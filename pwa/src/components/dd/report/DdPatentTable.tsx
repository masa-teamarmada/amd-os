import {type ReactNode} from 'react';
import type {DdReportCell,DdReportRow,DdIpLandscape,DdIpMapAsset} from '../../../lib/dd-report-types';

const WIDTHS=[210,160,150,190,190,155,140,140,170,190,270,130,310,270];
const LABELS=['','極狭','狭い','中','広い','極広'];
type RecordRow={key:string;sourceRow?:number;asset?:DdIpMapAsset;values:ReactNode[]};

/** Preserve source coordinates while comparing university applications and nearby patent families. */
export function DdPatentTable({rows,summary,landscape,group='university',print=false,cell}:{rows:DdReportRow[];summary?:string;landscape?:DdIpLandscape;group?:'university'|'other';print?:boolean;cell:(value:DdReportCell)=>ReactNode}){
  const [heading,...sourceRecords]=rows;
  if(!heading)return null;
  const ownerIndex=heading.cells.findIndex(value=>value.value==='出願人');
  const order=heading.cells.map((_,i)=>i);
  if(ownerIndex>1){order.splice(ownerIndex,1);order.splice(1,0,ownerIndex);}
  const columns=order.map(i=>({key:String(i),label:i===12?'SOLでの用途・比較点':String(heading.cells[i].value),width:WIDTHS[i]}));
  columns.splice(2,0,{key:'importance',label:'重要度',width:100},{key:'relevance',label:'SOLの事業との関係',width:220},{key:'overlap',label:'重なる技術・工程',width:230},{key:'verify',label:'確認すべきこと',width:240},{key:'breadth',label:'権利範囲',width:100},{key:'reason',label:'評価理由',width:320});
  const records:RecordRow[]=group==='other'?[]:sourceRecords.map(row=>({key:'source-'+row.row,sourceRow:row.row,asset:landscape?.mapAssets.find(a=>a.number.replace(/\s/g,'')===String(row.cells[3].value).replace(/\s/g,'')),values:row.cells.map(value=>cell(value))}));
  if(landscape&&group==='other')for(const asset of landscape.mapAssets.filter(a=>a.relation==='watch').sort((a,b)=>(b.importance??0)-(a.importance??0)||a.id.localeCompare(b.id,undefined,{numeric:true}))){
    const entry=landscape.entries.find(e=>e.id===asset.entryId);if(!entry)continue;
    const publication=entry.publication;
    records.push({key:asset.id,asset,values:[
      entry.title,entry.shortTitle,`${publication?.country??asset.number.slice(0,2)}・${entry.publicationType}`,
      publication?.applicationNumber??'未照合',asset.number,publication?.priorityDate??'未照合',asset.applicationDate,
      publication?.publicationDate??entry.dates,entry.owner,publication?.inventors.join('\n')??'未照合',entry.rightsState,
      /B\d?$|C$/.test(asset.number)?asset.number:'—（公開公報）',entry.comparison,
      <span key="source"><a href={asset.breadthAssessment?.source.url??entry.sources[0].url} target={print?undefined:'_blank'} rel="noreferrer">公報・請求項 ↗</a><br/>確認：{landscape.asOf}</span>,
    ]});
  }
  const value=(record:RecordRow,key:string):ReactNode=>{
    const evaluation=record.asset?.breadthAssessment,business=record.asset?.businessAssessment;
    if(key==='importance')return record.asset?.importance!=null?<strong className="ddr-ip-importance" data-score={record.asset.importance}>{record.asset.importance} / 5 · {['','参考','低','中','高','中核'][record.asset.importance]}{business?.basis==='bibliography'&&<small>書誌情報で評価</small>}</strong>:<span>未評価</span>;
    if(key==='relevance'||key==='overlap'||key==='verify')return business?.[key]??'採用仕様との照合時に評価。';
    if(key==='breadth')return record.asset?.claimBreadth!=null?<strong className="ddr-ip-table-score">{record.asset.claimBreadth} / 5 · {LABELS[record.asset.claimBreadth]}</strong>:<span className="ddr-ip-table-unassessed">原本未取得</span>;
    if(key==='reason')return evaluation?.tableReason??evaluation?.reason??'請求項原本の取得後に評価。';
    return record.values[Number(key)];
  };
  const description=group==='other'?`他者${records.length}系列の代表公報`:`愛媛大学${sourceRecords.length}件の出願情報`;
  const commentary=landscape?.commentary?.[group];
  const explanation=commentary&&<aside className="ddr-ip-commentary" data-ip-commentary={group}><h3>{commentary.title}</h3><p>{commentary.text}</p></aside>;
  if(print)return <section data-patent-group={group}>{explanation}<div className="ddr-patent-print">{records.map(record=><section className="ddr-patent-record" key={record.key} data-patent-asset={record.asset?.id}>
    <h3>{record.values[0]}</h3>
    <dl>{columns.slice(1).map(column=><div key={column.key}><dt>{column.label}</dt><dd>{value(record,column.key)}</dd></div>)}</dl>
  </section>)}</div></section>;
  return <section data-patent-group={group}>{explanation}<div className="ddr-table-scroll ddr-patent-scroll" tabIndex={0} role="region" aria-label={`${description}。横にスクロールして${columns.length}項目を比較`}>
    <table className="ddr-patent-table" style={{width:columns.reduce((sum,column)=>sum+column.width,0)}}><caption className="sr-only">特許・出願一覧：{description}</caption>
      <colgroup>{columns.map(column=><col key={column.key} style={{width:column.width}}/>)}</colgroup>
      <thead><tr className="ddr-table-head">{columns.map(column=><th key={column.key} scope="col">{group==='university'&&/^\d+$/.test(column.key)?cell({...heading.cells[Number(column.key)],value:column.label}):column.label}</th>)}</tr></thead>
      <tbody>{records.map(record=><tr key={record.key} data-source-row={record.sourceRow} data-patent-asset={record.asset?.id}>{columns.map((column,i)=>i===0?<th key={column.key} scope="row">{value(record,column.key)}</th>:<td key={column.key}>{value(record,column.key)}</td>)}</tr>)}</tbody>
    </table>
  </div></section>;
}
