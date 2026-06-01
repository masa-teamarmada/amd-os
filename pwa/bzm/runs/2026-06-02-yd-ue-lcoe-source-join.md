# YD UE/LCOE source join

作成日: 2026-06-02
作成者: BZM司令塔配下worker
ステータス: BZM司令塔レビュー待ち

## 0. この成果物の扱い

このファイルは、p18 Yellow Duck / YD の v12 evidence card へ戻す前に、低P/UE不成立の根拠sourceを read-only で追加joinしたもの。

- DB write、DDL、migration、extractor実装、code実装、deployは行っていない。
- 0-9 score表、R_net値付け、PRS正式採用、現行7軸AMD Score置換、過去score再計算は行っていない。
- 採用済み判断どおり、`low_p_market_structure` を主分類、`rnet_gross_margin_viability` を補助分類に置く。
- 同じLCOE/維持費/価格受容性sourceを、P低下とR_net低下へ二重減点しない。
- `ready_for_rubric_draft` は低P/UE不成立の観測項目draftに限定し、正式R_net rubricには進めない。

確認した主資料:

- `/Users/masa/projects/AGENTS.common.md`
- `AGENTS.md`, `CLAUDE.md`, `HANDOFF.md`
- `pwa/AGENTS.md`, `pwa/CLAUDE.md`, `pwa/HANDOFF_pwa_rebuild.md`
- `pwa/bzm/COMMANDER_TASKS.md`
- `origin/codex/yd-low-p-ue-guard-source-split:pwa/bzm/runs/2026-06-02-yd-low-p-ue-guard-source-split.md`
- `origin/codex/prs-evidence-cards-v11-p11-management-result:pwa/bzm/runs/2026-06-02-prs-pr-rnet-evidence-cards-v11.md`
- `origin/codex/prs-pr-rnet-evidence-cards:pwa/bzm/runs/2026-06-01-prs-unverified-source-map.md`
- `origin/codex/prs-pr-rnet-evidence-cards:pwa/bzm/runs/2026-06-01-prs-pr-rnet-observation-items-draft.md`
- `/Users/masa/projects/knowledge/yd.md`
- `pwa/design/db_schema.md`, `pwa/design/amd_score.md`
- Supabase read-only: `projects`, `project_ventures`, `project_knowledge`, `monthly_reports`, `project_meeting_summaries`, `project_strategy_signals`, `source_cache`, `project_vc_relations`, `project_xrl_log`, `project_xrl_evidence`
- 公開source: Yellow Duck公式サイト、Yellow Duck company page、福岡市実証実験資料、福岡市実証結果報告、経済界記事、Japan Energy Times

## 1. 結論

今回の追加joinで、YDについては次のように更新するのが安全。

| source bucket | join result | BZMでの扱い |
|---|---|---|
| `yd_specific_ue_lcoe_source` | Yellow Duck固有のLCOE、売電/販売単価、COGS、製造原価、保守費、保険、検収、粗利、契約、請求、入金は未発見。福岡市実証では5-50Wの実証機、設置性/安全性/干満追従/24時間連続発電などの検証sourceは見つかった。 | PoC/validation context。商用UE成立やR_net粗利成立には使わない。 |
| `vc_dd_source` | `/Users/masa/projects/knowledge/yd.md` に「各VC DDでUE成立せず」という内部current noteはあるが、VC別コメント、DD日、VC名、投資見送り理由原文はDB/ローカル/docs上では未発見。`project_vc_relations` もp18は空。 | DD要約sourceとして `review-only`。DD原文扱いしない。 |
| `wave_lane_failure_source` | 波力レーン一般の構造的不利sourceは増えた。経済界記事で中山氏自身が、過酷な海洋環境、50年に一度の大波対応による導入コスト、海洋生物付着メンテ、洋上風力偏重による予算環境を説明。Japan Energy Timesも初期投資/メンテ/技術成熟度の課題を整理。 | `low_p_market_structure` の補強。YD固有失敗理由へ直結しない。 |
| `yd_current_status_source` | 公式company pageでは設立 `2023-08-04`。公式newsでは2026-05-14に不動テトラ実証関連、2026-03〜05に登壇/受賞/メディア掲載があり、AMD関与後も活動継続sourceあり。DBは `projects.status=ended`, `start_ym=202505`, `end_ym=202509` でAMD関与終了を示す。 | YD会社としては活動継続、AMD関与はended。DBの `project_ventures.founded_at=2019-01-01` は公式設立日と衝突するため要補正候補。 |

重要な更新点は、`knowledge/yd.md` の「現状不明」は、公開情報ベースでは「会社・開発活動は継続」に更新できること。ただし、実証・登壇・受賞・メディア露出は、商用販売、粗利、売電単価、投資回収の成立sourceではない。したがって、YDはなお `low_p_market_structure` 主分類、`rnet_gross_margin_viability` 補助分類、`review-only` のまま扱う。

## 2. Source join table

| source_id_or_path | source_status | classification | evidence_summary | PRSで使うなら | double_count_guard | still_missing |
|---|---|---|---|---|---|---|
| `/Users/masa/projects/knowledge/yd.md` | internal knowledge / current note / 2026-05まさ口述 + web確認メモ | `low_p_market_structure` primary; `rnet_gross_margin_viability` secondary; `vc_dd_summary` secondary | 販売未到達、CEO自己資金試作、波力発電はUE成立しにくい、各VC DDで出資断念、AMD関与は2025-06〜2025-09の資金調達サポート。Web確認として発電コスト、導入/維持費、腐食/付着、Pelamis/Ocean Power Technologiesなども記載。 | `review-only` | internal noteをVC DD原文として扱わない。波力一般のLCOE/維持費はP側主source、R_net側では粗利未接続の補助理由に留める。 | Yellow Duck固有LCOE、売電/販売単価、製造原価、設置費、O&M、保険、検収、VC別DD原文、DD日、VC名。 |
| Supabase `projects?project_id=eq.p18` | DB current truth / read-only | `yd_current_status_source` for AMD relationship | `project_name=YD`, `status=ended`, `start_ym=202505`, `end_ym=202509`。AMD OS上はAMD関与終了PJ。 | `review-only` | AMD関与endedを、Yellow Duck法人の活動停止と読まない。 | AMD関与終了理由の一次source、契約/請求/支援範囲詳細。 |
| Supabase `project_ventures?project_id=eq.p18` | DB current truth with conflict | `yd_current_status_source`; `db_conflict` | `display_name=Yellow Duck`, `lane=gx_energy`, `outcome_pattern=ue_fail`, `short_description=波力発電 / オンサイトPoC到達もUE不成立で資金調達失敗`。ただし `founded_at=2019-01-01` は公式company pageの設立日 `2023-08-04` と衝突。 | `review-only` | `outcome_pattern=ue_fail` はAMD/BZM上の結果source。法人設立日・現在活動状況は公式sourceと照合する。 | DB設立日の由来、2019が研究開始/個人活動/旧登録なのかの確認。 |
| Supabase `project_knowledge?project_id=eq.p18` | DB basic facts only | `yd_current_status_source`; `still_missing` | basic facts 4件のみ。PJ表示名、レーン、法人設立日 `2019-01-01`、outcome_pattern `ue_fail`。UE/LCOE/VC DDの詳細knowledge rowは未接続。 | `review-only` | DB basic factを固有UE/LCOE source扱いしない。設立日は公式sourceと衝突するため補正候補。 | UE/LCOE/VC DD/売上/原価/保守/実証結果のproject_knowledge化。 |
| Supabase `monthly_reports`, `project_meeting_summaries`, `project_strategy_signals`, `source_cache`, `project_vc_relations`, `project_xrl_evidence` for p18 | DB read-only / no rows found | `still_missing` | p18の月次報告、MTGサマリ、strategy signals、source_cache、VC relation、XRL evidenceは空。 | `exclude from PRS` until rows exist | 空を「販売なし確定」「VC DD原文なし確定」と強く読みすぎない。少なくとも現DBにはjoin済みsourceが無い、に留める。 | Drive/メール/外部資料、DDメモ、pitch資料、VC別CRM、契約/請求/入金。 |
| Supabase `project_xrl_log?project_id=eq.p18` | DB manual XRL timeline / read-only | `survival_or_validation_context`; `seven_axis_context` | 2019-01-01 TRL4/BRL2/HRL3、2020-06-01 TRL5、2022-03-01 TRL6オンサイトPoC成功、2023-06-01 UE不成立/資金調達失敗/終了というmanual timeline。 | `review-only` for context; `exclude from PRS score` | TRL/PoCは技術検証sourceであり、商用UE/粗利成立sourceではない。日付は公式設立日と整合確認が必要。 | 各milestoneの一次source、実証先、発電量、費用、DD結果。 |
| `https://yellow-duck.jp/company/` | official public source / live checked 2026-06-02 | `yd_current_status_source`; `survival_or_validation_context` | 公式company pageは、2022年NEDO賞、2023年に海洋再エネ社会実装を目指して設立、会社概要で設立 `2023-08-04`、資本金300万円、事業内容は再生可能エネルギー研究開発等と記載。 | `review-only` | 設立/活動sourceとしては強いが、LCOE/粗利/販売成立sourceではない。DBの2019設立日をこのsourceで上書きするには別タスクで確認が必要。 | 商用契約、売上、原価、発電単価、保守費、投資回収。 |
| `https://yellow-duck.jp/` | official public source / live checked 2026-06-02 | `yd_current_status_source`; `survival_or_validation_context` | 公式newsに2026-05-14不動テトラとの浮体式波力発電システム実証、2026-03〜05の登壇/受賞/メディア掲載、2025-07以降の採択/展示/受賞が並ぶ。AMD関与後も会社活動は継続。 | `review-only` | 活動継続/検証継続を、UE成立・販売成立・粗利成立へ転用しない。 | 実証の費用負担、顧客/契約、検収、収益化条件、発電単価。 |
| 福岡市プレスリリース `namienerugiiniyoruhatudennsisutemu250128.pdf` | public municipal source / live checked 2026-06-02 | `yd_specific_validation_source`; `not_ue_lcoe` | 2025-01-28〜2025-02-07に博多漁港で、実証機を設置し実用可能性を検証。検証項目は安全作動、干満時の正常作動、大型漁船ひき波影響。実証機は高さ1300mm、全幅1000mm、全長3000mm、出力5〜50W、重量650kg。 | `review-only` | 5〜50W実証機の安全/設置検証を、商用LCOEや販売単価の成立sourceにしない。 | 実証費用、発電量実測、設備費、O&M、顧客支払意思、売電/販売単価。 |
| 福岡市実証結果報告 `houkokusyo_namienerugiiniyoruhatudennsisutemu.pdf` | public municipal result report / live checked 2026-06-02 | `yd_specific_validation_source`; `survival_or_validation_context` | 博多漁港実証で、特別な設備や重機なしの設置、荒天でも破損なし、約2m干満差と最大約3m海面変化への追従、24時間連続発電などを報告。 | `review-only` | 実証成功はTRL/BRL/SRL補助。LCOE・粗利・投資回収・R_net正値には使わない。 | 実証時の発電kWh、設備費、保守費、検収、顧客支払、商用スケール時の原価。 |
| 経済界 `https://net.keizaikai.co.jp/archives/3331` | public media/interview / live checked 2026-06-02 | `wave_lane_failure_source`; `low_p_market_structure` primary | 中山氏自身が、波力は過酷な海洋環境でコストが合わないと見切られてきた、50年に一度の大波対応で設備が過剰になり導入コストが上がる、海洋生物付着メンテが重い、洋上風力偏重で予算が付きにくい、と説明。 | `review-only` | 波力レーン一般の構造sourceとして扱う。YD固有技術がこれを覆せる/覆せないは別sourceが必要。R_net側へ同じ根拠を二重減点しない。 | Yellow Duck固有の実費、商用仕様、保守計画、顧客契約。 |
| Japan Energy Times `https://japan-energy-times.com/wave-power-generation-profitability-analysis-ocean-energy/` | public web source / live checked 2026-06-02 | `wave_lane_failure_source`; `low_p_market_structure` secondary | 波力発電の初期投資、運用/メンテ、技術成熟度、他再エネ比のコスト差、メンテ難度を整理。数値の一部は `knowledge/yd.md` の57円/kWhメモと一致しないため、単独でYD固有LCOEには採用しない。 | `review-only` | 一般web記事の数値を正式LCOEにしない。レーン一般の論点整理に留める。 | METI発電コスト検証WGなど一次資料との再照合、YD固有モデルへの適用可否。 |
| `origin/codex/yd-low-p-ue-guard-source-split` run | prior BZM worker artifact | `double_count_guard` primary | v12へ戻す前のsource split。`low_p_market_structure` primary、`rnet_gross_margin_viability` secondary、`p18_double_count_guard` のfield案あり。 | guard | 先行run自体は二次整理。実数sourceとして扱わない。今回のjoinでcurrent status/設立日/実証sourceを増補する。 | v12反映時のfield採用可否。 |
| `origin/codex/prs-evidence-cards-v11-p11-management-result` p18 section | prior evidence card | `low_p_market_structure` primary; `rnet_gross_margin_viability` secondary | p18は波力発電の高コスト、VC DDでUE成立せず、販売未到達、自己資金試作、海上実証/製造/設置/腐食/付着対策/O&M重いと整理。 | `review-only` | v11のP/R_net仮説は同じsourceを含むため、v12では主分類/補助分類を明示する。 | 追加finance/source join、VC DD原文、YD固有実数。 |

## 3. 分類別の扱い

### 3.1 `yd_specific_ue_lcoe_source`

今回見つかったYD固有sourceは、商用UEではなく実証・検証のsourceに寄っている。

- 福岡市実証開始資料: 博多漁港での安全性、設置性、干満・ひき波影響の検証。出力5〜50Wの実証機。
- 福岡市実証結果報告: 重機なし設置、荒天時の破損なし、干満/海面変化追従、24時間連続発電。
- 公式news: 2026-05-14の不動テトラ実証関連、2025〜2026の採択・登壇・受賞・メディア。

使ってよいこと:

- `survival_or_validation_context_status=active_validation_continues`
- `yd_current_status_source=official_site_and_municipal_demo_sources`
- `poc_not_commercial_ue` のguard補強

使ってはいけないこと:

- 商用LCOE成立
- 売電/販売単価成立
- COGS/粗利成立
- R_net正値
- 0-9 score

### 3.2 `vc_dd_source`

VC DDについては、今回も原文sourceは見つからなかった。

- `knowledge/yd.md`: 各VC DDでUE成立せず、出資断念という要約source。
- Supabase `project_vc_relations`: p18 rowsなし。
- `source_cache`, `project_meeting_summaries`, `project_strategy_signals`: p18 rowsなし。

したがって、v12では `vc_dd_status=ue_fail_summary_available_but_dd_details_not_joined` を維持する。VC別コメント、DD日、VC名、誰が何を問題視したかは `still_missing`。

### 3.3 `wave_lane_failure_source`

波力レーン一般のsourceは追加できた。

- 経済界記事は、波力の過酷な海洋環境、導入コスト、海洋生物付着メンテ、政策/予算環境の弱さを中山氏本人の説明として示す。
- Japan Energy Timesは、初期投資、メンテ、技術成熟度、他再エネ比のコスト差を一般論として整理する。
- `knowledge/yd.md` はPelamis Wave Power倒産、Ocean Power Technologies苦戦をレーン一般の失敗/苦戦例として持つ。

ただし、これらはYD固有失敗理由の直接証明ではない。v12では `wave_lane_failure_source_status=general_lane_source_joined_not_yd_specific` として、`low_p_market_structure` の補強に限る。

### 3.4 `yd_current_status_source`

current statusは更新が必要。

| 観点 | current source | 読み方 |
|---|---|---|
| AMD関与 | Supabase `projects.status=ended`, `start_ym=202505`, `end_ym=202509` | AMD側の関与は終了。 |
| Yellow Duck法人/活動 | 公式site 2026-05-14不動テトラ実証関連、2026-03〜05の登壇/受賞/掲載 | 法人/開発活動はAMD関与後も継続。 |
| 設立日 | 公式company page `2023-08-04` | 公式sourceでは2023-08-04。 |
| DB設立日 | `project_ventures.founded_at=2019-01-01`, `project_knowledge` basic factも2019-01-01 | 公式sourceと衝突。研究開始/個人活動/旧仮置きの可能性があるため、要補正候補。 |

v12では `yd_current_status_status=company_active_after_amd_support_but_amd_relationship_ended` とし、現状不明のままにはしない。ただし活動継続は商用UE成立とは別。

## 4. v12 evidence cardへ戻すfield案

v12ファイルは作らない。戻すなら、p18欄に次のfieldを追加/更新するのがよい。

| field | proposed value | purpose |
|---|---|---|
| `p18_low_p_market_structure_status` | `review_only_general_lane_sources_joined` | 波力レーン一般の市場構造/価格受容性/保守負担sourceは追加できたが、正式P値にはしない。 |
| `p18_low_p_primary_sources` | `/Users/masa/projects/knowledge/yd.md; https://net.keizaikai.co.jp/archives/3331; https://japan-energy-times.com/wave-power-generation-profitability-analysis-ocean-energy/` | low-P側のsource list。 |
| `p18_yd_specific_ue_lcoe_status` | `yd_specific_commercial_ue_lcoe_not_joined` | YD固有LCOE/売電/販売単価/COGS/粗利は未発見。 |
| `p18_yd_specific_validation_sources` | `Fukuoka City demo start PDF; Fukuoka City demo result PDF; Yellow Duck official news` | 実証/検証sourceとして分離。 |
| `p18_rnet_gross_margin_viability_status` | `gross_margin_not_joined` | R_net側は粗利成立source未接続。 |
| `p18_rnet_missing_join` | `contract + quote_or_tariff + invoice + payment + manufacturing_cost + installation_cost + o_and_m + corrosion_biofouling_maintenance + insurance + acceptance + customer_price` | review解除条件。 |
| `p18_vc_dd_status` | `ue_fail_summary_available_but_dd_details_not_joined` | VC DDの要約と原文未接続を分ける。 |
| `p18_vc_dd_missing_join` | `vc_name + dd_date + original_comment + no_go_reason + lcoe_or_cogs_or_price_assumption + source_path` | VC DD解除条件。 |
| `p18_wave_lane_source_status` | `general_lane_source_joined_not_yd_specific` | 波力一般とYD固有を分ける。 |
| `p18_current_status_status` | `company_active_after_amd_support_but_amd_relationship_ended` | Yellow Duck活動継続とAMD関与終了を分離。 |
| `p18_company_founded_at_source_status` | `official_company_page_2023_08_04_conflicts_with_db_2019_01_01` | DB basic fact補正候補。 |
| `p18_survival_or_validation_context_status` | `active_demo_and_award_context_not_gross_margin` | 実証/受賞/登壇を粗利から分離。 |
| `p18_double_count_guard` | `lcoe_maintenance_policy_budget_sources_primary_to_low_p_secondary_to_rnet_not_two_independent_penalties; poc_validation_not_commercial_ue; wave_lane_not_yd_specific` | 二重減点防止。 |
| `p18_ready_for_rubric_draft_scope` | `low_p_and_ue_failure_observation_items_only_not_formal_rnet_rubric` | 正式rubric化の誤読防止。 |
| `p18_prs_use` | `review-only` | comparison layer止まり。 |
| `p18_do_not_use_as` | `formal_P_value, formal_R_net_value, 0-9_score, current_7_axis_replacement, sales_actual, gross_margin_actual, vc_dd_original` | 誤用禁止。 |

## 5. 未解決

- Yellow Duck固有のLCOE、発電kWhあたりコスト、売電/販売単価、製造原価、設置費、O&M、腐食/付着対策費、保険、検収条件は未接続。
- 福岡市実証は設置性/安全性/追従性/連続発電の検証sourceであり、商用スケールのUE sourceではない。
- VC DD原文、VC別コメント、DD日、誰が何を問題視したかは未接続。
- `project_ventures.founded_at=2019-01-01` / `project_knowledge` 法人設立日と、公式company page `2023-08-04` が衝突。DB補正が必要かは別判断。
- AMD関与後もYellow Duckの活動は継続しているが、AMD関与終了後の資本政策/売上/商用実装の状況は未確認。
- 波力レーン一般の失敗/苦戦sourceは増えたが、YD固有技術で覆せる/覆せない範囲は未確認。

## 6. 司令塔判断事項

1. v12で `p18_current_status_status=company_active_after_amd_support_but_amd_relationship_ended` を採用してよいか。
2. 公式設立日 `2023-08-04` とDB `2019-01-01` の衝突を、別worker/別タスクでDB current truth補正候補にするか。
3. 福岡市実証sourceを `survival_or_validation_context` としてv12へ戻し、R_net/UE成立sourceからは明示除外する方針でよいか。
4. 経済界記事の中山氏説明を、`low_p_market_structure` の補強sourceとして採用してよいか。ただしYD固有失敗証明ではなく、wave lane general sourceに限定する。

## 7. 検証

- 必読資料、既存BZM run、knowledge、schema、DB read-only、公開sourceを確認した。
- Supabaseはread-only queryのみ。write/DDL/migration/extractor実装/deployは実行していない。
- 新規成果物はこのファイルのみ。
- 0-9 score表、R_net値付け、PRS正式採用、現行7軸AMD Score置換、過去score再計算は行っていない。
