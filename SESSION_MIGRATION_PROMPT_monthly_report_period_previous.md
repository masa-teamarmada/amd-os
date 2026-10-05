AMD OSの月次報告書の対象期間変更を引き継いで。cwdは /Users/masa/projects/AMD/amd-os。
読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/AGENTS.md
4. /Users/masa/projects/AMD/amd-os/HANDOFF_monthly_report_period.md
5. pwa/spec/3-2-monthly-reports-current-spec.md、pwa/manual/4-8-ms-progress-monthly-report-revision-spec.md、pwa/scheduled-tasks/amd-os-l2-monthend-evidence/SKILL.md、pwa/scheduled-tasks/amd-os-l2m1-monthly-report/SKILL.md
6. pwa/BUGS.md、pwa/design_log/sessions_2026-10.md

まさの依頼: 月次報告書の対象期間を1-25日から1-末日に設定されるように設計変更し、9月分も変更する。
変更は0648e03eでmainへpush・本番配信確認済み。クラウドroutineも月初〜暦上の末日へ保存・再読込済み。25日16:00生成は維持。本文は生成時点の確認済み実績だけ。26日以降は当月の追補対象で、翌月へ移さない。
9月提出版はCX(p20)・KUTE(p25)を9/1〜9/30へ限定修正し、KUTE冒頭説明も修正。SOL(p21)は既に9/30。validatorと差分純度、履歴を残す保存、DB本文一致まで確認。既存Drive PDFはこのチャットでは未更新。

再開時はfetch・status・配信版・現行DB本文・PDFを先に読む。監査開始時main=origin/main=36b99dde、配信6d75f288(v3.159.1)。後続の記録commitや並行作業があるので固定SHAへ戻さない。
画面/PDF関連22パスの未コミット変更はactiveチャット「9月月報の記載を修正」(01a1067a-97a0-7dc2-87d6-828f5269e13c)由来。commit・削除・stashしない。詳細は専用HANDOFF。旧SESSION_MIGRATION_PROMPT_task_based_pt_20260922.mdは未完の別案件で保存維持。DDの引き継ぎはpwa/HANDOFF_dd_spaces.mdに保存済み。
次にPDFの更新を扱う場合、同チャットの状況と現行本文を先に照合。並行作業の最新版を古い本文で戻さない。対象期間だけを変える意図を守り、更新前保存→限定差分→検証→OS読戻し→PDF/Drive読戻し。本文保存とPDF配置を別状態で報告する。追加の自動生成・外部通知・メール送信はしない。
main一本、自分の差分だけcommit/push。PWA実装変更時はmanual/spec/必要なDESIGN同期とAMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.shで配信確認。共有checkout全体は他チャットの変更が残るためarchive不可。今回のbranch/worktreeはゼロ。
