# AMD Score 実装仕様

SXの設立前月次表示では、個別の売上・売上原価・粗利・人件費・研究開発費・マーケ費・その他販管費・営業利益をNewCo P/Lへ表示しない。費用入力は正の「設立前PJ支出」へ集約し、設立月以後だけNewCo P/Lを表示する。

> **この章は何か**: AMD Score の PWA 実装、DB、route、計算境界の確定仕様。理論導出は `/bzm`、詳細履歴は `pwa/design/amd_score.md` にも残す。

> **2026-07-29 主張境界**: この章が確定するのは現行PWAの計算・表示契約であり、SPSの予測妥当性または因果妥当性ではない。現行SPSは9軸の診断指数で、企業価値、期待事業価値、成功確率、生存確率を表す検証済みモデルではない。点数差・点数比と`alpha`を経済的な間隔または弾力性として解釈しない。SPS順位とbottleneckだけでGO、NO_GO、投資額、投入人月を決めない。BZM 2.0の改訂要件は [`BZM_2_0_REVISION_REQUIREMENTS.md`](../bzm/BZM_2_0_REVISION_REQUIREMENTS.md) を参照する。

## 定義

スコア詳細の画面上の最上段は「BZM 2.2」とする。`public.sps_primary_model_registry`は現行運用SPS内の`legacy_sps / sps_2_1`切替だけをPJごとに固定し、BZM 2.2の表示順序は切り替えない。現行SPS / BZM 2.1、BZM 2.0、SPS 1.0 / Legacy AMDは画面最下部の独立したアーカイブとし、すべて初期状態を閉じる。アーカイブ内の重いchildは初回openまでmountせず、閉じた`details`内で先読みしない。

> **呼称の正本 (2026-07-11 まさ確定、[`pwa/bzm/terminology_glossary.md`](../bzm/terminology_glossary.md) §1.5)**: 旧称 PRS は廃止済み。SPS は和名「シーズ有望度」の略であって成分の頭字ではないため、4因子化しても名称は壊れず、MPRS への改称は不要 (まさ再確認 2026-07-16)。コード変数 (`calculatePrsScore` / `PrsComponentBreakdown` 等)・DB 列 (`prs_potential` / `prs_r_net`)・テストコマンド (`test:prs-mprs-grouping`) は内部識別子として据え置き、**表示テキスト・文書の呼称のみ SPS を使う**。アーカイブ・過去ログ内の「PRS」は「= 現 SPS」と読む。

> **2026-07-16 まさ確定 — σ_SU を S から分離、M·P·R·S 4因子へ**: 旧 S = σ_SU × FRL × R_net から σ_SU を独立項 M へ格上げし、S を自走力 (FRL × R_net) に純化した。「この会社は死なないか (予測、環境込み)」と「この会社は自走できるか (診断、内部要因のみ)」の二問が S に同居していたのを解消するため。フラット Cobb-Douglas の結合則により**総合スコア数値・α・K・履歴データは完全不変**。変わるのは breakdown のグルーピング・表示ラベル・律速診断の読みだけ。決定の正本は `/Users/masa/projects/AMD/BZSF/before_zero_theory.md` の「2026-07-16 セッション」節。数値不変の回帰テスト: `npm run test:prs-mprs-grouping` ([`scripts/check_prs_mprs_grouping.mts`](../scripts/check_prs_mprs_grouping.mts))。

$$
\mathrm{Score}_{\mathrm{SPS}} = K_{\mathrm{SPS}} \cdot M \cdot P \cdot R \cdot S
$$

$$
M = (\sigma_{\mathrm{SU}} + 1)^{\alpha_\sigma}
$$

$$
P = (P_{\mathrm{input}} + 1)^{\alpha_P}
$$

$$
R = \prod_{x \in \{\mathrm{TRL},\mathrm{BRL},\mathrm{GRL},\mathrm{SRL},\mathrm{HRL}\}} (x + 1)^{\alpha_x}
$$

$$
S = (\mathrm{FRL} + 1)^{\alpha_F} \cdot (R_{\mathrm{net}} + 1)^{\alpha_{R_{\mathrm{net}}}}
$$

$$
K_{\mathrm{SPS}} = \frac{100{,}000}{10^{\sum_{x \in \mathcal{A}_{\mathrm{SPS}}}\alpha_x}}
$$

where:

$$
\mathcal{A}_{\mathrm{SPS}} = \{P,\mathrm{TRL},\mathrm{BRL},\mathrm{GRL},\mathrm{SRL},\mathrm{HRL},\sigma_{\mathrm{SU}},\mathrm{FRL},R_{\mathrm{net}}\}
$$

軸集合 $\mathcal{A}_{\mathrm{SPS}}$・α・K は再グルーピング前と同一 (= スコア数値不変の機械的裏付け)。

`P` / `R_net` が未入力の場合は `status='missing'` / review pending とし、0点に丸めたり legacy AMD を primary として代替表示したりしない。

### Conceptual meaning of K / M / P / R / S

SPS (M·P·R·S) は「追い風が吹いているか」「大きくなりうるか」「届く準備があるか」「自走できるか」を別々の必要条件として扱うモデル。各要素は足し算の部分点ではなく、PJ / SU が立ち上がるために同時に必要なレバーとして読む。

| 記号 | 意味 | ざっくり解釈 | 主な入力 |
|---|---|---|---|
| `K_SPS` | Calibration constant | スコアの物差しを合わせるための倍率。全active axisが9点なら100,000になるように正規化する | alpha set / Shallow Tech mode |
| `M` | マクロ追い風 (Macrotrend) | いま、この分野に吹いている風。案件の属性ではなく時変の環境状態・タイミングの変数 | `sigma_SU` (Triple Helix: `mu_A` / `mu_I` / `mu_G`) |
| `P` | Potential | そもそも当たった時にどれくらい大きな事業・市場・社会インパクトになりうるか | `prs_potential` |
| `R` | Reach | そのポテンシャルへ到達するための会社側 readiness がどこまで揃っているか | TRL / BRL / GRL / SRL / HRL |
| `S` | 自走力 (Survival = FRL × R_net) | 外の資金がどれだけ止まっても、自分の力で走り続けられる体質があるか | final FRL / `R_net` |

積を取る理由は、SPS の4要素が代替可能な加点項目ではないため。Potential が大きくても Reach が弱ければ届かない。Macrotrend が吹いていても Survival (自走力) が低ければ「環境で延命しているだけ」になる。積にすると、どれか1つが弱い時に全体scoreも自然に抑えられ、4要素が同時に揃った時だけ大きく伸びる。

M と S を分けた効果は診断にある。旧構造では σ_SU の高さが自走力の欠如をマスクしていた (追い風型 PJ の S が高く出て「自走できていない」事実が見えなかった)。分離後は「M 高 × S 低 = 環境で延命、自走は未達」「M 低 × S 高 = 無風でも走れる体質」を別々に読める。M と P の分離基準は「案件の属性か、環境の状態か」— P はこの案件が当たったときの天井 (案件固有)、M はいまこの分野に吹いている風 (案件のものではない時変の環境)。

`K_SPS` はこの構造を壊さないための校正係数であり、事業価値そのものの入力ではない。`M` / `P` / `R` / `S` の相対構造を保ったまま、全軸9点の理想状態を `100,000` に合わせる。

## BZM 2.0観測台帳

PJコックピットのスコア詳細は、BZM 2.0観測画面を最下部の初期閉じアーカイブとして表示する。

二つのモデルは式、尺度、検証状態が異なるため、同じスコアとして合算または置換しない。

観測画面の式は、理論正本`pwa/bzm/sps-2-0-reachability-model.md`に従う。

$$
\mathrm{SPS}_{\mathrm{all},\tau}(H_{\mathrm{econ}})
=\sum_{o\in\mathcal O}q_{o,\tau}(H_{\mathrm{econ}})P_{o,\tau}(H_{\mathrm{econ}})
$$

$$
q_{\mathrm{plan},\tau}(H_v)
=\Pr\!\left(
T_C<T_Y,\quad T_C\le H_v
\mid \mathcal I_\tau
\right)
$$

$$
Q_\tau(h)
=\Pr\!\left(
T_C<T_Y,\quad T_C\le h
\mid \mathcal I_\tau
\right)
$$

トップでは、全価値実現経路の総和、共通経済評価地平までの資本自立経路全体、PJ固有の計画期限内経路を三段に分ける。
`q_plan`は計画達成診断、`q_G`は共通経済評価地平までの期限後到達を含む資本自立経路全体、`Q_h`は価値式へ掛けないPJ間比較用の共通期間曲線、`SPS_all`は相互排他的な全経路のモデル内確率加重持分価値である。
旧`q × P`は計画期限内の資本自立経路の寄与としてだけ残し、会社全体の期待時価総額とは表示しない。
非上場PJのモデル出力を市場で観測された時価総額と呼ばない。

経路価値を測定できた版は`value_json.schema='bzm2-path-equity-value-v0.2'`とし、`value_million_jpy`、`valuation_date`、`method`、`conditional_on`、`outcome_key`、`horizon_key`、`information_cutoff`、`currency='JPY'`を保存する。
全経路値を測定できた版は`value_json.schema='bzm2-all-path-value-v0.2'`とし、全PJ共通の`economic_horizon_months`と、各PJの情報締切から導いた`economic_horizon_date`を分けて保存する。
同じ日付を全PJへ置くことを共通期間とは呼ばない。
円建て評価入力が揃っていない版は、`value_status='missing'`、`value_json=null`とし、0へ変換しない。
到達前開発費、将来調達、希薄化、負債、税、残存価値を同じ評価日と通貨へそろえる。
評価方式はFCFFとWACC、FCFEと株主資本コスト、実確率と確率的割引因子、またはリスク中立確率と無リスク割引の一方式へ固定し、リスクを二重計上しない。
負債と非持分請求は企業価値から総持分価値への橋で扱い、清算優先、参加、転換、ストックオプション、希薄化は総持分価値内の証券クラス別配分で扱う。

2026-08-11に作った`P^(0)`と二成分指数`bzm2-potential-vector-v0.1`は撤回済みである。
値と根拠状態は履歴として残すが、円への換算規則が無いため、現行経路価値またはSPSへ使わない。

社会的要素は独立加点しない。
工程、時間、資金接続へ効くなら経路別`q_o`へ、売上、補助、公共調達、規制、費用へ効くなら将来キャッシュフローへ、投資家需要、要求収益率、評価倍率へ効くなら市場の価格づけへ接続する。
反映経路を支える証拠または事前に固定した推定規則が無ければ、説明変数として保存し、数値は動かさない。

全パラメータの抽出規則は`pwa/bzm/BZM_2_0_PARAMETER_EXTRACTION_REGISTER.md`を正本とする。
画面では13群の要約を折りたたみ表で表示する。

到達競争式の直下は、`Z`、`T_C`、`T_Y`、`H_v`、`H_econ`、`q_plan`、`Q_h`の現在の判定値を同じ表へ置く。`H_econ`は共通の経過月数とPJ別の対応日を表示する。式と現在値を別区画へ離さず、共通状態が時計と計画診断を条件づける構造を監査できるようにする。

`bzm_2_model_revisions`はPJ別の測定版を追記する。

`bzm_2_parameter_observations`は版ごとのパラメータ値、欠測、出所、影響先、条件を追記する。

`parameter_key`を行として持つため、`Z_policy`のような共通状態を列追加なしで登録できる。

| 項目 | 保存規則 |
|---|---|
| 版 | `project_id + revision_key`と`project_id + revision_order`を一意にする |
| 情報締切 | 版の締切を`information_cutoff`へ、コピーした観測自身の元締切を`condition_json.effective_information_cutoff`へ保存し、後の結果や定義改訂日で過去入力を書き換えない |
| 欠測 | `value_status=missing`または`not_started`、`value_json=null`とする。0へ変換しない |
| 出所 | 計算、文書、記録、ヒアリング、仮定、複合を区別し、欠測以外は`evidence_ref`を必須にする |
| 共通状態 | `affects`へ影響工程と時計を保存し、`condition_json`へ条件づけた入力を保存する |
| PJ文脈 | `parameter_group=context`へ現行状態、設立、AMD支援を保存する。共通状態の式へ混ぜず、過去予測へ遡及利用しない |
| 前向き検証 | `forward_validation_count`として版に保存し、計算済みと検証済みを分ける |

`Z_policy`は独立加点ではない。

LSTでは`#2=90%`と`#6=60%`を`Z_policy=present`へ条件づけ、`affects`に`#2`、`#6`、`T_C`、`T_Y`、`q_plan`を保存する。

反実仮想となる`Z_policy=absent`の工程入力は欠測なので、ロビイングの追加効果を計算しない。

APIの`/api/project/[projectId]/amd-score-detail`は、既存payloadへ`bzm2`を追加する。

`fetchBzm2Observatory()`は版と観測を取得し、パラメータごとに最新値と履歴を組み立てる。

`Bzm2ModelObservatory`は数式記号をLaTeXで組む。たとえば`T_C`という生文字列を表示せず、$T_C$として下付きを含めて描画する。トップは全経路、共通経済評価地平までの資本自立、計画期限内の資本自立を三段に分け、現在値と欠測理由を直下へ置く。確率値はパーセントで表示し、`95%CI`という略語ではなく「95%信頼区間（計算上のぶれ）」を併記する。数値は本文書体の`tabular-nums`で揃え、等幅書体は版IDや内部キーだけに限る。共通状態、時計、入力、資金、品質の台帳は、記号と変数名、現在値、測定状態・出所、反映先、履歴を同じ圧縮表へ並べる。各行の詳細で説明、出所参照、版別の観測自身の情報締切を確認する。$q_{\mathrm{plan}}$の版推移と全パラメータの抽出規則は初期状態で閉じ、必要なときだけ開く。

台帳が未適用または取得不能でも既存スコア詳細を失敗させず、BZM 2.0側だけを欠測表示にする。

初期データは、撤回済みSX v0.1を除外し、SX v0.2からv0.5とLST v0.1事前登録を投入する。

SXとLST以外で現行SPSを持つ10PJは`measurement_status=data_collection`でv0.1を作り、2026-08-10の情報締切までに構造化DBから確認できたPJ文脈、政策支援、現行SPS入力、証拠被覆、資金調達履歴を凍結する。

`data_collection`は計算前の観測収集中を表す。依存グラフ、時間分布、現在現金、バーン、計画期限が未接続なら、記録数が多くても`parameter_key=q`、すなわち$q_{\mathrm{plan},\tau}(H_v)$は欠測のままにする。

現行SPS入力は`quality.current_sps_input`として保持する。`prs_potential`をBZM 2.0の円建て経路価値へ、XRLを条件付き確率へ自動変換しない。撤回済みの`P^(0)`と二成分指数は履歴にだけ残し、現行値へ暗黙に流用しない。

資金調達ラウンドの既知合計は`cash.funding_history`として保持するが、`C_0`または`T_Y`へ読み替えない。

現行PJ状態は`context.lifecycle`として保持し、予測時点より後の結果を過去入力へ混入させない。

初期データの投入は既存の一次資料と構造化DBを画面用台帳へ写す処理であり、新しい確率の推定ではない。

この画面は読み取り専用である。

パラメータの更新は、凍結入力または事前登録の新しい版を作り、同じ版の観測行を追加する処理として行う。

## BZM 2.1動的方針台帳

PJコックピットのスコア詳細は、`sps_primary_model_registry`を読んで、下段の「現行SPS / BZM 2.1」内の運用モデルを決める。

`switch_status=active`かつ`primary_model=sps_2_1`なら、その下段アーカイブ内でBZM 2.1を現行運用モデルとする。画面上段のBZM 2.2より上には出さない。

未登録、取得不能、`preparing`、`rolled_back`ではlegacyを主表示に保ち、BZM 2.1をpreviewへ置く。

BZM 2.1は、BZM 2.0の固定方針を消さず、判断ノードごとの行動が次状態、経路別費用、正味価値、到達見込みをどう変えるかを同じ有限グラフ上で評価する。
理論・数式の正本は`pwa/bzm/bzm-2-1-dynamic-business-value-model.md`、入力抽出契約は`pwa/bzm/BZM_2_1_PARAMETER_EXTRACTION_REGISTER.md`とする。

固定方針は`fixed_baseline`、事前登録して閉じた行動集合内で選んだ方針は内部キー`optimized`として保存する。
画面では後者を「選択方針」と表示し、開かれた選択肢世界におけるPJ全体の最適方針とは呼ばない。

選択は、各判断状態で権限を持つ単一の意思決定主体と、その主体に事前登録した目的だけで一度行う。
会社、BZSF、公的支援者がそれぞれ別の行動を選んだ三本の方針として扱わず、選ばれた同じ方針を三視点で別評価する。
共同権限、相手方同意、公的目的の換算規則が閉じない場合は選択方針を計算しない。

三視点の価値範囲は次のとおり分離する。

| 視点 | 現行の価値範囲 | 混ぜないもの |
|---|---|---|
| 会社 | 会社が保有するPJの方針条件付き将来正味価値。増分は固定方針との差だけに使い、営業・投資キャッシュフローと資金調達キャッシュフローを分ける | 市場で観測された時価総額、BZSF証券価値 |
| BZSF | 対象証券からBZSFへ帰属する正味キャッシュフロー | 会社への資金流入そのもの、他PJの機会費用を含むポートフォリオ配分 |
| 公的 | 基金の財政価値と、換算規則を登録した社会厚生 | 補助金・税・公共調達の社会全体と基金内での二重計上 |

公的視点は、法的使命、財政境界、社会便益の換算、集約規則の四参照が閉じた場合だけ単一額へ進める。

単一CF台帳は、基金財政の符号つき金額、社会便益の成分ベクトル、成分ごとの換算額、集約額を分けて保存する。
最小版の集約規則は、基金財政と換算済み社会便益の加算だけであり、入力hashと算術一致をDB、read model、adapterで検査する。
会社、BZSF、基金の間の移転は、同じ経済事象キーを持つ視点別legとして反対符号を保存し、同じ入出金を各視点で同符号へ重複計上しない。

ただし最小エンジンv0.1は、経路全体について基金財政と社会便益を別々に後退集計する処理をまだ持たない。
そのため実PJの公的な行動価値と方針価値は`not_computable`に保つ。
別視点の権限主体が選んだ同一方針と、その方針から得た物理的な到達見込みは公的行にも保持し、計算不能な公的価値だけをNULLにする。

`expected_net_value`は各方針の絶対的な動的正味価値である。
`conditional_goal_net_value`は、同じ方針の下で資本自立へ初到達した経路だけに条件づけ、到達までの即時費用・便益・遷移キャッシュフローを一度ずつ含めた正味価値である。
終端価値だけ、または成功時売上だけを条件付き価値として保存しない。
`value_difference_from_baseline`は同じ視点で選択方針から固定方針を引いた差であり、他視点では負になり得る。
`controller_option_value`は、意思決定主体自身の登録目的についてだけ定義する柔軟性価値である。
三つを同じ「オプション価値」と呼ばず、BZM 2.0の全経路値へ足し戻さない。

行動は`continue`、`wait`、`retry`、`pivot`、`scale_down`、`scale_up`、`license`、`abandon`の8種類を基本部品とする。
実際の選択単位は複数部品、資金調達・交渉などの追加部品、順序、共有資源を持つ行動束である。
存在しない行動は`unavailable`、存在可能性または実行条件が未確認の行動は`unknown`とし、どちらも価値0へ変換しない。

各行動束は、実行権限、必要な社内承認、相手方同意、知財・契約条件、資金・人員・設備の実行可能性を持つ。
未契約の資金調達、交渉中のライセンス、未確認の大学承認を成立済みの行動として扱わない。
待機は、得られる情報と同時に燃焼、時間、顧客信用、競争機会の損失を入力し、情報が増えず費用だけ正の待機を自動的な価値として加えない。

物理遷移確率は到達見込みだけに使い、価値評価の割引・価格づけ規則と分ける。
最小エンジンv0.1が実装する価値評価は、物理遷移確率と視点別の明示的な決定論的割引率の組だけである。
確率的割引因子またはリスク中立確率を登録して同じ算術を流用せず、その方式は未実装として計算を止める。
支援策は到達見込みへ直接加点せず、行動費用、必要資金、実行可能集合、遷移、終端価値のどこを変えるかを保存する。
最小エンジンv0.1が計算へ反映するのは費用、必要資金、遷移確率、終端価値までであり、支援による行動集合、所要時間、到達時計、情報獲得の変更は未実装として計算を止める。
支援ありとなしの差は、識別条件を満たすまで「モデル内シナリオ差」と表示し、因果効果とは呼ばない。

### 計算・表示状態

| 状態 | 意味 | 表示できる範囲 |
|---|---|---|
| `not_computable` | 必須入力、権限、遷移、価値規則のいずれかが欠測 | 欠測項目と停止理由だけ |
| `partial` | 個別行動または測定済み行動集合の一部は計算可能 | 「測定済み行動内」と明記した部分値 |
| `decision_indeterminate` | 同率、近接、入力不確実性で選択が安定しない | 競合方針と値・到達見込みの範囲 |
| `computed` | 閉じた行動集合、完全方針、単一権限主体、価値規則、全必須入力が同版で閉じた | その登録範囲内の選択方針と三視点評価 |

個別行動の値が閉じても、行動被覆が閉じなければPJ全体の選択方針、固定方針との差、PJ間比較へ進めない。
固定方針が到達可能な全状態の行動を定めていなければ、BZM 2.0の到達診断は履歴として残せても、動的正味価値との同条件比較は行わない。

### 保存・API・初期状態

migration 261はBZM 2.0の表を変更せず、BZM 2.1専用の追記台帳を追加する。
版、状態、行動束、遷移、支援条件、スコープ付き入力、行動評価、方針評価を別表に置き、各観測へ根拠、情報締切、欠測状態を保存する。

版ごとの共通入力27項目は、存在、状態、値、根拠を計算前と読出時の両方で検査する。
版列または保存済み評価だけを直接埋めて入力台帳を迂回できない。

版、27入力、状態、行動、遷移、支援、単一CFを正規化したcanonical model hashを生成する。
行動評価と方針評価は同じhashと情報締切を持つ場合だけ表示し、入力更新後の古い計算結果は無効化する。
実PJ版では合成根拠を禁止し、すべての根拠時点、外貨換算日、評価時点が版の情報締切を越えないことを検査する。
台帳が無効または取得不能なら、保存済み数値を警告つきで残さず、計算値そのものを抑止する。

APIの`/api/project/[projectId]/amd-score-detail`は、既存の`bzm2`と現行SPS payloadを維持したまま`bzm21`を追加する。
BZM 2.1台帳が未適用または取得不能でも既存スコア詳細を失敗させず、BZM 2.1だけを取得不能・計算不能として表示する。

初版は現行のSPS対象12PJへ`measurement_status=incomplete`の空版を追加する。

migration 262は旧SPS入力、改訂、BZM 2.0履歴、旧alphaをPJ別のappend-only snapshotへ退避し、元表を変更しない。

migration 263は共通推定器`estimated-v0.1`の入力、状態、二行動、三遷移、単一CF、行動評価、方針評価を12PJへ追記する。

12PJすべての会社選択方針が`computed`、BZSFと公的価値が`not_computable`、入力hash、scope入力、archive hashが閉じた場合だけ、一つのtransactionでregistryを12件とも`active`へ切り替える。

実PJの判断ノード、行動別遷移、費用、撤退価値を観測で閉じたわけではない。

`estimated-v0.1`は合成fixtureではなく生データ抽出と共通推定器のshadow版だが、平均推定率97.4%のため測定済み価値として扱わない。

SXのBZM 2.0固定方針下の計画達成診断4.15%は消さず、BZM 2.1の動的正味価値へ自動転記しない。
前向き検証は0件のため、GO、NO_GO、投資額、支援採択の自動推薦に使わない。

## BZM 2.2全PJprovisional pilot

`pwa/bzm/pilot/bzm-2-2-all-pj-provisional-v0-1.json`は、12 PJの103パラメータへ欠測推定を入れたrepo内のshadow artifactである。

状態は`provisional-pilot-v0.1 / unvalidated`、前向き検証は0件とする。

このartifactのPJ別compact projectionは、read-only API `/api/project/[projectId]/bzm-2-2-pilot`を通じてPJコックピットのスコア詳細へ接続する。payloadは`{ pilot: Bzm22PilotProject }`とし、該当PJがartifact未登録ならBZM 2.2区画だけに明示的な未登録状態を返す。DB、監査JSONの正本、生成スクリプト、`sps_primary_model_registry`は書き換えない。

`Bzm22ProvisionalObservatory`を`data-testid="bzm22-provisional-primary"`の最上段に置き、見出しは「BZM 2.2」とする。要約は慎重・基準・強気の3ケースについて、$J$「全分岐込み現在価値」、$P$「全条件通過時の現在価値」、$Q$「基準到達指数」、$S$「逆風耐久指数」を分離する。$P_{r\mid G}^{\pi_{\mathrm{reg}}}$は登録中の進め方を固定した全gate通過条件の割引現在価値であり、最良方針を選ぶ値ではない。$J_r^{\pi_{\mathrm{reg}}}$は同じ方針の継続、全gate通過、各gate失敗を重みづけした割引現在価値である。一般に$J\neq QP$であり、$J$へ$QP$を足したり、$P$の全経路CFへ再び$Q$を一律に掛けたりしない。4指標は一文字、数値、数式、肯定形の一文を同じカードへ置き、内部keyの`proxy`表記をカード名へ出さない。金額表示は`¥4,010M`形式とし、百万JPY単位の値を整数へ四捨五入して表示する。artifact/APIの数値精度は変更しない。

PJ別projectionは、103項目をそのまま計算器にせず、正規化した`calculationTrace`を持つ。入力は経済計算地平$H$、割引率$r_d$、月次経済CF $CF_t$、gate別の判定月$t_i$・条件付き通過値$p_i$・符号付き停止時価値$RV_i$、終端価値$TV$、stress補正$m_{i\delta}$である。出力は$Q$、月ごとの経路継続重み$W_t$、経路加重CF現在価値、終端現在価値、成功寄与、gate別停止寄与、$P$、$J$、$S$とする。$W_t$を意思決定状態$\mathbf s_t$と混同しない。全12 PJ×慎重・基準・強気について、このDTOからの再計算とartifactを機械照合する。

UIはTOP式に現れる26記号のmanifestを持ち、孤立記号を許さない。$a,H,r_d,t,\mathcal T,CF_t,d_t,d_H,i,G,t_i,d_{t_i},p_i,W_t,W_{t_i^-},1-p_i,W_{t_i^-}(1-p_i),RV_i,TV,\delta,\Delta_{\mathrm{reg}},m_{i\delta},Q,S,P,J$を、固定方針、入力、集合・番号、計算途中、出力のいずれかへ分類する。各記号は日本語名と選択中scenarioの実値を持つ。$G$と$\Delta_{\mathrm{reg}}$は全構成員、$CF_t,d_t,W_t$は全$H$月、$m_{i\delta}$は全行列を展開する。$J$の停止脚は$d_{t_i}W_{t_i^-}(1-p_i)RV_i$とし、$d_i$や$s_t$を使わない。整数丸めした代入表示は厳密等号でなく`≈`を使い、検査は丸め前の値で行う。

画面は各ケースについて、$Q$をgate別の実値の積、$S$をstress別積の最小値、$P$を全gate通過経路のCF現在価値と終端現在価値の和、$J$を生存加重CF現在価値・成功寄与・停止寄与の和として実数代入する。各指標は記号式と実数代入を別領域へ分離せず、各項の式、日本語名、代入値、項の集計値を一つの`AnnotatedFormula`内の一段セルへ置く。意味を持たない縦の接続線と二段カードは置かない。項は数式順の横列とし、必要な幅だけ代入ボード内部を横スクロールする。各gateは日本語名、判定月、条件付き通過値、直前までの累積生存、当該gateで止まる分岐重み、符号付き停止時価値を同じ行へ置く。

四指標と式の下に「実行可能性と経営判断」を置く。artifactへ凍結済み計算結果がある登録方針と未登録shadow比較案だけをselectorへ出し、同じscenarioの$J/P/Q/S$を切り替える。未登録案を登録済み、将来判断候補、実行推奨へ昇格させない。登録方針のgate判定月だけはブラウザ内で変更でき、$p_i/CF_t/TV/m_{i\delta}$を固定して、月ごとの生存重み、停止時価値の割引、$J$だけを再計算する。$Q/S/P$は不変とし、工場、資金、経営判断の一般日付入力は因果写像がないため表示しない。保存、承認、DB書込み、URL永続化は行わない。

続く`Bzm22TimeLedger`は、評価月M0から$H$月までの`H+1`列を一つの時間軸として作る。登録方針は地平全体の帯、事業・技術・設備・資金イベントは月の点と上下の注記として置く。gateイベントは`calculationTrace.inputs.gates[].month`と同じ列へ置き、ブラウザ内でgate月を変えた場合は点も同じ列へ移動する。イベントカードは副説明を表示せず、同月の全タイトルを省略しない。gate月から意思決定を生成せず、条件付き資金を着金または確約として表示しない。desktopとmobileは同じ横長面を使い、mobileだけ縦カードへ置き換えない。

時間軸の直下に`project_pl_monthly`の月次PLを同じ列幅で表示する。売上、売上原価、粗利、人件費、研究開発費、マーケ費、その他販管費、営業利益を持ち、入力行は月セルから編集する。編集面は表の下へ追加せずBase UIの中央モーダルで開き、保存後に元の月列へ戻る。SX（p21）は2027-02を会社設立月として、全月に「設立前PJ / NewCo」の計上主体行と縦境界を置く。設立前の`project_pl_monthly`はNewCo P/LではなくPJ計画収支として表示する。同じ列へNewCoの営業C/F、設備投資、株式調達、融資実行、助成金等入金、月次純C/F、月初・月末資金残高を続けるが、C/Fは設立月から開始する。設立時残高が未確認なら月初・月末残高は0円へ推定せず算定不能とする。設備投資は現行年次計画のFY4月、株式調達はactive資本政策のイベント月、助成金は受領月未確認の低精度計画としてFY4月へ置き、融資未登録は0円でなく未計画とする。PSI Step 2の6,000万円は設立前PJ資金であり、NewCo C/Fと現金残高へ算入しない。`calculationTrace.inputs.cashFlow.monthlyEconomicCFMillionJpy.base`はM1からM$H$の「BZM経済CF」行として別表示する。`project_pl_monthly`と資金繰りC/FとBZM経済CFは自動同一視せず、$J/P$への直接接続は最後のBZM経済CFだけとする。SXの初回backfillはコックピット年次PLを金額正本、旧月次表を発生タイミングの配賦キーとして使い、各行notesに計画/推定の状態を残す。資本調達・補助金cash・CAPEXをPL売上へ混ぜない。コックピットヘッダーとHUDの`CockpitPlMonthlyModal`導線は削除し、つくよみヒアリングと月次PL編集を同区画へ置く。試算表は表の外に`単位：百万円`を1回だけ置き、セル値へ`M`や`¥`を繰り返さない。月・金額は右寄せ、等幅数字、表示11pxとし、DB円額とartifactの百万JPY値は丸めない。

score-detail全体は`data-density="compact-score-page"`、BZM 2.2本体は`data-density="compact-score"`、月次表は`data-density="compact-ledger"`を密度契約とする。用途を説明できない固定高さを禁止し、外周余白、section間gap、指標カード、数式box、シミュレーター、監査台帳、イベント時間軸、月次行の縦paddingを4px基準で圧縮する。月次表は固定見出し108px（`sm`以上172px）、月列76px、金額11px、通常行20px前後、イベント時間軸は上下2段・高さ101pxを契約値とする。右寄せと等幅数字を維持し、モーダル内の入力操作だけは40pxの操作高を確保する。月次表のC/F行から重複する「計画値」「残高は合計しない」を除き、残高を横合計しない意味と簡易C/Fの境界はsection説明に一度だけ置く。

SXの時間前提は、2027-02会社設立、設立前DD完了の必須ゲート、`project_meeting_summaries`から抽出する2027-03までの初回資金調達内部目標、`project_capital_plans.status=active`の初回株式イベントを同じ月軸へ置く。DD完了実績、会議の内部目標、active資本政策の計上月はいずれも契約・着金実績へ昇格しない。現BZM計算bundleが設立前DDを計算ゲートへ持たない間は前提監査未通過とし、J/P/Q/Sを資源配分またはPJ横比較へ使用しない。

`buildSxMonthlyFinanceComments()`は`buildSxMonthlyFinancePlan()`と同じ`SX_ANNUAL_PROJECTION`、`SX_BUSINESS_PLAN_PHASES`、active資本政策イベントから、設備投資・株式調達・助成金等入金・Phase 0非希薄化資金のセル注記を決定的に再現する。設備投資の注記は該当フェーズの技術レーンから小規模パイロット設備、量産実証工場、本格自社工場建設を選び、FY4月仮置きであることを明示する。調達注記はイベント名、金額、月、計画であって契約・入金実績ではないことを示す。助成金計画は制度名・受領月未確認を残す。`project_grants`の採択名、機関、採択額、採択日、受領実績は別の観測注記として、助成金行の評価地平内最初の対象月へ表示し、受領未確認ならcashへ算入しない。フェーズ開始月は営業利益セルへフェーズ期間・予算・opening round・推定配賦を注記する。注記セルは`◆`と淡色背景を持ち、Base UI tooltip portalを使ってoverflow面の外へもマウスオーバー／focusで表示する。

進捗管理タブを含む`CockpitVentureStatus`の主スコアは`Bzm22CockpitSummary`へ切り替え、同じ$J/P/Q/S$と数式を表示する。desktopの主表示は、左に4指標を縦に並べた値レール、右にXRLグラフを置く一体レイアウトとし、両者を上下に積んで余白を増やさない。XRLは右ペインの`ResizeObserver`実測幅・高さをSVG座標系へ使い、固定880×220のaspect比へ押し込めない。mobileは縦に積み、XRLの600px横長面だけを内部スクロールする。summary取得は既存member-only APIへ`?view=summary`を付け、103項目を初期表示へ同梱しない。スコア詳細では従来SPSを主スコア直下へ展開せず、ページ最下部の`旧SPS履歴 / Legacy AMD`アーカイブへ集約する。XRLは常時表示する。

パラメータ表示は三層に分ける。第一層「全パラメータ」は上記26項目を、種別・日本語名・記号・選択中ケースの値を持つ高密度表で表示する。第二層「実行可能性と経営判断」は状態、遷移、共有資源、権限、同意、行動束、資金制約、情報獲得を表示する。第三層「根拠・再現・監査」は7群の103項目を全件収載するが、初期状態を閉じる。登録値を件数だけのプレースホルダーへ潰さず、PJ名、制度名、金額、時期、確度、制約、技術・資金状態を日本語で具体表示する。SXでは少なくともPSI GAPファンド Step 2採択、VC DD、共同開発、期首自由資金、資金調達なしの資金不足月をprojectionの登録値から表示し、制度名をNEDO STS等へ読み替えない。モデルID、日付、通貨、各種ID、根拠資料、hash、税、換算、重複防止、現版未使用項目を第一層へ混ぜない。

`npm run check:bzm-2-2-all-pj-pilot`は、12 PJ×103パラメータ、型、由来、scenario別計算入力、cash cliff、禁止用途とartifact整合を検査する。

この検査の成功は、予測妥当性または構成概念妥当性を意味しない。

### 指標名と方針状態

gate積は`q_gate_product_proxy`、登録stress別gate積の最小値は`q_stress_proxy`として保存する。

UIでは前者を$Q$「基準到達指数」、後者を$S$「逆風耐久指数」と短縮する。$S$は戦略余力全体を表す単一尺度ではない。

条件付き確率としての校正とgate間依存を閉じていないため、`q`、`q_plan`、`q_robust`、$q_{\mathrm{rob}}^{-}$という名前で保存または表示しない。

現在方針は`shadow_only`の登録制御である。

確認済み実行可能、選択方針、最適方針のstatusを付けない。

既存の固定方針$\pi_0$を測定していないPJでは$q_{\mathrm{plan}}^{\pi_0}$を`not_applicable`にし、shadow現在方針の代理値で補完しない。

### cash cliffと資金

無資金月次残高が初めて不足する月をcash cliffとする。

既存のPJ gate月はcash cliffへ前倒ししない。

別の`full_horizon_liquidity_package_proxy_before_first_cliff`を初回cliff月の月初に置き、評価期間中の全補填期限を満たす資金枠または共同調達packageの低精度代理値を一度だけ掛ける。

同じ資金証拠を既存gateと二重に掛けず、重複する既存gateは非金融条件だけを残す。

金融・非金融を分離できない複合gateは、元確率を監査用に保持し、代理積では乗法単位元にする。これは非金融残余の成功確率を1と推定したものではなく、識別不能な残余を代理積から除外した処理である。

coverageは総額比でなく、補填期限ごとの利用可能capacityと累積必要額の比の最小値で検査する。日付なし資金はcapacityゼロとする。

代理gate失敗経路はcliff当月から停止し、以後の便益と終端価値を計上しない。

未確約資金は現金残高へ足さない。

資金調達入金は流動性と行動実行可能性へ接続し、会社PJの価値創造CFまたは$J$へ便益として加算しない。

希薄化、負債、証券別請求は持分評価層へ分ける。

legacy key `expected_cumulative_funding`には、無資金残高の最小補填必要額を経路生存で加重した値を置く。

このslotを資金受領期待額、コミット額、企業価値として読まない。

### 出力と用途の境界

$P$は成功条件付き価値、$J$は失敗を含む全経路の動的正味PJ価値、現行SPSは9軸診断指数である。

三つの出力は合算または相互変換しない。

低位、中央、高位は仮定束のscenarioであり、信頼区間ではない。

Gmail、Drive、Calendar、Slack、Notion、OS DBは、globalな本文取得、remote scope、thread再帰、権限範囲のいずれかが未完であるため、六つすべて`incomplete`とする。

未発見を不存在へ変換しない。

独立した経済学者役と経営学者役が指摘した、代理指標の誤称、cash cliff後の価値計上、$\pi_0$の偽装、実行可能性と最適性の過大表示、103パラメータと計算入力の不一致は、pilot checkerの停止条件へ入れる。

ただし、gateの条件付き確率としての妥当性、証拠間依存、状態遷移の因果識別、行動被覆、共有資源制約、前向き予測の較正は未検証である。

PJ間ランキング、撤退または継続の自動判断、投資判断、支援採択、資源配分へ使わない。

## Legacy AMD / M-X-F の位置づけ

legacy AMD / M-X-F では 7 軸を次の 3 要素で見せる。これは現行 primary score ではなく、SPS の R/S の根拠と比較用ブロックとして読む。

| 要素 | 意味 |
|---|---|
| M | Macrotrend / Triple Helix。`sigma_SU` |
| X | 会社に帰属する XRL。TRL / BRL / GRL / SRL / HRL |
| F | Founder / 経営チーム readiness。FRL |

FRL は XRL に飲み込まない。AMD Studio の哲学上、FRL と `sigma_SU` は独立した重要軸として扱う。旧計算式は巻末 Appendix に保存する。

## 実装ファイル

| file | 契約 |
|---|---|
| `pwa/src/lib/amd-score.ts` | SPS/legacy score 計算、alpha default、K、bottleneck、FRL CES |
| `pwa/src/lib/amd-score-derived.ts` | DB row から SPS primary と legacy comparison の derived score を作る |
| `pwa/src/lib/amd-score-data.ts` | `amd_score_inputs` / `amd_score_alpha` data access |
| `pwa/src/lib/bzm-2-observatory.ts` | BZM 2.0の必須記号、版、パラメータ履歴を組み立てる純粋契約 |
| `pwa/src/lib/bzm-2-observatory-data.ts` | BZM 2.0観測台帳のserver-side read。取得不能時は欠測payloadを返す |
| `pwa/src/components/cockpit/Bzm2ModelObservatory.tsx` | LaTeX数式、現在値、共通状態の影響先、初期折りたたみのq版推移、圧縮表のパラメータ台帳と行内履歴を表示 |
| `pwa/src/lib/bzm-2-2-pilot-ui.ts` / `bzm-2-2-pilot-ui.server.ts` | PJ別compact projectionの型と、12 PJの静的import map・schema/projectId/103件検査を持つread-only server loader |
| `pwa/src/generated/bzm-2-2-pilot/*.json` | 巨大artifactから生成したPJ別runtime projection。要約、選択・イベント時間軸、7群103パラメータを保持する |
| `pwa/src/app/api/project/[projectId]/bzm-2-2-pilot/route.ts` | PJ membershipを検査し、`{ pilot: Bzm22PilotProject }`をprivate/no-storeで返す。DB writeは行わない |
| `pwa/src/components/cockpit/Bzm22ProvisionalObservatory.tsx` | BZM 2.2のJ/P/Q/S、ブラウザ内の方針比較、選択・イベント時間軸、103項目の全パラメータ台帳を表示する |
| `pwa/src/lib/bzm-2-1-dynamic-policy.ts` | 単一意思決定主体の固定方針評価と閉じた行動集合内の選択、同じ方針の三視点再評価を行う純粋計算エンジン |
| `pwa/src/lib/bzm-2-1-policy-model.ts` | BZM 2.1の追記台帳を画面用の版・状態・行動・遷移・方針評価へ組み立てる純粋契約 |
| `pwa/src/lib/bzm-2-1-policy-model-data.ts` | BZM 2.1台帳のserver-side read。取得不能時はBZM 2.1だけを欠測payloadにする |
| `pwa/src/lib/bzm-2-1-policy-engine-adapter.ts` | BZM 2.1台帳の状態、行動、遷移、単一CF eventを計算エンジン入力へ変換し、欠測・符号・時点・親子関係の契約違反を計算前に止める |
| `pwa/src/components/cockpit/Bzm21DynamicPolicyObservatory.tsx` | 固定方針と選択方針、三視点の同一方針評価、欠測・停止理由、折りたたみ判断台帳を高密度表示 |
| `pwa/src/components/venture-map/AmdScoreView.tsx` | 下段のSPS 1.0 / Legacy AMDアーカイブで、9軸SPS、R_net、FRL、XRL evidenceとlegacy M-X-F comparisonを残す |
| `pwa/src/components/venture-map/AmdScoreList.tsx` | 一覧。SPS primary を主表示し、legacy AMD は比較列 |
| `pwa/src/components/cockpit/*AmdScore*` | cockpit chip / breakdown modal。SPS status を主語にする |

## DB 契約

| table | 用途 |
|---|---|
| `amd_score_inputs` | project_id + evaluated_at ごとの SPS input (`prs_potential`, `prs_r_net`) と legacy 7 軸入力、notes、FRL cap |
| `amd_score_alpha` | alpha weights の version 管理 |
| `amd_score_revisions` | 軸値の修正依頼履歴 |
| `bzm_2_model_revisions` | PJ別BZM 2.0測定版、情報締切、検証件数、変更理由 |
| `bzm_2_parameter_observations` | 版ごとのBZM 2.0パラメータ、欠測、出所、条件、影響先 |
| `bzm_2_1_model_revisions` | PJ別BZM 2.1版、地平、価値・判断規則、固定方針、情報締切、検証件数 |
| `bzm_2_1_decision_states` | 判断状態、信念状態、意思決定主体、残費用・残時間、既発生費用 |
| `bzm_2_1_actions` | 行動束、順序、共有資源、権限・同意・資金実行可能性、即時費用・便益 |
| `bzm_2_1_transitions` | 行動条件付きの次状態・終端、物理確率、到達・余力喪失時計、終端価値・失敗損失 |
| `bzm_2_1_interventions` | 支援策が費用、資金、行動集合、遷移、終端価値へ与える差分 |
| `bzm_2_1_input_observations` | 版・視点・状態・行動・遷移・支援ごとの値、欠測、根拠、情報締切 |
| `bzm_2_1_cashflow_events` | 支払主体・受取主体・時点・通貨・換算・税・根拠・視点別leg、公的財政・社会便益成分と、一度だけ入れる計算区分を持つ単一CF正本 |
| `bzm_2_1_action_evaluations` | 状態×行動×評価視点の同一選択状態、到達見込み、必要資金、損失、出口価値、正味価値、canonical hash |
| `bzm_2_1_policy_evaluations` | 固定方針と選択方針を同じ三視点で評価した値、基準線差、選択主体の柔軟性価値、同一方針・同一到達見込み・canonical hash |
| `project_xrl_log` | XRL 時系列評価ログ |
| `project_xrl_evidence` | L2M-2 XRL 根拠 |

`amd_score_inputs` の列名を書く前に `pwa/design/db_schema.md` を確認する。

## Data Derivation Contract

SPS primary は、次のデータを同じ `amd_score_inputs` row から組み立てる。`P` / `R_net` だけは nullable review input なので、未入力なら score を出さず `missingAxes` を返す。

| SPS要素 | 実装値 | 算出 / 解決順 | ベースデータ |
|---|---|---|---|
| `M` | `computeSigmaSU(mu_A, mu_I, mu_G)` の contribution | `((mu_A+1)(mu_I+1)(mu_G+1))^(1/3)-1`、`M=(σ_SU+1)^ασ` | `papers_log`, scholar/OpenAlex, `atlas_signals`, `macro_index_log`, policy/news/investment signals |
| `P` | `prs_potential` | detail draft -> row value -> past persisted row -> latest project-level row -> null | 事業仮説、Venture narrative、PL hearing、Atlas/市場根拠、まさレビュー |
| `R` | TRL / BRL / GRL / SRL / HRL contribution product | `xrl_checklist` 保存値または row の `trl..hrl` | `project_xrl_log`, `project_xrl_evidence`, `amd_score_inputs.xrl_checklist`, XRL notes |
| `S:FRL` | `resolveFrl(row)` | `frl_cap` があれば CES、無ければ `frl` | ALQ 4因子、Grit、Resilience、F_capability、`project_founding_members` |
| `S:R_net` | `prs_r_net` | detail draft -> row value -> past persisted row -> latest project-level row -> null | 収益化見込み、粗利、運営コスト、本命PJへのリソース毀損 |

`resolvePrsInputs()` は stored row -> prior row -> latest reviewed project-level SPS input の順で P/R_net を解決し、過去 row の SPS history を back-calculate する。null は 0 にしない。

LaTeX canonical formula:

$$
\mathrm{Score}_{\mathrm{SPS}}
= K_{\mathrm{SPS}}
\cdot (P_{\mathrm{input}}+1)^{\alpha_P}
\cdot \prod_{x \in \{\mathrm{TRL},\mathrm{BRL},\mathrm{GRL},\mathrm{SRL},\mathrm{HRL}\}}(x+1)^{\alpha_x}
\cdot(\sigma_{\mathrm{SU}}+1)^{\alpha_\sigma}
\cdot(\mathrm{FRL}_{\mathrm{final}}+1)^{\alpha_F}
\cdot(R_{\mathrm{net}}+1)^{\alpha_{R_{\mathrm{net}}}}
$$

$$
K_{\mathrm{SPS}}
= \frac{100{,}000}{10^{\sum_{x \in \mathcal{A}_{\mathrm{SPS}}}\alpha_x}}
$$

$$
\sigma_{\mathrm{SU}}
= \sqrt[3]{(\mu_A+1)(\mu_I+1)(\mu_G+1)} - 1
$$

## FRL 境界

FRL の 2 レイヤー CES 実装仕様は `/spec/4-1-frl-ces-current-spec` を正本にする。

- `frl` = F_character
- `frl_cap` = F_capability
- `frl_cap_amd` = AMD 寄与
- `resolveFrl()` 経由で最終 FRL を作る

## Bottleneck

律速軸は寄与度の小ささではなく、限界感度で見る。

$$
\frac{\partial \mathrm{Score}}{\partial Z_i}
= \frac{\alpha_i \cdot \mathrm{Score}}{Z_i + 1}
$$

$$
\mathrm{bottleneck} = \arg\max_i \frac{\alpha_i}{Z_i + 1}
$$

`argmin(contribution share)` に戻さない。

## Route / UI

| route | 役割 |
|---|---|
| `/venture-map/amd-score` | 全 SU PJ の SPS primary 一覧。legacy AMD は comparison 列 |
| `/project/[projectId]/cockpit?tab=score-detail` | BZM 2.0観測画面 / 現行SPS primary入力 / SPS history / R_net / legacy M-X-F / FRL panel / XRLチェックリストの正規画面 |
| `/venture-map/amd-score/[projectId]` | 旧個別URLから cockpit score detail への互換 redirect (`p99` デモを除く) |
| `/venture-map/amd-score/retrofit` | SPS review queue + legacy alpha 調整 |
| `/project/[projectId]/cockpit` | SPS primary status chip / legacy AMD comparison / 進捗管理 |

## SPS primary

SPS (`M x P x R x S`) を主表示とする。legacy 7軸 AMD Score / M×X×F は comparison と evidence 用に保持する。

| 要素 | 実装上の扱い |
|---|---|
| `M` | マクロ追い風 (Macrotrend)。`sigma_SU` の contribution。`PrsComponentBreakdown.macro` (2026-07-16 S から分離) |
| `P` | Potential / 潜在規模。`amd_score_inputs.prs_potential` に nullable で保存 |
| `R` | Reach / Readiness。TRL / BRL / GRL / SRL / HRL の contribution product |
| `S` | 自走力 (Survival = FRL × R_net)。final FRL / `R_net` の contribution product |
| `R_net` | 収益化指数。粗利 - 運営コスト - 本命から奪うリソース毀損。`amd_score_inputs.prs_r_net` に nullable で保存 |

実装ファイル:

| file | 契約 |
|---|---|
| `pwa/src/lib/amd-score.ts` | `SPS_ALPHA_DEFAULT` / `calculatePrsScore()`。P/R_net missing 時は score を返さず `status='missing'` |
| `pwa/src/lib/amd-score-derived.ts` | `derivePrsComponents()` / `buildPrimaryScoreSnapshot()`。stored P/R_net を優先し、主表示と legacy comparison を同じ row から作る |
| `pwa/src/components/venture-map/AmdScoreView.tsx` | cockpit score detail 上で P / R_net を保存し、SPS を primary、legacy AMD を comparison として表示 |
| `pwa/src/components/venture-map/AmdScoreRetrofit.tsx` | SPS review queue。missing PJ の棚卸しと legacy α 比較 |

禁止事項:

- P/R_net missing を 0 扱いして primary score を偽装すること
- SPS missing 時に legacy AMD を primary として見せること
- 既存7軸の履歴再計算

P/R_net rubric の厳密化と全 PJ の埋め切りは継続レビュー対象である。運用SPSのprimaryはSPSのまま維持するが、score-detail全体の画面最上段はBZM 2.2とし、両者の地位を混同しない。

legacy 値しかない PJ でも、primary を legacy AMD へ戻さない。画面上は SPS review pending とし、legacy は `Legacy AMD comparison` / `legacy M-X-F` / `comparison only` の文脈で表示する。

## Score detail 表示契約

cockpit の `スコア詳細` embedded view は、次の値をすべて説明可能な形で表示する。ここにある項目を UI に出す場合、算出式または入力元をこの章にも残す。旧 `/venture-map/amd-score/[projectId]` は同じ内容を別表示せず、この cockpit tab へ redirect する。

| UI表示 | 現行の位置づけ | 算出 / 取得元 |
|---|---|---|
| `BZM 2.2` | J/P/Q/S、方針比較、選択とイベント、103項目の計算前提を画面最上段に表示 | checked-in pilot artifactのPJ別compact projection |
| `全パラメータ台帳` | 7群103項目を省略しない監査表 | artifactのparameter ledger。値、推定状態、確度、根拠・注記、scenario別入力 |
| `これまでに得てきたもの` (BZM 2.2 獲得台帳) | 表示専用。J/P/Q/S・SPS・戦略余力のどの計算にも入らない | `GET /api/project/[projectId]/bzm-2-2-acquisitions` = `project_bzm_2_2_acquisitions` の `status='active'` を `occurred_on` 降順。仕様は [`4-6`](4-6-bzm-22-acquisition-ledger-current-spec.md) |
| `SPS Primary` score | 現行 primary | `calculatePrsScore()` の `Score_SPS`。`P` と `R_net` がある時だけ表示 |
| `INPUT NEEDED` / missing axes | review pending | `missingAxes`。`P` / `R_net` が null または非数なら score は null |
| `P Potential` | primary input | `amd_score_inputs.prs_potential`。空欄保存は null |
| `R_net` | primary input | `amd_score_inputs.prs_r_net`。空欄保存は null |
| `M` breakdown / `M マクロ追い風` | SPS component | `(sigma_SU + 1)^{alpha_sigma}`。`PrsComponentBreakdown.macro` |
| `P` breakdown | SPS component | `(P_input + 1)^{alpha_P}` |
| `R` breakdown / `R reach` | SPS component | TRL / BRL / GRL / SRL / HRL の contribution product |
| `S` breakdown / `S 自走力 (Survival = FRL × R_net)` | SPS component | final FRL / `R_net` の contribution product (σ_SU は `M` へ分離済み) |
| `SPS history` | primary history | `computePrsScoreSeries()`。`status='ready'` の行だけ採用し、Y軸は log scale |
| `Legacy AMD comparison` | legacy comparison | `calculateAmdScore()`。SPS missing の代替 primary ではない |
| `Legacy AMD` hero score | legacy comparison | `K_legacy * M * X * F` |
| `M / X / F バランス` | legacy evidence | `breakdownFromResult()` の `M`, `X`, `F` |
| `K`, `Σα`, `σ_SU`, `lane` | score metadata | `calculateAmdScore()` / `calculatePrsScore()` と `project_ventures.lane` |
| `律速` | action hint | 限界感度 `argmax alpha_i / (Z_i+1)`。現行画面では legacy comparison の bottleneck を併記 |
| `Triple Helix Matrix` | `sigma_SU` evidence | `triple-helix-observations` 由来の `mu_A` / `mu_I` / `mu_G`、C行列、観測値、被覆率 |
| `XRL 観測チェックリスト` | XRL evidence / writer | `xrl_checklist` JSONB から達成レベルを算出し、保存時に `trl..hrl` も更新 |
| `FRL — Founder Readiness Level` | final FRL evidence | ALQ 4因子 / Grit / Resilience / FRL notes と final FRL |

### SPS input resolution

`P` と `R_net` は UI draft がある時は draft を優先し、通常表示では次の順で解決する。

1. 対象 `amd_score_inputs` row の `prs_potential` / `prs_r_net`
2. 同一PJで `evaluated_at <= target.evaluated_at` の過去 row に保存済みの値
3. 同一PJの最新 project-level row に保存済みの値
4. null

null の場合は missing とし、0 へ丸めない。

### SPS expanded formula

$$
\mathrm{Score}_{\mathrm{SPS}}
= K_{\mathrm{SPS}}
\cdot (\sigma_{\mathrm{SU}}+1)^{\alpha_\sigma}
\cdot (P_{\mathrm{input}}+1)^{\alpha_P}
\cdot \prod_{x \in \{\mathrm{TRL},\mathrm{BRL},\mathrm{GRL},\mathrm{SRL},\mathrm{HRL}\}}(x+1)^{\alpha_x}
\cdot (\mathrm{FRL}+1)^{\alpha_F}
\cdot (R_{\mathrm{net}}+1)^{\alpha_{R_{\mathrm{net}}}}
$$

フラット Cobb-Douglas なので因子の掛け順・グルーピングは数値に影響しない (M·P·R·S 再グルーピングでスコアが不変な根拠)。Shallow Tech mode では `TRL=null` として R から TRL を除外し、`K_SPS` も active axes の alpha sum で再校正する。

### Triple Helix / Macrotrend (= SPS の M)

$$
\sigma_{\mathrm{SU}} = \sqrt[3]{(\mu_A+1)(\mu_I+1)(\mu_G+1)} - 1
$$

$$
M = (\sigma_{\mathrm{SU}}+1)^{\alpha_\sigma}
$$

観測モデルがある場合は、直近 quarter の観測値 `y_p` を過去16 quarterで 0-9 正規化し、loading `c_{xp}` で各 hidden state に集約する。

$$
\tilde{y}_p = 9 \cdot \frac{y_p - \min_t y_p}{\max_t y_p - \min_t y_p}
$$

$$
\mu_x = \frac{\sum_p c_{xp}\tilde{y}_p}{\sum_p c_{xp}},
\qquad x \in \{A,I,G\}
$$

UIの `c`, `ỹ`, `c·ỹ`, `coverage` は、この観測モデルの説明要素として表示する。観測値欠落時は推測で埋めず、coverage note に残す。

### XRL / Reach

各 XRL axis contribution:

$$
C_x = (x+1)^{\alpha_x}
$$

Reach:

$$
R = C_{\mathrm{TRL}} \cdot C_{\mathrm{BRL}} \cdot C_{\mathrm{GRL}} \cdot C_{\mathrm{SRL}} \cdot C_{\mathrm{HRL}}
$$

`XRL 観測チェックリスト` の達成レベルは、下から見て全項目が checked の連続最大レベル。

$$
\mathrm{level}_a =
\max\left\{l \mid \forall j \le l,\ \forall k \in \mathrm{checklist}_{a,j},\ \mathrm{checked}_{a,j,k}=\mathrm{true}\right\}
$$

保存時は `amd_score_inputs.xrl_checklist` に JSONB を保存し、同じ row の `trl`, `brl`, `grl`, `srl`, `hrl` を `level_a` で上書きする。

### FRL / Survival (自走力)

FRL 自動算出モードでは、入力済み component の重みだけを使って正規化する。全 component が null の場合は null。

$$
\overline{\mathrm{ALQ}_4}
= \mathrm{avg}(\mathrm{SelfAwareness},\mathrm{RelationalTransparency},\mathrm{BalancedProcessing},\mathrm{InternalizedMoral})
$$

$$
\mathrm{FRL}_{6f}
= \frac{0.6 \cdot \overline{\mathrm{ALQ}_4}
 + 0.2 \cdot \mathrm{Grit}
 + 0.2 \cdot \mathrm{Resilience}}
{\sum \mathrm{available\ weights}}
$$

final FRL は `/spec/4-1-frl-ces-current-spec` の `resolveFrl()` に従い、`frl_cap` がある場合は CES で `F_character` と `F_capability` を合成する。

$$
\mathrm{FRL}_{\mathrm{final}}
= \left(a(F_{\mathrm{char}}+1)^\rho + (1-a)(F_{\mathrm{cap}}+1)^\rho\right)^{1/\rho} - 1
$$

$$
S = (\mathrm{FRL}_{\mathrm{final}}+1)^{\alpha_F}
\cdot (R_{\mathrm{net}}+1)^{\alpha_{R_{\mathrm{net}}}}
$$

S = 自走力 (Survival = FRL × R_net)。σ_SU は 2026-07-16 に独立項 M へ分離した (上の「Triple Helix / Macrotrend (= SPS の M)」参照)。

## Appendix: legacy MXF / 7軸モデル

このセクションは過去モデルの保存場所。legacy MXF (= M-X-F / 7軸 Cobb-Douglas) は、現行 primary ではない。

$$
\mathrm{Score}_{\mathrm{legacy}}
= K_{\mathrm{legacy}} \cdot \prod_{i \in \mathcal{A}_{\mathrm{legacy}}}(X_i+1)^{\alpha_i}
$$

$$
\mathcal{A}_{\mathrm{legacy}}
= \{\sigma_{\mathrm{SU}},\mathrm{TRL},\mathrm{BRL},\mathrm{GRL},\mathrm{SRL},\mathrm{HRL},\mathrm{FRL}\}
$$

$$
K_{\mathrm{legacy}} = \frac{100{,}000}{10^{\sum_{i \in \mathcal{A}_{\mathrm{legacy}}}\alpha_i}}
$$

UI 表示上は次に分解する。

$$
\mathrm{Score}_{\mathrm{legacy}} = K_{\mathrm{legacy}} \cdot M \cdot X \cdot F
$$

$$
M = (\sigma_{\mathrm{SU}}+1)^{\alpha_\sigma},\quad
X = \prod_{x \in \{\mathrm{TRL},\mathrm{BRL},\mathrm{GRL},\mathrm{SRL},\mathrm{HRL}\}}(x+1)^{\alpha_x},\quad
F = (\mathrm{FRL}+1)^{\alpha_F}
$$

Shallow Tech mode では TRL 軸を除外し、K を再校正する。

legacy M-X-F は次の目的で残す。

- 過去の retrofit / score history の再読
- SPS の R/S components の evidence chain
- alpha tuning / historical comparison
- 旧画面・旧説明との対応確認

主表示・章 summary・操作導線では `SPS Primary` を先に置く。M-X-F / 7軸を現行 primary へ戻す変更は不可。

## 変更ゲート

- 計算式・alpha・FRL・bottleneck を変えたら `/spec` と `pwa/design/amd_score.md` の両方を更新する。
- DB列追加は migration + `pwa/design/db_schema.md` 再生成を同じ作業単位に含める。
- UI 導線を消す前に `pwa/design/FEATURE_REGISTRY.md` と critical UI test を確認する。
