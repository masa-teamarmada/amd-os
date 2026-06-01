# JOYCLE damage source split

作成日: 2026-06-02
作成者: BZM司令塔配下worker
ステータス: BZM司令塔レビュー待ち

## 0. この成果物の扱い

このメモは、p09 JOYCLE の `damage guard` / `本命毀損候補` を、PRS comparison layer で使える根拠と review-only に残す根拠へ分けるための source split である。

- PRSは現行7軸AMD Scoreを置換しない `comparison layer` のまま扱う。
- 0-9 score表、R_net値付け、PRS正式採用、現行7軸置換、過去score再計算は行わない。
- `damage_guard_use` は原則 `review-only`。正式R_net値や正式damage値にはしない。
- `negative R_net` は正式用語にしない。JOYCLE型は `damage guard` / `本命毀損候補` と呼ぶ。
- 口述由来の終結理由は confirmed 扱いにしない。`oral_history_pending_confirmation` までに留める。
- `billing_cycles` はAMD請求/cash timing補助に限定し、JOYCLE本体粗利、damage、reinvestment、PRS本体には使わない。
- DB write、DDL、migration、extractor実装、code実装、deployは行っていない。

確認した主資料:

- `pwa/bzm/COMMANDER_TASKS.md`
- `pwa/bzm/runs/2026-06-02-prs-classification-adoption-patch.md`
- `pwa/bzm/runs/2026-06-02-prs-bzm-judgement-brief.md`
- `pwa/bzm/runs/2026-06-02-prs-pr-rnet-evidence-cards-v3.md`
- `pwa/bzm/runs/2026-06-02-joycle-amd-support-end-current-truth-review.md`
- `pwa/bzm/runs/2026-06-02-prs-damage-reinvestment-source-pack.md`
- `pwa/bzm/runs/2026-06-01-prs-rnet-guard-memo.md`
- `/Users/masa/projects/knowledge/jc.md`

## 1. JOYCLE source inventory by type

| type | sources | source strength | PRS use | guard |
|---|---|---|---|---|
| `db_current_truth` | `projects.status='ended'`, `projects.end_ym='202603'`; `project_ventures.narrative_text` / `master_md_text` の2026-03終結記述 | 終了月については強い。`project_ventures.amd_support_ended_at=NULL` だけが正規化カラムのgap | `review-only` for support-end evidence | 終了日確認に使う。damage理由、JOYCLE本体粗利、R_net値へ転記しない |
| `knowledge_current_truth` | `/Users/masa/projects/knowledge/jc.md` の終了=2026-03、deep pivot、JB-02/JB-02A、R&D予算削減の整理 | knowledgeとして強いが、理由部分は口述を含む | `review-only` | 終了日と終結理由を分ける。理由は confirmed 扱いにしない |
| `oral_history_pending_confirmation` | 2026-05-06 まさ言語化の「R&D予算の意味が理解されなくなった」、2026-05-30口述の株主/bizdev/R&Dリテラシー/退任理由 | 重要だが source status は口述 | `review-only` | damage guard の仮説説明には使えるが、正式PRS根拠やDB truthにしない |
| `raw_source_candidate` | `monthly_reports`、`source_cache`、`project_knowledge` のR&D MTG、野田先生MTG、JOYCLE BOX有償テスト相談、見学会、装置量産計画、輸送/保管/法務意見書 | source候補。statusがdraft/unknown/candidate/active混在 | `review-only` or limited `usable source` only for factual existence | 契約、請求、入金、原価、導入/保守、本命R&D影響が揃うまで正のR_netにもdamage値にも使わない |
| `future_or_draft_source` | `MR_p09_202603`以降のdraft月次、202604以降のfuture-like月次、装置量産計画、来年以降の資金調達/生産パートナー選定 | future/draft | `review-only` or `exclude from PRS` | current truthや実績扱いしない。観測予定・source hygiene contextに留める |
| `billing_or_cash_timing_context` | p09 `billing_cycles` 202512-202702。202512/202601 payment confirmed、202602 invoice sent、202603以降 not_started中心 | AMD billing/cash timing context | `exclude from PRS` | AMD業務請求であり、JOYCLE本体PL、粗利、damage、reinvestmentには使わない |

## 2. Item-level split

### 2.1 AMD support end date

| source | type | current reading | prs_use | damage_guard_use | can feed v4? | notes |
|---|---|---|---|---|---|---|
| `projects.status='ended'`, `projects.end_ym='202603'` | `db_current_truth` | AMD/ARMADA業務PJとして2026-03終了 | `review-only` | support-end context only | yes | 終了月sourceとしてv4へ戻せる。R_net値やdamage理由ではない |
| `project_ventures.narrative_text` | `db_current_truth` | 2026-03-01「AMDによるJOYCLE支援が終了」 | `review-only` | support-end context only | yes | 正規化カラム補正候補のDB内根拠 |
| `project_ventures.master_md_text` / `jc.md` | `knowledge_current_truth` | 2026-03 AMD関与終結、会社自体は存続 | `review-only` | support-end context only | yes | knowledgeとDB textが一致 |
| `project_ventures.amd_support_ended_at=NULL` | `db_current_truth` gap | 継続根拠ではなく `source_hygiene_issue` | `review-only` | hygiene only | yes, as gap | DB全体ではなく、この正規化カラムだけがstale候補 |

結論: `support_end_status=ended_current_truth_candidate`、`support_end_date=2026-03`、`support_end_db_gap=project_ventures.amd_support_ended_at_null` として v4 に戻せる。ただし `project_ventures.amd_support_ended_at` 補正はOS/DB worker判断。

### 2.2 support end reason / まさ退任理由

| source | type | current reading | prs_use | damage_guard_use | can feed v4? | notes |
|---|---|---|---|---|---|---|
| `jc.md` 2026-05-06 まさ言語化 | `oral_history_pending_confirmation` | R&D予算を割り当てる意味が理解されなくなった | `review-only` | hypothesis/context | yes, with oral flag | 終結理由として重要だが、confirmed sourceではない |
| `jc.md` 2026-05-30 口述 | `oral_history_pending_confirmation` | 株主/bizdevがR&D投資を理解せず、まさが消耗して退任 | `review-only` | hypothesis/context | yes, with oral flag | `confirmed_by_masa` 未満。正式damage理由にはしない |
| `source_cache` / `project_knowledge` direct hits | `raw_source_candidate` absence | 退任/関与終結の直接ヒットは0件 | `exclude from PRS` as proof | no | yes, as missing-source note | 「raw source未確認」を明示するために使う |

結論: 終了日は current truth candidate、終結理由は `oral_history_pending_confirmation`。v4では `support_end_reason_status=oral_history_pending_confirmation` として、reasonを正式PRS根拠にしない。

### 2.3 R&D budget / engineering time damage

| source | type | current reading | prs_use | damage_guard_use | can feed v4? | notes |
|---|---|---|---|---|---|---|
| `jc.md` | `knowledge_current_truth` / `oral_history_pending_confirmation` | 2026-03に研究開発予算が削減され、野田先生成果の実装には至らず | `review-only` | candidate | yes, with source split | 予算削減は強い仮説だが、金額/意思決定ログは未接続 |
| `MR_p09_202511` | `raw_source_candidate` / draft | R&D体制再構築、野田先生特許活用、CO削減触媒、車両購入約400万円、人員確保計画 | `review-only` | candidate | yes, as source candidate | R&D投資・人員確保の観測候補。draftなので正式値不可 |
| `p09_202512` | `raw_source_candidate` / draft | 竹富島実証、ミニモデル発注準備、特許引き継ぎ、人材不足、deeptech認定優先 | `review-only` | candidate | yes, as source candidate | 人材不足/資金調達課題の候補 |
| `MR_p09_202601` | `raw_source_candidate` / draft | 研究開発体制強化、ミニモデル仕様確定、実証機材発送、定例MTG | `review-only` | candidate | yes, as source candidate | R&D継続source。予算削減の反対側sourceとして突合が必要 |
| `MR_p09_202602` | `raw_source_candidate` / fixed | 研究開発MTG月4回、技術課題検討、マスタースケジュール運用、請求書発行調整 | `usable source` only for activity existence; otherwise `review-only` | candidate | yes | fixed月次なので活動存在は強い。ただし請求調整はAMD billingであり、R&D damage根拠にはしない |
| source_cache `p09_gmeet_minutes_19c4625475e468b1` | `raw_source_candidate` | 2026-02-10 R&D MTG。8テーマ、ホワイトペーパー、JB-02A仕様、QA専門家 | `review-only` | candidate | yes | 本命R&D継続のsource候補 |
| source_cache `p09_gmeet_minutes_19d19a9f41cfc6df` | `raw_source_candidate` | 2026-03-23 野田先生MTG。大学装置利用、共同研究、学生協力、補助金活用 | `review-only` | candidate | yes | AMD関与終結前後のR&D継続/断絶確認に使える |
| project_knowledge `f12a6503-33c3-4227-bcef-bcbccd69f773` | `raw_source_candidate` | 野田先生側で学生を出せない状況 | `review-only` | candidate | yes | 人的リソース制約。damage確定ではない |

結論: v4へは `rd_budget_engineering_time_damage=review-only`、`rd_source_status=mixed_raw_and_oral` として戻す。R&D活動の存在は一部 usable だが、damageの因果と予算削減額は未確認。

### 2.4 JB-02/JB-02A sales-before-proof

| source | type | current reading | prs_use | damage_guard_use | can feed v4? | notes |
|---|---|---|---|---|---|---|
| `jc.md` JB-02/JB-02A section | `knowledge_current_truth` / oral mixed | JB-02は1台製作済み。JB-02Aは設計中で年内完成から販売可能に近い。販売実績ゼロ、装置販売前夜 | `review-only` | candidate | yes | 正のR_netではない。販売前夜としてのみ扱う |
| source_cache `p09_gmeet_minutes_19c4625475e468b1` | `raw_source_candidate` | JB-02A仕様決定、研究開発テーマ、品質保証専門家 | `review-only` | candidate | yes | 技術/仕様source。契約/入金/原価なし |
| source_cache `p09_gmail_19cbd831f3f4465b` | `raw_source_candidate` / unknown | JOYCLE BOX有償テストの適法スキーム・意見書相談 | `review-only` | candidate | yes | 法務/BRL/SRL候補。売上実績ではない |
| source_cache `p09_gmail_19cfe120cc2a71b2` | `raw_source_candidate` / unknown | 東邦ガス系のJOYCLE BOX化検討 | `review-only` | candidate | yes | 顧客候補。受注/入金/粗利ではない |
| project_knowledge `e081aad2-44df-4e91-b90f-ae674868b0da` | `raw_source_candidate` / active | 愛知県で取引先限定の装置見学会予定 | `review-only` | candidate | yes | 見学会を商談/販売実績にしない |
| project_knowledge `535e34ee-9fd0-40fd-a016-7c10c0282cfd` | `raw_source_candidate` / active | JOYCLE BOX法律意見書対象 | `review-only` | candidate | yes | 有償テスト/販売前SRL/BRL補助 |

結論: JB-02/JB-02Aは v4 で `sales_before_proof=review-only`。契約、請求、入金、原価、本命R&D影響が揃うまで `usable source` に上げない。

### 2.5 device introduction / maintenance / support burden

| source | type | current reading | prs_use | damage_guard_use | can feed v4? | notes |
|---|---|---|---|---|---|---|
| project_knowledge `68f08938-eb14-4e18-b29c-5feb1f995078` | `raw_source_candidate` / active | JOYCLE保有の熱分解装置。4tエアサス車両で輸送が必要、1機輸送予定 | `review-only` | operating-cost candidate | yes | 導入/輸送コスト候補。売上実績ではない |
| source_cache `p09_slack_1705354340_982309` | `raw_source_candidate` / unknown | ハード開発段取り、サカエ工業、開発予算2500万円程度で初号機を作れるか | `review-only` | operating-cost candidate | yes | 開発予算見込み。実支出/原価値ではない |
| source_cache `p09_slack_1706057433_112589` / `p09_slack_1710284416_901549` | `raw_source_candidate` / unknown | 自社装置/装置仕様たたき台 | `review-only` | candidate | yes | 仕様検討。販売前夜や粗利にしない |
| project_knowledge `8be06f88-e5e0-4388-9151-1114cc6a0d5a` | `future_or_draft_source` / active | 装置量産計画、資金調達と生産パートナー選定 | `review-only` | future/candidate | yes | 量産計画であり実績ではない |
| project_knowledge `994f6740-c1bc-4b65-bbf4-91072133eef3` | `future_or_draft_source` / active | 来年以降の装置量産、資金調達、生産パートナー選定 | `review-only` | future/candidate | yes | future計画。current truthにしない |

結論: 導入/保守/サポート負担は `operating_cost_source` として v4 に渡せる。ただし原価・保守人員・顧客対応工数・故障対応・輸送/設置費の実数がないため `review-only`。

### 2.6 billing_cycles / AMD billing / cash timing

| source | type | current reading | prs_use | damage_guard_use | can feed v4? | notes |
|---|---|---|---|---|---|---|
| `billing_cycles` p09 202512 | `billing_or_cash_timing_context` | invoice_sentあり、payment_confirmed_atあり | `exclude from PRS` | no | yes, exclusion note | AMD業務請求/cash timingのみ |
| `billing_cycles` p09 202601 | `billing_or_cash_timing_context` | budget_confirmed、invoice_sentあり、payment_confirmed_atあり | `exclude from PRS` | no | yes, exclusion note | JOYCLE本体PLではない |
| `billing_cycles` p09 202602 | `billing_or_cash_timing_context` | invoice_sentあり、payment未確認 | `exclude from PRS` | no | yes, exclusion note | 2月分請求処理の補助情報に限定 |
| `billing_cycles` p09 202603以降 | `future_or_draft_source` / billing context | not_started中心、invoice/paymentなし | `exclude from PRS` | no | yes, exclusion note | future-like rowsを継続支援や売上にしない |

結論: `billing_cycles` は v4 の `exclude_from_prs` 欄へ明示する。cash timing補助にだけ使い、JOYCLE本体粗利、damage、reinvestment、PRS本体には使わない。

## 3. PRS handling summary

| item | recommended classification | prs_use | reason |
|---|---|---|---|
| AMD support end date | `support_end_current_truth` | `review-only` | 終了日sourceとしては使えるが、R_net値・damage理由ではない |
| support end reason / まさ退任理由 | `oral_history_pending_confirmation` | `review-only` | 口述由来。正式damage理由やDB truthにしない |
| R&D budget / engineering time damage | `damage_guard_candidate` / `reinvestment_unverified` | `review-only` | raw source候補はあるが、予算削減額・意思決定ログ・因果が未接続 |
| JB-02/JB-02A sales-before-proof | `sales_before_proof` / `bridge_business_candidate` | `review-only` | 販売前夜であり、契約/請求/入金/原価/本命R&D影響が未接続 |
| device introduction / maintenance / support burden | `operating_cost_source` | `review-only` | 輸送・開発予算・量産計画の候補はあるが実費/工数未確認 |
| billing_cycles / AMD billing / cash timing | `amd_billing_cash_timing_only` | `exclude from PRS` | AMD請求でありSU本体PLでもdamage/reinvestmentでもない |

## 4. can_feed_evidence_cards_v4

| v4 field | recommended value | source basis |
|---|---|---|
| `support_end_status` | `ended_current_truth_candidate` | `projects.status='ended'`, `projects.end_ym='202603'`, `project_ventures.narrative_text`, `master_md_text`, `jc.md` |
| `support_end_date` | `2026-03` | DB end_ym and knowledge match |
| `support_end_db_gap` | `project_ventures.amd_support_ended_at_null` | normalized column gap only |
| `current_truth_classification` | `db_current_truth_plus_knowledge_current_with_normalized_column_gap` | DB/knowledge end state agree, one normalized field is stale candidate |
| `support_end_reason_status` | `oral_history_pending_confirmation` | 2026-05-06 / 2026-05-30まさ言語化 |
| `damage_guard_use` | `review-only` | source strength mixed; formal value blocked |
| `sales_before_proof_status` | `review-only` | JB-02/JB-02A, 有償テスト, 見学会, JOYCLE BOX化検討 |
| `operating_cost_source_status` | `review-only` | 輸送、初号機開発予算、量産計画、装置仕様 |
| `billing_cycles_use` | `exclude_from_prs` | AMD billing/cash timing only |
| `do_not_use_as` | `positive_R_net`, `formal_damage_value`, `sales_actual`, `gross_margin_actual` | contract/payment/cost/damage causal chain missing |

## 5. needs_masa_confirm

| question | why |
|---|---|
| 2026-05-06 / 2026-05-30口述の終結理由を、BZM内では `oral_history_pending_confirmation` のまま維持するか | 本成果物では confirmed 扱いにしない。まさ確認で source status をどう上げるか判断が必要 |
| 「株主/bizdevがR&Dを理解しなかった」ことを、公開/準公開TextbookやBZM内部だけのどちらで扱うか | 対外表現リスクとセンシティブ性がある |
| JB-02/JB-02A販売前夜をどこまで本命毀損候補として見るか | 販売が本命R&Dへ再投資される可能性と、R&D削減の口実になる可能性が両方ある |
| まさ退任理由を damage guard の代表例として使うか、internal-onlyのsourceに留めるか | 個人/経営判断文脈が強いため、扱う範囲の判断が必要 |

## 6. needs_os_db_hygiene

| issue | recommended next action |
|---|---|
| `project_ventures.amd_support_ended_at=NULL` | OS/DB workerでread-only再確認後、`2026-03-01` 補正またはmonth precision設計を判断 |
| ended PJのfuture-like `monthly_reports` / `billing_cycles` | ended PJ current truth判定からfuture-like draft rowsを除外する運用をOS側で明文化候補にする |
| `project_ventures.narrative_text` / `master_md_text` と正規化カラムのズレ | source hygiene issueとして台帳化する |
| source labelsの統一 | `support_end_current_truth`, `oral_history_pending_confirmation`, `sales_before_proof`, `amd_billing_cash_timing_only` をBZM run labelとして揃える |

## 7. needs_more_source

| missing source | why needed |
|---|---|
| JB-02/JB-02Aの契約、請求、入金、原価、販売予定単価 | sales-before-proofを実績粗利へ上げられるか判定するため |
| 導入/保守/輸送/顧客対応工数 | 装置販売が粗利を生むのか、R&D人員を食うのかを見るため |
| R&D予算推移、研究人員推移、野田先生技術実装ロードマップ | 本命R&Dが実際に縮んだかを確認するため |
| AMD関与終結前後の意思決定ログ | 口述由来の終結理由をraw sourceで補強するため |
| 2026-03以降のJOYCLE本体活動とAMD非関与の境界 | 会社存続とAMD支援終了を混同しないため |

## 8. Verification

- 指定されたAGENTS/CLAUDE/HANDOFF/BZM runsをread-onlyで確認した。
- `/Users/masa/projects/knowledge/jc.md` をread-onlyで確認した。
- `git fetch --all --prune`、`git log --branches --not --remotes --oneline`、`git branch -a`、`git status -s`、`git status -sb`を確認した。
- DB write、DDL、migration、extractor実装、code実装、deployは行っていない。
- 0-9 score表、R_net値付け、PRS正式採用、現行7軸置換、過去score再計算は行っていない。
- `negative R_net` は正式用語として採用していない。
- `billing_cycles` をJOYCLE本体粗利、damage、reinvestment、PRS本体に使っていない。
