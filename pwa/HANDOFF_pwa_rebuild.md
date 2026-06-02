# HANDOFF - AMD OS PWA

- Last updated: 2026-06-02 (通知 mojibake 調査・fix・DB 掃除)
- Topic: Codex automation outbox の日本語化け事故の恒久 fix + 化けた DB 11 行の掃除
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- Current branch: `main`
- Current HEAD: `99c4324 fix(automation): reject mojibake outbox before writing to DB + clean 11 garbled rows`

## 直近セッション (2026-06-02 mojibake)

- まさが `/notifications` で「?? ZMP: ??????」と化けた OS台帳差分通知を発見。
- 原因: Codex automation `amd-os-ms` の 6/1 00:46 run が Gmail 抽出日本語を `?` に lossy 変換し、applier が無検証で DB に保存していた (一過性の LLM 出力事故)。
- A. 恒久 fix: `pwa/scripts/ms_progress_review_tool.mjs` に `assertNoMojibake` ゲート追加。`?{3,}` を検知して outbox を `failed/` 退避 → DB 非汚染。
- B. DB 掃除: 化け 11 行を削除 (全て未採否・再生成可)。p21 confirmed の正規注記は除外。バックアップ `pwa/scripts/_mojibake_cleanup_2026-06-02_backup.json`。
- **次の一手**: 削除した候補は次回 automation run (6h ごと) が生データから再生成する想定。次セッションで `/notifications` を見て正常な日本語で入り直したか確認。入っていなければ手動で automation を走らせる。
- 詳細: `pwa/design_log/sessions_2026-06.md` / `pwa/BUGS.md` `[automation/mojibake] (2026-06-02)`。
- ⚠️ コード deploy は不要 (applier はローカル LaunchAgent 経由で動く非 PWA スクリプト。Vercel deploy 対象外、build-info bump も不要)。

## Current State (前ワークストリーム: ERS / payment, 別件)

- Main includes `1aa3e2e feat(score): backfill FRL cap AMD for active projects`; this handoff adds #103 ERS docs on top.
- Production was reported Ready from the 2026-05-30 22:33 JST deploy. This cleanup did not deploy.
- #97 finance fix, #100 ERS work, and #101 FRL/F_capability work are already represented in main-era docs/logs. This handoff no longer treats `feat/bzm-textbook` or the #100 ERS session as the current branch tip.
- `pwa/HANDOFF_bzm_textbook.md` remains the BZM/AMD Score workstream handoff. Keep BZM model work there, not here.

## ERS 実データ本評価

- 2026-05-31 に 3 機関 × 28 サブ軸 = 84 件を本番 `institution_assessments` へ `evaluated_at='2026-05-31'` / `evaluator='えいみ'` で upsert。
- 最新 note はすべて `本評価2026-05-31` に更新済み。最新行の `draft` note は 0 件。
- 最新 ERS: 香川大 44% / 工学院大 44% / NIMS 74%。
- 本番確認済み: `/institutions` に 44% / 44% / 74% 表示、`/institutions/assess` に Lv チェックと根拠メモ表示。
- 次に見る場所: `/institutions/assess` の根拠メモに「未確認」と残した項目。香川大は軸5/6/7、工学院大は軸5/6/7、NIMSは軸3/5/6/7-d が優先。
- KUTE 規程整備ログを元に、ERS raw evidence として制度比較マトリクス案を追加。ERS 本体は Lv1–5、規程・制度は `unknown` / `not_started` / `drafting` / `established`、詳細は `pwa/design_log/sessions_2026-05.md` #104。
- 制度比較マトリクスは migration `113_institution_policy_matrix.sql` で本番DBへ実装済み。`/institutions/assess` は `ERS評価` / `制度整備` / `規程比較` / `根拠資料` の4タブ。詳細は #105。

## Dirty / Local State

- `pwa/design/venture_map_demo.md` and spec-related files were modified outside this cleanup. Do not stage/revert them without confirming that workflow.
- `pwa/public/bzm/_prxs_9pj.png` was validation-only output from `pwa/scripts/prxs_9pj_inputs.py`.
  - Decision: do not commit/adopt it as a formal asset.
  - Cleanup: remove the generated file locally and ignore `pwa/public/bzm/_*.png` going forward.
  - If a future BZM session wants this figure in docs, regenerate/promote it with a non-underscore filename and add an explicit page reference.

## Payment PR #2

PR: `https://github.com/masa-teamarmada/amd-os/pull/2`

- State at cleanup: open draft, branch `codex/payment-confirm-slack-action`, one commit `dc7027a`.
- Intended diff is small: GAS interactive handler, Slack webhook allowlist, PWA payment confirm POST mode, nudge action flag, docs, build-info.
- Merge risk: branch base is old (`0d1eb0b`). Comparing branch to current main looks huge because main has many later BZM/ERS/FRL/doc commits.
- Reapply check: the PR patch applies cleanly to current main for GAS/API/SPEC files, but conflicts in:
  - `pwa/manual/6-4-finance-payment-confirm-spec.md`
  - `pwa/src/lib/build-info.ts`

Recommendation:

1. Do not merge PR #2 directly.
2. Close/supersede it, or recreate a clean main-based PR.
3. Reapply only the 7 intended files; resolve `manual/6-4` against the current finance docs and handle `build-info.ts` in the deploy commit.
4. Keep `PAYMENT_CONFIRM_SLACK_INTERACTIVE` default/off until GAS is deployed.
5. Required order remains: `clasp login` -> `clasp push --force` -> deploy existing GAS Web App -> set Vercel env -> PWA deploy -> Slack click end-to-end test.

## Useful Logs

- Payment-confirm Slack action: `pwa/design_log/sessions_2026-05.md` #96 and `pwa/BUGS.md` `[GAS/PWA] 入金確認Slack action...`
- CTB finance correction: `pwa/design_log/sessions_2026-05.md` #97 and `pwa/BUGS.md` `[PWA/finance] CTB 202604...`
- ERS UI: `pwa/design_log/sessions_2026-05.md` #100
- ERS 実データ本評価: `pwa/design_log/sessions_2026-05.md` #103
- ERS 制度比較マトリクス: `pwa/design_log/sessions_2026-05.md` #104
- ERS 制度比較マトリクス実装: `pwa/design_log/sessions_2026-05.md` #105
- ERS 制度比較マトリクスRLS境界修正: `pwa/design_log/sessions_2026-05.md` #106
- FRL/F_capability CES: `pwa/design_log/sessions_2026-05.md` #101 and `pwa/HANDOFF_bzm_textbook.md`

## First Next Action

```sh
cd /Users/masa/projects/AMD/amd-os
git fetch --all --prune
git log --branches --not --remotes --oneline
git status -sb
```

Then either continue the owner workflow for the remaining dirty files, or create a fresh main-based replacement for payment PR #2.
