"use client";

import { computeCostComparison, type CostComparison, type CostRange } from "@/lib/project-cost-comparison";
import styles from "./CockpitCostComparison.module.css";

const number = (n: number) => n.toLocaleString("ja-JP", { maximumFractionDigits: 0 });
function Range({ value, rounded = false }: { value: CostRange; rounded?: boolean }) {
  const format = (n: number) => number(rounded ? Math.round(n / 10) * 10 : n);
  return <span className={styles.number}><span>{format(value[0])}</span><span>〜</span><span>{format(value[1])}</span></span>;
}

export function CockpitCostComparison({ comparison }: { comparison: CostComparison | null }) {
  if (!comparison) return <div className={styles.empty} data-testid="cost-comparison-empty">競合プロセスの試算は未登録。対象排水・処理方式・費用範囲を揃えた比較資料を登録すると、ここに表示される。</div>;
  const volume = comparison.basis.dailyVolumeM3 * comparison.basis.operatingDays;
  return <article className={styles.root} data-testid="cost-comparison">
    <header className={styles.header}>
      <div className={styles.titleRow}><h2 className={styles.title}>{comparison.title}</h2><span className={styles.badge}>仮設計・見積未取得</span><span className={styles.date}>{comparison.asOf}</span></div>
      <p className={styles.summary}>{comparison.summary}</p>
      <div className={styles.basis} aria-label="競合試算の比較条件">
        <span>比較用排水量 <strong>{number(comparison.basis.dailyVolumeM3)} m³/日</strong></span>
        <span>稼働 <strong>{number(comparison.basis.operatingDays)} 日/年</strong></span>
        <span>年間 <strong>{number(volume)} m³</strong></span>
        <span>設備の単純年割 <strong>{number(comparison.basis.allocationYears)} 年</strong></span>
      </div>
    </header>

    {comparison.industries.map((industry) => <section className={styles.industry} key={industry.key} data-testid={`cost-comparison-${industry.key}`} aria-label={`${industry.label}の競合プロセス試算`}>
      <h3>{industry.label}</h3>
      <p className={styles.flow}>{industry.pretreatment.join(" → ")} <strong>→ 各脱色工程</strong></p>
      <table data-amie-list="matrix" className={styles.table}>
        <thead><tr><th scope="col">脱色方式</th><th scope="col">設備・工事費<span className={styles.unit}>CAPEX・円</span></th><th scope="col">年間運転費<span className={styles.unit}>OPEX・円/年</span></th><th scope="col">運転費<span className={styles.unit}>円/m³</span></th><th scope="col">設備年割＋運転費<span className={styles.unit}>参考額・円/m³</span></th></tr></thead>
        <tbody>{industry.scenarios.map((scenario) => {
          const result = computeCostComparison(comparison, industry, scenario);
          const method = comparison.methods.find((m) => m.key === scenario.methodKey);
          if (!result || !method) return null;
          return <tr key={scenario.methodKey} data-method={scenario.methodKey}>
            <th scope="row">{method.label}</th>
            <td><span className={styles.mobileLabel}>設備・工事費（円）</span><Range value={result.capexYen} /></td>
            <td><span className={styles.mobileLabel}>年間運転費（円/年）</span><Range value={result.annualOpexYen} /></td>
            <td><span className={styles.mobileLabel}>運転費（円/m³）</span><Range value={result.opexPerM3} /></td>
            <td className={styles.total}><span className={styles.mobileLabel}>設備年割＋運転費（円/m³）</span><Range value={result.totalPerM3} rounded /></td>
          </tr>;
        })}</tbody>
      </table>
    </section>)}

    <details className={styles.details} data-testid="cost-comparison-basis">
      <summary>前提と計算の内訳</summary>
      <div className={styles.body}>
        <p>{comparison.basis.note}</p>
        <p>設備・工事費＝前段＋脱色工程。運転費/m³＝前段＋脱色工程。年間運転費＝運転費/m³×年間排水量。設備年割/m³＝設備・工事費÷年割期間÷年間排水量。参考額＝設備年割/m³＋運転費/m³（10円単位に丸める）。</p>
        <p>設備費は同等の処理設備を新設する場合の概算。既設工場の取得価額・帳簿上の償却費・残価は確認待ち。</p>
        {comparison.industries.map((industry) => <section key={industry.key}>
          <h4>{industry.label}の前段</h4><p>{industry.influent}</p>
          <p>設備・工事費 <Range value={industry.baseCapexYen} /> 円 ／ 運転費 <Range value={industry.baseOpexPerM3} /> 円/m³。</p>
          <p>{industry.basisNote}</p>
          <h4>{industry.label}の脱色工程の追加費</h4>
          <ul>{industry.scenarios.map((scenario) => <li key={scenario.methodKey}><strong>{comparison.methods.find((m) => m.key === scenario.methodKey)?.label}</strong>：設備・工事費 <Range value={scenario.capexYen} /> 円、運転費 <Range value={scenario.opexPerM3} /> 円/m³。{scenario.note}</li>)}</ul>
          <h4>投入量の仮定</h4><ul>{industry.doses.map((dose) => <li key={dose.label}>{dose.label}：{dose.value}</li>)}</ul>
        </section>)}
        <h4>仮単価</h4><ul>{comparison.unitPrices.map((p) => <li key={p.label}>{p.label}：{number(p.value)} {p.unit}。{p.note}</li>)}</ul>
      </div>
    </details>
    <details className={styles.details} data-testid="cost-comparison-methods">
      <summary>4方式の処理プロセスと費用範囲</summary>
      <div className={styles.body}>
        {comparison.methods.map((method) => <div className={styles.method} key={method.key}><strong>{method.label}</strong><p>前処理・生物処理 → {method.steps.join(" → ")}</p><p>主な費用：{method.drivers.join("、")}。{method.equipmentNote}</p></div>)}
        <h4>設備・工事費へ含む範囲</h4><p>{comparison.capexIncludes.join("、")}。</p>
        <h4>運転費へ含む範囲</h4><p>{comparison.opexIncludes.join("、")}。</p>
      </div>
    </details>
    <details className={styles.details} data-testid="cost-comparison-sources">
      <summary>公開資料と推定の対応</summary>
      <div className={styles.body}>{comparison.sources.map((source) => <div className={styles.source} key={source.id}>
        <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a> <small>公開：{source.published}</small>
        <p>公開資料の内容：{source.observed}</p><p>試算での扱い：{source.usage}</p>
      </div>)}</div>
    </details>
    <details className={styles.details} data-testid="cost-comparison-unpriced" open>
      <summary>未見積の費用と比較の限界</summary>
      <div className={styles.body}><p>未見積：{comparison.unpriced.join("、")}。上表の金額に追加確認が必要。</p><ul>{comparison.limits.map((limit) => <li key={limit}>{limit}</li>)}</ul></div>
    </details>
  </article>;
}
