# YD low-P / UE guard source split

作成日: 2026-06-02
作成者: BZM司令塔配下worker
ステータス: BZM司令塔レビュー待ち

## 0. この成果物の扱い

このファイルは、p18 Yellow Duck / YD について、PRS comparison layer上の `low_p_market_structure` と `rnet_gross_margin_viability` を分けるためのsource splitである。

- PRSは正式rubricではなく、現行7軸AMD Scoreを補助するcomparison layerとして扱う。
- 0-9 score表、R_net値付け、DB列、migration、extractor実装、deploy、過去score再計算は行わない。
- YDは「低P/UE不成立型」の重要反例だが、現時点のsourceは薄い。薄いこと自体をcurrent conclusionとして残す。
- 同じsourceをP側とR_net側へ置く場合は、主分類と補助分類を分け、同じ根拠で2回減点しない。

確認した主資料:

- `/Users/masa/projects/knowledge/yd.md`
- `pwa/bzm/runs/2026-06-02-prs-pr-rnet-evidence-cards-v11.md`
- `pwa/bzm/runs/2026-06-02-prs-bzm-judgement-brief.md`
- `pwa/bzm/runs/2026-06-02-prs-classification-adoption-patch.md`
- `pwa/bzm/runs/2026-06-01-prs-9pj-delta-review.md`
- `pwa/bzm/runs/2026-06-01-prs-pr-rnet-observation-items-draft.md`
- `pwa/bzm/runs/2026-06-01-prs-unverified-source-map.md`
- `pwa/bzm/runs/2026-06-01-prs-rnet-guard-memo.md`
- `pwa/design/amd_score.md`
- `pwa/scripts/prxs_9pj_inputs.py`
- `pwa/scripts/prxs_retrofit_test.py`

## 1. 結論

YDは、現時点では次の4分類へ分けるのが安全。

| 分類 | 暫定結論 | PRSで使うなら |
|---|---|---|
| `low_p_market_structure` | 波力発電レーンの市場構造、価格受容性、設置/保守条件、代替電源との比較から、事業上限が低く見える。ただしYellow Duck固有技術が覆せる範囲は未確認。 | `review-only` |
| `rnet_gross_margin_viability` | 販売未到達、CEO自己資金試作段階、製造/設置/保守/腐食/付着/O&Mの重さから、粗利成立sourceは未発見。 | `review-only` |
| `survival_or_validation_context` | 技術PoC/TRL4相当、自己資金試作、VC DD、資金調達サポート3か月は、検証・継続文脈には効くが、R_net粗利ではない。 | `review-only` or `exclude from PRS` |
| `double_count_guard` | 波力発電のLCOE/維持費/価格受容性は、P側では市場構造の弱さ、R_net側では粗利不成立の理由として読める。ただし同じ根拠をP低下とR_net低下へ独立に2回使わない。 | guard |

重要なのは、YDを単なるBRL不足へ潰さないこと。TRL=4相当の技術PoCがあっても、LCOE、製造/設置/保守、腐食/付着、売電/販売単価が合わなければ、事業として筋が悪い。この判断差分は現行7軸だけでは薄くなりやすい。

一方で、現時点のsourceは `knowledge/yd.md` と既存BZM runs中心であり、Yellow Duck固有のLCOE/原価/販売単価/VC DD詳細は未接続。したがって、`ready_for_rubric_draft` と書くとしても「低P/UE不成立の観測項目draft」までであり、R_net値付けや正式rubricには進めない。

## 2. Source Split

| source_id_or_path | source_status | classification | evidence_summary | PRSで使うなら | double_count_guard | still_missing |
|---|---|---|---|---|---|---|
| `/Users/masa/projects/knowledge/yd.md` | knowledge / internal current note / web確認メモを含むが、このworkerでは外部リンクを再検証していない | `low_p_market_structure` primary; `rnet_gross_margin_viability` secondary; `survival_or_validation_context` secondary | 波力発電SU。販売未到達、CEO自己資金試作段階、UE成立見込み低い、波力発電自体がUE成立しにくい、公開情報上も導入/維持費が重い、各VC DDで出資断念、AMD関与は2025-06から2025-09の資金調達サポートのみ。 | `review-only` | LCOE/維持費/価格受容性はP側の低市場構造を説明する主sourceにし、R_net側では「粗利成立sourceなし」の補助理由に留める。同じLCOE根拠をP低下とR_net正式低値へ二重転記しない。技術PoCはTRL根拠であり、商用UE成立根拠ではない。 | Yellow Duck固有のLCOE、製造原価、設置費、保守/O&M、想定販売単価、想定売電単価、販売先、契約、請求、入金、VC DDコメント原文、現在活動状況。 |
| `pwa/bzm/runs/2026-06-02-prs-pr-rnet-evidence-cards-v11.md` p18 section | BZM evidence card / review待ち / prior source aggregation | `low_p_market_structure` primary; `rnet_gross_margin_viability` secondary | P仮説はlow。波力発電はコストが合いにくく、公開情報でも発電コストが高い。VC DDでUE成立せず、ue_failとしてAMD関与終結。R_netでは販売未到達、自己資金試作、海上実証・製造・設置・腐食/付着対策・維持管理コストが重いと整理。 | `review-only` | v11のP仮説とR_net仮説は同じ根拠を含むため、v12へ戻すなら `primary_guard_source=low_p_market_structure` とし、R_net側は `gross_margin_viability_not_joined` にする。`ready_for_rubric_draft` は観測項目draftに限定する。 | v11自体も追加finance sourceが薄いと明記。Yellow Duck固有の実数・契約・VC DD sourceがない。 |
| `pwa/bzm/runs/2026-06-01-prs-9pj-delta-review.md` p18 section | BZM review draft / judgement-difference artifact | `double_count_guard` primary; `low_p_market_structure` secondary | TRL=4のPoCがあっても、波力発電のUEが原理的に合わず、Pが低くR_netも立たない。「技術は進むが事業として筋が悪い」をPRSで追加説明できる。 | `review-only` | このsourceは判断差分を示すもので、実数sourceではない。P/R_net双方の採用根拠にせず、7軸では薄い論点を分離するguardとして使う。 | 低PとR_net不成立を別sourceで裏付けるデータ。波力レーン全体とYD固有の切り分け。 |
| `pwa/bzm/runs/2026-06-01-prs-rnet-guard-memo.md` Yellow Duck guard | guard memo / BZM review待ち | `double_count_guard` primary; `rnet_gross_margin_viability` secondary | YDは技術PoCを事業の筋良さと混同しない反例。LCOE、設置/保守、腐食/付着、売電/販売単価が合わないなら事業として筋が悪い。 | guard | R_net rubric draftでは「粗利貢献が立たない理由」として使うが、P rubric側にも同じsourceを重ねて正式減点しない。BRL不足、技術PoC、商用UEを分離する。 | Yellow Duck固有コスト/単価、VC DD具体論点、海外類似SU失敗理由との比較。 |
| `pwa/bzm/runs/2026-06-01-prs-pr-rnet-observation-items-draft.md` | observation draft / formalではない | `double_count_guard` primary | `p_ue_unverified`、`p_market_structure_unverified`、`r_ue_margin_unverified` の観測項目で、YD型はP/R_net両方のguardに使うと整理。 | guard / `review-only` | observation itemの対応表として使い、値付けには使わない。P側は市場天井/価格受容性、R_net側は粗利不成立という別問いに分ける。 | 実source候補のsource_id、confidence、入力主体、更新頻度。 |
| `pwa/bzm/runs/2026-06-01-prs-unverified-source-map.md` p18 row | source map / read-only plan | `still_missing` primary; `double_count_guard` secondary | p18はP flagsに `p_ue_unverified`, `p_market_structure_unverified`, `p_project_capture_unverified`, `p_substitute_unverified`、R_net flagsに `r_ue_margin_unverified`, `r_operating_cost_unverified`, `r_gross_margin_unverified`、Survivalに `s_lane_guard_unverified` と整理。source優先順位はstrategy signals / meeting summary / project knowledge、VC DD・LCOE・海外類似SU失敗理由、BZM判断。 | `review-only` | unverified flagを埋めたふりをしない。source不足をもって正式低P/正式低R_netにしない。 | strategy signals、meeting summaries、finance、VC DD、LCOE/COGS資料、類似SU failure researchのjoin。 |
| `pwa/bzm/runs/2026-06-02-prs-bzm-judgement-brief.md` 2.7 | judgement brief / 司令塔判断待ち | `double_count_guard` primary | YD型はP側に低P/市場上限・価格受容性、R_net側に粗利/UE不成立を置く。ただし二重カウントではなく、同じsourceに主分類と補助分類を付ける、と推奨。 | guard | BZM判断の選択肢sourceであり、根拠実数ではない。v12ではこの方針をfield構造に落とす。 | BZM/OS/まさの正式判断。 |
| `pwa/bzm/runs/2026-06-02-prs-classification-adoption-patch.md` YD二重配置 | comparison-layer adoption patch / review待ち | `double_count_guard` primary | YD二重配置をcomparison layer current truthとして暫定採用。ただし同じsourceを二重カウントしない、主分類と補助分類を分ける。 | guard | 「暫定採用」はcomparison layer分類の採用であり、正式rubricやscore採用ではない。 | v12 evidence cardへ戻すfield名、sourceごとのprimary/secondary分類。 |
| `pwa/design/amd_score.md` YD notes | design/history / current 7軸正本側 | `survival_or_validation_context` primary; `seven_axis_context` | YDはue_fail、PoC TRL4でもPre-Seed調達不能と整理。現行7軸側ではTRL/BRL/HRLなどの文脈がある。 | `exclude from PRS` for score values; `review-only` for context | 現行7軸の記述をPRSの正式値へ転用しない。TRL4は「技術PoCあり」の文脈で、PやR_net成立の根拠ではない。 | 7軸正式モデルとPRS comparison layerの境界の明示。 |
| `pwa/scripts/prxs_9pj_inputs.py` YD entry | script / provisional first-pass / score値は使用禁止 | `do_not_use_as_formal_score` primary; `double_count_guard` secondary | YDのfirst-pass noteに、波力はUE不成立、57円/kWh、販売未到達、自己資金試作、失敗対照群と書かれている。 | `exclude from PRS score`; noteだけ `review-only` | スクリプト内の数値は0-9化された第一次置きなので、このworkerでは採用しない。note内のsource directionだけを、既存カードとの整合確認に使う。 | 数値を使わずにsource_id化した根拠。 |
| 追加finance source | not currently available | `still_missing` | p18はfinance/cash source pack対象外で、追加finance sourceなし。 | `exclude from PRS` | finance source不足を、販売ゼロ確定や正式R_net低値に変換しない。 | freee/請求/入金、契約、見積、原価、支払、設備投資、保守費、検収。 |
| VC DD具体論点 | not currently available | `still_missing` | 「各VCのDDでUE成立せず」はknowledge上のcurrent noteとしてあるが、VC別コメント、DD資料、NO_GO理由原文は未接続。 | `review-only` only after found | 口述/要約をDD原文扱いしない。P側の市場構造とR_net側の粗利不成立のどちらを主論点にするか、sourceごとに切る。 | VC名、DD日、コメント、LCOE/COGS/価格前提、競合/代替比較、投資見送り理由。 |
| 類似SU failure / wave-energy market source | partially summarized in `yd.md`; raw source not joined in this worker | `low_p_market_structure` candidate; `s_lane_guard_unverified` candidate | Pelamis倒産、Ocean Power Technologies苦戦などがknowledgeに記載。波力レーンの構造的不利を補強しうる。 | `review-only` | 類似SU failureをYellow Duck固有の失敗理由へ直結しない。レーン一般の低P/高コストsourceとして扱う。 | raw source URL、失敗理由、技術方式の差分、YD固有技術で覆せる/覆せない範囲。 |

## 3. 分類別の扱い

### 3.1 `low_p_market_structure`

主に見るもの:

- 波力レーン全体の市場天井。
- 代替電源と比べた価格受容性。
- 設置可能場所、海象条件、規制、送電接続、保守アクセス。
- 海水腐食、フジツボ付着、台風/荒天、O&M負担。
- 類似SU failureやVC DDで見えた構造的不利。

YDで使えるsourceは、現時点では `knowledge/yd.md` と既存BZM runsの二次整理が中心。よって `low_p_market_structure_status=review_only_source_thin` が妥当。

### 3.2 `rnet_gross_margin_viability`

主に見るもの:

- 販売単価または売電単価。
- 製造/設置/海上工事費。
- O&M、保守、腐食/付着対策、交換部品、保険、検収。
- 契約、請求、入金、原価、粗利。
- 試作/実証が評価データ目的か、粗利目的か。

YDは販売未到達、自己資金試作段階というsourceはあるが、販売契約・原価・粗利・入金sourceは未発見。したがって `rnet_gross_margin_viability_status=gross_margin_not_joined` とし、正式R_net値にはしない。

### 3.3 `survival_or_validation_context`

主に見るもの:

- TRL4相当のPoC。
- CEO自己資金試作。
- AMDの3か月限定資金調達サポート。
- VC DD実施。
- 政策/実証/助成金/PoC採択があれば、runwayや検証には効く可能性。

これらはR_net粗利ではない。YDの場合、現時点で助成金/実証採択などのSurvival sourceは見つかっていないため、`s_lane_guard_unverified` に留める。PoCは7軸TRL/BRLの文脈には置けるが、P/R_netの商用成立根拠へ転用しない。

### 3.4 `double_count_guard`

YDで最も危ない二重カウントは次の3つ。

| guard | 危険な誤読 | 安全な扱い |
|---|---|---|
| `lcoe_primary_to_low_p_secondary_to_rnet` | LCOEが高いのでPも低い、R_netも低い、と同じ根拠を独立に2回減点する。 | LCOE/価格受容性は主に `low_p_market_structure`。R_net側では「粗利成立source未接続」の補助理由に留める。 |
| `poc_not_commercial_ue` | TRL4相当のPoCがあるから、事業や粗利も成立しそうと読む。 | PoCは7軸TRL/BRL。PRSでは商用UE・販売単価・COGS/O&Mへjoinできるかだけを見る。 |
| `wave_lane_not_yd_specific` | 波力レーン一般の筋悪さを、YD固有技術の失敗証明にする。 | レーン一般sourceとYD固有sourceを分ける。固有技術で覆せる余地は `still_missing`。 |

## 4. v12 evidence cardへ戻すfield案

v12ファイルは作らない。戻すなら、p18欄に次のfieldを追加するのがよい。

| field | proposed value | purpose |
|---|---|---|
| `p18_low_p_market_structure_status` | `review_only_source_thin` | P側の主分類。市場構造/価格受容性/レーン天井は見るが、正式P値にはしない。 |
| `p18_low_p_primary_sources` | `/Users/masa/projects/knowledge/yd.md; 2026-06-01-prs-rnet-guard-memo.md; 2026-06-01-prs-9pj-delta-review.md` | low-P側のsource list。 |
| `p18_rnet_gross_margin_viability_status` | `gross_margin_not_joined` | R_net側は粗利成立source未接続として扱う。 |
| `p18_rnet_missing_join` | `contract + quote_or_tariff + invoice + payment + manufacturing_cost + installation_cost + o_and_m + corrosion_biofouling_maintenance + customer_acceptance` | review解除条件。 |
| `p18_survival_or_validation_context_status` | `poc_and_fundraising_support_context_not_gross_margin` | PoC/資金調達サポートを粗利から分離する。 |
| `p18_vc_dd_status` | `ue_fail_summary_available_but_dd_details_not_joined` | VC DDの要約と原文未接続を分ける。 |
| `p18_wave_lane_vs_yd_specific_guard` | `do_not_treat_wave_lane_failure_as_yd_specific_without_source` | レーン一般とYD固有を分ける。 |
| `p18_double_count_guard` | `lcoe_and_maintenance_cost_primary_to_low_p_secondary_to_rnet_not_two_independent_penalties` | 同一sourceの二重減点防止。 |
| `p18_prs_use` | `review-only` | comparison layer止まり。 |
| `p18_do_not_use_as` | `formal_P_value, formal_R_net_value, 0-9_score, current_7_axis_replacement, sales_actual, gross_margin_actual` | 誤用禁止。 |

## 5. 未解決

- Yellow Duck固有のLCOE、製造/設置/保守費、O&M、腐食/付着対策費、販売/売電単価が未接続。
- VC DDの具体論点、VC別コメント、投資見送り理由原文が未接続。
- 波力レーン一般の類似SU failure sourceはknowledge上にあるが、このworkerではraw source化していない。
- Yellow Duck固有技術が波力レーンの構造的不利をどこまで覆せるか未確認。
- 設立日、現在活動状況、AMD関与後の継続/停止状況は不明。

## 6. 司令塔判断事項

1. YDのv12反映では、`low_p_market_structure` を主分類、`rnet_gross_margin_viability` を補助分類としてよいか。
2. v11の `ready_for_rubric_draft` は「低P/UE不成立の観測項目draftに限る」と明記して、正式R_net rubricには進めない扱いでよいか。
3. 次workerを切るなら、公開/内部sourceの追加調査は `YD UE/LCOE source join` として、VC DD原文・Yellow Duck固有コスト・類似SU failure raw sourceを分けて拾う形でよいか。

## 7. 検証

- 必読資料と関連BZM runsをread-onlyで確認した。
- 新規成果物 `pwa/bzm/runs/2026-06-02-yd-low-p-ue-guard-source-split.md` だけを作成した。
- DB write、DDL、migration、extractor実装、code実装、deployは行っていない。
- 0-9 score表、R_net値付け、PRS正式採用、現行7軸AMD Score置換、過去score再計算は行っていない。
