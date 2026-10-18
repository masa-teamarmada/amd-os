import {Fragment,type ReactNode} from 'react';
import type {DdReportGlossary} from '@/lib/dd-report-types';

const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const emphasis=/廃液処理|金属資源化|バイオ燃料|顧客の費用削減|継続供給|シード|IPO|\d[\d,.，]*(?:億円|万円|か月|ヶ月|年|台|拠点|人|%|％)/g;

/** Semantic emphasis is limited per paragraph; the canonical wording stays intact. */
export function ddEmphasize(text:string,enabled:boolean):ReactNode {
  if(!enabled)return text;
  const matches=[...text.matchAll(emphasis)].slice(0,3);let cursor=0;const result:ReactNode[]=[];
  for(const m of matches){result.push(text.slice(cursor,m.index),<strong className="ddr-emphasis" key={m.index}>{m[0]}</strong>);cursor=m.index!+m[0].length;}result.push(text.slice(cursor));return result;
}

export function DdReportRichText({text,id,slug,glossary={},interactive=true,emphasize=false}:{text:string;id:string;slug:string;glossary?:DdReportGlossary;interactive?:boolean;emphasize?:boolean}) {
  const terms=Object.keys(glossary).sort((a,b)=>b.length-a.length),pattern=terms.length?new RegExp(`https?:\\/\\/[^\\s）)<>]+|${terms.map(t=>/^[A-Za-z0-9-]+$/.test(t)?`(?<![A-Za-z0-9-])${escape(t)}(?![A-Za-z0-9-])`:escape(t)).join('|')}`,'g'):/https?:\/\/[^\s）)<>]+/g;
  const emphasisPattern=/\d[\d,.，]*(?:億円|万円|円)/.test(text)?/\d[\d,.，]*(?:億円|万円|円)/g:emphasis;
  let cursor=0,emphasisUsed=0;const nodes:ReactNode[]=[];
  const plain=(s:string)=>{const matches=[...s.matchAll(emphasisPattern)].slice(0,Math.max(0,3-emphasisUsed));if(!emphasize||!matches.length)return s;let pos=0;const out:ReactNode[]=[];for(const m of matches){out.push(s.slice(pos,m.index),<strong className="ddr-emphasis" key={m.index}>{m[0]}</strong>);pos=m.index!+m[0].length;}emphasisUsed+=matches.length;out.push(s.slice(pos));return out;};
  for(const m of text.matchAll(pattern)){
    nodes.push(<Fragment key={`before-${m.index}`}>{plain(text.slice(cursor,m.index))}</Fragment>);cursor=m.index!+m[0].length;
    const term=m[0],entry=glossary[term],popup=`term-${id}-${m.index}`;
    if(term.startsWith('http')){nodes.push(<a key={popup} href={term} target="_blank" rel="noreferrer">出所を開く ↗</a>);continue;}
    const label=plain(term),related=entry?.chapter?`/dd/${encodeURIComponent(slug)}?chapter=${entry.chapter}`:undefined;
    if(!interactive){nodes.push(term==='SIER'?<a key={popup} href={related??`/dd/${slug}?chapter=sier`}>{label}</a>:<Fragment key={popup}>{label}</Fragment>);continue;}
    const trigger=<button type="button" className="ddr-term" popoverTarget={popup} aria-label={`${term}の説明`}>{label}</button>;
    nodes.push(<Fragment key={popup}>{term==='SIER'?<><a href={related}>{label}</a><button type="button" className="ddr-term-info" popoverTarget={popup} aria-label="SIERの説明">?</button></>:trigger}<span id={popup} popover="auto" role="note" className="ddr-glossary"><strong>{term}</strong><button type="button" className="ddr-glossary-close" popoverTarget={popup} popoverTargetAction="hide" aria-label="用語説明を閉じる">×</button><span>{entry.definition}</span><span className="ddr-glossary-links">{related&&<a href={related}>関連資料を読む →</a>}{entry.sourceUrl&&<a href={entry.sourceUrl} target="_blank" rel="noreferrer">{entry.sourceLabel??'出所'} ↗</a>}</span></span></Fragment>);
  }
  nodes.push(<Fragment key="tail">{plain(text.slice(cursor))}</Fragment>);return <>{nodes}</>;
}
