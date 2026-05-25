# HANDOFF — AMD OS PWA

最終更新: 2026-05-25 (お昼) — えいみ仮眠中作業の closure
トピック: **L2 ②④⑤⑥ ghost 復旧の Routine 1 暫定実装 + 経営ハイライト修正依頼即時反映実装 + 認識誤り 2 件発覚 (= #40 GAS 移植 / #34 一方通行 update)**

> ⚠️ **本 HANDOFF は slim 版** (= 200 行以下目標)。
> 過去セッション (= #36 〜 #69 別 codex 含む) の詳細は [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) を参照。

---

## Current Rules
- canonical root: `/Users/masa/projects/AMD/amd-os`、PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- 確認 URL: `https://amd-os-pwa.vercel.app/...`、deploy は `bash pwa/scripts/deploy.sh` (`--cwd .../pwa` 禁止)
- 新セッションは必ず [`pwa/manual/00-intro.md`](manual/00-intro.md) → [`05-decisions-and-history.md`](manual/05-decisions-and-history.md) から読む
- 設計変更は `pwa/manual/` (正本) + 必要なら `pwa/design/` を同じ commit で更新
- TODO は **まさが「おけ」と言うまで `completed` にしない**、報告は **ビルド前**
- 別 codex 並行運用、push 前に `git pull --rebase --autostash origin main` 必須
- **複数 codex / Claude 並行運用なので、HANDOFF Latest Summary を膨張させない** (= 古い summary は design_log に追記してから削除する運用)

---

## Latest Summary (= 2026-05-25 お昼、えいみセッション)

完了 (まさ「おけ」確認済):
- **#33** 経営ハイライト 03:30 cron 自動取り込み修復 (= applier 監視先 dir 訂正)
- **#14** Slack 紐付け (p07 LST / p25 KUTE PATCH 済、p24 CLG はチャンネル未作成のため触らず)
- **#37** マニュアル 03/05/06 章 + L2_DATA + BUGS + HANDOFF (旧版) 全面 fact 訂正

完了 (まさ「おけ」未確認、in_progress 扱い):
- **#34 短期** 経営ハイライト各カード「🌙 つくよみへの過去の修正依頼」表示セクション + GET endpoint
- **#34 中期** `amd-os` automation の prompt に `l2_feedbacks` 読み込み手順追加 (= 保険、根本は対話型へ転換予定)
- **#34 即時反映 (一方通行版)** `/api/notifications/feedback` の `triggerImmediateReExtraction` に `project_strategy_signal` fast path 追加 + Anthropic Sonnet 4.6 で即時 update → ⚠️ **まさ 「内容変わらない、対話型に変えよう」で根本設計変更**、現実装は次セッションで対話型に置換
- **#22 Hint 部品 + 部分配置** (`Hint.tsx` + `ui-hints/index.ts` 30 個 + CockpitStrategySignals に 3 箇所)
- **#39 Routine 1 暫定** `amd-os-meeting-extract` scheduled-task 登録 (= 毎時 0 分発火) → ⚠️ **#40 認識誤りで dryRun 経由 GAS 依存実装、次セッションで完全移植版に置換**
- **#40 dryRun 暫定** GAS 074/153/155 に dryRun option 追加 + clasp push + deploy `@1473` → ⚠️ **まさ「GAS を呼ぶことは求めてない、GAS の設計を Claude routine 内に移植して」=  次セッションで全面書き直し**

設計判断の途中変更 (= 次セッションで対応):
- **#34** 「即時反映」を「一方通行 update」と解釈 → 実装 → まさ「内容変わらない + 対話型 (= つくよみ提案→まさ確認→確定) でやろう」 → **対話型に方針転換**
- **#40** 「GAS そのまま移植」を「GAS 関数を curl で呼ぶ (= GAS 依存)」と解釈 → dryRun option 追加 → まさ「GAS を呼ぶことは求めてない、GAS で作った設計を Claude routine 内に移植して (= GAS 非依存化)」 → **完全 inline 移植に方針転換**

Verified (= 今セッション実行):
- `npx tsc --noEmit` pass / `npm run build` pass
- Vercel production deploy 2 回 (`a33772d` + `2f096cc`)
- GAS clasp push + deploy `@1473`
- GAS dryRun 動作確認 (= `scanned=2/in_window=0` 正常応答)

---

## Repo State
- branch: `main`、HEAD: `a33772d feat(pwa): #34 経営ハイライト修正依頼の即時反映 + #22 Hint 部分配置`
- 今セッション私の commit: `2f096cc` + `a33772d` (= 全 push 済)
- uncommitted (= 別 codex 並行作業、私は触らない): `gas/154` / `gas/244` / `gas/503` / `gas/940` / `gas/CLAUDE.md` / `ios/supabase/...` / `pwa/BUGS.md` / `pwa/HANDOFF` / `pwa/design/*` / `pwa/manual/*` / 他多数
- untracked: `tmp/` (= まさの確認用、触らない)

---

## Open Tasks (= 次セッション着手、優先順)

### 🔥 最優先 (= 認識誤り訂正、根本実装)

1. **#40 完全移植** — Claude routine `amd-os-meeting-extract` の SKILL.md を **GAS 153 + 074 のロジック inline 完全移植** 版に書き直し。Calendar / Notion / Gmail へのアクセスは MCP 経由直接 (= Sheets MCP 要確認、なければ Drive xlsx export)。GAS 完全 bypass、LLM 呼びは Claude routine 内 Sonnet サブスク内。設計議論 md `pwa/design/l2_extract_claude_routine.md` も dryRun アプローチ撤回 → 完全移植アプローチに改訂
2. **#34 対話型修正依頼** — 一方通行 update 実装を捨て、**対話型** (= つくよみ提案 → まさ判断 → 確定) に置換:
   - `/api/notifications/feedback/dialog/start` 新規 (= Sonnet 呼んで提案を返す、DB 保存はしない)
   - `/api/notifications/feedback/dialog/confirm` 新規 (= まさ承認時に Supabase update + l2_feedbacks 保存)
   - `/api/notifications/feedback/dialog/refine` 新規 (= 過去提案を context にやり直し)
   - CockpitStrategySignals の修正依頼 modal を対話型 UI に拡張
   - 設計議論 md `pwa/design/feedback_dialog.md` 新規

### 🚀 大型実装 (= 残)

3. **#21+#20-2+#29+#31 統合 UI/cron** — migration 090 SQL ドラフト済、apply + UI/cron 実装 (= 経営ハイライト改修 + AmdScoreFutureEditModal + 透明 hit-area + 日次/週次 cron + `/admin/amd-score-alpha-review`)
4. **#41** PWA ダッシュボードに HUD 並みの情報量を移植 (= HudCockpitSignalStrip 相当を PWA 版に追加、UI テイストは通常版維持)
5. **Routine 2/3/4 完全移植版** (= プロトコル / PJ ナレッジ / メンバーナレッジ抽出) — #40 と同パターン
6. **#33 派生 手動実行ボタン** — L2 全種 (議事録 / プロトコル / PJ ナレッジ / メンバーナレッジ / 経営ハイライト) に「いま手動で叩く」ボタン (= `/admin/settings` の operations-catalog 拡張)
7. **#22 残箇所配置** — Hint を CockpitRoutineGas / CockpitVentureStatus / CockpitMeetingSummary / CockpitMonthlyList / CockpitHeader 等に配置

### 🟡 中型 / 軽め

8. **#32** XRL prompt DB 化 + 入力データ再設計
9. **#26** TODO かんばん設計議論 → 実装
10. **#35** 月次報告書ビジュアル改善
11. **#17** MS リスト + 月次モーダルに 3 列レイアウト (🎯 ゴール / 📝 やること / 📍 現状)
12. **#18** upcoming MTG カード + 強制議事録化ボタン
13. **#10** p00 月次モーダル下段スクロール確認 (= Chrome MCP)
14. **5/22-5/25 取り込み穴期間 backfill** (= Routine 1-4 完全移植版稼働後)
15. 過去残課題プール (`/admin/members` 実画面 / JOYCLE 再走 / PDF golden CI / p00 MVV / `SLACK_EIMI_BOT_TOKEN` / えいみ Slack app icon v5)

---

## First Next Action

```sh
cd /Users/masa/projects/AMD/amd-os
git fetch --all --prune
git status -s
git log --branches --not --remotes --oneline
git pull --rebase --autostash origin main
```

その後:

1. **マニュアル正本必読** ([`manual/00-intro.md`](manual/00-intro.md) → [`05-decisions-and-history.md`](manual/05-decisions-and-history.md))。特に §5.1 cron 廃止経緯 + §5.4 責務分担マトリクス + §5.6 new_business + §5.7 L2 ghost 復旧計画 + §5.8 過去事故ログ
2. **本 HANDOFF + design_log/sessions_2026-05.md 末尾** で前セッション末尾を確認
3. **#40 完全移植から着手** (= Open Tasks #1):
   - GAS 153 + 074 + 155 + 関連 helper を全 Read
   - Claude routine `amd-os-meeting-extract` SKILL.md を inline 完全移植版に書き直し
   - データソース MCP 確認 (= Sheets MCP 存在? なければ Drive xlsx export)
   - `pwa/design/l2_extract_claude_routine.md` 改訂 (= dryRun 撤回 → 完全移植)
4. その後 **#34 対話型** (= Open Tasks #2)

---

## Pointers

- **マニュアル正本**: [`pwa/manual/`](manual/) (= 00-09 + 20-24 章)
- **中核データ正本**: [`pwa/design/L2_DATA.md`](design/L2_DATA.md)
- **設計議論 md**: [`pwa/design/`](design/)
- **バグ事故ログ**: [`pwa/BUGS.md`](BUGS.md) (= 末尾の `[infra/l2-extraction]` + `[infra/outbox-applier]` が今セッション関連)
- **過去セッションログ**: [`pwa/design_log/sessions_2026-05.md`](design_log/) (= #36-#69 + 今セッション #70 想定)
- **PWA 固有運用**: [`pwa/CLAUDE.md`](CLAUDE.md)
- **まさえいMTG 運用手順**: [`pwa/CLAUDE.md`](CLAUDE.md) 末尾セクション

---

## ⚠️ 次セッションのえいみへ重要メモ

- **#40 / #34 認識誤りの教訓**: まさが「GAS そのまま移植」「直ちに修正」と言ったら、**斜め解釈せず字義通り受け取れ**。本セッションで dryRun 経由 GAS 依存実装 + 一方通行 update 実装と二度認識誤りを起こした。「斜め解釈する前にまさに確認」のセルフルール (BUGS.md `[meta]` 教訓参照)
- **HANDOFF 肥大化対策**: 今 HANDOFF は 100 行強の slim 版に圧縮した (= 旧 832 行)。次セッションで Latest Summary を追加するときは、古い summary を design_log に移してから上書きする運用を守る
- **対話型修正依頼**: 一方通行 update より対話型 (= つくよみ提案 → まさ判断 → 確定) の方がまさの期待。設計議論 md `feedback_dialog.md` (= 次セッション新規) で具体化してから実装
