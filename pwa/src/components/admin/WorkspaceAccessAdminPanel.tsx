"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, FolderKanban, Mail } from "lucide-react";

// Admin panel for external workspace access. Three independent grants, three sections:
//   1. 外部メールアカウント        — who exists at all
//   2. 研究機関ワークスペース権限  — which institution workspace they can open
//   3. 個別PJ権限                  — which individual PJ workspace they can open
// (2) never implies (3): the API creates them as separate rows and this UI says so.
// auth.users ids are never fetched or rendered here — people are identified by email.

type AccountRow = {
  id: string;
  email: string;
  display_name: string | null;
  status: string;
  last_login_at: string | null;
};

type WorkspaceRow = { id: string; slug: string; name: string; status: string; is_publicly_listed: boolean };
type ProjectRow = { project_id: string; project_name: string; status: string };
type InstitutionMembershipRow = {
  id: string;
  workspace_id: string;
  user_account_id: string;
  role: string;
  status: string;
};
type ProjectMembershipRow = {
  id: string;
  project_id: string;
  user_account_id: string;
  role: string;
  status: string;
};

type AccessData = {
  accounts: AccountRow[];
  institutionWorkspaces: WorkspaceRow[];
  institutionMemberships: InstitutionMembershipRow[];
  projects: ProjectRow[];
  projectMemberships: ProjectMembershipRow[];
};

const ACCOUNT_STATUS_LABELS: Record<string, string> = {
  invited: "招待済 (未ログイン)",
  active: "利用中",
  suspended: "停止",
};

const MEMBERSHIP_STATUS_LABELS: Record<string, string> = {
  invited: "招待済",
  active: "有効",
  suspended: "一時停止",
  revoked: "剥奪",
};

const INSTITUTION_ROLE_LABELS: Record<string, string> = {
  owner: "管理担当",
  member: "メンバー",
  readonly: "閲覧のみ",
};

const PROJECT_ROLE_LABELS: Record<string, string> = {
  manager: "管理担当",
  contributor: "参加者",
  readonly: "閲覧のみ",
};

const ERROR_LABELS: Record<string, string> = {
  invalid_json: "リクエストの形式が不正",
  invalid_kind: "操作の種類が不正",
  invalid_email: "メールアドレスの形式が不正",
  invalid_role: "権限の指定が不正",
  invalid_status: "状態の指定が不正",
  account_required: "対象アカウントを選ぶ",
  account_suspended: "このメールは停止中のアカウント。下の一覧で状態を変えてから招待する",
  unknown_account: "該当アカウントが無い。先に外部メールアカウントを追加する",
  workspace_required: "機関ワークスペースを選ぶ",
  unknown_workspace: "該当の機関ワークスペースが無い",
  project_required: "PJを選ぶ",
  unknown_project: "該当PJが無い",
  membership_required: "対象の権限行が不正",
  unknown_membership: "対象の権限行が見つからない",
  membership_exists: "すでに権限がある",
  membership_stopped: "既存の権限が停止/剥奪状態。一覧の状態を変更して再開する",
  institution_membership_required: "先に、この人へ対象の研究機関ワークスペース権限を付ける",
  kernel_access_stopped: "共同正本の権限が停止済み。暗黙再開はできないので個別確認が必要",
  project_access_grant_failed: "個別PJと共同正本の権限を同時に付与できなかった",
  nothing_to_change: "変更内容がない",
  load_failed: "読み込みに失敗",
};

function describeError(code: string | undefined, status: number) {
  if (code && ERROR_LABELS[code]) return ERROR_LABELS[code];
  if (status === 401 || status === 403) return "権限がない (admin でログインし直す)";
  return code ? `失敗した (${code})` : `失敗した (${status})`;
}

const inputClass = "h-9 min-w-0 rounded border border-border bg-background px-2 text-sm text-foreground";
const selectClass = "h-8 min-w-0 rounded border border-border bg-background px-1 text-xs text-foreground";
const buttonClass =
  "h-9 shrink-0 rounded bg-foreground px-4 text-xs font-semibold text-background disabled:opacity-50";
const labelClass = "grid gap-1 text-[11px] text-muted-foreground";

function StatusChip({ label, tone }: { label: string; tone: "ok" | "warn" | "stop" }) {
  const toneClass =
    tone === "ok"
      ? "bg-emerald-100 text-emerald-800"
      : tone === "warn"
        ? "bg-amber-100 text-amber-800"
        : "bg-rose-100 text-rose-800";
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${toneClass}`}>{label}</span>;
}

function statusTone(status: string): "ok" | "warn" | "stop" {
  if (status === "active") return "ok";
  if (status === "invited") return "warn";
  return "stop";
}

export function WorkspaceAccessAdminPanel() {
  const [data, setData] = useState<AccessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/workspace-access", { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as Partial<AccessData> & { error?: string };
    if (!response.ok) {
      setErrorMessage(describeError(payload.error, response.status));
      return;
    }
    setData({
      accounts: payload.accounts ?? [],
      institutionWorkspaces: payload.institutionWorkspaces ?? [],
      institutionMemberships: payload.institutionMemberships ?? [],
      projects: payload.projects ?? [],
      projectMemberships: payload.projectMemberships ?? [],
    });
  }, []);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  const mutate = useCallback(
    async (method: "POST" | "PATCH", body: Record<string, unknown>, okMessage: string) => {
      setBusy(true);
      setMessage(null);
      setErrorMessage(null);
      try {
        const response = await fetch("/api/admin/workspace-access", {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!response.ok || !payload.ok) {
          setErrorMessage(describeError(payload.error, response.status));
          return false;
        }
        setMessage(okMessage);
        await load();
        return true;
      } catch {
        setErrorMessage("通信に失敗した");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const accountsById = useMemo(() => {
    const map = new Map<string, AccountRow>();
    for (const account of data?.accounts ?? []) map.set(account.id, account);
    return map;
  }, [data]);

  const workspacesById = useMemo(() => {
    const map = new Map<string, WorkspaceRow>();
    for (const workspace of data?.institutionWorkspaces ?? []) map.set(workspace.id, workspace);
    return map;
  }, [data]);

  const projectsById = useMemo(() => {
    const map = new Map<string, ProjectRow>();
    for (const project of data?.projects ?? []) map.set(project.project_id, project);
    return map;
  }, [data]);

  if (loading) return <p className="text-sm text-muted-foreground">読み込み中…</p>;
  if (!data) {
    return <p className="text-sm text-rose-700">{errorMessage ?? "読み込みに失敗した"}</p>;
  }

  const accountLabel = (accountId: string) => {
    const account = accountsById.get(accountId);
    return account ? account.email : "(削除済みアカウント)";
  };

  return (
    <div className="grid gap-5">
      {(message || errorMessage) && (
        <p
          role="status"
          className={`rounded border px-3 py-2 text-xs ${
            errorMessage ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {errorMessage ?? message}
        </p>
      )}

      <AccountsSection accounts={data.accounts} busy={busy} mutate={mutate} />

      <InstitutionSection
        accounts={data.accounts}
        workspaces={data.institutionWorkspaces}
        memberships={data.institutionMemberships}
        workspacesById={workspacesById}
        accountLabel={accountLabel}
        busy={busy}
        mutate={mutate}
      />

      <ProjectSection
        accounts={data.accounts}
        workspaces={data.institutionWorkspaces}
        institutionMemberships={data.institutionMemberships}
        projects={data.projects}
        memberships={data.projectMemberships}
        workspacesById={workspacesById}
        projectsById={projectsById}
        accountLabel={accountLabel}
        busy={busy}
        mutate={mutate}
      />
    </div>
  );
}

type Mutate = (method: "POST" | "PATCH", body: Record<string, unknown>, okMessage: string) => Promise<boolean>;

function SectionShell({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-sky-100 text-sky-800">{icon}</span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          <div className="mt-1 text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
      {children}
    </section>
  );
}

function AccountsSection({
  accounts,
  busy,
  mutate,
}: {
  accounts: AccountRow[];
  busy: boolean;
  mutate: Mutate;
}) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const ok = await mutate("POST", { kind: "account", email, displayName }, `${email} を外部アカウントとして登録した。次に権限を付ける。`);
    if (ok) {
      setEmail("");
      setDisplayName("");
    }
  };

  return (
    <SectionShell
      icon={<Mail className="h-4 w-4" aria-hidden="true" />}
      title="1. 外部メールアカウント"
      description="外部の人の登録そのもの。ここに登録しただけでは、まだどこにも入れない。停止したアカウントを再開するときも、招待し直しではなく下の一覧で状態を変える。"
    >
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1.6fr_1fr_auto] sm:items-end">
        <label className={labelClass}>
          メールアドレス
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.ac.jp"
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          表示名 (任意)
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="例: 愛媛大 佐藤"
            className={inputClass}
          />
        </label>
        <button type="submit" disabled={busy} className={buttonClass}>
          登録
        </button>
      </form>

      <ul className="mt-4 grid gap-2">
        {accounts.length === 0 && <li className="text-xs text-muted-foreground">まだ外部アカウントがない。</li>}
        {accounts.map((account) => (
          <li
            key={account.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded border border-border px-3 py-2"
          >
            <span className="min-w-0 flex-1 break-all text-xs font-medium">{account.email}</span>
            {account.display_name && (
              <span className="text-[11px] text-muted-foreground">{account.display_name}</span>
            )}
            <StatusChip label={ACCOUNT_STATUS_LABELS[account.status] ?? account.status} tone={statusTone(account.status)} />
            <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
              状態
              <select
                value={account.status}
                disabled={busy}
                onChange={(event) =>
                  void mutate(
                    "PATCH",
                    { kind: "account", accountId: account.id, status: event.target.value },
                    `${account.email} の状態を ${ACCOUNT_STATUS_LABELS[event.target.value] ?? event.target.value} にした。`,
                  )
                }
                className={selectClass}
              >
                {Object.entries(ACCOUNT_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}

function AccountSelect({
  accounts,
  value,
  onChange,
}: {
  accounts: AccountRow[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={labelClass}>
      対象アカウント
      <select required value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>
        <option value="">選択する</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.email}
          </option>
        ))}
      </select>
    </label>
  );
}

function MembershipRow({
  who,
  target,
  role,
  status,
  roleLabels,
  busy,
  onRoleChange,
  onStatusChange,
}: {
  who: string;
  target: string;
  role: string;
  status: string;
  roleLabels: Record<string, string>;
  busy: boolean;
  onRoleChange: (value: string) => void;
  onStatusChange: (value: string) => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded border border-border px-3 py-2">
      <span className="min-w-0 flex-1 break-all text-xs font-medium">{who}</span>
      <span className="text-[11px] text-muted-foreground">{target}</span>
      <StatusChip label={MEMBERSHIP_STATUS_LABELS[status] ?? status} tone={statusTone(status)} />
      <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
        権限
        <select value={role} disabled={busy} onChange={(event) => onRoleChange(event.target.value)} className={selectClass}>
          {Object.entries(roleLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
        状態
        <select
          value={status}
          disabled={busy}
          onChange={(event) => onStatusChange(event.target.value)}
          className={selectClass}
        >
          {Object.entries(MEMBERSHIP_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </li>
  );
}

function InstitutionSection({
  accounts,
  workspaces,
  memberships,
  workspacesById,
  accountLabel,
  busy,
  mutate,
}: {
  accounts: AccountRow[];
  workspaces: WorkspaceRow[];
  memberships: InstitutionMembershipRow[];
  workspacesById: Map<string, WorkspaceRow>;
  accountLabel: (accountId: string) => string;
  busy: boolean;
  mutate: Mutate;
}) {
  const [accountId, setAccountId] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [role, setRole] = useState("member");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const workspaceName = workspacesById.get(workspaceId)?.name ?? "機関ワークスペース";
    const ok = await mutate(
      "POST",
      { kind: "institution_membership", accountId, workspaceId, role },
      `${accountLabel(accountId)} に ${workspaceName} の権限を付けた。個別PJの権限は別に付ける必要がある。`,
    );
    if (ok) setAccountId("");
  };

  return (
    <SectionShell
      icon={<Building2 className="h-4 w-4" aria-hidden="true" />}
      title="2. 研究機関ワークスペース権限"
      description={
        <>
          機関ワークスペース (愛媛大学など) に入れるかどうか。
          <strong className="text-foreground">
            機関の権限は、個別PJの権限を含まない。
          </strong>
          機関ワークスペースで見えるのは、その機関に紐づけて開示すると決めたサマリだけ。個別PJのワークスペースに入れるには、下の「3. 個別PJ権限」で別途付ける。
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1.4fr_1.2fr_0.8fr_auto] sm:items-end">
        <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} />
        <label className={labelClass}>
          機関ワークスペース
          <select
            required
            value={workspaceId}
            onChange={(event) => setWorkspaceId(event.target.value)}
            className={inputClass}
          >
            <option value="">選択する</option>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name} ({workspace.slug}){workspace.status === "active" ? "" : " ※停止中"}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          権限
          <select value={role} onChange={(event) => setRole(event.target.value)} className={inputClass}>
            {Object.entries(INSTITUTION_ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={busy} className={buttonClass}>
          付与
        </button>
      </form>

      <ul className="mt-4 grid gap-2">
        {memberships.length === 0 && <li className="text-xs text-muted-foreground">まだ機関ワークスペース権限がない。</li>}
        {memberships.map((membership) => (
          <MembershipRow
            key={membership.id}
            who={accountLabel(membership.user_account_id)}
            target={workspacesById.get(membership.workspace_id)?.name ?? "(不明なワークスペース)"}
            role={membership.role}
            status={membership.status}
            roleLabels={INSTITUTION_ROLE_LABELS}
            busy={busy}
            onRoleChange={(value) =>
              void mutate(
                "PATCH",
                { kind: "institution_membership", membershipId: membership.id, role: value },
                "機関ワークスペースの権限を変更した。",
              )
            }
            onStatusChange={(value) =>
              void mutate(
                "PATCH",
                { kind: "institution_membership", membershipId: membership.id, status: value },
                "機関ワークスペースの状態を変更した。",
              )
            }
          />
        ))}
      </ul>
    </SectionShell>
  );
}

function ProjectSection({
  accounts,
  workspaces,
  institutionMemberships,
  projects,
  memberships,
  workspacesById,
  projectsById,
  accountLabel,
  busy,
  mutate,
}: {
  accounts: AccountRow[];
  workspaces: WorkspaceRow[];
  institutionMemberships: InstitutionMembershipRow[];
  projects: ProjectRow[];
  memberships: ProjectMembershipRow[];
  workspacesById: Map<string, WorkspaceRow>;
  projectsById: Map<string, ProjectRow>;
  accountLabel: (accountId: string) => string;
  busy: boolean;
  mutate: Mutate;
}) {
  const [accountId, setAccountId] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [role, setRole] = useState("contributor");

  const availableWorkspaceIds = new Set(
    institutionMemberships
      .filter(
        (membership) =>
          membership.user_account_id === accountId &&
          (membership.status === "invited" || membership.status === "active"),
      )
      .map((membership) => membership.workspace_id),
  );
  const availableWorkspaces = workspaces.filter(
    (workspace) => workspace.status === "active" && availableWorkspaceIds.has(workspace.id),
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const projectName = projectsById.get(projectId)?.project_name ?? projectId;
    const ok = await mutate(
      "POST",
      { kind: "project_membership", accountId, workspaceId, projectId, role },
      `${accountLabel(accountId)} に ${projectName} の研究機関PJ面と共同正本の閲覧権限を付けた。`,
    );
    if (ok) {
      setAccountId("");
      setWorkspaceId("");
    }
  };

  return (
    <SectionShell
      icon={<FolderKanban className="h-4 w-4" aria-hidden="true" />}
      title="3. 個別PJ権限"
      description="対象の研究機関とPJを明示して、研究機関PJ面と承認済み共同正本の閲覧権限を同時に付ける。機関所属だけ、またはPJ名が一致するだけでは開かない。"
    >
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.35fr_1.1fr_1.1fr_0.75fr_auto] xl:items-end">
        <AccountSelect
          accounts={accounts}
          value={accountId}
          onChange={(value) => {
            setAccountId(value);
            setWorkspaceId("");
          }}
        />
        <label className={labelClass}>
          研究機関
          <select
            required
            value={workspaceId}
            disabled={!accountId}
            onChange={(event) => setWorkspaceId(event.target.value)}
            className={inputClass}
          >
            <option value="">{accountId ? "所属を選択する" : "先にアカウントを選ぶ"}</option>
            {availableWorkspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspacesById.get(workspace.id)?.name ?? workspace.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          PJ
          <select required value={projectId} onChange={(event) => setProjectId(event.target.value)} className={inputClass}>
            <option value="">選択する</option>
            {projects.map((project) => (
              <option key={project.project_id} value={project.project_id}>
                {project.project_id} {project.project_name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          権限
          <select value={role} onChange={(event) => setRole(event.target.value)} className={inputClass}>
            {Object.entries(PROJECT_ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={busy || availableWorkspaces.length === 0} className={buttonClass}>
          付与
        </button>
      </form>
      {accountId && availableWorkspaces.length === 0 ? (
        <p className="mt-2 text-xs text-amber-700">この人には利用可能な研究機関ワークスペース権限がない。先に2番で所属を付ける。</p>
      ) : null}

      <ul className="mt-4 grid gap-2">
        {memberships.length === 0 && <li className="text-xs text-muted-foreground">まだ個別PJ権限がない。</li>}
        {memberships.map((membership) => (
          <MembershipRow
            key={membership.id}
            who={accountLabel(membership.user_account_id)}
            target={`${membership.project_id} ${projectsById.get(membership.project_id)?.project_name ?? ""}`.trim()}
            role={membership.role}
            status={membership.status}
            roleLabels={PROJECT_ROLE_LABELS}
            busy={busy}
            onRoleChange={(value) =>
              void mutate(
                "PATCH",
                { kind: "project_membership", membershipId: membership.id, role: value },
                "個別PJの権限を変更した。",
              )
            }
            onStatusChange={(value) =>
              void mutate(
                "PATCH",
                { kind: "project_membership", membershipId: membership.id, status: value },
                "個別PJの状態を変更した。",
              )
            }
          />
        ))}
      </ul>
    </SectionShell>
  );
}
