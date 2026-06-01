# FRL_cap_amd notes rubric guard

作成日: 2026-06-02 JST
Owner: BZM司令塔 / frl_cap_amd notes rubric guard worker
Scope: `frl_cap_notes` / timeline row notes の標準テンプレ、confidence / source boundary / candidate status guard

## scope_guard

この guard は、FRL_cap_amd historical 整理で出た KT / JC / BWE / CTB の候補を、将来 `amd_score_inputs.frl_cap_notes` または timeline row notes へ入れるときの書き方を標準化するための rubric。

DB write / DDL / migration / extractor 実装 / deploy / score 再計算はしない。`frl_cap_amd` の正式値、0-9 score 表、R_net 値付け、PRS 正式採用、現行 7 軸 AMD Score 置換、過去 score 再計算には使わない。

この文書の status は `candidate_only` の notes template。`adopted_for_score` へ進めるには、別 worker で source hygiene / BZM review / OS implementation design / DB write approval が必要。

## notes_required_fields

`frl_cap_notes` は現行 DB では `text` だが、将来の機械処理と人間レビューのため、最低限この key-value 形を保つ。

```text
row_type:
candidate_status:
relationship_state:
evaluated_at_basis:
support_start_at:
support_start_status:
support_end_at:
support_end_status:
do_not_count_after:
amd_members:
amd_roles:
f_capability_mechanism:
evidence_sources:
private_public_boundary:
date_source_status:
confidence:
source_conflicts:
db_hygiene_issues:
still_missing:
do_not_infer:
review_owner:
reviewed_at:
```

Required field intent:

| Field | Required reason |
|---|---|
| `row_type` | current row / historical timeline / support end / transfer / light support boundary など、row の意味を固定する。 |
| `candidate_status` | 候補・レビュー済み候補・score採用済みを混同しない。今回の4件は `candidate_only`。 |
| `relationship_state` | current row へ過去AMD寄与を戻さないため、AMDとの現在関係を明示する。 |
| `evaluated_at_basis` | `evaluated_at` に置く日付が exact date か、月次anchorか、snapshot候補かを明示する。 |
| `support_start_at` / `support_start_status` | AMD関与期間の始点。missing / conflicting を隠さない。 |
| `support_end_at` / `support_end_status` | 関与終了後成果を current AMD contribution に混ぜない境界。 |
| `do_not_count_after` | 後続成果を `frl_cap_amd` に足さない日付・条件。必須。 |
| `amd_members` | AMD側寄与者。卒業先経営チームと混同しない。 |
| `amd_roles` | F_capability を押し上げた role / action。肩書きだけでなく実行内容を書く。 |
| `f_capability_mechanism` | どの経営実行力を補ったのか。例: COO体制構築、資金調達推進、CEO移譲、研究者接続。 |
| `evidence_sources` | source-first のため、path / source id / public URL / migration id を列挙する。 |
| `private_public_boundary` | internal/private/public を分け、公開利用できる証跡を誤認しない。 |
| `date_source_status` | exact / month-level / candidate / missing / conflicting / DB hygiene issue を明示する。 |
| `confidence` | date / role / mechanism / boundary の確信度を vocabulary で書く。 |
| `source_conflicts` | source間衝突を隠さない。空なら `none_observed`。 |
| `db_hygiene_issues` | DB row が source と衝突している場合、score根拠に使わず hygiene handoff に回す。 |
| `still_missing` | 推測で埋めないための不足source。 |
| `do_not_infer` | 後続成果や公開ページから逆算してはいけないこと。 |
| `review_owner` / `reviewed_at` | `reviewed_candidate` 以上へ進める場合だけ必須。未レビューは `none`。 |

## confidence_vocabulary

| Value | Meaning | Use |
|---|---|---|
| `high` | primary-like source または public + internal が一致し、date/role/boundary が安定。 | BWE 2025-04-28 founding snapshot など。 |
| `medium` | 複数sourceで方向は一致するが、exact date / legal effective date / role範囲に未確定がある。 | JC 2026-03 support end month、CTB AMED light support boundary など。 |
| `low_to_medium` | internal DB anchor はあるが primary source ではない。 | KT `projects.start_ym=202304`、CTB `projects.start_ym=202306` など。 |
| `low` | internal narrative のみ、または exact source が不足。 | KT support end / structure completion など。 |
| `conflicting` | source間で日付・代表者・開始時点が衝突。 | JC start date、BWE representative transition、DB stale dates。 |
| `missing` | source不足。推測禁止。 | KT support end exact date、CTB COO exit exact date。 |

Confidence は `row_confidence` ひとつで丸めず、可能なら `date_confidence`, `role_confidence`, `boundary_confidence` に分ける。

## date_source_status_vocabulary

| Value | Meaning |
|---|---|
| `exact_public_source` | 公開sourceで exact date が確認できる。 |
| `exact_private_primary_like` | Gmail / SmartRound / Drive 等の private primary-like source で exact date が確認できる。公開利用前に sanitization 必須。 |
| `month_level_only` | `YYYY-MM` までは確認できるが日付未確定。 |
| `internal_anchor_only` | `projects.start_ym` など内部DB anchor。役職就任・契約開始の exact proof ではない。 |
| `candidate_snapshot` | timeline row の候補日。正式採用ではない。 |
| `exact_date_missing` | exact date がない。推測で埋めない。 |
| `source_conflict` | source間で日付が衝突。 |
| `db_hygiene_issue` | DB row が public/internal source と衝突しており、score根拠に使わない。 |

## relationship_state_vocabulary

| Value | Meaning | Current row guard |
|---|---|---|
| `active_amd_support` | 現在も AMD が経営実行力を active に補完している。 | current row に載せる余地あり。 |
| `pre_company_active_amd_support` | 設立前/設立準備中で AMD が active に補完している。 | current row に載せる余地あり、設立時 timeline 分割候補。 |
| `support_ended_but_company_active` | AMD関与は終わったが会社は active。 | current row に過去 `frl_cap_amd` を載せない。 |
| `company_active_after_amd_relationship` | AMD関係終了後も会社が自走・活動中。 | 後続成果を current AMD contribution にしない。 |
| `frozen_current_row_with_light_support` | PJは frozen / 軽関与のみ。 | current `frl_cap_amd` を active contribution として戻さない。 |
| `historical_case_only` | Textbook / BZM internal case としては有用だが score採用未満。 | DB score値に使わない。 |

`relationship_state` は必須。空欄のまま notes を残すと、current row と historical row の混同が起きる。

## private_public_boundary

| Source posture | Write in notes | Do not write in notes |
|---|---|---|
| `public` | URL、公開文書名、確認した事実、取得日。 | 公開sourceだけで未確認の内部関係を断定しない。 |
| `internal_knowledge` | path、要約、internal-only であること。 | まさ口述や個人情報を public proof として扱わない。 |
| `live_db_readonly` | table/column/key、read-only確認、衝突の有無。 | DB値を source conflict 無視で exact truth にしない。 |
| `private_source` | source id / thread id / file id、短い事実ラベル、private sanitization required。 | 本文全文、メール本文の長引用、秘密値、添付内容の詳細。 |

Public use rule:

- Textbook public layer に使う場合は、`public` source だけで成立する narrative に書き直す。
- `private_source` / `internal_knowledge` は、BZM internal review と source hygiene 用。公開原稿の proof へ直結させない。
- public source と private source が衝突する場合は、`public_source_conflict` と書き、どちらかを勝手に上書きしない。

## candidate_status_vocabulary

| Status | Meaning | Allowed use |
|---|---|---|
| `candidate_only` | source pack / lookup / notes guard 上の候補。未採用。 | BZM internal review、次workerへの引き継ぎ、missing/source conflict の可視化。 |
| `reviewed_candidate` | BZM司令塔または指定reviewerが、source boundary / missing / conflict を確認した候補。 | OS implementation design の入力にできる。まだ DB write / score採用ではない。 |
| `adopted_for_score` | OS側実装判断、DB write approval、migration/API適用、検証が揃った score採用済み row。 | AMD Score計算に使える。今回の作業では到達禁止。 |

Guard:

- `candidate_only` は `frl_cap_amd` 値を正式に持たない。値を置く場合も `value_candidate` と明記する。
- `reviewed_candidate` は「採用」ではない。`adopted_for_score=false` を明記する。
- `adopted_for_score` に進めるには、source conflict 解消、private/public boundary、current row guard、CTB correction guard、DB hygiene issue の扱いがすべて解決済みであること。

## notes_writing_patterns

### exact date missing

```text
date_source_status=exact_date_missing;
support_end_at=missing;
confidence=low;
still_missing=COO退任日/契約終了日/board source;
do_not_infer=public outcome date or later financing date cannot be used as support_end_at;
candidate_status=candidate_only
```

### source conflict

```text
date_source_status=source_conflict;
source_conflicts=projects.start_ym=202312 vs project_knowledge.AMD参画開始日=2025-11-01 vs knowledge=2023-XX;
recommended_action=send_to_db_hygiene_review;
candidate_status=candidate_only;
do_not_infer=do not adopt any one date as exact support_start_at without primary source
```

### private source

```text
private_public_boundary=private_source;
evidence_sources=Gmail thread/message ids only;
public_sanitization_required=true;
confidence=high_for_event_medium_for_legal_effective_date;
do_not_quote=message body or attachments;
candidate_status=candidate_only
```

### public source

```text
private_public_boundary=public;
evidence_sources=public URL + document title + fact label;
confidence=high if public source matches internal source;
do_not_infer=public profile current display cannot settle historical transition date if conflicting sources exist
```

### DB hygiene issue

```text
date_source_status=db_hygiene_issue;
db_hygiene_issues=project_ventures.founded_at conflicts with public/knowledge source;
score_use=false;
recommended_action=OS/DB hygiene handoff;
candidate_status=candidate_only;
do_not_infer=do not use conflicting DB date as timeline evaluated_at
```

## project_notes_examples

These are short examples for future notes. They are not DB payloads and are not score adoption.

### p04 KT

```text
row_type=amd_coo_structure_building;
candidate_status=candidate_only;
relationship_state=support_ended_but_company_active;
evaluated_at_basis=support_start_anchor_only;
support_start_at=2023-04 anchor from projects.start_ym, not exact COO appointment;
support_start_status=internal_anchor_only;
support_end_at=missing;
support_end_status=exact_date_missing;
do_not_count_after=AMD関与終結後。Adam販売/Series A/有償展開を current AMD contribution にしない;
amd_members=まさ;
amd_roles=VC依頼によるCOO/経営体制構築;
evidence_sources=knowledge/KT.md; frl-cap-amd timeline source pack; design_log #102;
private_public_boundary=internal_knowledge + live_db_readonly;
date_source_status=exact_date_missing;
confidence=low_to_medium for start anchor, low for support end;
still_missing=COO appointment/退任/支援終了 primary source;
do_not_infer=post-AMD company outcomes are not support end proof
```

### p09 JC

```text
row_type=amd_deep_pivot_attempt / support_end_snapshot;
candidate_status=candidate_only;
relationship_state=support_ended_but_company_active;
evaluated_at_basis=2024-01 deep_pivot_start candidate and 2026-03-31 support_end_snapshot candidate;
support_start_at=conflicting: projects.start_ym=202312, project_members.join_ym=202312, project_knowledge=2025-11-01, knowledge=2023-XX;
support_start_status=source_conflict;
support_end_at=2026-03 month-level, exact day missing;
support_end_status=month_level_only;
do_not_count_after=2026-03 AMD関与終結後。JB-02A/販売準備/年内MVP予定を current AMD contribution にしない;
amd_members=まさ; うめ/きよ candidate_only;
amd_roles=deeptech化試行, 野田先生/群馬大接続, R&D投資理解の社内調整;
evidence_sources=knowledge/jc.md; source_cache p09 private ids; live projects/project_members/project_knowledge;
private_public_boundary=internal_knowledge + private_source + live_db_readonly;
date_source_status=source_conflict for start, month_level_only for end;
confidence=medium for 2026-03 end month, low/conflicting for start;
db_hygiene_issues=project_knowledge AMD参画開始日 2025-11-01 may be backfill/hygiene issue;
do_not_infer=do not classify 野田先生 as JC employee or AMD member
```

### p11 BWE

```text
row_type=studio_launch_and_ceo_transfer;
candidate_status=candidate_only;
relationship_state=company_active_after_amd_relationship;
evaluated_at_basis=2025-04-28 founding_snapshot public high; 2026-04-30 transfer candidate with 2026-05-09 governance confirmation;
support_start_at=2024-04-01 SIP/AMD support start anchor;
support_start_status=internal_anchor_only;
support_end_at=2026-04-30 candidate; governance_confirmation_at=2026-05-09;
support_end_status=exact_private_primary_like for GM/stock transfer, medium for legal effective resignation date;
do_not_count_after=2026-04-30 transfer/retirement candidate。退任/移譲後の採択/受賞/資金調達/メディアを current AMD contribution にしない;
amd_members=まさ/かず/きよ candidate_only;
amd_roles=SIP取りまとめ, まさCEO/代表, SU設立, CEO候補/経営チーム移管, 手続き支援;
evidence_sources=knowledge/BWE.md; public BWE PDF; Gmail/SmartRound private ids; source_cache p11;
private_public_boundary=public + private_source + internal_knowledge;
date_source_status=exact_public_source for founding, exact_private_primary_like plus legal-effective-date-missing for transfer;
confidence=high for founding, high for governance event, medium for legal effective date;
source_conflicts=public page/company profile still shows 山地 while official core member/private sources show 吉﨑 transition;
db_hygiene_issues=project_ventures.founded_at=2019-04-01 and amd_support_started_at=2026-02-01 conflict with source pack;
do_not_infer=do not count まり/はる as AMD-side frl_cap_amd after transfer merely because they are AMD members
```

### p06 CTB

```text
row_type=amd_coo_pre_amed_case / amed_light_support_boundary;
candidate_status=candidate_only;
relationship_state=frozen_current_row_with_light_support;
evaluated_at_basis=2023-06 support anchor only; 2024-12-27 AMED adoption public anchor; 2025-01/2025-02 light support boundary candidates;
support_start_at=2023-06-01 internal support anchor, not exact COO appointment;
support_start_status=internal_anchor_only;
support_end_at=missing for COO exit;
support_end_status=exact_date_missing;
do_not_count_after=COO退任後。AMED事務対応/大動物試験進捗を current F_capability active contribution にしない;
amd_members=まさ;
amd_roles=COO, 会社体制構築, 資金調達トライ; after AMED only office/admin support;
evidence_sources=knowledge/ctb.md; migration 112; CTB public AMED news; monthly_reports 2025-01/2025-02;
private_public_boundary=internal_knowledge + public + live_db_readonly;
date_source_status=exact_date_missing for COO exit, exact_public_source for AMED adoption;
confidence=medium for support anchor, low for COO exact, high/medium for light support boundary;
db_hygiene_issues=project_ventures.founded_at conflicts with CTB official founding date, but not used for AMD support date;
do_not_infer=do not treat AMED事務対応 as current active COO/F_cap contribution
```

## do_not_use_as

この guard を以下として使ってはいけない。

- `frl_cap_amd` の正式値。
- 0-9 score 表。
- R_net 値付け。
- PRS 正式採用根拠。
- 現行 7 軸 AMD Score の置換根拠。
- 過去 score 再計算の migration 仕様。
- DB schema / DDL / extractor 実装仕様。
- p04/p09/p11/p06 の current row に過去 AMD 寄与を戻す根拠。
- CTB current correction (`frl_cap=3`, `frl_cap_amd=0`) を上書きする根拠。
- public-facing proof without source sanitization.

## review_gate_before_any_score_use

`candidate_only` から先へ進める場合、最低限この gate を満たす。

1. `relationship_state` と `do_not_count_after` が notes にある。
2. exact date missing / source conflict / private source / public source / DB hygiene issue が隠されていない。
3. current row と historical/timeline row の境界が明記されている。
4. CTB current correction を上書きしていない。
5. Textbook case narrative と score implementation が混ざっていない。
6. private/internal source を public proof として扱っていない。
7. `adopted_for_score` へ進む場合は、別途 OS側実装判断と DB write approval がある。

## next_worker_candidates

1. `frl_cap_amd_source_hygiene_followup`
   - KT / CTB の exact support dates、JC start conflict、BWE legal effective date を source-first で追加確認する。
   - DB writeなし。private/public boundary を維持。

2. `frl_cap_amd_db_hygiene_handoff`
   - JC `project_knowledge` start date、BWE `project_ventures` stale dates、CTB founding date conflict を OS/DB hygiene 向けに整理する。
   - correction 実施は別判断。

3. `frl_cap_amd_timeline_row_design_only`
   - `amd_score_inputs` timeline row を将来使う場合の select policy / notes persistence / UI表示方針だけを設計する。
   - migration / API / deploy は禁止。

4. `textbook_case_boundary_public_safe`
   - KT / JC / BWE / CTB を public manuscript / Textbook case にする場合の public-safe narrative と internal-only evidence の分離案を作る。
