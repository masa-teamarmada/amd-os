import {DdReportIcon} from './DdReportIcon';
import type {DdReportChapter,DdReportGlossary,DdReportCell} from '@/lib/dd-report-types';
import {DdReportRichText} from './DdReportRichText';
import {ddPdfMarker} from '@/lib/dd-report-navigation';
export function DdBiographies({chapter,slug,glossary,allRows}:{chapter:DdReportChapter;slug:string;glossary?:DdReportGlossary;allRows?:boolean}){
  const renderText=(text:string,id:string)=><DdReportRichText text={text} id={id} slug={slug} glossary={glossary} interactive={!allRows} emphasize/>;
  const people=[{name:'山地 正洋',start:43,end:206},{name:'愛媛大学 杉浦美羽 准教授',start:215,end:341}];
  return <div className={`ddr-biographies ${allRows?'ddr-biographies-pdf':''}`}>{people.map(person=>{let category='profile';return <section className="ddr-bio-person" key={person.start}><h2>{person.name}</h2>{chapter.body.rows.filter(r=>r.row>=person.start&&r.row<=person.end).flatMap(r=>r.cells).map((c:DdReportCell)=>{
    const text=String(c.value??''),heading=/^(?:▼|【|＜)/.test(text),award=/受賞/.test(text)&&heading;
    if(heading)category=award?'award':/学歴|職歴|兼任/.test(text)?'career':/助成/.test(text)?'grant':/テレビ|メディア/.test(text)?'media':/特許|論文|業績/.test(text)?'research':'profile';
    const name=category==='award'?'Award':category==='career'?(/学歴|最終/.test(text)?'GraduationCap':'Briefcase'):category==='grant'?'HandCoins':category==='media'?'Tv':category==='research'?'BookOpen':'Microscope';
    const anchor=allRows?<a className="ddr-pdf-anchor" href={ddPdfMarker(slug,chapter.slug,c.address)} aria-hidden="true">.</a>:null;
    if(heading)return <h3 key={c.address} id={'cell-'+c.address}>{anchor}<DdReportIcon name={name} size={17} strokeWidth={1.8} aria-hidden="true"/>{renderText(text.replace(/^[▼【＜]|[】＞]$/g,''),c.address)}</h3>;
    const match=/^(\d{4}(?:[\d/年月日〜～\-月]*))\s+([\s\S]*)$/.exec(text);
    const isDetail=/^\s+（|^受賞タイトル/.test(text),isContact=/^(生年月日|住所|電話番号)/.test(text);
    return <div key={c.address} id={'cell-'+c.address} className={`ddr-bio-line ddr-bio-${category} ${match?'ddr-bio-dated':''} ${isDetail?'ddr-bio-detail':''} ${isContact?'ddr-bio-contact':''}`}>{anchor}{category==='award'&&!isDetail&&<DdReportIcon name="Award" size={15} className="ddr-bio-medal" aria-hidden="true"/>}{match?<><time>{match[1]}</time><div>{renderText(match[2],c.address)}</div></>:renderText(text,c.address)}</div>;
  })}</section>;})}</div>;
}
