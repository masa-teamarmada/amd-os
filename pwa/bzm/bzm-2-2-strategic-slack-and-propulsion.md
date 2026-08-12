# BZM 2.2 — 戦略余力と推進力の動学

開発費を使えば、現金は減る。

しかし、その支出によって量産再現性が確立し、有償評価が始まり、次の資金調達と共同開発が可能になったなら、スタートアップの経営状態まで同じだけ悪化したとは言えない。

逆に、現金残高と損益に目立った問題がなくても、主要人材、顧客の信頼、資金調達の時間窓、規制上の立場、代替経路が同時に失われつつあるなら、会社は危機へ近づいている。

BZM 2.2は、この違いを**推進力**と**戦略余力**の動学として扱う。

> **状態**：`theory-open v2.2 / implementation-not-started`
>
> **主張の地位**：`design-choice`＋`unvalidated-hypothesis`
>
> **情報締切**：2026-08-12
>
> **前向き検証**：0件
>
> **計算状態**：2.2の実PJ数値は未計算。
> BZM 2.1以前の試算を2.2の値へ読み替えない。

この章は、新しい点数や第十の診断軸を追加するものではない。

状態、行動別制約、実行可能な行動集合、支出による状態遷移、目標到達経路の頑健性を順に定め、その結果を[BZM 2.1の動的価値評価](./bzm-2-1-dynamic-business-value-model)へ渡す。

---

## 1. なぜ2.2へ上げるのか

BZM 2.1は、続行、待機、再試行、迂回、縮小、拡張、ライセンス、撤退を有限グラフ上で比較する。

その中では、行動費用はキャッシュフローから控除され、行動後の価値はBellman方程式で評価される。

この基本構造は正しい。

問題は、支出が次の状態をどう変えるかが、十分に構造化されていなかったことにある。

たとえば設備投資を負のキャッシュフローとして記録しても、その設備によって次の何が変わるかを置かなければならない。

- 残る技術課題がどれだけ減るか。
- 品質について何が分かるか。
- 顧客が有償評価へ進むか。
- 許認可や契約上の条件が閉じるか。
- 次に選べる行動が増えるか。
- 完成までの時間と残費用がどう変わるか。

費用だけを引き、これらの状態変化を固定確率または手置き係数へ押し込めば、支出の負側だけが強く見える。

これは、支出を正のキャッシュフローへ変えれば直る問題ではない。

必要なのは、費用と、その費用が買った状態変化を別の場所で一度ずつ数えることである。

もう一つの問題は、戦略余力を固定した五つまたは六つの成分で表そうとしたことにある。

現金、チーム、顧客、知財、パートナー、選択肢といった言葉は、現場の確認項目としては役立つ。

しかし、これらは同じ分類軸ではない。

現金は資源在庫、チームは主体と能力、顧客とパートナーは相手方の役割、知財は技術知識と法的権利の交差物、選択肢は状態から生まれる派生結果である。

したがって、固定した成分一覧を必要十分またはMECEな状態座標とはしない。

2.2への版上げは、次の二つを同時に行うために必要となる。

1. 支出を、状態遷移と次の行動集合へ接続する。
2. 戦略余力を、資源の足し算ではなく目標到達経路の壊れにくさとして定義する。

---

## 2. 2.1から何を継承し、何を改めるか

2.2は2.1の上書きではなく、2.1の価値評価へ渡す状態と遷移を精密化する版である。

### 2.1から継承するもの

- 有限判断グラフと後退評価。
- 一つのscenario、一つのcontroller、一つのpolicyという契約。
- 会社、BZSF、公的支援者の評価視点の分離。
- 物理確率と価値評価重みの分離。
- 行動束、権限、相手方同意、資金実行可能性の確認。
- 一つのキャッシュフロー事象を一度だけ保存し、各視点へ派生する規則。
- 情報締切、版、入力hash、欠測、前向き検証の管理。

### 2.2で改めるもの

- 戦略余力を固定成分の合計または最小時計としない。
- optionを基礎資源として二重に数えない。
- 支出と無関係な固定遷移確率だけで進捗を表さない。
- 登録済み行動を現実の全行動と呼ばない。
- 候補顧客数、VC数、経路数をそのまま余力へ加点しない。
- 「余力が減った」という事実だけで危機と判定しない。

BZM 2.0で定義した$T_Y$は、2.2では互換表示を残しながら中身を置き換える。

固定五成分の最小値ではなく、目標へ届く方針が失われる初回時点から導く。

---

## 3. 同じ生データイベントを重複計上しない

資源カテゴリも、現実の事象境界も、自然にMECEになるとは仮定しない。

排他的に管理するのは、同じ経済的または法的事象の識別と価値計上である。

一つの正規化事象に`canonical_event_id`を付け、根拠資料の`evidence_id`、状態への効果を表す`effect_id`、経済・入出金の脚を分ける。

同じ契約でも、締結、条件充足、請求、着金、変更、解除は別の事象になりうる。

同じ事象を支えるメール、契約書、議事録、銀行明細は、複数の証拠であって複数の事象ではない。

たとえば国の研究開発事業への採択には、少なくとも次の面がある。

- 条件付き資金を受け取る権利。
- 技術審査を通ったという証拠。
- 政策上の正当性。
- 対象経費、報告、返還に関する義務。
- 経営陣と研究チームの管理負荷。

これらを五件の採択として保存してはいけない。

採択事実は一件であり、その一件から複数の状態効果を派生する。

一件の採択には、採択上限、対象経費上限、条件付き債権、各回の着金という複数の金額がありうる。

したがって、金額も一つに潰さず、意味と時点の異なる`economic_leg`と`cashflow_leg`へ分ける。

同一キャッシュフローだけを重複計上せず、価値は後段の遷移とBellman計算で一度だけ評価する。

「資料が存在した」という観測と、「資料が示す状態効果を確認できた」という判定も分ける。

資料を見つけただけで、権利、現金、技術成功、相手方確約を`observed`へ昇格しない。

### 監査用のタグ

抽出漏れを探すため、次のタグを使ってよい。

- financial
- human-attention
- organization-governance
- technical-information
- physical-operations
- legal-regulatory
- relational
- legitimacy

この一覧は必要十分でも排他的でもない。

一つの事象へ複数タグが付いてよい。

識別子は一件に保ち、金額は意味と時点ごとの脚として保存する。

---

## 4. 2.2の状態

評価時点$t$の情報状態を、次のように置く。

$$
\mathbf s_t
=
(\mathbf x_t,\mathbf r_t,\widehat{\mathbf c}_t,\mathbf k_t,\mathbf n_t,\boldsymbol\ell_t,\mathbf e_t,\mathbf b_t)
$$

| 状態 | 意味 | 例 |
|---|---|---|
| $\mathbf x_t$ | 検証済みの進捗と知識証拠 | 実験結果、再現性、品質分布、有償評価の結果、残課題の減少 |
| $\mathbf r_t$ | 現在利用できる資源 | 使途別現金、工数、設備時間、試料、利用可能なデータ量とアクセス容量 |
| $\widehat{\mathbf c}_t$ | 組織に蓄積した実行能力のposterior summary | 再現可能なルーチン、学習速度、統合、再構成、品質管理、採用、交渉の能力に関する推定分布の要約 |
| $\mathbf k_t$ | 権利、契約、統治、規制上の状態 | 許認可、取締役会権限、投資契約、NDA、独占権、データ利用許諾、拘束力ある費用負担義務 |
| $\mathbf n_t$ | 相手方ごとの関係と確約状態 | 顧客の確約段階、VCとの競争性、共同開発の交渉段階、費用負担提案、撤回可能性 |
| $\boldsymbol\ell_t$ | 受け手別の正当性と受容状態 | 顧客、投資家、規制当局、行政、大学が何をどの証拠で受容しているか |
| $\mathbf e_t$ | 外部環境と期限 | 市場、競争、政策、規制変更、相手方予算、失効日 |
| $\mathbf b_t$ | 未確定事象についての信念 | 技術成功、調達成立、顧客採用、規制承認の分布 |

各状態はベクトルであり、異なる単位を足して一つの点数へしない。

検討初期の七層案$S=(X,R,C,G,N,E,\mu)$との対応では、$X=\mathbf x$、$R=\mathbf r$、$C=\widehat{\mathbf c}$、$G=(\mathbf k,\boldsymbol\ell)$、$N=\mathbf n$、$E=\mathbf e$、$\mu=\mathbf b$である。

統治・法的権利$\mathbf k$と受け手別正当性$\boldsymbol\ell$を同じ$G$へ潰さないため、2.2本文では八層へ展開した。

$\mathbf x_t$は消費しない進捗証拠だが、反証、失効、陳腐化によって下方更新されうる。

設備そのものは$\mathbf r_t$、設備によって確認した性能は$\mathbf x_t$、設備を使う権利と条件は$\mathbf k_t$へ分ける。

$\boldsymbol\ell_t$は単一の評判在庫ではない。

受け手、受容する主張、根拠、期限を別々に持ち、顧客の受容を規制当局または投資家の受容へ読み替えない。

同じ対象でも、意味の違う層へ分ける。

たとえばチームの人数と空き工数は$\mathbf r_t$、組合せと学習の力に関するposterior summaryは$\widehat{\mathbf c}_t$、誰が決められるかは$\mathbf k_t$に入る。

未受領の資金も段階を分ける。

| 観測 | 主な接続先 |
|---|---|
| VCの関心、面談、前向きな発言 | $\mathbf b_t$の調達成立に関する証拠 |
| 非拘束のterm sheet | $\mathbf n_t$の交渉状態と$\mathbf b_t$の調達成立に関する証拠。権利にはしない |
| 採択通知 | 交付条件に応じた$\mathbf k_t$の条件付き権利と$\boldsymbol\ell_t$の政策上の受容 |
| 署名済み契約で条件未充足 | $\mathbf k_t$と条件別の$\mathbf b_t$ |
| 着金済み現金 | $\mathbf r_t$ |

候補社数が増えただけでは、$\mathbf r_t$は増えない。

反対に、まだ着金していなくても、競争的な調達過程が成立すれば交渉条件と調達信念は変わりうる。

### 能力と信念の識別境界

真の能力$\mathbf c_t$は直接観測できる量ではなく、反復可能な実行記録から推定する潜在状態である。

投入量、案件難度、外部ショックを分けられない段階では、成果を能力の因果効果と呼ばない。

その段階の$\mathbf c_t$は、状態遷移を予測するための未校正な潜在変数である。

意思決定で直接使うのは、観測できない真の能力そのものではなく、情報集合から得た$\mathbf c_t$のposteriorまたは事前登録したposterior summary $\widehat{\mathbf c}_t$である。

$\mathbf b_t$は、情報集合$\mathcal I_t$の下で未確定状態$\theta$について持つ物理信念とする。

$$
\mathbf b_t
=
\Pr^{\mathbb P}(\theta\mid\mathcal I_t)
$$

同じイベントを$\mathbf x_t$、$\mathbf n_t$、$\boldsymbol\ell_t$へ写像しても、信念更新の尤度を三回掛けない。

状態効果の多面性と、統計証拠の独立性を混同しない。

状態$\mathbf s_t$は、同じ評価契約の下で将来のpayoff、制約、物理遷移を予測するために十分な情報状態でなければならない。

この条件が成り立たない場合、履歴または必要なposteriorを状態へ追加し、無理にMarkov性を仮定しない。

---

## 5. 行動ごとの制約を置く

同じ会社でも、量産設備へ投資する行動と、ライセンス交渉を始める行動では必要条件が違う。

したがって、戦略余力を会社全体の`available - required`だけで表さない。

行動$a_t$だけでなく、その行動へ投入する現金、工数、設備、権利の束$\mathbf i_t$も意思決定である。

そこで制御を次の組として置く。

$$
\mathbf z_t=(a_t,\mathbf i_t)
\in\mathcal Z_t^{\mathrm{reg}}
$$

登録済み制御$\mathbf z$について、各制約の証拠状態を次の三値で持つ。

$$
\sigma_j(\mathbf s_t,\mathbf z)
\in
\{\mathrm{met},\mathrm{violated},\mathrm{unknown}\}
$$

数量または時間を測定できる制約では、$\sigma_j=\mathrm{met}$の条件を次の関数で表す。

$$
g_j(\mathbf s_t,\mathbf z)\le 0
\qquad
(j\in\mathcal J(\mathbf z))
$$

登録済み制約の上で実行可能な行動集合は、次になる。

$$
\Gamma_{\mathrm{exec}}^{\mathrm{reg}}(\mathbf s_t)
=
\left\{
\mathbf z\in\mathcal Z_t^{\mathrm{reg}}
\;\middle|\;
\sigma_j(\mathbf s_t,\mathbf z)=\mathrm{met}
\ \text{for all }j\in\mathcal J(\mathbf z)
\right\}
$$

未確認の制約だけが残る行動は、別集合へ置く。

$$
\Gamma_{\mathrm{open}}^{\mathrm{reg}}(\mathbf s_t)
=
\left\{
\mathbf z\in\mathcal Z_t^{\mathrm{reg}}
\;\middle|\;
\sigma_j\ne\mathrm{violated}\ \text{for all }j\in\mathcal J(\mathbf z),
\ \sigma_j=\mathrm{unknown}\ \text{for some }j\in\mathcal J(\mathbf z)
\right\}
$$

ここで$\mathcal Z_t^{\mathrm{reg}}$は、評価時点に登録できた行動と投入束の集合である。

現実に存在する全行動と投入方法ではない。

Bellman最適化へ入れるのは$\Gamma_{\mathrm{exec}}^{\mathrm{reg}}$だけである。

$\Gamma_{\mathrm{open}}^{\mathrm{reg}}$はshadow評価または追加証拠の取得対象として表示するが、選択方針へ入れない。

重要なunknownには、許可取得、相手方確認、追加実験など、条件を確認済みへ変える探索行動を対応させる。

その行動も登録できない場合、$\Gamma_{\mathrm{exec}}^{\mathrm{reg}}$だけで出した結果を確認済み情報に基づく下限と呼ぶ。

$\Gamma_{\mathrm{exec}}^{\mathrm{reg}}$が空のとき、待機または撤退を暗黙の実行可能行動として補わない。

外部事象による強制遷移、distress、または終端状態を明示する。

### 制約の型

| 型 | 例 | 判定の形 |
|---|---|---|
| 数量 | 現金、工数、設備枠、試料 | 利用可能量と必要量 |
| 時間 | 入金、発注、審査、顧客予算 | 完了予測時点と期限 |
| 権限 | 取締役会、株主、大学、規制当局 | 許可、禁止、不明 |
| 契約 | 用途、独占、解除、費用負担 | 条項充足、未充足、不明 |
| 関係 | 相手方の確約、撤回可能性、依存 | 証拠段階と条件 |
| 共有資源 | CEOの注意、研究者、設備、資金 | 同時実行する行動束全体 |

制約の状態は、少なくとも`充足`、`違反`、`不明`に分ける。

`不明`を充足へ読み替えない。

数量制約に限り、診断用の余裕を次で表示できる。

$$
m_j(\mathbf s_t,\mathbf z)=-g_j(\mathbf s_t,\mathbf z)
$$

$m_j$は行動と投入束ごとの診断値であり、会社に固定された普遍的な戦略余力ではない。

また、人を採る、外注する、共同開発する、自動化するという代替があるため、必要資源を固定比率で置かない。

制約関数$g_j$は、複数の実行可能な投入束を扱える形にする。

予定へ割り当てられる経営陣の時間は$\mathbf r_t$で扱えるが、優先順位づけ、集中、切替負荷、意思決定構造を単純な工数へ潰さない。

反復可能な配分能力のposterior summaryは$\widehat{\mathbf c}_t$、権限と決裁構造は$\mathbf k_t$へ分ける。

### 複数PJの共有資源

PJを一件ずつ見たときに実行可能でも、同じCEO、研究者、設備、現金を同時には使えない場合がある。

$P$件のPJについて選ぶ制御ベクトルを$\mathbf z_t=(\mathbf z_{1t},\ldots,\mathbf z_{Pt})$、PJ状態を束ねたポートフォリオ状態を$\mathbf s_t^{\mathrm{port}}=(\mathbf s_{1t},\ldots,\mathbf s_{Pt},\mathbf r_t^{\mathrm{shared}})$、会社全体の共有資源制約を$G_h$とする。

共同実行可能な行動束は、次で確認する。

$$
\Gamma_{\mathrm{portfolio}}^{\mathrm{reg}}(\mathbf s_t^{\mathrm{port}})
=
\left\{
\mathbf z_t
\;\middle|\;
\mathbf z_{pt}\in\Gamma_{\mathrm{exec},p}^{\mathrm{reg}}(\mathbf s_{pt})
\ \text{for all }p,
\ G_h(\mathbf s_t^{\mathrm{port}},\mathbf z_t)\le0
\ \text{for all }h
\right\}
$$

単独PJの2.2値だけでは、複数PJの同時採用または資源配分を決めない。

単独PJだけを計算するときは、会社全体からそのPJへ割り当て済みの現金、工数、設備時間、経営陣の注意を外生的なquotaとして入力する。

他PJの機会費用または共有資源のshadow valueは、複数PJを同じ状態と制約へ載せたポートフォリオ計算でだけ求める。

会社またはBZSFで同時採用する場合は、このポートフォリオ制約を先に通す。

### 行動を発見する行動

スタートアップでは、重要な行動が最初から分かっているとは限らない。

顧客対話、小規模実験、共同研究の設計、資源獲得、戦略レビューは、新しい行動を発見するための行動である。

したがって、$\mathcal Z_t^{\mathrm{reg}}$には実行行動だけでなく探索行動と投入束も登録する。

それでも未登録の行動は残るため、計算結果を「世界全体の最適方針」と呼ばない。

正しい呼び方は「登録済み行動と制約の範囲における最適方針」である。

---

## 6. 支出は負のまま、状態変化を価値へ入れる

制御$\mathbf z_k=(a_k,\mathbf i_k)$の後に、次の状態と次の判断までの時間が生じる物理遷移を置く。

$$
(\mathbf s_{k+1},\Delta t_{k+1})
\sim
\mathbb P^{\mathrm{stress}}_{\delta}
\!\left(
\cdot\mid\mathbf s_k,\mathbf z_k
\right)
$$

$\delta$は、同じ制御に対する外部ショック経路である。

実験結果、市場反応、相手方判断、所要時間は、実行前には確定しない。

通常の物理予測には、事前登録したbaseline law $\mathbb P^0$を使う。

$\{\mathbb P^{\mathrm{stress}}_{\delta}:\delta\in\Delta\}$は、頑健性を調べるstress familyであり、baseline lawと混ぜない。

投入$\mathbf i_k$に含まれる支出は、キャッシュフローでは負である。

一方で、同じ投入が物理遷移を通じて進捗、能力、権利、関係、正当性、信念、次の実行可能集合を変える。

投入を増やしたときの限界価値は、後で定める同じcontroller、同じ評価視点、同じ割引規則の行動価値を二つ比較して定める。

両方の投入束が同じscenarioの確認済み実行可能集合に入る場合だけ、この差を計算する。

$$
\Delta J_{u_d}
\!\left(\mathbf s;a,\mathbf i,\Delta\mathbf i\right)
=
J_{u_d}^*
\!\left(\mathbf s,(a,\mathbf i+\Delta\mathbf i)\right)
-
J_{u_d}^*
\!\left(\mathbf s,(a,\mathbf i)\right)
$$

この差には、追加支出、途中キャッシュフロー、所要時間、遷移分布、将来方針の変化をすべて含める。

別視点$r$から同じ二つの制御を再評価する差は$\Delta J_{r\mid d}$と書き、controller目的の$\Delta J_{u_d}$と混ぜない。

第二の投入束が買う将来状態の改善が追加費用を上回れば、キャッシュフロー上は支出でも限界投資価値は正になる。

支出を正のキャッシュフローへ反転すると、状態遷移側の便益と二重計上になる。

正しい修正は、負の符号を消すことではなく、支出と状態変化の物理遷移を欠かさず、同じ行動価値の差として評価することである。

### 現金を一度だけ数える

会社が保有するPJの将来正味価値では、現金残高は行動の実行可能性と資金の崖に使う。

評価日時点の現金残高をPJ終端価値へ足さず、PJ支出はキャッシュフローで一度だけ控除する。

既存株主の持分価値を測る別モデルでは、現金、負債、優先権、希薄化、清算順位を株主帰属台帳へ入れる。

その場合、会社内部の支出を外部株主からの追加拠出としてもう一度控除しない。

PJ価値と株主持分価値の会計境界を同じ式へ混ぜない。

### 推進力

2.2でいう**推進力**は、資源の量でも支出額でもない。

潜在能力$\mathbf c_t$は行動前に会社へ蓄積しており、意思決定ではそのposterior summary $\widehat{\mathbf c}_t$を使う。

推進力は能力そのものではなく、その能力、状態、行動、投入束から予測される次状態と所要時間の分布である。

一度の成功結果を能力と同一視せず、実現した遷移と、事前に予測した遷移分布も分ける。

推進力は、最初から一つの点数へしない。

少なくとも次を別に測る。

- 残課題と残費用の減少。
- 完成時間の短縮または遅延。
- 技術品質と需要についての情報獲得。
- 契約、許認可、顧客確約の前進。
- 新しく実行可能になった行動。
- 同じ進捗を得るために消費した現金、時間、注意、権利。
- 下方失敗時に残る資産と次の手。

同じ一億円でも、何も閉じなかった一億円と、量産条件、顧客契約、資金調達の三つを前進させた一億円は異なる。

その差はキャッシュフローの符号ではなく、物理遷移核$\mathbb P^0$とstress familyの差として現れる。

---

## 7. 戦略余力は目標到達経路の壊れにくさである

目標集合を$\mathcal T$、到達前に許容できない状態の集合を$\mathcal F$、評価地平を$H$とする。

$\mathcal F$は倒産だけではなく、事前登録したhard failure状態である。

たとえば法的禁止、支払不能、不可逆な期限失効、目標達成を不可能にする技術失敗を含む。

到達見込みが閾値を下回るという確率的な経路喪失は$\mathcal F$へ循環的に入れず、捕捉領域$\mathcal K_{\mathcal T}^{-}$からの退出として扱う。

方針$\pi$の下で、判断時点$k$から目標と許容不能状態へ初めて着くまでの経過時間を、次で表す。

$$
\tau_{\mathcal T}^{\pi}
=
\inf
\left\{
\sum_{m=1}^{j}\Delta t_{k+m}
\;\middle|\;
j\ge0,\ \mathbf s_{k+j}^{\pi}\in\mathcal T
\right\}
$$

$$
\tau_{\mathcal F}^{\pi}
=
\inf
\left\{
\sum_{m=1}^{j}\Delta t_{k+m}
\;\middle|\;
j\ge0,\ \mathbf s_{k+j}^{\pi}\in\mathcal F
\right\}
$$

どちらも暦上の絶対時点ではなく、評価時点からの経過時間である。

$\mathcal T$と$\mathcal F$は互いに交わらない吸収状態とし、同じ判断時点で両条件に触れる場合は許容不能状態への到達を優先する。

目標または許容不能状態へ着いたら、その経路の余力評価を停止する。

### ショックと方針の情報順序

登録したショック経路の集合を$\Delta$とする。

$\Delta$には、入金遅延、主要人材の離脱、設備費上振れ、顧客予算の失効、規制遅延、それらが同時に起きる相関ショックを置く。

$\Pi_d^{\mathrm{reg,NA}}$は、controller $d$が登録した非予見的な状態依存方針の集合とする。

非予見的とは、将来のショックを先に知って行動を選ばず、その時点までに観測した状態だけで次の制御を選ぶことを意味する。

次の順序では、ショックが何か分かる前に一つの条件付き方針を登録し、その後は観測した状態に応じて方針内で行動を変える。

$$
q_{\mathrm{rob}}^{-}(\mathbf s,h;\Delta)
=
\sup_{\pi\in\Pi_d^{\mathrm{reg,NA}}(\Gamma_{\mathrm{exec}}^{\mathrm{reg}})}
\inf_{\delta\in\Delta}
\Pr_{\mathbb P^{\mathrm{stress}}_{\delta},\mathbf s}^{\pi}
\!\left(
\tau_{\mathcal T}^{\pi}<\tau_{\mathcal F}^{\pi},
\ \tau_{\mathcal T}^{\pi}\le h
\right)
$$

$q_{\mathrm{rob}}^{-}$は、確認済み実行可能集合だけを使った最悪ショック下の到達見込みである。

未確認制約をすべて満たせる可能性集合で同じ計算をした値を$q_{\mathrm{rob}}^{+}$とし、上限感度として別表示する。

$q_{\mathrm{rob}}^{+}$は、未確認制御の遷移についても事前登録した上限境界を置ける場合だけ計算する。

遷移そのものがmissingなら、上限を作らず`not_computable`とする。

missingを0にも充足にもせず、確認済み下限と可能性上限の幅へ残す。

### 頑健捕捉領域

閾値$\alpha$以上の見込みで目標へ届く状態の集合を、次で定める。

$$
\mathcal K_{\mathcal T}^{-}(\alpha,h;\Delta)
=
\left\{
\mathbf s
\;\middle|\;
q_{\mathrm{rob}}^{-}(\mathbf s,h;\Delta)\ge\alpha
\right\}
$$

可能性上限側も同様に$\mathcal K_{\mathcal T}^{+}$とする。

主表示には$\mathcal K_{\mathcal T}^{-}$を使い、$\mathcal K_{\mathcal T}^{+}$を確定値へ混ぜない。

### 2.2の$T_Y$

controllerが価値評価で選んだ方針$\pi_d^*$に沿う戦略余力喪失時間を、次で定める。

$$
T_Y^{2.2,\pi_d^*}
=
\inf
\left\{
h\in\mathcal H_{\mathrm{dec}}^{\pi_d^*}
\;\middle|\;
\mathbf s_{t+h}^{\pi_d^*}
\notin
\mathcal K_{\mathcal T}^{-}(\alpha,H-h;\Delta)
\right\}
$$

$\mathcal H_{\mathrm{dec}}^{\pi_d^*}$は、$0\le h\le\min(H,\tau_{\mathcal T}^{\pi_d^*},\tau_{\mathcal F}^{\pi_d^*})$を満たす判断時点までの経過時間集合である。

目標または許容不能状態への到達後に、余力喪失時点を探索しない。

集合内に余力喪失時点がなければ、$T_Y^{2.2,\pi_d^*}=+\infty$とする。

これは、固定した五つの時計のうち最初にゼロになる時間ではない。

選択方針を進めた結果、最悪登録ショックの下で目標へ届く登録方針を必要な確度で保持できなくなる初回時間である。

重みのない$\Delta$だけから、$T_Y$の中央値は一意に決まらない。

月数を表示する場合は、ショック$\delta$別の分位点、全$\delta$の最悪分位点、または事前登録した物理混合分布の分位点のどれかを明記する。

元の状態、制約、ショック経路を保存し、月数だけを正本にしない。

### ショック別の許容量

ショック$\ell$の強さを$\rho$とする集合$\Delta_{\ell}(\rho)$は、$\rho$が大きいほどショック経路を包含的に増やす。

$$
\rho_1\le\rho_2
\quad\Longrightarrow\quad
\Delta_{\ell}(\rho_1)\subseteq\Delta_{\ell}(\rho_2)
$$

その上で、許容できる最大ショックを次で表す。

$$
\rho_{\ell}^{*}(\mathbf s_t)
=
\sup
\left\{
\rho\ge0
\;\middle|\;
\mathbf s_t\in
\mathcal K_{\mathcal T}^{-}
\!\left(\alpha,H;\Delta_{\ell}(\rho)\right)
\right\}
$$

$\rho_{\ell}^{*}$は、入金遅延なら月、費用上振れなら円、人材なら工数という固有単位を持つ。

$\rho=0$でも捕捉領域の外なら$\rho_{\ell}^{*}=0$とし、登録した全$\rho$で内側なら登録範囲では上限未到達と表示する。

後者を有限の許容量へ丸めず、モデルが無限範囲を定義している場合だけ$+\infty$とする。

異なる単位の$\rho_{\ell}^{*}$を足して一つの戦略余力点数へしない。

### 一つの数字へ潰さない出力

戦略余力は、少なくとも次を分けて表示する。

1. 現在状態が$\mathcal K_{\mathcal T}^{-}$と$\mathcal K_{\mathcal T}^{+}$のどこにあるか。
2. 通常の物理分布下で目標到達前に許容不能状態へ着く確率。
3. ショック別の$T_Y^{2.2,\pi_d^*}$分布。
4. 共通故障点を持たない代替方針の有無。
5. ショック別の許容量$\rho_{\ell}^{*}$。
6. 各制約を一単位悪化させたときの継続価値低下。
7. どの制約が次に方針を消すか。

経路数をそのまま加点しない。

十本の経路が同じ許認可、供給者、投資家判断へ依存していれば、実質的には一本の共通故障点しかない。

また、通常の物理到達確率$q^{\pi}$と$q_{\mathrm{rob}}^{-}$は同じではない。

$q^{\pi}$はbaseline law $\mathbb P^0$における特定方針の到達見込みであり、$q_{\mathrm{rob}}^{-}$はstress familyの最悪登録ショック下の下限である。

### 評価契約を凍結する

目標、許容不能状態、地平、閾値、行動と投入束、制約、ショック集合、遷移モデル版、情報締切を評価契約$\Theta_v$として凍結する。

$$
\Theta_v
=
(\mathcal T,\mathcal F,H,\alpha,d,u_d,\mathcal Z^{\mathrm{reg}},\mathcal J,\mathbb P^0,\Delta,M,\mathbf q^{\mathrm{alloc}},\text{transition-version},\tau)
$$

$M$は視点別の価値評価規則、$\mathbf q^{\mathrm{alloc}}$は単独PJへ外生配分した共有資源quotaである。

$\Theta_v$を変更した結果は、同じ時系列上の戦略余力改善と呼ばず、新しいscenarioまたは新版とする。

状態が変わった効果と、測定仕様を変えた効果を分解表示する。

最初の$\Theta_v$についても、標準ショック集合、仕様作成者、独立した反対査読者、採否理由を登録する。

目標、$\alpha$、地平、ショック集合を最初から都合よく選ぶ余地を、凍結だけで解消したとはみなさない。

戦略余力を報酬、個人KPI、PJ順位、資源配分の単独条件にしない。

---

## 8. 余力の減少が危機になる条件

戦略余力が減っただけでは、危機と断定できない。

設備投資、実証、規制審査、採用、有償PoCでは、現金、時間、注意、選択肢を意図的に使う。

その消費によって、残課題が減り、完成時間が短くなり、契約が閉じ、次の行動が開いたなら、会社は前へ進んでいる。

反対に、現金が横ばいでも、主要顧客の信頼、知財上の独占可能性、資金調達の時間窓、CEOの注意、規制上の立場が悪化し、残課題が減っていなければ危機である。

したがって、危機判定は次の複合で行う。

- 同じ評価契約$\Theta_v$で再計算した$\mathcal K_{\mathcal T}^{-}$から外れる見込みが、複数版にわたり上昇している。
- $T_Y^{2.2,\pi_d^*}$が、残る目標到達時間より速く近づいている。
- 共通故障点の異なる代替方針が消えている。
- 消費した資源に対して、残課題、残時間、不確実性、行動集合が改善していない。
- 次の資源補充または状態改善より先に、最弱制約が違反へ到達する。

これを、**到達距離の短縮で補償されない戦略余力の慢性的低下**と呼ぶ。

行動発見またはモデル改訂で$\Theta_v$が変わった場合は、実態の変化と測定仕様の変化を分け、同じ慢性低下の系列へ直結しない。

余力は、多いほど常に良いわけでもない。

資源を温存するあまり実験、顧客対話、採用、設備投資を行わず、進捗が止まるなら、余力の高さは推進力の弱さを隠す。

---

## 9. 2.1の価値評価へ接続する

2.2でも、一つのscenarioでは一つのcontroller $d$だけが方針を選ぶ。

controller目的における制御$\mathbf z$の行動価値を、2.1の遷移別価値評価係数を保った形で表す。

終端状態$\zeta\in\mathcal T\cup\mathcal F$では、2.1と同じ残存価値または清算価値を境界条件にする。

$$
V_r^{\pi_d^*}(\zeta)=RV_r(\zeta),
\qquad
V_{u_d}^*(\zeta)=RV_{u_d}(\zeta)
$$

非終端状態で$\Gamma_{\mathrm{exec}}^{\mathrm{reg}}(\mathbf s)=\varnothing$なら最大化を行わず、状態ごとに事前登録したforced-failure、distress、またはclosure終端$\zeta_{\mathrm{forced}}(\mathbf s)$へ遷移させる。

$$
J_{u_d}^*(\mathbf s,\mathbf z)
=
-C_{u_d}^{\mathrm{now}}(\mathbf s,\mathbf z)
+
\operatorname E^{\mathbb P^0}
\left[
CF_{u_d}^{\mathrm{PV}}(\mathbf s,\mathbf z,\mathbf s',\Delta t)
+
M_{u_d}(\mathbf s,\mathbf z,\mathbf s',\Delta t)
V_{u_d}^*(\mathbf s')
\mid\mathbf s,\mathbf z
\right]
$$

$CF_{u_d}^{\mathrm{PV}}$と後で使う$CF_r^{\mathrm{PV}}$は、次の判断時点までに発生する各CFへ、その満期に対応する同じ視点別価格づけ核と割引を適用した、条件付き現在価値である。

$M_{u_d}$と$M_r$は、次の判断時点にある継続価値へ掛ける、同時点までの確率的割引と価格づけ係数である。

2.1の離散重み$w_r$は、区間内CF脚と継続価値脚の各満期に対応するbaseline transition probabilityと価格づけ核の積として再現する。

2.2は、2.1が許していた視点別価格づけを実世界期待値へ狭めない。

確認済み実行可能集合の中で、controllerが一つの方針を選ぶ。

次の最大化と方針定義は、非終端かつ$\Gamma_{\mathrm{exec}}^{\mathrm{reg}}(\mathbf s)\ne\varnothing$の状態に限る。

$$
V_{u_d}^*(\mathbf s)
=
\max_{\mathbf z\in\Gamma_{\mathrm{exec}}^{\mathrm{reg}}(\mathbf s)}
J_{u_d}^*(\mathbf s,\mathbf z)
$$

$$
\pi_d^*(\mathbf s)
\in
\arg\max_{\mathbf z\in\Gamma_{\mathrm{exec}}^{\mathrm{reg}}(\mathbf s)}
J_{u_d}^*(\mathbf s,\mathbf z)
$$

非終端状態で$\Gamma_{\mathrm{exec}}^{\mathrm{reg}}(\mathbf s)=\varnothing$なら、事前登録した終端$\zeta_{\mathrm{forced}}(\mathbf s)$へ強制遷移し、次を境界条件にする。

$$
V_{u_d}^*(\mathbf s)
=
RV_{u_d}(\zeta_{\mathrm{forced}}(\mathbf s)),
\qquad
\pi_d^*(\mathbf s)\ \text{is undefined}
$$

各評価視点$r$は、この同じ方針$\pi_d^*$を最大化し直さずに再評価する。

$$
V_r^{\pi_d^*}(\mathbf s)
=
-C_r^{\mathrm{now}}(\mathbf s,\mathbf z_d^*)
+
\operatorname E^{\mathbb P^0}
\left[
CF_r^{\mathrm{PV}}(\mathbf s,\mathbf z_d^*,\mathbf s',\Delta t)
+
M_r(\mathbf s,\mathbf z_d^*,\mathbf s',\Delta t)
V_r^{\pi_d^*}(\mathbf s')
\mid\mathbf s,\mathbf z_d^*
\right]
$$

ここで$\mathbf z_d^*=\pi_d^*(\mathbf s)$である。

$C_r^{\mathrm{now}}$、$CF_r^{\mathrm{PV}}$、$M_r$は、2.1で定めた視点別の費用、次の判断までのキャッシュフロー、割引、価格づけ規則である。

非金銭制約は$CF_r$へ混ぜず、$\sigma_j$と$\Gamma_{\mathrm{exec}}^{\mathrm{reg}}$へ置く。

非金銭便益を目的へ含める場合だけ、事前登録した換算規則または多目的判断規則として別に置く。

2.2は価値式を別物へ置き換えない。

変えるのは、次状態と所要時間の物理遷移、行動と投入束の制御、確認済み実行可能集合の作り方である。

### 三つの出力を混ぜない

| 出力 | 答える問い | 主な計算位置 |
|---|---|---|
| 推進力 | 資源を何へ、どの速さと不確実性で変えられるか | baseline law $\mathbb P^0$とstress family $\mathbb P_{\delta}^{\mathrm{stress}}$ |
| 戦略余力 | ショック後も目標到達方針を保持できるか | $\Gamma_{\mathrm{exec}}^{\mathrm{reg}}$と$\mathcal K_{\mathcal T}^{-}$ |
| 動的正味PJ価値 | その動学の下で方針が生む将来正味価値はいくらか | Bellman価値$V_r$ |

現行運用SPSは9軸の診断指数として別に残す。

BZM 2.0の固定方針SPSと、2.1以降の動的正味PJ価値も同じ出力名へ潰さない。

推進力が高くても、一回の不可逆行動で全代替経路を失うPJは、戦略余力が低い場合がある。

戦略余力が高くても、資源を進捗へ変えられないPJは、推進力が低い。

価値最大方針と、余力を最も温存する方針も一致するとは限らない。

したがって、余力を自動的な最大化目的にしない。

BZM 2.1の登録された目的で選んだ方針について戦略余力を表示し、余力最大方針は比較対象として分ける。

---

## 10. OSで必要な入力契約

OSは、原則としてまさへの質問ではなく、生データから次の順に抽出する。

1. 正規化イベント、複数の証拠、状態効果、経済・入出金脚、版、日時を分けて保存する。
2. イベントから状態への効果を、観測、計算、推定、不明に分けて写像する。
3. 行動と投入束ごとに必要な制約と、現在の充足、違反、不明を作る。
4. 制御が次の状態と所要時間へ与える物理遷移を作る。
5. 目標到達方針、許容不能状態への初回到達、戦略余力を計算する。
6. 同じ台帳を2.1の方針価値へ渡す。

人への確認は、生データと既存文書を読んでも結論が変わる重要な未決だけに限る。

### 必須の証拠段階

| 地位 | 意味 | 計算上の扱い |
|---|---|---|
| observed | 署名文書、着金、検収、実験記録などから、その状態効果まで確認 | 該当する状態へ反映。資料の存在だけとは分ける |
| calculated | 観測値から登録式で再計算 | 式と入力hashを保存 |
| estimated | 再現規則のある推定 | 中央値と感度を保存 |
| conditional | 条件が閉じた時だけ成立 | 条件別の分岐へ接続 |
| missing | 必要だが根拠がない | 0にせず不明を保持 |
| not_applicable | その行動では対象外 | 欠測と区別 |

推定値を使って強制試算する場合も、観測値へ昇格しない。

推定の粗さは、感度と行動反転の閾値で示す。

---

## 11. 二つの短い例

### 11.1 同じ一億円でも違う

行動Aは一億円を使い、設備を設置したが、受入条件、品質判定、顧客評価、次の調達条件が未定のままだったとする。

行動Bも一億円を使ったが、設備検収、連続運転データ、有償評価契約、次回調達の技術条件を同時に閉じたとする。

両方のキャッシュフローは一億円の支出である。

しかし、行動Bは$\mathbf x_t$、$\mathbf k_t$、$\mathbf n_t$、$\mathbf b_t$を変え、次の$\Gamma_{\mathrm{exec}}^{\mathrm{reg}}$を広げる。

2.2では、この差を次状態と所要時間の物理遷移で評価する。

支出額へ便益点を足すのではない。

### 11.2 現金が減っていなくても危機になる

あるPJが、半年間ほぼ同じ現金残高を保ったとする。

しかしその間に、主要顧客の予算期限が切れ、共同開発候補が離れ、CEOの注意が別PJへ移り、規制相談が未実施のまま申請期限へ近づいたとする。

財務runwayは悪化していない。

それでも、複数の行動制約が同時に違反へ近づき、選択方針の下で目標へ届く方針が消えるなら、$T_Y^{2.2,\pi_d^*}$は近づく。

これが、valuationや残高だけでは見えないスタートアップの危機である。

---

## 12. 経済学と経営学からの批判的監査

2.2の設計は、経済学者役と経営学者役の二つの独立批判レビューを受けた。

どちらも修正後の方向を条件付きで支持したが、固定カテゴリの正本化、単一スコア化、未確認制約の最適化への混入には反対した。

### 経済学側の主要な反論

- 制約は行動ごとに違い、代替投入と時間を扱う必要がある。
- 未受領資金は、信念、条件付き権利、着金済み資源へ分ける必要がある。
- 一つずつ実行可能な行動でも、共有資源の下では同時実行できないことがある。
- 選択肢の数は価値ではなく、維持費、共通故障点、期限を含める必要がある。
- 戦略余力、推進力、経済価値は別出力でなければならない。

### 経営学側の主要な反論

- 資源在庫と、資源を統合、学習、再配置する能力を分ける必要がある。
- 登録済み行動は不完全であり、行動を発見する探索を含める必要がある。
- 関係と正当性は相手方ごとに異なり、候補社数へ縮約できない。
- 統治、許認可、拒否権は連続量ではなく条件や権限として扱う必要がある。
- 余力は多いほどよいとは限らず、進捗へ変換されない余力は停滞を隠しうる。

この反論を受け、2.2は八つの監査タグを状態座標へせず、八つの状態層、行動と投入束ごとの制約、物理遷移へ分解した。

---

## 13. この章が主張しないこと

2.2は、次を主張しない。

- 状態の八層が自然界で唯一の必要十分分類であること。
- 戦略余力を一つの普遍的スコアで測れること。
- 経路数または候補社数が多ければ安全であること。
- 支出すれば必ず能力または進捗が増えること。
- 余力最大方針が価値最大または経営上最善であること。
- 登録済み行動集合が現実の全行動を覆うこと。
- 2.2が会社全体の時価総額または既存株主持分価値を直接返すこと。
- 現時点の2.2がPJ比較、資源配分、投資推奨に使えること。

2.2が追加するのは、支出と状態変化、状態と実行可能行動、行動集合と戦略余力を、反証できる形でつなぐ設計である。

---

## 14. 反証条件

次のどれかが繰り返し起きた場合、2.2を改訂または縮小する。

1. モデルが実行可能とした行動が、未登録の必須条件によって繰り返し実行不能になる。
2. 過去に実行できた行動を、モデルが同時点の証拠で実行不能と判定する。
3. 代替手段があるのに、単一資源不足だけで全方針を失ったと判定する。
4. 同じ資源在庫でも能力差で生じる進捗差を、$\widehat{\mathbf c}_t$と遷移が説明できない。
5. 架空の候補行動を細分化するだけで、戦略余力または動的正味PJ価値が上がる。
6. 共通故障点を持つ十経路を、独立した十経路として安全と判定する。
7. 同時採用した複数行動または複数PJが、共有資源量を超える。
8. 余力を温存して進捗が止まっているPJを、継続的に高く評価する。
9. 凍結した前向き予測で、2.2がBZM 2.1または単純runwayより危機の先行判別を改善しない。
10. 制約の充足、不明、違反について、独立評価者間で再現しない。

実装後は、反証結果を成功例と同じ場所に追記する。

---

## 15. 実装前ゲート

2.2の数値を実PJへ表示する前に、少なくとも次を閉じる。

- 状態各層のtyped fieldと証拠契約。
- 一意イベントから複数状態効果への写像と二重計上防止。
- 行動別制約、三値状態、相手方、権限、期限。
- 探索行動と未登録行動の表示。
- 支出から進捗、時間、情報、行動集合への遷移モデル。
- 共有資源を使う行動束とPJポートフォリオ制約。
- 頑健捕捉領域、$T_Y^{2.2}$、感度の再現計算。
- 2.1の単一キャッシュフロー台帳との接続。
- 独立評価者による制約判定。
- 関係$\mathbf n_t$と正当性$\boldsymbol\ell_t$について、受け手、主張、根拠、反証、期限、効果方向を分けた評価者再現性。
- 前向き予測台帳と較正。
- 潜在能力$\mathbf c_t$のposterior summary $\widehat{\mathbf c}_t$を因果効果と呼べる識別ゲート。
- 同一イベントの尤度を一度だけ使う信念更新規則。
- 単独PJに外生配分したquotaと、ポートフォリオ共同制約の分離。

このゲートが閉じるまで、OS上の現行SPS、BZM 2.1の動的正味PJ価値、BZM 2.2の未実装出力を同じ数値として表示しない。

---

## 16. 一次文献とBZM 2.2の追加範囲

| 文献 | 文献が支える範囲 | BZM 2.2で追加する範囲 |
|---|---|---|
| Hsu and Schwartz（2003） | R&D支出を控除しながら、残費用、品質学習、完成時間、続行と放棄を状態更新へ入れる | SUの資金、統治、関係、権利、複数行動を同じ状態契約へ接続する |
| Pindyck（1993） | 投資支出が残完成費用を減らし、技術的な費用不確実性を段階的に解く動学 | 支出が能力、関係、権利、行動集合へ与える効果を明示する |
| Penrose（1959） | 資源と、経営の下で資源が生む生産的サービスを分ける | 資源在庫$\mathbf r$と変換能力$\mathbf c$を状態として分離する |
| Teece, Pisano and Shuen（1997） | asset positionsと、統合、構築、再構成するdynamic capabilitiesを分ける | 能力を行動条件付き遷移へ接続し、観測契約を置く |
| Brush, Greene and Hart（2001） | 新規事業の資源を六類型へ整理するが、その必要十分性またはMECE性を立証していない | 固定六分類を必要十分またはMECEな状態座標とせず、抽出監査タグへ限定する |
| Hunt and Morgan（1995） | financial、physical、legal、human、organizational、informational、relationalという別の資源分類を示す | 普遍的な唯一分類がないことを前提に、イベントから状態効果へ写像する |
| Kreps（1979） | 将来の嗜好が不確かな条件の下で、より広い機会集合を好む柔軟性選好の表現 | 選択肢数を加点せず、登録済み行動集合と共通故障点を管理する |
| Aubin（1991） | 制約内に留まりながら目標へ届くviabilityとcapture basin | 目標到達経路の頑健性をSUの戦略余力として運用する |
| Nohria and Gulati（1996） | 組織slackが少なすぎても多すぎても革新を損ないうる関係 | 余力最大化を目的にせず、進捗への変換と併記する |
| Sirmon, Hitt and Ireland（2007） | 資源の保有と、構成、束ね、活用する管理過程を分ける | PJ行動と共有資源の実行契約へ落とす |
| Sarasvathy（2001）とBaker and Nelson（2005） | 起業家が所与の選択肢から選ぶだけでなく、手元資源から目的と行動を形成しうること | 登録済み行動の外を探す探索行動を制御集合へ置く |
| Ocasio（1997） | 組織の行動が、意思決定者の注意の配分と構造に左右されること | 経営陣の注意を共有資源として行動束とポートフォリオ制約へ置く |
| Baum, Calabrese and Silverman（2000） | 新規事業の提携ネットワークの構成が成果と関連すること | 相手方の社数ではなく、役割、補完性、依存、共通故障点を関係状態へ置く |
| Suchman（1995）とZimmerman and Zeitz（2002） | 正当性が、複数の受け手との関係と資源獲得に関わること | 顧客、投資家、行政、規制当局、大学ごとの受容状態を分ける |
| Garg（2013） | venture boardの監督が、成熟企業とは異なる統治問題を持つこと | controller、留保事項、同意、実行権限を行動別制約へ置く |
| Kerr（1975） | 望む行動と、実際に報酬される指標がずれる危険 | 戦略余力を単独KPI、報酬、順位、配分条件にしない |

Nohria and Gulatiの実証対象は二つの多国籍企業に属する264の機能部門であり、ディープテックSUに普遍的な最適余力量を示したものではない。

どの文献も、BZM 2.2の状態八層、戦略余力の表示、動的正味PJ価値との統合を完成形として与えてはいない。

2.2は、既存理論の範囲を明記した上で、Before Zeroの実務へ接続する設計仮説である。

### 参考文献

- [Hsu and Schwartz, 2003, A Model of R&D Valuation and the Design of Research Incentives](https://www.nber.org/papers/w10041)
- [Pindyck, 1993, Investments of Uncertain Cost](https://www.nber.org/papers/w4175)
- [Penrose, 1959, The Theory of the Growth of the Firm](https://academic.oup.com/book/25306)
- [Teece, Pisano and Shuen, 1997, Dynamic Capabilities and Strategic Management](https://sms.onlinelibrary.wiley.com/doi/10.1002/%28SICI%291097-0266%28199708%2918%3A7%3C509%3A%3AAID-SMJ882%3E3.0.CO%3B2-Z)
- [Brush, Greene and Hart, 2001, From Initial Idea to Unique Advantage: The Entrepreneurial Challenge of Constructing a Resource Base](https://journals.aom.org/doi/10.5465/AME.2001.4251394)
- [Hunt and Morgan, 1995, The Comparative Advantage Theory of Competition](https://journals.sagepub.com/doi/10.1177/002224299505900201)
- [Kreps, 1979, A Representation Theorem for Preference for Flexibility](https://www.gsb.stanford.edu/faculty-research/publications/representation-theorem-preference-flexibility)
- [Aubin, 1991, Viability Theory](https://link.springer.com/book/10.1007/978-0-8176-4910-4)
- [Nohria and Gulati, 1996, Is Slack Good or Bad for Innovation?](https://journals.aom.org/doi/10.5465/256998)
- [Sirmon, Hitt and Ireland, 2007, Managing Firm Resources in Dynamic Environments to Create Value](https://journals.aom.org/doi/10.5465/amr.2007.23466005)
- [Sarasvathy, 2001, Causation and Effectuation: Toward a Theoretical Shift from Economic Inevitability to Entrepreneurial Contingency](https://journals.aom.org/doi/10.5465/amr.2001.4378020)
- [Baker and Nelson, 2005, Creating Something from Nothing: Resource Construction through Entrepreneurial Bricolage](https://journals.sagepub.com/doi/10.2189/asqu.2005.50.3.329)
- [Ocasio, 1997, Towards an Attention-Based View of the Firm](https://sms.onlinelibrary.wiley.com/doi/10.1002/%28SICI%291097-0266%28199707%2918%3A1%2B%3C187%3A%3AAID-SMJ936%3E3.0.CO%3B2-K)
- [Baum, Calabrese and Silverman, 2000, Don't Go It Alone: Alliance Network Composition and Startups' Performance in Canadian Biotechnology](https://sms.onlinelibrary.wiley.com/doi/10.1002/%28SICI%291097-0266%28200003%2921%3A3%3C267%3A%3AAID-SMJ89%3E3.0.CO%3B2-8)
- [Suchman, 1995, Managing Legitimacy: Strategic and Institutional Approaches](https://journals.aom.org/doi/10.5465/amr.1995.9508080331)
- [Zimmerman and Zeitz, 2002, Beyond Survival: Achieving New Venture Growth by Building Legitimacy](https://journals.aom.org/doi/10.5465/amr.2002.7389921)
- [Garg, 2013, Venture Boards: Distinctive Monitoring and Implications for Firm Performance](https://journals.aom.org/doi/10.5465/amr.2010.0193)
- [Kerr, 1975, On the Folly of Rewarding A, While Hoping for B](https://journals.aom.org/doi/abs/10.5465/255378)

---

## 17. 章末の問い

1. 直近三か月の最大支出は、どの状態を変え、どの行動を新しく可能にしたか。
2. 現在のPJで、同じ共通故障点へ依存していない目標到達方針はいくつあるか。
3. 現金が増えていても失われつつある制約は何か。
4. いま最も細い制約は、資源、能力、権利、関係、期限のどれか。
5. その制約が違反へ達する前に、どの行動で状態を変えられるか。
6. 余力を温存することが、進捗を遅らせていないか。
7. 登録済み行動の外に、新しい手を発見するための行動があるか。

---

## 関連章

- [BZM 1.0から2.2への進化](./bzm-1-0-to-2-1-evolution-guide)：各版で何が動的になったか。
- [BZM 2.1 — 動的な事業価値モデル](./bzm-2-1-dynamic-business-value-model)：2.2の状態と遷移を受ける価値評価層。
- [到達見込みモデル](./sps-2-0-reachability-model)：固定方針下の$T_C$と旧$T_Y$の履歴版。
- [戦略余力 — 主導権を保って走り切る](./strategic-slack)：固定五成分で説明した旧入門章。
- [測定可能性ゲート](./sps-2-0-measurability-gate)：数字を出してよい条件。
