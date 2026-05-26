# L2 ②〜⑨ 取り込み統一 — claude.ai Cloud routines 移行完了 (設計議論)

> **状態 (= 2026-05-26 更新)**: ✅ **L2 ②〜⑨ 全 8 routine を claude.ai/code/routines (= Cloud / Remote routine) に移行完了、entry 済**。Mac の Local routine から、Anthropic-managed cloud infrastructure 上で動く Remote routine への一本化が完了。詳細仕様は [38 章](../manual/38-l2-extraction-routines-spec.md) を真とする。Local routine は「app open + 非スリープ中のみ発火」制約で MacBook Air 運用と相性悪く、Cloud routine が laptop closed でも動く点で優れる。
>
> **trigger ID 一覧** + 残課題は [`L2_DATA.md`](L2_DATA.md) の §「L2 ②〜⑨ Cloud routines 統一」と [38 章 §38.3](../manual/38-l2-extraction-routines-spec.md#383-routine-一覧--2026-05-26-entry-済) を参照。
>
> 関連: [`pwa/manual/03-data-and-extraction.md`](../manual/03-data-and-extraction.md) §3.1, [`pwa/manual/05-decisions-and-history.md`](../manual/05-decisions-and-history.md) §5.1 / §5.4 / §5.7, [`pwa/manual/38-l2-extraction-routines-spec.md`](../manual/38-l2-extraction-routines-spec.md), [`pwa/design_log/sessions_2026-05.md`](../design_log/) の 2026-05-26 セクション (= 移行経緯詳細)

---

## 背景

2026-05-22 「LLM 課金が発生する定期抽出 cron を全廃止」した時に、**Codex automation が L2 全種をカバーしてる前提が間違ってた** ことが 5/25 判明。実態 (= 2026-05-25 朝):

- **稼働中**: ① monthly_reports (= 別 GAS R313) / ③ MS 進捗 (= GAS 154 → PWA `/api/cron/hourly-estimate` が primary writer、Codex automation `amd-os-ms` は修正候補レビュー) / ⑦ OS 台帳差分 + ⑧ XRL 根拠 (= Codex automation `amd-os-ms`) / ⑨ 経営ハイライト (= Codex automation `amd-os`)
- **ghost (= 2026-05-22 以降取り込みゼロ)**: ② AMD プロトコル / ④ PJ ナレッジ / ⑤ メンバーナレッジ / ⑥ MTG サマリ

(詳細 fact は 03 章 3.1 マトリクス参照)

---

## ⚠️ 2026-05-25 お昼 方針転換 (一次): dryRun アプローチ撤回 → 完全移植アプローチへ

**経緯**:
- 当初えいみは「GAS の関数を Claude routine から curl で呼ぶ (= dryRun option 追加で GAS 内 LLM call を skip)」と解釈、実装
- まさ「GAS を呼ぶことは求めてない。GAS でせっかく作った設計を無視して新しい設計を考え始まったから、いやいやせっかく GAS で設計したんだから、それをそのまま移植してとお願いしただけ。**GAS を使うのではなく、GAS を移植して**」
- → **dryRun アプローチは GAS 依存のまま** = まさの「移植」と違う

**確定方針**:
- Claude routine SKILL.md 内に **GAS の業務ロジック (= source 取得 / 判定 / source_kinds / 抽出プロンプト / upsert) を inline 移植**
- Calendar / Notion / Gmail / Drive / Slack へのアクセスは **MCP 経由直接** (= GAS 経由しない)
- LLM 呼びは Claude routine 内 Sonnet (= サブスク内、Claude Code が直接実行、SDK 不要)
- **GAS は完全 bypass** (= kill switch のまま死んでて OK、参照すらしない)

**dryRun 実装の扱い**:
- GAS 074/153/155 への dryRun option 追加 commit (= `@1473`) は **revert 不要** (= backward compatible、ただし routine 改訂後は使われない)

---

## 🔥 2026-05-25 お昼 方針転換 (二次): L2 ②〜⑨ 全 Claude routines 統一

**まさ #71 確定**: 「すべて Claude routines で抽出する形に変更」 = **L2 ②〜⑨ 全 8 種を Claude routine に統一**。

**新方針**:
- ghost 4 種 (= ②④⑤⑥) だけでなく、稼働中の **③ MS 進捗 / ⑦ OS 台帳差分 / ⑧ XRL 根拠 / ⑨ 経営ハイライト** も Claude routine に移管
- 既存 Codex automation `amd-os-ms` + `amd-os` は段階的に停止
- LaunchAgent applier `jp.teamarmada.amd-os-ms-outbox-applier` も outbox 経路が不要になり次第 unload

**保留**:
- ① monthly_reports は別 GAS R313 (= LLM 不使用、月次 cron) のまま (= 課金問題なし、移管対象外)
- 修正依頼ループ (= `l2_feedbacks` 読み込み) は各 routine の SKILL.md prompt に必ず組み込み

---

## 8 routine 一覧 (= 2026-05-25 #71 確定)

| L2 | Routine 名 | 頻度 | 旧 writer (停止/移管対象) | 状態 |
|---|---|---|---|---|
| **② AMD プロトコル** | `amd-os-protocol-extract` | daily 08:00 JST | GAS 155 (= kill switch、completed bypass) | 🚧 SKILL.md 未作成 |
| **③ MS 進捗** | `amd-os-ms-progress-extract` | 毎時 0 分 | GAS 154 → PWA `/api/cron/hourly-estimate` + Codex `amd-os-ms` の `outbox.revisions` | 🚧 SKILL.md 未作成。**移管慎重**: 既存 primary writer が稼働中なので、Claude routine が動作確認できてから既存停止 |
| **④ PJ ナレッジ** | `amd-os-project-knowledge-extract` | daily 08:15 JST | GAS 155 (= kill switch) | 🚧 SKILL.md 未作成 |
| **⑤ メンバーナレッジ** | `amd-os-member-knowledge-extract` | daily 08:30 JST | GAS 155 (= kill switch) | 🚧 SKILL.md 未作成。**schema gap**: 現 `member_knowledge` に `status` / `source_hash` 列なし、候補採否設計には migration 必要 |
| **⑥ MTG サマリ** | `amd-os-meeting-extract` | **毎時 0 分** (= GAS 153 と同パターン、終了 +60-180 分の窓で拾う) | GAS 153 (= kill switch) | ✅ **SKILL.md 完全 inline 移植版 Write 済 2026-05-25 #71**、scheduled task 登録待ち |
| **⑦ OS 台帳差分** | `amd-os-registry-diff-extract` | 6h ごと | Codex `amd-os-ms` の `outbox.registryDiffs` (稼働中) | 🚧 SKILL.md 未作成。移管慎重 |
| **⑧ XRL 根拠** | `amd-os-xrl-evidence-extract` | 6h ごと | Codex `amd-os-ms` の `outbox.xrlEvidence` (稼働中) | 🚧 SKILL.md 未作成。移管慎重 |
| **⑨ 経営ハイライト** | `amd-os-strategy-signal-extract` | daily 03:20 JST | Codex `amd-os` (稼働中、5/25 applier 修復済) | 🚧 SKILL.md 未作成。移管慎重 + 対話型修正依頼ループ (#34) と接続必要 |

**実装順序** (= まさ確定後):
1. **Routine 1** (= ⑥ MTG サマリ) を 2026-05-25 #71 で SKILL.md 完成 + scheduled task 登録 + 翌朝観察
2. Routine 2-4 (= ②④⑤、ghost) を次セッションで同パターンで実装 (= 入力テーブル / プロンプト違いだけ)
3. Routine 5-8 (= ⑦⑧⑨ + ③) を段階的に実装、各 routine が動作確認できてから既存 Codex automation / PWA hourly を停止
4. 5/22-5/25 取り込み穴期間の backfill 機能を各 routine に追加 (= `--backfill-from 2026-05-22` モード or 別建て手動 routine)

---

## 確定事項 (= まさ 2026-05-25 #71 判断)

| 項目 | 確定内容 |
|---|---|
| 採用案 | **C 拡張版 (= Claude routine 8 個新設、L2 ②〜⑨ 全統一)** |
| 議事録 (= Routine 1 ⑥) の頻度 | **毎時 0 分発火 + 過去 60-180 分終了 events スキャン** (= GAS 153 と同パターン) |
| ナレッジ系 (= Routine 2-4 ②④⑤) の頻度 | **daily 08:00 / 08:15 / 08:30 JST** (= 30 分間隔ずらしで重なり回避) |
| MS 進捗 (= Routine 5 ③) の頻度 | **毎時 0 分** (= 既存 PWA hourly と同パターン) |
| OS 台帳差分 + XRL 根拠 (= Routine 6/7 ⑦⑧) の頻度 | **6h ごと** (= 既存 Codex `amd-os-ms` と同パターン) |
| 経営ハイライト (= Routine 8 ⑨) の頻度 | **daily 03:20 JST** (= 既存 Codex `amd-os` と同パターン) |
| subscription 帯域 | OK と判断 (= まさ確認済 #71) |
| failure handling | `notifyOnCompletion=true` 標準採用 (= running session に通知) |
| 既存 GAS 153 / 155 / 152 source | kill switch のまま残置 (= 廃止判断は後で) |
| 既存 Codex `amd-os-ms` / `amd-os` | Routine 5-8 動作確認後に段階的に停止 |
| LaunchAgent applier | Codex outbox 経路が不要になり次第 unload |
| 経営ハイライト修正依頼ループ (= #34) | 対話型ループに置換 (= `pwa/design/feedback_dialog.md`)、Routine 8 SKILL.md に対話 API 接続を組み込み |
| 各 routine の prompt | `l2_feedbacks` 読み込み手順を必ず含める (= 修正依頼ループ復活) |
| upsert path | routine 内で直接 Supabase REST (= service_role)、PWA API は使わない |
| LLM 呼び | サブスク内 Claude (= Claude Code が直接実行、SDK 不要) |
| データソース access | MCP 直接 (= Calendar / Notion / Gmail / Drive / Slack)、GAS 完全 bypass |

---

## 採用方針 (= まさ案 C 確定)

**Claude routine を 4 個新設** (= `~/.claude/scheduled-tasks/<id>/SKILL.md`)。

| 案 | 採用? | 理由 |
|---|---|---|
| A: GAS 復活 (= kill switch 外す) | ❌ | LLM (Gemini) 課金が cron 廃止方針に矛盾、また GAS 153 のコメント自身が「Use Codex automation/review batches」と言ってる |
| B: `amd-os-ms` prompt 拡張 | ❌ | 単一 automation が肥大化、失敗ドメイン分離効かない、prompt 文字数も限界 |
| **C: Claude routine 4 個新設** | ✅ | サブスク内 LLM、cron 廃止方針整合、`amd-os-management-dialogue-prep` で実績あり、ドメイン分離 |
| D: Vercel cron 復活 | ❌ | LLM 課金、cron 廃止方針真っ向矛盾 |

---

## 既存 routine から学ぶ (= `amd-os-management-dialogue-prep` パターン)

- **保存先**: `~/.claude/scheduled-tasks/<taskId>/SKILL.md`
- **frontmatter**: `name` + `description`
- **本文**: 必ず最初に Read するファイルリスト → Phase A 抽出 → Phase B 後段処理 / 通知
- **登録**: `mcp__scheduled-tasks__create_scheduled_task` で `cronExpression` 指定 (= ローカル時間)
- **DB upsert**: 直接 Supabase REST (= service_role) または PWA API (= `CRON_SECRET` ヘッダ)
- **冪等性**: source_hash 差分検知 + L2 ごとの status 語彙に合わせた通知採否ループ。`protocols` は yes で `confirmed`、`project_knowledge` は yes で `active`。`member_knowledge` は現 schema に `status` 列が無いので migration 判断が必要。

---

## 4 routine 設計案 (= まさ確認待ち)

### Routine 1: `amd-os-meeting-extract` (= L2 ⑥ MTG サマリ)

| 項目 | 確定内容 |
|---|---|
| 頻度 | **毎時 0 分発火 (`0 * * * *`)** (= GAS 153 と同パターン)。MTG 終了から 60-180 分の窓で 1 回拾われる |
| 入力 | Calendar 直近 3 時間の events をスキャン → 終了が「現在の 60-180 分前」のものだけ filter → PJ 判定 → 関連 Notion 議事録 + Slack 添付 + Drive Doc + Gmail を取得 |
| 処理 | event 単位で source_kinds 判定 + summary 抽出 (decided / progress / next_actions / risks) + `narrative_md` 生成 (= 長文) |
| 出力先 | Supabase `project_meeting_summaries` (= 直接 upsert by `meeting_id` PK) + `meeting_notifications` (= iOS 通知用) |
| LLM | Claude Sonnet 4.6 (= サブスク内) |
| 既存 GAS 074 系との関係 | GAS 074 / 074b-e の `_meeting_processOneEvent_` ロジック (= Notion AI 議事録パース / Gmail 議事録メール検索 / source_kinds 判定) を Claude routine 内で再実装。MCP (= Notion / Calendar / Gmail / Slack / Drive) 経由 fetch |
| 冪等性 | 各 event の `source_hash` を `project_meeting_summaries` から読む → 同 hash なら LLM call スキップ |

### Routine 2: `amd-os-protocol-extract` (= L2 ② AMD プロトコル)

| 項目 | 案 |
|---|---|
| 頻度 | **daily 08:00 JST** (= 議事録抽出後) |
| 入力 | 直近 24 時間に upsert された `project_meeting_summaries` (= 二次集約パターン、GAS 155 と同) |
| 処理 | 議事録の decided 等から「経営判断の構造化記録 (分岐点 / 判断材料 / アクション / 結果)」を抽出 |
| 出力先 | `protocols` (= `status='candidate'`、通知採否で `confirmed` 昇格) |
| LLM | Claude Sonnet 4.6 |
| 既存 GAS 155 との関係 | GAS 155 `nav_protocol_pollAll` の prompt 移植 |

### Routine 3: `amd-os-project-knowledge-extract` (= L2 ④ PJ ナレッジ)

| 項目 | 案 |
|---|---|
| 頻度 | **daily 08:15 JST** |
| 入力 | 直近 30 日の `monthly_reports` + `project_meeting_summaries` (= 二次集約) |
| 処理 | PJ にまつわる事実 / 人物 / 組織 / 進行中事項を抽出 |
| 出力先 | `project_knowledge` (= 既存 row を破壊せず SELECT/INSERT/PATCH、status='candidate') |
| LLM | Claude Sonnet 4.6 |
| 既存 GAS 155 との関係 | `nav_project_knowledge_pollAll` の prompt 移植 + v4_meta_strict (= 汚染防御) を継承 |

### Routine 4: `amd-os-member-knowledge-extract` (= L2 ⑤ メンバーナレッジ)

| 項目 | 案 |
|---|---|
| 頻度 | **daily 08:30 JST** |
| 入力 | 直近 30 日の `member_activities` + `project_meeting_summaries` (= 二次集約) |
| 処理 | メンバー個人の強み / スキル / 関心を 7 category で抽出 |
| 出力先 | `member_knowledge` (= 現 schema は `status` 列なし。候補採否を row に持たせるなら migration が必要) |
| LLM | Claude Sonnet 4.6 |
| 既存 GAS 155 との関係 | `nav_member_knowledge_pollAll` の prompt 移植 |

---

## 共通設計事項

### 修正依頼ループ (= まさ #34 中期)

各 routine の prompt に「`l2_feedbacks` の `l2_kind` 該当行を読み込んで反映」手順を入れる。これで GAS 155 の `_l2_loadFeedbackBlock_` 相当が実現する。**経営ハイライト routine 化も検討** (= `amd-os` 内の経営ハイライト抽出を独立 routine 化するか、現行 `amd-os` prompt に `l2_feedbacks` 読み込みを直接追加する)。

### upsert path

- **直接 Supabase REST** (= 高速、helper 不要、ただし routine 内で env 読み込み + auth ハンドリング必要)
- **PWA API** (= `/api/founding-members/save` 等、`CRON_SECRET` ヘッダ、既存 server-side validation 使える)

→ **推奨**: routine 内で直接 Supabase REST。PWA API は HTTPS + cold start で遅い、Claude routine から叩くと subscription 帯域余分に使う

### 冪等性

`source_hash` 列を活用、各 routine 開始時に「最終処理済 hash」を `l2_extract_state` から取得 (= 既存テーブル、migration 030)。差分検知して LLM call スキップ。

### 通知連携

routine 末尾で `l2_notifications` に upsert (= 既存 migration 031)。saved_count 変化で `notified_at=NULL` に戻る再通知トリガを既存通り使う。

---

## Routine 1 SKILL.md (= 完全 inline 移植版 Write 済、scheduled task 登録待ち)

**実 SKILL.md ファイル**: `~/.claude/scheduled-tasks/amd-os-meeting-extract/SKILL.md` (= 2026-05-25 #71 完全 inline 移植版に書き換え、git 管轄外)

**設計の要点** (= 2026-05-25 #71 完全 inline 移植版):

- **GAS 完全 bypass**: 旧 dryRun 経由 (= GAS を curl で呼ぶ) は廃止。Claude routine が **MCP 経由で Calendar / Notion / Gmail / Drive / Slack に直接 access**
- **LLM 呼び**: scheduled task 内の私 (= Claude) が prompt 受けて JSON 生成 (= Anthropic SDK 不要、サブスク内)
- **業務ロジック (= GAS 元コード完全保存)**:
  - Phase A: Calendar events 過去 3 時間取得 → 終了 60-180 分前 filter → PJ 判定 (= project_name / project_id / client_name substring match)
  - Phase B: Notion 3 段 fallback (= eventId equals → titleHint + 同日付 → 日付 equals) → ページ本文 + AI transcription block → Gmail thread + Drive Docs + Slack thread → source_kinds 判定 (= 30 chars 閾値) → source_hash 計算
  - Phase C: alias map + feedback block 生成 → 抽出 prompt 組み立て → 私が JSON 出力 (= summary_short / decided / progress / next_actions / risks / narrative_md)
  - Phase D: project_meeting_summaries + meeting_notifications upsert + feedback applied_count++
- **5 ソース全部見る** (= まさ絶対ルール 2026-05-11): Notion + Gmail + Drive + Slack + Calendar event 本文。GAS 074 + 074b-e の集約をこの 1 routine で実現

**注意点**:
- `members` テーブルに `member_name` 列が無い (= 2026-05-25 #71 確認時点)。alias map は code_name + email local part だけで動かす
- 議事録 DB ID + PJ DB ID は GAS の ScriptProperties (= `NOTION_DATABASE_ID` / `NOTION_PJ_DATABASE_ID`) から取ってたが、Claude routine からは Notion search の query で動く (= 固定したければ別 task で `.env.local` に追加)
- GAS の kill switch `MEETING_HOURLY_CRON_DISABLED_20260522` は維持 (= GAS time trigger は復活させない、Claude routine だけが稼働)

### 元 prompt (= 古い inline 草稿、参考用)

```markdown
---
name: amd-os-meeting-extract
description: AMD OS L2 ⑥ MTG サマリ抽出 routine。毎時 0 分発火、過去 60-180 分終了の Calendar events を拾って Notion 議事録 / Slack / Drive / Gmail から source 集約 → summary + narrative_md を `project_meeting_summaries` に upsert。
---

AMD OS の L2 ⑥ MTG サマリ抽出 routine。GAS 153 `nav_meeting_pollRecentlyEndedEvents` の後継 (= 5/22 kill switch で停止)。

【絶対】 動く前に必ず Read:
1. /Users/masa/projects/AMD/amd-os/pwa/manual/03-data-and-extraction.md (= §3.1 取り込み path / §3.2 L2 9 種正本 / §3.4 修正依頼ループ)
2. /Users/masa/projects/AMD/amd-os/pwa/design/meeting_summaries.md (= MTG サマリ仕様正本)
3. /Users/masa/projects/AMD/amd-os/pwa/design/db_schema.md (= 列名は想像で書かない、必ずここを grep)

═══════════════════════════════════════════════════
Phase A: スキャン対象の event を特定
═══════════════════════════════════════════════════

1. cwd を /Users/masa/projects/AMD/amd-os
2. pwa/.env.local から CRON_SECRET / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY をロード
3. Calendar MCP で `MAIN_CALENDAR_ID` (= ScriptProperties 相当、ScriptProperties は GAS なので Supabase config テーブル or env から) の **過去 3 時間に終了した events** を list
4. 各 event について:
   - 終了 datetime が「現在の 60 分前 〜 180 分前」の窓に入る? Yes なら処理対象
   - 既に `project_meeting_summaries.meeting_id = <eventId>` が `source_hash` 同一で存在? Yes ならスキップ (冪等性)
   - PJ 判定: GAS 153 と同じく `CFG_ColorPJHistory` (= Supabase `color_pj_history` テーブル相当) + `CFG_PJAlias` (= `pj_aliases` テーブル) で event color + title から projectId 解決
5. PJ 紐付けが取れた events だけを処理キューに入れる

═══════════════════════════════════════════════════
Phase B: 各 event について source 集約 + 抽出
═══════════════════════════════════════════════════

各 event について:

1. **source_kinds 判定** (= GAS 074 の `_meeting_processOneEvent_` と同じ優先順位):
   - **Notion AI 議事録**: event title / startAt / attendees から Notion DB を検索、AI ノート page 取得
   - **Gmail 議事録メール**: subject に PJ name 含む + 議事録キーワード (= 議事録/MTG/打合せ/minutes/notes) のメール検索
   - **Slack スレッド**: PJ の `slack_channel_id` から event 前後 24h の threads (議事録投稿ありそうなもの)
   - **Drive Doc**: PJ の `drive_folder_id` 配下 + event title 部分一致
   - **Calendar event 本文 fallback**: 全部空ならこれだけ
   - 該当ありの sources を `+` で結合 (= `notion+gmail` / `notion+slack` 等)
   - **全部空なら `source_kinds='none'`** (= chitchat 判定、saved=0 で記録)

2. **LLM 抽出** (= Claude Sonnet 4.6):
   - Input: 集約した sources + event meta (title / attendees / startAt) + name alias map (= members.code_name + member_name)
   - Output: decided[] / progress[] / next_actions[] / risks[] + narrative_md (= 長文)
   - 「会議が見つからない」「議事録なし」と判定したら `source_kinds='none'`、saved_count=0

3. **修正依頼の織り込み** (= まさ #34 中期):
   - `l2_feedbacks` で `l2_kind='meeting_summary'` AND `target_id=<projectId>` AND status='active' を取得
   - これらを prompt に「過去のユーザーフィードバック (重要・必ず反映すること)」として渡す
   - 反映した feedback の `applied_count` を increment

4. **upsert** (= 直接 Supabase REST):
   - `project_meeting_summaries` (PK=meeting_id) に upsert
   - 列: meeting_id, project_id, ym, source_kinds, decided, progress, next_actions, risks, narrative_md, source_url, source_hash, attendees, started_at, ended_at, status='active', etc.
   - source_hash は sources を JSON.stringify → SHA256

5. **通知 upsert** (= iOS APNs):
   - `meeting_notifications` (PK=meeting_id) に upsert
   - source_kinds != 'none' なら saved_count に応じて
   - saved_count 変化したら notified_at=NULL (= 再通知トリガ)

═══════════════════════════════════════════════════
Phase C: run summary
═══════════════════════════════════════════════════

- 処理した event 数 / saved 数 / skipped (= 冪等性) 数 / source_kinds 別件数
- エラー event があれば notes に列挙
- 翌時刻の polling に持ち越す event があるか
- まさへの 1 行サマリ: "🕐 議事録 routine: 過去 60-180 分の MTG を N 件チェック、M 件 saved (= notion=X, slack=Y, gmail=Z), N-M 件は議事録なし"
```

---

## 残設計事項 (= 次セッション以降の判断)

1. **MAIN_CALENDAR_ID の永続化**: Claude routine では `list_calendars` MCP で primary を都度確認、もしくは `.env.local` に `MAIN_CALENDAR_ID` 追加。Routine 1 では暫定 primary を使う
2. **Notion DB ID 固定化**: 議事録 DB / PJ DB の collection URL を `.env.local` に固定すると notion-search が速くなる。Routine 1 は `query` だけで動く設計、最適化は後回し
3. **members.member_name 列追加**: GAS 079 で想定してた `member_name` 列が現 schema に無い。migration で追加してまさが入れれば alias map が充実
4. **Routine 5 (= ③ MS 進捗) の primary writer 移管**: 既存 PWA `/api/cron/hourly-estimate` が稼働中なので、Routine 5 が動作確認 (= 数日観察) できてから既存停止
5. **Routine 6/7/8 (= ⑦⑧⑨) の Codex automation 停止**: 既存 `amd-os-ms` / `amd-os` を unload + LaunchAgent applier も outbox 経路が空になり次第 unload
6. **5/22-5/25 取り込み穴期間の backfill**: Routine 1-8 すべて稼働開始後に、各 routine に `--backfill-from 2026-05-22` モード追加 or 手動キック routine 別建て

---

## 実装ステップ

1. **✅ Routine 1 (= ⑥ MTG サマリ)** 完全 inline 移植 SKILL.md 完成 (= 2026-05-25 #71)
   - 次: `mcp__scheduled-tasks__create_scheduled_task` で登録 → 翌時の発火を観察 → upsert 件数確認
2. **🚧 Routine 2-4 (= ②④⑤ ghost 復旧)** を次セッションで同パターンで実装:
   - GAS 155 `nav_protocol_pollAll` / `nav_project_knowledge_pollAll` / `nav_member_knowledge_pollAll` の prompt を Notion / Supabase REST から拾って markdown 化
   - SKILL.md の Phase A-D 構造は Routine 1 と共通テンプレートにする
3. **🚧 Routine 5 (= ③ MS 進捗)** を実装、既存 PWA hourly と並行稼働で fact 比較 → OK なら既存停止
4. **🚧 Routine 6/7 (= ⑦⑧)** を実装、既存 Codex `amd-os-ms` と並行稼働で fact 比較 → OK なら既存停止
5. **🚧 Routine 8 (= ⑨ 経営ハイライト)** を実装 + 対話型修正依頼ループ (= `feedback_dialog.md`) と接続
6. **5/22-5/25 の取り込み穴期間 backfill**: 各 routine に `--backfill-from 2026-05-22` モード追加 or 手動キック routine 別建て
7. **マニュアル 5.4 / L2_DATA.md / 03 章 3.1 表更新**: writer 列を Claude routine 名に書き換え
8. **既存 Codex automation / LaunchAgent applier の停止**: Routine 5-8 動作確認後

---

## 「TODO おけ待ち」運用

各 routine 投入後、まさ「おけ」をもらってから:
- TODO `completed` 化
- 関連 md (= 03 章 3.1 マトリクス / 5.4 表 / L2_DATA.md) を「✅ 稼働」に更新
- BUGS.md に「5/22-5/25 ghost 期間の復旧記録」を追加
