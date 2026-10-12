"use client";

import { useState } from "react";
import { AMIE_TECH_LEVELS, AMIE_TECH_LEVEL_LABEL, AMIE_TECH_LEVEL_HELP, amieReadTechDisclosure, amieTechLevelOf, type AmieTechLevel } from "@/lib/amie-tech-disclosure-model";
import type { TechTopic, TechEntry } from "@/lib/project-tech";
import { updateTechRow } from "@/lib/project-tech-client";

// まさが原本とDDへの抜粋を照合する操作面。既存の白・Gray・Armada Blue、薄罫線、12px本文、4px刻みを使用。
const control = "w-full rounded border border-[#d2d2d7] bg-white px-2 py-1 text-[12px] text-[#1d1d1f] focus-visible:outline-2 focus-visible:outline-[#027FDC]";
export function AmieTechDisclosureBadge({ record }: { record: TechTopic | TechEntry }) {
  const policy = amieReadTechDisclosure(record.disclosure);
  return <span className="rounded border border-[#d2d2d7] bg-[#f5f5f7] px-2 py-0.5 text-[11px] text-[#3c3c43]">{record.disclosure_level ? AMIE_TECH_LEVEL_LABEL[record.disclosure_level] : policy ? AMIE_TECH_LEVEL_LABEL[policy.level] : "開示未仕分け"}</span>;
}
export function AmieTechDisclosureEditor({ record, entity, projectId, onChanged }: { record: TechTopic | TechEntry; entity: "topic" | "entry"; projectId: string; onChanged: () => void }) {
  const policy = amieReadTechDisclosure(record.disclosure);
  const [level, setLevel] = useState<AmieTechLevel>(policy?.level ?? "restricted");
  const [reason, setReason] = useState(policy?.reason ?? "未仕分け");
  const [enabled, setEnabled] = useState(!!policy?.dd);
  const keys = entity === "topic" ? ["title", "summary", "body_md", "source_label", "check_reason"] : ["row_label", "col_label", "value_text", "condition_text", "note", "source_label", "check_reason"];
  const labels: Record<string, string> = { title:"DD見出し", summary:"DDの要約", body_md:"DD本文", row_label:"DDの項目名", col_label:"DDの比較列名", value_text:"DDの値・説明", condition_text:"DDに示す適用条件", note:"DDの補足", value_mode:"数値の表示", source_label:"DDの根拠資料名", check_reason:"DDに示す未確認事項" };
  const [text, setText] = useState<Record<string, string>>(() => Object.fromEntries([...keys, ...(entity === "entry" ? ["value_mode"] : [])].map(key => [key, policy?.dd?.[key] ?? ((key === "title" || key === "row_label") ? String((record as unknown as Record<string, unknown>)[key] ?? "") : "")])));
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function save() {
    setBusy(true); setError(null);
    try {
      const dd = enabled ? Object.fromEntries([...keys, ...(entity === "entry" ? ["value_mode"] : [])].map(key => [key, key === "body_md" && ["restricted", "core"].includes(level) ? null : text[key]?.trim() || null])) : null;
      await updateTechRow(projectId, entity, entity === "topic" ? (record as TechTopic).tech_topic_id : (record as TechEntry).tech_entry_id, { disclosure:{ version:1, level, reason, dd } });
      onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : "開示区分の保存に失敗"); } finally { setBusy(false); }
  }
  return <details className="mt-2 border-t border-[#e5e5e7] pt-2" data-testid="amie-tech-disclosure-editor">
    <summary className="cursor-pointer text-[12px] font-medium text-[#027FDC]">開示区分・DD掲載欄を編集</summary>
    <div className="mt-2 space-y-2">
      <label className="grid gap-1 text-[11px]">情報の開示区分<select className={control} value={level} onChange={e=>{ const v=e.target.value as AmieTechLevel; setLevel(v); if (entity === "entry" && ["restricted","core"].includes(v)) setEnabled(false); }}>{AMIE_TECH_LEVELS.map(v=><option key={v} value={v}>{AMIE_TECH_LEVEL_LABEL[v]}</option>)}</select></label>
      <p className="text-[11px] text-[#6e6e73]">{AMIE_TECH_LEVEL_HELP[level]}</p>
      <label className="grid gap-1 text-[11px]">仕分け理由<textarea maxLength={4000} className={control} value={reason} onChange={e=>setReason(e.target.value)} /></label>
      <label className="flex min-h-11 items-center gap-2 text-[12px]"><input type="checkbox" checked={enabled} disabled={entity === "entry" && ["restricted", "core"].includes(level)} onChange={e=>setEnabled(e.target.checked)} />{entity === "topic" && ["restricted", "core"].includes(level) ? "DDの見出し・概要を指定（掲載行のみ）" : "通常DDへの掲載欄を指定"}</label>
      {enabled && keys.filter(key=>key!=="body_md" || !["restricted", "core"].includes(level)).map(key=><label key={key} className="grid gap-1 text-[11px]">{labels[key]}<textarea className={`${control} ${key === "body_md" ? "min-h-32" : "min-h-14"}`} value={text[key]??""} onChange={e=>setText({...text,[key]:e.target.value})} /></label>)}
      {enabled && entity === "entry" && <label className="flex min-h-11 items-center gap-2 text-[12px]"><input type="checkbox" checked={text.value_mode !== "text_only"} onChange={e=>setText({...text,value_mode:e.target.checked ? "source" : "text_only"})}/>元の数値・単位をDDへ掲載</label>}
      <p className="text-[11px] leading-4 text-[#6e6e73]">数値・単位・報告日は元の記録を使用。条件・説明はこの掲載欄だけを開示。元の内容が変わると再確認までDDから外れる。</p>
      {error && <p role="alert" className="text-[12px] text-[#b71c1c]">{error}</p>}
      <button type="button" disabled={busy} onClick={()=>void save()} className="min-h-11 rounded bg-[#027FDC] px-3 text-[12px] text-white disabled:opacity-50">{busy ? "保存中…" : "開示区分と掲載欄を保存"}</button>
    </div>
  </details>;
}
export function AmieTechDisclosureInventory({ topic, entries, canEdit, projectId, onChanged }: { topic:TechTopic; entries:TechEntry[]; canEdit:boolean; projectId:string; onChanged:()=>void }) {
  if (!topic.disclosure) return null;
  const status = (record:TechTopic|TechEntry) => record.disclosure_status === "needs_review" ? "変更あり・再確認待ち" : record.disclosure_status === "included" ? "DD抜粋あり" : "DD非掲載";
  return <details className="mt-3 border-t border-[#e5e5e7] pt-2" data-testid="amie-tech-disclosure-inventory">
    <summary className="cursor-pointer text-[12px] font-medium">秘密レベルとDDへの掲載範囲</summary>
    <p className="mt-2 text-[11px] leading-4 text-[#6e6e73]">社内原本の秘密区分と、通常DDへ出す抜粋を別に管理。</p>
    <div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-[12px]">本文</span><AmieTechDisclosureBadge record={topic}/><span className="text-[11px]">{status(topic)}</span></div>
    {canEdit && <AmieTechDisclosureEditor key={topic.tech_topic_id+topic.updated_at} record={topic} entity="topic" projectId={projectId} onChanged={onChanged}/>}
    {entries.length > 0 && <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[360px] border-collapse text-left text-[11px]"><thead><tr className="bg-[#f5f5f7]"><th className="p-2">項目</th><th className="p-2">秘密レベル</th><th className="p-2">DD掲載</th></tr></thead><tbody>{entries.map(e=><tr key={e.tech_entry_id} className="border-t border-[#e5e5e7]"><td className="p-2 align-top">{e.row_label}{canEdit && <AmieTechDisclosureEditor key={e.tech_entry_id+e.updated_at} record={e} entity="entry" projectId={projectId} onChanged={onChanged}/>}</td><td className="p-2 align-top">{AMIE_TECH_LEVEL_LABEL[amieTechLevelOf(e)]}</td><td className="p-2 align-top">{status(e)}</td></tr>)}</tbody></table></div>}
  </details>;
}
