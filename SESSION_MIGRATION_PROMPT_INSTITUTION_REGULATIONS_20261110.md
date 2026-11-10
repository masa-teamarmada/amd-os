AMD OSの研究機関「SU関連規程台帳」を将来再点検する。現時点で当初依頼は完了済みなので、新しい変更依頼がない限り実装へ入らない。作業場所は `/Users/masa/projects/AMD/amd-os`。`pwa/` をセッションの作業場所にしない。

読む順:

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/HANDOFF_INSTITUTION_REGULATIONS_20261110.md`
4. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
5. `/Users/masa/projects/AMD/amd-os/pwa/manual/1-1-intro.md`
6. `/Users/masa/projects/AMD/amd-os/pwa/spec/1-3-reconstruction-coverage-audit.md`
7. `/Users/masa/projects/AMD/amd-os/pwa/manual/4-9-institution-ers-spec.md`「SU関連規程リスト」
8. `/Users/masa/projects/AMD/amd-os/pwa/spec/3-8-cockpit-current-spec.md`「SU関連規程台帳」
9. `/Users/masa/projects/AMD/amd-os/pwa/design/FEATURE_REGISTRY.md`「SU関連規程台帳」
10. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md`

状態:

- `/institutions` の「SU関連規程」は、研究機関マスタ全件を行、規程種別を列にした横断表。同じDB正本を各研究機関コックピットへ投影する。
- 施行中の規程はセルに文字として `◯` を表示し、クリック可能。外部文書URLがあれば外部正本へ直行し、ない場合だけOS内の `/institutions/[institutionId]/regulations/[regulationId]` を開く。
- コックピットは作成中・審議中・決裁済・施行中、現行版、版履歴、次ゲートを管理する。本文をOSへ複製せず、原典URLと版情報を台帳化する。
- AMD memberは閲覧、`members.is_admin=true` のadminだけが編集できる。
- 実装起点は commit `b50055c1c`、build v3.79.0、migration 282。初回の本番確認では比較表、コックピット、編集フォーム、外部リンク、OS内フォールバックを確認済み。
- その後の公式公開情報調査で拡張され、現行マニュアル上は migration 385 / 387 時点で64機関・422規程、64機関すべてに最低1件の施行中規程がある。
- 2026-11-10のcloseoutでは本番・DB・外部URLを再検証していない。再開時は件数を固定値として使わずreadbackする。
- 当初依頼に対する未完了タスクはない。

再開時の作業:

1. `git fetch origin --prune` を行い、mainとの先行・遅れ、未送信commit、共有checkoutのdirtyを確認する。他スレッドの差分を戻したり混ぜたりしない。
2. 新しい変更依頼がなければ、正本を読んだ時点で「完了済み」と報告し、追加実装を始めない。
3. 再点検を求められた場合は、DBで研究機関数・規程数・版数・状態別件数をreadbackし、未確認と未整備を分ける。
4. PCのChromeで全機関表、当該機関コックピット、`◯` の遷移、外部正本優先、OS内フォールバック、作成中版、admin編集を確認する。依頼がない限りスマホWeb確認は行わない。
5. 外部URLのリンク切れ・移転を検出しても、OS本文へ複製しない。公式外部文書を正本としてURLと版情報を更新し、外部文書が存在しない場合だけOS内リンクを使う。
6. 変更する場合は、`pwa/manual/4-9-institution-ers-spec.md`、`pwa/spec/3-8-cockpit-current-spec.md`、`pwa/design/FEATURE_REGISTRY.md`、manual/spec附則、`macos/PARITY.md`、回帰検査を影響範囲に応じて同じ変更で同期する。
7. `npm run test:institution-regulations` と関連する型・build検査を実行し、PWA変更後は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` でmain push・本番版情報の読戻しまで行う。

守ること:

- main一本。新しいbranchやworktreeを作らない。
- 対象ファイルだけを明示してstageし、`git add .`を使わない。
- 規程の有無を推測で埋めない。`未確認`、`未整備`、`対象外`、作成中、施行中を混同しない。
- 1つの規程が複数領域をカバーする場合はtype linkで接続し、セルごとに文書を複製しない。
- 全機関表とコックピットを別台帳にしない。同じ `institution_regulation_*` 正本から投影する。
- 外部正本がある場合は常にそちらを優先する。
