import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const nativeRequire = createRequire(import.meta.url);
const cache = new Map<string, Record<string, any>>();
function sourceModule(file: string): Record<string, any> {
  const resolved = path.resolve(file);
  if (cache.has(resolved)) return cache.get(resolved)!;
  const exports = {}; cache.set(resolved, exports);
  const code = ts.transpileModule(readFileSync(resolved, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "exports", code)((name: string) => {
    if (name.startsWith("@/") || name.startsWith(".")) {
      const base = name.startsWith("@/") ? path.resolve("src", name.slice(2)) : path.resolve(path.dirname(resolved), name);
      for (const ext of ["", ".ts", ".tsx"]) { try { readFileSync(base + ext); return sourceModule(base + ext); } catch (err) { if ((err as {code?:string}).code !== "ENOENT") throw err; } }
      throw new Error(`Missing source module ${base}`);
    }
    return nativeRequire(name);
  }, exports);
  return exports;
}
const { contractTableRow } = sourceModule("src/components/contracts/ContractsClient.tsx");
const { ContractLedgerTable } = sourceModule("src/components/contracts/ContractLedgerTable.tsx");
const contract = {contract_id:"one",related_titles:[],current_signed_document_id:"proof",related_contract_ids:["one"],project_id:"p21",contract_title:"秘密保持契約",canonical_title:null,status:"signed",signed_document_id:"proof",signed_at:"2026-10-08",registry_status:"accepted",relationship_scope:"amd_contract",counterparty_name:"相手先",contract_type:"nda",effective_date:null,expiration_date:null,contract_value_yen:null,is_current_for_project:true,operational_terms_json:{},related_record_count:1};
const project = {project_name:"SOL",contract_terms_json:{currentContractId:"foreign",startDate:"2020-01-01",endDate:"2030-01-01",currentContracts:[{contractId:"foreign",terms:{scopeSummary:"FOREIGN_CANARY",monthlyFeeYen:9999}}]},end_ym:"2030-01"};
const doc = {document_id:"proof",contract_id:"one",document_kind:"signed",file_name:"押印版.pdf",web_view_link:"https://drive.google.com/file/d/proof/view",is_latest:true};
const row = contractTableRow(contract,project,[doc]);
assert.equal(row.signedDate,"2026/10/08");
assert.equal(row.startDate,"未確認"); assert.equal(row.endDate,"未確認","PJ period must not become contract period");
assert.equal(row.monthlyAmount,"未確認");assert.equal(row.totalAmount,"未確認");assert.equal(row.scope,"未確認","Other contract's terms must stay isolated");
assert.equal(row.signature,"押印完了");assert.equal(contractTableRow(contract,project,[]).signature,"要確認");
const zero = contractTableRow({...contract,contract_value_yen:0,operational_terms_json:{monthlyFeeYen:0}},project,[]);
assert.equal(zero.totalAmount,"0円");assert.equal(zero.monthlyAmount,"0円","Known zero is distinct from unknown");
for (const initialView of ["basic","terms","all"]) {
  const html = renderToStaticMarkup(React.createElement(ContractLedgerTable,{rows:[row],initialView,onOpen:()=>{}}));
  assert.ok(html.includes("<table"));assert.ok(!html.includes('role="button"'),"Table rows retain native semantics");
  const headers=[...html.matchAll(/<th\s[^>]*>(.*?)<\/th>/g)].map(match=>match[1]);
  assert.equal((html.match(/<td\s/g)||[]).length,headers.length,"Header/cell alignment");
  for(const label of ["PJ","契約名","相手先","契約書","確認事項"]) assert.ok(headers.includes(label),label);
  if(initialView==="basic" || initialView==="all") for(const label of ["状態","押印証跡","締結日","開始日","終了日","契約額","月額","支払条件"]) assert.ok(headers.includes(label),label);
  assert.ok(html.includes('href="https://drive.google.com/file/d/proof/view"'),"Direct source link retained");
  assert.ok(html.includes("秘密保持契約 の詳細を開く"),"Explicit detail button retained");
  assert.ok(!html.includes("FOREIGN_CANARY"));
  const empty=renderToStaticMarkup(React.createElement(ContractLedgerTable,{rows:[],initialView,onOpen:()=>{}}));
  assert.ok(empty.includes(`colSpan="${headers.length}"`));assert.ok(empty.includes("該当する契約なし"));
}
console.log("Contract ledger table: independent fields, unknown/zero, proof, isolation, native table and document/detail access OK");
