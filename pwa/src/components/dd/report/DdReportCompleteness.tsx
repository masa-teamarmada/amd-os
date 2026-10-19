import type {DdCoverage,DdDevelopmentDependencies as Dependencies,DdReportChapterSummary} from '@/lib/dd-report-types';

/** Versioned process dependencies, shared by the web reader and the PDF. */
export function DdDevelopmentDependencies({diagram}:{diagram:Dependencies}){
  const boxes:Record<string,[number,number,number,number]>={'1':[8,130,242,250],'2':[300,8,250,225],'3':[600,8,250,225],'4':[300,290,550,155],'5':[915,130,260,240]};
  const paths:Record<string,string>={'1-2':'M250 180H275V120H298','1-4':'M250 300H275V365H298','2-3':'M550 120H598','2-5':'M550 200H575V260H900V245H913','3-5':'M850 120H885V195H913','4-5':'M850 365H885V305H913'};
  const labels:Record<string,[number,number]>={'1-2':[275,68],'1-4':[275,410],'2-3':[575,97],'2-5':[730,254],'3-5':[885,90],'4-5':[884,398]};
  return <figure className="ddr-dependencies" aria-label="技術開発5領域の依存関係と次工程への移行条件">
    <figcaption>5領域の関係と、次の工程へ渡す条件</figcaption><p>{diagram.intro}</p>
    <svg viewBox="0 0 1185 460" role="img" aria-label="菌体生産から廃液処理・燃料開発へ、廃液処理から金属精製へ、合格した工程を量産へ移す">
      <defs><marker id="dd-development-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7" fill="#147d92"/></marker></defs>
      {diagram.edges.map(e=>{const k=e.from+'-'+e.to,[x,y]=labels[k];return <g key={k} data-dependency={k}><path d={paths[k]} stroke="#147d92" strokeWidth="2" fill="none" markerEnd="url(#dd-development-arrow)"/><text x={x} y={y} textAnchor="middle" fontSize="10" fill="#147d92">{e.label.split('\n').map((t,i)=><tspan key={i} x={x} dy={i?15:0}>{t}</tspan>)}</text></g>;})}
      {diagram.nodes.map(n=>{const [x,y,w,h]=boxes[n.id];return <foreignObject key={n.id} x={x} y={y} width={w} height={h}><div className={'ddr-dependency-node ddr-dependency-'+n.id}><h3><b>{n.id}</b>{n.title}</h3><p>{n.work}</p><div><strong>次へ進む条件</strong><p>{n.pass}</p></div><footer><strong>渡すもの</strong> {n.deliverable}</footer></div></foreignObject>;})}
    </svg><p className="ddr-dependency-approval">{diagram.approval}</p>
  </figure>;
}

/** Four-way publication ledger. Counts refer to source content, not empty worksheet cells. */
export function DdCoverageMatrix({coverage,slug,index,allRows,revision,workbookName}:{coverage:DdCoverage;slug:string;index:DdReportChapterSummary[];allRows?:boolean;revision?:number;workbookName?:string}){
  const fresh=!revision||revision===coverage.verifiedRevision;
  const target=(s:string)=>index.find(c=>c.slug===s),href=(s:string)=>`/dd/${encodeURIComponent(slug)}?chapter=${s}`;
  const excel=allRows&&workbookName?encodeURI(workbookName):`/api/dd/${encodeURIComponent(slug)}/report/export?format=xlsx&scope=all${revision?'&revision='+revision:''}`;
  return <section className="ddr-coverage" aria-label="元Excel・OS・PDF・Excelの全資料対応表">
    <h2>元Excelから、OS・配布ファイルへの掲載対応</h2>
    <p>{coverage.method}</p><p className="ddr-coverage-key">掲載先の対応と、配布実物の確認は分けて記録する。最終照合：資料版 {coverage.verifiedRevision}。{!fresh&&<strong> 現在の資料は更新されているため、配布実物の再照合が必要。</strong>}</p>
    <div className="ddr-coverage-metrics"><div><strong>38 / 38</strong><span>元Excelの全シートを照合</span></div><div><strong>{coverage.sourceCells.toLocaleString('ja-JP')}</strong><span>本文・表の元セル</span></div><div><strong>{coverage.unexplainedMissing}</strong><span>照合版で理由のない欠落</span></div></div>
    <p className="ddr-coverage-key"><b>本文・図 → PDF</b> ／ <b>計算・一覧の明細 → Excel</b>。数値資料のPDFには、概要・グラフと同梱Excelへの案内を掲載。OS欄の資料名から本文へ移動できる。</p>
    <div className="ddr-table-scroll"><table><thead><tr className="ddr-table-head"><th>元Excel {coverage.sourceVersion}</th><th>現在のOS</th><th>ダウンロードPDF</th><th>ダウンロードExcel</th><th>照合結果・変更内容</th></tr></thead><tbody>{coverage.entries.map(e=><tr key={e.slug} data-coverage-sheet={e.sheet}>
      <td><strong>{e.sheet}</strong><small>{e.sourceCells.toLocaleString()}セル{e.sourceFigures>0?'・図'+e.sourceFigures+'点':''}</small></td>
      <td>{(e.targets??[e.slug]).map(s=><a key={s} href={href(s)}>{target(s)?.title??s} ↗<br/></a>)}<small>現行 {e.currentCells.toLocaleString()}セル</small></td>
      <td>{e.pdf}<small>{e.figureNote}</small></td><td>{e.excel.length?e.excel.map(s=><span key={s}>「{s}」<br/></span>):<span className="ddr-coverage-route">本文はPDFに掲載</span>}</td>
      <td><b className="ddr-coverage-pass">{fresh?'照合済':'前版で照合'}</b><small>元位置 {e.sameAddress.toLocaleString()}{e.relocated?'／移動・統合 '+e.relocated:''}{e.removed?'／指示による削除 '+e.removed:''}</small>{e.note&&<small>{e.note}</small>}</td>
    </tr>)}</tbody></table></div>
    <p>照合元：Excel {coverage.sourceVersion}（SHA-256：<code>{coverage.sourceSha256}</code>）。計算式は元モデルと照合し、配布Excelの数値・数式・入力条件・感度分析表も確認する。</p><p><a href={excel}>数値計画・試算・一覧表のExcelを開く ↗</a></p>
  </section>;
}
