"use client";

import { useCallback, useEffect, useState } from "react";

type Person = { id: string; name: string; email: string; kind: "member" | "workspace_account"; isExecutive: boolean; status: string };
type Rule = {
  id: string; version: number; source_title: string; source_text: string; clause_reference: string;
  quorum_numerator: number; quorum_denominator: number; quorum_strict: boolean;
  approval_basis: "eligible" | "cast" | "non_abstain";
  approval_numerator: number; approval_denominator: number; approval_strict: boolean;
  close_mode: "manual" | "all_cast" | "deadline";
  manual_close_role: "any_executive" | "initiator" | "admin" | null;
  deadline_minutes: number | null; published_at: string;
};
type ProjectData = {
  project: { project_id: string; project_name: string };
  members: Array<{ member_id: string; member_name: string | null; code_name: string; email: string; status: string; is_executive: boolean }>;
  accounts: Array<{ id: string; display_name: string | null; email: string; status: string; is_executive: boolean }>;
  eligible_member_ids: string[]; eligible_account_ids: string[];
  roster: Array<{ member_id: string | null; workspace_account_id: string | null; active: boolean; added_at: string; removed_at: string | null }>;
  rules: Rule[];
};
type RuleDraft = {
  sourceTitle: string; sourceText: string; clauseReference: string;
  quorumNumerator: string; quorumDenominator: string; quorumStrict: boolean;
  approvalBasis: Rule["approval_basis"]; approvalNumerator: string; approvalDenominator: string; approvalStrict: boolean;
  closeMode: Rule["close_mode"]; manualCloseRole: NonNullable<Rule["manual_close_role"]>; deadlineMinutes: string;
};
const emptyRule: RuleDraft = {
  sourceTitle: "", sourceText: "", clauseReference: "",
  quorumNumerator: "", quorumDenominator: "", quorumStrict: false,
  approvalBasis: "eligible", approvalNumerator: "", approvalDenominator: "", approvalStrict: false,
  closeMode: "manual", manualCloseRole: "any_executive", deadlineMinutes: "",
};
const fieldClass = "mt-1 w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm";
const buttonClass = "rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50";

export function ExecutiveMeetingAdminPanel() {
  const [projects, setProjects] = useState<Array<{ project_id: string; project_name: string }>>([]);
  const [projectId, setProjectId] = useState("");
  const [data, setData] = useState<ProjectData | null>(null);
  const [directory, setDirectory] = useState<Pick<ProjectData, "members" | "accounts"> | null>(null);
  const [personKey, setPersonKey] = useState("");
  const [attributeKey, setAttributeKey] = useState("");
  const [rule, setRule] = useState<RuleDraft>(emptyRule);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const loadProject = useCallback(async (id: string) => {
    const response = await fetch(`/api/admin/executive-meetings?projectId=${encodeURIComponent(id)}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "設定を読み込めない");
    setData(payload as ProjectData);
  }, []);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/executive-meetings", { cache: "no-store" }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "ユーザーを読み込めない");
      if (!cancelled) { setProjects(payload.projects ?? []); setDirectory({ members: payload.members ?? [], accounts: payload.accounts ?? [] }); }
    }).catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "ユーザーを読み込めない"); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!projectId) { setData(null); return; }
    let cancelled = false;
    fetch(`/api/admin/executive-meetings?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "設定を読み込めない");
      if (!cancelled) setData(payload as ProjectData);
    }).catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "設定を読み込めない"); });
    return () => { cancelled = true; };
  }, [projectId]);
  const people: Person[] = directory ? [
    ...directory.members.map((member) => ({ id: member.member_id, name: member.member_name || member.code_name || member.email, email: member.email, kind: "member" as const, isExecutive: member.is_executive, status: member.status })),
    ...directory.accounts.map((account) => ({ id: account.id, name: account.display_name || account.email, email: account.email, kind: "workspace_account" as const, isExecutive: account.is_executive, status: account.status })),
  ] : [];
  const selectedAttributePerson = people.find((person) => `${person.kind}:${person.id}` === attributeKey);
  const activeKeys = new Set((data?.roster ?? []).filter((row) => row.active).map((row) => row.member_id ? `member:${row.member_id}` : `workspace_account:${row.workspace_account_id}`));
  const activePeople = people.filter((person) => activeKeys.has(`${person.kind}:${person.id}`));
  const addablePeople = people.filter((person) => person.isExecutive && !activeKeys.has(`${person.kind}:${person.id}`)
    && (person.kind === "member" ? data?.eligible_member_ids.includes(person.id) : data?.eligible_account_ids.includes(person.id)));

  async function post(values: Record<string, unknown>) {
    if ((values.action !== "set_attribute" && !projectId) || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/executive-meetings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(projectId ? { projectId } : {}), ...values }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "保存できない");
      if (values.action === "set_attribute") {
        const response = await fetch("/api/admin/executive-meetings", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "ユーザーを読み込めない");
        setDirectory({ members: payload.members ?? [], accounts: payload.accounts ?? [] });
      }
      if (projectId) await loadProject(projectId);
      setPersonKey("");
      setNotice(values.action === "publish_rule" ? "規程の新しい版を登録した" : values.action === "set_attribute" ? "ユーザーの経営陣属性を更新した" : "このPJの経営陣登録を更新した");
      if (values.action === "publish_rule") setRule(emptyRule);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存できない");
    } finally {
      setBusy(false);
    }
  }
  function updateRule<K extends keyof RuleDraft>(key: K, value: RuleDraft[K]) { setRule((current) => ({ ...current, [key]: value })); }
  function loadPreviousRule() {
    const previous = data?.rules[0];
    if (!previous) return;
    setRule({
      sourceTitle: previous.source_title, sourceText: previous.source_text, clauseReference: previous.clause_reference,
      quorumNumerator: String(previous.quorum_numerator), quorumDenominator: String(previous.quorum_denominator), quorumStrict: previous.quorum_strict,
      approvalBasis: previous.approval_basis, approvalNumerator: String(previous.approval_numerator), approvalDenominator: String(previous.approval_denominator), approvalStrict: previous.approval_strict,
      closeMode: previous.close_mode, manualCloseRole: previous.manual_close_role ?? "any_executive", deadlineMinutes: previous.deadline_minutes ? String(previous.deadline_minutes) : "",
    });
  }
  return <div className="max-w-[1400px] space-y-5">
    {error && <p role="alert" className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="rounded-md border border-primary/30 px-3 py-2 text-sm">{notice}</p>}
    {directory && <section className="rounded-lg border bg-background p-4">
      <h2 className="font-semibold">1. ユーザーの経営陣属性</h2>
      <p className="mt-1 text-xs text-muted-foreground">全PJに共通する資格。属性を付けた後、対象PJの経営陣へ登録する。属性を外すと、その人の全PJの経営会議アクセスと投票が止まる。</p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="min-w-[260px] flex-1 text-sm">対象ユーザー
          <select className={fieldClass} value={attributeKey} onChange={(event) => setAttributeKey(event.target.value)}>
            <option value="">人を選ぶ</option>
            {people.filter((person) => person.status === "active").map((person) => <option key={`${person.kind}:${person.id}`} value={`${person.kind}:${person.id}`}>{person.name} · {person.email} · {person.kind === "member" ? "社内" : "外部"} · {person.isExecutive ? "経営陣属性あり" : "属性なし"}</option>)}
          </select>
        </label>
        <button type="button" disabled={!selectedAttributePerson || busy} onClick={() => { if (!selectedAttributePerson) return; const next = !selectedAttributePerson.isExecutive; if (!next && !window.confirm(`${selectedAttributePerson.name}の経営陣属性を外す？ 全PJの経営会議をすぐ開けなくなるよ。`)) return; void post({ action: "set_attribute", kind: selectedAttributePerson.kind, principalId: selectedAttributePerson.id, active: next }); }} className={`${buttonClass} ${selectedAttributePerson?.isExecutive ? "bg-background" : "bg-primary text-primary-foreground"}`}>{selectedAttributePerson?.isExecutive ? "経営陣属性を外す" : "経営陣属性を付ける"}</button>
      </div>
    </section>}
    <div className="flex flex-wrap items-end gap-3">
      <label className="min-w-[260px] flex-1 text-sm font-medium">2. PJを選ぶ
        <select className={fieldClass} value={projectId} onChange={(event) => { setProjectId(event.target.value); setData(null); setRule(emptyRule); setPersonKey(""); setError(""); setNotice(""); }}>
          <option value="">PJを選ぶ</option>
          {projects.map((project) => <option key={project.project_id} value={project.project_id}>{project.project_name}（{project.project_id}）</option>)}
        </select>
      </label>
      {data && <span className="text-sm text-muted-foreground">このPJの経営陣 {activePeople.filter((person) => person.isExecutive && person.status === "active").length} 人 · 規程 {data.rules.length} 版</span>}
    </div>
    {data && <>
      <section className="rounded-lg border bg-background p-4">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-3"><div><h2 className="font-semibold">このPJの経営陣</h2><p className="mt-1 text-xs text-muted-foreground">経営陣属性があり、このPJの閲覧権限もある人を登録する。登録後、このPJの経営会議を閲覧・採決できる。</p></div></div>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="min-w-[260px] flex-1 text-sm">追加する人<select className={fieldClass} value={personKey} onChange={(event) => setPersonKey(event.target.value)}><option value="">対象を選択</option>{addablePeople.map((person) => <option key={`${person.kind}:${person.id}`} value={`${person.kind}:${person.id}`}>{person.name} · {person.email}</option>)}</select></label>
          <button type="button" disabled={!personKey || busy} onClick={() => { const person = addablePeople.find((item) => `${item.kind}:${item.id}` === personKey); if (person) void post({ action: "add", kind: person.kind, principalId: person.id }); }} className={`${buttonClass} bg-primary text-primary-foreground`}>経営陣に登録</button>
        </div>
        <div className="mt-3 divide-y rounded-md border">{activePeople.length ? activePeople.map((person) => <div key={`${person.kind}:${person.id}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"><div className="min-w-0"><p className="text-sm font-medium">{person.name}{!person.isExecutive && <span className="ml-2 text-xs text-destructive">属性なし・アクセス停止</span>}</p><p className="text-xs text-muted-foreground">{person.email}</p></div><button type="button" disabled={busy} onClick={() => { if (window.confirm(`${person.name}をこのPJの経営陣から外す？ 閲覧・投票権がすぐ止まるよ。`)) void post({ action: "remove", kind: person.kind, principalId: person.id }); }} className={buttonClass}>登録を外す</button></div>) : <p className="p-3 text-sm text-muted-foreground">このPJの経営陣はまだ登録されていない。</p>}</div>
      </section>
      <section className="rounded-lg border bg-background p-4">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b pb-3"><div><h2 className="font-semibold">経営会議規程</h2><p className="mt-1 text-xs text-muted-foreground">規程原文と、採決に使う条項・判定条件を同じ版で保存する。新しい版は開始前の採決だけに適用。</p></div>{data.rules.length > 0 && <button type="button" onClick={loadPreviousRule} className={buttonClass}>現行版を入力欄へ写す</button>}</div>
        {data.rules.length > 0 && <details className="mt-3 rounded-md border p-3 text-sm"><summary className="cursor-pointer font-medium">登録済みの版</summary><div className="mt-2 space-y-2">{data.rules.map((saved) => <details key={saved.id} className="rounded border p-2"><summary className="cursor-pointer">v{saved.version} · {saved.source_title} · {new Date(saved.published_at).toLocaleDateString("ja-JP")}</summary><p className="mt-2 text-xs">対応条項: {saved.clause_reference}</p><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap bg-muted p-2 font-sans text-xs">{saved.source_text}</pre></details>)}</div></details>}
        <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); if (window.confirm("規程の新しい版を登録する？ 既に始まった採決の規程は変更されない。")) void post({
          action: "publish_rule", sourceTitle: rule.sourceTitle, sourceText: rule.sourceText, clauseReference: rule.clauseReference,
          quorumNumerator: Number(rule.quorumNumerator), quorumDenominator: Number(rule.quorumDenominator), quorumStrict: rule.quorumStrict,
          approvalBasis: rule.approvalBasis, approvalNumerator: Number(rule.approvalNumerator), approvalDenominator: Number(rule.approvalDenominator), approvalStrict: rule.approvalStrict,
          closeMode: rule.closeMode, manualCloseRole: rule.closeMode === "manual" ? rule.manualCloseRole : null,
          deadlineMinutes: rule.closeMode === "deadline" ? Number(rule.deadlineMinutes) : null,
        }); }}>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium">規程名・版の名称<input required maxLength={200} className={fieldClass} value={rule.sourceTitle} onChange={(event) => updateRule("sourceTitle", event.target.value)} /></label>
            <label className="text-sm font-medium">対応条項・根拠<input required maxLength={1000} className={fieldClass} value={rule.clauseReference} onChange={(event) => updateRule("clauseReference", event.target.value)} placeholder="例：第8条 定足数、第9条 採決" /></label>
          </div>
          <label className="block text-sm font-medium">経営会議規程の原文<textarea required minLength={20} maxLength={100000} rows={8} className={fieldClass} value={rule.sourceText} onChange={(event) => updateRule("sourceText", event.target.value)} placeholder="適用する規程の全文を貼り付ける" /></label>
          <div className="grid gap-3 border-t pt-3 md:grid-cols-2">
            <fieldset className="space-y-2"><legend className="text-sm font-semibold">定足数</legend><div className="flex items-center gap-2 text-sm">有権者の<input required type="number" min={1} className={`${fieldClass} !mt-0 max-w-20`} value={rule.quorumNumerator} onChange={(event) => updateRule("quorumNumerator", event.target.value)} /> / <input required type="number" min={1} className={`${fieldClass} !mt-0 max-w-20`} value={rule.quorumDenominator} onChange={(event) => updateRule("quorumDenominator", event.target.value)} /><select className={`${fieldClass} !mt-0 max-w-24`} value={rule.quorumStrict ? "strict" : "inclusive"} onChange={(event) => updateRule("quorumStrict", event.target.value === "strict")}><option value="inclusive">以上</option><option value="strict">超</option></select></div></fieldset>
            <fieldset className="space-y-2"><legend className="text-sm font-semibold">可決条件</legend><div className="flex flex-wrap items-center gap-2 text-sm"><select className={`${fieldClass} !mt-0 max-w-40`} value={rule.approvalBasis} onChange={(event) => updateRule("approvalBasis", event.target.value as Rule["approval_basis"])}><option value="eligible">有権者</option><option value="cast">投票者</option><option value="non_abstain">賛成・反対票</option></select>の<input required type="number" min={1} className={`${fieldClass} !mt-0 max-w-20`} value={rule.approvalNumerator} onChange={(event) => updateRule("approvalNumerator", event.target.value)} /> / <input required type="number" min={1} className={`${fieldClass} !mt-0 max-w-20`} value={rule.approvalDenominator} onChange={(event) => updateRule("approvalDenominator", event.target.value)} /><select className={`${fieldClass} !mt-0 max-w-24`} value={rule.approvalStrict ? "strict" : "inclusive"} onChange={(event) => updateRule("approvalStrict", event.target.value === "strict")}><option value="inclusive">以上</option><option value="strict">超</option></select></div></fieldset>
          </div>
          <div className="grid gap-3 border-t pt-3 md:grid-cols-2"><label className="text-sm font-medium">締切方法<select className={fieldClass} value={rule.closeMode} onChange={(event) => updateRule("closeMode", event.target.value as Rule["close_mode"])}><option value="manual">手動で締切</option><option value="all_cast">全員が投票した時点</option><option value="deadline">開始から一定時間</option></select></label>
            {rule.closeMode === "manual" && <label className="text-sm font-medium">締切できる人<select className={fieldClass} value={rule.manualCloseRole} onChange={(event) => updateRule("manualCloseRole", event.target.value as RuleDraft["manualCloseRole"])}><option value="any_executive">経営陣全員</option><option value="initiator">採決開始者</option><option value="admin">管理者かつ経営陣</option></select></label>}
            {rule.closeMode === "deadline" && <label className="text-sm font-medium">採決開始からの分数<input required type="number" min={1} max={525600} className={fieldClass} value={rule.deadlineMinutes} onChange={(event) => updateRule("deadlineMinutes", event.target.value)} /></label>}
          </div>
          <p className="text-xs text-muted-foreground">判定条件が原文と一致していることを確認してから登録して。規程にない条件を推測して補わない。</p>
          <button disabled={busy} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">規程の新しい版を登録</button>
        </form>
      </section>
    </>}
  </div>;
}
