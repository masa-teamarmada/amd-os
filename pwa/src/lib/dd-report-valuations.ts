import type {DdEquityValuation} from './dd-report-types.ts';

/** Values use the capital plan's existing cells and units (JPY 100 million). */
export function ddEquityValuations(read:(sheet:string,address:string)=>unknown):DdEquityValuation[]{
  const number=(sheet:string,address:string)=>{const value=read(sheet,address);return typeof value==='number'&&Number.isFinite(value)?value:null;};
  const cap=number('共通前提','C16');
  const rounds:DdEquityValuation[]=[{name:'シード',pre:null,funding:number('資本政策表','C97'),post:null,previousPost:null,progress:null,cap:cap===null?null:cap/1e8}];
  for(const [i,col]of ['I','L','O','R','U'].entries()){
    const pre=number('資本政策表',col+'29'),post=number('資本政策表',col+'30'),previousPost=rounds.at(-1)!.post,previousCap=i===0?rounds[0].cap:null;
    const base=previousPost??previousCap,seedConversion=i===0?rounds[0].funding:0;
    rounds.push({name:['シリーズA','シリーズB','シリーズC','シリーズD','IPO'][i],pre,funding:number('資本政策表','C'+(98+i)),post,previousPost,...(i===0?{previousCap,seedConversion}:{}),progress:pre===null||base===null||seedConversion===null?null:pre-base-seedConversion,cap:null});
  }
  return rounds;
}
