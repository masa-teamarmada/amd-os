import type {DdReportCalculator} from './dd-report-model';
import {ddEscapeHtml} from './dd-confidentiality';

/** Reuse existing formula-backed ranges; preserve every model formula and input. */
export function updateDdFundingChartXml(xml:string,calc:DdReportCalculator):string {
  if(!xml.includes('ラウンド別の調達計画（億円）'))return xml;
  const template=xml.match(/<c:ser>[\s\S]*?<\/c:ser>/)?.[0];if(!template)return xml;
  const categories=['シリーズA','シリーズB','シリーズC','シリーズD','IPO'];
  const specs=[{name:'調達前評価額（億円）',column:'Z',row:333,color:'193D52'},{name:'新規調達額（億円）',column:'C',row:98,color:'147D92'}];
  const series=specs.map((s,i)=>template
    .replace(/<c:idx\b[^>]*\/>/,`<c:idx val="${i}"/>`).replace(/<c:order\b[^>]*\/>/,`<c:order val="${i}"/>`)
    .replace(/<c:tx>[\s\S]*?<\/c:tx>/,`<c:tx><c:v>${s.name}</c:v></c:tx>`)
    .replace(/<c:spPr>[\s\S]*?<\/c:spPr>/,`<c:spPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill><a:ln><a:prstDash val="solid"/></a:ln></c:spPr>`)
    .replace(/<c:cat>[\s\S]*?<\/c:cat>/,`<c:cat><c:strRef><c:f>'資本政策表'!$B$98:$B$102</c:f><c:strCache><c:ptCount val="5"/>${categories.map((v,j)=>`<c:pt idx="${j}"><c:v>${v}</c:v></c:pt>`).join('')}</c:strCache></c:strRef></c:cat>`)
    .replace(/<c:val>[\s\S]*?<\/c:val>/,`<c:val><c:numRef><c:f>'資本政策表'!$${s.column}$${s.row}:$${s.column}$${s.row+4}</c:f><c:numCache><c:formatCode>0.##</c:formatCode><c:ptCount val="5"/>${categories.map((_,j)=>`<c:pt idx="${j}"><c:v>${Number(calc.get('資本政策表',s.column+(s.row+j)))||0}</c:v></c:pt>`).join('')}</c:numCache></c:numRef></c:val>`)
  ).join('');
  const stacked=xml.replace('ラウンド別の調達計画（億円）',ddEscapeHtml('ラウンド別の評価額・新規調達額（億円）'))
    .replace(/<c:grouping val="[^"]*"\/>/,'<c:grouping val="stacked"/>')
    .replace(/<c:ser>[\s\S]*?<\/c:ser>/,series)
    .replace(/<c:overlap val="[^"]*"\/>/,'<c:overlap val="100"/>');
  return stacked.includes('<c:overlap')?stacked:stacked.replace(/(<c:gapWidth\b[^>]*\/>)/,'$1<c:overlap val="100"/>');
}
