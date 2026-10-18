import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {createClient} from '@supabase/supabase-js';
const folder=process.argv[2],apply=process.argv.includes('--apply');
if(!folder)throw new Error('Import folder required');
for(const line of (await fs.readFile('.env.local','utf8')).split(/\r?\n/)){const m=/^([A-Z_][A-Z_0-9]*)=(.*)$/.exec(line);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');}
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
const manifest=JSON.parse(await fs.readFile(path.join(folder,'manifest.json'),'utf8'));
const modelBytes=await fs.readFile(path.join(folder,'model.json.gz'));
const pkg=await db.from('dd_packages').select('id,project_id,slug,title,status,notice_text,updated_at').eq('slug','sol').single();
if(pkg.error||!pkg.data)throw new Error('DD package not found');
const projectId=pkg.data.project_id;
const prior=await db.from('dd_report_editions').select('*').eq('package_id',pkg.data.id).eq('source_sha256',manifest.sourceSha256).maybeSingle();
if(prior.error)throw prior.error;
if(prior.data?.revision>1)throw new Error('Edited edition exists; import cannot overwrite it');
const prefix=`${pkg.data.id}/${manifest.sourceSha256}/${manifest.importRevision||'initial'}`;
const legacyPath=prior.data?.legacy_snapshot_path||`${prefix}/legacy-snapshot.json`;
const paths={model_storage_path:`${prefix}/model-${createHash('sha256').update(modelBytes).digest('hex').slice(0,16)}.json.gz`,xlsx_storage_path:`${prefix}/source.xlsx`,legacy_snapshot_path:legacyPath};
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const before={package:pkg.data,items:[],grants:[],pages:{},pageErrors:[]};
const items=await db.from('dd_package_items').select('*').eq('package_id',pkg.data.id);
const grants=await db.from('dd_package_grants').select('id,package_id,user_account_id,status,capabilities,expires_at').eq('package_id',pkg.data.id);
if(items.error||grants.error)throw new Error('Legacy state read failed');
Object.assign(before,{items:items.data,grants:grants.data});
const backupFile=path.join(folder,'旧DDパッケ_変更前.json');
const saved=await fs.readFile(backupFile,'utf8').then(JSON.parse).catch(()=>null);
if(saved&&saved.package.id===pkg.data.id&&!saved.pageErrors.length&&JSON.stringify(saved.items)===JSON.stringify(items.data)&&JSON.stringify(saved.grants)===JSON.stringify(grants.data))before.pages=saved.pages;
else {
  const {DD_PAGE_KEYS}=await import('../src/lib/dd-pages.ts');
  const {loadDdProjectPage}=await import('../src/lib/dd-project-pages-server.ts');
  for(const page of DD_PAGE_KEYS.filter(p=>p!=='documents')) {
    try{(before.pages as Record<string,unknown>)[page]=await loadDdProjectPage(projectId,page,true);}
    catch(error){(before.pageErrors as {page:string;error:string}[]).push({page,error:error instanceof Error?error.message:String(error)});}
  }
}
await fs.writeFile(path.join(folder,'旧DDパッケ_変更前.json'),JSON.stringify(before,null,2));
if(before.pageErrors.length)throw new Error('Legacy read errors: '+JSON.stringify(before.pageErrors));
if(!apply){console.log(JSON.stringify({dryRun:true,chapters:manifest.chapters.length,assets:manifest.assets.length,legacyPages:Object.keys(before.pages).length,counts:manifest.counts}));process.exit(0);}
async function upload(storagePath:string,bytes:Uint8Array,mime:string) {
  const result=await db.storage.from('dd-report-files').upload(storagePath,bytes,{contentType:mime,upsert:false});
  if(result.error&&!/already exists|Duplicate/i.test(result.error.message))throw result.error;
  const check=await db.storage.from('dd-report-files').download(storagePath);if(check.error)throw check.error;
  if(hash(new Uint8Array(await check.data.arrayBuffer()))!==hash(bytes))throw new Error('Storage hash mismatch: '+storagePath);
}
await upload(paths.model_storage_path,modelBytes,'application/gzip');
await upload(paths.xlsx_storage_path,await fs.readFile(path.join(folder,'source.xlsx')),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
const legacyBytes=await fs.readFile(path.join(folder,'旧DDパッケ_変更前.json'));
// The first archived state is immutable across import retries.
const existingLegacy=await db.storage.from('dd-report-files').download(legacyPath);
if(existingLegacy.error)await upload(legacyPath,legacyBytes,'application/json');
const edition=prior.data??(await db.from('dd_report_editions').insert({package_id:pkg.data.id,title:manifest.title,source_version:manifest.sourceVersion,source_sha256:manifest.sourceSha256,status:'draft',summary:manifest.counts,...paths}).select('*').single()).data;
if(!edition)throw new Error('Edition insert failed');
if(prior.data){const update=await db.from('dd_report_editions').update({...paths,summary:manifest.counts}).eq('id',edition.id).eq('revision',1);if(update.error)throw update.error;}
for(const chapter of manifest.chapters){
  const bytes=gzipSync(JSON.stringify(chapter.body)),storagePath=`${prefix}/chapters/${chapter.slug}-${hash(bytes).slice(0,16)}.json.gz`;
  await upload(storagePath,bytes,'application/gzip');
  const body={version:1,storagePath,sha256:hash(bytes),rowCount:chapter.body.rows.length,objectCount:chapter.body.objects.length};
  const result=await db.from('dd_report_chapters').upsert({...chapter,body,edition_id:edition.id},{onConflict:'edition_id,slug'});if(result.error)throw new Error(chapter.slug+': '+result.error.message);
}
for(const asset of manifest.assets){const storagePath=`${prefix}/assets/${asset.key}`;const bytes=await fs.readFile(path.join(folder,'assets',asset.key));await upload(storagePath,bytes,asset.mime);const result=await db.from('dd_report_assets').upsert({edition_id:edition.id,asset_key:asset.key,storage_path:storagePath,mime_type:asset.mime,sha256:asset.sha256,size_bytes:asset.bytes},{onConflict:'edition_id,asset_key'});if(result.error)throw result.error;}
const count=await db.from('dd_report_chapters').select('slug',{count:'exact'}).eq('edition_id',edition.id);if(count.error||count.count!==38)throw new Error('Chapter readback mismatch');
const afterPackage=await db.from('dd_packages').select('id,project_id,slug,title,status,notice_text,updated_at').eq('id',pkg.data.id).single();
const afterGrants=await db.from('dd_package_grants').select('id,package_id,user_account_id,status,capabilities,expires_at').eq('package_id',pkg.data.id);
if(JSON.stringify(afterPackage.data)!==JSON.stringify(pkg.data)||JSON.stringify(afterGrants.data)!==JSON.stringify(grants.data))throw new Error('Existing access state changed during import');
await fs.writeFile(path.join(folder,'import-receipt.json'),JSON.stringify({editionId:edition.id,packageId:pkg.data.id,sourceSha256:manifest.sourceSha256,status:'draft',counts:manifest.counts,legacyPages:Object.keys(before.pages).length,existingAccessPreserved:true,paths},null,2));
console.log(JSON.stringify({editionId:edition.id,status:'draft',chapters:count.count,legacyPages:Object.keys(before.pages).length,existingAccessPreserved:true}));
