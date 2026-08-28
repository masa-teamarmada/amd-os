import { getModelMarkdownSource } from "@/app/(app)/model/model-data";

/**
 * 経営チームの八機能（モデル正本 §6.B-1 の $\mathcal F$）を、正本から読む。
 *
 * **画面もこのファイルも機能の一覧を書き起こさない。** 正本の表をそのまま読む。
 * 機能の粒度は「係数の再較正を伴う版の更新」としてしか変わらない量なので（§6.B-1 の注記）、
 * 版が上がって表が書き換わったとき、画面が古い八機能を持ち続けるのが一番まずい。
 * 表が見つからなければ空を返し、呼び出し側は機能表そのものを出さない
 * （式について pwa/spec/4-8 が定めているのと同じ規律）。
 *
 * 充足の判定条件（§6.B-2）は計算なので `team-fulfillment.ts` 側に持つ。正本と乖離していないかは
 * `pwa/scripts/check_team_function_contract.mjs` が機械で見張る。
 */

/** §6.B-1 の表の1行。 */
export interface TeamFunctionDef {
  /** 機能番号 1〜8。observations の function_no と同じ番号。 */
  no: number;
  /** 機能の名前（「エバンジェリスト機能」など）。 */
  name: string;
  /** 中身の説明。 */
  summary: string;
  /** 移せるか（「移せない」/「移せる」/「—」）。 */
  movable: string;
  /** 空席の埋まり方。 */
  fillPath: string;
}

const EVIDENCE_RE = /\s*\[根拠\]\(#evidence(?:\s+"[^"]*")?\)/g;
const CITE_RE = /\s*\[\d+\]\(#ref-\d+(?:\s+"[^"]*")?\)/g;
const LINK_RE = /\[([^\]]+)\]\([^)]+\)/g;

/** 正本の地の文から、表のセルとして読める形にする。中身は変えない。 */
function cell(text: string): string {
  return text
    .replace(EVIDENCE_RE, "")
    .replace(CITE_RE, "")
    .replace(LINK_RE, "$1")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** `| a | b | c |` を列の配列にする。行末・行頭のパイプは落とす。 */
function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((c) => c.trim());
}

let cached: { value: TeamFunctionDef[]; storedAt: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

/**
 * 八機能を正本から読む。見つからなければ空配列。
 *
 * 探し方: `6.B-1` の見出しの後にある最初のパイプ表の、先頭列が数字の行。
 * 見出しの番号ごと変わるような改訂なら、機能表は出ないほうが安全なので探しに行かない。
 */
export function loadTeamFunctions(): TeamFunctionDef[] {
  if (cached && Date.now() - cached.storedAt < TTL_MS) return cached.value;

  const source = getModelMarkdownSource("MODEL_VERSION_LEDGER");
  const result: TeamFunctionDef[] = [];
  if (!source) {
    cached = { value: result, storedAt: Date.now() };
    return result;
  }

  const lines = source.split("\n");
  const headingIndex = lines.findIndex((line) => /^#{2,6}\s+6\.B-1\b/.test(line.trim()));
  if (headingIndex < 0) {
    cached = { value: result, storedAt: Date.now() };
    return result;
  }

  let inTable = false;
  for (let i = headingIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    // 次の見出しに入ったら、そこで表は終わり。
    if (/^#{2,6}\s/.test(line.trim())) break;
    const isTableRow = line.trim().startsWith("|");
    if (!isTableRow) {
      if (inTable) break;
      continue;
    }
    inTable = true;
    const cols = splitRow(line);
    if (cols.length < 5) continue;
    const no = Number.parseInt(cols[0], 10);
    if (!Number.isInteger(no)) continue; // ヘッダ行と区切り行はここで落ちる
    result.push({
      no,
      name: cell(cols[1]),
      summary: cell(cols[2]),
      movable: cell(cols[3]),
      fillPath: cell(cols[4]),
    });
  }

  cached = { value: result, storedAt: Date.now() };
  return result;
}
