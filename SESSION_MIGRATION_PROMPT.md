KUTEの9月月報とAMD OSの画面修正を引き継いで。
業務資料の場所は /Users/masa/projects/AMD/kute、実装は /Users/masa/projects/AMD/amd-os。

最初に読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. 両プロジェクトのAGENTS.md
4. /Users/masa/projects/AMD/kute/HANDOFF_monthly_report_20261006.md
5. /Users/masa/projects/AMD/kute/docs/MONTHLY_REPORT_REVISION_20261004.md
6. /Users/masa/projects/AMD/amd-os/HANDOFF_KUTE_MONTHLY_REPORT_20261006.md
7. AMD OSのpwa/spec/3-2-monthly-reports-current-spec.md、3-8-cockpit-current-spec.md、pwa/manual/4-8-ms-progress-monthly-report-revision-spec.md、2-3-pj-cockpit.md
8. 両PJのBUGS.md、AMD OSのpwa/BUGS.mdとpwa/design_log/sessions_2026-10.md

現在地:
- 9月24日の有識者枠委員としての出席、9月29日の第2・第3領域構想共有、筑波大学訪問、担当者名を月報へ反映済み。「未達」「時期未定」という誤った報告を除いた。活動本文で「弊社の山地」を繰り返さない。
- 新宿フロアのSU向けサービス企画書をチームアルマダ側で作成する宿題を報告書へ反映済み。10月8日08:30〜09:45 JSTの「＋KUTE 新宿フロアのSU向けサービス企画書作成」はGoogleカレンダー登録・読戻し済み。重複登録しない。企画書自体はこの作業で完成していない。
- 正本本文はOSのp25/202609社内・提出版。修正原稿・変更前控えはKUTEのoutput/monthly_reports/202609_review/と202609_followup/。過去の保存SQLは再実行しない。
- PDFは社内版10頁・提出版5頁、OSドライブと共有Drive双方へ保存・実体照合済み。最新PDF ID・保存先は専用HANDOFF。初期のPDFへ戻さない。
- 月・社内版/提出版はプルダウン、編集と保存を同じ操作行へ集約。PDF保存ボタンは削除、編集履歴は本文末尾。本文保存後のPDF配置失敗はPDFだけ再試行する。
- 初期表示は日本時間の1〜24日が前月、25日から当月。手動で選んだ月は更新時に維持。PJメンバー文字列をヘッダーから除き、コックピット/ワークスペース/DDパッケを同じ行へ移した。
- 実装はmainのecab9a16を含む9485bfdeで本番v3.159.9へ配信済み。今回の引き継ぎ文書のみ後続commitになる。fetch/status/build-infoを確認し、固定SHAへ巻き戻さない。KUTEは非Git管理。新規branch/worktreeはゼロ。
- 月境界12ケースを3タイムゾーンで検証、型検査・本番build・PDF全頁・PC/スマホ静的描画は確認済み。Chrome接続エラーとブラウザのログイン待ちにより、ログイン後の実操作は未確認。

次の具体的な作業:
1. 認証済み画面を利用できる場合、月報の月/版切替、編集保存、未保存確認、履歴表示、PDF失敗時の再試行を実画面で確認する。権限や認証情報を勝手に変えない。
2. 新宿企画書へ進む依頼が来たら、9月29日の全体構想と現行の第2・第3領域正本を先に読み、サービス内容・対象者・運営・費用財源・大学との役割分担を具体化する。10月9日事前共有版、10月13日定例提示は計画であり大学の採用合意とは区別する。
3. 月報の内容・対象期間を直す依頼では、現行本文と変更前控えを取得し、限定差分・章/表構造・編集履歴・DB本文・両DriveのPDFを照合する。本文保存とPDF配置を別に検収する。

運用ルール:
- 業務の判断・根拠はKUTEの目的別md、実装仕様はAMD OSのspec/manual、開発履歴だけdesign_logへ保存する。
- 別チャット「左メニューを三点リーダー化」（01a10d16-952b-7d60-a3cf-e683d1b22a3e）が同じcheckoutで実装中。新しい左メニュー仕様を古いヘッダーへ戻さない。共有checkoutの他作業の差分はcommit・削除・stashしない。旧未追跡SESSION_MIGRATION_PROMPT_task_based_pt_20260922.mdの扱いは専用HANDOFFのcloseout記録を確認する。
- main一本で自分の差分だけcommit/push。PWA変更はmanual/specを同期し、AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.shで配信とSHAまで確認する。
- monthly_report_pdf_recordの20261004172000 migrationは適用済み。再適用しない。PDFは同梱Noto Sans JPで実Linux成果物を確認する。
- 外部メール/Slack送信、共有権限変更、追加の自動化はこの引き継ぎの承認に含まれない。
