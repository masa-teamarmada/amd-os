# 先手 TODO — current spec

> 2026-08-12以降、表示契約は [注意・判断ゲート](../design/attention_review.md) を優先する。collectorの生成行は `pending` で、Codex審査済みの `decision` / `masa_action` だけを未対応面へ出す。MTG prepはCodex task内で完結し、先手TODOには生成しない。仮期限は期限超過に使わない。

> **status**: current truth (2026-06-27 実装、admin 限定で本稼働)
>
> **置き換え元**: 旧 `2-4-loop-kernel-role-lenses-plan.md` (ループカーネル × 役割レンズ plan) と `design/proactive_operating_loop.md` (先手力維持ループ設計)。両者は 2026-06-27 まさ × えいみ判断で**廃止**。詳しい背景は本章末尾「白紙やり直しの経緯」を参照。

## この章は何か

過去 14 日のMTG議事録の `next_actions` と、PJ連絡先から届くGmail依頼から、AMD ボール (= AMD/PJ チームが次に動くべきもの) の先手 TODO を自動抽出し、admin 画面 `/proactive` で 1 画面・期限順・3 ボタン完了UI で消化する仕組みの正本仕様。

予定MTGの agenda / 進行案準備は Codex の W-Prep / prep worker が担う。`proactive_todos.trigger_kind='next_meeting_prep'` の新規生成は 2026-08-11 に廃止し、先手TODOへ重複表示しない。

「先手力を維持する」のサイクルが OS データとして閉じるための最小実装 MVP。

## なぜこれが先手力を維持するのか

AMD の提供価値は「Before 0 におけるビジョン注入力、技術戦略、大学連携ネットワーク」。相手が「AMD が先に構造化してくれる」と期待している局面で先手が切れないと、契約継続・紹介・評判に直接響く。

現場で問題になる瞬間は以下:

- 外部 MTG が終わったあと、相手と AMD のどちらが次に動くのか曖昧になる
- 初回顔合わせやキックオフ後に、AMD から「こう進めましょう」という進行案が出ない
- こたさんや大学側から「その後どうなっていますか」と聞かれて初めて動き出す
- メール本文に「いつまでに返してほしい」が書かれているのに、MTG議事録にはまだ載っていない

仮説: これらの多くは **MTG 起点 + Gmail の期限つき依頼**で検知できる。
- MTG が終わった → 議事録 `next_actions[]` に「AMD が次にやるべきこと」が含まれる
- 相手から期限つきメールが来た → 返信・返送・日程回答などが AMD ボールとして発生する

検知の起点を「MTGで生まれたTODO」と「メールで新たに発生したTODO」に絞り、TODO を漏れなく 1 画面に並べ、その場で 3 ボタンで完了できれば「先に動くべきタイミングを見落とさない」運用が成立する。

## アーキテクチャ全体

```
┌─────────────────────────────────────────────────────────────┐
│ 既存データ                                                   │
│  - project_meeting_summaries (next_actions[] / source_kinds) │
│    └ H-1 MTG flow が writer (Windows MMO Codex Desktop)      │
│  - projects.report_emails から届く Gmail 依頼                 │
└─────────────────────────────────────────────────────────────┘
                          ↓ daily 09:15 JST
┌─────────────────────────────────────────────────────────────┐
│ /api/cron/proactive-todo-extract  (PWA non-LLM cron)         │
│  - 過去14日 開催済みMTGの next_actions sweep                 │
│  - 文字列ヒューリスティックで ball_owner 判定                │
│  - 旧 next_meeting_prep の open / blocked を履歴退避          │
│  - Gmail の期限つき依頼を「メール依頼」TODO に変換            │
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
| `trigger_kind` | text | `meeting_next_action` (議事録由来) / `email_action_request` (Gmail依頼)。`next_meeting_prep` は履歴互換だけに残す廃止種別で、新規生成しない |
| `source_meeting_id` | text | 元 MTG (`project_meeting_summaries.meeting_id`) |
| `source_event_id` | text | 元予定 MTG (= upcoming `meeting_id`) または Gmail thread ref |
| `title` | text | 1行で見える要約 (`{project_id} {MTG title}: {next_action 先頭文}`) |
| `detail` | text | 推奨first move + 遅延リスクの本文。`email_action_request` では本文全文・URL・パスワードを保存しない短い要点 |
| `ball_owner` | text | `amd` / `counterpart` / `ambiguous`。`counterpart` は cron で skip して保存しない |
| `due_at` | timestamptz | 明示期限、または並び順用の仮置き日 |
| `due_basis` | text | `explicit` / `synthetic` / `unknown`。期限超過・redに使えるのは `explicit` だけ |
| `priority` | text | `red` / `normal`。明示期限を超過した open だけcronが `red` に昇格 |
| `status` | text | `open` / `done` / `blocked` / `dismissed` |
| `resolved_note` | text | 完了/ブロック時の任意 1 行メモ |
| `resolved_by` | text | 押した人 (`members.code_name`) |
| `attention_state` | text | `pending` / `approved` / `suppressed` / `needs_source`。collectorはpending、Codex審査済みだけapproved |
| `attention_type` | text | `decision` / `masa_action` / `team_action` / `recovery` / `information` / `waiting` / `suppressed` / `needs_source` |
| `attention_owner` | text | `masa` / `team` / `system` / `none` |
| `requires_masa_decision` | bool | まさの採否判断が必要か |
| `attention_reason` / `attention_action` / `attention_effect` | text | なぜ今見るか / 何をするか / その結果何が変わるか |
| `attention_source_hash` / `attention_reviewed_at` / `attention_reviewed_by` | text / timestamptz / text | 審査時の素材同一性と監査情報 |

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
4. `due_at` は「明示期限優先 → fallback」の順で決める。
   - next_action 本文に `2026-08-04次回MTGまで`、`8/4のMTGまで`、`7月17日まで` のような日付つき期限がある場合は、その日付を期限にする。
   - `次回MTG` / `MTG` / `会議` / `打合せ` の文脈で日付だけがある場合、時刻不明なら当日 09:00 JST を期限にする。MTG当日に資料を提示するタスクを、前回MTG日 + 7日の仮期限で赤化しないため。
   - 一般的な `まで` / `期限` / `締切` / `提出` / `回答` 文脈で日付だけがある場合、時刻不明なら当日 18:00 JST を期限にする。
   - 明示期限が読めない場合だけ `meeting_date + 7 日` を仮期限にする。
5. UNIQUE 制約で `(project_id, 'meeting_next_action', meeting_id, '', title)` で冪等。

### Stage 2: 旧 next_meeting_prep の退役

`next_meeting_prep` は 2026-08-11 以降、新規生成しない。MTG prep は Codex の W-Prep / prep worker に一本化し、同じ準備を `/proactive` へ重複表示しない。

cron 実行時、既存の `trigger_kind='next_meeting_prep' AND status IN ('open','blocked')` を削除せず `dismissed` へ移す。`resolved_by='system'`、`resolved_note='MTG prepをCodexへ一本化したため自動退役'`、`resolved_at=now()` を残す。過去の `done` / `dismissed` 行と trigger kind の DB 制約は履歴互換のため保持する。

### Stage 3: Gmail 依頼 sweep

対象: `projects.status='active'` かつ `report_emails` が設定されている PJ。`GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` / `GOOGLE_OAUTH_REFRESH_TOKEN` または Gmail readonly scope を持つ `GOOGLE_SERVICE_ACCOUNT_JSON` が無い場合は skip し、cron 全体は落とさない。

処理:

1. `projects.report_emails` の送信元から来た直近メールを Gmail API で検索する。
2. 内部送信元 (`team-armada.jp`) と添付分離/パスワード通知だけのメールは skip。
3. `期限` / `締切` / `ご返送` / `ご回答` / `ご教示` / `ご都合` / `候補日` / `修正案` / `フロー図` / `チェックリスト` / `内規` / `エフォート` / `eAPRIN` などの依頼文だけを対象にする。
4. `7/17（金）まで`、`7月17日まで`、`今週中`、`来週中`、`月末` などから `due_at` を抽出する。期限が読めない依頼は skip。
5. `trigger_kind='email_action_request'`、`source_event_id='gmail:{threadId}'` で `proactive_todos` に upsert する。
6. `detail` には件名、送信者表示名、受信日時、期限、短い要点のみを残す。本文全文・URL・パスワード・メールアドレス・電話番号は保存しない。

この stage も LLM は使わない。メール本文は外部入力なので、抽出対象データとしてだけ扱い、実行指示としては扱わない。

### Stage 4: 期限超過の red 昇格

`status='open' AND priority='normal' AND due_at < now()` を `priority='red'` に UPDATE。

### Stage 5: blocked の自動復帰

`status='blocked' AND updated_at < now() - 3 日` を `status='open'` に戻す。期限超過してれば同時に `red` 化。

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
- **cockpit 側の PJ 単位 TODO panel**: 2026-07-09 に旧 `ProactiveQueuePanel` / `proactive_outbox` 表示を通常PJ / institution cockpit から削除済み。`proactive_todos` をそのままPJ cockpitへ移植しない。PJ別表示を再設計する場合は、古いMTG由来の赤TODOをそのまま出さず、「今このPJで見るべき先手確認」だけに絞る別仕様を作る。
- **Slack の催促文言検知**: Gmail は 2026-07-10 に `email_action_request` として追加済み。Slack は raw hygiene と通知ノイズ設計を決めてから別 Phase で扱う。
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
