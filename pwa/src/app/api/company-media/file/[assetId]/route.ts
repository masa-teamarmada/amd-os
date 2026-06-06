import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ assetId: string }>;
}

type FileVariant = "thumb" | "original";

type CachedFile = {
  signedUrl: string;
  expiresAt: number;
};

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;
const CACHE_SKEW_MS = 5 * 60 * 1000;

const mediaFileCache = (() => {
  const globalScope = globalThis as typeof globalThis & {
    __amdCompanyMediaFileCache?: Map<string, CachedFile>;
  };
  if (!globalScope.__amdCompanyMediaFileCache) {
    globalScope.__amdCompanyMediaFileCache = new Map<string, CachedFile>();
  }
  return globalScope.__amdCompanyMediaFileCache;
})();

export async function GET(req: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const { assetId } = await context.params;
  if (!assetId) {
    return NextResponse.json({ ok: false, error: "assetId is required" }, { status: 400 });
  }

  const url = new URL(req.url);
  const variant = url.searchParams.get("variant") === "original" ? "original" : "thumb";
  const cacheKey = `${assetId}:${variant}`;
  const cached = mediaFileCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now + CACHE_SKEW_MS) {
    return redirectToSignedUrl(cached.signedUrl);
  }

  const admin = createAdminClient();
  const { data: asset, error } = await admin
    .from("media_assets")
    .select("storage_bucket,storage_path,thumbnail_path")
    .eq("asset_id", assetId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  const filePath = pathForVariant(
    variant,
    typeof asset?.storage_path === "string" ? asset.storage_path : null,
    typeof asset?.thumbnail_path === "string" ? asset.thumbnail_path : null,
  );
  if (!filePath) {
    return NextResponse.json({ ok: false, error: "asset file not found" }, { status: 404 });
  }

  const { data, error: signError } = await admin.storage
    .from(String(asset?.storage_bucket || "company-media"))
    .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS);

  if (signError || !data?.signedUrl) {
    return NextResponse.json({ ok: false, error: signError?.message || "signed URL failed" }, { status: 500 });
  }

  mediaFileCache.set(cacheKey, {
    signedUrl: data.signedUrl,
    expiresAt: now + SIGNED_URL_TTL_SECONDS * 1000,
  });
  return redirectToSignedUrl(data.signedUrl);
}

function pathForVariant(variant: FileVariant, storagePath: string | null, thumbnailPath: string | null) {
  if (variant === "original") return storagePath;
  return thumbnailPath || storagePath;
}

function redirectToSignedUrl(signedUrl: string) {
  return NextResponse.redirect(signedUrl, {
    headers: {
      "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
