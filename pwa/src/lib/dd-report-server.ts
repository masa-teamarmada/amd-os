import 'server-only';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {createAdminClient} from './supabase/admin';
import type {DdViewerAccess} from './dd-package-core';
import {canReadDdReport} from './dd-report-core';
export {canReadDdReport,canEditDdReport} from './dd-report-core';
import {completeDdReportInputs} from './dd-report-input-metadata';
import {ddJkissSummary} from './dd-report-jkiss';
import {DdReportCalculator,ddAddress,ddColumn} from './dd-report-model';
import type {DdReportAsset,DdReportBody,DdReportChapter,DdReportChapterSummary,DdReportEdition,DdReportModel,DdReportValue} from './dd-report-types';
import {loadProjectPartnerDisclosure} from './project-partner-disclosure-server';
import {redactProjectPartnerNames} from './project-partner-disclosure';
import {DD_DEVELOPMENT_SLUGS,splitDdDevelopmentChapter,splitDdDevelopmentIndex} from './dd-report-development-plans';

export const DD_REPORT_BUCKET='dd-report-files';
const EDITION_FIELDS='id,package_id,title,source_version,source_sha256,status,summary,model_storage_path,xlsx_storage_path,legacy_snapshot_path,input_overrides,glossary,revision,created_at,updated_at';
export async function loadDdReportEdition(access:DdViewerAccess):Promise<DdReportEdition|null> {
  let query=createAdminClient().from('dd_report_editions').select(EDITION_FIELDS).eq('package_id',access.packageId).neq('status','archived').order('created_at',{ascending:false}).limit(1);
  if(access.principal==='workspace_account')query=query.eq('status','published');
  const result=await query.maybeSingle();if(result.error)throw new Error('DDレポートを読み込めなかった');
  const edition=result.data as DdReportEdition|null;return edition&&canReadDdReport(access,edition)?edition:null;
}
export async function loadDdReportChapterIndex(editionId:string):Promise<DdReportChapterSummary[]> {
  const r=await createAdminClient().from('dd_report_chapters').select('id,slug,title,group_label,sort_order,source_sheet,revision,updated_at').eq('edition_id',editionId).order('sort_order');
  if(r.error)throw new Error('資料目録を読み込めなかった');return splitDdDevelopmentIndex(r.data as DdReportChapterSummary[]);
}
export async function loadDdReportChapter(editionId:string,slug:string):Promise<DdReportChapter|null> {
  const sourceSlug=DD_DEVELOPMENT_SLUGS.includes(slug as typeof DD_DEVELOPMENT_SLUGS[number])?'execution-plan':slug;
  const r=await createAdminClient().from('dd_report_chapters').select('id,slug,title,group_label,sort_order,source_sheet,body,revision,updated_at').eq('edition_id',editionId).eq('slug',sourceSlug).maybeSingle();
  if(r.error)throw new Error('資料本文を読み込めなかった');if(!r.data)return null;
  const stored=r.data.body as {storagePath?:string;sha256?:string};
  if(stored.storagePath){
    const f=await createAdminClient().storage.from(DD_REPORT_BUCKET).download(stored.storagePath);if(f.error)throw new Error('資料本文を読み込めなかった');
    const bytes=Buffer.from(await f.data.arrayBuffer());if(createHash('sha256').update(bytes).digest('hex')!==stored.sha256)throw new Error('資料本文の版が一致しない');
    r.data.body=JSON.parse(gunzipSync(bytes).toString());
  }
  return splitDdDevelopmentChapter(r.data as DdReportChapter,slug);
}
export async function storeDdReportBody(edition:DdReportEdition,chapter:DdReportChapter):Promise<Record<string,unknown>> {
  const path=edition.model_storage_path.replace(/\/[^/]+$/,'')+`/edited/${chapter.id}-${crypto.randomUUID()}.json.gz`;
  const bytes=gzipSync(JSON.stringify(chapter.body));const r=await createAdminClient().storage.from(DD_REPORT_BUCKET).upload(path,bytes,{contentType:'application/gzip',upsert:false});if(r.error)throw new Error('資料本文を保存できなかった');
  const check=await createAdminClient().storage.from(DD_REPORT_BUCKET).download(path);if(check.error||createHash('sha256').update(Buffer.from(await check.data.arrayBuffer())).digest('hex')!==createHash('sha256').update(bytes).digest('hex'))throw new Error('保存した本文を確認できなかった');
  return {version:1,storagePath:path,sha256:createHash('sha256').update(bytes).digest('hex'),rowCount:chapter.body.rows.length,objectCount:chapter.body.objects.length};
}
const modelCache=new Map<string,Promise<DdReportModel>>();
export async function loadDdReportModel(edition:DdReportEdition):Promise<DdReportModel> {
  const key=edition.source_sha256+':'+edition.model_storage_path;
  const old=modelCache.get(key);if(old)return old;
  if(modelCache.size>=2)modelCache.clear();
  const loading=(async()=>{const r=await createAdminClient().storage.from(DD_REPORT_BUCKET).download(edition.model_storage_path);if(r.error)throw new Error('数値モデルを読み込めなかった');const model=JSON.parse(gunzipSync(Buffer.from(await r.data.arrayBuffer())).toString()) as DdReportModel;if(model.version!==1||model.sourceSha256!==edition.source_sha256)throw new Error('数値モデルの版が一致しない');const complete=completeDdReportInputs(model);model.inputs=complete.inputs;const calc=new DdReportCalculator(model);model.inputs=model.inputs.filter(i=>!calc.isDataTableCell(i.sheet,i.address));return model;})();
  modelCache.set(key,loading);loading.catch(()=>modelCache.delete(key));return loading;
}
export async function ddReportAsset(editionId:string,key:string):Promise<{meta:DdReportAsset;bytes:Buffer}|null> {
  const r=await createAdminClient().from('dd_report_assets').select('*').eq('edition_id',editionId).eq('asset_key',key).maybeSingle();if(r.error)throw new Error('図版を読み込めなかった');if(!r.data)return null;
  const meta=r.data as DdReportAsset;const file=await createAdminClient().storage.from(DD_REPORT_BUCKET).download(meta.storage_path);if(file.error)throw new Error('図版を読み込めなかった');const bytes=Buffer.from(await file.data.arrayBuffer());if(createHash('sha256').update(bytes).digest('hex')!==meta.sha256)throw new Error('図版の内容を確認できない');return {meta,bytes};
}
export async function loadDdLegacySnapshot(edition:DdReportEdition):Promise<{pages:Record<string,unknown>}|null> {
  if(!edition.legacy_snapshot_path)return null;
  const r=await createAdminClient().storage.from(DD_REPORT_BUCKET).download(edition.legacy_snapshot_path);if(r.error)throw new Error('旧DDの控えを読み込めなかった');return JSON.parse(await r.data.text());
}
export function updateDdReportBody(body:DdReportBody,sheet:string,calc:DdReportCalculator):DdReportBody {
  return {...body,...(sheet==='資本政策表'?{jkiss:ddJkissSummary(calc)}:{}),rows:body.rows.map(row=>({...row,cells:row.cells.map(cell=>cell.formula||Object.hasOwn(calc.overrides,`${sheet}!${cell.address}`)||calc.isDataTableCell(sheet,cell.address)?{...cell,value:calc.get(sheet,cell.address)}:cell)})),objects:body.objects.map(object=>{
    if(object.kind!=='chart')return object;
    return {...object,series:object.series.map(series=>{
      const ref=/^'?([^'!]+)'?!\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/.exec(series.formula||'');if(!ref)return series;
      const a=ddAddress(ref[2]+ref[3]),b=ddAddress(ref[4]+ref[5]);const values:number[]=[];
      for(let r=a.row;r<=b.row;r++)for(let c=a.col;c<=b.col;c++)values.push(Number(calc.get(ref[1],ddColumn(c)+r))||0);return {...series,values};
    })};
  })};
}
export async function evaluatedDdReportChapter(edition:DdReportEdition,chapter:DdReportChapter,overrides:Record<string,DdReportValue>=edition.input_overrides) {
  const model=await loadDdReportModel(edition),calc=new DdReportCalculator(model,overrides);
  return {...chapter,body:updateDdReportBody(chapter.body,chapter.source_sheet,calc)};
}
export async function redactDdReport<T>(projectId:string,value:T):Promise<T> {
  return redactProjectPartnerNames(value,await loadProjectPartnerDisclosure(createAdminClient(),projectId));
}
