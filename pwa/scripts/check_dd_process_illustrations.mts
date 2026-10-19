import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {DdReportVisual} from '../src/components/dd/report/DdReportVisual.tsx';
import {DdUeProcess} from '../src/components/dd/report/DdSourceDiagrams.tsx';
const visual={kind:'flow' as const,afterRow:10,title:'金属回収の流れ',nodes:[
 {title:'回収',text:'金属を取り込んだ菌体を集める'},
 {title:'抽出・分離',text:'対象金属を取り出す'},
 {title:'精製・分析',text:'純度・不純物と販売可能量を確認'},
 {title:'再利用・販売',text:'顧客へ戻す、原料購入先へ出荷'},
]};
const html=renderToStaticMarkup(createElement(DdReportVisual,{visual,slug:'fixture'}));
assert.equal((html.match(/class="ddr-process-illustration"/g)||[]).length,4);
for(const n of visual.nodes)assert(html.includes(n.title)&&html.includes(n.text));
const fuel=renderToStaticMarkup(createElement(DdReportVisual,{visual:{...visual,title:'燃料の流れ',nodes:[{title:'回収',text:'脂肪酸を取り出す'}]},slug:'fixture'}));
assert(!fuel.includes('ddr-process-illustration'),'Do not insert a metal illustration in an unrelated recovery flow');
const rows=[{row:8,cells:[{address:'B8',column:2,span:1,value:'燃料専用シアノ',format:'General',formula:false,heading:false}]}];
const ue=renderToStaticMarkup(createElement(DdUeProcess,{rows,cell:c=>String(c.value)}));
assert(ue.includes('廃液処理・金属資源化')&&ue.includes('バイオ燃料')&&ue.includes('燃料専用シアノ'));
assert(!ue.includes('出荷待ち'));
console.log('PASS: four reusable metal-process drawings / unchanged labels / no unrelated illustration / dedicated fuel cultivation path');
