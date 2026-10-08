import { NextResponse } from "next/server";
import { resolveDdPackageAccess } from "@/lib/dd-access";
import { hasDdCapability, isUuid } from "@/lib/dd-package-core";
import { loadDdItem, recordDdAccessEvent } from "@/lib/dd-package-server";
import { deliverDdDocument } from "@/lib/dd-sources";
import { ddDocumentPreview } from "@/lib/dd-payload";
import { ddDisclosureZip } from "@/lib/dd-confidentiality";
import { ddContentHash, markDdHtml, markDdImage, markDdPdf } from "@/lib/dd-confidentiality-server";
import { DD_FILE_MAX_BYTES, DD_FILE_CACHE_BUCKET } from "@/lib/dd-sources";
import { createAdminClient } from "@/lib/supabase/admin";
import { DD_CONFIDENTIALITY_VERSION } from "@/lib/dd-confidentiality";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// DDの資料（資料室の最新のファイル）を開く・ダウンロードする。
//   - 毎リクエストでパッケージの閲覧権限を DB で確かめ直す（停止・失効・期限切れ・受付終了はここで止まる）。
//   - 閲覧者には公開中の資料項目だけを返す。管理者のプレビューは未公開の資料も開ける。
//   - ?download=1 は dd.download を持つ人だけ。表示（HTML / PDF / 画像）は dd.view で足りる。
//   - HTML はスクリプト・外部通信・フォーム送信を止めたサンドボックスで返す（next.config.ts の
//     ddPublicationFileSecurityHeaders が全体の CSP を上書きする）。それ以外は60秒の署名URLへ送る。

function notFound() {
  return NextResponse.json({ ok: false, error: "Not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
}

function contentDispositionFilename(name: string) {
  return encodeURIComponent(name).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; itemId: string }> },
) {
  const { slug, itemId } = await params;
  if (!isUuid(itemId)) return notFound();
  const access = await resolveDdPackageAccess(slug);
  if (!access) return notFound();

  const item = await loadDdItem(itemId);
  if (!item || item.package_id !== access.packageId || item.status !== "active" || item.item_kind !== "document") return notFound();
  if (!item.is_published && access.principal !== "internal_admin") return notFound();

  const download = new URL(request.url).searchParams.get("download") === "1";
  if (download && !hasDdCapability(access, "dd.download")) {
    return NextResponse.json(
      { ok: false, error: "この資料のダウンロード権限は付与されていない。" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const delivery = await deliverDdDocument({
    projectId: item.project_id,
    sourceKey: item.source_key,
    packageId: item.package_id,
    download,
  }).catch((error: unknown) => {
    console.error("[dd] document delivery failed:", error instanceof Error ? error.message : String(error));
    return { mode: "error" as const, status: 500, message: "資料を開けなかった。" };
  });

  if (delivery.mode === "error") {
    return NextResponse.json({ ok: false, error: delivery.message }, { status: delivery.status, headers: { "Cache-Control": "no-store" } });
  }

  if (!download && delivery.mode === "signed_url") {
    // 画面で表示できない形式（Excel・PowerPoint 等）は、ダウンロードとしてだけ扱う。
    const preview = ddDocumentPreview(delivery.mimeType, delivery.fileName);
    if (!preview) {
      return NextResponse.json(
        { ok: false, error: "この形式は画面で開けない。ダウンロードで受け取る。" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  if (delivery.mode === "html") {
    await recordDdAccessEvent(access, "dd_file_opened", { itemId, contentHash: ddContentHash(delivery.html) });
    return new NextResponse(markDdHtml(delivery.html), {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": `inline; filename*=UTF-8''${contentDispositionFilename(delivery.fileName)}`,
        "Content-Security-Policy":
          "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; img-src data:; style-src 'unsafe-inline'; font-src data:; sandbox",
        "Content-Type": "text/html; charset=utf-8",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  // Storage署名URLは利用者へ返さず、この認可済み応答に秘密指定を付けて渡す。
  // 上流URLはdeliverDdDocumentが生成したものだけ。原本の保存先・内容は変更しない。
  try {
    const upstream = await fetch(delivery.url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20_000) });
    if (!upstream.ok || Number(upstream.headers.get("content-length") ?? 0) > DD_FILE_MAX_BYTES) throw new Error("source_unavailable");
    const reader = upstream.body?.getReader();
    if (!reader) throw new Error("empty_source");
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > DD_FILE_MAX_BYTES) { await reader.cancel(); throw new Error("source_too_large"); }
      chunks.push(value);
    }
    const bytes = Buffer.concat(chunks);
    const contentHash = ddContentHash(bytes);
    const preview = ddDocumentPreview(delivery.mimeType, delivery.fileName);
    const output = download ? ddDisclosureZip(bytes, delivery.fileName, new Date().toISOString(), contentHash)
      : preview === "pdf" ? await markDdPdf(bytes)
      : preview === "image" ? await markDdImage(bytes, delivery.mimeType)
      : null;
    if (!output) throw new Error("unsupported_preview");
    const fileName = download ? `${delivery.fileName}_開示通知付き.zip` : preview === "image" ? `${delivery.fileName}.svg` : delivery.fileName;
    const mimeType = download ? "application/zip" : preview === "image" ? "image/svg+xml" : "application/pdf";
    // PDFはHTML用sandboxから分離してブラウザのPDFビューアで開く。
    // Vercel Function応答上限を超える生成物もprivate bucketへ置く。
    // 署名先は必ず秘密表示付きの写し／通知付きZIPで、原本へのURLは返さない。
    if ((!download && preview === "pdf") || output.byteLength > 3 * 1024 * 1024) {
      const storage = createAdminClient().storage.from(DD_FILE_CACHE_BUCKET);
      const path = `disclosures/${access.packageId}/${itemId}/${DD_CONFIDENTIALITY_VERSION}/${ddContentHash(output)}`;
      const uploaded = await storage.upload(path, output, { contentType: mimeType, upsert: false });
      if (uploaded.error && !/exists|duplicate/i.test(uploaded.error.message)) throw new Error("marked_copy_failed");
      const signed = await storage.createSignedUrl(path, 60, download ? { download: fileName } : undefined);
      if (signed.error || !signed.data?.signedUrl) throw new Error("marked_copy_url_failed");
      await recordDdAccessEvent(access, download ? "dd_file_downloaded" : "dd_file_opened", { itemId, contentHash });
      const response = NextResponse.redirect(signed.data.signedUrl, 303);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
    await recordDdAccessEvent(access, download ? "dd_file_downloaded" : "dd_file_opened", { itemId, contentHash });
    return new NextResponse(Buffer.from(output), { headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${contentDispositionFilename(fileName)}`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    } });
  } catch {
    return NextResponse.json({ ok: false, error: "秘密表示付きの資料を作成できなかった。画面を開き直して再試行する。" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
