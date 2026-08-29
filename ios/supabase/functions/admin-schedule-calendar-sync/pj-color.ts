/**
 * カレンダー色 ⇄ PJ の対応 (双方向)。
 *
 * 正本データは外部スプレッドシート `CalendarRepo_AMD_OS` の `CFG_ColorPJHistory`
 * (env `COLOR_PJ_CONFIG_SPREADSHEET_ID`)。まさが直接メンテする履歴表で、
 * 同じ colorId を時期で別 PJ へ振り替えられる。
 *
 * - 色 → PJ: H-1 MTG 抽出の第一軸 (manual 3-2 §カレンダー色 → PJ 判定)。
 * - PJ → 色: AMD OS が「＋<PJコード> <タスク>」の作業枠を書くときに付ける色。
 *   まさのカレンダーは PJ ごとに塗り分けられているので、OS が自分で入れる枠も
 *   同じ色でないと、まさから見て「どの PJ の予定か」が一目で分からなくなる。
 *
 * ここのスナップショットはランタイムに Drive を読めない経路 (Edge Function /
 * dry-run planner / guard) 用。値を変えるときはスプレッドシート側と必ず揃える。
 *
 * このファイルは `pwa/src/lib/calendar-pj-color.ts` と同一内容の Deno 用コピー。
 * Edge Function は pwa/src を import できないため二重に置いている。
 * ずれは `npm run test:calendar-pj-color` (pwa) が deep-equal で落とす。
 */

export type ColorPJHistoryRow = {
  /** Google Calendar の event colorId。12 以上はカレンダー単位の色で event には付かない */
  colorId: string;
  /** この割当が有効になる日 (YYYY-MM-DD, JST) */
  startDate: string;
  /** PJ コード。空文字は「割当なし」 */
  pjCode: string;
  note?: string;
};

/** CFG_ColorPJHistory のスナップショット (2026-08-29 時点) */
export const COLOR_PJ_HISTORY: ColorPJHistoryRow[] = [
  { colorId: "1", startDate: "2024-01-01", pjCode: "LST", note: "薄紫" },
  { colorId: "2", startDate: "2024-01-01", pjCode: "BWE", note: "エメラルド" },
  { colorId: "3", startDate: "2024-01-01", pjCode: "r3kt", note: "紫" },
  { colorId: "3", startDate: "2024-07-01", pjCode: "B1" },
  { colorId: "3", startDate: "2025-05-29", pjCode: "ZMP" },
  { colorId: "4", startDate: "2024-01-01", pjCode: "MC", note: "桃" },
  { colorId: "4", startDate: "2025-01-01", pjCode: "AER" },
  { colorId: "4", startDate: "2025-06-01", pjCode: "SX" },
  { colorId: "5", startDate: "2024-01-01", pjCode: "CTB", note: "黄" },
  { colorId: "5", startDate: "2025-05-01", pjCode: "YD" },
  { colorId: "5", startDate: "2025-11-01", pjCode: "UST" },
  { colorId: "6", startDate: "2024-01-01", pjCode: "JC", note: "橙" },
  { colorId: "6", startDate: "2026-05-28", pjCode: "VSX", note: "JC→VSX 色割当 (まさ依頼 2026-05-28)" },
  { colorId: "7", startDate: "2024-01-01", pjCode: "CTB", note: "水" },
  { colorId: "7", startDate: "2024-12-01", pjCode: "ORB", note: "水" },
  { colorId: "7", startDate: "2026-04-01", pjCode: "CLG", note: "ORB->CLG (Peacock)" },
  { colorId: "9", startDate: "2024-01-01", pjCode: "CCC", note: "青" },
  { colorId: "9", startDate: "2025-06-01", pjCode: "CX", note: "青" },
  { colorId: "10", startDate: "2024-01-01", pjCode: "SE", note: "緑" },
  { colorId: "11", startDate: "2024-01-01", pjCode: "private", note: "赤" },
  { colorId: "11", startDate: "2026-05-01", pjCode: "KUTE" },
  { colorId: "21", startDate: "2024-01-01", pjCode: "CTB", note: "水 (カレンダー単位色)" },
  { colorId: "21", startDate: "2024-12-01", pjCode: "AMD", note: "カレンダー単位色。event colorId としては使えない" },
];

/** project_id / project_name から CFG_ColorPJHistory の pjCode へ寄せる */
const PROJECT_TO_PJ_CODE: Record<string, string> = {
  p00: "AMD",
  p01: "OPT",
  p02: "r3kt",
  p03: "tiem",
  p04: "KT",
  p05: "MC",
  p06: "CTB",
  p07: "LST",
  p08: "CCC",
  p09: "JC",
  p10: "SE",
  p11: "BWE",
  p12: "B1",
  p14: "AER",
  p16: "ORB",
  p18: "YD",
  p19: "ZMP",
  p20: "CX",
  p21: "SX",
  p22: "OQC",
  p23: "UST",
  p24: "CLG",
  p25: "KUTE",
  p26: "VSX",
  p28: "NIMS",
  p29: "KENQ",
  p30: "EHM",
  p31: "ZEO",
  vasculax: "VSX",
};

/** Google Calendar の event colorId として実際に付けられる範囲 */
function isEventColorId(colorId: string): boolean {
  const n = Number(colorId);
  return Number.isInteger(n) && n >= 1 && n <= 11;
}

function ymd(on: Date | string): string {
  if (typeof on === "string") return on.slice(0, 10);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(on);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** project_id (p21) / project_name (SX, VasculaX) / pjCode いずれからでも pjCode を返す */
export function normalizePjCode(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const mapped = PROJECT_TO_PJ_CODE[raw.toLowerCase()];
  if (mapped) return mapped;
  return raw;
}

/**
 * 色 → PJ。startDate <= 対象日 の行のうち startDate 最大の pjCode を返す (履歴方式)。
 * H-1 の第一軸と同じ解決順で、こちらは planner / guard 用の純関数版。
 */
export function resolveProjectForColorId(colorId: string | null | undefined, on: Date | string = new Date()): string | null {
  const key = String(colorId ?? "").trim();
  if (!key) return null;
  const date = ymd(on);
  const rows = COLOR_PJ_HISTORY
    .filter((row) => row.colorId === key && row.startDate <= date)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const pjCode = rows.length ? rows[rows.length - 1].pjCode.trim() : "";
  return pjCode || null;
}

/**
 * PJ → 色。対象日時点でその PJ に割り当たっている event colorId を返す。
 * 色を持たない PJ (AMD、NIMS、KENQ、EHM など) は null。null は「色なしで書く」であって、
 * 別の色で代用してよいという意味ではない。
 */
export function resolveColorIdForProject(project: string | null | undefined, on: Date | string = new Date()): string | null {
  const pjCode = normalizePjCode(project);
  if (!pjCode) return null;
  const date = ymd(on);
  const candidates = [...new Set(COLOR_PJ_HISTORY.map((row) => row.colorId))]
    .filter(isEventColorId)
    .filter((colorId) => {
      const current = resolveProjectForColorId(colorId, date);
      return current !== null && current.toLowerCase() === pjCode.toLowerCase();
    })
    .sort((a, b) => Number(a) - Number(b));
  return candidates.length ? candidates[0] : null;
}
