import type {DdReportEdition} from './dd-report-types';

/** 2026-10-19: hold the completed SOL files until Masa asks for a consolidated refresh. */
const SOL_DOWNLOAD={packageId:'b0540a9f-7bde-426c-81a7-8a56a59f5b15',revision:87,documentVersion:'2.0.2',sourceSha256:'f94077ac4d35c352999f1a9743f9ccd58128f18d62a2004f91e6dcec57b9e2cb',title:'SolvioraX｜投資検討資料'};
export type DdDownloadRelease={revision:number;documentVersion:string|null;paused:boolean};
export function ddReportExportsPaused(edition:Pick<DdReportEdition,'package_id'>){return edition.package_id===SOL_DOWNLOAD.packageId;}
export function ddReportDownloadEdition(edition:DdReportEdition):DdReportEdition{
  return ddReportExportsPaused(edition)?{...edition,revision:SOL_DOWNLOAD.revision,document_version:SOL_DOWNLOAD.documentVersion,source_sha256:SOL_DOWNLOAD.sourceSha256,title:SOL_DOWNLOAD.title}:edition;
}
export function ddReportDownloadRelease(edition:DdReportEdition):DdDownloadRelease{
  const file=ddReportDownloadEdition(edition);return {revision:file.revision,documentVersion:file.document_version??null,paused:ddReportExportsPaused(edition)};
}
export function ddReportPinnedOutputPrefix(edition:DdReportEdition,disclosureHash:string):string|null{
  return ddReportExportsPaused(edition)?`${SOL_DOWNLOAD.packageId}/${SOL_DOWNLOAD.sourceSha256}/exports/layout-v21-v${SOL_DOWNLOAD.documentVersion}-r${SOL_DOWNLOAD.revision}-${disclosureHash}`:null;
}
