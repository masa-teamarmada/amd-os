import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PDFDocument} from 'pdf-lib';
import {ddEquityValuations} from '../src/lib/dd-report-valuations.ts';
import {DdReportContent} from '../src/components/dd/report/DdReportContent.tsx';
import {ddReportPdf} from '../src/lib/dd-report-export.tsx';
import type {DdReportChapter,DdReportCell} from '../src/lib/dd-report-types.ts';

const capital:Record<string,number>={C97:2,C98:3,C99:7,C100:15,C101:30,C102:100,I29:12,I30:15,L29:27.5,L30:34.5,O29:86.25,O30:101.25,R29:270,R30:300,U29:900,U30:1000};
const read=(sheet:string,address:string)=>sheet==='共通前提'&&address==='C16'?1e9:sheet==='資本政策表'?capital[address]:null;
const rounds=ddEquityValuations(read);
assert.equal(rounds[0].post,null,'J-KISS cap is not the seed post-money valuation');assert.equal(rounds[0].cap,10);assert.equal(rounds[1].previousPost,null);
assert.deepEqual(rounds.slice(2).map(r=>r.progress),[12.5,51.75,168.75,600]);
for(const r of rounds.slice(2))assert.equal(r.previousPost!+r.progress!+r.funding!,r.post);
capital.I29=20;capital.I30=23;assert.equal(ddEquityValuations(read)[2].progress,4.5,'Changing the preceding round updates the increment');
capital.L29=18;capital.L30=25;assert.equal(ddEquityValuations(read)[2].progress,-5,'A down round remains a negative increment');
Object.assign(capital,{I29:12,I30:15,L29:27.5,L30:34.5});
const cell=(address:string,value:string):DdReportCell=>({address,value,column:2,span:5,format:'General',formula:false,heading:false});
const cells=[cell('B9','2027年3月まで 大学研究・GAPファンド\n100L装置・実廃液20件・1t培養条件・顧客10社からシードの投資判断へ')];
for(const [i,[col,rows]]of [['B',[13,15,19,22,26]],['G',[13,15,19,22,26]],['L',[13,15,19,22,26]],['L',[32,34,38,41,45]],['G',[32,34,38,41,45]],['B',[32,34,38,41,45]]].entries()){
  const values=[rounds[i].name,'投資家へ示す成果\n既存の成果'+i,'調達条件'+i,'この資金で実現する成果\n既存の計画'+i,'次の評価額を支える理由\n既存の根拠'+i];
  for(const [j,row]of (rows as number[]).entries())cells.push(cell(String(col)+row,values[j]));
}
const chapter={id:'equity',slug:'equity-story',title:'エクイティストーリー',group_label:'成長',sort_order:1,source_sheet:'エクイティストーリー',revision:1,updated_at:'2026-10-19',body:{version:1,objects:[],equityValuations:rounds,rows:[{row:9,cells:[cells[0]]},{row:12,cells:[cell('B12','投資と成長の段階')]},...cells.slice(1).map(c=>({row:Number(c.address.replace(/\D/g,'')),cells:[c]}))]}} as DdReportChapter;
for(const allRows of [false,true]){
  const html=renderToStaticMarkup(createElement(DdReportContent,{chapter,slug:'sol',index:[],allRows}));
  assert(html.indexOf('GAPファンド</h3>')>=0&&html.indexOf('GAPファンド</h3>')<html.indexOf('id="cell-B13"'),'GAP card precedes the six financing cards');
  assert.equal((html.match(/data-phase="/g)||[]).length,6);assert.equal((html.match(/class="ddr-valuation-chart"/g)||[]).length,6);
  assert.equal((html.match(/<h4 class="ddr-phase-label">/g)||[]).length,24);
  for(const c of cells)assert.equal(html.split(`id="cell-${c.address}"`).length-1,1,`Keep one source anchor: ${c.address}`);
  for(let i=0;i<6;i++)for(const text of ['既存の成果','既存の計画','既存の根拠'])assert(html.includes(text+i));
}
const basic=(slug:string)=>({...chapter,id:slug,slug,source_sheet:slug,body:{version:1,rows:[],objects:[]}} as DdReportChapter);
const chapters=['source-index','business-plan','equity-story','capital-plan'].map(basic),layouts:unknown[]=[];
const bytes=await ddReportPdf({edition:{title:'テスト｜DD',revision:87,document_version:'2.0.2'} as any,chapters,index:chapters,slug:'sol',assetUrls:{},includeGlossary:false,deferNavigation:true},async(_html,layout)=>{
  layouts.push(layout??null);const pdf=await PDFDocument.create();pdf.addPage([layout?.pageWidthPx??794,layout?.pageHeightPx??1123]);return pdf.save();
});
assert.deepEqual(layouts,[null,{pageWidthPx:1588,pageHeightPx:1123},null]);
const output=await PDFDocument.load(bytes);assert.equal(output.getPageCount(),3);assert(output.getPage(1).getWidth()>output.getPage(1).getHeight());
const legacyRows=[{row:67,cells:[cell('B67','01 シード 初期3台と共通基盤')]},{row:70,cells:[cell('E70','重複するラウンド別の長文説明')]},{row:208,cells:[cell('B208','07 評価額を支える事業成果と投資家への説明')]},{row:210,cells:[cell('B210','重複する評価額の説明')]},{row:232,cells:[cell('B232','08 参考事例')]},{row:235,cells:[cell('B235','ちとせグループは73億円')]},{row:257,cells:[cell('B257','09 各ラウンドの計画数値と実行期間')]}];
for(const row of [78,98,118,138,158,178])legacyRows.push({row,cells:['B','F','I'].map(col=>cell(col+row,String(row)))});
const chart=(title:string)=>({kind:'chart',row:52,title,chartType:'barChart',horizontal:false,stacked:false,series:[{name:'売上高',categories:['FY2027','FY2028'],values:[1,2]}]}) as any;
chapter.body.rows.push(...legacyRows);chapter.body.objects.push(chart('目標評価額の成長（億円）'),chart('売上・営業損益の成長（億円）'));
const compactHtml=renderToStaticMarkup(createElement(DdReportContent,{chapter,slug:'sol',index:[]}));
assert(!compactHtml.includes('目標評価額の成長'));assert(!compactHtml.includes('重複する'));assert(!compactHtml.includes('07 評価額'));assert(!compactHtml.includes('ちとせグループは73億円'));assert(!compactHtml.includes('09 各ラウンド'));
assert(compactHtml.includes('総事業費 約580億円')&&compactHtml.includes('建設費単独')&&compactHtml.includes('調達総額 73億円'));
assert(compactHtml.includes('ddr-chart-compact')&&compactHtml.includes('viewBox="0 0 720 176"'));assert(compactHtml.includes('ddr-equity-resources'));assert(compactHtml.includes('収益倍率・希薄化・投資家収益率'));
for(const row of [78,98,118,138,158,178])for(const col of ['B','F','I'])assert.equal(compactHtml.split(`id="cell-${col+row}"`).length-1,1,'Keep unique budget and headcount values once');
console.log('PASS: GAP card / six horizontal stages / 24 section headings / preserved cells / model-linked valuation increments / J-KISS separation / landscape equity PDF');
