# HANDOFF — AMD OS PWA

最終更新: 2026-05-25 (#71、お昼 → 深夜) — **L2 8 routine + 対話型 UI + migration 091 + #41 dashboard HUD 並み情報量 + operations-catalog 8 routine + revalidatePath**

> ⚠️ **本 HANDOFF は slim 版** (= 200 行以下目標)。
> 過去セッション (= #36 〜 #70) の詳細は [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) を参照。

---

## Current Rules
- canonical root: `/Users/masa/projects/AMD/amd-os`、PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- 確認 URL: `https://amd-os-pwa.vercel.app/...`、deploy は `bash pwa/scripts/deploy.sh` (`--cwd .../pwa` 禁止)
- 新セッションは必ず [`pwa/manual/00-intro.md`](manual/00-intro.md) → [`05-decisions-and-history.md`](manual/05-decisions-and-history.md) から読む
- 設計変更は `pwa/manual/` (正本) + 必要なら `pwa/design/` を同じ commit で更新
- TODO は **まさが「おけ」と言うまで `completed` にしない**、報告は **ビルド前**
- 別 codex 並行運用、push 前に `git pull --rebase --autostash origin main` 必須

---

## Latest Summary (= 2026-05-25 #71)

**🔥 方針確定**:
- L2 ②〜⑨ 全 8 種を Claude routine に統一 (= ghost ②④⑤⑥ + 稼働中 ③⑦⑧⑨ 全部移管)
- 経営ハイライト修正依頼は対話型 (= start/refine/confirm 3 API + DiffRow + 適用/やり直し/追加コメント UI)

**完了 (まさ「おけ」確認済)**:
- 方針確定 + 既存稼働 fact 報告 + Routine 化スコープ拡大

**完了 (まさ「おけ」未確認、in_progress 扱い)**:
- **Routine 1-8 SKILL.md 完全 inline 移植版 + scheduled task 全登録** (= 命名規約: `amd-os-l<N>-<data-name>-extract`):
  - `amd-os-l2-protocol-extract` (daily 08:00) = AMD プロトコル
  - `amd-os-l3-ms-progress-extract` (毎時 0 分) = MS 進捗
  - `amd-os-l4-project-knowledge-extract` (daily 08:15) = PJ ナレッジ
  - `amd-os-l5-member-knowledge-extract` (daily 08:30) = メンバーナレッジ
  - `amd-os-l6-meeting-extract` (毎時 0 分) = MTG サマリ (旧 amd-os-meeting-extract をリネーム、443 行 inline)
  - `amd-os-l7-registry-diff-extract` (6h ごと) = OS 台帳差分
  - `amd-os-l8-xrl-evidence-extract` (6h ごと、L7 と 15 分ずらし) = XRL 根拠
  - `amd-os-l9-strategy-signal-extract` (daily 03:20) = 経営ハイライト
- **#34 対話型修正依頼**: helper `pwa/src/lib/strategy-signal-dialog.ts` + API 3 個 (start/refine/confirm) + CockpitStrategySignals modal 対話型 UI + `router.refresh()` + 旧 `reextractStrategySignalImmediate` 削除 + L2 ⑨ 即時再抽出分岐削除
- **migration 090 apply** (= polarity / score_impact_summary / amd_score_revisions / amd_score_alpha_proposals + RLS)
- **#34 中期 revert** (= `~/.codex/automations/amd-os/automation.toml` 手順 4 削除)
- **対話型 UI 全フロー実機テスト** (= Chrome MCP、p21 cockpit):
  - Test 1: 1 つ目 signal「Finechem...PoC候補拡張」(impact=high) → 修正依頼 → 提案 → 適用 → DB 更新「Finechem...PoC実施候補リスト入り」(impact=medium) ✓
  - Test 2: 3 つ目 signal「中国レアアース...」 → 修正依頼 → 提案 → **やり直し別案** → polarity forward set ✓ → **追加コメント** → score_impact_summary「📊 影響: Atlas 追い風 BRL +2 見込み」追記 ✓ → 適用 → DB 更新 + 対話履歴 6 件 + applied_count=1 ✓
- **design / manual / L2_DATA / design_log #71 同期**

追加実装 (= まさ「いけるとこまでそのまま残タスク進めて」+ 「ダッシュボード HUD 並み情報量」指示後):
- **#4 revalidatePath**: `strategy-signal-dialog.ts` applyProposal に `revalidatePath('/project/<pid>/cockpit', 'page')` + `/hud/...` 追加 (= 対話型 confirm 後の Next.js cache 強制 invalidate)
- **migration 091 apply**: `member_knowledge` に `status` / `source_hash` / `last_processed_at` 列追加 (= L5 routine schema gap 解消)、既存 row backfill='active'、`db_schema.md` 再生成 (= 120 tables, 1423 columns)
- **L5 SKILL.md 更新**: schema gap 注記削除 + upsert payload に `status='candidate'` + `source_hash` 追加
- **operations-catalog**: `CronOperation.layer` に `"Claude"` 追加 + 8 Claude routine (= `claude-l<N>-<data>-extract`) を末尾に追記
- **#41 dashboard 拡張**: `DashboardScoreOverview` 新規 component (= 通常テイスト、cyber 排除) + `dashboard/page.tsx` に HUD と同じ fetch (= AMD Score + Management Score + actionItems) 追加。`/dashboard` に Management Score / 月次残タスク 5 件 / 各 PJ AMD Score sparkline + M/X/F が表示されることを Chrome MCP で動作確認

Verified:
- `npx tsc --noEmit` + `npm run build` + `npm run test:critical-ui` 全 pass
- Vercel deploy 4 回 (= e2fdf34 + 8fd463b page.tsx fix + f2cbf8c migration 090 fallback + 720c8a1 router.refresh + 71d3b4d #41+91+revalidatePath+operations)
- 全 8 scheduled task enabled、cron 確認
- `/dashboard` 表示確認 (= AMD Management Score 44 + 月次残 5 件 + 9 PJ シグナル)

---

## Repo State
- branch: `main`、HEAD: `720c8a1` (= #71 commits) + これから commit する HANDOFF / design_log 更新
- 別 codex 並行作業: pwa/manual/* / gas/* / ios/* 多数 (= 触らない)

---

## Open Tasks (= 次セッション着手、優先順)

### 🔥 動作観察 + 段階的停止 (= 8 routine 稼働後)

1. **8 routine 動作観察**: 翌時 0 分 L3/L6 発火 → 翌朝 8:00/8:15/8:30 L2/L4/L5 → 翌 6h 単位 L7/L8 → 翌 03:20 L9。各 routine の出力を fact 確認 (= Supabase 直叩きで saved 件数 / source_hash / l2_extract_state 確認)、必要なら SKILL.md 修正
2. **既存 PWA `/api/cron/hourly-estimate` 停止** (= L3 routine 動作確認後): `vercel.json` から外し → `vercel.disabled-crons.json` に退避 + GAS 154 `nav_pwa_pingHourlyEstimate` を kill switch ON
3. **既存 Codex automation 段階的停止** (= L7/L8/L9 動作確認後): `amd-os-ms` (= L7/L8) → `amd-os` (= L9) → LaunchAgent applier の outbox 監視も unload (= 残るは Atlas のみ)

### 🚧 後追い改善

4. ~~**対話型 UI 表示反映**~~ → ✅ 完了 (= revalidatePath 追加、71d3b4d)
5. ~~**member_knowledge schema gap**~~ → ✅ 完了 (= migration 091 apply、71d3b4d)
6. **5/22-5/25 取り込み穴期間 backfill**: 各 routine に `--backfill-from 2026-05-22` モード追加 or 手動キック routine 別建て (= 動作観察後)

### 🚀 大型実装 (= 既存)

7. **#21+#20-2+#29+#31 統合 UI/cron** (= migration 090 apply 済、UI/cron 実装が残): 経営ハイライト改修 + AmdScoreFutureEditModal + 透明 hit-area + 日次/週次 cron + `/admin/amd-score-alpha-review`
8. ~~**#41** PWA ダッシュボードに HUD 並みの情報量を移植~~ → ✅ 完了 (= DashboardScoreOverview、71d3b4d)
9. ~~**#33 派生 手動実行ボタン**~~ → 🟡 半完了 (= operations-catalog に 8 routine 追加 71d3b4d、手動キック ボタン UI 自体は scheduled-tasks MCP 経由制約で manual reason 明記のみ。PWA から直接 routine を kick したいなら別途 API 経由設計が必要)
10. **#22 残箇所配置** (= Hint を CockpitRoutineGas / CockpitVentureStatus / CockpitMeetingSummary / CockpitMonthlyList / CockpitHeader 等に)

### 🟡 中型 / 軽め

11. **#32** XRL prompt DB 化 + 入力データ再設計
12. **#26** TODO かんばん設計議論 → 実装
13. **#35** 月次報告書ビジュアル改善
14. **#17** MS リスト + 月次モーダルに 3 列レイアウト
15. **#18** upcoming MTG カード + 強制議事録化ボタン
16. **#10** p00 月次モーダル下段スクロール確認
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

1. **マニュアル正本必読** ([`manual/00-intro.md`](manual/00-intro.md) → [`05-decisions-and-history.md`](manual/05-decisions-and-history.md)、特に §5.7 L2 ②〜⑨ Claude routine 8 個統一)
2. **本 HANDOFF + design_log/sessions_2026-05.md 末尾 (#71)** で前セッション末尾を確認
3. **`mcp__scheduled-tasks__list_scheduled_tasks`** で 8 routine の lastRunAt / 状況確認
4. **動作観察** (= Open Tasks #1): Supabase 直叩きで各 L2 テーブルの最新更新時刻 + saved 件数を確認、SKILL.md 修正必要なら patch

---

## Pointers

- **マニュアル正本**: [`pwa/manual/`](manual/)
- **中核データ正本**: [`pwa/design/L2_DATA.md`](design/L2_DATA.md)
- **設計議論 md**: [`pwa/design/`](design/) (= 特に `l2_extract_claude_routine.md` + `feedback_dialog.md`)
- **バグ事故ログ**: [`pwa/BUGS.md`](BUGS.md)
- **過去セッションログ**: [`pwa/design_log/sessions_2026-05.md`](design_log/) (= #36-#71)
- **PWA 固有運用**: [`pwa/CLAUDE.md`](CLAUDE.md)
- **scheduled-tasks**: `~/.claude/scheduled-tasks/amd-os-l<N>-<data-name>-extract/SKILL.md` (= git 管轄外、まさ手元 mac 限定)

---

## ⚠️ 次セッションのえいみへ重要メモ

- **scheduled task の create は SKILL.md を上書きする**: `create_scheduled_task` 呼ぶときに prompt 引数が SKILL.md に書き込まれる。長文 SKILL.md を保持したい場合は **create 後に Write で再書き込み** する (= 本セッションで一度上書き事故起こした、復元済)
- **対話型修正依頼は L2 ⑨ 専用** (= 当面)。他 L2 は次回 cron 待ち + 各 routine の prompt に `l2_feedbacks` 読み込み手順を組み込んで対応
- **動作観察の優先順**: ghost ②④⑤⑥ (= 5/22-5/25 取り込みゼロ) を最優先、稼働中 ③⑦⑧⑨ は既存と並行稼働で fact 比較してから既存停止
- **HANDOFF 肥大化対策**: Latest Summary を追加するときは古い summary を design_log に移してから上書き
