import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {unzipSync,strFromU8} from 'fflate';
import {XMLValidator} from 'fast-xml-parser';
import {ddReportHtml,ddReportPdf,ddReportXlsx} from '../src/lib/dd-report-export.tsx';
import {readDdPdfIndex} from '../src/lib/dd-report-pdf.ts';
import {ddReportFilename} from '../src/lib/dd-report-navigation.ts';
import {ddEscapeHtml} from '../src/lib/dd-confidentiality.ts';
import {DdReportCalculator} from '../src/lib/dd-report-model.ts';
import type {DdReportEdition,DdReportModel,DdReportChapter} from '../src/lib/dd-report-types.ts';
const folder=process.argv[2];if(!folder)throw new Error('Import folder required');
const manifestPath=process.argv.find(a=>a.startsWith('--manifest='))?.slice('--manifest='.length)??path.join(folder,process.argv.includes('--current')?'manifest.qa.json':'manifest.json');
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const model=JSON.parse(gunzipSync(await fs.readFile(path.join(folder,process.argv.includes('--current')?'model.qa.json.gz':'model.json.gz'))).toString()) as DdReportModel;
const {updateDdReportBody}=await import('../src/lib/dd-report-server.ts');
const chapters=manifest.chapters.map((c:DdReportChapter)=>({...c,body:updateDdReportBody(c.body,c.source_sheet,new DdReportCalculator(model)),id:c.slug,revision:1,updated_at:new Date().toISOString()})) as DdReportChapter[];
const edition={title:manifest.title,source_version:manifest.sourceVersion,source_sha256:manifest.sourceSha256,revision:manifest.revision??1,input_overrides:{},glossary:manifest.glossary} as DdReportEdition;
const projected=chapters.some(c=>c.body.excel), kept=chapters.filter(c=>c.slug==='source-index'||c.body.excel?.mode!=='pdf');
const out=process.argv.find(a=>a.startsWith('--output='))?.slice('--output='.length)??path.join(folder,'画面・出力検証');await fs.mkdir(out,{recursive:true});
const assetUrls:Record<string,string>={};for(const a of manifest.assets)assetUrls[a.key]=`data:${a.mime};base64,${(await fs.readFile(path.join(folder,'assets',a.key)).catch(()=>fs.readFile(path.join(path.dirname(manifestPath),'assets',a.key)))).toString('base64')}`;
for(const slug of ['business-plan','equity-story','organization','production-plan','market','financial-plan']){
  const html=await ddReportHtml({edition,chapters:chapters.filter(c=>c.slug===slug),index:chapters,slug:'sol',assetUrls});if(!projected||chapters.find(c=>c.slug===slug)?.body.excel?.mode!=='pdf'){assert(!html.split('<h1>専門用語の説明')[0].includes('<table'), 'Model tables belong in Excel: '+slug);assert(html.includes('同梱Excel')&&html.includes(encodeURI('_DD_数値計画・一覧表_r')), 'PDF must name and link to companion Excel');}if(slug==='financial-plan'){const visible=html.replace(/<!--[^]*?-->/g,'');assert(visible.includes('同梱Excelの「資金繰表」'));assert(!visible.includes('同梱Excelの「損益・資金繰」'));}await fs.writeFile(path.join(out,slug+'.html'),html);
}
const bytes=ddReportXlsx(await fs.readFile(path.join(folder,'source.xlsx')),edition,model,chapters);await fs.writeFile(path.join(out,'SolvioraX_DD_r1.xlsx'),bytes);
const files=unzipSync(bytes);
for(const [name,content] of Object.entries(files))if(name.endsWith('.xml')||name.endsWith('.rels'))assert.equal(XMLValidator.validate(strFromU8(content)),true,'Valid OpenXML: '+name);
const original=unzipSync(await fs.readFile(path.join(folder,'source.xlsx')));
const funding=Object.values(files).map(b=>strFromU8(b)).find(s=>s.includes('ラウンド別の評価額・新規調達額（億円）'));assert(funding);assert(funding.includes('<c:grouping val="stacked"/>'));assert.equal((funding.match(/<c:ser>/g)||[]).length,2);assert(funding.includes('$Z$333:$Z$337')&&funding.includes('$C$98:$C$102'));console.log('PASS: exported funding chart stacks formula-linked pre valuation and funding');
if(projected){
  const workbook=strFromU8(files['xl/workbook.xml']),names=[...workbook.matchAll(/<sheet\b[^>]*name="([^"]+)"/g)].map(m=>m[1]);
  const {splitDdDevelopmentChapters}=await import('../src/lib/dd-report-development-plans.ts');
  const technical=splitDdDevelopmentChapters(chapters).find(c=>c.slug==='technical-development-plan')!;
  const technicalXml=Object.entries(files).filter(([p])=>/^xl\/worksheets\/sheet\d+\.xml$/.test(p)).map(([,b])=>strFromU8(b)).find(s=>(s.match(/<(?:[\w.-]+:)?c\b[^>]*r="B2"[^>]*>[\s\S]*?<\/(?:[\w.-]+:)?c>/)?.[0]??'').includes('>技術開発計画<'))!;
  assert(technicalXml,'Native technical plan sheet exists');
  const commercial=technical.body.rows.filter(r=>r.row>=340&&r.row<=361&&r.cells.length>1);assert.equal(commercial.length,12);
  for(const row of commercial)for(const cell of row.cells){assert(technicalXml.includes('r="'+cell.address+'"'),'Export added commercial cell '+cell.address);assert(technicalXml.includes(ddEscapeHtml(String(cell.value)).replaceAll('損益・資金繰','資金繰表')),'Export full commercial detail '+cell.address);}
  console.log('PASS: all 9 added commercial execution records / 36 header and detail cells appear in the native technical workbook');
  assert.equal(names.length,21);assert(names.includes('事業開発計画')&&names.includes('技術開発計画')&&!names.includes('計画詳細'));assert.equal(names[0],'資料一覧');assert(!names.includes('事業計画'));assert(!names.includes('経営陣略歴'));assert(!names.includes('SIER'));
  assert.deepEqual(names.slice(1,8),['資本政策表','資金繰表','UE','シアノ生産コスト','リアクター処理コスト','金属回収コスト','FAME生産コスト']);
  assert(!Object.keys(files).some(p=>p.startsWith('xl/media/')));
  assert(!strFromU8(files[model.sheets['生産・拠点計画'].path]).includes('最初の進出先はシンガポール'));
  assert(strFromU8(files[model.sheets['資料一覧'].path]).includes('数値計画・試算・一覧表'));
  let checked=0;const calc=new DdReportCalculator(model,edition.input_overrides);
  for(const chapter of kept.filter(c=>c.slug!=='source-index')){
    const data=model.sheets[chapter.source_sheet],xml=strFromU8(files[data.path]);
    const cells=new Map([...xml.matchAll(/<(?:[\w.-]+:)?c\b[^>]*?\br="([A-Z]+\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/(?:[\w.-]+:)?c>)/g)].map(m=>[m[1],m[0]]));
    const sourceCells=new Map([...strFromU8(original[data.path]).matchAll(/<(?:[\w.-]+:)?c\b[^>]*?\br="([A-Z]+\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/(?:[\w.-]+:)?c>)/g)].map(m=>[m[1],m[0]]));
    for(const [address,entry] of Object.entries(data.cells)){
      if(entry.f){assert(cells.has(address),chapter.source_sheet+'!'+address+' preserves formula');const f=/<(?:[\w.-]+:)?f\b[^>]*?(?:\/>|>[\s\S]*?<\/(?:[\w.-]+:)?f>)/;const originalFormula=sourceCells.get(address)?.match(f)?.[0]?.replaceAll('損益・資金繰','資金繰表');const scaled=chapter.source_sheet==='資本政策表'&&['B177','F177','N177','R177'].includes(address);assert.equal(cells.get(address)?.match(f)?.[0],scaled?originalFormula?.replace(/>([\s\S]*?)<\//,(_m,body)=>`>(${body})/100000000</`):originalFormula);}
      if(typeof entry.v==='number'){assert(cells.has(address),chapter.source_sheet+'!'+address+' preserves numerical cell');const actual=Number(cells.get(address)?.match(/<(?:[\w.-]+:)?v>([^<]+)<\/(?:[\w.-]+:)?v>/)?.[1]);assert.equal(actual,Number(calc.get(chapter.source_sheet,address))/(chapter.source_sheet==='資本政策表'&&['B177','F177','N177','R177'].includes(address)?1e8:1),chapter.source_sheet+'!'+address+' preserves value');checked++;}
      if(entry.input)assert(cells.has(address),'Preserve input '+chapter.source_sheet+'!'+address);
    }
  }
  assert(checked>120000);console.log('PASS: numeric workbook, 21 sheets, PDF chapters absent; preserved numerical cells',checked);
  assert.equal(Object.entries(files).filter(([p,b])=>p.endsWith('.xml')&&strFromU8(b.subarray(0,1500)).includes('<c:chartSpace')).length,30);
  for(const [path,content]of Object.entries(files))if(path.endsWith('.xml'))assert(!/\/\s+hidden="/.test(strFromU8(content)),path+' has valid empty rows');
}else{
  assert.equal(Object.entries(files).filter(([p,b])=>p.endsWith('.xml')&&strFromU8(b.subarray(0,1500)).includes('<c:chartSpace')).length,37);
}
assert.equal(Object.entries(files).filter(([p])=>p.startsWith('xl/worksheets/')&&p.endsWith('.xml')).reduce((n,[,b])=>n+(strFromU8(b).match(/t="dataTable"/g)||[]).length,0),9);
const focused=unzipSync(ddReportXlsx(await fs.readFile(path.join(folder,'source.xlsx')),edition,model,chapters,s=>s,'損益・資金繰'));
const workbook=strFromU8(focused['xl/workbook.xml']),sheetNames=[...workbook.matchAll(/<sheet\b[^>]*name="([^"]+)"/g)].map(m=>m[1]);
assert.equal(Number(workbook.match(/activeTab="(\d+)"/)?.[1]),sheetNames.indexOf('資金繰表'));
assert(strFromU8(focused[model.sheets['損益・資金繰'].path]).includes('xSplit="4" ySplit="7"'));
console.log('PASS: Excel native formulas / 9 data tables / focused financial freeze; bytes',bytes.length);
// Recalculate the base case independently of cached Excel values.
const force=new DdReportCalculator(model,{},true),checks=[['資本政策表','L206'],['資本政策表','V14'],['UE','E18'],['UE','E19'],['UE','E20'],['UE','E21'],['損益・資金繰','Q61'],['エクイティストーリー','AT340'],['エクイティストーリー','AT341'],['エクイティストーリー','AU340']] as const;
for(const [sheet,address]of checks){const expected=model.sheets[sheet].cells[address].v,actual=force.get(sheet,address);if(typeof expected==='number')assert(Math.abs(Number(actual)-expected)<=Math.max(1e-6,Math.abs(expected)*1e-9),`${sheet}!${address}: ${expected} != ${actual}`);else assert.equal(actual,expected);console.log('baseline',sheet,address,actual);}
console.log('PASS: independent formula/base-case comparison');
if(process.argv.includes('--pdf')){
  const {renderWorkspaceDocumentHtmlToPdf}=await import('../src/lib/workspace-document-html-pdf.ts');
  const html=await ddReportHtml({edition,chapters,index:chapters,slug:'sol',assetUrls});await fs.writeFile(path.join(out,'all.html'),html);
  const pdf=await ddReportPdf({edition,chapters,index:chapters,slug:'sol',assetUrls},chunk=>renderWorkspaceDocumentHtmlToPdf(chunk,{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox'],tagged:false,pageWidthPx:794,compactPagination:true}));await fs.writeFile(path.join(out,ddReportFilename(edition,'pdf')),pdf);console.log('PDF bytes',pdf.length);
  const pdfIndex=await readDdPdfIndex(pdf),linked=ddReportXlsx(await fs.readFile(path.join(folder,'source.xlsx')),edition,model,chapters,s=>s,undefined,undefined,pdfIndex);
  await fs.writeFile(path.join(out,ddReportFilename(edition,'xlsx')),linked);
  assert(strFromU8(unzipSync(linked)['xl/worksheets/_rels/sheet1.xml.rels']).includes('#page='),'Companion PDF links include actual page numbers');
  console.log('PASS: final workbook uses completed PDF page map');
}
