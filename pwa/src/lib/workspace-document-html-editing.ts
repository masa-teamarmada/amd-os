/**
 * 生HTML資料を直接操作エディタへ通すための、純粋な文字列処理。
 *
 * サーバとブラウザの両方から使うので、Node組込みもDOM APIも参照しない。
 * ここが壊れると「編集して保存したら資料のJSが消えた」「DOCTYPEが落ちて表示が崩れた」
 * のような、保存した本人には見えない壊れ方をする。だから往復一致を契約テストで固定する。
 */

/** フレームへ流す前にscriptを退避したHTMLと、元のscriptタグ。 */
export type StashedWorkspaceDocumentScripts = {
  /** script要素をコメントのプレースホルダへ置き換えたHTML。 */
  html: string;
  /** 出現順の元のscriptタグ全文。復元時に同じ位置へ戻す。 */
  scripts: string[];
  /** プレースホルダの衝突回避トークン。復元時に同じ値が要る。 */
  token: string;
};

const SCRIPT_PATTERN = /<script\b[^>]*>[\s\S]*?<\/script\s*>|<script\b[^>]*\/>/gi;
const PLACEHOLDER_PREFIX = "amd:script:";

/**
 * プレースホルダが元の本文と衝突しないトークンを決める。
 *
 * ランダムにすると往復テストが書けないので、本文から決定的に伸ばす。
 * 資料側に `<!--amd:script:s:0-->` が既にあっても、`ss` `sss` と伸びて必ず未使用へ着地する。
 */
export function workspaceDocumentScriptToken(html: string): string {
  let token = "s";
  while (html.includes(`${PLACEHOLDER_PREFIX}${token}:`)) token += "s";
  return token;
}

export function workspaceDocumentScriptPlaceholder(token: string, index: number): string {
  return `<!--${PLACEHOLDER_PREFIX}${token}:${index}-->`;
}

/**
 * script要素をプレースホルダへ退避する。
 *
 * 編集フレームで資料側のJSを走らせる理由が無く、走らせると資料のスクリプトが
 * 編集中のDOMを書き換えてしまう。かといって捨てると資料が壊れるので、位置ごと預かる。
 */
export function stashWorkspaceDocumentScripts(html: string): StashedWorkspaceDocumentScripts {
  const token = workspaceDocumentScriptToken(html);
  const scripts: string[] = [];
  const stashed = html.replace(SCRIPT_PATTERN, (match) => {
    const index = scripts.length;
    scripts.push(match);
    return workspaceDocumentScriptPlaceholder(token, index);
  });
  return { html: stashed, scripts, token };
}

/**
 * 退避したscriptを元の位置へ戻す。
 *
 * プレースホルダが消えていたら、そのscriptは編集で削除されたブロックの中にあったということ。
 * 消えた分を末尾へ寄せ集めたりせず、そのまま落とす。位置の推測で資料を壊さない。
 */
export function restoreWorkspaceDocumentScripts(
  html: string,
  scripts: string[],
  token: string,
): string {
  if (scripts.length === 0) return html;
  const pattern = new RegExp(`<!--${PLACEHOLDER_PREFIX}${token}:(\\d+)-->`, "g");
  return html.replace(pattern, (match, rawIndex: string) => {
    const index = Number(rawIndex);
    if (!Number.isInteger(index) || index < 0 || index >= scripts.length) return match;
    return scripts[index];
  });
}

/**
 * DOCTYPE宣言を取り出す。
 *
 * iframeからDOMをシリアライズするとDOCTYPEが付かない。付け直さないと保存のたびに
 * quirks modeへ落ち、資料の見た目が静かに変わる。
 */
export function workspaceDocumentDoctype(html: string): string | null {
  const match = /^\s*<!DOCTYPE[^>]*>/i.exec(html);
  return match ? match[0].trim() : null;
}

/** DOCTYPEを持たないシリアライズ結果へ、元のDOCTYPEを戻す。 */
export function withWorkspaceDocumentDoctype(html: string, doctype: string | null): string {
  const trimmed = html.replace(/^\s+/, "");
  if (/^<!DOCTYPE/i.test(trimmed)) return trimmed;
  return doctype ? `${doctype}\n${trimmed}` : trimmed;
}

/**
 * 編集フレームが返したHTMLを、保存できる本文へ戻す。
 *
 * フレームへ流したのは「scriptを退避し、DOCTYPEの付かないDOM」なので、
 * 返ってきたHTMLをそのまま保存すると資料のJSとDOCTYPEが消える。
 * 退避したscriptの控えはリクエストを跨いで持たず、保存時に現物から同じ手順で作り直す。
 * トークンは本文から決まるので、現物が編集開始時のままなら退避時と必ず同じ値になる。
 *
 * だから **currentSource は楽観ロックを通った現物でなければならない**。
 * 別の内容を渡すとトークンがずれ、プレースホルダが本文に残ってscriptが失われる。
 */
export function workspaceDocumentDeckSaveSource(currentSource: string, framedHtml: string): string {
  const stashed = stashWorkspaceDocumentScripts(currentSource);
  const restored = restoreWorkspaceDocumentScripts(framedHtml, stashed.scripts, stashed.token);
  return withWorkspaceDocumentDoctype(restored, workspaceDocumentDoctype(currentSource));
}
