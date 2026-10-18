import type {DdJkissSummary} from '@/lib/dd-report-jkiss';
const oku=(n:number,d=2)=>(n/1e8).toLocaleString('ja-JP',{minimumFractionDigits:d,maximumFractionDigits:d});
const pct=(n:number)=>(n*100).toLocaleString('ja-JP',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
export function DdJkissExplanation({summary:s}:{summary:DdJkissSummary}){
  return <section className="ddr-jkiss-explanation" aria-label="J-KISS転換条件と持株比率">
    <h3>資本政策表で採用している転換条件</h3>
    <p>シード<strong>{oku(s.seed)}億円</strong>をポストキャップ<strong>{oku(s.cap)}億円</strong>・割引率<strong>{pct(s.discount)}</strong>のJ-KISSで調達する。シリーズAはプレ<strong>{oku(s.pre)}億円</strong>・新規調達<strong>{oku(s.funding)}億円</strong>を計画し、新規調達{oku(s.qualifying)}億円以上という計画上の転換基準を満たして転換する。</p>
    <p>現在の採用条件は<strong>{s.rule}</strong>。転換価額<strong>{s.price.toLocaleString('ja-JP')}円／株</strong>、転換株数<strong>{s.shares.toLocaleString('ja-JP')}株</strong>。シード投資家の持株比率は、<strong>Aの新株発行前{pct(s.before)}</strong>、<strong>Aの新株発行後{pct(s.after)}</strong>となる。Aのプレ評価額にはJ-KISSの転換分を含める。</p>
    <h3>Aの評価額による適用条件と持株比率</h3>
    <p>端数処理前の境目は、キャップ{oku(s.cap)}億円÷（1−割引率{pct(s.discount)}）＝<strong>Aプレ{oku(s.theoreticalBoundary)}億円</strong>。これより低い評価額ではディスカウント、高い評価額ではキャップの転換価額が低くなる。境目では両方式の転換価額が一致する。</p>
    <div className="ddr-table-scroll ddr-financial-table" tabIndex={0} aria-label="A評価額別のJ-KISS転換とシード持株比率"><table><thead><tr><th>Aプレ評価額（億円）</th><th>採用条件</th><th>転換価額（円／株）</th><th>シード持分：A新株前</th><th>シード持分：A新株後</th></tr></thead><tbody>{s.cases.map(c=><tr key={c.pre} className={c.pre===s.pre?'ddr-jkiss-current':''}><td>{oku(c.pre)}{c.pre===s.pre?'（現在の計画）':''}</td><td>{c.rule}</td><td className="ddr-number">{c.price.toLocaleString('ja-JP')}</td><td className="ddr-number">{pct(c.before)}</td><td className="ddr-number">{pct(c.after)}</td></tr>)}</tbody></table></div>
    <p className="ddr-chart-note">各ケースはAの新規調達額{oku(s.funding)}億円を共通とする。持分は設立時の新株予約権を含む完全希薄化後の比率。転換価額は1円単位で切り上げ、転換株数は1株未満を切り捨てる。端数処理を含む試算式では、Aプレ{oku(s.discountMaxPre,8)}億円までディスカウント、その金額を超えるとキャップを適用する。</p>
  </section>;
}
