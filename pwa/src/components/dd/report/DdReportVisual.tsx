import type {DdReportVisual as Visual,DdReportGlossary} from '@/lib/dd-report-types';
import {DdReportRichText} from './DdReportRichText';
import {DdProcessIllustration,ddProcessIllustrationKind} from './DdProcessIllustration';

/** Content-defined diagrams use the same versioned body in the browser and PDF. */
export function DdReportVisual({visual,slug,glossary,allRows}:{visual:Visual;slug:string;glossary?:DdReportGlossary;allRows?:boolean}) {
  const metalFlow=visual.kind==='flow'&&visual.nodes.some(n=>/金属/.test(n.title+n.text))&&visual.nodes.some(n=>/抽出|分離/.test(n.title));
  return <figure className={`ddr-visual ddr-visual-${visual.kind}`} aria-label={visual.title}>
    <figcaption>{visual.title}</figcaption><ol>{visual.nodes.map((node,i)=>{const art=node.illustration??(metalFlow?ddProcessIllustrationKind(node.title):null);return <li key={i} className={art?'ddr-visual-with-art':undefined}>
      {art&&<DdProcessIllustration kind={art}/>}<div>
      <div className="ddr-visual-step"><span aria-hidden="true">{String(i+1).padStart(2,'0')}</span><strong>{node.title}</strong></div>
      <div className="ddr-visual-text"><DdReportRichText text={node.text} id={`visual-${visual.afterRow}-${i}`} slug={slug} glossary={glossary} interactive={!allRows}/></div>
      </div>
      {visual.kind==='flow'&&i<visual.nodes.length-1&&<svg className="ddr-visual-arrow" viewBox="0 0 24 16" aria-hidden="true"><path d="M1 8h20m-6-6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>}
    </li>;})}</ol>
  </figure>;
}
