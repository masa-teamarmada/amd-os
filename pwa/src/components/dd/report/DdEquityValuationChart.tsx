import type {DdEquityValuation} from '@/lib/dd-report-types';

const money=(n:number)=>n.toLocaleString('ja-JP',{maximumFractionDigits:2});
type Step={label:string[];from:number;to:number;amount:number;fill:string;reference?:boolean};
export function ddEquityValuationSteps(round:DdEquityValuation){
  const steps:Step[]=[];
  if(round.pre===null){
    if(round.cap!==null)steps.push({label:['参考','キャップ'],from:0,to:round.cap,amount:round.cap,fill:'#edf3f6',reference:true});
    if(round.funding!==null){const base=round.cap??0;steps.push({label:['今回の','調達額'],from:base,to:base+round.funding,amount:round.funding,fill:'#e5a12a'});}
  }else{
    const base=round.previousPost??round.previousCap??null,conversion=round.seedConversion??0;
    const beforeConversion=round.pre-conversion;
    if(base!==null&&round.progress!==null){
      steps.push(round.previousPost!==null?{label:['前回','ポスト'],from:0,to:base,amount:base,fill:'#193d52'}:{label:['参考','キャップ'],from:0,to:base,amount:base,fill:'#edf3f6',reference:true});
      steps.push({label:['進捗で',round.progress<0?'評価減':'評価増'],from:base,to:beforeConversion,amount:round.progress,fill:round.progress<0?'#a8684f':'#35b9d0'});
    }else steps.push({label:conversion?['転換前','評価額']:['今回','プレ'],from:0,to:beforeConversion,amount:beforeConversion,fill:'#193d52'});
    if(conversion)steps.push({label:['シード','転換元本'],from:beforeConversion,to:round.pre,amount:conversion,fill:'#6a91b3'});
    if(round.funding!==null)steps.push({label:['新規','調達'],from:round.pre,to:round.pre+round.funding,amount:round.funding,fill:'#e5a12a'});
    if(round.post!==null)steps.push({label:['今回','ポスト'],from:0,to:round.post,amount:round.post,fill:'#087e9e'});
  }
  return steps;
}
export function DdEquityValuationChart({round}:{round:DdEquityValuation}){
  const steps=ddEquityValuationSteps(round);
  if(!steps.length)return null;
  const high=Math.max(1,...steps.flatMap(step=>[step.from,step.to])),baseline=142,y=(value:number)=>baseline-value/high*108,spacing=228/steps.length;
  return <figure className="ddr-valuation-chart">
    <figcaption>{round.pre===null?'J-KISSの条件':'評価額の変化'}<span>億円</span></figcaption>
    <svg viewBox="0 0 260 200" role="img" aria-label={`${round.name}：${steps.map(step=>step.label.join('')+' '+money(step.amount)+'億円').join('、')}`}>
      <line x1="16" x2="252" y1={baseline} y2={baseline} stroke="#afc4ce"/>
      <text x="10" y={baseline+4} textAnchor="end" fontSize="10" fill="#526874">0</text>
      {steps.map((step,i)=>{const x=20+(i+.5)*spacing,width=Math.min(34,spacing-18),top=y(Math.max(step.from,step.to)),height=Math.max(2,Math.abs(y(step.from)-y(step.to)));return <g key={i}>
        <title>{`${step.label.join('')} ${money(step.amount)}億円`}</title>
        {i>0&&step.from!==0&&<line x1={x-spacing+width/2} x2={x-width/2} y1={y(step.from)} y2={y(step.from)} stroke="#8ba7b5" strokeDasharray="3 2"/>}
        <rect x={x-width/2} y={top} width={width} height={height} fill={step.fill} stroke={step.reference?'#8aa4b1':'none'} strokeDasharray={step.reference?'3 2':undefined}/>
        <text x={x} y={top-8} textAnchor="middle" fontSize="12" fontWeight="700" fill="#193d52">{i>0&&step.from!==0&&step.amount>0?'+':''}{money(step.amount)}</text>
        <text x={x} y="162" textAnchor="middle" fontSize="11" fontWeight="600" fill="#193d52">{step.label.map((line,j)=><tspan key={j} x={x} dy={j?15:0}>{line}</tspan>)}</text>
      </g>;})}
    </svg>
    {round.pre===null?<p>株価は次回の株式調達時に確定</p>:round.seedConversion!=null&&<p>シード転換元本{money(round.seedConversion)}億円はプレの内訳。Aの新規資金は{round.funding===null?'未定':money(round.funding)+'億円'}。</p>}
  </figure>;
}
