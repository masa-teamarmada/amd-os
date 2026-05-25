# HANDOFF — AMD OS PWA

最終更新: 2026-05-25 (#71、お昼 → 夕方) — **L2 ②〜⑨ Claude routine 8 個統一方針確定 + Routine 1 完全 inline 移植 + #34 対話型修正依頼実装**

> ⚠️ **本 HANDOFF は slim 版** (= 200 行以下目標)。
> 過去セッション (= #36 〜 #70 別 codex 含む) の詳細は [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) を参照。

---

## Current Rules
- canonical root: `/Users/masa/projects/AMD/amd-os`、PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- 確認 URL: `https://amd-os-pwa.vercel.app/...`、deploy は `bash pwa/scripts/deploy.sh` (`--cwd .../pwa` 禁止)
- 新セッションは必ず [`pwa/manual/00-intro.md`](manual/00-intro.md) → [`05-decisions-and-history.md`](manual/05-decisions-and-history.md) から読む
- 設計変更は `pwa/manual/` (正本) + 必要なら `pwa/design/` を同じ commit で更新
- TODO は **まさが「おけ」と言うまで `completed` にしない**、報告は **ビルド前**
- 別 codex 並行運用、push 前に `git pull --rebase --autostash origin main` 必須
- HANDOFF Latest Summary を膨張させない (= 古い summary は design_log に追記してから上書き)

---

## Latest Summary (= 2026-05-25 #71、お昼 → 夕方)

**🔥 方針確定** (= まさ #71):
- **L2 ②〜⑨ Claude routine 8 個統一**: ghost 4 種 (②④⑤⑥) だけでなく稼働中の ③⑦⑧⑨ も Claude routine に移管。既存 Codex automation `amd-os-ms` / `amd-os` + LaunchAgent applier は Routine 5-8 動作確認後に段階的停止
- **#34 中期廃止**: 対話型ループが完成したら冗長、`amd-os` automation の prompt から `l2_feedbacks` 読み込み手順を revert

完了 (まさ「おけ」確認済):
- **L2 9 種現状確認** (= 直叩き fact: ghost ②④⑤⑥ + 稼働 ③⑦⑧⑨、①は別 GAS R313 で月次)
- **Routine 化スコープ拡大方針** (= まさ #71 確定、L2 ②〜⑨ 全 8 routine)
- **前セッション残置の 3 件** (= #34 短期 UI セクション + #34 中期 → 廃止 + #22 Hint 配置 3 箇所)

完了 (まさ「おけ」未確認、in_progress 扱い):
- **#40 Routine 1 完全 inline 移植**: `~/.claude/scheduled-tasks/amd-os-meeting-extract/SKILL.md` を **GAS dryRun 経由 → MCP 直叩き完全 inline 移植版** に書き直し (= Calendar / Notion / Gmail / Drive / Slack MCP + サブスク内 Claude LLM + Supabase REST 直叩き、5 ソース全部見る、GAS 完全 bypass)
- **#34 対話型修正依頼**: helper `pwa/src/lib/strategy-signal-dialog.ts` + API 3 個 (`/api/notifications/feedback/dialog/start|refine|confirm`) + CockpitStrategySignals modal を対話型 UI (= input → loading → preview (= DiffRow + 適用/やり直し/追加コメント 3 ボタン) → addComment) に拡張 + 旧 `reextractStrategySignalImmediate` 削除
- **#34 中期 revert** (= `~/.codex/automations/amd-os/automation.toml` 手順 4 削除)
- **design md / マニュアル / L2_DATA 同期** (= `design/l2_extract_claude_routine.md` 改訂 + `manual/05` §5.7 + `design/L2_DATA.md` を 8 routine 統一方針に更新)
- **design_log #71 セッション追記** ([sessions_2026-05.md](design_log/sessions_2026-05.md) 末尾)

Verified (= 今セッション実行):
- `npx tsc --noEmit` pass / `npm run build` pass / `npm run test:critical-ui` pass
- `/api/notifications/feedback/dialog/{start,refine,confirm}` 3 routes がビルド出力に登録

---

## Repo State
- branch: `main`、HEAD: 次セッション開始時に確認 (= 今セッションで #71 commit + push 予定)
- 別 codex 並行作業: `gas/154` / `gas/244` / `gas/503` / `gas/940` / `gas/CLAUDE.md` / `ios/supabase/...` / `pwa/manual/10-38*` 等多数 (= 触らない)
- untracked: `tmp/` (= まさの確認用)

---

## Open Tasks (= 次セッション着手、優先順)

### 🔥 最優先 (= #71 後続)

1. **Routine 1 scheduled task 登録 + 動作確認** — `mcp__scheduled-tasks__create_scheduled_task` で `amd-os-meeting-extract` を cron `0 * * * *` + `notifyOnCompletion=true` で登録、翌時 0 分の発火を観察、上手く動かなければ SKILL.md 修正
2. **対話型 UI 動作確認** — Chrome MCP で `/project/<id>/cockpit` の経営ハイライト各カード → 「⚠️ つくよみに修正依頼」 → textarea → 送信 → 提案表示 → 適用 / やり直し / 追加コメント の挙動を実機確認
3. **Routine 2-4 (= ②④⑤ ghost) SKILL.md** — Routine 1 と同パターンで GAS 155 `nav_protocol_pollAll` / `nav_project_knowledge_pollAll` / `nav_member_knowledge_pollAll` を完全 inline 移植。**member_knowledge schema gap** (= status / source_hash 列なし) は migration 判断必要

### 🚀 大型実装 (= 残)

4. **Routine 5-8 (= ③⑦⑧⑨) SKILL.md** — 既存稼働中なので慎重、Routine 5-8 が動作確認できてから既存 Codex automation / PWA hourly を停止
5. **5/22-5/25 取り込み穴期間 backfill** — 各 routine に `--backfill-from 2026-05-22` モード追加 or 手動キック routine 別建て
6. **既存 Codex automation / LaunchAgent applier の段階的停止** — Routine 5-8 動作確認後
7. **#21+#20-2+#29+#31 統合 UI/cron** — migration 090 SQL apply + 経営ハイライト改修 + AmdScoreFutureEditModal + 透明 hit-area + 日次/週次 cron + `/admin/amd-score-alpha-review`
8. **#41** PWA ダッシュボードに HUD 並みの情報量を移植 (= HudCockpitSignalStrip 相当を PWA 版に追加)
9. **#33 派生 手動実行ボタン** — L2 全種 (議事録 / プロトコル / PJ ナレッジ / メンバーナレッジ / 経営ハイライト) に「いま手動で叩く」ボタン (= `/admin/settings` operations-catalog 拡張)
10. **#22 残箇所配置** — Hint を CockpitRoutineGas / CockpitVentureStatus / CockpitMeetingSummary / CockpitMonthlyList / CockpitHeader 等に配置

### 🟡 中型 / 軽め

11. **#32** XRL prompt DB 化 + 入力データ再設計
12. **#26** TODO かんばん設計議論 → 実装
13. **#35** 月次報告書ビジュアル改善
14. **#17** MS リスト + 月次モーダルに 3 列レイアウト (🎯 ゴール / 📝 やること / 📍 現状)
15. **#18** upcoming MTG カード + 強制議事録化ボタン
16. **#10** p00 月次モーダル下段スクロール確認 (= Chrome MCP)
17. 過去残課題プール (`/admin/members` 実画面 / JOYCLE 再走 / PDF golden CI / p00 MVV / `SLACK_EIMI_BOT_TOKEN` / えいみ Slack app icon v5)

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

1. **マニュアル正本必読** ([`manual/00-intro.md`](manual/00-intro.md) → [`05-decisions-and-history.md`](manual/05-decisions-and-history.md))。特に §5.1 cron 廃止経緯 + §5.4 責務分担マトリクス + §5.7 L2 ②〜⑨ Claude routine 8 個統一 + §5.8 過去事故ログ
2. **本 HANDOFF + design_log/sessions_2026-05.md 末尾 (#71)** で前セッション末尾を確認
3. **Routine 1 動作観察** (= Open Tasks #1): scheduled task が登録済か `mcp__scheduled-tasks__list_scheduled_tasks` で確認、過去 24h の実行ログを確認、upsert 結果を Supabase で fact 確認
4. **対話型 UI 動作確認** (= Open Tasks #2)
5. その後 **Routine 2-4** (= Open Tasks #3) 着手

---

## Pointers

- **マニュアル正本**: [`pwa/manual/`](manual/) (= 00-09 + 20-24 章 + 25-38 章は別 codex 構築中)
- **中核データ正本**: [`pwa/design/L2_DATA.md`](design/L2_DATA.md)
- **設計議論 md**: [`pwa/design/`](design/) (= 特に `l2_extract_claude_routine.md` + `feedback_dialog.md`)
- **バグ事故ログ**: [`pwa/BUGS.md`](BUGS.md) (= 末尾の `[meta/ai-interpretation]` + `[infra/l2-extraction]` + `[infra/outbox-applier]` が #71 関連)
- **過去セッションログ**: [`pwa/design_log/sessions_2026-05.md`](design_log/) (= #36-#71)
- **PWA 固有運用**: [`pwa/CLAUDE.md`](CLAUDE.md)
- **まさえいMTG 運用手順**: [`pwa/CLAUDE.md`](CLAUDE.md) 末尾セクション

---

## ⚠️ 次セッションのえいみへ重要メモ

- **#71 で L2 ②〜⑨ 全 8 routine 統一方針が確定**。Routine 1 (= ⑥ MTG サマリ) は SKILL.md 完成 + scheduled task 登録待ち。Routine 2-8 は同パターンで実装する
- **対話型修正依頼 = L2 ⑨ 経営ハイライト専用** (= 当面)。他 L2 (= ②④⑤⑥) は次回 cron 待ち + 各 routine の prompt に `l2_feedbacks` 読み込み手順を組み込む形で対応
- **既存稼働中の writer は慎重に停止** (= 既存と Claude routine の出力 fact 比較してから既存 unload)
- **GAS 074 + 074b-e + 153 + 155 のロジックは Claude routine SKILL.md に inline 移植**。GAS は完全 bypass、kill switch のまま。「GAS を呼ぶことは求めてない、GAS の設計を移植して」の真意を字義通り受け取る
- HANDOFF 肥大化対策: Latest Summary を追加するときは古い summary を design_log に移してから上書き
