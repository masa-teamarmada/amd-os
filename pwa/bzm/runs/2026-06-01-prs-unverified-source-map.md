# P/R_net unverified flag source map

作成日: 2026-06-01
作成者: BZM理論検証worker
ステータス: BZM司令塔レビュー待ち

## 0. この成果物の扱い

このファイルは、P/R_net/Survival guard の観測項目draftに出ている未確認flagを、9PJ evidence cardsへ戻すための source map である。

- P/R_net の 0-9 値表は作らない。
- DB列、migration、extractor実装、deployは行わない。
- 現行7軸AMD Scoreは正式モデルのまま扱う。
- PRSは `Adopt as comparison layer` の検証用に留める。
- ここでの `l2_extractable` は「既存L2/既存docs/DB/outboxから候補を拾える」という意味であり、自動採用や正式値ではない。
- `masa_or_bzm_judgement` は、source候補を見たうえでまさ/BZMが境界を決める必要がある論点を指す。

確認した主資料:

- `pwa/bzm/runs/2026-06-01-prs-pr-rnet-evidence-cards.md`
- `pwa/bzm/runs/2026-06-01-prs-rnet-guard-memo.md`
- `pwa/bzm/runs/2026-06-01-prs-pr-rnet-observation-items-draft.md`
- `pwa/design/amd_score.md`
- `pwa/spec/3-1-l2-data-extraction-current-spec.md`
- `pwa/manual/3-2-data-and-extraction.md`
- `pwa/design/L2_DATA.md`
- `pwa/bzm/COMMANDER_TASKS.md`

前提にしたBZM判断:

- CTB型は `Survival guard / lane-specific survival evidence` として分離継続。
- JOYCLE型は正式名称未確定のまま `本命毀損 / damage guard` として扱う。
- Yellow Duck型はP側の低P/市場構造の筋悪さと、R_net側の粗利不成立の両方へ置く。
- BWE膜外販は供給余力・粗利・本命RED装置への影響が揃うまで `未確定R_net`。

## 1. source分類

| 分類 | 意味 | 使い方 |
|---|---|---|
| `l2_extractable` | 既存L2、既存docs、DB、outbox、月次/MTG/knowledgeなどから候補を拾える | 次workerが read-only で source候補を集め、confidence/source_refs付きで一覧化する |
| `worker_research` | workerが公開資料、既存knowledge、公開市場情報、類似SU調査から補強できる | 公開情報と内部knowledgeを分け、内部根拠だけで市場一般論を確定しない |
| `masa_or_bzm_judgement` | まさ/BZMの理論境界、反実仮想、資源配分、本命毀損判定が必要 | sourceを見たうえで、comparison layer上の置き場所だけ判断する。正式rubric承認ではない |

## 2. 未確認flag source map

### 2.1 P flags

| flag | 観測項目 | l2_extractable | worker_research | masa_or_bzm_judgement | 近いL2領域 |
|---|---|---|---|---|---|
| `p_market_ceiling_unverified` | 市場/成功上限 | project knowledge、monthly report、meeting summary、strategy signals、既存BZM evidence card | 公開市場レポート、競合資金調達、類似SU売上/EXIT、政策市場形成情報 | TAMをPJ固有Pへどこまで割り引くか。反実仮想市場をPに入れるか | project knowledge / monthly report / meeting summary / policy signal |
| `p_lane_ceiling_unverified` | 用途レーン別の天井 | project knowledge、meeting summary、project_strategy_signals、BZM/Textbook insight候補 | 用途別市場、顧客セグメント、用途別競合、レーン別規制 | U1短期キャッシュ層とU4/U5本命市場を分ける基準 | project knowledge / meeting summary / textbook insights / policy signal |
| `p_project_capture_unverified` | PJ固有の到達可能市場 | project knowledge、XRL根拠、monthly report、meeting summary | 競合比較、特許/IP範囲、製造能力、営業チャネル、規制制約 | レーン全体のPから、そのPJが取れる上限へどこまで落とすか | project knowledge / xrl evidence / monthly report |
| `p_ue_unverified` | UE/価格受容性 | monthly report、meeting summary、finance、project knowledge、strategy signals | 顧客価格、LCOE/COGS、VC DD、海外類似SU失敗理由 | 技術PoCを商用UE成立と見てよいか。NO_GO根拠としてどこまで強く扱うか | monthly report / meeting summary / finance / project knowledge |
| `p_market_structure_unverified` | 市場構造の筋悪さ | strategy signals、meeting summary、project knowledge、XRL根拠 | VC/DDコメント、販売構造、規制、設置/保守条件、類似SU失敗理由 | BRL不足ではなくP低さとして扱う境界 | strategy signals / meeting summary / project knowledge / xrl evidence |
| `p_substitute_unverified` | 代替技術/競合圧力 | atlas_signals、project knowledge、strategy signals、XRL根拠 | 論文/特許、競合上市、顧客既存解、資金調達ニュース | 代替技術の強さをPJ固有Pの割引として採用するか | policy signal / project knowledge / strategy signals / xrl evidence |
| `p_exit_path_unverified` | 出口可能性補助 | meeting summary、project knowledge、monthly report、strategy signals | M&A/IPO/ライセンス事例、製薬提携、VC DD | 出口可能性をP本体に加えるか、Survival guard補助に留めるか | meeting summary / project knowledge / monthly report |
| `p_policy_problem_unverified` | 政策・社会課題の大きさ補助 | atlas_signals、strategy signals、project knowledge、meeting summary | 政策文書、公募、社会課題レポート、業界団体資料 | 社会課題の大きさをPへ加点せず、価格受容や顧客予算で割り引く境界 | policy signal / strategy signals / project knowledge |

### 2.2 R_net flags

| flag | 観測項目 | l2_extractable | worker_research | masa_or_bzm_judgement | 近いL2領域 |
|---|---|---|---|---|---|
| `r_revenue_unverified` | 売上/受注実績 | finance、monthly report、meeting summary、project knowledge、billing/payment docs | 公開導入実績、プレスリリース、販売開始情報 | 販売前夜、見込み、受注、入金済みをどう分けるか | finance / monthly report / meeting summary / project knowledge |
| `r_gross_margin_unverified` | 粗利貢献 | finance、monthly report、meeting summary、project knowledge、contract docs | 類似製品粗利、製造原価、外注費、保守費の公開ベンチマーク | 粗利をR_net候補として扱う最低根拠。補助金/実証採択を混ぜない判断 | finance / monthly report / meeting summary |
| `r_operating_cost_unverified` | 運営コスト | finance、monthly report、meeting summary、member knowledge、project knowledge | 類似SU burn、CAPEX、規制/実証管理コスト | 固定費増や導入負担が粗利を相殺するか | finance / monthly report / member knowledge |
| `r_cash_conversion_unverified` | 入金サイト/運転資金負荷 | finance、monthly report、meeting summary、grant/payment docs | 補助金後払い条件、顧客検収条件、業界商習慣 | 売上/補助金がrunwayへ実効的に効くか | finance / monthly report / meeting summary |
| `r_reinvestment_unverified` | 本命PJへの再投資 | monthly report、meeting summary、project knowledge、protocols、strategy signals | 事業計画、資金使途、採用/研究開発予算の公開情報 | つなぎ収益が本命を支えると判断してよいか。反実仮想をどこまで採用するか | monthly report / meeting summary / project knowledge / protocols |
| `r_damage_guard_unverified` | 本命PJへのリソース毀損 / damage guard | meeting summary、monthly report、protocols、project knowledge、member knowledge、strategy signals | 公開方針転換、開発停止、研究連携縮小、採用/予算削減の痕跡 | JOYCLE型を負のR_netと呼ぶか、rubric外damage guardに留めるか | meeting summary / protocols / project knowledge / member knowledge |
| `r_ue_margin_unverified` | 低P/UE由来の粗利不成立 | monthly report、meeting summary、finance、strategy signals、project knowledge | LCOE、COGS、価格受容、VC DD、類似SU失敗理由 | Yellow Duck型をP側とR_net側の両方に置く粒度 | monthly report / finance / strategy signals / project knowledge |
| `r_bridge_business_unverified` | 本命前つなぎ事業の独立性 | project knowledge、monthly report、meeting summary、strategy signals | 顧客一覧、プロダクトロードマップ、技術依存関係、類似事例 | 別系統つなぎか、本命MVP前倒しか、個別受託消化か | project knowledge / monthly report / meeting summary |
| `r_bottleneck_external_sale_unverified` | ボトルネック資源の外販影響 | project knowledge、meeting summary、monthly report、XRL根拠、technical notes | 供給余力、部材/膜の公開供給制約、製造能力、外販先候補 | BWE膜外販を未確定R_netから正/負へ動かす条件 | project knowledge / meeting summary / xrl evidence |
| `r_validation_value_unverified` | 評価データ獲得の補助メモ | meeting summary、project knowledge、XRL根拠、monthly report、strategy signals | 実証レポート、共同研究成果、顧客評価、薬事/提携に必要な証拠 | 評価データを粗利ではなくBRL/SRLまたはSurvival guardへ置く判断 | meeting summary / project knowledge / xrl evidence / strategy signals |

### 2.3 Survival guard flags

| flag | 観測項目 | l2_extractable | worker_research | masa_or_bzm_judgement | 近いL2領域 |
|---|---|---|---|---|---|
| `s_grant_unverified` | 非希薄化資金 / 助成金 | finance、monthly report、meeting summary、strategy signals、project knowledge | AMED/NEDO/SIP/SBIR公募、採択情報、交付条件 | 助成金をR_netに混ぜず、何か月runwayを延ばす証拠として扱うか | finance / monthly report / meeting summary / policy signal |
| `s_regulatory_exit_unverified` | 薬事 / ライセンス / EXIT可能性 | project knowledge、meeting summary、monthly report、strategy signals | 薬事milestone、製薬提携、ライセンス類似事例、M&A/EXIT事例 | CTB型をR_net低値でNO_GOにしないguardの強さ | project knowledge / meeting summary / monthly report |
| `s_policy_demo_unverified` | 政策資金 / 実証採択 | atlas_signals、strategy signals、monthly report、meeting summary、project knowledge | SIP/東京都実証/政策公募、交付条件、実証管理コスト | 政策/実証を7軸/Survivalに置き、R_net粗利へ混ぜない境界 | policy signal / strategy signals / monthly report |
| `s_validation_data_unverified` | 評価データ獲得価値 | meeting summary、project knowledge、XRL根拠、monthly report | 実証レポート、顧客評価、共同研究成果、試験データ | 利益度外視テスト販売をどの程度Survival補助に置くか | meeting summary / project knowledge / xrl evidence |
| `s_lane_guard_unverified` | lane-specific survival evidence | project knowledge、meeting summary、monthly report、protocols、strategy signals | レーン別事業計画、規制、補助金、顧客導入条件、類似SU | 全PJに同じR_net観測を当てない例外条件の採用 | project knowledge / meeting summary / protocols / strategy signals |

## 3. 9PJ evidence cardsへのflag戻し

| PJ | P flags | R_net flags | Survival guard flags | source優先順位 | 司令塔判断メモ |
|---|---|---|---|---|---|
| p03 ティエムファクトリ | `p_market_ceiling_unverified`, `p_project_capture_unverified`, `p_lane_ceiling_unverified` | `r_revenue_unverified`, `r_gross_margin_unverified`, `r_operating_cost_unverified`, `r_reinvestment_unverified`, `r_bridge_business_unverified`, `r_damage_guard_unverified` | なし | 1. project knowledge / monthly report / meeting summary 2. Cabot代理店・開発受託の公開/内部資料 3. まさ反実仮想判断 | 商社/受託が本命モノリスを支える構造だったか、逆に本命を逸らす仕事だったかはまさ/BZM判断が必要。 |
| p04 輝翠TECH | `p_market_ceiling_unverified`, `p_project_capture_unverified` | `r_revenue_unverified`, `r_gross_margin_unverified`, `r_operating_cost_unverified`, `r_cash_conversion_unverified`, `r_bridge_business_unverified` | `s_validation_data_unverified` | 1. monthly report / meeting summary / project knowledge 2. Adam販売公開情報 3. まさの販売台数・粗利・保守負担確認 | Adam販売を本命MVP前倒し収益と見るか、導入/保守負担で割り引くか。 |
| p06 CrestecBio | `p_market_ceiling_unverified`, `p_project_capture_unverified`, `p_exit_path_unverified` | `r_operating_cost_unverified`, `r_cash_conversion_unverified` | `s_grant_unverified`, `s_regulatory_exit_unverified`, `s_lane_guard_unverified` | 1. project knowledge / monthly report / meeting summary / finance 2. AMED・薬事・製薬提携情報 3. BZMの創薬lane guard判断 | CTBはR_net低値ではなく、売上ゼロ期間を外部資金/薬事/EXITで耐える構造を別guardへ置く。 |
| p07 LiSTie | `p_market_ceiling_unverified`, `p_project_capture_unverified`, `p_policy_problem_unverified` | `r_revenue_unverified`, `r_gross_margin_unverified`, `r_operating_cost_unverified`, `r_cash_conversion_unverified`, `r_reinvestment_unverified`, `r_bridge_business_unverified` | `s_grant_unverified`, `s_policy_demo_unverified` | 1. monthly report / meeting summary / finance / project knowledge 2. 補助金・リサイクル商流資料 3. まさの資金繰り/再投資判断 | リサイクル先行売上を粗利/入金/本命LISMIC影響まで分けて見る。補助金はR_net粗利へ混ぜない。 |
| p09 JOYCLE | `p_market_ceiling_unverified`, `p_project_capture_unverified`, `p_market_structure_unverified` | `r_revenue_unverified`, `r_gross_margin_unverified`, `r_operating_cost_unverified`, `r_reinvestment_unverified`, `r_damage_guard_unverified`, `r_bridge_business_unverified` | `s_validation_data_unverified` | 1. meeting summary / protocols / project knowledge / monthly report 2. JB-02/JB-02Aの公開/内部資料 3. BZMのdamage guard名称・扱い判断 | 装置販売前夜を正のR_netにしない。本命R&D縮小やAMD関与終結ログがあればdamage guard候補。 |
| p11 BWE | `p_market_ceiling_unverified`, `p_project_capture_unverified`, `p_policy_problem_unverified` | `r_operating_cost_unverified`, `r_cash_conversion_unverified`, `r_bottleneck_external_sale_unverified`, `r_gross_margin_unverified`, `r_bridge_business_unverified` | `s_grant_unverified`, `s_policy_demo_unverified`, `s_lane_guard_unverified` | 1. project knowledge / meeting summary / monthly report / strategy signals 2. SIP/東京都実証/膜供給資料 3. BZMの未確定R_net継続判断 | 膜外販は供給余力・粗利・本命RED装置への影響が揃うまで未確定。政策資金はSurvival/7軸へ分離。 |
| p18 Yellow Duck | `p_ue_unverified`, `p_market_structure_unverified`, `p_project_capture_unverified`, `p_substitute_unverified` | `r_ue_margin_unverified`, `r_operating_cost_unverified`, `r_gross_margin_unverified` | `s_lane_guard_unverified` | 1. strategy signals / meeting summary / project knowledge 2. VC DD・LCOE・海外類似SU失敗理由 3. BZMの低P/UE不成立の置き場所判断 | 低P/市場構造の筋悪さと粗利不成立を両方に置く。ただしBRL不足へ潰さない。 |
| p20 CryoX | `p_market_ceiling_unverified`, `p_lane_ceiling_unverified`, `p_project_capture_unverified`, `p_policy_problem_unverified` | `r_revenue_unverified`, `r_gross_margin_unverified`, `r_operating_cost_unverified`, `r_reinvestment_unverified`, `r_validation_value_unverified`, `r_bridge_business_unverified` | `s_validation_data_unverified`, `s_policy_demo_unverified`, `s_lane_guard_unverified` | 1. project knowledge / meeting summary / monthly report / XRL根拠 2. TES/ADR/冷却機の市場・原価・NIMS関連資料 3. まさ/BZMのテスト販売位置づけ判断 | 利益度外視テスト販売は粗利ではなく評価データ価値として分ける可能性が高い。 |
| p21 SolvioraX | `p_market_ceiling_unverified`, `p_lane_ceiling_unverified`, `p_project_capture_unverified`, `p_ue_unverified`, `p_policy_problem_unverified` | `r_revenue_unverified`, `r_gross_margin_unverified`, `r_operating_cost_unverified`, `r_cash_conversion_unverified`, `r_reinvestment_unverified`, `r_damage_guard_unverified`, `r_bridge_business_unverified` | `s_policy_demo_unverified`, `s_validation_data_unverified`, `s_lane_guard_unverified` | 1. project knowledge / meeting summary / monthly report / finance 2. U1 PoC・サブスク/重量課金・GMO/顧客実装資料 3. まさ/BZMのU1とU4/U5分離判断 | U1短期キャッシュ層とU4/U5本命大市場を混ぜない。設立準備中なので実績値扱いしない。 |

## 4. sourceを埋める順番

### 4.1 L2抽出候補で先に拾う

次workerは read-only で、既存L2/DB/docs/outboxから候補sourceを拾うだけに留める。DB化や自動抽出実装はしない。

| source pack | 対象flag | 対象PJ | 近いL2領域 |
|---|---|---|---|
| 月次/MTG/strategy signalからの売上・受注・PoC・実証候補 | `r_revenue_unverified`, `r_bridge_business_unverified`, `r_validation_value_unverified`, `s_validation_data_unverified` | p04, p07, p09, p20, p21 | monthly report / meeting summary / strategy signals |
| finance/支払/契約docsからの粗利・入金・burn候補 | `r_gross_margin_unverified`, `r_operating_cost_unverified`, `r_cash_conversion_unverified`, `s_grant_unverified` | p04, p07, p11, p20, p21, p06 | finance / monthly report / meeting summary |
| project knowledge/XRL根拠からの市場・用途・capture候補 | `p_market_ceiling_unverified`, `p_lane_ceiling_unverified`, `p_project_capture_unverified`, `p_policy_problem_unverified` | 9PJ全体 | project knowledge / xrl evidence / policy signal |
| protocols/meeting summaryからの本命毀損・方針転換候補 | `r_damage_guard_unverified`, `r_reinvestment_unverified` | p03, p09, p20, p21 | protocols / meeting summary / project knowledge |
| policy/実証/助成金のSurvival候補 | `s_grant_unverified`, `s_policy_demo_unverified`, `s_lane_guard_unverified` | p06, p07, p11, p20, p21 | policy signal / monthly report / strategy signals |

### 4.2 worker researchで補強する

| research pack | 対象flag | 対象PJ | 目的 |
|---|---|---|---|
| 市場/競合/代替技術 desk research | `p_market_ceiling_unverified`, `p_project_capture_unverified`, `p_substitute_unverified` | p03, p04, p06, p11, p18, p20, p21 | TAMではなくPJ固有Pへ割り引く材料を作る |
| UE/LCOE/COGS/価格受容 desk research | `p_ue_unverified`, `p_market_structure_unverified`, `r_ue_margin_unverified` | p18中心、p21/p04補助 | Yellow Duck型の低P/UE不成立をBRL不足と分離する |
| 助成金/政策/実証条件 research | `s_grant_unverified`, `s_policy_demo_unverified`, `p_policy_problem_unverified` | p06, p07, p11, p20, p21 | 政策資金をR_net粗利へ混ぜず、Survival/7軸へ置く材料を作る |
| 類似SU failure / exit research | `p_exit_path_unverified`, `s_regulatory_exit_unverified`, `s_lane_guard_unverified` | p06, p18, p11, p20 | lane-specific guardを過不足なく置く |

### 4.3 まさ/BZM判断が必要

| judgement item | 対象PJ | 理由 |
|---|---|---|
| ティエム商社/受託の反実仮想をR_net evidenceとしてどこまで採用するか | p03 | 実績ではなく反実仮想を含むため、workerだけで確定できない |
| JOYCLE型を `負のR_net` と呼ぶか、rubric外 `damage guard` に留めるか | p09 | 用語と理論境界の問題。正式rubricではないが、BZM側の表現統制が必要 |
| Yellow Duck型をP低さとR_net粗利不成立の両方へ置く粒度 | p18 | 二重カウントを避けつつ、BRL不足へ潰さない境界が必要 |
| BWE膜外販を未確定R_netから動かす条件 | p11 | 供給余力、粗利、本命RED装置影響の3条件をBZMが明示する必要 |
| CTB型の売上ゼロ成立guardの強さ | p06 | R_net低値でNO_GOにしないため、Survival guardの優先度を決める必要 |
| SX/CXの利益度外視PoC/テスト販売を粗利ではなく評価データ価値へ置くか | p20, p21 | 粗利貢献とBRL/SRL/Survival補助の境界判断 |
| U1短期キャッシュ層とU4/U5本命市場をP/R_netで分離するルール | p21 | PとR_netの過大評価を避けるため、用途レーン別の見方が必要 |

## 5. 次worker候補

1. `P/R_net L2 source inventory worker`
   - 範囲: 既存L2/DB/docs/outboxから、各PJの未確認flagに使える source候補だけを read-only で拾う。
   - 成果物候補: `pwa/bzm/runs/2026-06-01-prs-l2-source-inventory.md`
   - 禁止: extractor実装、DB write、score化。

2. `P/R_net public/knowledge research worker`
   - 範囲: 公開資料と既存knowledgeから、市場上限、UE、競合/代替、助成金/政策、類似SU failure/exitを補強する。
   - 成果物候補: `pwa/bzm/runs/2026-06-01-prs-worker-research-pack.md`
   - 禁止: 内部knowledgeと公開根拠を同じconfidenceで混ぜない。

3. `BZM judgement brief worker`
   - 範囲: まさ/BZM判断が必要な論点を、source候補と選択肢に分解する。
   - 成果物候補: `pwa/bzm/runs/2026-06-01-prs-judgement-brief.md`
   - 禁止: BZM司令塔の代わりに正式rubricや0-9値を確定しない。

4. `Evidence card refresh worker`
   - 範囲: 上記source inventory / research / judgement後、9PJ evidence cardsへ `unverified_flags` と `source_status` を追記する。
   - 成果物候補: `pwa/bzm/runs/2026-06-01-prs-pr-rnet-evidence-cards-v2.md`
   - 禁止: 現行カードを根拠なく上書きしない。正式rubric化しない。

## 6. まだやらないこと

| まだやらないこと | 理由 |
|---|---|
| 0-9値表 | source候補とBZM判断が未確定 |
| DB列追加 | formal adoptionと誤読される |
| extractor実装 | まずsource mapとsource inventoryが必要 |
| 過去score再計算 | 現行7軸AMD Scoreを上書きする危険がある |
| P/R_net正式rubric | CTB/JOYCLE/YD/BWE guardと入力主体が未確定 |
| 助成金/政策資金のR_net加算 | Survival guardや7軸evidenceと混ざる |
| 評価データ獲得の粗利扱い | 利益度外視PoC/実証を高R_netに誤読する |

## 7. 自己レビュー

- 観測項目draftに出ている未確認flagを一覧化した。
- 9PJごとに該当flagを戻した。
- 各flagについて `l2_extractable` / `worker_research` / `masa_or_bzm_judgement` を分けた。
- L2で拾う場合の近い領域を仮分類した。
- DB migration、コード実装、deployは行っていない。
- 0-9 score表は作っていない。
- source候補と正式rubricを混同しないよう、`comparison layer` と `source map` の扱いを明記した。
