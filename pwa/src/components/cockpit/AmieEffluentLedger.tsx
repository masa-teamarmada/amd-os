"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TechEntry, TechTopic } from "@/lib/project-tech";
import { createTechRow, updateTechRow, uploadEffluentGraph } from "@/lib/project-tech-client";
import { AMIE_EFFLUENT_KINDS, AMIE_EFFLUENT_STATES, amieEffluentRows, amieEffluentSummary, amieEffluentReportedCount, amieValidateEffluentEntry, type AmieEffluentExperiment, type AmieEffluentKind, type AmieEffluentState } from "@/lib/amie-effluent-experiments";
import { EFFLUENT_WATER_TYPES, EMPTY_EXPERIMENT_VISUAL, EXPERIMENT_WEATHER, type ExperimentVisual, type EffluentWaterType } from "@/lib/experiment-result";
import { ExperimentDoneStamp, ExperimentResultWeather } from "./ExperimentResultWeather";
import styles from "./AmieEffluentLedger.module.css";

// まさが廃液の適用範囲を比較する面。前後を同じ行に置き、詳細だけを開閉する。
// 白い表面と薄い罫線、既存AMD Blueの操作色。12px本文/14px見出し、4/8pxの間隔。
const control = "min-h-11 w-full rounded border border-[#d2d2d7] bg-white px-2 py-2 text-[16px] md:text-[12px] text-[#1d1d1f] focus-visible:outline-2 focus-visible:outline-[#027FDC]";
const button = "min-h-11 rounded border border-[#d2d2d7] px-3 text-[12px] text-[#1d1d1f] hover:bg-[#f5f5f7] focus-visible:outline-2 focus-visible:outline-[#027FDC] disabled:opacity-50";
const cell = "px-2 py-1 align-middle text-[12px] leading-4 [overflow-wrap:anywhere]";
const rowButton = "min-h-11 rounded border border-[#d2d2d7] px-2 text-[12px] hover:bg-[#f5f5f7] focus-visible:outline-2 focus-visible:outline-[#027FDC] md:min-h-8";
const date = (value: string | null | undefined) => value || "未確認";
const value = (text: string | null | undefined) => text || "未確認";
type AmieEffluentField = "all" | "sample" | "provider" | "elements" | "changes" | "result" | "status" | "details";
const AMIE_EFFLUENT_FIELD_LABEL: Record<AmieEffluentField, string> = {all:"全項目",sample:"試料・性状",provider:"入手元",elements:"含有元素",changes:"処理前 → 処理後",result:"実験結果",status:"実験状態",details:"詳細・出典"};

function AmieEffluentForm({ projectId, topicId, entry, section = "all", onSaved, onCancel }: { projectId: string; topicId: string; entry?: TechEntry; section?: AmieEffluentField; onSaved: () => void; onCancel: () => void }) {
  const full = section === "all";
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (!full) formRef.current?.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(section === "result" ? "[data-amie-result]" : "input:not([type=checkbox]),textarea,select")?.focus(); }, [full,section]);
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
  const visual=experiment.visual??EMPTY_EXPERIMENT_VISUAL;
  const patchVisual=(patch:Partial<ExperimentVisual>)=>setExperiment(prev=>({...prev,visual:{...(prev.visual??EMPTY_EXPERIMENT_VISUAL),...patch}}));
  const errorRef = useRef<HTMLParagraphElement>(null);
  const patch = (key: keyof AmieEffluentExperiment, text: string | boolean) => setExperiment(prev => ({ ...prev, [key]: text }));
  const fields: Array<[keyof AmieEffluentExperiment, string]> = [["provider", "入手元"], ["route", "提供ルート"], ["sampling_point", "採取位置・工程"], ["components", "含まれる成分"], ["before", "処理前の記録（文章）"], ["after", "処理後の記録（文章）"], ["conditions", "試験条件"], ["follow_up", "残る課題・次の試験"]];
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
  return <form ref={formRef} onSubmit={save} onKeyDown={event=>{if(event.key==="Escape"&&!busy){event.preventDefault();onCancel();}}} className="my-1 max-w-[calc(100vw-80px)] space-y-3 rounded border border-[#d2d2d7] bg-[#fafafa] p-3 md:max-w-[1000px]" aria-label={entry ? `${AMIE_EFFLUENT_FIELD_LABEL[section]}を編集` : "廃液実験を追加"}>
    <p className="text-[13px] font-semibold">{entry ? `${entry.row_label} · ${AMIE_EFFLUENT_FIELD_LABEL[section]}を編集` : "廃液の種類を追加"}</p>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {(full || section === "sample") && <label className="space-y-1 text-[12px]">廃液名<input className={control} value={label} onChange={e => setLabel(e.target.value)} required maxLength={500}/></label>}
      {(full || section === "sample") && <label className="space-y-1 text-[12px]">区分<select className={control} value={experiment.kind} onChange={e => patch("kind", e.target.value as AmieEffluentKind)}>{Object.entries(AMIE_EFFLUENT_KINDS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>}
      {(full || section === "status") && <label className="space-y-1 text-[12px]">実験の状態<select className={control} value={experiment.status} onChange={e => patch("status", e.target.value as AmieEffluentState)}>{Object.entries(AMIE_EFFLUENT_STATES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>}
      {fields.filter(([key]) => full || (section === "provider" && ["provider","route","sampling_point"].includes(key)) || (section === "elements" && key === "components") || (section === "changes" && ["before","after","conditions"].includes(key)) || (section === "details" && key === "follow_up")).map(([key,label]) => <label key={key} className="space-y-1 text-[12px]">{label}<textarea className={control} rows={2} value={String(experiment[key])} onChange={e => patch(key,e.target.value)} maxLength={4000} required={key === "provider"}/></label>)}
      {(full || section === "result") && <label className="space-y-1 text-[12px]">結果の結論<textarea className={control} rows={2} value={outcome} onChange={e => setOutcome(e.target.value)} maxLength={4000}/></label>}
      {(full || section === "provider") && <label className="space-y-1 text-[12px]">受領日<input type="date" className={control} value={experiment.received_on} onChange={e => patch("received_on",e.target.value)}/></label>}
      {(full || section === "changes") && <label className="space-y-1 text-[12px]">試験日<input type="date" className={control} value={experiment.tested_on} onChange={e => patch("tested_on",e.target.value)}/></label>}
      {(full || section === "details") && <label className="space-y-1 text-[12px]">報告日<input type="date" className={control} value={reportedOn} onChange={e => setReportedOn(e.target.value)}/></label>}
      {(full || section === "details") && <label className="space-y-1 text-[12px]">出典<textarea className={control} rows={2} value={source} onChange={e => setSource(e.target.value)} required maxLength={4000}/></label>}
      {(full || section === "details") && <label className="space-y-1 text-[12px]">出典リンク<input type="url" className={control} value={sourceUrl} onChange={e => setSourceUrl(e.target.value)}/></label>}
    </div>
    {(full || ["sample","elements","changes","result"].includes(section)) && <fieldset className="space-y-2 rounded border border-[#d2d2d7] bg-white p-3"><legend className="px-1 text-[12px] font-medium">一覧で比較する情報</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {(full || section === "elements") && <label className="text-[12px]">含有元素（確認できた元素記号のみ）<input className={control} value={visual.element_symbols.join(" ")} onChange={e=>patchVisual({element_symbols:e.target.value.split(/[\s,、・]+/).filter(Boolean)})} placeholder="Cu Zn Mg"/></label>}
        {(full || section === "sample") && <div className="text-[12px]">排水の性状<div className="flex flex-wrap gap-3">{Object.entries(EFFLUENT_WATER_TYPES).map(([k,label])=><label key={k} className="flex min-h-11 items-center gap-1"><input type="checkbox" checked={visual.water_types.includes(k as EffluentWaterType)} onChange={e=>patchVisual({water_types:e.target.checked?[...visual.water_types,k as EffluentWaterType]:visual.water_types.filter(t=>t!==k)})}/>{label}</label>)}</div></div>}
        {(full || section === "result") && <label className="text-[12px]">実験結果<select data-amie-result className={control} value={visual.weather} onChange={e=>patchVisual({weather:e.target.value as ExperimentVisual["weather"]})}><option value="unknown">結果未確認</option>{Object.entries(EXPERIMENT_WEATHER).map(([k,x])=><option key={k} value={k}>{x.label}：{x.meaning}</option>)}</select></label>}
        {(full || section === "result") && <label className="text-[12px]">判定の根拠（短く）<input className={control} value={visual.weather_reason} onChange={e=>patchVisual({weather_reason:e.target.value})} maxLength={500}/></label>}
      </div>
      {(full || section === "changes") && visual.changes.map((c,i)=><div key={i} className="grid gap-2 sm:grid-cols-6">{([['parameter','成分・指標'],['before','処理前'],['after','処理後'],['time','処理時間'],['note','補足']] as const).map(([k,label])=><label key={k} className="text-[11px]">{label}<input className={control} value={c[k]} onChange={e=>patchVisual({changes:visual.changes.map((x,j)=>j===i?{...x,[k]:e.target.value}:x)})}/></label>)}<label className="text-[11px]">変化の判定<select className={control} value={c.effect??"unknown"} onChange={e=>patchVisual({changes:visual.changes.map((x,j)=>j===i?{...x,effect:e.target.value as typeof c.effect}:x)})}><option value="unknown">未評価・中立</option><option value="improved">改善を確認</option><option value="limited">効果限定</option><option value="worsened">悪化を確認</option></select></label><button type="button" className={button} onClick={()=>patchVisual({changes:visual.changes.filter((_,j)=>j!==i)})}>この変化を外す</button></div>)}
      {(full || section === "changes") && <button type="button" className={button} disabled={visual.changes.length>=12} onClick={()=>patchVisual({changes:[...visual.changes,{parameter:"",before:"",after:"",time:"",note:""}]})}>＋ 成分の変化を追加</button>}
    </fieldset>}
    {(full || section === "status") && <label className="flex min-h-11 items-center gap-2 text-[12px]"><input type="checkbox" checked={experiment.identity_confirmed} onChange={e => patch("identity_confirmed",e.target.checked)}/>他の記録と種類を照合済み（同じ廃液の二重計上なし）</label>}
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

export function AmieEffluentLedger({ projectId, topic, entries, allEntries, editableEntries, canEdit, onChanged, sharedView = false }: { projectId: string; topic: TechTopic; entries: TechEntry[]; allEntries?:TechEntry[]; editableEntries?:Record<string,TechEntry>; sharedView?:boolean; canEdit: boolean; onChanged: () => void }) {
  const rows = useMemo(() => amieEffluentRows(entries), [entries]);
  const summary = amieEffluentSummary(amieEffluentRows(allEntries??entries));
  const report = amieEffluentReportedCount(topic);
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [kind, setKind] = useState<AmieEffluentKind | "all">("actual");
  const [state, setState] = useState<AmieEffluentState | "all">("all");
  const [waterType,setWaterType]=useState<EffluentWaterType|"all">("all");
  const [weather,setWeather]=useState<ExperimentVisual["weather"]|"all">("all");
  const [editing, setEditing] = useState<TechEntry | "new" | null>(null);
  const [cellEditing, setCellEditing] = useState<{entry:TechEntry;displayId:string;field:AmieEffluentField}|null>(null);
  const editOriginRef = useRef<HTMLElement|null>(null);
  useEffect(()=>{if(!cellEditing&&editOriginRef.current?.isConnected)editOriginRef.current.focus();},[cellEditing]);
  const editSource = (entry:TechEntry) => canEdit ? (editableEntries ? editableEntries[entry.tech_entry_id] : entry) : undefined;
  const editableCell = (entry:TechEntry, field:AmieEffluentField) => editSource(entry) ? {
    tabIndex:0, "data-amie-cell-edit":field, "aria-label":`${entry.row_label}の${AMIE_EFFLUENT_FIELD_LABEL[field]}を編集`,
    onClick:(event:React.MouseEvent<HTMLElement>)=>{if((event.target as HTMLElement).closest("button,a,input,select,textarea"))return;editOriginRef.current=event.currentTarget;setEditing(null);setCellEditing({entry:editSource(entry)!,displayId:entry.tech_entry_id,field});if(window.innerWidth<768)tableRef.current?.scrollTo({left:0});},
    onKeyDown:(event:React.KeyboardEvent<HTMLElement>)=>{if(event.target!==event.currentTarget)return;if(event.key==="Enter"||event.key===" "){event.preventDefault();editOriginRef.current=event.currentTarget;setEditing(null);setCellEditing({entry:editSource(entry)!,displayId:entry.tech_entry_id,field});if(window.innerWidth<768)tableRef.current?.scrollTo({left:0});}},
  } : {};
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const tableRef = useRef<HTMLDivElement>(null);
  const filtered = rows.filter(({entry,experiment:e}) => (kind === "all" || e.kind === kind) && (state === "all" || e.status === state) && (waterType==="all"||e.visual?.water_types.includes(waterType)) && (weather==="all"||(e.visual?.weather??"unknown")===weather) && (!query.trim() || `${entry.row_label} ${e.provider} ${e.components} ${e.before} ${e.after} ${entry.value_text} ${e.follow_up} ${e.visual?.element_symbols.join(" ")??""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));
  const malformed = entries.length - rows.length;
  return <div data-testid="amie-effluent-ledger" className={`${styles.ledger} mt-3 min-w-0 space-y-2`}>
    <div className={styles.summary} aria-label="廃液実験の集計">
      <div className={`${styles.metric} ${styles.complete}`}><strong data-testid="amie-effluent-completed-count">{summary.completed}</strong><span>実廃液の実験完了<br/>種類照合済み</span></div>
      <div className={`${styles.metric} ${styles.pending}`}><strong>{summary.running}</strong><span>種類<br/>試験中</span></div>
      <div className={styles.metric}><strong>{summary.received}</strong><span>種類<br/>受領・結果待ち</span></div>
      <div className={styles.metric}><strong>{summary.completedUnresolved}</strong><span>件・完了報告<br/>種類未照合</span></div>
      <div className={styles.metric}><strong>{summary.simulatedCompleted}</strong><span>種類<br/>模擬廃液の完了</span></div>
    </div>
    <button className={styles.mobileFilterToggle} aria-expanded={filtersOpen} aria-controls={`poc-filters-${topic.tech_topic_id}`} onClick={()=>setFiltersOpen(open=>!open)}>検索・絞り込み<span>{filtered.length} / {summary.rows}行</span></button>
    <div id={`poc-filters-${topic.tech_topic_id}`} className={`${styles.filterBody} space-y-2`} data-open={filtersOpen}>
    <div className="flex flex-wrap items-center justify-between gap-2"><div className={styles.legend} aria-label="実験結果のお天気マークで絞り込み"><span className="mr-1 text-[11px] text-[#626b77]">実験結果</span>{Object.keys(EXPERIMENT_WEATHER).map(k=><button key={k} aria-pressed={weather===k} onClick={()=>setWeather(weather===k?"all":k as ExperimentVisual["weather"])} className="focus-visible:outline-2 focus-visible:outline-[#027FDC]"><ExperimentResultWeather weather={k as ExperimentVisual["weather"]} reason="" compact/></button>)}<button aria-pressed={weather==="unknown"} onClick={()=>setWeather(weather==="unknown"?"all":"unknown")} className="text-[11px] text-[#626b77]">未確認</button></div>
      <details className="text-[11px] text-[#626b77]"><summary className="cursor-pointer py-2 focus-visible:outline-2 focus-visible:outline-[#027FDC]">凡例・集計の定義{report?`／報告 ${report.minimum}種類以上`:""}</summary><div className="max-w-[85ch] space-y-1 py-2 leading-5"><p>「済」は試験完了、天気は対象成分の実験結果。対象成分の結果と条件を併せて読む。</p>{Object.values(EXPERIMENT_WEATHER).map(x=><p key={x.label}>{x.label}：{x.meaning}</p>)}<p>未確認は結果未登録。良い・悪いの評価には含めない。完了数は種類照合済みの実廃液を数え、再実験は同じ種類として集計する。</p>{report&&<p>研究者報告：{report.minimum}種類以上を試験（{report.reportedOn}）。個別一覧との全件照合は未完了。出典：{report.source}。</p>}</div></details>
    </div>

    <div className="grid grid-cols-2 items-end gap-2 md:flex md:flex-wrap">
      <label className="col-span-2 min-w-0 text-[11px] md:flex-1 md:max-w-[220px]">検索<input className={control} type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="試料・入手元・元素"/></label>
      <label className="text-[11px]">性状<select aria-label="排水の性状" className={control} value={waterType} onChange={e=>setWaterType(e.target.value as EffluentWaterType|"all")}><option value="all">全性状</option>{Object.entries(EFFLUENT_WATER_TYPES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      <label className="text-[12px]">区分<select aria-label="廃液の区分" className={control} value={kind} onChange={e=>setKind(e.target.value as AmieEffluentKind|"all")}><option value="all">全区分</option>{Object.entries(AMIE_EFFLUENT_KINDS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      <label className="text-[12px]">状態<select aria-label="廃液実験の状態で絞り込み" className={control} value={state} onChange={e=>setState(e.target.value as AmieEffluentState|"all")}><option value="all">全状態</option>{Object.entries(AMIE_EFFLUENT_STATES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      <div className="flex flex-col items-start gap-1 md:flex-row md:items-center md:gap-2"><span className="text-[11px] text-[#626b77]" aria-live="polite">{filtered.length} / {summary.rows}行</span>{canEdit && !sharedView && <button className={button} onClick={()=>{setCellEditing(null);setEditing("new");}}>＋ 廃液を追加</button>}</div>
    </div>
    </div>
    {malformed > 0 && <p role="alert" className="text-[12px] text-[#b71c1c]">登録形式を確認する行が{malformed}件ある。集計には含めていない。</p>}
    {editing && <AmieEffluentForm key={editing === "new" ? "new" : editing.tech_entry_id} projectId={projectId} topicId={topic.tech_topic_id} entry={editing === "new" ? undefined : editing} onCancel={()=>setEditing(null)} onSaved={()=>{setEditing(null);onChanged();}}/>}
    <p className="text-[12px] text-[#515158] md:hidden">比較表は横にスクロールできる。</p>
    <div ref={tableRef} className="overflow-x-auto rounded border border-[#d2d2d7]" tabIndex={0} aria-label="廃液ごとの比較表。狭い画面では横にスクロール">
      <table data-amie-list="custom" className={`${styles.table} w-full min-w-[960px] max-w-[1200px] table-fixed text-left`} data-testid="amie-effluent-table">
        <caption className="sr-only">廃液の入手元、成分、処理前後の結果と実験状態</caption>
        <colgroup><col className="w-[174px]"/><col className="w-[116px]"/><col className="w-[110px]"/><col className="w-[284px]"/><col className="w-[112px]"/><col className="w-[96px]"/><col className="w-[68px]"/></colgroup>
        <thead className="bg-[#f5f5f7] text-[11px] text-[#626b77]"><tr>{["試料・性状","入手元","含有元素","処理前 → 処理後","実験結果","実験状態","詳細"].map(x=><th key={x} scope="col" className="px-2 py-2 font-medium">{x}</th>)}</tr></thead>
        {filtered.map(({entry,experiment:e}) => {const v=e.visual??EMPTY_EXPERIMENT_VISUAL;const name=entry.row_label.startsWith(e.provider.split(/\s/)[0])?entry.row_label.slice(e.provider.split(/\s/)[0].length).trim():entry.row_label;const nature=v.water_types.length===2?"both":v.water_types[0]??"unknown";return <tbody key={entry.tech_entry_id} className="border-t border-[#e5e5e7]" data-effluent-type={e.type_key}>
          <tr>
            <th scope="row" {...editableCell(entry,"sample")} className={`${cell} font-medium`}><div className={styles.sample} data-type={nature}><p className="line-clamp-1 text-[12px] text-[var(--amd-ink)]" title={entry.row_label}>{name||entry.row_label}</p><div className="mt-1 flex flex-wrap gap-1">{v.water_types.map(t=><span key={t} className={`${styles.type} ${styles[t]}`}>{EFFLUENT_WATER_TYPES[t]}</span>)}{e.kind!=="actual"&&<span className={`${styles.type} ${styles.unknown}`}>{AMIE_EFFLUENT_KINDS[e.kind]}</span>}{!v.water_types.length&&e.kind==="actual"&&<span className="text-[10px] font-normal text-[#626b77]">性状未分類</span>}</div><div className="mt-1 flex flex-wrap items-center gap-1 md:hidden"><ExperimentResultWeather weather={v.weather} reason={v.weather_reason} compact/>{e.status==="completed"&&<ExperimentDoneStamp/>}<button aria-label={`${entry.row_label}の概要を開く`} className={rowButton} onClick={()=>{setExpanded(prev=>{const n=new Set(prev);if(n.has(entry.tech_entry_id))n.delete(entry.tech_entry_id);else n.add(entry.tech_entry_id);return n;});tableRef.current?.scrollTo({left:0,behavior:"smooth"});}}>開く</button></div>{v.changes[0]&&<p className="mt-1 text-[11px] font-normal text-[#626b77] md:hidden">{v.changes[0].parameter} {v.changes[0].before} → {v.changes[0].after}</p>}</div></th>
            <td {...editableCell(entry,"provider")} className={cell}><p className="line-clamp-1" title={e.provider}>{value(e.provider)}</p>{!sharedView && <p className="mt-0.5 line-clamp-1 text-[10px] text-[#626b77]" title={e.sampling_point}>{e.sampling_point||"採取位置未確認"}</p>}</td>
            <td {...editableCell(entry,"elements")} className={cell}><div className={styles.elements} aria-label={`${entry.row_label}の含有元素`}>{v.element_symbols.map(s=><span key={s} className={styles.element}>{s}</span>)}</div>{!v.element_symbols.length&&<span className="text-[11px] text-[#626b77]">元素未特定</span>}</td>
            <td {...editableCell(entry,"changes")} className={cell}>{v.changes.length?v.changes.slice(0,2).map((c,i)=><div key={i} title={`${c.parameter}：${c.before} → ${c.after} ${c.time}。${c.note}`}><div className={styles.change}><span className={styles.parameter}>{c.parameter}</span><span className={`${styles.before} truncate`}>{c.before}</span><span className={styles.arrow}>→</span><span className={`${styles.after} truncate`} data-effect={c.effect??"unknown"}>{c.after}</span></div></div>):<span className="text-[11px] text-[#626b77]">— → — <span className="ml-1">処理データ未確認</span></span>}{v.changes.length>0&&<span className={`${styles.time} truncate`}>{[...new Set(v.changes.slice(0,2).flatMap(c=>[c.time,c.note]).filter(Boolean))].join(" · ")}</span>}{v.changes.length>2&&<span className="text-[10px] text-[#626b77]">ほか{v.changes.length-2}項目は詳細へ</span>}</td>
            <td {...editableCell(entry,"result")} className={cell}><ExperimentResultWeather weather={v.weather} reason={v.weather_reason}/></td>
            <td {...editableCell(entry,"status")} className={cell} title={`${AMIE_EFFLUENT_STATES[e.status]} · 報告 ${date(entry.observed_on)}`}><div className="flex flex-col items-center">{e.status==="completed"?<ExperimentDoneStamp/>:<span className={e.status==="running"?styles.running:styles.neutral}>{e.status==="received"?"受領・結果待ち":AMIE_EFFLUENT_STATES[e.status]}</span>}{!e.identity_confirmed&&<span className="text-[10px] text-[#9a5800]">種類未照合</span>}</div></td>
            <td {...editableCell(entry,"details")} className={cell}><button aria-label={`${entry.row_label}の詳細`} aria-expanded={expanded.has(entry.tech_entry_id)} className={rowButton} onClick={()=>{setExpanded(prev=>{const n=new Set(prev); if(n.has(entry.tech_entry_id))n.delete(entry.tech_entry_id);else n.add(entry.tech_entry_id);return n;});if(window.innerWidth<768)tableRef.current?.scrollTo({left:0,behavior:"smooth"});}}>{expanded.has(entry.tech_entry_id)?"閉じる":"詳細"}</button>{e.graphs.length>0&&<p className="mt-0.5 text-[10px] text-[#626b77]">図 {e.graphs.length}枚</p>}</td>
          </tr>
          {cellEditing?.displayId === entry.tech_entry_id && <tr><td colSpan={7} className="bg-[#fafafa] px-2 py-2"><AmieEffluentForm key={`${entry.tech_entry_id}:${cellEditing.field}`} projectId={projectId} topicId={topic.tech_topic_id} entry={cellEditing.entry} section={cellEditing.field} onCancel={()=>setCellEditing(null)} onSaved={()=>{setCellEditing(null);onChanged();}}/></td></tr>}
          {expanded.has(entry.tech_entry_id) && <tr><td colSpan={7} className="bg-[#fafafa] px-3 py-3 text-[12px] leading-5"><div className="max-w-[calc(100vw-80px)] md:max-w-[1200px]"><div className="mb-2 flex gap-2"><button className={`${button} md:hidden`} onClick={()=>setExpanded(prev=>{const n=new Set(prev);n.delete(entry.tech_entry_id);return n;})}>詳細を閉じる</button>{editSource(entry)&&<button aria-label={`${entry.row_label}を編集`} className={button} onClick={()=>{setCellEditing(null);setEditing(editSource(entry)!);}}>この試料を編集</button>}</div><dl className={`${styles.detail} grid gap-3 sm:grid-cols-2`}>
            <div><dt className="font-medium">廃液名</dt><dd>{entry.row_label}</dd></div>
            <div><dt className="font-medium">{sharedView?"含有元素":"廃液の成分・採取位置"}</dt><dd>{value(e.components)}{!sharedView&&`／${value(e.sampling_point)}`}</dd></div>
            <div><dt className="font-medium">処理前 → 処理後</dt><dd>{value(e.before)} → {value(e.after)}</dd></div>
            <div><dt className="font-medium">結論</dt><dd>{value(entry.value_text)}</dd></div>
            {v.analysis_note&&<div><dt>分析補足</dt><dd>{v.analysis_note}</dd></div>}
            {!sharedView&&<div><dt className="font-medium">提供ルート・受領</dt><dd>{value(e.route)}／受領日 {date(e.received_on)}</dd></div>}
            {!sharedView&&<div><dt className="font-medium">試験条件・試験日</dt><dd>{value(e.conditions)}／試験日 {date(e.tested_on)}</dd></div>}
            {!sharedView&&<div><dt className="font-medium">残る課題</dt><dd>{e.follow_up || "追加課題の記録なし"}</dd></div>}
            {!sharedView&&<div><dt className="font-medium">出典</dt><dd>{entry.source_ref}{entry.source_url && /^https:\/\//.test(entry.source_url) && <a href={entry.source_url} target="_blank" rel="noopener noreferrer" className="ml-2 text-[#027FDC] underline">元資料を開く</a>}</dd></div>}
          </dl>{sharedView&&<p className="mt-3 text-[11px] text-muted-foreground">原グラフ・試験条件・出典の詳細は社内正本で管理。</p>}
            {v.changes.length>0&&<div className="mt-3 space-y-1 rounded border border-[#e5e5e7] bg-white p-3"><p className="mb-2 text-[11px] text-[#626b77]">成分・指標ごとの変化</p>{v.changes.map((c,i)=><div key={i}><div className={styles.change}><span className={styles.parameter}>{c.parameter}</span><span className={styles.before}>{c.before}</span><span className={styles.arrow}>→</span><span className={styles.after} data-effect={c.effect??"unknown"}>{c.after}</span></div><span className={styles.time}>{[c.time,c.note].filter(Boolean).join(" · ")}</span></div>)}</div>}
            {e.graphs.length>0&&<div className="mt-3 grid max-w-[1200px] gap-3 sm:grid-cols-2" aria-label={`${entry.row_label}の元データのグラフ`}>{e.graphs.map((g,index)=>{
              const url=`/api/project-tech-graphs?entryId=${encodeURIComponent(entry.tech_entry_id)}&index=${index}`;
              return <figure key={g.path} className="min-w-0"><a href={url} target="_blank" rel="noopener noreferrer" className="block rounded border border-[#d2d2d7] bg-white focus-visible:outline-2 focus-visible:outline-[#027FDC]"><img src={url} alt={g.caption} loading="lazy" className="h-auto w-full"/></a><figcaption className="mt-1 text-[12px]"><span className="font-medium">{g.caption}</span><span className="block text-[11px] text-[#515158]">{g.source_ref}</span></figcaption></figure>;
            })}</div>}
            {editSource(entry)&&<AmieEffluentGraphUpload projectId={projectId} entry={editSource(entry)!} onSaved={onChanged}/>}
          </div></td></tr>}
        </tbody>;})}
        {filtered.length === 0 && <tbody><tr><td colSpan={7} className="p-4 text-[12px] text-[#515158]">条件に一致する廃液の記録がない。</td></tr></tbody>}
      </table>
    </div>
  </div>;
}
