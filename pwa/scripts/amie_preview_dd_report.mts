import fs from 'node:fs/promises';
import path from 'node:path';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {DdReportContent} from '../src/components/dd/report/DdReportContent.tsx';
import {DD_REPORT_CSS} from '../src/components/dd/report/dd-report-style.ts';
const folder=process.argv[2],manifest=JSON.parse(await fs.readFile(path.join(folder,'manifest.json'),'utf8'));
if(process.argv.includes('--current')){
 for(const line of (await fs.readFile('.env.local','utf8')).split(/\r?\n/)){const m=/^([A-Z_][A-Z_0-9]*)=(.*)$/.exec(line);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');}
 const {createClient}=await import('@supabase/supabase-js'),{gunzipSync}=await import('node:zlib');
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
 const e=await db.from('dd_report_editions').select('id,revision,glossary,model_storage_path').eq('source_sha256',manifest.sourceSha256).single();if(e.error)throw e.error;
 const chapters=await db.from('dd_report_chapters').select('*').eq('edition_id',e.data.id).order('sort_order');if(chapters.error)throw chapters.error;
 manifest.chapters=await Promise.all(chapters.data.map(async c=>{const r=await db.storage.from('dd-report-files').download(c.body.storagePath);if(r.error)throw r.error;return {...c,body:JSON.parse(gunzipSync(Buffer.from(await r.data.arrayBuffer())).toString())};}));
 const model=await db.storage.from('dd-report-files').download(e.data.model_storage_path);if(model.error)throw model.error;await fs.writeFile(path.join(folder,'model.qa.json.gz'),Buffer.from(await model.data.arrayBuffer()));
 manifest.revision=e.data.revision;manifest.glossary=e.data.glossary;await fs.writeFile(path.join(folder,'manifest.qa.json'),JSON.stringify(manifest));
}
const out=path.join(folder,'画面・出力検証'),assetUrls:Record<string,string>={};
for(const a of manifest.assets)assetUrls[a.key]=`data:${a.mime};base64,${(await fs.readFile(path.join(folder,'assets',a.key))).toString('base64')}`;
for(const chapter of manifest.chapters){
  const content=renderToStaticMarkup(h(DdReportContent,{chapter,index:manifest.chapters,slug:'sol',assetUrls,glossary:manifest.glossary}));
  const nav=manifest.chapters.map((c:{slug:string;title:string})=>`<a href="preview-${c.slug}.html" ${c.slug===chapter.slug?'aria-current="page"':''}>${c.title}</a>`).join('');
  const html=`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${DD_REPORT_CSS}body{margin:0;font-family:system-ui,sans-serif;padding:24px}.preview{max-width:1440px;margin:auto;display:grid;grid-template-columns:184px minmax(0,1fr);gap:16px}.preview-nav{position:sticky;top:24px;max-height:90vh;overflow:auto}.ddr-header{padding-top:16px}@media(max-width:700px){body{padding:16px}.preview{display:block}.preview-nav{display:none}}</style><div class="preview"><aside class="ddr ddr-nav preview-nav">${nav}</aside><main class="ddr"><header class="ddr-header"><div class="ddr-kicker">SOLVIORAX · ${chapter.group_label}</div><h1>${chapter.title}</h1><div class="ddr-version">SolvioraX · 資料版1 · 全38資料</div></header>${content}</main></div></html>`;
  await fs.writeFile(path.join(out,'preview-'+chapter.slug+'.html'),html);
}
console.log('38 chapter previews written');
