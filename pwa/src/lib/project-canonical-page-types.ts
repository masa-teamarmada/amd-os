import type {DdLiveProjectPage} from './dd-project-page-types.ts';
import type {DdReportChapter,DdReportChapterSummary,DdReportGlossary,DdReportInput,DdReportValue} from './dd-report-types.ts';
import type {DdDownloadRelease} from './dd-report-download-policy.ts';
import type {ProjectCanonicalPageKey} from './project-canonical-pages.ts';
export type ProjectCanonicalPageData={
  projectId:string;page:ProjectCanonicalPageKey;projectName:string;slug:string;
  edition:{id:string;title:string;revision:number;sourceVersion:string;documentVersion?:string|null;sourceSha256:string;glossary?:DdReportGlossary};
  chapters:DdReportChapter[];index:DdReportChapterSummary[];inputs:DdReportInput[];overrides:Record<string,DdReportValue>;
  records:DdLiveProjectPage|null;canEditRecords:boolean;canSaveInputs:boolean;canDownload:boolean;downloadRelease:DdDownloadRelease;
};
