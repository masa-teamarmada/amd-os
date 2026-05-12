# HANDOFF — AMD OS PWA / GAS

最終更新: 2026-05-12 (blissful-robinson-8e462a #2 マクロ係数 P 以外列集計 + 4 lane 補完 + FRL grit/resilience cron 新規)
詳細セッションログ: [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) 末尾参照

---

## 状態

- main HEAD: `3e1de96` (= 本セッション merge 反映済)
- Vercel: `amd-os-8c333k2a8-armada0130` (= 本セッション最終)
- 本体 GAS deployment: `AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G` @1462 (= 前セッションから変更なし)
- AMD-Report GAS: scriptId `1r3Ak-tYASXY...` @1455 (= R303 hardcoded fallback は未対応、次セッション)
- 未 push commit: なし
- worktree: `claude/blissful-robinson-8e462a` (= main にマージ済、削除可)

---

## 🔴 まさから何度も言われた TODO (= 絶対に先送りしない)

このセクションは **まさが過去複数セッションで指摘 → HANDOFF に書いた → 結局実装されず再要求された** タスクの専用枠。次セッションのえいみは **何より先にここを 1 個ずつ潰す**。新規タスクは「次セッション最優先」セクションに書く。

| # | タスク | まさ要求回数 | 実装状態 | 完了条件 |
|---|---|---|---|---|
| ✅ 1 | マクロ係数 P 以外のデータ取得 (= macro_index_log の budget/investment/mention/signal_count + 4 lane 欠落) | 3 回+ | **2026-05-12 完了** | 全 8 lane で 4 列が埋まり、各 lane 月次で増えていく cron が稼働 |
| ✅ 2 | FRL grit/resilience の数値入力 | 3 回+ | **2026-05-12 完了** | 全 active PJ × 月次で Sonnet 推定が走り、5 PJ で 0-9 値 + reasoning 入る |
| 🔴 3 | R303 hardcoded fallback 削除 (= AMD-Report GAS、AGENTS 完遵) | 2 回 | 未着手 | `llm_prompts.monthly_report.r313_extract` body seed + AMD-Report GAS から DB fetch + fallback throw + clasp push 完了 |
| 🔴 4 | 試算表 Drive Excel 取り込み cron 新規 (= project_pl_monthly が全 PJ 「—」表示) | 2 回 | 未着手 | Drive folder 配下の `.xlsx` を Sonnet で月次 PL 構造化抽出 → upsert する cron + Vercel deploy + 手動キック動作確認 |

**ルール**:
- 未着手のままセッション終了する場合は HANDOFF の「直近セッション要約」で **明示的に「未着手のまま持ち越し」と書く** (= silent に消えない)
- 再要求されたら **そのセッションで実装まで完遂**、deploy + 動作確認 + design md 更新 + BUGS に「先送り癖」エントリ追加までが完了

---

## 直近セッション要約

本セッション 2026-05-12 (blissful-robinson-8e462a 全体) で **まさ 6 指摘を 1 セッションで完遂**:

### Round 1 (3 指摘)
1. 進捗イベント抽出ロジック復元 (= 旧 GAS gas/054 の Sonnet + system prompt + initiative_origin)
2. 拾った events の「不明」だらけ修正
3. MS なし PJ で月次モーダルから進捗ノート (= project_monthly_notes 新テーブル)

### Round 2 (1 指摘)
4. AMD スコア表示が XRL グラフに入って右端見切れ → AMD グラフ右上に固定 + 32px に拡大

### Round 3 (2 指摘 = まさ「何度もお願いしてる、明確に TODO に入れて」と怒り)
5. **マクロ係数 P 以外 0 件 + 4 lane 欠落**: macro-backfill chunk 化 (4 lane × 192 件 = 768 件 INSERT) + 新 cron `macro-aggregate-indicators` (= P 以外列を埋める集計、aggregated 143 行 / updated 129 行 / inserted 14 行 / 全 8 lane カバー)
6. **FRL grit/resilience が全 100 行 NULL**: migration 058/059 で `llm_prompts.frl.grit_resilience.extract` seed (= Duckworth 2007 / Markman 2005 0-9 判定基準) + 新 cron `frl-grit-resilience-extract` で 5 PJ × grit/resilience に意味のある数値入る (= 神谷 7/6, 杉浦 7/6, 丸島 6/6, 神谷 5/6, 山地 4/5)

副次:
- メイン repo の cyber 残骸全破棄 (= 前々セッション dashboard-cyber-3d-lab + 前セッション dashboard-cyber-lab 両方)
- db_schema.md 再生成 (= 99 tables / 1086 columns)
- BUGS.md に 4 件追加 (= events 抽出劣化 / HANDOFF 書き漏らし / マクロ + FRL 先送り癖 / etc.)

---

詳細は [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) の「2026-05-12 (blissful-robinson-8e462a)」セクション参照。

---

## 🚨 次セッション最優先 (= 残タスク)

### 0. (= 即座) 全 PJ × 4-5 月の events 残件 + 次期 MS 期間設定 ⭐

本セッション末で以下を background ループで叩いた (= `/tmp/member_activities_backfill.log`):

| PJ | 4月 saved | 5月 saved | 備考 |
|---|---|---|---|
| p00 | 0 | 0 | no source content (= report も meetings もなし) |
| p06 (CTB) | 9 | 5 | MS なし PJ で動作確認 ✅ |
| p10 (SE)  | 6 | 0 | MS なし PJ |
| p19 | 12 | 0 | |
| p20 (CX) | 9 | (未実行) | MS なし PJ で動作確認 ✅ |
| p21 (SX) | 14 | (未実行) | initiative_origin 分布 OK ✅ |
| p25 | 0 | 0 | no source content |
| p24 | 0 | 0 | no source content |

5 月分は monthly_report 未生成 + meeting_summaries 薄い PJ が多くて 0 件。次セッションで:
1. p20/p21 の 5月分 cron キック (`?ym=202605&projectId=p20|p21`)
2. 5月分の monthly_reports 生成 (= AMD-Report GAS の R313 cron が走るのを待つか、手動)
3. p20 (CX) / p06 (CTB) / p10 (SE) / p11 等で次期 MS 期間 (2026 Q2-Q3) を設定 → events に milestone_id 紐付けが入って画面表示が更にリッチになる

### 1. R303 hardcoded fallback 削除 (= AMD-Report GAS、AGENTS 完遵) ⭐ ↑ TODO セクション #3

`R303_MonthlyReport_Generator.js` Line 262-270 の hardcoded fallback を残置中。
- migration 053-style で `llm_prompts.monthly_report.r313_extract` body を seed (= 現在 body 空 / is_active=FALSE)
- AMD-Report GAS に Supabase client 追加 → DB fetch → fallback throw
- clasp push (= Drive 共有ドライブ `/Users/masa/Library/CloudStorage/GoogleDrive-masa@team-armada.jp/共有ドライブ/claude/AMD_OS/gas-report/`)

### 2. 試算表 Drive Excel 取り込み cron (= まさ前々セッション指摘 2) ⭐ ↑ TODO セクション #4

`project_pl_monthly` テーブルが全 PJ 全部「—」表示。Drive folder 配下の `.xlsx` を Sonnet で月次 PL に構造化抽出 → upsert。074c (議事録 Docs backfill) とは別 cron。

### 3. EventsSection の impact 強調表示 (= 本セッションの後続)

migration 056 で member_activities.impact (1-5) 列を追加して LLM も値を入れているが、UI 側はまだ表示してない。impact >= 4 を太字 / アイコンで強調すると先手力評価がより直感的に。`CockpitMonthlyModal.tsx` `EventsSection` の各 event カード内で impact の表示追加。

### 4. 5 生データ backfill の精度改善

| 種類 | 現状 | 改善案 |
|---|---|---|
| Drive (074c) | folder 直下 only scan | 再帰 scan (= サブフォルダの Docs も拾う) |
| Calendar (074d) | description 薄い event を chitchat 判定で saved=0 | 判定緩和 + Notion AI 議事録 page との連結 |
| Gmail (074e) | subject フィルタ 6 キーワード | 拡張 + bot 判定強化 + 添付ファイル考慮 |
| Slack | 過去 3 ヶ月分のみ saved=13 | bash ループで `monthsBack=6` × 4 回叩いて残り月分 |

### 5. protocols dedup + UI archive 運用

- 旧 22 件 legacy_specific → まさが UI で「📥 全部 archive」を 1 クリック
- 新 22 件 pattern に同テーマの重複ペアが 6+ 件 → Sonnet で「意味的に同一」グループ化 → dedup one-time

### 6. ファビコン後日チャレンジ

3 ラウンド試行で未解消 (= curl で配信完全 OK、シークレット 7 回でも見えず)。後日候補:
1. Chrome の Favicons SQLite 直接削除
2. Vercel CDN edge cache の no-store 強制
3. ファビコン URL を `/favicon-v2.ico` 別パスに変更
4. PWA installable として一度インストール + アンインストール
5. ブラウザの強制リロード手順を都度確認

### 7. exec_summary Phase 2 (任意)

PJ ごとに color theme を切り替える (= `.page--{slug}` で `--c-primary` 個別定義)。

---

## ⚠️ 既知のえいみ傾向 (= 本セッションで再発した分を反映)

1. **重い実装の先送り癖**: 「次セッションで」と書いた瞬間に進行が止まる
2. **早合点で隣の領域を触る**: まさの指摘の対象を最初に確認せず、コンポーネント / プロンプト / cron を取り違える
3. **「手元にない」即断**: 必ず `mdfind` / `find` / `locate` で徹底探索してから「無い」を結論にする
4. **未 push diff 破棄事故** (= 本セッションでも残骸対応): worktree 開始時に main repo の `git status -s` の `M` / `??` を確認、内容を `git diff` で見てから判断、無闇に `git checkout HEAD --` で破棄しない (まさ承認なら OK)
5. **「キャッシュ」を性急に仮説立てない** (= ファビコン 7 回否定された)
6. **「モック」「まずは」「見せて」は本番手前の確認指示**: 本番に直接 deploy せず、別ページ / 画像で見せる
7. **AGENTS.md 画像禁止ルール再確認** (= 過去 2 回違反): 「画像活用」と言われたら本物のロゴ画像 (`<img>`) を配置、SVG / CSS で自作しない
8. **「文字だけ入れ替え」を文字通り守る**: 雛形の CSS / 構造を書き直したい衝動を抑える
9. **HTML を正規表現で構造置換しない**: template literal でコピーか cheerio / DOMParser
10. **CSS 変数の scope cascade 落ちに注意**: 抽出時に `var(--xxx)` を全部 grep して `:root` 定義済か確認
11. **ダウンロード HTML の `<img src>` は絶対 URL 必須**: `${origin}/...` で組み立て
12. **GAS → PWA 移植時に概念ごと落とすな** ⭐ 本セッション真因: 旧実装の出力スキーマ + system prompt + LLM モデル選定は **設計の核**。データソース置換だけしてもアプリの精度は再現しない。移植時に「精度の核は何か」を確認
13. **「過去は精度よかった」とまさが言ったら git log を疑う** ⭐: BUGS で「Haiku に格下げ」「entity が削除された」のような明確な後退があれば、それが真因
14. **まさの口頭指示を md に残す** ⭐ 本セッションで露呈: HANDOFF / sessions log に「コード変更を伴わない要望」も書く。「あれどうなった?」と聞かれて design md に痕跡無いのは不適切
15. **「不明」が UI に出るとき、それが LLM 判断結果か API mapping 漏れかを区別する** ⭐ 本セッション真因: 後者は退化バグ
16. **HANDOFF に書いただけで実装しない「先送り癖」を絶対許さない** ⭐⭐ Round 3 真因: 「何度もお願いしてるけど全然やってくれてない」とまさが怒る根本理由。次セッション最優先 #1〜#4 は **次回セッションの最初に必ず潰す**。「重い」「次のセッションで」「Phase 2 で」と縮めない
17. **新 cron 追加時は `db_schema.md` を Read してから .select 列名を書く** ⭐ Round 3 副次事故: `project_founding_members.organization` (= 存在しない、`affiliation` が正解) を想像で書いて PostgREST silent failure。CLAUDE.md の絶対ルールを実際に守る
18. **silent fail を残すと cron は永久に気づかれない** ⭐ Round 3 真因: macro-backfill が JSON parse 失敗で `continue` していた結果 4 lane が 0 件のまま放置。各 chunk の成否を return JSON に必ず含める
19. **prompt の「null / 不明」選択肢は LLM の逃げ道になる**: FRL prompt の「pre-founding なら null」を LLM が強く読みすぎて意味のある PJ でも null。「null は最終手段」「creator 一覧空でも本文推定可」と厳格化が必要

---

## 入口

- [`design/L2_DATA.md`](design/L2_DATA.md) ⭐⭐⭐ — 中核データ正本 (L2 6 種 + 5 生データ backfill 一覧)
- [`design/SPEC_pwa.md`](design/SPEC_pwa.md) ⭐ — PWA 全体仕様
- [`design/db_schema.md`](design/db_schema.md) — 99 tables / 1086 columns (= 本セッションで再生成)
- [`design/README.md`](design/README.md) — 設計 md インデックス
- [`BUGS.md`](BUGS.md) — 本セッションで 2 件追加 (= 進捗イベント抽出劣化 / HANDOFF 書き漏らし)
- [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) 末尾 — 本セッション全 commit + 設計変更網羅
- `/Users/masa/projects/AGENTS.common.md` — えいみ人格 + 「LLM プロンプト運用 (絶対ルール)」
- `pwa/AGENTS.md` — **画像禁止ルール** (= 毎セッション再確認)

## 運用コマンド

```sh
# Vercel deploy (= 本セッションで使用、通知付き)
bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh

# DDL 適用
python3 -X utf8 pwa/scripts/apply_ddl.py pwa/scripts/migrations/NNN_name.sql

# 本体 GAS push + deploy (現在 v1462)
cd /Users/masa/projects/AMD/amd-os/gas
npx @google/clasp@latest push --force
npx @google/clasp@latest deploy --deploymentId AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G --description "vNNN_xxx"

# 進捗イベント cron 手動キック (= 本セッションで動作確認)
SECRET=$(grep '^CRON_SECRET=' pwa/.env.local | cut -d= -f2- | tr -d '"')
curl -sL "https://amd-os-pwa.vercel.app/api/cron/member-activities?ym=202605&projectId=p21" \
  -H "Authorization: Bearer $SECRET" --max-time 180

# 全 active PJ × 1 ヶ月分一括 (= projectId 省略)
curl -sL "https://amd-os-pwa.vercel.app/api/cron/member-activities?ym=202605" \
  -H "Authorization: Bearer $SECRET" --max-time 240

# 5 種 backfill 一気
URL=$(grep '^NEXT_PUBLIC_GAS_WEBAPP_URL=' pwa/.env.local | cut -d= -f2- | tr -d '"')
KEY=$(grep '^NEXT_PUBLIC_GAS_API_KEY=' pwa/.env.local | cut -d= -f2- | tr -d '"')
for fn in nav_meeting_backfillSlackAllActive_ nav_meeting_backfillDriveAllActive_ \
         nav_meeting_backfillCalendarAllActive_ nav_meeting_backfillGmailAllActive_; do
  ARGS=$(python3 -c "import urllib.parse,json; print(urllib.parse.quote(json.dumps([{'monthsBack':6,'maxLlmCallsPerRun':18,'maxLlmPerCall':3}])))")
  curl -sL "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=$fn&args=$ARGS" | head -c 200
done

# initiative_origin 分布の確認 (= 本セッションで使用)
URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' pwa/.env.local | cut -d= -f2- | tr -d '"')
ANON=$(grep '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' pwa/.env.local | cut -d= -f2- | tr -d '"')
curl -sL "${URL}/rest/v1/member_activities?project_id=eq.p21&ym=eq.202604&source=eq.inferred&select=initiative_origin,impact,depth,title" \
  -H "apikey: ${ANON}" -H "Authorization: Bearer ${ANON}"
```
