# 研究機関 SU関連規程台帳 引き継ぎ

- 更新: 2026-11-10 JST
- 仕事種別: development（今回のcloseoutでは実装変更なし）
- 状態: 当初依頼は実装・DB反映・本番反映済み。未完了タスクなし

## 完了状態

- `/institutions` に全研究機関を横断する「SU関連規程」を追加済み。
- 施行中の規程はセルにクリック可能な `◯` を表示する。
- クリック先は外部文書を最優先する。外部正本がない場合だけOS内台帳へ遷移する。
- `/institutions/[institutionId]/cockpit` に当該機関だけの「SU関連規程」を追加済み。
- コックピットでは作成中・審議中・決裁済・施行中、現行版、版履歴、次ゲートを同じDB正本から管理する。
- AMD memberは閲覧、`members.is_admin=true` のadminだけが更新できる。
- 実装の起点は commit `b50055c1c`、build v3.79.0、migration 282。
- その後の公式公開情報調査で台帳は拡張済み。現行マニュアルでは migration 385 / 387 時点で64機関・422規程、64機関すべてに最低1件の施行中規程がある。
- 2026-11-10のcloseoutでは本番・DB・外部URLを再検証していない。上記の件数と反映状態は現行正本の記録に基づく。

## 正本

- 利用手順: `pwa/manual/4-9-institution-ers-spec.md`「SU関連規程リスト」
- 現行仕様: `pwa/spec/3-8-cockpit-current-spec.md`「SU関連規程台帳」
- 業務導線: `pwa/design/FEATURE_REGISTRY.md`「SU関連規程台帳」
- DB: `institution_regulation_types` / `institution_regulations` / `institution_regulation_type_links` / `institution_regulation_versions`
- 初期DDL: `pwa/scripts/migrations/282_institution_regulation_ledger.sql`
- API: `pwa/src/app/api/institution-regulations/route.ts`
- 共通UI: `pwa/src/components/institutions/InstitutionRegulations.tsx`
- 回帰検査: `npm run test:institution-regulations`

## 未解決

なし。当初依頼の追加実装は行わない。

## 将来この機能を再開するときの最初の行動

1. `git fetch origin --prune` 後、mainとの先行・遅れと共有checkoutのdirtyを確認する。
2. 正本3件と最新migrationを読み、現在の規程種別・機関数・件数をDB readbackで確認する。
3. PCのChromeで全機関表、1機関コックピット、外部正本リンク、OS内フォールバック、作成中版、admin編集を確認する。
4. 外部URLは正本なので、リンク切れや移転がある場合もOS本文へ複製せず、正本URLと版情報を更新する。
5. 変更が必要な場合だけmanual / spec / FEATURE_REGISTRY / 附則 / 回帰検査を同じ変更で同期し、正規の反映スクリプトで本番版情報まで読戻す。

## closeoutメモ

- このcloseoutでは製品仕様・コード・DBを変更していないため、OSマニュアル同期ゲートは対象外。
- `design_log/` は触っていない。
- 共有checkoutには別の稼働中スレッドの差分があるため、汎用の `SESSION_MIGRATION_PROMPT.md` は上書きしない。再開文は `SESSION_MIGRATION_PROMPT_INSTITUTION_REGULATIONS_20261110.md` を使う。
