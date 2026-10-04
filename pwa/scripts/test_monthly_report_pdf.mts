import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { renderMonthlyReportPdf } from "../src/lib/monthly-report-pdf-render.ts";

// Exercise actual Chromium, streamed SSR visibility, Japanese fonts and network isolation.
let remoteRequests = 0;
const server = createServer((_req, res) => { remoteRequests += 1; res.end("unexpected"); });
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const address = server.address();
  assert(address && typeof address !== "string");
  const chrome = process.env.MONTHLY_REPORT_CHROME_PATH || (process.platform === "darwin" && existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome") ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : undefined);
  const html = `<html><head><style>@page{size:A4;margin:14mm}@media print{.no-print{display:none}}</style></head><body>
  <script>document.body.replaceChildren()</script><div hidden><div class="print-root"><div class="no-print">編集履歴</div>
  <main class="submission-sheet"><h1>月次業務報告書</h1><p>2026年9月の実施内容</p><img src="http://127.0.0.1:${address.port}/external"></main></div></div></body></html>`;
  const pdf = await renderMonthlyReportPdf(html, chrome);
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert(pdf.length > 10_000, "日本語fontを含むPDFを生成する");
  assert.equal(remoteRequests, 0, "文書内の外部assetへ接続しない");
  await assert.rejects(renderMonthlyReportPdf("<html><body>missing report</body></html>", chrome), /紙面/);
  console.log("monthly report PDF rendering: ok");
} finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
