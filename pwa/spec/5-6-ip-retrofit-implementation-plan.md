# 特許案 retrofit 実装分解案

> **この章は何か**: AMD OS / AMDプロトコル特許案に書かれているが、現OSでは薄い機能を、DB / API / UI / automation へ安全に分解するための内部実装計画。これは設計レビューであり、この章自体は DB write / DDL / production migration / 外部送付を行わない。

## Current Truth

| 項目 | 現状 |
|---|---|
| 根拠docs | `docs/ip/2026-06-01_patent_os_gap_audit_internal.md`, `docs/ip/2026-06-01_patent_application_draft_internal.md`, `docs/ip/2026-06-01_claim_revision_internal.md` |
| 現OSの強い部分 | 5生データ -> L2候補 -> evidence metadata -> `/notifications` 承認 -> 正本反映、`protocols` + `protocol_examples` の 1:N 構造 |
| 薄い部分 | `protocol_result_observations` の実UI、outcome evidence refs、汎用system parameter governance、Before-Zero設立時期推奨、統合確認導線 |
| 禁止境界 | 実DB行、source permalink、prompt全文、few-shot、score weight / threshold / calibration、実PJ本文を保存・表示しない |
| この章の状態 | implementation plan。runtime実装・migration適用は次workerへ分割 |

## Gap Review

### 1. `protocol_result_observations` の実UI化

現OSには `protocol_result_observations` table と spec がある。列は `protocol_id`, `protocol_example_id`, `project_id`, `observed_on`, `horizon`, `valence`, `confidence`, `summary`, `evidence_source_type`, `evidence_source_id`, `evidence_url`, `created_by`, `created_at`。

ただし `/admin/protocols` の server page は `protocols`, `projects`, `protocol_examples` だけを fetch しており、outcome ledger を読んでいない。client も結果観測の追加・閲覧・同一horizonの矛盾併記を持たない。

**最初に着手すべき小単位**はここ。既存tableを使えるため、DDLなしで read-only UI -> insert UI の順に進められる。

### 2. Outcome evidence refs の強化

現tableは evidence を `evidence_source_type`, `evidence_source_id`, `evidence_url` の単一セットで持つ。請求項案の「複数異種evidence」には弱い。

選択肢は2つ。

| 案 | 内容 | 長所 | 短所 | 推奨 |
|---|---|---|---|---|
| JSON追加 | `protocol_result_observations.evidence_refs_json jsonb` を追加し、`[{source_category, role, short_basis, source_id_hash}]` を保存 | 追加table不要。UI実装が速い | refsの個別監査・RLS・検索が弱い | MVP向き |
| 中間table | `protocol_result_observation_evidence_refs` を作り、1 observation : N refs を正規化 | 監査・検索・role別表示が強い | migrationとUIが少し重い | 長期推奨 |

安全な保存範囲は `source_category`, `role`, `short_basis`, `source_id_hash` まで。実source permalink、実本文、長いsnippetは扱わない。

### 3. WS-5 generic system parameter governance

現OSには `llm_prompts`, `llm_model_config`, `amd_score_revisions`, `amd_score_alpha`, `amd_score_alpha_proposals` がある。だがこれは prompt編集UIやAMD Score寄りで、prompt / rule / config / model / workflow を横断する pending proposal -> review -> approved version にはなっていない。

推奨schema案は以下。

| table | 役割 | 秘匿境界 |
|---|---|---|
| `system_parameter_definitions` | parameterの抽象ID、種類、owner、current_version_id | prompt本文やweight値は置かない |
| `system_parameter_versions` | approved versionの要約、effective_at、created_by | bodyは暗号化/別保管、または `redacted_summary` だけ |
| `system_parameter_proposals` | pending proposal、reason、target kind、review state | diff全文ではなく `change_summary`, `risk_summary` |
| `system_parameter_proposal_reviews` | approve / reject / comment の監査 | commentは短いreview basisだけ |

初回MVPではDBを作らず、`pwa/design/score_revision_feedback_loop.md` のscore-specific flowを「汎用governanceへ拡張するADR」として別workerで確定する。

### 4. WS-6 Before-Zero設立時期推奨

現OSには `project_ventures.founded_at`, `project_founding_members`, `project_xrl_evidence`, `project_xrl_log`, `amd_score_inputs` など周辺根拠がある。一方、`incorporation_timing_recommendations` 相当の専用table / route / UIは未発見。

推奨MVPは「実PJ本文を持たない推奨台帳」。

| column | contract |
|---|---|
| `recommendation_id` | uuid |
| `project_id` | 対象PJ |
| `recommendation_status` | `draft / review / accepted / rejected / superseded` |
| `timing_category` | `too_early / prepare_now / incorporate_now / wait / no_go / unknown` |
| `input_categories_json` | `readiness`, `team`, `ip`, `customer`, `funding`, `institution`, `risk` など抽象カテゴリ |
| `missing_categories_json` | 判断に足りないカテゴリ |
| `conflicting_categories_json` | 矛盾しているカテゴリ |
| `basis_summary` | 短い判断basis。実source本文なし |
| `evidence_refs_json` | `source_category / role / short_basis` だけ |

初回は自動推奨ではなく、admin-only read/write台帳 + `/notifications` candidate化の設計までに留める。

### 5. 統合確認UI / 関連画面群

Fig.8相当を単一巨大画面にすると、現OSの導線と衝突する。実装は関連画面群として束ねる。

| route | 役割 |
|---|---|
| `/notifications` | candidate / evidence / approve / reject / comment |
| `/admin/protocols` | protocol / examples / outcome ledger |
| `/admin/ip` | 内部IP report、gap summary、retrofit状況 |
| `/project/{projectId}/cockpit` | PJごとの承認済みsignal / XRL / related members / meeting context |

`/admin/ip` はレポート画面であり、DB write導線にしない。retrofit statusを出す場合も、実PJ本文やsecret設定値を出さず、`implemented / partial / planned / blocked` の状態だけを表示する。

## Worker Breakdown

| priority | worker | scope | DB / migration | UI / API | close gate |
|---|---|---|---|---|---|
| P0 | Outcome ledger read UI | `/admin/protocols` に `protocol_result_observations` をfetchして表示。horizon/valence/confidence/summaryを見せ、同一horizonの異valenceを矛盾chipで併記 | なし | server fetch + client表示のみ | `npm run lint`、必要なら `npm run build`、スクショ確認 |
| P1 | Outcome ledger write UI | admin-onlyで観測を追加。既存rowを上書きしない | なし | insert form。sourceは抽象カテゴリだけ | test + manual UI確認 |
| P2 | Outcome evidence refs schema | JSON追加か中間tableを決め、migration案だけ作る | migration draftのみ。本番適用は司令塔review後 | UIは未実装でOK | DDL review、secret scan |
| P3 | Generic parameter governance ADR | score-specific flowを汎用parameter governanceへ拡張するschema/API/UI設計 | なし | なし | docs/spec commit |
| P4 | Before-Zero recommendation ADR | `incorporation_timing_recommendations` のschema/API/UI案 | なし | なし | docs/spec commit |
| P5 | `/admin/ip` retrofit status | read-only summary。関連画面への導線だけ | なし | report更新のみ | build不要なら docs確認 |

## Safety Boundary

| layer | safe now | must not do in first worker |
|---|---|---|
| DB | 既存schemaのread、migration draft作成 | production migration適用、既存row更新、seed投入 |
| API | admin-only read route / existing Supabase client read | 外部送付、source permalink返却、prompt本文返却 |
| UI | admin-only表示、抽象category、short basis | 実PJ本文、実source所在、score weight/threshold/calibration表示 |
| Automation | なし。手動UIから始める | outcome自動生成、parameter自動適用、設立時期自動確定 |
| Docs | spec / docs/ip 内部review | 公開層 / BZM public manuscriptへの転記 |

## First Implementation Unit

**P0: `/admin/protocols` outcome ledger read UI** を最初の1本にする。

理由:

- `protocol_result_observations` は既存tableなので、DDLなしで始められる。
- 特許案の claim 8-10 と gap audit の high priority に直結する。
- read-only から始めれば、実DB行の更新やセンシティブseedを避けられる。
- 同一horizonの矛盾併記をUIで見せるだけでも、append-only outcome ledger のOS実態が強くなる。

最小実装の形:

1. `/admin/protocols/page.tsx` で `protocol_result_observations` を `protocol_id, protocol_example_id, project_id, observed_on, horizon, valence, confidence, summary, evidence_source_type, evidence_source_id, created_at` だけselectする。
2. `evidence_url` は初回表示しない。source permalinkを露出しないため。
3. `AdminProtocolsClient` の `Protocol` に `observations` を追加する。
4. 展開領域の関連事例の下に、horizon別の観測リストを表示する。
5. 同一horizon内に異なる `valence` がある場合だけ `矛盾観測あり` chipを出す。既存観測は絶対に上書きしない。
6. 追加フォームは次worker。P0はread-onlyで閉じる。

## Verification Plan

- `git status -sb` で対象変更だけを確認。
- `rg -n "protocol_result_observations" pwa/src/app pwa/src/components pwa/spec` でread UIが既存schema名と一致することを確認。
- P0実装時は `cd pwa && npm run lint` を通す。UIやserver componentに触った場合は `npm run build` も通す。
- Browserで `/admin/protocols` を開き、既存protocolが空観測でも崩れないこと、観測がある場合はhorizon/valenceが表示されることを確認する。
- production DB write / migration / deploy は、P0 read-onlyの後に司令塔reviewを挟む。

## 残課題

- 指定の 2026-06-01 IP docs は、現在のworktree HEADには存在せず、`codex/ip-patent-consult-pack` 系ブランチ上の文書を read-only で参照した。main反映時はIP docsブランチの統合状態を先に確認する。
- `protocol_result_observations` の RLS / admin-only書き込み境界は、P1 write UI 前に改めて確認する。
- `system_parameter_*` と `incorporation_timing_recommendations` は、最初からDDL適用せずADR -> migration draft -> review -> production apply の順に分ける。
