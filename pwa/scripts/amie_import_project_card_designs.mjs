import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {WORKSPACE_DOCUMENTS_BUCKET} from '../src/lib/workspace-documents-core.ts';
import {createClient} from '@supabase/supabase-js';
process.loadEnvFile('.env.local');
const rows=JSON.parse(await readFile(new URL('./data/amie-card-initial-import.json',import.meta.url),'utf8'));
const apply=process.argv.includes('--apply');
const root=resolve(process.argv.includes('--workspace-root')?process.argv[process.argv.indexOf('--workspace-root')+1]:resolve(import.meta.dirname,'../../..'));
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
for(const row of rows){
 const assets=[];
 for(const original of row.assets){
  const {local_file,...a}=original;
  if(local_file){
   const bytes=await readFile(resolve(root,local_file));if(bytes.length!==a.byte_size)throw Error(`Drive readback size mismatch: ${a.file_name}`);
   a.sha256=createHash('sha256').update(bytes).digest('hex');a.storage_bucket=WORKSPACE_DOCUMENTS_BUCKET;a.storage_path=`project/${a.project_id}/card-designs/${row.request_key}/${a.role}/${a.sha256}.pdf`;
   if(apply){const existing=await db.storage.from(a.storage_bucket).download(a.storage_path);if(existing.error){const u=await db.storage.from(a.storage_bucket).upload(a.storage_path,bytes,{upsert:false,contentType:a.mime_type});if(u.error)throw Error('snapshot upload failed: '+u.error.message);}
    const check=await db.storage.from(a.storage_bucket).download(a.storage_path);if(check.error||createHash('sha256').update(Buffer.from(await check.data.arrayBuffer())).digest('hex')!==a.sha256)throw Error('snapshot readback failed');}
  }
  assets.push(a);
 }
 if(apply){const {data,error}=await db.rpc('amie_save_card_version',{p:{...row,assets}});if(error)throw Error(error.message);console.log(JSON.stringify({brand:row.brand_label,...data}));}
 else console.log(JSON.stringify({brand:row.brand_label,assets:assets.length,pdf_snapshots:assets.filter(a=>a.storage_path).length,mode:'dry-run'}));
}
