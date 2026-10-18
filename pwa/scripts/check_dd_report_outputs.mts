import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {unzipSync,strFromU8} from 'fflate';
import {ddReportHtml,ddReportPdf,ddReportXlsx} from '../src/lib/dd-report-export.tsx';
import {ddEscapeHtml} from '../src/lib/dd-confidentiality.ts';
import {DdReportCalculator} from '../src/lib/dd-report-model.ts';
import type {DdReportEdition,DdReportModel,DdReportChapter} from '../src/lib/dd-report-types.ts';
const folder=process.argv[2];if(!folder)throw new Error('Import folder required');
const manifest=JSON.parse(await fs.readFile(path.join(folder,process.argv.includes('--current')?'manifest.qa.json':'manifest.json'),'utf8'));
const model=JSON.parse(gunzipSync(await fs.readFile(path.join(folder,process.argv.includes('--current')?'model.qa.json.gz':'model.json.gz'))).toString()) as DdReportModel;
const chapters=manifest.chapters.map((c:DdReportChapter)=>({...c,id:c.slug,revision:1,updated_at:new Date().toISOString()})) as DdReportChapter[];
const edition={title:manifest.title,source_version:manifest.sourceVersion,source_sha256:manifest.sourceSha256,revision:manifest.revision??1,input_overrides:{},glossary:manifest.glossary} as DdReportEdition;
const out=path.join(folder,'画面・出力検証');await fs.mkdir(out,{recursive:true});
const assetUrls:Record<string,string>={};for(const a of manifest.assets)assetUrls[a.key]=`data:${a.mime};base64,${(await fs.readFile(path.join(folder,'assets',a.key))).toString('base64')}`;
for(const slug of ['business-plan','equity-story','organization','production-plan','market','financial-plan']){
  const html=await ddReportHtml({edition,chapters:chapters.filter(c=>c.slug===slug),index:chapters,slug:'sol',assetUrls});await fs.writeFile(path.join(out,slug+'.html'),html);
}
const bytes=ddReportXlsx(await fs.readFile(path.join(folder,'source.xlsx')),edition,model,chapters);await fs.writeFile(path.join(out,'SolvioraX_DD_r1.xlsx'),bytes);
const files=unzipSync(bytes);
const original=unzipSync(await fs.readFile(path.join(folder,'source.xlsx')));
for(const sheet of Object.values(model.sheets)){const sourceXml=strFromU8(original[sheet.path]).replace(/<c\b[^>]*?\br="([A-Z]+\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g,(cell,address:string)=>{const name=Object.keys(model.sheets).find(s=>model.sheets[s].path===sheet.path)!,patch=model.formulaPatches?.[name+'!'+address];return patch?cell.replace(/<f\b([^>]*?)>[\s\S]*?<\/f>/,(_f,attrs:string)=>`<f${attrs}>${ddEscapeHtml(patch)}</f>`):cell;}),resultXml=strFromU8(files[sheet.path]);assert.deepEqual([...resultXml.matchAll(/<c\b[^>]*?\br="([A-Z]+\d+)"/g)].map(m=>m[1]),[...sourceXml.matchAll(/<c\b[^>]*?\br="([A-Z]+\d+)"/g)].map(m=>m[1]),sheet.path+' preserves every cell');assert.deepEqual(resultXml.match(/<f\b[^>]*?(?:\/>|>[\s\S]*?<\/f>)/g),sourceXml.match(/<f\b[^>]*?(?:\/>|>[\s\S]*?<\/f>)/g),sheet.path+' preserves every native formula');}

assert.equal(Object.entries(files).filter(([p,b])=>p.endsWith('.xml')&&strFromU8(b.subarray(0,1500)).includes('<c:chartSpace')).length,37);
assert(!Object.keys(files).some(p=>p.startsWith('xl/media/')));
assert.equal(Object.entries(files).filter(([p])=>/^xl\/worksheets\/sheet\d+\.xml$/.test(p)).reduce((n,[,b])=>n+(strFromU8(b).match(/t="dataTable"/g)||[]).length,0),9);
assert.equal(Object.keys(model.sheets).length,38);
console.log('PASS: Excel 38 sheets / 37 native charts / 9 native data tables; bytes',bytes.length);
// Recalculate the base case independently of cached Excel values.
const force=new DdReportCalculator(model,{},true),checks=[['資本政策表','L206'],['資本政策表','V14'],['UE','E18'],['UE','E19'],['UE','E20'],['UE','E21'],['損益・資金繰','Q61'],['エクイティストーリー','AT340'],['エクイティストーリー','AT341'],['エクイティストーリー','AU340']] as const;
for(const [sheet,address]of checks){const expected=model.sheets[sheet].cells[address].v,actual=force.get(sheet,address);if(typeof expected==='number')assert(Math.abs(Number(actual)-expected)<=Math.max(1e-6,Math.abs(expected)*1e-9),`${sheet}!${address}: ${expected} != ${actual}`);else assert.equal(actual,expected);console.log('baseline',sheet,address,actual);}
console.log('PASS: independent formula/base-case comparison');
if(process.argv.includes('--pdf')){
  const {renderWorkspaceDocumentHtmlToPdf}=await import('../src/lib/workspace-document-html-pdf.ts');
  const html=await ddReportHtml({edition,chapters,index:chapters,slug:'sol',assetUrls});await fs.writeFile(path.join(out,'all.html'),html);
  const pdf=await ddReportPdf({edition,chapters,index:chapters,slug:'sol',assetUrls},chunk=>renderWorkspaceDocumentHtmlToPdf(chunk,{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox'],tagged:false,pageWidthPx:794,compactPagination:true}));await fs.writeFile(path.join(out,'SolvioraX_DD_r1.pdf'),pdf);console.log('PDF bytes',pdf.length);
}
