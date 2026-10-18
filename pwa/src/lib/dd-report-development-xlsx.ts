import {strFromU8,strToU8} from 'fflate';
import {ddEscapeHtml} from './dd-confidentiality';
import {DD_EXECUTION_WINDOWS,ddExecutionQuarters,ddExecutionSpan,ddExecutionTasks,ddMonthLabel} from './dd-report-execution-plan';
import {DD_DEVELOPMENT_SLUGS,ddDevelopmentTarget} from './dd-report-development-plans';
import type {DdReportChapter,DdReportModel} from './dd-report-types';
import {ddReportFilename,type DdPdfIndex} from './dd-report-navigation';
import type {DdReportEdition} from './dd-report-types';
const tag='(?:[\\w.-]+:)?';
const column=(n:number)=>{let s='';for(;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
const attr=(s:string,n:string)=>s.match(new RegExp('\\b'+n+'="([^"]+)"'))?.[1]??'';

/** Separate native, editable sheets while retaining source cell coordinates and every task detail. */
export function splitDdDevelopmentWorkbook(files:Record<string,Uint8Array>,chapters:DdReportChapter[],model:DdReportModel,edition:DdReportEdition,pdfIndex?:DdPdfIndex){
  const plans=DD_DEVELOPMENT_SLUGS.map(slug=>chapters.find(c=>c.slug===slug));if(plans.some(c=>!c))return;
  const sourcePath=model.sheets['計画詳細'].path,source=strFromU8(files[sourcePath]),prefix=source.match(/<([\w.-]+:)?worksheet\b/)?.[1]??'';
  let styles=strFromU8(files['xl/styles.xml']);
  const fillStart=Number(styles.match(/<fills count="(\d+)"/)?.[1]),styleStart=Number(styles.match(/<cellXfs count="(\d+)"/)?.[1]);
  if(!Number.isFinite(fillStart)||!Number.isFinite(styleStart))throw Error('工程ガントの書式が不足');
  styles=styles.replace(/<fills count="\d+"/,`<fills count="${fillStart+2}"`).replace('</fills>',['147D92','B7832E'].map(color=>`<fill><patternFill patternType="solid"><fgColor rgb="FF${color}"/><bgColor indexed="64"/></patternFill></fill>`).join('')+'</fills>');
  styles=styles.replace(/<cellXfs count="\d+"/,`<cellXfs count="${styleStart+2}"`).replace('</cellXfs>',[0,1].map(i=>`<xf numFmtId="0" fontId="0" fillId="${fillStart+i}" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>`).join('')+'</cellXfs>');files['xl/styles.xml']=strToU8(styles);
  const sourceStyle=(address:string,fallback='0')=>source.match(new RegExp('<'+tag+'c\\b[^>]*r="'+address+'"[^>]*s="(\\d+)"'))?.[1]??fallback;
  const textCell=(address:string,text:string,style=sourceStyle('C169'))=>`<${prefix}c r="${address}" s="${style}" t="inlineStr"><${prefix}is><${prefix}t xml:space="preserve">${ddEscapeHtml(text)}</${prefix}t></${prefix}is></${prefix}c>`;
  const extraPath=`xl/worksheets/sheet${Math.max(...Object.keys(files).flatMap(p=>/^xl\/worksheets\/sheet(\d+)\.xml$/.exec(p)?.slice(1).map(Number)??[]))+1}.xml`;
  let workbook=strFromU8(files['xl/workbook.xml']);const wp=workbook.match(/<([\w.-]+:)?workbook\b/)?.[1]??'',sourceTag=[...workbook.matchAll(new RegExp('<'+tag+'sheet\\b[^>]*/>','g'))].find(m=>attr(m[0],'name')==='計画詳細')?.[0];if(!sourceTag)throw Error('工程明細シートが不足');
  const insertAt=[...workbook.matchAll(new RegExp('<'+tag+'sheet\\b[^>]*/>','g'))].findIndex(m=>m[0]===sourceTag)+1;
  const nextId=Math.max(...[...workbook.matchAll(/\bsheetId="(\d+)"/g)].map(m=>Number(m[1])))+1,rid='rIdDdTechnicalPlan';
  workbook=workbook.replace(sourceTag,sourceTag.replace('name="計画詳細"','name="事業開発計画"')+`<${wp}sheet name="技術開発計画" sheetId="${nextId}" r:id="${rid}"/>`);files['xl/workbook.xml']=strToU8(workbook);
  files['xl/workbook.xml']=strToU8(workbook.replace(/\blocalSheetId="(\d+)"/g,(_m,id:string)=>`localSheetId="${Number(id)>=insertAt?Number(id)+1:id}"`));
  files['xl/_rels/workbook.xml.rels']=strToU8(strFromU8(files['xl/_rels/workbook.xml.rels']).replace('</Relationships>',`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/${extraPath}"/></Relationships>`));
  files['[Content_Types].xml']=strToU8(strFromU8(files['[Content_Types].xml']).replace('</Types>',`<Override PartName="/${extraPath}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`));
  for(const [i,plan] of plans.entries()){
    const c=plan!,path=i?extraPath:sourcePath,keep=new Set(c.body.rows.flatMap(r=>r.cells.map(c=>c.address))),tasks=ddExecutionTasks(c.body.rows);
    let xml=source.replace(new RegExp('<'+tag+'c\\b[^>]*?\\br="([A-Z]+)(\\d+)"[^>]*?(?:/>|>[\\s\\S]*?</'+tag+'c>)','g'),(cell,col:string,row:string)=>keep.has(col+row)&&!(col==='B'&&(Number(row)===167||tasks.some(t=>t.row===Number(row))))?cell:'');
    xml=xml.replace(new RegExp('<'+tag+'mergeCell\\b[^>]*ref="([A-Z]+\\d+):[^" ]+"[^>]*/>','g'),(merge,anchor:string)=>keep.has(anchor)?merge:'');
    xml=xml.replace(new RegExp('<'+tag+'hyperlink\\b[^>]*ref="([^"]+)"[^>]*/>','g'),(link,ref:string)=>keep.has(ref.split(':')[0])?link:'');
    const merges:string[]=[],links:string[]=[],rows:string[]=[];let row=610;
    const full=(text:string,heading=false)=>{rows.push(`<${prefix}row r="${row}" ht="${heading?27:23}" customHeight="1">${textCell('B'+row,text,sourceStyle(heading?'B160':'C169'))}</${prefix}row>`);merges.push(`B${row}:X${row}`);return row++;};
    full(c.title+'｜工程ガント',true);full('工程IDまたは仕事名から、担当・先行条件・完了条件の明細へ移動。');
    for(const window of DD_EXECUTION_WINDOWS){
      full(window.label+'　'+ddMonthLabel(window.start)+'〜'+ddMonthLabel(window.end),true);
      const quarters=ddExecutionQuarters(window);
      rows.push(`<${prefix}row r="${row}" ht="25" customHeight="1">${textCell('B'+row,'ID',sourceStyle('C167'))}${textCell('C'+row,'仕事',sourceStyle('D167'))}${quarters.map((q,j)=>textCell(column(j+5)+row,q.label,sourceStyle('C167'))).join('')}</${prefix}row>`);merges.push(`C${row}:D${row}`);row++;
      for(const task of tasks){const span=ddExecutionSpan(task,window);if(!span)continue;
        const cells=[textCell('B'+row,task.id),textCell('C'+row,task.title)];merges.push(`C${row}:D${row}`);
        const lastActive=quarters.findLastIndex(q=>q.start<=Math.min(task.ongoing?window.end:task.end,window.end));
        for(const [j,q]of quarters.entries()){const active=task.start<=q.start+q.months-1&&(task.ongoing||task.end>=q.start);cells.push(textCell(column(j+5)+row,active&&j===lastActive?(span.continuesAfter?'»':'▶'):'',active?String(styleStart+i):sourceStyle('C169')));}
        rows.push(`<${prefix}row r="${row}" ht="32" customHeight="1">${cells.join('')}</${prefix}row>`);for(const col of ['B','C'])links.push(`<${prefix}hyperlink ref="${col}${row}" location="'${c.title}'!C${task.row}"/>`);row++;
      }
      full('▶ 期間内に完了　» 表示期間の後も継続');
    }
    // The source coordinates remain stable for formulas, evidence and incoming links.
    for(const [address,value]of [['B2',c.title],['B160','実行工程の明細'],['B163','工程ごとの期間・担当・先行条件・完了条件。短中期ガントは上部のリンクから開く。']] as const){const pattern=new RegExp('<'+tag+'c\\b[^>]*r="'+address+'"[^>]*>[\\s\\S]*?</'+tag+'c>');xml=xml.replace(pattern,textCell(address,value,sourceStyle(address)));}
    xml=xml.replace(new RegExp('</'+tag+'sheetData>'),rows.join('')+`</${prefix}sheetData>`);
    if(new RegExp('</'+tag+'mergeCells>').test(xml))xml=xml.replace(new RegExp('</'+tag+'mergeCells>'),merges.map(ref=>`<${prefix}mergeCell ref="${ref}"/>`).join('')+`</${prefix}mergeCells>`);
    xml=xml.replace(new RegExp('<'+tag+'mergeCells count="\\d+"'),m=>m.replace(/count="\d+"/,`count="${[...xml.matchAll(new RegExp('<'+tag+'mergeCell\\b','g'))].length}"`));
    links.push(`<${prefix}hyperlink ref="B4" location="'${c.title}'!B610"/>`);
    xml=xml.replace(new RegExp('<'+tag+'row\\b[^>]*r="4"[^>]*(?:/>|>[\\s\\S]*?</'+tag+'row>)'),`<${prefix}row r="4" ht="24" customHeight="1">${textCell('B4','短中期ガントを開く ↓',sourceStyle('B1'))}</${prefix}row>`);
    if(new RegExp('</'+tag+'hyperlinks>').test(xml))xml=xml.replace(new RegExp('</'+tag+'hyperlinks>'),links.join('')+`</${prefix}hyperlinks>`);
    else xml=xml.replace(new RegExp('<'+tag+'pageMargins\\b|</'+tag+'worksheet>'),m=>`<${prefix}hyperlinks>${links.join('')}</${prefix}hyperlinks>`+m);
    xml=xml.replace(new RegExp('<'+tag+'(?:drawing|legacyDrawing)\\b[^>]*/>','g'),'');
    xml=xml.replace(new RegExp('<'+tag+'dimension\\b[^>]*/>'),`<${prefix}dimension ref="A1:X${row}"/>`);
    files[path]=strToU8(xml);
    const sourceRels=sourcePath.replace(/\/([^/]+)$/,'/_rels/$1.rels');if(i&&files[sourceRels])files[extraPath.replace(/\/([^/]+)$/,'/_rels/$1.rels')]=files[sourceRels].slice();
  }
  // All saved links follow the new sheet that owns their original record.
  for(const [path,bytes]of Object.entries(files))if(path.endsWith('.xml')||path.endsWith('.rels')){
    let xml=strFromU8(bytes);xml=xml.replace(/(?:&apos;|')?計画詳細(?:&apos;|')?!(\$?[A-Z]+\$?\d+)/g,(_m,address:string)=>`'${ddDevelopmentTarget(address.replaceAll('$',''))==='technical-development-plan'?'技術開発計画':'事業開発計画'}'!${address}`);
    if(path===model.sheets['資料一覧'].path)xml=xml.replace(/>計画詳細</g,'>事業開発計画<');
    files[path]=strToU8(xml);
  }
  const indexPath=model.sheets['資料一覧'].path;let indexXml=strFromU8(files[indexPath]);
  const entry=[...indexXml.matchAll(new RegExp('<'+tag+'row\\b[^>]*r="(\\d+)"[^>]*>[\\s\\S]*?</'+tag+'row>','g'))].find(m=>m[0].includes('>事業開発計画<'));
  if(!entry)throw Error('開発計画のExcel目録が不足');const beforeRow=Number(entry[1]),newRow=beforeRow+1;
  indexXml=indexXml.replace(/\b(r|ref)="([A-Z]*)(\d+)(?::([A-Z]+)(\d+))?"/g,(m,key:string,col:string,row:string,endCol:string,endRow:string)=>`${key}="${col}${Number(row)>beforeRow?Number(row)+1:row}${endCol?':'+endCol+(Number(endRow)>beforeRow?Number(endRow)+1:endRow):''}"`);
  const indexCell=(address:string,text:string)=>`<c r="${address}" s="${attr(entry[0].match(/<c\b[^>]*r="C\d+"[^>]*>/)?.[0]??'','s')||'0'}" t="inlineStr"><is><t>${ddEscapeHtml(text)}</t></is></c>`;
  const page=pdfIndex?.['technical-development-plan']?.page;
  const newEntry=`<row r="${newRow}" ht="25" customHeight="1">${indexCell('B'+newRow,plans[1]!.group_label)}${indexCell('C'+newRow,'技術開発計画')}${indexCell('D'+newRow,'技術・製造の工程ガント、担当・先行条件・成果、年度別KPI')}${indexCell('E'+newRow,page?'p. '+page:'本文PDF')}</row>`;
  const at=indexXml.indexOf(entry[0].replace(/name="計画詳細"/g,'name="事業開発計画"'));
  // The existing row itself is unchanged by shifting the later rows.
  if(at<0)throw Error('開発計画目録の挿入位置が不足');indexXml=indexXml.slice(0,at+entry[0].length)+newEntry+indexXml.slice(at+entry[0].length);
  indexXml=indexXml.replace('</hyperlinks>',`<hyperlink ref="C${newRow}" location="'技術開発計画'!B2"/><hyperlink ref="E${newRow}" r:id="rIdDdTechnicalPdf"/></hyperlinks>`);files[indexPath]=strToU8(indexXml);
  const indexRel=indexPath.replace(/\/([^/]+)$/,'/_rels/$1.rels');files[indexRel]=strToU8(strFromU8(files[indexRel]).replace('</Relationships>',`<Relationship Id="rIdDdTechnicalPdf" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${ddEscapeHtml(ddReportFilename(edition,'pdf')+(page?'#page='+page:''))}" TargetMode="External"/></Relationships>`));
}
