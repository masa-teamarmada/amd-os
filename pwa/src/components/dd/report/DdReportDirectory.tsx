import type {DdReportChapterSummary,DdReportRow} from '@/lib/dd-report-types';

export function DdReportDirectory({index,rows,slug}:{index:DdReportChapterSummary[];rows:DdReportRow[];slug:string}) {
  const priority=['business-plan','equity-story','capital-plan','financial-plan','unit-economics','production-plan'];
  const descriptions=new Map(rows.filter(r=>r.cells.length===2).map(r=>[String(r.cells[0].value),String(r.cells[1].value)]));
  const remaining=index.filter(c=>c.slug!=='source-index'&&c.slug!=='assumptions'&&!priority.includes(c.slug));
  const groups=[{name:'最初に読む',chapters:priority.flatMap(s=>index.filter(c=>c.slug===s))},...[...new Set(remaining.map(c=>c.group_label))].map(name=>({name,chapters:remaining.filter(c=>c.group_label===name)})),{name:'計算条件',chapters:index.filter(c=>c.slug==='assumptions')}];
  let number=0;
  return <div className="ddr-directory" aria-label="資料一覧">{groups.map((group,g)=><section key={group.name} className={'ddr-directory-group'+(g===0?' ddr-directory-priority':'')}><h3>{group.name}</h3><div className="ddr-directory-entries">{group.chapters.map(c=>{
    const description=descriptions.get(c.title)||'',title=c.title==='UE'?'UE（ユニットエコノミクス）':c.title;
    return <a className="ddr-directory-item" key={c.slug} href={`/dd/${encodeURIComponent(slug)}?chapter=${c.slug}`} title={description}><span className="ddr-directory-number">{String(++number).padStart(2,'0')}</span><span className="ddr-directory-title">{title}</span><span className="ddr-directory-description">{description}</span></a>;
  })}</div></section>)}</div>;
}
