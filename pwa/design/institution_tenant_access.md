# Institution Tenant / Access Design

作成日: 2026-05-31
ステータス: Design draft for NIMS Pilot gate. 実装はまだしない。
対象: NIMS / 外部研究機関へ AMD OS を見せる前に必要な tenant, institution scope, role, RLS/API guard, audit log 設計。

## Executive summary

NIMS Pilot は、現行 AMD OS をそのまま社外公開する話ではない。現行 OS は AMD 内部運用を前提に、Gmail / Drive / Calendar / Slack / Notion から L2 データを抽出し、Supabase を正本にしている。したがって、NIMS に見せるには、まず「どの institution / project / workspace に属する外部ユーザーが、どの row / column / file / notification を見てよいか」を DB / API / UI の前に確定する必要がある。

本設計の方針は以下。

1. `institution_id` は外部機関スコープの基準。`project_id` は業務・PJ単位の基準。NIMS tenant は CX `p20` と同一ではない。
2. 初期実装は「single Supabase project + row / API scoped multi-tenant」で始める。tenant ごとに DB を分ける設計は Phase 2 以降。
3. 外部ユーザーは Supabase の raw table を直接広く読まない。PWA API / scoped view / RLS で列と行を絞る。
4. NIMS データを他機関営業、ERS 比較、Before Zero 教科書、cross-institution benchmark に使う場合は、匿名化、明示許諾、契約条項、audit trail が必須。
5. LLM / automation / service_role は外部機関権限を bypass できるが、bypass した処理は audit log に残し、外部公開用 artifact へ直接流さない。
6. NIMS Pilot の minimum safe configuration は、外部ユーザー 1-3 名、`institution_id='nims'`、scoped project は CX `p20` + NIMS pilot seeds だけ、外部編集は candidate / comment / evidence proposal に限定する。

## Why tenant/access design is required before NIMS Pilot

### Current truth

- AMD OS の正本は Supabase。5 生データから M/W/D/H L2へ抽出し、候補は `/notifications` の採否ゲートを通して正本反映する。
- 現行マニュアルでは AMD OS は社内専用で、SU 側メンバーや外部ユーザーは使わない前提。
- NIMS 導入ゲート文書では、NIMS workspace / institution scope / row-level policy / external user role の設計が導入開始前の不足領域として残っている。
- `institutions`, `institution_assessments`, `institution_policy_*` は既にあるが、外部ユーザー向けの tenant membership / project scope / audit log は未実装。
- `projects` には現時点で `institution_id` がない。機関と PJ の関係は knowledge docs / ERS / seeds / project context で整理されているが、DB 上の権限スコープとしてはまだ固定されていない。

### Risk if skipped

| risk | 起きること |
|---|---|
| AMD internal leak | 報酬、請求、他PJ、他機関、Slack/Gmail snippet、内部Protocolが NIMS 側に見える |
| NIMS data misuse | NIMS由来のシーズ、会議、ERSギャップを許諾なしに他機関営業・教科書・比較に使う |
| CX confusion | CX `p20` のPJ運用と NIMS institution tenant を同一視し、法人設立準備データと機関導入データが混ざる |
| audit gap | 誰が見た、編集した、export した、service_role が触った、を後から説明できない |
| automation spillover | proactive outbox / L2 outbox が外部機関 data を AMD 内部司令塔や別PJ thread へ誤送信する |

## Scope: external institution users vs AMD internal users

### External institution users

外部機関ユーザーは、研究機関の URA / EIR / 準備責任者 / readonly observer を想定する。NIMS Pilot では「NIMS側準備責任者 + URA/EIR 1-3名」から始める。

許可すること:

- 自機関 tenant のダッシュボード閲覧。
- 自機関に scoped された PJ / seeds / ERS / monthly review artifact の閲覧。
- candidate comment、ERS evidence proposal、seed status proposal、monthly review comment の投稿。
- 契約で許された範囲の export request。

許可しないこと:

- AMD 全PJ横断 cockpit の閲覧。
- 報酬、請求、freee、payout、内部人事、他機関情報の閲覧。
- Slack / Gmail / Notion / Drive raw source 全文の閲覧。
- 正本 DB への直接反映。外部編集は candidate 化し、AMD確認を通す。
- service_role / admin API / cron route の使用。

### AMD internal users

AMD internal users は既存 admin / member 運用を維持する。ただし外部機関データに触る場合は、内部ユーザーでも `institution_id` と `project_id` を audit log に残す。

AMD internal の権限は広いが、外部機関向け公開 artifact を生成する時は「外部公開フィルタ」を通す。内部で見えるから外部に出してよい、ではない。

## Data classification

### AMD internal only

AMD 社内の判断・経理・人事・報酬・他PJ横断情報。外部機関ユーザーには原則不可視。

例:

- `billing_cycles`, `billing_log`, payout / reward / freee 系 table。
- `members`, `project_members` の内部役割・報酬に関わる情報。
- AMD internal note、`internal_notes`, `source_path`, `report_emails`, `invoice_*`。
- strategy / protocol のうち AMD の営業戦略、他機関比較、未公開の交渉メモ。
- proactive outbox の `risk_if_late`, `recommended_first_move` の内部戦略部分。

### Institution-visible

対象 institution と契約上共有できる、または月次レビューで提示する前提の情報。

例:

- 自機関 master: `institutions` の自機関 row の基本情報。
- 自機関 ERS summary: `institution_assessments` の評価結果と、共有可能な根拠メモ。
- scoped PJ summary: CX `p20` の外部向け project summary / status / monthly review。
- scoped seeds: NIMS 由来・NIMS と共有可のシーズ概要。
- NIMS向けに承認済みの monthly review artifact / meeting summary narrative。
- universal protocol のうち匿名化・一般化済みのもの。

### Institution-editable candidate

外部ユーザーが直接正本を書かず、候補として出せる情報。AMD が確認してから正本反映する。

例:

- ERS evidence proposal: 制度資料 URL、ヒアリング補足、評価へのコメント。
- seed proposal: 追加シーズ候補、PI情報、公開可否、次アクション案。
- monthly review comment: 月次レポートへの補足、修正依頼。
- meeting summary correction: 議事録の誤り指摘。
- proactive action comment: 外部ユーザーが実施済み / 保留 / 追加情報を返す場合のコメント。

### Anonymized/cross-institution reusable

契約・許諾・匿名化を満たした後にだけ、他機関比較、ERS benchmark、Before Zero 教科書、営業資料へ再利用できる情報。

条件:

- institution / person / project / technology の直接識別子を外す。
- 小集団で再識別可能な固有事情を丸める。
- 契約または個別同意で「匿名化した知見の再利用」を明記する。
- audit log に reuse decision / approver / artifact を残す。

### Never share

外部機関にも、匿名化再利用にも出さない情報。

例:

- メール全文、Slack全文、Notion全文、Drive添付の未承認全文。
- 個人情報、採用・報酬・健康・家庭事情。
- 他機関の未公開資料、契約条件、政治メモ。
- AMD の価格交渉、営業戦略、内部評価、競合比較の生メモ。
- NIMS が明示的に非公開指定した資料・シーズ・PI情報。

## Role model

| role | 主体 | 基本権限 |
|---|---|---|
| `amd_admin` | AMD 管理者 | 全体管理、tenant scope 設定、role 付与、audit review、final approve |
| `amd_pm` | AMD PJ担当 | 担当 project / institution の閲覧、candidate review、monthly artifact 作成、外部共有準備 |
| `institution_owner` | 機関側責任者 | 自機関 workspace の閲覧、member 招待申請、export request、candidate 作成 |
| `institution_member` | 機関側実務者 | 自機関の scoped project / seeds / ERS 閲覧、candidate/comment 作成 |
| `institution_readonly` | 機関側閲覧者 | 自機関の承認済み artifact の閲覧のみ。コメント不可または限定 |
| `service_role` / `automation` | server / LaunchAgent / Codex automation | DB/API 処理用 bypass。外部公開データ生成時は必ず scoped guard + audit |

### Suggested membership tables

実装 worker への提案。列名は未実装なので inferred。

```text
institution_user_roles
  id
  institution_id
  user_id or auth_email
  role
  status
  invited_by
  approved_by
  created_at
  updated_at

project_institution_scopes
  id
  institution_id
  project_id
  scope_kind: pilot | owned | shared | reference
  visibility_status: active | paused | revoked
  visible_from
  visible_until
  approved_by
  notes
```

`project_institution_scopes` を置く理由は、CX `p20` のように「NIMS起点PJだが、NIMS tenant そのものではない」関係を明示するため。将来、1 PJ が複数 institution と関係する可能性も残す。

## Institution scope model

### `institution_id`

`institution_id` は外部機関スコープの基準。既存 `institutions.institution_id` があるので、NIMS はまず `nims` など安定 ID を割り当てる。

使い道:

- 外部ユーザー membership。
- ERS / policy assessment / seeds / project scope / proactive outbox の row scope。
- audit log の対象 institution。
- data export / deletion / offboarding の単位。

### `project_id`

`project_id` は AMD OS の既存PJ単位。CX は `p20`。ただし `project_id='p20'` は CX の法人設立準備・事業化 PJ であり、NIMS institution tenant と同一ではない。

設計ルール:

- 外部表示は `institution_id + project_id` の scope mapping を通す。
- `projects` に直接 `institution_id` を1個だけ持たせるより、初期は mapping table を推奨する。
- 外部ユーザーが見える project fields は scoped API で限定する。

### Workspace / tenant concept

初期の tenant は物理DB分離ではなく、logical workspace として扱う。

```text
workspace = institution tenant view
  institution_id
  allowed project_id list
  allowed seeds list or org_name filter
  allowed ERS rows
  allowed file/link refs
  role membership
  export/offboarding policy
```

将来、契約規模・法務要求・機密度が上がった場合は、tenant 別 Supabase project / schema 分離を検討する。ただし NIMS Pilot は logical tenant で十分。ただし RLS と API guard が完成していることが条件。

### CX as initial use case but not equal to NIMS tenant

CX `p20` は NIMS Pilot の最小ユースケースだが、次のものは分ける。

| concept | scope |
|---|---|
| NIMS tenant | NIMS 機関ユーザー、NIMS ERS、NIMS seeds、NIMS向け月次レビュー |
| CX project | CryoX 法人設立準備、CX 月次、CX MTG、CX strategy signals |
| NIMS pilot seeds | CX以外の NIMS内シーズ 3-5件。PJ化前は `seeds`、PJ化後に `projects` |
| AMD internal CX data | AMD の社内判断、資金調達、CEO候補、価格・契約、他PJ比較 |

## Table-by-table initial visibility matrix

Legend:

- `internal`: AMD internal only.
- `visible`: institution-visible after scope guard.
- `candidate`: institution-editable candidate, AMD approve required.
- `anonymized`: reusable only after anonymization / consent.
- `never`: never share.

| table / area | external visibility | external edit | guard / notes |
|---|---|---|---|
| `projects` | `visible` for scoped projects only | no direct edit | expose limited fields: `project_id`, public/display name, status summary, start/end if approved. Hide fee, invoice, report emails, Slack/Drive IDs, internal category notes. |
| `institutions` | own institution `visible`; other institutions only if public benchmark approved | no direct edit | external users see own row. Cross-institution list is anonymized or aggregated unless explicitly public. |
| `institution_assessments` | own ERS result `visible` | `candidate` via proposal | raw `note` may contain internal hearing. Split public note vs internal note before external read. |
| ERS policy: `institution_policy_items` | `visible` as rubric/master | no direct edit | master can be globally readable if it contains no internal note. |
| ERS policy: `institution_policy_assessments` | own institution `visible` with redaction | `candidate` via evidence proposal | Current RLS is admin-only because `source_path` / hearing evidence may be internal. External view must hide `source_path` and internal evidence. |
| `seeds` | scoped NIMS seeds `visible` with `public_summary`; AMD-wide seed list internal | `candidate` via seed proposal | `internal_notes`, `amd_rating_note`, owner, source_detail are internal unless explicitly approved. |
| `seed_contact_log`, `seed_funding`, `seed_news` | selected rows `visible` if tied to scoped seed and approved | candidate comment only | contact history can leak AMD relationship strategy. Default internal. |
| `monthly_reports` | scoped project + approved month `visible` | comment / correction candidate | `draft_content` internal until approved for external. `final_content` for scoped project can be visible if sanitized. Never expose source checklist raw details that include other connectors. |
| `project_meeting_summaries` | scoped meetings `visible` after AMD approval | correction candidate | show `narrative_md` / `summary_short` sanitized. Hide raw source refs, Gmail thread IDs, private attachments unless approved. |
| `meeting_assets` / files | selected approved attachments only | upload proposal if enabled | use signed URL / Storage scope. Never expose raw Drive folder ID as broad access. |
| `protocols` | universal sanitized protocols `visible`; scoped project examples optional | no direct edit; comment candidate | project-specific internal protocols hidden unless selected for NIMS learning. Cross-institution reuse requires anonymization. |
| `protocol_examples` | scoped examples `visible` if approved | no direct edit | examples often contain named parties; sanitize before external view. |
| `project_knowledge` | scoped `active` facts only if approved | correction candidate | many facts are internal; default hide until category allowlist exists. |
| `project_strategy_signals` | limited scoped summary if part of monthly review | no direct edit; comment candidate | strategy signals are mostly internal. External view should show only "shared next action" subset, not AMD internal impact/risk. |
| `l2_notifications` / `/notifications` | internal only for Phase 1 | no | current route is admin-only. Do not expose AMD notification inbox to institution users. Build institution-specific review queue if needed. |
| `proactive_outbox` | internal only by default | external comment only via separate surface | outbox routes to commander threads and contains AMD first-move strategy. If institution response is needed, expose a derived action request, not raw outbox row. |
| `project_commander_threads` | never | no | thread IDs are internal operational mapping. |
| `proactive_loop_events` | internal audit; external SLA summary optional | no | raw events can reveal internal delays / routing. External SLA report must be summarized. |
| `source_cache` | never raw; short approved snippet only | no | source refs/hash can point to Gmail/Slack/Drive. Use only server-side evidence resolution. |
| billing / payout / finance tables | never | no | includes AMD economic terms and member rewards. |
| member tables | limited contact display only if approved | no | `members` / `member_knowledge` are AMD internal. External view can show AMD担当名 from a curated profile table if needed. |

## RLS/API guard strategy

### Design principles

1. Default deny for external users.
2. External read must pass both `institution_id` membership and row scope.
3. External write must create candidate rows, not directly mutate operational truth.
4. Sensitive columns are hidden at API/view layer even when row is visible.
5. `service_role` is server-only. It can bypass RLS for jobs, but must write audit logs when reading/writing institution-scoped data.
6. RLS protects raw table access; API guard protects business rules and column filtering. Both are required.

### Auth claims and helpers

実装 worker への提案。

```text
amd_os_current_user_role()
amd_os_current_user_institution_ids()
amd_os_can_access_institution(institution_id)
amd_os_can_access_project(project_id)
amd_os_is_amd_internal()
amd_os_is_external_institution_user()
```

Supabase JWT に custom claims を入れるか、`auth.uid()` / email から `institution_user_roles` を引く。初期は server route で membership を解決し、RLS helper は後追いでもよい。ただし raw table を client direct fetch する外部画面は作らない。

### API route pattern

```text
GET /api/institution-workspace
  session required
  resolve role + institution_id
  fetch scoped data with service role
  redact columns
  audit read

POST /api/institution-candidates
  session required
  validate role can propose
  insert candidate/proposal
  notify amd_admin / amd_pm
  audit write
```

### RLS pattern

RLS は最低限以下の分類を持つ。

| table class | RLS |
|---|---|
| admin/internal tables | `is_admin()` only + service_role |
| institution-owned rows | `institution_id IN current_user_institution_ids()` for selected roles |
| project-scoped rows | exists `project_institution_scopes` active mapping for user institution |
| candidate proposal tables | insert allowed for `institution_owner/member`, select own proposals |
| audit logs | insert via service_role/API; select admin only. Institution-facing audit summaryは別view |

既存 `institution_policy_assessments` は admin-only が current truth。外部に直接開けず、redacted API / view を作る。

## Audit log requirements

外部機関導入では、閲覧・編集・export・automation bypass を追えることが必須。

### Suggested table

```text
institution_access_audit_logs
  audit_id
  occurred_at
  actor_kind: amd_user | institution_user | service_role | automation
  actor_id
  actor_role
  institution_id
  project_id
  action: read | list | create_candidate | update_candidate | approve | reject | export | delete_request | role_change | service_read | service_write
  resource_type
  resource_id
  route_or_job
  purpose
  metadata_json
  ip_hash / user_agent_hash if available
```

### Must log

- 外部ユーザーの login / workspace open / major artifact read。
- monthly report / meeting summary / seed / ERS の閲覧。
- candidate 作成・修正・削除。
- AMD による candidate approve / reject。
- export request / export file generation / download。
- role grant / revoke / invitation。
- service_role / automation が institution-scoped data を読んだ・書いた。
- cross-institution anonymized reuse decision。
- offboarding deletion / retention action。

### Retention

NIMS Pilot は最低 2 年保持を推奨。契約やセキュリティ要件で延長。audit log は外部ユーザーに raw 開示せず、必要に応じて月次 summary を出す。

## Data export / deletion / contract offboarding

### Export

外部機関の export は role + contract scope で制御する。

| export type | allowed for | content |
|---|---|---|
| monthly review PDF / doc | `institution_owner`, approved `institution_member` | approved monthly reports, meeting narrative, next actions |
| ERS snapshot | `institution_owner` | own ERS score, public rubric, approved evidence summary |
| seed list | `institution_owner/member` | own scoped seeds, public_summary, status, next action |
| audit summary | `institution_owner` by request | access summary, not raw internal logs |

Export artifact must record `exported_by`, `approved_by`, `institution_id`, `project_id`, `content_hash`, `created_at`.

### Deletion / retention

NIMSデータは3分類する。

| class | offboarding treatment |
|---|---|
| institution-owned input | contractに従って返却、削除、または閲覧停止。削除は audit log に残す |
| AMD-created derivative | 契約に従う。匿名化済みなら保持可、未匿名なら停止または削除 |
| AMD internal operations | AMD の正当な記録として保持。ただし NIMS raw data を含む場合は契約に従う |

### Contract offboarding checklist

1. user roles revoke。
2. signed links / exported artifact access revoke。
3. scoped project / seed / ERS visibility pause。
4. pending candidates close or hand back。
5. NIMS data reuse status review。
6. deletion / retention certificate 作成。
7. audit summary freeze。

## Proactive outbox implications

先手力 outbox は、外部機関導入で特に注意が必要。

### Current truth

- `proactive_outbox` は OS が検知した「打つべき一手」を PJ 司令塔へ渡す control layer。
- `project_commander_threads` は PJ / institution と commander thread を結ぶ案。
- outbox row には `recommended_first_move`, `risk_if_late`, `commander_thread_id`, `evidence_refs` が入りうる。

### Design implications

| item | rule |
|---|---|
| `institution_id` | proactive tables must carry institution_id when source / target belongs to an external institution |
| commander routing | NIMS-related row must route to NIMS/CX approved AMD commander thread only |
| thread mapping | `project_commander_threads` is internal-only. External users never see thread IDs |
| evidence refs | never include raw Gmail/Slack/Drive text in commander message if the commander thread may include broad participants |
| external action request | if institution response is needed, create separate redacted "institution action request" instead of exposing raw `proactive_outbox` |
| SLA reporting | external-facing SLA summary can show due / status / requested action, not AMD internal risk narrative |
| audit | every outbox row generated from NIMS data logs `service_write`; every send to commander logs `sent_to_commander` with institution_id |

### NIMS first safe rule

For NIMS Pilot, `proactive_outbox` is AMD internal only. The external institution UI may show a derived checklist such as "NIMS側確認待ち", but not raw first-move strategy.

## NIMS Pilot minimum safe configuration

### Tenant

| item | value |
|---|---|
| institution | NIMS |
| `institution_id` | `nims` recommended |
| workspace label | `NIMS Pilot Workspace` |
| initial scoped project | CX `p20` only |
| initial scoped seeds | NIMS追加シーズ 3-5件。CXとは別に `seeds` で管理 |
| initial users | `institution_owner` 1名, `institution_member` 1-2名, readonly optional |

### Visible surfaces

初期に見せてよいものだけを限定する。

1. NIMS workspace home: Pilot purpose, scoped projects, scoped seeds, ERS snapshot。
2. CX monthly review: approved monthly report + sanitized meeting summary。
3. NIMS ERS: score, rubric, approved evidence summary。
4. NIMS seeds: public summary / status / next action。
5. Candidate proposal form: ERS evidence, seed update, monthly comment。

初期に見せないもの。

- `/notifications`
- AMD全体 cockpit / p00
- 他PJ cockpit
- admin finance / payout
- raw source / source_cache
- proactive raw outbox
- project commander thread mapping

### API / DB guard acceptance criteria

NIMS Pilot GO の最低条件。

- NIMS user cannot fetch non-NIMS project by URL guess。
- NIMS user cannot see non-scoped `monthly_reports` / `project_meeting_summaries`。
- NIMS user cannot see `billing_*`, payout, finance, member internal data。
- NIMS user can create candidate but cannot directly update `projects`, `monthly_reports`, `protocols`, `project_strategy_signals`。
- service_role route logs institution-scoped reads/writes。
- admin can revoke NIMS user and signed links immediately。
- export artifact is scoped and hash logged。

## Open questions

1. NIMS の正式 `institution_id` を `nims` で固定するか。
2. 外部ユーザーの identity は Google Workspace login に寄せるか、Supabase Auth email/password / magic link にするか。
3. `projects` に `institution_id` を直接持たせるか、初期から `project_institution_scopes` を作るか。推奨は mapping table。
4. NIMS 側が編集できる範囲を「candidate only」に固定するか、一部 field は direct update を許すか。推奨は Pilot 期間 candidate only。
5. ERS の根拠メモを外部表示用 / 内部用で列分割するか、redacted view で処理するか。
6. NIMS由来データを Before Zero 教科書へ使う許諾条項を、Pilot契約に最初から入れるか、個別承認にするか。
7. proactive outbox の institution-level loop は `project_id` 必須をどう扱うか。`p00` / synthetic project / nullable project_id のどれにするか。
8. 外部機関向け export の保存先を Supabase Storage にするか、Drive にするか。
9. Offboarding 時に AMD-created derivative をどこまで削除対象にするか。
10. NIMS Pilot を CX `p20` のみで開始するか、最初から NIMS seeds 3-5件を入れるか。

## Next implementation workers

### Worker 1: DB schema / migration design

Scope:

- `institution_user_roles`
- `project_institution_scopes`
- `institution_candidate_proposals` or per-domain candidate tables
- `institution_access_audit_logs`
- optional redacted views for ERS / monthly / meetings

Must not:

- existing `db_schema.md` を手編集しない。
- `projects` の既存列や RLS を壊さない。
- NIMS data を seed する前に scope table なしで外部公開しない。

### Worker 2: API guard / auth

Scope:

- session role resolver。
- `GET /api/institution-workspace`
- `GET /api/institution-projects/:projectId`
- `POST /api/institution-candidates`
- audit log writer。
- redaction helper。

Validation:

- external NIMS user cannot access non-scoped project。
- admin / amd_pm can review candidate。
- service_role routes write audit logs。

### Worker 3: NIMS Pilot UI

Scope:

- `/institution` workspace home。
- scoped project/monthly review view。
- ERS read view + evidence proposal form。
- seed proposal/update form。
- readonly role behavior。

Non-goals:

- admin finance。
- raw notifications。
- full cockpit clone。

### Worker 4: Proactive outbox tenant guard

Scope:

- add / confirm `institution_id` propagation。
- commander routing table guard。
- external institution action request derivative surface if needed。
- audit logs for outbox created / sent。

### Worker 5: Contract / data-use appendix

Scope:

- Pilot contract appendix for OS利用権。
- data classification appendix。
- anonymized reuse consent。
- offboarding / export / deletion process。
- incident response process。

## Change log

| Date | What Changed | Why | By |
|---|---|---|---|
| 2026-05-31 | 初版作成。NIMS Pilot 前に必要な tenant / institution scope / role / RLS/API guard / audit / outbox implications を整理 | NIMS導入ゲートで外部機関向けデータ分離・権限設計が未解決だったため | えいみ |
