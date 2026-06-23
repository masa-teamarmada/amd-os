# HANDOFF - AMD OS PWA

- Last updated: 2026-06-23 (Admin MS Overview write boundary / slider UI / closeout)
- Topic: `/admin/ms-overview` is now the canonical MS design editor. Cockpit-side editing is stopped, pt unit rules are restored to period months x 10pt, and the editor UI now has aggregate/all-MS sliders plus compact member share rows.
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- Current branch: `main`

## 直近セッション要約 (2026-06-23)

詳細は [`design_log/sessions_2026-06.md`](design_log/sessions_2026-06.md) の 2026-06-23 Admin MS Overview セクション、仕様正本 [`manual/6-8-admin-ms-overview-spec.md`](manual/6-8-admin-ms-overview-spec.md)、登録簿 [`design/FEATURE_REGISTRY.md`](design/FEATURE_REGISTRY.md)、教訓 [`BUGS.md`](BUGS.md) の MS editing / slider エントリ。

- **MS設計の保存口を `/admin/ms-overview` に集約**。cockpit / HUD cockpit は表示・進捗確認のみ。MS名 / pt / tag / 期間 / 完了条件 / 担当share / 役割 / タスク / 追加 / 無効化は admin MS Overview の編集モードで保存する。
- **pt単価の正本を復旧**。regular = シーズン期間月数 x 10pt、cap_extra = MS期間月数 x 10pt。通常MSの配分pt合計を `value_plan_cycles.total_points` や regular pt単価分母に使わない。
- **cap_extra も例外なし**。ZMP OkuDoor system development (202605-202610) は 6か月 x 10 = 60pt。20pt固定でも旧67ptでもない。
- **編集UIを compact 2 pane へ修正**。左にMS基本情報、右にメンバーshare表。メンバーは1人1行で、`メンバー / share / 役割 / MS内金額 / 担当タスク` を並べる。2カラム member grid は使わない。
- **全MS pt配分スライダーを復活・拡張**。MS一覧先頭に aggregate slider panel を置き、各MSカード内の slider と同じ編集中 state を更新する。残り割り振り可能pt、MS金額、担当者ごとのMS内金額をリアルタイム表示。
- **スライダー加速バグを修正**。通常MSの slider max は編集開始時点の最大pt x 1.5 に固定。ドラッグ中に max が現在値へ追従しないので、右側でもpt増加ペースが一定。
- 現在の main はこの後の payout cache / payout matrix sticky column fixes まで含む `d070807c` / `v0.34.15`。

## Repo State

- Handoff docs は `main` に commit/push 済み。最新 closeout docs hash は `git log --oneline -n 5` で確認する。
- Product code baseline before the docs-only handoff commit: `d070807c Fix payout matrix sticky columns`。
- Production alias は docs-only handoff commit に遅れて追従することがある。closeout 中は product baseline `d070807c` から first handoff docs commit `965b5638` へ移動した (どちらも `v0.34.15` / `dirty=false`)。final docs correction `db91107f` が visible かは次セッションで `/api/build-info` を再確認する。
- 未push commit: なし。
- dirty tracked: 月初合意 / admin payouts WIP (`v0.34.16` cutoff + gateOnly docs/guard)。対象: `pwa/BUGS.md`, `pwa/design/FEATURE_REGISTRY.md`, `pwa/design_log/sessions_2026-06.md`, `pwa/manual/6-5-admin-payouts-reward-notice-spec.md`, `pwa/manual/9-3-appendix-changelog.md`, `pwa/scripts/check_pwa_critical_ui.cjs`, `pwa/spec/3-14-monthly-work-agreement-current-spec.md`, `pwa/src/lib/build-info.ts`, `pwa/src/lib/monthly-work-agreement-payout-gate.ts`, `pwa/src/lib/monthly-work-agreement.ts`。
- untracked: `gas-slack/.clasp.json` (今回のPWA/MS作業外。GAS/Slack clasp link state っぽいので owner 判断まで commit しない)。

## Unresolved / 次アクション

1. **ログイン済み admin 実機確認**:
   - `/admin/ms-overview` → 任意PJ → 編集モード。
   - 上部保存バー、左MS基本情報、右メンバー1行表、全MS pt配分スライダー、残り割り振り可能pt、MS金額、MS内金額、フッター保存バーを確認。
   - DB保存テストは、まさが明示したときだけ tiny/safe な変更で行う。
2. **`value_milestones` 見積明細混入 cleanup**:
   - 月次レポート印刷ビューで発見された別課題。印刷ビュー以外にも cockpit / `/admin/ms-overview` / 報酬計算へ影響しうる。
   - 発生源 (= 見積→MS変換の cron or 手動投入) と、既存 fixed-cycle 明細の `is_active=false` 化 / 別テーブル退避を別セッションで扱う。
3. **月初合意 / admin payouts WIP の owner 判断**:
   - closeout時点で tracked dirty として残っている。`source_ym <= 202605` を導入前/移行月として合意済み扱いにする cutoff と、月初合意gateの後追い取得 (`gateOnly`) docs/guard らしき差分。
   - MS Overview handoff commit には含めていない。次の owner が finish / test / deploy / revert を判断する。
4. **`gas-slack/.clasp.json` の owner 判断**:
   - 中身は見ずに残した。GAS/Slack worker が必要なら track / local exclude / regenerate の判断をする。

## First Next Action

```bash
cd /Users/masa/projects/AMD/amd-os
git fetch origin main
git status -sb --untracked-files=all
git log --left-right --oneline main...origin/main
curl -fsS https://amd-os-pwa.vercel.app/api/build-info
```

その後 `manual/6-8-admin-ms-overview-spec.md` と `design/FEATURE_REGISTRY.md` の `/admin/ms-overview` セクションを読み、ログイン済みブラウザで編集モードを確認する。月初合意 / admin payouts WIP が残っている場合、deploy script は tracked dirty で止まるため、先に owner を決める。

## Pointers

- MS Overview 仕様正本: [`manual/6-8-admin-ms-overview-spec.md`](manual/6-8-admin-ms-overview-spec.md)
- 回帰防止登録簿: [`design/FEATURE_REGISTRY.md`](design/FEATURE_REGISTRY.md) `/admin/ms-overview`
- 報酬/pt計算: [`manual/7-1-reward-calc-spec.md`](manual/7-1-reward-calc-spec.md)、[`src/lib/season-point-basis.ts`](src/lib/season-point-basis.ts)、[`src/lib/admin/ms-overview-calc.ts`](src/lib/admin/ms-overview-calc.ts)
- 教訓: [`BUGS.md`](BUGS.md) `[reward/admin] admin MS編集...` と `[admin/ms-overview] pt配分スライダー...`
- セッションログ: [`design_log/sessions_2026-06.md`](design_log/sessions_2026-06.md)

## Verification Run

```bash
npm exec tsc -- --noEmit --pretty false
npm run test:critical-ui
npm run build
```

- Browser route smoke: unauthenticated `/admin/ms-overview` は `/auth/login?next=%2Fadmin%2Fms-overview` へ redirect。ログイン済みUIのスクショ確認は未実施。
