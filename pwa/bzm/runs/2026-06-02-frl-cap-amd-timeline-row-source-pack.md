# FRL_cap_amd timeline row source pack

作成日: 2026-06-02 JST
Owner: BZM司令塔 / frl_cap_amd timeline row source pack worker
Scope: p04 KT / p09 JC / p11 BWE / p06 CTB の AMD 関与期間 source pack と timeline row proposal

## source_pack_summary

この pack は `frl_cap_amd_historical_policy` の follow-up。目的は、current row に過去の AMD 寄与を戻さず、AMD が実際に F_capability を補完していた時点だけを timeline-specific row 候補として切ること。

DB write / DDL / extractor 実装 / score 再計算はしない。`frl_cap_amd` の値も正式決定しない。必要な箇所は `candidate_only` として扱う。

### 読んだ source

| Source | 使った事実 |
|---|---|
| `pwa/bzm/runs/2026-06-02-frl-cap-amd-historical-policy.md` | current row と historical/timeline row の分離方針。p04/p09/p11/p06 の分類。 |
| `pwa/spec/4-1-frl-ces-current-spec.md` | `frl_cap_amd = F_cap(全員) - F_cap(AMD抜き)` と、historical PJ は timeline-specific row で別途整理する現行仕様。 |
| `pwa/HANDOFF_bzm_textbook.md` | FRL_cap_amd first pass の PJ別保留理由。p06 current row 補正。 |
| `pwa/design_log/sessions_2026-05.md` #102 | live DB 確認、migration 111/112、p04/p09/p11 保留、p06 verify。 |
| `pwa/scripts/migrations/111_frl_cap_amd_active_projects.sql` | active/current row first pass の範囲と、ended/historical PJ を bulk backfill しない理由。 |
| `pwa/scripts/migrations/112_ctb_frl_cap_amd_frozen_correction.sql` | p06 CTB current row を `frl_cap=3`, `frl_cap_amd=0` に戻した正本。 |
| `pwa/design/amd_score.md` / `pwa/design/db_schema.md` | `amd_score_inputs` unique key、FRL 2レイヤー列、`project_founding_members.status` 列契約。 |
| `/Users/masa/projects/knowledge/KT.md` | KT は VC依頼型、まさ COO、経営体制構築後に AMD 関与終結、会社は active/有償展開中。 |
| `/Users/masa/projects/knowledge/jc.md` | JC は 2026-03 AMD 関与終結、会社存続。AMD は deeptech 化、野田先生接続、R&D 投資理解のリバウンド失敗。 |
| `/Users/masa/projects/knowledge/BWE.md` | BWE は 2024-04 SIP内関与開始、2025-04-28設立、まさ CEO/取りまとめ、2026-04-30退任/移譲。 |
| `/Users/masa/projects/knowledge/ctb.md` | CTB はまさ COO 参画後に一旦退任、AMED採択後は事務対応のみの軽関与。 |

## timeline_row_proposals

### p04 KT

| Field | Proposal |
|---|---|
| `relationship_state` | `support_ended_but_company_active` |
| `current_row_policy` | current row へ `frl_cap_amd` を載せない。会社の有償展開、Adam販売、シリーズA、量産/全国展開は AMD 関与終了後の company activity として扱う。 |
| `historical_row_candidate` | `candidate_only`: `row_type=amd_coo_structure_building`; `period=まさ COO 参画から経営体制が回るようになり AMD 関与終結するまで`; `evaluated_at=exact_support_end_at_missing` |
| `amd_members` | まさ |
| `amd_roles` | VC依頼による COO / 経営体制構築 |
| `evidence_sources` | `/Users/masa/projects/knowledge/KT.md`; `pwa/bzm/runs/2026-06-02-frl-cap-amd-historical-policy.md`; `pwa/design_log/sessions_2026-05.md` #102 |
| `support_end_at` / `support_end_status` | exact date missing。knowledge source は「経営体制が回るようになった後に AMD 関与終結」とする。 |
| `do_not_count_after` | AMD 関与終結後。少なくとも 2024-03 Adam販売開始、2024-05 シリーズA以降の成果を current AMD contribution として数えない。 |
| `still_missing` | COO参画開始日、COO退任/支援終了日、当時の経営体制が回ったことを示す source、当時の `amd_score_inputs.evaluated_at` として採用する日付。 |

Notes:

- KT は Textbook case としては「COO派遣型 / VC依頼型 / 体制構築後の卒業」に使える。
- current score implementation では、後続の会社成長を AMD の current `frl_cap_amd` に積まない。

### p09 JC

| Field | Proposal |
|---|---|
| `relationship_state` | `support_ended_but_company_active` |
| `current_row_policy` | current row へ `frl_cap_amd` を載せない。2026-03 以降の装置開発、JB-02A、販売準備は company activity として扱う。 |
| `historical_row_candidate` | `candidate_only`: `row_type=amd_deep_pivot_attempt`; `period=2023-XX AMD関与開始から2026-03 AMD関与終結まで`; `evaluated_at candidates=2024-01-01 deep_pivot_start / 2026-03-31 support_end_snapshot` |
| `amd_members` | まさ / うめ / きよ candidate_only |
| `amd_roles` | shallow tech 判定、deeptech 化試行、野田先生/群馬大接続、R&D 投資理解の社内調整、業務委託運用 |
| `evidence_sources` | `/Users/masa/projects/knowledge/jc.md`; `pwa/HANDOFF_bzm_textbook.md`; `pwa/design_log/sessions_2026-05.md` #102 |
| `support_end_at` / `support_end_status` | `support_end_at=2026-03`。AMD 関与終結、会社は存続。 |
| `do_not_count_after` | 2026-03 AMD関与終結後。年内MVP完成予定、JB-02A設計、装置販売前夜の進捗は current AMD contribution にしない。 |
| `still_missing` | AMD関与開始の exact date、うめ/きよの具体 role source、2024-01 / 2025-03 / 2026-03 のどの row に `frl_cap_amd` candidate を置くかの採択基準、R&D予算削減の primary source。 |

Notes:

- JC は Textbook case としては「deep_pivot 後のリバウンド失敗」「R&D投資理解が定着しないと AMD 寄与が後続成果へ接続されない」事例に使える。
- score implementation では、2026-03 以降の会社活動を AMD 寄与として過大評価しない。

### p11 BWE

| Field | Proposal |
|---|---|
| `relationship_state` | `company_active_after_amd_relationship` |
| `current_row_policy` | current row へ `frl_cap_amd` を載せない。2026-04-30 退任/移譲後の資金調達、実証、採択、受賞、メディア露出は BWE 自身の activity として扱う。 |
| `historical_row_candidate` | `candidate_only`: `row_type=studio_launch_and_ceo_transfer`; `period=2024-04 SIP内関与開始から2026-04-30退任/移譲まで`; `evaluated_at candidates=2025-04-28 founding_snapshot / 2026-04-30 transfer_snapshot` |
| `amd_members` | まさ / かず / きよ candidate_only。BWE側の まり / はる は AMDメンバーだが、row上は「卒業先経営チーム」か「AMD提供価値」かを分ける必要がある。 |
| `amd_roles` | 内閣府SIP案件の取りまとめ、まさ CEO、SU設立、CEO候補/経営チームへの移管、助成金・手続きサポート |
| `evidence_sources` | `/Users/masa/projects/knowledge/BWE.md`; `pwa/HANDOFF_bzm_textbook.md`; `pwa/design_log/sessions_2026-05.md` #102 |
| `support_end_at` / `support_end_status` | `support_end_at=2026-04-30` candidate。source上はまさ取締役退任/移譲の効力日として扱われる。 |
| `do_not_count_after` | 2026-04-30 退任/移譲後。東京都採択、メディア、受賞、プレシード完了予定などを current AMD contribution にしない。 |
| `still_missing` | まさ CEO就任/代表者期間の primary source、2026-04-30 の辞任/解任処理の確定事実、かず/きよの作業期間と F_cap 寄与に使える source、まり/はるを AMD側寄与と卒業先経営チームのどちらで扱うかのルール。 |

Notes:

- BWE は Textbook case としては「スタジオ設立、CEO移譲、卒業前カリキュラム不足、ガバナンス補助輪」の事例に使える。
- score implementation では、移譲後の会社 active 状態を current AMD active と誤読させない。

### p06 CTB

| Field | Proposal |
|---|---|
| `relationship_state` | `frozen_current_row_with_light_support` |
| `current_row_policy` | current row は維持: `frl_cap=3`, `frl_cap_amd=0`。AMED事務対応などの軽い関与は current F_capability active contribution として数えない。 |
| `historical_row_candidate` | `candidate_only`: `row_type=amd_coo_pre_amed_case`; `period=まさ COO 参画、会社体制構築 + 資金調達トライから一旦退任まで`; `evaluated_at=exact_coo_exit_at_missing` |
| `amd_members` | まさ |
| `amd_roles` | COO、会社体制構築、資金調達トライ。現在はAMED事務対応のみ。 |
| `evidence_sources` | `/Users/masa/projects/knowledge/ctb.md`; `pwa/scripts/migrations/112_ctb_frl_cap_amd_frozen_correction.sql`; `pwa/design_log/sessions_2026-05.md` #102 |
| `support_end_at` / `support_end_status` | exact COO退任日 missing。current status は frozen / current AMD active なし。 |
| `do_not_count_after` | COO退任後。AMED採択後の事務対応と大動物試験進捗を current AMD F_cap contribution にしない。 |
| `still_missing` | COO参画開始日、COO退任日、資金調達トライ期間、historical row を作るなら AMED採択前後の exact evaluated_at。 |

Notes:

- CTB は current row へ過去寄与を戻さない guardrail の代表 case。
- historical COO case は作れるが、current `frl_cap=3`, `frl_cap_amd=0` の correction を上書きする根拠にはしない。

## current_row_guardrails

1. current row は「今の経営体制」を表す。
2. p04/p09/p11 は会社が active でも、AMD 関係が終わっているため current row に `frl_cap_amd` を載せない。
3. p06 は frozen/current light support のため、current row `frl_cap=3`, `frl_cap_amd=0` を維持する。
4. 後続成果は AMD の historical contribution を消す材料ではないが、current AMD contribution に足す材料でもない。
5. timeline row は、対象時点の AMD member / role / evidence / support_end / do_not_count_after を notes に持つ。

## notes_required_fields

将来 `frl_cap_notes` または timeline row notes に最低限入れるべき fields:

| Field | Required reason |
|---|---|
| `row_type` | current / historical / transfer / support_end など、row の意味を固定する。 |
| `relationship_state` | active / support_ended / frozen / company_active_after_amd_relationship を明示する。 |
| `amd_members` | 誰の寄与かを後から検証できるようにする。 |
| `amd_roles` | F_capability を押し上げた行為を役割単位で残す。 |
| `evidence_sources` | source-first のため、knowledge/doc/DB/migration/log を列挙する。 |
| `support_start_at` | AMD関与期間の始点。missingなら `missing` と書く。 |
| `support_end_at` / `support_end_status` | current row へ混入させないための終点。 |
| `do_not_count_after` | 後続成果を current AMD contribution にしない境界。 |
| `candidate_status` | `candidate_only` / `reviewed` / `adopted` など。今回 pack はすべて `candidate_only`。 |
| `still_missing` | 推測で埋めないための不足リスト。 |

## textbook_case_boundary

Textbook では、今回の4件を「AMD の価値を過大評価せず、消しもしない」境界例として使える。

| Case | Textbook use | Boundary |
|---|---|---|
| KT | COO派遣型、VC依頼型、体制構築後の卒業 | 有償展開/シリーズAを current AMD寄与にしない。 |
| JC | deep_pivot 後のリバウンド失敗、R&D投資理解の失敗 | 野田先生接続や deep化試行と、2026-03後の会社活動を分ける。 |
| BWE | スタジオ設立、CEO移譲、卒業前カリキュラム不足 | 2026-04-30後の会社 active を AMD current active にしない。 |
| CTB | frozen / light support / current row guardrail | 過去COO寄与を current row へ戻さない。 |

## do_not_use_as

この pack を以下として使ってはいけない。

- `frl_cap_amd` の正式値。
- 0-9 score 表。
- R_net 値付け。
- PRS 正式採用根拠。
- 現行 7 軸 AMD Score の置換根拠。
- 過去 score 再計算の migration 仕様。
- DB schema / DDL / extractor 実装仕様。
- p04/p09/p11/p06 の current row に過去 AMD 寄与を戻す根拠。
- public-facing proof。内部 knowledge とまさ口述を含むため、公開利用時は別途 source sanitization が必要。

## next_worker_candidates

1. `frl_cap_amd_notes_rubric_guard`
   - 今回の `notes_required_fields` をもとに、timeline row notes の標準テンプレを作る。
   - DB writeなし。schema化する場合は別worker。

2. `frl_cap_amd_timeline_date_source_lookup`
   - KT / CTB の COO参画開始・終了日、JC の AMD関与開始日、BWE の代表/退任 primary source を read-only で埋める。
   - Gmail/Drive/登記/公開sourceを使う場合は private/public boundary を分ける。

3. `textbook_case_boundary_pack`
   - KT / JC / BWE / CTB を Textbook case として使う際の public-safe narrative と internal-only evidence を分離する。

4. `os_score_implementation_design_only`
   - timeline row の select policy、current row guard、notes template、UI表示方針だけを設計する。
   - migration / DB write / extractor / deploy は禁止のまま。
