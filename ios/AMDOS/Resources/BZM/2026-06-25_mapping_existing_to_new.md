# 既存 bzm/ 章 → 新 Book 0-VI 配置 mapping (節レベル)

*生成: 2026-06-25 / source: workflow `wl8pcv7wl` (5 agents, 363k tokens, 3 min)*

*位置付け: 既存 bzm/ 章 md (preface / field-* / why-valuation / model-overview / p / r / s / strategic-slack / score / model-critiques / retrofit / nursery-ers / ethics) を新 Book 0-VI 構造 ([2026-06-25_proposal_book0_vi.md](/bzm/2026-06-25_proposal_book0_vi)) のどの章のどこに移すかを節レベルで mapping。Book II 執筆着手の準備物。*

**target_role の意味**:
- `primary`: 該当章の中心素材として使う
- `secondary`: 補助素材 / 参照として引用
- `reference`: 言及のみ、内容は別所
- `rewrite_substantially`: 元素材は素材として残るが、新章で大幅 rewrite

---

## 1. 新章ごとの素材集約 (target_chapter view)

新 Book 0-VI のどの章にどの既存節が集まるか。執筆時はここから素材を引いてくる。

### Ch 0.0 (12 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `preface` | 誰のための本か | URA/研究者/若手/VC など想定読者列挙 | secondary | 射程と匿名化方針の章で読者像として要約。学術書向けに簡素化 |
| `preface` | 本書の構成 | 旧4部+補論構成の案内表 | rewrite_substantially | 新 Book 0-VI 構造に全面書き換え。旧4部表は廃棄 |
| `preface` | どこから読むか | 読者タイプ別の入口案内 | reference | 新構造に合わせて入口ガイドを再構成 |
| `preface` | 本書が約束しないこと | 投資助言でない/モデルは判断の代わりでない 等の限界 | secondary | 射程と匿名化方針に統合。倫理・著者性の一部は付録Cにも |
| `ethics-and-authorship` | 冒頭 (ストーリーから始めない理由) | 本書の語る位置 (著者性/利害) を本文外に逃さないという宣言 | primary | Book 0 Ch 0.0 射程と匿名化方針の front-load |
| `ethics-and-authorship` | ## なぜ、この章を巻末に置くのか | モデル批判と立場批判の区別、出版倫理 | primary | 新構造では front-load (Ch 0.0) と末尾 (Ch 38 後の付記) に二分割の可能性 |
| `ethics-and-authorship` | ## 批判 (1) — これは支援者の営業資料ではないか | 支援者バイアス自覚と本文が守る三つの線 | primary | Ch 0.0 匿名化方針 + 著者立場明示 |
| `ethics-and-authorship` | ## 批判 (2) — 研究者や大学を代弁する資格があるのか | 元アカデミアでも代弁資格はない、当事者の声が消える構造を書く | primary | Ch 0.0 著者性宣言 + Ch 38 新領域宣言の謙抑性 |
| `ethics-and-authorship` | ## 批判 (4) — 匿名化された実例は、都合よく作られていないか | composite case の限界、検証手続きを別に置く | primary | Ch 0.0 匿名化方針 + Ch 26b registry |
| `ethics-and-authorship` | ## 批判 (5) — 当事者の経験を、著者の知的資産として回収していないか | 経験の倫理的扱い、書き方の倫理 5 線 | primary | Ch 0.0 匿名化方針 |
| `ethics-and-authorship` | ## 批判 (8) — 執筆過程と責任の所在 | 編集過程と最終責任、読者が気にする境界の明示 | primary | Ch 0.0 author's note |
| `ethics-and-authorship` | ## 編集上の運用 — 批判をどう本文に反映するか | 4 つの編集運用ルール (立場開示/強実例の弱化/社会実装の非一方向性/批判余地) | rewrite_substantially | Book 0 全体への運用ルール — Ch 0.0 author's note と編集方針として書き直し |

### Ch 0.1 (5 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `preface` | 序章 — この本の読み方 (intro paragraph) | 研究成果が会社になるまでの Before Zero 時間の壊れやすさを宣言する hook | primary | 領土宣言の冒頭 hook 素材として再利用。Tier3 学術モノグラフ向けに筆致は調整 |
| `field-before-zero` | (冒頭ストーリー: 強すぎた一文) | 若手事業化担当が発表スライドを盛ってしまうエピソード | primary | Book0 の領土宣言冒頭 hook として最有力。Ch 27 (掘り起こし) でも secondary 引用可 |
| `field-before-zero` | 熱意だけでは、会社にならない | シーズ/URA/TLO/GAP の用語定義 + 判断の宙づり構造 | primary | 用語定義は Ch 0.0 にも分割。判断の宙づりは Ch 4 (失敗パターン抽象) で再活用 |
| `why-valuation-fails` | 冒頭ストーリー (URA・5年後売上30億円) | URAが事業計画の数字に振り回される導入ストーリー、評価額が場面ごとに別の顔を持つ | secondary | 領土宣言の動機づけ素材。Ch 4 (失敗パターン抽象) でも再利用可能 |
| `model-overview` | 冒頭ストーリー (支援チーム月例会議、三案件) | 断熱素材/計測装置/エネルギー変換の三件で物差しが噛み合わない | secondary | 領土宣言の motivating story。Ch 2 PRS 概念導入にも再利用 |

### Ch 0.2a (7 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `why-valuation-fails` | Valuation とは何か — まず道具を正しく知る | DCF の定義と式、適用範囲の問題提起 | primary | 四スクール継承の中でファイナンス/Valuation スクールの限界を扱う節の核 |
| `why-valuation-fails` | 第一の壁 — 前提がすべて仮定になる | 設立前 CF 実績ゼロ、仮定の積み上げで数倍ぶれる | primary | Valuation 限界の論拠1 |
| `why-valuation-fails` | 第二の壁 — 期待 (ハイプ) を測ってしまう | Valuation は期待ベースで分野ハイプを混ぜ込む | primary | Valuation 限界の論拠2。Ch 10 OPENER のハイプ動学と接続可 |
| `why-valuation-fails` | 第三の壁 — 単一の値は律速を隠す | 単一値は内訳/律速を隠す、A/B 例 | primary | Ch 4 失敗パターンとも連動。律速概念の初出 |
| `why-valuation-fails` | 第四の壁 — 「死なない力」を測る軸がない | ディープテック死因は資金/選択肢切れ、DCFは割引率に隠す、Jカーブ一律適用問題 | primary | Ch 3 ERS 概念と Ch 8 戦略余力動学への導入。Jカーブ批判は Ch 4 にも分岐 |
| `why-valuation-fails` | 章末の問い — 現場で使うチェック | 8 項目の現場チェック | reference | Book 0 末尾の練習問題として残す。一部 Ch 4 へ |
| `model-overview` | DCFは何を測っていたのか — 標準手法との関係 | DCFは P のみを測っていた、本モデルは上位互換 | primary | 四スクール継承 (ファイナンススクール) の総括。Ch 2 末尾にも参照 |

### Ch 0.2b (2 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `field-before-zero` | スタートアップの教科書は、ゼロの後から始まる | リーンスタートアップ等が Zero 以後を前提とする限界 | primary | 未engage lit (リーン/Disciplined Entrepreneurship) との対比に流用 |
| `model-overview` | モデルの進化 — 「測れていないもの」を埋めてきた歴史 (第1/2/3 世代) | 統合 readiness → P×R×S → 戦略余力動学統合への世代進化 | rewrite_substantially | 未engage lit (BZSF 自身の進化史) として再構成。Ch 0.4 三貢献 front-load と Ch 26a calibration に... |

### Ch 0.3 (5 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `field-toolkit` | 章末に — 道具についての三つの総注意 | 道具は会話の代わりでない/グッドハート/書き換え推奨 | primary | 二層 readiness 方法論章の警句。グッドハートは Ch 36 (機関 KPI) にも |
| `field-who-carries` | 第I部の終わりに — 問いを、測れる形へ | 現場問いを測れる形に変える宣言 | primary | 二層 readiness 方法論の橋渡しに最適 |
| `model-overview` | 判定層と動学層 — モデルの二層構造 | 判定層 (スナップショット) と動学層、σ_SU と戦略余力動学の対称性 | primary | 二層 readiness 方法論章の中核導入。Ch 5 Triple Helix SSM と Ch 8 戦略余力動学への入口 |
| `model-overview` | 進化が教えること | 過去ケース当てはめで欠落を発見する方法論 | primary | 二層 readiness 方法論の retrofit verification 観点。Ch 26b prediction registry とも連動 |
| `nursery-ers` | ## なぜ『土壌』を独立に測るのか | 二層 readiness の理論的根拠 — 時間尺度の違い、支援ギャップ可視化 | primary | Book 0 Ch 0.3 二層 readiness 方法論の front-load。Ch 9 二層非可換性にも |

### Ch 1 (3 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `field-before-zero` | Before Zero とは何か | ゼロ/Before Zero の定義、初期条件表、フェーズ表 | primary | Ch1 状態空間と観測量の章で「領土の輪郭」として再利用。表は変数化の素材 |
| `field-before-zero` | 何がまだ不確実なのか — 七つの領域 | 再現性/用途/顧客/知財/担い手/資金/制度 の七不確実性 | primary | 状態空間 X の観測量に直接マップ。Ch 4 (失敗パターン) でも参照 |
| `field-clocks` | 関係者×関心×時計の地図 | 研究者/大学/企業/VC/行政/支援者の時計一覧表 | primary | 状態空間の観測量 (関係者軸) に変換。Ch 27-31 各章でも参照 |

### Ch 2 (8 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `field-who-carries` | 創業者機能の分解 — 二択をやめる | CEO肩書き批判と五機能分解表 | primary | PRS の人的軸 (担い手) の概念基盤。Ch 30 (設立) にも |
| `field-who-carries` | 研究に残るべきもの、移せるもの | 技術の核と真正性は移せない、経営実務は補完可 | primary | PRS 概念。Ch 33 (EIR) にも |
| `why-valuation-fails` | では、何を測ればよいのか — 天井 × 到達 × 生存 | PRSの三因子分解、表で Valuation との対応 | primary | PRS 概念章の中核導入。Ch 0.4 三貢献 front-load にも要約を抜粋 |
| `model-overview` | 三つの正しさは、なぜ噛み合わなかったのか | PRS 三因子に名前を与え、価値を積で書く骨格 | primary | PRS 概念章の中核。Ch 0.4 にも要旨抜粋 |
| `model-overview` | なぜ積なのか — 期待値の標準分解 | E[価値] = P × Pr(到達) = P × R × S、登山アナロジー | primary | PRS の理論的根拠。Ch 6 PRS 期待値分解で数学的に再展開 |
| `model-overview` | 積であることの意味 | 掛け算ゆえ最弱因子が支配、律速診断が式から導ける | primary | Ch 4 律速失敗パターン、Ch 25 層間結合とも連動 |
| `model-overview` | 冒頭の三件を読み直す | 三件を PRS で再評価する表 | secondary | Ch 12-19 retrofit の prototype として位置づけ |
| `model-overview` | 章末の問い — 現場で使うチェック | 8 項目の PRS チェック | reference | PRS 概念章末の練習問題として保持 |

### Ch 3 (6 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `field-who-carries` | (冒頭ストーリー: 最後は誰が背負うんですか) | 研究者が責任の所在を問い、五機能分解が始まる場面 | primary | ERS 概念章の hook。研究者責任の非対称は Ch 33 にも |
| `field-who-carries` | 「誰が背負うのか」は、なぜ空欄になるのか | 足し算支援の限界、研究者が背負うものの表 | primary | ERS の機関側軸の動機。Ch 32 (ERS 8軸処方) でも引用 |
| `model-overview` | なぜ戦略余力を「10本目の軸」にしないのか | 時間スケール不一致と二重計上回避、不可逆達成は R、消費可能資源は y | primary | ERS 概念章で軸設計の根拠として再配置。Ch 8 戦略余力動学にも参照 |
| `s-survival` | 死因の第一位に、名前を付ける | ディープテックの死因は技術劣後ではなく、本命整備前の資金・選択肢枯渇であると定義。 | secondary | ERS 概念導入というよりは PRS の S 因子独立性の根拠。Ch 7 冒頭でも再掲。Ch 4 (失敗パターン抽象) でも参照。 |
| `strategic-slack` | なぜ「死なない力」を独立に測るのか | moat 削減と外部接触のジレンマ。S 独立化の動機。 | secondary | Ch 3 PRS 概念の S 独立化動機。Ch 8 冒頭にも要約再掲。 |
| `nursery-ers` | ## 機関整備度は 8 つの軸で見る | ERS 8 軸定義 + TLO/EIR/ギャップ資金/COI 用語 | primary | Ch 3 ERS 概念の核心定義。Ch 32 で軸別処方に展開 |

### Ch 4 (7 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `field-clocks` | 「温度差」ではなく「時計の差」と呼ぶ理由 | 温度差概念の批判と時計概念への置換 | primary | 失敗パターン抽象の中核。合理性の概念は Ch 10 (OPENER) と接続 |
| `field-clocks` | 正しい圧力どうしの、未調整 | 急がせる/盛らせる/開示を誤らせるの三圧力 | primary | 失敗パターンの抽象化素材。Ch 28 (第一歩) にも secondary |
| `field-gates` | (冒頭ストーリー: 送信予約と登記の軽い一言) | 開示メール送信予約と登記提案が同日に起きる場面 | primary | 失敗パターン抽象の hook。Ch 29 (GAP), Ch 30 (設立) でも分割引用 |
| `field-gates` | 取り返しのつく失敗と、つかない失敗 | 鬼門の不可逆性概念 | primary | 失敗パターン抽象の核。Ch 5/Ch 8 の非可換性とも接続 |
| `field-who-carries` | 失敗を学習に変える — 記録の粒度がすべてを決める | 粗い記録の人格化、四原因分解、四行ログ | primary | 失敗パターン抽象の核。付録C (やらかし図鑑) にも primary |
| `why-valuation-fails` | 実例 — 評価額が測らなかったもの (ケース1/ケース2) | 高評価で沈んだ材料系、評価なしで生き残った装置系 | primary | 失敗パターン抽象の典型例として再配置。Ch 12-19 retrofit の前哨 |
| `model-overview` | 実例 — 同じ準備度に見えた二つのプロジェクト (高機能素材/医療系) | 同じ readiness でも P と S 設計で結末が分かれた事例 | primary | 失敗パターン抽象の典型例。Ch 12-19 retrofit の素材としても抜粋可 |

### Ch 6 (22 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `p-potential` | 冒頭ストーリー (水処理膜面談 / 不整地ロボット) | 1兆円TAMで沈黙する投資家と、市場小と門前払いされたロボットの対比導入 | secondary | Ch 6冒頭のmotivating vignetteとして簡潔化して残す。詳細retrofitはBook III Ch 12-19へ移植候補 |
| `p-potential` | 天井という考え方 — P は何を測るか | P×R×S 積構造の導入とDCFとの役割分担。Pは大風呂敷、RとSが実現可能性 | primary | Ch 6 PRS期待値分解の導入節として中核。式表示は付録A数学補遺と二重化 |
| `p-potential` | 1つの数字に2つの役割を負わせない — 絶対スケールと達成率 | 絶対スコアと達成率の分離。投資配分 vs 運用評価 | primary | PRS期待値分解の解釈論として保持。Ch 26a calibrationとも相互参照 |
| `p-potential` | 天井はなぜ測りにくいか — TAM は最も盛られやすい数字 | TAM/SAM/SOM三層と TAMが盛られる構造的理由 (安い・見栄え・検証遅延) | primary | P観測の中核議論。Ch 4 失敗パターン抽象とも接続 (TAM-only失敗型) |
| `p-potential` | 証拠の質で刻む — 三つの物差し | 第三者データ・ユニットエコノミクス・経路具体性の三軸で証拠の質を評価 | primary | Ch 6内の操作的定義の核。付録Bデータ仕様/registryで観測項目スキーマ化 |
| `p-potential` | P 大だけではダメ、P で落とすべき案件もある | 積構造ゆえP単独では不十分、しかし原理コスト下限のP低はSで救えない | primary | Ch 6で保持しつつ、Ch 4失敗パターン (P-floor型) とCh 9 ERS統合への伏線 |
| `p-potential` | 天井は動く — P は戦略の関数である | 機会創造観の取り込み、P(t)=max_u P_u、U(t)拡張が経営の打ち手 | primary | Book II 数学装置の中核。Ch 0.2a 四スクール継承 (Sarasvathy系) との接続注記。Ch 8戦略余力動学のBATNA議論とも相互参照 |
| `r-readiness` | 冒頭ストーリー (ガス分離膜面談) | 「技術はできています」が三者三様に受け取られる導入 | secondary | R概念のmotivating vignette。Ch 3 ERS概念とも一部素材共有候補 |
| `r-readiness` | 到達度 R とは何か — 五枚に割って測る | R不可逆性、五軸 TRL/BRL/GRL/SRL/HRL の導入、0-9段階 | primary | Ch 6のR分解定義。ただしR五軸は本来ERS(Ch 3/9)の8軸とも関連—Ch 9 ERS加重和との関係を再整理する必要あり |
| `r-readiness` | TRL — 技術はどこまで「作れる」か / 応用×組織マトリクス | TRLを応用×組織のマトリクスで持ち最小値で読む。研究室セルvs自社セルのギャップ | primary | Ch 6 R分解の象徴節。min演算子はBook II数学装置として付録Aへ二重化 |
| `r-readiness` | BRL — 事業はどこまで検証されたか | 仮説→検証→拡大の三段階、対価を得た検証の重み | primary | 対価検証→Ch 8戦略余力の余力補充議論と相互参照 |
| `r-readiness` | GRL — 制度の関門をどこまで通したか | 規制リスク特定・届出認証・標準化、遅効性 | primary | 遅効性議論はCh 8動学/Ch 11 jump+gateと相互参照 |
| `r-readiness` | SRL — 社会はそれを受け入れるか / マクロ追い風と社会受容の別物性 | SRL独立軸の必要性、GMO欧州事例で追い風と受容の乖離 | primary | Ch 9 ERS二層非可換性 (マクロ風 vs 社会受容) の伏線。Ch 10 OPENERにも接続 |
| `r-readiness` | HRL — 作り続けられる人と組織があるか | チーム補完性、属人性、創業者個人資質はHRLに含めずSに置く | primary | 創業者個人質→Ch 7 S内部F-CESに渡す境界線が重要 |
| `r-readiness` | R と戦略余力の線引き — 不可逆な達成と使えば減る資源 | R(不可逆ストック) vs y(消費可能フロー) の線引き、特許の両義性 | primary | Ch 6→Ch 8戦略余力動学への橋。特許R/y分解は Ch 8でも再掲。state space (Ch 1) 定義にも関与 |
| `score-and-bottleneck` | ## 計算は9本の軸で行う — P・R・S は概念のラベル | P/R/S は概念ラベルで実計算は 9 軸同格の積、軸テーブル提示 | primary | Ch 6 (PRS 期待値分解) の核心。P/R/S が独立因子ではなくラベルである旨と 9 軸定義を Ch 6 に移植 |
| `score-and-bottleneck` | ## なぜ掛け算か — Cobb-Douglas という選択 | 加重和/min/Cobb-Douglas の比較、律速表現可能性、CES 補完性 | primary | Ch 6 の Cobb-Douglas 導出。Ch 9 (ERS 加重和) との対比軸として重要 — 'なぜ案件は積、機関は和か' の伏線 |
| `score-and-bottleneck` | ## +1 シフトの2つの役割 | ゼロ消滅回避と対数スケール読みやすさの説明 | primary | Ch 6 内の式設計の technical note。付録 A へ一部移しても可 |
| `score-and-bottleneck` | ## 実用の核心 — 律速診断 | 偏微分から α/(X+1) の bottleneck 定義導出 | primary | Ch 6 PRS 期待値分解の応用、または Ch 5.5 GO 導出と並ぶ数学装置 |
| `score-and-bottleneck` | ### 律速診断の読み方 — 三つの注意 | 効き目 vs 上げやすさ、構造的ゼロの読み替え、スコアと診断の用途分け | primary | 実務的注意点として Ch 6 末尾。または Ch 35 政策含意にも一部反響 |
| `score-and-bottleneck` | ## 章末の問い | 8 項目の現場チェックリスト | secondary | 各章末問いとして再配置 — Book II Ch 6 末尾 |
| `model-critiques` | ### 批判 1 — 機会は発見されるのではなく、創造される | エフェクチュエーションと P の動的扱い、許容可能損失 = y | secondary | Ch 6 PRS 期待値分解に P の動的更新を明記。Ch 38 新領域宣言で発見/創造観統合を主張 |

### Ch 7 (11 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `s-survival` | 冒頭ストーリー (審査会「この会社は死なないんですか」) | 年配審査委員が事業計画書の「死なない設計」欠如を一言で突くオープニング物語。 | primary | Ch 7 (S 内部 F-CES) の motivating story として冒頭に置く。Book III の機関 retrofit (Ch 20-24... |
| `s-survival` | 背骨は一本の不等式 — 生存条件式 (B - R_net ≤ F) | 生存不等式 B-R_net≤F の三項定義と読み方。 | primary | Ch 7 の数式装置の中核。Book II の数学装置として formal に書き直す。Ch 8 の動学とは静学/動学の対で配置。 |
| `s-survival` | 三つの項は、三つの経営の選択肢である | B/R_net/F それぞれが独立な打ち手 (規模縮小・自走収益・調達力) に対応。 | primary | Ch 7 の処方論。Book V (Ch 32) の ERS 軸別処方とも接続。 |
| `s-survival` | S の三つの要素 — どれかで補える | σ_SU (追い風) / R_net / F の三要素代替性とコブ・ダグラス型合成。 | primary | Ch 7 の主構造。Ch 5/5.5 の Triple Helix SSM の σ_SU 導出と連結。 |
| `s-survival` | 収益化指数 R_net — 「稼げる体質」を測る | つなぎ/先行収益を区別せず純キャッシュ貢献で測る。共食い型は負。 | primary | Ch 7 の R_net サブ節。Ch 4 失敗パターン (共食いつなぎ) とも参照。 |
| `s-survival` | 創業者要因 F — 資質と経営実行力の二層 | F を資質 (AL4次元+Grit+Resilience) と経営実行力 (経験序列) の二層に分解。 | primary | Ch 7 の F 二層構造。学術出典 (AL, Grit, Resilience, 創業チーム実証) は付録 A or B へ脚注移送。 |
| `s-survival` | 合成は「両方ないと成立しない」— CES | F=CES(F_char, F_cap; ρ=-2, a=0.6) の数式と数値例。 | primary | Ch 7 のタイトル「S 内部 F-CES」の中核。CES 数学的詳細は付録 A 数学補遺へ。 |
| `s-survival` | 章末の問い — 現場で使うチェック | S を現場で運用するための 8 問の self-check。 | rewrite_substantially | Book II 各章の章末問いとして再フォーマット。Book IV Ch 30 用と分割する可能性あり。 |
| `model-critiques` | ### 批判 5 — 生存確率は、状態ではなく『打ち手』の関数 | S の定義に『優れた伴走前提』を明記、支援価値 = Δ生存確率 | primary | Ch 7 S 内部 F-CES の前提明示 + Ch 33 GAP+URA+EIR の支援価値定義 |
| `model-critiques` | ### 批判 3 — 資質は本当に測れているのか | 構成概念妥当性、観察可能 Yes/No 化、複数評定者、blind 採点 | primary | Ch 7 (S 内部 F-CES) の F 採点方法論。Ch 26a 採点プロトコルにも |
| `ethics-and-authorship` | ## 批判 (6) — スコアや資質評価が、人を傷つけるのではないか | バイアス再生産、観察可能行動への分解、異議申し立て経路 | secondary | Ch 7 F-CES 採点方法論 + Ch 36 KPI 倫理 |

### Ch 8 (15 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `s-survival` | 次章への橋 — スナップショットから軌跡へ | S の静学から (x,y) 動学へのブリッジ。 | reference | Ch 7→Ch 8 のトランジションとして再構成。 |
| `strategic-slack` | 冒頭ストーリー (大手共同研究で買い叩かれた展示会案件) | 成果KPIに忠実な担当者が BATNA を失い、共同研究条件を三分の一に削られる物語。 | primary | Ch 8 の motivating story。KPI 病理は Book V (Ch 33 GAP/URA/EIR) でも参照。 |
| `strategic-slack` | 2 軸の地図 — 事業化到達度と戦略余力 | x (PRS 到達度・不可逆) と y (戦略余力・消費可能) の直交平面定義。 | primary | Ch 8 の状態空間定義。Ch 1 (状態空間と観測量) でも前方参照。 |
| `strategic-slack` | y = 0 は倒産だけを意味しない | y=0 を主導権喪失・希薄化・従属ライセンス等に拡張定義。 | primary | Ch 4 (失敗パターン抽象) でも引用。 |
| `strategic-slack` | 戦略余力の中身 — 五つの成分 | y を 現金/moat/信用/選択肢/集中力 の五成分に分解、月単位への換算と H=y/T_remaining 健全度指標。 | primary | Ch 8 の中核。H 指標は Ch 26a calibration とも接続。 |
| `strategic-slack` | 時間の中で見る — 鋸歯のグラフ | Before Zero → 設立 → バーン拡大 → 補充 → BEP の鋸歯軌跡。 | primary | Ch 8 動学描像。Ch 31 (調達) の補充タイミング論にも接続。 |
| `strategic-slack` | PoC と情報開示は「y を消費して x を買う投資」 | PoC 形態別の x↑/y↓ 表、交換効率の数式。 | primary | Ch 8 内の実務翻訳節。Ch 29 (GAP) でも参照。 |
| `strategic-slack` | 交換レートを決めるのは交渉力 | 交渉力の源泉 (相手切迫度・代替困難性・BATNA・証拠・権利・時間) と低/高状態の対比。 | primary | Ch 8 内の交渉力サブ節。Book V Ch 33 (URA/EIR) でも応用。 |
| `strategic-slack` | 開示は Lv1〜Lv4 で設計する | 情報開示 4 段階と NDA 限界、コミット交換設計。 | primary | Ch 8 の運用論。Ch 27 (掘り起こし)/Ch 29 (GAP) の現場フローでも引用。 |
| `strategic-slack` | 出口設計 — ライセンスか、自社事業化か | ライセンス vs 自社事業化を (x,y) 経路として再定義。 | primary | Ch 8 後半。Ch 31 (調達) や Ch 38 (新領域宣言) の出口多様化論にも接続。 |
| `strategic-slack` | 「ライセンスだと買い叩かれる」は本当か | 買い叩きの本質は契約形態でなく BATNA 欠如。4点セット (非独占/2社/自社オプション/マイルストン) の処方。 | primary | Ch 8 出口設計サブ節。Book III 防除剤ケース (Ch 12-19) と組で読む。 |
| `strategic-slack` | 生存確率への接続 — 軌跡は語る (S=Pr(τ_x<τ_y)) | S をギャンブラー破産型 Pr(τ_x<τ_y) で再定義。健全/ゾンビ/即落/鋸歯の4軌跡パターン。 | primary | Ch 8 と Ch 9 (ERS 加重和) を繋ぐ。軌跡パターン分類は Ch 4 (失敗パターン抽象) でも primary に展開。鋸歯型創薬は Ch ... |
| `strategic-slack` | 章末の問い — 現場で使うチェック | (x,y) 地図運用の 8 問チェックリスト。 | rewrite_substantially | Book II 章末問いとして再フォーマット。KPI 問は Ch 33 とも分担。 |
| `model-critiques` | ### 批判 2 — 余力は多いほど良いのか。逆U字 | 組織スラック逆U字、H = y/T_remaining の上側警戒帯 | primary | Ch 8 戦略余力動学に上側警戒帯の追加 |
| `model-critiques` | ### 批判 5 — 学習する力が、変数になっていない | 動的能力、交換効率を時間変数として追跡、支援価値の主経路 | primary | Ch 8 戦略余力動学に交換効率の時間変数化を追加。Ch 33 GAP+URA+EIR の支援価値定義に接続 |

### Ch 9 (6 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `r-readiness` | GRL と SRL の両義性 — 到達度であり、働きかけでもある | GRL/SRLは到達度であり同時に環境への働きかけ | secondary | 二層非可換性 (内側達成 vs 外側環境) の素材としてCh 9へ。Ch 6では短い注記 |
| `r-readiness` | 五枚をどう読み合わせるか — 凸凹 | 重要度差・時定数差・凸凹パターン診断・平均で読まない | primary | ERS加重和の動機付け。重み付け式は付録Aへ。Ch 6では定性版のみ |
| `score-and-bottleneck` | 冒頭ストーリー (桜が散ったあとの月曜日) | 九項目計画が三か月後に全て『継続検討』で止まり、顧問が『一つに絞れない物差し』を指摘する導入 | primary | Ch 9 (ERS 加重和 + 二層非可換性) の motivating story というより、Book II の統合スコア提示の動機付け。Ch 5-9... |
| `nursery-ers` | ### 充足率としての ERS — 計算のしかた | ERS = 100·Σw_k·A_k 加重和計算、レーダーで凹みを読む | primary | Ch 9 ERS 加重和 + 二層非可換性の数式核心 |
| `nursery-ers` | ## なぜ掛け算ではなく、加重和なのか | 案件は積/機関は和の数式の対比 — 外部連携で補える、欠損可視化目的 | primary | Ch 9 二層非可換性の核心論証 — Book II 全体の echo として最重要 |
| `nursery-ers` | ## 機関の評価と、案件の評価を混ぜない | 二重計上禁止、単発成功と pipeline 区別、二行に分ける作法 | primary | Ch 9 二層非可換性の運用作法。Ch 25 層間結合とも |

### Ch 11 (7 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `field-gates` | 判断の語彙 — 進める、待つ、止める、保留する | GO/WAIT/NO_GO/HOLD 四語彙 | primary | BVAR+jump+gate の gate 概念の素地。Ch 27-31 全体の judgement spine としても利用 |
| `field-gates` | WAIT は「何もしない」ではない | 戻る条件・見直し日・並行作業の三部品 | primary | gate 設計の実装。Ch 8 (戦略余力動学) とも接続 |
| `model-critiques` | ## 最大の批判 — 割引率は三つの仕事を束ねている | 割引率の3仕事 (失敗リスク/時間価値/市況連動) 分解と S が肩代わりできる範囲 | primary | Ch 11 BVAR+jump+gate に直結。時間価値ゲート設計に組み込む。Ch 38 でも参照 |
| `model-critiques` | ### 第一の仕事 — 失敗リスクの補正 | S は割引率より筋の良い置き場所 — 失敗確率のモデル化 | primary | Ch 7 (S 内部 F-CES) / Ch 11 の理論的正当化 |
| `model-critiques` | ### 第二の仕事 — 時間価値 | S は『いつ』を測れない、創薬 vs ロボティクス比較不可 | primary | Ch 11 gate 設計の根拠 — (スコア, 必要月数) の二次元ゲート |
| `model-critiques` | ### 第三の仕事 — 市況連動リスク | σ_SU 共通成分でポートフォリオの分散効果が過大評価される逆向き論点 | primary | Ch 11 BVAR の市況連動 factor 議論。Ch 35 政策含意にも反響 |
| `model-critiques` | ### 処方 — 時間と市況は、別の物差しで併読する | 二次元ゲート、低率時間割引の併読、ポートフォリオ共通ファクター開示の三処方 | primary | Ch 11 の gate + jump 設計の実装処方 |

### Ch 12 (4 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `score-and-bottleneck` | ## 例題 — 手を動かして一度計算する | 吸着材 PJ の 9 軸採点とスコア=45 の手計算 | primary | Book III の 8 PJ retrofit に組み込む匿名 motivating case。または Ch 6 例題として併用 |
| `score-and-bottleneck` | ### 例題のつづき — 九項目の計画を一つに絞る | 9 軸 α/(X+1) 計算で R_net 律速、$F$ + HRL 二番手 | primary | motivating case 続編 — Book III retrofit と連動 |
| `model-critiques` | ## 実例 — 物差しが歪み始めた、二つの場面 | 候補数の水増し (Goodhart) と医薬 vs 機械の時間軸無視の二場面 | secondary | Book III motivating case として再利用 (両方とも特定 PJ ではないので複数章に散らす可) |
| `retrofit-verification` | 冒頭ストーリー (段ボール二箱と進行中案件の既視感) | 終了案件を (x,y) 平面に描き直したら、進行中案件と同じ折れ線が見えた | primary | Book III の総 motivating frame として最適。retrofit 8 PJ の方法論の入口 |

### Ch 13 (1 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `score-and-bottleneck` | ## 実例 — 律速診断が、見たくない軸を指したとき | 機能性材料 PJ で F が律速と診断され、得意分野への重力に逆らった事例 | primary | Book III motivating case の一つ |

### Ch 25 (2 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `retrofit-verification` | ## 軌跡パターンは、実データで本当に分離するか | 健全/ゾンビ/即落/鋸歯 4 型と実データでの分離検証 | primary | Ch 25 層間結合 + Ch 26b prediction registry の軌跡型照合台帳 |
| `retrofit-verification` | ## R と y の線引きを、当てはめで確かめる | R と y の境界を retrofit で磨く方法論 | primary | Ch 25 層間結合の定義磨き。Ch 1-3 状態空間定義への frontloading 議論にも |

### Ch 27 (4 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `field-before-zero` | 章末の問い | 七不確実性チェック等の現場問い | secondary | 掘り起こし章の実務問いに移植。Ch 1 末尾にも reference |
| `field-clocks` | (冒頭ストーリー: 五つの締切が同じ週) | 金曜正午締切に五つの時計が重なる場面 | primary | 時系列スパインの掘り起こしフェーズ hook。Ch 4 でも引用 |
| `field-toolkit` | (冒頭ストーリー: 月曜の鞄の中身) | 道具を持たず問いを持って面談へ向かう若手の場面 | secondary | 掘り起こし章の補助素材。Tier3 では基本廃棄、エッセンスのみ |
| `field-toolkit` | 道具1: 初回面談の問いセット | 四束の問いと初回に聞かない問い | primary | 掘り起こしフェーズの実務テンプレ。付録Bにも |

### Ch 28 (3 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `field-clocks` | 時計のズレを読めると、何が変わるか | 企業/VC/行政/大学/研究者の時計の逆算術 | primary | 第一歩 (関係構築) 章の実務素材 |
| `field-clocks` | 章末の問い — 相手の時計を確認する | 時計逆算の現場問い | secondary | 第一歩章末問い |
| `field-toolkit` | 道具2: 現場メモの安全化手順 | 五つの印・固有名詞・本人確認・保存 | primary | 第一歩章。付録B (data spec) にも primary |

### Ch 29 (4 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `field-gates` | 鬼門その一 — 外部開示の順序 | 新規性喪失と開示順序、四つが同時に壊れる | primary | GAP章の中心素材。Ch 4 でも抽象パターンとして引用 |
| `field-gates` | 実例その一: 自分の発表に先を越された出願 | 開示順序事故 composite | primary | Book III pattern (Ch 12-19) にも retrofit 候補 |
| `field-gates` | 章末の問い | 鬼門前チェック | secondary | GAP章末問いと Ch 30 にも分散 |
| `field-toolkit` | 道具3: 開示前チェック — 資料の一文テスト | 強い文検出と一文テスト、Lv1-4 | primary | GAP章の実務道具。Ch 8 (開示Lv) と接続 |

### Ch 30 (10 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `field-before-zero` | 早すぎても、遅すぎても | タイミング窓・両側非対称・遅すぎる失敗の不可視性 | primary | 設立タイミング章の中心素材。Ch 4 (失敗パターン) と Ch 8 (戦略余力) にも secondary |
| `field-before-zero` | 実例 — 二つの研究室 | 早すぎる設立 / 遅すぎる立ち消え の対比 composite case | primary | Book III pattern library (Ch 12-19) でも retrofit 候補。匿名化方針 (Ch 0.0) の実例にも |
| `field-gates` | 鬼門その二 — 会社化のタイミング | 登記の不可逆性・三択・早すぎ/遅すぎの結末 | primary | 設立章の中心素材 |
| `field-gates` | 鬼門その三 — CEO機能の早すぎる要求 | 研究者CEO/外部CEO二択批判、機能分解 | primary | 設立タイミングの担い手側面。Ch 33 (EIR) にも secondary |
| `field-gates` | 実例その二: 戻る条件を三つ書いた WAIT | 明文化WAITで設立を半年遅らせ成功した composite | primary | Ch 11 の gate 実例にも |
| `field-toolkit` | 道具4: 会社化判断の四枚の紙 | 顧客証拠/配置メモ/余力/WAIT案 の四枚 | primary | 設立判断章。Ch 9 (ERS加重和) と Ch 11 (gate) のフィールド側 |
| `field-toolkit` | 道具5: 九十日役割メモのテンプレート | 機能×誰×いつまで×持たないもの×できなかったら | primary | 担い手側面。Ch 33 (EIR) と Ch 32 にも secondary |
| `field-who-carries` | 役割の合意は、紙にする | 九十日メモの四欄 | secondary | 道具5と統合。Ch 2 にも reference |
| `field-who-carries` | 章末の問い | 担い手・五機能・記録粒度の現場問い | secondary | 設立章末問いに統合 |
| `s-survival` | 早すぎる起業への警鐘 — 設立を遅らせるという選択肢 | B は設立で走り出す。右辺未整備のままの設立を避け、設立タイミングを遅らせる選択肢を正面化。Jカーブ一律適用批判。 | primary | 時系列現場接続の Ch 30 (設立) の中核論。Ch 7 では短い前方参照に留め、Book IV へ移送。 |

### Ch 32 (4 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `nursery-ers` | 冒頭ストーリー (二人の研究者と二つの大学) | 同じ水準のシーズが異なる土壌で十八か月後にまったく違う速度になる | primary | Book V Institution-side Design 全体の motivating frame |
| `nursery-ers` | ### 各軸は Lv1〜5 の『到達状態』で測る | rubric の例 (知財/資金/制度設計の Lv フル表) | primary | Ch 32 ERS 8 軸別処方の rubric 詳細。付録 B にも収録 |
| `nursery-ers` | ## 弱い軸は、外部連携で補ってよい | 自前 vs 外部委託、unknown/not_started 区別、根拠ノート | primary | Ch 32 ERS 8 軸別処方 + Ch 34 地域動態 |
| `nursery-ers` | ## 章末の問い | 機関 8 軸自己評価チェック 7 項目 | secondary | Ch 32 末尾 + Ch 36 機関 KPI |

### Ch 33 (8 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `field-clocks` | 支援の局所最適 — 支援者が増えるほど、真ん中が空く | 局所最適と研究者の孤独・統合役の空席 | primary | GAP+URA+EIR の機関設計章の中心動機。Ch 4 にも secondary |
| `field-clocks` | GAP ファンドと VC — 二つの物差しに引き裂かれる | ピッチ磨きと体制審査の物差しの衝突 | primary | Ch 32 (ERS処方) と Ch 35 (政策含意) にも分散 |
| `field-clocks` | 実例 — 七人の支援者と、止まった案件 | 支援過多で停止し統合役配置で前進した composite | primary | Book III の機関 retrofit (Ch 20-24) にも再利用 |
| `field-clocks` | 実例 — 磨かれたピッチが、調達の部屋で崩れた | GAP→VC物差し衝突 composite case | primary | Ch 31 (調達) でも secondary |
| `field-toolkit` | 道具7: 機関の九十日 pilot charter | 機関整備度を九十日 pilot で試す | primary | GAP+URA+EIR 章の実装テンプレ。Ch 34 (地域動態) にも |
| `strategic-slack` | なぜ手が緩むのか — KPI が交渉力を壊す | 成果件数 KPI が選択肢成分を内側から毀損するメカニズムと処方 (選択肢 KPI)。 | primary | Book V Ch 33 (GAP+URA+EIR) の機関設計含意。Ch 8 内には短い導入のみ残し、本格論は Book V へ。Ch 35 政策含意で... |
| `nursery-ers` | ## 大きな改革ではなく、90 日の試行から | 90 日 pilot charter の四項目構造 | primary | Ch 33 GAP+URA+EIR の実装作法 |
| `ethics-and-authorship` | ## 批判 (7) — 支援者が研究者の主導権を奪う道具にならないか | 道具の使い方倫理、選択肢を一つに見せない、沈黙を同意としない | primary | Ch 33 GAP+URA+EIR の支援者倫理 + Ch 28 第一歩 |

### Ch 35 (1 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `ethics-and-authorship` | ## 批判 (3) — 公的研究を市場へ従属させていないか | 市場を唯一の審判にしない、研究機関への還元設計 | primary | Ch 35 政策含意 + Ch 38 新領域宣言 — AMD の知財収益還元目的と整合 |

### Ch 36 (7 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `model-critiques` | 冒頭ストーリー (経済学研究会の質疑) | 計量経済学者・VC・経営学者三人の批判と発表者の『ご指摘は三つとも正しい』応答 | primary | Book VI の critiques 受け止めの motivating frame、または Ch 38 新領域宣言の前置きに |
| `model-critiques` | ## なぜ、自分のモデルの批判を一章かけて書くのか | 限界の章を書く方法論的理由 = 反証可能性の確保 | primary | Book VI の epistemology 章 |
| `model-critiques` | ## 経済学者からの五つの批判 | 識別問題、後知恵、自己選択、順序尺度、最適制御 5 批判 | primary | Book VI Ch 36 機関 KPI 批判 / Ch 37 head-to-head の前提として整理。Ch 26a/26b にも分配 |
| `model-critiques` | ## 経営学者からの六つの批判 | 機会創造観/逆U字/構成概念妥当性/Goodhart/動的能力/べき乗則 | primary | Book VI Ch 36 head-to-head 比較と Ch 38 新領域宣言の前置きに分配 |
| `model-critiques` | ### 批判 4 — グッドハートの法則 | 測定が目標化する、証拠の質で刻む、採点者と受益者の分離 | primary | Book VI Ch 36 機関 KPI の中核論点 + Ch 32 ERS 8 軸別処方 |
| `model-critiques` | ### 批判 6 — 単一スコアは、ポートフォリオを均質化する | べき乗則 outlier、確信による例外を記録付きで運用 | primary | Book VI Ch 36 KPI 設計 + Ch 35 政策含意 |
| `model-critiques` | ## 章末の問い | 使い手向け 8 項目チェック | secondary | Book VI Ch 36 末尾 + 付録 C (やらかし図鑑) にも反響 |

### Ch 38 (1 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `ethics-and-authorship` | ## 章末の問い | 読者向け 8 項目倫理チェック | secondary | Ch 38 新領域宣言の末尾 + 付録 C |

### Ch 12-19 (3 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `field-who-carries` | 実例 — 機能の分解と、記録の粒度 | 完璧CEO探しで止まった / 市場ない結論しかけた 二事例 | primary | 8 PJ retrofit pattern library に再構成。Ch 2/Ch 4 でも引用 |
| `s-survival` | 実例 — 二つの相談を S で読む | 資質高×実行力低の補強事例と三要素全ゼロの対照事例。 | secondary | Book III の PJ retrofit に統合。Ch 7 末尾には短い見出し抜粋のみ残す。 |
| `strategic-slack` | 実例 — ある天然系防除剤の出口設計 | 天然防除剤ライセンス戦略の (x,y) 診断と 5 処方。 | secondary | Book III の 8 PJ retrofit に統合。Ch 8 末尾には参照のみ。 |

### Book III Ch 12-19 (2 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `p-potential` | 実例 — 断熱材料 / 発電方式 / 不整地ロボット | P大だがR不在で停滞、P原理低で落とすべき、P書き換えで動いた三例 | primary | 匿名化retrofit実例として該当PJ章に移植。Ch 6には1-2文の要約参照のみ残す |
| `r-readiness` | 実例 — 透明断熱材の長期停滞 | 研究室TRLと自社TRLギャップ放置の典型停滞 | primary | retrofit実例として該当PJ章へ移植。Ch 6には要約のみ |

### Ch 26a (7 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `s-survival` | 測り方の注意 — 資質の評価は盛れる、実行力の評価は釣れる | 資質の自己申告バイアスと実行力の名義膨張への対策 (行動観察・コミット実質)。 | secondary | Ch 7 内にも短く残すが、calibration 論として Ch 26a に primary 配置。 |
| `score-and-bottleneck` | ## 重み α — 専門家判断の事前値と、過去ケースでの校正 | 9 軸の α 値と F/σ_SU 重視思想、ベイズ事前値の位置づけ | primary | α 値表は calibration 章 (Ch 26a) の核。Ch 6 にはエッセンスのみ残し、具体値と推定論議は Ch 26a へ |
| `score-and-bottleneck` | ## K の校正 — 全軸最高で 100,000 という物差し合わせ | K の校正規約と対数スケール上の順位指標としての読み方 | secondary | calibration 詳細は Ch 26a、付録 A にも収録 |
| `score-and-bottleneck` | ## 軸どうしは独立ではない — 共線性の扱い | 共線性の積構造での扱い、連動が崩れた事例こそ情報量最大 | primary | Ch 26a calibration と Ch 11 BVAR の identification 議論につながる |
| `model-critiques` | ### 批判 1 — パラメータは『推定』されていない | 識別不能、専門家事前信念のベイズ的位置づけ | primary | Ch 26a calibration 章の方法論基盤 |
| `model-critiques` | ### 批判 4 — 順序の数字を、比率の数字として扱っている | 順序尺度と単調変換頑健性 | primary | Ch 26a 感度分析の節 |
| `retrofit-verification` | ## 数値化を急がない — 検証の順序 | 四段階運用 (地図→観測項目→軌跡再構成→確率校正) | primary | Ch 26a calibration プロトコル — 数値化前に会話の道具として使う哲学 |

### App B (1 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `strategic-slack` | ロイヤリティはどう決めるか | イニシャル+ランニング+ミニマム三点セット、正味売上基準、25%ルール検算。 | primary | ロイヤリティ相場・25%ルール詳細は付録 B (データ仕様+registry) へ。Ch 8 では原理だけ残す。 |

### Ch 26b (6 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `model-critiques` | ### 批判 2 — 過去ケースへの当てはめは、後知恵である | 後知恵バイアスと blind retrofit + 事前予測 registry | primary | Ch 26b prediction registry の核心 |
| `model-critiques` | ### 批判 3 — サンプルは自己選択されている | 見送り案件 = 対照群の追跡設計 | primary | Ch 26b registry に見送り案件追跡を組み込む |
| `retrofit-verification` | ## モデルは信じるものではなく、検証するもの | 構造化された専門家判断システムとしての位置づけ、retrofit の役割 | primary | Ch 26b prediction registry の方法論前文 |
| `retrofit-verification` | ## 検証の落とし穴 (1) — 後知恵バイアスと blind retrofit | blind retrofit 手続きと事前予測への重心移動 | primary | Ch 26b prediction registry の手続き定義 = 核心 |
| `retrofit-verification` | ## 検証の落とし穴 (2) — 自己選択と、見送り案件という対照群 | ウォッチリスト追跡で対照群を作る | primary | Ch 26b registry に組み込む。Ch 27 掘り起こしとも接続 |
| `retrofit-verification` | ## 章末の問い | 過去案件・進行中案件・見送り案件の検証チェック 8 項目 | secondary | Ch 26b 末尾 + 付録 B データ仕様にも反響 |

### Ch 12-19 のいずれか (2 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `retrofit-verification` | ## 『設立が早すぎた』がスコア差として再現される | 定性的後悔が桁違いのスコア差として再現される — 透明断熱材タイプ | primary | Book III 8 PJ retrofit のうち『早すぎた設立』型 PJ の primary 素材 |
| `retrofit-verification` | ## 実例 — 『早すぎた設立』を軌跡で読み直す | 透明断熱材タイプの設立時スコアと軌跡再構成 = ゾンビ型 | primary | Book III の 1 PJ retrofit の primary 素材として展開 |

### Ch 20-24 (1 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `nursery-ers` | ## 実例 — 二つの機関 | 単発成功 pipeline 不在の国立大 / 外部連携で動く小規模地方大 | primary | Book III 機関 retrofit の primary 素材 2 件 |

### 付録B (4 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `field-gates` | 判断を記録に残す | 6行記録テンプレ | primary | prediction registry/データ仕様の実務テンプレに収容 |
| `p-potential` | 章末の問い (P) | P評価8項目の現場チェックリスト | primary | observation registry/checklist仕様として付録Bに収納。Ch 6末尾は短縮版 |
| `r-readiness` | 評価のブレを防ぐ — 段階を Yes/No の観測項目に割る | 段階評価を観測項目チェックリストへ分解、主張ではなく観測 | primary | observation registry仕様の中核。Ch 6本文は要約のみ |
| `r-readiness` | 章末の問い (R) | R評価8項目の現場チェックリスト | primary | observation registry/checklistへ収納。Ch 6末尾は短縮 |

### 付録C (1 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `field-toolkit` | 道具6: 失敗の学習ログのテンプレート | 四行ログと運び手保護 | primary | やらかし図鑑の構造化テンプレ。Ch 26b (prediction registry) にも |

### 付録 A (1 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `score-and-bottleneck` | ### 練習問題 | 計算/律速/概念の 3 問 | primary | 数学補遺 (付録 A) の演習として収録 |

### (discard) (1 件)

| 出典 | 節 | 要約 | role | notes |
|---|---|---|---|---|
| `field-before-zero` | この先の読み方 | 後続部への前方参照 | rewrite_substantially | 新構造の橋渡しに全面書き換え |

---

## 2. グループ別 mapping (source view)

既存 bzm/ 章をどう新 Book に解体・移動するか、source ファイル単位で見るとどうなるか。

### 【グループ 1】preface.md + field-*.md (実務 spine 素材)

**source_files**: `preface.md`, `field-before-zero.md`, `field-clocks.md`, `field-gates.md`, `field-toolkit.md`, `field-who-carries.md`

**preservation_notes**: 判断軸: (1) 概念定義・状態空間の構成要素 (七不確実性・五機能・時計マップ) は Book I (Ch 1-4) に primary 移植して数学装置 (Book II) の土台にする。(2) 鬼門ストーリー (開示順序・登記・CEO) は Book IV の時系列スパイン Ch 27-31 に primary、抽象部分は Ch 4 (失敗パターン) に分岐。(3) 機関構造批判 (支援の局所最適・GAP-VC物差し衝突・支援過多 case) は Book V Ch 32-35 に集約。(4) 実務テンプレ (九十日メモ・四行失敗ログ・WAIT 6行記録) は付録B/Cの構造化registryに収容、本文では Ch 27-31 と Ch 11 から参照。(5) preface の構成案内は新 Book 0-VI 用に全面書き換え必須。(6) 旧第I部の語り口 (story-driven, 平易) は Tier3 monograph に合わせて圧縮するが、composite case は匿名化方針 (Ch 0.0) の枠で温存。(7) 同一素材が複数章にまたがる場合は primary 1 箇所 + reference で重複回避。

**discarded_sections** (捨てる節):
- preface.md: 本書の構成 (旧4部表)
- field-before-zero.md: この先の読み方 (旧構造への前方参照)
- field-toolkit.md: 冒頭ストーリーの大半 (Tier3 学術書では story 圧縮)

**sections_map** (53 節):

| 出典節 | 要約 | → 新章 | role | notes |
|---|---|---|---|---|
| `preface` :: 序章 — この本の読み方 (intro paragraph) | 研究成果が会社になるまでの Before Zero 時間の壊れやすさを宣言する hook | Ch 0.1 | primary | 領土宣言の冒頭 hook 素材として再利用。Tier3 学術モノグラフ向けに筆致は調整 |
| `preface` :: 誰のための本か | URA/研究者/若手/VC など想定読者列挙 | Ch 0.0 | secondary | 射程と匿名化方針の章で読者像として要約。学術書向けに簡素化 |
| `preface` :: 本書の構成 | 旧4部+補論構成の案内表 | Ch 0.0 | rewrite_substantially | 新 Book 0-VI 構造に全面書き換え。旧4部表は廃棄 |
| `preface` :: どこから読むか | 読者タイプ別の入口案内 | Ch 0.0 | reference | 新構造に合わせて入口ガイドを再構成 |
| `preface` :: 本書が約束しないこと | 投資助言でない/モデルは判断の代わりでない 等の限界 | Ch 0.0 | secondary | 射程と匿名化方針に統合。倫理・著者性の一部は付録Cにも |
| `field-before-zero` :: (冒頭ストーリー: 強すぎた一文) | 若手事業化担当が発表スライドを盛ってしまうエピソード | Ch 0.1 | primary | Book0 の領土宣言冒頭 hook として最有力。Ch 27 (掘り起こし) でも secondary 引用可 |
| `field-before-zero` :: 熱意だけでは、会社にならない | シーズ/URA/TLO/GAP の用語定義 + 判断の宙づり構造 | Ch 0.1 | primary | 用語定義は Ch 0.0 にも分割。判断の宙づりは Ch 4 (失敗パターン抽象) で再活用 |
| `field-before-zero` :: Before Zero とは何か | ゼロ/Before Zero の定義、初期条件表、フェーズ表 | Ch 1 | primary | Ch1 状態空間と観測量の章で「領土の輪郭」として再利用。表は変数化の素材 |
| `field-before-zero` :: スタートアップの教科書は、ゼロの後から始まる | リーンスタートアップ等が Zero 以後を前提とする限界 | Ch 0.2b | primary | 未engage lit (リーン/Disciplined Entrepreneurship) との対比に流用 |
| `field-before-zero` :: 何がまだ不確実なのか — 七つの領域 | 再現性/用途/顧客/知財/担い手/資金/制度 の七不確実性 | Ch 1 | primary | 状態空間 X の観測量に直接マップ。Ch 4 (失敗パターン) でも参照 |
| `field-before-zero` :: 早すぎても、遅すぎても | タイミング窓・両側非対称・遅すぎる失敗の不可視性 | Ch 30 | primary | 設立タイミング章の中心素材。Ch 4 (失敗パターン) と Ch 8 (戦略余力) にも secondary |
| `field-before-zero` :: 実例 — 二つの研究室 | 早すぎる設立 / 遅すぎる立ち消え の対比 composite case | Ch 30 | primary | Book III pattern library (Ch 12-19) でも retrofit 候補。匿名化方針 (Ch 0.0) の実例にも |
| `field-before-zero` :: この先の読み方 | 後続部への前方参照 | (discard) | rewrite_substantially | 新構造の橋渡しに全面書き換え |
| `field-before-zero` :: 章末の問い | 七不確実性チェック等の現場問い | Ch 27 | secondary | 掘り起こし章の実務問いに移植。Ch 1 末尾にも reference |
| `field-clocks` :: (冒頭ストーリー: 五つの締切が同じ週) | 金曜正午締切に五つの時計が重なる場面 | Ch 27 | primary | 時系列スパインの掘り起こしフェーズ hook。Ch 4 でも引用 |
| `field-clocks` :: 「温度差」ではなく「時計の差」と呼ぶ理由 | 温度差概念の批判と時計概念への置換 | Ch 4 | primary | 失敗パターン抽象の中核。合理性の概念は Ch 10 (OPENER) と接続 |
| `field-clocks` :: 関係者×関心×時計の地図 | 研究者/大学/企業/VC/行政/支援者の時計一覧表 | Ch 1 | primary | 状態空間の観測量 (関係者軸) に変換。Ch 27-31 各章でも参照 |
| `field-clocks` :: 正しい圧力どうしの、未調整 | 急がせる/盛らせる/開示を誤らせるの三圧力 | Ch 4 | primary | 失敗パターンの抽象化素材。Ch 28 (第一歩) にも secondary |
| `field-clocks` :: 支援の局所最適 — 支援者が増えるほど、真ん中が空く | 局所最適と研究者の孤独・統合役の空席 | Ch 33 | primary | GAP+URA+EIR の機関設計章の中心動機。Ch 4 にも secondary |
| `field-clocks` :: GAP ファンドと VC — 二つの物差しに引き裂かれる | ピッチ磨きと体制審査の物差しの衝突 | Ch 33 | primary | Ch 32 (ERS処方) と Ch 35 (政策含意) にも分散 |
| `field-clocks` :: 時計のズレを読めると、何が変わるか | 企業/VC/行政/大学/研究者の時計の逆算術 | Ch 28 | primary | 第一歩 (関係構築) 章の実務素材 |
| `field-clocks` :: 実例 — 七人の支援者と、止まった案件 | 支援過多で停止し統合役配置で前進した composite | Ch 33 | primary | Book III の機関 retrofit (Ch 20-24) にも再利用 |
| `field-clocks` :: 実例 — 磨かれたピッチが、調達の部屋で崩れた | GAP→VC物差し衝突 composite case | Ch 33 | primary | Ch 31 (調達) でも secondary |
| `field-clocks` :: 章末の問い — 相手の時計を確認する | 時計逆算の現場問い | Ch 28 | secondary | 第一歩章末問い |
| `field-gates` :: (冒頭ストーリー: 送信予約と登記の軽い一言) | 開示メール送信予約と登記提案が同日に起きる場面 | Ch 4 | primary | 失敗パターン抽象の hook。Ch 29 (GAP), Ch 30 (設立) でも分割引用 |
| `field-gates` :: 取り返しのつく失敗と、つかない失敗 | 鬼門の不可逆性概念 | Ch 4 | primary | 失敗パターン抽象の核。Ch 5/Ch 8 の非可換性とも接続 |
| `field-gates` :: 鬼門その一 — 外部開示の順序 | 新規性喪失と開示順序、四つが同時に壊れる | Ch 29 | primary | GAP章の中心素材。Ch 4 でも抽象パターンとして引用 |
| `field-gates` :: 鬼門その二 — 会社化のタイミング | 登記の不可逆性・三択・早すぎ/遅すぎの結末 | Ch 30 | primary | 設立章の中心素材 |
| `field-gates` :: 鬼門その三 — CEO機能の早すぎる要求 | 研究者CEO/外部CEO二択批判、機能分解 | Ch 30 | primary | 設立タイミングの担い手側面。Ch 33 (EIR) にも secondary |
| `field-gates` :: 判断の語彙 — 進める、待つ、止める、保留する | GO/WAIT/NO_GO/HOLD 四語彙 | Ch 11 | primary | BVAR+jump+gate の gate 概念の素地。Ch 27-31 全体の judgement spine としても利用 |
| `field-gates` :: WAIT は「何もしない」ではない | 戻る条件・見直し日・並行作業の三部品 | Ch 11 | primary | gate 設計の実装。Ch 8 (戦略余力動学) とも接続 |
| `field-gates` :: 判断を記録に残す | 6行記録テンプレ | 付録B | primary | prediction registry/データ仕様の実務テンプレに収容 |
| `field-gates` :: 実例その一: 自分の発表に先を越された出願 | 開示順序事故 composite | Ch 29 | primary | Book III pattern (Ch 12-19) にも retrofit 候補 |
| `field-gates` :: 実例その二: 戻る条件を三つ書いた WAIT | 明文化WAITで設立を半年遅らせ成功した composite | Ch 30 | primary | Ch 11 の gate 実例にも |
| `field-gates` :: 章末の問い | 鬼門前チェック | Ch 29 | secondary | GAP章末問いと Ch 30 にも分散 |
| `field-toolkit` :: (冒頭ストーリー: 月曜の鞄の中身) | 道具を持たず問いを持って面談へ向かう若手の場面 | Ch 27 | secondary | 掘り起こし章の補助素材。Tier3 では基本廃棄、エッセンスのみ |
| `field-toolkit` :: 道具1: 初回面談の問いセット | 四束の問いと初回に聞かない問い | Ch 27 | primary | 掘り起こしフェーズの実務テンプレ。付録Bにも |
| `field-toolkit` :: 道具2: 現場メモの安全化手順 | 五つの印・固有名詞・本人確認・保存 | Ch 28 | primary | 第一歩章。付録B (data spec) にも primary |
| `field-toolkit` :: 道具3: 開示前チェック — 資料の一文テスト | 強い文検出と一文テスト、Lv1-4 | Ch 29 | primary | GAP章の実務道具。Ch 8 (開示Lv) と接続 |
| `field-toolkit` :: 道具4: 会社化判断の四枚の紙 | 顧客証拠/配置メモ/余力/WAIT案 の四枚 | Ch 30 | primary | 設立判断章。Ch 9 (ERS加重和) と Ch 11 (gate) のフィールド側 |
| `field-toolkit` :: 道具5: 九十日役割メモのテンプレート | 機能×誰×いつまで×持たないもの×できなかったら | Ch 30 | primary | 担い手側面。Ch 33 (EIR) と Ch 32 にも secondary |
| `field-toolkit` :: 道具6: 失敗の学習ログのテンプレート | 四行ログと運び手保護 | 付録C | primary | やらかし図鑑の構造化テンプレ。Ch 26b (prediction registry) にも |
| `field-toolkit` :: 道具7: 機関の九十日 pilot charter | 機関整備度を九十日 pilot で試す | Ch 33 | primary | GAP+URA+EIR 章の実装テンプレ。Ch 34 (地域動態) にも |
| `field-toolkit` :: 章末に — 道具についての三つの総注意 | 道具は会話の代わりでない/グッドハート/書き換え推奨 | Ch 0.3 | primary | 二層 readiness 方法論章の警句。グッドハートは Ch 36 (機関 KPI) にも |
| `field-who-carries` :: (冒頭ストーリー: 最後は誰が背負うんですか) | 研究者が責任の所在を問い、五機能分解が始まる場面 | Ch 3 | primary | ERS 概念章の hook。研究者責任の非対称は Ch 33 にも |
| `field-who-carries` :: 「誰が背負うのか」は、なぜ空欄になるのか | 足し算支援の限界、研究者が背負うものの表 | Ch 3 | primary | ERS の機関側軸の動機。Ch 32 (ERS 8軸処方) でも引用 |
| `field-who-carries` :: 創業者機能の分解 — 二択をやめる | CEO肩書き批判と五機能分解表 | Ch 2 | primary | PRS の人的軸 (担い手) の概念基盤。Ch 30 (設立) にも |
| `field-who-carries` :: 研究に残るべきもの、移せるもの | 技術の核と真正性は移せない、経営実務は補完可 | Ch 2 | primary | PRS 概念。Ch 33 (EIR) にも |
| `field-who-carries` :: 役割の合意は、紙にする | 九十日メモの四欄 | Ch 30 | secondary | 道具5と統合。Ch 2 にも reference |
| `field-who-carries` :: 失敗を学習に変える — 記録の粒度がすべてを決める | 粗い記録の人格化、四原因分解、四行ログ | Ch 4 | primary | 失敗パターン抽象の核。付録C (やらかし図鑑) にも primary |
| `field-who-carries` :: 実例 — 機能の分解と、記録の粒度 | 完璧CEO探しで止まった / 市場ない結論しかけた 二事例 | Ch 12-19 | primary | 8 PJ retrofit pattern library に再構成。Ch 2/Ch 4 でも引用 |
| `field-who-carries` :: 第I部の終わりに — 問いを、測れる形へ | 現場問いを測れる形に変える宣言 | Ch 0.3 | primary | 二層 readiness 方法論の橋渡しに最適 |
| `field-who-carries` :: 章末の問い | 担い手・五機能・記録粒度の現場問い | Ch 30 | secondary | 設立章末問いに統合 |

---

### 【グループ 2】why-valuation-fails.md + model-overview.md (序論・全体像)

**source_files**: `why-valuation-fails.md`, `model-overview.md`

**preservation_notes**: 既存 v1 の 2 章は『Valuation 限界の論証』と『PRS 骨格の導入』という Book 0-II 全体の入口素材を凝縮しており、捨てる節はない。判断軸: (1) Valuation スクール批判素材は Book 0 Ch 0.2a (四スクール継承) に集約し、四つの壁を四スクール限界論証の骨格に転用。(2) PRS 三因子の定義・積構造・登山アナロジー・DCF 対応は Book I Ch 2 (PRS 概念) に primary 配置、数学的展開は Book II Ch 6 にバトンする。(3) 二層構造 (判定層/動学層) は Ch 0.3 (二層 readiness 方法論) の中核に昇格。Ch 5 Triple Helix SSM / Ch 8 戦略余力動学への前振りとして再書き。(4) ERS の軸設計議論 (10本目の軸にしない理由) は Ch 3 (ERS 概念) で primary 再配置。(5) 冒頭の二つのストーリー (URA・三案件会議) は Ch 0.1 領土宣言の motivating narrative に転用、後段の匿名ケース 2 組は Ch 4 (失敗パターン抽象) に集約し Ch 12-19 retrofit の前哨に。(6) モデル進化史 (第1-3世代) は Ch 0.2b (未engage lit) として BZSF 自身の系譜文献化を行い rewrite_substantially。(7) 章末の問いは各受け側章末の reference として温存。全体として「物語素材→Book 0」「概念定義→Book I」「数学根拠予告→Book II入口」の三分割で再構築する。

**sections_map** (21 節):

| 出典節 | 要約 | → 新章 | role | notes |
|---|---|---|---|---|
| `why-valuation-fails` :: 冒頭ストーリー (URA・5年後売上30億円) | URAが事業計画の数字に振り回される導入ストーリー、評価額が場面ごとに別の顔を持つ | Ch 0.1 | secondary | 領土宣言の動機づけ素材。Ch 4 (失敗パターン抽象) でも再利用可能 |
| `why-valuation-fails` :: Valuation とは何か — まず道具を正しく知る | DCF の定義と式、適用範囲の問題提起 | Ch 0.2a | primary | 四スクール継承の中でファイナンス/Valuation スクールの限界を扱う節の核 |
| `why-valuation-fails` :: 第一の壁 — 前提がすべて仮定になる | 設立前 CF 実績ゼロ、仮定の積み上げで数倍ぶれる | Ch 0.2a | primary | Valuation 限界の論拠1 |
| `why-valuation-fails` :: 第二の壁 — 期待 (ハイプ) を測ってしまう | Valuation は期待ベースで分野ハイプを混ぜ込む | Ch 0.2a | primary | Valuation 限界の論拠2。Ch 10 OPENER のハイプ動学と接続可 |
| `why-valuation-fails` :: 第三の壁 — 単一の値は律速を隠す | 単一値は内訳/律速を隠す、A/B 例 | Ch 0.2a | primary | Ch 4 失敗パターンとも連動。律速概念の初出 |
| `why-valuation-fails` :: 第四の壁 — 「死なない力」を測る軸がない | ディープテック死因は資金/選択肢切れ、DCFは割引率に隠す、Jカーブ一律適用問題 | Ch 0.2a | primary | Ch 3 ERS 概念と Ch 8 戦略余力動学への導入。Jカーブ批判は Ch 4 にも分岐 |
| `why-valuation-fails` :: では、何を測ればよいのか — 天井 × 到達 × 生存 | PRSの三因子分解、表で Valuation との対応 | Ch 2 | primary | PRS 概念章の中核導入。Ch 0.4 三貢献 front-load にも要約を抜粋 |
| `why-valuation-fails` :: 実例 — 評価額が測らなかったもの (ケース1/ケース2) | 高評価で沈んだ材料系、評価なしで生き残った装置系 | Ch 4 | primary | 失敗パターン抽象の典型例として再配置。Ch 12-19 retrofit の前哨 |
| `why-valuation-fails` :: 章末の問い — 現場で使うチェック | 8 項目の現場チェック | Ch 0.2a | reference | Book 0 末尾の練習問題として残す。一部 Ch 4 へ |
| `model-overview` :: 冒頭ストーリー (支援チーム月例会議、三案件) | 断熱素材/計測装置/エネルギー変換の三件で物差しが噛み合わない | Ch 0.1 | secondary | 領土宣言の motivating story。Ch 2 PRS 概念導入にも再利用 |
| `model-overview` :: 三つの正しさは、なぜ噛み合わなかったのか | PRS 三因子に名前を与え、価値を積で書く骨格 | Ch 2 | primary | PRS 概念章の中核。Ch 0.4 にも要旨抜粋 |
| `model-overview` :: なぜ積なのか — 期待値の標準分解 | E[価値] = P × Pr(到達) = P × R × S、登山アナロジー | Ch 2 | primary | PRS の理論的根拠。Ch 6 PRS 期待値分解で数学的に再展開 |
| `model-overview` :: 積であることの意味 | 掛け算ゆえ最弱因子が支配、律速診断が式から導ける | Ch 2 | primary | Ch 4 律速失敗パターン、Ch 25 層間結合とも連動 |
| `model-overview` :: 冒頭の三件を読み直す | 三件を PRS で再評価する表 | Ch 2 | secondary | Ch 12-19 retrofit の prototype として位置づけ |
| `model-overview` :: DCFは何を測っていたのか — 標準手法との関係 | DCFは P のみを測っていた、本モデルは上位互換 | Ch 0.2a | primary | 四スクール継承 (ファイナンススクール) の総括。Ch 2 末尾にも参照 |
| `model-overview` :: 判定層と動学層 — モデルの二層構造 | 判定層 (スナップショット) と動学層、σ_SU と戦略余力動学の対称性 | Ch 0.3 | primary | 二層 readiness 方法論章の中核導入。Ch 5 Triple Helix SSM と Ch 8 戦略余力動学への入口 |
| `model-overview` :: なぜ戦略余力を「10本目の軸」にしないのか | 時間スケール不一致と二重計上回避、不可逆達成は R、消費可能資源は y | Ch 3 | primary | ERS 概念章で軸設計の根拠として再配置。Ch 8 戦略余力動学にも参照 |
| `model-overview` :: モデルの進化 — 「測れていないもの」を埋めてきた歴史 (第1/2/3 世代) | 統合 readiness → P×R×S → 戦略余力動学統合への世代進化 | Ch 0.2b | rewrite_substantially | 未engage lit (BZSF 自身の進化史) として再構成。Ch 0.4 三貢献 front-load と Ch 26a calibration に... |
| `model-overview` :: 進化が教えること | 過去ケース当てはめで欠落を発見する方法論 | Ch 0.3 | primary | 二層 readiness 方法論の retrofit verification 観点。Ch 26b prediction registry とも連動 |
| `model-overview` :: 実例 — 同じ準備度に見えた二つのプロジェクト (高機能素材/医療系) | 同じ readiness でも P と S 設計で結末が分かれた事例 | Ch 4 | primary | 失敗パターン抽象の典型例。Ch 12-19 retrofit の素材としても抜粋可 |
| `model-overview` :: 章末の問い — 現場で使うチェック | 8 項目の PRS チェック | Ch 2 | reference | PRS 概念章末の練習問題として保持 |

---

### 【グループ 3】p-potential.md + r-readiness.md (PRS 前半)

**source_files**: `p-potential.md`, `r-readiness.md`

**preservation_notes**: 基本方針: 既存p/r章は「物語+定性解説+例+問い」の混合だったが、新Book構造では (1)Ch 6に PRS期待値分解の数学的骨格と定性核 (2)付録Aに式の精密化 (3)付録Bにobservation registry/checklist (4)Book III Ch 12-19/20-24にretrofit実例 (5)Ch 9にERS加重和と二層非可換性 と層別に再配置する。判断軸: (a)積構造・min演算子・P(t)定義など「装置」はCh 6 primary、(b)0-9段階定義やYes/No項目など「仕様」は付録B primary、(c)断熱材・分離膜・ロボットなど匿名化具体例はBook III primaryでCh 6には参照のみ、(d)冒頭ストーリーは新Ch 6でも短い導入として温存、(e)GRL/SRL両義性とR/y線引きはCh 9/Ch 8への橋として保持。書き換え時はTRL五軸の「R」位置づけ (本書Rか、ERS 8軸の一部か) をCh 3/Ch 9と整合化する必要があり、現Rを「ERSのready側集約」として再記述する rewrite_substantially 作業が次工程で要る (本表では現素材の宛先のみ記録)。

**discarded_sections** (捨てる節):
- p-potential.md HTML注釈コメント (理論ソース注記) — メタ情報なので本文には移さず、Book 0 Ch 0.0 射程節での出典統合に吸収
- r-readiness.md HTML注釈コメント (同上) — 同様にCh 0.0/付録Bの出典管理へ吸収

**sections_map** (22 節):

| 出典節 | 要約 | → 新章 | role | notes |
|---|---|---|---|---|
| `p-potential` :: 冒頭ストーリー (水処理膜面談 / 不整地ロボット) | 1兆円TAMで沈黙する投資家と、市場小と門前払いされたロボットの対比導入 | Ch 6 | secondary | Ch 6冒頭のmotivating vignetteとして簡潔化して残す。詳細retrofitはBook III Ch 12-19へ移植候補 |
| `p-potential` :: 天井という考え方 — P は何を測るか | P×R×S 積構造の導入とDCFとの役割分担。Pは大風呂敷、RとSが実現可能性 | Ch 6 | primary | Ch 6 PRS期待値分解の導入節として中核。式表示は付録A数学補遺と二重化 |
| `p-potential` :: 1つの数字に2つの役割を負わせない — 絶対スケールと達成率 | 絶対スコアと達成率の分離。投資配分 vs 運用評価 | Ch 6 | primary | PRS期待値分解の解釈論として保持。Ch 26a calibrationとも相互参照 |
| `p-potential` :: 天井はなぜ測りにくいか — TAM は最も盛られやすい数字 | TAM/SAM/SOM三層と TAMが盛られる構造的理由 (安い・見栄え・検証遅延) | Ch 6 | primary | P観測の中核議論。Ch 4 失敗パターン抽象とも接続 (TAM-only失敗型) |
| `p-potential` :: 証拠の質で刻む — 三つの物差し | 第三者データ・ユニットエコノミクス・経路具体性の三軸で証拠の質を評価 | Ch 6 | primary | Ch 6内の操作的定義の核。付録Bデータ仕様/registryで観測項目スキーマ化 |
| `p-potential` :: P 大だけではダメ、P で落とすべき案件もある | 積構造ゆえP単独では不十分、しかし原理コスト下限のP低はSで救えない | Ch 6 | primary | Ch 6で保持しつつ、Ch 4失敗パターン (P-floor型) とCh 9 ERS統合への伏線 |
| `p-potential` :: 天井は動く — P は戦略の関数である | 機会創造観の取り込み、P(t)=max_u P_u、U(t)拡張が経営の打ち手 | Ch 6 | primary | Book II 数学装置の中核。Ch 0.2a 四スクール継承 (Sarasvathy系) との接続注記。Ch 8戦略余力動学のBATNA議論とも相互参照 |
| `p-potential` :: 実例 — 断熱材料 / 発電方式 / 不整地ロボット | P大だがR不在で停滞、P原理低で落とすべき、P書き換えで動いた三例 | Book III Ch 12-19 | primary | 匿名化retrofit実例として該当PJ章に移植。Ch 6には1-2文の要約参照のみ残す |
| `p-potential` :: 章末の問い (P) | P評価8項目の現場チェックリスト | 付録B | primary | observation registry/checklist仕様として付録Bに収納。Ch 6末尾は短縮版 |
| `r-readiness` :: 冒頭ストーリー (ガス分離膜面談) | 「技術はできています」が三者三様に受け取られる導入 | Ch 6 | secondary | R概念のmotivating vignette。Ch 3 ERS概念とも一部素材共有候補 |
| `r-readiness` :: 到達度 R とは何か — 五枚に割って測る | R不可逆性、五軸 TRL/BRL/GRL/SRL/HRL の導入、0-9段階 | Ch 6 | primary | Ch 6のR分解定義。ただしR五軸は本来ERS(Ch 3/9)の8軸とも関連—Ch 9 ERS加重和との関係を再整理する必要あり |
| `r-readiness` :: 評価のブレを防ぐ — 段階を Yes/No の観測項目に割る | 段階評価を観測項目チェックリストへ分解、主張ではなく観測 | 付録B | primary | observation registry仕様の中核。Ch 6本文は要約のみ |
| `r-readiness` :: TRL — 技術はどこまで「作れる」か / 応用×組織マトリクス | TRLを応用×組織のマトリクスで持ち最小値で読む。研究室セルvs自社セルのギャップ | Ch 6 | primary | Ch 6 R分解の象徴節。min演算子はBook II数学装置として付録Aへ二重化 |
| `r-readiness` :: BRL — 事業はどこまで検証されたか | 仮説→検証→拡大の三段階、対価を得た検証の重み | Ch 6 | primary | 対価検証→Ch 8戦略余力の余力補充議論と相互参照 |
| `r-readiness` :: GRL — 制度の関門をどこまで通したか | 規制リスク特定・届出認証・標準化、遅効性 | Ch 6 | primary | 遅効性議論はCh 8動学/Ch 11 jump+gateと相互参照 |
| `r-readiness` :: SRL — 社会はそれを受け入れるか / マクロ追い風と社会受容の別物性 | SRL独立軸の必要性、GMO欧州事例で追い風と受容の乖離 | Ch 6 | primary | Ch 9 ERS二層非可換性 (マクロ風 vs 社会受容) の伏線。Ch 10 OPENERにも接続 |
| `r-readiness` :: HRL — 作り続けられる人と組織があるか | チーム補完性、属人性、創業者個人資質はHRLに含めずSに置く | Ch 6 | primary | 創業者個人質→Ch 7 S内部F-CESに渡す境界線が重要 |
| `r-readiness` :: GRL と SRL の両義性 — 到達度であり、働きかけでもある | GRL/SRLは到達度であり同時に環境への働きかけ | Ch 9 | secondary | 二層非可換性 (内側達成 vs 外側環境) の素材としてCh 9へ。Ch 6では短い注記 |
| `r-readiness` :: 五枚をどう読み合わせるか — 凸凹 | 重要度差・時定数差・凸凹パターン診断・平均で読まない | Ch 9 | primary | ERS加重和の動機付け。重み付け式は付録Aへ。Ch 6では定性版のみ |
| `r-readiness` :: R と戦略余力の線引き — 不可逆な達成と使えば減る資源 | R(不可逆ストック) vs y(消費可能フロー) の線引き、特許の両義性 | Ch 6 | primary | Ch 6→Ch 8戦略余力動学への橋。特許R/y分解は Ch 8でも再掲。state space (Ch 1) 定義にも関与 |
| `r-readiness` :: 実例 — 透明断熱材の長期停滞 | 研究室TRLと自社TRLギャップ放置の典型停滞 | Book III Ch 12-19 | primary | retrofit実例として該当PJ章へ移植。Ch 6には要約のみ |
| `r-readiness` :: 章末の問い (R) | R評価8項目の現場チェックリスト | 付録B | primary | observation registry/checklistへ収納。Ch 6末尾は短縮 |

---

### 【グループ 4】s-survival.md + strategic-slack.md (S と戦略余力動学)

**source_files**: `s-survival.md`, `strategic-slack.md`

**preservation_notes**: 方針: (1) v1 章は「冒頭物語→数式解説→匿名化実例→章末問い」の単一章型だが、新 Book 構造では機構 (Book II) / 実例 (Book III) / 現場接続 (Book IV) / 機関設計 (Book V) / 付録に役割分離する。よって既存節は機能別に分解再配置する。(2) Ch 7 (S 内部 F-CES) には s-survival.md の生存不等式・三要素代替性・F 二層 CES を primary に集中。CES 数学詳細は付録 A、料率相場・25%ルール詳細は付録 B、calibration 注意は Ch 26a へ薄く分配。(3) Ch 8 (戦略余力動学) には strategic-slack.md の (x,y) 平面・五成分・鋸歯動学・PoC 交換効率・開示 Lv・出口設計・S=Pr(τ_x<τ_y) を primary に集中。(4) KPI 病理と「設立を遅らせる」論は Book IV-V の処方論にあたるため、Ch 30/33 へ primary 移送し Book II では短い導入に留める。(5) 冒頭物語と匿名化実例は Book III (PJ retrofit) と Book II 章頭 motivating story に二重活用 (新章型は前置きを軽く、retrofit を厚く)。(6) 学術出典 (AL/Grit/Resilience/CES/ロイヤリティ統計) は本文中の注 TODO を付録 A/B の脚注 registry に固定し、Book II 本文では出典文字列を減らす。(7) 「章末の問い」は Book II の全章末で揃った形式に rewrite するため rewrite_substantially タグ。(8) 捨てる対象は HTML コメントのメタ情報のみ。本文節は原則すべて新構造のどこかに primary か secondary で居場所を確保する (v1 の情報損失ゼロを優先)。

**discarded_sections** (捨てる節):
- s-survival.md の <!-- 理論正本コメント --> ヘッダ (メタ情報、本文外)
- strategic-slack.md の <!-- 理論正本コメント --> ヘッダ (メタ情報、本文外)
- s-survival.md 内の出典注 TODO コメント (References worker タスクに移送済み、新版では脚注として付録に統合)

**sections_map** (29 節):

| 出典節 | 要約 | → 新章 | role | notes |
|---|---|---|---|---|
| `s-survival` :: 冒頭ストーリー (審査会「この会社は死なないんですか」) | 年配審査委員が事業計画書の「死なない設計」欠如を一言で突くオープニング物語。 | Ch 7 | primary | Ch 7 (S 内部 F-CES) の motivating story として冒頭に置く。Book III の機関 retrofit (Ch 20-24... |
| `s-survival` :: 死因の第一位に、名前を付ける | ディープテックの死因は技術劣後ではなく、本命整備前の資金・選択肢枯渇であると定義。 | Ch 3 | secondary | ERS 概念導入というよりは PRS の S 因子独立性の根拠。Ch 7 冒頭でも再掲。Ch 4 (失敗パターン抽象) でも参照。 |
| `s-survival` :: 背骨は一本の不等式 — 生存条件式 (B - R_net ≤ F) | 生存不等式 B-R_net≤F の三項定義と読み方。 | Ch 7 | primary | Ch 7 の数式装置の中核。Book II の数学装置として formal に書き直す。Ch 8 の動学とは静学/動学の対で配置。 |
| `s-survival` :: 三つの項は、三つの経営の選択肢である | B/R_net/F それぞれが独立な打ち手 (規模縮小・自走収益・調達力) に対応。 | Ch 7 | primary | Ch 7 の処方論。Book V (Ch 32) の ERS 軸別処方とも接続。 |
| `s-survival` :: S の三つの要素 — どれかで補える | σ_SU (追い風) / R_net / F の三要素代替性とコブ・ダグラス型合成。 | Ch 7 | primary | Ch 7 の主構造。Ch 5/5.5 の Triple Helix SSM の σ_SU 導出と連結。 |
| `s-survival` :: 収益化指数 R_net — 「稼げる体質」を測る | つなぎ/先行収益を区別せず純キャッシュ貢献で測る。共食い型は負。 | Ch 7 | primary | Ch 7 の R_net サブ節。Ch 4 失敗パターン (共食いつなぎ) とも参照。 |
| `s-survival` :: 創業者要因 F — 資質と経営実行力の二層 | F を資質 (AL4次元+Grit+Resilience) と経営実行力 (経験序列) の二層に分解。 | Ch 7 | primary | Ch 7 の F 二層構造。学術出典 (AL, Grit, Resilience, 創業チーム実証) は付録 A or B へ脚注移送。 |
| `s-survival` :: 合成は「両方ないと成立しない」— CES | F=CES(F_char, F_cap; ρ=-2, a=0.6) の数式と数値例。 | Ch 7 | primary | Ch 7 のタイトル「S 内部 F-CES」の中核。CES 数学的詳細は付録 A 数学補遺へ。 |
| `s-survival` :: 測り方の注意 — 資質の評価は盛れる、実行力の評価は釣れる | 資質の自己申告バイアスと実行力の名義膨張への対策 (行動観察・コミット実質)。 | Ch 26a | secondary | Ch 7 内にも短く残すが、calibration 論として Ch 26a に primary 配置。 |
| `s-survival` :: 早すぎる起業への警鐘 — 設立を遅らせるという選択肢 | B は設立で走り出す。右辺未整備のままの設立を避け、設立タイミングを遅らせる選択肢を正面化。Jカーブ一律適用批判。 | Ch 30 | primary | 時系列現場接続の Ch 30 (設立) の中核論。Ch 7 では短い前方参照に留め、Book IV へ移送。 |
| `s-survival` :: 次章への橋 — スナップショットから軌跡へ | S の静学から (x,y) 動学へのブリッジ。 | Ch 8 | reference | Ch 7→Ch 8 のトランジションとして再構成。 |
| `s-survival` :: 実例 — 二つの相談を S で読む | 資質高×実行力低の補強事例と三要素全ゼロの対照事例。 | Ch 12-19 | secondary | Book III の PJ retrofit に統合。Ch 7 末尾には短い見出し抜粋のみ残す。 |
| `s-survival` :: 章末の問い — 現場で使うチェック | S を現場で運用するための 8 問の self-check。 | Ch 7 | rewrite_substantially | Book II 各章の章末問いとして再フォーマット。Book IV Ch 30 用と分割する可能性あり。 |
| `strategic-slack` :: 冒頭ストーリー (大手共同研究で買い叩かれた展示会案件) | 成果KPIに忠実な担当者が BATNA を失い、共同研究条件を三分の一に削られる物語。 | Ch 8 | primary | Ch 8 の motivating story。KPI 病理は Book V (Ch 33 GAP/URA/EIR) でも参照。 |
| `strategic-slack` :: なぜ「死なない力」を独立に測るのか | moat 削減と外部接触のジレンマ。S 独立化の動機。 | Ch 3 | secondary | Ch 3 PRS 概念の S 独立化動機。Ch 8 冒頭にも要約再掲。 |
| `strategic-slack` :: 2 軸の地図 — 事業化到達度と戦略余力 | x (PRS 到達度・不可逆) と y (戦略余力・消費可能) の直交平面定義。 | Ch 8 | primary | Ch 8 の状態空間定義。Ch 1 (状態空間と観測量) でも前方参照。 |
| `strategic-slack` :: y = 0 は倒産だけを意味しない | y=0 を主導権喪失・希薄化・従属ライセンス等に拡張定義。 | Ch 8 | primary | Ch 4 (失敗パターン抽象) でも引用。 |
| `strategic-slack` :: 戦略余力の中身 — 五つの成分 | y を 現金/moat/信用/選択肢/集中力 の五成分に分解、月単位への換算と H=y/T_remaining 健全度指標。 | Ch 8 | primary | Ch 8 の中核。H 指標は Ch 26a calibration とも接続。 |
| `strategic-slack` :: 時間の中で見る — 鋸歯のグラフ | Before Zero → 設立 → バーン拡大 → 補充 → BEP の鋸歯軌跡。 | Ch 8 | primary | Ch 8 動学描像。Ch 31 (調達) の補充タイミング論にも接続。 |
| `strategic-slack` :: PoC と情報開示は「y を消費して x を買う投資」 | PoC 形態別の x↑/y↓ 表、交換効率の数式。 | Ch 8 | primary | Ch 8 内の実務翻訳節。Ch 29 (GAP) でも参照。 |
| `strategic-slack` :: 交換レートを決めるのは交渉力 | 交渉力の源泉 (相手切迫度・代替困難性・BATNA・証拠・権利・時間) と低/高状態の対比。 | Ch 8 | primary | Ch 8 内の交渉力サブ節。Book V Ch 33 (URA/EIR) でも応用。 |
| `strategic-slack` :: なぜ手が緩むのか — KPI が交渉力を壊す | 成果件数 KPI が選択肢成分を内側から毀損するメカニズムと処方 (選択肢 KPI)。 | Ch 33 | primary | Book V Ch 33 (GAP+URA+EIR) の機関設計含意。Ch 8 内には短い導入のみ残し、本格論は Book V へ。Ch 35 政策含意で... |
| `strategic-slack` :: 開示は Lv1〜Lv4 で設計する | 情報開示 4 段階と NDA 限界、コミット交換設計。 | Ch 8 | primary | Ch 8 の運用論。Ch 27 (掘り起こし)/Ch 29 (GAP) の現場フローでも引用。 |
| `strategic-slack` :: 出口設計 — ライセンスか、自社事業化か | ライセンス vs 自社事業化を (x,y) 経路として再定義。 | Ch 8 | primary | Ch 8 後半。Ch 31 (調達) や Ch 38 (新領域宣言) の出口多様化論にも接続。 |
| `strategic-slack` :: 「ライセンスだと買い叩かれる」は本当か | 買い叩きの本質は契約形態でなく BATNA 欠如。4点セット (非独占/2社/自社オプション/マイルストン) の処方。 | Ch 8 | primary | Ch 8 出口設計サブ節。Book III 防除剤ケース (Ch 12-19) と組で読む。 |
| `strategic-slack` :: ロイヤリティはどう決めるか | イニシャル+ランニング+ミニマム三点セット、正味売上基準、25%ルール検算。 | App B | primary | ロイヤリティ相場・25%ルール詳細は付録 B (データ仕様+registry) へ。Ch 8 では原理だけ残す。 |
| `strategic-slack` :: 生存確率への接続 — 軌跡は語る (S=Pr(τ_x<τ_y)) | S をギャンブラー破産型 Pr(τ_x<τ_y) で再定義。健全/ゾンビ/即落/鋸歯の4軌跡パターン。 | Ch 8 | primary | Ch 8 と Ch 9 (ERS 加重和) を繋ぐ。軌跡パターン分類は Ch 4 (失敗パターン抽象) でも primary に展開。鋸歯型創薬は Ch ... |
| `strategic-slack` :: 実例 — ある天然系防除剤の出口設計 | 天然防除剤ライセンス戦略の (x,y) 診断と 5 処方。 | Ch 12-19 | secondary | Book III の 8 PJ retrofit に統合。Ch 8 末尾には参照のみ。 |
| `strategic-slack` :: 章末の問い — 現場で使うチェック | (x,y) 地図運用の 8 問チェックリスト。 | Ch 8 | rewrite_substantially | Book II 章末問いとして再フォーマット。KPI 問は Ch 33 とも分担。 |

---

### 【グループ 5】score-and-bottleneck.md + model-critiques.md + retrofit-verification.md + nursery-ers.md + ethics-and-authorship.md (推定・批判・retrofit・ERS・倫理)

**source_files**: `score-and-bottleneck.md`, `model-critiques.md`, `retrofit-verification.md`, `nursery-ers.md`, `ethics-and-authorship.md`

**preservation_notes**: 基本方針: 既存5ファイルの全節を破棄せず、新Book 0-VI構造のいずれかに必ず配置する。判断軸は (1) 数学装置層 (式の導出・性質) は Book II、(2) 実例 / retrofit motivating case は Book III、(3) 機関側処方は Book V、(4) 批判受け止めと epistemology は Book VI、(5) 著者性・匿名化方針・二層 readiness の方法論は Book 0 に front-load、(6) calibration プロトコル・rubric・演習は付録 A/B/C へ。 score-and-bottleneck.md は Cobb-Douglas 設計と律速診断を Ch 6 中心に置き、α 値表と K 校正は Ch 26a calibration に分離 (現行で混ざっている『置いた理由』と『推定方法論』を分けて書き直し)。model-critiques.md は割引率三仕事分解を Ch 11 BVAR+jump+gate に primary 移植 (これが Ch 11 の数学的動機付け)、経済学者批判 5 件は Ch 26a/26b と Ch 36 に分配、経営学者批判 6 件は Ch 6/7/8/36/38 に分配。retrofit-verification.md は冒頭ストーリーを Book III 全体の入口、軌跡 4 型と blind retrofit を Ch 25/26b の核心に。nursery-ers.md は ERS 8 軸定義を Ch 3 に基礎概念として置き、rubric 詳細と処方を Ch 32 に、加重和 vs 積の対比論証を Ch 9 二層非可換性の核心として最重要扱い。ethics-and-authorship.md は批判 1-2,4-5,8 を Ch 0.0 (Book 0 冒頭の author's note) に front-load、批判 3 (公的研究/市場) を Ch 35 政策含意に、批判 6 (バイアス) を Ch 7 採点方法に、批判 7 (主導権) を Ch 33 支援者倫理に、編集運用ルールを Book 0 全体の編集方針として書き直す (rewrite_substantially)。捨てる節は無し — 各節とも新構造で位置を持つ。重複する motivating story (例: 律速診断の機能性材料 PJ と retrofit の透明断熱材) は Book III の 8 PJ retrofit の素材として分散配置する。

**sections_map** (69 節):

| 出典節 | 要約 | → 新章 | role | notes |
|---|---|---|---|---|
| `score-and-bottleneck` :: 冒頭ストーリー (桜が散ったあとの月曜日) | 九項目計画が三か月後に全て『継続検討』で止まり、顧問が『一つに絞れない物差し』を指摘する導入 | Ch 9 | primary | Ch 9 (ERS 加重和 + 二層非可換性) の motivating story というより、Book II の統合スコア提示の動機付け。Ch 5-9... |
| `score-and-bottleneck` :: ## 計算は9本の軸で行う — P・R・S は概念のラベル | P/R/S は概念ラベルで実計算は 9 軸同格の積、軸テーブル提示 | Ch 6 | primary | Ch 6 (PRS 期待値分解) の核心。P/R/S が独立因子ではなくラベルである旨と 9 軸定義を Ch 6 に移植 |
| `score-and-bottleneck` :: ## なぜ掛け算か — Cobb-Douglas という選択 | 加重和/min/Cobb-Douglas の比較、律速表現可能性、CES 補完性 | Ch 6 | primary | Ch 6 の Cobb-Douglas 導出。Ch 9 (ERS 加重和) との対比軸として重要 — 'なぜ案件は積、機関は和か' の伏線 |
| `score-and-bottleneck` :: ## +1 シフトの2つの役割 | ゼロ消滅回避と対数スケール読みやすさの説明 | Ch 6 | primary | Ch 6 内の式設計の technical note。付録 A へ一部移しても可 |
| `score-and-bottleneck` :: ## 重み α — 専門家判断の事前値と、過去ケースでの校正 | 9 軸の α 値と F/σ_SU 重視思想、ベイズ事前値の位置づけ | Ch 26a | primary | α 値表は calibration 章 (Ch 26a) の核。Ch 6 にはエッセンスのみ残し、具体値と推定論議は Ch 26a へ |
| `score-and-bottleneck` :: ## K の校正 — 全軸最高で 100,000 という物差し合わせ | K の校正規約と対数スケール上の順位指標としての読み方 | Ch 26a | secondary | calibration 詳細は Ch 26a、付録 A にも収録 |
| `score-and-bottleneck` :: ## 例題 — 手を動かして一度計算する | 吸着材 PJ の 9 軸採点とスコア=45 の手計算 | Ch 12 | primary | Book III の 8 PJ retrofit に組み込む匿名 motivating case。または Ch 6 例題として併用 |
| `score-and-bottleneck` :: ## 実用の核心 — 律速診断 | 偏微分から α/(X+1) の bottleneck 定義導出 | Ch 6 | primary | Ch 6 PRS 期待値分解の応用、または Ch 5.5 GO 導出と並ぶ数学装置 |
| `score-and-bottleneck` :: ### 例題のつづき — 九項目の計画を一つに絞る | 9 軸 α/(X+1) 計算で R_net 律速、$F$ + HRL 二番手 | Ch 12 | primary | motivating case 続編 — Book III retrofit と連動 |
| `score-and-bottleneck` :: ### 律速診断の読み方 — 三つの注意 | 効き目 vs 上げやすさ、構造的ゼロの読み替え、スコアと診断の用途分け | Ch 6 | primary | 実務的注意点として Ch 6 末尾。または Ch 35 政策含意にも一部反響 |
| `score-and-bottleneck` :: ## 軸どうしは独立ではない — 共線性の扱い | 共線性の積構造での扱い、連動が崩れた事例こそ情報量最大 | Ch 26a | primary | Ch 26a calibration と Ch 11 BVAR の identification 議論につながる |
| `score-and-bottleneck` :: ### 練習問題 | 計算/律速/概念の 3 問 | 付録 A | primary | 数学補遺 (付録 A) の演習として収録 |
| `score-and-bottleneck` :: ## 実例 — 律速診断が、見たくない軸を指したとき | 機能性材料 PJ で F が律速と診断され、得意分野への重力に逆らった事例 | Ch 13 | primary | Book III motivating case の一つ |
| `score-and-bottleneck` :: ## 章末の問い | 8 項目の現場チェックリスト | Ch 6 | secondary | 各章末問いとして再配置 — Book II Ch 6 末尾 |
| `model-critiques` :: 冒頭ストーリー (経済学研究会の質疑) | 計量経済学者・VC・経営学者三人の批判と発表者の『ご指摘は三つとも正しい』応答 | Ch 36 | primary | Book VI の critiques 受け止めの motivating frame、または Ch 38 新領域宣言の前置きに |
| `model-critiques` :: ## なぜ、自分のモデルの批判を一章かけて書くのか | 限界の章を書く方法論的理由 = 反証可能性の確保 | Ch 36 | primary | Book VI の epistemology 章 |
| `model-critiques` :: ## 最大の批判 — 割引率は三つの仕事を束ねている | 割引率の3仕事 (失敗リスク/時間価値/市況連動) 分解と S が肩代わりできる範囲 | Ch 11 | primary | Ch 11 BVAR+jump+gate に直結。時間価値ゲート設計に組み込む。Ch 38 でも参照 |
| `model-critiques` :: ### 第一の仕事 — 失敗リスクの補正 | S は割引率より筋の良い置き場所 — 失敗確率のモデル化 | Ch 11 | primary | Ch 7 (S 内部 F-CES) / Ch 11 の理論的正当化 |
| `model-critiques` :: ### 第二の仕事 — 時間価値 | S は『いつ』を測れない、創薬 vs ロボティクス比較不可 | Ch 11 | primary | Ch 11 gate 設計の根拠 — (スコア, 必要月数) の二次元ゲート |
| `model-critiques` :: ### 第三の仕事 — 市況連動リスク | σ_SU 共通成分でポートフォリオの分散効果が過大評価される逆向き論点 | Ch 11 | primary | Ch 11 BVAR の市況連動 factor 議論。Ch 35 政策含意にも反響 |
| `model-critiques` :: ### 処方 — 時間と市況は、別の物差しで併読する | 二次元ゲート、低率時間割引の併読、ポートフォリオ共通ファクター開示の三処方 | Ch 11 | primary | Ch 11 の gate + jump 設計の実装処方 |
| `model-critiques` :: ## 経済学者からの五つの批判 | 識別問題、後知恵、自己選択、順序尺度、最適制御 5 批判 | Ch 36 | primary | Book VI Ch 36 機関 KPI 批判 / Ch 37 head-to-head の前提として整理。Ch 26a/26b にも分配 |
| `model-critiques` :: ### 批判 1 — パラメータは『推定』されていない | 識別不能、専門家事前信念のベイズ的位置づけ | Ch 26a | primary | Ch 26a calibration 章の方法論基盤 |
| `model-critiques` :: ### 批判 2 — 過去ケースへの当てはめは、後知恵である | 後知恵バイアスと blind retrofit + 事前予測 registry | Ch 26b | primary | Ch 26b prediction registry の核心 |
| `model-critiques` :: ### 批判 3 — サンプルは自己選択されている | 見送り案件 = 対照群の追跡設計 | Ch 26b | primary | Ch 26b registry に見送り案件追跡を組み込む |
| `model-critiques` :: ### 批判 4 — 順序の数字を、比率の数字として扱っている | 順序尺度と単調変換頑健性 | Ch 26a | primary | Ch 26a 感度分析の節 |
| `model-critiques` :: ### 批判 5 — 生存確率は、状態ではなく『打ち手』の関数 | S の定義に『優れた伴走前提』を明記、支援価値 = Δ生存確率 | Ch 7 | primary | Ch 7 S 内部 F-CES の前提明示 + Ch 33 GAP+URA+EIR の支援価値定義 |
| `model-critiques` :: ## 経営学者からの六つの批判 | 機会創造観/逆U字/構成概念妥当性/Goodhart/動的能力/べき乗則 | Ch 36 | primary | Book VI Ch 36 head-to-head 比較と Ch 38 新領域宣言の前置きに分配 |
| `model-critiques` :: ### 批判 1 — 機会は発見されるのではなく、創造される | エフェクチュエーションと P の動的扱い、許容可能損失 = y | Ch 6 | secondary | Ch 6 PRS 期待値分解に P の動的更新を明記。Ch 38 新領域宣言で発見/創造観統合を主張 |
| `model-critiques` :: ### 批判 2 — 余力は多いほど良いのか。逆U字 | 組織スラック逆U字、H = y/T_remaining の上側警戒帯 | Ch 8 | primary | Ch 8 戦略余力動学に上側警戒帯の追加 |
| `model-critiques` :: ### 批判 3 — 資質は本当に測れているのか | 構成概念妥当性、観察可能 Yes/No 化、複数評定者、blind 採点 | Ch 7 | primary | Ch 7 (S 内部 F-CES) の F 採点方法論。Ch 26a 採点プロトコルにも |
| `model-critiques` :: ### 批判 4 — グッドハートの法則 | 測定が目標化する、証拠の質で刻む、採点者と受益者の分離 | Ch 36 | primary | Book VI Ch 36 機関 KPI の中核論点 + Ch 32 ERS 8 軸別処方 |
| `model-critiques` :: ### 批判 5 — 学習する力が、変数になっていない | 動的能力、交換効率を時間変数として追跡、支援価値の主経路 | Ch 8 | primary | Ch 8 戦略余力動学に交換効率の時間変数化を追加。Ch 33 GAP+URA+EIR の支援価値定義に接続 |
| `model-critiques` :: ### 批判 6 — 単一スコアは、ポートフォリオを均質化する | べき乗則 outlier、確信による例外を記録付きで運用 | Ch 36 | primary | Book VI Ch 36 KPI 設計 + Ch 35 政策含意 |
| `model-critiques` :: ## 実例 — 物差しが歪み始めた、二つの場面 | 候補数の水増し (Goodhart) と医薬 vs 機械の時間軸無視の二場面 | Ch 12 | secondary | Book III motivating case として再利用 (両方とも特定 PJ ではないので複数章に散らす可) |
| `model-critiques` :: ## 章末の問い | 使い手向け 8 項目チェック | Ch 36 | secondary | Book VI Ch 36 末尾 + 付録 C (やらかし図鑑) にも反響 |
| `retrofit-verification` :: 冒頭ストーリー (段ボール二箱と進行中案件の既視感) | 終了案件を (x,y) 平面に描き直したら、進行中案件と同じ折れ線が見えた | Ch 12 | primary | Book III の総 motivating frame として最適。retrofit 8 PJ の方法論の入口 |
| `retrofit-verification` :: ## モデルは信じるものではなく、検証するもの | 構造化された専門家判断システムとしての位置づけ、retrofit の役割 | Ch 26b | primary | Ch 26b prediction registry の方法論前文 |
| `retrofit-verification` :: ## 『設立が早すぎた』がスコア差として再現される | 定性的後悔が桁違いのスコア差として再現される — 透明断熱材タイプ | Ch 12-19 のいずれか | primary | Book III 8 PJ retrofit のうち『早すぎた設立』型 PJ の primary 素材 |
| `retrofit-verification` :: ## 数値化を急がない — 検証の順序 | 四段階運用 (地図→観測項目→軌跡再構成→確率校正) | Ch 26a | primary | Ch 26a calibration プロトコル — 数値化前に会話の道具として使う哲学 |
| `retrofit-verification` :: ## 軌跡パターンは、実データで本当に分離するか | 健全/ゾンビ/即落/鋸歯 4 型と実データでの分離検証 | Ch 25 | primary | Ch 25 層間結合 + Ch 26b prediction registry の軌跡型照合台帳 |
| `retrofit-verification` :: ## 検証の落とし穴 (1) — 後知恵バイアスと blind retrofit | blind retrofit 手続きと事前予測への重心移動 | Ch 26b | primary | Ch 26b prediction registry の手続き定義 = 核心 |
| `retrofit-verification` :: ## 検証の落とし穴 (2) — 自己選択と、見送り案件という対照群 | ウォッチリスト追跡で対照群を作る | Ch 26b | primary | Ch 26b registry に組み込む。Ch 27 掘り起こしとも接続 |
| `retrofit-verification` :: ## R と y の線引きを、当てはめで確かめる | R と y の境界を retrofit で磨く方法論 | Ch 25 | primary | Ch 25 層間結合の定義磨き。Ch 1-3 状態空間定義への frontloading 議論にも |
| `retrofit-verification` :: ## 実例 — 『早すぎた設立』を軌跡で読み直す | 透明断熱材タイプの設立時スコアと軌跡再構成 = ゾンビ型 | Ch 12-19 のいずれか | primary | Book III の 1 PJ retrofit の primary 素材として展開 |
| `retrofit-verification` :: ## 章末の問い | 過去案件・進行中案件・見送り案件の検証チェック 8 項目 | Ch 26b | secondary | Ch 26b 末尾 + 付録 B データ仕様にも反響 |
| `nursery-ers` :: 冒頭ストーリー (二人の研究者と二つの大学) | 同じ水準のシーズが異なる土壌で十八か月後にまったく違う速度になる | Ch 32 | primary | Book V Institution-side Design 全体の motivating frame |
| `nursery-ers` :: ## なぜ『土壌』を独立に測るのか | 二層 readiness の理論的根拠 — 時間尺度の違い、支援ギャップ可視化 | Ch 0.3 | primary | Book 0 Ch 0.3 二層 readiness 方法論の front-load。Ch 9 二層非可換性にも |
| `nursery-ers` :: ## 機関整備度は 8 つの軸で見る | ERS 8 軸定義 + TLO/EIR/ギャップ資金/COI 用語 | Ch 3 | primary | Ch 3 ERS 概念の核心定義。Ch 32 で軸別処方に展開 |
| `nursery-ers` :: ### 各軸は Lv1〜5 の『到達状態』で測る | rubric の例 (知財/資金/制度設計の Lv フル表) | Ch 32 | primary | Ch 32 ERS 8 軸別処方の rubric 詳細。付録 B にも収録 |
| `nursery-ers` :: ### 充足率としての ERS — 計算のしかた | ERS = 100·Σw_k·A_k 加重和計算、レーダーで凹みを読む | Ch 9 | primary | Ch 9 ERS 加重和 + 二層非可換性の数式核心 |
| `nursery-ers` :: ## なぜ掛け算ではなく、加重和なのか | 案件は積/機関は和の数式の対比 — 外部連携で補える、欠損可視化目的 | Ch 9 | primary | Ch 9 二層非可換性の核心論証 — Book II 全体の echo として最重要 |
| `nursery-ers` :: ## 機関の評価と、案件の評価を混ぜない | 二重計上禁止、単発成功と pipeline 区別、二行に分ける作法 | Ch 9 | primary | Ch 9 二層非可換性の運用作法。Ch 25 層間結合とも |
| `nursery-ers` :: ## 弱い軸は、外部連携で補ってよい | 自前 vs 外部委託、unknown/not_started 区別、根拠ノート | Ch 32 | primary | Ch 32 ERS 8 軸別処方 + Ch 34 地域動態 |
| `nursery-ers` :: ## 大きな改革ではなく、90 日の試行から | 90 日 pilot charter の四項目構造 | Ch 33 | primary | Ch 33 GAP+URA+EIR の実装作法 |
| `nursery-ers` :: ## 実例 — 二つの機関 | 単発成功 pipeline 不在の国立大 / 外部連携で動く小規模地方大 | Ch 20-24 | primary | Book III 機関 retrofit の primary 素材 2 件 |
| `nursery-ers` :: ## 章末の問い | 機関 8 軸自己評価チェック 7 項目 | Ch 32 | secondary | Ch 32 末尾 + Ch 36 機関 KPI |
| `ethics-and-authorship` :: 冒頭 (ストーリーから始めない理由) | 本書の語る位置 (著者性/利害) を本文外に逃さないという宣言 | Ch 0.0 | primary | Book 0 Ch 0.0 射程と匿名化方針の front-load |
| `ethics-and-authorship` :: ## なぜ、この章を巻末に置くのか | モデル批判と立場批判の区別、出版倫理 | Ch 0.0 | primary | 新構造では front-load (Ch 0.0) と末尾 (Ch 38 後の付記) に二分割の可能性 |
| `ethics-and-authorship` :: ## 批判 (1) — これは支援者の営業資料ではないか | 支援者バイアス自覚と本文が守る三つの線 | Ch 0.0 | primary | Ch 0.0 匿名化方針 + 著者立場明示 |
| `ethics-and-authorship` :: ## 批判 (2) — 研究者や大学を代弁する資格があるのか | 元アカデミアでも代弁資格はない、当事者の声が消える構造を書く | Ch 0.0 | primary | Ch 0.0 著者性宣言 + Ch 38 新領域宣言の謙抑性 |
| `ethics-and-authorship` :: ## 批判 (3) — 公的研究を市場へ従属させていないか | 市場を唯一の審判にしない、研究機関への還元設計 | Ch 35 | primary | Ch 35 政策含意 + Ch 38 新領域宣言 — AMD の知財収益還元目的と整合 |
| `ethics-and-authorship` :: ## 批判 (4) — 匿名化された実例は、都合よく作られていないか | composite case の限界、検証手続きを別に置く | Ch 0.0 | primary | Ch 0.0 匿名化方針 + Ch 26b registry |
| `ethics-and-authorship` :: ## 批判 (5) — 当事者の経験を、著者の知的資産として回収していないか | 経験の倫理的扱い、書き方の倫理 5 線 | Ch 0.0 | primary | Ch 0.0 匿名化方針 |
| `ethics-and-authorship` :: ## 批判 (6) — スコアや資質評価が、人を傷つけるのではないか | バイアス再生産、観察可能行動への分解、異議申し立て経路 | Ch 7 | secondary | Ch 7 F-CES 採点方法論 + Ch 36 KPI 倫理 |
| `ethics-and-authorship` :: ## 批判 (7) — 支援者が研究者の主導権を奪う道具にならないか | 道具の使い方倫理、選択肢を一つに見せない、沈黙を同意としない | Ch 33 | primary | Ch 33 GAP+URA+EIR の支援者倫理 + Ch 28 第一歩 |
| `ethics-and-authorship` :: ## 批判 (8) — 執筆過程と責任の所在 | 編集過程と最終責任、読者が気にする境界の明示 | Ch 0.0 | primary | Ch 0.0 author's note |
| `ethics-and-authorship` :: ## 編集上の運用 — 批判をどう本文に反映するか | 4 つの編集運用ルール (立場開示/強実例の弱化/社会実装の非一方向性/批判余地) | Ch 0.0 | rewrite_substantially | Book 0 全体への運用ルール — Ch 0.0 author's note と編集方針として書き直し |
| `ethics-and-authorship` :: ## 章末の問い | 読者向け 8 項目倫理チェック | Ch 38 | secondary | Ch 38 新領域宣言の末尾 + 付録 C |

---

## 3. 統計サマリ

- **合計 mapping 件数**: 194 節
- **対象 source ファイル**: 13 個 (preface + 5 field-* + why-valuation + model-overview + p + r + s + strategic-slack + score-and-bottleneck + model-critiques + retrofit-verification + nursery-ers + ethics-and-authorship)
- **target_role 分布**:
  - `primary`: 156 件
  - `secondary`: 28 件
  - `reference`: 4 件
  - `rewrite_substantially`: 6 件

- **target_chapter 分布 (Book 別)**:
  - Book 0: 31 件
  - Book I: 24 件
  - Book II: 61 件
  - Book III: 20 件
  - Book IV: 21 件
  - Book V: 13 件
  - Book VI: 8 件
  - 付録: 6 件
  - discard: 1 件
  - other: 9 件

---

## 4. 関連ドキュメント

- **新 Book 0-VI 構造案**: [/bzm/2026-06-25_proposal_book0_vi](/bzm/2026-06-25_proposal_book0_vi)
- **既存 bzm/ 章本文**: `/bzm/preface`, `/bzm/field-before-zero` 等 (それぞれ PWA でアクセス可能)

## Changelog

| 日付 | 変更 | 担当 |
|---|---|---|
| 2026-06-25 | 初版作成。workflow `wl8pcv7wl` の 5 並列 mapping を統合し、新章ごと・グループ別の二視点で table 化 | えいみ |