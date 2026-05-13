# HANDOFF — AMD OS PWA / GAS

最終更新: 2026-05-13 (dazzling-wing-23c8e9 #9 系 3 連発 / VC cron 統合 + PWA backfill 移植 + AMD-Report GAS 6/7 修復 + R303 fallback 削除)
詳細セッションログ: [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) 末尾 #8 / #9 / #9 続き / #9 続き 2

---

## 状態

- main HEAD: `1708ed6`
- Vercel production: `amd-os-4z8a43syd-armada0130` (= 並列 backfill 改修 + impact 強調 deploy 済)
- 本体 GAS deployment: `AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G` @1462 (= 変更なし)
- AMD-Report GAS: scriptId `1r3Ak-tYASXY...` 最新 deploy `AKfycbyA3ri...@23 - r303-fallback-removed`、`AKfycbxtap...@21` の production access も維持 (= まさ「全員アクセス可」承認済)
- 未 push commit: なし
- worktree: `claude/dazzling-wing-23c8e9` (= main マージ済、削除可)

---

## 🔴 残 TODO (= 次セッションで触る順、優先度別)

| # | タスク | 状態 |
|---|---|---|
| 🔴 6 | **VC RSS / X feed cron** (= ノクターン的ロングテール VC の真の解決策、LLM 不要) | 未着手、#8 で TODO 化 |
| 🟡 4 | 試算表 (project_pl_monthly) — 生データからの未来予測抽出 | 設計のみ [`design/project_pl_monthly.md`](design/project_pl_monthly.md)、後回し |
| 🟡 D | 5 生データ backfill 精度改善 (= drive 82 / calendar 7 が薄い) | GAS 074 系修復連動、本セッション #9 で source_cache 実態調査済 |
| 🟡 E-4 | AMD-Report GAS GCP project 紐付け | CLI 不可確定、必要になった時にまさのブラウザ作業で対応 |
| 🟢 | protocols dedup + UI archive | 旧 22 件 legacy_specific archive + 新 22 件 pattern を Sonnet dedup |
| 🟢 | ファビコン / exec_summary Phase 2 | 任意、後日 |

このセッションで完遂した TODO (#3 / #5-7 / #7 / #8 / 6/7 of #5 / A-monthly_reports-backfill / B-impact-強調) は表から除外。詳細は design_log #8 / #9 系参照。

---

## 🚨 次セッション最優先

### 1. まさが「色々細かいところを修正したい」 (= まさ依頼、最優先)
具体内容は次セッション冒頭でまさから聞く。HANDOFF / BUGS / design_log を read してから着手。

### 2. VC RSS / X feed cron (= TODO #6) — ノクターン的ロングテール対策
1. migration: `vcs` に `rss_url` (text) / `x_handle` (text) 列追加
2. `/vcs/[id]/edit` に RSS URL / X handle 入力欄
3. `seed-vcs` の prompt に「公式 RSS / X handle も探す」追記
4. 新 cron `/api/cron/vc-rss-fetch` (daily 09:00 JST、LLM 不要):
   - `vcs.rss_url IS NOT NULL` を fetch
   - RSS 各 item を `vc_news` に upsert (`ingested_by='rss_feed'`)
   - X handle は X API 制約のため Apify / RSSHub 等を検討

### 3. 試算表 (TODO #4)
詳細は [`design/project_pl_monthly.md`](design/project_pl_monthly.md)。優先度低、本セッションで設計のみ確定 (= まさから「未来予測抽出 / 専用 cron 作らない / 手動入力なし」方針を引き出し済)。

---

## 入口

- [`design/README.md`](design/README.md) — 設計 md インデックス (最初に見る)
- [`design/L2_DATA.md`](design/L2_DATA.md) ⭐⭐⭐ — 中核データ正本 (L2 6 種 + 5 生データ backfill + 全 cron)
- [`design/SPEC_pwa.md`](design/SPEC_pwa.md) ⭐ — PWA 全体仕様
- [`design/db_schema.md`](design/db_schema.md) — 99 tables / 1086 columns
- [`design/project_pl_monthly.md`](design/project_pl_monthly.md) — 試算表設計 (= #9 続きで NEW)
- [`BUGS.md`](BUGS.md) — AMD-Report GAS 三重壁エントリは ✅ ほぼ解決状態に更新済 (= #9 続き 2)
- [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) — 末尾 #8 / #9 / #9 続き / #9 続き 2
- `/Users/masa/projects/AGENTS.common.md` — えいみ人格 + LLM プロンプト運用絶対ルール
- `pwa/AGENTS.md` — **画像禁止ルール** (毎セッション再確認)

---

## ⚠️ えいみ傾向 (= 本セッション群で再発した分、memory に強化済)

新規追加 memory (= 次セッション冒頭で必読):
- [`feedback_question_own_proposals.md`](/Users/masa/.claude/projects/-Users-masa-projects-AMD-amd-os/memory/feedback_question_own_proposals.md) — 提案前に DB 実測する (= vc-news-ingest 機能してない事実を 3 回まさに突かれて初めて気づいた)
- [`feedback_vercel_cron_throughput.md`](/Users/masa/.claude/projects/-Users-masa-projects-AMD-amd-os/memory/feedback_vercel_cron_throughput.md) — Vercel maxDuration ギリギリ limit で curl hang 事故、並列処理で wall-clock 圧縮
- [`feedback_tsukuyomi_builds_from_raw_data.md`](/Users/masa/.claude/projects/-Users-masa-projects-AMD-amd-os/memory/feedback_tsukuyomi_builds_from_raw_data.md) — 手動入力前提の機能設計禁止、つくよみが生データから自動構築が原則

既存 memory も読み直し:
- 「手順渡す / 実行をお願いは禁止」(= AGENTS 例外のみ最小ステップで振る)
- 「『できない』即断する前に 3 つ試す」(= 本セッションでも GCP 紐付け CLI 化を 3 経路試して結論)
- 「GAS 関数依頼時はファイル名 + 関数名セット必須」
- 「Drive 同期事故 GAS への push は危険」(= 本セッション #9 続きで重複ファイル整理して回避済)
- 「clasp deploy --deploymentId update でスナップショット失う」(= 新規 deploy で test 優先)

---

## 運用コマンド (= 本セッションで使ったもの)

```sh
# Vercel deploy (通知付き)
bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh

# Supabase Management API SQL
SBAT=$(grep '^SUPABASE_ACCESS_TOKEN=' pwa/.env.local | cut -d= -f2- | tr -d '"')
curl -sX POST "https://api.supabase.com/v1/projects/nbnhrhybjslbawdukvvk/database/query" \
  -H "Authorization: Bearer $SBAT" -H "Content-Type: application/json" \
  -H "User-Agent: amd-os-pwa/1.0" -d '{"query":"..."}'

# DDL 適用
python3 -X utf8 pwa/scripts/apply_ddl.py pwa/scripts/migrations/NNN_name.sql

# AMD-Report GAS 操作 (= /tmp/gas-report-clean/ で作業、backup あり)
cd /tmp/gas-report-clean
npx @google/clasp@latest push --force
npx @google/clasp@latest deploy --description "..."
npx @google/clasp@latest deployments

# monthly-reports-backfill (= AMD-Report GAS が動かない時の保険 PWA cron)
CRON_SECRET=$(grep '^CRON_SECRET=' pwa/.env.local | cut -d= -f2- | tr -d '"')
curl -sS --max-time 290 "https://amd-os-pwa.vercel.app/api/cron/monthly-reports-backfill?limit=25&concurrency=5" \
  -H "Authorization: Bearer $CRON_SECRET"
```
