'use client';
import Link from 'next/link';
import {useState} from 'react';
import type {DdReportChapterSummary} from '@/lib/dd-report-types';
export function DdReportNavigation({slug,index,selected}:{slug:string;index:DdReportChapterSummary[];selected:string}) {
  const [query,setQuery]=useState('');
  const priority=['source-index','business-plan','equity-story','capital-plan','financial-plan','unit-economics','production-plan'];
  const matches=(c:DdReportChapterSummary)=>c.title.includes(query.trim())||c.group_label.includes(query.trim());
  const groups=[...new Set(index.filter(c=>!priority.includes(c.slug)&&c.slug!=='assumptions').map(c=>c.group_label))];
  const link=(c:DdReportChapterSummary)=><Link key={c.slug} prefetch={false} href={`/dd/${encodeURIComponent(slug)}?chapter=${c.slug}`} aria-current={selected===c.slug?'page':undefined}>{c.title==='UE'?'UE（ユニットエコノミクス）':c.title}</Link>;
  return <nav className="ddr ddr-nav" aria-label="DDパッケージの資料目録">
    <label className="sr-only" htmlFor="dd-report-search">資料名を検索</label><input id="dd-report-search" value={query} onChange={e=>setQuery(e.target.value)} type="search" placeholder={`${index.length}資料から検索`}/>
    <div className="ddr-nav-group">最初に読む</div>{priority.flatMap(key=>index.filter(c=>c.slug===key&&matches(c)).map(link))}
    {groups.map(group=>{const chapters=index.filter(c=>c.group_label===group&&!priority.includes(c.slug)&&c.slug!=='assumptions'&&matches(c));return chapters.length?<div key={group}><div className="ddr-nav-group">{group}</div>{chapters.map(link)}</div>:null;})}
    {index.some(c=>c.slug==='assumptions'&&matches(c))&&<div><div className="ddr-nav-group">計算条件</div>{index.filter(c=>c.slug==='assumptions'&&matches(c)).map(link)}</div>}
    <div className="ddr-nav-footer"><Link prefetch={false} href={`/dd/${encodeURIComponent(slug)}/legacy`}>旧DDパッケ ↗</Link><Link prefetch={false} href={`/dd/${encodeURIComponent(slug)}/legacy?tab=documents`}>添付・証憑資料 ↗</Link></div>
  </nav>;
}
