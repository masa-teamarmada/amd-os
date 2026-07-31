import { createSignedAccessUrl } from "../lib/blobStore.mjs";
import { isHtmlFileName, MAX_PDF_BYTES, pdfDownloadName, renderHtmlToPdf } from "../lib/htmlPdf.mjs";
import { isSameOrigin } from "../lib/origin.mjs";
import { isWithinFilesPrefix } from "../lib/pathGuard.mjs";
import { readJsonBody } from "../lib/body.mjs";
import { sendJson, sendText } from "../lib/respond.mjs";

const MAX_HTML_BYTES = 8 * 1024 * 1024;

export async function handlePdfRoute(
  req,
  res,
  {
    isAuthed,
    createSignedAccessUrlFn = createSignedAccessUrl,
    fetchFn = fetch,
    renderHtmlToPdfFn = renderHtmlToPdf,
  }
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    sendText(res, 405, "Method Not Allowed");
    return;
  }

  if (!isAuthed) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  if (!isSameOrigin(req)) {
    sendJson(res, 403, { error: "cross-origin request rejected" });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: "invalid JSON body" });
    return;
  }

  const pathname = typeof body.pathname === "string" ? body.pathname : null;
  const name = pathname?.split("/").at(-1);
  if (!pathname || !isWithinFilesPrefix(pathname) || !isHtmlFileName(name)) {
    sendJson(res, 400, { error: "invalid HTML pathname" });
    return;
  }

  try {
    const { url } = await createSignedAccessUrlFn(pathname, { download: false });
    const upstream = await fetchFn(url);
    const contentLength = Number(upstream.headers.get("content-length"));
    if (!upstream.ok) {
      sendJson(res, 502, { error: "failed to read file" });
      return;
    }
    if (Number.isFinite(contentLength) && contentLength > MAX_HTML_BYTES) {
      sendJson(res, 413, { error: "HTML document is too large to convert" });
      return;
    }

    const html = Buffer.from(await upstream.arrayBuffer());
    if (html.byteLength > MAX_HTML_BYTES) {
      sendJson(res, 413, { error: "HTML document is too large to convert" });
      return;
    }

    const pdf = await renderHtmlToPdfFn(html.toString("utf8"));
    if (pdf.byteLength > MAX_PDF_BYTES) {
      sendJson(res, 413, { error: "PDF is too large to download" });
      return;
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(pdfDownloadName(name))}`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Length", String(pdf.byteLength));
    res.end(pdf);
  } catch {
    sendJson(res, 502, { error: "failed to generate PDF" });
  }
}
