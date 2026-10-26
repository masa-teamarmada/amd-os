import type {DdReportChapter} from './dd-report-types.ts';
import type {CapitalEvent,Holder,EventAllocation} from './capital-plan.ts';
import type {StandardIpoCapitalPlanDocument} from './capital-plan-presets.ts';
/** DDの計算済み株数・価格を比較案の初期値にする。元のプランと確定台帳は保持する。 */
export function capitalPlanFromReport(chapter:DdReportChapter,version:string):StandardIpoCapitalPlanDocument{
  const cells=new Map(chapter.body.rows.flatMap(row=>row.cells).map(cell=>[cell.address,cell.value]));
  const text=(address:string)=>String(cells.get(address)??'');
  const number=(address:string)=>{const value=cells.get(address);if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw new Error(`DDの数値の検証が必要：${address}`);return value;};
  const date=(column:string)=>{const match=/^(\d{4})\/(\d{1,2})$/.exec(text(column+'8'));if(!match)throw new Error('DDの調達月の検証が必要。');return `${match[1]}-${match[2].padStart(2,'0')}-01`;};
  const columns=['C','F','I','L','O','R','U'];
  if(chapter.slug!=='capital-plan'||text('B9')!=='株主／完全希薄化後'||!text('F7').includes('J-KISS')||!chapter.body.jkiss)throw new Error('DDの資本政策表の形の検証が必要。');
  const rows=Array.from({length:10},(_,i)=>i+10).filter(row=>text('B'+row));
  const holders:Holder[]=rows.map(row=>({id:'amie-dd-holder-'+row,name:text('B'+row),kind:row===13?'esop_pool':row<=11?'founder':row===12?'employee':'investor',note:`DD v${version}の資本政策表 B${row}。計画上の配分。`}));
  const holderId=(row:number)=>'amie-dd-holder-'+row;
  const value=(value:number)=>({value,source:'imported' as const});
  const note=`DD v${version}の計算済み値を比較案の初期条件として取得。日付はDDの計画月の月初。`;
  const events:CapitalEvent[]=[];
  const add=(event:Omit<CapitalEvent,'order'|'status'>)=>events.push({...event,order:events.length+1,status:'planned',note:event.note??note});
  const initial=rows.filter(row=>row!==13&&number('C'+row)>0).map(row=>({id:'amie-dd-inc-'+row,holderId:holderId(row),shareClass:'common' as const,shares:value(number('C'+row)),amount:value(number('E'+row)),pricePerShare:value(number('C24'))}));
  add({id:'amie-dd-incorporation',type:'incorporation',label:text('C7'),date:date('C'),calculationBasis:'manual',allocations:initial,pricePerShare:value(number('C24'))});
  const pool=number('C13');
  if(pool)add({id:'amie-dd-so-initial',type:'option_pool',label:'シード前SOプール',date:date('C'),calculationBasis:'manual',poolSize:value(pool),allocations:[{id:'amie-dd-so-initial-allocation',holderId:holderId(13),shareClass:'option',shares:value(pool)}]});
  const jkiss=chapter.body.jkiss;
  const seedShares=number('F14');
  add({id:'amie-dd-seed',type:'convertible_issue',label:text('F7'),date:date('F'),calculationBasis:'manual',conversionCap:value(jkiss.cap),conversionDiscount:value(jkiss.discount),pricePerShare:value(jkiss.price),note:note+` 転換条件となる新規株式調達額は${jkiss.qualifying.toLocaleString('ja-JP')}円。転換価額・株数はDDの計算済み値。`,allocations:[{id:'amie-dd-seed-allocation',holderId:holderId(14),shareClass:'convertible',shares:value(seedShares),amount:value(number('H14')),pricePerShare:value(jkiss.price)}]});
  for(let index=2;index<columns.length;index++){
    const column=columns[index],previous=columns[index-1];
    if(index===2&&seedShares){
      add({id:'amie-dd-seed-conversion',type:'convertible_conversion',label:'シードJ-KISS転換',date:date(column),calculationBasis:'manual',conversionCap:value(jkiss.cap),conversionDiscount:value(jkiss.discount),allocations:[{id:'amie-dd-seed-consume',holderId:holderId(14),shareClass:'convertible',shares:value(-seedShares)},{id:'amie-dd-seed-convert',holderId:holderId(14),shareClass:'preferred',shares:value(seedShares)}]});
    }
    const extraPool=number(column+'13')-number(previous+'13');
    if(extraPool<0)throw new Error('DDのSO減少の検証が必要。');
    if(extraPool)add({id:'amie-dd-so-'+index,type:'option_pool',label:text(column+'7')+'前のSO追加',date:date(column),calculationBasis:'manual',poolSize:value(extraPool),allocations:[{id:'amie-dd-so-allocation-'+index,holderId:holderId(13),shareClass:'option',shares:value(extraPool)}]});
    const cashColumn=String.fromCharCode(column.charCodeAt(0)+2),allocations:EventAllocation[]=[];
    for(const row of rows){
      if(row===13)continue;
      const shares=number(column+row)-number(previous+row);
      if(shares<0)throw new Error('DDの株式移動の検証が必要。');
      if(shares)allocations.push({id:`amie-dd-${index}-allocation-${row}`,holderId:holderId(row),shareClass:index===columns.length-1?'common':'preferred',shares:value(shares),amount:value(number(cashColumn+row)),pricePerShare:value(number(column+'24'))});
    }
    if(!allocations.length)throw new Error('DDの新規割当の検証が必要。');
    const pre=number(column+'29')*1e8;
    add({id:'amie-dd-round-'+index,type:index===columns.length-1?'ipo':'equity_issue',label:text(column+'7'),date:date(column),calculationBasis:'manual',preMoneyValuation:value(pre),postMoneyValuation:value(pre+number(column+'23')),pricePerShare:value(number(column+'24')),allocations});
  }
  return {holders,events};
}
