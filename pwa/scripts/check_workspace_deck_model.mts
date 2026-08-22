/**
 * デッキモデル schema v1 の契約テスト。
 *
 * ここが守るのは「保存できたものは必ず描ける」「同じ内容なら必ず同じsha256」の2つ。
 * 前者が崩れると publish で黙って中身が消え、後者が崩れると楽観ロックが誤検知して
 * 「別のセッションが更新しています」を出し続ける。どちらも画面では気づけない壊れ方をする。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  collectWorkspaceDeckAssetIds,
  createWorkspaceDeck,
  normalizeWorkspaceDeck,
  normalizeWorkspaceDeckRichText,
  sanitizeWorkspaceDeckRawHtml,
  serializeWorkspaceDeck,
  workspaceDeckByteLength,
  workspaceDeckRichTextToPlain,
  WORKSPACE_DECK_BLOCK_SPECS,
  WORKSPACE_DECK_IMPLEMENTED_BLOCK_TYPES,
} from "../src/lib/workspace-deck-model.ts";
import {
  probeWorkspaceDeckImage,
  workspaceDeckImageExceedsMaxEdge,
  WORKSPACE_DECK_ASSET_EXTENSIONS,
} from "../src/lib/workspace-deck-assets.ts";
import {
  WORKSPACE_DOCUMENT_ASSET_MAX_EDGE_PX,
  WORKSPACE_DOCUMENT_DECK_MODEL_MAX_BYTES,
  workspaceDocumentAssetStoragePathFromBase,
} from "../src/lib/workspace-documents-core.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const UPDATED_AT = "2026-08-22T00:00:00.000Z";

const deckOf = (slides: unknown[], extra: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  meta: { title: "契約テスト", docType: "deck", updatedAt: UPDATED_AT },
  slides,
  ...extra,
});
const slideOf = (blocks: unknown[], extra: Record<string, unknown> = {}) => ({
  sectionTitle: "01 / 検査",
  blocks,
  ...extra,
});
const heading = { type: "heading", slots: { title: "見出し" } };

const ok = (value: unknown) => {
  const result = normalizeWorkspaceDeck(value);
  assert.ok(result.ok, `通るはずのモデルが弾かれた: ${result.ok ? "" : `${result.path} ${result.error}`}`);
  return result.deck;
};
const rejected = (value: unknown, message: string) => {
  const result = normalizeWorkspaceDeck(value);
  assert.equal(result.ok, false, `弾くはずのモデルが通った: ${message}`);
  return result.ok ? { path: "", error: "" } : { path: result.path, error: result.error };
};

// ---------------------------------------------------------------------------
// 1. 最小の有効なデッキ
// ---------------------------------------------------------------------------

const seed = createWorkspaceDeck("SE 事業計画", UPDATED_AT);
assert.equal(seed.schemaVersion, 1);
assert.equal(seed.slides.length, 1);
assert.equal(seed.theme.logo, "amd_horizontal");
assert.equal(seed.defaults.slideMode, "fixed16x9", "既定は固定16:9 (投影で崩れる事故のほうが高くつく)");
assert.deepEqual(ok(seed), seed, "自分の作った種を自分で弾いた");

// 省略した項目は既定で埋まる。手書きモデルを書けなくしない。
const filled = ok({ meta: { title: "既定" }, slides: [{ blocks: [heading] }] });
assert.equal(filled.meta.docType, "deck");
assert.equal(filled.theme.preset, "amd");
assert.equal(filled.slides[0].mode, "fixed16x9");
assert.equal(filled.slides[0].layout, "standard");
assert.equal(filled.slides[0].id, "s1", "idの無いスライドは位置から決まるidを持つ");
assert.equal(filled.slides[0].blocks[0].id, "s1b1");

// ---------------------------------------------------------------------------
// 2. 必須スロット
// ---------------------------------------------------------------------------

rejected(deckOf([]), "スライド0枚");
rejected(deckOf([slideOf([{ type: "heading", slots: {} }])]), "headingのtitle無し");
rejected(deckOf([slideOf([{ type: "heading", slots: { title: "   " } }])]), "空白だけのtitle");
rejected(deckOf([slideOf([{ type: "bullets", slots: { items: [] } }])]), "空のbullets");
rejected(deckOf([slideOf([{ type: "callout", slots: {} }])]), "本文もタイトルも無いcallout");
rejected(deckOf([slideOf([{ type: "image", slots: { assetId: "not-a-uuid" } }])]), "assetIdがuuidでない");
rejected(deckOf([slideOf([{ type: "kpiRow", slots: { items: [{ label: "だけ" }] } }])]), "valueの無いkpi");
rejected({ meta: {}, slides: [slideOf([heading])] }, "タイトル無し");
rejected(deckOf([slideOf([heading])], { schemaVersion: 2 }), "別schemaVersion");

// 表は列数を勝手に足し引きしない。抜けた数字に気づけなくなる。
const shortRow = rejected(
  deckOf([slideOf([{ type: "table", slots: { head: ["A", "B"], rows: [["1"]] } }])]),
  "列数の合わない行",
);
assert.match(shortRow.error, /列数/);
assert.match(shortRow.path, /rows\[0\]/, "どの行かをpathで示す");

// 制御文字は表示・PDF化・PPTX化のどこかで必ず化ける。改行とタブは通す。
const nul = `壊${String.fromCharCode(0)}れる`;
rejected(deckOf([slideOf([{ type: "heading", slots: { title: nul } }])]), "NUL入りの文字列");
ok(deckOf([slideOf([heading], { notes: "1行目\n2行目\tメモ" })]));

// ---------------------------------------------------------------------------
// 3. ブロックの語彙 — 未知 / 未対応 / 固定16:9限定
// ---------------------------------------------------------------------------

for (const type of WORKSPACE_DECK_IMPLEMENTED_BLOCK_TYPES) {
  assert.equal(WORKSPACE_DECK_BLOCK_SPECS[type]?.implemented, true);
}
assert.deepEqual(
  [...WORKSPACE_DECK_IMPLEMENTED_BLOCK_TYPES].sort(),
  ["bullets", "callout", "heading", "image", "kpiRow", "rawHtml", "table", "twoCol"],
  "第1弾8種から増減したら、レンダラと契約テストを一緒に直す",
);

const unknown = rejected(deckOf([slideOf([{ type: "carousel", slots: {} }])]), "知らないブロック");
assert.match(unknown.error, /知らないブロック/);

// 語彙にはあるがレンダラが描けないものは、保存の時点で断る。
// 通してしまうと publish で黙って消え、配ったあとに気づく。
const notYet = rejected(deckOf([slideOf([{ type: "timeline", slots: {} }])]), "未対応ブロック");
assert.match(notYet.error, /まだ使えない/);

// freeCanvasは固定16:9限定。フローは高さが可変で座標の意味が決まらない。
const freeOnFlow = rejected(
  deckOf([slideOf([{ type: "freeCanvas", slots: { items: [] } }], { mode: "flow" })]),
  "フローのfreeCanvas",
);
assert.match(freeOnFlow.error, /固定16:9/, "フローでの拒否理由は寸法モードであると分かる形にする");
assert.equal(WORKSPACE_DECK_BLOCK_SPECS.freeCanvas?.fixedOnly, true);

// 2カラムの中に2カラムを積まない。固定16:9でまず読めなくなる。
rejected(
  deckOf([slideOf([{ type: "twoCol", slots: { left: [{ type: "twoCol", slots: { left: [], right: [] } }], right: [] } }])]),
  "入れ子の2カラム",
);
const nested = ok(deckOf([slideOf([{ type: "twoCol", slots: { left: [heading], right: [heading] } }])]));
assert.equal(nested.slides[0].blocks[0].type, "twoCol");

// ---------------------------------------------------------------------------
// 4. RichText — インライン限定
// ---------------------------------------------------------------------------

assert.deepEqual(normalizeWorkspaceDeckRichText("素のテキスト"), ["素のテキスト"]);
assert.deepEqual(normalizeWorkspaceDeckRichText({ t: "text", v: "畳む" }), ["畳む"], "{t:text}は素の文字列へ畳む");
assert.deepEqual(
  normalizeWorkspaceDeckRichText(["前", { t: "strong", c: ["中"] }, { t: "br" }, "後"]),
  ["前", { t: "strong", c: ["中"] }, { t: "br" }, "後"],
);
assert.equal(workspaceDeckRichTextToPlain(["前", { t: "strong", c: ["中"] }, { t: "br" }, "後"]), "前中\n後");
assert.throws(() => normalizeWorkspaceDeckRichText([{ t: "a", href: "javascript:alert(1)", c: ["罠"] }]));
assert.throws(() => normalizeWorkspaceDeckRichText([{ t: "div", c: ["段落構造はブロック側が持つ"] }]));
assert.deepEqual(
  normalizeWorkspaceDeckRichText([{ t: "a", href: "https://example.com/x", c: ["外部"] }]),
  [{ t: "a", href: "https://example.com/x", c: ["外部"] }],
);
// 入れ子の深さ。壊れた入力で再帰を止められないと、保存で関数が落ちる。
let deepNode: unknown = ["底"];
for (let depth = 0; depth < 8; depth += 1) deepNode = [{ t: "em", c: deepNode }];
assert.throws(() => normalizeWorkspaceDeckRichText(deepNode));

// ---------------------------------------------------------------------------
// 5. 正規化の冪等性とsha256の安定 — jsonbはキー順を保存しない
// ---------------------------------------------------------------------------

const rich = deckOf([
  slideOf([
    { type: "heading", slots: { eyebrow: "PROBLEM", title: "アイキャッチ", lead: "補足" } },
    { type: "bullets", variant: "check", slots: { items: ["A", ["B", { t: "strong", c: ["強調"] }]] } },
    { type: "table", variant: "compare", slots: { head: ["項目", "現行"], rows: [["初期費", "3,000千円"]] } },
    { type: "kpiRow", slots: { items: [{ label: "導入", value: "12", unit: "社", note: "上期" }] } },
    { type: "callout", variant: "warn", slots: { title: "注意", body: ["本文"] } },
    { type: "image", slots: { assetId: "8E5C0A26-1111-4222-8333-444455556666", caption: "図" } },
    { type: "rawHtml", slots: { html: "<p>そのまま</p>" } },
  ]),
]);

const first = serializeWorkspaceDeck(ok(rich));
const second = serializeWorkspaceDeck(ok(JSON.parse(first)));
assert.equal(second, first, "正規化が冪等でない = 保存のたびにsha256が動く");

// Postgresのjsonbから読み直すとキー順は変わる。順を入れ替えても同じ直列化になること。
const shuffle = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(shuffle);
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).reverse();
    return Object.fromEntries(entries.map(([key, item]) => [key, shuffle(item)]));
  }
  return value;
};
assert.equal(serializeWorkspaceDeck(ok(shuffle(JSON.parse(first)))), first, "キー順で直列化がズレた");

// assetIdは小文字へ揃える。大小違いで同じ画像を二重に数えない。
const assetIds = collectWorkspaceDeckAssetIds(ok(rich));
assert.deepEqual(assetIds, ["8e5c0a26-1111-4222-8333-444455556666"]);
// 2カラムの中の画像も拾う。拾い漏らすと publish で「画像が見つからない」になる。
const nestedAsset = ok(deckOf([slideOf([{
  type: "twoCol",
  slots: {
    left: [{ type: "image", slots: { assetId: "11111111-2222-4333-8444-555566667777" } }],
    right: [heading],
  },
}])]));
assert.deepEqual(collectWorkspaceDeckAssetIds(nestedAsset), ["11111111-2222-4333-8444-555566667777"]);

// ---------------------------------------------------------------------------
// 6. rawHtml のサニタイズ
// ---------------------------------------------------------------------------

const dirty = [
  '<p onclick="steal()" style="color:#f00;background:url(https://evil.example/x.png)">本文</p>',
  '<script>fetch("https://evil.example")</script>',
  '<iframe src="https://evil.example"></iframe>',
  '<img src="https://evil.example/x.png"><img src="data:image/png;base64,AAAA">',
  '<a href="javascript:alert(1)">罠</a><a href="https://example.com">外部</a>',
  '<style>@import url(https://evil.example/x.css); .a { background: url(https://evil.example/y.png) }</style>',
  '<form action="https://evil.example"><input name="password"></form>',
].join("");
const clean = sanitizeWorkspaceDeckRawHtml(dirty);

assert.doesNotMatch(clean, /<script/i, "scriptが残った");
assert.doesNotMatch(clean, /<iframe/i, "iframeが残った");
assert.doesNotMatch(clean, /<form|<input/i, "入力欄が残った");
assert.doesNotMatch(clean, /onclick/i, "イベント属性が残った");
assert.doesNotMatch(clean, /javascript:/i, "javascript:が残った");
assert.doesNotMatch(clean, /@import/i, "@importが残った");
assert.doesNotMatch(clean, /https:\/\/evil\.example/i, "外部参照が残った");
assert.match(clean, /本文/, "本文まで消した");
assert.match(clean, /data:image\/png;base64,AAAA/, "data URIの画像まで消した");
assert.match(clean, /href="https:\/\/example\.com"/, "普通のリンクまで消した");
assert.equal(sanitizeWorkspaceDeckRawHtml(clean), clean, "サニタイズが冪等でない = 保存のたびにsha256が動く");

// 保存の時点で落としておく。エディタのプレビューと publish出力を同じ本文にするため。
const savedRaw = ok(deckOf([slideOf([{ type: "rawHtml", slots: { html: dirty } }])]));
const savedHtml = savedRaw.slides[0].blocks[0];
assert.equal(savedHtml.type, "rawHtml");
assert.doesNotMatch(savedHtml.type === "rawHtml" ? savedHtml.slots.html : "", /<script|onclick|evil\.example/i);

// ---------------------------------------------------------------------------
// 7. 上限
// ---------------------------------------------------------------------------

// 1ブロックずつは上限内でも、積み上げでモデル全体が2MBを超えたら断る。
const fat = deckOf(Array.from({ length: 12 }, () =>
  slideOf([{ type: "rawHtml", slots: { html: "あ".repeat(190_000) } }])));
const fatResult = rejected(fat, "モデル上限超え");
assert.match(fatResult.error, /大きすぎる/);
assert.ok(workspaceDeckByteLength(ok(rich)) < WORKSPACE_DOCUMENT_DECK_MODEL_MAX_BYTES);
rejected(deckOf([slideOf([{ type: "rawHtml", slots: { html: "x".repeat(200_001) } }])]), "rawHtmlの文字数上限");

// ---------------------------------------------------------------------------
// 8. id
// ---------------------------------------------------------------------------

rejected(deckOf([{ id: "s1", blocks: [heading] }, { id: "s1", blocks: [heading] }]), "重複したスライドid");
rejected(deckOf([{ id: "s 1", blocks: [heading] }]), "空白入りのid");
rejected(deckOf([{ id: "../etc", blocks: [heading] }]), "pathに見えるid");
const collide = ok(deckOf([{ id: "s2", blocks: [heading] }, { blocks: [heading] }]));
assert.equal(collide.slides[0].id, "s2");
assert.notEqual(collide.slides[1].id, "s2", "自動採番が既存idと衝突した");

// ---------------------------------------------------------------------------
// 9. テーマ
// ---------------------------------------------------------------------------

const themed = ok(deckOf([slideOf([heading])], { theme: { preset: "amd", logo: "amd_mark", tokens: { accent: "#FF8800" } } }));
assert.equal(themed.theme.tokens.accent, "#ff8800", "色は小文字へ揃える");
assert.equal(themed.theme.logo, "amd_mark");
// 色をCSSへそのまま入れるので、任意文字列を通すと宣言を割られる。
rejected(deckOf([slideOf([heading])], { theme: { tokens: { accent: "red; } body { display:none" } } }), "色でない色トークン");
rejected(deckOf([slideOf([heading])], { theme: { logo: "kute" } }), "知らないロゴ");

// ---------------------------------------------------------------------------
// 10. 画像アセット — 名乗られたMIMEを信じない
// ---------------------------------------------------------------------------

const pngBytes = new Uint8Array(readFileSync(join(root, "public/AMD_logo_mark.png")));
const png = probeWorkspaceDeckImage(pngBytes);
assert.deepEqual(png, { mimeType: "image/png", width: 730, height: 744 }, "実物のPNGを読めない");

const gif = probeWorkspaceDeckImage(Uint8Array.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x40, 0x01, 0xf0, 0x00, 0x00, 0x00, 0x00,
]));
assert.deepEqual(gif, { mimeType: "image/gif", width: 320, height: 240 });

// JPEG: APP0のあとにSOF0が来る最小構成。マーカーを読み飛ばせないと寸法が取れない。
const jpeg = probeWorkspaceDeckImage(Uint8Array.from([
  0xff, 0xd8,
  0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
  0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x03, 0x20, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
  0xff, 0xd9,
]));
assert.deepEqual(jpeg, { mimeType: "image/jpeg", width: 800, height: 600 });

const webpLossless = Buffer.alloc(40);
webpLossless.write("RIFF", 0, "ascii");
webpLossless.write("WEBP", 8, "ascii");
webpLossless.write("VP8L", 12, "ascii");
webpLossless[20] = 0x2f;
// 14bitずつの (width-1, height-1) = (639, 479)
webpLossless.writeUInt32LE(639 | (479 << 14), 21);
assert.deepEqual(
  probeWorkspaceDeckImage(new Uint8Array(webpLossless)),
  { mimeType: "image/webp", width: 640, height: 480 },
);

assert.equal(probeWorkspaceDeckImage(new Uint8Array(Buffer.from("<html>ただのHTML</html>", "utf8"))), null);
assert.equal(probeWorkspaceDeckImage(new Uint8Array(Buffer.from("<svg xmlns=''></svg>", "utf8"))), null, "SVGは受け付けない");
assert.equal(probeWorkspaceDeckImage(new Uint8Array(0)), null);

// 縮小はブラウザ側。上限を超える画像はここで断る (黙って原寸を通すとpublishが5MBを超える)。
assert.equal(workspaceDeckImageExceedsMaxEdge({ mimeType: "image/png", width: WORKSPACE_DOCUMENT_ASSET_MAX_EDGE_PX, height: 100 }), false);
assert.equal(workspaceDeckImageExceedsMaxEdge({ mimeType: "image/png", width: 100, height: WORKSPACE_DOCUMENT_ASSET_MAX_EDGE_PX + 1 }), true);

assert.deepEqual(Object.keys(WORKSPACE_DECK_ASSET_EXTENSIONS).sort(), ["image/gif", "image/jpeg", "image/png", "image/webp"]);

// 保存先は現物の隣。asset_idはDBが払い出すuuidなので、同じpathが別の画像で埋まらない。
assert.equal(
  workspaceDocumentAssetStoragePathFromBase("project/p10/abc", "8e5c0a26-1111-4222-8333-444455556666", "png"),
  "project/p10/abc.asset.8e5c0a26-1111-4222-8333-444455556666.png",
);
assert.throws(() => workspaceDocumentAssetStoragePathFromBase("project/../etc", "8e5c0a26-1111-4222-8333-444455556666", "png"));
assert.throws(() => workspaceDocumentAssetStoragePathFromBase("project/p10/abc", "not-a-uuid", "png"));
assert.throws(() => workspaceDocumentAssetStoragePathFromBase("project/p10/abc", "8e5c0a26-1111-4222-8333-444455556666", "../x"));

console.log("check_workspace_deck_model: ok");
