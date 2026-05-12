# HANDOFF — AMD OS PWA / GAS

最終更新: 2026-05-12 (blissful-robinson-8e462a 進捗イベント抽出復元 + MS なし PJ 月次ノート)
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

## 直近セッション要約

まさ 3 指摘を 1 セッションで完遂:
- **進捗イベント抽出ロジック復元** ⭐: 真因 = 2026-05-07 `6d81541` で旧 GAS rewardDashboard 路線を Supabase 直読みに置換した時に、旧 GAS の Sonnet + system prompt + initiative_origin/impact/depth 必須付与のコンセプトが完全に落ちて Haiku で title のみ生成する構成に格下げされていた。migration 056 で列追加、057 で `llm_prompts.member_activities.extract` seed、cron を Sonnet 4.6 + DB prompt + 入力に `project_meeting_summaries` 追加 + plan_cycle 必須緩和でリライト。動作確認 = p21 4月 11→14 件、先手力 0%→46%、全 active PJ 4月 16→50 件 (3 倍超)
- **MS なし PJ でも月次モーダルに進捗ノート**: `project_monthly_notes` 新テーブル + `/api/project/monthly-note` + CockpitMonthlyModal の `MonthlyNoteSection` (= MS なし時は強調メッセージ、MS あり時は補足メモ表示)
- **メイン repo の cyber 残骸破棄**: 前セッションが「モック作って」を本物に deploy 後 revert したが残骸 (`dashboard-cyber-lab/` / `mock/` / globals.css cyber CSS / middleware /mock bypass / playwright dep) が main repo に残っていたのを `git checkout HEAD --` + `rm -rf` で完全破棄

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

### 1. R303 hardcoded fallback 削除 (= AMD-Report GAS、AGENTS 完遵)

`R303_MonthlyReport_Generator.js` Line 262-270 の hardcoded fallback を残置中。
- migration 053-style で `llm_prompts.monthly_report.r313_extract` body を seed (= 現在 body 空 / is_active=FALSE)
- AMD-Report GAS に Supabase client 追加 → DB fetch → fallback throw
- clasp push (= Drive 共有ドライブ `/Users/masa/Library/CloudStorage/GoogleDrive-masa@team-armada.jp/共有ドライブ/claude/AMD_OS/gas-report/`)

### 2. 試算表 Drive Excel 取り込み cron (= まさ前々セッション指摘 2)

`project_pl_monthly` テーブルが全 PJ 全部「—」表示。Drive folder 配下の `.xlsx` を Sonnet で月次 PL に構造化抽出 → upsert。074c (議事録 Docs backfill) とは別 cron。

### 3. FRL grit / resilience LLM 抽出 cron 新規

`amd_score_inputs.frl_grit` / `frl_resilience` は手動入力前提で cron 未実装。monthly_reports + meeting_summaries から CEO の集中力・タフさを Sonnet で 0-9 score 推定 → upsert。

### 4. EventsSection の impact 強調表示 (= 本セッションの後続)

migration 056 で member_activities.impact (1-5) 列を追加して LLM も値を入れているが、UI 側はまだ表示してない。impact >= 4 を太字 / アイコンで強調すると先手力評価がより直感的に。`CockpitMonthlyModal.tsx` `EventsSection` の各 event カード内で impact の表示追加。

### 5. 5 生データ backfill の精度改善

| 種類 | 現状 | 改善案 |
|---|---|---|
| Drive (074c) | folder 直下 only scan | 再帰 scan (= サブフォルダの Docs も拾う) |
| Calendar (074d) | description 薄い event を chitchat 判定で saved=0 | 判定緩和 + Notion AI 議事録 page との連結 |
| Gmail (074e) | subject フィルタ 6 キーワード | 拡張 + bot 判定強化 + 添付ファイル考慮 |
| Slack | 過去 3 ヶ月分のみ saved=13 | bash ループで `monthsBack=6` × 4 回叩いて残り月分 |

### 6. protocols dedup + UI archive 運用

- 旧 22 件 legacy_specific → まさが UI で「📥 全部 archive」を 1 クリック
- 新 22 件 pattern に同テーマの重複ペアが 6+ 件 → Sonnet で「意味的に同一」グループ化 → dedup one-time

### 7. ファビコン後日チャレンジ

3 ラウンド試行で未解消 (= curl で配信完全 OK、シークレット 7 回でも見えず)。後日候補:
1. Chrome の Favicons SQLite 直接削除
2. Vercel CDN edge cache の no-store 強制
3. ファビコン URL を `/favicon-v2.ico` 別パスに変更
4. PWA installable として一度インストール + アンインストール
5. ブラウザの強制リロード手順を都度確認

### 8. exec_summary Phase 2 (任意)

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
