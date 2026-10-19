import {ddEscapeHtml} from './dd-confidentiality';
import type {DdReportInput} from './dd-report-types';

/** The immutable source workbook may contain list choices superseded by the current model. */
export function syncDdListValidation(xml:string,inputs:DdReportInput[]) {
  const lists=new Map(inputs.filter(i=>i.options?.length).map(i=>[i.address,i.options!]));
  return xml.replace(/<((?:[\w.-]+:)?dataValidation)\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?dataValidation>/g,(whole,tag:string,attrs:string,body:string)=>{
    if(!/\btype="list"/.test(attrs))return whole;
    const refs=(attrs.match(/\bsqref="([^"]+)"/)?.[1]??'').trim().split(/\s+/);
    // Shared/range rules retain their original semantics; single-cell model choices are authoritative.
    if(refs.length!==1||refs[0].includes(':'))return whole;
    const options=lists.get(refs[0]);if(!options)return whole;
    const literal='"'+options.map(v=>v.replaceAll('"','""')).join(',')+'"';
    if(options.some(v=>v.includes(','))||literal.length>255)return whole;
    const prefix=tag.includes(':')?tag.slice(0,tag.indexOf(':')+1):'';
    const formula=`<${prefix}formula1>${ddEscapeHtml(literal)}</${prefix}formula1>`;
    const updated=/<(?:[\w.-]+:)?formula1\b/.test(body)?body.replace(/<(?:[\w.-]+:)?formula1\b[^>]*>[\s\S]*?<\/(?:[\w.-]+:)?formula1>/,formula):formula+body;
    return `<${tag}${attrs}>${updated}</${tag}>`;
  });
}
