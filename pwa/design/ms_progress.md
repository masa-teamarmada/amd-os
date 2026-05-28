# MS進捗 (③ L2) — 設計の正本

最終更新: 2026-05-09 (Phase 4 = 毎時 polling 化)
正本ステータス: 進化中。仕様変更したらここを同じ commit で更新する。

マニュアル版: [`pwa/manual/4-8-ms-progress-monthly-report-revision-spec.md`](../manual/4-8-ms-progress-monthly-report-revision-spec.md)。

---

## このドキュメントが扱う範囲

L2 ③ MS進捗 (`milestone_monthly_progress`) の自動更新 cron 全般。

- 1 PJ × 1 ym の `monthly_reports` 本文を LLM に渡し、各 MS の今月の追加進捗% (delta) を推定 → 累積化 → upsert
- 毎時 0 分 polling + `progress_estimate_state.source_hash` 差分検知で、本文が変わってないときは LLM を呼ばずスキップ

⭐ **この md と関連する progress_estimation.md (旧設計) は同居している**。本ファイルが Phase 4 (毎時 polling 化) 後の正本、`progress_estimation.md` は Phase 3 までの設計記録 (履歴)。

---

## Phase の流れ (要約)

| 時期 | 内容 |
|---|---|
| Phase 1 (旧 GAS L1/L2 cron) | `R060_RewardV2_Estimator.gs` の `cron_progressEstimateDaily_()`。`source_cache` を入力。**廃止済**。 |
| Phase 2 (PWA daily) | `cron/daily-estimate` (03:00 daily, PWA)。`monthly_reports.final_content / draft_content` を入力。Sonnet 4.5 で抽出。差分検知なし。 |
| **Phase 4** ⭐ (本仕様) | `cron/hourly-estimate` (毎時 0 分, PWA)。`progress_estimate_state.source_hash` で差分検知。変わってなければ LLM 呼ばずスキップ。**全 L2 毎時 polling 化方針** ([L2_DATA.md](L2_DATA.md)) の最初の実装。 |

---

## なぜ毎時化したか (まさの方針 2026-05-09)

> 「全部の L2 データ取得を 60 分ごとにやっていくの、めちゃくちゃいいかも」

- **リアルタイム性**: 月次レポートを書き換えた直後、最大 1 時間で MS 進捗バーが追従する。daily 03:00 のままだと「翌朝まで反映されない」
- **軽量化**: 1 cron 内で 14 LLM call まで打ち切り。差分検知前提なので何度走らせても無駄ゼロ
- **タイムアウト減**: Vercel Hobby `maxDuration: 60` 秒に近い処理時間。差分検知でほとんど skip されるので実走 < 60 秒
- **公平性**: `last_processed_at` 古い順に処理 → 全 PJ が等しく処理される

---

## ⚠️ Vercel Hobby plan の cron 制約と本構成

**Vercel Hobby plan は cron schedule が "1 日 1 回まで" に制限される** (`0 * * * *` のような毎時 schedule は deploy 時に reject される)。Pro 移行は別件 (まさの判断待ち) なので、当 Phase 4 では:

- `/api/cron/hourly-estimate` route 自体は実装済 (PWA 側に実装、`Authorization: Bearer $CRON_SECRET` 認証)
- **vercel.json の crons から `/api/cron/hourly-estimate` を外す** (= Vercel cron として登録しない)
- **本体GAS の毎時 0 分 time-trigger** から `nav_pwa_pingHourlyEstimate` (`gas/154_PwaCronCaller.js`) で URL を curl で叩く構成

これにより Vercel Hobby のままで毎時 polling が実現できる。Pro 移行したら vercel.json に戻して GAS trigger を消すだけで切り替え可能。

---

## データフロー

```
[毎時 0 分 GAS time-trigger]
   │
   ├─ nav_pwa_pingHourlyEstimate (gas/154_PwaCronCaller.js)
   │     UrlFetchApp で `${PWA_BASE_URL}/api/cron/hourly-estimate` を `Bearer $CRON_SECRET` で GET
   │
[/api/cron/hourly-estimate] (PWA, Vercel)
   │
   ├─ 1. アクティブ PJ 取得 (status='active')
   │
   ├─ 2. target list 構築: 各 PJ × {当月, 前月}
   │     (前月含めるのは月跨ぎ直後 (1日 0-3時) に前月レポートが確定するケースを拾うため)
   │
   ├─ 3. progress_estimate_state.last_processed_at で sort (古い順, NULL 優先)
   │
   ├─ 4. 各 target で estimateProgress(projectId, ym, { force: false })
   │       │
   │       ├─ value_plan_cycles + value_milestones + milestone_sub_items 取得
   │       ├─ project_members + members (codeName) 取得
   │       ├─ 前月までの milestone_monthly_progress 取得 (累積計算用)
   │       ├─ 当月の milestone_monthly_progress 取得 (現在登録値)
   │       ├─ monthly_reports.final_content || draft_content 取得 (50 字未満なら早期 return)
   │       ├─ tsukuyomi_context (tag='reward_estimate', status='active') から system prompt 取得
   │       │
   │       ├─ source_hash 計算 = sha256(JSON({rb, rs, ms, prev, curr, sp}))
   │       │     rb: reportBody, rs: report status, ms: milestones meta,
   │       │     prev: prevMap, curr: currMap, sp: systemPrompt
   │       │
   │       ├─ progress_estimate_state から (project_id, ym) で既存取得
   │       │
   │       ├─ ⚡ force=false かつ existing.source_hash == new_hash:
   │       │     LLM 呼ばずに last_processed_at だけ touch して { unchanged: true } を return
   │       │
   │       └─ ⚙ それ以外:
   │             ├─ tag='routine' のMSは、先に `value_milestones.period_start_ym`〜`target_ym` の月割りで `routine_auto` 進捗を補完
   │             ├─ Sonnet 4.5 で各 MS の delta(progressPct) を抽出
   │             │     success_criteria / sub_items を入力し、成功条件に直結する成果物証拠を優先
   │             ├─ 各 MS について累積化 (newCumPct = min(100, prevCum + delta))
   │             │     スキップ条件:
   │             │       - tag='routine' (定常業務は上記の月割り自動補完に寄せる)
   │             │       - success_criteria があるMSで 80%以上または大幅増分なのに、成果物の完成/提出/確定/レビュー可能を示す直接証拠がない
   │             │       - delta=0
   │             │       - source='pm_manual' / 'pm_confirmed' / 'pm_rejected' / 'criteria_toggle' / 'tsukuyomi_revision' (手動確定済みは上書き禁止)
   │             │       - newCumPct <= 現在登録値 (単調増加のみ保存)
   │             ├─ milestone_monthly_progress に upsert (onConflict: milestone_key, ym)
   │             └─ progress_estimate_state に upsert (source_hash, last_processed_at)
   │
   └─ 5. 1 cron 内で LLM call 数 ≥ maxItems (default 14) になったら hasMore=true で打ち切り
         残りは翌時 cron で処理 (last_processed_at 古い順なので公平に回る)
```

### 1 PJ × 1 ms 単位ではなく 1 PJ 単位を維持した理由

L2_DATA.md には「1 PJ × 1 ms 単位に分解」と書いてあるが、実際には **1 PJ × 全 MS 一括 LLM call** を維持した:

- **MS 間の文脈を保つ**: 「MS 1 が完了 → MS 2 着手」のような MS 横断推論を LLM がしやすい
- **LLM call 回数が増えすぎない**: 1 PJ × 9 MS にすると call 数が 9 倍。差分検知前提とはいえ、レポート初回登録時は全 MS が変わったとみなされて 9 call 必要
- **source_hash で十分な差分検知粒度**: 同じ monthly_report なら全 MS の推定根拠が同じなので、PJ 単位の hash で過不足なく検知できる

---

## 認証 / 呼び出し方

### 本番 (毎時 0 分): GAS time-trigger 経由
```
[GAS] nav_pwa_pingHourlyEstimate (gas/154_PwaCronCaller.js)
   ↓ UrlFetchApp.fetch
GET https://amd-os-pwa.vercel.app/api/cron/hourly-estimate
Authorization: Bearer $CRON_SECRET   # ScriptProperties から取得
```

GAS ScriptProperties:
| キー | 用途 |
|---|---|
| `PWA_BASE_URL` | `https://amd-os-pwa.vercel.app` |
| `CRON_SECRET` | Vercel Production env の `CRON_SECRET` と同じ値 |

setup (1 度だけ):
```sh
# ScriptProperties に PWA_BASE_URL + CRON_SECRET を入れる
SECRET=$(grep '^CRON_SECRET=' /Users/masa/projects/AMD/amd-os/pwa/.env.local | sed 's/^CRON_SECRET=//' | tr -d '"')
ARGS=$(node -e "console.log(encodeURIComponent(JSON.stringify([{PWA_BASE_URL:'https://amd-os-pwa.vercel.app',CRON_SECRET:'$SECRET'}])))")
curl -sL "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=nav_pwa_setProps_&args=$ARGS"

# 毎時 0 分の trigger を立てる
curl -sL "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=nav_pwa_setupHourlyPwaTrigger_"
```

### 手動実行 (curl 直叩き、本番動作確認用)
```sh
# 当月 + 前月 を回す (default)
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://amd-os-pwa.vercel.app/api/cron/hourly-estimate"

# 特定 ym だけ
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://amd-os-pwa.vercel.app/api/cron/hourly-estimate?ym=202605"

# 強制再推定 (差分検知無視)
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://amd-os-pwa.vercel.app/api/cron/hourly-estimate?force=1"

# maxItems 上限を変える (default 14)
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://amd-os-pwa.vercel.app/api/cron/hourly-estimate?maxItems=5"
```

### 手動 UI 「AIで再推定」ボタン
`POST /api/progress/estimate { projectId, ym }` → `estimateProgress(projectId, ym)` (= force = true がデフォルト)。
source_hash を無視して必ず LLM を呼ぶ。

### レポート生成直後の自動推定
`/api/report/generate` 内で fire-and-forget で `estimateProgress(projectId, ym)` (force = true)。

---

## Supabase スキーマ

### `milestone_monthly_progress` (既存、変更なし)

```sql
CREATE TABLE milestone_monthly_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_key TEXT NOT NULL,
  ym TEXT NOT NULL,                          -- yyyymm
  progress_pct NUMERIC NOT NULL DEFAULT 0,   -- 累積進捗% (0..100)
  consumed_pt NUMERIC NOT NULL DEFAULT 0,    -- points * progress_pct / 100
  source TEXT,                                -- 'tsukuyomi_estimate' | 'pm_manual' | 'criteria_toggle' | ...
  confirmed_at TIMESTAMPTZ,
  note TEXT,                                  -- LLM の reason (500 字 max)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(milestone_key, ym)
);
```

### `progress_estimate_state` (新規, migration 029)

```sql
CREATE TABLE progress_estimate_state (
  project_id        TEXT NOT NULL,
  ym                TEXT NOT NULL,
  source_hash       TEXT NOT NULL,
  saved_count       INT  NOT NULL DEFAULT 0,
  skipped_count     INT  NOT NULL DEFAULT 0,
  total_count       INT  NOT NULL DEFAULT 0,
  llm_model         TEXT,
  message           TEXT,
  last_processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, ym)
);

CREATE INDEX idx_pes_last_processed_at ON progress_estimate_state (last_processed_at);
-- RLS: anon, authenticated とも SELECT 可。書き込みは service_role のみ。
```

---

## 主要ファイル

| ファイル | 役割 |
|---|---|
| [pwa/src/lib/progress-estimator.ts](../src/lib/progress-estimator.ts) | **本ロジック正本**。`estimateProgress(projectId, ym, opts?)` |
| [pwa/src/app/api/cron/hourly-estimate/route.ts](../src/app/api/cron/hourly-estimate/route.ts) | 毎時 cron entry。target sort + maxItems 打ち切り |
| [pwa/src/app/api/progress/estimate/route.ts](../src/app/api/progress/estimate/route.ts) | 手動「再推定」ボタン (POST { projectId, ym }) |
| [pwa/src/app/api/report/generate/route.ts](../src/app/api/report/generate/route.ts) | レポート生成成功後の fire-and-forget |
| [pwa/src/components/cockpit/CockpitMonthlyModal.tsx](../src/components/cockpit/CockpitMonthlyModal.tsx) | 進捗確認タブの UI + 「🤖 AIで再推定」ボタン |
| [pwa/scripts/migrations/029_progress_estimate_state.sql](../scripts/migrations/029_progress_estimate_state.sql) | state テーブル DDL |
| [pwa/vercel.json](../vercel.json) | Vercel cron 一覧 (Hobby 制約により `/api/cron/hourly-estimate` は **登録しない**) |
| [gas/154_PwaCronCaller.js](../../gas/154_PwaCronCaller.js) | **GAS 毎時 trigger** から PWA cron を curl で叩く (Hobby 回避策) |

---

## ScriptProperties / 環境変数

Vercel production env vars (本番):

| 変数 | 用途 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase ref 抽出元 |
| `SUPABASE_SERVICE_ROLE_KEY` | RLS 越えて milestone_monthly_progress / progress_estimate_state 書き込み |
| `ANTHROPIC_API_KEY` | Sonnet 4.5 |
| `CRON_SECRET` | `/api/cron/hourly-estimate` 認証 (GAS が `Bearer` で送る) |

⚠️ Vercel local の .env.local に書いただけでは本番に反映されない。`vercel env add` 必要 ([progress_estimation.md](progress_estimation.md) 「環境変数の欠落」参照)。

GAS ScriptProperties:

| 変数 | 用途 |
|---|---|
| `PWA_BASE_URL` | `https://amd-os-pwa.vercel.app` |
| `CRON_SECRET` | Vercel Production env と同じ値 (= 上記表のもの) |

---

## 既知の制約・運用上の注意

- **対象PJ**: cronはactive PJを見に行く。ただしMS進捗抽出はDTSU PJ・エコシステム構築PJ・新規事業創出PJだけ。`projects.project_category in ('dtsu','ecosystem','new_business')` 以外のPJはMS進捗を抽出せず、月次モーダルの月次ノートに毎月の進捗を残す。
- **MS管理対象PJで対象月のMS計画/項目がない場合**: `value_plan_cycles` が無い、または有効な `value_milestones` が無い場合でも `project_config_gap` 通知は出さない。`monthly_reports` + `project_meeting_summaries` を `project_monthly_notes` に保存し、月次モーダルにその月の動きを残す。LLMは呼ばない。
- **monthly_report / meeting summary 本文が無い PJ の場合**: `月次ノートに入れるソースなし` として `progress_estimate_state` だけtouchし、次回 cron で再チェック。
- **pm_manual / pm_confirmed / pm_rejected / criteria_toggle / tsukuyomi_revision で手動確定済みの MS**: LLM が delta を返しても上書きされない。LLM 呼び出し自体はされる (source_hash が変わってれば) が、save 段階でスキップされる
- **confirmed revision lock**: `ms_progress_revisions.status='confirmed'` がある MS は、`milestone_monthly_progress.source` が古い推定値に戻っていても、抽出開始時に `tsukuyomi_revision` として再適用し、LLM保存対象から外す。
- **単調増加のみ保存**: LLM が前月より低い値を返しても save しない。「進捗が下がる」ケースは PM が手動で `pm_manual` で書き換える運用
- **成功条件ガード**: `success_criteria` がある MS では、80%以上または前月から +50%以上の大きな増分を保存するには、成功条件に書かれた成果物が完成・完了・確定・提出・作成済・策定済・レビュー可能になった直接証拠が必要。面談、関心表明、VC/DD開始、準備、着手、進行中だけでは高進捗を保存しない。
- **routine タグ MS**: トラブルがなければ期間按分で毎月進む。`value_milestones.period_start_ym`〜`target_ym` の月数で 100% を割り、対象月までの各月を `source='routine_auto'` で補完する。1年PJなら毎月 `100/12%`。PMが `pm_manual` などで対象月を確定している場合は上書きしない。
- **delta=0**: 「今月は進んでない」を意味する。LLM が 0 を返したら save しない (= 既存値そのまま)
- **`tsukuyomi_context` の system prompt 変更も差分検知に含む**: prompt を更新したら次回 cron で全 PJ が再推定対象になる (意図通り)
- **maxItems 打ち切り**: default 14。アクティブ PJ × 2 ym = 14 を全部 LLM で回せる想定。差分検知でほとんど skip されるので実際の LLM call は 0-3 程度になることが多い
- **Vercel Hobby maxDuration 60秒**: route 自体は `export const maxDuration = 300` で書いてあるが Hobby plan では 60 秒が天井。差分検知で実走 LLM call は少ないので問題は出ない想定。Pro 移行後は 300 秒まで使える
- **手動 UI ボタンの force=true**: 差分検知を意図的に無視。「とにかく再推定したい」というユーザ意図を尊重
- **GAS UrlFetchApp タイムアウト**: GAS 側 fetch のタイムアウトは default で 60 秒程度。本 cron は 60 秒以内に終わる想定なので OK だが、もし PJ が増えて重くなったら `?maxItems=N` を分割呼び出しする
- **本体GAS time-trigger 上限 (1 script 100 個)**: 現状 18+ 個 → 本 trigger 1 個追加で 19+ 個。十分余裕

---

## 過去の差分・履歴

| 日付 | 変更 |
|---|---|
| 2026-04-17 | Phase 2 PWA 実装 (GAS R060 移植 + monthly_reports ベース化、daily 03:00) |
| 2026-04-17 | Vercel env vars 追加 (`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`) |
| 2026-04-17 | 月次モーダル「AIで再推定」ボタン追加 |
| **2026-05-09** | **Phase 4 移行** (本仕様初版): 毎時 polling + `progress_estimate_state` 差分検知 + cron/daily-estimate → cron/hourly-estimate にリネーム + maxItems 打ち切り |
| 2026-05-09 | Vercel Hobby plan の "daily 1 回まで" cron 制約に阻まれて vercel.json から外し、**本体GAS の毎時 trigger から `nav_pwa_pingHourlyEstimate` で叩く構成** に変更 (`gas/154_PwaCronCaller.js` 新規) |

---

## 関連 md

- [`L2_DATA.md`](L2_DATA.md) — L2 全体の設計、Phase 4 全 L2 毎時化方針の入口
- [`progress_estimation.md`](progress_estimation.md) — Phase 1〜2 の経緯 (歴史記録)
- [`meeting_summaries.md`](meeting_summaries.md) — Phase 3 で確立した「毎時 polling + source_hash」パターンの原型
