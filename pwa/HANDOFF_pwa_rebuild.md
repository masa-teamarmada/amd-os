# HANDOFF — AMD OS PWA

最終更新: 2026-05-25 (#36 セッション末)
トピック: **`project_category` に `new_business` 追加 + ZMP (p19) 移行**。レガシー企業 DX + 研究シーズ取込で新規事業創出するモデルを DTSU と分離。当面はロジック扱い DTSU と同じ (まさ判断、後で見直す)。

詳細ログ: [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) 末尾 #36 セッション
**📖 マニュアル正本** (= 新セッション必読): [`manual/00-intro.md`](manual/00-intro.md) → [`manual/05-decisions-and-history.md`](manual/05-decisions-and-history.md) (= §5.6 に今回判断追加)
バグ/教訓: [`BUGS.md`](BUGS.md) (= 今回新規追加なし、設計判断系の教訓は design_log #36 末尾)

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

## Latest Summary (= 2026-05-25 #36 セッション末)

**完了 (= まさ「さんきゅ」確認済)**:
- **#36 `project_category` に `new_business` 追加** (= 9127b57)
  - DB migration 089 で CHECK 制約拡張 + ZMP (p19) 移行、本番適用済
  - PWA 5 ファイル変更 (AdminProjectsTable / progress-estimator / activities-infer / Cockpit / HudCockpit{,Header})
  - 設計 md 更新 (cockpit.md / ms_progress.md / db_schema.md)
  - マニュアル正本 manual/05 §5.6 + manual/04 §4.2 に category 表追記
- AskUserQuestion で 4 択提示し、「PJ タイプ」がどの軸かを特定してから動いた (= `project_type` と `project_category` 2 軸の区別)

**Verified (= 今セッションで実際に実行)**:
- `npx tsc --noEmit` pass
- `npm run build` pass
- Supabase 本番 SELECT で ZMP の `project_category='new_business'` 確認、CHECK 制約に 4 値含まれること確認
- production deploy (`bash pwa/scripts/deploy.sh` 2 分 22 秒) `https://amd-os-pwa.vercel.app` aliased 成功

**未引継ぎ (= 前セッションから持ち越し)**:
- Open Tasks セクション参照 (= #1 #3-#10 #12-#14 は前回 HANDOFF からそのまま持ち越し、#11 は category 部分完了で status 部分のみ残)

---

## Repo State
- branch: `main`、HEAD: `9127b57 feat(pwa): project_category に new_business を追加 + ZMP (p19) 移行`
- 今セッション私の commit 1 本 (push 済): 9127b57
- handoff 用に次 commit で push 予定:
  - `pwa/HANDOFF_pwa_rebuild.md` (= 本書、リフレッシュ)
  - `pwa/design_log/sessions_2026-05.md` (= #36 セッション追記)
  - `pwa/manual/04-admin-ops.md` (= §4.2 に project_category 表追記)
- untracked: `tmp/`、`pwa/manual/` (= 5/24 セッションで作成、ま既 untracked、別 codex が管理してる可能性あり要確認)

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
11. **#23 派生 PJ status 追記** (= category 部分完了、**status 部分のみ残**): `admin/projects` の status (= draft / active / sales / ended / frozen / lost) 種類と意味をマニュアル 04 章 4.2 に網羅追記。category 側は #36 で完了

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
1. **マニュアル正本を必ず読む** ([`pwa/manual/00-intro.md`](manual/00-intro.md) → [`05-decisions-and-history.md`](manual/05-decisions-and-history.md))。特に **5.1 cron 廃止経緯 + 5.4 責務分担マトリクス + 5.6 project_category new_business 追加経緯 + 5.7 過去事故ログ** を読まずに動かない
2. まさが議論したい議題があれば優先。なければ Open Tasks #1 (= outbox applier 修正) or #3 (= 大型統合実装) から着手判断
3. #21 着手するなら migration 090 を書く前に [`design/score_revision_feedback_loop.md`](design/score_revision_feedback_loop.md) + [`design/strategy_signals_redesign.md`](design/strategy_signals_redesign.md) を再読

---

## First Read Order (= 必読)

1. **`pwa/manual/00-intro.md`** ⭐⭐⭐ (= マニュアル正本入口)
2. **`pwa/manual/05-decisions-and-history.md`** ⭐⭐⭐ (= 過去判断、cron 廃止経緯、責務分担、§5.6 new_business 経緯、過去事故ログ)
3. `pwa/manual/03-data-and-extraction.md` (= データ抽出 path、用語と実装の対応)
4. `pwa/manual/04-admin-ops.md` §4.2 (= project_category 表)
5. `pwa/HANDOFF_pwa_rebuild.md` ← この文書 (= 残タスク + first action)
6. `pwa/BUGS.md` 末尾 (= 直近セッションの教訓)
7. `pwa/design_log/sessions_2026-05.md` 末尾 #36 (= 今セッション全詳細)
8. `pwa/design/L2_DATA.md` (= 中核データ正本)
9. `pwa/design/cockpit.md` Project Category 表 (= #36 で更新)
10. `pwa/design/strategy_signals_redesign.md` (= #26 #27 #29 #31 統合改訂方針)
11. `pwa/design/score_revision_feedback_loop.md` (= #21 議論)
12. `pwa/design/ui_hint_tooltip.md` (= #22 議論)
13. `pwa/CLAUDE.md` (= 「まさえいMTG」運用手順含む)
