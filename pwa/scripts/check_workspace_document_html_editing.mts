/**
 * 直接操作エディタの往復契約テスト。
 *
 * 「編集して保存したら資料のJSが消えた」「DOCTYPEが落ちた」は保存した本人には見えない。
 * 画面で気づけない壊れ方なので、往復一致をここで固定する。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  restoreWorkspaceDocumentScripts,
  stashWorkspaceDocumentScripts,
  withWorkspaceDocumentDoctype,
  workspaceDocumentDeckSaveSource,
  workspaceDocumentDoctype,
  workspaceDocumentScriptPlaceholder,
  workspaceDocumentScriptToken,
} from "../src/lib/workspace-document-html-editing.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath: string) => readFileSync(join(root, relativePath), "utf8");

// ---------------------------------------------------------------------------
// 1. script の退避と復元 — 触っていないHTMLは1バイトも変わらない
// ---------------------------------------------------------------------------

const roundTrip = (html: string) => {
  const stashed = stashWorkspaceDocumentScripts(html);
  return restoreWorkspaceDocumentScripts(stashed.html, stashed.scripts, stashed.token);
};

const plain = "<!DOCTYPE html><html><body><h1>見出し</h1></body></html>";
assert.equal(roundTrip(plain), plain, "scriptの無い資料が変化した");

const withScript = `<!DOCTYPE html>
<html>
  <head><script src="a.js"></script></head>
  <body>
    <p>本文</p>
    <script>
      const a = 1 < 2;
      document.title = "x";
    </script>
  </body>
</html>`;
assert.equal(roundTrip(withScript), withScript, "scriptの往復で内容が変わった");

// フレームへ渡す側にはscriptの中身が残っていない。残っていたら実行される。
const stashed = stashWorkspaceDocumentScripts(withScript);
assert.equal(stashed.scripts.length, 2);
assert.doesNotMatch(stashed.html, /<script/i, "退避後にscriptタグが残っている");
assert.ok(!stashed.html.includes("document.title"), "退避後にscript本文が残っている");
assert.ok(stashed.html.includes(workspaceDocumentScriptPlaceholder(stashed.token, 0)));
assert.ok(stashed.html.includes(workspaceDocumentScriptPlaceholder(stashed.token, 1)));

// 属性・大文字・閉じタグの空白ゆれ。ここを取りこぼすと生のJSがフレームで走る。
const messy = `<SCRIPT type="module" defer>let x=1;</SCRIPT ><script></script><script src="b.js"/>`;
const messyStash = stashWorkspaceDocumentScripts(messy);
assert.equal(messyStash.scripts.length, 3, "大文字・空文字・自己閉じのscriptを取りこぼした");
assert.doesNotMatch(messyStash.html, /<script/i);
assert.equal(roundTrip(messy), messy);

// `</script>` を含む文字列を持つscript。HTMLの仕様上ここでscriptは終わる。
const nested = `<script>const s = "</script>";</script><p>後ろ</p>`;
assert.equal(roundTrip(nested), nested);

// ---------------------------------------------------------------------------
// 2. プレースホルダの衝突 — 資料側に同じ形のコメントがあっても壊れない
// ---------------------------------------------------------------------------

assert.equal(workspaceDocumentScriptToken("<p>ふつう</p>"), "s");
const collides = `<!--amd:script:s:0--><script>alert(1)</script>`;
const collideToken = workspaceDocumentScriptToken(collides);
assert.notEqual(collideToken, "s", "既に使われているトークンをそのまま使った");
assert.equal(roundTrip(collides), collides, "衝突する資料で往復が壊れた");
assert.equal(workspaceDocumentScriptToken("<!--amd:script:s:0--><!--amd:script:ss:0-->"), "sss");

// ---------------------------------------------------------------------------
// 3. 編集で消えたブロック — 位置の推測で資料を壊さない
// ---------------------------------------------------------------------------

const twoScripts = stashWorkspaceDocumentScripts(`<div><script>A()</script></div><div><script>B()</script></div>`);
// 1つ目のブロックごと消された想定。残った2つ目だけが戻る。
const edited = twoScripts.html.replace(`<div>${workspaceDocumentScriptPlaceholder(twoScripts.token, 0)}</div>`, "");
const restored = restoreWorkspaceDocumentScripts(edited, twoScripts.scripts, twoScripts.token);
assert.ok(!restored.includes("A()"), "削除されたscriptが復活した");
assert.ok(restored.includes("B()"), "残っているscriptが消えた");
assert.doesNotMatch(restored, /amd:script:/, "プレースホルダが本文に残った");

// 範囲外の番号は書き戻さない。壊れた入力でscripts[0]を撃ち込まない。
const outOfRange = restoreWorkspaceDocumentScripts(
  workspaceDocumentScriptPlaceholder(twoScripts.token, 99),
  twoScripts.scripts,
  twoScripts.token,
);
assert.equal(outOfRange, workspaceDocumentScriptPlaceholder(twoScripts.token, 99));
// トークンが違えば何も戻さない。別リクエストの退避結果を混ぜない。
assert.equal(
  restoreWorkspaceDocumentScripts(workspaceDocumentScriptPlaceholder("zz", 0), twoScripts.scripts, twoScripts.token),
  workspaceDocumentScriptPlaceholder("zz", 0),
);

// ---------------------------------------------------------------------------
// 4. DOCTYPE — シリアライズで落ちる分を戻す
// ---------------------------------------------------------------------------

assert.equal(workspaceDocumentDoctype("<!DOCTYPE html>\n<html></html>"), "<!DOCTYPE html>");
assert.equal(workspaceDocumentDoctype("  \n<!doctype html><html></html>"), "<!doctype html>");
assert.equal(workspaceDocumentDoctype("<html></html>"), null);
// 先頭以外のDOCTYPE風文字列を拾わない。
assert.equal(workspaceDocumentDoctype("<p><!DOCTYPE html></p>"), null);

assert.equal(withWorkspaceDocumentDoctype("<html></html>", "<!DOCTYPE html>"), "<!DOCTYPE html>\n<html></html>");
// 既にDOCTYPEがあるなら二重に付けない。
assert.equal(withWorkspaceDocumentDoctype("<!DOCTYPE html><html></html>", "<!DOCTYPE html>"), "<!DOCTYPE html><html></html>");
// 元がDOCTYPE無しならDOCTYPE無しのまま返す。勝手にhtml5へ格上げしない。
assert.equal(withWorkspaceDocumentDoctype("<html></html>", null), "<html></html>");

// ---------------------------------------------------------------------------
// 5. lib の不変条件 — サーバ専用APIへ依存させない
// ---------------------------------------------------------------------------

const lib = read("src/lib/workspace-document-html-editing.ts");
// ブラウザのフレーム側からも同じ関数を使う。Node組込みを足すとバンドルが壊れる。
assert.doesNotMatch(lib, /from "node:|require\(|server-only/);
// DOMに触れない純粋関数のままにする。
assert.doesNotMatch(lib, /\bdocument\.|\bwindow\./);

// ---------------------------------------------------------------------------
// 6. 保存本文の組み立て — フレームが返したHTMLを現物へ戻す
// ---------------------------------------------------------------------------

const deckSource = [
  "<!DOCTYPE html>",
  "<html><head>",
  "<script>window.AMD_DECK = 1;<\/script>",
  "</head><body>",
  "<section><h1>1枚目</h1></section>",
  "<section><h1>2枚目</h1></section>",
  "<script defer>document.title = 'deck';<\/script>",
  "</body></html>",
].join("\n");

// フレームは「scriptを退避し、DOCTYPEの落ちたDOM」を返す。ブラウザ側の往復をここで模す。
const framed = (() => {
  const stashed = stashWorkspaceDocumentScripts(deckSource);
  const doctype = workspaceDocumentDoctype(deckSource);
  return doctype ? stashed.html.slice(doctype.length).trimStart() : stashed.html;
})();
assert.doesNotMatch(framed, /<script/i, "フレームへ生のscriptを渡していない");
assert.doesNotMatch(framed, /^<!DOCTYPE/i);

// 1. 何も編集しなければ、現物と1バイトも変わらない。
assert.equal(workspaceDocumentDeckSaveSource(deckSource, framed), deckSource);

// 2. 文言を書き換えた分だけが反映され、scriptとDOCTYPEは元のまま戻る。
const deckEdited = framed.replace("<h1>1枚目</h1>", "<h1>表紙</h1>");
const deckSaved = workspaceDocumentDeckSaveSource(deckSource, deckEdited);
assert.match(deckSaved, /^<!DOCTYPE html>/);
assert.match(deckSaved, /<h1>表紙<\/h1>/);
assert.match(deckSaved, /window\.AMD_DECK = 1;/);
assert.match(deckSaved, /<script defer>/);
// 退避先の目印を本文へ置き去りにしない。
assert.doesNotMatch(deckSaved, /amd:script:/);

// 3. スライドごと消した編集では、そのスライドのscriptも戻らない。
const withSlideScript = deckSource.replace(
  "<section><h1>2枚目</h1></section>",
  "<section><h1>2枚目</h1><script>slide2();<\/script></section>",
);
const framedSlides = (() => {
  const stashed = stashWorkspaceDocumentScripts(withSlideScript);
  const doctype = workspaceDocumentDoctype(withSlideScript);
  return doctype ? stashed.html.slice(doctype.length).trimStart() : stashed.html;
})();
const deletedSlide = framedSlides.replace(/<section><h1>2枚目<\/h1>[\s\S]*?<\/section>/, "");
const savedAfterDelete = workspaceDocumentDeckSaveSource(withSlideScript, deletedSlide);
assert.doesNotMatch(savedAfterDelete, /slide2\(\)/, "消したスライドのscriptを蘇らせない");
assert.match(savedAfterDelete, /window\.AMD_DECK = 1;/, "残したスライドのscriptは戻る");
assert.doesNotMatch(savedAfterDelete, /amd:script:/);

// 4. 退避番号は「現物の何番目のscriptか」しか意味しない。
//    だからこの関数へ渡すcurrentSourceは、必ず楽観ロックを通った現物でなければならない。
//    デッキエディタで「このまま上書き保存」を出さないのはこの性質が理由。

// 4-a. 別セッションがscriptを消していると、フレーム側の:1は範囲外になる。
//      戻るscriptが無いだけでなく、退避先の目印が本文へ残る。
const driftedRemoved = deckSource.replace("<script defer>document.title = 'deck';<\/script>\n", "");
const savedAgainstRemoved = workspaceDocumentDeckSaveSource(driftedRemoved, deckEdited);
assert.doesNotMatch(savedAgainstRemoved, /document\.title = 'deck';/);
assert.match(savedAgainstRemoved, /amd:script:/, "戻せなかった退避先が本文へ残る");

// 4-b. 別セッションが先頭へscriptを足していると番号が1つずれ、別のscriptが黙って別の位置へ入る。
//      目印も残らないので、保存後のHTMLを見ても壊れたと分からない。
const driftedAdded = deckSource.replace(
  "<html><head>",
  "<html><head>\n<script>window.AMD_ANALYTICS = 1;<\/script>",
);
const savedAgainstAdded = workspaceDocumentDeckSaveSource(driftedAdded, deckEdited);
assert.doesNotMatch(savedAgainstAdded, /amd:script:/, "番号が埋まるので壊れた形跡が残らない");
assert.match(savedAgainstAdded, /window\.AMD_ANALYTICS = 1;/, "別セッションのscriptが先頭へ入る");
assert.doesNotMatch(savedAgainstAdded, /document\.title = 'deck';/, "後ろのscriptは落ちる");

console.log("workspace document html editing: ok");
