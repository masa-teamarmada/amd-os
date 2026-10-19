import type {DdReportChapter,DdReportChapterSummary,DdReportRow} from './dd-report-types';

export const DD_DEVELOPMENT_SLUGS=['business-development-plan','technical-development-plan'] as const;
export function ddDevelopmentTarget(address?:string){const n=Number(address?.match(/\d+/)?.[0]);return n>=75&&n<=90||n>=214&&n<=255||n>=340&&n<=361||n>=500&&n<600?'technical-development-plan':'business-development-plan';}
export function splitDdDevelopmentIndex(index:DdReportChapterSummary[]){return index.flatMap(c=>c.slug!=='execution-plan'?[c]:DD_DEVELOPMENT_SLUGS.map((slug,i)=>({...c,slug,id:c.id+':'+i,title:i?'技術開発計画':'事業開発計画',sort_order:c.sort_order+i*.1})));}
export function splitDdDevelopmentChapters(chapters:DdReportChapter[]){return chapters.flatMap(c=>c.slug==='execution-plan'?DD_DEVELOPMENT_SLUGS.map(slug=>splitDdDevelopmentChapter(c,slug)):[c]);}

/** Two reader pages share the immutable source coordinates and one versioned authoring record. */
export function splitDdDevelopmentChapter(source:DdReportChapter,slug:string):DdReportChapter{
  if(source.slug!=='execution-plan'||!DD_DEVELOPMENT_SLUGS.includes(slug as typeof DD_DEVELOPMENT_SLUGS[number]))return source;
  const technical=slug===DD_DEVELOPMENT_SLUGS[1],title=technical?'技術開発計画':'事業開発計画',group=technical?'技術開発':'事業開発';
  const change=(row:DdReportRow,text:string)=>({...row,cells:[{...row.cells[0],value:text}]});
  const titleRows=source.body.rows.filter(r=>r.row<=2).map(r=>r.row===2?change(r,title):r);
  const brief=source.body.rows.filter(r=>technical?r.row>=500&&r.row<600:r.row>=400&&r.row<500);
  const section=source.body.rows.find(r=>r.row===12),summary=source.body.rows.filter(r=>technical?r.row>=75&&r.row<=90:r.row>=55&&r.row<=70).map(r=>r.row===(technical?75:55)?change(r,'段階別の実行方針'):r);
  const kpis=source.body.rows.filter(r=>r.row>=95&&r.row<=153).map(r=>r.row===95?change(r,'年度別KPI'):r.cells.length>2?{...r,cells:r.cells.filter(c=>technical?c.column!==4:c.column!==13).map(c=>c.column===2?{...c,format:'0'}:c)}:r);
  const taskHeading=source.body.rows.find(r=>r.row===160),taskHelp=source.body.rows.find(r=>r.row===163);
  const taskRows=source.body.rows.filter(r=>r.cells.length===6&&r.cells[0].value===group);
  const rest=source.body.rows.filter(r=>technical?r.row>=340&&r.row<=361:r.row>=264&&r.row<=332);
  return {...source,id:source.id+':'+(technical?1:0),slug,title,sort_order:source.sort_order+(technical?.1:0),body:{...source.body,excel:{mode:'tables',order:source.body.excel?.order??15},objects:[],rows:[...titleRows,...brief,...(section?[change(section,'開発工程の全体像')]:[]),...summary,...kpis,...(taskHeading?[change(taskHeading,'短中期の実行工程')]:[]),...(taskHelp?[change(taskHelp,'各工程の矢羽にマウスを重ねると、担当・先行条件・完了条件を確認できる。表示期間を切り替えて、設立前の準備からIPO後の工程まで確認する。')]:[]),...taskRows,...rest.map(r=>technical&&r.cells.length>1?{...r,exportTable:true}:r)]}};
}

/** Native formulas still use 計画詳細. The final Excel projection separates its two sheets. */
export function mergeDdDevelopmentForWorkbook(chapters:DdReportChapter[]){
  const business=chapters.find(c=>c.slug===DD_DEVELOPMENT_SLUGS[0]),technical=chapters.find(c=>c.slug===DD_DEVELOPMENT_SLUGS[1]);
  if(!business||!technical)return chapters;
  const rows=new Map<number,DdReportRow>();for(const row of [...business.body.rows,...technical.body.rows]){const prior=rows.get(row.row);rows.set(row.row,prior?{...prior,cells:[...new Map([...prior.cells,...row.cells].map(c=>[c.address,c])).values()].sort((a,b)=>a.column-b.column)}:row);}
  return chapters.filter(c=>c!==technical).map(c=>c===business?{...business,body:{...business.body,rows:[...rows.values()].sort((a,b)=>a.row-b.row)}}:c);
}
