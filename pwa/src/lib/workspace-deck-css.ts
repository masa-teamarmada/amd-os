/**
 * デッキの見た目。文字列1本で持ち、エディタのキャンバスもpublish出力も同じこれを使う。
 *
 * **Tailwindのユーティリティをデッキ内で使わない。** publish先にTailwindは無いので、
 * ユーティリティで組むと資料室で見えている絵と配布したHTMLが必ずズレる。
 *
 * 寸法の基準は `--deck-u` 1本。
 * - 固定16:9のスライドは `--deck-u: 1cqw`。スライド自身をコンテナにするので、
 *   画面幅が変わっても中身が丸ごと拡大縮小して16:9を保つ (JSを使わない。表示側のCSPがscriptを許さない)。
 * - フローのスライドは `--deck-u: 12.8px`。1280px幅の固定スライドと同じ実寸から始まり、縦にだけ伸びる。
 * コンテナ単位はコンテナ自身の指定には効かないので、内側の `.deck-slide__inner` で余白を取る。
 *
 * 配色と見出し階層は `AMD_SLIDE_DESIGN_CODE.md` に従う。
 * 章タイトル (`.deck-slide__section-title`) をページ内で最大にし、アイキャッチ
 * (`.deck-heading__title`) を必ずそれより小さくする。契約テストで機械的に確かめる。
 */

import type { WorkspaceDeck, WorkspaceDeckLogo, WorkspaceDeckTokens } from "@/lib/workspace-deck-model";
import { WORKSPACE_DECK_LOGO_MARK_PNG_BASE64, WORKSPACE_DECK_LOGO_TYPE_PNG_BASE64 } from "@/lib/workspace-deck-logo";

/** AMD_SLIDE_DESIGN_CODE.md のカラートークン。 */
export const WORKSPACE_DECK_DEFAULT_TOKENS: Required<WorkspaceDeckTokens> = {
  accent: "#027fdc",
  ink: "#1f2933",
  muted: "#667085",
  surface: "#f5f7fa",
  line: "#d9e2ec",
  canvas: "#ffffff",
};

export const WORKSPACE_DECK_CSS = `
:root {
  --deck-accent: ${WORKSPACE_DECK_DEFAULT_TOKENS.accent};
  --deck-ink: ${WORKSPACE_DECK_DEFAULT_TOKENS.ink};
  --deck-muted: ${WORKSPACE_DECK_DEFAULT_TOKENS.muted};
  --deck-surface: ${WORKSPACE_DECK_DEFAULT_TOKENS.surface};
  --deck-line: ${WORKSPACE_DECK_DEFAULT_TOKENS.line};
  --deck-canvas: ${WORKSPACE_DECK_DEFAULT_TOKENS.canvas};
  --deck-page: #e9edf2;
  --deck-u: 12.8px;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body.deck-body {
  background: var(--deck-page);
  color: var(--deck-ink);
  font-family: "Yu Gothic Medium", "游ゴシック Medium", YuGothic, "游ゴシック体", "Hiragino Sans", "ヒラギノ角ゴシック", Meiryo, system-ui, sans-serif;
  font-size: 16px;
  line-height: 1.7;
  -webkit-text-size-adjust: 100%;
}
.deck { display: flex; flex-direction: column; align-items: center; gap: 24px; padding: 24px 16px 64px; }
.deck-slide {
  position: relative;
  width: 100%;
  max-width: 1280px;
  background: var(--deck-canvas);
  border: 1px solid var(--deck-line);
  border-radius: 8px;
  overflow: hidden;
}
.deck-slide--fixed { container-type: inline-size; aspect-ratio: 16 / 9; --deck-u: 1cqw; }
.deck-slide__inner {
  display: flex;
  flex-direction: column;
  gap: calc(var(--deck-u) * 1.4);
  height: 100%;
  padding: calc(var(--deck-u) * 4) calc(var(--deck-u) * 4.6) calc(var(--deck-u) * 4.2);
}
.deck-slide--flow .deck-slide__inner { height: auto; }
.deck-slide--cover .deck-slide__inner { justify-content: center; }
.deck-slide--section .deck-slide__inner { justify-content: center; background: var(--deck-surface); }
.deck-slide--full .deck-slide__inner { padding: 0; gap: 0; }
.deck-slide__section-title {
  margin: 0;
  color: var(--deck-accent);
  font-size: calc(var(--deck-u) * 2.5);
  font-weight: 800;
  line-height: 1.25;
  letter-spacing: 0.01em;
}
.deck-slide--cover .deck-slide__section-title,
.deck-slide--section .deck-slide__section-title { font-size: calc(var(--deck-u) * 3.4); }
.deck-slide__section-title::after {
  content: "";
  display: block;
  width: calc(var(--deck-u) * 3.2);
  height: calc(var(--deck-u) * 0.28);
  margin-top: calc(var(--deck-u) * 0.9);
  background: var(--deck-accent);
}
.deck-slide__body { display: flex; flex-direction: column; gap: calc(var(--deck-u) * 1.6); min-height: 0; }
.deck-slide--full .deck-slide__body { height: 100%; gap: 0; }
.deck-slide__logo {
  position: absolute;
  right: calc(var(--deck-u) * 2.2);
  bottom: calc(var(--deck-u) * 1.6);
  width: calc(var(--deck-u) * 11);
  height: calc(var(--deck-u) * 1.8);
  background-repeat: no-repeat;
  opacity: 0.72;
}
/* 表紙だけロゴを左上へ。表紙以外は右下に控えめに置く (AMD_SLIDE_DESIGN_CODE.md 基本ルール3)。 */
.deck-slide--cover .deck-slide__logo {
  top: calc(var(--deck-u) * 3.6);
  right: auto;
  bottom: auto;
  left: calc(var(--deck-u) * 4.6);
  opacity: 1;
}

.deck-block { margin: 0; }
.deck-block--align-center { text-align: center; }
.deck-block--align-right { text-align: right; }
.deck-block--space-none { margin-bottom: calc(var(--deck-u) * -1.6); }
.deck-block--space-sm { margin-bottom: calc(var(--deck-u) * -0.8); }
.deck-block--space-md { margin-bottom: calc(var(--deck-u) * 0.8); }
.deck-block--space-lg { margin-bottom: calc(var(--deck-u) * 2.4); }
.deck-block--tone-muted { color: var(--deck-muted); }
.deck-block--tone-accent { color: var(--deck-accent); }

.deck-heading__eyebrow {
  margin: 0 0 calc(var(--deck-u) * 0.4);
  color: var(--deck-muted);
  font-size: calc(var(--deck-u) * 1.05);
  font-weight: 700;
  letter-spacing: 0.08em;
}
.deck-heading__title {
  margin: 0;
  font-size: calc(var(--deck-u) * 1.85);
  font-weight: 700;
  line-height: 1.4;
}
.deck-heading__lead {
  margin: calc(var(--deck-u) * 0.7) 0 0;
  color: var(--deck-muted);
  font-size: calc(var(--deck-u) * 1.2);
  line-height: 1.65;
}

.deck-bullets { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: calc(var(--deck-u) * 0.7); font-size: calc(var(--deck-u) * 1.3); }
.deck-bullets__item { position: relative; padding-left: calc(var(--deck-u) * 1.8); line-height: 1.65; }
.deck-bullets--plain .deck-bullets__item::before {
  content: "";
  position: absolute;
  left: calc(var(--deck-u) * 0.5);
  top: calc(var(--deck-u) * 0.72);
  width: calc(var(--deck-u) * 0.5);
  height: calc(var(--deck-u) * 0.5);
  border-radius: 50%;
  background: var(--deck-accent);
}
.deck-bullets--check .deck-bullets__item::before {
  content: "✓";
  position: absolute;
  left: 0;
  color: var(--deck-accent);
  font-weight: 800;
}
.deck-bullets--number { counter-reset: deck-bullets; }
.deck-bullets--number .deck-bullets__item { counter-increment: deck-bullets; }
.deck-bullets--number .deck-bullets__item::before {
  content: counter(deck-bullets) ".";
  position: absolute;
  left: 0;
  color: var(--deck-accent);
  font-weight: 800;
}

.deck-table { width: 100%; border-collapse: collapse; font-size: calc(var(--deck-u) * 1.15); }
.deck-table th, .deck-table td {
  border: 1px solid var(--deck-line);
  padding: calc(var(--deck-u) * 0.6) calc(var(--deck-u) * 0.8);
  text-align: left;
  vertical-align: top;
  line-height: 1.55;
}
.deck-table th { background: var(--deck-surface); color: var(--deck-ink); font-weight: 700; }
.deck-table--compare tbody th,
.deck-table--compare tbody td:first-child { background: var(--deck-surface); font-weight: 700; }

.deck-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: calc(var(--deck-u) * 2); align-items: start; }
.deck-two-col--wideLeft { grid-template-columns: 1.6fr 1fr; }
.deck-two-col--wideRight { grid-template-columns: 1fr 1.6fr; }
.deck-two-col__col { display: flex; flex-direction: column; gap: calc(var(--deck-u) * 1.2); min-width: 0; }

.deck-callout {
  border-left: calc(var(--deck-u) * 0.28) solid var(--deck-accent);
  background: var(--deck-surface);
  padding: calc(var(--deck-u) * 1) calc(var(--deck-u) * 1.3);
  font-size: calc(var(--deck-u) * 1.2);
  line-height: 1.65;
}
.deck-callout--warn { border-left-color: #d92d20; }
.deck-callout--accent { background: #e8f3fc; }
.deck-callout__title { margin: 0 0 calc(var(--deck-u) * 0.3); font-weight: 800; font-size: calc(var(--deck-u) * 1.25); }
.deck-callout__body { margin: 0; }

.deck-figure { margin: 0; display: flex; flex-direction: column; gap: calc(var(--deck-u) * 0.5); min-height: 0; }
.deck-figure__image { display: block; max-width: 100%; max-height: 100%; object-fit: contain; }
.deck-figure--bleed { flex: 1; }
.deck-figure--bleed .deck-figure__image { width: 100%; height: 100%; }
.deck-figure__caption { color: var(--deck-muted); font-size: calc(var(--deck-u) * 1); }
.deck-figure__missing {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(var(--deck-u) * 8);
  border: 1px dashed var(--deck-line);
  color: var(--deck-muted);
  font-size: calc(var(--deck-u) * 1);
}

.deck-kpi { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: calc(var(--deck-u) * 1.2); }
.deck-kpi__item { border-top: calc(var(--deck-u) * 0.22) solid var(--deck-accent); padding-top: calc(var(--deck-u) * 0.7); min-width: 0; }
.deck-kpi__label { color: var(--deck-muted); font-size: calc(var(--deck-u) * 1); font-weight: 700; }
.deck-kpi__value { color: var(--deck-ink); font-size: calc(var(--deck-u) * 2.2); font-weight: 800; line-height: 1.2; }
.deck-kpi__unit { font-size: calc(var(--deck-u) * 1.1); font-weight: 700; margin-left: calc(var(--deck-u) * 0.2); }
.deck-kpi__note { color: var(--deck-muted); font-size: calc(var(--deck-u) * 0.95); line-height: 1.5; }

.deck-raw { font-size: calc(var(--deck-u) * 1.2); line-height: 1.65; }
.deck-raw img, .deck-raw table { max-width: 100%; }
.deck-raw table { border-collapse: collapse; }

.deck-rich code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.92em; background: var(--deck-surface); padding: 0 0.25em; border-radius: 3px; }
.deck-rich a { color: var(--deck-accent); }

@media print {
  body.deck-body { background: var(--deck-canvas); }
  .deck { gap: 0; padding: 0; }
  .deck-slide { max-width: none; border: none; border-radius: 0; break-after: page; break-inside: avoid; }
  .deck-slide:last-child { break-after: auto; }
}
`.trim();

/**
 * テーマの色を上書きするCSS。値は `#rrggbb` に正規化済みのものだけが来る
 * (`normalizeWorkspaceDeck`)。任意文字列を通すと宣言を割られるので、ここで再確認する。
 */
export function workspaceDeckThemeCss(deck: WorkspaceDeck): string {
  const declarations = (Object.keys(WORKSPACE_DECK_DEFAULT_TOKENS) as (keyof WorkspaceDeckTokens)[])
    .map((key) => {
      const value = deck.theme.tokens[key];
      return value && /^#[0-9a-f]{6}$/.test(value) ? `--deck-${key}: ${value};` : null;
    })
    .filter((declaration): declaration is string => declaration != null);
  return declarations.length ? `:root { ${declarations.join(" ")} }` : "";
}

/**
 * ロゴは1つのCSS規則の中でだけbase64を持つ。スライドごとに `<img>` で貼ると
 * 同じbase64が枚数分だけHTMLへ複製され、5MBのプレビュー上限を無駄に食う。
 */
export function workspaceDeckLogoCss(logo: WorkspaceDeckLogo): string {
  if (logo === "none") return ".deck-slide__logo { display: none; }";
  const mark = `url("data:image/png;base64,${WORKSPACE_DECK_LOGO_MARK_PNG_BASE64}")`;
  if (logo === "amd_mark") {
    return [
      ".deck-slide__logo {",
      `  background-image: ${mark};`,
      "  background-position: right center;",
      "  background-size: auto 100%;",
      "  width: calc(var(--deck-u) * 1.9);",
      "}",
    ].join("\n");
  }
  // 「シンボル + ロゴタイプ」の横並びは2枚の背景で組む。1枚に合成した画像を別に持つと、
  // 正本画像を差し替えたときに合成物だけ古いまま残る。
  const type = `url("data:image/png;base64,${WORKSPACE_DECK_LOGO_TYPE_PNG_BASE64}")`;
  return [
    ".deck-slide__logo {",
    `  background-image: ${type}, ${mark};`,
    "  background-position: right center, left center;",
    "  background-size: auto 58%, auto 100%;",
    "}",
  ].join("\n");
}
