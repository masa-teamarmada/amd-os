'use client';
import {createContext,useContext} from 'react';
import type {DdReportChapter} from '../../lib/dd-report-types';
export type CanonicalCapitalTemplate={chapter:DdReportChapter;documentVersion:string};
export const CanonicalCapitalTemplateContext=createContext<CanonicalCapitalTemplate|null|undefined>(undefined);
export const useCanonicalCapitalTemplate=()=>useContext(CanonicalCapitalTemplateContext);
