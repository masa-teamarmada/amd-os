import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {DdReportContent} from '../src/components/dd/report/DdReportContent.tsx';
import {ddFundingRounds} from '../src/components/dd/report/DdCapitalFundingFigure.tsx';
import {updateDdFundingChartXml} from '../src/lib/dd-report-funding-chart.ts';
import {DdReportCalculator} from '../src/lib/dd-report-model.ts';
import type {DdReportChapter,DdReportRow,DdReportModel} from '../src/lib/dd-report-types.ts';
const row=(n:number,items:[number,string|number,number?][],detail=false):DdReportRow=>({row:n,calculationDetail:detail,cells:items.map(([column,value,span=1])=>({address:String.fromCharCode(64+column)+n,column,span,value,format:'General',heading:false,formula:false}))});
const months=(n:number)=>Array.from({length:n},(_,i)=>[i+5,i+1] as [number,number]);
const rows=[row(126,months(24)),row(139,[[2,'資料一覧へ戻る']]),row(140,[[2,'長期の販売・供給・人員・投資計画｜月次収支の計算明細'],[3,'長期の販売・供給・人員・投資計画']]),row(142,[[2,'2027年4月〜2037年3月の120か月。導入台数と費用条件から計算する。']]),row(145,[[3,'月次／金額：円'],...months(24)]),row(147,[[3,'新規 金属 1m³/日 台'],...months(24)]),row(148,[[3,'新規 金属 10m³/日 台'],...months(24)]),row(234,[[2,'年度別の損益・現金 単位：百万円']]),row(235,[[3,'項目'],[5,'2027年度'],[6,'2028年度']]),row(236,[[3,'売上高'],[5,10],[6,30]]),row(400,[[3,'４工程の原価・設備・回収を月次計画へ反映',17]],true),row(402,[[3,'月次数量と必要設備から費用を計算する。',17]],true),row(404,[[3,'月次／円',2],...months(24)],true),row(405,[[3,'金属の処理量',2],...months(24)],true)];
const chapter={id:'test',group_label:'資金',sort_order:1,revision:1,updated_at:'2026-10-19',slug:'financial-plan',source_sheet:'損益・資金繰',title:'資金繰表',body:{version:1,rows,objects:[],excel:{mode:'model',order:1}}} as DdReportChapter;
const html=renderToStaticMarkup(createElement(DdReportContent,{chapter,slug:'sample',index:[]}));
const tables=[...html.matchAll(/<table>[\s\S]*?<\/table>/g)].map(x=>x[0]);
const monthly=tables.find(t=>t.includes('cell-C147'))!;
assert(monthly,'Monthly grid is rendered');assert(!monthly.includes('cell-B139')&&!monthly.includes('cell-B140')&&!monthly.includes('cell-B142'),'Worksheet metadata must not add a blank label column');
assert.match(monthly,/<tr[^>]*data-source-row="147"[^>]*><td[^>]*><span id="cell-C147">/,'The first cell is the row label, not a synthesized blank');
assert(monthly.includes('cell-C145'),'Month header stays with monthly values');assert(!monthly.includes('cell-C235'),'Annual grid is separate');
const details=tables.find(t=>t.includes('cell-C405'))!;assert(details&&!details.includes('cell-C400')&&!details.includes('cell-C402'),'Calculation-detail titles and explanations are outside the grid');
for(const r of rows)for(const c of r.cells)assert.equal(html.split(`id="cell-${c.address}"`).length-1,1,`Preserve source cell once: ${c.address}`);
const pdf=renderToStaticMarkup(createElement(DdReportContent,{chapter,slug:'sample',index:[],allRows:true,pdfWorkbookName:'sample.xlsx'}));assert(!pdf.includes('<table>'));assert(pdf.includes('sample.xlsx'));
const capitalRows=[row(97,[[3,2]]),...['I','L','O','R','U'].flatMap((c,i)=>[{row:29,cells:[{address:c+'29',value:[12,27.5,86.25,270,900][i]}]},{row:30,cells:[{address:c+'30',value:[15,34.5,101.25,300,1000][i]}]},row(98+i,[[3,[3,7,15,30,100][i]]])])];
const capital={...chapter,slug:'capital-plan',body:{...chapter.body,rows:capitalRows}} as DdReportChapter;
const rounds=ddFundingRounds(capital);assert.equal(rounds.length,6);assert.equal(rounds[0].pre,null);for(const r of rounds.slice(1))assert.equal(r.pre!+r.funding,r.post);
const minimal='<c:chartSpace xmlns:c="c" xmlns:a="a"><a:t>ラウンド別の調達計画（億円）</a:t><c:barChart><c:grouping val="clustered"/><c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>新規調達額</c:v></c:tx><c:spPr></c:spPr><c:cat></c:cat><c:val></c:val></c:ser><c:overlap val="0"/></c:barChart></c:chartSpace>';
const calc=new DdReportCalculator({sheets:{'資本政策表':{cells:{Z333:{v:12,f:null},C98:{v:3,f:null}}}}} as unknown as DdReportModel);
const xml=updateDdFundingChartXml(minimal,calc);assert(xml.includes('val="stacked"'));assert.equal((xml.match(/<c:ser>/g)||[]).length,2);assert(xml.includes('$Z$333:$Z$337'));assert(xml.includes('$C$98:$C$102'));
const flowChapter={...chapter,slug:'effluent-business',body:{...chapter.body,excel:{mode:'pdf',order:1},rows:[row(14,[[2,'調査'],[5,'試験'],[8,'導入'],[11,'供給']]),row(15,[[4,'→'],[7,'→'],[10,'→']])]}} as DdReportChapter;
const flowHtml=renderToStaticMarkup(createElement(DdReportContent,{chapter:flowChapter,slug:'sample',index:[]}));assert(flowHtml.includes('ddr-source-flow'));assert(!flowHtml.includes('<table>'));
const ganttChapter={...chapter,slug:'metal-business',body:{...chapter.body,rows:[row(110,[[2,'工程'],[5,'1〜3月'],[7,'4〜6月'],[9,'7〜9月']]),row(111,[[2,'試験'],[5,'実施'],[7,'実施']]),row(112,[[2,'評価'],[9,'実施']])]}} as DdReportChapter;
const ganttHtml=renderToStaticMarkup(createElement(DdReportContent,{chapter:ganttChapter,slug:'sample',index:[]}));assert(ganttHtml.includes('ddr-gantt-bar'));for(const r of ganttChapter.body.rows)for(const c of r.cells)assert.equal(ganttHtml.split(`id="cell-${c.address}"`).length-1,1);
const longChapter={...chapter,slug:'cyanobacteria-cost',body:{...chapter.body,rows:Array.from({length:40},(_,i)=>row(i+10,[[2,'費目'+i],[5,i]]))}};
assert(!renderToStaticMarkup(createElement(DdReportContent,{chapter:longChapter,slug:'sample',index:[]})).includes('<details'));
console.log('PASS: metadata outside numerical grids, first-column labels, separate annual tables, all cells exactly once, PDF-to-Excel contract, formula-linked funding stack');

if(process.argv[2]){
  const fs=await import('node:fs/promises'),path=await import('node:path');
  const {DD_REPORT_CSS}=await import('../src/components/dd/report/dd-report-style.ts');
  const manifest=JSON.parse(await fs.readFile(process.argv[2],'utf8')),out=process.argv[3];await fs.mkdir(out,{recursive:true});
  for(const c of manifest.chapters){

    if(process.argv[4]){const {gunzipSync}=await import('node:zlib');const {updateDdReportBody}=await import('../src/lib/dd-report-server.ts');const model=JSON.parse(gunzipSync(await fs.readFile(process.argv[4])).toString());c.body=updateDdReportBody(c.body,c.source_sheet,new DdReportCalculator(model));}
    const markup=renderToStaticMarkup(createElement(DdReportContent,{chapter:c,slug:'sol',index:manifest.chapters}));
    await fs.writeFile(path.join(out,c.slug+'.html'),`<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>body{font-family:Arial,'Hiragino Kaku Gothic ProN',sans-serif;padding:20px} ${DD_REPORT_CSS}</style></head><body><main class="ddr"><h1>${c.title}</h1>${markup}</main></body></html>`);
    assert(!markup.includes('<details'),'No collapsed publication content: '+c.slug);
    if(c.slug==='unit-economics'){assert(markup.includes('ddr-ue-process'));assert(markup.includes('UE（ユニットエコノミクス）は'));}
    if(c.slug==='biographies'){assert(!markup.includes('上段は提供略歴'));assert(markup.includes('ddr-bio-medal'));}
    if(['financial-plan','cyanobacteria-cost','reactor-cost','metal-cost','fame-cost','production-plan'].includes(c.slug)){
      for(const r of c.body.rows.filter((r:DdReportRow)=>r.row>2))for(const cell of r.cells)assert.equal(markup.split(`id="cell-${cell.address}"`).length-1,1,c.slug+'!'+cell.address);
    }
    if(c.slug==='cyanobacteria-cost'&&process.argv[4]){const {gunzipSync}=await import('node:zlib');const model=JSON.parse(gunzipSync(await fs.readFile(process.argv[4])).toString());const controls=model.inputs.filter((i:any)=>i.sheet===c.source_sheet);const interactive=renderToStaticMarkup(createElement(DdReportContent,{chapter:c,slug:'sol',index:manifest.chapters,inputControls:{inputs:controls,sheet:c.source_sheet,values:{},disabled:false,change:()=>{}}}));assert((interactive.match(/<select/g)||[]).length>=6);assert((interactive.match(/<input/g)||[]).length>=100);assert(!interactive.includes('<details'));}
    if(c.slug==='capital-plan'&&process.argv[4]){assert(markup.includes('2.00億円'));assert(markup.includes('20.83%'));assert(markup.includes('16.66%'));assert(markup.includes('12.50億円'));assert(markup.includes('12.49858335億円'));}
    if(c.slug==='financial-plan'){
      const t=[...markup.matchAll(/<table>[\s\S]*?<\/table>/g)].find(x=>x[0].includes('cell-C147'))?.[0];
      assert(t&&!t.includes('cell-B139')&&!t.includes('cell-B140')&&!t.includes('cell-B142'));
      assert.match(t,/<tr[^>]*data-source-row="147"[^>]*><td[^>]*><span id="cell-C147">/);
      for(const r of c.body.rows.filter((r:DdReportRow)=>r.row>2))for(const cell of r.cells)assert.equal(markup.split(`id="cell-${cell.address}"`).length-1,1,cell.address);
    }
  }
  console.log('PASS: actual financial data preserved exactly once; rendered chapter fixtures: '+out);
}
