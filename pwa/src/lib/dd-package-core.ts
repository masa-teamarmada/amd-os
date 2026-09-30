// DDパッケージ（投資家・金融機関向けの開示面）の純粋な判定ロジック。
// DB・ネットワークには触れない。scripts/check_dd_package_core.mts から直接検査する。
//
// 領域と操作を分けて持つ（2026-09-30 まさ確定）:
//   - 入れる領域 … コックピット / ワークスペース / DD の3つ。DDへ入れる根拠は dd_package_grants の行だけで、
//     project_access_memberships（ワークスペース）や institution_workspace_memberships（機関）とは独立。
//     DDの付与はワークスペースへ入る根拠にならず、ワークスペースの所属もDDへ入る根拠にならない。
//   - できる操作 … 付与行の capabilities（dd.view / dd.download）。領域に入れても操作は付与された分だけ。
//
// ここで固定する規則（弱めるときは pwa/spec/5-17-dd-package-current-spec.md を先に直す）:
//   - アカウントが active で、Supabase 認証と紐付いていて、cookie のメールと一致するときだけ解決する
//   - 付与は status='active' かつ期限内、パッケージは status='open' のときだけ数える
//   - capabilities は既知の値だけを残し、dd.view を含まない付与は数えない
//   - 数えられる付与が0件なら null（閉じる側へ倒す）

export const DD_SECTIONS = [
  {
    key: "business",
    label: "事業概要",
    description: "何を誰に提供し、どう収益を得るか",
  },
  {
    key: "technology",
    label: "技術・製品",
    description: "技術の中身、検証結果、製品化の条件",
  },
  {
    key: "market",
    label: "顧客・市場",
    description: "顧客候補、市場、競合",
  },
  {
    key: "economics",
    label: "採算・数値計画",
    description: "単位採算、費用計画、月次資金繰り",
  },
  {
    key: "capital",
    label: "資本政策",
    description: "調達ラウンド、転換条件、持分",
  },
  {
    key: "ip_contracts_team",
    label: "知財・契約・体制",
    description: "権利、契約、経営・実行体制",
  },
  {
    key: "evidence",
    label: "証憑一覧",
    description: "根拠資料と未確認事項",
  },
] as const;

export type DdSectionKey = (typeof DD_SECTIONS)[number]["key"];

export const DD_SECTION_KEYS: readonly DdSectionKey[] = DD_SECTIONS.map((section) => section.key);

export function isDdSectionKey(value: unknown): value is DdSectionKey {
  return typeof value === "string" && (DD_SECTION_KEYS as readonly string[]).includes(value);
}

export function ddSectionLabel(key: DdSectionKey): string {
  return DD_SECTIONS.find((section) => section.key === key)?.label ?? key;
}

export type DdItemKind = "document" | "tech_topic" | "funding_plan" | "capital_policy" | "cost_model";

export const DD_ITEM_KINDS: readonly DdItemKind[] = ["document", "tech_topic", "funding_plan", "capital_policy", "cost_model"];

export const DD_ITEM_KIND_LABEL: Record<DdItemKind, string> = {
  document: "資料",
  tech_topic: "技術台帳のページ",
  funding_plan: "資金計画",
  capital_policy: "資本政策",
  cost_model: "採算（コスト試算）",
};

export function isDdItemKind(value: unknown): value is DdItemKind {
  return typeof value === "string" && (DD_ITEM_KINDS as readonly string[]).includes(value);
}

export type DdCapability = "dd.view" | "dd.download";
export const DD_CAPABILITIES: readonly DdCapability[] = ["dd.view", "dd.download"];

export type DdGrantStatus = "invited" | "active" | "suspended" | "revoked";
export type DdPackageStatus = "draft" | "open" | "closed";

export const DD_GRANT_STATUS_LABEL: Record<DdGrantStatus, string> = {
  invited: "招待済み（未ログイン）",
  active: "有効",
  suspended: "停止中",
  revoked: "失効",
};

export const DD_PACKAGE_STATUS_LABEL: Record<DdPackageStatus, string> = {
  draft: "未公開（管理者だけが確認できる）",
  open: "公開中（付与された人だけが閲覧できる）",
  closed: "受付終了（誰も閲覧できない）",
};

export const DD_CAPABILITY_LABEL: Record<DdCapability, string> = {
  "dd.view": "閲覧",
  "dd.download": "添付資料のダウンロード",
};

/** 付与行に保存された capabilities を既知の値だけへ絞る。順序は DD_CAPABILITIES に揃える。 */
export function normalizeDdCapabilities(raw: unknown): DdCapability[] {
  if (!Array.isArray(raw)) return [];
  const values = new Set(raw.filter((value): value is string => typeof value === "string"));
  return DD_CAPABILITIES.filter((capability) => values.has(capability));
}

export type DdAccountRow = {
  id: string;
  email_normalized: string;
  auth_user_id: string | null;
  status: "invited" | "active" | "suspended";
};

export type DdGrantRow = {
  id: string;
  status: DdGrantStatus;
  capabilities: unknown;
  expires_at: string | null;
  package: {
    id: string;
    slug: string;
    project_id: string;
    title: string;
    status: DdPackageStatus;
  } | null;
};

export type DdViewerPackage = {
  grantId: string;
  packageId: string;
  slug: string;
  projectId: string;
  title: string;
  capabilities: DdCapability[];
  expiresAt: string | null;
};

export type DdViewerScope = {
  accountId: string;
  email: string;
  packages: DdViewerPackage[];
};

function isUnexpired(expiresAt: string | null, nowMs: number): boolean {
  if (!expiresAt) return true;
  const parsed = Date.parse(expiresAt);
  // 読めない期限は失効扱い。期限の解釈に失敗して開く側へ倒さない。
  return Number.isFinite(parsed) && parsed > nowMs;
}

/**
 * 外部アカウントのDD閲覧範囲を組み立てる。null のときは「DDへ入れない」として閉じる。
 * cookie の中身だけでは呼ばない。呼び出し側は毎リクエスト DB を引き直した行を渡す。
 */
export function buildDdViewerScope(
  account: DdAccountRow | null,
  sessionEmail: string,
  grants: DdGrantRow[],
  nowMs: number = Date.now(),
): DdViewerScope | null {
  if (!account) return null;
  if (account.status !== "active") return null;
  if (!account.auth_user_id) return null;
  if (account.email_normalized !== sessionEmail) return null;

  const packages: DdViewerPackage[] = [];
  for (const grant of grants) {
    if (grant.status !== "active") continue;
    if (!grant.package || grant.package.status !== "open") continue;
    if (!isUnexpired(grant.expires_at, nowMs)) continue;
    const capabilities = normalizeDdCapabilities(grant.capabilities);
    if (!capabilities.includes("dd.view")) continue;
    packages.push({
      grantId: grant.id,
      packageId: grant.package.id,
      slug: grant.package.slug,
      projectId: grant.package.project_id,
      title: grant.package.title,
      capabilities,
      expiresAt: grant.expires_at,
    });
  }

  if (packages.length === 0) return null;
  packages.sort((a, b) => a.title.localeCompare(b.title, "ja"));
  return { accountId: account.id, email: account.email_normalized, packages };
}

/**
 * ログインリンクを送ってよい付与があるか（/api/auth/email-start と /auth/callback が使う）。
 * 招待済み・有効で、パッケージが公開中かつ期限内のものだけ。未公開・受付終了のパッケージへの付与では
 * ログインリンクを送らない（入った先で何も見られないため）。
 */
export function hasLoginEligibleDdGrant(
  grants: Array<{ status: string; capabilities: unknown; expires_at: string | null; package: { status: string } | null }>,
  nowMs: number = Date.now(),
): boolean {
  return grants.some((grant) =>
    (grant.status === "invited" || grant.status === "active")
    && grant.package?.status === "open"
    && isUnexpired(grant.expires_at, nowMs)
    && normalizeDdCapabilities(grant.capabilities).includes("dd.view"),
  );
}

/** DD の閲覧者（外部アカウント）と管理者プレビューを区別して扱うための型。 */
export type DdViewerAccess =
  | {
      principal: "internal_admin";
      memberId: string;
      email: string;
      packageId: string;
      slug: string;
      projectId: string;
      title: string;
      packageStatus: DdPackageStatus;
      capabilities: readonly DdCapability[];
      preview: true;
    }
  | {
      principal: "workspace_account";
      accountId: string;
      email: string;
      grantId: string;
      packageId: string;
      slug: string;
      projectId: string;
      title: string;
      packageStatus: "open";
      capabilities: readonly DdCapability[];
      preview: false;
    };

export function hasDdCapability(access: Pick<DdViewerAccess, "capabilities">, capability: DdCapability): boolean {
  return access.capabilities.includes(capability);
}

// --- 公開版の中身 -------------------------------------------------------------------

/**
 * 公開版 payload の決定的な直列化。キー順を固定して content hash を安定させる。
 * 同じ元データから同じ公開版を作ったとき、同じ hash になることを検査で固定する。
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
}

/** 未確認事項の入力を正規化する。空行を捨て、1件500文字・最大30件まで。 */
export function normalizeDdUnverifiedNotes(raw: unknown): string[] {
  const lines = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/\r?\n/)
      : [];
  return lines
    .filter((line): line is string => typeof line === "string")
    .map((line) => line.replace(/^[\s・\-*]+/, "").trim())
    .filter((line) => line.length > 0)
    .map((line) => line.slice(0, 500))
    .slice(0, 30);
}

// --- 載せる範囲（項目の中の節・行） -------------------------------------------------------

/**
 * 項目の中で、載せる・外すを選べる単位（本文の節、表の行、注意書き、方針の段落など）。
 * key は元データの識別子か、内容から決める短い hash。内容が変わった節・段落は別の key になり、選び直すまで載らない。
 */
export type DdPart = { key: string; label: string; group: string };

/** 載せる範囲を選べる種類。資料は1ファイル丸ごと、資本政策は「どのラウンドまで」で選ぶ。 */
export const DD_PART_ITEM_KINDS: readonly DdItemKind[] = ["tech_topic", "cost_model", "funding_plan"];

const DD_PART_KEY_PATTERN =
  /^(?:body:(?:lead|[0-9a-f]{8}(?:-\d{1,3})?)|row:[0-9a-f]{8}(?:-\d{1,3})?|entry:[A-Za-z0-9_-]{1,100}|scope|assumptions|caveat:[A-Za-z0-9_-]{1,100}|policy:[0-9a-f]{8}(?:-\d{1,3})?|assumption:[0-9a-f]{8}(?:-\d{1,3})?|source|equipmentNotes)$/;

export function isDdPartKey(value: unknown): value is string {
  return typeof value === "string" && DD_PART_KEY_PATTERN.test(value);
}

/** 1つの項目で選べる範囲の上限（技術台帳の大きな表でも収まる数）。 */
export const DD_PART_MAX = 1000;

/**
 * source_options.includedParts を読む。配列が無ければ null（元データの節・行をすべて載せる）。
 * 配列があれば、その key の節・行だけを載せる（あとから元データに増えた節・行は、選ぶまで載らない）。
 */
export function readDdIncludedParts(sourceOptions: Record<string, unknown> | null | undefined): ReadonlySet<string> | null {
  const raw = sourceOptions?.includedParts;
  if (!Array.isArray(raw)) return null;
  return new Set(raw.filter(isDdPartKey));
}

/** 内容から短い key を作る（FNV-1a 32bit）。暗号用途ではなく、同じ文なら同じ key になることだけを使う。 */
export function ddShortHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

const DD_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isDdSlug(value: unknown): value is string {
  return typeof value === "string" && value.length <= 64 && DD_SLUG_PATTERN.test(value);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

// --- 関所（middleware）で外部セッションを通す DD の path ------------------------------

/** 外部アカウントの署名 cookie を認証の代わりに使ってよい DD の path。中身の認可は各ページが行う。 */
export function isDdViewerPath(pathname: string): boolean {
  if (pathname === "/dd") return true;
  return /^\/dd\/[^/]+(?:\/items\/[^/]+(?:\/file)?)?\/?$/.test(pathname);
}
