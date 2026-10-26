import {ddEmphasize} from './DdReportRichText';
import {DdPageIntroduction} from './DdPageIntroduction';
import type {DdReportBody} from '../../../lib/dd-report-types';
const date=(value:string)=>new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));
export function DdReportChangeLog({data,slug}:{data:NonNullable<DdReportBody['changeLog']>;slug:string}){
  const local=Boolean(data.localReleases?.length);
  return <div className="ddr-change-log">
    <DdPageIntroduction chapterSlug="change-log" slug={slug}/>
    <dl className="ddr-change-log-versions"><div><dt>{local?'ローカル確認版':'公開中のWeb'}</dt><dd>v{data.currentVersion}</dd></div>{local&&<div><dt>本番のWeb</dt><dd>v{data.publishedVersion}</dd></div>}<div><dt>配布するPDF・Excel</dt><dd>v{data.downloadVersion}</dd></div></dl>
    {local&&<section className="ddr-change-log-pending"><h2>ローカルの変更・本番反映待ち</h2><ol className="ddr-change-log-list">{data.localReleases!.map(r=><li key={r.document_version}><div><strong>v{r.document_version}</strong><time dateTime={r.created_at}>{date(r.created_at)}</time></div><p>{ddEmphasize(r.summary,true)}</p></li>)}</ol></section>}
    {!local&&data.pending&&data.pending.length>0&&<section className="ddr-change-log-pending"><h2>ローカル・反映待ち</h2><p>次の変更はこの確認環境に保存済み。本番のWebと配布資料への反映は、まとめて実施する。</p><ul>{data.pending.map(p=><li key={p.title}><strong>{p.title}</strong><span>{p.summary}</span></li>)}</ul></section>}
    {data.historicalNotes&&data.historicalNotes.length>0&&<section aria-label="数値計画・調達条件の変更経緯"><h2>数値計画・調達条件の変更経緯</h2>{data.historicalNotes.map(note=><section key={note.id} id={note.sourceAddress?'cell-'+note.sourceAddress:note.id} style={{marginBottom:24}}><h3>{note.title}</h3><p className="ddr-change-log-note">{note.dateLabel}</p>{note.paragraphs.map((paragraph,i)=><p key={i}>{ddEmphasize(paragraph,true)}</p>)}{note.table&&<div style={{overflowX:'auto'}}><table><thead><tr>{note.table.headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{note.table.rows.map((r,i)=><tr key={i}>{r.map((value,j)=><td key={j} style={{textAlign:j?'right':'left'}}>{value}</td>)}</tr>)}</tbody></table></div>}</section>)}</section>}
    <h2>公開済みの変更</h2>
    <div className="ddr-change-log-head" aria-hidden="true"><span>版・更新日時</span><span>変更内容</span></div>
    <ol className="ddr-change-log-list">{data.releases.map(r=><li key={r.document_version+'-'+r.revision}><div><strong>v{r.document_version}</strong><time dateTime={r.created_at}>{date(r.created_at)}</time></div><p>{ddEmphasize(r.summary,true)}</p></li>)}</ol>
    <p className="ddr-change-log-note">登録済みの全{data.releases.length}版を掲載。{data.releases.length>0&&<>登録履歴はv{data.releases.at(-1)!.document_version}から。</>}過去の変更内容は、その版を更新した時点の記録。</p>
  </div>;
}
