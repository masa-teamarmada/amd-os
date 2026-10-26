import type {DdReportChapter,DdReportEdition,DdReportRelease} from './dd-report-types.ts';
/** Edition-matched release records are shared by web and PDF; pending authoring notes are local-only. */
export function withDdReportChangeLog(chapter:DdReportChapter,edition:DdReportEdition,releases:DdReportRelease[],includePending=false):DdReportChapter {
  if(!chapter.body.changeLog)return chapter;
  return {...chapter,body:{...chapter.body,changeLog:{historicalNotes:chapter.body.changeLog.historicalNotes,currentVersion:edition.document_version??`r${edition.revision}`,downloadVersion:edition.download_snapshot?.documentVersion??edition.document_version??`r${edition.revision}`,releases:releases.filter(r=>r.scope!=='local'&&r.revision<=edition.revision).sort((a,b)=>b.revision-a.revision),...(includePending?{pending:chapter.body.changeLog.pending,publishedVersion:chapter.body.changeLog.publishedVersion,localReleases:chapter.body.changeLog.localReleases?.filter(r=>r.revision<=edition.revision).sort((a,b)=>b.revision-a.revision)}: {})}}};
}
