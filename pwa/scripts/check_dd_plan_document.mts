import assert from "node:assert/strict";
import * as nodeModule from "node:module";
// Node 22 provides synchronous hooks; the repository still uses older Node type definitions.
type ResolveContext = { parentURL?: string };
type ResolveResult = { url: string; shortCircuit?: boolean };
type ResolveNext = (specifier: string, context: ResolveContext) => ResolveResult;
const { registerHooks } = nodeModule as unknown as { registerHooks(hooks: { resolve(specifier: string, context: ResolveContext, next: ResolveNext): ResolveResult }): void };
import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.endsWith('/project-short-term-plan-server.ts')) {
    if (specifier === './workspace-documents-server') return {url:'data:text/javascript,export const WORKSPACE_DOCUMENT_FIELDS="document_id,project_id,scope_kind,mime_type,upload_status";',shortCircuit:true};
    if (specifier === './workspace-document-text') return {url:'data:text/javascript,export async function loadWorkspaceDocumentText(db,row,max){return db.readText(row,max)}',shortCircuit:true};
  }
  return next(specifier,context);
} });
const {loadLongTermPlanHtml,loadLongTermPlanDocument,loadShortTermPlanHtml}=await import('../src/lib/project-short-term-plan-server.ts');
const id='6b2f3927-ae3c-4934-b3e6-d3ab25275146';
const source='<style>body{color:#15394A}</style><section id="work"><svg><title>IPO</title></svg></section><section id="cash">PRIVATE</section><script>PRIVATE</script>';
function db(options:{project?:string;status?:string;mime?:string;pointer?:string|null;fail?:string;body?:string}={}){
 const tables:Record<string,Record<string,unknown>[]>= {project_config:[{project_id:'p21',key:'long_term_plan_document_id',value:options.pointer===undefined?id:options.pointer},{project_id:'p21',key:'short_term_plan_document_id',value:id}],workspace_documents:[{document_id:id,project_id:options.project??'p21',scope_kind:'project',upload_status:options.status??'active',mime_type:options.mime??'text/html'}]};
 return {from(table:string){const filters:[string,unknown][]=[];const query={select(){return query},eq(k:string,v:unknown){filters.push([k,v]);return query},maybeSingle(){return Promise.resolve({data:tables[table].find(r=>filters.every(([k,v])=>r[k]===v))??null,error:options.fail===table?{message:'failure'}:null})}};return query},readText(_row:unknown,max:number){assert.equal(max,5*1024*1024);return Promise.resolve({ok:true,text:options.body??source})}} as unknown as SupabaseClient;
}
const html=await loadLongTermPlanHtml(db(),'p21');
assert.ok(html?.includes('<section id="work"><svg><title>IPO</title>'));
assert.ok(html?.includes('<style>body{color:#15394A}</style>'));
assert.ok(!html?.includes('PRIVATE'),'cash/other sections and outside scripts are excluded');
assert.equal(await loadLongTermPlanDocument(db(),'p34'),null);
assert.equal(await loadLongTermPlanDocument(db({pointer:null}),'p21'),null);
for(const bad of [{pointer:'invalid'},{project:'p34'},{status:'archived'},{mime:'text/plain'},{fail:'project_config'},{fail:'workspace_documents'}]) await assert.rejects(loadLongTermPlanDocument(db(bad),'p21'));
await assert.rejects(loadLongTermPlanHtml(db({body:'<section id="cash">not work</section>'}),'p21'),/ガント/);
assert.equal(await loadShortTermPlanHtml(db(),'p21'),html);
const route=readFileSync('src/app/dd/[slug]/long-term-plan-document/route.ts','utf8');
assert.ok(route.indexOf('if (!access) notFound()')<route.indexOf('loadLongTermPlanHtml(createAdminClient(), access.projectId)'));
assert.match(route,/private, no-store/);assert.match(route,/default-src 'none'/);assert.match(route,/sandbox/);
assert.match(readFileSync('next.config.ts','utf8'),/long-term-plan-document", headers: ddPublicationFileSecurityHeaders/);
console.log('DD plan document: authorized PJ/config, HTML scope/style, missing/archived references, short-term preservation, route auth/CSP PASS');
