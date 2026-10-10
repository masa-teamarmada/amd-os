import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { unzipSync, strFromU8 } from "fflate";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { ddDisclosureZip, markDdWorkbook, DD_CONFIDENTIALITY_VERSION, DD_CONFIDENTIALITY_NOTICE } from "../src/lib/dd-confidentiality.ts";
import { ddContentHash, markDdHtml, markDdPdf, markDdImage } from "../src/lib/dd-confidentiality-server.ts";
import { createBusinessPlanPhaseMatrixXlsx } from "../src/lib/project-business-plan-xlsx.ts";

const original = new Uint8Array([0, 1, 2, 255, 4]);
const zipped = unzipSync(ddDisclosureZip(original, "../../開示通知.txt", "2026-10-08", ddContentHash(original)));
assert.deepEqual(zipped["原本/開示通知.txt"], original, "原本を変更しない／パストラバーサル・通知ファイル衝突を防ぐ");
assert.match(strFromU8(zipped["開示通知.txt"]), new RegExp(ddContentHash(original)));
assert.ok(strFromU8(zipped["開示通知.txt"]).includes(DD_CONFIDENTIALITY_NOTICE));
assert.equal(Object.keys(zipped).length, 3);
assert.match(strFromU8(zipped["開示通知.html"]), /color:#b91c1c/);
assert.match(strFromU8(zipped["開示通知.html"]), /CONFIDENTIAL/);
assert.ok(strFromU8(zipped["開示通知.html"]).includes(DD_CONFIDENTIALITY_NOTICE));
const escapedZip = unzipSync(ddDisclosureZip(original, '<script>alert(1)</script>.html', 'date', ddContentHash(original)));
assert.ok(!strFromU8(escapedZip['開示通知.html']).includes('<script>'), '通知HTML内の資料名を実行可能なHTMLにしない');
const workbook = createBusinessPlanPhaseMatrixXlsx([]);
const oldFiles = unzipSync(workbook), newFiles = unzipSync(markDdWorkbook(workbook));
assert.ok(strFromU8(newFiles["xl/workbook.xml"]).includes('name="開示通知"'));
assert.ok(strFromU8(newFiles["xl/worksheets/dd-disclosure.xml"]).includes(DD_CONFIDENTIALITY_NOTICE));
assert.match(strFromU8(newFiles["xl/styles.xml"]), /<b\/><color rgb="FFB91C1C"\/><sz val="18"/);
assert.equal(strFromU8(newFiles['xl/styles.xml']).replace(/<fonts count="\d+"/, '<fonts').split('</fonts>')[0].split('<font>').slice(1, -1).join('<font>'), strFromU8(oldFiles['xl/styles.xml']).replace(/<fonts count="\d+"/, '<fonts').split('</fonts>')[0].split('<font>').slice(1).join('<font>'), '既存のフォント順序と内容を保持');
assert.match(strFromU8(newFiles["xl/worksheets/sheet1.xml"]), /&amp;KB91C1CCONFIDENTIAL/);
assert.equal(strFromU8(newFiles["xl/worksheets/sheet1.xml"]).replace(/<headerFooter>[\s\S]*?<\/headerFooter>/, ""), strFromU8(oldFiles["xl/worksheets/sheet1.xml"]), "元の表・数値・セル参照を保持");
const html = '<!doctype html><html><body class="source"><h1>ORIGINAL</h1></body></html>';
assert.ok(markDdHtml(html).includes('<h1>ORIGINAL</h1>'));
assert.ok(markDdHtml(html).indexOf('data-dd-confidentiality') < markDdHtml(html).indexOf('<h1>'));
assert.match(markDdHtml(html), /color:#b91c1c!important/);
const pdf = await PDFDocument.create();
const font = await pdf.embedFont(StandardFonts.Helvetica);
pdf.addPage([600, 800]).drawText("ORIGINAL", { x: 30, y: 760, font });
const pdfBytes = await pdf.save();
const marked = await PDFDocument.load(await markDdPdf(pdfBytes));
assert.equal(marked.getPageCount(), 1);
assert.equal(marked.getPages()[0].getHeight(), 828, "本文を覆わず秘密表示の余白を追加");
assert.equal(marked.getSubject(), DD_CONFIDENTIALITY_NOTICE);
const sharp = (await import("sharp")).default;
const png = await sharp({ create: { width: 400, height: 300, channels: 3, background: 'white' } }).png().toBuffer();
const image = await markDdImage(png, "image/png");
assert.match(Buffer.from(image).toString(), /秘密情報/);
assert.match(Buffer.from(image).toString(), /fill="#b91c1c">CONFIDENTIAL/);
assert.ok(Buffer.from(image).toString().includes(png.toString("base64")), "元画像の実体を保持");

// 実routeを依存先だけ置き換えて実行し、権限・CSRF・失敗時の閉鎖を検査する。
function route(path: string, mocks: Record<string, unknown>) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const output: Record<string, Function> = {};
  new Function("require", "exports", compiled.outputText)((name: string) => { assert.ok(name in mocks, name); return mocks[name]; }, output);
  return output;
}
let access: any = null, audit: any[] = [], sameOrigin = true, failAudit = false;
const confirmRoute = route("../src/app/dd/[slug]/confidentiality/route.ts", {
  "next/server": { NextResponse: Response },
  "@/lib/dd-access": { resolveDdPackageAccess: async () => access },
  "@/lib/dd-package-server": { recordDdAccessEvent: async (...args: any[]) => { if (failAudit) throw new Error('fail'); audit.push(args); } },
  "@/lib/dd-confidentiality": { DD_CONFIDENTIALITY_VERSION },
  "@/lib/workspace-mutation-origin": { isSameOriginWorkspaceMutation: () => sameOrigin },
});
const context = { params: Promise.resolve({ slug: 'test' }) };
const request = (version = DD_CONFIDENTIALITY_VERSION) => new Request('https://test/dd/test/confidentiality', { method: 'POST', body: JSON.stringify({ noticeVersion: version }) });
assert.equal((await confirmRoute.POST(request(), context)).status, 404);
assert.equal(audit.length, 0);
access = { principal: 'workspace_account', packageId: 'package', projectId: 'p21' };
sameOrigin = false;
assert.equal((await confirmRoute.POST(request(), context)).status, 403);
assert.equal(audit.length, 0);
sameOrigin = true;
assert.equal((await confirmRoute.POST(request('old'), context)).status, 400);
assert.equal((await confirmRoute.POST(request(), context)).status, 200);
assert.equal(audit[0][1], 'dd_confidentiality_confirmed');
failAudit = true;
assert.equal((await confirmRoute.POST(request(), context)).status, 500, '保存失敗を確認済みとして返さない');

let item: any = { package_id: 'package', project_id: 'p21', status: 'active', item_kind: 'document', is_published: true, updated_at: '2026-10-08', source_key: 'source' };
let deliveryCalls = 0, downloadAllowed = false;
let delivery: any = { mode: "html", html, fileName: "原本.html" };
const fileRoute = route('../src/app/dd/[slug]/items/[itemId]/file/route.ts', {
  'next/server': { NextResponse: Response },
  '@/lib/dd-access': { resolveDdPackageAccess: async () => access },
  '@/lib/dd-package-core': { isUuid: () => true, hasDdCapability: () => downloadAllowed },
  '@/lib/dd-package-server': { loadDdItem: async () => item, recordDdAccessEvent: async (...args: any[]) => { audit.push(args); } },
  '@/lib/dd-sources': { DD_FILE_MAX_BYTES: 100 * 1024 * 1024, DD_FILE_CACHE_BUCKET: 'cache', deliverDdDocument: async () => { deliveryCalls++; return delivery; } },
  '@/lib/dd-payload': { ddDocumentPreview: () => 'html' },
  '@/lib/dd-confidentiality': { ddDisclosureZip, DD_CONFIDENTIALITY_VERSION },
  '@/lib/dd-confidentiality-server': { ddContentHash, markDdHtml, markDdImage, markDdPdf },
  '@/lib/supabase/admin': { createAdminClient: () => { throw new Error('unexpected write'); } },
});
const fileContext = { params: Promise.resolve({ slug: 'test', itemId: 'id' }) };
const fileRequest = (download = false) => new Request('https://test/dd/test/items/id/file' + (download ? '?download=1' : ''));
access = null;
assert.equal((await fileRoute.GET(fileRequest(), fileContext)).status, 404);
access = { principal: 'workspace_account', packageId: 'package', projectId: 'p21' };
item.package_id = 'other';
assert.equal((await fileRoute.GET(fileRequest(), fileContext)).status, 404);
item.package_id = 'package'; item.is_published = false;
assert.equal((await fileRoute.GET(fileRequest(), fileContext)).status, 404);
item.is_published = true;
assert.equal((await fileRoute.GET(fileRequest(true), fileContext)).status, 403);
assert.equal(deliveryCalls, 0, '認可前に資料実体を取得しない');
const delivered = await fileRoute.GET(fileRequest(), fileContext);
assert.equal(delivered.status, 200);
assert.match(await delivered.text(), /data-dd-confidentiality/);
assert.match(delivered.headers.get('content-security-policy')!, /sandbox/);
assert.equal(audit.at(-1)[2].contentHash, ddContentHash(html));
console.log('DD confidentiality: original bytes, notice/versions, Excel cells, PDF geometry, image content, actual receipt/file routes and denied access OK');

// ダウンロードの実応答は通知付きZIPで、失効・巨大ファイルを原本へ迂回させない。
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => new Response(original);
delivery = { mode: 'signed_url', url: 'https://storage.invalid/private', fileName: '原本.bin', mimeType: 'application/octet-stream' };
downloadAllowed = true;
try {
  const zipResponse = await fileRoute.GET(fileRequest(true), fileContext);
  assert.equal(zipResponse.status, 200);
  assert.equal(zipResponse.headers.get('content-type'), 'application/zip');
  const payload = unzipSync(new Uint8Array(await zipResponse.arrayBuffer()));
  assert.deepEqual(payload['原本/原本.bin'], original);
  assert.ok(strFromU8(payload['開示通知.txt']).includes(ddContentHash(original)));
  assert.equal(audit.at(-1)[1], 'dd_file_downloaded');
  globalThis.fetch = async () => new Response('', { headers: { 'content-length': String(101 * 1024 * 1024) } });
  assert.equal((await fileRoute.GET(fileRequest(true), fileContext)).status, 500);
  access = null;
  assert.equal((await fileRoute.GET(fileRequest(true), fileContext)).status, 404);
} finally { globalThis.fetch = originalFetch; }
console.log('DD file delivery: real notification ZIP, SHA/readback, oversized body and revoked access fail closed OK');
