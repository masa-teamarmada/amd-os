import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const nativeRequire = createRequire(import.meta.url);
const cache = new Map<string, Record<string, unknown>>();
export function sourceModule(file: string): Record<string, any> {
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
const { contractOperationalChecks, contractSourceUrl } = sourceModule("src/lib/contract-operational-checks.ts");
const { ContractOperationalChecks } = sourceModule("src/components/cockpit/ContractOperationalChecks.tsx");
const { CockpitProjectOverview } = sourceModule("src/components/cockpit/CockpitProjectOverview.tsx");
const confirmed = { id:"one",question:"開示の条件は？",status:"confirmed",answer:"対象範囲を確認",sourceTitle:"原本",sourceUrl:"https://drive.google.com/file/d/source/view",sourceClause:"第1条",checkedAt:"2026-10-08",actions:[{kind:"contract_requirement",text:"承諾を得る"},{kind:"recommended_check",text:"承認者を確認"}],unresolved:["様式未確認"] };
assert.equal(contractOperationalChecks([confirmed])[0].status, "confirmed");
for (const patch of [{sourceUrl:"https://drive.google.com.evil.example/file"},{sourceClause:""},{checkedAt:""},{status:"approved"}]) assert.equal(contractOperationalChecks([{...confirmed,...patch}])[0].status,"needs_confirmation");
for (const url of ["javascript:alert(1)","data:text/html,bad","http://drive.google.com/file","https://evil.example/"]) assert.equal(contractSourceUrl(url),null);
for (const value of [null,{},"approved",[null,4,{}, {question:"q"}]]) assert.deepEqual(contractOperationalChecks(value),[]);
const html = renderToStaticMarkup(React.createElement(ContractOperationalChecks,{terms:{operationalChecks:[confirmed,{...confirmed,id:"two",status:"needs_confirmation"}]}}));
assert.equal((html.match(/<details[^>]*open=""/g) || []).length,1,"Only unresolved question starts open");
for (const text of ["契約上の義務","開示前の確認","まだ確定していないこと","第1条","2026-10-08","今回の相手・資料に対する開示承認の記録は、別途確認"]) assert.ok(html.includes(text),text);
const empty = renderToStaticMarkup(React.createElement(ContractOperationalChecks,{terms:{}}));
assert.ok(empty.includes("手続き未確認")); assert.ok(!empty.includes("条項確認済み"));
const malicious = renderToStaticMarkup(React.createElement(ContractOperationalChecks,{terms:{operationalChecks:[{...confirmed,sourceUrl:"javascript:alert(1)",answer:"<script>bad</script>"}]}}));
assert.ok(!malicious.includes('href="javascript:')); assert.ok(malicious.includes("&lt;script&gt;"));
const project = {projectId:"any",projectName:"test",clientName:"test",status:"active",contractTerms:{currentContractId:"original",operationalChecks:[{...confirmed,answer:"FOREIGN_CONTRACT_CANARY"}],currentContracts:[{contractId:"different",title:"other",terms:null}]}};
const isolated = renderToStaticMarkup(React.createElement(CockpitProjectOverview,{project}));
assert.ok(!isolated.includes("FOREIGN_CONTRACT_CANARY"),"Never borrow another contract's conditions");
assert.ok(isolated.includes("手続き未確認"));
console.log("Contract operational checks: source safety, unknown states, actual rendering, open/closed details and contract isolation OK");
