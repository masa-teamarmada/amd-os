/**
 * デッキモデルを描く唯一のレンダラ。
 *
 * エディタのキャンバスも publish(HTML書き出し) も PDF も、必ずこの1本を通る
 * (`spec/2-8-workspace-document-deck-editor-plan.md` §4)。2本目を作らない。
 * 「エディタで見えていた絵」と「配ったHTML」がズレる余地を、実装として消すのが目的。
 *
 * **拡張子が `.tsx` ではなく `.ts` で、JSXを書かずに `createElement` で組む理由。**
 * 契約テストは素のNode (`node --experimental-strip-types`) からこのファイルを読み、
 * 実際に描かせて「scriptが混ざらない」「外部参照がゼロ」を検査する。Nodeの型除去は
 * `.tsx` を読めないので、JSXで書くとレンダラの振る舞いを機械検査できなくなり、
 * 文字列assertしか書けなくなる。ここは publish出力の安全性そのものなので、
 * 検査できる形を優先する (spec §9 の「振る舞いを検査したい規則は純粋関数へ切り出す」と同じ判断)。
 *
 * 文字のエスケープはReactに任せる。手書きのHTML連結でスロットを埋めない。
 */

import { createElement, type ReactElement, type ReactNode } from "react";

import { WORKSPACE_DECK_CSS, workspaceDeckLogoCss, workspaceDeckThemeCss } from "@/lib/workspace-deck-css";
import {
  sanitizeWorkspaceDeckRawHtml,
  type WorkspaceDeck,
  type WorkspaceDeckBlock,
  type WorkspaceDeckRichText,
  type WorkspaceDeckSlide,
} from "@/lib/workspace-deck-model";

const h = createElement;

/** publish出力を「モデルから生成したもの」と機械的に見分けるための印。 */
export const WORKSPACE_DECK_GENERATOR = "amd-os-deck/1";

/**
 * assetId から画像のsrcへの対応。
 * publishでは data URI、エディタでは署名URLやblob URLが入る。
 * レンダラはどちらかを知らない。外部参照ゼロを守るのは publish 側の責任。
 */
export type WorkspaceDeckAssetSources = Record<string, string>;

// ---------------------------------------------------------------------------
// RichText
// ---------------------------------------------------------------------------

function renderRichText(nodes: WorkspaceDeckRichText, keyPrefix: string): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    // 素のテキストは要素で包まない。包むとPDFやPPTXへ持っていくときに余計な入れ子が増える。
    if (typeof node === "string") return node;
    if (node.t === "br") return h("br", { key });
    if (node.t === "a") {
      // 外部リンクは新しいタブへ。opener経由で開き元を触らせない。
      return h(
        "a",
        { key, href: node.href, target: "_blank", rel: "noreferrer noopener" },
        renderRichText(node.c, key),
      );
    }
    return h(node.t, { key }, renderRichText(node.c, key));
  });
}

// ---------------------------------------------------------------------------
// ブロック
// ---------------------------------------------------------------------------

function blockClassName(block: WorkspaceDeckBlock, base: string): string {
  const classes = ["deck-block", base];
  const style = block.style;
  if (style?.align && style.align !== "left") classes.push(`deck-block--align-${style.align}`);
  if (style?.space) classes.push(`deck-block--space-${style.space}`);
  if (style?.tone && style.tone !== "default") classes.push(`deck-block--tone-${style.tone}`);
  return classes.join(" ");
}

function renderBlock(block: WorkspaceDeckBlock, assets: WorkspaceDeckAssetSources): ReactElement {
  // data-block-id は編集UIが要素を選ぶための取っ手。publish出力にも残すが、
  // 見た目には影響しないので、生成物から「どのブロックだったか」を辿れる利点だけが残る。
  const common = { key: block.id, id: `b-${block.id}`, "data-block-id": block.id, "data-block-type": block.type };

  switch (block.type) {
    case "heading": {
      const children: ReactNode[] = [];
      if (block.slots.eyebrow) {
        children.push(h("p", { key: "eyebrow", className: "deck-heading__eyebrow" }, block.slots.eyebrow));
      }
      children.push(h("h2", { key: "title", className: "deck-heading__title" }, block.slots.title));
      if (block.slots.lead) {
        children.push(h("p", { key: "lead", className: "deck-heading__lead" }, block.slots.lead));
      }
      return h("div", { ...common, className: blockClassName(block, "deck-heading") }, children);
    }
    case "bullets": {
      const listTag = block.variant === "number" ? "ol" : "ul";
      return h(
        listTag,
        { ...common, className: `${blockClassName(block, "deck-bullets")} deck-bullets--${block.variant}` },
        block.slots.items.map((item, index) =>
          h(
            "li",
            { key: index, className: "deck-bullets__item deck-rich" },
            renderRichText(item, `i${index}`),
          )),
      );
    }
    case "table": {
      return h(
        "table",
        { ...common, className: `${blockClassName(block, "deck-table")} deck-table--${block.variant}` },
        [
          h("thead", { key: "head" }, h(
            "tr",
            null,
            block.slots.head.map((cell, index) =>
              h("th", { key: index, scope: "col", className: "deck-rich" }, renderRichText(cell, `h${index}`))),
          )),
          h(
            "tbody",
            { key: "body" },
            block.slots.rows.map((row, rowIndex) =>
              h(
                "tr",
                { key: rowIndex },
                row.map((cell, cellIndex) =>
                  h("td", { key: cellIndex, className: "deck-rich" }, renderRichText(cell, `r${rowIndex}c${cellIndex}`))),
              )),
          ),
        ],
      );
    }
    case "twoCol": {
      const column = (side: "left" | "right") =>
        h(
          "div",
          { key: side, className: "deck-two-col__col" },
          block.slots[side].map((child) => renderBlock(child, assets)),
        );
      return h(
        "div",
        { ...common, className: `${blockClassName(block, "deck-two-col")} deck-two-col--${block.variant}` },
        [column("left"), column("right")],
      );
    }
    case "callout": {
      const children: ReactNode[] = [];
      if (block.slots.title) {
        children.push(h("p", { key: "title", className: "deck-callout__title" }, block.slots.title));
      }
      children.push(h(
        "div",
        { key: "body", className: "deck-callout__body deck-rich" },
        renderRichText(block.slots.body, "body"),
      ));
      return h(
        "div",
        { ...common, className: `${blockClassName(block, "deck-callout")} deck-callout--${block.variant}` },
        children,
      );
    }
    case "image": {
      const src = assets[block.slots.assetId];
      const children: ReactNode[] = [
        src
          ? h("img", {
              key: "image",
              className: "deck-figure__image",
              src,
              alt: block.slots.caption ?? "",
            })
          // 画像が見つからないときに黙って詰めない。抜けたまま配ったことに気づけなくなる。
          : h("div", { key: "missing", className: "deck-figure__missing" }, "画像が見つからないよ"),
      ];
      if (block.slots.caption) {
        children.push(h("figcaption", { key: "caption", className: "deck-figure__caption" }, block.slots.caption));
      }
      return h(
        "figure",
        { ...common, className: `${blockClassName(block, "deck-figure")} deck-figure--${block.variant}` },
        children,
      );
    }
    case "kpiRow": {
      return h(
        "div",
        { ...common, className: blockClassName(block, "deck-kpi") },
        block.slots.items.map((item, index) =>
          h("div", { key: index, className: "deck-kpi__item" }, [
            h("div", { key: "label", className: "deck-kpi__label" }, item.label),
            h("div", { key: "value", className: "deck-kpi__value" }, [
              item.value,
              item.unit ? h("span", { key: "unit", className: "deck-kpi__unit" }, item.unit) : null,
            ]),
            item.note ? h("div", { key: "note", className: "deck-kpi__note" }, item.note) : null,
          ])),
      );
    }
    case "rawHtml": {
      // モデルへ入る時点でサニタイズ済みだが、描く直前にもう一度通す。
      // 別経路で書き込まれた行や、サニタイズ規則を後から強めた場合に、古い本文をそのまま描かない。
      return h("div", {
        ...common,
        className: blockClassName(block, "deck-raw"),
        dangerouslySetInnerHTML: { __html: sanitizeWorkspaceDeckRawHtml(block.slots.html) },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// スライドとデッキ
// ---------------------------------------------------------------------------

function renderSlide(slide: WorkspaceDeckSlide, assets: WorkspaceDeckAssetSources, index: number): ReactElement {
  const inner: ReactNode[] = [];
  if (slide.sectionTitle) {
    // 章タイトルはページ内で最上位。h1で出し、アイキャッチ(heading)はh2に落ちる。
    inner.push(h("h1", { key: "section", className: "deck-slide__section-title" }, slide.sectionTitle));
  }
  inner.push(h(
    "div",
    { key: "body", className: "deck-slide__body" },
    slide.blocks.map((block) => renderBlock(block, assets)),
  ));

  // notes(発表者メモ)は本文へ出さない。対外資料へ内部メモを混ぜないための線引き。
  return h(
    "section",
    {
      key: slide.id,
      id: `s-${slide.id}`,
      className: [
        "deck-slide",
        slide.mode === "fixed16x9" ? "deck-slide--fixed" : "deck-slide--flow",
        `deck-slide--${slide.layout}`,
      ].join(" "),
      "data-slide-id": slide.id,
      "data-slide-index": String(index + 1),
      "aria-label": slide.sectionTitle || `スライド${index + 1}`,
    },
    [
      h("div", { key: "inner", className: "deck-slide__inner" }, inner),
      h("span", { key: "logo", className: "deck-slide__logo", role: "img", "aria-label": "team ARMADA" }),
    ],
  );
}

export function WorkspaceDeckView(props: {
  deck: WorkspaceDeck;
  assets?: WorkspaceDeckAssetSources;
}): ReactElement {
  const assets = props.assets ?? {};
  return h(
    "main",
    { className: "deck", "data-deck-schema-version": String(props.deck.schemaVersion) },
    props.deck.slides.map((slide, index) => renderSlide(slide, assets, index)),
  );
}

// ---------------------------------------------------------------------------
// 自己完結HTML
// ---------------------------------------------------------------------------

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * 本文のマークアップを自己完結HTMLへ包む。
 *
 * 外部参照をゼロにするのは飾りではない。表示routeのCSPが `default-src 'none'; img-src data:` で、
 * 外部を参照した瞬間その資料はプレビューで壊れる。フォントはシステムフォント、CSSは埋め込み、
 * 画像はdata URI、scriptは無し。
 */
export function buildWorkspaceDeckDocument(deck: WorkspaceDeck, bodyMarkup: string): string {
  const themeCss = workspaceDeckThemeCss(deck);
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<meta name="generator" content="${WORKSPACE_DECK_GENERATOR}">`,
    `<title>${escapeHtmlText(deck.meta.title)}</title>`,
    `<style>\n${WORKSPACE_DECK_CSS}\n</style>`,
    themeCss ? `<style>\n${themeCss}\n</style>` : null,
    `<style>\n${workspaceDeckLogoCss(deck.theme.logo)}\n</style>`,
  ].filter((line): line is string => line != null);

  return [
    "<!DOCTYPE html>",
    '<html lang="ja">',
    "<head>",
    head.join("\n"),
    "</head>",
    '<body class="deck-body">',
    bodyMarkup,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

/**
 * モデル → 配布できるHTML。publishもPDFも契約テストもこの1本を呼ぶ。
 *
 * `react-dom/server` を動的importにしているのは、静的importするとApp Routerのビルドが
 * 「react-dom/server を読むコンポーネントを import している」と言って止まるため。
 * 描く木は `WorkspaceDeckView` 1本のままで、エディタはこの木を直接マウントする。
 */
export async function renderWorkspaceDeckDocument(
  deck: WorkspaceDeck,
  assets: WorkspaceDeckAssetSources = {},
): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  return buildWorkspaceDeckDocument(deck, renderToStaticMarkup(WorkspaceDeckView({ deck, assets })));
}
