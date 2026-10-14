import assert from "node:assert/strict";
import { amieTechFieldState, amieTechRecordState, amieTechSharedEntry } from "../src/lib/amie-tech-display.ts";
import { amieTechFieldLevel, amieTechContainsLevel, amieReadTechDisclosure } from "../src/lib/amie-tech-disclosure-model.ts";
import fs from "node:fs";
import path from "node:path";
import { amiePrepareTechDisclosure, amieProjectDdTechTopic, amieTechDisclosureStatus } from "../src/lib/amie-tech-disclosure-server.ts";
import { loadProjectTechData } from "../src/lib/project-tech-server.ts";
import { shapeDdTechTopic } from "../src/lib/dd-payload.ts";

const topic:any={project_id:"p21",tech_topic_id:"culture",tech_domain:"培養",status:"active",block_kind:"record",title:"CANARY_RECIPE",summary:"CANARY_SUMMARY",body_md:"CANARY_GENE",source_ref:"CANARY_PRIVATE_REF",source_url:"https://private.example/CANARY_SOURCE",created_by:"CANARY_AUTHOR",updated_by:"CANARY_EDITOR",sort_order:1,presentation:{private:"CANARY_PRESENTATION"},future_secret:"CANARY_FUTURE"};
const row:any={project_id:"p21",tech_topic_id:"culture",tech_entry_id:"speed",row_label:"CANARY_RAW_LABEL",col_label:"CANARY_RAW_COL",value_min:15,value_max:15,unit:"h",value_text:"CANARY_CONTROL",condition_text:"CANARY_SETTINGS",note:"CANARY_MEASUREMENT",source_ref:"CANARY_INTERNAL_SOURCE",source_url:"https://private.example/CANARY_ROW_URL",created_by:"CANARY_AUTHOR",updated_by:"CANARY_EDITOR",confidence:"medium",observed_on:"2026-09-01",sort_order:1,future_secret:"CANARY_FUTURE"};
const approvedTopic={...topic,disclosure:amiePrepareTechDisclosure(topic,"topic",{version:1,level:"core",reason:"CANARY_REVIEW_REASON",dd:{title:"供給能力",summary:"報告値と未達",body_md:null,source_label:"研究者報告",check_reason:"連続運転は未確認"}})};
const approvedRow={...row,disclosure:amiePrepareTechDisclosure(row,"entry",{version:1,level:"dd_summary",reason:"CANARY_REVIEW_REASON",dd:{row_label:"培養時間",value_text:null,condition_text:"基準条件の報告値。制御手順は限定管理",note:"量産は未実証",source_label:"研究者報告",check_reason:"反復未確認"},reviewed_hash:"forged"})};
const privateRow={...row,tech_entry_id:"recipe",disclosure:amiePrepareTechDisclosure({...row,tech_entry_id:"recipe"},"entry",{version:1,level:"core",reason:"原手順",dd:null})};
const approvedRows=[approvedRow,privateRow,{...approvedRow,project_id:"p34"},{...approvedRow,tech_topic_id:"other"}];
const projected=amieProjectDdTechTopic(approvedTopic,approvedRows)!;
assert.ok(projected);
assert.equal(projected.entries.length,1);
assert.equal(projected.topic.body_md,null);
assert.equal(projected.topic.needs_check,true,"DD側で追加した未確認事項も表示");
assert.equal(projected.entries[0].value_min,15);
assert.equal(projected.entries[0].unit,"h");
assert.equal(projected.entries[0].confidence,"medium");
assert.equal(projected.entries[0].observed_on,"2026-09-01");
assert.equal(projected.entries[0].source_url,null);

// 同一行の数値と原条件は別の開示範囲。原本全体を「DD開示」にしない。
const displayRow={...approvedRow,disclosure_status:"included"};
assert.equal(amieTechFieldState(displayRow,projected.entries[0],["value_min","value_max","unit"]),"dd");
assert.equal(amieTechFieldState(displayRow,projected.entries[0],["condition_text"]),"private");
assert.equal(amieTechRecordState(displayRow,projected.entries[0],["value_min","condition_text"]),"excerpt");
assert.equal(amieTechFieldState(displayRow,undefined,["value_min"]),"private","親トピックが非掲載なら掲載指定済みの子も非掲載");
assert.equal(amieTechFieldState(displayRow,projected.entries[0],["value_min"],"needs_review"),"review");
assert.equal(amieTechFieldState(projected.entries[0],projected.entries[0],["value_min"]),"dd","投影済みの外部表示はDD開示");
assert.equal(amieTechSharedEntry(displayRow,{enabled:true,sharedEntries:new Map()}),undefined,"実際の投影にない行を採用しない");

// 機密度と掲載状況は独立。普通の説明を言い換えても秘密度は変わらない。
const fieldTopic:any={...topic,summary:"性能と適用範囲を一枚にまとめる",body_md:"一般的な説明",disclosure:amiePrepareTechDisclosure({...topic,summary:"性能と適用範囲を一枚にまとめる",body_md:"一般的な説明"},"topic",{version:1,level:"restricted",reason:"出典の詳細",field_levels:{summary:"public",body_md:"public",source_ref:"restricted"},field_reasons:{summary:"案内文",body_md:"一般説明",source_ref:"内部の試験情報"},dd:{title:"性能の概要",summary:"事業判断の説明",body_md:"一般的な説明"}})};
const fieldPreview=amieProjectDdTechTopic(fieldTopic,[])!;
assert.ok(fieldPreview);
assert.equal(amieTechFieldLevel(fieldTopic,["summary"]),"public");
assert.equal(amieTechContainsLevel(fieldTopic,"public"),true,"秘密度の絞り込みでも一般の案内を親区分へ巻き込まない");
assert.equal(amieTechFieldState(fieldTopic,fieldPreview.topic,["summary"]),"private","言い換えはDD非掲載の意味だけ");
assert.equal(amieTechFieldLevel({...fieldTopic,disclosure:{...fieldTopic.disclosure,dd:null}},["summary"]),"public","DDを外しても秘密度は変わらない");
const mixedRow:any={...row,disclosure:amiePrepareTechDisclosure(row,"entry",{version:1,level:"core",reason:"条件に制御手順",field_levels:{value_min:"dd_summary",value_max:"dd_summary",unit:"public",value_text:"dd_summary",condition_text:"core",row_label:"public"},field_reasons:{condition_text:"具体的な制御操作"},dd:{row_label:"培養時間",value_text:"CANARY_CONTROL",condition_text:"制御手順は別管理"}})};
assert.equal(amieProjectDdTechTopic(approvedTopic,[mixedRow])!.entries[0].value_min,15,"秘密の条件があっても独立した性能値は投影できる");
assert.equal(amieTechFieldLevel(mixedRow,["condition_text"]),"core");
assert.throws(()=>amiePrepareTechDisclosure(row,"entry",{...mixedRow.disclosure,dd:{...mixedRow.disclosure.dd,condition_text:row.condition_text}}),/通常DD/,"秘密原条件をそのまま掲載できない");
assert.throws(()=>amiePrepareTechDisclosure(row,"entry",{...mixedRow.disclosure,field_levels:{...mixedRow.disclosure.field_levels,value_min:"core"},field_reasons:{...mixedRow.disclosure.field_reasons,value_min:"具体的設定"}}),/通常DD/,"秘密に指定した原数値を掲載できない");
assert.throws(()=>amiePrepareTechDisclosure(row,"entry",{...mixedRow.disclosure,field_reasons:{}}),/理由/);
assert.equal(amieReadTechDisclosure({...mixedRow.disclosure,field_levels:{future_secret:"public"}}),null,"未知の欄の区分を採用しない");
assert.equal(amieTechFieldLevel({...mixedRow,value_text:null},["value_min","value_max","unit","value_text"]),"dd_summary","空欄の秘密度を表示中の数値へ引き継がない");
const markSource=fs.readFileSync(path.join(import.meta.dirname,"../src/components/cockpit/AmieTechDisclosureMark.tsx"),"utf8");
assert.ok(markSource.includes('private:"DD非掲載"'));
assert.ok(!markSource.includes("社内限定"));
assert.ok(markSource.includes("data-amie-sensitivity"),"欄の秘密度を掲載バッジとは別に表示する");

const textOnly={...row,disclosure:amiePrepareTechDisclosure(row,"entry",{version:1,level:"dd_summary",reason:"旧値との混同を避ける",dd:{row_label:"説明だけ",value_mode:"text_only",value_text:"条件を追加確認"}})};
assert.equal(amieProjectDdTechTopic(approvedTopic,[textOnly])!.entries[0].value_min,null,"不要な旧値や質問回数は掲載しない");
assert.equal(row.value_min,15,"非掲載でも原本の値は保持");
assert.ok(!JSON.stringify(projected).includes("CANARY_"),"本文・条件・URL・備考・著者・将来カラム・仕分け理由を返さない");
assert.equal(amieProjectDdTechTopic(topic,[approvedRow]),null,"未仕分け本文は非掲載");
assert.equal(amieProjectDdTechTopic(approvedTopic,[]),null,"核心本文の見出しだけでは掲載しない");
for(const changed of [{value_min:16},{condition_text:"新条件"},{note:"新しい結果"},{source_ref:"新資料"}]) {
 assert.equal(amieTechDisclosureStatus({...approvedRow,...changed},"entry"),"needs_review");
 assert.equal(amieProjectDdTechTopic(approvedTopic,[{...approvedRow,...changed}]),null,"古い掲載欄を再利用しない");
}
assert.equal(amieTechDisclosureStatus({...approvedRow,sort_order:50,updated_at:"2030-01-01"},"entry"),"included","並べ替えと更新日時だけでは失効しない");
assert.equal(amieProjectDdTechTopic({...approvedTopic,body_md:"変更した原文"},[approvedRow]),null);
assert.throws(()=>amiePrepareTechDisclosure(row,"entry",{version:1,level:"core",reason:"非公開",dd:{row_label:"誤開示"}}),/通常DD/);
assert.throws(()=>amiePrepareTechDisclosure(topic,"topic",{version:1,level:"core",reason:"非公開",dd:{title:"見出し",body_md:"誤開示"}}),/通常DD/);
assert.throws(()=>amiePrepareTechDisclosure(row,"entry",{version:1,level:"dd_summary",reason:"理由",dd:{row_label:"値",value_min:"偽数値"}}),/形式/);
assert.notEqual((approvedRow.disclosure as any).reviewed_hash,"forged","確認hashはサーバー生成");
assert.throws(()=>shapeDdTechTopic("p21",topic,[approvedRow]),/開示/);
assert.equal(shapeDdTechTopic("p21",approvedTopic,approvedRows).entries.length,1,"選択DD項目・PDF用も同じ仕分け");
assert.throws(()=>shapeDdTechTopic("p34",approvedTopic,approvedRows),/PJ/);

const tables:any={project_tech_topics:[approvedTopic,{...topic,tech_topic_id:"unclassified"},{...topic,tech_topic_id:"competition",tech_domain:"競合比較"}],project_tech_entries:approvedRows,project_knowledge:[{fact_text:"CANARY_FRAGMENT"}]};
const db:any={from(table:string){const query:any={select(){return query},eq(){return query},neq(){return query},order(){return query},in(){return query},limit(){return query},then(resolve:any){return Promise.resolve({data:tables[table],error:null}).then(resolve)}};return query}};
const internal=await loadProjectTechData(db,"p21",true,"internal","technology");
assert.equal(internal.topics[0].body_md,"CANARY_GENE");
assert.equal(internal.canEdit,true);
for(const audience of ["dd","shared"] as const){
 const external=await loadProjectTechData(db,"p21",true,audience,"technology");
 assert.equal(external.canEdit,false);
 assert.equal(external.topics.length,1);
 assert.equal(external.entries.length,1);
 assert.equal(external.fragments.length,0);
 assert.ok(!JSON.stringify(external).includes("CANARY_"),audience+"取得時に内部データを除外");
}
assert.equal((await loadProjectTechData(db,"p21",false,"dd","competition")).topics.length,1,"別タブへ技術原文を混ぜない");

// 初回仕分けの全件を同じ投影関数で確認し、確認用原稿もDriveへ直接出す。
if(process.argv[2]) {
 const folder=process.argv[2];const snapshot=JSON.parse(fs.readFileSync(path.join(folder,"技術台帳_仕分け前.json"),"utf8"));
 const policies=JSON.parse(fs.readFileSync(path.join(folder,"技術情報_開示仕分け.json"),"utf8"));
 const withPolicy=(records:any[],entity:string)=>records.map(r=>({...r,disclosure:policies.find((p:any)=>p.entity===entity&&p.id===r[entity==="topic"?"tech_topic_id":"tech_entry_id"]).disclosure}));
 const sourceTopics=withPolicy(snapshot.topics,"topic");const sourceEntries=withPolicy(snapshot.entries,"entry");
 const full=sourceTopics.map((t:any)=>amieProjectDdTechTopic(t,sourceEntries)).filter((p): p is NonNullable<typeof p> => p !== null);
 assert.equal(full.reduce((n:number,p:any)=>n+p.entries.length,0),121);
 const json=JSON.stringify(full);
 assert.ok(!/TmtA|メタノール|OD5|Fe\(NO|650nm|730nm|440nm|3%CO2|6\.5%CO2/.test(json),"個別遺伝子・培養・抽出条件が混ざらない");
 assert.ok(full.some((p:any)=>p.entries.some((e:any)=>e.tech_entry_id==="pte_sx_1001_r01")));
 assert.ok(full.some((p:any)=>p.entries.some((e:any)=>e.tech_entry_id==="pte_sol_mate_nd_20261008")));
 fs.writeFileSync(path.join(folder,"通常DDの技術掲載内容.json"),JSON.stringify(full,null,2)+"\n");
 const lines=["# 通常DDへ開示する技術情報","","仕分け済みの正本から投影した表示内容。数値は研究者報告・仮定・未確認を区別して読む。原データ・再現手順は含めない。",""];
 for(const p of full){lines.push("## "+p.topic.title,"",p.topic.summary??"",p.topic.body_md??"","");for(const e of p.entries){lines.push("### "+e.row_label,"",[e.value_min!=null?`${e.value_min}${e.value_max!=null&&e.value_max!==e.value_min?"〜"+e.value_max:""}${e.unit??""}`:"",e.value_text,e.condition_text,e.note,e.check_reason?"要確認："+e.check_reason:null].filter(Boolean).join("\n\n"),"");}}
 fs.writeFileSync(path.join(folder,"通常DDの技術掲載内容.md"),lines.join("\n")+"\n");
 console.log(JSON.stringify({corpusTopics:full.length,corpusEntries:121}));
}
console.log("Tech disclosure: private canaries, numeric preservation, stale review, unclassified, cross-PJ, DD/shared loader and selected item export PASS");

// 実画面で発見した、保存後にブラウザのHTTPキャッシュへ戻る不具合の再発防止。
const originalFetch=globalThis.fetch;
Object.assign(globalThis,{window:{}});
try {
 const {loadProjectTech,updateTechRow}=await import("../src/lib/project-tech-client.ts");
 let current={ok:true,canEdit:true,topics:[{...approvedTopic,disclosure_status:"included"}],entries:[],fragments:[]};
 let browserCached: typeof current | null=null;
 globalThis.fetch=(async (_url:unknown,init?:RequestInit)=>{
  if(init?.method==="PATCH"){current={...current,topics:[{...approvedTopic,disclosure_status:"excluded"}]};return new Response(JSON.stringify({ok:true}));}
  if(init?.cache==="no-store" || !browserCached) browserCached=current;
  return new Response(JSON.stringify(browserCached));
 }) as typeof fetch;
 assert.equal((await loadProjectTech("http-cache-test")).topics[0].disclosure_status,"included");
 await updateTechRow("http-cache-test","topic","culture",{disclosure:{version:1,level:"core",reason:"原本",dd:null}});
 assert.equal((await loadProjectTech("http-cache-test",{force:true})).topics[0].disclosure_status,"excluded","保存後はブラウザの古い掲載状態を再利用しない");
} finally {globalThis.fetch=originalFetch;Reflect.deleteProperty(globalThis,"window");}
console.log("Tech disclosure saving: browser HTTP cache bypass and current inclusion state PASS");
