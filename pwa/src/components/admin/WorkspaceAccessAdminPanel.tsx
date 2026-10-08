"use client";

import { accessRequestScopeChoices } from "@/lib/workspace-access-request-scopes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type Account = { id: string; email: string; display_name: string | null; status: string };
type Membership = { id: string; user_account_id: string; status: string; role: string; workspace_id?: string; project_id?: string };
type Grant = { id: string; user_account_id: string; package_id: string; status: string; capabilities: string[]; expires_at: string | null };
type Data = {
  accounts: Account[];
  institutionWorkspaces: { id: string; name: string; slug: string; status: string }[];
  projects: { project_id: string; project_name: string; status: string }[];
  institutionMemberships: Membership[];
  projectMemberships: Membership[];
  ddPackages: { id: string; title: string; project_id: string; status: string }[];
  ddGrants: Grant[];
  accessRequests: { id: string; email_normalized: string; status: string; target_kind: string; project_id: string | null; workspace_slug: string | null }[];
};
type Place = { key: string; label: string; kind: "institution" | "project" | "dd"; targetId: string; available: boolean };
type Assignment = { place: Place; id: string; status: string; role: string; capabilities?: string[]; expiresAt?: string | null };
const input = "h-11 sm:h-9 rounded-md border border-border bg-background px-3 text-sm min-w-0";
const button = "min-h-11 sm:min-h-9 rounded-md border border-border px-3 py-2 text-xs font-medium disabled:opacity-50";
const enabled = (status: string) => status === "active" || status === "invited";
const statusLabel = (status: string) => ({ active: "利用中", invited: "初回ログイン待ち", suspended: "停止中", revoked: "取消済み" }[status] || status);
const roleLabel = (role: string) => ({ readonly: "閲覧のみ", contributor: "参加者", manager: "管理担当", owner: "管理担当", member: "メンバー" }[role] || role);

export function WorkspaceAccessAdminPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("allowed");
  const [editing, setEditing] = useState<Account | "new" | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [requestScopes, setRequestScopes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/workspace-access", { cache: "no-store" });
    if (!response.ok) throw new Error("一覧を読み込めません。再読み込みしてください。");
    setData(await response.json());
  }, []);
  useEffect(() => { void load().catch(e => setError(e.message)); }, [load]);
  const places = useMemo<Place[]>(() => data ? [
    ...data.institutionWorkspaces.map(w => ({ key: `institution:${w.id}`, label: `${w.name} · 機関ワークスペース`, kind: "institution" as const, targetId: w.id, available: w.status === "active" })),
    ...data.projects.map(p => ({ key: `project:${p.project_id}`, label: `${p.project_name || p.project_id} · ワークスペース`, kind: "project" as const, targetId: p.project_id, available: true })),
    ...data.ddPackages.map(p => ({ key: `dd:${p.id}`, label: `${p.title} · DD`, kind: "dd" as const, targetId: p.id, available: p.status === "open" })),
  ] : [], [data]);
  function assignments(accountId: string): Assignment[] {
    if (!data) return [];
    return places.flatMap(place => {
      if (place.kind === "dd") return data.ddGrants.filter(g => g.user_account_id === accountId && g.package_id === place.targetId).map(g => ({ place, id: g.id, status: g.status, role: "readonly", capabilities: g.capabilities, expiresAt: g.expires_at }));
      const rows = place.kind === "project" ? data.projectMemberships : data.institutionMemberships;
      return rows.filter(m => m.user_account_id === accountId && (place.kind === "project" ? m.project_id : m.workspace_id) === place.targetId).map(m => ({ place, id: m.id, status: m.status, role: m.role }));
    });
  }
  const visible = data?.accounts.filter(a => {
    const scopes = assignments(a.id);
    const haystack = `${a.email} ${a.display_name || ""} ${scopes.map(s => s.place.label).join(" ")}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) && (filter === "all" || (filter === "stopped" ? a.status === "suspended" : a.status !== "suspended" && scopes.some(s => enabled(s.status))));
  }) || [];
  async function send(body: Record<string, unknown>, dd = false, patch = false) {
    const response = await fetch(dd ? "/api/admin/dd" : "/api/admin/workspace-access", { method: patch ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error === "account_suspended" ? "この人は停止中です。利用を再開してから権限を追加してください。" : result.error === "invalid_email" ? "メールアドレスの形式を確認してください。" : result.error === "membership_exists" || result.error === "membership_stopped" ? "登録済みの場所です。一覧を再読み込みして、その場所の状態を変更してください。" : "変更を保存できませんでした。一覧を再読み込みして、もう一度操作してください。");
    return result;
  }
  async function perform(operation: () => Promise<unknown>) {
    setBusy(true); setError(""); setNotice("");
    try { await operation(); await load(); setNotice("保存しました"); }
    catch (e) { setError(e instanceof Error ? e.message : "変更できません"); await load().catch(() => {}); }
    finally { setBusy(false); }
  }
  function open(account: Account | "new") { setEditing(account); setName(account === "new" ? "" : account.display_name || ""); setEmail(account === "new" ? "" : account.email); setSelected(""); setError(""); setNotice(""); }
  const current = editing && editing !== "new" ? data?.accounts.find(a => a.id === editing.id) : null;
  const currentAssignments = current ? assignments(current.id) : [];
  async function changeAssignment(a: Assignment, changes: { status?: string; role?: string; capabilities?: string[] }) {
    await perform(() => a.place.kind === "dd"
      ? send({ action: "update_grant", grantId: a.id, ...changes }, true)
      : send({ kind: a.place.kind === "project" ? "project_membership" : "institution_membership", membershipId: a.id, ...changes }, false, true));
  }
  async function addPlace() {
    const place = places.find(p => p.key === selected);
    if (!current || !place) return;
    await perform(async () => {
      if (place.kind === "dd") await send({ action: "create_grant", packageId: place.targetId, email: current.email, capabilities: ["dd.view"], createAccount: false }, true);
      else if (place.kind === "project") await send({ action: "grant_project_viewer", accountId: current.id, projectId: place.targetId });
      else await send({ kind: "institution_membership", accountId: current.id, workspaceId: place.targetId, role: "readonly", status: current.status === "active" ? "active" : "invited" });
      setSelected("");
    });
  }
  if (!data) return <p role="status" className="text-sm">{error || "読み込み中…"}</p>;
  const scopeChoices = accessRequestScopeChoices(data);
  const pending = data.accessRequests.filter(r => r.status === "pending");
  return <div className="space-y-4">
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {notice && !editing && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
    {pending.length > 0 && <section className="rounded-md border border-border px-3">
      <h2 className="py-3 text-sm font-semibold">承認待ちのアクセス要求 · {pending.length}件</h2>
      {pending.map(r => <div key={r.id} className="flex flex-wrap items-center gap-2 border-t border-border py-3 text-sm">
        <div className="min-w-0 flex-1 break-all"><strong>{r.email_normalized}</strong><p className="text-xs text-muted-foreground">{r.project_id ? data.projects.find(p => p.project_id === r.project_id)?.project_name : data.institutionWorkspaces.find(w => w.slug === r.workspace_slug)?.name || "対象未特定"}</p></div>
        {r.target_kind === "unspecified" && <select aria-label={`${r.email_normalized}の閲覧先`} className={`${input} w-full text-base sm:w-auto sm:max-w-sm sm:text-sm`} disabled={busy} value={requestScopes[r.id] || ""} onChange={e => setRequestScopes(prev => ({ ...prev, [r.id]: e.target.value }))}>
          <option value="">閲覧させる場所を選ぶ</option>{scopeChoices.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>}
        <button className={button} disabled={busy || (r.target_kind === "unspecified" && !requestScopes[r.id])} onClick={() => void perform(() => send({ action: "access_request_decision", requestId: r.id, decision: "approved", scope: r.target_kind === "unspecified" ? requestScopes[r.id] : undefined }))}>閲覧を許可</button>
        <button className={button} disabled={busy} onClick={() => void perform(() => send({ action: "access_request_decision", requestId: r.id, decision: "rejected" }))}>許可しない</button>
      </div>)}
    </section>}
    <div className="flex flex-wrap items-center gap-2">
      <input aria-label="名前・メール・場所で検索" placeholder="名前・メール・場所で検索" className={`${input} w-full basis-full sm:w-auto sm:basis-0 sm:flex-1`} value={query} onChange={e => setQuery(e.target.value)} />
      <select aria-label="表示する人" className={input} value={filter} onChange={e => setFilter(e.target.value)}><option value="all">すべて</option><option value="allowed">権限あり</option><option value="stopped">停止中</option></select>
      <button className={button} onClick={() => open("new")}>人を追加</button>
    </div>
    <p className="text-xs text-muted-foreground">{visible.length}人 · 追加する権限は閲覧のみ。変更はその場で保存される。</p>
    <div className="divide-y divide-border border-y border-border">
      {visible.map(a => <div key={a.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 py-3 md:grid-cols-[minmax(180px,1fr)_minmax(0,2fr)_auto]">
        <div className="col-start-1 row-start-1 min-w-0"><p className="truncate text-sm font-medium">{a.display_name || "名前未登録"}</p><p className="break-all text-xs text-muted-foreground">{a.email}</p><p className="mt-1 text-[11px] text-muted-foreground">{statusLabel(a.status)}</p></div>
        <div className="col-span-2 col-start-1 row-start-2 flex flex-wrap items-center gap-1 md:col-span-1 md:col-start-2 md:row-start-1">{assignments(a.id).filter(s => enabled(s.status)).map(s => <span key={s.id} className="rounded bg-muted px-2 py-1 text-xs">{s.place.label}<span className="text-muted-foreground"> · {s.expiresAt && Date.parse(s.expiresAt) <= Date.now() ? "期限切れ" : !s.place.available ? "非公開" : roleLabel(s.role)}</span></span>)}{!assignments(a.id).some(s => enabled(s.status)) && <span className="text-xs text-muted-foreground">閲覧できる場所なし</span>}</div>
        <button aria-label={`${a.display_name || a.email}の権限を編集`} className={`${button} col-start-2 row-start-1 self-start md:col-start-3`} onClick={() => open(a)}>編集</button>
      </div>)}
      {!visible.length && <p className="py-8 text-center text-sm text-muted-foreground">該当する人がいない</p>}
    </div>
    <Dialog open={!!editing} onOpenChange={open => { if (!open && !busy) setEditing(null); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{editing === "new" ? "人を追加" : `${current?.display_name || "外部の人"}のアクセス`}</DialogTitle><DialogDescription>この人の情報と、見られる場所をまとめて管理する。</DialogDescription></DialogHeader>
        <form className="grid gap-3" onSubmit={e => { e.preventDefault(); void perform(async () => {
          if (editing === "new") { const result = await send({ kind: "account", email, displayName: name }); setEditing({ id: result.accountId, email, display_name: name, status: "invited" }); }
          else if (current) await send({ kind: "account", accountId: current.id, status: current.status, displayName: name }, false, true);
        }); }}>
          <label className="grid gap-1 text-xs">名前<input className={input} value={name} onChange={e => setName(e.target.value)} maxLength={120} /></label>
          <label className="grid gap-1 text-xs">メールアドレス<input className={input} type="email" required value={email} disabled={editing !== "new"} onChange={e => setEmail(e.target.value)} /></label>
          <button className={`${button} justify-self-start`} disabled={busy}>{editing === "new" ? "登録して場所を選ぶ" : "名前を保存"}</button>
        </form>
        {current && <>
          <div className="flex items-center justify-between border-t border-border pt-3"><span className="text-xs">{statusLabel(current.status)}</span><button className={button} disabled={busy} onClick={() => void perform(() => send({ kind: "account", accountId: current.id, status: current.status === "suspended" ? "invited" : "suspended" }, false, true))}>{current.status === "suspended" ? "利用を再開" : "すべてのアクセスを停止"}</button></div>
          <h3 className="text-sm font-semibold">見られる場所</h3>
          <p className="text-xs text-muted-foreground">ワークスペースとDDは別々に選ぶ。機関の権限は、個別PJの権限を含まない。</p>
          <div className="divide-y divide-border">{currentAssignments.map(a => <div key={a.id} className="space-y-2 py-3">
            <p className="text-sm font-medium">{a.place.label}</p>
            <div className="flex flex-wrap items-center gap-2">
              <select aria-label={`${a.place.label}の状態`} className={input} value={enabled(a.status) ? "allowed" : "stopped"} disabled={busy || current.status === "suspended"} onChange={e => void changeAssignment(a, { status: e.target.value === "allowed" ? (current.status === "active" ? "active" : "invited") : "revoked" })}><option value="allowed">許可</option><option value="stopped">停止</option></select>
              {a.place.kind !== "dd" && <select aria-label={`${a.place.label}の権限`} className={input} value={a.role} disabled={busy} onChange={e => void changeAssignment(a, { role: e.target.value })}><option value="readonly">閲覧のみ</option>{a.place.kind === "project" ? <><option value="contributor">参加者</option><option value="manager">管理担当</option></> : <><option value="member">メンバー</option><option value="owner">管理担当</option></>}</select>}
              {a.place.kind === "dd" && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={a.capabilities?.includes("dd.download") || false} disabled={busy} onChange={e => void changeAssignment(a, { capabilities: e.target.checked ? ["dd.view", "dd.download"] : ["dd.view"] })} />ダウンロードも許可</label>}
            </div>
            {!a.place.available && <p className="text-xs text-amber-700">この場所は非公開。公開するまで本人は開けない。</p>}
            {a.expiresAt && <p className="text-xs text-muted-foreground">期限：{new Date(a.expiresAt).toLocaleString("ja-JP")}{Date.parse(a.expiresAt) <= Date.now() ? "（期限切れ）" : ""}</p>}
          </div>)}</div>
          <div className="flex gap-2"><select aria-label="追加する場所" className={`${input} flex-1 w-0`} value={selected} disabled={busy || current.status === "suspended"} onChange={e => setSelected(e.target.value)}><option value="">場所を選んで追加</option>{places.filter(p => !currentAssignments.some(a => a.place.key === p.key)).map(p => <option key={p.key} value={p.key}>{p.label}{p.available ? "" : "（非公開）"}</option>)}</select><button className={button} disabled={busy || !selected || current.status === "suspended"} onClick={() => void addPlace()}>閲覧を許可</button></div>
        </>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}{notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
        <button className={`${button} justify-self-end`} disabled={busy} onClick={() => setEditing(null)}>閉じる</button>
      </DialogContent>
    </Dialog>
  </div>;
}
