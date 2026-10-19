import type {DdDevelopmentDependencies as Dependencies} from '@/lib/dd-report-types';

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
