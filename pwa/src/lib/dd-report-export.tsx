import 'server-only';
import {renderToReadableStream} from 'react-dom/server.edge';
import {strFromU8,strToU8,unzipSync,zipSync} from 'fflate';
import {DdReportContent} from '@/components/dd/report/DdReportContent';
import {DD_REPORT_CSS} from '@/components/dd/report/dd-report-style';
import {DdReportCalculator,ddAddress,ddColumn} from './dd-report-model';
import type {DdReportChapter,DdReportChapterSummary,DdReportEdition,DdReportModel,DdReportValue} from './dd-report-types';
import {DD_CONFIDENTIALITY_LABEL,DD_CONFIDENTIALITY_NOTICE,ddEscapeHtml} from './dd-confidentiality';

function printableChapter(chapter:DdReportChapter):DdReportChapter {
  // Monthly matrices are divided into consecutive periods so numbers remain legible on paper.
  const rows:typeof chapter.body.rows=[],wide:typeof chapter.body.rows=[];
  const flush=()=>{if(!wide.length)return;const count=Math.max(...wide.map(r=>r.cells.length-1));for(let offset=0;offset<count;offset+=6)for(const row of wide)rows.push({...row,row:row.row+offset/10000,cells:[row.cells[0],...row.cells.slice(1+offset,7+offset)].map((c,i)=>({...c,column:i+1,span:1}))});wide.length=0;};
  for(const row of chapter.body.rows){if(row.cells.length>15)wide.push(row);else{flush();rows.push(row);}}flush();
  return {...chapter,body:{...chapter.body,rows}};
}
export async function ddReportHtml({edition,chapters,index,slug,assetUrls}:{edition:DdReportEdition;chapters:DdReportChapter[];index:DdReportChapterSummary[];slug:string;assetUrls:Record<string,string>}) {
  const stream=await renderToReadableStream(<html lang="ja"><head><meta charSet="utf-8"/><base href="https://amd-os-pwa.vercel.app"/><title>{edition.title}</title><style>{DD_REPORT_CSS+`
    body{margin:0;padding:16px;background:white;font-family:'Noto Sans JP Variable',sans-serif} .ddr{font-size:14px}.ddr p{max-width:none}.ddr-chapter{break-before:auto;margin-top:28px}.ddr-table-scroll{max-height:none;overflow:visible}.ddr table{font-size:11px}.ddr td{min-width:0!important;padding:6px 8px}.ddr-wide td{white-space:normal}.ddr-equity-flow{grid-template-columns:repeat(2,minmax(0,1fr))}.ddr-phase>div{font-size:12px}.ddr-phase{break-inside:avoid}.ddr-equity-flow>.ddr-phase:nth-child(n){grid-column:auto;grid-row:auto}.ddr-flow-arrow{display:none}.ddr-chart svg{min-width:0}.ddr h2{break-after:avoid}.ddr p{orphans:2;widows:2}.ddr-image img{max-height:1000px}.ddr-proof{font-size:10px;color:#526874;border-top:1px solid #d6e1e5;padding:10px 0;margin-top:24px} tr{break-inside:avoid}
  `}</style></head><body><main className="ddr">
    <header className="ddr-header"><div className="ddr-kicker">{DD_CONFIDENTIALITY_LABEL}</div><h1>{edition.title}</h1><p>資料版 {edition.revision} · 移行元 {edition.source_version}</p><p style={{fontSize:11}}>{DD_CONFIDENTIALITY_NOTICE}</p><p style={{fontSize:11}}>{chapters.map(c=>c.title).join(' ／ ')}</p></header>
    {chapters.map(chapter=><section className="ddr-chapter" key={chapter.id}><div className="ddr-kicker">{chapter.group_label}</div><h1>{chapter.title==='UE'?'UE（ユニットエコノミクス）':chapter.title}</h1><DdReportContent chapter={printableChapter(chapter)} slug={slug} index={index} assetUrls={assetUrls} allRows/><p className="ddr-proof">{DD_CONFIDENTIALITY_LABEL} · 資料版 {edition.revision} · {chapter.title}</p></section>)}
  </main></body></html>);
  return new Response(stream).text();
}

function xmlCell(original:string,value:DdReportValue,formula:boolean) {
  const attrs=original.slice(0,original.indexOf('>')+1).replace(/\s+t="[^"]*"/g,'').replace(/\/>$/,'>');
  const f=formula?(original.match(/<f\b[^>]*(?:\/>|>[\s\S]*?<\/f>)/)?.[0]??''):'';
  if(value===null)return attrs+f+'</c>';
  const scalar=typeof value==='number'?String(value):typeof value==='boolean'?value?'1':'0':ddEscapeHtml(String(value));
  if(typeof value==='string')return attrs.replace(/>$/,' t="'+(formula?'str':'inlineStr')+'">')+f+(formula?`<v>${scalar}</v>`:`<is><t xml:space="preserve">${scalar}</t></is>`)+'</c>';
  return attrs.replace(/>$/,typeof value==='boolean'?' t="b">':'>')+f+`<v>${scalar}</v></c>`;
}
/** Preserve native formulas, chart objects, validations, styles and Excel data tables. */
export function ddReportXlsx(source:Uint8Array,edition:DdReportEdition,model:DdReportModel,chapters:DdReportChapter[],redact:(text:string)=>string=(s)=>s) {
  const files=unzipSync(source),calc=new DdReportCalculator(model,edition.input_overrides),edited=new Map(chapters.map(ch=>[ch.source_sheet,new Map(ch.body.rows.flatMap(r=>r.cells).filter(c=>!c.formula&&typeof c.value==='string').map(c=>[c.address,c.value]))]));
  for(const [sheet,data]of Object.entries(model.sheets)){
    let xml=strFromU8(files[data.path]);
    xml=xml.replace(/<c\b[^>]*?\br="([A-Z]+\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g,(cell,address:string)=>{
      const entry=data.cells[address];if(!entry)return cell;
      let value=edited.get(sheet)?.get(address)??calc.get(sheet,address);
      if(typeof value==='string')value=redact(value);
      return xmlCell(cell,value,Boolean(entry.f)||/<f\b/.test(cell));
    }).replace(/zoomScale="\d+"/g,'zoomScale="100"');
    // Source files can already contain a print notice; replace it, never append a duplicate element.
    const footer=`<headerFooter><oddHeader>&amp;C&amp;BCONFIDENTIAL · DD r${edition.revision}</oddHeader></headerFooter>`;
    if(/<headerFooter\b/.test(xml))xml=xml.replace(/<headerFooter\b[\s\S]*?<\/headerFooter>/,footer);
    else xml=xml.replace(/<(?:rowBreaks|colBreaks|customProperties|cellWatches|ignoredErrors|smartTags|drawing|legacyDrawing|legacyDrawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)\b|<\/worksheet>/,match=>footer+match);
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
  // A harmless custom XML part identifies the same DB revision as PDF without adding a visible sheet.
  files['dd-report-version.json']=strToU8(JSON.stringify({title:edition.title,revision:edition.revision,sourceVersion:edition.source_version,sourceSha256:edition.source_sha256}));
  const contentTypes=strFromU8(files['[Content_Types].xml']);if(!contentTypes.includes('Extension="json"'))files['[Content_Types].xml']=strToU8(contentTypes.replace('</Types>','<Default Extension="json" ContentType="application/json"/></Types>'));
  return zipSync(files,{level:6});
}
