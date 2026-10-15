"use client";
import {loadReferenceData,peekReferenceData,prefetchReferenceData} from "@/lib/reference-data-cache";
import type {ProjectPocListData} from "./project-poc-list";
const key=(projectId:string,sharedView=false)=>`project-poc-list:${projectId}:${sharedView?"shared":"internal"}`;
async function request(projectId:string):Promise<ProjectPocListData>{
 const response=await fetch(`/api/project-poc-list?projectId=${encodeURIComponent(projectId)}`,{cache:"no-store"});
 const data=await response.json();
 if(!response.ok||!data.ok)throw new Error("PoCリストを読み込めなかった");
 return data;
}
export function loadProjectPocList(projectId:string,sharedView=false,force=false){return loadReferenceData(key(projectId,sharedView),()=>request(projectId),{force});}
export function peekProjectPocList(projectId:string,sharedView=false){return peekReferenceData<ProjectPocListData>(key(projectId,sharedView));}
export function prefetchProjectPocList(projectId:string,sharedView=false){prefetchReferenceData(key(projectId,sharedView),()=>request(projectId));}
