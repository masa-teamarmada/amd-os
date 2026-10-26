import {canonicalChapterHref,type CanonicalReportNavigation} from '../../../lib/project-canonical-links';
import {Fragment,type ReactNode} from 'react';
import type {DdReportGlossary} from '@/lib/dd-report-types';

/** SOL document wording only; calculation keys and URLs retain their original values. */
export function ddCostTerm(text:string,slug:string):string {return slug==='sol'?text.split(/(https?:\/\/[^\s）)<>]+)/g).map(part=>part.startsWith('http')?part:part.replaceAll('原価','コスト')).join(''):text;}
const costGlossaries=new WeakMap<DdReportGlossary,DdReportGlossary>();
function costGlossary(glossary:DdReportGlossary){let result=costGlossaries.get(glossary);if(!result){result=Object.fromEntries(Object.entries(glossary).map(([key,entry])=>[ddCostTerm(key,'sol'),{...entry,definition:ddCostTerm(entry.definition,'sol'),sourceLabel:entry.sourceLabel?ddCostTerm(entry.sourceLabel,'sol'):undefined}]));costGlossaries.set(glossary,result);}return result;}
const escape=(s:string)=>s.replace(/[|\\{}()[\]^$+*?.]/g,'\\$&');
type EmphasisRange={start:number;end:number;authored:boolean};
/** Phrase ranges are chosen before glossary segmentation. */
export function ddEmphasisRanges(text:string,enabled:boolean,highlights:readonly string[]=[]):EmphasisRange[]{
  if(!enabled&&!highlights.length)return [];
  const ranges:EmphasisRange[]=[];
  const add=(start:number,end:number,authored=false)=>{if(start<0||ranges.some(r=>start<r.end&&end>r.start))return false;ranges.push({start,end,authored});return true;};
  for(const phrase of highlights.filter(Boolean).slice(0,3)){const start=text.indexOf(phrase);if(start>=0)add(start,start+phrase.length,true);}
  if(ranges.length)return ranges.sort((a,b)=>a.start-b.start);
  const budget=Math.max(12,Math.min(64,Math.floor(text.length*.28)));let used=0;
  for(const match of text.matchAll(/[^、。\n；]+/g)){
    const clause=match[0].trim();
    if(clause.length<8||clause.length>budget||clause.length>48||!/(?:を優先|を起点|を並行|を確保|を判断|を計画|を目指|を担う|で収益|へ展開|へ横展開|から着手|から開始|に基づ)/.test(clause))continue;
    const start=match.index!+match[0].indexOf(clause);if(add(start,start+clause.length)){used+=clause.length;break;}
  }
  const key=/(?:有償共同開発|開発費を受領|顧客の費用削減|継続供給|反復受注|実施許諾|品質保証|権利範囲|営業利益|月末現金|共同開発|金属資源化|バイオ燃料|廃液処理|検収|再現性|\d[\d,.，]*(?:億円|万円|円|か月|ヶ月|年|台|拠点|人|%|％))/g;
  for(const match of text.matchAll(key)){if(ranges.length>=3)break;if(used+match[0].length>budget)continue;if(add(match.index!,match.index!+match[0].length))used+=match[0].length;}
  return ranges.sort((a,b)=>a.start-b.start);
}
function marked(text:string,offset:number,ranges:readonly EmphasisRange[]):ReactNode{
  let cursor=0;const nodes:ReactNode[]=[];
  for(const range of ranges){
    const start=Math.max(0,range.start-offset),end=Math.min(text.length,range.end-offset);if(start>=end)continue;
    nodes.push(text.slice(cursor,start),range.authored?<mark className="ddr-key-point" key={range.start}>{text.slice(start,end)}</mark>:<strong className="ddr-emphasis" key={range.start}>{text.slice(start,end)}</strong>);cursor=end;
  }
  nodes.push(text.slice(cursor));return nodes;
}
export function ddEmphasize(text:string,enabled:boolean):ReactNode{return marked(text,0,ddEmphasisRanges(text,enabled));}
export function DdReportRichText({text,id,slug,glossary={},interactive=true,emphasize=true,highlights=[],navigation}:{text:string;id:string;slug:string;glossary?:DdReportGlossary;interactive?:boolean;emphasize?:boolean;highlights?:readonly string[];navigation?:CanonicalReportNavigation}){
  if(slug==='sol'){text=ddCostTerm(text,slug);highlights=highlights.map(x=>ddCostTerm(x,slug));glossary=costGlossary(glossary);}
  const terms=Object.keys(glossary).sort((a,b)=>b.length-a.length),pattern=terms.length?new RegExp('https?:\\/\\/[^\\s）)<>]+|'+terms.map(t=>/^[A-Za-z0-9-]+$/.test(t)?'(?<![A-Za-z0-9-])'+escape(t)+'(?![A-Za-z0-9-])':escape(t)).join('|'),'g'):/https?:\/\/[^\s）)<>]+/g;
  const ranges=ddEmphasisRanges(text,emphasize,highlights);let cursor=0;const nodes:ReactNode[]=[];
  for(const match of text.matchAll(pattern)){
    const start=match.index!,term=match[0],entry=glossary[term],popup='term-'+id+'-'+start;
    nodes.push(<Fragment key={'before-'+start}>{marked(text.slice(cursor,start),cursor,ranges)}</Fragment>);cursor=start+term.length;
    if(term.startsWith('http')){nodes.push(<a key={popup} href={term} target="_blank" rel="noreferrer">出所を開く ↗</a>);continue;}
    const label=marked(term,start,ranges),related=entry?.chapter?canonicalChapterHref(slug,entry.chapter,navigation):undefined;
    if(!interactive){nodes.push(term==='SIER'?<a key={popup} href={related??canonicalChapterHref(slug,'sier',navigation)}>{label}</a>:<Fragment key={popup}>{label}</Fragment>);continue;}
    const trigger=<button type="button" className="ddr-term" popoverTarget={popup} aria-label={term+'の説明'}>{label}</button>;
    nodes.push(<Fragment key={popup}>{term==='SIER'?<><a href={related}>{label}</a><button type="button" className="ddr-term-info" popoverTarget={popup} aria-label="SIERの説明">?</button></>:trigger}<span id={popup} popover="auto" role="note" className="ddr-glossary"><strong>{term}</strong><button type="button" className="ddr-glossary-close" popoverTarget={popup} popoverTargetAction="hide" aria-label="用語説明を閉じる">×</button><span>{entry.definition}</span><span className="ddr-glossary-links">{related&&<a href={related}>関連資料を読む →</a>}{entry.sourceUrl&&<a href={entry.sourceUrl} target="_blank" rel="noreferrer">{entry.sourceLabel??'出所'} ↗</a>}</span></span></Fragment>);
  }
  nodes.push(<Fragment key="tail">{marked(text.slice(cursor),cursor,ranges)}</Fragment>);return <>{nodes}</>;
}
