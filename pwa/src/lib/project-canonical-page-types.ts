import type {DdLiveProjectPage} from '@/lib/dd-project-page-types';
import type {DdReportChapter,DdReportChapterSummary,DdReportGlossary,DdReportInput,DdReportValue} from './dd-report-types.ts';
import type {DdDownloadRelease} from '@/lib/dd-report-download-policy';
import type {ProjectCanonicalPageKey} from './project-canonical-pages.ts';
export type ProjectCanonicalPageData={
  projectId:string;page:ProjectCanonicalPageKey;projectName:string;slug:string;
  edition:{id:string;title:string;revision:number;sourceVersion:string;documentVersion?:string|null;sourceSha256:string;glossary?:DdReportGlossary};
  chapters:DdReportChapter[];index:DdReportChapterSummary[];inputs:DdReportInput[];overrides:Record<string,DdReportValue>;
  records:DdLiveProjectPage|null;canEditRecords:boolean;canSaveInputs:boolean;canDownload:boolean;downloadRelease:DdDownloadRelease;
};
