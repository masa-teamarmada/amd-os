import 'server-only';
import {deduplicateDdPdfStreams} from './dd-report-pdf';
import {renderToReadableStream} from 'react-dom/server.edge';
import {strFromU8,strToU8,unzipSync,zipSync} from 'fflate';
import {DdReportContent} from '@/components/dd/report/DdReportContent';
import {DD_REPORT_CSS} from '@/components/dd/report/dd-report-style';
import {DdReportCalculator,ddAddress,ddColumn} from './dd-report-model';
import type {DdReportChapter,DdReportChapterSummary,DdReportEdition,DdReportModel,DdReportValue} from './dd-report-types';
import {DD_CONFIDENTIALITY_LABEL,DD_CONFIDENTIALITY_NOTICE,ddEscapeHtml} from './dd-confidentiality';
import {projectDdWorkbook} from './dd-report-workbook';

export function orderedDdChapters<T extends {slug:string;sort_order:number}>(chapters:T[]){return [...chapters].sort((a,b)=>a.slug==='source-index'?-1:b.slug==='source-index'?1:a.sort_order-b.sort_order);}
export async function ddReportHtml({edition,chapters,index,slug,assetUrls,includeCover=true,includeGlossary=true,glossaryAll=false}:{edition:DdReportEdition;chapters:DdReportChapter[];index:DdReportChapterSummary[];slug:string;assetUrls:Record<string,string>;includeCover?:boolean;includeGlossary?:boolean;glossaryAll?:boolean}) {
  const ordered=orderedDdChapters(chapters);
  const stream=await renderToReadableStream(<html lang="ja"><head><meta charSet="utf-8"/><base href="https://amd-os-pwa.vercel.app"/><title>{edition.title}</title><style>{DD_REPORT_CSS+`
    body{margin:0;padding:16px;background:white;font-family:'Noto Sans JP Variable',sans-serif} .ddr{font-size:14px}.ddr p{max-width:none}.ddr-chapter{break-before:auto;margin-top:28px}.ddr-table-scroll{max-height:none;overflow:visible}.ddr table{font-size:11px}.ddr-table-scroll{width:100%;min-width:0!important}.ddr table{width:100%;table-layout:fixed}.ddr td,.ddr th{min-width:0!important;padding:4px 6px}.ddr td:first-child,.ddr th:first-child{width:auto!important}.ddr-wide td,.ddr .ddr-number{white-space:normal;overflow-wrap:anywhere}.ddr-equity-flow{grid-template-columns:repeat(2,minmax(0,1fr))}.ddr-phase>div{font-size:12px}.ddr-phase{break-inside:avoid}.ddr-equity-flow>.ddr-phase:nth-child(n){grid-column:auto;grid-row:auto}.ddr-flow-arrow{display:none}.ddr-chart svg{min-width:0}.ddr h2{break-after:avoid}.ddr p{orphans:2;widows:2}.ddr-image img{max-height:1000px}.ddr-header{padding:4px 0 8px;margin:0 0 12px}.ddr-header h1{font-size:24px}.ddr-header p{margin-bottom:6px}.ddr-directory{columns:2;column-gap:16px}.ddr-directory-priority .ddr-directory-entries{grid-template-columns:repeat(2,minmax(0,1fr));column-gap:16px}.ddr-directory-group{margin-bottom:8px}.ddr-directory-group h3{font-size:11px;line-height:16px;margin:0 0 2px;padding:0 0 2px}.ddr .ddr-directory-item{grid-template-columns:18px 122px minmax(0,1fr);gap:4px;padding:2px 0;line-height:14px}.ddr-directory-title,.ddr-directory-number{font-size:10.5px}.ddr-directory-description{font-size:10px;white-space:normal;overflow:visible;line-height:14px}.ddr-org-scroll{overflow:visible}.ddr-org{padding:0;break-inside:avoid}.ddr-org-node{font-size:11px;line-height:1.4;padding:6px;margin:6px}.ddr-org-lead{margin:0}.ddr-org-stem{height:64px}.ddr-org-advisor{top:6px;left:8px;width:124px;font-size:10px;padding:6px}.ddr-org-advisor:before{left:-9px;width:8px}.ddr-org-dept h3{padding:8px;font-size:12px}.ddr-org>p{font-size:10px;margin-top:12px}.ddr-proof{font-size:10px;color:#526874;border-top:1px solid #d6e1e5;padding:10px 0;margin-top:24px} tr{break-inside:avoid}
  `}</style></head><body><main className="ddr">
    {includeCover&&<header className="ddr-header"><div className="ddr-kicker">{DD_CONFIDENTIALITY_LABEL}</div><h1>{edition.title}</h1><p>本文・図解版 · 資料版 {edition.revision} · 移行元 {edition.source_version}</p><p><a href={`/api/dd/${encodeURIComponent(slug)}/report/export?format=xlsx&scope=all&revision=${edition.revision}`}>表・計算モデルをExcelでダウンロード ↗</a></p><p style={{fontSize:11}}>{DD_CONFIDENTIALITY_NOTICE}</p></header>}
    {ordered.map(chapter=><section data-chapter={chapter.slug} className="ddr-chapter" key={chapter.id}><div className="ddr-kicker">{chapter.group_label}</div><h1>{chapter.title==='UE'?'UE（ユニットエコノミクス）':chapter.title}</h1><DdReportContent chapter={chapter} revision={edition.revision} slug={slug} index={index} assetUrls={assetUrls} glossary={edition.glossary} allRows/><p className="ddr-proof">{DD_CONFIDENTIALITY_LABEL} · 資料版 {edition.revision} · {chapter.title}</p></section>)}
    {includeGlossary&&Object.keys(edition.glossary??{}).length>0&&<section className="ddr-chapter"><h1>専門用語の説明</h1><table><colgroup><col style={{width:'22%'}}/><col style={{width:'78%'}}/></colgroup><tbody>{Object.entries(edition.glossary??{}).filter(([term])=>glossaryAll||index.length===chapters.length||chapters.some(c=>c.body.rows.some(r=>r.cells.some(v=>typeof v.value==='string'&&v.value.includes(term))))).map(([term,entry])=><tr key={term}><th>{term}</th><td>{entry.definition}{entry.sourceUrl&&<> <a href={entry.sourceUrl}>{entry.sourceLabel} ↗</a></>}</td></tr>)}</tbody></table></section>}
  </main></body></html>);
  return new Response(stream).text();
}

/** Bound each Chromium document so the complete package stays within server memory/time limits. */
export async function ddReportPdf(args:Parameters<typeof ddReportHtml>[0],render:(html:string)=>Promise<Uint8Array>):Promise<Uint8Array>{
  const {PDFDocument}=await import('pdf-lib');
  const chapters=orderedDdChapters(args.chapters),output=await PDFDocument.create();
  for(let offset=0;offset<chapters.length;offset+=4){
    const started=Date.now(),part=chapters.slice(offset,offset+4);
    const bytes=await render(await ddReportHtml({...args,chapters:part,includeCover:args.includeCover!==false&&offset===0,includeGlossary:args.includeGlossary!==false&&offset+4>=chapters.length,glossaryAll:args.glossaryAll??args.chapters.length===args.index.length}));
    const pdf=await PDFDocument.load(bytes),pages=await output.copyPages(pdf,pdf.getPageIndices());for(const page of pages)output.addPage(page);
    console.info('DD PDF section batch',{batch:offset/4+1,chapters:part.length,pages:pages.length,ms:Date.now()-started});
  }
  output.setTitle(args.edition.title);output.setSubject(`DD revision ${args.edition.revision}; source ${args.edition.source_version}`);
  deduplicateDdPdfStreams(output);return output.save();
}

function xmlCell(original:string,value:DdReportValue,formula:boolean) {
  const prefix=original.match(/^<([\w.-]+:)?c\b/)?.[1]??'';
  const attrs=original.slice(0,original.indexOf('>')+1).replace(/\s+t="[^"]*"/g,'').replace(/\/>$/,'>');
  const f=formula?(original.match(/<(?:[\w.-]+:)?f\b[^>]*(?:\/>|>[\s\S]*?<\/(?:[\w.-]+:)?f>)/)?.[0]??''):'';
  if(value===null)return attrs+f+`</${prefix}c>`;
  const scalar=typeof value==='number'?String(value):typeof value==='boolean'?value?'1':'0':ddEscapeHtml(String(value));
  if(typeof value==='string')return attrs.replace(/>$/,' t="'+(formula?'str':'inlineStr')+'">')+f+(formula?`<${prefix}v>${scalar}</${prefix}v>`:`<${prefix}is><${prefix}t xml:space="preserve">${scalar}</${prefix}t></${prefix}is>`)+`</${prefix}c>`;
  return attrs.replace(/>$/,typeof value==='boolean'?' t="b">':'>')+f+`<${prefix}v>${scalar}</${prefix}v></${prefix}c>`;
}
/** Preserve native formulas, chart objects, validations, styles and Excel data tables. */
export function ddReportXlsx(source:Uint8Array,edition:DdReportEdition,model:DdReportModel,chapters:DdReportChapter[],redact:(text:string)=>string=(s)=>s,focusSheet?:string,reportHref='https://amd-os-pwa.vercel.app/dd') {
  const files=unzipSync(source),calc=new DdReportCalculator(model,edition.input_overrides),edited=new Map(chapters.map(ch=>[ch.source_sheet,new Map(ch.body.rows.flatMap(r=>r.cells).filter(c=>!c.formula&&typeof c.value==='string').map(c=>[c.address,c.value]))]));
  for(const [sheet,data]of Object.entries(model.sheets)){
    let xml=strFromU8(files[data.path]);
    xml=xml.replace(/<(?:[\w.-]+:)?c\b[^>]*?\br="([A-Z]+\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/(?:[\w.-]+:)?c>)/g,(cell,address:string)=>{
      const entry=data.cells[address];if(!entry)return cell;
      let value=edited.get(sheet)?.get(address)??calc.get(sheet,address);
      if(typeof value==='string')value=redact(value);
      const patch=model.formulaPatches?.[`${sheet}!${address}`];
      const originalCell=patch?cell.replace(/<((?:[\w.-]+:)?f)\b([^>]*?)>[\s\S]*?<\/(?:[\w.-]+:)?f>/,(_f,tag:string,attrs:string)=>`<${tag}${attrs}>${ddEscapeHtml(patch)}</${tag}>`):cell;
      return xmlCell(originalCell,value,Boolean(entry.f)||/<(?:[\w.-]+:)?f\b/.test(cell));
    }).replace(/zoomScale="\d+"/g,'zoomScale="100"');
    if(focusSheet)xml=xml.replace(/tabSelected="[01]"/g,`tabSelected="${sheet===focusSheet?'1':'0'}"`);
    // Source files can already contain a print notice; replace it, never append a duplicate element.
    const prefix=xml.match(/<([\w.-]+:)?worksheet\b/)?.[1]??'';
    const footer=`<${prefix}headerFooter><${prefix}oddHeader>&amp;C&amp;BCONFIDENTIAL · DD r${edition.revision}</${prefix}oddHeader></${prefix}headerFooter>`;
    if(/<(?:[\w.-]+:)?headerFooter\b/.test(xml))xml=xml.replace(/<(?:[\w.-]+:)?headerFooter\b[\s\S]*?<\/(?:[\w.-]+:)?headerFooter>/,footer);
    else xml=xml.replace(/<(?:[\w.-]+:)?(?:rowBreaks|colBreaks|customProperties|cellWatches|ignoredErrors|smartTags|drawing|legacyDrawing|legacyDrawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)\b|<\/(?:[\w.-]+:)?worksheet>/,match=>footer+match);
    const chapter=chapters.find(c=>c.source_sheet===sheet),relsPath=data.path.replace(/\/([^/]+)$/,'/_rels/$1.rels');
    if(chapter&&files[relsPath]){
      const targets=new Map(chapter.body.rows.flatMap(r=>r.cells).filter(c=>/^https?:\/\//i.test(c.link??'')).map(c=>[c.address,c.link!]));
      const ids=new Map([...xml.matchAll(/<(?:[\w.-]+:)?hyperlink\b[^>]*\bref="([A-Z]+\d+)"[^>]*\br:id="([^"]+)"[^>]*\/>/g)].flatMap(m=>targets.has(m[1])?[[m[2],targets.get(m[1])!] as const]:[]));
      files[relsPath]=strToU8(strFromU8(files[relsPath]).replace(/<Relationship\b[^>]*\/>/g,rel=>{const target=ids.get(rel.match(/\bId="([^"]+)"/)?.[1]??'');return target?rel.replace(/\bTarget="[^"]*"/,`Target="${ddEscapeHtml(target)}"`):rel;}));
    }
    files[data.path]=strToU8(xml);
  }
  // Prose and original figures are supplied in PDF/HTML. Excel retains every text and numerical sheet.
  for(const path of Object.keys(files)){
    if(/^xl\/drawings\/[^/]+\.xml$/.test(path))files[path]=strToU8(strFromU8(files[path]).replace(/<xdr:(twoCellAnchor|oneCellAnchor|absoluteAnchor)\b[\s\S]*?<\/xdr:\1>/g,a=>a.includes('<xdr:pic>')?'':a));
    if(/^xl\/drawings\/_rels\/.*\.rels$/.test(path))files[path]=strToU8(strFromU8(files[path]).replace(/<Relationship\b[^>]*Type="[^"]*\/image"[^>]*\/>/g,''));
    if(/^xl\/media\//.test(path))delete files[path];
    if(path.endsWith('.xml')&&strFromU8(files[path].subarray(0,1500)).includes('<c:chartSpace')){
      files[path]=strToU8(strFromU8(files[path]).replace(/<c:numRef>[\s\S]*?<\/c:numRef>/g,ref=>{
        const f=ref.match(/<c:f>([^<]+)<\/c:f>/)?.[1],m=/^'?([^'!]+)'?!\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/.exec(f??'');if(!m)return ref;
        const a=ddAddress(m[2]+m[3]),b=ddAddress(m[4]+m[5]),values=[];
        for(let r=a.row;r<=b.row;r++)for(let c=a.col;c<=b.col;c++)values.push(Number(calc.get(m[1],ddColumn(c)+r))||0);
        return ref.replace(/<c:numCache>[\s\S]*?<\/c:numCache>/,`<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${values.length}"/>${values.map((v,i)=>`<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('')}</c:numCache>`);
      }));
    }
  }
  if(files['xl/sharedStrings.xml'])files['xl/sharedStrings.xml']=strToU8(redact(strFromU8(files['xl/sharedStrings.xml'])));
  files['xl/workbook.xml']=strToU8(strFromU8(files['xl/workbook.xml']).replace(/<calcPr\b[^>]*\/>/,'<calcPr calcId="191029" fullCalcOnLoad="1" forceFullCalc="1"/>'));
  delete files['xl/calcChain.xml'];
  files['xl/_rels/workbook.xml.rels']=strToU8(strFromU8(files['xl/_rels/workbook.xml.rels']).replace(/<Relationship\b[^>]*Type="[^"]*\/calcChain"[^>]*\/>/g,''));
  files['[Content_Types].xml']=strToU8(strFromU8(files['[Content_Types].xml']).replace(/<Override\b[^>]*PartName="\/xl\/calcChain.xml"[^>]*\/>/g,''));
  const projected=projectDdWorkbook(files,chapters,model,edition,reportHref);
  if(projected){const selected=focusSheet&&projected.includes(focusSheet)?focusSheet:projected[0];for(const name of projected){const p=model.sheets[name].path;files[p]=strToU8(strFromU8(files[p]).replace(/<(?:[\w.-]+:)?sheetView\b[^>]*>/g,view=>view.replace(/\s+tabSelected="[01]"/g,'').replace(/\/?>$/,` tabSelected="${name===selected?'1':'0'}"${view.endsWith('/>')?'/>':'>'}`)));}}
  if(focusSheet){const names=projected??[...strFromU8(files['xl/workbook.xml']).matchAll(/<sheet\b[^>]*name="([^"]+)"/g)].map(m=>m[1].replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&'));const position=names.indexOf(focusSheet);if(position>=0)files['xl/workbook.xml']=strToU8(strFromU8(files['xl/workbook.xml']).replace(/activeTab="\d+"/g,`activeTab="${position}"`));}
  // A harmless custom XML part identifies the same DB revision as PDF without adding a visible sheet.
  files['dd-report-version.json']=strToU8(JSON.stringify({title:edition.title,revision:edition.revision,sourceVersion:edition.source_version,sourceSha256:edition.source_sha256,...(projected?{contents:'numerical-model-and-tables',sheets:projected}:{})}));
  const contentTypes=strFromU8(files['[Content_Types].xml']);if(!contentTypes.includes('Extension="json"'))files['[Content_Types].xml']=strToU8(contentTypes.replace('</Types>','<Default Extension="json" ContentType="application/json"/></Types>'));
  return zipSync(files,{level:6});
}
