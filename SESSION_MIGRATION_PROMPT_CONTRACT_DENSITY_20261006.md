AMD OSの「いよぎんキャピタルNDA・契約リスト密度」の引き継ぎ。作業場所は /Users/masa/projects/AMD/amd-os。仕事種別は開発。今回の依頼は完了し、追加作業は新しい依頼が来るまで始めない。

読む順:
1. /Users/masa/projects/AGENTS.common.md。特に「余白の多いカードで、一件ずつ読ませる」設計の絶対禁止。
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md（AMD共通知識）
3. AGENTS.md → HANDOFF_CONTRACT_EVIDENCE_20261006.md
4. pwa/spec/5-6-contracts-management-current-spec.md、pwa/spec/5-17-dd-package-current-spec.md、pwa/spec/5-10-reference-data-caching-current-spec.md → pwa/manual/2-3-pj-cockpit.md、pwa/manual/2-6-admin-ops.md
5. pwa/BUGS.md → pwa/design_log/sessions_2026-10.md。配布時はpwa/spec/5-2-development-operations-current-spec.md、文書同期時はpwa/design/SPEC_GOVERNANCE.md。

状態スナップショット:
- NDA登録・初期実装a47660bd、密度修正1e85e608はmainに保存・本番反映済み。密度修正はv3.160.14で実画面確認。その後別作業が進み、closeout時の公開build-infoはv3.160.15 / 4a7f56cc / main / dirty:false。古い版へ戻さない。
- SOL/p21のNDAは契約ID b5e39c23-6039-428d-bddf-5f90bb6f862a。先方受領版とチームアルマダの変更履歴付き修正案の2版、10/2受領・返送と10/6先方回答・電子署名担当回答の4履歴。署名待ち・未締結。署名完了・契約期間は未確認。台帳更新484は適用済み、再実行しない。
- 一覧は1契約1行。契約・当事者、状態、最新版、更新日、確認事項、締結・期間、管理者のDDチェックを横に比較。検索・状態絞り込み・並び順あり。「文書・経緯」で選択契約だけの表モーダル。初期一覧は最新版のみ取得、履歴は新しい順20件ずつの複合カーソル取得。
- 素材はDrive「261002_いよぎんNDA」、保存参照はpwa/scripts/migrations/484_iyogin_nda_versions_history_20261006.sql。現行UIはhttps://amd-os-pwa.vercel.app/project/p21/workspace#contracts。コードはProjectContractList.tsxとproject-contract-list関連lib/API。正式な取得・開示境界はspec正本を読む。
- 証跡は /Users/masa/.codex/visualizations/2026/10/06/01a110c7-3254-7d63-a9b0-6157d2af9d19/ のcontract-dense-list.jpg、contract-dense-evidence.jpg、contract-density-closeout.md。
- 共有checkoutでは「DDパッケに事業計画関連を追加」など別チャットが継続中。財務・DD・長期計画・関連spec/manual/build-infoのdirtyはその担当の仕事。reset/stash/delete/一括commitしない。未追跡SESSION_MIGRATION_PROMPT_task_based_pt_20260922.mdはタスク報酬移行の既存再開資料として保持する。

次の行動と禁止事項:
- まさの次の依頼を待つ。署名版を受領した場合は、確認済み証拠に基づいて既存の押印版登録経路で更新する。先方が締結を進める旨を回答しただけで締結済みにしない。通知・外部送信・共有権限変更は依頼されていない。
- UIは「余白の多いカードで一件ずつ読ませる」を絶対禁止。詳細を別画面に分けるだけで密度改善としない。一覧も詳細もコンパクトな表・行へまとめ、文字を小さくする前に余白・重複・縦積みを減らす。
- main一本。fetchして差分・所有者を確認。今回のように共有dirtyとremote更新が重なる場合はmainの一時clean cloneで対象差分だけを扱い、保存・push後にコピーを閉じる。branch/worktree/subagentは作らない。
- 検証済み: test:project-contract-list、tsc、production build、正規deployゲート、PC本番2版・4履歴。ローカル60契約×各60履歴の検索・20→40→60件追加、同時刻60履歴の重複/欠落ゼロを検査。検証用fixtureは削除済み。Swiftネイティブは未移植。
- 製品変更の本番反映は AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh。CLI直接deploy禁止。今回の引き継ぎ・BUGS・開発履歴のみの差分はdeploy_skipの除外対象なので、不要な再配布をしない。
- 仕様はspec/manual、開発履歴はdesign_log、現在地は薄いHANDOFFへ分離。旧Function Storageの再開文はSESSION_MIGRATION_PROMPT_FUNCTION_STORAGE_20261006_BEFORE_CONTRACT.mdへ内容不変で保存済み。
