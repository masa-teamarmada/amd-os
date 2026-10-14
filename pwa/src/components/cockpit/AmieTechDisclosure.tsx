"use client";

import { useState } from "react";
import { AMIE_TECH_LEVELS, AMIE_TECH_LEVEL_LABEL, AMIE_TECH_LEVEL_HELP, amieReadTechDisclosure, amieTechLevelOf, type AmieTechLevel } from "@/lib/amie-tech-disclosure-model";
import type { TechTopic, TechEntry } from "@/lib/project-tech";
import { updateTechRow } from "@/lib/project-tech-client";

// まさが原本とDDへの抜粋を照合する操作面。既存の白・Gray・Armada Blue、薄罫線、12px本文、4px刻みを使用。
const control = "min-h-11 w-full rounded border border-[#d2d2d7] bg-white px-2 py-1 text-[12px] text-[#1d1d1f] focus-visible:outline-2 focus-visible:outline-[#027FDC]";
export function AmieTechDisclosureBadge({ record }: { record: TechTopic | TechEntry }) {
  const policy = amieReadTechDisclosure(record.disclosure);
  return <span className="rounded border border-[#d2d2d7] bg-[#f5f5f7] px-2 py-0.5 text-[11px] text-[#3c3c43]">{record.disclosure_level ? AMIE_TECH_LEVEL_LABEL[record.disclosure_level] : policy ? AMIE_TECH_LEVEL_LABEL[policy.level] : "開示未仕分け"}</span>;
}
export function AmieTechDisclosureEditor({ record, entity, projectId, onChanged }: { record: TechTopic | TechEntry; entity: "topic" | "entry"; projectId: string; onChanged: () => void }) {
  const policy = amieReadTechDisclosure(record.disclosure);
  const [level, setLevel] = useState<AmieTechLevel>(policy?.level ?? "restricted");
  const [reason, setReason] = useState(policy?.reason ?? "未仕分け");
  const [enabled, setEnabled] = useState(!!policy?.dd);
  const [fieldLevels, setFieldLevels] = useState(policy?.field_levels);
  const [fieldReasons, setFieldReasons] = useState(policy?.field_reasons ?? {});
  const fieldLabels: Record<string, string> = { title:"見出し", summary:"要約", body_md:"本文", presentation:"表の説明", row_label:"項目名", col_label:"比較列名", value_min:"数値（下限）", value_max:"数値（上限）", unit:"単位", value_text:"値の説明", rating:"評価", condition_text:"条件", note:"補足", source_ref:"出典", source_url:"出典リンク", check_reason:"未確認事項" };
  const source = record as unknown as Record<string, unknown>;
  const sourceFields = Object.keys(fieldLabels).filter(key => source[key] !== null && source[key] !== undefined && source[key] !== "");
  const granular = !!fieldLevels;
  const displayLevel = granular ? sourceFields.reduce<AmieTechLevel>((highest, key) => AMIE_TECH_LEVELS.indexOf(fieldLevels[key] ?? level) > AMIE_TECH_LEVELS.indexOf(highest) ? fieldLevels[key] ?? level : highest, "public") : level;
  const keys = entity === "topic" ? ["title", "summary", "body_md", "source_label", "check_reason"] : ["row_label", "col_label", "value_text", "condition_text", "note", "source_label", "check_reason"];
  const labels: Record<string, string> = { title:"DD見出し", summary:"DDの要約", body_md:"DD本文", row_label:"DDの項目名", col_label:"DDの比較列名", value_text:"DDの値・説明", condition_text:"DDに示す適用条件", note:"DDの補足", value_mode:"数値の表示", source_label:"DDの根拠資料名", check_reason:"DDに示す未確認事項" };
  const [text, setText] = useState<Record<string, string>>(() => Object.fromEntries([...keys, ...(entity === "entry" ? ["value_mode"] : [])].map(key => [key, policy?.dd?.[key] ?? ((key === "title" || key === "row_label") ? String((record as unknown as Record<string, unknown>)[key] ?? "") : "")])));
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function save() {
    setBusy(true); setError(null);
    try {
      const dd = enabled ? Object.fromEntries([...keys, ...(entity === "entry" ? ["value_mode"] : [])].map(key => [key, key === "body_md" && !granular && ["restricted", "core"].includes(level) ? null : text[key]?.trim() || null])) : null;
      await updateTechRow(projectId, entity, entity === "topic" ? (record as TechTopic).tech_topic_id : (record as TechEntry).tech_entry_id, { disclosure:{ version:1, level: granular ? sourceFields.reduce<AmieTechLevel>((highest, key) => AMIE_TECH_LEVELS.indexOf(fieldLevels[key] ?? level) > AMIE_TECH_LEVELS.indexOf(highest) ? fieldLevels[key] ?? level : highest, "public") : level, reason, dd, ...(granular ? {field_levels:fieldLevels, field_reasons:fieldReasons} : {}) } });
      onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : "秘密度の保存に失敗"); } finally { setBusy(false); }
  }
  return <details className="mt-2 border-t border-[#e5e5e7] pt-2" data-testid="amie-tech-disclosure-editor">
    <summary className="min-h-11 cursor-pointer text-[12px] font-medium text-[#027FDC] sm:min-h-0">秘密度とDD掲載欄を編集</summary>
    <div className="mt-2 space-y-2">
      <label className="grid gap-1 text-[11px]">情報の秘密度<select disabled={granular} className={control} value={displayLevel} onChange={e=>{ const v=e.target.value as AmieTechLevel; setLevel(v); if (!granular && entity === "entry" && ["restricted","core"].includes(v)) setEnabled(false); }}>{AMIE_TECH_LEVELS.map(v=><option key={v} value={v}>{AMIE_TECH_LEVEL_LABEL[v]}</option>)}</select></label>
      <p className="text-[11px] text-[#6e6e73]">{AMIE_TECH_LEVEL_HELP[displayLevel]}</p>
      <label className="grid gap-1 text-[11px]">秘密度の理由{granular ? "（欄ごとに編集）" : ""}<textarea readOnly={granular} maxLength={4000} className={control} value={granular ? [...new Set(sourceFields.filter(key=>(fieldLevels[key]??level)===displayLevel).map(key=>fieldReasons[key]).filter(Boolean))].join(" / ") : reason} onChange={e=>setReason(e.target.value)} /></label>
      <details className="rounded border border-[#e5e5e7] p-2"><summary className="min-h-11 cursor-pointer text-[12px]">説明・値・条件ごとの秘密度</summary><p className="text-[11px] text-[#6e6e73]">全体の秘密度は各欄の最大値。一般説明を他の欄の秘密度へ巻き込まない。</p>{sourceFields.map(key => <div key={key} className="mt-2 grid gap-1 border-t border-[#e5e5e7] pt-2"><label className="grid gap-1 text-[11px]">{fieldLabels[key]}<select className={control} value={fieldLevels?.[key] ?? level} onChange={e=>setFieldLevels({...Object.fromEntries(sourceFields.map(k=>[k,fieldLevels?.[k]??level])),[key]:e.target.value as AmieTechLevel})}>{AMIE_TECH_LEVELS.map(v=><option key={v} value={v}>{AMIE_TECH_LEVEL_LABEL[v]}</option>)}</select></label><label className="grid gap-1 text-[11px]">{fieldLabels[key]}の理由<textarea className={control} maxLength={4000} value={fieldReasons[key]??""} onChange={e=>setFieldReasons({...fieldReasons,[key]:e.target.value})}/></label></div>)}</details>
      <label className="flex min-h-11 items-center gap-2 text-[12px]"><input type="checkbox" checked={enabled} disabled={!granular && entity === "entry" && ["restricted", "core"].includes(level)} onChange={e=>setEnabled(e.target.checked)} />{!granular && entity === "topic" && ["restricted", "core"].includes(level) ? "DDの見出し・概要を指定（掲載行のみ）" : "通常DDへの掲載欄を指定"}</label>
      {enabled && keys.filter(key=>key!=="body_md" || granular || !["restricted", "core"].includes(level)).map(key=><label key={key} className="grid gap-1 text-[11px]">{labels[key]}<textarea className={`${control} ${key === "body_md" ? "min-h-32" : "min-h-14"}`} value={text[key]??""} onChange={e=>setText({...text,[key]:e.target.value})} /></label>)}
      {enabled && entity === "entry" && <label className="flex min-h-11 items-center gap-2 text-[12px]"><input type="checkbox" checked={text.value_mode !== "text_only"} onChange={e=>setText({...text,value_mode:e.target.checked ? "source" : "text_only"})}/>元の数値・単位をDDへ掲載</label>}
      <p className="text-[11px] leading-4 text-[#6e6e73]">数値・単位・報告日は元の記録を使用。条件・説明はこの掲載欄だけを開示。元の内容が変わると再確認までDDから外れる。</p>
      {error && <p role="alert" className="text-[12px] text-[#b71c1c]">{error}</p>}
      <button type="button" disabled={busy} onClick={()=>void save()} className="min-h-11 rounded bg-[#027FDC] px-3 text-[12px] text-white disabled:opacity-50">{busy ? "保存中…" : "秘密度とDD掲載欄を保存"}</button>
    </div>
  </details>;
}
export function AmieTechDisclosureInventory({ topic, entries, canEdit, projectId, onChanged }: { topic:TechTopic; entries:TechEntry[]; canEdit:boolean; projectId:string; onChanged:()=>void }) {
  if (!topic.disclosure) return null;
  const status = (record:TechTopic|TechEntry) => record.disclosure_status === "needs_review" ? "変更あり・再確認待ち" : record.disclosure_status === "included" ? "DD抜粋あり" : "DD非掲載";
  return <details className="mt-3 border-t border-[#e5e5e7] pt-2" data-testid="amie-tech-disclosure-inventory">
    <summary className="min-h-11 cursor-pointer text-[12px] font-medium sm:min-h-0">秘密度とDD掲載状況</summary>
    <p className="mt-2 text-[11px] leading-4 text-[#6e6e73]">秘密度は内容と隠す理由、DD掲載状況は掲載原稿で管理。DD非掲載だけでは秘密情報を意味しない。</p>
    <div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-[12px]">本文</span><AmieTechDisclosureBadge record={topic}/><span className="text-[11px]">{status(topic)}</span></div><p className="mt-1 text-[11px] leading-5 text-[#515158]">理由：{amieReadTechDisclosure(topic.disclosure)?.reason}</p>
    {canEdit && <AmieTechDisclosureEditor key={topic.tech_topic_id+topic.updated_at} record={topic} entity="topic" projectId={projectId} onChanged={onChanged}/>}
    {entries.length > 0 && <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[360px] border-collapse text-left text-[11px]"><thead><tr className="bg-[#f5f5f7]"><th className="p-2">項目</th><th className="p-2">秘密度</th><th className="p-2">DD掲載</th></tr></thead><tbody>{entries.map(e=><tr key={e.tech_entry_id} className="border-t border-[#e5e5e7]"><td className="p-2 align-top">{e.row_label}{canEdit && <AmieTechDisclosureEditor key={e.tech_entry_id+e.updated_at} record={e} entity="entry" projectId={projectId} onChanged={onChanged}/>}</td><td className="p-2 align-top">{AMIE_TECH_LEVEL_LABEL[amieTechLevelOf(e)]}</td><td className="p-2 align-top">{status(e)}</td></tr>)}</tbody></table></div>}
  </details>;
}
