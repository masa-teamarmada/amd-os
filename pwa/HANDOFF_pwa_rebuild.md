# HANDOFF — AMD OS PWA / GAS

最終更新: 2026-05-11 (cranky-rhodes-ff4609 セッション #2、まさ 9 指摘の 7 件即対応)
詳細セッションログ: [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) 末尾参照

---

## 状態

- main HEAD: `4f5614e` (= cranky-rhodes-ff4609 #5 マージ後)
- Vercel: `amd-os-ga77qm32o-armada0130` (= 850e87a 反映)
- 本体 GAS deployment: `AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G` @1461 (= protocol 復旧 + 074b form-encoded + maxTokens 4096)
- AMD-Report GAS: scriptId `1r3Ak-tYASXY...` @1455 (= 前セッションの bot 除外 + 人物誤認防止)、**R303 hardcoded fallback は未対応 (次セッション)**
- 未 push commit: なし
- 本セッション worktree: `claude/cranky-rhodes-ff4609` (= 6 commit、main にマージ済)

---

## まさ 9 指摘への対応状況 (2026-05-11 後半)

| # | 指摘 | 状態 | 対応 |
|---|---|---|---|
| 1 | 「創業」セクション削除 + 「メンバー」に統合 | ✅ | CockpitMembersModal に LLM 抽出創業メンバー統合、🧑‍🤝‍🧑 創業 タブ削除 |
| 2 | 試算表が全部「ー」 | ⏳ 次セッション | Drive Excel 取り込み cron が未実装。下記「次セッション最優先」参照 |
| 3 | AMD スコア表示位置をグラフ現在点上に大きく | ✅ | SVG 内に pill + 引き出し線 + 18px bold red、クリックでモーダル |
| 4 | FRL grit / resilience が 0 | ✅ (= UI 誤認解消) | null → 「—」表示 + バー無し。LLM 抽出 cron は未実装 (= 下記参照) |
| 5 | FRL「合計」削除 | ✅ | 右上「現在の FRL」が大きく表示済で冗長 + ラベル矛盾 |
| 6 | Slack に限定した理由 / Drive/Calendar も backfill | ⏳ 次セッション | Slack 集中の理由は前 HANDOFF 最優先 1 で書いてたから。074c/074d skeleton 必要 |
| 7 | プロトコル定義改善 (= 業務オペ除外) | ✅ + 残課題 | llm_prompts.protocol.extract body 厳格化 (migration 053) + 再抽出。ただし既存「契約書フォーマット」プロトコルは消えてないので UI archive 必要 |
| 8 | PJ 停止中にしても dashboard で active | ✅ | fetchProjectsFromSupabase の `r.status \|\| "active"` フォールバック撤去 |
| 9 | PJ status 保存が動かない | ✅ | AdminProjectsTable.STATUS_OPTIONS に `draft` 追加 (DB の p24 CLG 対応) |

---

## 本セッションで完了した主要事項

1. **Slack backfill 真因特定 + 完全動作化** (前ハンドオフ最優先 1):
   - `slack_callApi` の `conversations.replies` が `invalid_arguments` を返していた (= JSON body の ts precision 問題)
   - 074b 専用 `_meeting_slack_callForm_` で form-encoded helper を新規、history / replies 両方ともそちらへ
   - 各 continue ポイントで items.push して可視化、`existing_count` / `channel` / `scan_err` も return
   - parent text >= 200 字なら reply ゼロでも候補化 (= 議事録貼り付け対応)
   - system prompt を `llm_prompts.meeting_extract.slack` (migration 051) から取得 (AGENTS ルール)
   - 動作確認: p06 2026-04 で saved=5、全 7 PJ × 3 ヶ月で saved=13

2. **AdminProtocolsClient 旧/新分離表示** (前ハンドオフ最優先 2):
   - 候補欄に kind='pattern' のみ立てる (= 新形式 Phase 4 抽出)
   - 「⚠️ 旧形式」セクションに kind='legacy_specific' (22 件)、初期 collapsed
   - 「📥 全部 archive」一括ボタン (まさが 1 クリックで 22 件を archive へ)

3. **既存 22 件 protocols 再抽出 + GAS 155 復旧** (前ハンドオフ最優先 3):
   - 前セッションの未 commit 修正 (= protocol 普遍化 + examples + `llm_prompts.protocol.extract` 必須化) を **私が `git checkout HEAD` で破棄してしまった** → ターン履歴から復元
   - 加えて opts.maxTokens 2048 → 4096 (= LLM parse failed 3 件救済)
   - 再キック: errors=0 / saved=11 (= 新版 pattern protocols、p20/p21/p06 から抽出)

4. **ファビコン根本対策** (前ハンドオフ最優先 4、まさが 7 回シークレットモード指摘):
   - 真因: `public/icons/icon-192.png` `/icons/icon-512.png` が **404** + `app/icon.png` が 730×744 (PNG サイズ判定上限超過) + middleware manifest bypass 漏れ。**ブラウザキャッシュではなかった**。
   - `public/icons/` 新規生成 (192 / 512 / 同 maskable)、`app/icon.png` 512x512 化、`app/apple-icon.png` 180x180 化
   - `public/manifest.json` 4 icon (any + maskable) に拡張、`middleware.ts` matcher に manifest.json / .ico を bypass 追加

5. **sync-pj-facts cron 初回キック + cron 化** (前ハンドオフ最優先 6):
   - 手動キック: 58 行 synced (= 10 PJ × 約 6 fact)
   - vercel.json に `0 19 * * *` (= daily 04:00 JST) を追記
   - → まさが /admin/contexts や cockpit で設立日 / outcome_pattern / 起源組織を見られる

6. **migration 適用**:
   - 051: `llm_prompts.meeting_extract.slack` body seed (= 074b の system prompt)
   - 052: `project_meeting_summaries.source_url TEXT NULL` (= Slack URL / Drive URL 共通格納用)

---

## 🚨 次セッション最優先 (= 残タスク)

### A. まさ指摘 2: 試算表 Drive Excel 取り込み cron 新規実装

**現状**: コックピットの「📊 試算表」モーダルが全 PJ 全部「ー」表示。
**原因**: `project_pl_monthly` テーブルは存在するが、行が空。Drive Excel から自動取り込む cron が **未実装**。設計上は手動入力前提だが、まさは「Drive に Excel あるんだから読んでよ」と要求。

**実装案** (= 次セッション):
1. `gas/074d_PlMonthlyFromDrive.js` 新規:
   - PJ Drive folder (= projects.drive_folder_id) 配下の `.xlsx` / `.xls` ファイルを `Drive.Files.list` で query
   - ファイル名 / mimeType / 更新日でフィルタ (= 「試算表」「PL」「BS」「月次決算」「収支」を含む xlsx)
   - 各 xlsx を Drive API で fetch → Apps Script `Utilities.unzip` で sheets parse (or `Drive.Files.export` で CSV 化)
   - LLM (Sonnet) で「月次 PL 行 (ym + 売上 + 原価 + 人件費 + R&D + マーケ + その他)」を構造化抽出
   - `project_pl_monthly` に upsert (UNIQUE: project_id+ym)
2. `pwa/scripts/migrations/054_pl_monthly_extract_prompt.sql` で system prompt seed
3. cron は GAS time-based trigger 月曜 03:00 JST、もしくは PWA `/api/cron/pl-extract` で `Drive API + xlsx parser (= `xlsx` npm package)`。
4. 手動キック curl 用の `nav_pl_extractFromDriveAllActive_(opts)` ラッパーも追加

**まさへの伝達**: 「Drive Excel から拾う仕組みは今まで未実装、コードが旧設計 (手動入力) のままだった。次セッションで cron を新規実装する」

### B. まさ指摘 6: 5 生データ全種類の backfill 完成 (= Gmail / Drive / Calendar / Notion alias)

★ 2026-05-11 まさ追加指摘: 「生データは **5 種類** (Gmail / Drive / Calendar / Slack / Notion)」を絶対忘れない。Slack だけ着手して Drive/Calendar/Gmail を忘れる事故をしない。詳細は [`design/L2_DATA.md`](design/L2_DATA.md) 冒頭の絶対ルール参照。

`gas/074b_MeetingSummarySlack.js` と同じパターンで:
- `gas/074c_MeetingSummaryDrive.js`: PJ Drive folder の議事録系 (Docs / Slides / .gdoc) ファイル名 / 本文 → meeting summary (= ★ A の Excel 試算表 cron とは別)
- `gas/074d_MeetingSummaryCalendar.js`: Calendar event description + attendees + 紐付く Notion AI ページの再 backfill
- `gas/074e_MeetingSummaryGmail.js`: ★ **Gmail backfill (= まさ追加指摘で気づいた漏れ)**。日次レポート用 R307 はあるが、議事録メール (件名「議事録」「Meeting Notes」「打ち合わせ」等) を meeting summary として抽出する backfill 関数が無い → 074b と同じ pattern で実装
- Notion alias resolver 強化 (= `_meeting_resolveProjectIdFromPage_` の alias map を `members.member_name` + 外部 alias 表から動的拡張)
- 各 system prompt は `llm_prompts.meeting_extract.drive` / `.calendar` / `.gmail` として migration で seed (AGENTS ルール)

A と B は別 cron (= A: Drive Excel → P&L 数値抽出、B: 5 生データから meeting summary 文章抽出)。

### C. まさ指摘 4: FRL grit / resilience LLM 抽出 cron 新規

**現状**: `amd_score_inputs.frl_grit` / `frl_resilience` 列は存在するが、抽出 cron が未実装で全 PJ null。
**実装案**:
- `pwa/src/app/api/cron/frl-grit-resilience-extract/route.ts` 新規 (or 既存 `cron/amd-score-l2-refresh` 拡張)
- monthly_reports + meeting_summaries から「creator/CEO の集中力・タフさ」エビデンスを Sonnet 抽出 → 0-9 score + reasoning
- `amd_score_inputs` に新行 upsert (evaluated_at=今日)
- migration 054 で system prompt seed

### D. まさ指摘 7: 既存 22 件 pattern protocols の dedup + UI archive 運用

**現状**: 新プロンプト (= migration 053) で再抽出後、22 件 pattern + 22 件 legacy_specific (旧手動) = 44 件。
pattern の中に **同テーマで微妙にタイトル違いの重複** が 6+ ペアある (例: 「資金逼迫時の委託業務範囲縮小」/「資金逼迫時の委託業務スコープ縮小」)。
**新プロンプトでも「契約書ドラフトフォーマット」 (= 業務オペ) が残ってる** (= upsert は既存を上書きしないため)。

**まさ手動アクション**:
1. `/admin/protocols` で「⚠️ 旧形式 (22 件)」を「📥 全部 archive」で処理
2. 新 pattern 22 件のうち重複ペアは個別「📥 archive」で間引き
3. 「契約書ドラフトフォーマット」「議事録ツール選び」等の業務オペは「❌ 却下」or 「📥 archive」

**次セッション実装案 (dedup 自動化)**:
- protocols テーブルの title を Sonnet で「意味的に同一」のグループ化 → 重複を archive にする one-time backfill 関数

### E. R303 hardcoded fallback 削除 (= AGENTS 完遵、前 HANDOFF 最優先 5)

AMD-Report GAS `R303_MonthlyReport_Generator.js` `mr_gen_getTsukuyomiContext_` Line 262-270 に
hardcoded fallback が残っている。

**設計判断**: 2 案。
- 案 A (推奨): AMD-Report GAS 側に `supa_select` 相当 helper を追加 (= 既存 `R012_SupabaseSync.js` を流用 / 拡張) → `llm_prompts.monthly_report.r313_extract` body fetch → 失敗時 `tsukuyomi_listContextRows({tag:'monthlyreport',status:'active'})` → 両方空なら **throw** (= silent な低品質 fallback を防ぐ)。事前に migration 053 で `llm_prompts.monthly_report.r313_extract` body 充填 + `is_active=TRUE` (現在は body 空 / is_active=FALSE)。
- 案 B (簡易): `DB_TsukuyomiContext` (本体スプシ) に `tag='monthlyreport',scope='global',status='active'` の行を runFunc 経由で seed → R303 の hardcoded fallback を Logger.log + 空文字に。

**手順 (案 A)**:
1. `pwa/scripts/migrations/053_monthly_report_r313_body.sql` で `llm_prompts.monthly_report.r313_extract` body 充填 + `is_active=TRUE`
2. AMD-Report GAS Drive 共有ドライブ (`/Users/masa/Library/CloudStorage/GoogleDrive-masa@team-armada.jp/共有ドライブ/claude/AMD_OS/gas-report/`) の R303 編集
3. AMD-Report GAS ScriptProperties に `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` が無ければ `oneTime_setScriptProperty` 経由で seed (要 listProps で確認)
4. `npx @google/clasp@latest push --force` + `deploy --deploymentId <ID> --description "v1456_r303_db_prompt"`

### 2. Drive / Calendar backfill 追加 (= 前ハンドオフ最優先 7)

`gas/074b_MeetingSummarySlack.js` と同じパターンで:
- `gas/074c_MeetingSummaryDrive.js` (PJ Drive folder の議事録系ファイル名 / 本文から meeting 構築)
- `gas/074d_MeetingSummaryCalendar.js` (Calendar event description + attendees + 紐付く Notion AI ページ)
- Notion alias resolver 強化 (`_meeting_resolveProjectIdFromPage_` の alias map 拡張)

system prompt はそれぞれ `llm_prompts.meeting_extract.drive` / `meeting_extract.calendar` として **migration で seed**。AGENTS ルール遵守。

### 3. Slack backfill 過去 4-6 ヶ月分

本セッションでは過去 3 ヶ月分 (= saved=13) を完走。`monthsBack=6` で複数回キックして残り 3 ヶ月分を取り込む。
GAS 6 分制約のため、bash ループで `maxLlmCallsPerRun=18` を 4 回程度叩く構成が安全:

```sh
URL=$(grep '^NEXT_PUBLIC_GAS_WEBAPP_URL=' pwa/.env.local | cut -d= -f2- | tr -d '"')
KEY=$(grep '^NEXT_PUBLIC_GAS_API_KEY=' pwa/.env.local | cut -d= -f2- | tr -d '"')
for i in 1 2 3 4; do
  ARGS=$(python3 -c "import urllib.parse,json; print(urllib.parse.quote(json.dumps([{'monthsBack':6,'maxLlmCallsPerRun':18,'maxLlmPerCall':3}])))")
  curl -sL "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=nav_meeting_backfillSlackAllActive_&args=$ARGS"
  echo "---round $i done"
done
```

### 4. 旧 22 件 protocols の archive 操作 (= まさ手動)

`/admin/protocols` で「⚠️ 旧形式 (22 件、kind=legacy_specific)」セクションを開いて「📥 全部 archive」を 1 クリック。
→ 候補欄が新形式 11 件のみになる。新規候補が出てきたらまさが確認して 4 アクション (✅ 確定 / 🔄 修正依頼 / ❌ 却下 / 📥 archive) で運用。

### 5. LLM parse 残課題

GAS Web App 6 分制約 + Sonnet 出力 4096 token 制約のため、入力 (= meeting_summaries 集約テキスト) が長い PJ-ym では再び truncate しうる。
監視: `nav_protocol_pollAll force=true` の結果 `errors > 0` で `LLM parse failed` が出たら、その PJ-ym の inputText 長さを確認 → 16000 字制限 (gas/155 Line 685) を 12000 に下げるか、入力を「最新 8 サマリ」等に絞る改修。

---

## ⚠️ 既知のえいみ傾向 (= 同じ失敗を防ぐため)

1. **重い実装の先送り癖**: 「次セッションで」と書いた瞬間に進行が止まる → 本ハンドオフの 1-5 を順に**着手して止まらない**
2. **早合点で隣の領域を触る**: まさの指摘の対象を最初に確認せず、コンポーネント / プロンプト / cron を取り違える
3. **「手元にない」即断**: 必ず `mdfind` / `find` / `locate` で徹底探索してから「無い」を結論にする
4. **未 push diff 破棄事故** (= 本セッションで再発): worktree 開始時に main repo の `git status -s` の `M` / `??` を確認、内容を `git diff` で見てから判断、無闇に `git checkout HEAD --` で破棄しない。詳細は BUGS.md 該当エントリ
5. **「キャッシュ」を性急に仮説立てない** (= ファビコン 7 回否定された): まさが複数回シークレットモードで否定したら、キャッシュ以外の真因 (manifest / size 不整合 / middleware) を **全部** 確認

---

## 入口

- [`design/L2_DATA.md`](design/L2_DATA.md) ⭐⭐⭐ — L2 6 種 + 全 cron 一覧 (sync-pj-facts daily cron 追加 by 本セッション)
- [`design/README.md`](design/README.md) — 設計 md インデックス
- [`design/SPEC_pwa.md`](design/SPEC_pwa.md) — PWA 全体仕様
- [`BUGS.md`](BUGS.md) — 直近事故 (本セッションで 3 件追加: Slack form-encoded / 未 push diff 破棄事故 / favicon 真因)
- [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) 末尾 — 本セッション全 commit + 設計変更網羅
- `/Users/masa/projects/AGENTS.common.md` — えいみ人格 + 「LLM プロンプト運用 (絶対ルール)」セクション

## 運用コマンド

```sh
# Vercel deploy (= 本番反映)
bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh

# DDL 適用
python3 -X utf8 pwa/scripts/apply_ddl.py pwa/scripts/migrations/NNN_name.sql

# 本体 GAS push + deploy
cd /Users/masa/projects/AMD/amd-os/gas
npx @google/clasp@latest push --force
npx @google/clasp@latest deploy --deploymentId AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G --description "vNNN_xxx"

# AMD-Report GAS push (= R303 修正時)
cd "/Users/masa/Library/CloudStorage/GoogleDrive-masa@team-armada.jp/共有ドライブ/claude/AMD_OS/gas-report"
npx @google/clasp@latest push --force

# protocols 再抽出 (本セッション同等)
URL=$(grep '^NEXT_PUBLIC_GAS_WEBAPP_URL=' pwa/.env.local | cut -d= -f2- | tr -d '"')
KEY=$(grep '^NEXT_PUBLIC_GAS_API_KEY=' pwa/.env.local | cut -d= -f2- | tr -d '"')
ARGS=$(python3 -c "import urllib.parse,json; print(urllib.parse.quote(json.dumps([{'force':True,'maxItems':12}])))")
curl -sL "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=nav_protocol_pollAll&args=$ARGS"

# sync-pj-facts 手動キック
SECRET=$(grep '^CRON_SECRET=' pwa/.env.local | cut -d= -f2- | tr -d '"')
curl -sL "https://amd-os-pwa.vercel.app/api/cron/sync-pj-facts" -H "Authorization: Bearer $SECRET"
```
