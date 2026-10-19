import 'server-only';
import {deduplicateDdPdfStreams,finalizeDdPdfNavigation} from './dd-report-pdf';
import {ddPdfMarker,ddReportFilename,ddReportVersionLabel,orderDdReading,type DdPdfIndex} from './dd-report-navigation';
import {renderToReadableStream} from 'react-dom/server.edge';
import {strFromU8,strToU8,unzipSync,zipSync} from 'fflate';
import {DdReportContent} from '@/components/dd/report/DdReportContent';
import {DD_REPORT_CSS} from '@/components/dd/report/dd-report-style';
import {DdReportCalculator,ddAddress,ddColumn} from './dd-report-model';
import type {DdReportChapter,DdReportChapterSummary,DdReportEdition,DdReportModel,DdReportValue} from './dd-report-types';
import {DD_CONFIDENTIALITY_LABEL,DD_CONFIDENTIALITY_NOTICE,ddEscapeHtml} from './dd-confidentiality';
import {scaleDdJkissSummary} from './dd-report-jkiss-xlsx';
import {updateDdFundingChartXml} from './dd-report-funding-chart';
import {mergeDdDevelopmentForWorkbook,splitDdDevelopmentChapters,splitDdDevelopmentIndex} from './dd-report-development-plans';
import {splitDdDevelopmentWorkbook} from './dd-report-development-xlsx';
import {projectDdWorkbook} from './dd-report-workbook';
import {syncDdListValidation} from './dd-report-validation';

export const orderedDdChapters=orderDdReading;
export async function ddReportHtml({edition,chapters,index,slug,assetUrls,includeCover=true,includeGlossary=true,glossaryAll=false}:{edition:DdReportEdition;chapters:DdReportChapter[];index:DdReportChapterSummary[];slug:string;assetUrls:Record<string,string>;includeCover?:boolean;includeGlossary?:boolean;glossaryAll?:boolean}) {
  chapters=splitDdDevelopmentChapters(chapters);index=splitDdDevelopmentIndex(index);
  const ordered=orderedDdChapters(chapters);
  const stream=await renderToReadableStream(<html lang="ja"><head><meta charSet="utf-8"/><base href="https://amd-os-pwa.vercel.app"/><title>{edition.title}</title><style>{DD_REPORT_CSS+`
     .ddr-pdf-anchor{position:absolute;font-size:1px;line-height:1px;color:transparent!important;text-decoration:none!important}.ddr-pdf-heading{color:inherit!important;text-decoration:none!important} body{margin:0;padding:16px;background:white;font-family:'Noto Sans JP Variable',sans-serif} .ddr{font-size:13px}.ddr p{max-width:none}.ddr-chapter{break-before:auto;margin-top:28px}.ddr-chapter>.ddr-kicker,.ddr-chapter>h1{break-after:avoid;page-break-after:avoid}.ddr-table-scroll{max-height:none;overflow:visible}.ddr table{font-size:11px}.ddr-table-scroll{width:100%;min-width:0!important}.ddr table{width:100%;table-layout:fixed}.ddr td,.ddr th{min-width:0!important;padding:4px 6px}.ddr td:first-child,.ddr th:first-child{width:auto!important}.ddr-wide td,.ddr .ddr-number{white-space:normal;overflow-wrap:anywhere}.ddr-equity-flow{grid-template-columns:repeat(2,minmax(0,1fr))}.ddr-phase>div{font-size:12px}.ddr-phase{break-inside:avoid}.ddr-equity-flow>.ddr-phase:nth-child(n){grid-column:auto;grid-row:auto}.ddr-flow-arrow{display:none}.ddr-equity-scroll{overflow:visible;break-inside:avoid;page-break-inside:avoid}.ddr-equity-rounds{grid-template-columns:repeat(6,minmax(0,1fr))}.ddr-phase-gap{break-inside:avoid}.ddr-ue-process,.ddr-source-gantt,.ddr-source-flow{break-inside:avoid;page-break-inside:avoid}.ddr-chart svg{min-width:0}.ddr h2{break-after:avoid}.ddr p{orphans:2;widows:2}.ddr-image img{max-height:840px;width:auto;max-width:100%;object-fit:contain;margin-inline:auto}.ddr-header{padding:4px 0 8px;margin:0 0 12px}.ddr-header h1{font-size:24px}.ddr-header p{margin-bottom:6px}.ddr-directory{columns:2;column-gap:16px}.ddr-directory-priority .ddr-directory-entries{grid-template-columns:repeat(2,minmax(0,1fr));column-gap:16px}.ddr-directory-group{margin-bottom:8px}.ddr-directory-group h3{font-size:11px;line-height:16px;margin:0 0 2px;padding:0 0 2px}.ddr .ddr-directory-item{grid-template-columns:18px 122px minmax(0,1fr);gap:4px;padding:2px 0;line-height:14px}.ddr-directory-title,.ddr-directory-number{font-size:10.5px}.ddr-directory-description{font-size:10px;white-space:normal;overflow:visible;line-height:14px}.ddr-proof{font-size:10px;color:#526874;padding:0;margin:2px 0 8px;break-after:avoid} tr{break-inside:avoid}
  `}</style></head><body><main className="ddr">
    {includeCover&&<header className="ddr-header"><div className="ddr-kicker">{DD_CONFIDENTIALITY_LABEL}</div><h1>{edition.title}</h1><p>本文・図解版 · DD資料 {ddReportVersionLabel(edition)}</p><p>資料一覧としおりから本文の該当箇所へ移動できる。数値・条件・一覧の明細は、同じフォルダに保存した <a href={encodeURI(ddReportFilename(edition,'xlsx'))}>同梱Excel</a> の指定シートで確認する。</p><p style={{fontSize:11}}>{DD_CONFIDENTIALITY_NOTICE}</p></header>}
    {ordered.map(chapter=><section data-chapter={chapter.slug} className="ddr-chapter" key={chapter.id}><div className="ddr-kicker">{chapter.group_label}</div><h1><a className="ddr-pdf-heading" href={ddPdfMarker(slug,chapter.slug)}>{chapter.title==='UE'?'UE（ユニットエコノミクス）':chapter.title}</a></h1><p className="ddr-proof">{DD_CONFIDENTIALITY_LABEL} · DD資料 {ddReportVersionLabel(edition)} · {chapter.title}</p><DdReportContent chapter={chapter} revision={edition.revision} slug={slug} index={index} assetUrls={assetUrls} glossary={edition.glossary} allRows pdfWorkbookName={ddReportFilename(edition,'xlsx')}/></section>)}
    {includeGlossary&&Object.keys(edition.glossary??{}).length>0&&<section className="ddr-chapter"><h1>専門用語の説明</h1><table><colgroup><col style={{width:'22%'}}/><col style={{width:'78%'}}/></colgroup><tbody>{Object.entries(edition.glossary??{}).filter(([term])=>glossaryAll||index.length===chapters.length||chapters.some(c=>c.body.rows.some(r=>r.cells.some(v=>typeof v.value==='string'&&v.value.includes(term))))).map(([term,entry])=><tr key={term}><th>{term}</th><td>{entry.definition}{entry.sourceUrl&&<> <a href={entry.sourceUrl}>{entry.sourceLabel} ↗</a></>}</td></tr>)}</tbody></table></section>}
  </main></body></html>);
  return new Response(stream).text();
}

/** Bound each Chromium document so the complete package stays within server memory/time limits. */
export async function ddReportPdf(args:Parameters<typeof ddReportHtml>[0]&{deferNavigation?:boolean},render:(html:string,layout?:{pageWidthPx:number;pageHeightPx:number})=>Promise<Uint8Array>):Promise<Uint8Array>{
  args={...args,chapters:splitDdDevelopmentChapters(args.chapters),index:splitDdDevelopmentIndex(args.index)};
  const {PDFDocument}=await import('pdf-lib');
  const chapters=orderedDdChapters(splitDdDevelopmentChapters(args.chapters)),output=await PDFDocument.create();
  const batches:typeof chapters[]=[];let pending:typeof chapters=[];
  for(const chapter of chapters){
    if(chapter.slug==='equity-story'){if(pending.length)batches.push(pending);pending=[];batches.push([chapter]);}
    else {pending.push(chapter);if(pending.length===4){batches.push(pending);pending=[];}}
  }
  if(pending.length)batches.push(pending);
  for(const [batch,part]of batches.entries()){
    const started=Date.now(),wide=part.length===1&&part[0].slug==='equity-story';
    const bytes=await render(await ddReportHtml({...args,chapters:part,includeCover:args.includeCover!==false&&batch===0,includeGlossary:args.includeGlossary!==false&&batch===batches.length-1,glossaryAll:args.glossaryAll??args.chapters.length===args.index.length}),wide?{pageWidthPx:1588,pageHeightPx:1123}:undefined);
    const pdf=await PDFDocument.load(bytes),pages=await output.copyPages(pdf,pdf.getPageIndices());for(const page of pages)output.addPage(page);
    console.info('DD PDF section batch',{batch:batch+1,chapters:part.length,pages:pages.length,ms:Date.now()-started});
  }
  output.setTitle(args.edition.title);output.setSubject(`DD ${ddReportVersionLabel(args.edition)}; revision ${args.edition.revision}; source ${args.edition.source_version}`);
  if(!args.deferNavigation)await finalizeDdPdfNavigation(output,args.edition,chapters,args.slug);
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
export function ddReportXlsx(source:Uint8Array,edition:DdReportEdition,model:DdReportModel,chapters:DdReportChapter[],redact:(text:string)=>string=(s)=>s,focusSheet?:string,reportHref='https://amd-os-pwa.vercel.app/dd',pdfIndex?:DdPdfIndex) {
  chapters=splitDdDevelopmentChapters(chapters);
  const files=unzipSync(source),calc=new DdReportCalculator(model,edition.input_overrides),edited=new Map(mergeDdDevelopmentForWorkbook(chapters).map(ch=>[ch.source_sheet,new Map(ch.body.rows.flatMap(r=>r.cells).filter(c=>!c.formula&&typeof c.value==='string').map(c=>[c.address,c.value]))]));
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
    const footer=`<${prefix}headerFooter><${prefix}oddHeader>&amp;C&amp;BCONFIDENTIAL · DD ${ddReportVersionLabel(edition)}</${prefix}oddHeader></${prefix}headerFooter>`;
    if(/<(?:[\w.-]+:)?headerFooter\b/.test(xml))xml=xml.replace(/<(?:[\w.-]+:)?headerFooter\b[\s\S]*?<\/(?:[\w.-]+:)?headerFooter>/,footer);
    else xml=xml.replace(/<(?:[\w.-]+:)?(?:rowBreaks|colBreaks|customProperties|cellWatches|ignoredErrors|smartTags|drawing|legacyDrawing|legacyDrawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)\b|<\/(?:[\w.-]+:)?worksheet>/,match=>footer+match);
    const chapter=chapters.find(c=>c.source_sheet===sheet),relsPath=data.path.replace(/\/([^/]+)$/,'/_rels/$1.rels');
    if(chapter&&files[relsPath]){
      const targets=new Map(chapter.body.rows.flatMap(r=>r.cells).filter(c=>/^https?:\/\//i.test(c.link??'')).map(c=>[c.address,c.link!]));
      const ids=new Map([...xml.matchAll(/<(?:[\w.-]+:)?hyperlink\b[^>]*\bref="([A-Z]+\d+)"[^>]*\br:id="([^"]+)"[^>]*\/>/g)].flatMap(m=>targets.has(m[1])?[[m[2],targets.get(m[1])!] as const]:[]));
      files[relsPath]=strToU8(strFromU8(files[relsPath]).replace(/<Relationship\b[^>]*\/>/g,rel=>{const target=ids.get(rel.match(/\bId="([^"]+)"/)?.[1]??'');return target?rel.replace(/\bTarget="[^"]*"/,`Target="${ddEscapeHtml(target)}"`):rel;}));
    }
    xml=syncDdListValidation(xml,model.inputs.filter(input=>input.sheet===sheet));
    files[data.path]=strToU8(xml);
  }
  // PDF/HTML supplies narrative and figures; the projected workbook keeps calculations and detailed lists.
  for(const path of Object.keys(files)){
    if(/^xl\/drawings\/[^/]+\.xml$/.test(path))files[path]=strToU8(strFromU8(files[path]).replace(/<xdr:(twoCellAnchor|oneCellAnchor|absoluteAnchor)\b[\s\S]*?<\/xdr:\1>/g,a=>a.includes('<xdr:pic>')?'':a));
    if(/^xl\/drawings\/_rels\/.*\.rels$/.test(path))files[path]=strToU8(strFromU8(files[path]).replace(/<Relationship\b[^>]*Type="[^"]*\/image"[^>]*\/>/g,''));
    if(/^xl\/media\//.test(path))delete files[path];
    if(path.endsWith('.xml')&&strFromU8(files[path].subarray(0,1500)).includes('<c:chartSpace')){
      files[path]=strToU8(updateDdFundingChartXml(strFromU8(files[path]),calc).replace(/<c:numRef>[\s\S]*?<\/c:numRef>/g,ref=>{
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
  scaleDdJkissSummary(files,model.sheets['資本政策表']?.path);
  const projected=projectDdWorkbook(files,mergeDdDevelopmentForWorkbook(chapters),model,edition,reportHref,pdfIndex);
  if(projected){const selected=focusSheet&&projected.includes(focusSheet)?focusSheet:projected[0];for(const name of projected){const p=model.sheets[name].path;files[p]=strToU8(strFromU8(files[p]).replace(/<(?:[\w.-]+:)?sheetView\b[^>]*>/g,view=>view.replace(/\s+tabSelected="[01]"/g,'').replace(/\/?>$/,` tabSelected="${name===selected?'1':'0'}"${view.endsWith('/>')?'/>':'>'}`)));}}
  if(focusSheet){const names=projected??[...strFromU8(files['xl/workbook.xml']).matchAll(/<sheet\b[^>]*name="([^"]+)"/g)].map(m=>m[1].replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&'));const position=names.indexOf(focusSheet);if(position>=0)files['xl/workbook.xml']=strToU8(strFromU8(files['xl/workbook.xml']).replace(/activeTab="\d+"/g,`activeTab="${position}"`));}
  // A harmless custom XML part identifies the same DB revision as PDF without adding a visible sheet.
  // Rename the public sheet after calculation and projection, updating formulas, charts and hyperlinks together.
  for(const path of Object.keys(files))if(path.endsWith('.xml')||path.endsWith('.rels'))files[path]=strToU8(strFromU8(files[path]).replaceAll('損益・資金繰','資金繰表'));
  files['dd-report-version.json']=strToU8(JSON.stringify({title:edition.title,documentVersion:edition.document_version??null,revision:edition.revision,sourceVersion:edition.source_version,sourceSha256:edition.source_sha256,...(projected?{contents:'numerical-model-and-tables',sheets:projected.flatMap(s=>s==='計画詳細'?['事業開発計画','技術開発計画']:[s==='損益・資金繰'?'資金繰表':s])}:{})}));
  const contentTypes=strFromU8(files['[Content_Types].xml']);if(!contentTypes.includes('Extension="json"'))files['[Content_Types].xml']=strToU8(contentTypes.replace('</Types>','<Default Extension="json" ContentType="application/json"/></Types>'));
  splitDdDevelopmentWorkbook(files,chapters,model,edition,pdfIndex);
  return zipSync(files,{level:6});
}
