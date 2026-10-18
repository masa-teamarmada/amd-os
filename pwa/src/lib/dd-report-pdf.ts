import 'server-only';
import {createHash} from 'node:crypto';
import {PDFArray,PDFDict,PDFDocument,PDFObject,PDFRawStream,PDFRef} from 'pdf-lib';

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
