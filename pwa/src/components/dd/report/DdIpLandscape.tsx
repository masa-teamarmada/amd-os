'use client';
import {ddEmphasize} from './DdReportRichText';
import {useEffect,useId,useMemo,useRef,useState} from 'react';
import {PatentMap} from '../../cockpit/PatentMap';
import type {IpAsset} from '../../../lib/project-ip';
import type {DdIpLandscape as Landscape,DdIpLandscapeEntry,DdIpMapAsset} from '../../../lib/dd-report-types';

const IMPORTANCE_LABELS=['','参考','低','中','高','中核'];

const BREADTH_LABELS=['','極狭','狭い','中','広い','極広'];

function BreadthAssessment({asset,print}:{asset:DdIpMapAsset;print:boolean}){
  const evaluation=asset.breadthAssessment;
  if(!evaluation)return null;
  return <section className="ddr-ip-assessment" data-breadth-assessment={asset.id}>
    <div className="ddr-ip-assessment-heading"><h3>権利範囲の評価</h3><strong>{asset.claimBreadth==null?'原本未取得':`${asset.claimBreadth} / 5 · ${BREADTH_LABELS[asset.claimBreadth]}`}</strong></div>
    {print&&<p className="ddr-ip-assessment-number">{asset.title} · {asset.number}</p>}
    <p className="ddr-ip-assessment-meta">{evaluation.claimSet} · {evaluation.claims} · 確認 {evaluation.reviewedAt}</p>
    {!!evaluation.requirements.length&&<><h4>請求項の必須要件</h4><ul>{evaluation.requirements.map(requirement=><li key={requirement}>{requirement}</li>)}</ul></>}
    <h4>{asset.claimBreadth==null?'評価に必要な資料':'評価理由'}</h4><p>{ddEmphasize(evaluation.reason,true)}</p>
    <a href={evaluation.source.url} target={print?undefined:'_blank'} rel="noreferrer">{evaluation.source.label} ↗</a>
  </section>;
}

function BusinessAssessment({asset}:{asset:DdIpMapAsset}){
  const evaluation=asset.businessAssessment;
  if(!evaluation)return null;
  return <section className="ddr-ip-assessment ddr-ip-business" data-business-assessment={asset.id}>
    <div className="ddr-ip-assessment-heading"><h3>SOLの事業との関係</h3><strong>重要度 {asset.importance} / 5 · {IMPORTANCE_LABELS[asset.importance??0]}</strong></div>
    <p className="ddr-ip-assessment-meta">{evaluation.basis==='claims'?'請求項と事業計画に基づく評価':'書誌情報と事業上の役割に基づく評価'} · 確認 {evaluation.reviewedAt}</p>
    <p>{ddEmphasize(evaluation.relevance,true)}</p><h4>重なる技術・工程</h4><p>{ddEmphasize(evaluation.overlap,true)}</p><h4>確認すべきこと</h4><p>{ddEmphasize(evaluation.verify,true)}</p>
  </section>;
}

function ApplicantChart({data,print}:{data:Landscape;print:boolean}){
  const research=data.applicantLandscape;
  if(!research)return null;
  const applicants=[...research.applicants].sort((a,b)=>(b.total??-1)-(a.total??-1)||a.name.localeCompare(b.name,'ja'));
  const max=Math.max(1,...applicants.map(a=>a.total??0));
  const panelCount=print?2:3,perPanel=Math.ceil(applicants.length/panelCount);
  const panels=Array.from({length:panelCount},(_,i)=>applicants.slice(i*perPanel,(i+1)*perPanel));
  const commentary=data.commentary?.applicants;
  const count=(applicant:typeof applicants[number],area:'all'|'water'|'lipid'|'device')=>{
    const n=area==='all'?applicant.total:applicant.areas[area],source=applicant.sources[area];
    return n==null?<span className="ddr-ip-count-pending">集計中</span>:source?<a href={source.url} target={print?undefined:'_blank'} rel="noreferrer" title={`${applicant.name} · ${area==='all'?'3領域の合計':research.queries.find(q=>q.id===area)?.label} · ${n}系列`}>{n.toLocaleString('ja-JP')}</a>:<span>{n.toLocaleString('ja-JP')}</span>;
  };
  return <section className={'ddr-ip-applicants'+(print?' ddr-ip-portfolio-print':'')} aria-labelledby="ip-applicant-chart-title">
    <h2 id="ip-applicant-chart-title">関連領域の出願人別出願数</h2>
    {commentary&&<aside className="ddr-ip-commentary" data-ip-commentary="applicants"><h3>{commentary.title}</h3><p>{ddEmphasize(commentary.text,true)}</p></aside>}
    <figure className="ddr-ip-portfolio" aria-label="関連領域全体の出願人別公開出願系列数">
      <figcaption><span>{research.coverage} · 比較{applicants.length}出願人</span><span>単位：同族1系列 · {research.provider} · 集計{research.asOf}</span></figcaption>
      <div className="ddr-ip-portfolio-grid">{panels.map((panel,i)=><table className="ddr-ip-portfolio-table" key={i}>
        <caption className="sr-only">公開出願系列数：{i*perPanel+1}〜{i*perPanel+panel.length}位</caption>
        <colgroup><col style={{width:'42%'}}/><col style={{width:'28%'}}/>{research.queries.map(q=><col key={q.id} style={{width:'10%'}}/>)}</colgroup>
        <thead><tr><th scope="col">出願人</th><th scope="col">合計</th><th scope="col" title={research.queries[0].label}>廃液</th><th scope="col" title={research.queries[1].label}>脂質</th><th scope="col" title={research.queries[2].label}>培養</th></tr></thead>
        <tbody>{panel.map((applicant,j)=><tr key={applicant.id} data-applicant={applicant.id} data-portfolio-total={applicant.total??undefined}>
          <th scope="row"><span className="ddr-ip-portfolio-rank">{i*perPanel+j+1}</span>{applicant.sources.all?<a href={applicant.sources.all.url} title={applicant.aliases.join(' ／ ')} target={print?undefined:'_blank'} rel="noreferrer">{applicant.name}</a>:applicant.name}</th>
          <td><div className="ddr-ip-portfolio-total"><span className="ddr-ip-portfolio-track" aria-hidden="true"><i style={{width:`${(applicant.total??0)/max*100}%`}}/></span><strong>{count(applicant,'all')}</strong></div></td>
          {(['water','lipid','device'] as const).map(area=><td key={area} data-area={area}>{count(applicant,area)}</td>)}
        </tr>)}</tbody>
      </table>)}</div>
      <p className="ddr-ip-chart-note">廃液：金属・色素・排水処理 ／ 脂質：脂肪酸・油脂・燃料生産 ／ 培養：培養・分離・回収。{research.method}</p>
    </figure>
    <details className="ddr-ip-rubric ddr-ip-portfolio-method" open={print||undefined}><summary>検索条件・出願人名の統合</summary><p>{research.selection} {research.nameMethod}</p><dl>{research.queries.map(q=><div key={q.id}><dt>{q.label}</dt><dd>{q.expression}</dd></div>)}</dl><p>検索項目：発明名称・要約と特許分類。公開日：{research.publicationCutoff}まで。集計：{research.asOf}。権利の存続・失効を含む公開出願の活動量。</p><dl className="ddr-ip-portfolio-aliases">{applicants.map(a=><div key={a.id}><dt>{a.name}</dt><dd>{a.aliases.join(' ／ ')}{a.note&&` · ${a.note}`}</dd></div>)}</dl><div className="ddr-ip-sources">{research.sources.map(source=><a key={source.url} href={source.url} target={print?undefined:'_blank'} rel="noreferrer">{source.label} ↗</a>)}</div></details>
  </section>;
}

export function DdIpLandscape({data,print=false,projectId=""}:{data:Landscape;print?:boolean;projectId?:string}){
  const [activeId,setActiveId]=useState<string|null>(null),dialogRef=useRef<HTMLDialogElement>(null),titleId=useId();
  const selected=data.mapAssets.find(asset=>asset.id===activeId);
  const active=data.entries.find(entry=>entry.id===selected?.entryId);
  const assets=useMemo<IpAsset[]>(()=>data.mapAssets.map(asset=>({
    ip_asset_id:asset.id,project_id:projectId,relation:asset.relation,ip_kind:'patent',title:asset.title,
    abstract_text:null,jurisdiction:'',family_key:asset.entryId,application_number:asset.number,
    publication_number:null,registration_number:null,application_date:asset.applicationDate,publication_date:null,
    registration_date:null,expiry_date:null,applicants:asset.applicants,inventors:null,status:'unknown',
    tech_domain:asset.techDomain,ipc_codes:null,cpc_codes:null,claim_breadth:asset.claimBreadth,
    importance:asset.importance??3,threat_level:null,confidentiality:'confidential',note_md:null,external_url:null,
    source_kind:'dd_verified_bibliography',external_sync_at:null,priority_date:null,examination_requested_on:null,
    annuity_status:'unknown',annuity_paid_through_on:null,pct_status:'unknown',pct_number:null,current_assignee:null,
    practice_status:'unknown',annual_cost_yen:null,owner_member_id:null,attorney_firm:null,last_verified_on:data.asOf,
    family_size:null,citation_count:null,
  })),[data.mapAssets,data.asOf,projectId]);
  useEffect(()=>{const dialog=dialogRef.current;if(!dialog)return;if(activeId&&!dialog.open)dialog.showModal();if(!activeId&&dialog.open)dialog.close();},[activeId]);
  const details=(entry:DdIpLandscapeEntry)=><>
    <dl className="ddr-ip-bibliography"><div><dt>出願人・公報上の名義</dt><dd>{entry.owner}</dd></div><div><dt>関連する出願・公開番号</dt><dd>{entry.numbers.join('／')}</dd></div><div><dt>資料の種類・日付</dt><dd>{entry.publicationType} · {entry.dates}</dd></div><div><dt>権利・手続の状態</dt><dd>{entry.rightsState}</dd></div></dl>
    <section><h3>{entry.basis==='claims'?'公報の請求対象':'研究者資料の出願情報'}</h3><p>{ddEmphasize(entry.summary,true)}</p></section>
    <section><h3>技術の比較点</h3><p>{ddEmphasize(entry.comparison,true)}</p></section>
    <div className="ddr-ip-sources">{entry.sources.map(source=><a key={source.url} href={source.url} target={print?undefined:'_blank'} rel="noreferrer">{source.label} ↗</a>)}</div>
  </>;
  return <section className={'ddr-ip-landscape ddr-ip-standard'+(print?' ddr-ip-landscape-print':'')} aria-label="知財マップ">
    <PatentMap assets={assets} onSelect={asset=>setActiveId(asset.ip_asset_id)} assessmentDisplay="explicit" importanceDisplay="assessed" print={print}/>
    {data.commentary?.map&&<aside className="ddr-ip-commentary" data-ip-commentary="map"><h3>{data.commentary.map.title}</h3><p>{ddEmphasize(data.commentary.map.text,true)}</p>{data.mapGuides&&<dl className="ddr-ip-map-guides">{data.mapGuides.map(guide=><div key={guide.title}><dt>{guide.title}</dt><dd>{guide.text}</dd></div>)}</dl>}</aside>}
    <p className="ddr-ip-methodology">{ddEmphasize(data.methodology,true)}</p>
    {!!data.breadthRubric?.length&&<details className="ddr-ip-rubric" open={print||undefined}><summary>権利範囲の評価基準</summary><dl>{[...data.breadthRubric].reverse().map(item=><div key={item.score}><dt>{item.score} · {item.label}</dt><dd>{item.description}</dd></div>)}</dl></details>}
    {!!data.importanceRubric?.length&&<details className="ddr-ip-rubric" open={print||undefined}><summary>重要度の評価基準</summary><dl>{data.importanceRubric.map(item=><div key={item.score}><dt>{item.score} · {item.label}</dt><dd>{item.description}</dd></div>)}</dl></details>}
    {data.searchCoverage&&<details className="ddr-ip-rubric ddr-ip-search" open={print||undefined}><summary>検索した分野・キーワード</summary><p>{data.searchCoverage.scope}（{data.searchCoverage.asOf}、{data.searchCoverage.queryCount}検索式）</p><dl>{data.searchCoverage.areas.map(area=><div key={area.label}><dt>{area.label}</dt><dd>{area.keywords.join(' ／ ')}</dd></div>)}</dl></details>}
    <ApplicantChart data={data} print={print}/>
    {print?<div className="ddr-ip-print-details">{data.entries.map(entry=><section key={entry.id} data-publication-id={entry.id}><h3>{entry.id} · {entry.title}</h3>{data.mapAssets.filter(asset=>asset.entryId===entry.id).map(asset=><div key={asset.id}><BusinessAssessment asset={asset}/><BreadthAssessment asset={asset} print/></div>)}{details(entry)}</section>)}</div>:<dialog ref={dialogRef} className="ddr-progress-dialog ddr-ip-dialog" aria-labelledby={titleId} onClose={()=>setActiveId(null)}>
      <div className="ddr-progress-dialog-toolbar"><span>特許マップの詳細</span><button type="button" autoFocus onClick={()=>dialogRef.current?.close()}>閉じる <span aria-hidden="true">×</span></button></div>
      {active&&selected&&<div className="ddr-progress-dialog-body"><div className="ddr-ip-detail-kind">{active.id} · {active.group==='university'?'杉浦先生の出願（愛媛大学）':'近接公報'} · {selected.claimBreadth==null?'書誌情報に基づく配置':'請求項に基づく比較'}</div><h2 id={titleId}>{selected.title}</h2><p className="ddr-ip-selection">{selected.number} ／ {selected.techDomain} ／ 出願日：{selected.applicationDate}</p><BusinessAssessment asset={selected}/><BreadthAssessment asset={selected} print={false}/>{details(active)}</div>}
    </dialog>}
  </section>;
}
