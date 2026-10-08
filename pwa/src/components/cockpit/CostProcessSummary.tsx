"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { APPLICATION_LABEL, LOCATION_SHORT_LABEL, METHOD_LABEL, STRAIN_LABEL, type CostComputation, type CostModelBundle } from "@/lib/project-cost-model";
import { computeProcessSummary, type CostProcessKey, type ProcessSelection } from "@/lib/cost-process-summary";
import { CostProcessAnimation } from "./CostProcessAnimation";
import styles from "./CostProcessSummary.module.css";

const amount = (n: number) => n.toLocaleString("ja-JP", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const yen = (n: number) => `${Math.round(n).toLocaleString("ja-JP")}円`;

export function CostProcessSummary({ bundle, computed, selection, unit }: {
  bundle: CostModelBundle; computed: CostComputation; selection: ProcessSelection; unit: string;
}) {
  const summary = useMemo(() => computeProcessSummary(bundle, computed, selection), [bundle, computed, selection]);
  const [playing, setPlaying] = useState(true);
  const [opened, setOpened] = useState<CostProcessKey | null>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!opened) return;
    detailHeading.current?.focus({ preventScroll: true });
    detailHeading.current?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, [opened]);
  const closeDetail = () => { setOpened(null); opener.current?.focus({ preventScroll: true }); };
  if (!summary) return null;
  const selected = summary.steps.find((s) => s.key === opened);
  const max = Math.max(1, ...summary.steps.map((s) => s.capex + s.opex));
  const scenario = [computed.strain && STRAIN_LABEL[computed.strain], selection.application && APPLICATION_LABEL[selection.application], LOCATION_SHORT_LABEL[selection.location], METHOD_LABEL[selection.method]].filter(Boolean).join("・");
  return <section className={styles.summary} data-testid="cost-process-summary" data-playing={playing} aria-label="8工程とコストの全体像">
    <div className={styles.header}>
      <div><h3>工程とコストの全体像</h3><p>{scenario} ／ 単位：円/{unit}</p></div>
      <div className={styles.total}><span>登録済み原価の合計</span><strong>{amount(summary.total)}<small>円/{unit}</small></strong><span>SOL {amount(summary.sx)} ＋ 顧客 {amount(summary.customer)}</span></div>
      <button type="button" className={styles.motionButton} onClick={() => setPlaying((p) => !p)} aria-pressed={!playing}>{playing ? "動きを止める" : "動きを再開"}</button>
    </div>
    <p className={styles.legend}><i className={styles.capexDot} />CAPEX＝設備の償却 <i className={styles.opexDot} />OPEX＝運転費 <span>各工程で増える原価を表示。工程を押すと初期投資額と明細が開く。</span></p>
    {summary.invalidVolume && <p className={styles.gaps}>年間処理量が0のため、単位あたりの原価を計算できない。表示の0は実際の0円を意味しない。</p>}
    <div className={styles.flowCanvas}>
    <CostProcessAnimation cartridge={selection.method === "循環"} metal={selection.application === "metal"} offsite={selection.location === "offsite"} />
    <ol className={styles.grid}>
      {summary.steps.map((step, i) => <li key={step.key} className={styles.step} style={{ gridArea: `s${i + 1}` }} data-testid={`cost-process-${step.key}`} data-step-number={i + 1}>
        <button type="button" className={styles.stepButton} aria-expanded={opened === step.key} aria-controls={opened === step.key ? `${id}-detail` : undefined} onClick={(e) => { opener.current = e.currentTarget; setOpened(opened === step.key ? null : step.key); }}>
          <span className={styles.stepHeading}><span className={styles.number}>{i + 1}</span><span>{step.title}</span></span>
          <span className={styles.costs}><span><i className={styles.capexDot} />CAPEX <b data-process-capex={step.capex}>+{amount(step.capex)}</b></span><span><i className={styles.opexDot} />OPEX <b data-process-opex={step.opex}>+{amount(step.opex)}</b></span></span>
          <span className={styles.bar} aria-hidden="true"><span className={styles.capexBar} style={{ width: `${step.capex / max * 100}%` }} /><span className={styles.opexBar} style={{ width: `${step.opex / max * 100}%` }} /></span>
          <span className={styles.cumulative}>ここまでの累計 <b data-process-cumulative={step.cumulative}>{amount(step.cumulative)}</b></span>
          <span className={styles.status}>{step.rows.some((r) => r.unknown) ? "工数未確認あり" : step.gaps.length ? step.gaps[0] : "内訳を見る"}<span aria-hidden="true">{opened === step.key ? "−" : "＋"}</span></span>
        </button>
      </li>)}
    </ol>
    </div>
    {selected && <div id={`${id}-detail`} className={styles.detail} data-testid="cost-process-detail" role="region" aria-labelledby={`${id}-detail-heading`}>
      <div className={styles.detailHeading}><h4 ref={detailHeading} id={`${id}-detail-heading`} tabIndex={-1}>{summary.steps.indexOf(selected) + 1} {selected.title}の内訳</h4><button type="button" onClick={closeDetail} className={styles.motionButton}>閉じる</button></div>
      <p className={styles.detailDescription}>{selected.description}。SOL {amount(selected.sx)} ／ 顧客 {amount(selected.customer)} 円/{unit}</p>
      {selected.gaps.length > 0 && <p className={styles.gaps}>{selected.gaps.join("。")}{selected.gaps.some((g) => /未計上|未確定/.test(g)) ? "。未計上・未確認の費用は実際の0円を意味しない。" : "。"}</p>}
      <div className={styles.tableWrap}><table><thead><tr><th>費用・作業</th><th>負担</th><th>区分</th><th>初期投資（償却前）</th><th>円/{unit}</th></tr></thead><tbody>
        {selected.rows.filter((r) => r.perUnit !== 0 || r.initial !== 0 || r.unknown || r.note).map((row) => <tr key={row.id}>
          <td>{row.label}{row.note && <small>{row.note}</small>}{row.unknown && <small>工数未確認・人件費未反映</small>}</td><td>{row.payer === "sx" ? "SOL" : "顧客"}</td><td>{row.type}</td>
          <td>{row.type === "CAPEX" ? <>{yen(row.initial)}<small>{row.initialScope === "production" ? "製造拠点全体" : row.initialScope === "recovery" ? "回収能力で比例換算" : "1処理拠点"}</small></> : "—"}</td><td>{amount(row.perUnit)}</td>
        </tr>)}
      </tbody></table></div>
      {selected.rows.every((r) => r.perUnit === 0 && r.initial === 0 && !r.unknown && !r.note) && <p className={styles.gaps}>この工程単独の費用は登録されていない。</p>}
    </div>}
    <p className={styles.footer}>累計はSOLと顧客の登録済み原価の合計（売価・利益を含まない）。往復移動は④、搬入・搬出の合算作業は⑤に一度だけ計上。設備の形・配置・動きは模式図。</p>
    {summary.overridden && <p className={styles.gaps}>菌体の原価を上書き中：①〜③は①へ合算。製造のCAPEX/OPEX内訳は上書き値から分けられない。</p>}
  </section>;
}
