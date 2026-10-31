// /bzm 配下の振り分け（src/lib/bzm-reader/hosts.ts）の検査。
// OS では本・論文・理論マップを表示せず、/bzm 配下はすべて書斎へ送る（2026-10-31）。仕様は spec 2-1。
// Run: npm run test:bzm-redirects
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { AMD_OS_HOST, SHOSAI_HOST, isShosaiHost, readerHostRedirect } from "../src/lib/bzm-reader/hosts.ts";

const at = (u: string) => new URL(u);
const shelf = `https://${SHOSAI_HOST}/bzm/read`;

// 書斎のアドレス: `/` は棚へ、書斎とログインは通し、それ以外は AMD OS へ
assert.equal(readerHostRedirect(at(`https://${SHOSAI_HOST}/`), SHOSAI_HOST), shelf);
assert.equal(readerHostRedirect(at(`https://${SHOSAI_HOST}/bzm/read`), SHOSAI_HOST), null);
assert.equal(readerHostRedirect(at(`https://${SHOSAI_HOST}/bzm/read/bzm30-textbook/x?at=end`), SHOSAI_HOST), null);
assert.equal(readerHostRedirect(at(`https://${SHOSAI_HOST}/auth/login?next=%2Fbzm%2Fread`), SHOSAI_HOST), null);
assert.equal(readerHostRedirect(at(`https://${SHOSAI_HOST}/auth/callback?code=1`), SHOSAI_HOST), null);
assert.equal(readerHostRedirect(at(`https://${SHOSAI_HOST}/dashboard`), SHOSAI_HOST), `https://${AMD_OS_HOST}/dashboard`);
// 大文字やポート付きの Host でも同じ
assert.equal(readerHostRedirect(at(`https://${SHOSAI_HOST}/`), `Bookshelf-Armada.vercel.app:443`), shelf);

// AMD OS のアドレス: 書斎は同じパスのまま書斎のアドレスへ
assert.equal(readerHostRedirect(at(`https://${AMD_OS_HOST}/bzm/read/book-a?x=1`), AMD_OS_HOST), `https://${SHOSAI_HOST}/bzm/read/book-a?x=1`);
assert.equal(readerHostRedirect(at(`https://${AMD_OS_HOST}/bzm/read`), AMD_OS_HOST), shelf);
// それ以外の /bzm 配下（教科書の入口・章、旧ナラティブ版、理論マップ）は書斎の本棚へ
for (const p of ["/bzm", "/bzm/", "/bzm/book-a-ch-1?x=1", "/bzm/readme", "/bzm/public", "/bzm/public/00-prologue", "/bzm/map", "/bzm/map/"]) {
  assert.equal(readerHostRedirect(at(`https://${AMD_OS_HOST}${p}`), AMD_OS_HOST), shelf, p);
}
// /bzm で始まるだけの別の画面は触らない
assert.equal(readerHostRedirect(at(`https://${AMD_OS_HOST}/bzmx`), AMD_OS_HOST), null);
assert.equal(readerHostRedirect(at(`https://${AMD_OS_HOST}/dashboard`), AMD_OS_HOST), null);
assert.equal(readerHostRedirect(at(`https://${AMD_OS_HOST}/model/bzm-2-2-strategic-slack-and-propulsion`), AMD_OS_HOST), null);

// その他のアドレス（プレビュー、手元の開発）は振り分けない
assert.equal(readerHostRedirect(at("http://localhost:3000/bzm/read"), "localhost:3000"), null);
assert.equal(readerHostRedirect(at("https://amd-os-abc123-armada0130.vercel.app/bzm/map"), "amd-os-abc123-armada0130.vercel.app"), null);

// ログイン画面の出し分け
assert.equal(isShosaiHost(SHOSAI_HOST), true);
assert.equal(isShosaiHost("BOOKSHELF-ARMADA.vercel.app:443"), true);
assert.equal(isShosaiHost(AMD_OS_HOST), false);
assert.equal(isShosaiHost(null), false);

// /bzm 配下の画面と API を OS に戻さない。振り分けは middleware が認証より前に行うので、画面が無くても届く。
for (const dir of ["src/app/(app)/bzm", "src/app/api/bzm", "src/app/api/bzm-reader", "src/components/bzm-reader"]) {
  assert.ok(!fs.existsSync(path.resolve(process.cwd(), dir)), `${dir} が復活している（OS では本・論文・理論マップを表示しない）`);
}
const middleware = fs.readFileSync(path.resolve(process.cwd(), "src/middleware.ts"), "utf8");
assert.ok(middleware.includes("readerHostRedirect("), "middleware が /bzm 配下の振り分けを呼んでいない");

console.log("check_bzm_redirects: ok");
