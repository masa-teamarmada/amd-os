// Render the real component, without a server or production credentials.
// --serve provides the same fixture for responsive visual verification.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const file = path.resolve(__dirname, '../src/components/monthly-agreement/MonthlyAgreementExperience.tsx');
const source = fs.readFileSync(file, 'utf8');
const mod = new Module(file, module);
mod.filename = file;
mod.paths = module.paths;
const originalRequire = mod.require.bind(mod);
mod.require = (id) => id === '@/components/ui/Hint' ? { Hint: () => null } : originalRequire(id);
mod._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { SeasonRewardTrend } = mod.exports;
const accrual = [119893,119893,120363,73347,74287,47958,0,0,0,0,0,0];
const pay = [0,0,87185,87378,87727,92200,79900,67200,49500,4600,0,51];
const yms = Array.from({length:12}, (_,i) => {const d=new Date(Date.UTC(2026,3+i,1));return `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}`;});
let stock = 0;
const project = { seasonStartYm: '202604', seasonEndYm: '202703', milestones: [{milestoneId:'test',title:'知財戦略策定',points:6,plannedShare:0.8,periodStartYm:'202604',targetYm:'202606'}], payoutSchedule: yms.map((ym,i)=>{
  const carryInYen=stock; stock+=accrual[i]-pay[i];
  const d=new Date(Date.UTC(Number(ym.slice(0,4)),Number(ym.slice(4,6))+2,1));
  return {sourceYm:ym,paymentYm:`${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}`,basePayYen:accrual[i],carryInYen,stockYen:stock,totalPayYen:pay[i],isActualPaid:false};
})};
const before = JSON.stringify(project);
const render = (p=project) => renderToStaticMarkup(React.createElement(SeasonRewardTrend,{project:p,ym:'202609'}));
const html = render();
for(const text of ['発生した報酬','¥119,893','¥120,363','前月から繰越','翌月へ繰越','¥239,786','振込予定月','26/9','27/6','¥51','¥0','照合前・予定','将来分は見込み']) assert.ok(html.includes(text),text);
assert.ok(html.includes('season-reward-accrualYen'));
assert.equal(project.payoutSchedule.reduce((s,x)=>s+x.basePayYen,0),555741);
assert.equal(project.payoutSchedule.reduce((s,x)=>s+x.totalPayYen,0),555741);
assert.equal(stock,0);
assert.equal(JSON.stringify(project),before,'Rendering must not mutate reward data');
assert.ok(render({...project,payoutSchedule:project.payoutSchedule.slice(1)}).includes('—'));
assert.ok(render({...project,payoutSchedule:[{...project.payoutSchedule[2],isActualPaid:true}]}).includes('bg-emerald-500'));
assert.equal(render({...project,seasonStartYm:null,seasonEndYm:null,payoutSchedule:[]}), '');
console.log('PASS season reward accrual / payout / carry / payment month / missing / paid / no mutation');
if(process.argv.includes('--serve')) (async()=>{
  const {compile}=require('@tailwindcss/node');
  const compiler=await compile('@import "tailwindcss";', {base:path.resolve(__dirname,'..'),onDependency:()=>{}});
  const css=compiler.build(source.match(/[^\s<>"'`{}]+/g)||[]);
  const document=`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>報酬表示・検証用</title><style>${css}body{font-family:Arial,"Hiragino Sans",sans-serif;padding:16px}main{max-width:1280px;margin:auto}</style><main><p>検証用データ・本番の支払情報は変更しません</p>${html}</main></html>`;
  require('node:http').createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(document)}).listen(4319,'127.0.0.1',()=>console.log('Fixture http://127.0.0.1:4319'));
})();
