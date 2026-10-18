import 'server-only';
import {createHash} from 'node:crypto';
import {PDFArray,PDFDict,PDFDocument,PDFHexString,PDFName,PDFNumber,PDFObject,PDFRawStream,PDFRef,PDFString,StandardFonts,rgb} from 'pdf-lib';
import type {DdReportChapterSummary,DdReportEdition} from './dd-report-types';
import {ddPdfLocation,ddReportFilename,type DdPdfIndex} from './dd-report-navigation';

const pdfText=(value:PDFObject|undefined)=>value instanceof PDFString||value instanceof PDFHexString?value.decodeText():undefined;
export async function readDdPdfIndex(bytes:Uint8Array):Promise<DdPdfIndex>{
  const doc=await PDFDocument.load(bytes),value=doc.catalog.get(PDFName.of('DdReportIndex'));
  const raw=value instanceof PDFString?Buffer.from(value.asBytes()).toString('utf8'):pdfText(value);
  if(!raw)throw Error('PDFの参照目次が不足している');return JSON.parse(raw);
}

/** Resolve references only after the complete set of independently rendered pages is joined. */
export async function finalizeDdPdfNavigation(doc:PDFDocument,edition:DdReportEdition,chapters:DdReportChapterSummary[],slug:string){
  const pages=doc.getPages(),index:DdPdfIndex={},markers=new Set<PDFDict>();
  const annotations=pages.flatMap((page,pageIndex)=>{
    const a=page.node.Annots();if(!a)return [];
    return a.asArray().flatMap(ref=>{const dict=doc.context.lookup(ref);if(!(dict instanceof PDFDict))return [];
      const action=dict.lookupMaybe(PDFName.of('A'),PDFDict),uri=action&&pdfText(action.get(PDFName.of('URI')));if(!uri)return [];
      let url:URL;try{url=new URL(uri,'https://amd-os-pwa.vercel.app');}catch{return [];}
      if(url.searchParams.get('pdfAnchor')==='1'){
        const chapter=url.searchParams.get('chapter')!,key=chapter+url.hash,rect=dict.lookup(PDFName.of('Rect'),PDFArray),x=rect.lookup(0,PDFNumber).asNumber(),y=rect.lookup(3,PDFNumber).asNumber();
        index[key]??={page:pageIndex+1,x,y};markers.add(dict);
        if(url.hash.startsWith('#cell-'))index[chapter+'#section-'+url.hash.replace(/^#cell-[A-Z]+/,'')]??=index[key];
      }
      return [{dict,action:action!,uri,url}];
    });
  });
  for(const c of chapters)if(!index[c.slug])throw Error('PDF本文の参照先が不足: '+c.slug);
  const destination=(at:{page:number;x:number;y:number})=>doc.context.obj([pages[at.page-1].ref,PDFName.of('XYZ'),at.x,at.y,null]);
  for(const {dict,action,url} of annotations){
    if(markers.has(dict))continue;
    const target=chapters.find(c=>c.slug===url.searchParams.get('chapter'));
    if(url.origin==='https://amd-os-pwa.vercel.app'&&url.pathname===`/dd/${encodeURIComponent(slug)}`&&target){
      const exact=index[target.slug+url.hash],at=exact??ddPdfLocation(index,target.slug);
      if(url.hash.startsWith('#cell-')&&!exact&&index[target.slug+'#excel-tables']){
        // The referenced table lives in the companion workbook; its sheet/cell remain explicit.
        action.set(PDFName.of('URI'),PDFString.of(encodeURI(ddReportFilename(edition,'xlsx'))));
        dict.set(PDFName.of('Contents'),PDFHexString.fromText(`同梱Excel「${target.source_sheet.replaceAll('損益・資金繰','資金繰表')}」!${url.hash.slice(6)}`));
      }else if(at){dict.delete(PDFName.of('A'));dict.set(PDFName.of('Dest'),destination(at));}
    }else if((url.pathname===`/api/dd/${encodeURIComponent(slug)}/report/export`&&url.searchParams.get('format')==='xlsx')||decodeURIComponent(url.pathname).endsWith('/'+ddReportFilename(edition,'xlsx'))){
      action.set(PDFName.of('URI'),PDFString.of(encodeURI(ddReportFilename(edition,'xlsx'))));
    }
  }
  for(const page of pages){const a=page.node.Annots();if(a)for(let i=a.size()-1;i>=0;i--)if(markers.has(a.lookup(i,PDFDict)))a.remove(i);}
  doc.catalog.set(PDFName.of('DdReportIndex'),PDFString.of(JSON.stringify(index)));
  const root=doc.context.obj({Type:'Outlines'}),rootRef=doc.context.register(root),entries=chapters.map(c=>doc.context.obj({Title:PDFHexString.fromText(c.title==='UE'?'UE（ユニットエコノミクス）':c.title),Parent:rootRef,Dest:destination(index[c.slug])})),refs=entries.map(e=>doc.context.register(e));
  entries.forEach((entry,i)=>{if(i)entry.set(PDFName.of('Prev'),refs[i-1]);if(i+1<refs.length)entry.set(PDFName.of('Next'),refs[i+1]);});
  if(refs.length){root.set(PDFName.of('First'),refs[0]);root.set(PDFName.of('Last'),refs.at(-1)!);root.set(PDFName.of('Count'),PDFNumber.of(refs.length));doc.catalog.set(PDFName.of('Outlines'),rootRef);}
  const dests=doc.context.obj({Names:[...chapters].sort((a,b)=>a.slug.localeCompare(b.slug)).flatMap(c=>[PDFString.of(c.slug),destination(index[c.slug])])});
  doc.catalog.set(PDFName.of('Names'),doc.context.obj({Dests:dests}));
  const font=await doc.embedFont(StandardFonts.Helvetica);
  pages.forEach((page,i)=>{page.drawText('CONFIDENTIAL',{x:24,y:12,size:8,font,color:rgb(.6,.15,.15)});const text=`${i+1} / ${pages.length}`;page.drawText(text,{x:page.getWidth()-font.widthOfTextAtSize(text,8)-24,y:12,size:8,font,color:rgb(.32,.41,.46)});});
  return index;
}

/** Reuse byte-identical streams only, including their complete PDF dictionaries. */
export function deduplicateDdPdfStreams(pdf:PDFDocument){
  const canonical=new Map<string,PDFRef>(),aliases=new Map<PDFRef,PDFRef>();
  for(const [ref,object] of pdf.context.enumerateIndirectObjects())if(object instanceof PDFRawStream){
    const hash=createHash('sha256').update(object.dict.toString()).update(object.getContents()).digest('hex');
    const previous=canonical.get(hash);if(previous)aliases.set(ref,previous);else canonical.set(hash,ref);
  }
  const visited=new Set<PDFObject>();
  const rewrite=(object:PDFObject):PDFObject=>{
    if(object instanceof PDFRef)return aliases.get(object)??object;
    if(visited.has(object))return object;visited.add(object);
    if(object instanceof PDFRawStream)rewrite(object.dict);
    else if(object instanceof PDFDict)for(const [key,value] of object.entries())object.set(key,rewrite(value));
    else if(object instanceof PDFArray)for(let i=0;i<object.size();i++)object.set(i,rewrite(object.get(i)));
    return object;
  };
  for(const [,object] of pdf.context.enumerateIndirectObjects())rewrite(object);
  for(const ref of aliases.keys())pdf.context.delete(ref);
  return aliases.size;
}
