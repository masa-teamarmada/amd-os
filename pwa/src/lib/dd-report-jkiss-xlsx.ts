import {strFromU8,strToU8} from 'fflate';
/** Four summary amounts use billions of yen; original model cells and all dependent calculations stay in yen. */
export function scaleDdJkissSummary(files:Record<string,Uint8Array>,sheetPath:string|undefined){
  if(!sheetPath||!files[sheetPath])return;
  let styles=strFromU8(files['xl/styles.xml']),xml=strFromU8(files[sheetPath]);
  const cellXfs=styles.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/);if(!cellXfs)throw new Error('Excel styles missing');
  const xfs=[...cellXfs[1].matchAll(/<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g)].map(m=>m[0]),newStyles=new Map<string,number>();
  for(const address of ['B177','F177','N177','R177']){
    const pattern=new RegExp(`<((?:[\\w.-]+:)?c)\\b[^>]*\\br="${address}"[^>]*>[\\s\\S]*?<\\/\\1>`);
    xml=xml.replace(pattern,cell=>{
      const old=cell.match(/\bs="(\d+)"/)?.[1]??'0';let style=newStyles.get(old);
      if(style===undefined){style=xfs.length;newStyles.set(old,style);xfs.push(xfs[Number(old)].replace(/numFmtId="\d+"/,'numFmtId="2"'));}
      let result=cell.replace(/\bs="\d+"/,`s="${style}"`);
      result=result.replace(/<((?:[\w.-]+:)?v)>([^<]+)<\/\1>/,(_m,t,v)=>`<${t}>${Number(v)/1e8}</${t}>`);
      result=result.replace(/<((?:[\w.-]+:)?f)(\b[^>]*)>([\s\S]*?)<\/\1>/,(_m,t,a,f)=>`<${t}${a}>(${f})/100000000</${t}>`);
      return result;
    });
  }
  styles=styles.replace(cellXfs[0],`<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>`);
  // The values themselves carry the displayed unit in the column headings.
  for(const address of ['B176','F176','N176','R176']){
    const re=new RegExp(`(<(?:[\\w.-]+:)?c\\b[^>]*\\br="${address}"[^>]*>[\\s\\S]*?<[^>]*t[^>]*>)([^<]+)`);
    xml=xml.replace(re,(_m,start,text)=>start+text+'（億円）');
  }
  files[sheetPath]=strToU8(xml);files['xl/styles.xml']=strToU8(styles);
}
