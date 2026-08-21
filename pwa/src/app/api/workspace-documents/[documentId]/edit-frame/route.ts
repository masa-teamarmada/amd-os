import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { recordWorkspaceAuditEvent } from "@/lib/workspace-access-audit";
import { workspaceDocumentEditAgentSource } from "@/lib/workspace-document-edit-agent";
import { loadEditableWorkspaceHtmlDocument } from "@/lib/workspace-document-editing";
import { stashWorkspaceDocumentScripts } from "@/lib/workspace-document-html-editing";
import { WORKSPACE_DOCUMENT_HTML_PREVIEW_MAX_BYTES } from "@/lib/workspace-documents-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * 直接操作エディタのキャンバス。
 *
 * `sandbox allow-scripts` だけを渡し、**`allow-same-origin` は渡さない**。
 * フレームは不透明オリジンになるので、資料HTMLがまさのセッションのcookieやlocalStorage、
 * 親のDOMへ到達する経路が無い。代償として親とのpostMessageは origin が "null" になり、
 * 送信元をoriginで確かめられない。だから親が発行したtokenを受け取って埋め込み、
 * 全メッセージで照合する。tokenはhex32文字だけを通すので、そのままHTMLへ入れても本文を壊さない。
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!/^[0-9a-f]{32}$/.test(token)) {
    return json({ ok: false, error: "編集フレームのtokenが不正だよ。" }, 400);
  }

  const loaded = await loadEditableWorkspaceHtmlDocument(documentId);
  if (!loaded.ok) return json({ ok: false, error: loaded.error }, loaded.status);
  const { db, row, access, storageBucket, storagePath } = loaded;

  if (row.file_size_bytes > WORKSPACE_DOCUMENT_HTML_PREVIEW_MAX_BYTES) {
    return json({ ok: false, error: "HTMLプレビューは5MBまでだよ。" }, 413);
  }

  const download = await db.storage.from(storageBucket).download(storagePath);
  if (download.error || !download.data) {
    console.error("[workspace-documents] edit-frame download failed:", download.error?.message);
    return json({ ok: false, error: "HTML資料を読み込めなかったよ。" }, 500);
  }
  const source = Buffer.from(await download.data.arrayBuffer()).toString("utf8");

  // 資料側のJSをフレームで走らせる理由が無く、走らせると編集中のDOMを書き換えてしまう。
  // 捨てると資料が壊れるので、保存時に同じ位置へ戻せる形で預かる。
  const stashed = stashWorkspaceDocumentScripts(source);
  const nonce = randomBytes(16).toString("hex");
  const agent = workspaceDocumentEditAgentSource({ token }).replace(/<\/script/gi, "<\\/script");
  const tag = `<script nonce="${nonce}" data-amd-agent="1">${agent}</script>`;
  const closing = stashed.html.lastIndexOf("</body>");
  const html =
    closing >= 0
      ? `${stashed.html.slice(0, closing)}${tag}${stashed.html.slice(closing)}`
      : `${stashed.html}${tag}`;

  await recordWorkspaceAuditEvent(db, {
    eventType: "workspace_document_opened",
    userAccountId: access.accountId,
    email: access.accountId ? access.email : null,
    workspaceId: access.workspaceId,
    projectId: access.projectId,
    detail: { document_id: documentId, entry_kind: row.entry_kind, action: "edit_frame" },
  });

  return new NextResponse(html, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Security-Policy":
        `default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; ` +
        `img-src data: blob:; style-src 'unsafe-inline'; font-src data:; ` +
        `script-src 'nonce-${nonce}'; sandbox allow-scripts`,
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}
