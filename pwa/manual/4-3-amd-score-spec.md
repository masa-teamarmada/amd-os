# AMD Score 詳細仕様

AMD Score は、PJ / SU の9軸を現行の符号化・重み・乗法集約規則で束ねる診断指標。現行画面の主表示は **SPS Primary** (`M x P x R x S`)。M / X / F と 7 軸 Cobb-Douglas は **legacy AMD comparison** として残し、SPS の根拠・履歴比較・旧モデル確認に使う。

> **2026-07-16 まさ確定**: σ_SU (マクロ追い風) を S から分離して独立因子 M へ格上げし、S を自走力 (FRL × R_net) に純化した。総合スコアの数値・重み・履歴は完全に不変で、変わるのは内訳のグルーピングとラベルだけ。
>
> **呼称**: 正式名は **SPS = Seed Prospect Score (シーズ有望度)**。旧称 PRS は 2026-07-11 まさ確定で廃止 ([`pwa/bzm/terminology_glossary.md`](../bzm/terminology_glossary.md) §1.5)。SPS は和名の略であって成分の頭字ではないから、4因子になっても名前は壊れず、MPRS への改称は不要。`prs_potential` などの小文字が画面や表に残るのは DB 列・コードの内部識別子で、表示呼称とは別物。

日常の確認・入力は PJ cockpit の **スコア詳細** に集約する。正規URLは `/project/{projectId}/cockpit?tab=score-detail`。SPS、R_net、FRL、XRL の根拠とチェックリストを同じタブで確認し、旧 `/venture-map/amd-score/{projectId}` は互換URLとして cockpit へ自動転送する。

> 実装者向けの確定仕様は [/spec/4-2-amd-score-current-spec](/spec/4-2-amd-score-current-spec)。理論導出は `/bzm`、日常画面での読み方はこの章に置く。

> **2026-07-29 主張境界**: 現行SPSは診断指数であり、企業価値、期待事業価値、成功確率、生存確率を表す検証済みモデルではない。0〜9点は現時点では順序尺度として扱い、SPSの点数差・点数比・`alpha`に経済的な間隔や弾力性の意味があるとはみなさない。SPS順位と律速表示だけでGO、NO_GO、投資額、投入人月を決めない。改訂要件は [`BZM_2_0_REVISION_REQUIREMENTS.md`](../bzm/BZM_2_0_REVISION_REQUIREMENTS.md) を参照する。

## 先にここだけ読む

AMD Score は PJ / SU の比較と弱点診断に使う指数。AMD 全社の健康度を見る AMD Management Score とは別物。

SPS (M·P·R·S) は、PJを診断する9軸を4つの問いへ整理して表示する現行モデル。4因子は概念上のグループであり、実計算は9軸を一層で乗法集約する。

| 要素 | 意味 | 何を見るか | 主なデータ |
|---|---|---|---|
| `M` | マクロ追い風 (Macrotrend) | いま、この分野に吹いている世の中の風 | `sigma_SU` (`mu_A` / `mu_I` / `mu_G`) |
| `P` | Potential | 当たった時の市場・事業・社会インパクトの天井 | `amd_score_inputs.prs_potential` |
| `R` | Reach / Readiness | その天井へ届くための会社側 readiness | TRL / BRL / GRL / SRL / HRL |
| `S` | 自走力 (Survival = FRL × R_net) | 外の資金が止まっても自分の力で走り続けられる体質 | FRL / `prs_r_net` |

足し算ではなく掛け算にする現在の理由は、弱い軸が総合点を抑える診断規則を採用したため。Potential が大きくても Reach が低ければ届きにくく、Macrotrend が吹いていても自走力が無ければ環境への依存が残る。ただし、この乗法集約が将来成果を最もよく予測することは未検証であり、他の符号化・重み・集約方法に対する感度確認が必要。

`P` / `R_net` が未入力なら、SPS は `INPUT NEEDED` / review pending として止める。legacy AMD score を代わりに主表示へ戻さない。

この章を読む時は、数式を全部暗記しなくていい。大事なのは、AMD Score が「このPJは大きくなりそうか」を1つの数字に潰しているだけではなく、次の4つの質問に分解して見ていること。

1. **M: 追い風は吹いているか**
   学術・産業・政府が同時に動いている分野か、無風の分野かを見る。
2. **P: そもそも大きい勝ち筋か**
   小さな市場で堅実に儲かる話なのか、世界を取りにいける話なのかを見る。
3. **R: そこまで届く準備があるか**
   技術、事業、制度、社会受容、人材がどこまで揃っているかを見る。
4. **S: 外の資金が止まっても自走できるか**
   創業者・経営チームの強さと、資金や収益性の持久力を見る。J カーブが描けなくても、売れるものを作って自分の力で走り続けられるかの診断。

つまり、AMD Score は「追い風」「夢の大きさ」「実現する準備」「自走する力」を同時に見るスコア。どれか1つだけ高くても、全体は伸びにくい。M と S を分けているのは、「環境で延命しているのか、自走できているのか」を別々に診断するため (2026-07-16 まさ確定)。

## BZM 2.0観測画面

スコア詳細の先頭には、現行運用SPSとは別に、BZM 2.0の数式と測定状態を表示する。

BZM 2.0は検証中の到達見込みモデルであり、現行の診断指数を置き換えたものではない。

$$
\mathbf{SPS}=q\mathbf P
$$

$$
q(\mathbf z)
=
\Pr\!\left(
T_C(\mathbf z)<T_Y(\mathbf z),\quad
T_C(\mathbf z)\le H_v
\mid \mathbf Z_\tau=\mathbf z
\right)
$$

トップ式の直下では、`q`、`P`、BZM 2.0の`SPS`を同じ代入列で表示する。`P`はベクトルなので、現行運用SPSの値へ読み替えず、尺度または合成規則が未登録なら最終出力を**未測定**とする。未着手・欠測を0として掛けず、未測定の理由も同じ列に残す。

右の到達競争式の直下では、共通状態、到達時間、余力喪失時間、計画期限、到達見込みを現在の判定値として並べる。これにより、共通状態がどの時計と到達見込みへ条件づけられているかを、式と値を往復せず確認できる。

画面は、式の記号を次の現在値へ結ぶ。

| 記号 | 画面で確認するもの |
|---|---|
| `q` | 現行版の到達見込み、信頼区間、版ごとの変化 |
| `P` | 潜在価値ベクトルの測定状態。未着手または欠測を0にしない |
| `T_C` | 到達時間の分布または時間入力の欠測 |
| `T_Y` | 戦略余力の喪失時間。資金成分だけの部分実装を全体と同一視しない |
| `H_v` | 計画版ごとの期限。資金の崖とは分けて表示する |
| `Z` | 複数工程へ作用する共通状態と、その影響先 |

たとえばLSTの`Z_policy`は、独立した加点係数ではない。

現在の`#2=90%`と`#6=60%`を`Z_policy=present`に条件づけた入力として表示し、影響先を`#2`、`#6`、`T_C`、`T_Y`、`q`へつなぐ。

政策支援がない状態の入力は未取得なので、ロビイングの追加効果は表示しない。

数値が増えたように見せるための0補完もしない。

SXとLST以外で現行SPSを持つPJは、まず`観測収集中`として表示する。

この段階では、AMD OSの構造化DBから確認できたPJ状態、設立状態、AMD支援期間、公的支援、現行XRL、証拠被覆、資金調達履歴を表示する。

これらは入力候補を見えるようにしたもので、まだBZM 2.0の確率や時計へ接続済みとは限らない。

特に、現行SPSの`prs_potential`はBZM 2.0の`P`ではなく、累積調達額は現在現金`C_0`でも`T_Y`でもない。

終了状態を過去の予測入力へ戻して使うと後知恵になるため、現行状態は文脈として残すだけで`q`へ接続しない。

`Z_policy`は公的支援のDB記録から現在状態を確認するが、影響工程が未確定なら矢印を付けない。DBに記録が無いことも、政策支援が存在しない証明にはしない。

パラメータ台帳は、記号、現在値、測定状態と出所、反映先、履歴を同じ表の1行に圧縮して表示する。

数式の記号は画面上でLaTeXとして組み、たとえば$T_C$、$T_Y$、$H_v$、$Z_{\mathrm{policy}}$を下付きが分かる形で表示する。

$q$の版推移は初期状態では折りたたみ、必要なときだけ変更理由と出所を開く。

各パラメータの説明、出所参照、版ごとの値・状態・情報締切も行内の「詳細」から開く。現在値を比べるだけなら、表を縦に読み続けずに済む。

新しい共通状態や工程入力は、DB列を増やさず`parameter_key`の新しい行として追加する。

SXはv0.2からv0.5までの`q`と現行入力を表示する。

LSTは事前登録中として、8ノードと`Z_policy`を表示するが、依存グラフ、時間三点幅、`C_0`が欠測のため`q`を出さない。

そのほかのPJは、事前登録または観測が始まるまで必須記号を欠測のまま表示する。

画面に出る`q`は、定義に従って計算した仮説出力である。

前向き検証件数を併記し、GO、NO_GO、投資額へ単独利用しない。

## Primary Formula

$$
\mathrm{Score}_{\mathrm{SPS}}
= K_{\mathrm{SPS}} \cdot M \cdot P \cdot R \cdot S
$$

$$
M = (\sigma_{\mathrm{SU}}+1)^{\alpha_\sigma}
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
(\mathrm{FRL}_{\mathrm{final}}+1)^{\alpha_F}
\cdot(R_{\mathrm{net}}+1)^{\alpha_{R_{\mathrm{net}}}}
$$

$$
K_{\mathrm{SPS}}
= \frac{100{,}000}{10^{\sum_{x \in \mathcal{A}_{\mathrm{SPS}}}\alpha_x}}
$$

$$
\mathcal{A}_{\mathrm{SPS}}
= \{P,\mathrm{TRL},\mathrm{BRL},\mathrm{GRL},\mathrm{SRL},\mathrm{HRL},
\sigma_{\mathrm{SU}},\mathrm{FRL},R_{\mathrm{net}}\}
$$

全active axis が 9 点の時に `100,000` になるように `K_SPS` で校正する。`K_SPS` は価値入力ではなく、スコアの物差しをそろえる倍率。Shallow Tech mode では `TRL=null` として `R` から TRL を外し、`K_SPS` も active axes だけで再校正する。

### 式を日本語にすると

`Score_SPS = K_SPS * M * P * R * S` は、ざっくり言うと次の意味。

```text
AMD Score
= 点数の単位を揃える係数
  x いま吹いている追い風
  x 当たった時の大きさ
  x そこへ届く準備
  x 自分の力で走り続けられる体質
```

`+1` が入っているのは、0点の軸があっても計算全体が完全に0になりすぎないようにするため。0点は「まったく効かない」ではなく、「最低状態からのスタート」として扱う。`alpha` は、その軸をどれくらい重く見るかを決めるつまみ。たとえば `FRL` の alpha が大きいのは、deeptech startup では創業者・経営チームの質がかなり効く、という考え方を反映している。

`K_SPS` は偏差値の換算表みたいなもの。PJの実力そのものではなく、全軸9点の理想状態が `100,000` になるように表示スケールを合わせている。

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
| `alpha_x` | 正数 | 各軸の現行重み。経済学上の弾力性としては未検証 | `SPS_ALPHA_DEFAULT` または `amd_score_alpha` | retrofit / review |

## SPS Input Resolution

`P` と `R_net` は、表示時に次の順で解決する。

1. 画面入力中の draft
2. 対象 `amd_score_inputs` row の `prs_potential` / `prs_r_net`
3. 同一PJで `evaluated_at <= target.evaluated_at` の過去 row に保存済みの値
4. 同一PJの最新 project-level row に保存済みの値
5. null

null は 0 ではない。null の場合は `missingAxes` に入り、SPS score は `null` のまま。これで「情報がないのに低い点を付ける」「legacy score を勝手に primary に戻す」事故を防ぐ。

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

## M の算出 (マクロ追い風)

M は、いまこの分野に吹いている世の中の追い風 (Macrotrend)。学術・産業・政府が同時に動いているかを見る。

$$
M = (\sigma_{\mathrm{SU}}+1)^{\alpha_\sigma}
$$

M は会社の努力 (案件の属性) ではなく、環境の状態。制御はできないが、「いつ立ち上げるか」「いつ攻めるか」のタイミング判断に直結する。2026-07-16 のまさ確定で S から分離して独立因子になった。これで「追い風で延命しているのか、自走できるのか」を別々に診断できる (スコア数値は分離の前後で不変)。

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

## S の算出 (自走力)

S は、自走力 (Survival = FRL × R_net)。外の資金がどれだけ止まっても、ライスワークでも何でも、自分の力で走り続けられる体質があるかを見る。

$$
S =
(\mathrm{FRL}_{\mathrm{final}}+1)^{\alpha_F}
\cdot(R_{\mathrm{net}}+1)^{\alpha_{R_{\mathrm{net}}}}
$$

| 要素 | 日本語でいうと | 見ていること |
|---|---|---|
| `FRL_final` | 経営中核の強さ | 困難な時に資金・人・意思決定を動かせるか |
| `R_net` | 資源の持久力 | 粗利や資金繰りがあり、他PJを壊さず走れるか |

`S` の式では、経営中核 `FRL_final` と資源の持久力 `R_net` を掛け合わせる。どちらか片方では自走できない。CEO が強くても収益の見通しが無ければ資金が尽きるし、粗利があっても経営中核が弱ければ難所を越えられない。

以前は S に `sigma_SU` (追い風) も入っていたが、2026-07-16 に独立因子 M へ分離した。追い風はあくまで環境であって、会社の体質ではない。「M 高 × S 低」は「環境で延命しているが自走はできていない」、「M 低 × S 高」は「無風でも自分で走れる」と読む。旧構造ではこの区別が `sigma_SU` の高さにマスクされて見えなかった。

ここで大事なのは、S は「気合い」ではないこと。どれだけ良い技術でも、創業者・経営中核が弱く、資金を食い潰すだけなら、途中で止まる。逆に、まだ未完成でも、人と資金の見通しがあると、生き残って改善し続ける可能性が上がる。

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

現行の SPS default は `pwa/src/lib/amd-score.ts` の `SPS_ALPHA_DEFAULT`。

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

`amd_score_alpha` は legacy alpha の version 管理に使う。SPS weight の恒久変更をする時は、manual / spec / design と UI 表示を同じ作業単位で同期する。

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

単に値が低い軸ではない。alpha が大きく、現在値が低い軸が最も効く。現行画面では legacy comparison の bottleneck も併記するが、主表示の判断は SPS primary を先に読む。

律速軸は「一番悪い軸」ではなく、「次に直すと一番スコアが伸びる軸」。たとえば `SRL=1` でも alpha が小さければ、短期の最優先にはならないことがある。逆に `FRL=4` で一見そこまで低くなくても、alpha が大きいので、創業者・経営中核の補強が一番効くことがある。

画面で律速が出たら、次の順で読む。

1. その軸の点数が本当に妥当か
2. 根拠 notes があるか
3. 1点上げるために何をすればいいか
4. それが短期で直せるものか、長期課題か

## 画面に出ているもの

| 表示 | 位置づけ | 算出 / 取得元 |
|---|---|---|
| `SPS Primary` | 現行 primary | `calculatePrsScore()`。`P` / `R_net` が揃った時だけ score を出す |
| `INPUT NEEDED` | review pending | `missingAxes`。`P` / `R_net` のどちらかが null |
| `P Potential` | primary input | `amd_score_inputs.prs_potential` |
| `R_net` | primary input | `amd_score_inputs.prs_r_net` |
| `M マクロ追い風` | SPS component | `sigma_SU` の contribution `(sigma_SU+1)^alpha_sigma` |
| `R reach` | SPS component | TRL / BRL / GRL / SRL / HRL の contribution product |
| `S 自走力 (Survival = FRL × R_net)` | SPS component | final FRL / `R_net` の contribution product |
| `SPS history` | primary history | `computePrsScoreSeries()`。`status='ready'` の行だけ採用 |
| `Legacy AMD comparison` | legacy comparison | 旧 7 軸 Cobb-Douglas。SPS missing の代替 primary ではない |
| `M / X / F バランス` | legacy evidence | `M=sigma_SU`, `X=5 XRL`, `F=FRL` |
| `Triple Helix Matrix` | `sigma_SU` (= M) evidence | `mu_A` / `mu_I` / `mu_G`、C行列、観測値、被覆率 |
| `FRL panel` | founder evidence | ALQ 4因子 / Grit / Resilience / F_cap / notes |
| `XRL checklist` | XRL evidence / writer | チェックリストから達成レベルを算出し、`trl..hrl` へ反映 |

画面を見る時は、いきなり総合点だけを見ない。次の順番で見る。

1. `SPS Primary` が出ているか、`INPUT NEEDED` かを見る
2. `INPUT NEEDED` なら、足りないのが `P` か `R_net` かを見る
3. score が出ているなら、`M / P / R / S` のどれが弱いかを見る
4. 弱い component の内訳を見る
5. 最後に legacy M-X-F を comparison / evidence として読む

たとえば、総合点が低くても `P` が高いなら「大きい勝ち筋はあるが、追い風・準備・自走力のどれかが足りない」と読める。`R` が低ければ XRL checklist を見る。`M` が低ければ Triple Helix (観測 coverage 含む) を見る。`S` が低ければ FRL と R_net を見る。`P` 自体が低ければ、そもそもの市場・事業仮説を見直す。

### 簡単な読み方の例

| 状態 | 読み方 | 次に見るもの |
|---|---|---|
| `P` 高い / `R` 低い / `S` 中くらい | 大きい夢はあるが、まだ実現準備が足りない | XRL checklist、特に TRL / BRL / HRL |
| `M` 高い / `S` 低い | 追い風で延命できているが、自走はできていない | FRL、R_net (旧構造ではこの状態が見えなかった) |
| `M` 低い / `S` 高い | 無風でも自分の力で走れる体質 | 攻めのタイミングは M の変化を待つ / 作る |
| `P` 高い / `R` 高い / `S` 低い | 準備はあるが、自走する体力が不安 | FRL、R_net |
| `P` 低い / `R` 高い / `S` 高い | 実行力はあるが、勝った時の天井が小さい | 市場規模、事業仮説、Atlas / PL hearing |
| `P` missing | そもそもどれくらい大きい勝ち筋か未レビュー | `prs_potential` を入力・レビュー |
| `R_net` missing | 自走力のうち資金・収益・資源毀損が未レビュー | `prs_r_net` を入力・レビュー |

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
amd_score_inputs に評価 row または SPS input を保存
        ↓
cockpit / venture-map が today 以前の最新 row を読む
        ↓
SPS Primary / SPS history / legacy M-X-F / evidence を表示
        ↓
まさが違和感を持ったら詳細画面・Tsukuyomi・修正依頼 loop で直す
```

## Legacy AMD / M-X-F Appendix

legacy MXF (= M-X-F / 7 軸 Cobb-Douglas) は過去モデル。削除しないが、現行 primary として読まない。

M-X-F は、昔のAMD Scoreを読むための地図として残す。いまの主表示は SPS (M·P·R·S) だけど、M-X-F は無駄ではない。legacy の `M` は SPS の `M` と同一の式 `(sigma_SU+1)^alpha_sigma`、`X` は SPS の `R` の根拠、`F` は SPS の `S` (自走力) に入る FRL の根拠として使う。

つまり、M-X-F は「古い点数をそのまま主役に戻すもの」ではなく、「SPSがなぜその値になったかを説明する証拠棚」。古い資料や過去のscore historyを見る時も、M-X-Fが残っていると当時の判断を読み解ける。

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

| legacy 要素 | 意味 | 現行 SPS での読み方 |
|---|---|---|
| `M` | Macrotrend / Triple Helix | SPS の `M` と同一の式 (2026-07-16 に SPS 側でも独立因子へ) |
| `X` | 5 XRL readiness | `R` の evidence |
| `F` | Founder readiness | `S` (自走力) の FRL evidence |

保存目的:

- 過去の retrofit / score history を読み解く
- SPS の R/S の根拠として XRL / sigma_SU / FRL を残す
- 旧画面・旧説明との比較対象にする

禁止:

- legacy score を SPS missing の代替 primary にする
- M-X-F を章 summary や cockpit 主表示の主語へ戻す
- 既存 7 軸履歴を破壊的に再計算する

たとえば `SPS Primary` が `INPUT NEEDED` の時に、legacy score が高いからといって「このPJは高スコア」と表示しない。必要なのは legacy を主役に戻すことではなく、足りない `P` / `R_net` をレビューして SPS を完成させること。

## 関連

- [`pwa/spec/4-2-amd-score-current-spec.md`](../spec/4-2-amd-score-current-spec.md)
- [`pwa/design/amd_score.md`](../design/amd_score.md)
- [`pwa/design/xrl_evidence.md`](../design/xrl_evidence.md)
- [`pwa/design/score_revision_feedback_loop.md`](../design/score_revision_feedback_loop.md)
- [`pwa/design/macrotrend_atlas_seeds_architecture.md`](../design/macrotrend_atlas_seeds_architecture.md)
