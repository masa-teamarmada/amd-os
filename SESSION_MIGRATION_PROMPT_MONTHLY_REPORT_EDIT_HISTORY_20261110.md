月次報告書の編集履歴を再び変更する必要が生じた場合だけ、この引き継ぎから再開する。作業場所は `/Users/masa/projects/AMD/amd-os`。`pwa/` をセッションの作業場所にしない。

読む順:

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/AGENTS.md`
4. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
5. `/Users/masa/projects/AMD/amd-os/HANDOFF_MONTHLY_REPORT_EDIT_HISTORY_20261110.md`
6. `/Users/masa/projects/AMD/amd-os/pwa/manual/1-1-intro.md`
7. `/Users/masa/projects/AMD/amd-os/pwa/spec/1-3-reconstruction-coverage-audit.md`
8. `/Users/masa/projects/AMD/amd-os/pwa/manual/4-8-ms-progress-monthly-report-revision-spec.md`
9. `/Users/masa/projects/AMD/amd-os/pwa/spec/3-2-monthly-reports-current-spec.md`
10. `/Users/masa/projects/AMD/amd-os/pwa/design/FEATURE_REGISTRY.md`
11. `/Users/masa/projects/AMD/amd-os/pwa/design/db_schema.md`
12. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md`

状態:

- 月次報告書の社内版・提出版は、印刷ビューから編集者、日時、操作、変更章、変更前後の差分を確認できる。
- PCでは右側パネルで表示する。個別編集はPDFへ載せず、PDFには「版・発行履歴」として節目だけを載せる。
- 本文保存と履歴追加は同じDB処理で完了し、履歴は追記専用。通常経路外の書込みも捕捉する。
- 過去分は人物や差分を推測せず、詳細差分なしの記録として保持する。
- 実装commitは`52b8a14752b16af3d72bc878a194733f4ee01508`、初回本番版は`v3.57.0`。その後の変更は正本へ反映済み。
- 2026-11-10のcloseout開始時は`main`、HEAD `042e37acf`、ローカルの`origin/main`と一致。未解決の機能作業はない。

次に変更依頼が来たとき:

1. 依頼内容が表示、履歴保存、権限、PDFのどこに影響するかを正本で特定する。
2. DB変更が必要なら、未適用の新しいmigrationだけを作り、本番DBへ先に適用して読戻す。適用済みmigrationは再適用しない。
3. PWA変更はPCのChromeで実画面を確認し、編集履歴の入口、右側パネル、社内版・提出版切替、差分、印刷除外、キーボード操作を確認する。
4. manual、spec、FEATURE_REGISTRY、DB定義、各附則、必要な回帰検査を同じ変更で更新する。
5. `main`へ対象ファイルだけを記録し、`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`で本番反映と版情報の読戻しまで行う。

守ること:

- main一本。新しいbranchや作業ツリーを作らない。
- 着手前と送信前に共有先を確認し、対象ファイルだけを明示して記録する。`git add .`は使わない。
- 月次報告書本文、履歴、確定者を別々の不整合な状態にしない。
- 過去の編集者や変更内容を推測で補完しない。
- 編集履歴の復元操作は追加しない。必要になった場合は別仕様として設計と権限を確定する。
- 依頼がない限りスマホ幅のWeb確認や追加実装は行わない。まさが使うPWA確認はPCのChromeで行う。
- 仕様変更が無い調査だけなら、コード、DB、本番、文書を変更しない。
