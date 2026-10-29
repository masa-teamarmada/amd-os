/**
 * 支払通知書PDF閲覧API (/api/admin/payouts/pdf) の検査。
 *
 * 実行: npm run test:payout-notice-pdf-access
 * 正本: pwa/src/app/api/admin/payouts/pdf/route.ts
 *
 * 守るのは「管理者だけが、DBに保存された正規のDriveファイルだけを、改変なしで読める」規則。
 *   - 認証前にDB/Driveへ触れない
 *   - ym/memberId の形式チェックで弾く
 *   - DBに通知書が無ければ404
 *   - 保存URLが Drive の正規形式(認証情報なし・標準ポートのみ)以外なら拒否
 *   - Driveのファイル名が _memberId_ym の境界どおりでなければ拒否 (桁延びも拒否)
 *   - trashed/MIME不一致/サイズ超過/バイト列不一致はすべて拒否
 *   - 成功時はPDFバイトそのまま、Location無し、private,no-store
 *   - 読み取りは何度叩いても副作用なし
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

type Notice = { pdf_url: string | null } | null;
type DriveMeta = { name: string; mimeType: string; size: string; trashed: boolean };

let notice: Notice = null;
let dbWriteAttempted = false;
let authOk = true;
let authStatus = 401;
let driveMeta: DriveMeta | null = null;
let driveBytes: Buffer | null = null;
let driveGetCalls = 0;
let driveDownloadCalls = 0;

function resetState() {
  notice = null;
  dbWriteAttempted = false;
  authOk = true;
  authStatus = 401;
  driveMeta = null;
  driveBytes = null;
  driveGetCalls = 0;
  driveDownloadCalls = 0;
}

const adminClient = {
  from(table: string) {
    assert.equal(authOk, true, "DB must not be queried before admin authorization");
    assert.equal(table, "payout_notices");
    const builder = {
      select() {
        return builder;
      },
      eq() {
        return builder;
      },
      async maybeSingle() {
        return { data: notice, error: null };
      },
      async insert() {
        dbWriteAttempted = true;
        throw new Error("read-only route must not write");
      },
      async update() {
        dbWriteAttempted = true;
        throw new Error("read-only route must not write");
      },
    };
    return builder;
  },
};

const mocks: Record<string, unknown> = {
  "next/server": {
    NextResponse: {
      json: (body: unknown, init?: ResponseInit) =>
        new Response(JSON.stringify(body), init),
    },
  },
  googleapis: {
    google: {
      drive: () => ({
        files: {
          async get(args: Record<string, unknown>, opts?: { responseType?: string }) {
            if (opts?.responseType === "arraybuffer") {
              driveDownloadCalls++;
              if (!driveBytes) throw new Error("no bytes configured");
              return { data: driveBytes };
            }
            driveGetCalls++;
            if (!driveMeta) throw new Error("no metadata configured");
            return { data: { id: args.fileId, ...driveMeta } };
          },
        },
      }),
    },
  },
  "@/lib/supabase/api-auth": {
    async requireAdmin() {
      if (authOk) return { ok: true as const };
      return {
        ok: false as const,
        errorResponse: new Response(JSON.stringify({ error: "forbidden" }), { status: authStatus }),
      };
    },
  },
  "@/lib/supabase/admin": {
    createAdminClient: () => adminClient,
  },
  "@/lib/sources/google": {
    async getGoogleAuthAsync() {
      return {};
    },
  },
};

const source = ts.transpileModule(
  fs.readFileSync(new URL("../src/app/api/admin/payouts/pdf/route.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;

const exportedNames: string[] = [];
const moduleExports: Record<string, unknown> = {};
new Function("require", "exports", source)(
  (name: string) => {
    assert(name in mocks, `unexpected require: ${name}`);
    return mocks[name];
  },
  moduleExports,
);
for (const key of Object.keys(moduleExports)) exportedNames.push(key);

// Next.jsのroute moduleはGET/POST等のHTTPメソッドとruntime以外の値エクスポートを許さない。
assert.deepEqual(exportedNames.sort(), ["GET", "runtime"], "route module must only export GET and runtime");

const GET = moduleExports.GET as (req: { url: string }) => Promise<Response>;

function req(ym: string, memberId: string) {
  const params = new URLSearchParams({ ym, memberId });
  return { url: `https://example.com/api/admin/payouts/pdf?${params.toString()}` };
}

let failures = 0;
async function check(label: string, run: () => Promise<void>) {
  try {
    await run();
  } catch (err) {
    failures++;
    console.error(`✗ ${label} — ${err instanceof Error ? err.message : String(err)}`);
  }
}

const VALID_YM = "202501";
const MEMBER_ID = "ID003";
const TRUSTED_URL = "https://drive.google.com/file/d/abc123DEF/view";
const TRUSTED_NAME = `支払通知書_NOTICE1_${MEMBER_ID}_${VALID_YM}.pdf`;
const PDF_BYTES = Buffer.from("%PDF-1.4\n%%EOF");

function configureSuccess() {
  notice = { pdf_url: TRUSTED_URL };
  driveMeta = { name: TRUSTED_NAME, mimeType: "application/pdf", size: String(PDF_BYTES.length), trashed: false };
  driveBytes = PDF_BYTES;
}

await check("401 before DB/Drive when unauthenticated", async () => {
  resetState();
  authOk = false;
  authStatus = 401;
  const res = await GET(req(VALID_YM, MEMBER_ID));
  assert.equal(res.status, 401);
  assert.equal(driveGetCalls, 0);
});

await check("403 before DB/Drive when not admin", async () => {
  resetState();
  authOk = false;
  authStatus = 403;
  const res = await GET(req(VALID_YM, MEMBER_ID));
  assert.equal(res.status, 403);
  assert.equal(driveGetCalls, 0);
});

await check("400 on malformed ym", async () => {
  resetState();
  const res = await GET(req("2025013", MEMBER_ID));
  assert.equal(res.status, 400);
});

await check("400 on malformed memberId", async () => {
  resetState();
  const res = await GET(req(VALID_YM, "bad id!"));
  assert.equal(res.status, 400);
});

await check("404 when no notice stored", async () => {
  resetState();
  notice = null;
  const res = await GET(req(VALID_YM, MEMBER_ID));
  assert.equal(res.status, 404);
});

await check("rejects untrusted stored URL host", async () => {
  resetState();
  notice = { pdf_url: "https://evil.example.com/file/d/abc123DEF/view" };
  const res = await GET(req(VALID_YM, MEMBER_ID));
  assert.equal(res.status, 500);
  assert.equal(driveGetCalls, 0);
});

await check("rejects credentialed Drive URL", async () => {
  resetState();
  notice = { pdf_url: "https://user:pass@drive.google.com/file/d/abc123DEF/view" };
  const res = await GET(req(VALID_YM, MEMBER_ID));
  assert.equal(res.status, 500);
  assert.equal(driveGetCalls, 0);
});

await check("rejects nonstandard port Drive URL", async () => {
  resetState();
  notice = { pdf_url: "https://drive.google.com:8443/file/d/abc123DEF/view" };
  const res = await GET(req(VALID_YM, MEMBER_ID));
  assert.equal(res.status, 500);
  assert.equal(driveGetCalls, 0);
});

await check("rejects filename with digits extending ym", async () => {
  resetState();
  configureSuccess();
  driveMeta = {
    name: `支払通知書_NOTICE1_${MEMBER_ID}_${VALID_YM}9.pdf`,
    mimeType: "application/pdf",
    size: String(PDF_BYTES.length),
    trashed: false,
  };
  const res = await GET(req(VALID_YM, MEMBER_ID));
  assert.equal(res.status, 409);
});

await check("rejects mismatched identity filename", async () => {
  resetState();
  configureSuccess();
  driveMeta!.name = `支払通知書_NOTICE1_ID999_${VALID_YM}.pdf`;
  const res = await GET(req(VALID_YM, MEMBER_ID));
  assert.equal(res.status, 409);
});

await check("rejects non-PDF mimeType", async () => {
  resetState();
  configureSuccess();
  driveMeta!.mimeType = "application/octet-stream";
  const res = await GET(req(VALID_YM, MEMBER_ID));
  assert.equal(res.status, 409);
});

await check("rejects trashed file", async () => {
  resetState();
  configureSuccess();
  driveMeta!.trashed = true;
  const res = await GET(req(VALID_YM, MEMBER_ID));
  assert.equal(res.status, 409);
});

await check("413 when metadata size exceeds limit", async () => {
  resetState();
  configureSuccess();
  driveMeta!.size = String(5 * 1024 * 1024);
  const res = await GET(req(VALID_YM, MEMBER_ID));
  assert.equal(res.status, 413);
});

await check("502 when downloaded bytes do not match PDF signature", async () => {
  resetState();
  configureSuccess();
  driveBytes = Buffer.from("not a pdf");
  driveMeta!.size = String(driveBytes.length);
  const res = await GET(req(VALID_YM, MEMBER_ID));
  assert.equal(res.status, 502);
});

await check("502 when downloaded byte length does not match stored size", async () => {
  resetState();
  configureSuccess();
  driveMeta!.size = String(PDF_BYTES.length + 1);
  const res = await GET(req(VALID_YM, MEMBER_ID));
  assert.equal(res.status, 502);
});

await check("200 with exact PDF bytes, no Location, private no-store", async () => {
  resetState();
  configureSuccess();
  const res = await GET(req(VALID_YM, MEMBER_ID));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Location"), null);
  assert.equal(res.headers.get("Cache-Control"), "private, no-store");
  assert.equal(res.headers.get("Content-Type"), "application/pdf");
  const body = Buffer.from(await res.arrayBuffer());
  assert.deepEqual(body, PDF_BYTES);
});

await check("repeated GET stays read-only", async () => {
  resetState();
  configureSuccess();
  await GET(req(VALID_YM, MEMBER_ID));
  const res = await GET(req(VALID_YM, MEMBER_ID));
  assert.equal(res.status, 200);
  assert.equal(dbWriteAttempted, false);
});

const viewerSource = fs.readFileSync(
  new URL("../src/components/admin/AdminPayoutsClient.tsx", import.meta.url),
  "utf8",
);
assert.doesNotMatch(viewerSource, /href=\{(?:notice\.pdf_url|preview\.pdfUrl)\}/, "PDF viewer links must not navigate directly to Drive");
assert.match(viewerSource, /payoutNoticePdfViewUrl\(state\.ym, preview\.memberId\)/, "mail attachment preview uses captured payment month");

if (failures > 0) {
  console.error(`FAIL: ${failures} check(s) failed`);
  process.exit(1);
}
console.log(
  "PASS: admin-only / 404 missing notice / untrusted or credentialed or nonstandard-port Drive URL rejected / filename boundary enforced / trashed, MIME, oversize, byte-mismatch rejected / exact bytes served without Location / read-only on repeat",
);
