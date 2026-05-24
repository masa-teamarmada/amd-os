# L2 ②④⑤⑥ 取り込み復旧 — Claude routine 新設 (設計議論 draft)

> **状態**: まさ #案 C 確定 2026-05-25。**次セッションで頻度 / prompt / upsert path を確定 → 実装**。
>
> 関連: [`pwa/manual/03-data-and-extraction.md`](../manual/03-data-and-extraction.md) §3.1, [`pwa/manual/05-decisions-and-history.md`](../manual/05-decisions-and-history.md) §5.1 / §5.4

---

## 背景

2026-05-22 「LLM 課金が発生する定期抽出 cron を全廃止」した時に、**Codex automation が L2 全種をカバーしてる前提が間違ってた** ことが 5/25 判明。実態:

- **稼働中**: ① monthly_reports (= 別 GAS R313) / ③ MS 進捗 + ⑦ OS 台帳差分 + ⑧ XRL 根拠 (= Codex automation `amd-os-ms`) / ⑨ 経営ハイライト (= Codex automation `amd-os`)
- **ghost (= 2026-05-22 以降取り込みゼロ)**: ② AMD プロトコル / ④ PJ ナレッジ / ⑤ メンバーナレッジ / ⑥ MTG サマリ

(詳細 fact は 03 章 3.1 マトリクス参照)

---

## 確定事項 (= まさ 2026-05-25 判断)

| 項目 | 確定内容 |
|---|---|
| 採用案 | **C (= Claude routine 4 個新設)** |
| 議事録 (= Routine 1) の頻度 | **毎時 0 分発火 + 過去 60-180 分終了 events スキャン** (= GAS 153 `nav_meeting_pollRecentlyEndedEvents` と同パターン)。「MTG 終了 +60 分で抽出」要件を踏襲 |
| 他 3 routine の頻度 | **daily 08:00 / 08:15 / 08:30 JST** (= 30 分間隔ずらしで重なり回避) |
| subscription 帯域 | OK と判断 (= まさ確認済) |
| failure handling | `notifyOnCompletion=true` 標準採用 (= running session に通知) |
| 既存 GAS 153 / 155 / 152 source | kill switch のまま残置 (= 廃止判断は後で) |
| 経営ハイライト routine 化 | 今回スコープ外 (= 別 task #3 で `amd-os` automation prompt に `l2_feedbacks` 読み込みを追加するだけ) |
| 各 routine の prompt | `l2_feedbacks` 読み込み手順を必ず含める (= 修正依頼ループ復活) |
| upsert path | routine 内で直接 Supabase REST (= service_role)、PWA API は使わない |

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
- **冪等性**: source_hash 差分検知 + status='candidate' 保存で通知採否ループ

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
| 出力先 | `protocols` (= `status='candidate'`、通知採否で active 昇格) |
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
| 出力先 | `member_knowledge` (= status='candidate') |
| LLM | Claude Sonnet 4.6 |
| 既存 GAS 155 との関係 | `nav_member_knowledge_pollAll` の prompt 移植 |

---

## 共通設計事項

### 修正依頼ループ (= まさ #34 中期)

各 routine の prompt に「`l2_feedbacks` の `l2_kind` 該当行を読み込んで反映」手順を入れる。これで GAS 155 の `_l2_loadFeedbackBlock_` 相当が実現する。**経営ハイライト routine 化も検討** (= 5 routine 目として `amd-os-strategy-signals-extract` を作って `amd-os` automation を移管 → l2_feedbacks 読み込み実装)。

### upsert path

- **直接 Supabase REST** (= 高速、helper 不要、ただし routine 内で env 読み込み + auth ハンドリング必要)
- **PWA API** (= `/api/founding-members/save` 等、`CRON_SECRET` ヘッダ、既存 server-side validation 使える)

→ **推奨**: routine 内で直接 Supabase REST。PWA API は HTTPS + cold start で遅い、Claude routine から叩くと subscription 帯域余分に使う

### 冪等性

`source_hash` 列を活用、各 routine 開始時に「最終処理済 hash」を `l2_extract_state` から取得 (= 既存テーブル、migration 030)。差分検知して LLM call スキップ。

### 通知連携

routine 末尾で `l2_notifications` に upsert (= 既存 migration 031)。saved_count 変化で `notified_at=NULL` に戻る再通知トリガを既存通り使う。

---

## Routine 1 SKILL.md (= 起草済、実 routine 登録待ち)

**実 SKILL.md ファイル**: [`~/.claude/scheduled-tasks/amd-os-meeting-extract/SKILL.md`](~/.claude/scheduled-tasks/amd-os-meeting-extract/SKILL.md) (= 2026-05-25 Write 済、case-by-case で同期メンテ)

**設計の要点** (= ファイル本体は上記参照、ここでは設計判断だけ):

- **GAS dryRun アプローチ採用** (= 2026-05-25 確定): GAS 074 `nav_meeting_processOneEvent_` + GAS 153 `nav_meeting_pollRecentlyEndedEvents` に `opts.dryRun` を追加。dryRun=true のとき GAS は context (= notion + gmail combined text、alias、feedback、source_hash、source_kinds、meeting_meta) を返すだけで LLM call はしない。Claude routine が GAS を毎時 curl で叩いて context を取得 → サブスク内 Claude で抽出 → Supabase upsert。
- GAS の kill switch `MEETING_HOURLY_CRON_DISABLED_20260522` は dryRun=true 経路では bypass される (= GAS time trigger は復活させない、Claude routine 側だけが叩く形)
- LLM 課金は Anthropic サブスク内 (= Claude Code 内で実行されるため SDK API key 不要、5/22 cron 廃止判断と整合)
- データソース・ロジック・冪等性 (`source_hash`) は GAS 元コード完全保存 (= まさ「仕組み変えるな」指示と整合)

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

## 残設計事項 (= 実装着手前にまさ最終確認)

1. **MAIN_CALENDAR_ID の永続化**: GAS は ScriptProperties に持ってたが、Claude routine からどうアクセスする? → 案: Supabase `app_config` テーブルに移管、または `.env.local` 経由
2. **color_pj_history / pj_aliases**: GAS では in-memory CFG だったが Claude routine からは Supabase テーブル化が必要? → 案: 既存テーブルあるか確認、無ければ migration 090 で新設
3. **Routine 1 動作確認後**: Routine 2 / 3 / 4 を順次投入 (= 同パターン、入力テーブル違いだけ)
4. **5/22-5/25 取り込み穴期間 backfill**: Routine 1-4 すべて稼働開始後に、`--backfill-from 2026-05-22` モードを追加実装 or 手動キック routine 別建て

---

## 実装ステップ (= まさ確定後)

1. **Routine 1 (= 議事録)** から実装 (= 最緊急)
   - SKILL.md 起草 → `mcp__scheduled-tasks__create_scheduled_task` で登録 → 翌朝 07:30 まで観察 → upsert 件数確認
2. 動作確認後、**Routine 2 / 3 / 4 を順次** 同パターンで投入
3. 5/22-5/25 の **取り込み穴期間の backfill**: 各 routine に `--backfill-from 2026-05-22` モード追加 or 手動キック routine 別建て
4. **マニュアル 5.4 責務分担マトリクスを更新** (= GAS 153 / 155 を「停止 + 後継 Claude routine 稼働中」に書き換え)
5. **L2_DATA.md 表更新** (= writer 列を Claude routine 名に)

---

## 「TODO おけ待ち」運用

各 routine 投入後、まさ「おけ」をもらってから:
- TODO `completed` 化
- 関連 md (= 03 章 3.1 マトリクス / 5.4 表 / L2_DATA.md) を「✅ 稼働」に更新
- BUGS.md に「5/22-5/25 ghost 期間の復旧記録」を追加
