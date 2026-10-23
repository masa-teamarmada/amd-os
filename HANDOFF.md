# HANDOFF — 経営会議の管理画面

- 更新: 2026-10-23 JST
- 作業種別: development
- 正本: `pwa/spec/3-26-executive-meeting-current-spec.md`、利用手順: `pwa/manual/2-3-pj-cockpit.md`「経営会議」

## 現在地

- 全PJ共通の経営会議ページと議案・採決はPWAに実装済み。コックピットとワークスペースだけに置き、経営陣属性・PJ閲覧権限・PJ経営陣登録を毎回照合する。既存「動向・会議」へのデータ流出経路を作らない。
- 管理者画面 `/admin/executive-meetings` は最初から全36PJを一覧表示。登録済みPJを先頭にし、登録済み経営陣と規程の有無を行に表示する。行を押すと編集欄へ進む。Admin左メニューにも入口を追加済み。
- SOLの経営陣は、まさ・石原先生・杉浦先生の3人。杉浦先生のアカウント表示名を本番DBで修正し、画面で読み戻した。SOLの経営会議規程は未登録のため、議案の下書きは可能だが採決開始は不可。
- 画面変更はPC Chromeで1419×824の実画面をUI/UX監査し、一覧・SOL編集・未登録PJ編集を確認。型、静的検査、build、正規反映ゲートを通過。
- 実装commit `e53f4b91`、本番 `v3.163.43`。2026-10-23時点で公開 `/api/build-info` のSHA一致、`main=origin/main`、dirtyなし、worktree本体1、ローカルbranchはmainのみ。終了記録の文書commit後は画面非表示変更として本番SHAより先行しうる。

## 未解決と最初の次アクション

- 各会社の経営会議規程の原文・定足数・可決条件・締切方法は未登録。次にまさが対象会社の規程を渡したら、原文と条項を確認して管理者画面に版として登録し、その規程に沿う採決を確認する。条件を推測して登録しない。
- 将来の取締役会決議は未実装。同じ画面内へ追加する方針だが、招集・資格・利害関係・議決要件を別途設計する。現行の経営会議の採決を取締役会決議として扱わない。
- 過去のmigration履歴にはローカルと本番のversion不一致がある。今回の終了作業でDDL再適用や履歴repairはしない。新たなDB変更前には現行履歴・schemaを再監査する。

## 参照先

- 実装仕様: `pwa/spec/3-26-executive-meeting-current-spec.md`
- 操作と権限: `pwa/manual/2-3-pj-cockpit.md`「経営会議」
- 全画面正本: `ios/DESIGN.md`
- 回帰の教訓: `pwa/BUGS.md`「経営会議の管理画面」
- 実装履歴: `pwa/design_log/sessions_2026-10.md`
- ネイティブへの境界: `pwa/HANDOFF_pwa_to_native_viewing.md`
