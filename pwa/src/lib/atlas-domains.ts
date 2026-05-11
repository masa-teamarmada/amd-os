/**
 * Atlas のドメイン (A-O) → 色・短縮ラベル変換。
 * design_log/2026-04_atlas.md の指針:
 *   素材=青 / エネルギー=黄 / 規制=赤 / 技術=緑 を踏襲。
 */

const DOMAIN_COLOR: Record<string, string> = {
  A: "#ef4444", // 地政学 — red
  B: "#dc2626", // 規制 — red (deeper)
  C: "#3b82f6", // 素材 — blue
  D: "#eab308", // エネルギー — yellow
  E: "#22c55e", // 製造・プロセス — green
  F: "#ec4899", // バイオ・医療 — pink
  G: "#a855f7", // モビリティ — purple
  H: "#92400e", // 建築・インフラ — brown
  I: "#6366f1", // ICT/AI — indigo
  J: "#1e293b", // 宇宙・防衛 — dark slate
  K: "#84cc16", // 食・農・水産 — lime
  L: "#10b981", // 金融 — emerald
  M: "#f97316", // 社会構造 — orange
  N: "#06b6d4", // 海洋・水資源 — cyan
  O: "#14b8a6", // サーキュラー — teal
  // 2026-05-11 追加: ASPI 8 domain quantum / sensing / advanced_ict 補完
  P: "#8b5cf6", // 量子・量子計算 — violet
  Q: "#0ea5e9", // センシング・計測・測位・タイミング — sky
  R: "#71717a", // 先端通信 (6G / 衛星通信) — zinc
};

const DOMAIN_LABEL: Record<string, string> = {
  A: "地政学",
  B: "規制",
  C: "素材",
  D: "エネルギー",
  E: "製造",
  F: "バイオ",
  G: "モビリティ",
  H: "建築",
  I: "ICT/AI",
  J: "宇宙",
  K: "食/農",
  L: "金融",
  M: "社会",
  N: "海洋",
  O: "サーキュラー",
  P: "量子",
  Q: "センシング",
  R: "通信",
};

export function domainKey(domain: string | null | undefined): string | null {
  if (!domain) return null;
  const k = domain.charAt(0).toUpperCase();
  return DOMAIN_COLOR[k] ? k : null;
}

export function domainColor(domain: string | null | undefined): string {
  const k = domainKey(domain);
  return k ? DOMAIN_COLOR[k] : "#94a3b8";
}

export function domainLabel(domain: string | null | undefined): string {
  const k = domainKey(domain);
  return k ? DOMAIN_LABEL[k] : "—";
}

export const DOMAIN_KEYS = Object.keys(DOMAIN_COLOR);
export { DOMAIN_COLOR, DOMAIN_LABEL };
