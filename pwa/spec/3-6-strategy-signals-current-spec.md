# L2⑨ 経営ハイライト仕様

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

`signal_date` は「リアクター特許出願完了（4/27付）」なら 4/27。議事録に出た日ではなく、事象発生日を優先する。

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

## 採否

- 「はい」: `project_strategy_signals.status='confirmed'`。
- 「いいえ」: `status='rejected'`。
- コメント: `l2_feedbacks` に保存して次回 automation へ入れる。

`risk` は純粋な外部要因に使う。自社内部のリスクは本来の分類 (`management_decision` / `business_progress` / `commercial_progress` など) に寄せる。

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
- GAS health failure だけで L2⑨ review 全体を止めない。
