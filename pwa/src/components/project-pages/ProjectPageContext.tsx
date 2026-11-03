'use client';
import {createContext,useContext} from 'react';
import type {ProjectPageRuntime} from '../../lib/project-page-runtime-types';
import type {CanonicalReportNavigation} from '../../lib/project-canonical-links';
export type ProjectPageEnvironment={
  endpoint:(pageId:string)=>string;
  reportEndpoint:(pageId:string)=>string;
  navigation:CanonicalReportNavigation;
  navigate:(pageId:string)=>void;
  location:(pageId:string)=>string;
};
export const ProjectPageEnvironmentContext=createContext<ProjectPageEnvironment|null>(null);
export const ProjectPageRuntimeContext=createContext<ProjectPageRuntime|null>(null);
export function useProjectPageEnvironment(){const value=useContext(ProjectPageEnvironmentContext);if(!value)throw new Error('ページの入口が未設定');return value;}
export function useProjectPageRuntime(){return useContext(ProjectPageRuntimeContext);}

export const ProjectPageRefreshContext=createContext<(()=>Promise<ProjectPageRuntime>)|null>(null);
export function useProjectPageRefresh(){return useContext(ProjectPageRefreshContext);}

export function useOptionalProjectPageEnvironment(){return useContext(ProjectPageEnvironmentContext);}
