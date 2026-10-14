import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { amiePrepareTechDisclosure, amieProjectDdTechTopic } from "../src/lib/amie-tech-disclosure-server.ts";
import type { TechTopic, TechEntry } from "../src/lib/project-tech.ts";
import { AMIE_TECH_LEVELS, AMIE_TECH_LEVEL_LABEL, type AmieTechLevel } from "../src/lib/amie-tech-disclosure-model.ts";

// 2026-10-14に全23項目・248行を読んで作成した欄ごとのレビュー。将来行へ語句で分類を推測しない。
const folder = process.argv[2];
if (!folder) throw new Error("Driveの変更前控えがあるフォルダが必要");
const snapshot = JSON.parse(fs.readFileSync(path.join(folder, "技術台帳_変更前.json"), "utf8"));
type Row = Record<string, any>;
const topics: Row[] = snapshot.topics, entries: Row[] = snapshot.entries;
assert.equal(topics.length, 23); assert.equal(entries.length, 248);
const general = "案内・用語・一般的な仕組みの説明。固有の設定・手順・顧客情報を含まず、秘密にする具体的な理由がない。";
const business = "性能・適用限界・実績・計画・試算の判断情報。未確認・旧値・DD非掲載という理由だけで秘密度を上げない。掲載範囲と提供元の利用条件は別に管理する。";
const experiment = "個別試験の菌体量・組成・培養設定・測定条件を特定できる詳細。概要の性能値とは分け、提供元と受領者の開示条件を確認する。";
const customer = "顧客を特定する実名・試料の組成・採取工程・個別提供条件。提供元の情報利用条件の確認が必要。";
const equipment = "試作装置の内部構造・配置・供給流量・個別運転記録。装置の容量や到達性能だけの説明とは分ける。";
const gene = "個別株の導入対象・導入数・株の構成を特定する設計情報。一般的なタンパク質の説明や性能値とは分け、公表範囲と大学の情報利用条件を確認する。";
const recipe = "具体的な制御操作・投入順序・抽出と再利用の手順を含み、再現につながるため核心ノウハウとして管理する。";
const edits = new Map<string, Record<string, [AmieTechLevel, string]>>();
function mark(ids: string, fields: string, level: AmieTechLevel, reason: string) {
  for (const id of ids.split(/\s+/).filter(Boolean)) {
    const row = edits.get(id) ?? {}; for (const field of fields.split(" ")) row[field] = [level, reason]; edits.set(id, row);
  }
}
// 原本の本文・案内は子の試験行から独立して読む。
mark("ptt_sx_spec_sheet ptt_sol_qa ptt_sx_preference", "body_md", "public", general);
mark("ptt_sx_effluent_sources", "body_md", "restricted", customer);
mark("ptt_sx_closed_mechanism", "body_md", "dd_summary", business);
mark("ptt_sx_closed_gilsp", "body_md", "dd_summary", business);

// 規制の要件は一般説明。株の判定結果と装置への適用は事業情報として分ける。
for (const e of entries.filter(e => e.tech_topic_id === "ptt_sx_closed_categories")) mark(e.tech_entry_id, "value_text condition_text note col_label", "public", general);
mark("pte_sx_cls_r60 pte_sx_cls_r90", "value_text", "public", general);
mark("pte_sx_cls_g40 pte_sx_cls_g50", "value_text", "restricted", gene);
mark("pte_sx_cls_r10 pte_sx_cls_r20 pte_sx_cls_r30 pte_sx_cls_r40", "value_text", "restricted", equipment);

// 株の改変の難しさやノウハウの存在は手順ではない。一般的な吸収波長も核心としない。
mark("pte_sx_k04 pte_sx_k05 pte_sx_ss06", "value_min value_max unit value_text condition_text note", "public", general);
mark("pte_sx_k24 pte_sx_ss28 pte_sx_0915_16", "value_text condition_text note", "dd_summary", business);
mark("pte_sx_k07 pte_sx_ss09", "note", "public", general);
mark("pte_sx_ss08 pte_sx_ss12 pte_sx_ss20 pte_sx_f05 pte_sx_r02 pte_sx_r23", "note", "public", general);
mark("pte_sx_k13 pte_sx_ss22", "value_text condition_text", "public", general);

// 運転範囲・適用限界・出力は事業情報。実際の設定の組合せだけを限定管理する。
mark("pte_sx_k02 pte_sx_k03 pte_sx_k22 pte_sx_ss03 pte_sx_ss07", "value_min value_max value_text", "restricted", experiment);
mark("pte_sx_k02 pte_sx_k03 pte_sx_k16 pte_sx_ss03", "note", "core", recipe);
mark("pte_sx_ss03", "condition_text", "core", recipe);
mark("pte_sx_k06", "value_text", "core", recipe);
mark("pte_sx_k08", "value_text", "restricted", experiment);
mark("pte_sx_k07 pte_sx_ss09 pte_sx_k18 pte_sx_ss10", "condition_text", "restricted", experiment);
mark("pte_sx_k19", "value_min value_max", "restricted", experiment);
mark("pte_sx_pl260520_air_flow pte_sx_pl260520_co2_flow", "value_min value_max value_text condition_text note", "restricted", equipment);
mark("pte_sx_pl260603_dead_volume", "value_min value_max value_text condition_text", "restricted", equipment);
mark("pte_sx_pl260520_tank_drawdown pte_sx_1001_r03", "value_text condition_text", "restricted", equipment);
mark("pte_sx_d01", "condition_text", "restricted", equipment);
mark("pte_sx_d03", "note", "restricted", equipment);

// 個別株の構成と性能値を分離。試験前という状態だけで核心にしない。
mark("pte_sx_d10", "row_label value_min value_max value_text", "restricted", gene);
mark("pte_sx_d11 pte_sx_ss25 pte_sx_ss26", "row_label", "restricted", gene);
mark("pte_sx_d16", "row_label value_text condition_text note", "restricted", gene);
mark("pte_sx_f01 pte_sx_ss17", "condition_text", "restricted", gene);
mark("pte_sx_l07", "value_text note", "restricted", gene);
mark("pte_sx_0915_13", "value_text condition_text", "restricted", "他研究者の個別株と未照合の比較評価。第三者の情報利用条件を確認する。");
mark("pte_sx_0915_11", "value_text note", "core", recipe);
mark("pte_sx_0915_12 pte_sx_0915_14", "value_text condition_text", "core", recipe);
// 脂肪酸の分析値は掲載済みの性能値。抽出手順を含む条件だけを核心として扱う。
mark("pte_sx_0915_14", "value_text", "dd_summary", business);
mark("pte_sx_ss25", "condition_text", "restricted", experiment);
mark("pte_sx_ss25", "note", "restricted", gene);
mark("pte_sx_r19 pte_sx_r20 pte_sx_r21 pte_sx_r22 pte_sx_e03 pte_sx_ss04 pte_sx_ss16", "condition_text", "restricted", experiment);
mark("pte_sx_r21 pte_sx_r22", "note", "restricted", experiment);
mark("pte_sx_r24 pte_sx_r25", "value_text condition_text", "restricted", experiment);

// 実排液の企業名・組成は引き続き個別確認。匿名の性能概要まで巻き込まない。
for (const e of entries.filter(e => e.tech_topic_id === "ptt_sx_effluent_sources" && e.tech_entry_id !== "pte_sx_ef07")) mark(e.tech_entry_id, "row_label value_text condition_text note source_ref", "restricted", customer);
mark("pte_sx_d14 pte_sx_d15 pte_sol_mate_nd_20261008", "row_label condition_text source_ref", "restricted", customer);
mark("pte_sx_e06 pte_sx_e07 pte_sx_e12 pte_sx_1002_e02 pte_sx_1002_e03 pte_sx_1002_x01 pte_sx_ss14 pte_sx_ss15", "condition_text", "restricted", customer);
mark("pte_sx_e07 pte_sx_ss14", "value_text", "restricted", customer);
mark("pte_sx_f04", "value_min value_max value_text condition_text", "restricted", customer);
mark("pte_sx_ss13 pte_sx_l02", "condition_text", "restricted", experiment);

const fields = ["title", "summary", "body_md", "presentation", "row_label", "col_label", "value_min", "value_max", "unit", "value_text", "rating", "condition_text", "note", "source_ref", "source_url", "check_reason"];
const mapping: Row[] = [];
for (const [entity, records] of [["topic", topics], ["entry", entries]] as const) for (const r of records) {
  const id = r[entity === "topic" ? "tech_topic_id" : "tech_entry_id"];
  const levels: Record<string, AmieTechLevel> = {}, reasons: Record<string, string> = {};
  for (const field of fields.filter(key => Object.hasOwn(r, key))) {
    const baseline: AmieTechLevel = ["title", "summary", "row_label", "col_label", "unit"].includes(field) ? "public" : "dd_summary";
    const [level, reason] = edits.get(id)?.[field] ?? [baseline, baseline === "public" ? general : business];
    levels[field] = level; reasons[field] = reason;
  }
  const present = Object.keys(levels).filter(key => r[key] !== null && r[key] !== undefined && r[key] !== "");
  const level = present.reduce<AmieTechLevel>((highest, key) => AMIE_TECH_LEVELS.indexOf(levels[key]) > AMIE_TECH_LEVELS.indexOf(highest) ? levels[key] : highest, "public");
  const reason = [...new Set(present.filter(key => levels[key] === level).map(key => reasons[key]))].join(" / ");
  // 今回の依頼は秘密度と掲載状況の整理。既存の掲載原稿・掲載選択は保持する。
  const disclosure = amiePrepareTechDisclosure(r, entity, {version:1,level,reason,field_levels:levels,field_reasons:reasons,dd:r.disclosure?.dd??null});
  assert.deepEqual(disclosure.dd, r.disclosure?.dd ?? null, "DD原稿を無断で拡張しない");
  mapping.push({entity,id,source_hash:r._pg_hash,disclosure});
}
const recordsWithPolicy = (records: Row[], entity: string) => records.map(r=>({...r,disclosure:mapping.find(m=>m.entity===entity&&m.id===r[entity==="topic"?"tech_topic_id":"tech_entry_id"])!.disclosure}));
const before = topics.map(t=>amieProjectDdTechTopic(t as TechTopic, entries as TechEntry[])).filter(Boolean);
const afterTopics = recordsWithPolicy(topics,"topic"), afterEntries = recordsWithPolicy(entries,"entry");
const after = afterTopics.map(t=>amieProjectDdTechTopic(t as TechTopic, afterEntries as TechEntry[])).filter(Boolean);
assert.deepEqual(after.map(p=>p!.entries.map(e=>e.tech_entry_id)),before.map(p=>p!.entries.map(e=>e.tech_entry_id)),"掲載対象を保持");
// 外部の意味と値を変えない。秘密度の表示値だけは新版の分類に従う。
const withoutLevel = (x: any): any => Array.isArray(x) ? x.map(withoutLevel) : x && typeof x === "object" ? Object.fromEntries(Object.entries(x).filter(([key])=>key!=="disclosure_level").map(([key,v])=>[key,withoutLevel(v)])) : x;
assert.deepEqual(withoutLevel(after),withoutLevel(before),"DD本文・数値・条件・出典の保持");
const quote=(s:string)=>"'"+s.replaceAll("'","''")+"'";
let sql="BEGIN;\n";
for(const entity of ["topic","entry"]) {
  const rows=mapping.filter(r=>r.entity===entity), table=entity==="topic"?"project_tech_topics":"project_tech_entries", pk=entity==="topic"?"tech_topic_id":"tech_entry_id";
  sql+=`DO $amie$ DECLARE changed integer; BEGIN\n WITH input AS (SELECT * FROM jsonb_to_recordset(${quote(JSON.stringify(rows))}::jsonb) AS x(id text,source_hash text,disclosure jsonb)), updated AS (UPDATE public.${table} r SET disclosure=x.disclosure FROM input x WHERE r.${pk}=x.id AND r.project_id='p21' AND md5((to_jsonb(r)-'created_at'-'updated_at'-'sort_order')::text)=x.source_hash RETURNING r.${pk}) SELECT count(*) INTO changed FROM updated;\n IF changed<>${rows.length} THEN RAISE EXCEPTION 'Tech field review changed: %/${rows.length}',changed; END IF; END $amie$;\n`;
}
sql+="COMMIT;\n";
fs.writeFileSync("scripts/data/amie_sol_tech_fields_20261014.sql",sql);
fs.writeFileSync(path.join(folder,"秘密度の変更内容.json"),JSON.stringify(mapping,null,2)+"\n");
const lines=["# 技術情報の秘密度とDD掲載状況","","2026年10月14日。全23項目・248行を欄ごとに確認。秘密度、DD掲載、事実の確度を分ける。一般情報は公開済みを意味せず、DD非掲載は秘密を意味しない。既存のDD原稿と選択を保持する。","","|項目|欄|秘密度|理由|","|---|---|---|---|"];
for(const m of mapping) {const r=(m.entity==="topic"?topics:entries).find(r=>r[m.entity==="topic"?"tech_topic_id":"tech_entry_id"]===m.id)!;for(const [field,level] of Object.entries(m.disclosure.field_levels)) if(r[field]!=null&&r[field]!=="") lines.push(`|${String(r.title??r.row_label).replaceAll("|","／")}|${field}|${AMIE_TECH_LEVEL_LABEL[level as AmieTechLevel]}|${m.disclosure.field_reasons[field]}|`);}
fs.writeFileSync(path.join(folder,"技術情報の秘密度とDD掲載状況.md"),lines.join("\n")+"\n");
console.log(JSON.stringify({topics:topics.length,entries:entries.length,levels:mapping.reduce((c:Row,r:Row)=>(c[r.disclosure.level]=(c[r.disclosure.level]??0)+1,c),{}),ddTopics:after.length,ddEntries:after.reduce((n,p)=>n+p!.entries.length,0)}));
