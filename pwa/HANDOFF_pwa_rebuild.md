# HANDOFF — AMD OS PWA / GAS

最終更新: 2026-05-11 (eloquent-chatelet-417abc セッション)
詳細セッションログ: [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) 末尾参照

---

## 状態

- main HEAD: `9da5d9f` (この後さらに handoff 更新 commit が乗る)
- Vercel: `amd-os-bgfyv01fh-armada0130` (= main `9da5d9f` 反映済)
- 本体 GAS: deployment `AKfycbwzA_sBg4i...` @1457 (Slack backfill 関数追加版)
- AMD-Report GAS: scriptId `1r3Ak-tYASXY...` @1455 (bot 除外 + 人物誤認防止 prompt)
- 未 push commit: なし
- worktree: `claude/eloquent-chatelet-417abc` (= 本セッション、main にマージ済)

---

## 🚨 次セッション最優先 (= 「先送り」を防ぐ具体ステップ)

### 1. Slack backfill の LLM 呼び出しロジック修正

**症状**: `nav_meeting_backfillSlackAllActive_({monthsBack:6, maxLlmCallsPerRun:20})` 実行結果:
- p06 CTB で **27 スレッド検出** したのに `saved=0` / `llm_calls=0`
- p10 SE = 0 threads / p00 AMD = no_channel

**調査ポイント**: [`gas/074b_MeetingSummarySlack.js`](../gas/074b_MeetingSummarySlack.js)
- `if (existing && existing[meetingId])` の `existing` 構造が `_meeting_loadExistingForProjectYm_` の戻り値と一致してない可能性 (= 全 thread が "skipped_existing" になってる)
- もしくは `llm_callJson("meeting_extract", ...)` 呼び出し前で例外が起きてるが catch で握りつぶしてる

**確認 curl**:
```sh
SVC=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' pwa/.env.local | cut -d= -f2- | tr -d '"')
curl -sL -G "https://nbnhrhybjslbawdukvvk.supabase.co/rest/v1/project_meeting_summaries?select=project_id,source_kinds&source_kinds=eq.slack" \
  -H "apikey: $SVC" -H "Authorization: Bearer $SVC"
```

### 2. AdminProtocolsClient の legacy_specific と pattern を別セクション表示

**症状**: まさが「AMDプロトコルが巻き戻ってる、事例とプロトコル分離してない」と指摘。既存 22 件 (= 旧形式) が candidate に戻された状態で混在表示

**修正方針**:
- AdminProtocolsClient.tsx でフィルターのデフォルトを `kind='pattern'` に
- legacy_specific (= 22 件) は別セクション「⚠️ 旧形式 (要再抽出 or アーカイブ)」で折りたたみ表示 + 「一括 archive」ボタン
- 新形式 (kind='pattern') が候補欄に表示される構造

### 3. 既存 22 件 protocols の再抽出 (force=true)

`nav_protocol_pollAll force=true` を本セッションで実行 → 結果: `processed=11, llmCalls=11, errors=3 (LLM parse failed), no_input=9`。LLM parse failed の 3 件はリトライ要。

```sh
URL=$(grep '^NEXT_PUBLIC_GAS_WEBAPP_URL=' pwa/.env.local | cut -d= -f2- | tr -d '"')
KEY=$(grep '^NEXT_PUBLIC_GAS_API_KEY=' pwa/.env.local | cut -d= -f2- | tr -d '"')
curl "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=nav_protocol_pollAll&args=$(python3 -c "import urllib.parse,json; print(urllib.parse.quote(json.dumps([{'force':True,'maxItems':20}])))")"
```

### 4. ファビコンが反映されない

**現状**: `pwa/src/app/icon.png` + `apple-icon.png` 配置済、root layout の `metadata.icons` 削除済、それでも反映されない (まさシークレットモードでも未確認)

**次セッション**: 
1. `curl -sL https://amd-os-pwa.vercel.app/ | grep -oE '<link[^>]*icon[^>]*>'` で本番 HTML に `<link rel="icon" href="/icon...">` が生成されてるか確認
2. 不足なら Vercel project settings の Favicon override 確認、もしくは `pwa/public/favicon.ico` に本物 ICO 配置

### 5. R303 monthly_report の hardcoded fallback を削除 (AGENTS 完遵)

AGENTS ルール「プロンプトはコードに書かない」未達:
- AMD-Report `R303_MonthlyReport_Generator.js` `mr_gen_getSystemPrompt_` に hardcoded fallback 残っている
- `llm_prompts.monthly_report.r313_extract.body` に完全版を seed + is_active=TRUE
- R303 の `return 'あなたは...'` 削除して DB 必須に
- clasp push (= `/Users/masa/Library/CloudStorage/GoogleDrive-masa@team-armada.jp/共有ドライブ/claude/AMD_OS/gas-report/`)

### 6. sync-pj-facts cron を初回キック + Vercel cron 化

```sh
SECRET=$(grep '^CRON_SECRET=' pwa/.env.local | cut -d= -f2- | tr -d '"')
curl -sL "https://amd-os-pwa.vercel.app/api/cron/sync-pj-facts" -H "Authorization: Bearer $SECRET"
```
→ project_knowledge に basic_fact が同期される (まさが PJ ナレッジで設立日 / outcome_pattern / amd_support_* を見られるように)

加えて `pwa/vercel.json` に daily 04:00 JST 追加 (or GAS 154 から curl 構成)。

### 7. Drive / Calendar backfill 追加

`gas/074b_MeetingSummarySlack.js` と同じパターンで:
- `gas/074c_MeetingSummaryDrive.js` (PJ Drive folder の議事録系ファイル名から meeting 構築)
- `gas/074d_MeetingSummaryCalendar.js` (Calendar event description + attendees)
- Notion alias resolver 強化 (`_meeting_resolveProjectIdFromPage_` の alias map 拡張)

---

## ⚠️ 既知のえいみ傾向 (= 同じ失敗を防ぐため)

1. **重い実装の先送り癖**: 「次セッションで」と書いた瞬間に進行が止まる → 本ハンドオフの 1-7 を順に**着手して止まらない**
2. **早合点で隣の領域を触る**: まさの指摘の対象を最初に確認せず、コンポーネント / プロンプト / cron を取り違える → 修正対象がズレた commit が積み上がる
3. **「手元にない」即断**: AMD-Report GAS が手元に無いと言ったが Drive に 107 files あった → 徹底探索 (mdfind / find / locate) を必ず先にやる

---

## 入口

- [`design/L2_DATA.md`](design/L2_DATA.md) ⭐⭐⭐ — L2 6 種 + 全 cron 一覧 (本セッションで 3 cron 追加済)
- [`design/README.md`](design/README.md) — 設計 md インデックス
- [`design/SPEC_pwa.md`](design/SPEC_pwa.md) — PWA 全体仕様
- [`BUGS.md`](BUGS.md) — 直近事故 (本セッションで 4 件追加: SE 「2/18 2:47」誤抽出 / title.template バグ / archive UI / プロトコル取り違え)
- [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) 末尾 — 本セッション全 commit + 設計変更網羅
- `/Users/masa/projects/AGENTS.common.md` — えいみ人格 + 「LLM プロンプト運用 (絶対ルール)」セクション

## 運用コマンド

```sh
# Vercel deploy (= 本番反映)
bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh

# DDL 適用
python3 -X utf8 pwa/scripts/apply_ddl.py pwa/scripts/migrations/NNN_name.sql

# 本体 GAS push
cd /Users/masa/projects/AMD/amd-os/gas
npx @google/clasp@latest push --force
npx @google/clasp@latest deploy --deploymentId AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G --description "vNNN_xxx"

# AMD-Report GAS push
cd "/Users/masa/Library/CloudStorage/GoogleDrive-masa@team-armada.jp/共有ドライブ/claude/AMD_OS/gas-report"
npx @google/clasp@latest push --force
```
