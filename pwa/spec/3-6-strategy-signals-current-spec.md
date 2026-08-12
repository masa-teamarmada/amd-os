# L2D-6 経営ハイライト仕様

> **この章は何か**: `project_strategy_signals` に保存される経営ハイライト、通知採否、cockpit 表示、dialogue 接続の確定仕様。設計議論は `pwa/design/project_strategy_signals.md` にも残す。

## 定義

経営ハイライトは、MS進捗より上位の「進んだこと / 起きたこと」。

入れる:

- 経営方針や事業方針が決まった
- 顧客 / 提携 / 資金 / 規制 / 知財 / 採用で PJ の進路が変わる進捗があった
- 重要リスクが顕在化した
- 次に取るべき行動が事業上の意思決定として明確になった

入れない:

- 単なる日程調整
- 通常の TODO
- MS 進捗率だけで表せる作業
- source refs が弱い推測
- 既存 signal の言い換え

## 正本テーブル

| table | 用途 |
|---|---|
| `project_strategy_signals` | 経営ハイライト本体 |
| `l2_notifications` | `l2_kind='project_strategy_signal'` の承認カード |
| `project_meeting_summaries` | dialogue 議事録 (`source_kinds='dialogue'`) |
| `l2_feedbacks` | コメント / 修正依頼 / 次回抽出への学習 |

## 現行 writer

| 項目 | 値 |
|---|---|
| writer | Codex automation `amd-os` |
| SKILL | `pwa/scheduled-tasks/amd-os-l9-strategy-signal-extract/SKILL.md` |
| schedule | daily 03:20 JST |
| output | `~/.codex/automations/amd-os/strategy-signals-outbox/*.json` |
| apply | LaunchAgent + `ms_progress_review_tool.mjs apply-outbox-dir --dir <strategy-signals-outbox>` |

`automation-prepare` の hard gate は Supabase / PWA API / snapshot refresh / 5 生データ。GAS health は任意診断で、デフォルト hard gate にしない。

### SXワークスペース接続

SX (`p21`) だけは、5生データとOS snapshotに加えて `GET /api/project-workspace/p21/automation-context?since=YYYY-MM-DD&until=YYYY-MM-DD` を読む。このrouteは同じ `project_management_*` 正本の変更履歴を件数上限なしで返し、保存時にLLMは呼ばない。

- `strategyEvidence.eligible=true` は「D-6がレビューすべき完了事実」の一次絞り込みであり、自動採用ではない。
- 通常の進行中TODO、未完了、単なる編集は経営ハイライト候補にしない。
- D-6のdone-only、claim gate、重複排除、candidate reviewをそのまま通す。
- source refは `kind='project_management_update'` と `update_id` を保持し、Cockpitの根拠詳細から元のSXワークスペースへ戻れるようにする。
- ワークスペースの件数・工程・判断一覧をCockpitへ別カードとして複製しない。

外部公開情報は別の Codex automation `tsukuyomi-external-research` が平日09:00 JSTに調べ、同じ outbox / applier へ候補を渡す。旧 `gas-external-research` の Slack 配信は停止し、候補の提示先は `/notifications` に一本化する。新情報ゼロは正常終了で、空 outbox や穴埋め記事は作らない。

## DB 契約

| column | 契約 |
|---|---|
| `project_id` | 対象 PJ。会社全体は `p00` |
| `ym` | 対象月。明確でなければ NULL |
| `signal_date` | 事象が起きた日。観測日ではない |
| `polarity` | `breakthrough` / `forward` / `pivot` / `risk` |
| `signal_type` | `management_decision` / `business_progress` / `strategic_pivot` / `commercial_progress` / `partnership` / `funding` / `ip_regulatory` / `risk` / `next_move` / `tech_progress` |
| `impact_level` | `low` / `medium` / `high` / `critical` |
| `decision_state` | `observed` / `proposed` / `decided` / `executing` / `revised` |
| `status` | `candidate` / `confirmed` / `rejected` / `archived` |
| `source_refs_json` | source id / date / title / short snippet / url / hash |
| `source_hash` | 重複排除 |
| `origin_kind` | `internal` = 従来の経営ハイライト、`external_research` = つくよみ外部リサーチ |
| `research_category` | 外部リサーチだけ `industry_market` / `grant` / `partner`。internal は NULL |
| `signal_scope` | `company` / `project` / `cross_project`。Management Scoreに入れる範囲分類 |
| `applies_to_company_score` | AMD会社バイタルへ入れてよいとき TRUE |
| `pipeline_status` / `pipeline_probability` | 契約前pipelineの状態と確度。高確度candidateは原則 0.75 以上 |
| `expected_amount_yen` / `expected_contract_ym` | 見込み金額と契約・請求・開始見込み月 |
| `company_score_axis` / `scope_reason` | Management Score 側の軸と、company/PJ分類の根拠 |

`signal_date` は「リアクター特許出願完了（4/27付）」なら 4/27。議事録に出た日ではなく、事象発生日を優先する。

外部リサーチの `source_hash` は、正規化した title / entity / event date / material update の SHA-256。canonical URL とこの fingerprint を、candidate / confirmed / rejected / archived の全履歴と未反映 outbox に対して照合する。status・月・種別が変わっても同じ出来事を再通知しない。締切確定、採択結果、金額変更など判断に効く新事実がある場合だけ `material_update` を変えて続報にする。

## Cockpit 表示

`/project/[projectId]/cockpit` の MS リスト直下に出す。

- 日付
- polarity chip
- signal_type chip
- impact chip
- candidate の未確認 chip
- title
- summary 1-2行
- `score_impact_summary`
- source refs 数と短い根拠

candidate も表示してよいが、未確認 chip を必ず付ける。

2026-08-11以降、経営ハイライト内は次の2棚に分ける。

- `重要な動き`: `origin_kind='internal'` の candidate / confirmed。従来表示を維持する。
- `採用リサーチ`: `origin_kind='external_research' AND status='confirmed'` だけ。業界・市場 / 助成金 / 協業候補の分類を出す。

外部リサーチの candidate は cockpit に出さず `/notifications` だけに置く。

## 採否

- 「はい」: `project_strategy_signals.status='confirmed'`。
- 「いいえ」: `status='rejected'`。
- コメント: `l2_feedbacks` に保存して次回 automation へ入れる。

外部リサーチ通知だけは画面文言を「採用 / 見送り」にする。通知 metadata の `signal_source_hash` と完全一致する1件だけを更新し、一致しない場合に同月・同種別へ採否対象を広げない。

`risk` は純粋な外部要因に使う。自社内部のリスクは本来の分類 (`management_decision` / `business_progress` / `commercial_progress` など) に寄せる。

Management Scoreへ入れるかどうかは `status='confirmed'` とは別契約。PJ cockpit上の経営ハイライトとしては candidate/confirmed を表示してよいが、AMD会社バイタルへ入れるには `applies_to_company_score=true` かつ `signal_scope in ('company','cross_project')` が必要。個別PJの技術・実験・設立・顧客論点は `signal_scope='project'` / `applies_to_company_score=false` にする。

## Dialogue 接続

dialogue は、candidate signals をまさとえいみが 1 件ずつ確認し、チームへ提案する前の論点を整理する経路。

| API | 用途 |
|---|---|
| `POST /api/strategy-signals` | confirm / reject / update / create |
| `POST /api/dialogue-meeting` | 議論ログを `project_meeting_summaries` に保存 |
| `POST /api/dialogue-meeting/narrate` | raw 配列を narrative に変換 |

dialogue の `decided[]` は会社としての正式決定ではなく、「チームへ出す提案として固まったこと」の意味で書く。

## 禁止事項

- source refs が弱い推測で signal を作らない。
- 未了 TODO を「進んだこと」として入れない。
- Gmail / Slack / Notion / Drive 本文全文を保存しない。
- GAS health failure だけで L2D-6 review 全体を止めない。
