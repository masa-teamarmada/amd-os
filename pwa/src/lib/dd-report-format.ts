import type {DdReportValue} from './dd-report-types';
export function formatDdReportValue(value:DdReportValue,format='General'):string {
  if(value===null)return '';if(typeof value!=='number')return String(value);
  if(format===';;;')return '';
  const section=format.split(';')[value<0?1:0]||format.split(';')[0];
  if(/^"[^"]*"$/.test(section))return section.slice(1,-1);
  if(/yyyy|yy\/|mm\/|年/.test(format)&&value>20000&&value<100000){const date=new Date(Date.UTC(1899,11,30)+value*86400000);return `${date.getUTCFullYear()}/${String(date.getUTCMonth()+1).padStart(2,'0')}`+(/d{1,2}/i.test(format)?`/${String(date.getUTCDate()).padStart(2,'0')}`:'');}
  const percent=section.includes('%'),decimals=section.match(/[0#]\.([0#]+)/)?.[1]??'',scale=format.split(';')[0].match(/[0#](,+)(?=(?:"[^"]*"|\s)*$)/)?.[1].length??0;
  if(value===0&&format.split(';').length>=3){const zero=format.split(';')[2];if(!/[0#]/.test(zero))return zero.replaceAll('"','').replaceAll('\\','');}
  const parentheses=value<0&&section.includes('('),number=((parentheses?Math.abs(value):value)*(percent?100:1)/1000**scale).toLocaleString('ja-JP',{minimumFractionDigits:Math.min((decimals.match(/0/g)||[]).length,6),maximumFractionDigits:format==='General'?6:Math.min(decimals.length,6)});
  const suffix=section.match(/[0#%,]("[^"]*")$/)?.[1].replaceAll('"','')??'';
  return (parentheses?'('+number+')':number)+(percent?'%':'')+suffix;
}
