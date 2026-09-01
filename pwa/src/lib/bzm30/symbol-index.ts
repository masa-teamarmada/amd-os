/**
 * 式の中の記号を、「この案件での値」または「全案件共通の係数の値」へ引き当てる索引。
 *
 * まさ 2026-09-02:「おれがモデル全体をいつでも確認できるようにしておかないといけないので、
 * その何件って数えてくれた要素だけを並べておくのではなく、式とあわせて、それぞれの要素について
 * 説明を書いておいてほしい。（略）各PJで実際にその式に入っている数値を見ながら、式を見ながら、
 * 説明を見ながら、違和感がないか確認することができるので。」
 *
 * それまでは、式（正本から）・案件ごとの入力（13項目）・係数の実値（75件）が別々のブロックに
 * 分かれていて、式に出てくる記号がどの値なのかを画面の上でたどれなかった。この層は3つを記号で結ぶ。
 *
 * 値の出どころは3系統ある。
 *   1. 案件ごとの入力 … その案件について調べて入れた値。空なら「未調査」と出す
 *   2. 全案件共通の係数 … 参照実装の CFG。根拠レベル（A/B/C/確定/規約）と正本の節を持つ
 *   3. 計算で出る量 … スコアそのものや中間量。入力でも係数でもない
 *
 * **画面が値を書き起こさない。** 1 は DB、2 は tier0.json（参照実装の写し）から来る。
 */

import type { Bzm30Model } from "@/lib/bzm30-model-client";
import type { Bzm30SeedInput } from "./seed-inputs";

export type SymbolOrigin = Bzm30SeedInput["origin"] | "全案件共通の係数" | "計算で出る量";

export interface ResolvedSymbol {
  /** 式に出てくる記号（TeX） */
  symbol: string;
  /** 正本の記号表にある意味 */
  meaning: string;
  /** 引き当てた値。引き当てられなければ null */
  value: string | null;
  origin: SymbolOrigin | null;
  /** 係数のとき: 根拠レベル（A / B / C / 確定 / 規約） */
  level?: string;
  /** 係数のとき: 正本の節 */
  section?: string;
  /** 係数のとき: その係数が何をしているかの説明 */
  note?: string;
  /** 案件入力のとき: 何を見て置いた値か（出どころ・根拠） */
  source?: string;
}

/**
 * TeX の表記ゆれを吸収する。正本の記号表と参照実装の CFG は別々に書かれているので、
 * 書き方が揃っていない。とくに**正本の記号表は `$…$` で囲まれていて、CFG の側は囲まれていない**
 * （ここを吸収しないと1件も引き当てられない）。
 */
function norm(tex: string): string {
  return tex
    .replace(/\$/g, "")
    .replace(/\\(?:bigg?l?r?|Bigg?l?r?|left|right|displaystyle|mathrm|mathbb|text|,|;|:|!)/g, "")
    .replace(/[{}\s()]/g, "")
    .toLowerCase();
}

/** 記号が同じものを指しているか。添字違い（θ の成分など）は別扱いにしない。 */
function sameSymbol(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  return na === nb;
}

/**
 * 正本の記号表には「$\bar P_u - \delta_u$」のように**複合の形**でしか現れない量がある。
 * 案件ごとの入力は成分ごと（天井・置き換え分）に持っているので、合計の入力キーへ手で結ぶ。
 * ここに書いた分だけが引き当たる（推測でつながない）。
 */
const COMPOSITE_ALIAS: { pattern: string; inputKey: string }[] = [
  { pattern: "\\bar P_u - \\delta_u", inputKey: "total" },
  // 「$\frac{\bar P_u - \delta_u}{12}$」（月額に直した量）はここに入れない。
  // 案件入力が持っているのは年額なので、同じ数字を月額の行にも出すと 12 倍ずれた値を見せることになる。
];

/**
 * 式に出てくる記号を、案件入力 → 係数 の順に引き当てる。
 * 案件入力を先に見るのは、案件ごとに調べた値があるならそちらが実際に計算へ入るため。
 */
export function resolveFormulaSymbols(
  symbols: { symbol: string; meaning: string }[],
  inputs: Bzm30SeedInput[],
  params: Bzm30Model["params"],
  /** この案件の算出済みスコア。スコアそのものを指す記号（V）に実際の値を出すために使う */
  scoreValue?: { symbol: string; value: string }[],
): ResolvedSymbol[] {
  return symbols.map((s) => {
    const scored = scoreValue?.find((v) => sameSymbol(v.symbol, s.symbol));
    if (scored) {
      return { symbol: s.symbol, meaning: s.meaning, value: scored.value, origin: "計算で出る量" };
    }
    const alias = COMPOSITE_ALIAS.find((a) => sameSymbol(a.pattern, s.symbol));
    const aliasHit = alias ? inputs.find((i) => i.key === alias.inputKey) : undefined;
    if (aliasHit) {
      return {
        symbol: s.symbol,
        meaning: s.meaning,
        value: aliasHit.value,
        origin: aliasHit.origin,
        source: aliasHit.source,
      };
    }
    const hit = inputs.find((i) => sameSymbol(i.symbol, s.symbol));
    if (hit) {
      return {
        symbol: s.symbol,
        meaning: s.meaning,
        value: hit.value,
        origin: hit.origin,
        source: hit.source,
      };
    }
    const p = params.find((q) => sameSymbol(q.symbol, s.symbol));
    if (p) {
      return {
        symbol: s.symbol,
        meaning: s.meaning,
        value: p.display,
        origin: "全案件共通の係数",
        level: p.level,
        section: p.section,
        note: p.note,
      };
    }
    return { symbol: s.symbol, meaning: s.meaning, value: null, origin: null };
  });
}

/**
 * 式のどれにも記号として現れない係数を返す（過程の中だけで効く係数）。
 * 式の下に出す表と重複させないために使う。
 */
export function paramsNotInFormulas(
  formulas: { symbols: { symbol: string }[] }[],
  params: Bzm30Model["params"],
): Bzm30Model["params"] {
  const shown = new Set<string>();
  for (const f of formulas) for (const s of f.symbols) shown.add(norm(s.symbol));
  return params.filter((p) => !p.symbol || !shown.has(norm(p.symbol)));
}
