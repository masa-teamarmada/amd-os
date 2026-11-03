'use client';

import {useId, useState} from 'react';
import {strategicResourcePoints, type ResourcePoint, type StrategicResources} from '@/lib/project-strategic-resources';
import styles from './ProjectStrategicResources.module.css';

const yen = (value: number) => (value / 1e8).toLocaleString('ja-JP', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '億円';
const money = (value: number) => Math.round(value).toLocaleString('ja-JP') + '円';
const percent = (value: number) => (value * 100).toFixed(2) + '%';
const shortDate = (date: string) => date.replaceAll('-', '/');
const eventKinds = new Set(['seed', 'evidence', 'series_a']);

/** 唯一の戦略余力本文。スペースの別やPJ固有の値を表示部品へ持ち込まない。 */
export function ProjectStrategicResources({data}: {data: StrategicResources | null}) {
  const [strength, setStrength] = useState(1);
  const [license, setLicense] = useState<number | 'mid'>('mid');
  const [selected, setSelected] = useState<number | null>(null);
  const chartId = useId();
  if (!data) return <section className={styles.page}><h2>戦略余力</h2><p className={styles.muted}>試算未登録</p></section>;
  const points = strategicResourcePoints(data.cases, strength, license);
  const baseline = strategicResourcePoints(data.baseline, data.baseline[0].strength, license);
  const current = points[0], final = points.at(-1)!;
  const active = points[selected ?? points.length - 1] ?? final;
  const eventName = (p: ResourcePoint) => p.kind === 'seed' ? 'シード調達' : p.kind === 'series_a' ? 'シリーズA調達完了' : data.evidence.find(e => e.id === p.evidenceId)?.name ?? (p.kind === 'today' ? '現在' : '月次の支出・価値更新');
  const events = points.flatMap((point, index) => eventKinds.has(point.kind) ? [{point, index}] : []);
  const start = Date.parse(current.date), end = Date.parse(final.date);
  const max = Math.ceil(Math.max(...points.map(p => p.total), ...baseline.map(p => p.total)) / 2e8) * 2e8;
  const min = Math.min(0, ...points.map(p => p.cash));
  const x = (p: ResourcePoint) => 64 + (Date.parse(p.date) - start) / (end - start || 1) * 856;
  const y = (value: number) => 302 - (value - min) / (max - min || 1) * 266;
  const line = (rows: ResourcePoint[], key: 'cash' | 'total') => rows.map((p, i) => `${i ? 'L' : 'M'}${x(p)},${y(p[key])}`).join(' ');
  const cashArea = line(points, 'cash') + ` L${x(final)},${y(0)} L${x(current)},${y(0)} Z`;
  const resourceArea = line(points, 'total') + ' ' + [...points].reverse().map(p => `L${x(p)},${y(p.cash)}`).join(' ') + ' Z';
  const title = eventName(active);
  const activeEvidence = data.evidence.find(e => e.id === active.evidenceId);
  const monthlyTicks = points.filter(p => p.kind === 'monthly');
  const tickStep = Math.max(1, Math.round(monthlyTicks.length / 4));
  const ticks = [current, ...monthlyTicks.filter((p, i) => i > 0 && i % tickStep === 0 && Date.parse(p.date) < end - (end - start) / 10), final];
  return <article className={styles.page} data-strategic-resource-version={data.revision}>
    <header className={styles.heading}><h2>戦略余力</h2><span className={styles.badge}>試算</span><span className={styles.meta}>評価日 {shortDate(data.asOf)} · {data.revision}</span></header>
    <p className={styles.definition}>保有資金と、技術・顧客実績・権利などから生まれる将来の正味価値を円で評価。</p>
    <div className={styles.summary}>
      <div><span>現在の戦略余力</span><strong>{yen(current.total)}</strong><small>{shortDate(current.date)}</small></div>
      <div><span>シリーズA調達完了時</span><strong>{yen(final.total)}</strong><small>{shortDate(final.date)} · 条件付き試算</small></div>
      <div><span>現在からの増分</span><strong>＋{yen(final.total - current.total)}</strong><small>資金調達・成果確認・時間経過を含む</small></div>
    </div>
    <section className={styles.section} aria-labelledby={chartId + '-heading'}>
      <div className={styles.sectionHeading}><h3 id={chartId + '-heading'}>戦略余力の推移</h3><span className={styles.meta}>単位：各評価時点の円</span></div>
      <p className={styles.scenario}>{data.scenario}</p>
      <div className={styles.controls}>
        <fieldset><legend>成果による評価の強さ</legend><div>{[[0.5, '控えめ'], [1, '基準'], [1.5, '強め']].filter(([n]) => data.cases.some(c => c.strength === n)).map(([value, label]) => <button key={value} type="button" aria-pressed={strength === value} onClick={() => setStrength(Number(value))}>{label}</button>)}</div></fieldset>
        <fieldset><legend>大学への利用対価</legend><div>{(['mid', ...new Set(data.cases.map(c => c.licenseYen))] as const).map(value => <button key={value} type="button" aria-pressed={license === value} onClick={() => setLicense(value)}>{value === 'mid' ? '中間' : (value / 10000).toLocaleString('ja-JP') + '万円'}</button>)}</div></fieldset>
      </div>
      <div className={styles.chartScroll}><svg key={`${strength}:${license}`} className={styles.chart} viewBox="0 0 1000 352" role="img" aria-labelledby={chartId + '-title ' + chartId + '-desc'}>
        <title id={chartId + '-title'}>現在からシリーズA調達完了までの戦略余力</title><desc id={chartId + '-desc'}>現在{yen(current.total)}から{yen(final.total)}。資金と将来の正味価値を積み上げ、成果確認と資金調達の変化を番号で表示。下の一覧で各変化の原因と金額を確認できる。</desc>
        {[0, .25, .5, .75, 1].map(f => {const value = min + (max - min) * f; return <g key={f}><line x1="64" x2="920" y1={y(value)} y2={y(value)} stroke="#e5e5e7"/><text x="52" y={y(value) + 4} textAnchor="end">{(value / 1e8).toFixed(0)}億</text></g>;})}
        <path d={cashArea} fill="#b9e7ef"/><path d={resourceArea} fill="#fce8bf"/>
        <path d={line(baseline, 'total')} fill="none" stroke="#86868b" strokeWidth="2" strokeDasharray="6 5"/>
        <path d={line(points, 'cash')} fill="none" stroke="#16869a" strokeWidth="1.5"/>
        <path d={line(points, 'total')} fill="none" stroke="#1d1d1f" strokeWidth="2.5"/>
        {events.map(({point, index}, n) => <g key={index}><line x1={x(point)} x2={x(point)} y1={y(point.total)} y2="302" stroke="#b8b8bd" strokeDasharray="2 4"/><circle cx={x(point)} cy={y(point.total)} r="11" fill="#fff" stroke="#1d1d1f"/><text x={x(point)} y={y(point.total) + 4} textAnchor="middle" className={styles.marker}>{n + 1}</text></g>)}
        {ticks.map((p, i) => <text key={i} x={x(p)} y="328" textAnchor={i === 0 ? 'start' : 'middle'}>{p.date.slice(0, 7).replace('-', '/')}</text>)}
        <text x="932" y={y(final.total) + 4} className={styles.totalLabel}>{(final.total / 1e8).toFixed(2)}億</text>
      </svg></div>
      <div className={styles.legend}><span><i className={styles.totalKey}/>戦略余力の総額</span><span><i className={styles.resourceKey}/>将来の正味価値</span><span><i className={styles.cashKey}/>保有資金</span><span><i className={styles.referenceKey}/>成果による見込み更新前</span></div>
      <div className={styles.detail} aria-live="polite"><div><span className={styles.meta}>{shortDate(active.date)}</span><strong>{title}</strong></div><dl><div><dt>戦略余力</dt><dd>{yen(active.total)}</dd></div><div><dt>保有資金</dt><dd>{yen(active.cash)}</dd></div><div><dt>将来の正味価値</dt><dd>{yen(active.businessValue)}</dd></div></dl>{activeEvidence&&<p className={styles.activeEffect}>{activeEvidence.effect}</p>}</div>
    </section>
    <section className={styles.section}><h3>変化の原因</h3><div className={styles.tableScroll}><table data-amie-list="custom"><thead><tr><th>時期・成果</th><th>増分</th><th>評価の根拠・確認条件</th></tr></thead><tbody>{events.map(({point, index}, n) => {
      const e = data.evidence.find(e => e.id === point.evidenceId), previous = points[index - 1];
      return <tr key={index} data-selected={selected === index}><th scope="row"><button type="button" onClick={() => setSelected(index)} aria-pressed={selected === index}><span className={styles.eventNumber}>{n + 1}</span><span><small>{shortDate(point.date)}</small>{eventName(point)}</span></button></th><td className={styles.amount}>＋{yen(point.funding + point.informationGain + point.costRelief)}</td><td>{e ? <><p>{e.condition}</p><small>長期事業の成立見込み {percent(previous.probability)} → {percent(point.probability)}</small></> : <p>{money(point.funding)}の着金を想定。保有資金と戦略余力が同額増加。</p>}</td></tr>;
    })}</tbody></table></div><p className={styles.footnote}>成果確認の増分は確認直前からの再評価額。月次には開発費・運営費・入金・割引の戻しを反映。</p></section>
    <details className={styles.disclosure}><summary>前提と計算方法</summary><div className={styles.notes}>
      <h3>評価の前提</h3><dl className={styles.parameters}><div><dt>年割引率</dt><dd>{percent(data.discountRate)}</dd></div><div><dt>開発の最終達成率</dt><dd>{percent(data.developmentAchievement)}</dd></div><div><dt>長期事業の成立見込み</dt><dd>{percent(current.probability)} → {percent(final.probability)}</dd></div></dl>
      {data.assumptions.map((note, i) => <p key={i}>{note}</p>)}
      <h3>成果の評価方法</h3><p>成果確認の前後で、後続事業の成立見込みと追加開発費を更新する。成立見込みのオッズに、先行する成果を条件とした情報係数を乗じる。</p><p>情報係数は試算上の仮定。控えめ・基準・強めは、係数の対数を0.5倍・1倍・1.5倍とした感度比較。</p>
      <div className={styles.tableScroll}><table data-amie-list="custom"><thead><tr><th>成果</th><th>情報係数（基準）</th></tr></thead><tbody>{data.evidence.map(e => <tr key={e.id}><th scope="row">{e.name}</th><td>{e.likelihoodRatio.toFixed(2)}</td></tr>)}</tbody></table></div>
      <h3>参照資料</h3>{data.sources.map((source, i) => <p key={i}>{source}</p>)}
    </div></details>
  </article>;
}
