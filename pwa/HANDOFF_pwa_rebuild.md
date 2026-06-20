# HANDOFF - AMD OS PWA

- Last updated: 2026-06-20 (別財布 cap_extra 是正完了 / **次主題: ZMP の MS設計を一から再考**)
- Topic: ZMP(p19) 別財布 OkuDoor の本契約汚染を是正 (エンジン+予実表+DB+表示, v0.29.3 deploy済)。その過程でまさが「あびの金額が高すぎる」と指摘 → **OkuDoor企画・現地運用が tag=normal で本契約に混入している MS設計の問題**が判明。次セッションで ZMP の MS設計 (pt/tag/share/期間) を一から見直す。
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app` (v0.29.3 / git_sha 95153036 / dirty:false 確認済)
- Current branch: `main`

## 直近セッション要約 (2026-06-20)

詳細は [`design_log/sessions_2026-06.md`](design_log/sessions_2026-06.md) の 2026-06-20 別財布セクション (3つ)、設計正本 [`design/season_budget_actual.md`](design/season_budget_actual.md) §5.1+§5.2、教訓 [`BUGS.md`](BUGS.md) の別財布 2 エントリ。

- **別財布 cap_extra 汎用化を完遂・deploy** (v0.29.2→v0.29.3): エンジン (extra_budget_yen cap / extra pt単価独立化) + ZMP DB是正 (total_points 187→177 / OkuDoor system開発 share まさ0.6923系 / extra_budget_yen 202610=130万) + 予実表 computeSeasonPl 別財布対応 + 報酬債務台帳の「cap不足」誤表示修正 (pool分離)。
- **計算ルール (65%/pt単価/cap/繰越) は全PJ共通のまま不変。別財布も特殊計算しない** (まさ確定)。汎用プレイブックは §5.2。
- **まさの「あびが高すぎる」指摘から MS設計の根本論点が浮上** (= 次主題): OkuDoor の 3 MS のうち system開発(67pt)だけ cap_extra 別財布化済み、**企画(20pt)・現地運用(20pt)は tag=normal で本契約 regular に混入**したまま。あびの本契約取り分を押し上げていた。

## Repo State

- HEAD: `95153036 fix(payouts): 別財布(cap_extra)を本契約capと突合する誤「cap不足」表示を修正 (v0.29.3)` (push済)
- production: **v0.29.3 / 95153036 / dirty:false 反映確認済**。
- 未push commit: **なし**。dirty: なし (このhandoff doc commit 前)。

## Unresolved / 次アクション (次セッション = ZMP MS設計の再考)

> **まさ確定: 「そもそも ZMP の MS設計から再考したほうがいい」。次セッションの主題。** MS は今セッションで一切触っていない (DB変更は total_points/share/extra_budget_yen のみ)。

1. **ZMP(p19) の MS設計を一から見直す** — pt / tag / share / 期間。特に:
   - **OkuDoor企画 (`MS-p19-2026-01-okudoor-planning`, 20pt, 202601-08, share まさ0.5/あび0.5)**: まさ「あびはそんなに貢献してないかも」「企画は AMD側がそもそもあまり貢献していない気がしてきた」→ **pt と share を下げる方向で見直す**。
   - **OkuDoor現地運用 (`MS-p19-2026-03-okudoor-ops`, 20pt, 202609-12, share まさ0.2/うめ0.4/あび0.4)**: **実消化はまだ0** (`milestone_monthly_progress` progress=0%)。予実/支払予定では将来按分で計上中。まさ確認「現地運用は入ってないよね？」= まだ実発生していない認識。実稼働前なので pt/share は仮置きの可能性。
   - **OkuDoor企画・現地運用は別財布にしない** (= cap_extra にしない。開発じゃないから本契約 regular のまま、というのがまさ確定)。
2. MS 修正後は reward 再計算 (`syncRewardSummariesForProject`、PAID月 202601/202604/202605 は自動 skip) → `/admin/season-pl` と `/admin/payouts` で あびを含む各員の金額が妥当か再検算。
3. **cap不足の端数誤判定** (副次・別課題): 報酬債務台帳が本契約 regular の丸め端数 (数百円) 繰越も「cap不足」赤判定する。本物の cap 逼迫と区別する閾値 or carry 由来判定。MS設計再考と合わせて扱うか別タスク。
4. 既存の別件残課題: ZMP regular プール timing (OS task `task_20260620015628_8lzmx`) / 別財布入力UI自動化 (次段階) / 他PJ監査 (SX 1pt穴 / KUTE budget_yen異常)。

## First Next Action

```bash
cd /Users/masa/projects/AMD/amd-os
git fetch --all --prune
git log --branches --not --remotes --oneline
git status -sb
curl -fsS https://amd-os-pwa.vercel.app/api/build-info   # v0.29.3 のはず
```

その後 [`BUGS.md`](BUGS.md) の `[reward/data] OkuDoor 企画・現地運用 MS が tag=normal で...` エントリと [`design_log/sessions_2026-06.md`](design_log/sessions_2026-06.md) 末尾の「ZMP MS設計再考の論点発見」を読み、ZMP の現行 MS (value_milestones + milestone_responsibility) を実DB read してから まさと MS設計を再考する。報酬計算の正本は [`manual/7-1-reward-calc-spec.md`](manual/7-1-reward-calc-spec.md)。

## Pointers

- 設計正本: [`design/season_budget_actual.md`](design/season_budget_actual.md) §5.1 (別財布是正実証) + §5.2 (別財布処理プレイブック)
- 報酬計算正本: [`manual/7-1-reward-calc-spec.md`](manual/7-1-reward-calc-spec.md) 「別財布 (cap_extra) プール」章 / [`manual/6-5-admin-payouts-reward-notice-spec.md`](manual/6-5-admin-payouts-reward-notice-spec.md)
- 予実表: [`design/FEATURE_REGISTRY.md`](design/FEATURE_REGISTRY.md) `/admin/season-pl`
- 教訓: [`BUGS.md`](BUGS.md) 別財布 cap_extra エントリ (3つ: cap機構/表示混入/MS設計混入)
- セッションログ: [`design_log/sessions_2026-06.md`](design_log/sessions_2026-06.md)

## Verification Run (2026-06-20)

```bash
npx tsc --noEmit --pretty false          # exit 0
npm run test:critical-ui                  # green
npm run build                             # OK
AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh  # v0.29.2 / v0.29.3 deploy 成功
```

- ZMP DB是正は本番適用済 (total_points 177 / OkuDoor system開発 share 0.6923系 / extra_budget_yen 202610=130万)。
- 別財布是正後の実DB検証: うめ/あび OkuDoor各約20万・OkuDoor総消化≈130万・最終月 extraStock=0。報酬債務台帳が pool 分離 (本契約行/別財布行) で表示。
- **未着手 (次セッション)**: ZMP MS設計の再考 (OkuDoor企画 pt/share見直し / 現地運用の実稼働前提整理)。MS は今セッションで未変更。
