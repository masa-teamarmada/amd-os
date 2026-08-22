/**
 * publish出力の契約テスト。
 *
 * 代表モデルを実際に描かせて、配布できるHTMLの条件を機械で確かめる。
 * ここが崩れると、表示route (`/render`) のCSP (`default-src 'none'; img-src data:`) に
 * 引っかかって資料が真っ白になるか、実行できるものが混ざった資料を配ることになる。
 * どちらも「保存できたので大丈夫だろう」では気づけない。
 */
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";

import { WORKSPACE_DECK_CSS, workspaceDeckLogoCss, workspaceDeckThemeCss } from "../src/lib/workspace-deck-css.ts";
import { normalizeWorkspaceDeck, type WorkspaceDeck } from "../src/lib/workspace-deck-model.ts";
import {
  buildWorkspaceDeckDocument,
  renderWorkspaceDeckDocument,
  WORKSPACE_DECK_GENERATOR,
} from "../src/lib/workspace-deck-render.ts";
import { WORKSPACE_DOCUMENT_HTML_PREVIEW_MAX_BYTES } from "../src/lib/workspace-documents-core.ts";

const ASSET_ID = "8e5c0a26-1111-4222-8333-444455556666";
// 1x1のPNG。中身は問わない。data URIとして出力へ入るかだけを見る。
const PIXEL_DATA_URI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const validation = normalizeWorkspaceDeck({
  meta: { title: "SE 事業計画 <2026>", docType: "deck", updatedAt: "2026-08-22T00:00:00.000Z" },
  theme: { preset: "amd", logo: "amd_horizontal", tokens: { accent: "#027fdc" } },
  slides: [
    {
      id: "cover",
      layout: "cover",
      sectionTitle: "SE 事業計画",
      notes: "ここは発表者メモ。相手への交渉意図を書く場所で、本文へ出してはいけない。",
      blocks: [{ id: "cover1", type: "heading", slots: { title: "電力を市場から取り戻す" } }],
    },
    {
      id: "problem",
      sectionTitle: "01 / 顧客課題",
      blocks: [
        { id: "p1", type: "heading", slots: { eyebrow: "PROBLEM", title: "判断に要る数字が揃わない", lead: "月次で締めるが、判断は週次で要る。" } },
        { id: "p2", type: "bullets", variant: "check", slots: { items: [["需給の", { t: "strong", c: ["実測"] }, "が無い"], "コストが後追い"] } },
        { id: "p3", type: "kpiRow", slots: { items: [{ label: "導入社数", value: "12", unit: "社", note: "2026年上期" }] } },
        { id: "p4", type: "callout", variant: "warn", slots: { title: "注意", body: ["前提が変わると", { t: "em", c: ["結論も変わる"] }] } },
      ],
    },
    {
      id: "compare",
      mode: "flow",
      sectionTitle: "02 / 比較",
      blocks: [
        {
          id: "c1",
          type: "twoCol",
          variant: "wideLeft",
          slots: {
            left: [{ id: "c1a", type: "table", variant: "compare", slots: { head: ["項目", "現行"], rows: [["初期費", "3,000千円"]] } }],
            right: [{ id: "c1b", type: "image", variant: "inline", slots: { assetId: ASSET_ID, caption: "構成図" } }],
          },
        },
        { id: "c2", type: "rawHtml", slots: { html: '<p class="note">持ち込みの<b>マークアップ</b></p>' } },
        { id: "c3", type: "bullets", slots: { items: [[{ t: "a", href: "https://example.com/spec", c: ["仕様書"] }]] } },
      ],
    },
  ],
});
assert.ok(validation.ok, `代表モデルが検査を通らない: ${validation.ok ? "" : `${validation.path} ${validation.error}`}`);
const deck: WorkspaceDeck = validation.deck;

const html = renderWorkspaceDeckDocument(deck, { [ASSET_ID]: PIXEL_DATA_URI });

// ---------------------------------------------------------------------------
// 1. 自己完結HTMLの形
// ---------------------------------------------------------------------------

assert.match(html, /^<!DOCTYPE html>\n<html lang="ja">/, "DOCTYPEとlangが無いと表示もPDFも崩れる");
assert.match(html, new RegExp(`<meta name="generator" content="${WORKSPACE_DECK_GENERATOR}">`), "生成物の印が無い");
assert.match(html, /<title>SE 事業計画 &lt;2026&gt;<\/title>/, "titleがエスケープされていない");
assert.match(html, /<body class="deck-body">/);
assert.equal(html, renderWorkspaceDeckDocument(deck, { [ASSET_ID]: PIXEL_DATA_URI }), "同じモデルから違うHTMLが出た");

// ---------------------------------------------------------------------------
// 2. script混入ゼロ
// ---------------------------------------------------------------------------

assert.doesNotMatch(html, /<script/i, "publish出力にscriptが混ざった");
assert.doesNotMatch(html, /javascript:/i, "javascript: が混ざった");
assert.doesNotMatch(html, /\son[a-z]+\s*=/i, "イベント属性が混ざった");

// ---------------------------------------------------------------------------
// 3. 外部参照ゼロ — 表示routeのCSPは data: 以外の読み込みを許さない
// ---------------------------------------------------------------------------

for (const match of html.matchAll(/\s(?:src|srcset|poster|background|data)\s*=\s*"([^"]*)"/gi)) {
  assert.ok(match[1].startsWith("data:"), `外部を読む属性が残っている: ${match[1].slice(0, 60)}`);
}
for (const match of html.matchAll(/url\(\s*["']?([^)"']+)/gi)) {
  assert.ok(match[1].startsWith("data:"), `CSSが外部を読んでいる: ${match[1].slice(0, 60)}`);
}
assert.doesNotMatch(html, /@import/i, "@importが混ざった");
assert.doesNotMatch(html, /<link\b/i, "外部stylesheetの参照が混ざった");
// リンク (遷移) は残す。読み込みではないので自己完結性を壊さない。
assert.match(html, /<a href="https:\/\/example\.com\/spec" target="_blank" rel="noreferrer noopener">仕様書<\/a>/);

// ---------------------------------------------------------------------------
// 4. サイズ — プレビュー上限を超えると資料ごと開けなくなる
// ---------------------------------------------------------------------------

const byteLength = Buffer.byteLength(html, "utf8");
assert.ok(byteLength < WORKSPACE_DOCUMENT_HTML_PREVIEW_MAX_BYTES, "代表モデルで既に5MBを超えている");
// ロゴのbase64はCSS規則1つにまとめる。スライドごとに<img>で貼ると枚数分だけ複製される。
assert.equal((html.match(/data:image\/png;base64,iVBOR/g) || []).length >= 1, true);
assert.ok(byteLength < 200_000, `土台のHTMLが太りすぎ (${byteLength}B)。ロゴを枚数分だけ複製していないか確認する`);

// ---------------------------------------------------------------------------
// 5. 発表者メモは本文へ出さない (対外資料ルール)
// ---------------------------------------------------------------------------

assert.doesNotMatch(html, /発表者メモ|交渉意図/, "notesがpublish出力へ漏れた");

// ---------------------------------------------------------------------------
// 6. ブロックが実際に描かれている
// ---------------------------------------------------------------------------

assert.match(html, /class="deck-slide deck-slide--fixed deck-slide--cover"/);
assert.match(html, /class="deck-slide deck-slide--flow deck-slide--standard"/, "flowスライドが固定扱いになっている");
assert.match(html, /<h1 class="deck-slide__section-title">SE 事業計画<\/h1>/);
assert.match(html, /<h2 class="deck-heading__title">判断に要る数字が揃わない<\/h2>/);
assert.match(html, /需給の<strong>実測<\/strong>が無い/, "RichTextの強調が落ちた");
assert.match(html, /deck-kpi__value">12<span class="deck-kpi__unit">社<\/span>/);
assert.match(html, /<table[^>]*class="deck-block deck-table deck-table--compare"/);
assert.match(html, new RegExp(`<img class="deck-figure__image" src="${PIXEL_DATA_URI.slice(0, 40)}`), "画像がdata URIで入っていない");
assert.match(html, /<figcaption class="deck-figure__caption">構成図<\/figcaption>/);
assert.match(html, /<p class="note">持ち込みの<b>マークアップ<\/b><\/p>/, "rawHtmlの中身が落ちた");
assert.match(html, /data-block-id="p2"/, "編集UIが要素を選ぶための取っ手が無い");

// 画像が見つからないときに黙って詰めない。抜けたまま配ったことに気づけなくなる。
const missing = renderWorkspaceDeckDocument(deck, {});
assert.match(missing, /画像が見つからないよ/);
assert.doesNotMatch(missing, /<img /, "srcの無いimgを出さない");

// ---------------------------------------------------------------------------
// 7. 描画時にもrawHtmlをサニタイズする
// ---------------------------------------------------------------------------

// 保存経路 (normalize) を通さずDBへ入った本文や、サニタイズ規則を後から強めた場合に、
// 古い本文をそのまま描かないこと。
const tainted = JSON.parse(JSON.stringify(deck)) as WorkspaceDeck;
const taintedBlock = tainted.slides[2].blocks[1];
assert.equal(taintedBlock.type, "rawHtml");
if (taintedBlock.type === "rawHtml") {
  taintedBlock.slots.html = '<p onmouseover="steal()">罠</p><script>alert(1)</script><img src="https://evil.example/x.png">';
}
const taintedHtml = renderWorkspaceDeckDocument(tainted, {});
assert.doesNotMatch(taintedHtml, /<script|onmouseover|evil\.example/i, "描画時のサニタイズが効いていない");
assert.match(taintedHtml, /罠/, "本文まで消した");

// ---------------------------------------------------------------------------
// 8. CSS — Tailwindを使わない / 章タイトルをアイキャッチより大きく保つ
// ---------------------------------------------------------------------------

// publish先にTailwindは無い。ユーティリティで組むと配布HTMLで必ずズレる。
for (const match of html.matchAll(/\sclass="([^"]*)"/g)) {
  for (const className of match[1].split(/\s+/).filter(Boolean)) {
    assert.ok(
      className.startsWith("deck") || className === "note",
      `デッキ由来でないclassが混ざっている: ${className}`,
    );
  }
}

const fontSizeOf = (selector: string): number => {
  const rule = new RegExp(`${selector.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}[^{}]*\\{([^}]*)\\}`).exec(WORKSPACE_DECK_CSS);
  assert.ok(rule, `${selector} の規則が無い`);
  const size = /font-size:\s*calc\(var\(--deck-u\)\s*\*\s*([0-9.]+)\)/.exec(rule[1]);
  assert.ok(size, `${selector} にfont-sizeが無い`);
  return Number(size[1]);
};

const sectionTitleSize = fontSizeOf(".deck-slide__section-title");
const eyecatchSize = fontSizeOf(".deck-heading__title");
assert.ok(
  eyecatchSize < sectionTitleSize,
  `アイキャッチ(${eyecatchSize}u)が章タイトル(${sectionTitleSize}u)以上になっている (AMD_SLIDE_DESIGN_CODE 基本ルール6)`,
);

// 章タイトル以外のどのブロックも章タイトルより大きくしない。
// 数字だけが巨大なスライドは、資料のどこを見ているのか分からなくなる。
const coverSectionTitleSize = fontSizeOf(".deck-slide--cover .deck-slide__section-title");
for (const match of WORKSPACE_DECK_CSS.matchAll(/([^{}]+)\{([^}]*font-size:\s*calc\(var\(--deck-u\)\s*\*\s*([0-9.]+)\)[^}]*)\}/g)) {
  const selector = match[1].trim();
  const size = Number(match[3]);
  if (selector.includes("section-title")) continue;
  assert.ok(
    size <= sectionTitleSize,
    `${selector} が章タイトルより大きい (${size}u > ${sectionTitleSize}u)`,
  );
}
assert.ok(coverSectionTitleSize > sectionTitleSize, "表紙の資料タイトルは通常ページの章タイトル以上にする");

// 固定16:9はコンテナ単位、フローはpx。この2行が寸法モデルの本体。
assert.match(WORKSPACE_DECK_CSS, /\.deck-slide--fixed \{[^}]*container-type: inline-size;[^}]*--deck-u: 1cqw;/);
assert.match(WORKSPACE_DECK_CSS, /:root \{[^}]*--deck-u: 12\.8px;/s);
assert.match(WORKSPACE_DECK_CSS, /@media print \{[\s\S]*break-after: page/, "印刷でスライドごとに改ページしない");

// ---------------------------------------------------------------------------
// 9. テーマとロゴ
// ---------------------------------------------------------------------------

assert.equal(workspaceDeckThemeCss(deck), ":root { --deck-accent: #027fdc; }");
assert.match(workspaceDeckLogoCss("amd_horizontal"), /background-image: url\("data:image\/png;base64,[A-Za-z0-9+/=]+"\), url\("data:image\/png;base64,/);
assert.equal(workspaceDeckLogoCss("none"), ".deck-slide__logo { display: none; }");
assert.doesNotMatch(workspaceDeckLogoCss("amd_mark"), /https?:/, "ロゴが外部URLを参照している");

// 本文マークアップは受け取ったものをそのまま包む。包む側で書き換えない。
const wrapped = buildWorkspaceDeckDocument(deck, "<main>差し替え</main>");
assert.match(wrapped, /<main>差し替え<\/main>/);

console.log("check_workspace_deck_render: ok");
