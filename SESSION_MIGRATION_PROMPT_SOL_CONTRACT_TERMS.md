AMD OSのSOL契約条件確認を再開する。作業場所は /Users/masa/projects/AMD/amd-os。

読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/AGENTS.md
4. /Users/masa/projects/AMD/amd-os/HANDOFF_SOL_CONTRACT_TERMS.md
5. pwa/manual/1-1-intro.md → pwa/spec/1-3-reconstruction-coverage-audit.md
6. pwa/spec/5-6-contracts-management-current-spec.md「PJ契約の論点と手続き」→ pwa/manual/6-7-contracts-management-spec.md
7. pwa/design/SPEC_GOVERNANCE.md、pwa/BUGS.md。必要時のみ11月開発履歴。

状態: まさの2026-11-20の指示で一旦終了。SOL「PJ管理 → 契約」の論点・手続き表示は実装babde9f8fで反映済み。今回の終了確認では本番v3.165.28 / 3f182e886が記録前のmain・origin/mainと一致し、元の実装を含む。契約論点の実部品検査も成功。今回の変更は引き継ぎ記録のみ、再公開は不要。最新の実画面・DB・大学の承諾状況は今回再確認していない。

素材と正本: Drive上の260601_請負契約書(260601_270331)_愛媛大学_AMD.PDFを10月8日に読んだ。本文はDrive、短い条項確認結果は契約条件JSON。根拠と識別情報はspec5-6と適用済みmigration492・493。個人情報・再委託は第11条、細則準用は第12条、未定事項協議は第14条を確認。技術・事業情報全般の第三者開示条件、別NDA・仕様書・細則適用版、承認者・承諾形式は当時未確認。

次の依頼の趣旨: 「VCにSOL関連情報を開示するとき、愛媛大の許可が必要か」を、実際の資料と契約から判断できる状態にする。大学由来の非公開情報、公開情報、チームアルマダ独自情報を資料内で特定し、相手VC・目的・資料の版・開示範囲と、適用契約・既存承諾を照合する。契約条項の確認済み表示だけでは個別資料の開示承諾を確認したことにならない。

最初の作業: 再開依頼の範囲を読み、git fetch後の差分と本番を照合する。そのうえで現在の契約原本・関連契約と対象資料を読み取りで確認し、確定条件、確認が必要な相手・事項を根拠付きで提示する。大学やVCへの連絡が必要なら下書きまで。今回の終了依頼から調査・改修・送信を自動再開しない。

運用: main一本、別作業の変更を保持し対象だけ保存する。未追跡のS01_富士山_日本語.mdは今回と関係のない記事原稿。所有者は未特定で本文保持・保存対象外。次の共有作業場所を扱うえいみが、移動・削除・一括保存より前に原稿担当と正本を照合する。適用済み492・493は再実行しない。製品変更時はmanual/spec/附則と他プラットフォーム向け引き継ぎを同期し、対象検査後、正規deploy.shで反映・本番照合する。PCのChromeで確認する。SOL DDは専用ローカル環境で進め、明示的な本番反映指示を待つ。メールは送信せず、権限や共有先も変更しない。
