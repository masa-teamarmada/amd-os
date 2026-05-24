# HANDOFF — AMD OS PWA

最終更新: 2026-05-24 (3 回目 = session 末)
トピック: まさ × えいみ 対話セッションで 23 件 (案D/E/F + 中規模追加) を 6 commit + migration 088 で消化。**残: #14 中国レアアース消えた問題復活 / #17 案A MS 拡張 / #18 upcoming MTG / #20 破線 2 本問題 + クリック範囲 / #21 alpha フィードバック + 自動修正提案 / #22 UI ヒント / #23 マニュアル**

詳細ログ: [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) 末尾 (#33 セクション、8 ラウンド全部分解)
関連仕様: [`design/README.md`](design/README.md) ⭐ / [`design/L2_DATA.md`](design/L2_DATA.md) / [`design/SPEC_pwa.md`](design/SPEC_pwa.md) / [`design/FEATURE_REGISTRY.md`](design/FEATURE_REGISTRY.md) / [`design/project_strategy_signals.md`](design/project_strategy_signals.md) / [`design/cockpit.md`](design/cockpit.md) / [`design/meeting_summaries.md`](design/meeting_summaries.md)
**新規 設計議論 md (= 次セッションで議論再開)**: [`design/score_revision_feedback_loop.md`](design/score_revision_feedback_loop.md) (#21) / [`design/ui_hint_tooltip.md`](design/ui_hint_tooltip.md) (#22) / [`design/os_manual.md`](design/os_manual.md) (#23)
バグ/教訓: [`BUGS.md`](BUGS.md) 末尾 3 件 (= 4分類で外部環境消えた / ip_regulatory 混在 / モーダル背景クリック loop)

---

## Current Rules

- canonical root: `/Users/masa/projects/AMD/amd-os`、PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- 確認URL: `https://amd-os-pwa.vercel.app/...`、deploy は必ず `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` (`--cwd .../pwa` 禁止)
- 設計正本は `pwa/design/` 配下。`design_log/` は時系列ログで正本にしない。新規設計 md は `design/` 配下に
- 未確認 dirty files は revert しない (`tmp/` 触らない)
- 完了報告は「まさが何を依頼したか / えいみが何をしたか / 何ができるようになったか」で書く
- 別 codex セッションが同時稼働するので push 前に `git pull --rebase origin main` を必ず確認

---

## Latest Summary

(過去セッション 全 #1-#32 詳細は [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) に記録済。`/admin/payouts` 改善 / 支払通知書PDF golden / L2 ⑨ 経営事業シグナル / cockpit 案C レイアウト / p00 Management Score Hero / dialogue narrative / まさえいMTG 命名 / Slack bot 別人格化)

**今セッション 2026-05-24 PM (#33 全 8 ラウンド)** — まさ × えいみ 23 件改修:

- **Round 4-5** (= 案D/E、まさ #1-#6 1st + 2nd): MTGサマリ source link + dialogue ラベル + Hero + 月次サマリ復活 + フレーム廃止 + narrative_md。`MarkdownView` 強化 (色 / 黄色マーカー / TODO checkbox / 表 / 図 ready)。`narrate` API max_tokens 16000 + 表本文取り込み prompt
- **Round 6** (= #7-#13): 「まさえいMTG」リネーム + Slack 再投稿 / 「5月下旬MTG」過度フォーカス削除 / ✘→✕ / モーダル背景クリック loop 修正 / つくよみ修正依頼 UI (経営シグナル + 議事録) / 3 分類グルーピング / signal_date 事象発生日へ補正 (16 件)
- **Round 7** (= #14-#16, #19): 3→4 分類再設計 (🏛 経営全般 / 🚀 事業開発 / 🔬 技術開発 / 🌐 外部環境) + 時間軸混合表示 / sticky thead / emails edit modal / Gantt bar 短縮表示
- **Round 8** (= #20): AMDスコア today filter + Chart 1/2 間に M/X/F カード
- **Round 9** (= #14-3rd + #20-2nd): ip_regulatory 分割 (= migration 088 で `tech_progress` 新規 + 既存 6 件 re-label) / AMDスコア 過去=実線 / 未来=破線

**Verified This Session**:
- `npx tsc --noEmit` / `npm run build` / `npm run test:critical-ui` 全 pass (= 各 round の deploy 前)
- production deploy 6 回 ((案D + 案E) / Round 6 / Round 7 / Round 8 / Round 9) すべて `https://amd-os-pwa.vercel.app` aliased 成功
- migration 088 (`tech_progress` signal_type) を `apply_ddl.py` で本番適用
- Supabase REST PATCH 多数: `project_strategy_signals` 24 件 re-label (= 8 risk → 内部分類 + 6 ip_regulatory → tech_progress/management_decision/commercial_progress + 16 signal_date 補正) / `milestone_monthly_progress` 98 行 backfill (p00) / `project_meeting_summaries` 3 件 narrative_md 再生成 + 3 件 title rename
- Chrome MCP で実機目視: cockpit 案C + 案D/E/F / dialogue narrative 表 + チェックボックス / 経営シグナル 4 分類 chip / Gantt bar 短縮 / AMDスコア 過去実線+未来破線 / M/X/F カード
- Slack #p21_sx に「えいみ」名義で議事録直リンク版を再投稿 (= 旧 ts=1779556087 削除 + 新 ts=1779608045)

---

## Repo State

- branch: `main`、HEAD: `28c2653 feat(pwa): tech_progress signal type + future score dashed line`
- このセッション私の commit 6 本: 77aa1b4 → 2ced55a → 3f4aae1 → 11ca23f → e40195a → 28c2653 (= 全て origin/main に push 済)
- 別 codex セッション commit `3ecf569 feat(gas): pwaApi runFunc を POST body 経由で叩けるようにする` も main に取り込み済 (= rebase 経由)
- HANDOFF/BUGS/設計議論 md 更新でこの commit 後 untracked: `tmp/` (PDF/PNG 確認用、触らない)
- handoff 用に新規追加するファイル (= 次の commit で push 予定):
  - `pwa/HANDOFF_pwa_rebuild.md` (= 本書、全面 slim 化)
  - `pwa/BUGS.md` (= 末尾 3 件追加)
  - `pwa/design_log/sessions_2026-05.md` (= #33 セッション追記)
  - `pwa/design/project_strategy_signals.md` (= 4 分類 / tech_progress / 外部環境表示問題反映)
  - `pwa/design/score_revision_feedback_loop.md` (= 新規、#21 議論)
  - `pwa/design/ui_hint_tooltip.md` (= 新規、#22 議論)
  - `pwa/design/os_manual.md` (= 新規、#23 議論)

---

## Open Tasks (= 次セッション着手)

優先度順:

1. **#14 中国レアアース消えた問題復活** ⚠️: 「外部環境」カテゴリも cockpit カードに表示する。Atlas リンクは header に残す。`CockpitStrategySignals.tsx` で `visibleSignals` フィルタの `cat !== "external"` 条件を外し、external にも amber 左ボーダーで描画する。詳細は [`BUGS.md`](BUGS.md) の該当エントリ
2. **#20 破線 2 本問題**: 添付スクショで「破線が 2 つある」とまさ指摘 → `pastScorePath` + `futureScorePath` 以外に何か余分な path を描いてる可能性、`CockpitVentureStatus.tsx` を本番 Chrome で目視 + コード読み直し
3. **#20 破線クリック範囲が狭すぎる**: 未来予測ドットの clickable hit area 拡大 (= 透明 r=20 circle を上に重ねる)。`#21 AmdScoreFutureEditModal` 着手と一緒
4. **#17 案A 実装**: MS リスト + 月次モーダルに「🎯 ゴール (`success_criteria`) / 📝 やること (`milestone_sub_items` + `responsibility.task_description`) / 📍 現状 (`milestone_monthly_progress.note` + `progress_pct`)」3 列。新規スキーマなし。MilestoneGanttChart 展開行 + 月次モーダル
5. **#18 upcoming MTG カード + 自動議事録化 + 強制議事録化ボタン**: `project_meeting_summaries` に `source_kinds='upcoming'` 行 INSERT。前回議事録の `next_actions[]` から初期項目自動投入。`nav_meeting_pollRecentlyEndedEvents` cron が実施日後 60-180 分以内に同じ row update。`l2_notifications` で `upcoming_meeting` 通知。手動「強制議事録化」ボタン併設
6. **#21 alpha フィードバック構造実装**: [`design/score_revision_feedback_loop.md`](design/score_revision_feedback_loop.md) 通り。migration 089 で `amd_score_revisions` + `amd_score_alpha_proposals` 2 テーブル + AmdScoreFutureEditModal + 週次 cron + つくよみ自動修正提案 cron
7. **#22 UI ヒント設計確定 → 実装**: [`design/ui_hint_tooltip.md`](design/ui_hint_tooltip.md) 案 D (= Radix Tooltip + Hint コンポーネント TS 定数管理) を承認得て、初期 30-50 個の hint 投入
8. **#23 OS マニュアル設計確定 → 実装**: [`design/os_manual.md`](design/os_manual.md) 章立て案 1/2/3 + データ管理 A/B/C 確定。トップナビ「立替」の右に「📖 マニュアル」追加。初期 5 章 draft
9. **HUD 版モーダルに案D/E/F 思想を写す**: `HudCockpitMeetingDetailModal.tsx` に narrative_md 優先 + フレーム廃止 + dialogue ラベル + メリハリ MarkdownView を写す (= PWA 版だけ反映済、HUD 未対応)
10. **AMD cockpit (p00) 月次モーダル実機確認**: https://amd-os-pwa.vercel.app/project/p00/cockpit で MS Gantt + 月次カード + 月次モーダル目視
11. **過去セッション残課題**: `/admin/members` 実画面確認 / JOYCLE 関連メンバー再走 / 支払通知書 PDF golden 更新 CI / p00 MVV section / `SLACK_EIMI_BOT_TOKEN` を ScriptProperties に永続化 / えいみ App icon v5 差し替え (まさ手動)

---

## First Next Action

まず `git fetch --all --prune && git status -s && git log --branches --not --remotes --oneline` を確認。別 codex セッションが `handoff/2026-05-24-pwa-api-and-gas-docs` branch を切る運用に変わってるので、main 直 push する前に `git pull --rebase origin main` で他セッション commit を取り込む。

そのあと **#14 中国レアアース問題** をまず修正 (= `CockpitStrategySignals.tsx` で external も表示する) → deploy → Chrome 確認 → commit。続けて **#20 破線 2 本問題 + クリック範囲** に着手。両方終わったら #21 設計が確定しているので migration 089 に進む。

それ以降の優先順位は Open Tasks の順序通り。#22 #23 は設計議論 md の叩き台があるので、まさと議論再開してから実装。

---

## First Read Order

1. `pwa/HANDOFF_pwa_rebuild.md` ← この文書 (= 残タスク + first action + pointers)
2. `pwa/BUGS.md` 末尾 3 件 (= 4分類で外部環境消えた / ip_regulatory 混在 / モーダル背景クリック loop)
3. `pwa/design_log/sessions_2026-05.md` 末尾 #33 (= 今セッション全 8 ラウンド詳細)
4. `pwa/design/README.md`
5. `pwa/design/L2_DATA.md` ⭐⭐⭐ (= L2 9 種 + 全 cron 中核データ正本)
6. `pwa/design/project_strategy_signals.md` (= 4 分類 / tech_progress / 外部環境表示問題 反映済)
7. `pwa/design/cockpit.md` (= 4 分類仕様 + p00 月次データ仕様)
8. `pwa/design/meeting_summaries.md` (= MTGサマリモーダル + narrative_md)
9. `pwa/design/score_revision_feedback_loop.md` ⭐ (= #21 議論、新規)
10. `pwa/design/ui_hint_tooltip.md` ⭐ (= #22 議論、新規)
11. `pwa/design/os_manual.md` ⭐ (= #23 議論、新規)
12. `pwa/design/FEATURE_REGISTRY.md`
13. `pwa/design/SPEC_pwa.md`
14. `pwa/CLAUDE.md` (= 「まさえいMTG」運用手順含む)
