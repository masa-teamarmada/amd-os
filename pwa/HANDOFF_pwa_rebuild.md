# HANDOFF — AMD OS PWA / GAS

最終更新: 2026-05-13 (blissful-robinson-8e462a #7 monthly_report 文字化け復旧 + AMD-Report GAS 諸事故露呈)
詳細セッションログ: [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) 末尾参照

---

## 状態

- main HEAD: `5922262` (= Round 6 deploy 含む、Round 7 はコード変更なし、AMD-Report GAS 側のみ操作)
- Vercel: `amd-os-i2xfns6im-armada0130` (= TimeSeriesChart 位置移動の deploy が最新、その後 PWA 側変更なし)
- 本体 GAS deployment: `AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G` @1462 (= 前セッションから変更なし)
- AMD-Report GAS: scriptId `1r3Ak-tYASXY...` 本セッションで多数 deploy update + push、production deployment access 全壊状態。time-based cron は別経路で動く想定
- 未 push commit: なし
- worktree: `claude/blissful-robinson-8e462a` (= main にマージ済)

---

## 🟡 進行中 (= 放置で完了予定)

**aggressive backfill (= monthly_reports 残り未生成 104 件)**
- まさが GAS Editor で `R001_Api 2.js` の `setup_aggressiveBackfill_2026_05_13` を ▶ 実行 (= 22:50 頃)
- 15 分置き trigger で `_aggressive_backfill_self_teardown_2026_05_13` 自動実行
- 約 6-7 時間で全完了予定 (= 翌朝 5-6 時)
- 完了時 (= generated=0 検知) は **trigger 自動削除**、まさは何もしなくて OK
- 確認方法: Supabase で `SELECT COUNT(*) FROM billing_cycles bc LEFT JOIN monthly_reports mr ON ... WHERE mr.id IS NULL` が 0 になれば完了

---

## 🔴 まさから何度も言われた TODO (= 絶対に先送りしない)

| # | タスク | 状態 |
|---|---|---|
| ✅ 1 | マクロ係数 P 以外のデータ取得 | 2026-05-12 完了 (Round 3 + 5) |
| ✅ 2 | FRL grit/resilience の数値入力 | 2026-05-12 完了 (Round 3 + 5) |
| 🔴 3 | R303 hardcoded fallback 削除 (= AMD-Report GAS、AGENTS 完遵) | 未着手、TODO #5 と一緒にやるべき (= 同 GAS) |
| 🔴 4 | 試算表 Drive Excel 取り込み cron 新規 (= project_pl_monthly が全 PJ「—」表示) | 未着手 |
| 🔴 5 | **AMD-Report GAS の構造的修復** (= 本セッション露呈) ⭐ NEW | 未着手 |

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

### 1. AMD-Report GAS の構造的修復 (= 上の TODO #5、本セッション露呈の全事故対応) ⭐⭐

詳細は [BUGS.md](BUGS.md) の「AMD-Report GAS が Drive 同期事故 + isAdmin_ 未定義 + access 設定崩壊の三重壁」エントリ参照。

修復タスク:
1. **Drive 同期事故ファイル整理**: local 側で `R001_Api.js` (0 byte) / `R290_NotionProtocolSync.js` (空コメント、私が上書き) など重複の片方を整理。.claspignore で除外も検討
2. **R290 元コード復元**: 私が空コメントで上書きした `R290_NotionProtocolSync.js` の元 93773 byte コード復元 (= R290 2.js 94608 byte と diff 取って判断、もしくはどちらか 1 つを正本として確定)
3. **Web App URL access 再設定**: GAS Editor で deployment access を「全員」承認 → 既存 cron 系 client が動くか確認
4. **GCP project 紐付け**: Apps Script API 経由で外部から関数実行できるよう GCP Cloud project と紐付け → 今後の clasp run / curl 経路を確保 (= ScriptProperties 取得や任意関数実行が可能に)
5. **`isAdmin_` 等 admin helper の正規実装**: 本セッション私が `R001_Api 2.js` 末尾に簡易追加したが、専用 helper ファイル (`R002_AdminCheck.js` 等) に移動 + 他の admin 系関数 (R040 / R313 admin_*) と整合
6. **monthly_report 文字化け検出 alert**: R313 cron に「`?` 比率 > 50% で alert 出して保存しない」防御コード追加 → 今回 (p20 202604) のような単発文字化けを未然防止
7. **R303 hardcoded fallback 削除** (= TODO #3): `llm_prompts.monthly_report.r313_extract` body seed + AMD-Report GAS から DB fetch で読む構造に置換 + clasp push (= 上記 4 で API 経路ができれば一気にできる)

### 2. 試算表 Drive Excel 取り込み cron (= TODO #4)

`project_pl_monthly` テーブルが全 PJ 全部「—」表示。Drive folder 配下の `.xlsx` を Sonnet で月次 PL に構造化抽出 → upsert。074c (議事録 Docs backfill) とは別 cron。

### 3. EventsSection の impact 強調表示

migration 056 で member_activities.impact (1-5) 列を追加して LLM も値を入れているが、UI 側はまだ表示してない。impact >= 4 を太字 / アイコンで強調。

### 4. 5 生データ backfill の精度改善

| 種類 | 改善案 |
|---|---|
| Drive (074c) | 再帰 scan |
| Calendar (074d) | chitchat 判定緩和 + Notion AI 連結 |
| Gmail (074e) | subject フィルタ拡張 |
| Slack | 過去 6 ヶ月分 backfill ループ |

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
