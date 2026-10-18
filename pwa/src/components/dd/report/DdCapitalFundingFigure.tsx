import type {DdReportChapter} from '@/lib/dd-report-types';

export type DdFundingRound={name:string;pre:number|null;funding:number;post:number|null};
/** Read the same evaluated cells as the capital table; do not introduce price assumptions. */
export function ddFundingRounds(chapter:DdReportChapter):DdFundingRound[]{
  const cells=new Map(chapter.body.rows.flatMap(r=>r.cells).map(c=>[c.address,c.value]));
  const num=(address:string)=>{const v=cells.get(address);return typeof v==='number'?v:null;};
  const rounds:DdFundingRound[]=[{name:'シード',pre:null,funding:num('C97')??0,post:null}];
  for(const [i,col] of ['I','L','O','R','U'].entries())rounds.push({name:['シリーズA','シリーズB','シリーズC','シリーズD','IPO'][i],pre:num(col+'29'),funding:num('C'+(98+i))??0,post:num(col+'30')});
  return rounds;
}
const money=(n:number)=>n.toLocaleString('ja-JP',{maximumFractionDigits:2});
export function DdCapitalFundingFigure({chapter}:{chapter:DdReportChapter}){
  const rounds=ddFundingRounds(chapter),high=Math.max(1,...rounds.map(r=>(r.pre??0)+r.funding));
  const x=(i:number)=>96+(i+.5)*880/rounds.length,y=(n:number)=>238-n/high*198;
  return <figure className="ddr-chart ddr-funding-chart">
    <figcaption>ラウンド別の評価額・新規調達額（億円）</figcaption>
    <div className="ddr-chart-scroll"><svg viewBox="0 0 1000 364" role="img" aria-label="調達前評価額と新規調達額の積み上げ。合計が調達後評価額。シードはJ-KISSの調達額を表示。">
      {[0,.25,.5,.75,1].map(f=><g key={f}><line x1="96" x2="976" y1={y(f*high)} y2={y(f*high)} stroke="#dce5e8"/><text x="84" y={y(f*high)+5} textAnchor="end" fontSize="13" fill="#425966">{money(f*high)}</text></g>)}
      {rounds.map((r,i)=>{const xx=x(i),pre=r.pre??0,total=pre+r.funding;return <g key={r.name}>
        <title>{`${r.name}：${r.pre===null?'J-KISS':`調達前 ${money(pre)}億円`}、新規調達 ${money(r.funding)}億円${r.post===null?'':`、調達後 ${money(r.post)}億円`}`}</title>
        {pre>0&&<rect x={xx-42} y={y(pre)} width="84" height={238-y(pre)} fill="#193d52"/>}
        <rect x={xx-42} y={y(total)} width="84" height={Math.max(.5,y(pre)-y(total))} fill="#147d92"/>
        {r.post!==null&&<text x={xx} y={y(total)-9} textAnchor="middle" fontSize="13" fontWeight="650" fill="#193d52">{money(r.post)}</text>}
        <text x={xx} y="263" textAnchor="middle" fontSize="13" fontWeight="600" fill="#193d52">{r.name}</text>
        <text x={xx} y="288" textAnchor="middle" fontSize="12" fill="#425966">{r.pre===null?'J-KISS':`プレ ${money(r.pre)}`}</text>
        <text x={xx} y="309" textAnchor="middle" fontSize="12" fill="#147d92" fontWeight="650">調達 {money(r.funding)}</text>
        <text x={xx} y="330" textAnchor="middle" fontSize="12" fill="#425966">{r.post===null?'転換時に株価確定':`ポスト ${money(r.post)}`}</text>
      </g>;})}
    </svg></div>
    <div className="ddr-legend"><span><i style={{background:'#193d52'}}/>調達前評価額（プレ）</span><span><i style={{background:'#147d92'}}/>新規調達額</span><span>合計＝調達後評価額（ポスト）</span></div>
    <p className="ddr-chart-note">シードはJ-KISSで{money(rounds[0].funding)}億円を調達し、シリーズAで転換する計画。棒にはシードの調達額を表示する。キャップ・割引率・転換価額は資本政策表に記載する。</p>
  </figure>;
}
export function DdInvestorReturnNote({chapter}:{chapter:DdReportChapter}){
  const cells=new Map(chapter.body.rows.flatMap(r=>r.cells).map(c=>[c.address,c.value]));
  const get=(a:string)=>Number(cells.get(a)),seed=get('U117'),a=get('U118');
  if(![seed,a,get('R117'),get('R118')].every(Number.isFinite))return null;
  const months=Math.round((get('E118')-get('E117'))/30.4375);
  return <p className="ddr-return-note">シードの投資倍率は{money(get('R117'))}倍、シリーズAは{money(get('R118'))}倍。シードは約{months}か月早く出資し、IPOまでの期間が長いため、年率IRRはシード{money(seed*100)}%、シリーズA{money(a*100)}%となる。投資倍率は回収総額を、年率IRRは投資期間を含めた収益率を示す。</p>;
}
