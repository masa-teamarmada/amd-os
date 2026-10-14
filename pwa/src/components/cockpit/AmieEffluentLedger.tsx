"use client";

import { useMemo, useRef, useState } from "react";
import type { TechEntry, TechTopic } from "@/lib/project-tech";
import { createTechRow, updateTechRow, uploadEffluentGraph } from "@/lib/project-tech-client";
import { AMIE_EFFLUENT_KINDS, AMIE_EFFLUENT_STATES, amieEffluentRows, amieEffluentSummary, amieEffluentReportedCount, amieValidateEffluentEntry, type AmieEffluentExperiment, type AmieEffluentKind, type AmieEffluentState } from "@/lib/amie-effluent-experiments";

// まさが廃液の適用範囲を比較する面。前後を同じ行に置き、詳細だけを開閉する。
// 白い表面と薄い罫線、既存AMD Blueの操作色。12px本文/14px見出し、4/8pxの間隔。
const control = "min-h-11 w-full rounded border border-[#d2d2d7] bg-white px-2 py-2 text-[12px] text-[#1d1d1f] focus-visible:outline-2 focus-visible:outline-[#027FDC]";
const button = "min-h-11 rounded border border-[#d2d2d7] px-3 text-[12px] text-[#1d1d1f] hover:bg-[#f5f5f7] focus-visible:outline-2 focus-visible:outline-[#027FDC] disabled:opacity-50";
const cell = "px-3 py-2 align-top text-[12px] leading-4 [overflow-wrap:anywhere]";
const rowButton = "min-h-11 rounded border border-[#d2d2d7] px-2 text-[12px] hover:bg-[#f5f5f7] focus-visible:outline-2 focus-visible:outline-[#027FDC] md:min-h-8";
const date = (value: string | null | undefined) => value || "未確認";
const value = (text: string | null | undefined) => text || "未確認";

function AmieEffluentForm({ projectId, topicId, entry, onSaved, onCancel }: { projectId: string; topicId: string; entry?: TechEntry; onSaved: () => void; onCancel: () => void }) {
  const initial = entry ? amieEffluentRows([entry])[0]?.experiment : undefined;
  const [experiment, setExperiment] = useState<AmieEffluentExperiment>(() => initial ?? {
    version: 1, type_key: `effluent_${crypto.randomUUID()}`, kind: "actual", status: "received", identity_confirmed: true,
    provider: "", route: "", sampling_point: "", received_on: "", tested_on: "", components: "", before: "", after: "", conditions: "", follow_up: "", source_entry_ids: [], source_sample_ids: [], source_test_ids: [], graphs: [],
  });
  const [label, setLabel] = useState(entry?.row_label ?? "");
  const [outcome, setOutcome] = useState(entry?.value_text ?? "");
  const [source, setSource] = useState(entry?.source_ref ?? "");
  const [sourceUrl, setSourceUrl] = useState(entry?.source_url ?? "");
  const [reportedOn, setReportedOn] = useState(entry?.observed_on ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  const patch = (key: keyof AmieEffluentExperiment, text: string | boolean) => setExperiment(prev => ({ ...prev, [key]: text }));
  const fields: Array<[keyof AmieEffluentExperiment, string]> = [["provider", "入手元"], ["route", "提供ルート"], ["sampling_point", "採取位置・工程"], ["components", "含まれる成分"], ["before", "処理前"], ["after", "処理後"], ["conditions", "試験条件"], ["follow_up", "残る課題・次の試験"]];
  async function save(event: React.FormEvent) {
    event.preventDefault(); setError("");
    const row: Record<string, unknown> = { row_label: label.trim(), value_text: outcome.trim(), experiment, source_ref: source.trim(), source_url: sourceUrl.trim() || null, observed_on: reportedOn || null,
      needs_check: !!experiment.follow_up.trim() || !experiment.identity_confirmed, check_reason: experiment.follow_up.trim() || (!experiment.identity_confirmed ? "廃液の種類の同一性を照合する" : null),
    };
    try {
      row.experiment = amieValidateEffluentEntry({ ...row, project_id:projectId, tech_entry_id:entry?.tech_entry_id });
      if (sourceUrl && !/^https:\/\//.test(sourceUrl)) throw new Error("出典リンクはhttpsで入力して");
      setBusy(true);
      if (entry) await updateTechRow(projectId, "entry", entry.tech_entry_id, {...row,expected_updated_at:entry.updated_at});
      else await createTechRow(projectId, "entry", { ...row, tech_topic_id: topicId, confidence: "medium", source_kind: "measurement", sort_order: 100,
        disclosure: { version: 1, level: "restricted", reason: "提供企業、試料の性状と個別実験結果を含む", dd: null },
      });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "保存に失敗"); requestAnimationFrame(() => errorRef.current?.focus()); }
    finally { setBusy(false); }
  }
  return <form onSubmit={save} className="my-3 max-w-[1000px] space-y-3 rounded border border-[#d2d2d7] bg-[#fafafa] p-3" aria-label={entry ? "廃液実験を編集" : "廃液実験を追加"}>
    <p className="text-[13px] font-semibold">{entry ? "廃液実験を編集" : "廃液の種類を追加"}</p>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="space-y-1 text-[12px]">廃液名<input className={control} value={label} onChange={e => setLabel(e.target.value)} required maxLength={500}/></label>
      <label className="space-y-1 text-[12px]">区分<select className={control} value={experiment.kind} onChange={e => patch("kind", e.target.value as AmieEffluentKind)}>{Object.entries(AMIE_EFFLUENT_KINDS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label className="space-y-1 text-[12px]">実験の状態<select className={control} value={experiment.status} onChange={e => patch("status", e.target.value as AmieEffluentState)}>{Object.entries(AMIE_EFFLUENT_STATES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      {fields.map(([key,label]) => <label key={key} className="space-y-1 text-[12px]">{label}<textarea className={control} rows={2} value={String(experiment[key])} onChange={e => patch(key,e.target.value)} maxLength={4000} required={key === "provider"}/></label>)}
      <label className="space-y-1 text-[12px]">結果の結論<textarea className={control} rows={2} value={outcome} onChange={e => setOutcome(e.target.value)} maxLength={4000}/></label>
      <label className="space-y-1 text-[12px]">受領日<input type="date" className={control} value={experiment.received_on} onChange={e => patch("received_on",e.target.value)}/></label>
      <label className="space-y-1 text-[12px]">試験日<input type="date" className={control} value={experiment.tested_on} onChange={e => patch("tested_on",e.target.value)}/></label>
      <label className="space-y-1 text-[12px]">報告日<input type="date" className={control} value={reportedOn} onChange={e => setReportedOn(e.target.value)}/></label>
      <label className="space-y-1 text-[12px]">出典<textarea className={control} rows={2} value={source} onChange={e => setSource(e.target.value)} required maxLength={4000}/></label>
      <label className="space-y-1 text-[12px]">出典リンク<input type="url" className={control} value={sourceUrl} onChange={e => setSourceUrl(e.target.value)}/></label>
    </div>
    <label className="flex min-h-11 items-center gap-2 text-[12px]"><input type="checkbox" checked={experiment.identity_confirmed} onChange={e => patch("identity_confirmed",e.target.checked)}/>他の記録と種類を照合済み（同じ廃液の二重計上なし）</label>
    {error && <p role="alert" tabIndex={-1} ref={errorRef} className="text-[12px] text-[#b71c1c]">{error}</p>}
    <div className="flex gap-2"><button type="submit" disabled={busy} className={`${button} border-[#027FDC] bg-[#027FDC] text-white hover:bg-[#0267B2]`}>{busy ? "保存中…" : "保存"}</button><button type="button" disabled={busy} className={button} onClick={onCancel}>取消</button></div>
  </form>;
}

function AmieEffluentGraphUpload({ projectId, entry, onSaved }: {projectId:string;entry:TechEntry;onSaved:()=>void}) {
  const [open,setOpen]=useState(false), [file,setFile]=useState<File|null>(null), [caption,setCaption]=useState(""), [source,setSource]=useState(entry.source_ref??""), [busy,setBusy]=useState(false), [error,setError]=useState("");
  if (!open) return <button className={`${button} mt-2`} onClick={()=>setOpen(true)}>＋ 元データのグラフを保存</button>;
  return <form className="mt-3 grid max-w-[720px] gap-2 sm:grid-cols-2" onSubmit={async event=>{
    event.preventDefault(); if(!file)return;setBusy(true);setError("");
    try {await uploadEffluentGraph(projectId,entry.tech_entry_id,file,caption,source);setOpen(false);setFile(null);onSaved();}
    catch(e){setError(e instanceof Error?e.message:"保存に失敗");}finally{setBusy(false);}
  }}>
    <label className="text-[12px] sm:col-span-2">元データの画像（PNG・JPEG・WebP、8MB以下）<input aria-label={`${entry.row_label}のグラフ画像`} type="file" accept="image/png,image/jpeg,image/webp" className={control} required onChange={e=>{const f=e.target.files?.[0]??null;setFile(f);if(f&&!caption)setCaption(f.name);}}/></label>
    <label className="text-[12px]">図の説明<input className={control} required value={caption} onChange={e=>setCaption(e.target.value)} maxLength={500}/></label>
    <label className="text-[12px]">図の出典<input className={control} required value={source} onChange={e=>setSource(e.target.value)} maxLength={4000}/></label>
    {error&&<p role="alert" className="text-[#b71c1c] sm:col-span-2">{error}</p>}
    <div className="flex gap-2 sm:col-span-2"><button className={button} disabled={busy}>{busy?"保存中…":"画像を保存"}</button><button type="button" className={button} disabled={busy} onClick={()=>setOpen(false)}>取消</button></div>
  </form>;
}

export function AmieEffluentLedger({ projectId, topic, entries, allEntries, canEdit, onChanged }: { projectId: string; topic: TechTopic; entries: TechEntry[]; allEntries?:TechEntry[]; canEdit: boolean; onChanged: () => void }) {
  const rows = useMemo(() => amieEffluentRows(entries), [entries]);
  const summary = amieEffluentSummary(amieEffluentRows(allEntries??entries));
  const report = amieEffluentReportedCount(topic);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<AmieEffluentKind | "all">("actual");
  const [state, setState] = useState<AmieEffluentState | "all">("all");
  const [editing, setEditing] = useState<TechEntry | "new" | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const tableRef = useRef<HTMLDivElement>(null);
  const filtered = rows.filter(({entry,experiment:e}) => (kind === "all" || e.kind === kind) && (state === "all" || e.status === state) && (!query.trim() || `${entry.row_label} ${e.provider} ${e.components} ${e.before} ${e.after} ${entry.value_text} ${e.follow_up}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));
  const malformed = entries.length - rows.length;
  return <div data-testid="amie-effluent-ledger" className="mt-3 min-w-0 space-y-3">
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-y border-[#d2d2d7] bg-[#fafafa] px-3 py-3 text-[12px]" aria-label="廃液実験の集計">
      <p>実廃液の実験完了 <strong className="ml-1 text-[20px] font-semibold tabular-nums text-[#027FDC]" data-testid="amie-effluent-completed-count">{summary.completed}</strong> 種類 <span className="text-[#515158]">（種類照合済み）</span></p>
      <p>試験中 <strong>{summary.running}</strong> 種類</p><p>受領済み・結果未確認 <strong>{summary.received}</strong> 種類</p><p>完了報告・種類未照合 <strong>{summary.completedUnresolved}</strong> 件</p>
      <p>模擬廃液の実験完了 <strong>{summary.simulatedCompleted}</strong> 種類</p>
    </div>
    <p className="max-w-[90ch] text-[12px] leading-5 text-[#515158]">完了は試験結果を得た状態。処理の成功、全項目の除去、再現性の保証とは別。実廃液は提供元・採取系統を照合した種類を数え、再実験は同じ種類として集計する。模擬廃液と参考試料は実廃液の完了数に含めない。</p>
    {report && <details className="text-[12px] leading-5 text-[#515158]"><summary className="cursor-pointer py-2 focus-visible:outline-2 focus-visible:outline-[#027FDC]">研究者報告：{report.minimum}種類以上を試験（{report.reportedOn}）／個別一覧との全件照合は未完了</summary><p className="mt-1 max-w-[90ch]">出典：{report.source}。個別の廃液と結果が揃っていないため、この累計報告は一覧から集計した完了数と分けて読む。</p></details>}
    {malformed > 0 && <p role="alert" className="text-[12px] text-[#b71c1c]">登録形式を確認する行が{malformed}件ある。集計には含めていない。</p>}
    <div className="flex flex-wrap items-end gap-2">
      <label className="min-w-0 flex-1 text-[12px] sm:max-w-[320px]">検索<input className={control} type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="廃液名・入手元・成分・結果"/></label>
      <label className="text-[12px]">区分<select aria-label="廃液の区分" className={control} value={kind} onChange={e=>setKind(e.target.value as AmieEffluentKind|"all")}><option value="all">全区分</option>{Object.entries(AMIE_EFFLUENT_KINDS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      <label className="text-[12px]">状態<select aria-label="廃液実験の状態で絞り込み" className={control} value={state} onChange={e=>setState(e.target.value as AmieEffluentState|"all")}><option value="all">全状態</option>{Object.entries(AMIE_EFFLUENT_STATES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      <span className="py-3 text-[12px] text-[#515158]" aria-live="polite">{filtered.length} / {summary.rows}行</span>
      {canEdit && <button className={button} onClick={()=>setEditing("new")}>＋ 廃液を追加</button>}
    </div>
    {editing && <AmieEffluentForm key={editing === "new" ? "new" : editing.tech_entry_id} projectId={projectId} topicId={topic.tech_topic_id} entry={editing === "new" ? undefined : editing} onCancel={()=>setEditing(null)} onSaved={()=>{setEditing(null);onChanged();}}/>}
    <p className="text-[12px] text-[#515158] md:hidden">比較表は横にスクロールできる。</p>
    <div ref={tableRef} className="overflow-x-auto rounded border border-[#d2d2d7]" tabIndex={0} aria-label="廃液ごとの比較表。狭い画面では横にスクロール">
      <table className="w-full min-w-[1180px] max-w-[1600px] table-fixed text-left" data-testid="amie-effluent-table">
        <caption className="sr-only">廃液の入手元、成分、処理前後の結果と実験状態</caption>
        <colgroup><col className="w-[170px]"/><col className="w-[180px]"/><col className="w-[180px]"/><col className="w-[170px]"/><col className="w-[250px]"/><col className="w-[160px]"/><col className="w-[120px]"/></colgroup>
        <thead className="bg-[#f5f5f7] text-[12px] text-[#515158]"><tr>{["廃液・区分","入手元・採取位置","含まれる成分","処理前","処理後・結果","実験の状態","詳細"].map(x=><th key={x} scope="col" className="px-3 py-2 font-medium">{x}</th>)}</tr></thead>
        {filtered.map(({entry,experiment:e}) => <tbody key={entry.tech_entry_id} className="border-t border-[#e5e5e7] hover:bg-[#fafafa]" data-effluent-type={e.type_key}>
          <tr>
            <th scope="row" className={`${cell} font-medium`}><p className="line-clamp-2" title={entry.row_label}>{entry.row_label}</p><p className="mt-1 text-[11px] font-normal text-[#515158]">{AMIE_EFFLUENT_KINDS[e.kind]}</p>{!e.identity_confirmed && <p className="text-[11px] font-normal text-[#9a5800]">種類の同一性未確認</p>}</th>
            <td className={cell}><p className="line-clamp-1" title={e.provider}>{value(e.provider)}</p><p className="mt-1 line-clamp-1 text-[#515158]" title={e.sampling_point}>{value(e.sampling_point)}</p></td>
            <td className={cell}><p className="line-clamp-2" title={e.components}>{value(e.components)}</p></td><td className={cell}><p className="line-clamp-2" title={e.before}>{value(e.before)}</p></td>
            <td className={cell}><p className="line-clamp-2" title={e.after}>{value(e.after)}</p>{entry.value_text && <p className="mt-1 line-clamp-1 font-medium" title={entry.value_text}>{entry.value_text}</p>}</td>
            <td className={cell}><p className={`font-medium ${e.status === "completed" ? "text-[#0267B2]" : e.status === "running" ? "text-[#9a5800]" : "text-[#515158]"}`}>{AMIE_EFFLUENT_STATES[e.status]}</p><p className="mt-1 text-[11px] text-[#515158]">報告 {date(entry.observed_on)}</p>{e.follow_up && <p className="mt-1 text-[11px] text-[#9a5800]">追加確認あり</p>}</td>
            <td className={cell}><div className="flex gap-1"><button aria-label={`${entry.row_label}の詳細`} aria-expanded={expanded.has(entry.tech_entry_id)} className={rowButton} onClick={()=>{setExpanded(prev=>{const n=new Set(prev); if(n.has(entry.tech_entry_id))n.delete(entry.tech_entry_id);else n.add(entry.tech_entry_id);return n;});if(window.innerWidth<768)tableRef.current?.scrollTo({left:0,behavior:"smooth"});}}>{expanded.has(entry.tech_entry_id) ? "閉じる" : "詳細"}</button>{canEdit && <button aria-label={`${entry.row_label}を編集`} className={rowButton} onClick={()=>setEditing(entry)}>編集</button>}</div>{e.graphs.length>0&&<p className="mt-1 text-[11px] text-[#515158]">グラフ {e.graphs.length}枚</p>}</td>
          </tr>
          {expanded.has(entry.tech_entry_id) && <tr><td colSpan={7} className="bg-[#fafafa] px-3 py-3 text-[12px] leading-5"><div className="max-w-[calc(100vw-80px)] md:max-w-[1200px]"><button className={`${button} mb-2 md:hidden`} onClick={()=>setExpanded(prev=>{const n=new Set(prev);n.delete(entry.tech_entry_id);return n;})}>詳細を閉じる</button><dl className="grid gap-2 sm:grid-cols-2">
            <div><dt className="font-medium">廃液名</dt><dd>{entry.row_label}</dd></div>
            <div><dt className="font-medium">廃液の成分・採取位置</dt><dd>{value(e.components)}／{value(e.sampling_point)}</dd></div>
            <div><dt className="font-medium">処理前 → 処理後</dt><dd>{value(e.before)} → {value(e.after)}</dd></div>
            <div><dt className="font-medium">結論</dt><dd>{value(entry.value_text)}</dd></div>
            <div><dt className="font-medium">提供ルート・受領</dt><dd>{value(e.route)}／受領日 {date(e.received_on)}</dd></div>
            <div><dt className="font-medium">試験条件・試験日</dt><dd>{value(e.conditions)}／試験日 {date(e.tested_on)}</dd></div>
            <div><dt className="font-medium">残る課題</dt><dd>{e.follow_up || "追加課題の記録なし"}</dd></div>
            <div><dt className="font-medium">出典</dt><dd>{entry.source_ref}{entry.source_url && /^https:\/\//.test(entry.source_url) && <a href={entry.source_url} target="_blank" rel="noopener noreferrer" className="ml-2 text-[#027FDC] underline">元資料を開く</a>}</dd></div>
          </dl>
            {e.graphs.length>0&&<div className="mt-3 grid max-w-[1200px] gap-3 sm:grid-cols-2" aria-label={`${entry.row_label}の元データのグラフ`}>{e.graphs.map((g,index)=>{
              const url=`/api/project-tech-graphs?entryId=${encodeURIComponent(entry.tech_entry_id)}&index=${index}`;
              return <figure key={g.path} className="min-w-0"><a href={url} target="_blank" rel="noopener noreferrer" className="block rounded border border-[#d2d2d7] bg-white focus-visible:outline-2 focus-visible:outline-[#027FDC]"><img src={url} alt={g.caption} loading="lazy" className="h-auto w-full"/></a><figcaption className="mt-1 text-[12px]"><span className="font-medium">{g.caption}</span><span className="block text-[11px] text-[#515158]">{g.source_ref}</span></figcaption></figure>;
            })}</div>}
            {canEdit&&<AmieEffluentGraphUpload projectId={projectId} entry={entry} onSaved={onChanged}/>}
          </div></td></tr>}
        </tbody>)}
        {filtered.length === 0 && <tbody><tr><td colSpan={7} className="p-4 text-[12px] text-[#515158]">条件に一致する廃液の記録がない。</td></tr></tbody>}
      </table>
    </div>
  </div>;
}
