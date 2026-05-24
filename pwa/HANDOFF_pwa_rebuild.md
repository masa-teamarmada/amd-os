# HANDOFF — AMD OS PWA

最終更新: 2026-05-25 (= 5/24 夜セッション末)
トピック: **OS マニュアル 7 章 + /manual route 着手完了** (= 忘却対策 #23 着手)。前段で #14 #20 #28 #30 修正・経営ハイライト改訂方針 #26 #27 #29 #31 確定。Codex automation outbox 9 件手動 apply で経営ハイライトに 5/22 までの最新 candidate を反映。

詳細ログ: [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) 末尾 (#35 セッション)
**📖 マニュアル正本** (= 新セッション必読): [`manual/00-intro.md`](manual/00-intro.md) → [`manual/05-decisions-and-history.md`](manual/05-decisions-and-history.md) ⭐⭐⭐
バグ/教訓: [`BUGS.md`](BUGS.md) 末尾 6 件 (= 4分類 / ip_regulatory / モーダル loop / cron 復活誤判定 / outbox 不整合 / source_cache 混同)

---

## Current Rules
- canonical root: `/Users/masa/projects/AMD/amd-os`、PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- 確認URL: `https://amd-os-pwa.vercel.app/...`、deploy は `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` (`--cwd .../pwa` 禁止)
- **新規セッションは必ず `pwa/manual/` から読む** (= 2026-05-25 確定、設計判断の正本)
- 設計変更は必要に応じて `pwa/manual/` (= 正本) + `pwa/design/` 配下を同じ commit で更新
- TODO は **まさが「おけ」と言うまで `completed` にしない** (= 2026-05-25 確定、AGENTS.common.md 反映済)
- 報告は **ビルド前** にする (= 同上)
- TODO description には `[依頼=#N] / [実施] / [deploy] / [まさ承認]` テンプレで書く
- 別 codex セッションが branch を切る運用、push 前に `git pull --rebase origin main` 必須

---

## Latest Summary (= 2026-05-25 セッション末)

**完了 (= まさ承認済)**:
- #14 外部環境シグナル復活 (= fd56582)
- #20-1 破線 2 本問題 (= fd56582)
- #25 リニア化漏れ調査 (= 取り下げ)
- #27 名称「経営ハイライト」確定
- #28 cockpit レイアウト 2x2 (= 2f6b337)
- #30 pill 位置 + future ドット数字 (= 2f6b337)

**完了 (= まさ「おけ」未確認、in_progress 保留)**:
- #23 **OS マニュアル 7 章 + /manual route + ナビ追加** (= b58135e、本番反映済 `https://amd-os-pwa.vercel.app/manual`)
- Phase A 緊急復旧: `amd-os` automation outbox 9 件を手動 apply、Supabase の `project_strategy_signals` に candidate INSERT (= 5/22 Finechem・三浦工業・閉鎖鉱山 / 5/13 JAFCO DD 開始 / 5/13 リアクター特許出願 / 他 6 件)
- `~/.codex/automations/amd-os/strategy-signals-outbox/` の 5/24 03:30 滞留分を flush
- Slack `source_cache` を 5/21 以降キャッチアップ (= p06 1 件 / p19 46 件 / p20 74 件 / p21 34 件)。p07 / p24 / p25 は saved=0 (= channel 紐付け要確認)
- AGENTS.common.md に「TODO リスト運用ルール」追加 (= git 外、ローカル直編集)

**設計議論まとめ済 (= 実装着手 GO 待ち)**:
- #21 alpha フィードバック構造: cron on + 全 PJ 共通 OK (まさ確定)
- #22 UI ヒント: 案 D (Radix Tooltip + Hint コンポーネント TS 定数管理) でやってみよう (まさ確定)
- #26 真意: 未了は経営ハイライト対象外、`done` のみ書く。未了は **TODO かんばん** (= 別 UI、別 task) へ
- #29: 4 アイコン軸 (🎉/✨/🔄/⚠️) 確定、🌐 中立は廃止 (= 外部環境シグナルも PJ にとってプラスかマイナスのいずれか)
- #31: 案 A 確定 (= score_impact_summary + score_impact_delta_json 列追加、migration 089 で同 commit 予定)
- #32: XRL prompt DB 化 + 入力データ再設計 (= 経営ハイライト + XRL 根拠 + 関連メンバーをメイン、沿革 + チーム名簿は副次)
- #9: HUD 維持 + 正本化 (= PWA 版で入れた変更を HUD 版に写す)

**Verified**:
- `npx tsc --noEmit` / `npm run build` / `npm run test:critical-ui` 全 pass
- production deploy 3 回 (= マニュアル含む) `https://amd-os-pwa.vercel.app` aliased 成功
- Chrome MCP で `/manual` index + `/manual/05-decisions-and-history` 目視、callout / マーカー / コード強調が綺麗にレンダリング
- p21 cockpit で 5/22 Finechem PoC 候補拡張など 9 件 candidate 並び確認

---

## Repo State
- branch: `main`、HEAD: `b58135e feat(pwa/manual): OS マニュアル 7 章 + /manual ルート + ナビ追加 (#23)`
- 今セッション私の commit 4 本 (全 push 済): fd56582 → 2f6b337 → 21e4df5 → b58135e
- handoff 用に次 commit で push 予定:
  - `pwa/HANDOFF_pwa_rebuild.md` (= 本書、全面リフレッシュ)
  - `pwa/BUGS.md` (= 末尾 3 件追加 = cron 復活誤判定 / outbox 不整合 / source_cache 混同)
  - `pwa/AGENTS.md` (= 必読リスト先頭に `manual/` 追加)
  - `pwa/CLAUDE.md` (= ドキュメント構成表に manual を最上行追加)
  - `pwa/design_log/sessions_2026-05.md` (= #35 セッション追記)
- untracked: `tmp/` (PDF/PNG 確認用、触らない)

---

## Open Tasks (= 次セッション着手)

### 🔥 緊急 / 構造修復
1. **#33 outbox applier 監視先修正** (= `run-ms-outbox-applier.sh` の `STRATEGY_AUTOMATION_DIR` を `amd-os/strategy-signals-outbox` に変更)。これ直さないと毎日 03:30 後に手動 apply 必要
2. **#34 短期 + 中期**:
   - 短期: `CockpitStrategySignals.tsx` に「過去の修正依頼」表示セクション (= l2_feedbacks 読み込み) → 「形跡が残らない」問題解消
   - 中期: Codex automation `amd-os` を PWA cron / Claude routine に移管 + `l2_feedbacks` 読み込み実装 → 修正依頼が反映される

### 大型実装 (= まさ GO 待ち)
3. **#21 + #20-2 + #29 + #31 統合実装** (migration 089): polarity 列 / score_impact 列 / amd_score_revisions 2 テーブル + CockpitStrategySignals 全面改修 (経営ハイライト rename + アイコン軸 + decision_state 撤廃 + 影響 1 行表示) + AmdScoreFutureEditModal + 透明 r=20 hit-area + 日次自動提案 cron + 週次 alpha レビュー cron + /admin/amd-score-alpha-review
4. **#22 UI ヒント**: 案 D 実装 (= Radix Tooltip wrapper + Hint コンポーネント TS 定数管理 + 初期 30-50 個 hint リスト)
5. **#9 HUD 版同期** (= HudCockpitMeetingDetailModal.tsx に narrative_md 優先 + フレーム廃止 + dialogue ラベル + メリハリ MarkdownView を写す。HUD を正本化方針)
6. **#32 XRL prompt DB 化 + 入力データ再設計** (migration 091?): `xrl_judgment_prompts` テーブル新規 + prompt 内容を「経営ハイライト + XRL 根拠 + 関連メンバー」メインに改訂 + /admin/xrl-prompt 編集画面
7. **#26 TODO かんばん設計議論 → 実装**: 未了議題用、ユーザーが Done に移動したら抽出元同期 + 経営ハイライト級なら自動転記。設計議論 md 作成から
8. **#35 月次報告書ビジュアル改善**: 議事録同様の構造化 + 客観評価 (= AMD 役立度 / 事業進捗 / 先手力低下) + PDCA 回せるレベル

### 中型
9. **#17 案A**: MS リスト + 月次モーダルに「🎯 ゴール / 📝 やること / 📍 現状」3 列
10. **#18 upcoming MTG カード + 強制議事録化ボタン**

### マニュアル追記 (= 新規依頼)
11. **#23 派生 PJ status 追記**: `admin/projects` の status (= active / その他) 種類と意味 + **新規追加された「新規事業創出」status** をマニュアル 04 章 4.2 に網羅追記。まずは Supabase で現状全 status 値を確認

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
1. **マニュアル正本を必ず読む** ([`pwa/manual/00-intro.md`](manual/00-intro.md) → [`05-decisions-and-history.md`](manual/05-decisions-and-history.md))。特に **5.1 cron 廃止経緯 + 5.4 責務分担マトリクス + 5.6 過去事故ログ** を読まずに動かない
2. まさが議論したい議題があれば優先。なければ Open Tasks #1 (= outbox applier 修正) or #3 (= 大型統合実装) から着手判断
3. #21 着手するなら migration 089 を書く前に [`design/score_revision_feedback_loop.md`](design/score_revision_feedback_loop.md) + [`design/strategy_signals_redesign.md`](design/strategy_signals_redesign.md) を再読

---

## First Read Order (= 必読)

1. **`pwa/manual/00-intro.md`** ⭐⭐⭐ (= マニュアル正本入口)
2. **`pwa/manual/05-decisions-and-history.md`** ⭐⭐⭐ (= 過去判断、cron 廃止経緯、責務分担、過去事故ログ)
3. `pwa/manual/03-data-and-extraction.md` (= データ抽出 path、用語と実装の対応)
4. `pwa/HANDOFF_pwa_rebuild.md` ← この文書 (= 残タスク + first action)
5. `pwa/BUGS.md` 末尾 6 件 (= 直近セッションの教訓)
6. `pwa/design_log/sessions_2026-05.md` 末尾 #35 (= 今セッション全詳細)
7. `pwa/design/L2_DATA.md` (= 中核データ正本)
8. `pwa/design/strategy_signals_redesign.md` (= #26 #27 #29 #31 統合改訂方針)
9. `pwa/design/score_revision_feedback_loop.md` (= #21 議論)
10. `pwa/design/ui_hint_tooltip.md` (= #22 議論)
11. `pwa/design/os_manual.md` (= #23 初期議論、実装は manual/ に着手済なので参考)
12. `pwa/CLAUDE.md` (= 「まさえいMTG」運用手順含む)
