# L2⑥ Meeting Flow 仕様

> **この章は何か**: MTGサマリだけでなく、予定MTGカード、Drive資料同期、TODO→cockpit、Calendar作業枠、資料draft、Gmail draft まで含む L2⑥ meeting flow の現行仕様。詳細運用は `/manual/8-3-l2-extraction-routines-spec` にも残す。

## 現行 writer

| 項目 | 値 |
|---|---|
| automation | `amd-os-l6-meeting-flow` |
| 実行場所 | Windows MMO Codex Desktop automation |
| schedule | 09:00-21:00 JST、毎時 |
| early exit | 該当 MTG event 0 件なら Phase B 以降を実行しない |
| repo SKILL | `pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md` |

旧 GAS 153 / 074 は定期 writer として復活させない。

## 入力

| source | 内容 |
|---|---|
| Calendar | 過去60-180分終了 event、今日0:00 JSTから60日先の確定予定 |
| Notion | 議事録 page / DB |
| Gmail | report_emails thread / follow-up draft context |
| Drive | Docs / Slides / Sheets / PDF / Office metadata |
| Slack | thread / file / nudge context |
| PWA | `meeting_assets` 添付、過去 meeting summaries、monthly reports、MS context |

## Calendar PJ 判定

Calendar event の PJ 判定は、色→PJ判定を第一軸にする。

1. `CFG_ColorPJHistory` の `colorId + startDate` 履歴で PJ code を決める。
2. 色で取れない場合に `CFG_PJAlias` の title alias を見る。
3. 最後に `project_name` / `project_id` / `client_name` の substring fallback を使う。

移植・リファクタで色判定を削除しない。

## 予定MTGカード同期

- `POST /api/meeting-prep/calendar-sync` が `source_kinds='upcoming'` の予定MTGカードを upsert する。
- weekly recurring MTG は series ごとに次回1件だけ表示する。
- `+` / `＋` 始まり、全日予定、start datetime のない予定は除外する。
- Drive資料は automation 側が metadata として渡す。PWA route は Drive を直接読まない。
- Drive資料だけを根拠に `decided` へ「決定済み」と書かない。
- 予定MTG詳細では `risks` を UI 上「必ず確認すること」として表示・編集する。既存データは破壊削除せず、旧「気をつけたい読み違い」相当の値もこの section の確認事項として扱う。

## Calendar dry-run planners

MTGカード / 議事録側に日時・場所・対面/オンライン・持参物・返信/宿題があるのに Calendar event が無い/薄いケースは、`POST /api/meeting-calendar/upsert-plan` で一次防御する。PWA は Calendar を直接読まない / 書かない。L2⑥ automation が既存 Calendar event metadata を read-only で渡し、この route は `update_existing` / `create_candidate` / `review_required` / `hold` の plan、重複判定、`sendUpdates='none'` 前提の proposed payload だけを返す。`dry_run=false` / `execute=true` は `calendar_write_disabled` で拒否する。

MTGから生まれた担当タスク、OS task、Gmail TODO、Slack TODO は `POST /api/task-calendar/schedule-plan` で Calendar 作業枠候補にする。route は owner calendar とまさ calendar の busy window を入力として受け取り、`+<PJコード> <task>` の作業枠候補を `calendar_writes[]` で返す。外部 attendees は空、Google Meetなし、Gmail/Slack返信は送らない。owner calendar が不明、低信頼、個人予定境界、共通空き枠なしは `review_required` / `hold`。

## ended / frozen PJ の MTGサマリ生成ガード (2026-06-03 まさ確定)

月次サマリと同じ進捗ベース原則を L2⑥ にも適用する。**開催済みの実MTG (= 実進捗) は状態を問わず記録してよい**が、**未来の予定MTG prep を終了/凍結 PJ に自動生成しない**。frozen 判定は `projects.status='frozen'` または (`freeze_from_ym` ≤ 対象 ym)。

| 生成経路 | ガード |
|---|---|
| `POST /api/meeting-prep/calendar-sync` | `projects.status in ('active','sales')` のみ対象 (既存) |
| `POST /api/meeting-prep` (upcoming prep) | ended / frozen / `freeze_from_ym ≤ ym` なら upsert せず `skipped` を返す |
| `POST /api/meeting-workflow/finalize` (次回 prep 自動生成) | 次回 prep の ym が ended / frozen 境界後ならその candidate をスキップ (開催済みMTGの finalize 自体は許可) |
| `POST /api/dialogue-meeting` (まさえいMTG 記録) | ガードしない (人が意図的に記録する実進捗のため) |

## 開催済みMTG narrative

`project_meeting_summaries.narrative_md` は次の見出し順を固定する。

```md
## 🎯背景
## 📊経緯
## ✅決まったこと
## ▶️次の一手
## ⚠️残課題
```

- 見出し文言・絵文字・順序を変えない。
- raw array の貼り付けではなく、参加していないメンバーが理解できる段落にする。
- `✅決まったこと` は会議で実際に合意・確認されたことだけを書く。
- 詳細モーダルの編集 mode は、表示している section と同じ source field を編集する。`narrative_md` が主表示なら `narrative_md`、raw 配列が表示されている fallback 時だけ `decided / progress / next_actions / risks` を編集する。

## 出力

| output | 用途 |
|---|---|
| `project_meeting_summaries` | MTG narrative / decided / progress / next_actions / risks |
| `meeting_assets` | 手動添付の一般ファイル / スクショ / PDF / 画面共有資料。新規実体はDriveの `PJフォルダ / YYMMDD_会議名`、旧実体はprivate Storage |
| `meeting_notifications` | 旧 iOS APNs / 通知互換 |
| `tsukuyomi_nudge_queue` or cockpit TODO | TODO の cockpit 反映 |
| Calendar event | `+<PJ>` prefix の作業枠 |
| Drive file | automation が生成できる資料 draft |
| Gmail draft | facilitator 名義 follow-up draft。本送信は禁止 |

## 禁止事項

- Gmail を本送信しない。draft 止まり。
- Calendar 作業枠を `+<PJ>` prefix なしで作らない。
- freebusy を見ずに重複枠を作らない。
- 前提データが足りない資料を強引に生成しない。
- 旧 GAS 153 / 074 を定期 writer として復活させない。
