import type {DdReportEdition} from './dd-report-types';

export type DdPdfLocation={page:number;x:number;y:number};
export type DdPdfIndex=Record<string,DdPdfLocation>;
export function ddReportVersionLabel(edition:Pick<DdReportEdition,'revision'|'document_version'>){
  return edition.document_version?`v${edition.document_version}`:`r${edition.revision}`;
}
export function ddReportFilename(edition:Pick<DdReportEdition,'title'|'revision'|'document_version'>,format:'pdf'|'xlsx'){
  const company=edition.title.split('｜')[0].replace(/[\\/\x00-\x1f]/g,'_');
  return `${company}_DD_${format==='pdf'?'本文・図解':'数値計画・一覧表'}_${ddReportVersionLabel(edition)}.${format}`;
}
export function ddReportBundleFilename(edition:Pick<DdReportEdition,'title'|'revision'|'document_version'>){
  const company=edition.title.split('｜')[0].replace(/[\\/\x00-\x1f]/g,'_');
  return `${company}_DD_PDF+Excel_${ddReportVersionLabel(edition)}.zip`;
}
export function ddPdfMarker(slug:string,chapter:string,address?:string){
  return `https://amd-os-pwa.vercel.app/dd/${encodeURIComponent(slug)}?chapter=${encodeURIComponent(chapter)}&pdfAnchor=1${address?'#cell-'+address:''}`;
}
export function ddPdfLocation(index:DdPdfIndex|undefined,chapter:string,address?:string){
  return index?.[chapter+(address?'#cell-'+address:'')]??index?.[chapter];
}

export const DD_READING_PRIORITY=['source-index','business-plan','equity-story','capital-plan','financial-plan','unit-economics','production-plan'];
export function orderDdReading<T extends {slug:string;sort_order:number}>(chapters:T[]){const rank=(c:T)=>c.slug==='assumptions'?1e6:DD_READING_PRIORITY.includes(c.slug)?DD_READING_PRIORITY.indexOf(c.slug):100+c.sort_order;return [...chapters].sort((a,b)=>rank(a)-rank(b));}
