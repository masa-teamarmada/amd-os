import {strFromU8,strToU8} from 'fflate';
import {ddEscapeHtml} from './dd-confidentiality';
import type {DdReportChapter,DdReportEdition,DdReportModel} from './dd-report-types';

type Files=Record<string,Uint8Array>;
const tag='(?:[\\w.-]+:)?';
const decode=(s:string)=>s.replace(/&apos;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const attr=(s:string,n:string)=>decode(s.match(new RegExp('\\b'+n+'="([^"]*)"'))?.[1]??'');
const relsPath=(p:string)=>p.replace(/\/([^/]+)$/,'/_rels/$1.rels');
function resolve(base:string,target:string){const parts=(target.startsWith('/')?target.slice(1):base.slice(0,base.lastIndexOf('/')+1)+target).split('/'),out:string[]=[];for(const p of parts){if(p==='..')out.pop();else if(p&&p!=='.')out.push(p);}return out.join('/');}

/** Keep the calculation graph and native Excel features; remove PDF chapters and prose. */
export function projectDdWorkbook(files:Files,chapters:DdReportChapter[],model:DdReportModel,edition:DdReportEdition,reportHref:string){
  if(!chapters.some(c=>c.body.excel))return null;
  const directory=chapters.find(c=>c.slug==='source-index');if(!directory)throw Error('Excel目録が不足している');
  const selected=chapters.filter(c=>c.slug!=='source-index'&&c.body.excel?.mode!=='pdf').sort((a,b)=>(a.body.excel?.order??a.sort_order)-(b.body.excel?.order??b.sort_order));
  const keep=new Set([directory.source_sheet,...selected.map(c=>c.source_sheet)]),removed=chapters.filter(c=>!keep.has(c.source_sheet));
  // A missing dependency must stop export rather than produce a workbook with broken links.
  for(const c of selected)for(const entry of Object.values(model.sheets[c.source_sheet].cells))if(entry.f){
    const formula=entry.f.replace(/"(?:[^"]|"")*"/g,'');
    if(removed.some(r=>formula.includes(r.source_sheet+'!')||formula.includes("'"+r.source_sheet.replaceAll("'","''")+"'!")))throw Error('Excelの計算参照を保持できない: '+c.source_sheet);
  }
  const wbPath='xl/workbook.xml',original=strFromU8(files[wbPath]),sheetTags=[...original.matchAll(new RegExp('<'+tag+'sheet\\b[^>]*\\/>','g'))].map(m=>m[0]);
  const oldNames=sheetTags.map(x=>attr(x,'name')),ordered=[directory.source_sheet,...selected.map(c=>c.source_sheet)],newIndex=new Map(ordered.map((n,i)=>[n,i]));
  let workbook=original.replace(new RegExp('(<'+tag+'sheets\\b[^>]*>)[\\s\\S]*?(</'+tag+'sheets>)'),(_all,open:string,close:string)=>open+ordered.map(n=>{const t=sheetTags.find(x=>attr(x,'name')===n);if(!t)throw Error('Excelシートが不足: '+n);return t;}).join('')+close);
  workbook=workbook.replace(new RegExp('<'+tag+'definedName\\b[^>]*>[\\s\\S]*?</'+tag+'definedName>','g'),n=>{
    const local=n.match(/\blocalSheetId="(\d+)"/);if(local){const at=newIndex.get(oldNames[Number(local[1])]);return at===undefined?'':n.replace(/localSheetId="\d+"/,`localSheetId="${at}"`);}
    return removed.some(r=>decode(n).includes(r.source_sheet+'!')||decode(n).includes("'"+r.source_sheet+"'!"))?'':n;
  }).replace(/activeTab="\d+"/g,'activeTab="0"').replace(/firstSheet="\d+"/g,'firstSheet="0"');
  files[wbPath]=strToU8(workbook);
  const removedIds=new Set(sheetTags.filter(t=>!keep.has(attr(t,'name'))).map(t=>attr(t,'r:id')));
  files['xl/_rels/workbook.xml.rels']=strToU8(strFromU8(files['xl/_rels/workbook.xml.rels']).replace(/<Relationship\b[^>]*\/>/g,r=>removedIds.has(attr(r,'Id'))?'':r));

  for(const c of selected){
    const data=model.sheets[c.source_sheet],path=data.path,prefix=strFromU8(files[path]).match(/<([\w.-]+:)?worksheet\b/)?.[1]??'';
    let xml=strFromU8(files[path]);
    const prose=new Set(c.body.rows.filter(r=>r.row>2&&r.cells.length===1&&!r.cells[0].heading&&r.cells[0].span>=5&&typeof r.cells[0].value==='string'&&!r.cells[0].formula&&!data.cells[r.cells[0].address]?.input).map(r=>r.cells[0].address));
    const tableRows=new Set(c.body.rows.filter(r=>r.cells.length>1||r.cells.some(x=>x.heading)||r.row<=2).map(r=>r.row));
    const removedCells=new Set<string>();
    xml=xml.replace(new RegExp('<'+tag+'c\\b[^>]*?\\br="([A-Z]+)(\\d+)"[^>]*?(?:\\/>|>[\\s\\S]*?</'+tag+'c>)','g'),(cell,addressCol:string,row:string)=>{
      const address=addressCol+row,entry=data.cells[address];
      const drop=prose.has(address)||(c.body.excel?.mode==='tables'&&Number(row)>2&&!tableRows.has(Number(row))&&!entry?.f&&!entry?.input);
      if(drop){removedCells.add(address);return '';}return cell;
    });
    xml=xml.replace(new RegExp('<'+tag+'mergeCell\\b[^>]*\\bref="([A-Z]+\\d+):[^" ]+"[^>]*/>','g'),(m,anchor:string)=>removedCells.has(anchor)?'':m);
    xml=xml.replace(new RegExp('<'+tag+'mergeCells\\b[^>]*>([\\s\\S]*?)</'+tag+'mergeCells>'),(_m,inside:string)=>{const count=[...inside.matchAll(new RegExp('<'+tag+'mergeCell\\b','g'))].length;return count?`<${prefix}mergeCells count="${count}">${inside}</${prefix}mergeCells>`:'';});
    const visible=new Set<number>();
    for(const m of xml.matchAll(new RegExp('<'+tag+'row\\b[^>]*?\\br="(\\d+)"[^>]*?(?:\\/>|>([\\s\\S]*?)</'+tag+'row>)','g')))if(new RegExp('<'+tag+'(?:v|is|f)\\b').test(m[2]??'')&&!/\bhidden="1"/.test(m[0].slice(0,m[0].indexOf('>'))))visible.add(Number(m[1]));
    // Preserve the visual height of populated merges and native charts, including their axes.
    for(const m of xml.matchAll(new RegExp('<'+tag+'mergeCell\\b[^>]*ref="[A-Z]+(\\d+):[A-Z]+(\\d+)"','g')))if(visible.has(Number(m[1])))for(let r=Number(m[1]);r<=Number(m[2]);r++)visible.add(r);
    const relPath=relsPath(path),rels=files[relPath]?strFromU8(files[relPath]):'';
    for(const rel of rels.matchAll(/<Relationship\b[^>]*\/>/g))if(attr(rel[0],'Type').endsWith('/drawing')){
      const drawing=files[resolve(path,attr(rel[0],'Target'))];if(!drawing)continue;
      for(const anchor of strFromU8(drawing).matchAll(/<xdr:twoCellAnchor\b[\s\S]*?<\/xdr:twoCellAnchor>/g)){
        const rows=[...anchor[0].matchAll(/<xdr:row>(\d+)<\/xdr:row>/g)].map(m=>Number(m[1])+1);if(rows.length>=2)for(let r=rows[0];r<=rows[1];r++)visible.add(r);
      }
    }
    xml=xml.replace(new RegExp('<'+tag+'row\\b[^>]*\\br="(\\d+)"[^>]*>','g'),(r,row:string)=>visible.has(Number(row))?r:r.replace(/\s+hidden="[01]"/,'').replace(/\/?>$/,` hidden="1"${r.endsWith('/>')?'/>':'>'}`));
    // Internal links to a PDF chapter open the same authorized chapter in the DD site.
    let relationshipXml=rels||'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>',linkNo=0;
    xml=xml.replace(new RegExp('<'+tag+'hyperlink\\b[^>]*/>','g'),link=>{
      if(removedCells.has(attr(link,'ref')))return '';
      const location=attr(link,'location'),sheet=location.match(/^'?([^'!]+)'?!/)?.[1],target=removed.find(r=>r.source_sheet===sheet);if(!target)return link;
      const id='rIdDdPdf'+(++linkNo);relationshipXml=relationshipXml.replace('</Relationships>',`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${ddEscapeHtml(reportHref+'?chapter='+target.slug)}" TargetMode="External"/></Relationships>`);
      return link.replace(/\s+location="[^"]*"/,'').replace(/\/>$/,` xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${id}"/>`);
    });
    if(rels||linkNo)files[relPath]=strToU8(relationshipXml);
    files[path]=strToU8(xml);
  }

  // The workbook starts with a compact numerical directory, not the narrative DD catalogue.
  const indexPath=model.sheets[directory.source_sheet].path,indexXml=strFromU8(files[indexPath]);
  const style=(address:string,fallback='0')=>indexXml.match(new RegExp('<'+tag+'c\\b[^>]*r="'+address+'"[^>]*s="(\\d+)"'))?.[1]??fallback;
  const titleStyle=style('B2'),bodyStyle=style('B9'),linkStyle=style('B25',bodyStyle),headStyle=style('B8',titleStyle);
  const textCell=(address:string,value:string,s:string)=>`<c r="${address}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${ddEscapeHtml(value)}</t></is></c>`;
  const rows=[`<row r="1" ht="8" customHeight="1"/>`,`<row r="2" ht="34" customHeight="1">${textCell('B2',edition.title.split('｜')[0]+' 数値計画・試算・一覧表',titleStyle)}</row>`,`<row r="3" ht="23" customHeight="1">${textCell('B3','資料版 '+edition.revision+' ／ 事業説明・図解・経歴・法規制は同梱PDFとDDサイトで閲覧',bodyStyle)}</row>`,`<row r="5" ht="23" customHeight="1">${textCell('B5','DDサイトを開く',linkStyle)}</row>`,`<row r="7" ht="24" customHeight="1">${textCell('B7','分類',headStyle)+textCell('C7','シート',headStyle)+textCell('D7','内容',headStyle)}</row>`];
  const links=[`<hyperlink ref="B5" r:id="rIdDdSite"/>`];
  const descriptions:Record<string,string>={'capital-plan':'ラウンド評価額・J-KISS転換・株数・持株比率・IRR','financial-plan':'月次の売上・原価・利益・入出金・現金残高','unit-economics':'4工程の単位原価・顧客の費用削減・採算判定','cyanobacteria-cost':'培養方式・生産量・菌体1kg-DCW当たり原価','reactor-cost':'処理方式・処理量・廃液1m³当たり原価','metal-cost':'元素別の価格・回収率・金属1kg当たり原価','fame-cost':'製造方式・収量・FAME 1L当たり原価','production-plan':'生産能力・必要面積・拠点別人員・設備費用','assumptions':'調達条件・人件費・設備・生産・原価の共通入力','commercial-assumptions':'装置台数・料金・継続供給・販売原価の月次計算','equipment-costs':'設備・初期費用・投資時期・減価償却','cash-details':'月次の入出金・費目別支払・現金増減','fuel-development':'初期研究項目・設備・人件費と支払配分','poc':'実廃液・処理結果・進捗の一覧','partners':'顧客候補・協業先・投資家の分類と進展','execution-plan':'事業開発・技術開発の工程表と年度別KPI','gap-fund':'申請時の到達目標とKPIの達成状況','competition':'競合・代替プロセスの比較','market':'市場規模・需要・顧客費用の調査データ'};
  rows.splice(3,0,'<row r="4" ht="8" customHeight="1"/>');rows.splice(5,0,'<row r="6" ht="8" customHeight="1"/>');
  selected.forEach((c,i)=>{const r=i+8;rows.push(`<row r="${r}" ht="25" customHeight="1">${textCell('B'+r,c.group_label,bodyStyle)+textCell('C'+r,c.source_sheet,linkStyle)+textCell('D'+r,descriptions[c.slug]??(c.body.excel?.mode==='model'?'入力条件と計算結果':'比較・進捗・調査の一覧表'),bodyStyle)}</row>`);links.push(`<hyperlink ref="C${r}" location="${ddEscapeHtml("'"+c.source_sheet.replaceAll("'","''")+"'!B2")}"/>`);});
  files[indexPath]=strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><tabColor rgb="FF147D92"/></sheetPr><dimension ref="B2:D${selected.length+7}"/><sheetViews><sheetView showGridLines="0" zoomScale="100" workbookViewId="0" tabSelected="1"><pane ySplit="7" topLeftCell="A8" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="C8" sqref="C8"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="20"/><cols><col min="1" max="1" width="3" customWidth="1"/><col min="2" max="2" width="18" customWidth="1"/><col min="3" max="3" width="28" customWidth="1"/><col min="4" max="4" width="68" customWidth="1"/></cols><sheetData>${rows.join('')}</sheetData><mergeCells count="3"><mergeCell ref="B2:D2"/><mergeCell ref="B3:D3"/><mergeCell ref="B5:D5"/></mergeCells><hyperlinks>${links.join('')}</hyperlinks></worksheet>`);
  files[relsPath(indexPath)]=strToU8(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdDdSite" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${ddEscapeHtml(reportHref)}" TargetMode="External"/></Relationships>`);

  // Remove detached worksheets, diagrams and media instead of leaving the old document inside the ZIP.
  const reached=new Set(['[Content_Types].xml']),queue=[''];
  while(queue.length){const part=queue.shift()!,rp=part?relsPath(part):'_rels/.rels';if(!files[rp])continue;reached.add(rp);for(const rel of strFromU8(files[rp]).matchAll(/<Relationship\b[^>]*\/>/g)){if(attr(rel[0],'TargetMode')==='External')continue;const target=resolve(part,attr(rel[0],'Target'));if(files[target]&&!reached.has(target)){reached.add(target);queue.push(target);}}}
  for(const p of Object.keys(files))if(!reached.has(p))delete files[p];
  files['[Content_Types].xml']=strToU8(strFromU8(files['[Content_Types].xml']).replace(/<Override\b[^>]*\/>/g,o=>files[attr(o,'PartName').replace(/^\//,'')]?o:''));
  if(files['docProps/app.xml'])files['docProps/app.xml']=strToU8(strFromU8(files['docProps/app.xml']).replace(/(<HeadingPairs>[\s\S]*?<vt:i4>)\d+(<\/vt:i4>)/,(_m,b:string,e:string)=>b+ordered.length+e).replace(/<TitlesOfParts>[\s\S]*?<\/TitlesOfParts>/,`<TitlesOfParts><vt:vector size="${ordered.length}" baseType="lpstr">${ordered.map(n=>`<vt:lpstr>${ddEscapeHtml(n)}</vt:lpstr>`).join('')}</vt:vector></TitlesOfParts>`));
  return ordered;
}
