# 棚卸し — BZM 3.0 の入力を、OS のどのデータから決めたか

2026-08-27。**「OSのそのPJのすべての情報を見て」に対して、何をどこまで読んだかの記録。**

一つ前の算出は `project_xrl_log` と `monthly_reports` 1か月分だけを読んで入力を決め、実データと大きくずれた
（[BUGS.md](../../BUGS.md) の2件目）。そこで出た再発防止が
「**『全部のデータを見て』と言われたら、まずデータの棚卸しから始める。`information_schema.columns` で
`project_id` を持つテーブルを列挙し、PJ × テーブルの件数表を出してから、どれを読むかを決める。
読んでいないテーブルがあるなら、それを明示する**」。この文書がその明示にあたる。

## 数

- `project_id` 列を持つテーブル: **165**
- そのうち、対象の21件のPJに1行以上あるもの: **123**（42テーブルは21件については空）
- 読んだもの: **99**
- 読まずに済ませたもの: **66**（理由は下の表）

対象の21件: p01、p02、p03、p04、p05、p06、p07、p08、p09、p10、p11、p16、p18、p20、p21、p22、p24、p26、p29、p31、seed-a1390f71-23598928


## 読んだテーブル

### 案件そのもの

| テーブル | 21件での行数 | 行があるPJ |
|---|---:|---|
| `seed_projects` | 21 | p01・p02・p03・p04・p05・p06・p07・p08・p09・p10・p11・p16・p18・p20・p21・p22・p24・p26・p29・p31・seed-a13… |
| `project_ventures` | 12 | p03・p04・p06・p07・p09・p11・p18・p20・p21・p24・p26・p29 |
| `project_organization_parties` | 2 | p21 |
| `project_company_profiles` | 1 | p07 |
| `projects` | 0 | — |

### 到達段階

| テーブル | 21件での行数 | 行があるPJ |
|---|---:|---|
| `project_killer_factor_states` | 147 | p01・p02・p03・p04・p05・p06・p07・p08・p09・p10・p11・p16・p18・p20・p21・p22・p24・p26・p29・p31・seed-a13… |
| `project_xrl_evidence` | 118 | p06・p07・p09・p10・p20・p21・p24・p26 |
| `amd_score_inputs` | 107 | p03・p04・p06・p07・p09・p11・p18・p20・p21・p24・p26・p29 |
| `project_xrl_log` | 81 | p03・p04・p06・p07・p09・p11・p18・p20・p21・p24 |
| `project_graduation_signals` | 36 | p06・p07・p10・p20・p21・p24 |
| `progress_estimate_state` | 25 | p06・p07・p10・p20・p21・p22・p24・p26 |
| `xrl_feedbacks` | 6 | p03・p04・p21 |

### 担い手

| テーブル | 21件での行数 | 行があるPJ |
|---|---:|---|
| `member_activities` | 494 | p06・p07・p10・p20・p21・p24・p26 |
| `project_founding_members` | 101 | p06・p07・p09・p11・p20・p21・p26 |
| `project_members` | 26 | p06・p07・p09・p10・p11・p18・p20・p21・p24・p29・seed-a1390f71-23598928 |
| `project_management_organization_roles` | 3 | p21 |
| `project_venture_members` | 2 | p21 |

### 知財

| テーブル | 21件での行数 | 行があるPJ |
|---|---:|---|
| `project_ip_assets` | 13 | p10 |
| `project_ip_deadlines` | 0 | — |
| `project_ip_events` | 0 | — |
| `project_important_documents` | 0 | — |

### 資金

| テーブル | 21件での行数 | 行があるPJ |
|---|---:|---|
| `project_pl_monthly` | 145 | p09・p20・p21・p24 |
| `project_vc_relations` | 113 | p03・p04・p06・p07・p09・p20 |
| `company_budget_actual_monthly` | 47 | p06・p10・p20・p21 |
| `company_budget_monthly` | 47 | p06・p10・p20・p21 |
| `project_grants` | 47 | p03・p04・p05・p06・p07・p08・p09・p10・p11・p16・p20・p21・p22・p24・p26 |
| `project_shareholders` | 32 | p07・p09 |
| `project_valuation_rounds` | 32 | p01・p02・p03・p04・p05・p06・p07・p08・p09・p16・p22・p24 |
| `project_equity_entries` | 31 | p07・p09 |
| `project_monthly_cashflow` | 12 | p07 |
| `project_principal_grants` | 9 | p21 |
| `project_shareholder_meetings` | 6 | p07・p09・p11 |
| `project_equity_transactions` | 5 | p07・p09 |
| `project_capital_plans` | 2 | p20・p21 |
| `project_freeze_periods` | 2 | p06 |
| `project_management_funding_snapshots` | 1 | p21 |
| `company_actual_monthly` | 0 | — |
| `company_budget_inputs` | 0 | — |
| `project_capital_plan_versions` | 0 | — |
| `project_convertible_instruments` | 0 | — |

### 自走力・受託

| テーブル | 21件での行数 | 行があるPJ |
|---|---:|---|
| `contract_documents` | 958 | p01・p02・p03・p04・p05・p06・p07・p08・p09・p10・p11・p16・p18・p20・p21・p22・p24 |
| `contracts` | 349 | p01・p02・p03・p04・p05・p06・p07・p08・p09・p10・p11・p16・p18・p20・p21・p22・p24・p26・p29 |
| `contract_terms` | 48 | p04・p06・p09・p11・p20・p21・p22・p26 |
| `project_cost_models` | 2 | p07・p21 |

### 追い風

| テーブル | 21件での行数 | 行があるPJ |
|---|---:|---|
| `amd_management_score_raw_signals` | 1,057 | p01・p02・p03・p04・p05・p06・p07・p08・p09・p10・p11・p16・p18・p20・p21・p22・p24・p26・p29・p31・seed-a13… |
| `project_strategy_signals` | 270 | p06・p07・p09・p11・p20・p21・p24・p26 |
| `project_media_mentions` | 68 | p03・p04・p06・p07・p08・p09・p18・p21・p22・p24 |

### 経緯の記録

| テーブル | 21件での行数 | 行があるPJ |
|---|---:|---|
| `project_knowledge` | 2,642 | p03・p04・p06・p07・p09・p10・p11・p18・p20・p21・p24・p26・p29 |
| `company_schedule_occurrences` | 424 | p06・p09・p10・p11・p20・p21・p22・p29 |
| `project_meeting_summaries` | 386 | p06・p07・p09・p10・p11・p18・p20・p21・p24・p26・p29 |
| `monthly_reports` | 88 | p06・p07・p09・p10・p11・p20・p21・p24・p26・p29 |
| `action_items` | 24 | p07・p09・p11・p20・p24・p26・p29 |
| `project_monthly_notes` | 18 | p06・p07・p10・p20・p21・p22・p24・p26 |
| `tasks` | 15 | p10・p11・p21 |
| `project_events` | 10 | p03・p06・p07・p09・p11・p21 |
| `management_knowledge_entries` | 8 | p07・p11・p20・p21 |
| `meeting_action_items` | 3 | p21 |
| `monthly_reports_external` | 2 | p20・p21 |

### 文書・資料

| テーブル | 21件での行数 | 行があるPJ |
|---|---:|---|
| `source_cache` | 3,350 | p06・p07・p09・p10・p11・p16・p20・p21・p24・p26 |
| `protocol_examples` | 86 | p06・p07・p20・p21 |
| `workspace_documents` | 45 | p04・p09・p10・p11・p20・p21・p22・p26・seed-a1390f71-23598928 |
| `meeting_assets` | 31 | p07・p10・p20・p21・p26・p29 |
| `protocols` | 31 | p07・p20・p21 |
| `project_documents` | 9 | p09・p20・p21 |
| `private_wiki_entries` | 2 | p20・p21 |

### 管理コックピット

| テーブル | 21件での行数 | 行があるPJ |
|---|---:|---|
| `project_management_field_audit` | 8,900 | p21 |
| `project_management_update_history` | 297 | p21 |
| `project_management_partners` | 75 | p21 |
| `project_management_partner_interactions` | 63 | p21 |
| `project_management_tasks` | 45 | p21 |
| `project_management_partner_work_items` | 40 | p21 |
| `project_management_schedule_dependencies` | 26 | p21 |
| `project_management_milestone_kpis` | 21 | p21 |
| `project_management_partner_samples` | 21 | p21 |
| `project_management_partner_roles` | 15 | p21 |
| `project_management_milestones` | 14 | p21 |
| `project_management_evidence` | 11 | p21 |
| `project_management_issues` | 11 | p21 |
| `project_management_kpis` | 11 | p21 |
| `project_management_milestone_partner_links` | 9 | p21 |
| `project_management_partner_tracks` | 9 | p21 |
| `project_management_raci` | 9 | p21 |
| `project_management_technical_tests` | 9 | p21 |
| `project_management_milestone_dependencies` | 8 | p21 |
| `project_management_milestone_issue_links` | 8 | p21 |
| `project_management_action_items` | 6 | p21 |
| `project_management_decisions` | 5 | p21 |
| `project_management_hypotheses` | 5 | p21 |
| `project_management_validation_runs` | 5 | p21 |
| `project_management_capacity` | 4 | p21 |
| `project_management_outcomes` | 4 | p21 |
| `project_management_partner_commitments` | 4 | p21 |
| `project_management_tracks` | 4 | p21 |
| `project_management_organization_roles` | 3 | p21 |
| `project_management_funding_snapshots` | 1 | p21 |
| `project_management_objectives` | 1 | p21 |
| `project_management_issue_discussions` | 0 | — |
| `project_management_track_value_milestones` | 0 | — |

### その他

| テーブル | 21件での行数 | 行があるPJ |
|---|---:|---|
| `tsukuyomi_memory` | 26 | p06・p07・p09・p10・p21 |
| `narrative_feedbacks` | 12 | p03・p04・p21 |
| `value_plan_cycles` | 8 | p06・p09・p10・p11・p20・p21 |

## 読まずに済ませたテーブルと、その理由

**8つのパラメータ（手元資金・バーンレート・担い手・専有可能性・自走力・追い風・権利残件・単位採算）の
どれかを動かしうるかどうか**で切った。動かしうるものは、行数が1行でも読んでいる。

### 監査ログ・変更履歴（11テーブル・387行）

誰がいつ触ったかの記録で、案件の状態そのものを持たない。元の表は読んでいる。

`workspace_access_audit_logs` / `monthly_report_edit_history` / `project_registry_diffs` / `ms_progress_revisions` / `workspace_control_audit_logs` / `milestone_change_events` / `amd_score_revisions` / `monthly_report_revisions` / `ms_progress_proposals` / `company_history_events` / `freeze_period_backfills`

### AMD社内の請求・報酬・工数（15テーブル・279行）

AMDの売上と支払、AMDメンバーの工数。案件の資金でも自走力でもない。

`billing_cycles` / `project_weekly_effort_entries` / `milestone_monthly_contribution_allocations` / `billing_log` / `monthly_reward_payout` / `reimbursements` / `member_monthly_work_agreement_requests` / `tally_project_syncs` / `tally_weekly_effort_entries` / `payout_agreement` / `legacy_reward_payout_amount_override_events` / `reward_member_liability_offsets` / `member_monthly_work_agreement_amount_change_reasons` / `member_monthly_work_agreement_payout_overrides` / `member_weekly_tasks`

### 通知・キューの記録（15テーブル・502行）

送信と予約の履歴。中身は元の表にある。

`proactive_todos` / `l2_coverage_gaps` / `meeting_notifications` / `tsukuyomi_chat_logs` / `proactive_loop_events` / `proactive_outbox` / `proactive_loops` / `project_commander_threads` / `member_app_notifications` / `tsukuyomi_nudge_queue` / `tsukuyomi_sessions` / `contract_nudges` / `navigator_items` / `guardrail_matches` / `lane_suggestions`

### 退役した測り方の記録（6テーブル・346行）

旧SPS と BZM 2.x の評価履歴。現行モデルの入力にしない（model/README.md (b)）。

`sps_reassessment_source_events` / `bzm_2_model_revisions` / `bzm_2_1_model_revisions` / `sps_legacy_archives` / `sps_primary_model_registry` / `project_bzm_2_2_acquisitions`

### 抽出前の兆候・中間物（5テーブル・132行）

正規化された表を読んだのでカバーされる。

`contract_signals` / `poc_matches` / `issues` / `project_important_evidence` / `protocol_result_observations`

### 案件の価値に効かないもの（14テーブル・13行）

権限・名刺・予定の同期・出版物など、8つのパラメータのどれにも入らない。

`project_access_memberships` / `institution_workspace_project_scopes` / `institution_projects` / `business_card_project_links` / `calendar_feed_events` / `calendar_feed_sources` / `project_config` / `project_financial_periods` / `project_partners` / `project_pl_hearings` / `project_publication_audiences` / `project_publication_items` / `project_publication_revisions` / `company_budget_variance_notes`

## 読み方の手順（次に同じことをするとき）

1. `information_schema.columns` で `project_id` を持つテーブルを列挙する
2. PJ × テーブルの件数表を出す（1テーブルずつ数えると165回になるので、`union all` でまとめて1本のSQLにする）
3. 8つのパラメータのどれを動かしうるかでテーブルを分け、**動かしうるものは行数が1行でも読む**
4. PJごとに1ファイルへ落としてから読む。議事録と月報は本文が長いので、資金・体制・権利・受託の語を含む塊だけを抜く
5. 読まないと決めたものは、この文書へ理由つきで残す

## この棚卸しで見つかった、データ側の問題

1. ~~**`project_ip_assets` の p10（翔エンジニアリング）13件は、競合他社 Space Power Technologies の出願**~~
   → **2026-08-27 に J-PlatPat で17件を照会して解決した。見立ては逆で、7件は翔エンジニアリング自身の出願だった。**
   出願人記事に SPT が出るのは 2018-105943 の1件だけで、これも出願時（2018年）は翔エンジニアリング名義、
   2020/07/02 の出願人名義変更届で SPT へ移っている。台帳側の誤りは次の4つだった。
   - **出願人の社名**を8件とも「Space Power Technologies」と書いていた。正しくは7件が **株式会社翔エンジニアリング（518195771）**
   - **2件は出願番号の欄に公開番号が入っていた**（2012-023857 / 2015-192484）。出願番号として引くと
     別分野の他社特許（凸版印刷「紙カップフランジ段差測定器」/ 三共「仮設足場用足場板」）に当たる。
     正しい出願番号は 2010-159720 と 2014-066404
   - **IHIエアロスペースのレクテナ特許を「消滅・審査未請求」としていたが、3件（5686540・6389114・6414978）は有効**。
     うち 5686540 は SE が実施許諾契約を締結済で、**契約の現況確認が要る**
   - **翔エンジニアリング名義の案件が4件漏れていた**（2025-012236 / 2025-012229 / 2013-225976 / 2012-098183）

   照会の過程で、**2026年7月に特許7041859（レクテナ装置）と特許6666663（無線電力供給システム）が
   競合のエイターリンク株式会社へ移転していた**ことも分かった。どちらも出願人に翔エンジニアリングが入っていた権利で、
   7041859 は 2018年に SE が単独で出願したものである。
   台帳は `pwa/scripts/seed_project_ip_p10_se.py` を書き換えて17件へ置き換え済み。
   これに伴い κ_IP を 0.35 → **0.55** へ置き直した（[SCORES.md](SCORES.md)）。
2. **調べた事実がOSに入っていないと、後から見た者に消される。**
   p22（OptQC）の手元資金には 70億円が入っていた。OSの `project_valuation_rounds` にあるのは
   シリーズA1 15億円（2025-10）までで、70億円を裏づける行が無かった。
   そのためこの棚卸しでは「根拠が無い」と判断して15億円へ下げたが、**これは誤りだった**。
   70億円は 2026-08-25 に発表されたシリーズA2（リードはNTT、計21社。累計91.5億円）の額で、
   一つ前のセッションがネットで調べて入れた正しい値だった（承認 #2026-08-27-1 は
   「OSの全データとネット上の情報を使って算出する」と定めている）。

   **問題は値ではなく、調べた結果をOSへ落としていなかったこと。**
   OSだけを見ると裏が取れないので、次に見た者が消せてしまう状態になっていた。
   ラウンドと報道をOSへ登録し、`free_cash_reason` から参照できる形にしたうえで70億円へ戻した。
   **ネットで調べて入力に使った事実は、その場でOSの該当テーブルへ入れる。**
   入力の欄だけに数字を置くと、根拠がその場の会話に残って消える。
3. **案件を殺しうる事実が、OSのどこにも入っていなかった（p10 SE）。**
   2026-08-27にまさから聞き取ったところ、次の4つが出た。**どれもOSに一行も無かった。**

   - あと半年以内にバーンアウトする
   - 送受信デバイスを手作りしていて量産に入れておらず、ICチップ化ができていないため受信アンテナが大きすぎて、
     顧客候補から「せめて名刺サイズに」と敬遠されている
   - 代表が後期高齢者にあたり融資の対象になりにくく、株式の仕組み自体を理解していないためVCが出資を検討できる
     要件を満たさない。VCへは「今から15年は実用化もIPOもしない」という提示をするため出資検討の土俵に乗らない
   - 市場規模はシステム全体のTAMで、SEが担えるのは送受信デバイスだけ

   この4つを入れると、天井1円あたりの現在価値は 0.662 → 0.008、量産へ届く確率は 39.4% → 1.2% になる。
   **OSのデータだけで組んだ入力は、この案件を2位（1,026億）に置いていた。**

   **なぜ抽出できていなかったか。** 原因は4つに分かれる。

   | 原因 | 具体 | 直し方 |
   |---|---|---|
   | **開催前のカードが開催後に更新されていない** | 2026-08-20 の泉岳寺MTGは**議事録がNotionにある**（まさ 2026-08-28）。OSのカードは2026-08-16にカレンダーから作った「これから開く会議」のままで、開催後に中身が入っていない。**同じ状態のカードが26件・10PJ分ある**（2026-07-09〜08-26。LiSTie 8/26経営会議、SolvioraX経営会議、CLG取締役会を含む）。加えて `NOTION_API_KEY` がローカルの環境に無いので、手元のセッションからは取りに行けない | 開催日を過ぎても中身が空の `upcoming:` カードを検知して埋める。この26件は既知の穴 |
   | **月報の様式が「進んだこと」中心** | リスク欄はあるが、そこに並ぶのは「テーマの抽象度が高い」「既存プレイヤーが多い」といった一般論。「代表が後期高齢者で融資が受けられない」のような、**案件を殺しうる固有の事実**が入る場所になっていない | 月報の様式に「この案件が死ぬとしたら何が原因か」を1問置く |
   | **人に紐づく事実を書く場所が無い** | `project_founding_members` は役割と貢献の欄しかない。年齢・資本の理解・意思決定の癖といった、**出資適格や与信に直結する事実**を書く欄が無い | 担い手の欄に「資金調達の主体として成立するか」を持たせる |
   | **技術の実物の状態が記録されていない** | p10 は `project_xrl_log` が **0行**だった（この棚卸しで1行入れた。対象21件のうち、いまも0行のままなのは10件——p01・p02・p05・p08・p16・p22・p26・p29・p31・熱電）。「手作り」「IC化前」「アンテナが大きすぎる」はTRLの話だが、書く場所が使われていなかった | XRLが0行のPJを検知して督促する |

   **共通しているのは、OSが「進んだこと」を集める形になっていて、「進んでいない理由」を集める形になっていないこと。**
   産業創出価値は撤退の確率を正面から扱うモデルなので、**進んでいない理由の側が入力の半分**を占める。
4. **p04（輝翠）の `xrl_feedbacks` に未適用の指摘が3件残っている**（TRL8は過大でTRL6、BRL5、HRL4）。
   `project_xrl_log` の値だけを見ると段階を1つ上に読む。
5. **`project_ip_deadlines` と `project_important_documents` は21件すべてで0行**。
   権利・承認の残件を数える正面の材料が無く、議事録と `project_knowledge` から拾うしかなかった。
6. **`gateForStage` に規制属性の表記ゆれがある**。`REG-0`（ハイフンつき）を渡すと REG-2 の列（治験のゲート）が返る。
   DB は `REG0` 形式なので実害は出ていないが、呼び出し側が形式を間違えると静かに違う列で計算する。

