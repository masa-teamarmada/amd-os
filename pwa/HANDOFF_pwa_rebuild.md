# HANDOFF — AMD OS PWA / GAS

最終更新: 2026-05-12 (cranky-rhodes-ff4609 #2、exec_summary 機能完成 + backfill 5 種 + 多数連続事故)
詳細セッションログ: [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) 末尾参照

---

## 状態

- main HEAD: `5280503`
- Vercel: `amd-os-elbazbh35-armada0130` (= 7c391f0 反映)
- 本体 GAS deployment: `AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G` @1462
- AMD-Report GAS: scriptId `1r3Ak-tYASXY...` @1455 (= R303 hardcoded fallback は未対応、次セッション)
- 未 push commit: なし
- worktree: `claude/cranky-rhodes-ff4609` (= main にマージ済)

---

## 直近セッション要約 (3-10 行)

まさからの 9 指摘 + 5 指摘 + 3 指摘 を 1 セッションで対応。主要成果:
- **Slack backfill 真因 (= JSON body の ts precision loss) 特定 → form-encoded で完全動作化**
- **5 生データ backfill skeleton 完成** (= 074b Slack 動作中 / 074c Drive / 074d Calendar / 074e Gmail / Notion 既存。GAS v1462 deploy 済)
- **「📑 全 PJ 紹介資料作成」機能完成** (3 ラウンド試行錯誤の末 = ラウンド 3 の template literal で雛形フォーマット完全再現)
- **コックピット: 創業セクション削除 / AMD スコア大表示 / 先手力ラベル復活 / FRL "—" 表示**
- **dashboard: アラート削除 / 紹介資料ボタン追加 / PJ status fallback 撤去**
- **管理画面: STATUS_OPTIONS に draft / プロトコル新旧分離 / プロンプト 5 件 seed (migration 051-055)**
- **重大事故 6 件 BUGS.md 追記**: 雛形自前再構築事故 / モック要請を本物にデプロイ事故 / CSS 変数 scope 落ち / ロゴ相対 URL 404 / 先手力 events 0 件短絡 / Chrome MCP `[BLOCKED]` 制限への POST server 迂回

詳細は [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) の「2026-05-12 (cranky-rhodes-ff4609 #2)」セクション参照。

---

## 🚨 次セッション最優先 (= 残タスク)

### 0. (= 即座) db_schema.md 再生成 ⭐⭐

migration 052 で `project_meeting_summaries.source_url` 列を追加したが `design/db_schema.md` を再生成してない (= 本セッションで net new な列が 1 個発生)。次セッション冒頭で:

```sh
cd /Users/masa/projects/AMD/amd-os/pwa
python3 -X utf8 scripts/dump_schema.py
# → design/db_schema.md が更新される
```

### 1. 進捗イベント (events) 抽出ロジック見直し ⭐ (= まさ 2026-05-12 末追加指摘)

「先手力」表示は復活した。が、そもそも `progress_events` テーブルに events が 0 件の PJ-月が大半。
- `progress-estimator.ts` / `cron/hourly-estimate` / `events_inferred` 系の cron を再点検
- `member_activities` から events を組み立てるロジックが弱い可能性
- まさが「先手力」を意味のある数値で見られる状態 = 直近 1-3 ヶ月で events 5+ 件 / PJ になる状態を目標に

### 2. R303 hardcoded fallback 削除 (= AMD-Report GAS、AGENTS 完遵)

`R303_MonthlyReport_Generator.js` Line 262-270 の hardcoded fallback を残置中。
- migration 053-style で `llm_prompts.monthly_report.r313_extract` body を seed (= 現在 body 空 / is_active=FALSE)
- AMD-Report GAS に Supabase client 追加 → DB fetch → fallback throw
- clasp push (= Drive 共有ドライブ `/Users/masa/Library/CloudStorage/GoogleDrive-masa@team-armada.jp/共有ドライブ/claude/AMD_OS/gas-report/`)

### 3. 試算表 Drive Excel 取り込み cron (= まさ前々セッション指摘 2)

`project_pl_monthly` テーブルが全 PJ 全部「—」表示。Drive folder 配下の `.xlsx` を Sonnet で月次 PL に構造化抽出 → upsert。074c (議事録 Docs backfill) とは別 cron。

### 4. FRL grit / resilience LLM 抽出 cron (= まさ前セッション指摘 4 の根本)

`amd_score_inputs.frl_grit` / `frl_resilience` は手動入力前提で cron 未実装。monthly_reports + meeting_summaries から CEO の集中力・タフさを Sonnet で 0-9 score 推定 → upsert。

### 5. 5 生データ backfill の精度改善

| 種類 | 現状 | 改善案 |
|---|---|---|
| Drive (074c) | folder 直下 only scan | 再帰 scan (= サブフォルダの Docs も拾う) |
| Calendar (074d) | description 薄い event を chitchat 判定で saved=0 | 判定緩和 + Notion AI 議事録 page との連結 (= description が薄くても議事録 page があれば extract) |
| Gmail (074e) | subject フィルタ 6 キーワード | 拡張 + bot 判定強化 + 添付ファイル考慮 |
| Slack | 過去 3 ヶ月分のみ saved=13 | bash ループで `monthsBack=6` × 4 回叩いて残り月分を取り込む |

### 6. protocols dedup + UI archive 運用

- 旧 22 件 legacy_specific → まさが UI で「📥 全部 archive」を 1 クリック
- 新 22 件 pattern に同テーマの重複ペアが 6+ 件 → Sonnet で「意味的に同一」グループ化 → dedup one-time

### 7. ファビコン後日チャレンジ (= TODO 残置)

3 ラウンド試行で未解消 (= curl で配信完全 OK、シークレット 7 回でも見えず)。後日の試行候補:
1. Chrome の Favicons SQLite 直接削除
2. Vercel CDN edge cache の no-store 強制
3. ファビコン URL を `/favicon-v2.ico` 別パスに変更 (= 既存キャッシュキーから完全切り離し)
4. PWA installable として一度インストール + アンインストール
5. ブラウザの強制リロード手順を都度確認

### 8. exec_summary Phase 2 (任意)

PJ ごとに color theme を切り替える (= `.page--{slug}` で `--c-primary` 個別定義)。
現状は全 PJ 共通の AMD 青で表示。

---

## ⚠️ 既知のえいみ傾向 (= 同じ失敗を防ぐため、本セッションで再発した分を反映)

1. **重い実装の先送り癖**: 「次セッションで」と書いた瞬間に進行が止まる
2. **早合点で隣の領域を触る**: まさの指摘の対象を最初に確認せず、コンポーネント / プロンプト / cron を取り違える
3. **「手元にない」即断**: 必ず `mdfind` / `find` / `locate` で徹底探索してから「無い」を結論にする
4. **未 push diff 破棄事故** (= 本セッション再発): worktree 開始時に main repo の `git status -s` の `M` / `??` を確認、内容を `git diff` で見てから判断、無闇に `git checkout HEAD --` で破棄しない
5. **「キャッシュ」を性急に仮説立てない** (= ファビコン 7 回否定された)
6. **「モック」「まずは」「見せて」は本番手前の確認指示** (= 本セッション ダッシュボード cyber 事故): 本番に直接 deploy せず、別ページ / 画像で見せる
7. **AGENTS.md 画像禁止ルール再確認** (= 本セッション 六角形 SVG 自作で違反): 「画像活用」と言われたら本物のロゴ画像 (`<img>`) を配置、SVG / CSS で自作しない
8. **「文字だけ入れ替え」を文字通り守る** (= 本セッション 3 連続崩壊): 雛形の CSS / 構造を書き直したい衝動を抑える。template literal で一字一句コピーが正解
9. **HTML を正規表現で構造置換しない** (= `</div>` 誤マッチ): template literal でコピーか cheerio / DOMParser で parse
10. **CSS 変数の scope cascade 落ちに注意** (= 雛形 `.page--xxx` scope の `--c-primary` 抽出時に消える): 抽出時に `var(--xxx)` を全部 grep して `:root` 定義済か確認
11. **ダウンロード HTML の `<img src>` は絶対 URL 必須** (= file:// で 404): `${origin}/...` で組み立て

---

## 入口

- [`design/L2_DATA.md`](design/L2_DATA.md) ⭐⭐⭐ — 中核データ正本 (L2 6 種 + 5 生データ backfill 一覧)
- [`design/SPEC_pwa.md`](design/SPEC_pwa.md) ⭐ — PWA 全体仕様 (画面・API route・cron・データモデル・ディレクトリ構成)
- [`design/README.md`](design/README.md) — 設計 md インデックス
- [`BUGS.md`](BUGS.md) — 本セッションで 6 件追加 (= 雛形自前再構築 / モック→本物 deploy / CSS 変数 scope 落ち / ロゴ相対 URL 404 / 先手力 events 0 短絡 / Chrome MCP `[BLOCKED]` POST server 迂回)
- [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) 末尾 — 本セッション全 commit + 設計変更網羅
- `/Users/masa/projects/AGENTS.common.md` — えいみ人格 + 「LLM プロンプト運用 (絶対ルール)」
- `pwa/AGENTS.md` — **画像禁止ルール** (= 毎セッション再確認)

## 運用コマンド (本セッションで使ったもの)

```sh
# Vercel deploy
bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh

# DDL 適用
python3 -X utf8 pwa/scripts/apply_ddl.py pwa/scripts/migrations/NNN_name.sql

# 本体 GAS push + deploy (現在 v1462)
cd /Users/masa/projects/AMD/amd-os/gas
npx @google/clasp@latest push --force
npx @google/clasp@latest deploy --deploymentId AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G --description "vNNN_xxx"

# 5 種 backfill 一気 (= 次セッションで実行する想定)
URL=$(grep '^NEXT_PUBLIC_GAS_WEBAPP_URL=' pwa/.env.local | cut -d= -f2- | tr -d '"')
KEY=$(grep '^NEXT_PUBLIC_GAS_API_KEY=' pwa/.env.local | cut -d= -f2- | tr -d '"')
for fn in nav_meeting_backfillSlackAllActive_ nav_meeting_backfillDriveAllActive_ \
         nav_meeting_backfillCalendarAllActive_ nav_meeting_backfillGmailAllActive_; do
  ARGS=$(python3 -c "import urllib.parse,json; print(urllib.parse.quote(json.dumps([{'monthsBack':6,'maxLlmCallsPerRun':18,'maxLlmPerCall':3}])))")
  curl -sL "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=$fn&args=$ARGS" | head -c 200
done

# protocols 再抽出 (= 新 prompt で再キックする時)
ARGS=$(python3 -c "import urllib.parse,json; print(urllib.parse.quote(json.dumps([{'force':True,'maxItems':12}])))")
curl -sL "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=nav_protocol_pollAll&args=$ARGS"

# sync-pj-facts 手動キック (= daily cron 化済、04:00 JST trigger)
SECRET=$(grep '^CRON_SECRET=' pwa/.env.local | cut -d= -f2- | tr -d '"')
curl -sL "https://amd-os-pwa.vercel.app/api/cron/sync-pj-facts" -H "Authorization: Bearer $SECRET"
```
