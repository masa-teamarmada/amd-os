# 先手 TODO — current spec

> **status**: current truth (2026-06-27 実装、admin 限定で本稼働)
>
> **置き換え元**: 旧 `2-4-loop-kernel-role-lenses-plan.md` (ループカーネル × 役割レンズ plan) と `design/proactive_operating_loop.md` (先手力維持ループ設計)。両者は 2026-06-27 まさ × えいみ判断で**廃止**。詳しい背景は本章末尾「白紙やり直しの経緯」を参照。

## この章は何か

過去 14 日のMTG議事録の `next_actions` と、7 日以内に開催される予定MTGから、AMD ボール (= AMD/PJ チームが次に動くべきもの) の先手 TODO を自動抽出し、admin 画面 `/proactive` で 1 画面・期限順・3 ボタン完了UI で消化する仕組みの正本仕様。

「先手力を維持する」のサイクルが OS データとして閉じるための最小実装 MVP。

## なぜこれが先手力を維持するのか

AMD の提供価値は「Before 0 におけるビジョン注入力、技術戦略、大学連携ネットワーク」。相手が「AMD が先に構造化してくれる」と期待している局面で先手が切れないと、契約継続・紹介・評判に直接響く。

現場で問題になる瞬間は以下:

- 外部 MTG が終わったあと、相手と AMD のどちらが次に動くのか曖昧になる
- 初回顔合わせやキックオフ後に、AMD から「こう進めましょう」という進行案が出ない
- 次回 MTG 前に、本来こちらから agenda / roadmap / 提案書を出すべきなのに、準備が見えない
- こたさんや大学側から「その後どうなっていますか」と聞かれて初めて動き出す

仮説: これらの 80% は **MTG 起点**で検知できる。
- MTG が終わった → 議事録 `next_actions[]` に「AMD が次にやるべきこと」が含まれる
- 次回 MTG が近い → agenda / 進行案を先に出す必要がある

検知の起点を MTG に絞り、TODO を漏れなく 1 画面に並べ、その場で 3 ボタンで完了できれば「先に動くべきタイミングを見落とさない」運用が成立する、というのがこの MVP の賭け。

## アーキテクチャ全体

```
┌─────────────────────────────────────────────────────────────┐
│ 既存データ                                                   │
│  - project_meeting_summaries (next_actions[] / source_kinds) │
│    └ H-1 MTG flow が writer (Windows MMO Codex Desktop)      │
│  - source_kinds='upcoming' な未来MTG                         │
└─────────────────────────────────────────────────────────────┘
                          ↓ daily 09:15 JST
┌─────────────────────────────────────────────────────────────┐
│ /api/cron/proactive-todo-extract  (PWA non-LLM cron)         │
│  - 過去14日 開催済みMTGの next_actions sweep                 │
│  - 文字列ヒューリスティックで ball_owner 判定                │
│  - 7日以内の upcoming MTG に「agenda準備」TODO               │
│  - 期限超過 open を red に昇格                               │
│  - 3日経過 blocked を open に復帰                            │
└─────────────────────────────────────────────────────────────┘
                          ↓ UNIQUE upsert
┌─────────────────────────────────────────────────────────────┐
│ proactive_todos (新規テーブル、migration 157)                │
│  status: open / done / blocked / dismissed                  │
└─────────────────────────────────────────────────────────────┘
                          ↓ admin auth
┌─────────────────────────────────────────────────────────────┐
│ /proactive  (ProactiveTodoBoard.tsx)                        │
│  全PJ横断・期限順・3ボタン (✅完了 / ⏸ブロック / 🗑関係ない) │
│  + dashboard 上段に件数バッジ (ProactiveTodoBadge.tsx)       │
└─────────────────────────────────────────────────────────────┘
```

## データモデル

正本 migration: `pwa/scripts/migrations/157_proactive_todos.sql`
正本 schema dump: `pwa/design/db_schema.md` → `proactive_todos` セクション

主要列:

| 列 | 型 | 意味 |
|---|---|---|
| `id` | uuid | PK |
| `project_id` | text | 対象 PJ |
| `trigger_kind` | text | `meeting_next_action` (議事録由来) / `next_meeting_prep` (次回MTG準備) |
| `source_meeting_id` | text | 元 MTG (`project_meeting_summaries.meeting_id`) |
| `source_event_id` | text | 元予定 MTG (= upcoming `meeting_id`) |
| `title` | text | 1行で見える要約 (`{project_id} {MTG title}: {next_action 先頭文}`) |
| `detail` | text | 推奨first move + 遅延リスクの本文 |
| `ball_owner` | text | `amd` / `counterpart` / `ambiguous`。`counterpart` は cron で skip して保存しない |
| `due_at` | timestamptz | 期限。`meeting_next_action` は MTG 日 + 7 日、`next_meeting_prep` は MTG 開始 - 1 日 |
| `priority` | text | `red` / `normal`。期限超過 open は cron が `red` に昇格 |
| `status` | text | `open` / `done` / `blocked` / `dismissed` |
| `resolved_note` | text | 完了/ブロック時の任意 1 行メモ |
| `resolved_by` | text | 押した人 (`members.code_name`) |

UNIQUE 制約:
`(project_id, trigger_kind, source_meeting_id, source_event_id, title)` で、同じ MTG の同じ next_action に対する upsert を冪等化する。

RLS:
admin (= `members.is_admin = true`) と `service_role` のみ ALL。anon SELECT は付与しない。経営機微 (相手側に出す前の進行案、催促予兆) を含むため。

## 自動抽出 cron

正本: `pwa/src/app/api/cron/proactive-todo-extract/route.ts`

スケジュール: daily 09:15 JST (Vercel cron `"15 0 * * *"` = 00:15 UTC)。MVP は daily 運用。Vercel Hobby plan の cron 制限のため毎時運用は不可、頻度が足りないと体感したら Pro へアップグレードするか Mac LaunchAgent / Codex automation 経由で毎時化する選択肢を取る。
- `pwa/vercel.json` の `crons` に登録。
- 認証: `Authorization: Bearer ${CRON_SECRET}` (= Vercel 環境変数)。

### Stage 1: 開催済みMTGの next_action sweep

対象: 過去 `LOOKBACK_DAYS=14` 日かつ `source_kinds NOT IN ('upcoming', 'none')` の `project_meeting_summaries`。

各 `next_actions[]` テキストに対し:

0. **文字化け guard**: `meetingTitle` または `text` が `isGarbledText` (連続 3 個以上の `?`、または ASCII `?` が 30% 超) なら skip。化けた summary が修復されるまで通知に出さない。
1. テンプレ next_action (`関連資料.*前回までの論点.*当日確認` 正規表現にマッチ) は skip。
2. `detectBallOwner(text, amdMemberNames)` で主語を判定:
   - **counterpart**: 「○○氏」「○○さん」「○○先生」「○○教授」「○○社長」「○○代表」「相手側」「先方」「○○大学側」が主語の文。「○○氏と××氏は」のような並列も counterpart
     - H-1 next_actions の担当者prefix形式 (`杉浦さん: ...`, `軽部さん: ...`, `○○先生: ...`) は、prefix 名が `members` の active AMD メンバー名 / code_name に一致しない限り counterpart。AMD 側から相手へ依頼・調整する文 (`○○先生に依頼する`, `○○さんから受領する`) は、非AMD担当者のTODOとは扱わない。
   - **amd**: 以下のいずれか:
     - AMD メンバー実名 (フルネーム/姓だけ/コードネーム) が冒頭 40 文字以内に主語または担当者prefixとして現れる (`{name}は/が/と/に/を/から/の`, `{name}さん:` など)。`members` テーブルから実行時 fetch
     - 「AMD側」「アルマダ」「SX側/CX側/CryoX側/ZeMA側 等の PJ コード/プロダクト名側」「えいみ/つくよみ/まさ」「こちら/当方/当社/当チーム」
   - **ambiguous**: 上記いずれにも該当しない (= AMD ボール扱いで TODO に積む。漏れない方針)
3. `counterpart` 判定なら skip (= counterpart は本 cron では保存しない)。`amd` / `ambiguous` のみ upsert。
4. `due_at = meeting_date + 7 日`。
5. UNIQUE 制約で `(project_id, 'meeting_next_action', meeting_id, '', title)` で冪等。

### Stage 2: 次回MTG準備 TODO

対象: `source_kinds = 'upcoming'` かつ `meeting_date >= today` の `project_meeting_summaries` のうち、`meeting_start_at` が現在時刻より後のもの。開始時刻を過ぎた予定MTGから新しい準備TODOを作らない。

7 日以内 (土日除外) に開催される MTG のみ TODO 化。`meetingTitle` が `isGarbledText` なら skip (= 「??? の準備をする」通知を出さない)。

- `title = {project_id} {MTG title}: agenda / 進行案を先に提示する`
- `detail = {meeting_date} 開催予定。AMD から agenda / 進行案 / 論点表を先に出して、相手側が議論をリードする状態を避ける。`
- `ball_owner = 'amd'` (= 進行案出しは必ず AMD)
- `due_at = MTG 開始 - 1 日`

### Stage 3: 期限超過の red 昇格

`status='open' AND priority='normal' AND due_at < now()` を `priority='red'` に UPDATE。

### Stage 4: blocked の自動復帰

`status='blocked' AND updated_at < now() - 3 日` を `status='open'` に戻す。期限超過してれば同時に `red` 化。

### Stage 5: MTG開始後の準備TODO自動終了

`trigger_kind='next_meeting_prep'` の `open` / `blocked` TODO は、紐づく予定MTGの `meeting_start_at` が現在時刻を過ぎたら `done` へ自動更新する。これは「会議前にagenda/進行案を出す」という準備TODOが、会議開始後も赤い未対応として残り続けることを防ぐための出口。

自動終了時は `resolved_by='system'`、`resolved_note='MTG開始時刻を過ぎたため自動終了'` を保存する。会議後の本当の次アクションは Stage 1 の開催済みMTG `next_actions[]` から別TODOとして抽出する。

### 課金 LLM 不使用

このルートは AMD OS の課金 LLM cron 禁止ルール (`pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md` 「追加課金ゼロ境界」) に従い、Anthropic / OpenAI / Gemini の従量 API を呼ばない。AMD ボール判定は文字列ヒューリスティック (`COUNTERPART_SUBJECT_PATTERNS` / `AMD_SUBJECT_PATTERNS`) のみで完結する。

## UI

### `/proactive` (admin 専用フルページ)

- ルート: `pwa/src/app/(app)/proactive/page.tsx`
- 本体: `pwa/src/components/proactive-todo/ProactiveTodoBoard.tsx`
- 権限: server 側で `members.is_admin` を確認、非 admin は `notFound()`
- タブ: 未対応 / ブロック中 / 完了 / 関係ない (= status 4 状態)
- 並び順: priority asc, due_at asc (= 期限切迫順)
- 行: 期限chip + 検知種別chip + ボール種別chip + PJ名 + title
- 展開: クリックで detail + メタ情報 + 3 ボタン
- AMD メンバー名表示: title / detail / resolved_by / resolved_note に active AMD メンバーの本名・姓+敬称 (`山地さん` など)・active member 内で一意な姓 (`[owner: 山地]` など) が混ざった場合、表示時に `members.code_name` へ正規化し、`/mypage?memberId=<members.member_id>` へリンクする。raw の `proactive_todos` 本文は検証用に保持してよいが、OS UI では本名のまま出さない。
- 3 ボタン:
  - ✅ **完了** → `status='done'`, `resolved_at=now()`
  - ⏸ **ブロック中** → `status='blocked'` + 任意1行メモ、3日後 cron が `open` 復帰
  - 🗑 **関係ない** → `status='dismissed'`, 二度と cron が同じ key で作らない
- 3 ボタン押下後はリスト全体を即時再読込しない。押したカードだけをその場で「完了にした / ブロック中にした / 関係ないにした」として約 3.5 秒表示し、現在タブから外れる status ならその後に一覧から除去する。除去時は隣接カードの位置を維持し、ページ最上部へ戻さない。
- done/dismissed タブからは「未対応に戻す」ボタンで `open` 復帰可能

### dashboard 上段バッジ

- 本体: `pwa/src/components/proactive-todo/ProactiveTodoBadge.tsx`
- 埋め込み先: `pwa/src/app/(app)/dashboard/page.tsx`
- admin のみ表示。非 admin は `null` 返却 (枠ごと消える)
- 表示: 件数 (open / overdue / red) + `/proactive` へのリンク 1 つ
- 状態色: overdue/red あり = 赤、open あり = amber、なし = 平常

### 完了 API

正本: `pwa/src/app/api/proactive-todos/[id]/resolve/route.ts`

- `POST /api/proactive-todos/:id/resolve`
- body: `{ action: 'done' | 'blocked' | 'dismissed', note?: string }`
- 認証: server cookie auth + `members.is_admin` 確認
- `resolved_by` は `members.code_name`

## 未対応・今後の Phase

MVP では以下は持たない:

- **`sent` 状態 (相手にボールを渡した)**: 必要性が見えたら追加 (まさ判断 2026-06-27)
- **cockpit 側の PJ 単位 TODO panel**: 既存 `CockpitView.tsx` が `ProactiveQueuePanel` を使ってるが、これは旧 `proactive_outbox` 由来。本 spec の置き換えでは触らず、dashboard 側だけ刷新した。cockpit 側の置き換えは別 Phase
- **Gmail / Slack の催促文言検知**: MTG 起点で 80% カバーできる仮説に賭けて MVP では作らない
- **完了 → 学習段への流し込み**: `resolved_note` を AMD Protocol / textbook insight 候補へ流す Step 3 は未着手
- **判断 → 実行 → 学習 のループ閉鎖**: 旧 spec 2-4 で書いた「ループ成立の 4 遷移」は廃止。「先手 TODO リスト」単機能として割り切り、学習接続は出来たら別 Phase で

## 白紙やり直しの経緯 (2026-06-27 まさ × えいみ判断)

直前の状態:

- 2026-05-31 `pwa/design/proactive_operating_loop.md` で先手力維持ループ (proactive_outbox + heartbeat + 司令塔通知) を設計
- 2026-06-12 `2-4-loop-kernel-role-lenses-plan.md` で 5 段ループカーネル (`/loop`) + dashboard 上段の `LoopKernelBoard` 埋め込みを実装

問題:

1. 5 段盤面のうち先手力維持と関係するのは「実行」段だけだったが、その実行段に完了 UI が無く、超過 666h の seed が残骸として叫び続けた
2. Phase 2 の自動検知 (heartbeat、Gmail 催促検知) は未稼働、`proactive_outbox` は手動 seed のみ
3. 「司令塔セッションのえいみ → worker」というワークフローが Codex 側で実装試行されたが、運用上機能しなかった (= 司令塔セッションは廃止)
4. heartbeat の受け側 (= 司令塔セッション) が消えた以上、旧設計の前提が崩れた

まさ判断:

1. 5 段ループ盤面 (`/loop`、`LoopKernelBoard.tsx`、dashboard 埋め込み) は捨てる
2. 「先手 TODO リスト」1 画面に作り直す
3. 検知はえいみが自動で行う (= MTG 起点の cron で半自動投入、文字列ヒューリスティック)
4. まさが押すのは最終手段、原則 cron で積み続けて完了ボタンだけ押す運用

実装ファイル境界 (この章の current truth):

- migration: `pwa/scripts/migrations/157_proactive_todos.sql`
- cron: `pwa/src/app/api/cron/proactive-todo-extract/route.ts`
- 完了 API: `pwa/src/app/api/proactive-todos/[id]/resolve/route.ts`
- フルページ: `pwa/src/app/(app)/proactive/page.tsx` + `pwa/src/components/proactive-todo/ProactiveTodoBoard.tsx`
- dashboard バッジ: `pwa/src/components/proactive-todo/ProactiveTodoBadge.tsx`
- vercel cron 登録: `pwa/vercel.json` `crons[]` 末尾
- scheduled-tasks 索引: `pwa/scheduled-tasks/README.md` の Routine 一覧に追記
