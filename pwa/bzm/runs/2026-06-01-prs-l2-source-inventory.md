# P/R_net L2 source inventory

作成日: 2026-06-01
作成者: BZM理論検証worker
ステータス: BZM司令塔レビュー待ち

## 0. この成果物の扱い

このファイルは、P/R_net/Survival guard の source候補棚卸しである。

- P/R_net の 0-9 値表は作らない。
- DB列、migration、extractor実装、deployは行わない。
- 現行7軸AMD Scoreは正式モデルのまま扱う。
- PRSは `Adopt as comparison layer` の検証用に留める。
- ここでの `available_now` は、人間レビュー用の候補sourceを拾えそう、という意味であり、自動採用や正式値ではない。
- `unsafe_to_infer` は、source候補があってもPRS値・rubric判断へ直結させると危ない状態を指す。

確認したもの:

- `pwa/bzm/runs/2026-06-01-prs-unverified-source-map.md`
- `pwa/bzm/runs/2026-06-01-prs-pr-rnet-observation-items-draft.md`
- `pwa/bzm/runs/2026-06-01-prs-pr-rnet-evidence-cards.md`
- `pwa/bzm/runs/2026-06-01-prs-rnet-guard-memo.md`
- `pwa/design/L2_DATA.md`
- `pwa/design/db_schema.md`
- `pwa/spec/3-1-l2-data-extraction-current-spec.md`
- `pwa/spec/3-2-monthly-reports-current-spec.md`
- `pwa/spec/3-3-meeting-flow-current-spec.md`
- `pwa/spec/3-5-xrl-evidence-current-spec.md`
- `pwa/spec/3-6-strategy-signals-current-spec.md`
- `pwa/spec/3-9-l2-protocol-current-spec.md`
- `pwa/spec/3-11-l2-project-knowledge-current-spec.md`
- `pwa/spec/3-12-l2-member-knowledge-current-spec.md`
- `pwa/spec/3-13-l2-textbook-insights-current-spec.md`
- `pwa/manual/3-2-data-and-extraction.md`
- `pwa/scheduled-tasks/amd-os-l1-monthly-report-extract/SKILL.md`
- `pwa/scheduled-tasks/amd-os-l2-protocol-extract/SKILL.md`
- `pwa/scheduled-tasks/amd-os-l4-project-knowledge-extract/SKILL.md`
- `pwa/scheduled-tasks/amd-os-l5-member-knowledge-extract/SKILL.md`
- `pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md`
- `pwa/scheduled-tasks/amd-os-l7-registry-diff-extract/SKILL.md`
- `pwa/scheduled-tasks/amd-os-l8-xrl-evidence-extract/SKILL.md`
- `pwa/scheduled-tasks/amd-os-l9-strategy-signal-extract/SKILL.md`
- `pwa/scheduled-tasks/amd-os-l10-textbook-insight-extract/SKILL.md`
- Supabase read-only spot check for 9PJ tables: `projects`, `monthly_reports`, `project_meeting_summaries`, `project_knowledge`, `project_strategy_signals`, `project_xrl_evidence`, `protocols`, `billing_cycles`, `company_actual_monthly`, `source_cache`
- `/Users/masa/projects/knowledge/{tiem,KT,ctb,LST,jc,BWE,yd,cx,sx,before_zero_theory}.md`

## 1. 全体結論

L2から拾える候補は十分あるが、flagごとに「事実候補」と「BZM判断」が混ざる。

| source状態 | 該当しやすいflag | 意味 |
|---|---|---|
| `available_now` | 市場/用途/政策/実証/売上候補/資金調達/会議決定/既存XRL根拠 | 既存L2・DB・knowledge md・outboxからレビュー用source候補を拾える |
| `available_but_needs_join` | 粗利貢献、運営コスト、入金サイト、本命再投資、つなぎ事業独立性 | 月次/MTG/finance/knowledgeを突合しないと候補の意味が決まらない |
| `not_currently_available` | p03/p04/p18の実DB L2、p06/p11/p20/p21の詳細粗利、p09のR&D予算推移 | 現状のL2/DBだけでは足りず、knowledge mdまたはresearch/まさ確認が必要 |
| `unsafe_to_infer` | R_net値、負のR_net、CTB売上ゼロ成立、BWE膜外販、CX/SX評価データ価値 | sourceがあっても値・rubric・GO/NO_GO判断へ直結させると危ない |
| `requires_masa_or_bzm_review` | 反実仮想、本命毀損、P/R_net二重カウント、Survival guard境界 | source候補後に理論境界判断が必要 |

DB spot check の概況:

| table | 9PJ内の実データ状況 | PRS sourceとしての読み方 |
|---|---|---|
| `projects` | 9PJ全件あり。p03/p04/p09/p11/p18はended、p06/p07/p20/p21はactive。 | 時点評価・ended/frozen/activeの扱いを分ける前提として使える |
| `monthly_reports` | p06/p09/p11/p20/p21中心。p03/p04/p07/p18は薄いまたはなし。 | 月次断面、売上/資金/PoC/実証/コスト語の候補抽出に使える。draft/final混在に注意 |
| `project_meeting_summaries` | p06/p07/p11/p20/p21中心。p03/p04/p09/p18は薄い。 | 決定・進捗・次アクション・リスク候補に使える。upcoming行は実績扱い禁止 |
| `project_knowledge` | p06/p07/p09/p11/p20/p21にあり。p03/p04/p18は実DB上は薄い。 | market/tech/ip/org/strategy/fundingの候補。categoryとsource confidenceを併記する |
| `project_strategy_signals` | p06/p07/p20/p21中心。p09/p11/p03/p04/p18は薄い。 | funding/commercial/management decision候補。candidateとconfirmedを分ける |
| `project_xrl_evidence` | p06/p07/p20/p21中心。 | TRL/BRL/GRL/SRL/HRL evidence候補。P/R_netそのものではない |
| `protocols` | p20/p21に候補あり。 | 本命毀損・資金調達・事業設計の判断構造候補。ただしcandidate中心 |
| `billing_cycles` | p06/p09/p11/p20/p21にあるが、多くはbudget/payment管理。 | AMDへの請求/入金確認であり、SU本体のR_net粗利とは別物 |
| `company_actual_monthly` | 9PJ spot checkでは0件。 | SU別R_netには現状使えない |
| `source_cache` | p06/p09/p11/p20/p21にあり。 | raw source refs補助。これ単独でno-data/確定判断しない |

## 2. flag別 inventory

### 2.1 P flags

| flag | source状態 | 近いL2領域 | source候補 | 注意 |
|---|---|---|---|---|
| `p_market_ceiling_unverified` | `available_now` | project knowledge / monthly report / meeting summary / policy signal / knowledge md | `project_knowledge.category in ('market','strategy','competitor','tech')`、`monthly_reports` の市場調査・事業計画、`project_strategy_signals`、各PJ knowledge md、`before_zero_theory.md` のP表 | TAMをそのままPJ固有Pにしない |
| `p_lane_ceiling_unverified` | `available_now` ただしSX/CXは `available_but_needs_join` | project knowledge / meeting summary / textbook insights / policy signal | SX U1/U4/U5、CXアカデミア/量子/データセンター、LSTリサイクル/装置などの用途別記述 | 短期キャッシュ層と本命大市場を混ぜない |
| `p_project_capture_unverified` | `available_but_needs_join` | project knowledge / xrl evidence / monthly report | 特許/IP、製造能力、顧客候補、BRL/XRL根拠、競合情報 | レーン全体Pから当該PJが取れる上限への割引はBZM判断が必要 |
| `p_ue_unverified` | p18は `not_currently_available`、p21/p04は `available_but_needs_join` | monthly report / meeting summary / finance / project knowledge | LCOE/COGS/価格受容、顧客PoC、VC DD、月次のコスト試算 | 技術PoCをUE成立と誤読しない |
| `p_market_structure_unverified` | p18は `requires_masa_or_bzm_review`、他は `available_but_needs_join` | strategy signals / meeting summary / project knowledge / xrl evidence | DDコメント、販売構造、規制・設置・保守条件、類似SU失敗理由 | BRL不足ではなくP低さとして扱う境界が必要 |
| `p_substitute_unverified` | `not_currently_available` in L2、`worker_research`寄り | policy signal / project knowledge / strategy signals / xrl evidence | atlas_signals、論文/特許、競合上市、顧客既存解 | 現L2だけでは競合/代替の網羅性が弱い |
| `p_exit_path_unverified` | p06は `available_but_needs_join`、他は `worker_research`寄り | meeting summary / project knowledge / monthly report | CTBの製薬ライセンス/EXIT、資金調達メモ、VC/DD | P本体かSurvival guard補助かを分ける |
| `p_policy_problem_unverified` | `available_now` | policy signal / strategy signals / project knowledge / atlas | `project_strategy_signals`, `project_xrl_evidence.evidence_kind='grant_signal'`, `atlas_signals`, 補助金/政策系source | 社会課題の大きさを価格受容へ直結させない |

### 2.2 R_net flags

| flag | source状態 | 近いL2領域 | source候補 | 注意 |
|---|---|---|---|---|
| `r_revenue_unverified` | p07/p20/p21は `available_now`、p04/p03/p18は `not_currently_available` in DB | finance / monthly report / meeting summary / project knowledge | MTGの販売/MOU/受注/有料製作、monthly_reports、`billing_cycles`、knowledge md | `billing_cycles` はAMD請求でありSU売上ではない。販売前夜を実績扱いしない |
| `r_gross_margin_unverified` | `available_but_needs_join`、多くは `not_currently_available` | finance / monthly report / meeting summary | LSTの原価/利益率候補、BWEのGP30%メモ、CX/SXコスト試算、freee/予実 | 売上・補助金・評価データを粗利に混ぜない |
| `r_operating_cost_unverified` | `available_but_needs_join` | finance / monthly report / member knowledge / meeting summary | burn、CAPEX、設備、採用、導入/保守、規制/実証管理コスト | 固定費増・後払い・導入負担を差し引く必要 |
| `r_cash_conversion_unverified` | `available_but_needs_join` | finance / monthly report / meeting summary | 補助金後払い、入金予定、請求/支払、資金繰り表、`billing_cycles.payment_confirmed_at` | AMD請求の入金確認とSU本体キャッシュを混同しない |
| `r_reinvestment_unverified` | `requires_masa_or_bzm_review` | monthly report / meeting summary / project knowledge / protocols | 資金使途、R&D予算、採用、事業計画、経営会議ログ | つなぎ収益が本命へ戻るかはsourceだけでは決まらない |
| `r_damage_guard_unverified` | `unsafe_to_infer` + `requires_masa_or_bzm_review` | meeting summary / protocols / project knowledge / member knowledge | JOYCLEの方針転換・AMD関与終結・R&D投資縮小ログ、p09月次、protocols | 負のR_netと呼ぶか、rubric外damage guardに留めるか要判断 |
| `r_ue_margin_unverified` | p18は `not_currently_available` in DB、research必須 | monthly report / finance / strategy signals / project knowledge | LCOE/COGS/DD/類似SU失敗理由 | Yellow Duck型はP側とR_net側で二重カウント注意 |
| `r_bridge_business_unverified` | p07/p20/p21は `available_now`、p03/p04はknowledge mdのみ | project knowledge / monthly report / meeting summary | LSTリサイクル先行、CX TES/ADR、SX U1、KT Adam、ティエム商社反実仮想 | 別系統つなぎ、本命MVP前倒し、個別受託消化を分ける |
| `r_bottleneck_external_sale_unverified` | p11は `available_but_needs_join` | project knowledge / meeting summary / xrl evidence | BWE膜外販、膜供給余力、住友理工/膜条件、SIP/実証資料 | 膜は本命ボトルネックでもあるため正負両面 |
| `r_validation_value_unverified` | p20/p21は `available_now`、p04/p07は `available_but_needs_join` | meeting summary / project knowledge / xrl evidence / strategy signals | CXテスト販売/有料製作、SXオンサイトPoC、LSTサンプル出荷、KTデモ | 評価データ獲得は粗利ではなくBRL/SRL/Survival補助かも |

### 2.3 Survival guard flags

| flag | source状態 | 近いL2領域 | source候補 | 注意 |
|---|---|---|---|---|
| `s_grant_unverified` | `available_now` | finance / monthly report / meeting summary / policy signal | CTB AMED、LST NEDO/SBIR/Startup Global、BWE SIP、CX/SX PSI等 | 助成金はR_net粗利へ加算しない。自己負担・後払い・使途制限を見る |
| `s_regulatory_exit_unverified` | p06は `available_but_needs_join`、research補強必須 | project knowledge / meeting summary / monthly report | CTB薬事、製薬提携、ライセンス/EXIT、AMED進捗 | CTB型をR_net低値でNO_GOにしないguard |
| `s_policy_demo_unverified` | `available_now` | policy signal / strategy signals / monthly report | SIP/東京都実証/NEDO/PSI/政策公募、`project_strategy_signals` | 政策/実証は7軸やSurvival evidence。粗利扱いしない |
| `s_validation_data_unverified` | p20/p21/p07は `available_now` | meeting summary / project knowledge / xrl evidence | 実証レポート、顧客評価、共同研究、試験データ | 利益度外視テスト販売を高R_netにしない |
| `s_lane_guard_unverified` | `requires_masa_or_bzm_review` | project knowledge / meeting summary / protocols / strategy signals | 創薬、政策実証、大型装置、アカデミア装置、設立準備PJごとの例外条件 | 全PJへ同じR_net観測を当てないための理論境界 |

## 3. PJ別 inventory

| PJ | 実DB/L2の厚み | `available_now` 候補 | joinが必要な候補 | 不足 / unsafe / 判断事項 |
|---|---|---|---|---|
| p03 ティエム | 実DB L2は薄い。knowledge md / before_zero_theory中心 | `tiem.md`, `before_zero_theory.md`, BZM既存runsの商社/受託/モノリス記述 | 反実仮想のCabot代理店・開発受託をP/R_net evidenceへどう扱うか | `not_currently_available`: DB内の月次/MTG/finance。`unsafe_to_infer`: 反実仮想をR_net値にすること |
| p04 輝翠TECH | 実DB L2は薄い。knowledge `KT.md` 中心 | `KT.md` のAdam有償展開、シリーズA、デモ/販売開始情報 | Adam販売の粗利、保守/導入負担、R&D速度影響 | まさ販売台数・粗利・保守負担確認が必要。MVP販売を高R_netへ直結させない |
| p06 CTB | monthly_reports 42件、meeting 23件、project_knowledge 38件、strategy 11件、xrl 3件、source_cache 117件 | AMED、T-CReDO、Go-Tech/NEDO検討、薬事/助成金事務、CTB211市場/Pはknowledge md | AMED金額・期間・後払い・自己負担、薬事/ライセンス/EXITをSurvivalへ結合 | `unsafe_to_infer`: R_net低値でNO_GO。助成金を粗利扱いしない |
| p07 LiSTie | meeting 32件、strategy 177件、xrl 8件、knowledge 3件。monthly_reports spot checkは薄いがMTGが厚い | 8,000万円融資、DG/Adlib投資、リサイクル販売MOU、JFE拠点、NEDO/SBIR/Startup Global、原価/利益率候補 | リサイクル売上・粗利・入金サイト・補助金後払い・本命LISMIC影響 | 補助金/融資/投資をR_net粗利へ混ぜない。つなぎが本命を支えるか要判断 |
| p09 JOYCLE | monthly_reports 16件、project_knowledge 274件、source_cache 175件。meeting/strategyはspot checkでは薄い | 研究開発体制、JB-02/JB-02A、車両購入、採用/コスト、TRY! YAMANASHI不採択等 | 売上候補、装置原価、R&D予算推移、AMD関与終結ログ | `unsafe_to_infer`: 販売前夜を正のR_netにすること。damage guard名称はBZM判断 |
| p11 BWE | monthly_reports 15件、meeting 1件、knowledge 105件、source_cache 55件。strategy/xrlは薄い | SIP、東京都実証、臨時株主総会、膜/10kW PoC、住友理工・山口大・NIMS文脈、GP30%メモ | 膜外販の供給余力・粗利・本命RED装置影響、実証資金入金条件 | 政策資金を粗利扱いしない。膜外販は未確定R_net維持が安全 |
| p18 Yellow Duck | 実DB L2は薄い。knowledge `yd.md` 中心 | `yd.md`, `before_zero_theory.md` のUE不成立/波力P低さ | LCOE、製造/設置/保守、VC DD具体論点、類似SU失敗理由 | DB内では `not_currently_available`。P低さとR_net粗利不成立の二重カウント要注意 |
| p20 CryoX | monthly_reports 16件、meeting 24件、knowledge 66件、strategy 15件、xrl 21件、protocols 12件、source_cache 60件 | BUILD/ANRI、5,000万-1億pre-seed、TES/ADR/KEK/JAXA有料製作、NIMS/特許/顧客候補、市場調査 | テスト販売の単価/原価/粗利、人員負担、評価データ価値、本命市場への接続 | 利益度外視テスト販売は粗利ではなく評価データ価値へ置く可能性 |
| p21 SolvioraX | monthly_reports 14件、meeting 67件、knowledge 14件、strategy 19件、xrl 17件、protocols 10件、source_cache 93件 | JAFCO DD、U1 PoC、業務委託契約、PSI/オンサイトPoC、U1-U5用途、ダイキ/三菱等顧客候補 | U1売上/粗利/O&M/入金、サブスク価格受容、U1とU4/U5分離、PoC消化の本命毀損 | 設立準備中なので実績値扱いしない。短期キャッシュ層と本命Pを混ぜない |

## 4. L2領域別の使い方

| L2領域 | source候補として使えるもの | 向いているflag | guard |
|---|---|---|---|
| project knowledge | category/entity/fact_text/source/confidence/status | P天井、用途、技術/IP、競合、事業計画、つなぎ事業 | active/candidate、sourceの古さ、knowledge mdとの重複を分ける |
| monthly report | draft/final、活動断面、資金/PoC/実証/コスト語 | revenue, cost, validation, grant, bridge business | draft/final/no-dataテンプレを区別。未来月draftを実績扱いしない |
| meeting summary | decided/progress/next_actions/risks/narrative/source_kinds | management decision, bridge business, damage guard, validation | `source_kinds='upcoming'` は予定。開催済み実績扱いしない |
| member knowledge / member activities | 稼働・スキル・関与・本人活動ログ | operating cost補助、resource damage補助 | 本人主体かPJ全体会議かを分ける |
| textbook insights | theory_case / practice_kind / evidence_refs | BZM理論境界、case refresh | approved/BZM reviewを通すまで本文・理論採用しない |
| finance | billing_cycles, company_budget/actual, freee関連, payout | cash conversion, operating cost, AMD請求/入金 | SU本体PLとAMDへの業務委託請求を混同しない |
| policy signal / Atlas | atlas_signals, strategy_signals, XRL grant_signal | policy problem, grant, demo, survival | 政策資金をR_net粗利に混ぜない |
| xrl evidence | axis/evidence_kind/structured/source_refs | TRL/BRL/GRL/SRL/HRL補助、capture、validation | P/R_netそのものではない。7軸正式モデルの根拠 |
| protocol | branch point / judgment basis / action / outcome observation | reinvestment, damage guard, lane guard | candidate中心。結果欄は自動推測で埋めない |
| source_cache/outbox | source refs, snippets, hash, raw evidence cache | traceability補助 | source_cacheだけでno-data/確定判断しない。全文保存禁止 |

## 5. source pack候補

次workerが実際にsource候補を抜くなら、次のpackに分けると安全。

| 優先 | pack | 対象PJ | 対象flag | read-only query候補 |
|---|---|---|---|---|
| 1 | finance / cash conversion candidate pack | p07, p20, p21, p06, p11 | `r_revenue`, `r_gross_margin`, `r_operating_cost`, `r_cash_conversion`, `s_grant` | `monthly_reports`, `project_meeting_summaries`, `project_strategy_signals`, `billing_cycles`, finance docs |
| 2 | bridge business / validation pack | p07, p20, p21, p04, p03 | `r_bridge_business`, `r_validation_value`, `s_validation_data` | meeting summaries, project knowledge, XRL evidence, knowledge md |
| 3 | damage / reinvestment pack | p09, p03, p20, p21 | `r_damage_guard`, `r_reinvestment` | `monthly_reports`, `project_knowledge`, `protocols`, strategy signals, AMD関与終結ログ |
| 4 | lane-specific survival pack | p06, p11, p20, p21 | `s_grant`, `s_regulatory_exit`, `s_policy_demo`, `s_lane_guard` | strategy signals, XRL grant evidence, monthly reports, knowledge md |
| 5 | market / P capture pack | 9PJ全体 | `p_market_ceiling`, `p_project_capture`, `p_lane_ceiling`, `p_policy_problem` | project knowledge, knowledge md, before_zero_theory, XRL/strategy |
| 6 | UE / low-P pack | p18, p21, p04 | `p_ue`, `p_market_structure`, `r_ue_margin` | `yd.md`, external research, DD notes if present |

## 6. unsafe / requires review items

| item | status | 理由 | BZM/まさ判断の形 |
|---|---|---|---|
| ティエム商社/受託の反実仮想 | `requires_masa_or_bzm_review` | 実績sourceではなく反実仮想を含む | evidence card上は scenario として別扱いにするか |
| JOYCLE本命毀損 | `unsafe_to_infer` | 売上候補・装置販売前夜を正のR_netへ誤読しやすい | `negative R_net` と呼ぶか、`damage guard` に留めるか |
| Yellow Duck UE不成立 | `requires_masa_or_bzm_review` | P低さとR_net粗利不成立が重複しやすい | P側・R_net側のどちらを主にするか |
| CTB売上ゼロ成立 | `unsafe_to_infer` | R_net低値でNO_GOにすると創薬laneを誤判定 | Survival guardをR_netより優先する条件 |
| BWE膜外販 | `available_but_needs_join` + `unsafe_to_infer` | 膜はつなぎ収益候補であり本命ボトルネックでもある | 供給余力・粗利・本命影響の3条件が揃うまで未確定にするか |
| CX/SX利益度外視PoC/テスト販売 | `requires_masa_or_bzm_review` | 粗利ではなく評価データ価値かもしれない | BRL/SRL/Survival補助へ置くか |
| `billing_cycles` の扱い | `unsafe_to_infer` | AMDへの業務委託請求/入金でありSU本体の粗利ではない | R_net sourceには補助・別ラベルで扱う |
| candidate status rows | `available_now` だが注意 | `project_strategy_signals` / `project_xrl_evidence` / `protocols` はcandidate中心 | confirmed/activeとcandidateをsource_statusで分ける |

## 7. 次worker候補

優先順:

1. `P/R_net finance and cash source pack worker`
   - 対象: p07/p20/p21/p06/p11。
   - 目的: 売上/受注/粗利/入金サイト/助成金/政策資金のsource候補を、L2 row id・source_refs・status付きで一覧化する。
   - 禁止: R_net値付け、SU本体粗利とAMD請求の混同。

2. `P/R_net bridge and validation source pack worker`
   - 対象: p07/p20/p21/p04/p03。
   - 目的: つなぎ事業、本命MVP前倒し、評価データ獲得、テスト販売のsource候補を整理する。
   - 禁止: 評価データを粗利扱いすること。

3. `P/R_net damage guard source pack worker`
   - 対象: p09中心、p03/p20/p21補助。
   - 目的: 本命R&D縮小、AMD関与終結、目先収益化、予算/人員/ロードマップ変化のsource候補を抜く。
   - 禁止: JOYCLEを正式な負R_net値にすること。

4. `P/R_net lane-specific survival worker`
   - 対象: p06/p11/p20/p21。
   - 目的: CTB創薬、BWE大型装置/政策実証、CX/SX評価データ・設立準備のSurvival guard sourceを分ける。
   - 禁止: 助成金・政策・実証をR_net粗利へ混ぜること。

5. `P/R_net public/knowledge research worker`
   - 対象: p03/p04/p18を優先し、9PJ補助。
   - 目的: 実DB L2が薄いPJの市場上限、UE、競合/代替、類似SU failure/exitを公開資料・knowledge mdから補強する。
   - 禁止: 内部knowledgeと公開根拠を同じconfidenceで混ぜること。

6. `BZM judgement brief worker`
   - 対象: 上記source pack後。
   - 目的: まさ/BZM判断が必要な項目を、source候補、選択肢、採用しない場合の影響に分ける。
   - 禁止: BZM司令塔の代わりに正式rubricや0-9値を確定すること。

## 8. 検証

- read-onlyで指定docs、spec、manual、schema、scheduled-task SKILL、既存BZM runsを確認した。
- Supabaseはread-only SELECTのみ実行した。DB write、DDL、migration、deployは行っていない。
- extractor実装、コード実装、0-9 score表、P/R_net正式rubric、現行7軸置換、過去score再計算は行っていない。
- `pwa/design/db_schema.md` で実列を確認し、存在しないP/R_net列を前提にしていない。
- `git add .` は使っていない。

## 9. 未解決

- p03/p04/p18は実DB L2が薄く、knowledge md / public research / まさ判断の比重が高い。
- `company_actual_monthly` は9PJ spot checkでPJ別R_net候補としては使える行が見つからなかった。
- `billing_cycles` はAMD請求/入金確認として有用だが、SU本体の粗利・売上とは別扱いが必要。
- candidate statusのL2 rowをどこまでsource候補に含めるかは、source pack workerで `source_status` を必ず残す必要がある。
- BZM判断なしに、CTB/JOYCLE/YD/BWE/CX/SXのguardをrubric値へ変換しない。
