# HANDOFF — AMD OS PWA / GAS (2026-05-11 eloquent-chatelet-417abc 引き継ぎ)

## 🚨 次セッション最優先 (= 「前セッションでもまた同じこと」防止)

過去 N セッションで「次セッションで」と先送りされた件:

### 1. backfill 全 source 統合 — 進捗 50%

**現状**:
- Notion + Gmail (本体 GAS 074) → 既存稼働、ただし Notion 議事録が少ない PJ は空
- Slack (本体 GAS 074b) → **本セッションで実装 + clasp push + clasp deploy 完了**
  - `gas/074b_MeetingSummarySlack.js` (新規)
  - `nav_meeting_extractSlackThreadsForProjectYm_(projectId, ym, opts)` (単月単 PJ)
  - `nav_meeting_backfillSlackAllActive_(opts)` (全 active PJ × 過去 N ヶ月)
  - bot 除外 (USLACKBOT / subtype=bot_message / bot_id / app_id) 込みの安全実装
  - WebApp URL: 既存 deploymentId を上書き update (v1457)
- Drive / Calendar → 未実装

**次セッションで**:
- まず Slack backfill の実行結果を `project_meeting_summaries` で目視確認
  ```sh
  SVC=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' pwa/.env.local | cut -d= -f2- | tr -d '"')
  curl -sL -G "https://nbnhrhybjslbawdukvvk.supabase.co/rest/v1/project_meeting_summaries?select=project_id,source_kinds&source_kinds=eq.slack" -H "apikey: $SVC" -H "Authorization: Bearer $SVC" | jq 'group_by(.project_id) | map({pj: .[0].project_id, n: length})'
  ```
- 必要なら手動で再起動:
  ```sh
  URL=$(grep '^NEXT_PUBLIC_GAS_WEBAPP_URL=' pwa/.env.local | cut -d= -f2- | tr -d '"')
  KEY=$(grep '^NEXT_PUBLIC_GAS_API_KEY=' pwa/.env.local | cut -d= -f2- | tr -d '"')
  curl "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=nav_meeting_backfillSlackAllActive_&args=$(python3 -c "import urllib.parse,json; print(urllib.parse.quote(json.dumps([{'monthsBack':12,'maxLlmCallsPerRun':50}])))")"
  ```
- Drive backfill (R309_MonthlyReport_DriveExtract を本体 GAS に移植):
  - 074c_MeetingSummaryDrive.js を新規作成
  - PJ Drive folder から「議事録」「打合せ」を含むファイル名のものを meeting として upsert
- Calendar backfill: event description + attendees から meeting 構築
- Notion alias resolver 強化 (= 「香川大学」→ p06 等のマップ拡張)

### 2. AdminProtocolsClient の 4 要素ステップカード UI が見えない (= 巻き戻り疑い)

**症状**: まさが「ビジュアライズが巻き戻ってる」と指摘

**仮説 (要検証)**:
- 既存 13 件の protocols を本セッションで `status='archived'` に一括変更
- `AdminProtocolsClient.tsx` のデフォルト filterStatus=`""` (= 全 status 表示) で archived も表示されるはず
- ただし表示順 `order updated_at desc` なので最新 archived が頭に出てる可能性
- → archived は折りたたみ + candidate 優先表示にする UI 修正必要

**次セッションで**:
- /admin/protocols 開いて画面確認 → どこで巻き戻ってる?
- 必要なら AdminProtocolsClient の filter デフォルトを `status=candidate` にして archived 非表示

### 3. 既存 13 件 protocols の再抽出 (= 普遍プロトコル形式に)

旧形式 protocols (= PJ 固有事例ベース) は archived 済。再抽出は GAS cron 月 1 回。手動キック:
```sh
URL=$(grep '^NEXT_PUBLIC_GAS_WEBAPP_URL=' pwa/.env.local | cut -d= -f2- | tr -d '"')
KEY=$(grep '^NEXT_PUBLIC_GAS_API_KEY=' pwa/.env.local | cut -d= -f2- | tr -d '"')
curl "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=nav_protocol_pollAll&args=$(python3 -c "import urllib.parse,json; print(urllib.parse.quote(json.dumps([{'force':True}])))")"
```

`llm_prompts.protocol.extract.body` は is_active=TRUE で本文入り (普遍 + examples 構造の prompt)。
これに従って Gemini が `protocol_examples` テーブルに 1 protocol : N examples を upsert する仕組みは
gas/155 nav_protocol_extractOneForYm_ に実装済。

### 4. ファビコンが反映されない

**現状**:
- `pwa/src/app/icon.png` + `apple-icon.png` 配置済 (Next.js convention)
- root layout.tsx の `metadata.icons` 削除済 (= 二重 link 衝突回避)
- それでもまさ環境では Vercel デフォルト favicon が見える

**次セッションで確認**:
1. 本番 HTML を curl して `<link rel="icon" href="/icon..." >` が生成されてるか
   ```sh
   curl -sL https://amd-os-pwa.vercel.app/ | grep -oE '<link[^>]*icon[^>]*>'
   ```
2. もし生成されてなければ:
   - `pwa/src/app/icon.tsx` (= 動的) を試す
   - もしくは `pwa/public/favicon.ico` に本物の ICO 形式を配置 (PNG→ICO 変換: `magick convert icon.png favicon.ico`)
3. Vercel project settings の Favicon override がないか確認

### 5. R303 monthly_report の hardcoded fallback も削除する

**現状**:
- `llm_prompts.monthly_report.r313_extract.body` に seed 入り、ただし簡易テキストのみ
- AMD-Report `R303_MonthlyReport_Generator.js` `mr_gen_getSystemPrompt_` に hardcoded fallback (約 470 字) が残ってる
- AGENTS ルール「プロンプトをコードに書かない」に違反

**次セッションで**:
1. R303 の `mr_gen_buildPrompt_` 全体を読んで、system prompt 構築箇所を特定
2. DB の `monthly_report.r313_extract.body` に「人物誤認の防止 + bot 除外」を含む完全版を入れる
3. R303 の `return 'あなたは...'` 部分を削除して DB 必須に
4. clasp push (AMD-Report GAS、`/Users/masa/Library/CloudStorage/GoogleDrive-masa@team-armada.jp/共有ドライブ/claude/AMD_OS/gas-report/.clasp.json`)

### 6. project_knowledge への基本事実同期を実行

**現状**: `cron/sync-pj-facts` route 作成済、まだキックしてない

**次セッションで**:
```sh
SECRET=$(grep '^CRON_SECRET=' pwa/.env.local | cut -d= -f2- | tr -d '"')
curl -sL "https://amd-os-pwa.vercel.app/api/cron/sync-pj-facts" -H "Authorization: Bearer $SECRET"
```
→ 全 active PJ の founded_at / outcome_pattern / amd_support_* が `project_knowledge.basic_fact` に同期される

加えて Vercel cron 化 (daily 04:00 JST):
- pwa/vercel.json に追加

---

## 過去経緯 (= 同じミスを繰り返さないため)

### えいみ (Opus 4.7) の事実誤認傾向
- 過去ターンで「p03 は 2022-03-01 に事業終了」と発言した
- 実際は `outcome_pattern='smb'` (= 中小企業転換、継続中)、`amd_support_ended_at=null`
- 原因: `narrative_text` の 2022-03 entry「事業継続における一時的な課題に直面」を「終了」と誤読
- 教訓: **構造化フィールドを必ず参照、自由テキストの曖昧文言から推測しない**

### えいみが「次セッション」で先送りした件
- backfill 全 source: 4 セッション以上先送り → 本セッションで Slack 部分は実装完了
- AMD-Report GAS が手元に無いと即断 → 実は Drive に 107 files あった (= mdfind で 3 秒)
- 仕事を後回しにする傾向、次セッションは **本ハンドオフの 1-6 を即座に進める**

### コード内 hardcoded プロンプト排除 (AGENTS ルール)
- 完了: chat/route.ts buildSystemPrompt() / gas/155 protocol fallback
- 未完了: R303 monthly_report fallback / chat/route.ts tool descriptions (TOOLS 配列、約 600 行)
- 注意: 完全排除 = 全プロンプトを DB で管理、まさが /admin/prompts UI で編集可能に

---

## 主要ファイル / コミット

| ファイル | 役割 |
|---|---|
| `pwa/scripts/migrations/045_members_is_admin.sql` | is_admin カラム |
| `pwa/scripts/migrations/046_pl_review_requested.sql` | PL 確認依頼の状態分離 |
| `pwa/scripts/migrations/047_tsukuyomi_token_usage.sql` | つくよみ usage log |
| `pwa/scripts/migrations/048_llm_prompts.sql` | LLM prompt DB |
| `pwa/scripts/migrations/049_protocol_examples.sql` | プロトコル普遍化 + N 事例 |
| `pwa/scripts/migrations/050_protocol_examples_uniq.sql` | examples UNIQUE |
| `pwa/src/app/(app)/admin/prompts/` | LLM prompt 管理 UI |
| `pwa/src/app/api/cron/sync-pj-facts/route.ts` | PJ 基本事実同期 cron (未キック) |
| `pwa/src/app/api/cron/freeze-period-backfill/route.ts` | 休止期間 backfill cron |
| `pwa/src/app/api/cron/triple-helix-recompute/route.ts` | Triple Helix Kalman |
| `gas/074b_MeetingSummarySlack.js` | Slack スレッド meeting backfill |
| `gas/155_L2KnowledgeExtractor.js` | プロトコル抽出 (hardcoded 排除済) |
| AMD-Report `R306_MonthlyReport_SlackExtract.js` | bot 除外 (まさ 2/18 事故対応) |
| AMD-Report `R303_MonthlyReport_Generator.js` | 人物誤認防止 prompt (※ hardcoded 残あり) |

---

## clasp / GAS push 手順

```sh
# 本体 GAS
cd /Users/masa/projects/AMD/amd-os/gas
npx @google/clasp@latest push --force
npx @google/clasp@latest deploy --deploymentId AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G --description "vNNN_xxx"

# AMD-Report GAS
cd "/Users/masa/Library/CloudStorage/GoogleDrive-masa@team-armada.jp/共有ドライブ/claude/AMD_OS/gas-report"
npx @google/clasp@latest push --force
# AMD-Report の WebApp URL は別、scriptId=1r3Ak-tYASXY...
```

---

## Vercel deploy

```sh
bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh
# 5-7 分で本番反映 (= amd-os-pwa.vercel.app)
```
