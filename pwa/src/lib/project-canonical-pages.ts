import type {ProjectSurface} from './project-surface-permissions.ts';
import {COCKPIT_TAB_FORMATS,WORKSPACE_TAB_FORMATS,PROJECT_REPORT_CATALOG_VISIBILITY,type ProjectFormatType} from './project-formats.ts';

/** 本文と計算の採用元。スペース別の本文を追加しない。入口と操作認可は呼出側が管理する。 */
export const PROJECT_CANONICAL_PAGES = {
  gantt:{chapters:['daily-execution-plan'],records:'gantt',label:'実行ガント・担当・依存関係'},
  activity:{chapters:['progress','gap-fund'],records:'activity',label:'助成金・支援業務の原記録'},
  partners:{chapters:['partners'],records:'partners',label:'関係先の原記録と進行管理'},
  technology:{chapters:['technology'],records:'technology',label:'技術の原記録・条件・出所'},
  'poc-list':{chapters:['poc'],records:'poc-list',label:'実験原記録と元グラフ'},
  competition:{chapters:['competition'],records:'competition',label:'競合評価の原記録と出所'},
  'business-model':{chapters:['business-model'],records:'business-model',label:'商流の原記録と出所'},
  'business-plan':{chapters:['business-plan'],records:'business-plan',label:'フェーズ比較と元の登録計画'},
  'development-issues':{chapters:['development-issues'],records:'development-issues',label:'開発課題の登録記録'},
  'financial-projection':{chapters:['financial-plan'],records:'financial-projection',label:'登録PL・CF・比較案の入力'},
  'capital-plan':{chapters:['capital-plan'],records:'capital-plan',label:'資本プランの編集・履歴・比較'},
  'cost-model':{chapters:['unit-economics','cyanobacteria-cost','reactor-cost','metal-cost','fame-cost'],records:'cost-model',label:'競合試算・登録条件・作業明細'},
  ip:{chapters:['ip-contracts'],records:'ip',label:'知財ID・権利関係・期限管理'},
  company:{chapters:['company'],records:'company',label:'会社の確定情報・決算・会議体'},
  'organization-chart':{chapters:['organization'],records:'organization-chart',label:'以前の組織図・登録内容'},
  contracts:{chapters:['contracts'],records:'contracts',label:'契約原本・全版・経緯'},
} as const;
export type ProjectReportPageKey=`report:${string}`;
export type ProjectCanonicalPageKey=keyof typeof PROJECT_CANONICAL_PAGES|ProjectReportPageKey;
type CanonicalDefinition={chapters:readonly string[];records:string|null;label:string};
type CanonicalMenu={pageLabels:Readonly<Record<string,string>>;technicalTabs:readonly string[];technicalLabel:string};
const DEFAULT_CANONICAL_MENU:CanonicalMenu={pageLabels:{'development-issues':'技術課題と検証計画'},technicalTabs:['technology','report:technical-development-plan','development-issues','poc-list'],technicalLabel:'技術と実証'};
/** 共通ページの採用元と配置を同じ登録情報に置く。画面でPJ番号を判定しない。 */

export function canonicalMenuConfiguration(projectId?:string,chapters:readonly string[]=[]):CanonicalMenu{return chapters.includes('development-issues')?DEFAULT_CANONICAL_MENU:{pageLabels:{},technicalTabs:[],technicalLabel:'技術と実証'};}
export function isProjectReportPageKey(key:string):key is ProjectReportPageKey{return /^report:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key);}
/** DD専用だった章も同じ本文定義を使う。新しい入口は表示設定に report:章名 を追加するだけ。 */
export function canonicalPageDefinition(page:ProjectCanonicalPageKey,projectId?:string):CanonicalDefinition{
  return isProjectReportPageKey(page)?{chapters:[page.slice(7)],records:null,label:''}:PROJECT_CANONICAL_PAGES[page];
}
export function canonicalPageKey(key:string):ProjectCanonicalPageKey|null {
  const normalized=key==='cost'||key==='cost-fuel'?'cost-model':key==='monthly-trial'?'financial-projection':key;
  return Object.hasOwn(PROJECT_CANONICAL_PAGES,normalized)||isProjectReportPageKey(normalized)?normalized as ProjectCanonicalPageKey:null;
}
export function canonicalPageForChapter(chapter:string):ProjectCanonicalPageKey|null {
  // 技術課題と技術開発計画を別の共通ページとして保持する。
  if(chapter==='development-issues')return 'development-issues';
  return (Object.entries(PROJECT_CANONICAL_PAGES).find(([key,value])=>key!=='development-issues'&&(value.chapters as readonly string[]).includes(chapter))?.[0] as ProjectCanonicalPageKey|undefined)??(isProjectReportPageKey(`report:${chapter}`)?`report:${chapter}`:null);
}
export function canonicalPageVisible(page:ProjectCanonicalPageKey,surface:ProjectSurface,type:ProjectFormatType) {
  if(surface==='dd'||surface==='cockpit'&&PROJECT_REPORT_CATALOG_VISIBILITY.cockpit==='all'&&isProjectReportPageKey(page))return true;
  const format=surface==='cockpit'?COCKPIT_TAB_FORMATS[type]:WORKSPACE_TAB_FORMATS[type];
  return format.some(group=>group.tabs.some(key=>canonicalPageKey(key)===page));
}
export function canonicalReportChapterAllowed(page:ProjectCanonicalPageKey,chapter:string,projectId?:string){return canonicalPageDefinition(page,projectId).chapters.includes(chapter);}
export function canonicalReportPath(projectId:string,surface:ProjectSurface,page:string,slug?:string){
  const query=new URLSearchParams({surface,page});if(slug)query.set('slug',slug);
  return `/api/project/${encodeURIComponent(projectId)}/canonical-page?${query}`;
}
