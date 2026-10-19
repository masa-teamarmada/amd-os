import {ddEscapeHtml} from './dd-confidentiality';

/** A formula edit can replace an original value or an empty worksheet cell. */
export function ddPatchWorksheetFormula(cell:string,formula:string):string {
  const prefix=cell.match(/^<([\w.-]+:)?c\b/)?.[1]??'';
  const node=`<${prefix}f>${ddEscapeHtml(formula)}</${prefix}f>`;
  const existing=/<(?:[\w.-]+:)?f\b[^>]*?(?:\/>|>[\s\S]*?<\/(?:[\w.-]+:)?f>)/;
  if(existing.test(cell))return cell.replace(existing,node);
  const expanded=cell.endsWith('/>')?cell.slice(0,-2)+`></${prefix}c>`:cell;
  return expanded.replace(/^(<(?:[\w.-]+:)?c\b[^>]*>)/,opening=>opening+node);
}
