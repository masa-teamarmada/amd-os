'use client';
import Link from 'next/link';
import {useState} from 'react';
import type {DdReportChapterSummary} from '@/lib/dd-report-types';
export function DdReportNavigation({slug,index,selected}:{slug:string;index:DdReportChapterSummary[];selected:string}) {
  const [query,setQuery]=useState('');
  const priority=['source-index','business-plan','equity-story','capital-plan','financial-plan','production-plan'];
  const matches=(c:DdReportChapterSummary)=>c.title.includes(query.trim())||c.group_label.includes(query.trim());
  const groups=[...new Set(index.filter(c=>!priority.includes(c.slug)).map(c=>c.group_label))];
  const link=(c:DdReportChapterSummary)=><Link key={c.slug} href={`/dd/${encodeURIComponent(slug)}?chapter=${c.slug}`} aria-current={selected===c.slug?'page':undefined}>{c.title==='UE'?'UE（ユニットエコノミクス）':c.title}</Link>;
  return <nav className="ddr ddr-nav" aria-label="DDパッケージの資料目録">
    <label className="sr-only" htmlFor="dd-report-search">資料名を検索</label><input id="dd-report-search" value={query} onChange={e=>setQuery(e.target.value)} type="search" placeholder="38資料から検索"/>
    <div className="ddr-nav-group">最初に読む</div>{priority.flatMap(key=>index.filter(c=>c.slug===key&&matches(c)).map(link))}
    {groups.map(group=>{const chapters=index.filter(c=>c.group_label===group&&!priority.includes(c.slug)&&matches(c));return chapters.length?<div key={group}><div className="ddr-nav-group">{group}</div>{chapters.map(link)}</div>:null;})}
    <div className="ddr-nav-footer"><Link href={`/dd/${encodeURIComponent(slug)}/legacy`}>旧DDパッケ ↗</Link><Link href={`/dd/${encodeURIComponent(slug)}/legacy?tab=documents`}>添付・証憑資料 ↗</Link></div>
  </nav>;
}
