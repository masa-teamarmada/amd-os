import type {DdReportChapter} from '@/lib/dd-report-types';

/** Shared by the reader and PDF so the reporting and advisory lines agree. */
export function DdOrganizationChart({chapter}:{chapter:DdReportChapter}) {
  const cells=new Map(chapter.body.rows.flatMap(row=>row.cells).map(cell=>[cell.address,String(cell.value)]));
  const label=(address:string,x:number,y:number,lineHeight=24)=>
    <text x={x} y={y} textAnchor="middle">{(cells.get(address)||'').split('\n').map((line,i)=><tspan key={i} x={x} dy={i?lineHeight:0} className={i?'ddr-organization-secondary':undefined}>{line}</tspan>)}</text>;
  const member=(address:string,x:number,y:number)=>
    <g key={address} data-source-cell={address}><rect className="ddr-organization-card" x={x} y={y} width="264" height="62"/>{label(address,x+132,y+(cells.get(address)?.includes('\n')?25:38),23)}</g>;
  return <figure className="ddr-organization">
    <svg viewBox="0 0 1080 648" role="img" aria-label="SolvioraX 設立時の予定組織図" className="ddr-organization-diagram">
      <title>SolvioraX 設立時の予定組織図</title>
      <desc>株主総会、経営会議、CEO、経営企画部と技術開発部の順を示す。取締役会は非設置。石原先生は経営企画部長へ、中島先生はCTOへ点線で助言関係を示す。</desc>
      <g className="ddr-organization-line"><path d="M530 58V76M530 124V146M530 222V248H360V272M530 248H700V272M360 346V376M700 346V376"/></g>
      <g className="ddr-organization-support-line"><path d="M360 361H190M700 361H878"/></g>
      <g className="ddr-organization-board" data-source-cell="M6"><rect x="382" y="10" width="296" height="48"/>{label('M6',530,41)}</g>
      <g className="ddr-organization-board" data-source-cell="M8"><rect x="382" y="76" width="296" height="48"/>{label('M8',530,106,22)}</g>
      <g className="ddr-organization-ceo" data-source-cell="M11"><rect x="382" y="146" width="296" height="76"/>{label('M11',530,176,27)}</g>
      <g className="ddr-organization-lead" data-source-cell="E19"><rect x="212" y="272" width="296" height="74"/>{label('E19',360,301,26)}</g>
      <g className="ddr-organization-lead" data-source-cell="V19"><rect x="552" y="272" width="296" height="74"/>{label('V19',700,301,26)}</g>
      <g className="ddr-organization-support" data-source-cell="AE23"><rect x="878" y="324" width="198" height="74"/>{label('AE23',977,353,26)}</g>
      <g className="ddr-organization-department" data-department="management">
        <rect x="212" y="376" width="296" height="264"/>
        <rect className="ddr-organization-department-heading" x="212" y="376" width="296" height="42"/>
        <text className="ddr-organization-department-title" x="360" y="404" textAnchor="middle">{cells.get('C27')}</text>
        {['D35','D39','D43'].map((address,i)=>member(address,228,430+i*68))}
      </g>
      <g className="ddr-organization-department" data-department="technology">
        <rect x="552" y="376" width="296" height="264"/>
        <rect className="ddr-organization-department-heading" x="552" y="376" width="296" height="42"/>
        <text className="ddr-organization-department-title" x="700" y="404" textAnchor="middle">{cells.get('R27')}</text>
        {['T31','T35','T39'].map((address,i)=>member(address,568,430+i*68))}
      </g>
      <g className="ddr-organization-support ddr-organization-external" data-source-cell="D31"><rect x="2" y="305" width="188" height="112"/>{label('D31',96,332,23)}</g>
    </svg>
    <figcaption>{['B50','B52'].map(address=>cells.get(address)&&<p key={address}>{cells.get(address)}</p>)}</figcaption>
  </figure>;
}
