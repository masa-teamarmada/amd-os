import { NextResponse } from "next/server";
import { resolveDdPackageAccess } from "@/lib/dd-access";
import { hasDdCapability, isUuid } from "@/lib/dd-package-core";
import { loadDdItem, recordDdAccessEvent } from "@/lib/dd-package-server";
import { deliverDdDocument } from "@/lib/dd-sources";
import { ddDocumentPreview } from "@/lib/dd-payload";

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

  await recordDdAccessEvent(access, download ? "dd_file_downloaded" : "dd_file_opened", { itemId });

  if (delivery.mode === "html") {
    return new NextResponse(delivery.html, {
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

  const response = NextResponse.redirect(delivery.url, 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
