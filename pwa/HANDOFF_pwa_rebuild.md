# HANDOFF — AMD OS PWA

最終更新: 2026-05-25 (#40 セッション継続)
トピック: **OS マニュアルの継続クロール追記**。#39 の 2 セクション構成に続き、探索系アセット、HUD / Venture Map、Operations Settings の独立章を追加。design/os_manual も現行章立てへ更新。

詳細ログ: [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) 末尾 #40 セッション
**📖 マニュアル正本** (= 新セッション必読): [`manual/00-intro.md`](manual/00-intro.md) → [`manual/08-member-quick-start.md`](manual/08-member-quick-start.md) → [`manual/09-research-assets-quick-start.md`](manual/09-research-assets-quick-start.md) → [`manual/20-system-architecture.md`](manual/20-system-architecture.md) → [`manual/23-hud-and-venture-map-spec.md`](manual/23-hud-and-venture-map-spec.md) → [`manual/24-operations-settings-spec.md`](manual/24-operations-settings-spec.md)
バグ/教訓: [`BUGS.md`](BUGS.md) (= 今回新規追加なし、manual coverage 表を 20 章に追加)

---

## Current Rules
- canonical root: `/Users/masa/projects/AMD/amd-os`、PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- 確認URL: `https://amd-os-pwa.vercel.app/...`、deploy は `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` (`--cwd .../pwa` 禁止)
- **新規セッションは必ず `pwa/manual/` から読む** (= 設計判断の正本)
- 設計変更は必要に応じて `pwa/manual/` (= 正本) + `pwa/design/` 配下を同じ commit で更新
- TODO は **まさが「おけ」と言うまで `completed` にしない**
- 報告は **ビルド前** にする
- TODO description には `[依頼=#N] / [実施] / [deploy] / [まさ承認]` テンプレで書く
- 別 codex セッションが branch を切る運用、push 前に `git pull --rebase origin main` 必須

---

## Latest Summary (= 2026-05-25 #40 セッション継続)

**完了 (= #40)**:
- **探索系アセット章追加**:
  - `manual/09-research-assets-quick-start.md` 新規
  - Atlas / Seeds / VC / Scholar の役割、Seeds status 遷移、VC DPE 出所、Scholar の OpenAlex / `papers_log` 位置付けを整理
- **HUD / Venture Map 仕様章追加**:
  - `manual/23-hud-and-venture-map-spec.md` 新規
  - HUD client の分離方針、HUD routes、HUD dashboard 入力データ、parity checklist、Venture Map の macro 指数・論文政策乖離・主テーブル・実験ビューを整理
- **Operations Settings 仕様章追加**:
  - `manual/24-operations-settings-spec.md` 新規
  - `/admin/settings` の Raw Data / L2 Data / Cron Control、Run Now 内部フロー、実行可 / 停止中 operation、更新ルール、トラブルシュートを整理
- **manual index / design 更新**:
  - `manual-chapters.ts` に 09 / 23 / 24 を追加
  - `00-intro`, `04-admin-ops`, `06-developer`, `07-atlas...`, `08-member-quick-start`, `20-system-architecture` から新章へリンク
  - `design/os_manual.md` を「実装済み + 現行 2 セクション章立て」へ更新
- **manual link 補正**:
  - `MarkdownView` に `linkMode="manual"` を追加
  - manual 画面だけ、manual 章リンクは `/manual/{slug}`、design/scripts 等の相対参照は GitHub blob へ補正。cockpit 側 Markdown は default のまま

**完了 (= #39)**:
- **manual index 2 セクション化**:
  - `pwa/src/app/(app)/manual/manual-chapters.ts` を追加
  - `/manual` を「まず使う人向け」「全体設計・細かい仕様」に grouping
  - prev/next navigation も同じ順序へ変更
- **初心者向け quick start**:
  - `manual/08-member-quick-start.md` 新規
  - `/dashboard` / `/mypage` / cockpit / `/notifications` / `/reimburse` / admin の最短導線を整理
- **全体設計章**:
  - `manual/20-system-architecture.md` 新規
  - platform map、screen map、data layer、write path、auth/role、manual coverage 表を追加
  - route crawl で漏れていた `/atlas/admin/themes`, `/atlas/inbox/submit`, HUD, `/project/{project_id}/config`, Venture Map 実験ビューも追記
- **AMD Score 詳細仕様**:
  - `manual/21-amd-score-spec.md` 新規
  - 数式、M/X/F、軸、α、律速、データソース、根拠 notes、更新フローを整理
- **通知 / つくよみ仕様**:
  - `manual/22-notifications-and-tsukuyomi.md` 新規
  - 正本反映ゲート、`l2_feedbacks`、現状ギャップ、入金確認/PL承認 nudge を整理

**直前完了 (= #38、引き続き有効)**:
- **判断エンジン章追加**:
  - `manual/07-atlas-protocol-score-macrotrend.md` 新規追加
  - Macrotrend / Atlas / AMD Score / AMD Protocol / AMD Management Score の役割分担を整理
  - Atlas routes は現状実装 (`/atlas`, `/atlas/inbox`, `/atlas/map`, `/atlas/macrotrends`, `/atlas/divergence`, `/atlas/decisions`) に合わせて記述
  - AMD Protocol は 2026-05-25 時点で GAS 155 停止・Claude routine 新設予定と明記
- **月次ルーティン図解**:
  - `manual/01-pj-cockpit.md` §1.5 に標準PJ / CTB の締切フロー図、タスク内容、クリック先、`invoice_ym` 延期時の扱いを追記
  - `manual/04-admin-ops.md` §4.6 に admin 側データとの接続図を追記
- **メンバー表現修正**:
  - `manual/00-intro.md` の想定ユーザーから個別メンバー代表行を廃止し、`AMD メンバー` 行に統合
  - manual 内の個別メンバー代表例を一般化
  - `manual/02` / `manual/05` のまさえいMTG説明から、内部事情の説明を削除し「チームへ提案する前の対話セッション」として整理
  - 関連 design md の目立つ旧呼称・内部事情説明も削除

**以前の完了 (= #36 / #37、引き続き有効)**:
- **#36 `project_category` に `new_business` 追加** (= 9127b57)
  - DB migration 089 で CHECK 制約拡張 + ZMP (p19) 移行、本番適用済
  - PWA 5 ファイル変更 (AdminProjectsTable / progress-estimator / activities-infer / Cockpit / HudCockpit{,Header})
  - 設計 md 更新 (cockpit.md / ms_progress.md / db_schema.md)
  - マニュアル正本 manual/05 §5.6 + manual/04 §4.2 に category 表追記
- AskUserQuestion で 4 択提示し、「PJ タイプ」がどの軸かを特定してから動いた (= `project_type` と `project_category` 2 軸の区別)

**Verified (= 今セッションで実際に実行)**:
- #40: route coverage script で主要 page route の manual 言及漏れ 0 件。
- #40: `git diff --check` pass。
- #40: `npm --prefix pwa run build` pass。static pages 152。
- #40: `bash pwa/scripts/deploy.sh` pass、production alias `https://amd-os-pwa.vercel.app` 反映済み。
- #40: Chrome で `/manual`, `/manual/23-hud-and-venture-map-spec`, `/admin/settings`, `/hud/dashboard` を目視確認。
- #39: `git diff --check` pass、route coverage script で主要 page route の manual 言及漏れ 0 件。
- #39: `npm --prefix pwa run build` pass。static pages 149。
- #39: `bash pwa/scripts/deploy.sh` pass、production alias `https://amd-os-pwa.vercel.app` 反映済み。
- #39: `curl -I -L` で `/manual`, `/manual/08-member-quick-start`, `/manual/21-amd-score-spec` が auth redirect 後 200 を返すことを確認。
- #38 は docs-only。`git diff --check` と旧表現 grep で検証。
- #36: `npx tsc --noEmit` pass / `npm run build` pass / Supabase 本番 SELECT / production deploy 済み

**未引継ぎ (= 前セッションから持ち越し)**:
- Open Tasks セクション参照 (= #1 #3-#10 #12-#14 は前回 HANDOFF からそのまま持ち越し、#11 は 2026-05-25 #37 で status 部分も追記済み)

---

## Repo State
- branch: `main`、HEAD: `9127b57 feat(pwa): project_category に new_business を追加 + ZMP (p19) 移行`
- 今セッション私の commit 1 本 (push 済): 9127b57
- handoff 用に次 commit で push 予定:
  - `pwa/HANDOFF_pwa_rebuild.md` (= 本書、リフレッシュ)
  - `pwa/design_log/sessions_2026-05.md` (= #38 セッション追記)
  - `pwa/manual/00-intro.md` / `01-pj-cockpit.md` / `02-amd-cockpit.md` / `03-data-and-extraction.md` / `04-admin-ops.md` / `05-decisions-and-history.md` / `07-atlas-protocol-score-macrotrend.md`
  - `pwa/manual/08-member-quick-start.md` / `20-system-architecture.md` / `21-amd-score-spec.md` / `22-notifications-and-tsukuyomi.md`
  - `pwa/manual/09-research-assets-quick-start.md` / `23-hud-and-venture-map-spec.md` / `24-operations-settings-spec.md`
  - `pwa/src/components/cockpit/MarkdownView.tsx` (= manual linkMode 補正)
  - `pwa/src/app/(app)/manual/page.tsx` / `[slug]/page.tsx` / `manual-chapters.ts`
  - `pwa/design/atlas.md` / `project_strategy_signals.md` / `strategy_signals_redesign.md` / `os_manual.md` / `meeting_summaries.md` / `ui_hint_tooltip.md`
- untracked: `tmp/`、manual 新規章、manual index config

---

## Open Tasks (= 次セッション着手、#36 セッションでは触らず持ち越し)

### 🔥 緊急 / 構造修復
1. **#33 outbox applier 監視先修正** (= `run-ms-outbox-applier.sh` の `STRATEGY_AUTOMATION_DIR` を `amd-os/strategy-signals-outbox` に変更)。これ直さないと毎日 03:30 後に手動 apply 必要
2. **#34 短期 + 中期**:
   - 短期: `CockpitStrategySignals.tsx` に「過去の修正依頼」表示セクション (= l2_feedbacks 読み込み) → 「形跡が残らない」問題解消
   - 中期: Codex automation `amd-os` を PWA cron / Claude routine に移管 + `l2_feedbacks` 読み込み実装 → 修正依頼が反映される

### 大型実装 (= まさ GO 待ち)
3. **#21 + #20-2 + #29 + #31 統合実装** (migration 090?, ※ 089 は #36 で消費済): polarity 列 / score_impact 列 / amd_score_revisions 2 テーブル + CockpitStrategySignals 全面改修 (経営ハイライト rename + アイコン軸 + decision_state 撤廃 + 影響 1 行表示) + AmdScoreFutureEditModal + 透明 r=20 hit-area + 日次自動提案 cron + 週次 alpha レビュー cron + /admin/amd-score-alpha-review
4. **#22 UI ヒント**: 案 D 実装 (= Radix Tooltip wrapper + Hint コンポーネント TS 定数管理 + 初期 30-50 個 hint リスト)
5. **#9 HUD 版同期** (= HudCockpitMeetingDetailModal.tsx に narrative_md 優先 + フレーム廃止 + dialogue ラベル + メリハリ MarkdownView を写す。HUD を正本化方針)
6. **#32 XRL prompt DB 化 + 入力データ再設計** (migration 091?): `xrl_judgment_prompts` テーブル新規 + prompt 内容を「経営ハイライト + XRL 根拠 + 関連メンバー」メインに改訂 + /admin/xrl-prompt 編集画面
7. **#26 TODO かんばん設計議論 → 実装**: 未了議題用、ユーザーが Done に移動したら抽出元同期 + 経営ハイライト級なら自動転記。設計議論 md 作成から
8. **#35 月次報告書ビジュアル改善**: 議事録同様の構造化 + 客観評価 (= AMD 役立度 / 事業進捗 / 先手力低下) + PDCA 回せるレベル

### 中型
9. **#17 案A**: MS リスト + 月次モーダルに「🎯 ゴール / 📝 やること / 📍 現状」3 列
10. **#18 upcoming MTG カード + 強制議事録化ボタン**

### マニュアル追記
11. ✅ **#23 派生 PJ status 追記**: `admin/projects` の status (= draft / active / sales / ended / frozen / lost) 種類と意味、`freeze_from_ym` / `restart_expected_ym` / `project_freeze_periods` との使い分けをマニュアル 04 章 4.2 に追記済み。category 側は #36 で完了
15. ✅ **Atlas / AMD protocol / AMD Score / Macrotrend 追記**: manual 07 章として追加済み。月次ルーティンの締切・タスク内容・フロー図も manual 01 / 04 に追記済み
16. ✅ **manual 2 セクション化 + quick start + 全体設計 + AMD Score 詳細 + 通知仕様**: #39 で追加済み
17. ✅ **探索系 / HUD / Venture Map / Operations Settings 追記**: #40 で manual 09 / 23 / 24 章として追加済み

### 軽め
12. **#10 p00 月次モーダル下段確認** (= 上段は確認済、月次サマリ + MTGサマリ部のスクロール確認だけ残ってる)
13. **過去残課題**: `/admin/members` 実画面 / JOYCLE 関連メンバー再走 / 支払通知書 PDF golden CI / p00 MVV section / `SLACK_EIMI_BOT_TOKEN` ScriptProperties 永続化 / えいみ App icon v5 (まさ手動)

### Slack channel 紐付け確認 (= 簡単)
14. p07 LST / p24 CLG / p25 KUTE は backfill で saved=0 だった。`projects.slack_channel_id` 設定漏れ疑い、確認 + 修正

---

## First Next Action

まず:
```sh
cd /Users/masa/projects/AMD/amd-os
git fetch --all --prune
git status -s
git log --branches --not --remotes --oneline
git pull --rebase origin main   # ← 別 codex セッション commit 取り込み
```

そのあと:
1. **マニュアル正本を必ず読む** ([`pwa/manual/00-intro.md`](manual/00-intro.md) → [`08-member-quick-start.md`](manual/08-member-quick-start.md) → [`20-system-architecture.md`](manual/20-system-architecture.md) → [`05-decisions-and-history.md`](manual/05-decisions-and-history.md))。特に **5.1 cron 廃止経緯 + 5.4 責務分担マトリクス + 5.6 project_category new_business 追加経緯 + §5.7 L2 ②④⑤⑥ ghost 化と Claude routine 4 個新設計画 (= 2026-05-25 発見、緊急復旧中) + 5.8 過去事故ログ** を読まずに動かない
2. **🚨 最優先タスク**: [`pwa/design/l2_extract_claude_routine.md`](design/l2_extract_claude_routine.md) を読んで Routine 1 SKILL.md prompt のまさレビューを取り、`mcp__scheduled-tasks__create_scheduled_task` で登録 → 動作確認 → Routine 2/3/4 を順次投入
3. まさが議論したい議題があれば優先

---

## 🚨 2026-05-25 発見 (= 緊急復旧フェーズ)

**L2 ②④⑤⑥ (= AMD プロトコル / PJ ナレッジ / メンバーナレッジ / MTG サマリ) の自動取り込みが 5/22 以降 ghost 化**。詳細はマニュアル §5.7 + BUGS.md `[infra/l2-extraction]` エントリ。

**現セッションで完了した訂正**:
- マニュアル 03 章 3.1 (= 5 ソース × L2 マトリクス + 稼働中 path 一覧フロー図)
- マニュアル 03 章 3.2 L2 9 種正本表 (= writer + 状態列)
- マニュアル 03 章 3.3 抽出パイプラインの Claude routine セクション (= 新 4 routine 追加)
- マニュアル 03 章 3.4 修正依頼ループの現状ギャップ fact 訂正
- マニュアル 05 章 5.4 責務分担マトリクス (= GAS 153/155/152 停止 + Claude routine 新設予定 4 行追加)
- マニュアル 05 章 5.4 ⚠️ 現状の片肺 項目 1 修復済 + 項目 5 訂正 + 項目 6 新規
- マニュアル 05 章 5.7 新設 (= L2 ghost 復旧計画専用セクション)、旧 5.7 を 5.8 にシフト
- L2_DATA.md L2 9 種正本表 (= ②④⑤⑥ writer + 状態列訂正) + cron 一覧 (= 旧 GAS 5 行 strike-through + 新 routine 5 行追加) + Phase 4 セクション fact 訂正
- BUGS.md `[infra/l2-extraction]` 大型新エントリ追加
- 設計議論 md [`pwa/design/l2_extract_claude_routine.md`](design/l2_extract_claude_routine.md) 新規 — 確定事項 + Routine 1 SKILL.md prompt 完全版 inline + 残設計事項 (= MAIN_CALENDAR_ID 永続化 / color_pj_history / pj_aliases の Claude routine からのアクセス手段)
- `scripts/run-ms-outbox-applier.sh` 監視 dir 修復済 (= STRATEGY_OUTBOX_DIR を実出力先に揃え、bash -n + 単体実行 exit 0 確認、明日 03:30 cron で本検証)
- Supabase: p07 LST / p25 KUTE Slack channel 紐付け修復 (= p25 は `freee_partner_id` 誤入力訂正)

**次セッションで進める**:
1. Routine 1 (= `amd-os-meeting-extract`) のまさレビュー後、`mcp__scheduled-tasks__create_scheduled_task` で登録 (= まず毎時 polling で実装 + 残設計事項 (= calendar id / color_pj_history / pj_aliases) を解決)
2. 動作確認後、Routine 2 / 3 / 4 を順次投入 (= daily 08:00 / 08:15 / 08:30 JST)
3. 5/22-5/25 取り込み穴期間の backfill (= `--backfill-from 2026-05-22` モード追加 or 手動キック)
4. 大型実装 #21+#29+#31 (= 経営ハイライト全面改修)、migration **090** から (= 089 は new_business で別 codex 確保済)
5. その他 Open Tasks #2 #5 #6 #7 #8 #9 #10 #13 #14 #15 (= タスク一覧 [`pwa/HANDOFF_pwa_rebuild.md`](HANDOFF_pwa_rebuild.md) §Open Tasks 参照)

---

## First Read Order (= 必読)

1. **`pwa/manual/00-intro.md`** ⭐⭐⭐ (= マニュアル正本入口)
2. **`pwa/manual/08-member-quick-start.md`** ⭐⭐⭐ (= まず使う人向け)
3. **`pwa/manual/20-system-architecture.md`** ⭐⭐⭐ (= OS 全体設計 / 画面 map / coverage)
4. **`pwa/manual/07-atlas-protocol-score-macrotrend.md`** ⭐⭐⭐ (= Atlas / Macrotrend / AMD Score / AMD Protocol の関係)
5. **`pwa/manual/21-amd-score-spec.md`** ⭐⭐⭐ (= AMD Score 詳細ロジック)
6. **`pwa/manual/22-notifications-and-tsukuyomi.md`** ⭐⭐⭐ (= 通知 / 修正依頼 / 正本反映ゲート)
7. **`pwa/manual/05-decisions-and-history.md`** ⭐⭐⭐ (= 過去判断、cron 廃止経緯、責務分担、§5.6 new_business 経緯、過去事故ログ)
8. `pwa/manual/03-data-and-extraction.md` (= データ抽出 path、用語と実装の対応)
9. `pwa/manual/04-admin-ops.md` §4.2 / §4.6 (= project_category 表、月次ルーティンと admin の接続)
10. `pwa/HANDOFF_pwa_rebuild.md` ← この文書 (= 残タスク + first action)
11. `pwa/BUGS.md` 末尾 (= 直近セッションの教訓)
12. `pwa/design_log/sessions_2026-05.md` 末尾 #39 (= 今セッション全詳細)
13. `pwa/design/L2_DATA.md` (= 中核データ正本)
14. `pwa/design/cockpit.md` Project Category 表 (= #36 で更新)
15. `pwa/design/strategy_signals_redesign.md` (= #26 #27 #29 #31 統合改訂方針)
16. `pwa/design/score_revision_feedback_loop.md` (= #21 議論)
17. `pwa/design/ui_hint_tooltip.md` (= #22 議論)
18. `pwa/CLAUDE.md` (= 「まさえいMTG」運用手順含む)
