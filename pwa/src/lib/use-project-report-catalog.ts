'use client';
import {useEffect,useState} from 'react';
import {loadReferenceData,peekReferenceData} from '@/lib/reference-data-cache';
import {canonicalReportPath} from './project-canonical-pages.ts';
import type {DdReportChapterSummary} from './dd-report-types.ts';
import type {ProjectSurface} from '@/lib/project-surface-permissions';

export function useProjectReportCatalog(projectId:string,surface:ProjectSurface,slug?:string){
  const key=`canonical-report-catalog:${projectId}:${surface}:${slug??''}`;
  const [catalog,setCatalog]=useState<{key:string;index:DdReportChapterSummary[]}>(()=>({key,index:peekReferenceData<DdReportChapterSummary[]>(key)??[]}));
  const [error,setError]=useState('');
  useEffect(()=>{
    let active=true;
    void loadReferenceData(key,async()=>{
      const response=await fetch(canonicalReportPath(projectId,surface,'business-plan',slug));
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error||'共通資料の一覧を読み込めなかった。');
      return (payload.page?.index??[]) as DdReportChapterSummary[];
    }).then(value=>{if(active){setCatalog({key,index:value});setError('');}}).catch(()=>{if(active)setError('共通資料の一覧を読み込めなかった。ページを再読み込みして確認する。');});
    return()=>{active=false;};
  },[key,projectId,surface,slug]);
  return {index:catalog.key===key?catalog.index:[],error};
}
