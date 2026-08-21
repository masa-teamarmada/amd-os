/**
 * 知財台帳 (project_ip_*) の共通型とラベル。
 *
 * スコープは AMD 自社知財だけでなく、その技術領域の IP 全体マップ (before zero の定石)。
 * migration: scripts/migrations/308_project_ip_ledger.sql
 * API: /api/project-ip / UI: src/components/cockpit/CockpitIpPortfolio.tsx
 */

export type IpRelation = "own" | "university" | "joint" | "blocking" | "watch";

export type IpAsset = {
  ip_asset_id: string;
  project_id: string;
  relation: IpRelation;
  ip_kind: string;
  title: string;
  abstract_text: string | null;
  jurisdiction: string;
  family_key: string | null;
  application_number: string | null;
  publication_number: string | null;
  registration_number: string | null;
  application_date: string | null;
  publication_date: string | null;
  registration_date: string | null;
  expiry_date: string | null;
  applicants: string[] | null;
  inventors: string[] | null;
  status: string;
  tech_domain: string | null;
  ipc_codes: string[] | null;
  cpc_codes: string[] | null;
  claim_breadth: number | null;
  importance: number;
  threat_level: string | null;
  confidentiality: string;
  note_md: string | null;
  external_url: string | null;
  source_kind: string;
  external_sync_at: string | null;
};

export type IpDeadline = {
  ip_deadline_id: string;
  ip_asset_id: string;
  project_id: string;
  deadline_kind: string;
  label: string | null;
  due_on: string;
  status: string;
  owner_member_id: string | null;
  note: string | null;
  source_kind: string;
};

export type IpRight = {
  ip_right_id: string;
  ip_asset_id: string;
  holder_kind: string;
  holder_name: string;
  share_pct: number | null;
  license_to_project: string;
  license_agreement_status: string;
  royalty_terms: string | null;
  non_practice_compensation: string | null;
  note: string | null;
};

export type IpEvent = {
  ip_event_id: string;
  ip_asset_id: string;
  project_id: string;
  event_date: string;
  event_kind: string;
  title: string;
  detail: string | null;
  source_kind: string;
};

/** 立場 (relation) = 特許マップの色分け軸。 */
export const RELATION_META: Record<IpRelation, { label: string; short: string; hex: string; cls: string }> = {
  own:        { label: "自社保有",       short: "自社",   hex: "#059669", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  university: { label: "大学基本特許",   short: "大学",   hex: "#0284c7", cls: "border-sky-200 bg-sky-50 text-sky-700" },
  joint:      { label: "共同出願",       short: "共同",   hex: "#7c3aed", cls: "border-violet-200 bg-violet-50 text-violet-700" },
  blocking:   { label: "障害特許",       short: "障害",   hex: "#e11d48", cls: "border-rose-200 bg-rose-50 text-rose-700" },
  watch:      { label: "ウォッチ",       short: "監視",   hex: "#64748b", cls: "border-border bg-muted/40 text-muted-foreground" },
};

export const RELATION_ORDER: IpRelation[] = ["own", "university", "joint", "blocking", "watch"];

export const IP_KIND_LABEL: Record<string, string> = {
  patent: "特許", utility_model: "実用新案", design: "意匠", trademark: "商標",
  trade_secret: "営業秘密", know_how: "ノウハウ", copyright: "著作権",
};

export const IP_STATUS_LABEL: Record<string, string> = {
  idea: "着想", drafting: "明細書作成中", filed: "出願済", published: "公開",
  under_examination: "審査中", granted: "登録", rejected: "拒絶", withdrawn: "取下げ",
  expired: "満了", abandoned: "放棄", unknown: "不明",
};

export const DEADLINE_KIND_LABEL: Record<string, string> = {
  examination_request: "審査請求期限",
  pct_national_phase: "PCT国内移行",
  priority_claim: "優先権主張期限",
  office_action_response: "拒絶理由応答",
  annuity: "年金納付",
  grace_period: "新規性喪失の例外",
  other: "その他",
};

export const EVENT_KIND_LABEL: Record<string, string> = {
  filed: "出願", published: "公開", office_action: "拒絶理由通知", response: "応答",
  granted: "登録", rejected: "拒絶査定", appeal: "審判", assignment: "移転",
  license: "ライセンス", annuity_paid: "年金納付", lapsed: "失効", opposition: "異議",
  search_report: "調査報告", note: "メモ", other: "その他",
};

export const HOLDER_KIND_LABEL: Record<string, string> = {
  amd: "AMD", project_company: "PJ法人", university: "大学",
  partner_company: "パートナー企業", inventor: "発明者", other: "その他",
};

export const LICENSE_LABEL: Record<string, string> = {
  none: "なし", negotiating: "交渉中", option: "オプション",
  non_exclusive: "非独占", exclusive: "独占",
};

export const AGREEMENT_LABEL: Record<string, string> = {
  none: "未締結", negotiating: "交渉中", drafted: "ドラフト", executed: "締結済", expired: "失効",
};

export const THREAT_LABEL: Record<string, { txt: string; cls: string }> = {
  none:   { txt: "脅威なし", cls: "border-border bg-muted/40 text-muted-foreground" },
  low:    { txt: "脅威 低",  cls: "border-border bg-muted/40 text-muted-foreground" },
  medium: { txt: "脅威 中",  cls: "border-amber-200 bg-amber-50 text-amber-700" },
  high:   { txt: "脅威 高",  cls: "border-rose-200 bg-rose-50 text-rose-700" },
};

/** 権利範囲の広さ (claim_breadth) = 特許マップの Y 軸。 */
export const CLAIM_BREADTH_LABEL: Record<number, string> = {
  1: "1 極めて狭い", 2: "2 狭い", 3: "3 中程度", 4: "4 広い", 5: "5 極めて広い",
};

/** 出願番号などから J-PlatPat / Espacenet の外部リンクを組む。 */
export function externalSearchUrl(asset: IpAsset): { label: string; url: string } | null {
  if (asset.external_url) return { label: "外部リンク", url: asset.external_url };
  const num = asset.publication_number || asset.registration_number || asset.application_number;
  if (!num) return null;
  if (asset.jurisdiction === "JP") {
    return { label: "J-PlatPat で検索", url: `https://www.j-platpat.inpit.go.jp/s0100?query=${encodeURIComponent(num)}` };
  }
  return { label: "Espacenet で検索", url: `https://worldwide.espacenet.com/patent/search?q=${encodeURIComponent(num)}` };
}

/** 期限までの残日数 (負なら超過)。 */
export function daysUntil(dateStr: string): number {
  const due = new Date(`${dateStr}T00:00:00+09:00`).getTime();
  const now = Date.now();
  return Math.ceil((due - now) / 86400000);
}
