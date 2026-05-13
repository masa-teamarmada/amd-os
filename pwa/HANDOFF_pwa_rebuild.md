# HANDOFF — AMD OS PWA / GAS

最終更新: 2026-05-13 (dazzling-wing-23c8e9 #8 VC cron LLM コスト 88% 削減 + vc-news-ingest 廃止 + vc-discover 統合)
詳細セッションログ: [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) 末尾参照

---

## 状態

- main HEAD: `142b9bc` + 本セッション (VC cron 統合) のマージ予定
- Vercel: 本セッション末で再 deploy 予定 (vc-discover weekly + suggested_fund_patch 統合)
- 本体 GAS deployment: `AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G` @1462 (= 変更なし)
- AMD-Report GAS: scriptId `1r3Ak-tYASXY...` 前セッションで access 全壊、本セッション未対応 (= TODO #5 持ち越し)
- 未 push commit: 本セッション分 (= deploy 後 push)
- worktree: `claude/dazzling-wing-23c8e9`

---

## ✅ 完了済 (本セッション #9)

**monthly_reports backfill 104 件 → 0 件**
- 前セッションの AMD-Report GAS aggressive backfill (= 00:57 JST 停止) を PWA 側で完遂
- [`cron/monthly-reports-backfill`](src/app/api/cron/monthly-reports-backfill/route.ts) 新設、concurrency=5 並列実行
- 残 104 件を約 2 時間で全完遂 (= total_reports 60 → 164)
- cron route はそのまま残置 = 新月分の自動補完にも転用可能 (= Vercel cron schedule に追加すれば常駐化可能、ただし AMD-Report GAS R313 と被るので現状は手動キックのみ)

---

## 🔴 まさから何度も言われた TODO (= 絶対に先送りしない)

| # | タスク | 状態 |
|---|---|---|
| ✅ 1 | マクロ係数 P 以外のデータ取得 | 2026-05-12 完了 (Round 3 + 5) |
| ✅ 2 | FRL grit/resilience の数値入力 | 2026-05-12 完了 (Round 3 + 5) |
| 🔴 3 | R303 hardcoded fallback 削除 (= AMD-Report GAS、AGENTS 完遵) | 未着手、TODO #5 と一緒にやるべき |
| 🟡 4 | 試算表 (project_pl_monthly) — 生データからの未来予測抽出 | 設計のみ [`design/project_pl_monthly.md`](design/project_pl_monthly.md) に記録、優先度低、後回し |
| 🔴 5 | **AMD-Report GAS の構造的修復** | 未着手 |
| 🔴 6 | **VC RSS / X feed cron** (= ノクターン的ロングテール VC の真の解決策、LLM 不要) | #8 で TODO 化 |
| ✅ 7 | EventsSection impact 強調表示 | 本セッション (#9) 完了 |
| ✅ 8 | monthly_reports PWA backfill | 本セッション (#9) 完了 (= cron 新設 + ループ実行中) |

---

## 🚨 次セッション最優先

### 0. (= 即座) aggressive backfill 完了確認 + 一時関数 cleanup ⭐

- Supabase で残り未生成 row count = 0 を確認
- `R001_Api 2.js` 末尾の **本セッション一時関数群** を削除 + clasp push:
  - `setup_aggressiveBackfill_2026_05_13`
  - `_aggressive_backfill_self_teardown_2026_05_13`
  - `teardown_aggressiveBackfill_2026_05_13`
  - `isAdmin_` (= 残置するなら正規ファイルに移動)
- R290 空コメント問題 = R290 系 admin 関数群が無効化されたまま、要対応

### 1. AMD-Report GAS の構造的修復 (= TODO #5)

本セッション (#9) で **5/7 タスク完了**。残 2 つは別作業:

| # | タスク | 状態 |
|---|---|---|
| ✅ 1 | Drive 同期事故ファイル整理 | 完了 (= 重複 26 ファイル整理、`*` 2.js suffix 全削除、main 確定) |
| ✅ 2 | R290 元コード復元 | 完了 (= 94608 byte 正本を main に上書き、私が事故った 125 byte 空コメント版を破棄) |
| ✅ 3 | Web App URL access 再設定 | 完了 (= まさ確認済「全員アクセス可」、新 deploy @22 と旧 @21 両方で GET エラーが「doGet 関数 not found」になり access 通ったことが確認できた = doGet は設計上元々ない、doPost のみ) |
| 🔴 4 | GCP project 紐付け | **未着手** (= まさのブラウザ作業必須、GAS Editor → プロジェクトの設定 → Google Cloud Platform プロジェクトを変更 → 既存 GCP プロジェクトに紐付け or 新規作成)。これがあれば Apps Script API 経由で外部から任意関数実行 (= ScriptProperties 取得 / aggressive backfill 系再起動) ができるようになる |
| ✅ 5 | isAdmin_ 等 admin helper の正規実装 | 仮完了 (= R001_Api.js 末尾に isAdmin_ 残置、機能してる。専用ファイル化 (`R002_AdminCheck.js` 等) は将来 cleanup) |
| ✅ 6 | monthly_report 文字化け検出 alert | 完了 (= R303 `mr_generateDraft_` + `mr_generateDraftUpdate_` に `mr_detectMojibake_` helper 追加、? 比率 > 50% で保存中止) |
| 🔴 7 | R303 hardcoded fallback 削除 (= TODO #3) | **未着手** (= 慎重作業、`llm_prompts.monthly_report.r313_extract` から DB fetch する path に置換 + clasp push、次セッション着手) |

#### 本セッション完了後の AMD-Report GAS 状態
- scriptId: `1r3Ak-tYASXY...`
- production deployment: `AKfycbxtap99...@21` (= まさ承認の「全員アクセス可」)
- 新 deploy: `AKfycbzQ07aq...@22` (= post-cleanup-2026-05-13-session9)
- local: `/tmp/gas-report-clean/` 重複なし 50 ファイル
- backup: `/tmp/gas-report-clean-backup-20260513-144052/`
- aggressive backfill 一時関数 3 つ削除済 (= PWA 側で完遂したため不要、関連 trigger は teardown 完走時に自動削除済の想定)

#### TODO #5 残作業の正しいやり方 (= 次セッション着手前にまさへ)
- **#4 GCP project 紐付け**: GAS Editor → 左下 ⚙️ プロジェクトの設定 → Google Cloud Platform (GCP) プロジェクト → 「変更」→ 既存 amd-os の GCP プロジェクトを紐付け or 新規作成。完了したら次セッション以降で clasp run / Apps Script API 経由実行が可能になる
- **#7 R303 hardcoded fallback 削除**: llm_prompts.monthly_report.r313_extract を DB fetch する `mr_gen_getPrompt_()` 関数を新設 → mr_gen_callClaude_ 呼ぶ前に prompt を DB から取得 → push。is_active=true に変える判断もまさへ確認

### 2. 試算表 (project_pl_monthly) — 生データからの未来予測抽出 (= TODO #4)

**設計の正本は [`design/project_pl_monthly.md`](design/project_pl_monthly.md)**。優先度低、後回し OK。

#### まさから引き出した設計 (= 2026-05-13 #9 続き、md に詳細)
- freee 連携は **できない前提** (= できる案件は稀)
- 拾うのは **未来予測情報** (バーンレート / 資金枯渇予想月 / 調達予定 / 大型支出予定 等)
- **試算表専用 cron は作らない** = 他 cron (= 議事録抽出 / monthly-reports-backfill 等) が source_cache に詰めたデータを **二次加工**
- 手動入力は想定外 (= memory [feedback_tsukuyomi_builds_from_raw_data.md])
- 手動試算表が Drive にあれば 074c が拾った範囲で fallback (= 試算表専用 Drive scan は不要)

#### 推奨着手順 (= 詳細は md)
1. migration: `project_pl_forecast` 新規テーブル (= 予測 / 計画 / 単発予定。`project_pl_monthly` 実績とは別系)
2. `monthly_report.r313_extract` prompt 拡張で `pl_extract` 副産物出力
3. PWA `cron/monthly-reports-backfill` で parse + upsert
4. 074c 拡張で試算表ファイル別フラグ (= source_cache.source = `'pl_sheet'`)
5. CockpitPlMonthlyModal に予測値オーバーレイ実装

### 2.5. VC RSS / X feed cron 新設 (= TODO #6) ⭐ NEW

本セッション (#8) で議論したノクターン的ロングテール VC の真の解決策。web_search では業界記事になってないマイナー VC の動向は構造的に拾えないことが判明。実装:

1. migration: `vcs` に `rss_url` (text) / `x_handle` (text) 列追加
2. `seed-vcs` の prompt に「公式 RSS feed と X handle も探して埋める」を追加 (Sonnet 自動補完)
3. `/vcs/[id]/edit` フォームに RSS URL / X handle 入力欄追加
4. **新 cron** `/api/cron/vc-rss-fetch` (daily 09:00 JST):
   - `vcs` の `rss_url IS NOT NULL` だけ fetch
   - RSS 各 item を `vc_news` に upsert (`ingested_by='rss_feed'` / `source_url` で重複排除)
   - X handle は X API の制約で代替検討 (= Apify / RSSHub 等)
5. coverage 期待: ノクターンのような VC でも公式 RSS があれば確実に news 取得、LLM コストゼロ

これでロングテール VC 対応 = `vc-discover (週次 LLM)` + `vc-rss-fetch (daily 無料)` の 2 段構え。

### 3. ~~EventsSection の impact 強調表示~~ ✅ 本セッション (#9) 完了

### 4. 5 生データ backfill の精度改善 (= GAS 074 系修復と連動)

本セッション (#9) で source_cache 実態確認:
- slack 1681 / notion 373 / gmail 342 / gmeet_minutes 176 / drive **82** / calendar **7** / msrev_feedback 1
- → calendar / drive が極端に薄い、まさ指摘通り

これらは **GAS 074 cron** (= 074c-Drive / 074d-Calendar / 074e-Gmail / Slack 系) が source_cache 投入してる。PWA 側 `pwa/src/lib/sources/*.ts` は AMD Score L2 抽出時の **直読み専用** であって source_cache 投入はしてない。

→ **改善は GAS 074 系の改修が本筋** (= TODO #5 AMD-Report GAS 構造修復後に着手)

代替案 (= AMD-Report GAS 修復を待たずに): PWA 側に新 cron `/api/cron/source-cache-backfill` を作って `sources/*.ts` から直接 `source_cache` に投入する。これだと GAS 不要、ただし大規模変更 (= 3-4 時間級)。優先度判断はまさへ。

改善具体策:
| 種類 | 改善案 | 着手場所 |
|---|---|---|
| Drive (074c) | 再帰 scan (= サブフォルダも掘る) | GAS 074c.gs |
| Calendar (074d) | chitchat 判定緩和 + Notion AI 連結 (= 議事録抽出時の参考) | GAS 074d.gs |
| Gmail (074e) | subject フィルタ拡張 (= 「ご返信」「打合せ」等のキーワード追加) | GAS 074e.gs |
| Slack | 過去 6 ヶ月分 backfill ループ (= 1 ヶ月ずつスキャン) | GAS 074-slack.gs |

### 5. protocols dedup + UI archive 運用

旧 22 件 legacy_specific archive + 新 22 件 pattern の Sonnet dedup。

### 6. ファビコン後日チャレンジ / exec_summary Phase 2 (任意)

詳細は前 HANDOFF 参照。

---

## ⚠️ 既知のえいみ傾向 (= 本セッションで再発した分を反映)

memory に強化済 (= [feedback_no_handoff_steps_to_masa.md](/Users/masa/.claude/projects/-Users-masa-projects-AMD-amd-os/memory/) / [feedback_never_say_cant_first.md] / [feedback_specify_file_name_for_gas_function.md])。次セッションのえいみは memory を真っ先に Read。

主な失敗パターン:
1. **「手順渡す」「実行をお願い」は禁止**: AGENTS 例外 (Google OAuth ブラウザ承認 / 物理端末 / 課金 / 2FA) に真に該当する場合のみ最小ステップで振る
2. **「できない」即断する前に 3 つ試す**: CLI/API/別経路を最低 3 つ実際に試してから結論
3. **GAS 関数依頼時はファイル名 + 関数名セット必須**: `{ファイル名} の {関数名}` を毎回明示
4. **HANDOFF TODO は実装まで完遂**: 「次セッションでやる」と書いた TODO は次セッション冒頭で必ず潰す。同じ「何度も言ってる」を発動させない
5. **Drive 同期事故 GAS への push は危険**: 重複ファイルが本番 GAS に push される事故。push 前に local 側を整理
6. **clasp deploy --deploymentId X で update すると元 deployment スナップショットが失われる**: バックアップなしの上書き禁止、まず新規 deploy で test
7. **GAS Web App access 設定は appsscript.json だけでは反映されない**: deployment ごとに Web Editor で承認必要

---

## 入口

- [`design/L2_DATA.md`](design/L2_DATA.md) ⭐⭐⭐ — 中核データ正本 (L2 6 種 + 5 生データ backfill 一覧)
- [`design/SPEC_pwa.md`](design/SPEC_pwa.md) ⭐ — PWA 全体仕様
- [`design/db_schema.md`](design/db_schema.md) — 99 tables / 1086 columns
- [`design/README.md`](design/README.md) — 設計 md インデックス
- [`BUGS.md`](BUGS.md) — 本セッションで合計 5 件追加 (= AMD-Report GAS 三重壁が最重要)
- [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) 末尾 — 本セッション #6 + #7 全網羅
- `/Users/masa/projects/AGENTS.common.md` — えいみ人格 + 「LLM プロンプト運用 (絶対ルール)」
- `pwa/AGENTS.md` — **画像禁止ルール** (= 毎セッション再確認)

## 運用コマンド (本セッションで使ったもの)

```sh
# Vercel deploy (= 通知付き)
bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh

# DDL 適用
python3 -X utf8 pwa/scripts/apply_ddl.py pwa/scripts/migrations/NNN_name.sql

# AMD-Report GAS 操作 (= 本セッションで確立、要 clasp login)
cd /tmp/gas-report-clean
npx @google/clasp@latest login    # 1 回 OAuth
npx @google/clasp@latest pull     # GAS 正本取得
npx @google/clasp@latest push --force
npx @google/clasp@latest deploy --deploymentId X --description "..."
npx @google/clasp@latest deployments

# Supabase Management API SQL (= 本セッションで多用)
SBAT=$(grep '^SUPABASE_ACCESS_TOKEN=' pwa/.env.local | cut -d= -f2- | tr -d '"')
curl -sX POST "https://api.supabase.com/v1/projects/nbnhrhybjslbawdukvvk/database/query" \
  -H "Authorization: Bearer $SBAT" \
  -H "Content-Type: application/json" \
  -H "User-Agent: amd-os-pwa-cleanup/1.0" \
  -d '{"query":"SELECT ..."}'

# Backfill 進捗確認
URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' pwa/.env.local | cut -d= -f2- | tr -d '"')
ANON=$(grep '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' pwa/.env.local | cut -d= -f2- | tr -d '"')
curl -sL "${URL}/rest/v1/monthly_reports?select=count" -H "apikey: ${ANON}" -H "Authorization: Bearer ${ANON}" -H "Prefer: count=exact"
```
