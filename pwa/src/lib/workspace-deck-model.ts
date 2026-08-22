/**
 * 資料室スライドの構造化モデル schema v1。
 *
 * このモデルが正本で、HTML / PDF / 将来のPPTX はすべてここからの生成物
 * (`spec/2-8-workspace-document-deck-editor-plan.md` §2.1 / §3.2)。生成物からモデルへ逆流させない。
 *
 * ここに `server-only` を import しない。契約テストが素のNodeから読んで振る舞いを検査する。
 * Node組込みもDOM APIも参照せず、サーバ・ブラウザ・テストの3箇所で同じ結果になるようにする。
 *
 * **sha256 は必ず `serializeWorkspaceDeck(normalizeWorkspaceDeck(...).deck)` に対して取る。**
 * Postgresのjsonbはキー順を保存しないので、DBから読み直したJSONをそのまま直列化すると
 * 同じ内容でも別のsha256になる。正規化は毎回同じ順でオブジェクトを組み直すので、
 * 経路がどこであれ「同じ内容 → 同じsha256」が成り立つ。楽観ロックの鍵はこれに依存している。
 */

import {
  WORKSPACE_DOCUMENT_DECK_MODEL_MAX_BYTES,
  WORKSPACE_DOCUMENT_DECK_SCHEMA_VERSION,
} from "@/lib/workspace-documents-core";

// ---------------------------------------------------------------------------
// 型
// ---------------------------------------------------------------------------

export type WorkspaceDeckDocType = "deck" | "doc";
export type WorkspaceDeckSlideMode = "fixed16x9" | "flow";
export type WorkspaceDeckSlideLayout = "cover" | "section" | "standard" | "full";
export type WorkspaceDeckLogo = "amd_horizontal" | "amd_mark" | "none";

/** テーマの色トークン。AMDデザインコードの配色から外れる自由記述を持たせない。 */
export type WorkspaceDeckTokenKey = "accent" | "ink" | "muted" | "surface" | "line" | "canvas";
export type WorkspaceDeckTokens = Partial<Record<WorkspaceDeckTokenKey, string>>;

/**
 * インライン限定の最小サブセット。段落構造はブロック側が持ち、任意HTMLを文字列に混ぜない。
 * 素の文字列はそのまま本文テキストとして扱う (`["説明", { t: "strong", c: ["ここ"] }]`)。
 */
export type WorkspaceDeckRichNode =
  | string
  | { t: "strong" | "em" | "code"; c: WorkspaceDeckRichNode[] }
  | { t: "a"; href: string; c: WorkspaceDeckRichNode[] }
  | { t: "br" };
export type WorkspaceDeckRichText = WorkspaceDeckRichNode[];

/** ブロックの見た目の微調整。閉じた列挙だけを持ち、生CSSを受け取らない。 */
export type WorkspaceDeckBlockStyle = {
  align?: "left" | "center" | "right";
  space?: "none" | "sm" | "md" | "lg";
  tone?: "default" | "muted" | "accent";
};

export type WorkspaceDeckKpiItem = {
  label: string;
  value: string;
  unit?: string;
  note?: string;
};

type BlockBase = { id: string; style?: WorkspaceDeckBlockStyle };

export type WorkspaceDeckBlock =
  | (BlockBase & { type: "heading"; slots: { eyebrow?: string; title: string; lead?: string } })
  | (BlockBase & {
      type: "bullets";
      variant: "plain" | "check" | "number";
      slots: { items: WorkspaceDeckRichText[] };
    })
  | (BlockBase & {
      type: "table";
      variant: "plain" | "compare";
      slots: { head: WorkspaceDeckRichText[]; rows: WorkspaceDeckRichText[][] };
    })
  | (BlockBase & {
      type: "twoCol";
      variant: "even" | "wideLeft" | "wideRight";
      slots: { left: WorkspaceDeckBlock[]; right: WorkspaceDeckBlock[] };
    })
  | (BlockBase & {
      type: "callout";
      variant: "info" | "warn" | "accent";
      slots: { title?: string; body: WorkspaceDeckRichText };
    })
  | (BlockBase & {
      type: "image";
      variant: "inline" | "bleed";
      slots: { assetId: string; caption?: string };
    })
  | (BlockBase & { type: "kpiRow"; slots: { items: WorkspaceDeckKpiItem[] } })
  | (BlockBase & { type: "rawHtml"; slots: { html: string } });

export type WorkspaceDeckBlockType = WorkspaceDeckBlock["type"];

export type WorkspaceDeckSlide = {
  id: string;
  mode: WorkspaceDeckSlideMode;
  layout: WorkspaceDeckSlideLayout;
  /** 全ページ共通の章タイトル。AMDデザインコードでページ内の最上位に置く要素。 */
  sectionTitle?: string;
  /** 発表者メモ。本文と混ぜない (対外資料ルール)。publish出力には出さない。 */
  notes?: string;
  blocks: WorkspaceDeckBlock[];
};

export type WorkspaceDeck = {
  schemaVersion: 1;
  meta: { title: string; docType: WorkspaceDeckDocType; updatedAt: string };
  theme: { preset: "amd"; tokens: WorkspaceDeckTokens; logo: WorkspaceDeckLogo };
  defaults: { slideMode: WorkspaceDeckSlideMode; contentWidthPx: number };
  slides: WorkspaceDeckSlide[];
};

export type WorkspaceDeckValidation =
  | { ok: true; deck: WorkspaceDeck }
  | { ok: false; error: string; path: string };

// ---------------------------------------------------------------------------
// ブロックの語彙
// ---------------------------------------------------------------------------

/**
 * schema v1 が持つブロックの全一覧。
 *
 * `implemented: false` は「schemaとしては v1 の語彙だが、まだレンダラが描けない」もの。
 * 語彙から消さずにここへ残すのは、保存だけ通ってpublishで黙って消える事故を防ぐため。
 * 未知のtypeと未対応のtypeで別のメッセージを返せるようにもなる。
 */
export const WORKSPACE_DECK_BLOCK_SPECS: Record<
  string,
  { label: string; implemented: boolean; fixedOnly?: boolean }
> = {
  heading: { label: "見出し", implemented: true },
  bullets: { label: "箇条書き", implemented: true },
  table: { label: "表", implemented: true },
  twoCol: { label: "2カラム", implemented: true },
  callout: { label: "囲み", implemented: true },
  image: { label: "画像", implemented: true },
  kpiRow: { label: "数値並び", implemented: true },
  rawHtml: { label: "生HTML", implemented: true },
  timeline: { label: "時系列", implemented: false },
  funnel: { label: "ファネル", implemented: false },
  quote: { label: "引用", implemented: false },
  spacer: { label: "余白", implemented: false },
  // 自由配置は固定16:9のスライドでだけ許す。フローは高さが可変で、座標の意味が決まらない。
  freeCanvas: { label: "自由配置", implemented: false, fixedOnly: true },
};

export const WORKSPACE_DECK_IMPLEMENTED_BLOCK_TYPES = Object.keys(WORKSPACE_DECK_BLOCK_SPECS)
  .filter((type) => WORKSPACE_DECK_BLOCK_SPECS[type]?.implemented) as WorkspaceDeckBlockType[];

// ---------------------------------------------------------------------------
// 上限
// ---------------------------------------------------------------------------

export const WORKSPACE_DECK_LIMITS = {
  slides: 200,
  blocksPerSlide: 60,
  columnBlocks: 20,
  bulletItems: 40,
  tableColumns: 12,
  tableRows: 80,
  kpiItems: 6,
  richNodes: 200,
  richDepth: 4,
  rawHtmlChars: 200_000,
  title: 200,
  sectionTitle: 120,
  eyebrow: 80,
  lead: 400,
  notes: 4000,
  caption: 200,
  text: 4000,
  contentWidthPxMin: 640,
  contentWidthPxMax: 1600,
} as const;

const DEFAULT_CONTENT_WIDTH_PX = 1120;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/;
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/;
// 改行とタブだけ通す。NUL・垂直タブ・CRは表示、PDF化、PPTX化のどこかで必ず化ける。
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b-\u001f\u007f]/;
const ASSET_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TOKEN_KEYS: WorkspaceDeckTokenKey[] = ["accent", "ink", "muted", "surface", "line", "canvas"];

// ---------------------------------------------------------------------------
// 検証の足回り
// ---------------------------------------------------------------------------

class DeckModelError extends Error {
  // 引数プロパティ (`constructor(readonly path: string)`) を使わない。
  // Nodeの型除去は素通しなので、契約テストがこのファイルを読めなくなる。
  readonly path: string;

  constructor(path: string, message: string) {
    super(message);
    this.name = "DeckModelError";
    this.path = path;
  }
}

function fail(path: string, message: string): never {
  throw new DeckModelError(path, message);
}

function readRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(path, "オブジェクトが必要だよ。");
  return value as Record<string, unknown>;
}

function readArray(value: unknown, path: string, max: number): unknown[] {
  if (!Array.isArray(value)) fail(path, "配列が必要だよ。");
  if (value.length > max) fail(path, `多すぎるよ (${max}件まで)。`);
  return value;
}

/** 表示文字列の共通検査。制御文字は表示・PDF化・PPTX化のどこかで必ず化けるので通さない。 */
function readText(value: unknown, path: string, max: number): string {
  if (typeof value !== "string") fail(path, "文字列が必要だよ。");
  if (CONTROL_CHARACTERS.test(value)) fail(path, "使えない制御文字が入っているよ。");
  if (value.length > max) fail(path, `長すぎるよ (${max}文字まで)。`);
  return value;
}

function readRequiredText(value: unknown, path: string, max: number): string {
  const text = readText(value, path, max);
  if (!text.trim()) fail(path, "空にできないよ。");
  return text;
}

function readOptionalText(value: unknown, path: string, max: number): string | undefined {
  if (value == null || value === "") return undefined;
  const text = readText(value, path, max);
  return text.trim() ? text : undefined;
}

function readEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
  fallback?: T,
): T {
  if (value == null || value === "") {
    if (fallback !== undefined) return fallback;
    fail(path, "指定が必要だよ。");
  }
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    fail(path, `${allowed.join(" / ")} のどれかにしてね。`);
  }
  return value as T;
}

function readInt(value: unknown, path: string, min: number, max: number, fallback: number): number {
  if (value == null || value === "") return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) fail(path, "数値が必要だよ。");
  const rounded = Math.round(value);
  if (rounded < min || rounded > max) fail(path, `${min}〜${max}の範囲にしてね。`);
  return rounded;
}

/**
 * リンク先。publish出力は不透明オリジンのiframeで開くので、資格情報を持ち出せる形の
 * URLを本文へ埋めない。`javascript:` などのスキームはここで落とす。
 */
function readHref(value: unknown, path: string): string {
  const raw = readRequiredText(value, path, 2000).trim();
  const lowered = raw.toLowerCase();
  if (lowered.startsWith("http://") || lowered.startsWith("https://") || lowered.startsWith("mailto:")) {
    return raw;
  }
  fail(path, "リンクは http / https / mailto だけだよ。");
}

// ---------------------------------------------------------------------------
// RichText
// ---------------------------------------------------------------------------

function normalizeRichNodes(
  value: unknown,
  path: string,
  depth: number,
  counter: { count: number },
): WorkspaceDeckRichText {
  if (depth > WORKSPACE_DECK_LIMITS.richDepth) fail(path, "入れ子が深すぎるよ。");
  // 素の文字列と単一ノードは1要素の配列として受ける。手書きモデルを読みやすくするため。
  const source = Array.isArray(value) ? value : [value];
  if (source.length > WORKSPACE_DECK_LIMITS.richNodes) fail(path, "要素が多すぎるよ。");

  const nodes: WorkspaceDeckRichText = [];
  for (let index = 0; index < source.length; index += 1) {
    const nodePath = `${path}[${index}]`;
    const node = source[index];
    counter.count += 1;
    if (counter.count > WORKSPACE_DECK_LIMITS.richNodes) fail(path, "要素が多すぎるよ。");

    if (typeof node === "string") {
      if (!node) continue;
      nodes.push(readText(node, nodePath, WORKSPACE_DECK_LIMITS.text));
      continue;
    }
    const record = readRecord(node, nodePath);
    const tag = readEnum(record.t, ["text", "strong", "em", "code", "a", "br"] as const, `${nodePath}.t`);
    if (tag === "br") {
      nodes.push({ t: "br" });
      continue;
    }
    // `{ t: "text", v: "…" }` は素の文字列へ畳む。正規形を1つに保たないとsha256が揺れる。
    if (tag === "text") {
      const text = readText(record.v, `${nodePath}.v`, WORKSPACE_DECK_LIMITS.text);
      if (text) nodes.push(text);
      continue;
    }
    const children = normalizeRichNodes(record.c, `${nodePath}.c`, depth + 1, counter);
    if (tag === "a") {
      nodes.push({ t: "a", href: readHref(record.href, `${nodePath}.href`), c: children });
      continue;
    }
    nodes.push({ t: tag, c: children });
  }
  return nodes;
}

export function normalizeWorkspaceDeckRichText(value: unknown, path = "richText"): WorkspaceDeckRichText {
  return normalizeRichNodes(value, path, 1, { count: 0 });
}

/** RichTextの素のテキスト。検索・要約・PPTX書き出しが同じ読み方をするための1本。 */
export function workspaceDeckRichTextToPlain(nodes: WorkspaceDeckRichText): string {
  let out = "";
  for (const node of nodes) {
    if (typeof node === "string") out += node;
    else if (node.t === "br") out += "\n";
    else out += workspaceDeckRichTextToPlain(node.c);
  }
  return out;
}

// ---------------------------------------------------------------------------
// rawHtml のサニタイズ
// ---------------------------------------------------------------------------

/** 中身ごと落とす要素。実行できるもの・外部を読むもの・入力を集めるもの。 */
const RAW_HTML_DROPPED_ELEMENTS = [
  "script", "iframe", "object", "embed", "noscript", "template",
  "form", "input", "button", "select", "textarea", "link", "base", "meta",
];
/** 値がdata:でなければ落とす属性。publish出力を外部参照ゼロに保つ。 */
const RAW_HTML_RESOURCE_ATTRIBUTES = new Set([
  "src", "srcset", "poster", "background", "data", "formaction", "action", "ping", "xlink:href",
]);

function isDataUriValue(value: string): boolean {
  return /^\s*data:/i.test(value);
}

function stripExternalUrlFunctions(css: string): string {
  return css
    .replace(/@import[^;]*;?/gi, "")
    .replace(/url\(\s*(['"]?)([^)'"]*)\1\s*\)/gi, (match, _quote: string, url: string) =>
      isDataUriValue(url) ? match : "none");
}

/**
 * `rawHtml` ブロックの中身を、publishしても安全な形へ削る。
 *
 * 保存時 (normalize) と描画時の両方で通す。保存時に通すのは、エディタのプレビューと
 * publish出力を同じ本文にするため。何度通しても結果が変わらない (冪等) ことを契約テストで固定する。
 * 冪等でないとモデルのsha256が保存のたびに動き、楽観ロックが誤検知する。
 *
 * 正規表現でHTMLを削るので、属性値に `>` を含む極端な入力までは面倒を見きれない。
 * 最後の砦は表示側のCSP (`default-src 'none'`、scriptを一切許さない) で、ここはその手前の一段。
 */
export function sanitizeWorkspaceDeckRawHtml(html: string): string {
  let out = html;

  for (const element of RAW_HTML_DROPPED_ELEMENTS) {
    out = out.replace(new RegExp(`<${element}\\b[^>]*>[\\s\\S]*?</${element}\\s*>`, "gi"), "");
    out = out.replace(new RegExp(`</?${element}\\b[^>]*>`, "gi"), "");
  }

  out = out.replace(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi, (_match, css: string) =>
    `<style>${stripExternalUrlFunctions(css)}</style>`);

  out = out.replace(/<([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g, (_match, tag: string, rawAttributes: string) => {
    const attributes = rawAttributes.replace(
      /\s([a-zA-Z_:][-a-zA-Z0-9_:.]*)(\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?/g,
      (attribute: string, name: string, assignment: string | undefined) => {
        const lowered = name.toLowerCase();
        const value = assignment ? assignment.replace(/^\s*=\s*/, "").replace(/^["']|["']$/g, "") : "";
        if (lowered.startsWith("on")) return "";
        if (/^\s*(?:javascript|vbscript)\s*:/i.test(value)) return "";
        if (lowered === "srcdoc") return "";
        if (lowered === "style") return ` style="${stripExternalUrlFunctions(value).replace(/"/g, "&quot;")}"`;
        if (RAW_HTML_RESOURCE_ATTRIBUTES.has(lowered) && value && !isDataUriValue(value)) return "";
        return attribute;
      },
    );
    return `<${tag}${attributes}>`;
  });

  return out;
}

// ---------------------------------------------------------------------------
// ブロック
// ---------------------------------------------------------------------------

function normalizeBlockStyle(value: unknown, path: string): WorkspaceDeckBlockStyle | undefined {
  if (value == null) return undefined;
  const record = readRecord(value, path);
  const style: WorkspaceDeckBlockStyle = {};
  if (record.align != null && record.align !== "") {
    style.align = readEnum(record.align, ["left", "center", "right"] as const, `${path}.align`);
  }
  if (record.space != null && record.space !== "") {
    style.space = readEnum(record.space, ["none", "sm", "md", "lg"] as const, `${path}.space`);
  }
  if (record.tone != null && record.tone !== "") {
    style.tone = readEnum(record.tone, ["default", "muted", "accent"] as const, `${path}.tone`);
  }
  return Object.keys(style).length ? style : undefined;
}

type BlockContext = {
  slideMode: WorkspaceDeckSlideMode;
  usedIds: Set<string>;
  /** twoColの中は1段だけ。カラムの中にカラムを積むと、固定16:9でまず読めなくなる。 */
  nested: boolean;
};

function claimId(rawId: unknown, fallback: string, path: string, usedIds: Set<string>): string {
  let id = fallback;
  if (rawId != null && rawId !== "") {
    if (typeof rawId !== "string" || !ID_PATTERN.test(rawId)) {
      fail(path, "idは英数字と - _ の40文字までだよ。");
    }
    if (usedIds.has(rawId)) fail(path, "同じidが2つあるよ。");
    id = rawId;
  } else {
    // idの無い手書きモデルにも位置から決まるidを与える。既に使われていたらずらす。
    let sequence = 2;
    while (usedIds.has(id)) id = `${fallback}-${sequence++}`;
  }
  usedIds.add(id);
  return id;
}

function normalizeBlock(value: unknown, path: string, context: BlockContext, fallbackId: string): WorkspaceDeckBlock {
  const record = readRecord(value, path);
  const type = readText(record.type, `${path}.type`, 40);
  const spec = WORKSPACE_DECK_BLOCK_SPECS[type];
  if (!spec) fail(`${path}.type`, `知らないブロック「${type}」だよ。`);
  if (spec.fixedOnly && context.slideMode !== "fixed16x9") {
    fail(`${path}.type`, `${spec.label}は固定16:9のスライドでだけ置けるよ。`);
  }
  if (!spec.implemented) fail(`${path}.type`, `${spec.label}はまだ使えないよ。`);

  const id = claimId(record.id, fallbackId, `${path}.id`, context.usedIds);
  const style = normalizeBlockStyle(record.style, `${path}.style`);
  const slots = readRecord(record.slots, `${path}.slots`);
  const base = style ? { id, style } : { id };

  switch (type) {
    case "heading": {
      const heading: WorkspaceDeckBlock = {
        ...base,
        type: "heading",
        slots: { title: readRequiredText(slots.title, `${path}.slots.title`, WORKSPACE_DECK_LIMITS.title) },
      };
      const eyebrow = readOptionalText(slots.eyebrow, `${path}.slots.eyebrow`, WORKSPACE_DECK_LIMITS.eyebrow);
      const lead = readOptionalText(slots.lead, `${path}.slots.lead`, WORKSPACE_DECK_LIMITS.lead);
      if (eyebrow) heading.slots.eyebrow = eyebrow;
      if (lead) heading.slots.lead = lead;
      return heading;
    }
    case "bullets": {
      const items = readArray(slots.items, `${path}.slots.items`, WORKSPACE_DECK_LIMITS.bulletItems);
      if (!items.length) fail(`${path}.slots.items`, "1行以上入れてね。");
      return {
        ...base,
        type: "bullets",
        variant: readEnum(record.variant, ["plain", "check", "number"] as const, `${path}.variant`, "plain"),
        slots: {
          items: items.map((item, index) =>
            normalizeWorkspaceDeckRichText(item, `${path}.slots.items[${index}]`)),
        },
      };
    }
    case "table": {
      const head = readArray(slots.head, `${path}.slots.head`, WORKSPACE_DECK_LIMITS.tableColumns);
      if (!head.length) fail(`${path}.slots.head`, "見出し行が要るよ。");
      const rows = readArray(slots.rows, `${path}.slots.rows`, WORKSPACE_DECK_LIMITS.tableRows);
      return {
        ...base,
        type: "table",
        variant: readEnum(record.variant, ["plain", "compare"] as const, `${path}.variant`, "plain"),
        slots: {
          head: head.map((cell, index) =>
            normalizeWorkspaceDeckRichText(cell, `${path}.slots.head[${index}]`)),
          rows: rows.map((row, rowIndex) => {
            const cells = readArray(row, `${path}.slots.rows[${rowIndex}]`, WORKSPACE_DECK_LIMITS.tableColumns);
            // 列数を勝手に足し引きしない。欠けた表を黙って描くと、抜けた数字に気づけない。
            if (cells.length !== head.length) {
              fail(`${path}.slots.rows[${rowIndex}]`, `列数が見出しと違うよ (${head.length}列)。`);
            }
            return cells.map((cell, cellIndex) =>
              normalizeWorkspaceDeckRichText(cell, `${path}.slots.rows[${rowIndex}][${cellIndex}]`));
          }),
        },
      };
    }
    case "twoCol": {
      if (context.nested) fail(`${path}.type`, "2カラムの中に2カラムは置けないよ。");
      const columns = (side: "left" | "right") => {
        const raw = readArray(slots[side], `${path}.slots.${side}`, WORKSPACE_DECK_LIMITS.columnBlocks);
        return raw.map((child, index) =>
          normalizeBlock(
            child,
            `${path}.slots.${side}[${index}]`,
            { ...context, nested: true },
            `${id}-${side}${index + 1}`,
          ));
      };
      return {
        ...base,
        type: "twoCol",
        variant: readEnum(record.variant, ["even", "wideLeft", "wideRight"] as const, `${path}.variant`, "even"),
        slots: { left: columns("left"), right: columns("right") },
      };
    }
    case "callout": {
      const callout: WorkspaceDeckBlock = {
        ...base,
        type: "callout",
        variant: readEnum(record.variant, ["info", "warn", "accent"] as const, `${path}.variant`, "info"),
        slots: { body: normalizeWorkspaceDeckRichText(slots.body, `${path}.slots.body`) },
      };
      const title = readOptionalText(slots.title, `${path}.slots.title`, WORKSPACE_DECK_LIMITS.title);
      if (title) callout.slots.title = title;
      if (!callout.slots.body.length && !title) fail(`${path}.slots.body`, "本文を入れてね。");
      return callout;
    }
    case "image": {
      const assetId = readRequiredText(slots.assetId, `${path}.slots.assetId`, 64).trim();
      if (!ASSET_ID_PATTERN.test(assetId)) fail(`${path}.slots.assetId`, "画像の指定が正しくないよ。");
      const image: WorkspaceDeckBlock = {
        ...base,
        type: "image",
        variant: readEnum(record.variant, ["inline", "bleed"] as const, `${path}.variant`, "inline"),
        slots: { assetId: assetId.toLowerCase() },
      };
      const caption = readOptionalText(slots.caption, `${path}.slots.caption`, WORKSPACE_DECK_LIMITS.caption);
      if (caption) image.slots.caption = caption;
      return image;
    }
    case "kpiRow": {
      const items = readArray(slots.items, `${path}.slots.items`, WORKSPACE_DECK_LIMITS.kpiItems);
      if (!items.length) fail(`${path}.slots.items`, "1つ以上入れてね。");
      return {
        ...base,
        type: "kpiRow",
        slots: {
          items: items.map((raw, index) => {
            const itemPath = `${path}.slots.items[${index}]`;
            const item = readRecord(raw, itemPath);
            const kpi: WorkspaceDeckKpiItem = {
              label: readRequiredText(item.label, `${itemPath}.label`, 40),
              value: readRequiredText(item.value, `${itemPath}.value`, 24),
            };
            const unit = readOptionalText(item.unit, `${itemPath}.unit`, 12);
            const note = readOptionalText(item.note, `${itemPath}.note`, 80);
            if (unit) kpi.unit = unit;
            if (note) kpi.note = note;
            return kpi;
          }),
        },
      };
    }
    case "rawHtml": {
      const html = readText(slots.html, `${path}.slots.html`, WORKSPACE_DECK_LIMITS.rawHtmlChars);
      return { ...base, type: "rawHtml", slots: { html: sanitizeWorkspaceDeckRawHtml(html) } };
    }
    default:
      // 語彙表にあって実装済みなのにここへ来るのは、ケースの追加漏れ。黙って落とさない。
      return fail(`${path}.type`, `${type}をまだ描けないよ。`);
  }
}

// ---------------------------------------------------------------------------
// スライドとデッキ
// ---------------------------------------------------------------------------

function normalizeSlide(
  value: unknown,
  path: string,
  index: number,
  defaults: WorkspaceDeck["defaults"],
  usedIds: Set<string>,
): WorkspaceDeckSlide {
  const record = readRecord(value, path);
  const id = claimId(record.id, `s${index + 1}`, `${path}.id`, usedIds);
  const mode = readEnum(record.mode, ["fixed16x9", "flow"] as const, `${path}.mode`, defaults.slideMode);
  const layout = readEnum(record.layout, ["cover", "section", "standard", "full"] as const, `${path}.layout`, "standard");
  const blocks = readArray(record.blocks, `${path}.blocks`, WORKSPACE_DECK_LIMITS.blocksPerSlide);

  const slide: WorkspaceDeckSlide = {
    id,
    mode,
    layout,
    blocks: blocks.map((block, blockIndex) =>
      normalizeBlock(block, `${path}.blocks[${blockIndex}]`, { slideMode: mode, usedIds, nested: false }, `${id}b${blockIndex + 1}`)),
  };
  const sectionTitle = readOptionalText(record.sectionTitle, `${path}.sectionTitle`, WORKSPACE_DECK_LIMITS.sectionTitle);
  const notes = readOptionalText(record.notes, `${path}.notes`, WORKSPACE_DECK_LIMITS.notes);
  if (sectionTitle) slide.sectionTitle = sectionTitle;
  if (notes) slide.notes = notes;
  return slide;
}

function normalizeTokens(value: unknown, path: string): WorkspaceDeckTokens {
  if (value == null) return {};
  const record = readRecord(value, path);
  const tokens: WorkspaceDeckTokens = {};
  for (const key of TOKEN_KEYS) {
    const raw = record[key];
    if (raw == null || raw === "") continue;
    const color = readText(raw, `${path}.${key}`, 7).trim().toLowerCase();
    // 色は #rrggbb だけ。CSSへそのまま入れるので、任意の文字列を通すと宣言を割られる。
    if (!HEX_COLOR_PATTERN.test(color)) fail(`${path}.${key}`, "色は #rrggbb 形式で書いてね。");
    tokens[key] = color;
  }
  return tokens;
}

/**
 * 受け取った値を schema v1 の正規形へ直す。検証と正規化を1回で済ませるのは、
 * 「検証は通ったが保存された形は別」を作らないため。戻り値の `deck` だけを保存・描画に使う。
 */
export function normalizeWorkspaceDeck(value: unknown, updatedAtFallback?: string): WorkspaceDeckValidation {
  try {
    const record = readRecord(value, "deck");
    const schemaVersion = readInt(
      record.schemaVersion,
      "deck.schemaVersion",
      1,
      99,
      WORKSPACE_DOCUMENT_DECK_SCHEMA_VERSION,
    );
    if (schemaVersion !== WORKSPACE_DOCUMENT_DECK_SCHEMA_VERSION) {
      fail("deck.schemaVersion", `このOSが読めるのはschema v${WORKSPACE_DOCUMENT_DECK_SCHEMA_VERSION}だけだよ。`);
    }

    const meta = readRecord(record.meta, "deck.meta");
    const theme = record.theme == null ? {} : readRecord(record.theme, "deck.theme");
    const defaultsRecord = record.defaults == null ? {} : readRecord(record.defaults, "deck.defaults");

    const updatedAtRaw = readOptionalText(meta.updatedAt, "deck.meta.updatedAt", 40);
    // updatedAtはモデルの中身の一部。serverで毎回now()を入れるとsha256が保存のたびに動き、
    // 「中身が変わっていない保存」を見分けられなくなる。渡された値をそのまま正本にする。
    const updatedAt = updatedAtRaw ?? updatedAtFallback ?? "";
    if (updatedAt && Number.isNaN(Date.parse(updatedAt))) {
      fail("deck.meta.updatedAt", "日時の形式が読めないよ。");
    }

    const defaults: WorkspaceDeck["defaults"] = {
      slideMode: readEnum(defaultsRecord.slideMode, ["fixed16x9", "flow"] as const, "deck.defaults.slideMode", "fixed16x9"),
      contentWidthPx: readInt(
        defaultsRecord.contentWidthPx,
        "deck.defaults.contentWidthPx",
        WORKSPACE_DECK_LIMITS.contentWidthPxMin,
        WORKSPACE_DECK_LIMITS.contentWidthPxMax,
        DEFAULT_CONTENT_WIDTH_PX,
      ),
    };

    const slideValues = readArray(record.slides, "deck.slides", WORKSPACE_DECK_LIMITS.slides);
    if (!slideValues.length) fail("deck.slides", "スライドが1枚も無いよ。");
    const usedIds = new Set<string>();

    const deck: WorkspaceDeck = {
      schemaVersion: WORKSPACE_DOCUMENT_DECK_SCHEMA_VERSION,
      meta: {
        title: readRequiredText(meta.title, "deck.meta.title", WORKSPACE_DECK_LIMITS.title),
        docType: readEnum(meta.docType, ["deck", "doc"] as const, "deck.meta.docType", "deck"),
        updatedAt,
      },
      theme: {
        preset: readEnum(theme.preset, ["amd"] as const, "deck.theme.preset", "amd"),
        tokens: normalizeTokens(theme.tokens, "deck.theme.tokens"),
        logo: readEnum(
          theme.logo,
          ["amd_horizontal", "amd_mark", "none"] as const,
          "deck.theme.logo",
          "amd_horizontal",
        ),
      },
      defaults,
      slides: slideValues.map((slide, index) =>
        normalizeSlide(slide, `deck.slides[${index}]`, index, defaults, usedIds)),
    };

    const byteLength = workspaceDeckByteLength(deck);
    if (byteLength > WORKSPACE_DOCUMENT_DECK_MODEL_MAX_BYTES) {
      fail("deck", `モデルが大きすぎるよ (${Math.round(WORKSPACE_DOCUMENT_DECK_MODEL_MAX_BYTES / 1024 / 1024)}MBまで)。画像はアセットで持ってね。`);
    }
    return { ok: true, deck };
  } catch (error) {
    if (error instanceof DeckModelError) return { ok: false, error: error.message, path: error.path };
    throw error;
  }
}

/**
 * 正規形の直列化。sha256とbyte数はこの1本を通す。
 * 正規化がキーを毎回同じ順で組み立てるので、経路が違っても同じ内容なら同じ文字列になる。
 */
export function serializeWorkspaceDeck(deck: WorkspaceDeck): string {
  return JSON.stringify(deck);
}

export function workspaceDeckByteLength(deck: WorkspaceDeck): number {
  return new TextEncoder().encode(serializeWorkspaceDeck(deck)).byteLength;
}

/** モデルが参照している画像のid。publishの埋め込み対象と、未参照アセットの判定に使う。 */
export function collectWorkspaceDeckAssetIds(deck: WorkspaceDeck): string[] {
  const ids = new Set<string>();
  const walk = (blocks: WorkspaceDeckBlock[]) => {
    for (const block of blocks) {
      if (block.type === "image") ids.add(block.slots.assetId);
      else if (block.type === "twoCol") {
        walk(block.slots.left);
        walk(block.slots.right);
      }
    }
  };
  for (const slide of deck.slides) walk(slide.blocks);
  return [...ids];
}

/** 最小の有効なデッキ。新規作成と、契約テストの土台に使う。 */
export function createWorkspaceDeck(title: string, updatedAt: string): WorkspaceDeck {
  const validation = normalizeWorkspaceDeck({
    schemaVersion: WORKSPACE_DOCUMENT_DECK_SCHEMA_VERSION,
    meta: { title, docType: "deck", updatedAt },
    theme: { preset: "amd", logo: "amd_horizontal" },
    defaults: { slideMode: "fixed16x9", contentWidthPx: DEFAULT_CONTENT_WIDTH_PX },
    slides: [
      {
        id: "s1",
        mode: "fixed16x9",
        layout: "cover",
        sectionTitle: title,
        blocks: [{ id: "s1b1", type: "heading", slots: { title } }],
      },
    ],
  });
  if (!validation.ok) throw new Error(`workspace deck seed invalid: ${validation.path} ${validation.error}`);
  return validation.deck;
}
