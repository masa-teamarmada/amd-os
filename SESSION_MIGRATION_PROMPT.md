# SESSION MIGRATION PROMPT - AMD OS admin MS overview

```text
cd /Users/masa/projects/AMD/amd-os

まず `HANDOFF.md` を読んで。次に `pwa/HANDOFF_pwa_rebuild.md`、`pwa/manual/6-8-admin-ms-overview-spec.md`、`pwa/design/FEATURE_REGISTRY.md` の `/admin/ms-overview` セクション、`pwa/spec/6-1-appendix-changelog.md` を読んで。その次に `pwa/BUGS.md` を読んで。必要なら `pwa/design_log/sessions_2026-06.md` の 2026-06-23 Admin MS Overview セクションも読む。

作業開始前に必ず:
1. `git fetch origin main`
2. `git status -sb --untracked-files=all`
3. `git log --left-right --oneline main...origin/main`
4. `curl -fsS https://amd-os-pwa.vercel.app/api/build-info`

current truth:
- `/admin/ms-overview` が MS 設計編集の正本。cockpit / HUD cockpit から MS名・pt・tag・期間・担当shareを保存しない。
- regular pt単価分母はシーズン期間月数 x 10pt。通常MSの配分pt合計を `total_points` や pt単価分母に戻さない。
- cap_extra も例外なしで MS期間月数 x 10pt。ZMP OkuDoor system development (202605-202610) は 60pt。
- 編集UIは左=MS基本情報、右=メンバーshare表。メンバーは1人1行、2カラムにしない。行には `MS内金額` を出す。
- `全MS pt配分スライダー` と各MSカード内スライダーは同じ編集中 state を動かす。まとめパネルには残り割り振り可能ptとMS金額を表示する。
- 通常MS slider max は編集開始時点の最大pt x 1.5 で固定。ドラッグ中に現在値へ追従させない。
- 保存は `PUT /api/admin/ms-overview/{planCycleId}`。`value_milestones` / `milestone_responsibility` 保存後、`total_points = シーズン期間月数×10 + Σcap_extra MS期間月数×10` に再計算し、reward summary を同期する。PAID月は内部でskip。

次にやること:
1. ログイン済み admin で `/admin/ms-overview` を開き、編集モードの実UIを確認する。
2. もし見づらさが残っていたら、既存の two-pane / one-member-row / aggregate slider 設計を崩さず微調整する。
3. `value_milestones` の見積明細混入 cleanup は別タスク。発生源と既存データ無効化方針を確認してから扱う。
4. 月初合意 / admin payouts WIP が dirty に残っていたら、MS Overview とは別 owner へ分ける。`source_ym <= 202605` cutoff と `gateOnly` 後追い取得 docs/guard らしき差分で、finish/test/deploy/revert は次 owner 判断。
5. `gas-slack/.clasp.json` は今回のPWA/MS作業外。中身を晒さず、GAS/Slack owner 判断まで commit しない。

注意:
- `git add .` は使わない。
- PWA deploy が必要なら repo root から `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`。
- DB保存テストは、まさが明示的にOKした tiny/safe な変更だけで行う。
```
