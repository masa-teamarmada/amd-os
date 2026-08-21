/**
 * 編集フレームの契約テスト。
 *
 * ここが緩むと、資料HTMLがまさのセッションへ到達できるようになる。しかも画面上は
 * 何も変わらないので、緩んだこと自体に誰も気づかない。だからヘッダ文字列を直接固める。
 *
 * エージェントは `toString()` して埋め込むため、外の識別子を1つ参照しただけで
 * フレームが黙って死ぬ。構文検査では捕まらないので、最小のモックで実際に走らせる。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { workspaceDocumentEditAgentSource } from "../src/lib/workspace-document-edit-agent.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath: string) => readFileSync(join(root, relativePath), "utf8");

// ---------------------------------------------------------------------------
// 1. フレームのセキュリティ境界 — ここが唯一の防壁
// ---------------------------------------------------------------------------

const route = read("src/app/api/workspace-documents/[documentId]/edit-frame/route.ts");

/** ヘッダの値そのものを取り出す。解説コメントに書かれた語で判定を汚さない。 */
function headerValue(source: string, name: string): string {
  const start = source.indexOf(`"${name}":`);
  assert.ok(start > 0, `${name} ヘッダが無い`);
  const rest = source.slice(start + name.length + 3);
  const end = rest.indexOf('\n      "');
  return end > 0 ? rest.slice(0, end) : rest.slice(0, 600);
}

const csp = headerValue(route, "Content-Security-Policy");

// allow-same-origin が付いた瞬間、資料HTMLが親のDOMとcookieへ届く。
assert.doesNotMatch(csp, /allow-same-origin/, "編集フレームに allow-same-origin を付けてはいけない");
assert.match(csp, /sandbox allow-scripts/, "sandbox allow-scripts が無い");
// フレーム内で走ってよいのは、こちらが nonce を付けたエージェントだけ。
assert.match(csp, /script-src 'nonce-\$\{nonce\}'/);
assert.doesNotMatch(csp, /'unsafe-eval'|'unsafe-inline'[^;]*script|script-src [^;`]*\*/);
assert.match(route, /randomBytes\(16\)\.toString\("hex"\)/, "nonce はリクエストごとに作る");
assert.match(csp, /default-src 'none'/);
assert.match(csp, /frame-ancestors 'self'/);
assert.match(csp, /form-action 'none'/);
assert.match(csp, /base-uri 'none'/);
// 外部への通信路を開けない。開くと資料の中身が外へ出る経路になる。
assert.doesNotMatch(csp, /connect-src|https:|http:/);
assert.match(route, /"X-Content-Type-Options": "nosniff"/);
assert.match(route, /"Cache-Control": "private, no-store, max-age=0"/);

// token は hex32 だけ通す。そのままHTMLへ埋めるので、ここが緩むと注入経路になる。
assert.match(route, /\/\^\[0-9a-f\]\{32\}\$\/\.test\(token\)/);
// 認可は共有ゲート1本に集約したまま。ここで独自に組み直さない。
assert.match(route, /loadEditableWorkspaceHtmlDocument\(documentId\)/);
assert.doesNotMatch(route, /resolveDocumentRowAccess/, "認可を編集フレームで組み直さない");
// 資料側のJSを退避してから流す。
const stashIndex = route.indexOf("stashWorkspaceDocumentScripts(source)");
const injectIndex = route.indexOf("data-amd-agent");
assert.ok(stashIndex > 0, "script の退避を通していない");
assert.ok(stashIndex < injectIndex, "退避より前にエージェントを注入している");
assert.match(route, /stashed\.html/, "退避後のHTMLを配信していない");
// エージェント本文が資料側のタグを閉じてしまわないようにする。
assert.match(route, /replace\(\/<\\\/script\/gi/);
assert.match(route, /WORKSPACE_DOCUMENT_HTML_PREVIEW_MAX_BYTES/, "サイズ上限を外さない");
assert.match(route, /action: "edit_frame"/, "監査ログを残していない");

// 既存の閲覧レンダラは script を一切許さないまま。編集の都合で緩めない。
const render = read("src/app/api/workspace-documents/[documentId]/render/route.ts");
const renderCsp = headerValue(render, "Content-Security-Policy");
assert.doesNotMatch(renderCsp, /script-src|allow-scripts/, "閲覧レンダラのCSPを緩めてはいけない");
assert.match(renderCsp, /sandbox`?,?\s*$|sandbox['"`;]/, "閲覧レンダラの sandbox が消えている");

// ---------------------------------------------------------------------------
// 2. エージェントを実際に走らせる — 自由変数を1つでも掴んだら死ぬ
// ---------------------------------------------------------------------------

const token = "0123456789abcdef0123456789abcdef";
const source = workspaceDocumentEditAgentSource({ token });

type Posted = Record<string, unknown>;
const posted: Posted[] = [];
const listeners: Record<string, ((event: unknown) => void)[]> = {};
const record = (target: string) => (type: string, handler: (event: unknown) => void) => {
  const key = `${target}:${type}`;
  (listeners[key] ??= []).push(handler);
};

const emptyList = { length: 0 } as unknown as NodeListOf<Element>;
const styleTag: Record<string, unknown> = {};
const documentMock = {
  documentElement: { cloneNode: () => ({ querySelector: () => null, querySelectorAll: () => emptyList, outerHTML: "<html></html>" }) },
  head: { appendChild: (node: unknown) => { assert.equal(node, styleTag); } },
  createElement: () => styleTag,
  querySelectorAll: () => emptyList,
  addEventListener: record("document"),
  execCommand: () => true,
};
const windowMock = { addEventListener: record("window"), getSelection: () => null };
const parentMock = { postMessage: (payload: Posted) => { posted.push(payload); } };

new Function("document", "window", "parent", "getComputedStyle", source)(
  documentMock,
  windowMock,
  parentMock,
  () => ({ fontWeight: "400", fontStyle: "normal", textDecorationLine: "none", color: "rgb(0, 0, 0)", fontSize: "16px", textAlign: "start" }),
);

// 走り切って ready を返した = 外の識別子を掴んでいない。
assert.equal(posted.length, 1, "エージェントが ready を送らなかった");
assert.equal(posted[0].type, "ready");
assert.equal(posted[0].amd, token, "全メッセージに照合token が要る");
assert.ok(Array.isArray(posted[0].candidates));

// 親からの操作を受ける口が開いている。
assert.ok(listeners["window:message"]?.length === 1, "message ハンドラが無い");
for (const type of ["click", "dblclick", "input", "submit"]) {
  assert.ok(listeners[`document:${type}`]?.length === 1, `${type} ハンドラが無い`);
}

// token の違うメッセージを黙って実行しない。origin が "null" になる以上、ここが唯一の関門。
const onMessage = listeners["window:message"][0];
posted.length = 0;
onMessage({ data: { amd: "deadbeefdeadbeefdeadbeefdeadbeef", type: "serialize", requestId: 1 } });
onMessage({ data: { type: "serialize", requestId: 2 } });
onMessage({ data: null });
onMessage({ data: "serialize" });
assert.equal(posted.length, 0, "token の合わないメッセージに応答した");

onMessage({ data: { amd: token, type: "serialize", requestId: 3 } });
assert.equal(posted.length, 1);
assert.equal(posted[0].type, "serialized");
assert.equal(posted[0].requestId, 3);
assert.equal(posted[0].html, "<html></html>");

// ---------------------------------------------------------------------------
// 3. エージェント実装の不変条件
// ---------------------------------------------------------------------------

const lib = read("src/lib/workspace-document-edit-agent.ts");
const agentBody = lib.slice(lib.indexOf("function agent("), lib.indexOf("export function workspaceDocumentEditAgentSource"));
assert.ok(agentBody.length > 0, "agent が無い");

// transpile のヘルパー (__spreadArray 等) が注入されると、埋め込み先で未定義参照になる。
// toString にヘルパー定義は含まれないので、構文の側で使わせない。
assert.doesNotMatch(agentBody, /\.\.\.[A-Za-z_$[{]/, "agent で spread を使わない (transpile ヘルパーが注入される)");
assert.doesNotMatch(agentBody, /\basync\b|\bawait\b/, "agent で async/await を使わない");
assert.doesNotMatch(agentBody, /for\s*\(\s*(?:var|let|const)?\s*\w+\s+of\s/, "agent で for...of を使わない");
assert.doesNotMatch(agentBody, /\?\./, "agent で optional chaining を使わない");
// import した関数を呼ぶと toString で欠落する。
assert.doesNotMatch(agentBody, /workspaceDocument\w+\(/, "agent が外の関数を呼んでいる");

// 保存用HTMLは clone を掃除して作る。編集中のDOMを直に掃除すると画面の編集状態が壊れる。
const serializeBody = agentBody.slice(agentBody.indexOf("function serialize()"), agentBody.indexOf("var css ="));
assert.match(serializeBody, /document\.documentElement\.cloneNode\(true\)/);
for (const marker of ["STYLE_ID", "data-amd-agent", "SELECTED_ATTR", "SLIDE_ATTR", "contenteditable"]) {
  assert.ok(serializeBody.includes(marker), `保存用HTMLから ${marker} を落としていない`);
}

// 文字を打ったら右のパネルへ選択情報を送り直す。dirty だけ送ると、
// パネルに出ている要素の文言や大きさが打つ前のまま固まる (2026-08-22 修正)。
assert.match(agentBody, /document\.addEventListener\("input", markTyping, true\)/);
assert.match(
  agentBody,
  /function markTyping\(\)[\s\S]{0,320}?publishSelection\(\)/,
  "入力後に選択情報を送り直していない",
);

// 全メッセージに token を載せる経路が1本しかない。
assert.equal(agentBody.split("parent.postMessage").length - 1, 1, "postMessage の呼び口を増やさない");
assert.match(agentBody, /payload\.amd = TOKEN;/);

// ---------------------------------------------------------------------------
// 4. 保存経路 — フレームが返したHTMLを現物へ戻すのは1箇所だけ
// ---------------------------------------------------------------------------

const savePath = read("src/app/api/workspace-documents/[documentId]/source/route.ts");

// 認可も楽観ロックも共有の入口で済ませる。デッキ用に別ルートを生やさない。
assert.match(savePath, /loadEditableWorkspaceHtmlDocument\(documentId\)/);
assert.equal(savePath.split("replaceWorkspaceHtmlSource(").length - 1, 1, "保存の書き込み経路を増やさない");
// 読むのはGETの仕事。書き込みだけはrouteの外へ出す。
assert.doesNotMatch(savePath, /\.upload\(/, "routeがStorageへ直接書いている");
assert.doesNotMatch(savePath, /\.from\("workspace_documents"\)[\s\S]{0,80}\.update\(/, "routeが行を直接更新している");
// sha256が無い保存を通さない。通せば競合検知が空振りする。
assert.match(savePath, /isWorkspaceDocumentSha256\(body\.expectedSha256\)[\s\S]{0,200}return json/);

// デッキかどうかは受信したmodeだけで決まる。
assert.match(savePath, /const deckMode = body\.mode === "deck";/);
// 組み直しはデッキのときだけ。ソース編集は受け取った本文をそのまま現物にする。
assert.match(
  savePath,
  /transformNextSource:\s*deckMode\s*\?[\s\S]{0,200}workspaceDocumentDeckSaveSource\(currentSource, normalized\.source\)[\s\S]{0,40}:\s*undefined/,
);
// auditActionはリテラルのまま。ここを条件式にすると資料室の契約テストが落ちる。
assert.match(savePath, /auditAction: "replace_html"/);
assert.match(savePath, /auditDetail: \{ editor: deckMode \? "deck" : "source" \}/);

const editingLib = read("src/lib/workspace-document-editing.ts");

// 組み直しは409を返したあと。競合中の現物を材料にしない。
const conflictIndex = editingLib.indexOf("conflict: true");
const transformIndex = editingLib.indexOf("transformNextSource ? transformNextSource(currentSource)");
assert.ok(conflictIndex > 0, "競合の返しが無い");
assert.ok(transformIndex > 0, "組み直しの呼び口が無い");
assert.ok(conflictIndex < transformIndex, "sha256照合より先に組み直している");

// 現物へ書くのは組み直したあとの本文。受信した本文をそのまま書かない。
assert.match(editingLib, /const sourceBytes = Buffer\.from\(finalSource, "utf8"\)/);
assert.match(editingLib, /workspaceDocumentContentSha256\(finalSource\)/);
assert.doesNotMatch(editingLib, /workspaceDocumentContentSha256\(nextSource\)/);
assert.doesNotMatch(editingLib, /Buffer\.from\(nextSource, "utf8"\)/);
// 退避したscriptが戻る分だけ本文は伸びる。受信時の検査は保存サイズを保証しない。
const sizeIndex = editingLib.indexOf("WORKSPACE_DOCUMENT_HTML_EDITOR_MAX_BYTES", transformIndex);
assert.ok(sizeIndex > transformIndex, "組み直したあとにサイズを検査していない");
assert.match(editingLib.slice(sizeIndex, sizeIndex + 200), /status: 413/);

// ---------------------------------------------------------------------------
// 5. 親側 — 合言葉の作り方と、ローディングの出口
// ---------------------------------------------------------------------------

const deck = read("src/components/workspace-documents/WorkspaceDocumentDeckEditor.tsx");

// 合言葉をレンダー中に作らない。useState の initializer と useMemo はサーバ描画と
// ブラウザの hydration で2回走るので、乱数を引くと iframe の src に載る値と
// 親が照合する値がずれる。フレームが正しく送った ready を親が永久に捨て、
// 画面は「資料を読み込み中」から一生進まない (2026-08-22 の永久ローディング事故)。
assert.doesNotMatch(
  deck,
  /useState\(\s*\(\) =>[\s\S]{0,240}?randomUUID/,
  "合言葉をuseStateのinitializerで作っている (SSRとhydrationで値がずれる)",
);
assert.doesNotMatch(
  deck,
  /useMemo\(\s*\(\) =>[\s\S]{0,240}?randomUUID/,
  "合言葉をuseMemoで作っている (SSRとhydrationで値がずれる)",
);
assert.match(deck, /const \[token, setToken\] = useState<string \| null>\(null\)/);
assert.match(deck, /useEffect\(\(\) => \{\s*setToken\(/, "合言葉はマウント後に一度だけ決める");

// 合言葉が決まるまでフレームを描かない。srcの無いiframeを先に描くと二重ロードになる。
assert.match(deck, /token === null\s*\?\s*null\s*:\s*`\/api\/workspace-documents\//);
assert.match(deck, /\{frameSrc !== null && \(\s*<iframe/, "合言葉が決まる前にiframeを描いている");

// 準備完了が来ないまま黙って回り続けない。理由と、作り直す出口を必ず出す。
assert.match(deck, /const FRAME_READY_TIMEOUT_MS = \d+/);
assert.match(deck, /setTimeout\(\(\) => setLoadTimedOut\(true\), FRAME_READY_TIMEOUT_MS\)/);
assert.match(
  deck,
  /loadTimedOut \?[\s\S]{0,800}?onClick=\{reloadFrame\}/,
  "読み込めなかったときに作り直す出口が無い",
);

console.log("workspace document edit frame: ok");
