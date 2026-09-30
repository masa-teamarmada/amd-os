import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveDdPackageAccess } from "@/lib/dd-access";
import { hasDdCapability, isUuid } from "@/lib/dd-package-core";
import { loadDdPublicationFile, loadDdPublishedItem, recordDdAccessEvent } from "@/lib/dd-package-server";
import { DD_PUBLICATION_BUCKET } from "@/lib/dd-sources";
import { ddDocumentPreview } from "@/lib/dd-payload";
import { WORKSPACE_DOCUMENT_HTML_PREVIEW_MAX_BYTES, withWorkspaceDownloadFileName } from "@/lib/workspace-documents-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DDの添付（公開時点で固定したファイル）を開く・ダウンロードする。
//   - 毎リクエストでパッケージの閲覧権限を DB で確かめ直す（停止・失効・期限切れ・受付終了はここで止まる）。
//   - 公開中の資料項目の、いま外部に見せている版のファイルだけを返す。古い版・取り下げた版は返さない。
//   - ?download=1 は dd.download を持つ人だけ。表示（HTML / PDF / 画像）は dd.view で足りる。
//   - HTML はスクリプト・外部通信・フォーム送信を止めたサンドボックスで返す。PDF・画像・ダウンロードは60秒の署名URLへ送る。

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

  const loaded = await loadDdPublishedItem(access.packageId, itemId);
  if (!loaded || loaded.item.publication.item_kind !== "document") return notFound();
  const publication = loaded.item.publication;

  const download = new URL(request.url).searchParams.get("download") === "1";
  if (download && !hasDdCapability(access, "dd.download")) {
    return NextResponse.json(
      { ok: false, error: "この資料のダウンロード権限は付与されていない。" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const file = await loadDdPublicationFile(publication.id);
  if (!file) return notFound();
  const preview = ddDocumentPreview(file.mimeType, file.fileName);
  if (!download && !preview) {
    // 画面で表示できない形式（Excel・PowerPoint 等）は、ダウンロードとしてだけ扱う。
    return NextResponse.json(
      { ok: false, error: "この形式は画面で開けない。ダウンロードで受け取る。" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const db = createAdminClient();

  if (!download && preview === "html") {
    if (file.sizeBytes > WORKSPACE_DOCUMENT_HTML_PREVIEW_MAX_BYTES) {
      return NextResponse.json(
        { ok: false, error: "このHTMLは画面表示の上限（5MB）を超えている。ダウンロードで受け取る。" },
        { status: 413, headers: { "Cache-Control": "no-store" } },
      );
    }
    const { data, error } = await db.storage.from(DD_PUBLICATION_BUCKET).download(file.storagePath);
    if (error || !data) {
      console.error("[dd] html load failed:", error?.message ?? "no data");
      return NextResponse.json({ ok: false, error: "資料を開けなかった。" }, { status: 500, headers: { "Cache-Control": "no-store" } });
    }
    await recordDdAccessEvent(access, "dd_file_opened", { itemId, publicationId: publication.id, revision: publication.revision });
    return new NextResponse(await data.text(), {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": `inline; filename*=UTF-8''${contentDispositionFilename(file.fileName)}`,
        "Content-Security-Policy":
          "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; img-src data:; style-src 'unsafe-inline'; font-src data:; sandbox",
        "Content-Type": "text/html; charset=utf-8",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const { data: signed, error: signedError } = await db.storage
    .from(DD_PUBLICATION_BUCKET)
    .createSignedUrl(file.storagePath, 60);
  if (signedError || !signed?.signedUrl) {
    console.error("[dd] signed read failed:", signedError?.message ?? "no url");
    return NextResponse.json({ ok: false, error: "資料を開けなかった。" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }

  await recordDdAccessEvent(access, download ? "dd_file_downloaded" : "dd_file_opened", {
    itemId,
    publicationId: publication.id,
    revision: publication.revision,
  });

  const destination = download ? withWorkspaceDownloadFileName(signed.signedUrl, file.fileName) : signed.signedUrl;
  const response = NextResponse.redirect(destination, 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
