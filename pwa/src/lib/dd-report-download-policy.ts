import type {DdReportEdition} from './dd-report-types';

/** A saved release pauses generation independently from the editable document version. */
export type DdDownloadRelease={revision:number;documentVersion:string|null;paused:boolean};
export function ddReportExportsPaused(edition:Pick<DdReportEdition,'download_snapshot'>){return !!edition.download_snapshot;}
export function ddReportDownloadEdition(edition:DdReportEdition):DdReportEdition{
  const file=edition.download_snapshot;return file?{...edition,revision:file.revision,document_version:file.documentVersion,source_sha256:file.sourceSha256,title:file.title}:edition;
}
export function ddReportDownloadRelease(edition:DdReportEdition):DdDownloadRelease{
  const file=ddReportDownloadEdition(edition);return {revision:file.revision,documentVersion:file.document_version??null,paused:ddReportExportsPaused(edition)};
}
export function ddReportPinnedOutputPrefix(edition:DdReportEdition,disclosureHash:string):string|null{
  const file=edition.download_snapshot;return file?`${edition.package_id}/${file.sourceSha256}/exports/${file.layoutVersion}-v${file.documentVersion}-r${file.revision}-${disclosureHash}`:null;
}
