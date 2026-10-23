AMD OSの経営会議機能の次回作業を引き継ぐ。作業場所は /Users/masa/projects/AMD/amd-os。まさの新しい依頼が来るまでは、規程の推測登録や取締役会機能の先行実装をしない。

読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/AGENTS.md、HANDOFF.md
4. pwa/manual/1-1-intro.md、pwa/spec/1-3-reconstruction-coverage-audit.md、pwa/spec/3-26-executive-meeting-current-spec.md、ios/DESIGN.mdの経営会議節
5. pwa/manual/2-3-pj-cockpit.mdの経営会議節、pwa/BUGS.mdの経営会議管理画面節、pwa/design/SPEC_GOVERNANCE.md、pwa/design_log/sessions_2026-10.mdの2026-10-23節

状態スナップショット:
経営会議は全PJ共通のPWAで実装済み。コックピット・ワークスペースにだけ入口があり、本人の経営陣属性、PJ閲覧権限、PJ経営陣登録の3条件で閲覧と採決を守る。既存の「動向・会議」やDDへは議案データを流さない。管理画面 /admin/executive-meetings は初期表示で全36PJを一覧にし、登録済みPJを先頭に、経営陣と規程状態を表示する。行を押すとそのPJの編集へ進み、Admin左メニューにも入口がある。SOLの経営陣はまさ・石原先生・杉浦先生。杉浦先生の表示名は本番DBで修正済み。SOL規程は未登録のため採決開始は不可。将来の取締役会決議は未実装で、経営会議の採決を代用しない。
実装commit e53f4b91 / 本番 v3.163.43 は公開 /api/build-info で一致を確認した。終了記録の文書commitは画面非表示のため、本番SHAよりmainが先行していてもUIコード差はない。再開時にfetch・status・ahead/behind・公開build-infoを確認する。仕様はspec3-26、手順はmanual2-3、履歴はdesign_log、バグと再発防止はBUGS、現況はHANDOFF。PC Chromeの画面監査メモと画像は無視対象の .jez/artifacts/ にある。

次に着手するとき:
まさが会社の経営会議規程を提示したら、原文と該当条項から定足数・可決条件・締切方法を確認し、管理者画面に新しい規程版として登録する。表現できない規程なら勝手に近似せず、仕様拡張を検討する。初期一覧からSOLを開く実導線、経営陣3人のアクセス、非経営陣の拒否、採決開始・投票・確定、既存「動向・会議」への非流出を確認する。まさから取締役会機能の依頼があれば、その時に招集、資格、利害関係、議決要件と証跡を別に設計する。過去のmigration versionはローカルと本番で不一致があるため、次のDB変更前に現行履歴とschemaを監査し、適用済みDDLを再適用しない。

運用:
main一本。新branch/worktreeやサブエージェントを作らない。共有差分をreset、stash、削除、一括commitしない。全プラットフォームへの影響を見て、画面追加・改名時はios/DESIGN、PWA仕様変更時はspec/manual/附則とnative handoffを同じcommitで同期する。画面を完成として報告する前にPC Chrome実画面でUI/UX監査し、初期状態・視線の流れ・操作後の行き先を説明なしで使えるか確認する。スマホWeb検証はまさが依頼した時だけ。PWA本番反映は変更を束ねて AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh を使い、READY・公開SHA・PC実画面を読む。画面非表示の終了記録は既存のskip CI判定でpushする。メールや対人通知は明示指示なしに送らない。
