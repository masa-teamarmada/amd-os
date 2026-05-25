# HANDOFF — AMD OS PWA

- Last updated: 2026-05-25 深夜
- Topic: dashboard 大幅改修 (#71) + L2 ②〜⑨ Claude routine 8 個統一 + 対話型修正依頼 + OS manual UX overhaul (= 並行作業)
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- HEAD: `ad2e621`

## Latest Summary

並行で 2 軸の改修が走った:

**軸 A: dashboard 大幅改修 + L2 routine + 対話型 UI (= #71、本セッション)**
- `/dashboard` を `/hud/dashboard` 相当の情報量 + 通常テイストに再設計。v1 → v5 まで連続 fb 反映 (= 重複解消 / PL/PM/Closer / 横長 stripe / バイタル trend / マイページ embed / 線太さ統一 / col 固定)
- L2 ②〜⑨ 全 8 種を Claude routine に統一 (= `amd-os-l<N>-<data>-extract`、cron 設定 + scheduled-tasks 登録済、enabled)
- #34 経営ハイライト修正依頼を一方通行 → 対話型 (= start/refine/confirm 3 API + DiffRow UI) に置換
- migration 090 (polarity / score_impact / amd_score_revisions / amd_score_alpha_proposals) + 091 (member_knowledge status/source_hash) apply 済
- ネーミング: `AMD Management Score` → `バイタルサイン (VS)` (UI のみ、DB 維持、まさ #71 確定)
- 詳細は [`design_log/sessions_2026-05.md` #71](design_log/sessions_2026-05.md) 全て (前段 + 後段 + v2-v5 ループ)

**軸 B: OS manual UX overhaul (= 別 codex 並行作業、ad2e621 前の commit 群)**
- `/manual` を book-like global TOC + セクション別目次 + 全章一覧 の構造に
- audience=user / developer 切替で表示番号 (= 1-1 / 2-2 等) を動的生成
- 詳細は [`design_log/sessions_2026-05.md` #85 / #87](design_log/sessions_2026-05.md) (= 別 codex 担当)
- 正本: [`design/os_manual.md`](design/os_manual.md)

## Latest Deployments

- HEAD = `ad2e621` (= 本セッション #71 後段 v5、deploy 完了)
- Vercel deploy 履歴は今セッションで 7 回 (= e2fdf34 → 8fd463b → f2cbf8c → 720c8a1 → 71d3b4d → 6cd3b76 → eacc807 → 369f089 → 2902055 → fed25b8 → a03f373 → ad2e621)
- 別 codex の manual UX deploys: `https://amd-os-4pl6v5l6d-armada0130.vercel.app` / `https://amd-os-3uygkoaqw-armada0130.vercel.app`

## Repo State

- branch: `main`
- 未 push commit なし
- 未 commit (= 別 codex 並行、私は触らない): pwa/HANDOFF_pwa_rebuild.md / pwa/design/L2_DATA.md / pwa/design_log/sessions_2026-05.md / pwa/src/app/(app)/mypage/page.tsx / 他 GAS / iOS / manual 系多数
- 本セッションで触った files (= 全 push 済): dashboard / mypage / strategy-signal-dialog / API dialog/3 routes / operations-catalog / migrations 090+091 / db_schema / design md / manual md / scheduled-tasks SKILL.md 8 個 (git 管轄外)

## Open Tasks

### 🔥 動作観察 (= 翌日)
1. **L2 routine 8 個の翌時 / 翌朝発火** を確認 (= `mcp__scheduled-tasks__list_scheduled_tasks` で lastRunAt + Supabase 各テーブル created_at 新規分 fact 確認)
2. **既存 PWA hourly-estimate + Codex automation `amd-os-ms` / `amd-os` 段階的停止** (= Routine 動作確認 OK 後、 `vercel.disabled-crons.json` 退避 + GAS 154 kill switch + Codex automation unload)
3. **5/22-5/25 取り込み穴期間 backfill** (= 各 routine に `--backfill-from` モード追加 or 手動キック routine)

### 🚧 中型 / 軽め
4. **#21+#20-2+#29+#31 統合 UI/cron** (= migration 090 apply 済、UI/cron 実装が残): AmdScoreFutureEditModal + 透明 hit-area + 日次/週次 cron + `/admin/amd-score-alpha-review`
5. **#22 残箇所 Hint 配置** (= CockpitRoutineGas / CockpitVentureStatus / CockpitMeetingSummary / CockpitMonthlyList / CockpitHeader)
6. **manual UX 残対応** (= 別 codex 側、team feedback 待ち、本 session スコープ外)
7. **#32** XRL prompt DB 化、**#26** TODO かんばん、**#35** 月次報告書ビジュアル、**#17/#18/#10** cockpit 細部、過去残課題プール

### ⚠️ 注意点
- `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` 必須 (= `--cwd .../pwa` 禁止)
- 別 codex 並行運用、push 前必ず `git pull --rebase --autostash origin main`
- TODO は **まさ「おけ」まで completed しない**、報告は **ビルド前**

## First Read Next Session

1. `pwa/HANDOFF_pwa_rebuild.md` (= 本文書)
2. `pwa/manual/00-intro.md` → `pwa/manual/05-decisions-and-history.md` (= 特に §5.7 L2 routine 統一)
3. `pwa/design/L2_DATA.md` (= L2 中核データ正本)
4. `pwa/design/SPEC_pwa.md` / `pwa/design/README.md` (= 設計フォルダ全体)
5. `pwa/BUGS.md` (= 末尾の [meta/ai-interpretation] + [infra/l2-extraction] + [infra/outbox-applier])
6. `pwa/design_log/sessions_2026-05.md` の `#71` (前段 + 後段 + v2-v5) + `#85`/`#87` (= manual UX、別 codex)
7. `pwa/design/feedback_dialog.md` (= 対話型修正依頼設計)
8. `pwa/design/l2_extract_claude_routine.md` (= 8 routine 設計議論)

## First Next Action

```sh
cd /Users/masa/projects/AMD/amd-os
git fetch --all --prune
git status -s
git log --branches --not --remotes --oneline
git pull --rebase --autostash origin main
```

その後:
1. `mcp__scheduled-tasks__list_scheduled_tasks` で 8 routine の lastRunAt / 状況確認
2. Supabase 直叩きで各 L2 テーブル (= protocols / project_knowledge / member_knowledge / project_meeting_summaries / milestone_monthly_progress / project_registry_diffs / project_xrl_evidence / project_strategy_signals) の created_at 新規分を fact 確認
3. fact 確認後、Open Tasks #2 (= 既存停止) or #4 (= #21 統合 UI/cron) に着手

## Pointers

- **マニュアル正本**: [`pwa/manual/`](manual/) (= book TOC 経由で章別、`os_manual.md` で UX 仕様)
- **中核データ正本**: [`pwa/design/L2_DATA.md`](design/L2_DATA.md)
- **設計議論**: [`pwa/design/`](design/) (= 特に `l2_extract_claude_routine.md` / `feedback_dialog.md` / `os_manual.md`)
- **バグ事故ログ**: [`pwa/BUGS.md`](BUGS.md)
- **セッションログ**: [`pwa/design_log/sessions_2026-05.md`](design_log/) (= #36-#71 + manual UX 別 codex #85/#87)
- **PWA 固有運用**: [`pwa/CLAUDE.md`](CLAUDE.md)
- **scheduled tasks (= git 管轄外、まさ手元 mac 限定)**: `~/.claude/scheduled-tasks/amd-os-l<N>-<data>-extract/SKILL.md` (= L2 / L3 / L4 / L5 / L6 / L7 / L8 / L9 の 8 個 + 旧 amd-os-management-dialogue-prep 1 個、合計 9 個 enabled)

## 重要メモ (= 次セッションのえいみへ)

- **scheduled task create は SKILL.md を上書きする**: `mcp__scheduled-tasks__create_scheduled_task` の prompt 引数が SKILL.md に書き込まれる。長文 SKILL.md を保持したい場合は **create 後に Write で再書き込み** (= 本セッションで一度上書き事故、復元済)
- **対話型修正依頼は L2 ⑨ 専用** (= 当面)。他 L2 は次回 routine 発火で `l2_feedbacks` 反映
- **動作観察優先順**: ghost ②④⑤⑥ (= 5/22-5/25 取り込みゼロ) 最優先、稼働中 ③⑦⑧⑨ は並行稼働で fact 比較してから既存停止
- **HANDOFF 肥大化対策**: Latest Summary を追加するときは古い summary を design_log に移してから上書き
- **sparkline 線太さ**: `vector-effect="non-scaling-stroke"` 必須 (= preserveAspectRatio="none" + 異なる横幅 container で stroke が non-uniform scale される。本セッションで一度ハマって修正)

## Verification Commands Run This Session

- `npx tsc --noEmit` (× 多数、全 pass)
- `npm run build` (× 多数、全 pass)
- `npm run test:critical-ui` (× 多数、全 pass)
- `bash pwa/scripts/deploy.sh` (× 7 回、すべて Ready)
- `python3 scripts/apply_ddl.py scripts/migrations/090_*.sql` + `091_*.sql` (= 両方 OK 201)
- Chrome MCP で `/dashboard` + `/project/p21/cockpit` を都度動作確認 (= 対話型 UI の start/refine/confirm 全フロー + dashboard v3/v4/v5 反映確認)
