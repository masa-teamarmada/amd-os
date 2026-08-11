# BZM 2.0 学際模擬監査台帳

> **状態**：`multidisciplinary-audit v0.1`（2026-08-11）
>
> **監査対象**：`pwa/bzm/sps-2-0-reachability-model.md`、`pwa/bzm/BZM_2_0_PARAMETER_EXTRACTION_REGISTER.md`、`pwa/bzm/BZM_2_0_REVISION_REQUIREMENTS.md`、`pwa/bzm/BZM_2_0_DIAGNOSTIC_SCORE_SPEC.md`
>
> **監査時点**：2026-08-11
>
> **前向き検証**：0件
>
> **監査の性質**：この台帳は、経済学、経営学、ディープテック経営、産学連携、VCの判断基準を分離して行ったAIによる独立模擬監査である。
>
> **署名境界**：実在する経済学者、経営学者、経営者、産学連携担当者、VCによる署名監査、査読、推薦、保証ではない。

## 1. 総合判定

総合判定は、**研究用の測定プロトコルとして条件付き通過、PJ比較に使う予測モデルと投資配分モデルとして不通過**である。

現行設計には、工程依存、資金の崖、欠測、情報締切、版更新を明示する再現可能な骨格がある。

一方、全価値実現経路を覆う価値式、PJ間で共通の予測地平、価値評価方式の整合、産学連携固有の権利台帳、評価者間信頼性、前向き予測妥当性は通過条件を満たしていない。

したがって、現時点の出力を「校正済みの成功確率」「期待時価総額」「DCFの代替」「SPS順位に従う資源配分の優位性」と呼ぶことはできない。

この結論は、モデル全体に代数的な矛盾があるという意味ではない。

現時点で棄却されるのは、未検証のモデルを比較、予測、価値評価、投資判断へそのまま使えるという強い主張である。

証拠基盤は、SXの1 PJで行ったモデル内計算、LSTの入力収集、前向き検証0件である。

| 利用目的 | 判定 | 現時点で許される主張 |
|---|---|---|
| 工程と証拠の再構成 | 条件付き通過 | PJごとの仮説、依存、欠測、資金切れ経路を版管理する研究用診断 |
| 計画達成の診断 | 条件付き通過 | 計画版と情報締切を固定したモデル上の計画達成値 |
| PJ間の到達比較 | 不通過 | 共通地平の累積到達曲線と測定不変性の確認後に再監査する |
| モデル上の総持分価値の算定 | 不通過 | 全価値実現経路と経路別正味持分価値を実装した後に再監査する |
| DCFまたはVC法の置換 | 不通過 | 独立評価、実取引、既存手法に対する増分妥当性を前向きに示す必要がある |
| BZSFの投資額配分 | 不通過 | 投資契約、証券クラス、フォローオン、ポートフォリオ制約を下流層で加える必要がある |

## 2. 監査後に置く数式

### 2.1 計画達成とPJ比較を分ける

計画版$v$の期限$H_v$までに資本自立へ到達する診断値を、計画達成用の$q_{\mathrm{plan}}$とする。

$$
q_{\mathrm{plan},\tau}(H_v)
=
\Pr^{\mathbb P}
\!\left(T_C<T_Y,\ T_C\le H_v\mid\mathcal I_\tau\right)
$$

| 記号 | 意味 |
|---|---|
| $q_{\mathrm{plan},\tau}(H_v)$ | 情報締切$\tau$時点における計画版$v$の資本自立達成診断値 |
| $T_C$ | 資本自立へ初めて到達するまでの時間 |
| $T_Y$ | 戦略余力を失うまでの時間 |
| $H_v$ | 計画版$v$の期限。計算前に$T_C$と同じ時間軸へ変換する |
| $\mathcal I_\tau$ | 情報締切までに利用できた証拠 |
| $\mathbb P$ | 実世界の確率測度 |

$H_v$がPJごとに違えば、$q_{\mathrm{plan}}$の差にはPJ状態の差と観測期間の差が混ざる。

PJ比較には、全PJへ同じ経過時間$h$を置いた累積到達曲線$Q_\tau(h)$を使う。

$$
Q_\tau(h)
=
\Pr^{\mathbb P}
\!\left(T_C<T_Y,\ T_C\le h\mid\mathcal I_\tau\right)
\qquad
(0\le h\le H_{\mathrm{econ}})
$$

| 記号 | 意味 |
|---|---|
| $Q_\tau(h)$ | 情報締切$\tau$から共通地平$h$までに資本自立へ到達する累積確率 |
| $h$ | 全PJへ共通に置く経過時間。$H_{\mathrm{econ}}$を超えない |

$q_{\mathrm{plan}}$は計画の実行可能性を診断し、$Q_\tau(h)$は同じ地平でPJを比較する。

この二つを一つの未修飾記号へ戻さない。

### 2.2 全価値実現経路と資本自立経路を分ける

価値実現経路の集合$\mathcal O$には、計画期限内の資本自立$G_{\mathrm{plan}}$、計画期限後の資本自立$G_{\mathrm{late}}$、ライセンス、M&A、知財売却、ピボット、撤退、清算、経済評価地平末の未解決継続`unresolved_continuation`を含める。

$H_{\mathrm{econ}}$は経路分類と価値評価を閉じる全PJ共通の経済評価地平であり、計算前に情報締切からの同じ経過時間として固定する。

$$
0 < H_v \le H_{\mathrm{econ}}
$$

$H_v>H_{\mathrm{econ}}$の計画版は計画達成診断値だけを別に計算できるが、$G_{\mathrm{plan}}$、$G_{\mathrm{late}}$、非$G$を同時に閉じる価値分解へ入れない。

$H_{\mathrm{econ}}$より後のキャッシュフローを0にせず、同地平時点の継続価値または残存価値として$P_o$へ含める。

$H_{\mathrm{econ}}$までに$G_{\mathrm{plan}}$または$G_{\mathrm{late}}$へ入らない履歴だけを非$G$経路へ割り当てる。

各履歴が一つだけの経路へ入るように分類規則を事前登録し、残余経路を置いて集合を相互排他的かつ網羅的にする。

$$
\mathrm{SPS}_{\mathrm{all},\tau}(H_{\mathrm{econ}})
=
\sum_{o\in\mathcal O}
q_{o,\tau}(H_{\mathrm{econ}})
P_{o,\tau}(H_{\mathrm{econ}})
$$

| 記号 | 意味 |
|---|---|
| $q_{o,\tau}(H_{\mathrm{econ}})$ | $H_{\mathrm{econ}}$までに経路$o$へ分類される実世界の条件付き確率 |
| $P_{o,\tau}(H_{\mathrm{econ}})$ | 経路$o$における評価日時点で存在する全持分証券の条件付き正味持分価値 |
| $\mathrm{SPS}_{\mathrm{all},\tau}(H_{\mathrm{econ}})$ | 列挙した全価値実現経路の確率加重持分価値 |

$P_{o,\tau}$は条件付き算術平均とし、中央値を使わない。

$P_{o,\tau}$には、到達前の開発費、将来調達、希薄化、負債、税、残存価値を同じ評価日と通貨で入れる。

以下では、測定版の$H_{\mathrm{econ}}$が固定されている場合に限り、経路別の$q$、$P$、SPSから引数を省略する。

$q_{o,\tau}=0$の経路では$P_{o,\tau}$を推測せず、その経路の寄与だけを0とする。

資本自立経路$G=G_{\mathrm{self}}(12\mathrm m)$は、計画期限内の$G_{\mathrm{plan}}$と、計画期限後かつ$H_{\mathrm{econ}}$までの$G_{\mathrm{late}}$へ分ける。

$$
q_{G,\tau}(H_{\mathrm{econ}})
=
Q_\tau(H_{\mathrm{econ}})
=
q_{\mathrm{plan},\tau}(H_v)
+
q_{G,\mathrm{late},\tau}(H_v,H_{\mathrm{econ}})
$$

$q_{G,\tau}(H_{\mathrm{econ}})$と$P_{G,\tau}(H_{\mathrm{econ}})$は計画期限を条件にせず、$H_{\mathrm{econ}}$までの資本自立経路全体について定義する。

$q_{G,\mathrm{late},\tau}(H_v,H_{\mathrm{econ}})$は、戦略余力を失う前に$H_v$より後かつ$H_{\mathrm{econ}}$までに資本自立へ着く確率である。

資本自立経路全体の寄与は、次の一成分として残す。

$$
\mathrm{SPS}_{G,\tau}(H_{\mathrm{econ}})
=
q_{G,\tau}(H_{\mathrm{econ}})
P_{G,\tau}(H_{\mathrm{econ}})
=
\mathrm{SPS}_{G,\mathrm{plan},\tau}(H_v)
+
\mathrm{SPS}_{G,\mathrm{late},\tau}(H_v,H_{\mathrm{econ}})
$$

| 記号 | 意味 |
|---|---|
| $H_{\mathrm{econ}}$ | 計画期限とは別に固定する経済評価地平 |
| $q_{G,\tau}(H_{\mathrm{econ}})$ | 計画期限を条件にせず、$H_{\mathrm{econ}}$までに資本自立経路$G$が実現する確率 |
| $P_{G,\tau}(H_{\mathrm{econ}})$ | $H_{\mathrm{econ}}$までの資本自立経路全体に条件づけた正味持分価値 |
| $\mathrm{SPS}_{G,\tau}(H_{\mathrm{econ}})$ | 資本自立経路が全価値へ寄与する金額 |

旧UIの積は、計画期限内の資本自立経路だけへ条件づける。

$$
\mathrm{SPS}_{G,\mathrm{plan},\tau}(H_v)
=
q_{\mathrm{plan},\tau}(H_v)
P_{G,\mathrm{plan},\tau}(H_v)
$$

$$
\mathrm{SPS}_{G,\mathrm{late},\tau}(H_v,H_{\mathrm{econ}})
=
q_{G,\mathrm{late},\tau}(H_v,H_{\mathrm{econ}})
P_{G,\mathrm{late},\tau}(H_v,H_{\mathrm{econ}})
$$

$P_{G,\mathrm{plan},\tau}(H_v)$と$P_{G,\tau}(H_{\mathrm{econ}})$は条件集合が異なるため、同じ値として流用しない。

$q_{G,\tau}(H_{\mathrm{econ}})>0$なら、$P_{G,\tau}(H_{\mathrm{econ}})$は期限内と期限後の条件付き価値を各経路確率で加重した算術平均とする。

$q_{G,\tau}(H_{\mathrm{econ}})=0$なら$P_{G,\tau}(H_{\mathrm{econ}})$は未定義であり、$q_{\mathrm{plan},\tau}(H_v)=0$なら$P_{G,\mathrm{plan},\tau}(H_v)$は未定義である。

どちらの場合も欠測値を0とせず、対応する価値寄与だけを0とする。

$H_v$だけを変更した場合、$G_{\mathrm{plan}}$と$G_{\mathrm{late}}$の内訳は変わりうるが、証拠、経路、キャッシュフロー、$H_{\mathrm{econ}}$が同じなら$q_{G,\tau}(H_{\mathrm{econ}})$、$\mathrm{SPS}_{G,\tau}(H_{\mathrm{econ}})$、$\mathrm{SPS}_{\mathrm{all},\tau}(H_{\mathrm{econ}})$は変えない。

$\mathrm{SPS}_{G,\mathrm{plan},\tau}(H_v)$を$\mathrm{SPS}_{\mathrm{all},\tau}(H_{\mathrm{econ}})$と同じ出力として扱う採用条件は、期限後資本自立の寄与$\mathrm{SPS}_{G,\mathrm{late},\tau}(H_v,H_{\mathrm{econ}})$と、すべての非$G$経路の寄与$q_{o,\tau}(H_{\mathrm{econ}})P_{o,\tau}(H_{\mathrm{econ}})$がそれぞれ0であると証拠で示すことである。

$\mathrm{SPS}_{G,\tau}(H_{\mathrm{econ}})$を$\mathrm{SPS}_{\mathrm{all},\tau}(H_{\mathrm{econ}})$と同じ出力として扱う採用条件は、すべての非$G$経路の寄与$q_{o,\tau}(H_{\mathrm{econ}})P_{o,\tau}(H_{\mathrm{econ}})$がそれぞれ0であると証拠で示すことである。

正負の経路寄与が偶然相殺して数値だけ一致する場合は、どちらの採用条件も満たさない。

価値評価は、次の四方式のいずれか一つへ固定する。

1. FCFFとWACC。
2. FCFEと株主資本コスト。
3. 実確率と確率的割引因子。
4. リスク中立確率と無リスク割引。

第1方式と第2方式は、理論正本がいう「期待キャッシュフローとリスク調整割引率」を、事業価値から作る場合と持分キャッシュフローから作る場合へ分けた二つの実装である。

方式をまたいで同じリスクまたは失敗確率を再投入しない。

リスク中立方式では実確率$q_{o,\tau}$を外側から再乗算せず、FCFFまたはFCFEが失敗確率を含む場合も同じ失敗確率を外側から再乗算しない。

### 2.3 旧主張の撤回

旧主張「$qP$は到達前失敗を含む期待時価総額である」は撤回する。

時価総額は市場価格が成立している株式について観測される量であり、モデルが算出する非公開PJの理論値と同じではない。

さらに、旧$qP$は期限後資本自立経路と非$G$の価値実現経路を0にしていたため、全経路のモデル上の総持分価値も表していなかった。

修正後の$\mathrm{SPS}_{\mathrm{all},\tau}$は「列挙した価値実現経路のモデル内確率加重持分価値」と呼ぶ。

未列挙経路、モデル外リスク、未校正入力が残る限り、市場時価総額、観測価格、DCFの代替と同値だとは主張しない。

## 3. 役割別の独立模擬監査

役割ごとの判定は、他の役割の合格によって相殺しない。

一つの役割がP0を出した場合、そのP0は総合監査にも残す。

### 3.1 経済学

**判定は、到達診断の研究設計として条件付き通過、価値評価とDCF代替の主張として不通過である。**

確率と条件付き価値を分ける発想、実世界確率の明示、到達前失敗の二重計上を避ける方針は維持できる。

しかし、計画期限を超えただけで価値を0にする旧構造、非$G$経路の残存価値欠落、到達前開発費と将来希薄化の欠落、実確率と割引率の混在、総持分価値と証券クラス配分の混同は価値主張を止める。

$q_{\mathrm{plan}}(H_v)$、$Q_\tau(h)$、$q_G(H_{\mathrm{econ}})$、$P_{G,\mathrm{plan}}(H_v)$、$P_G(H_{\mathrm{econ}})$、$q_o(H_{\mathrm{econ}})$、$P_o(H_{\mathrm{econ}})$、$\mathrm{SPS}_{G,\mathrm{plan}}(H_v)$、$\mathrm{SPS}_{G}(H_{\mathrm{econ}})$、$\mathrm{SPS}_{\mathrm{all}}(H_{\mathrm{econ}})$への分離は前二点を構造上修正するが、経路別キャッシュフローと証券権利の実装が終わるまで再監査を通さない。

### 3.2 経営学と組織論

**判定は、組織状態を追跡する研究プロトコルとして条件付き通過、一般的な起業成功予測モデルとして不通過である。**

$G_{\mathrm{self}}$はBZMが選んだ資本自立の終点であり、起業研究で確立した普遍的な「成功」の定義ではない。

起業成果は売上、成長、生存、資金調達、IPO、ライセンス、売却など複数の尺度で測られてきたため、資本自立だけを全価値の入口にすると構成概念が狭すぎる。[^entrepreneurship-performance]

工程グラフ、再試行、資金の崖は段階投資と実物オプションの考え方に整合するが、現行の固定計画には、学習後に継続、ピボット、拡張、放棄を選ぶ意思決定ノードが足りない。[^staging][^real-options][^dynamic-capabilities]

キラー要素カタログは発生後の再測定トリガーとして維持できるが、七分類の内容妥当性、識別妥当性、評価者間一致、予測増分は未確認である。

したがって、キラー要素を校正済みの事前予測因子とは呼ばない。

### 3.3 ディープテック経営者

**判定は、PJ運営の診断補助として条件付き通過、経営会議で自動利用するスコアとして不通過である。**

技術、製造、顧客、規制、知財、資金の依存を並行か直列かまで明示し、失敗、迂回、再試行、資金切れを一つの経路へ組む設計は実務上使える。

欠測を0にしないこと、計画版を上書きしないこと、未来情報を過去入力へ補完しないことも維持する。

一方、全ノードの詳細確率を一人の経営者へ一度に聞く運用は入力負担が大きく、回答者が把握していない工程へ擬似精度を生む。

文書を先に読み、会議一回の初期上限を影響の大きい5から10ノードに置き、各レーンの責任者から取得し、取得時間と未回答理由を保存して上限を改訂する必要がある。

### 3.4 産学連携と技術移転

**判定は現状不通過であり、産学連携専用の権利台帳を追加した後に条件付き通過候補となる。**

現行台帳だけでは、発明者、権利者、出願人、実施権者を分けるchain of title（発明からPJまでの権利帰属の連鎖）、共有持分、背景知財、共同研究成果、改良発明、FTO（他者権利を侵害せず実施できる見込み）、ライセンスの段階と範囲を再現できない。

ライセンスでは、独占性、対象技術、用途、地域、再許諾、開発義務、解除、対価が$q_{\mathrm{plan}}$、$Q_\tau(h)$、$q_o$の対応する工程入力と全期間キャッシュフローを変える。[^wipo-license]

大学側の利益相反、兼業、名称と施設の利用、輸出管理、学内承認も別の条件であり、CEOの説明だけでは確定できない。[^meti-collaboration]

文書証拠を優先し、出自機関との関係悪化をキラー要素の再測定トリガーにする規律は維持する。

### 3.5 VC

**判定は、デューデリジェンス補助として条件付き通過、投資価格と資金配分を決めるモデルとして不通過である。**

マイルストーン、資金の崖、失敗分岐、証拠の版管理は、段階投資とモニタリングを行うVC実務に整合する。[^staging]

しかし、全価値実現経路、到達前費用、将来ラウンド、希薄化、清算優先、参加条項、転換、ストックオプションを入れなければ、モデル上の総持分価値から各証券の価値へ配分できない。[^private-capital]

企業価値から総持分価値へのブリッジと、総持分価値を証券クラスへ配分するウォーターフォールを分ける必要がある。

投資額、フォローオン、持分比率、支配権、集中、流動性、ファンド期限はSPSへ混ぜず、BZSFのポートフォリオ層で扱う。

## 4. 修正優先度

### 4.1 P0

P0は、完了するまで比較、予測、価値評価、投資配分の主張を止める修正である。

| ID | 必須修正 | 完了条件 |
|---|---|---|
| P0-1 | 旧「期待時価総額」主張を全正本から撤回する | $q_{\mathrm{plan}}(H_v)$、$Q_\tau(h)$、$q_G(H_{\mathrm{econ}})$、$P_{G,\mathrm{plan}}(H_v)$、$P_G(H_{\mathrm{econ}})$、$q_o(H_{\mathrm{econ}})$、$P_o(H_{\mathrm{econ}})$、$\mathrm{SPS}_{G,\mathrm{plan}}(H_v)$、$\mathrm{SPS}_G(H_{\mathrm{econ}})$、$\mathrm{SPS}_{\mathrm{all}}(H_{\mathrm{econ}})$の名称と役割、および$H_v$と$H_{\mathrm{econ}}$の条件キーが全正本で一致する |
| P0-2 | 価値実現経路を相互排他的かつ網羅的にする | 非$G$経路と残余経路を事前登録し、各履歴が一つだけの経路へ入る |
| P0-3 | 経路別$P_o$を正味持分価値として作る | 到達前費用、将来資金、希薄化、税、負債、残存価値を同じ評価日と通貨で計算する |
| P0-4 | リスクの扱いを一方式へ固定する | FCFFとWACC、FCFEと株主資本コスト、実確率と確率的割引因子、リスク中立確率と無リスク割引の四方式から一つだけを選び、方式間で確率またはリスクを重複投入しない |
| P0-5 | 総持分価値と証券クラス配分を分ける | 清算優先などの契約権利を総持分から二重控除せず、ウォーターフォールでクラスへ配る |
| P0-6 | PJ比較を共通地平へ移す | 同じ$h$の$Q_\tau(h)$または曲線全体だけを比較に使い、計画期限の違いを混ぜない |
| P0-7 | 工程グラフの粒度規約を作る | 同じ事象を細分化すると主観確率が変わるunpacking effect（事象分解効果）を検査できるコードブックを固定する[^support-theory] |
| P0-8 | キラー要素の主張を監視へ限定する | 七分類を校正済み予測器と呼ばず、発生判定と再測定の台帳として表示する |
| P0-9 | 産学連携の権利台帳を追加する | chain of title、FTO、ライセンス条件、大学承認、利益相反、輸出管理を別々に抽出する |
| P0-10 | 前向き検証0件の利用境界を固定する | 校正済み確率、投資推奨、DCF代替という表示と運用を無効にする |

### 4.2 P1

P1は、P0後の再現性、説明力、実務適合性を上げる修正である。

| ID | 推奨修正 | 狙い |
|---|---|---|
| P1-1 | 学習後の継続、ピボット、拡張、放棄を意思決定ノードにする | 固定計画では表せない適応と実物オプションを経路へ入れる |
| P1-2 | 複数評価者の構造化エリシテーションを導入する | 質問文、条件、評価者、幅、根拠を固定し、単独の感覚値を減らす[^expert-judgement] |
| P1-3 | キラー要素七分類のコードブックを作る | 定義、含む例、含まない例、発生日、証拠、影響工程を分け、評価者間一致を測る |
| P1-4 | $Z_{\mathrm{policy}}$などの共通状態に反実仮想を付ける | 既存入力への織り込みと独立加点を重ねず、政策上の立ち位置とロビイング効果を分ける |
| P1-5 | PJ類型別に校正する | 技術分野、法人化前後、資本集約度、販売型、ライセンス型の異質性を平均で消さない |
| P1-6 | 大学発PJの起業能力を別入力で観察する | 機会の精緻化、資源活用、推進者形成を権利状態と混同しない[^academic-entrepreneurship] |
| P1-7 | BZSF下流層へ将来ラウンドとファンド制約を置く | SPSと投資家固有の回収、集中、準備資金、期限を分ける |
| P1-8 | 入力取得負担を保存する | 文書先行、重要ノード優先、レーン責任者分担が実際に運用可能かを検証する |

### 4.3 P2

P2は、十分な前向きデータが集まった後に精度と解釈を改善する修正である。

| ID | 改善候補 | 狙い |
|---|---|---|
| P2-1 | 三角分布、PERT、対数正規、経験分布を比較する | 所要時間分布の選択だけで$q_{\mathrm{plan}}$、$Q_\tau(h)$、$q_o$が動く構造感度を測る |
| P2-2 | 階層参照クラスを作る | 少数PJを無理に一つへ束ねず、共通部分とPJ固有部分を分ける |
| P2-3 | 実現済み社会成果$O_{\mathrm{soc}}$をSPSと別に追う | 私的持分価値へ反映されない外部便益を0と誤認しない |
| P2-4 | 意思決定純便益と作業時間を比較する | 予測精度だけでなく、会議と資源配分が改善したかを測る |

## 5. 現行設計で維持できる点

| 維持点 | 監査理由 | 維持条件 |
|---|---|---|
| 到達確率と価値の証拠を分ける | 一方を動かして他方を救う自己弁護と二重計上を抑えられる | 経路別$q_o$と$P_o$の情報集合、評価日、版を固定する |
| 計画期限と資金の崖を分ける | 計画未達と継続不能は異なる事象である | 計画期限は$q_{\mathrm{plan}}$だけへ使い、全経路のモデル上の総持分価値を打ち切らない |
| 工程の並行、直列、失敗、迂回、再試行をグラフ化する | 単純積よりも技術事業化の構造を再現しやすい | グラフ粒度と依存の取り方を固定し、splitとmergeを検査する |
| 共通状態を独立加点しない | 政策、信用、提携の効果を影響工程へ条件づけ、二重計上を避けられる | 影響先、作用機構、織り込み済みかを保存する |
| 社会要素を三経路へ接続する | キャッシュフロー、到達、市場価格づけへ接続しない便益を株価へ自動加点しない | 私的価値に入らない社会成果を別の$O_{\mathrm{soc}}$へ残す[^sustainable-investing] |
| キラー要素を発生後の再測定トリガーにする | 根拠のない一律減点を作らず、新情報を版更新へ反映できる | 発生証拠と確率変更を分け、増分予測力を後で検証する |
| CEOの自己申告だけで発生を確定しない | ガバナンスと権利の事象は契約と記録で確認できる | 自己申告を捨てず、文書、他者記録、行動証拠と三角測量する |
| 欠測を0にしない | 未観測と不存在を分けられる | 補完値には`imputed`を付け、観測値と同じ色、名称、主張にしない |
| 情報締切と版を保存する | 後知恵と未来情報の混入を検査できる | 結果を知った後に過去入力を上書きしない |
| 前向き検証0件を明記する | 予測の説明と検証済み予測を分けられる | 0件の間は強い表示と自動判断を解除する |

## 6. 主張と文献の対応

この台帳では、文献との関係を四種類に分ける。

**文献由来**は、数式、測定原則、または制度要件を文献から直接採ったことを示す。

**文献整合**は、BZMの仕組みが既存研究と矛盾しないことだけを示し、BZMの予測精度を文献が証明したことを意味しない。

**BZM独自**は、BZMが目的に合わせて選んだ定義、分類、実装規則である。

**未検証**は、BZMの対象PJで構成概念妥当性、信頼性、予測妥当性、因果効果を確認していない主張である。

| BZMの主張または設計 | 地位 | 文献が支える範囲 | 文献からは導けない範囲 |
|---|---|---|---|
| 確率と条件付き価値を分ける | 文献由来、文献整合 | 条件付き期待値、確率加重現在価値、割引率とキャッシュフローの整合[^present-value][^sdf] | $G_{\mathrm{self}}$の採用、工程分類、BZM入力の妥当性 |
| 段階工程と資金の崖 | 文献整合 | 不確実性が高い初期企業への段階投資とモニタリング[^staging] | BZMの各ノード確率、時間幅、資金切れ率 |
| PERTによる工程時間 | 文献由来、未検証 | R&D工程をネットワークと三点時間で扱う原型[^pert] | 三角分布またはPERT分布が各ディープテックPJへ最適という主張 |
| $q_{\mathrm{plan}}$と$Q_\tau(h)$の分離 | BZM独自、文献整合 | 比較には同じ構成概念と測定条件が必要という測定不変性の原則[^measurement-invariance] | 採用する共通地平$h$と実務上の閾値 |
| $G_{\mathrm{self}}(12\mathrm m)$ | BZM独自、未検証 | 資本自立を一つの経営状態として定義すること | 起業成功の普遍的定義、12か月が最適な窓という主張 |
| $\mathrm{SPS}_{\mathrm{all}}=\sum q_oP_o$ | 文献由来、BZM独自 | 相互排他的で網羅的な事象分解による条件付き期待値 | 経路集合$\mathcal O$の完全性、各$q_o$と$P_o$の正しさ |
| $\mathrm{SPS}_{G}=q_GP_G$ | BZM独自 | 一経路の期待値寄与としての代数 | これを全経路のモデル上の総持分価値または市場時価総額と呼ぶこと |
| 学習後の継続、拡張、放棄 | 文献由来、文献整合 | 技術投資の実物オプションと適応的な資源再構成[^real-options][^dynamic-capabilities] | BZMの具体的な意思決定規則と介入効果 |
| 政策上の立ち位置を共通状態として扱う | 文献整合、未検証 | 著名な提携先や支援者が若い企業の資源獲得と評価へ関係する実証[^endorsement] | LSTの政策上の立ち位置が各工程を因果的に何ポイント動かすか |
| 七つのキラー要素 | BZM独自、未検証 | 創業チーム、CEO交代、専門経営化が成果と関係する研究[^new-venture-teams][^founder-succession][^professionalization] | 七分類の網羅性、分類間の独立性、一律の減衰率、増分予測力 |
| 大学発PJのネットワークと起業能力 | 文献整合 | 創業者の社会関係、機会精緻化、資源活用、推進者形成と大学発企業の帰結との関係[^university-startups][^academic-entrepreneurship] | AMDの現行入力がそれらを正しく測ること |
| 社会要素の三経路 | 文献整合、BZM独自 | 投資家の選好が価格と資本配分へ影響しうる理論[^sustainable-investing] | 個別PJの外部便益が自動的に株価へ完全資本化されること |
| chain of title、FTO、ライセンス条件の分離 | 文献由来、制度整合 | 技術移転契約で権利範囲、地域、用途、再許諾、開発義務を区別する実務原則[^wipo-license][^meti-collaboration] | 各条項がBZMの$q_{\mathrm{plan}}$、$Q_\tau(h)$、$q_o$、$P_o$へ与える定量効果 |
| 構成概念妥当性と予測妥当性を分ける | 文献由来 | 構成概念を支える理論ネットワークと、説明モデルと予測モデルの区別[^construct-validity][^explain-predict] | BZMが妥当な構成概念を測り、将来を当てること |
| Brier score、log score、校正曲線で比較する | 文献由来 | 確率予測を適切なスコアと校正で評価する原則[^proper-scoring] | SPSが基準モデルより良いこと |

## 7. 修正後の再監査ゲート

P0を文書へ追記しただけでは再監査を通過しない。

式、抽出台帳、入力、計算コード、画面表示、保存データの同じ意味が再現できる必要がある。

| ゲート | 通過条件 | 不通過条件 |
|---|---|---|
| G0 主張同期 | 旧期待時価総額表記が正本と画面から消え、$q_{\mathrm{plan}}(H_v)$、$Q_\tau(h)$、$q_G(H_{\mathrm{econ}})$、$P_{G,\mathrm{plan}}(H_v)$、$P_G(H_{\mathrm{econ}})$、$q_o(H_{\mathrm{econ}})$、$P_o(H_{\mathrm{econ}})$、$\mathrm{SPS}_{G,\mathrm{plan}}(H_v)$、$\mathrm{SPS}_G(H_{\mathrm{econ}})$、$\mathrm{SPS}_{\mathrm{all}}(H_{\mathrm{econ}})$の名称と条件キーが一致する | 一つでも旧$qP$または$\mathrm{SPS}_{G,\mathrm{plan}}(H_v)$を全経路の総持分価値と表示する |
| G1 価値式 | $H_{\mathrm{econ}}$を固定し、$G_{\mathrm{plan}}$、$G_{\mathrm{late}}$、非$G$を含む$\mathcal O$が相互排他的かつ網羅的で、$\sum_o q_o=1$となり、経路別$P_o$を同じ評価日と通貨で再計算できる | 期限後$G$、非$G$価値、到達前費用、将来希薄化、残余経路を落とす |
| G2 評価整合 | FCFFとWACC、FCFEと株主資本コスト、実確率と確率的割引因子、リスク中立確率と無リスク割引の四方式から採用した一方式で、総持分価値と証券クラス価値を別々に再現できる | 方式を混ぜてリスクまたは失敗確率を二重投入する、または持分権利を二重控除する |
| G3 測定再現性 | 独立した二名以上が同じ資料締切からグラフと主要入力を作り、差異と協議前の値を保存する | 協議後の一点しか残さない、または質問文と条件を再現できない |
| G4 PJ比較 | 共通地平の$Q_\tau(h)$を使い、splitとmergeの許容差を結果を見る前に固定する | PJごとの$H_v$を比較値へ使う、またはグラフ粒度で順位が任意に変わる |
| G5 産学連携 | 権利、FTO、ライセンス、大学承認の証拠が$q_{\mathrm{plan}}$、$Q_\tau(h)$、$q_o$の対応する工程入力と経路別CFへ一意に写る | option段階をlicense成立と扱う、または権利保有だけでFTO成立と扱う |
| G6 前向き予測 | 連続登録したPJを基礎発生率、TRL単独、独立専門家判断と比較し、校正、Brier skill、log lossを報告する | 成功例だけを分母にする、未来情報を補完する、基準モデルを置かない |
| G7 意思決定価値 | SPSを使う判断が基準運用より純便益を改善し、追加工数と誤判断の費用を含めて報告する | 数式上SPSが動いたことを外部成果の改善とみなす |

G6の必要標本数と許容差は、結果を見る前に精度または検出力にもとづいて事前登録する。

前向き検証が0件の現時点では、G6とG7は自動的に不通過である。

## 8. 最小反証試験

次の試験は、モデルを擁護するためではなく、誤っている場合に止めるために行う。

| 試験 | 手順 | 棄却または改訂条件 |
|---|---|---|
| 共通地平試験 | 同じPJについて$H_v$だけを延長し、$q_{\mathrm{plan}}$、$Q_\tau(h)$、$\mathrm{SPS}_{\mathrm{all}}$を再計算する | 実工程とCFを変えていないのに$Q_\tau(h)$または$\mathrm{SPS}_{\mathrm{all}}$が動く |
| 経路被覆試験 | 資本自立前のM&A、ライセンス、知財売却、期限後事業化の事例を入力する | 実現価値が非$G$経路へ残らず0になる |
| splitとmerge試験 | 同じ事象を粗いグラフと細かいグラフで独立評価する | モンテカルロ誤差を超えて$q_{\mathrm{plan}}$、$Q_\tau(h)$、$q_o$または順位が実質的に変わる |
| 適応方針試験 | 継続、ピボット、放棄を選べる経路と固定計画を同じ証拠で比べる | 選択肢の価値を持つPJほど一律に低くなる、または放棄による損失回避を表せない |
| キラー増分妥当性試験 | 情報締切前のキラー証拠を固定し、事前登録した対象$q_{\mathrm{plan}}$または$q_o$の基礎モデルに対するBrier scoreとlog lossの改善を前向きに測る | 改善しない、符号が安定しない、または発生判定が評価者で再現しない |
| 共通状態試験 | $Z_{\mathrm{policy}}$の観測証拠、影響工程、織り込み済み入力を固定し、状態なしの反実仮想と比べる | 影響経路が特定できない、二重加点が起きる、または将来成果との関係が再現しない |
| 産学連携境界試験 | 権利保有だがFTOなし、共有特許だが必要同意なし、option段階だがlicense未締結の三ケースを入れる | 到達または価値が成立済みと判定される |
| 証券ウォーターフォール試験 | 事業価値と総持分価値を固定し、優先条件だけを変える | 他条件が同じなのに$\mathrm{SPS}_{\mathrm{all}}$が動く、または証券クラス価値が動かない |
| 前向き比較試験 | 全登録PJを失敗、停止、未調達を含めて追跡し、基礎発生率、TRL、独立専門家判断と比較する | 校正または意思決定純便益に増分がなく、複雑さと取得負担だけが増える |

## 9. 監査結論

BZM 2.0は、ディープテックPJの工程、資金、権利、組織状態を同じ情報締切で再構成する研究基盤として残せる。

ただし、その基盤から計算した数を比較可能な確率、全経路のモデル上の総持分価値、投資配分へ読み替えるには、P0の構造修正と前向き検証が必要である。

修正後も、文献に整合することは予測が当たることを意味しない。

文献が支えるのは、使うべき概念、分けるべき量、検証方法、既知の失敗可能性である。

BZM独自の到達目標、工程グラフ、キラー分類、社会要素の写像、PJ順位は、AMDの前向きデータで別に検証する。

## 10. 一次資料と査読文献

[^present-value]: Financial Accounting Standards Board, [Statement of Financial Accounting Concepts No. 7: Using Cash Flow Information and Present Value in Accounting Measurements](https://storage.fasb.org/Concepts_Statement_7_As_Amended.pdf), 2000, amended 2008.

[^sdf]: Hansen, L. P. and Richard, S. F., [The Role of Conditioning Information in Deducing Testable Restrictions Implied by Dynamic Asset Pricing Models](https://larspeterhansen.org/lph_research/the-role-of-conditioning-information-in-deducing-testable-restrictions-implied-by-dynamic-asset-pricing-models/), *Econometrica*, 55(3), 1987, 587–613.

[^private-capital]: International Private Equity and Venture Capital Valuation Board, [International Private Equity and Venture Capital Valuation Guidelines](https://www.privateequityvaluation.com/Portals/0/Documents/Guidelines/IPEV%20Valuation%20Guidelines%20-%20December%202022.pdf), December 2022, and Gornall, W. and Strebulaev, I. A., [Squaring Venture Capital Valuations with Reality](https://www.sciencedirect.com/science/article/abs/pii/S0304405X19301692), *Journal of Financial Economics*, 135(1), 2020, 120–143.

[^entrepreneurship-performance]: Murphy, G. B., Trailer, J. W. and Hill, R. C., [Measuring Performance in Entrepreneurship Research](https://doi.org/10.1016/0148-2963(95)00159-X), *Journal of Business Research*, 36(1), 1996, 15–23, and Delmar, F., Davidsson, P. and Gartner, W. B., [Arriving at the High-Growth Firm](https://doi.org/10.1016/S0883-9026(02)00080-0), *Journal of Business Venturing*, 18(2), 2003, 189–216.

[^staging]: Gompers, P. A., [Optimal Investment, Monitoring, and the Staging of Venture Capital](https://doi.org/10.1111/j.1540-6261.1995.tb05185.x), *The Journal of Finance*, 50(5), 1995, 1461–1489.

[^real-options]: McGrath, R. G., [A Real Options Logic for Initiating Technology Positioning Investments](https://doi.org/10.5465/AMR.1997.9711022113), *Academy of Management Review*, 22(4), 1997, 974–996.

[^dynamic-capabilities]: Teece, D. J., Pisano, G. and Shuen, A., [Dynamic Capabilities and Strategic Management](https://doi.org/10.1002/(SICI)1097-0266(199708)18:7%3C509::AID-SMJ882%3E3.0.CO;2-Z), *Strategic Management Journal*, 18(7), 1997, 509–533, and Eisenhardt, K. M. and Martin, J. A., [Dynamic Capabilities: What Are They?](https://doi.org/10.1002/1097-0266(200010/11)21:10/11%3C1105::AID-SMJ133%3E3.0.CO;2-E), *Strategic Management Journal*, 21(10–11), 2000, 1105–1121.

[^expert-judgement]: Hanea, A. M., Hemming, V. and Nane, G. F., [Uncertainty Quantification with Experts: Present Status and Research Needs](https://doi.org/10.1111/risa.13718), *Risk Analysis*, 42(2), 2022, 254–263.

[^academic-entrepreneurship]: Rasmussen, E., Mosey, S. and Wright, M., [The Evolution of Entrepreneurial Competencies: A Longitudinal Study of University Spin-Off Venture Emergence](https://doi.org/10.1111/j.1467-6486.2010.00995.x), *Journal of Management Studies*, 48(6), 2011, 1314–1345.

[^support-theory]: Tversky, A. and Koehler, D. J., [Support Theory: A Nonextensional Representation of Subjective Probability](https://doi.org/10.1037/0033-295X.101.4.547), *Psychological Review*, 101(4), 1994, 547–567.

[^pert]: Malcolm, D. G., Roseboom, J. H., Clark, C. E. and Fazar, W., [Application of a Technique for Research and Development Program Evaluation](https://doi.org/10.1287/opre.7.5.646), *Operations Research*, 7(5), 1959, 646–669.

[^measurement-invariance]: Steenkamp, J.-B. E. M. and Baumgartner, H., [Assessing Measurement Invariance in Cross-National Consumer Research](https://doi.org/10.1086/209528), *Journal of Consumer Research*, 25(1), 1998, 78–90.

[^endorsement]: Stuart, T. E., Hoang, H. and Hybels, R. C., [Interorganizational Endorsements and the Performance of Entrepreneurial Ventures](https://doi.org/10.2307/2666998), *Administrative Science Quarterly*, 44(2), 1999, 315–349.

[^new-venture-teams]: Klotz, A. C., Hmieleski, K. M., Bradley, B. H. and Busenitz, L. W., [New Venture Teams: A Review of the Literature and Roadmap for Future Research](https://doi.org/10.1177/0149206313493325), *Journal of Management*, 40(1), 2014, 226–255.

[^founder-succession]: Wasserman, N., [Founder-CEO Succession and the Paradox of Entrepreneurial Success](https://doi.org/10.1287/orsc.14.2.149.14995), *Organization Science*, 14(2), 2003, 149–172.

[^professionalization]: Hellmann, T. and Puri, M., [Venture Capital and the Professionalization of Start-Up Firms: Empirical Evidence](https://doi.org/10.1111/1540-6261.00419), *The Journal of Finance*, 57(1), 2002, 169–197.

[^university-startups]: Shane, S. and Stuart, T., [Organizational Endowments and the Performance of University Start-Ups](https://doi.org/10.1287/mnsc.48.1.154.14280), *Management Science*, 48(1), 2002, 154–170.

[^sustainable-investing]: Pástor, Ľ., Stambaugh, R. F. and Taylor, L. A., [Sustainable Investing in Equilibrium](https://doi.org/10.1016/j.jfineco.2020.12.011), *Journal of Financial Economics*, 142(2), 2021, 550–571.

[^wipo-license]: World Intellectual Property Organization, [Technology Transfer Agreements](https://www.wipo.int/en/web/technology-transfer/agreements) and [Successful Technology Licensing](https://www.wipo.int/publications/en/details.jsp?id=296&plang=EN).

[^meti-collaboration]: 経済産業省, 文部科学省, [産学官連携による共同研究強化のためのガイドライン](https://www.meti.go.jp/policy/innovation_corp/guideline.html), 2016, 2020年追補.

[^construct-validity]: Cronbach, L. J. and Meehl, P. E., [Construct Validity in Psychological Tests](https://doi.org/10.1037/h0040957), *Psychological Bulletin*, 52(4), 1955, 281–302.

[^explain-predict]: Shmueli, G., [To Explain or to Predict?](https://doi.org/10.1214/10-STS330), *Statistical Science*, 25(3), 2010, 289–310.

[^proper-scoring]: Gneiting, T. and Raftery, A. E., [Strictly Proper Scoring Rules, Prediction, and Estimation](https://doi.org/10.1198/016214506000001437), *Journal of the American Statistical Association*, 102(477), 2007, 359–378.
