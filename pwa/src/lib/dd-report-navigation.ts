import type {DdReportEdition} from './dd-report-types';

export type DdPdfLocation={page:number;x:number;y:number};
export type DdPdfIndex=Record<string,DdPdfLocation>;
export function ddReportFilename(edition:Pick<DdReportEdition,'title'|'revision'>,format:'pdf'|'xlsx'){
  const company=edition.title.split('｜')[0].replace(/[\\/\x00-\x1f]/g,'_');
  return `${company}_DD_${format==='pdf'?'本文・図解':'数値計画・一覧表'}_r${edition.revision}.${format}`;
}
export function ddPdfMarker(slug:string,chapter:string,address?:string){
  return `https://amd-os-pwa.vercel.app/dd/${encodeURIComponent(slug)}?chapter=${encodeURIComponent(chapter)}&pdfAnchor=1${address?'#cell-'+address:''}`;
}
export function ddPdfLocation(index:DdPdfIndex|undefined,chapter:string,address?:string){
  return index?.[chapter+(address?'#cell-'+address:'')]??index?.[chapter];
}
