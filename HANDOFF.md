# HANDOFF - AMD OS

- Last updated: 2026-06-25 (BZM Book 0-VI 構造再設計、進化経済査読を軽微修正へ)
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- Default branch: `main`

## Latest Session Summary

- BZM (Before Zero Model = 本書) の章構成を、既存 17 章ドラフトから新 Book 0-VI 構造 (870p / 18ヶ月、Tier 3 学術モノグラフ) に再設計する設計議論を実施。4 つの設計提案 md を `pwa/bzm/` に push (本文ではなく本文外の設計ノート)。
- 5 経済学者 persona の adversarial verify を 3 ラウンド回し、Evolutionary Economist 査読の verdict trajectory: NO → 条件付き受理 (Major Revision) → 軽微修正 (accept conditional)。Cambridge UP Schumpeter モノグラフ + Research Policy 特集号巻頭論文の publication path が確定。
- サイドナビ (`bzm-chapters.ts`) に「設計提案 (2026-06-25, 本文外)」 part を追加して 4 md を登録。`BUILD_VERSION` v0.34.25 → v0.34.26 に bump (後追い)。
- まさ最終決定: 提案 1 の Book 0-VI 構成で本文執筆開始。次セッションは Book II Ch 5 (Triple Helix SSM) から起草。
- 詳細は `pwa/design_log/sessions_2026-06.md` の 2026-06-25 エントリ、台帳は `pwa/bzm/COMMANDER_TASKS.md`、4 提案物は `pwa/bzm/2026-06-25_*.md` を参照。

## Repo / Deploy State

- Local branch: `main`
- 2026-06-25 セッションで追加された commit (古→新):
  - `1088124f` initial proposal_book0_vi (英語混在)
  - `3a557e8b` proposal_book0_vi 日本語翻訳 v1
  - `cc954d9b` 既存 → 新章 mapping md 追加
  - `718af3af` Book II 構造手術 Rev 1 (進化経済 NO → 条件付き受理)
  - `4bafe452` Book II 構造手術 Rev 2 (条件付き受理 → 軽微修正、Cambridge UP path 確定)
  - `c3949656` サイドナビに提案 part を追加 (bzm-chapters.ts)
  - `274e742c` 厳格再翻訳 (4 md の英語混入を経済学・統計学訳語に置換)
  - `81db5530` BUILD_VERSION v0.34.25 → v0.34.26 (後追い bump)
- Production `/api/build-info` at closeout: `v0.34.26` / `81db5530` / `dirty=false` (まさ目視確認)
- Pre-existing dirty/untracked items (本セッション外):
  - `gas-slack/.clasp.json` (前回 handoff からのキャリーオーバー、GAS/Slack owner 判断待ち)
  - `pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/outbox/` (worker outbox local artifact)
  - `pwa/scripts/update_drive_file.mjs` (untracked script)
  - `pwa/src/app/api/meeting-assets/replace/` (untracked api dir)

## Dirty State To Own

| path | status | class | owner guess | resolution action | risk |
|---|---:|---|---|---|---|
| `gas-slack/.clasp.json` | `??` | unknown / local tooling | GAS/Slack owner or quarantine | decide track vs local exclude vs safe remove; do not print contents | low-medium: accidental secret/local link commit risk |

Dirty buckets:
- needs Masa/GAS owner decision: `gas-slack/.clasp.json` owner/handling
- expected after this handoff commit: no tracked dirty files; `gas-slack/.clasp.json` remains untracked

## Verification Already Run For Monthly Agreement / Payout Work

- `npx tsx -e ...buildPayoutAgreementGateSummary(...)`: `source_ym=202605` row returns `status=agreed`, `migrationBypass=true`, `blockers=0`.
- `git diff --check`
- `npx tsc --noEmit`
- `npx eslint src/lib/monthly-work-agreement-payout-gate.ts src/components/admin/AdminPayoutsClient.tsx` (existing `react-hooks/exhaustive-deps` warning 1, error 0)
- `npm run build`
- `npm run test:critical-ui`
- Logged-in browser check: `/admin/payouts?ym=202606` on production `v0.34.19` shows `対象支払行 4 / 移行月スキップ 4 / blocker 0`, no individual member table.

## Unresolved Tasks

1. **BZM 本文執筆 Book II Ch 5 から開始 (最優先、まさ最終決定)**
   - 提案 1 (`pwa/bzm/2026-06-25_proposal_book0_vi`) の Book 0-VI 構成を採用。
   - 推奨書き順: Book II Ch 5/5.5/9 load-bearing 定理 → Book III ケース → Book 0 → I → IV → V → VI。
   - Book II Ch 10 (進化経済 OPENER) は提案 4 が detailed section design (§10.0〜10.10、72p) を含む。
   - 起草時は提案 2 (mapping md) を素材棚として使う (既存 17 章の 194 節 → 新 37 章への対応表)。
2. **進化経済査読の軽微修正残 5 件** (執筆中対応)
   - Pilot power calculation at N≈32 / §10.8 kernel-identification 解消 / F_char measurement validity / International-17 cohort selection 補正 / Theorem 3 A3 defense。
3. **残 4 経済学者査読パスの構造手術** (DSGE / Innovation Systems / Econometric / AE)
   - 各 baseline で「条件付き受理」だったので進化経済より軽い surgery で軽微修正レベル到達見込み。
4. **まさが先に判断する開放論点** (synth 8 件のうち未決の 5 件)
   - 機関匿名化方針 / 国際比較章対象機関 / prospective prediction registry 18ヶ月 ≥20 case 現実性 / Ch 21 を N≥15 インタビュー program 化するか / ALQ4/Grit/Resilience psychometric controversy 対応。
5. **既存 carry-over (本セッション外)**
   - Governance/action-items production smoke (build-info `3677cd33` 検証)
   - Admin payouts regression smoke (production v0.34.22 → 26 への smoke)
   - `value_milestones` estimate-line pollution cleanup
   - `gas-slack/.clasp.json` (GAS/Slack owner 判断待ち)

## Read First Next Session

1. `HANDOFF.md`
2. `pwa/spec/3-14-monthly-work-agreement-current-spec.md`
3. `pwa/manual/6-5-admin-payouts-reward-notice-spec.md`
4. `pwa/design/FEATURE_REGISTRY.md`
5. `pwa/BUGS.md`
6. `pwa/design_log/sessions_2026-06.md`
7. For governance production verification: `pwa/design/governance_action_items.md`, `pwa/manual/2-3-pj-cockpit.md`

## First Next Action

```sh
cd /Users/masa/projects/AMD/amd-os
git fetch origin main
git status -sb --untracked-files=all
git log --left-right --oneline main...origin/main
curl -fsS https://amd-os-pwa.vercel.app/api/build-info
```

Expected: local `main` and `origin/main` align, no tracked dirty files, production product code is `v0.34.22` with product baseline through `3677cd33`, and only `gas-slack/.clasp.json` remains untracked.

## Guardrails

- Do not show candidate action items in PJ cockpit governance surfaces unless the confirmed-only WIP is intentionally completed.
- Do not re-expand migration-month monthly agreement rows into individual `合意済` member rows. Migration-only gate should stay summary-style.
- Do not create fake `member_monthly_work_agreements` rows for 2026/05 or earlier.
- Do not use `git add .`; stage named files only.
- For future PWA production-bound changes, use `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` from a clean tracked state.
