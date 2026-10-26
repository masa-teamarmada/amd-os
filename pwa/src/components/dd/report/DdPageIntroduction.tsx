import {DdReportRichText} from './DdReportRichText';
import {DD_REPORT_INTRODUCTIONS,DD_REPORT_INTRODUCTION_HIGHLIGHTS} from '../../../lib/dd-report-introductions';
import type {DdReportGlossary} from '../../../lib/dd-report-types';
import type {CanonicalReportNavigation} from '../../../lib/project-canonical-links';

export function DdPageIntroduction({chapterSlug,slug,glossary,allRows,navigation}:{chapterSlug:string;slug:string;glossary?:DdReportGlossary;allRows?:boolean;navigation?:CanonicalReportNavigation}){
  const text=DD_REPORT_INTRODUCTIONS[chapterSlug];
  if(!text)return null;
  return <div className="ddr-page-introduction" aria-label="この資料の対象と使い方">{text.split('\n\n').map((paragraph,i)=><p key={i}><DdReportRichText text={paragraph} id={'page-introduction-'+i} slug={slug} glossary={glossary} interactive={!allRows} emphasize highlights={DD_REPORT_INTRODUCTION_HIGHLIGHTS[chapterSlug]} navigation={navigation}/></p>)}</div>;
}
