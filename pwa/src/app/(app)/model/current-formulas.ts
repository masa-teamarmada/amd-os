import { headingAnchorId } from "@/lib/heading-anchor";
import { getModelMarkdownSource } from "./model-data";

/**
 * 現行モデル（BZM 3.0）の式を、正本（model/MODEL_VERSION_LEDGER.md）から抜き出す。
 *
 * まさ 2026-08-25「モデルページがだいぶボリューミーになってきた。正本の式が一番下に
 * 置かれていて読みにくいので、これを一番上にもってきてほしい」。
 *
 * ページ下部の「すべての式」は `formula-canon.ts` が `bzm/` から抽出している**旧 BZM 2.2 系列**で、
 * 2026-08-24 の BZM 3.0 採用で退役した（画面に札あり）。したがって「一番上に持ってくる」ときに
 * あの一覧をそのまま上げると、**退役した式がページの先頭に出る**。現行の式は台帳 §5・§6 にあるので、
 * ここでそれを抜き出す。
 *
 * 画面側で式を書き起こしたり並べ替えたりはしない。**正本に現れる順**でそのまま拾い、
 * それぞれが正本のどの節にあるかへのリンクを添えるだけ。正本に式が増えれば、ここは何もしなくても追随する。
 */

export interface CurrentFormula {
  /** 正本での通し番号（1 始まり。出現順） */
  index: number;
  /** TeX 本体（`$$` の中身） */
  tex: string;
  /** その式が置かれている節の見出し（`{#id}` は除く） */
  section: string;
  /** 節へのアンカー id */
  anchor: string;
}

const HEADING_ID_RE = /\s*\{#([a-zA-Z0-9_-]+)\}\s*$/;

function headingParts(raw: string): { text: string; anchor: string } {
  const m = HEADING_ID_RE.exec(raw);
  if (m) {
    return { text: raw.replace(HEADING_ID_RE, "").trim(), anchor: m[1] };
  }
  const text = raw.trim();
  return { text, anchor: headingAnchorId(text) };
}

/**
 * 台帳を上から読み、`$$ … $$` を直近の見出しとセットで拾う。
 *
 * 見出しは h3 を優先する（h2 だけだと「5. BZM 3.0 — モデルの定義」に十数本が集まって、
 * どの式がどこの話か分からなくなる）。h3 が無い位置の式は h2 に紐づく。
 */
export function loadCurrentFormulas(): CurrentFormula[] {
  const source = getModelMarkdownSource("MODEL_VERSION_LEDGER");
  if (!source) return [];

  const lines = source.split("\n");
  const out: CurrentFormula[] = [];
  let h2: { text: string; anchor: string } | null = null;
  let h3: { text: string; anchor: string } | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      h2 = headingParts(line.slice(3));
      h3 = null;
      continue;
    }
    if (line.startsWith("### ")) {
      h3 = headingParts(line.slice(4));
      continue;
    }
    if (line.trim() !== "$$") continue;

    const buf: string[] = [];
    let j = i + 1;
    while (j < lines.length && lines[j].trim() !== "$$") {
      buf.push(lines[j]);
      j += 1;
    }
    i = j;

    const tex = buf.join("\n").trim();
    if (!tex) continue;
    const head = h3 ?? h2;
    if (!head) continue;

    out.push({
      index: out.length + 1,
      tex,
      section: head.text,
      anchor: head.anchor,
    });
  }

  return out;
}
