import type {DdReportRelease} from '@/lib/dd-report-types';

const releasedAt=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});

export function DdReportReleaseHistory({version,releases}:{version:string;releases:DdReportRelease[]}){
  return <details className="group min-w-0 text-[12px] leading-5 text-[#526874] print:hidden">
    <summary className="flex min-h-8 w-fit cursor-pointer list-none items-center gap-2 rounded px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0876ba]">
      <span className="font-semibold text-[#0876ba]">DD資料 v{version}</span>
      <span className="text-[#6e6e73]">変更履歴 <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-180">▾</span></span>
    </summary>
    <div className="my-2 max-h-80 overflow-y-auto rounded-md border border-[#dce7ee] bg-[#f6fafd] px-4 py-3">
      <h2 className="mb-2 text-sm font-semibold text-[#193f50]">DD資料の変更履歴</h2>
      <ol className="space-y-3">{releases.map(release=><li key={release.document_version}>
        <div className="flex flex-wrap items-baseline gap-x-3"><span className="font-semibold text-[#193f50]">v{release.document_version}</span><time className="text-[11px] text-[#6e6e73]" dateTime={release.created_at}>{releasedAt.format(new Date(release.created_at))}</time></div>
        <p className="mt-1 break-words">{release.summary}</p>
      </li>)}</ol>
    </div>
  </details>;
}
