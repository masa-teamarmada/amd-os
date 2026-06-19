# AMD Score 詳細仕様

AMD Score は、PJ / SU の価値・成熟度を数値化する指標。現行画面の主表示は **PRS Primary** (`P x R x S`)。M / X / F と 7 軸 Cobb-Douglas は **legacy AMD comparison** として残し、PRS の根拠・履歴比較・旧モデル確認に使う。

> 実装者向けの確定仕様は [/spec/4-2-amd-score-current-spec](/spec/4-2-amd-score-current-spec)。理論導出は `/bzm`、日常画面での読み方はこの章に置く。

## 先にここだけ読む

AMD Score は PJ / SU の価値評価。AMD 全社の健康度を見る AMD Management Score とは別物。

PRS は、PJ が立ち上がるための3つの必要条件を掛け合わせるモデル。

| 要素 | 意味 | 何を見るか | 主なデータ |
|---|---|---|---|
| `P` | Potential | 当たった時の市場・事業・社会インパクトの天井 | `amd_score_inputs.prs_potential` |
| `R` | Reach / Readiness | その天井へ届くための会社側 readiness | TRL / BRL / GRL / SRL / HRL |
| `S` | Survival | 届くまで走り切るための生存力 | `sigma_SU` / FRL / `prs_r_net` |

足し算ではなく掛け算にするのは、3つが「どれか1つ高ければOK」ではないから。Potential が大きくても Reach が低ければ届かない。Reach が高くても Survival が低ければ途中で止まる。Survival が高くても Potential が小さければ、AMD Score は大きくならない。積にすると、弱い要素が自然に全体を抑え、3つが同時に揃った時だけ score が伸びる。

`P` / `R_net` が未入力なら、PRS は `INPUT NEEDED` / review pending として止める。legacy AMD score を代わりに主表示へ戻さない。

この章を読む時は、数式を全部暗記しなくていい。大事なのは、AMD Score が「このPJは大きくなりそうか」を1つの数字に潰しているだけではなく、次の3つの質問に分解して見ていること。

1. **P: そもそも大きい勝ち筋か**
   小さな市場で堅実に儲かる話なのか、世界を取りにいける話なのかを見る。
2. **R: そこまで届く準備があるか**
   技術、事業、制度、社会受容、人材がどこまで揃っているかを見る。
3. **S: 途中で死なずに走れるか**
   世の中の追い風、創業者・経営チーム、資金や収益性の持久力を見る。

つまり、AMD Score は「夢の大きさ」「実現する準備」「生き残る力」を同時に見るスコア。どれか1つだけ高くても、全体は伸びにくい。

## Primary Formula

$$
\mathrm{Score}_{\mathrm{PRS}}
= K_{\mathrm{PRS}} \cdot P \cdot R \cdot S
$$

$$
P = (P_{\mathrm{input}}+1)^{\alpha_P}
$$

$$
R =
\prod_{x \in \{\mathrm{TRL},\mathrm{BRL},\mathrm{GRL},\mathrm{SRL},\mathrm{HRL}\}}
(x+1)^{\alpha_x}
$$

$$
S =
(\sigma_{\mathrm{SU}}+1)^{\alpha_\sigma}
\cdot(\mathrm{FRL}_{\mathrm{final}}+1)^{\alpha_F}
\cdot(R_{\mathrm{net}}+1)^{\alpha_{R_{\mathrm{net}}}}
$$

$$
K_{\mathrm{PRS}}
= \frac{100{,}000}{10^{\sum_{x \in \mathcal{A}_{\mathrm{PRS}}}\alpha_x}}
$$

$$
\mathcal{A}_{\mathrm{PRS}}
= \{P,\mathrm{TRL},\mathrm{BRL},\mathrm{GRL},\mathrm{SRL},\mathrm{HRL},
\sigma_{\mathrm{SU}},\mathrm{FRL},R_{\mathrm{net}}\}
$$

全active axis が 9 点の時に `100,000` になるように `K_PRS` で校正する。`K_PRS` は価値入力ではなく、スコアの物差しをそろえる倍率。Shallow Tech mode では `TRL=null` として `R` から TRL を外し、`K_PRS` も active axes だけで再校正する。

### 式を日本語にすると

`Score_PRS = K_PRS * P * R * S` は、ざっくり言うと次の意味。

```text
AMD Score
= 点数の単位を揃える係数
  x 当たった時の大きさ
  x そこへ届く準備
  x 届くまで生き残る力
```

`+1` が入っているのは、0点の軸があっても計算全体が完全に0になりすぎないようにするため。0点は「まったく効かない」ではなく、「最低状態からのスタート」として扱う。`alpha` は、その軸をどれくらい重く見るかを決めるつまみ。たとえば `FRL` の alpha が大きいのは、deeptech startup では創業者・経営チームの質がかなり効く、という考え方を反映している。

`K_PRS` は偏差値の換算表みたいなもの。PJの実力そのものではなく、全軸9点の理想状態が `100,000` になるように表示スケールを合わせている。

### 0-9点の感覚

各入力はだいたい 0-9 点で見る。

| 点数帯 | 感覚 | 読み方 |
|---:|---|---|
| 0-2 | まだ材料が薄い | アイデア・仮説・初期調査段階 |
| 3-5 | 形が見えてきた | 一部の根拠や初期実績はあるが、まだ不確実 |
| 6-7 | かなり揃ってきた | 実証・顧客・チーム・制度などが現実に動いている |
| 8-9 | 強い根拠がある | 事業として勝ち筋を説明しやすい |

これは機械的な採点だけではなく、根拠 notes と一緒に読む。点数が高くても根拠が薄ければ review pending、点数が低くても根拠が明確なら「今どこを直せば伸びるか」が分かる。

## パラメータ一覧

| 記号 / 列 | 範囲 | 意味 | 算出・入力方法 | ベースデータ |
|---|---:|---|---|---|
| `P_input` / `prs_potential` | 0-9 / null | 事業ポテンシャル。成功時の規模・市場・社会インパクトの天井 | 詳細画面でレビュー保存。未入力は null | 事業仮説、Venture narrative、PL hearing、Atlas/市場根拠、まさ判断 |
| `TRL` | 0-9 / null | Technology Readiness。技術成熟度 | XRL checklist または `amd_score_inputs.trl` | 内閣府 SIP 原典準拠チェックリスト、技術進捗、PoC、特許、論文 |
| `BRL` | 0-9 | Business Readiness。事業化成熟度 | XRL checklist または `amd_score_inputs.brl` | 顧客ヒアリング、LOI、売上、商談、事業設計 |
| `GRL` | 0-9 | Governance / Government Readiness。制度・規制成熟度 | XRL checklist または `amd_score_inputs.grl` | 規制、許認可、制度、政策、補助金 |
| `SRL` | 0-9 | Social Readiness。社会受容・市場受容 | XRL checklist または `amd_score_inputs.srl` | 社会受容、ステークホルダー反応、導入抵抗、倫理・安全性 |
| `HRL` | 0-9 | Human Readiness。組織・人材 readiness | XRL checklist / 関連メンバー評価 | `project_founding_members`, `project_venture_members`, メンバー構成 |
| `mu_A` | 0-9 | Academic momentum。学術側の追い風 | 観測モデルまたは人間レビュー | `papers_log`, scholar ingest, OpenAlex, 研究活動 |
| `mu_I` | 0-9 | Industry momentum。産業側の追い風 | 観測モデルまたは人間レビュー | `atlas_signals`, VC/企業投資、業界実装、競争環境 |
| `mu_G` | 0-9 | Government momentum。政策・制度側の追い風 | 観測モデルまたは人間レビュー | 政策、規制、補助金、公募、政府文書 |
| `sigma_SU` | 0-9 | Triple Helix 合成値。学・産・官の追い風 | `mu_A` / `mu_I` / `mu_G` から算出 | 上記3系列 |
| `FRL_final` | 0-9 | Founder Readiness。創業者・経営中核の readiness | `resolveFrl()`。`frl_cap` があれば CES、なければ `frl` | ALQ 4因子、Grit、Resilience、経営実行力、AMD寄与 |
| `R_net` / `prs_r_net` | 0-9 / null | 純残存力。粗利・運営コスト・本命PJへの資源毀損を見た生存力 | 詳細画面でレビュー保存。未入力は null | 収益化見込み、運営コスト、リソース毀損、事業優先度 |
| `alpha_x` | 正数 | 各軸の重み / 弾力性 | `PRS_ALPHA_DEFAULT` または `amd_score_alpha` | retrofit / review |

## PRS Input Resolution

`P` と `R_net` は、表示時に次の順で解決する。

1. 画面入力中の draft
2. 対象 `amd_score_inputs` row の `prs_potential` / `prs_r_net`
3. 同一PJで `evaluated_at <= target.evaluated_at` の過去 row に保存済みの値
4. 同一PJの最新 project-level row に保存済みの値
5. null

null は 0 ではない。null の場合は `missingAxes` に入り、PRS score は `null` のまま。これで「情報がないのに低い点を付ける」「legacy score を勝手に primary に戻す」事故を防ぐ。

## R の算出

R は、会社側の到達 readiness。

ここでいう **readiness** は「準備ができている度合い」。もっとくだいて言うと、アイデアや研究成果が「本当に会社として前に進められる状態に近いか」を見る。

たとえば、すごい技術があっても、それだけでは会社は立ち上がらない。顧客がいるか、売り方が見えているか、規制で止まらないか、社会に受け入れられるか、動かす人がいるかも必要。R は、この「実現に向かう準備」をまとめて見る部分。

R は `TRL / BRL / GRL / SRL / HRL` の5つを使う。

| 軸 | 見ている準備 | たとえば |
|---|---|---|
| `TRL` | 技術の準備 | 原理だけか、試作品が動くか、量産や実装に近いか |
| `BRL` | 事業の準備 | 顧客、価格、売り方、売上の作り方が見えているか |
| `GRL` | 制度・規制の準備 | 許認可、規制、政策、補助金の道筋があるか |
| `SRL` | 社会受容の準備 | 現場・社会・利用者が受け入れそうか |
| `HRL` | 人材・組織の準備 | CEO、技術者、事業側、支援メンバーが揃っているか |

つまり R は「届く力」。P が「どれくらい大きい山か」だとすると、R は「その山を登る装備がどれくらい揃っているか」。

$$
C_x=(x+1)^{\alpha_x}
$$

$$
R=C_{\mathrm{TRL}}\cdot C_{\mathrm{BRL}}\cdot C_{\mathrm{GRL}}\cdot
C_{\mathrm{SRL}}\cdot C_{\mathrm{HRL}}
$$

式では、5つの準備を掛け合わせる。どれか1つだけ高くても、他が低ければ R は伸びにくい。これは「技術だけ強い」「人だけいる」「政策だけ追い風」では、会社として目的地に届かないから。

`C_x` は各軸の点数を、重み `alpha_x` つきの貢献値に変換したもの。たとえば `TRL` は技術の点数、`C_TRL` は「技術がR全体にどれくらい効いているか」を表す。

### XRL checklist の考え方

XRL の各軸は、原則として XRL 観測チェックリストから作る。チェックリストは、Lv.1, Lv.2, Lv.3 ... という階段になっている。

「全項目チェック済みが続く最大レベル」というのは、下から順番に見て、途中で穴が空く手前までを達成レベルにするという意味。

例:

| レベル | チェック状態 | 判定 |
|---:|---|---|
| Lv.1 | 全部チェック済み | OK |
| Lv.2 | 全部チェック済み | OK |
| Lv.3 | 1項目だけ未チェック | ここで止まる |
| Lv.4 | 全部チェック済み | Lv.3 が未達なので数えない |

この場合、達成レベルは `2`。Lv.4 が良くても、Lv.3 に穴があるなら「土台が飛んでいる」とみなす。階段を1段ずつ登るモデルだから、途中の段を飛ばして高レベル扱いにはしない。

$$
\mathrm{level}_a =
\max\left\{l \mid
\forall j \le l,\ \forall k \in \mathrm{checklist}_{a,j},\
\mathrm{checked}_{a,j,k}=\mathrm{true}
\right\}
$$

この式は、上の表を数学っぽく書いただけ。`a` は軸、`l` は候補レベル、`j <= l` は「Lv.1 からそのレベルまで全部見る」、`checked=true` は「必要なチェック項目が全部埋まっている」という意味。

保存すると `amd_score_inputs.xrl_checklist` JSONB と同時に `trl` / `brl` / `grl` / `srl` / `hrl` の生値も更新される。定義の正本は [`src/lib/xrl-level-definitions.ts`](../src/lib/xrl-level-definitions.ts)。原典は内閣府 SIP「サーキュラーエコノミーシステムの構築」2023 公募要領。

R は「すごいアイデアが、現実に届く形になっているか」を見る。5つの軸は、次のように読む。

| 軸 | 高い時 | 低い時 |
|---|---|---|
| `TRL` | 技術が実証され、実装や量産に近い | 原理は面白いが、まだ動くか分からない |
| `BRL` | 顧客、価格、売り方、事業モデルが見えている | 誰が買うか、どう売るかが曖昧 |
| `GRL` | 規制・許認可・制度の道筋が見えている | 法規制や制度面で止まる可能性がある |
| `SRL` | 社会や現場が受け入れる理由がある | 便利でも、反発・倫理・安全面で詰まりそう |
| `HRL` | 必要な人材・チーム・役割が揃っている | 技術や事業を進める人が足りない |

R は5軸の積なので、「TRLだけ高い」PJはまだ伸びきらない。たとえば大学の技術が強くても、顧客が未確認で、規制も読めず、CEO候補もいないなら、R は低く出る。逆に技術がまだ途中でも、顧客・制度・人材が強く揃っているなら、どこを伸ばせばよいかが見える。

## S の算出

S は、到達するまで走り切るための生存力。

ここでいう生存力は、「会社が倒れない根性」だけではない。deeptech startup が育つまでには時間がかかるので、外部環境の追い風、創業者・経営チームの強さ、資金や収益の持久力が必要になる。S はその3つを見る。

| 要素 | 日本語でいうと | 見ていること |
|---|---|---|
| `sigma_SU` | 世の中の追い風 | 学術・産業・政府が同時に動いているか |
| `FRL_final` | 経営中核の強さ | 困難な時に資金・人・意思決定を動かせるか |
| `R_net` | 資源の持久力 | 粗利や資金繰りがあり、他PJを壊さず走れるか |

つまり S は「生き残れる会社か」を、外の風・中の人・お金/資源の3方向から見る。

### Triple Helix と sigma_SU

Triple Helix は、直訳すると「三重らせん」。ここでは、スタートアップを取り巻く外部環境を **学術・産業・政府** の3つで見る考え方として使う。

| 記号 | 領域 | 見ているもの |
|---|---|---|
| `mu_A` | Academic / 学術 | 論文、研究予算、研究者コミュニティ、大学・研究機関の動き |
| `mu_I` | Industry / 産業 | 企業投資、VC投資、実装事例、競合、業界の採用 |
| `mu_G` | Government / 政府 | 政策、規制緩和、補助金、公募、政府文書 |

産官学の合成とは、この3つを1つの「外部追い風スコア」にまとめること。たとえば、論文だけ多くても企業が動いていなければ、事業化の追い風としてはまだ弱い。逆に、研究も企業も政策も同時に動いている領域は、SU が育つ土壌が強い。

$$
\sigma_{\mathrm{SU}}
= \sqrt[3]{(\mu_A+1)(\mu_I+1)(\mu_G+1)} - 1
$$

この式は、3つの値の **幾何平均** を取っている。普通の平均は足して3で割る。

$$
\mathrm{ordinary\ average}
= \frac{\mu_A+\mu_I+\mu_G}{3}
$$

幾何平均は、掛け合わせてから三乗根を取る。

$$
\mathrm{geometric\ average}
= \sqrt[3]{(\mu_A+1)(\mu_I+1)(\mu_G+1)}-1
$$

三乗根にしている理由は、掛け合わせたものを元の 0-9 点くらいのスケールに戻すため。2つなら平方根、3つなら三乗根。ここでは `mu_A` / `mu_I` / `mu_G` の3つを合成しているので三乗根になる。

`+1` と `-1` は、0点が混ざっても計算が完全に0で潰れすぎないようにするための調整。0点は「存在しない」ではなく「最低状態」として扱う。

幾何平均を使う理由は、3つのバランスを見るため。普通の平均だと、1つだけ高い値が全体を引っ張り上げやすい。幾何平均だと、低い要素があると全体も抑えられる。

例:

| `mu_A` | `mu_I` | `mu_G` | 普通の平均 | 読み方 |
|---:|---:|---:|---:|---|
| 9 | 0 | 0 | 3.0 | 研究だけ強いが、産業・政府はまだ弱い |
| 5 | 5 | 5 | 5.0 | 3方向がバランスよく動いている |

普通の平均だけなら前者もそこそこ良く見える。でも AMD Score では、外部追い風は3方向が揃うほど強いと考えるので、幾何平均で「偏り」を抑える。

$$
S =
(\sigma_{\mathrm{SU}}+1)^{\alpha_\sigma}
\cdot(\mathrm{FRL}_{\mathrm{final}}+1)^{\alpha_F}
\cdot(R_{\mathrm{net}}+1)^{\alpha_{R_{\mathrm{net}}}}
$$

`S` の式では、外部追い風 `sigma_SU`、経営中核 `FRL_final`、資源の持久力 `R_net` を掛け合わせる。どれか1つだけで生存できるとは見ない。政策が追い風でも経営チームが弱ければ進まないし、CEOが強くても外部環境が無風で資金も続かなければきつい。

S は「目的地まで走り切れるか」を見る。P が夢の大きさ、R が準備だとすると、S は体力と追い風。

| 要素 | 見ているもの | 高い時のイメージ |
|---|---|---|
| `sigma_SU` | 学術・産業・政府の追い風 | 研究も盛り上がり、企業も動き、政策も後押ししている |
| `FRL_final` | 創業者・経営中核の強さ | 困難な局面でも資金・人・意思決定を動かせる |
| `R_net` | 純残存力 | 粗利や資金繰りがあり、他の本命PJを壊さず走れる |

ここで大事なのは、S は「気合い」ではないこと。どれだけ良い技術でも、市場が動かず、創業者が弱く、資金を食い潰すだけなら、途中で止まる。逆に、まだ未完成でも、追い風・人・資金の見通しがあると、生き残って改善し続ける可能性が上がる。

### Triple Helix 観測モデル

観測モデルが使える場合、観測値 `y_p` を過去16 quarterで 0-9 に正規化し、loading `c_{xp}` で `mu_A` / `mu_I` / `mu_G` に集約する。

$$
\tilde{y}_p
= 9 \cdot \frac{y_p-\min_t y_p}{\max_t y_p-\min_t y_p}
$$

$$
\mu_x
= \frac{\sum_p c_{xp}\tilde{y}_p}{\sum_p c_{xp}},
\qquad x \in \{A,I,G\}
$$

UI の `c`, `ỹ`, `c·ỹ`, `coverage` はこの途中経過。観測値が欠けている時は推測で埋めず、coverage note に残す。

この観測モデルは、Triple Helix の3つの値を人間が毎回手で入力する代わりに、論文数、投資件数、政策文書などの観測データから作るためのもの。`y_p` は観測値、`tilde{y}_p` はそれを 0-9 点に直した値、`c_{xp}` は「この観測値が学術・産業・政府のどれにどれくらい効くか」を表す重み。

### FRL final

FRL は、創業者・経営中核の readiness。`frl_cap` が無い行では `frl` をそのまま final FRL とする。`frl_cap` がある行では CES で `F_char` と `F_cap` を合成する。

$$
\overline{\mathrm{ALQ}_4}
= \mathrm{avg}(
\mathrm{SelfAwareness},
\mathrm{RelationalTransparency},
\mathrm{BalancedProcessing},
\mathrm{InternalizedMoral}
)
$$

$$
F_{\mathrm{char}}
=
\frac{
0.6\cdot\overline{\mathrm{ALQ}_4}
+0.2\cdot\mathrm{Grit}
+0.2\cdot\mathrm{Resilience}
}{\sum \mathrm{available\ weights}}
$$

$$
\mathrm{FRL}_{\mathrm{final}}
=
\left(
a(F_{\mathrm{char}}+1)^\rho
+(1-a)(F_{\mathrm{cap}}+1)^\rho
\right)^{1/\rho}-1
$$

既定値は `a=0.6`, `rho=-2`。`rho<0` にすることで、資質と実行力のどちらかが低い時に FRL が大きく下がる補完性を表す。S 全体は Cobb-Douglas 的に代替余地があるが、FRL 内部だけは CES で「両方必要」を表現する。

FRL は「この人・この経営中核で、難しい会社を本当に前に進められるか」を見る。性格診断ではなく、deeptech startup の難所を越える力を見る。

`F_char` は、CEO本人に近い資質。自己認識、透明性、バランスよく情報を見る力、内側の倫理、やり抜く力、回復力を見る。
`F_cap` は、チームとしての経営実行力。IPO/Exit、資金調達、PL責任、事業運営、同業界経験のように、実際に会社を動かした経験を重く見る。

FRL内部だけ CES にしているのは、「人柄は良いが経営実行力がない」「経営経験はあるが創業者として危うい」のどちらも危ないから。片方だけ高くても、もう片方が低いと final FRL は伸びにくい。

## Alpha Weights

現行の PRS default は `pwa/src/lib/amd-score.ts` の `PRS_ALPHA_DEFAULT`。

| 軸 | alpha | 読み方 |
|---|---:|---|
| `P` | 1.0 | Potential を標準重みで見る |
| `TRL` | 1.0 | 技術中核 |
| `BRL` | 0.6 | 事業検証 |
| `GRL` | 0.3 | 規制・制度 |
| `SRL` | 0.2 | 社会受容 |
| `HRL` | 1.1 | Deeptech では人材・組織が律速になりやすい |
| `sigma_SU` | 1.3 | Macrotrend に乗っているかを重視 |
| `FRL` | 1.5 | founder quality を最重視 |
| `R_net` | 0.8 | 純残存力を Survival に効かせる |

`amd_score_alpha` は legacy alpha の version 管理に使う。PRS weight の恒久変更をする時は、manual / spec / design と UI 表示を同じ作業単位で同期する。

alpha は「その軸が1点上がった時、全体にどれくらい効くか」を決める重み。点数そのものだけでなく、重みも見る。

たとえば `SRL=2` と `FRL=2` が並んでいた場合、どちらも低い点数ではある。でも `FRL` の alpha は `1.5`、`SRL` は `0.2` なので、同じ1点改善でも FRL の方が AMD Score に効きやすい。これは「社会受容を軽視する」という意味ではなく、現行の base case では、deeptech venture の成立に founder quality がより強く効くという仮定を置いているという意味。

alpha は固定の真理ではない。retrofit や実際の成果とのズレを見ながら更新される。ただし、日常運用では alpha をいじるより、まず各軸の根拠と点数が妥当かを見る。

## 律速軸

律速軸は「1 段階上げた時に score が一番増える軸」。

$$
\frac{\partial \mathrm{Score}}{\partial Z_i}
= \frac{\alpha_i \cdot \mathrm{Score}}{Z_i+1}
$$

$$
\mathrm{bottleneck}
= \arg\max_i \frac{\alpha_i}{Z_i+1}
$$

単に値が低い軸ではない。alpha が大きく、現在値が低い軸が最も効く。現行画面では legacy comparison の bottleneck も併記するが、主表示の判断は PRS primary を先に読む。

律速軸は「一番悪い軸」ではなく、「次に直すと一番スコアが伸びる軸」。たとえば `SRL=1` でも alpha が小さければ、短期の最優先にはならないことがある。逆に `FRL=4` で一見そこまで低くなくても、alpha が大きいので、創業者・経営中核の補強が一番効くことがある。

画面で律速が出たら、次の順で読む。

1. その軸の点数が本当に妥当か
2. 根拠 notes があるか
3. 1点上げるために何をすればいいか
4. それが短期で直せるものか、長期課題か

## 画面に出ているもの

| 表示 | 位置づけ | 算出 / 取得元 |
|---|---|---|
| `PRS Primary` | 現行 primary | `calculatePrsScore()`。`P` / `R_net` が揃った時だけ score を出す |
| `INPUT NEEDED` | review pending | `missingAxes`。`P` / `R_net` のどちらかが null |
| `P Potential` | primary input | `amd_score_inputs.prs_potential` |
| `R_net` | primary input | `amd_score_inputs.prs_r_net` |
| `R reach` | PRS component | TRL / BRL / GRL / SRL / HRL の contribution product |
| `S survival` | PRS component | `sigma_SU` / final FRL / `R_net` の contribution product |
| `PRS history` | primary history | `computePrsScoreSeries()`。`status='ready'` の行だけ採用 |
| `Legacy AMD comparison` | legacy comparison | 旧 7 軸 Cobb-Douglas。PRS missing の代替 primary ではない |
| `M / X / F バランス` | legacy evidence | `M=sigma_SU`, `X=5 XRL`, `F=FRL` |
| `Triple Helix Matrix` | `sigma_SU` evidence | `mu_A` / `mu_I` / `mu_G`、C行列、観測値、被覆率 |
| `FRL panel` | founder evidence | ALQ 4因子 / Grit / Resilience / F_cap / notes |
| `XRL checklist` | XRL evidence / writer | チェックリストから達成レベルを算出し、`trl..hrl` へ反映 |

画面を見る時は、いきなり総合点だけを見ない。次の順番で見る。

1. `PRS Primary` が出ているか、`INPUT NEEDED` かを見る
2. `INPUT NEEDED` なら、足りないのが `P` か `R_net` かを見る
3. score が出ているなら、`P / R / S` のどれが弱いかを見る
4. 弱い component の内訳を見る
5. 最後に legacy M-X-F を comparison / evidence として読む

たとえば、総合点が低くても `P` が高いなら「大きい勝ち筋はあるが、準備か生存力が足りない」と読める。`R` が低ければ XRL checklist を見る。`S` が低ければ Triple Helix、FRL、R_net を見る。`P` 自体が低ければ、そもそもの市場・事業仮説を見直す。

### 簡単な読み方の例

| 状態 | 読み方 | 次に見るもの |
|---|---|---|
| `P` 高い / `R` 低い / `S` 中くらい | 大きい夢はあるが、まだ実現準備が足りない | XRL checklist、特に TRL / BRL / HRL |
| `P` 高い / `R` 高い / `S` 低い | 準備はあるが、走り切る体力が不安 | FRL、R_net、Triple Helix coverage |
| `P` 低い / `R` 高い / `S` 高い | 実行力はあるが、勝った時の天井が小さい | 市場規模、事業仮説、Atlas / PL hearing |
| `P` missing | そもそもどれくらい大きい勝ち筋か未レビュー | `prs_potential` を入力・レビュー |
| `R_net` missing | 生存力のうち資金・収益・資源毀損が未レビュー | `prs_r_net` を入力・レビュー |

## データソース

| データ | 主な source | 保存先 / 参照先 |
|---|---|---|
| `P` | 事業仮説、Venture narrative、PL hearing、まさレビュー | `amd_score_inputs.prs_potential` |
| `R_net` | 収益化見込み、粗利、運営コスト、リソース毀損 | `amd_score_inputs.prs_r_net` |
| `mu_A` | 論文、研究活動、OpenAlex | `papers_log`, scholar ingest, `amd_score_inputs.mu_A` |
| `mu_I` / `mu_G` | 政策、投資、ニュース、業界実装 | `atlas_signals`, `macro_index_log`, `amd_score_inputs.mu_I/mu_G` |
| `TRL/BRL/GRL/SRL/HRL` | XRL checklist、XRL evidence、進捗ログ | `project_xrl_log`, `project_xrl_evidence`, `amd_score_inputs.xrl_checklist` |
| `FRL` | ALQ / Grit / Resilience / 経営実行力 | `amd_score_inputs.frl_*`, `project_founding_members` |
| annotation | score 変化の根拠イベント | `project_events`, 経営ハイライト |

`amd_score_inputs` には未来予測 row も入るため、現在値を出す時は **`evaluated_at <= today` の最新行**を使う。経時グラフは未来予測も表示してよい。

## 根拠 notes の優先順

| 軸 | 優先順 |
|---|---|
| XRL 5 軸 | `amd_score_inputs.xrl_notes` -> `project_xrl_log.source_note` -> 仮置き |
| `mu_A` | `amd_score_inputs.mu_notes.a` -> `scholar` / `papers_log` -> 仮置き |
| `mu_I` / `mu_G` | `amd_score_inputs.mu_notes.i/g` -> `atlas_signals` -> 仮置き |
| FRL | `amd_score_inputs.frl_notes` / `frl_cap_notes` -> 仮置き |
| P / R_net | detail input notes / review rationale -> 仮置き |

値だけでなく、なぜその値なのかを残すことが重要。根拠が無い値は「高い/低い」ではなく「review pending」として扱う。

## 更新フロー

```text
XRL / Macrotrend / FRL / P / R_net の根拠が増える
        ↓
amd_score_inputs に評価 row または PRS input を保存
        ↓
cockpit / venture-map が today 以前の最新 row を読む
        ↓
PRS Primary / PRS history / legacy M-X-F / evidence を表示
        ↓
まさが違和感を持ったら詳細画面・Tsukuyomi・修正依頼 loop で直す
```

## Legacy AMD / M-X-F Appendix

legacy MXF (= M-X-F / 7 軸 Cobb-Douglas) は過去モデル。削除しないが、現行 primary として読まない。

M-X-F は、昔のAMD Scoreを読むための地図として残す。いまの主表示は PRS だけど、M-X-F は無駄ではない。`M` は PRS の `S` に入る `sigma_SU` の根拠、`X` は PRS の `R` の根拠、`F` は PRS の `S` に入る FRL の根拠として使う。

つまり、M-X-F は「古い点数をそのまま主役に戻すもの」ではなく、「PRSがなぜその値になったかを説明する証拠棚」。古い資料や過去のscore historyを見る時も、M-X-Fが残っていると当時の判断を読み解ける。

$$
\mathrm{Score}_{\mathrm{legacy}}
= K_{\mathrm{legacy}}
\cdot
\prod_{i \in \mathcal{A}_{\mathrm{legacy}}}(X_i+1)^{\alpha_i}
$$

$$
\mathcal{A}_{\mathrm{legacy}}
= \{\sigma_{\mathrm{SU}},\mathrm{TRL},\mathrm{BRL},\mathrm{GRL},\mathrm{SRL},\mathrm{HRL},\mathrm{FRL}\}
$$

$$
\mathrm{Score}_{\mathrm{legacy}}
= K_{\mathrm{legacy}}\cdot M\cdot X\cdot F
$$

$$
M=(\sigma_{\mathrm{SU}}+1)^{\alpha_\sigma}
$$

$$
X=\prod_{x \in \{\mathrm{TRL},\mathrm{BRL},\mathrm{GRL},\mathrm{SRL},\mathrm{HRL}\}}(x+1)^{\alpha_x}
$$

$$
F=(\mathrm{FRL}_{\mathrm{final}}+1)^{\alpha_F}
$$

| legacy 要素 | 意味 | 現行 PRS での読み方 |
|---|---|---|
| `M` | Macrotrend / Triple Helix | `S` の `sigma_SU` evidence |
| `X` | 5 XRL readiness | `R` の evidence |
| `F` | Founder readiness | `S` の FRL evidence |

保存目的:

- 過去の retrofit / score history を読み解く
- PRS の R/S の根拠として XRL / sigma_SU / FRL を残す
- 旧画面・旧説明との比較対象にする

禁止:

- legacy score を PRS missing の代替 primary にする
- M-X-F を章 summary や cockpit 主表示の主語へ戻す
- 既存 7 軸履歴を破壊的に再計算する

たとえば `PRS Primary` が `INPUT NEEDED` の時に、legacy score が高いからといって「このPJは高スコア」と表示しない。必要なのは legacy を主役に戻すことではなく、足りない `P` / `R_net` をレビューして PRS を完成させること。

## 関連

- [`pwa/spec/4-2-amd-score-current-spec.md`](../spec/4-2-amd-score-current-spec.md)
- [`pwa/design/amd_score.md`](../design/amd_score.md)
- [`pwa/design/xrl_evidence.md`](../design/xrl_evidence.md)
- [`pwa/design/score_revision_feedback_loop.md`](../design/score_revision_feedback_loop.md)
- [`pwa/design/macrotrend_atlas_seeds_architecture.md`](../design/macrotrend_atlas_seeds_architecture.md)
