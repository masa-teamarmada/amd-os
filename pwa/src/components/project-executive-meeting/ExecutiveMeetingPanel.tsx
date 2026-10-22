"use client";

import { useCallback, useEffect, useState } from "react";

type Rule = {
  id: string; version: number; source_title: string; source_text: string;
  quorum_numerator: number; quorum_denominator: number; quorum_strict: boolean;
  approval_basis: "eligible" | "cast" | "non_abstain";
  approval_numerator: number; approval_denominator: number; approval_strict: boolean;
  close_mode: "manual" | "all_cast" | "deadline";
  manual_close_role: "any_executive" | "initiator" | "admin" | null;
  deadline_minutes: number | null; clause_reference: string; published_at: string;
};
type Agenda = {
  id: string; title: string; motion: string; materials: string; status: "draft" | "open" | "closed" | "cancelled";
  proposed_by_kind: "member" | "workspace_account"; proposed_by_id: string;
  rule_version_id: string | null; opened_at: string | null; opened_by_kind: "member" | "workspace_account" | null; opened_by_id: string | null; deadline_at: string | null;
  closed_at: string | null; outcome: "approved" | "rejected" | "no_quorum" | null;
  cancel_reason: string | null; supersedes_agenda_id: string | null;
  created_at: string; eligible_count: number; cast_count: number;
  my_vote: "yes" | "no" | "abstain" | null; can_vote: boolean;
  tally: { yes: number; no: number; abstain: number } | null;
};
type MeetingData = {
  viewer: { kind: "member" | "workspace_account"; id: string; displayName: string; isAdmin: boolean };
  rule: Rule | null; rule_versions: Rule[];
  roster_count: number; agendas: Agenda[];
};

const statusLabel: Record<Agenda["status"], string> = { draft: "準備中", open: "採決中", closed: "確定", cancelled: "取消" };
const outcomeLabel = { approved: "可決", rejected: "否決", no_quorum: "定足数不足" };
const choiceLabel = { yes: "賛成", no: "反対", abstain: "棄権" };
const approvalBasisLabel = { eligible: "有権者", cast: "投票者", non_abstain: "賛成・反対票" };
const closeLabel = { manual: "手動で締切", all_cast: "全員投票で締切", deadline: "期限で締切" };
const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
const firstAgendaId = (agendas: Agenda[]) => agendas.find((agenda) => agenda.status === "open" && agenda.can_vote && !agenda.my_vote)?.id
  ?? agendas.find((agenda) => agenda.status === "open" || agenda.status === "draft")?.id
  ?? agendas.find((agenda) => agenda.status === "closed" && (agenda.outcome === "approved" || agenda.outcome === "rejected"))?.id
  ?? agendas[0]?.id ?? null;
function materialContent(value: string) {
  return value.split(/(https?:\/\/[^\s、。，）)]+)/g).map((part, index) => /^https?:\/\//.test(part)
    ? <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="break-all text-[#075985] underline underline-offset-2">{part}</a>
    : part);
}

export function ExecutiveMeetingPanel({ projectId }: { projectId: string }) {
  const [data, setData] = useState<MeetingData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [motion, setMotion] = useState("");
  const [materials, setMaterials] = useState("");
  const [supersedesId, setSupersedesId] = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [voteChoice, setVoteChoice] = useState<Agenda["my_vote"]>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endpoint = `/api/project-executive-meeting/${encodeURIComponent(projectId)}`;
  const load = useCallback(async () => {
    const response = await fetch(endpoint, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "経営会議を読み込めない");
    setData(payload as MeetingData);
    setSelectedId((current) => current ?? firstAgendaId((payload as MeetingData).agendas));
  }, [endpoint]);
  useEffect(() => {
    let cancelled = false;
    fetch(endpoint, { cache: "no-store" }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "経営会議を読み込めない");
      if (!cancelled) {
        setData(payload as MeetingData);
        setSelectedId((current) => current ?? firstAgendaId((payload as MeetingData).agendas));
      }
    }).catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "経営会議を読み込めない"); });
    return () => { cancelled = true; };
  }, [endpoint]);
  const selected = data?.agendas.find((agenda) => agenda.id === selectedId) ?? null;
  const mine = selected && data && selected.proposed_by_kind === data.viewer.kind && selected.proposed_by_id === data.viewer.id;
  const openedByMe = selected && data && selected.opened_by_kind === data.viewer.kind && selected.opened_by_id === data.viewer.id;
  const selectedRule = data?.rule_versions.find((rule) => rule.id === selected?.rule_version_id);
  const formVisible = creating || editing;

  async function act(action: string, values: Record<string, unknown> = {}) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, agendaId: selected?.id, ...values }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "操作を完了できない");
      await load();
      if (action === "create") setSelectedId(payload.id);
      setCreating(false);
      setEditing(false);
      setSupersedesId(null);
      setShowCancel(false);
      setCancelReason("");
      setVoteChoice(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作を完了できない");
    } finally {
      setBusy(false);
    }
  }

  function startNew() {
    setSelectedId(null); setTitle(""); setMotion(""); setMaterials(""); setSupersedesId(null); setCreating(true); setEditing(false); setVoteChoice(null); setError(null);
  }
  function revise(agenda: Agenda) {
    setSelectedId(null); setTitle(agenda.title); setMotion(agenda.motion); setMaterials(agenda.materials);
    setSupersedesId(agenda.id); setCreating(true); setEditing(false); setError(null);
  }
  function editDraft(agenda: Agenda) {
    setTitle(agenda.title); setMotion(agenda.motion); setMaterials(agenda.materials); setCreating(false); setEditing(true); setError(null);
  }
  const canClose = selected?.status === "open" && selectedRule?.close_mode === "manual"
    && (selectedRule.manual_close_role === "any_executive"
      || (selectedRule.manual_close_role === "initiator" && openedByMe)
      || (selectedRule.manual_close_role === "admin" && data?.viewer.isAdmin));
  const waitingForMyVote = data?.agendas.filter((agenda) => agenda.status === "open" && agenda.can_vote && !agenda.my_vote) ?? [];
  const undecidedAgendas = data?.agendas.filter((agenda) =>
    (agenda.status === "open" && !(agenda.can_vote && !agenda.my_vote)) || agenda.status === "draft") ?? [];
  const decidedAgendas = data?.agendas.filter((agenda) => agenda.status === "closed" && (agenda.outcome === "approved" || agenda.outcome === "rejected")) ?? [];
  const unresolvedAgendas = data?.agendas.filter((agenda) =>
    agenda.status === "cancelled" || (agenda.status === "closed" && agenda.outcome !== "approved" && agenda.outcome !== "rejected")) ?? [];
  const displayedRule = selectedRule ?? data?.rule;

  function agendaRow(agenda: Agenda) {
    const isSelected = selected?.id === agenda.id && !formVisible;
    const needsMyVote = agenda.status === "open" && agenda.can_vote && !agenda.my_vote;
    const state = needsMyVote ? "投票待ち" : agenda.status === "closed" && agenda.outcome ? outcomeLabel[agenda.outcome] : statusLabel[agenda.status];
    return <button
      key={agenda.id}
      type="button"
      aria-pressed={isSelected}
      onClick={() => { setSelectedId(agenda.id); setCreating(false); setEditing(false); setShowCancel(false); setCancelReason(""); setVoteChoice(null); setError(null); }}
      className={`block w-full border-b px-4 py-3 text-left last:border-b-0 hover:bg-[#f4f9fd] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#0068a8] ${isSelected ? "bg-[#e8f3fc] text-[#1d1d1f]" : "bg-white"}`}
    >
      <span className="block text-sm font-semibold leading-6">{agenda.title}</span>
      <span className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-[#5b6470]">
        <span>{agenda.status === "open" ? `${agenda.cast_count} / ${agenda.eligible_count}人が投票` : agenda.status === "closed" ? `確定 ${dateLabel(agenda.closed_at)}` : `作成 ${dateLabel(agenda.created_at)}`}</span>
        <span className={`shrink-0 rounded-full px-2.5 py-1 font-medium ${needsMyVote ? "bg-[#dceefa] text-[#075985]" : "bg-[#f1f3f5] text-[#4b5563]"}`}>{state}</span>
      </span>
    </button>;
  }

  if (!data && !error) return <div className="py-12 text-sm text-muted-foreground">経営会議を読み込んでいる…</div>;
  if (!data) return <div role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">{error}</div>;
  return (
    <section className="min-w-0 space-y-5 text-[#1d1d1f]" aria-label="経営会議" data-testid="executive-meeting-panel">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-xl font-semibold">経営会議</h2>
          <p className="mt-1 text-sm text-[#5b6470]">議案の内容を確認し、経営陣が一人一票で判断する</p>
        </div>
        <button type="button" onClick={startNew} className="rounded-md border border-[#b9c6d2] bg-white px-4 py-2 text-sm font-medium hover:bg-[#f4f9fd] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0068a8]">＋ 新しい議案を作る</button>
      </div>
      {waitingForMyVote.length > 0 && <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-[#b9d9ec] bg-[#edf7fd] px-4 py-3 text-sm" role="status">
        <span className="font-semibold text-[#075985]">あなたの投票待ち {waitingForMyVote.length}件</span>
        <span className="text-[#435463]">議案を選び、決める内容を確認して投票へ。</span>
      </div>}
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(260px,0.85fr)_minmax(0,1.65fr)]">
        <div className="min-w-0 self-start overflow-hidden rounded-lg border border-[#d7e0e7] bg-white">
          <div className="flex items-baseline justify-between border-b border-[#d7e0e7] px-4 py-3"><h3 className="font-semibold">議案一覧</h3><span className="text-xs text-[#5b6470]">{data.agendas.length}件</span></div>
          {data.agendas.length === 0 && <p className="px-4 py-8 text-sm text-[#5b6470]">議案はまだない。右上の「新しい議案を作る」から作成できる。</p>}
          {waitingForMyVote.length > 0 && <div>{waitingForMyVote.map(agendaRow)}</div>}
          {undecidedAgendas.length > 0 && <div><h4 className="border-b border-[#e3e9ee] bg-[#f8fbfd] px-4 py-2 text-xs font-semibold text-[#5b6470]">未決議</h4>{undecidedAgendas.map(agendaRow)}</div>}
          {decidedAgendas.length > 0 && <div><h4 className="border-b border-[#e3e9ee] bg-[#f8fbfd] px-4 py-2 text-xs font-semibold text-[#5b6470]">決議済み</h4>{decidedAgendas.map(agendaRow)}</div>}
          {unresolvedAgendas.length > 0 && <div><h4 className="border-b border-[#e3e9ee] bg-[#f8fbfd] px-4 py-2 text-xs font-semibold text-[#5b6470]">不成立・取消</h4>{unresolvedAgendas.map(agendaRow)}</div>}
        </div>
        <div className="min-w-0 rounded-lg border border-[#d7e0e7] bg-white p-5">
          {formVisible ? <form onSubmit={(event) => { event.preventDefault(); void act(creating ? "create" : "update", { title, motion, materials, supersedesAgendaId: creating ? supersedesId : null }); }} className="space-y-5">
            <div><h3 className="text-lg font-semibold">{creating ? "新しい議案を作る" : "議案の下書きを編集"}</h3><p className="mt-1 text-sm text-[#5b6470]">まず下書きを保存。内容を確認してから採決を始められる。</p></div>
            {supersedesId && <p className="rounded-md bg-[#f4f9fd] p-3 text-sm">前の議案の内容を引き継ぎ中。前の投票結果は引き継がない。</p>}
            <label className="block text-sm font-medium">議案名<input required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 w-full rounded-md border border-[#b9c6d2] bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-[#0068a8]" /></label>
            <label className="block text-sm font-medium">今回決めること（決議文）<textarea required maxLength={20000} rows={4} value={motion} onChange={(event) => setMotion(event.target.value)} className="mt-2 w-full rounded-md border border-[#b9c6d2] bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-[#0068a8]" /></label>
            <label className="block text-sm font-medium">判断材料・資料<span className="mt-1 block text-xs font-normal text-[#5b6470]">資料名・URLと、判断に必要な要点を記入</span><textarea maxLength={100000} rows={5} value={materials} onChange={(event) => setMaterials(event.target.value)} className="mt-2 w-full rounded-md border border-[#b9c6d2] bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-[#0068a8]" /></label>
            <p className="text-xs text-[#5b6470]">採決開始後、決議文と資料は変更不可。</p>
            <div className="flex flex-wrap gap-2"><button disabled={busy} className="rounded-md bg-[#1d1d1f] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">下書きを保存</button><button type="button" onClick={() => { setCreating(false); setEditing(false); setSupersedesId(null); }} className="rounded-md border border-[#b9c6d2] px-4 py-2.5 text-sm">戻る</button></div>
          </form> : selected ? <article className="space-y-5">
            <header className="border-b border-[#e3e9ee] pb-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#5b6470]"><span className="rounded-full bg-[#edf2f6] px-2.5 py-1 font-semibold text-[#344454]">{statusLabel[selected.status]}</span><span>作成 {dateLabel(selected.created_at)}</span>{selectedRule && <span>・適用規程 v{selectedRule.version}</span>}{selected.deadline_at && <span>・投票期限 {dateLabel(selected.deadline_at)}</span>}</div>
              <h3 className="mt-3 text-xl font-semibold leading-snug">{selected.title}</h3>
            </header>
            <section className="rounded-lg border border-[#dce5ec] bg-[#f7fafc] p-4" aria-label="今回決めること"><h4 className="text-xs font-semibold text-[#526373]">今回決めること</h4><p className="mt-2 whitespace-pre-wrap text-base font-medium leading-7">{selected.motion}</p></section>
            <section><h4 className="text-xs font-semibold text-[#526373]">判断材料・資料</h4><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{selected.materials ? materialContent(selected.materials) : "判断材料は未登録。"}</p></section>
            {selected.supersedes_agenda_id && <p className="text-xs text-[#5b6470]">前の議案の内容を引き継いで作成。</p>}
            {selected.status === "draft" && <section className="rounded-lg border border-[#b9d9ec] bg-[#edf7fd] p-4"><h4 className="font-semibold">次の操作：採決を始める</h4><p className="mt-1 text-sm text-[#435463]">開始時の経営陣と規程がこの議案に固定される。内容を確認してから開始。</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busy || !data.rule} onClick={() => { if (window.confirm("この内容と現在の経営陣で採決を始める？ 開始後は変更不可。")) void act("start"); }} className="rounded-md bg-[#1d1d1f] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">採決を始める</button>{mine && <button type="button" onClick={() => editDraft(selected)} className="rounded-md border border-[#b9c6d2] bg-white px-4 py-2.5 text-sm">下書きを編集</button>}</div>{!data.rule && <p className="mt-2 text-sm text-amber-800">経営会議規程の登録後に採決を開始できる。</p>}</section>}
            {selected.status === "open" && <>
              {selected.my_vote ? <section className="rounded-lg border border-[#cddfd2] bg-[#f2f8f3] p-4"><h4 className="font-semibold">投票済み</h4><p className="mt-1 text-sm">あなたの票：<strong>{choiceLabel[selected.my_vote]}</strong></p><p className="mt-1 text-xs text-[#526373]">票は変更不可。結果は採決の確定後に表示。</p></section>
                : selected.can_vote ? <section className="rounded-lg border border-[#b9d9ec] bg-[#edf7fd] p-4" aria-label="あなたの投票"><p className="text-xs font-semibold text-[#075985]">あなたの対応</p><h4 className="mt-1 text-base font-semibold">この議案に投票する</h4><p className="mt-1 text-sm text-[#435463]">決める内容と判断材料を確認し、意見を選ぶ。</p>
                  <fieldset className="mt-4 grid gap-2 sm:grid-cols-3"><legend className="sr-only">投票の選択</legend>{(["yes", "no", "abstain"] as const).map((choice) => <label key={choice} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-3 text-sm font-medium hover:border-[#0068a8] ${voteChoice === choice ? "border-[#0068a8] bg-white ring-1 ring-[#0068a8]" : "border-[#b9c6d2] bg-white"}`}><input type="radio" name={`vote-${selected.id}`} value={choice} checked={voteChoice === choice} onChange={() => setVoteChoice(choice)} className="accent-[#0068a8]" />{choiceLabel[choice]}</label>)}</fieldset>
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2"><button type="button" disabled={busy || !voteChoice} onClick={() => { if (voteChoice && window.confirm(`「${choiceLabel[voteChoice]}」で投票を確定する？ 投票後は変更不可。`)) void act("vote", { choice: voteChoice }); }} className="rounded-md bg-[#1d1d1f] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">投票を確定</button><span className="text-xs text-[#526373]">投票後は変更不可。棄権も投票済み人数に含む。</span></div>
                </section> : <section className="rounded-lg bg-[#f4f6f8] p-4 text-sm">この採決の投票対象外。</section>}
              <section className="border-t border-[#e3e9ee] pt-4" aria-label="投票状況"><div className="flex items-center justify-between text-sm"><h4 className="font-semibold">投票状況</h4><span>{selected.cast_count} / {selected.eligible_count}人が投票</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e3e9ee]"><div className="h-full bg-[#438bb8]" style={{ width: `${Math.min(100, selected.eligible_count ? selected.cast_count / selected.eligible_count * 100 : 0)}%` }} /></div><p className="mt-2 text-xs text-[#5b6470]">賛否の内訳は採決の確定後に表示。</p></section>
            </>}
            {selected.status === "closed" && <section className="rounded-lg border border-[#cddfd2] bg-[#f2f8f3] p-4"><p className="text-xs font-semibold text-[#526373]">採決結果</p><h4 className="mt-1 text-lg font-semibold">{selected.outcome ? outcomeLabel[selected.outcome] : "確定"}</h4><div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm"><div className="rounded border border-[#d7e0e7] bg-white p-2">賛成<br /><strong className="text-lg">{selected.tally?.yes ?? 0}</strong></div><div className="rounded border border-[#d7e0e7] bg-white p-2">反対<br /><strong className="text-lg">{selected.tally?.no ?? 0}</strong></div><div className="rounded border border-[#d7e0e7] bg-white p-2">棄権<br /><strong className="text-lg">{selected.tally?.abstain ?? 0}</strong></div></div>{selected.my_vote && <p className="mt-3 text-xs">あなたの票：{choiceLabel[selected.my_vote]}</p>}</section>}
            {selected.status === "cancelled" && <section className="rounded-lg border border-[#e3e9ee] bg-[#f8f9fa] p-4"><h4 className="font-semibold">採決を取り消し</h4><p className="mt-1 text-sm">理由：{selected.cancel_reason}</p></section>}
            {(canClose || data.viewer.isAdmin || selected.status !== "draft") && <details className="border-t border-[#e3e9ee] pt-4 text-sm"><summary className="cursor-pointer font-medium text-[#435463]">議案の管理</summary><div className="mt-3 flex flex-wrap items-center gap-2"><p className="w-full text-xs text-[#5b6470]">採決の締切・取り消し・議案の作り直し</p>{canClose && <button type="button" disabled={busy} onClick={() => { if (window.confirm("採決を締めて結果を確定する？")) void act("close"); }} className="rounded-md border border-[#b9c6d2] bg-white px-4 py-2 text-sm">採決を締める</button>}{selected.status !== "draft" && <button type="button" onClick={() => revise(selected)} className="rounded-md border border-[#b9c6d2] bg-white px-4 py-2 text-sm">内容を引き継いで新しい議案を作る</button>}{selected.status === "open" && data.viewer.isAdmin && <div className="w-full"><button type="button" onClick={() => setShowCancel((value) => !value)} className="text-sm text-destructive underline">この採決を取り消す</button>{showCancel && <div className="mt-2 flex flex-wrap gap-2"><input aria-label="取消理由" maxLength={1000} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="取消理由を記録" className="min-w-[220px] flex-1 rounded-md border px-3 py-2 text-sm" /><button type="button" disabled={busy || !cancelReason.trim()} onClick={() => { if (window.confirm("この採決を取り消す？ 票は履歴に残るよ。")) void act("cancel", { reason: cancelReason }); }} className="rounded-md border border-destructive px-3 py-2 text-sm text-destructive disabled:opacity-50">取消を確定</button></div>}</div>}</div></details>}
          </article> : <div className="py-12 text-center"><h3 className="font-semibold">議案を選択</h3><p className="mt-2 text-sm text-[#5b6470]">左の一覧から議案を開くか、新しい議案を作成。</p></div>}
        </div>
      </div>
      {error && <div role="alert" className="fixed bottom-5 right-5 z-50 max-w-sm rounded-lg border border-destructive/40 bg-white p-4 text-sm text-destructive shadow-lg"><p className="font-semibold">操作を完了できなかった</p><p className="mt-1">{error}</p><button type="button" onClick={() => setError(null)} className="mt-2 underline">閉じる</button></div>}
      <details className="rounded-lg border border-[#d7e0e7] bg-white px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium">{selectedRule ? `この採決の判定ルール（規程 v${selectedRule.version}）` : `現在の経営会議規程${data.rule ? `（v${data.rule.version}）` : "（未登録）"}`}</summary>
        {displayedRule ? <div className="mt-3 space-y-2 text-sm">
          <p><strong>原文:</strong> {displayedRule.source_title} · <strong>対応条項:</strong> {displayedRule.clause_reference}</p>
          <p>定足数: 有権者の {displayedRule.quorum_numerator}/{displayedRule.quorum_denominator} {displayedRule.quorum_strict ? "超" : "以上"} · 可決: {approvalBasisLabel[displayedRule.approval_basis]}の {displayedRule.approval_numerator}/{displayedRule.approval_denominator} {displayedRule.approval_strict ? "超" : "以上"} · {closeLabel[displayedRule.close_mode]}</p>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded bg-[#f4f9fd] p-3 font-sans text-xs leading-5">{displayedRule.source_text}</pre>
        </div> : <p className="mt-2 text-muted-foreground">管理者が規程原文と判定条件を登録するまで、採決は始められない。</p>}
      </details>
    </section>
  );
}
