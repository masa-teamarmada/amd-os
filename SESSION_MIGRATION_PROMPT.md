AMD OSの月次試算表・Admin移設の引き継ぎ。作業場所は /Users/masa/projects/AMD/amd-os。

読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. AGENTS.md、HANDOFF_MONTHLY_FINANCE_ADMIN.md
4. pwa/manual/1-1-intro.md、pwa/spec/1-3-reconstruction-coverage-audit.md、pwa/spec/2-1-pwa-runtime-routes.md、pwa/design/management_score.md
5. pwa/manual/2-6-admin-ops.md、pwa/manual/4-5-management-score-and-finance-simulation-spec.md、pwa/BUGS.md

状態:
2026-11-05確認時はmainとorigin/mainがd7a562341で一致、dirtyなし。本番v3.165.13も同じSHA。今回の変更0ad89a5ef・bd364a248はこの版に含まれる。
月次試算表は/admin/monthly-trial-balance、Managementは/admin/management-score。通常メニューのManagement項目と両ページの相互リンクは削除済み。まさは「リンク残さないで」と明示したので復活させない。Adminは本人の既存閲覧回数順、検索あり、履歴なしは下段。Managementの旧URLの閲覧数も合算する。
実装・仕様・マニュアル・Native未移植の記録は反映済み。証跡はARMADA共有ドライブのa3_backoffice/261104_月次試算表ページとAdminメニュー/制作。移設版はManagement移設_v3.165.11。財務更新の根拠は同階層の261104_Management月次試算更新。

次の作業:
未完了の依頼はない。新しい指示を待つ。再開時はfetchして現在のdirty・HEAD・公開build-infoを確認し、このスナップショットを現在値と決めつけない。
財務を更新する依頼が来たら、法人受取と個人受取、稼働月と支払月、給与手取りとPL、融資台帳、税の概算と確定額を区別する。未登録の将来変動収入や報酬を自動繰越しない。灰色のモデル残高と実績接続後の見込み残高を区別し、左右軸のゼロ点を保持する。

運用:
main一本。別作業の変更を混ぜない。DB集計migration 20261104100247は適用済みで再適用不要。PCのChromeで確認し、スマホWeb・Native実装は追加依頼時だけ。コード変更は仕様・マニュアル・ios/DESIGNと同期し、AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.shで一括反映する。SOL DDは本人の本番反映指示まで専用ローカル環境で保持。今回のローカル追加ビルドは別作業再開時に中断したが、同一commitの本番型検査・ビルドと実画面確認は成功している。
