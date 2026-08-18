# AMD OS Handoff

最終更新: 2026-08-19 JST

対象: PJワークスペースのガント並べ替え保存、初期配色、再読み込み性能

作業種別: development

## 今回の到達点

- ガントの同一階層タスク並べ替えを、兄弟全件のversionを検査する1トランザクション保存へ変更した。途中失敗で表示順が元へ戻る原因を解消した。
- route-level loading/error/完成面をAMDブルー・白・チャコールの同一skinへ統一し、旧・淡い和風色の初期表示を廃止した。
- 重いmanagement投影を他のsummary queryと同時開始し、PJ名・active member・表示名だけを認可確認後60秒cacheへ分離した。ガント・論点・関係先・週次データはcacheしていない。
- 本番desktop/mobileで旧skin 0件、背景 `#f5f5f7`、横崩れなし、console warning/error 0件を確認した。再読み込み実測は約4.1〜5.1秒で、さらに短縮する場合はサーバー側query別計測が次段階。
- 詳細仕様は `pwa/spec/3-16-project-weekly-control-current-spec.md`、利用者向け説明は `pwa/manual/2-3-pj-cockpit.md`、原因と再発防止は `pwa/BUGS.md` に記録した。`design_log/` は触っていない（現行spec・changelog・BUGSが既存の実装履歴正本）。

## Repo・本番状態

- canonical path: `/Users/masa/projects/AMD/amd-os`
- branch: `main`
- 対象実装commit: `71a8ca5f`（並べ替え）、`4167691d`（配色・再読み込み）。いずれもorigin/mainと本番へ反映済み。
- handoff/manual同期はこのhandoff作業のcommitを参照すること。
- PWA本番は `/api/build-info` でbuild version、git SHA、dirty=falseを読戻す。
- 検証済み: workspace契約検査、three-party view検査、TypeScript、Next.js production build、critical UI群、本番desktop/mobile実画面。

## 既存dirty（今回の作業外）

- `pwa/manual/4-3-amd-score-spec.md`、`pwa/spec/4-2-amd-score-current-spec.md`: AMD Score文書の別作業。所有者はAMD Score担当、stage/revertしない。次のAMD Score作業開始時に差分を再確認してcommitまたはrevertを判断する。
- `docs/corporate/` の5ファイル: 役員貸付・金銭消費貸借文書の別作業。所有者はcorporate文書担当、削除しない。次のcorporate文書セッションで正本性とcommit対象を判断する。
- `pwa/scripts/diagnose-cash-inflow.mts`、`pwa/scripts/refresh-live-monthly-pl.mts`: finance診断・更新スクリプトの別作業。所有者はfinance担当、実行・stage・削除しない。次のfinanceセッションで用途と安全弁を確認する。

## 未解決

- 今回依頼は完了。再読み込みは本番実測4.1〜5.1秒なので、まさがさらに短縮を望む場合は、freshnessを保ったまま各Supabase queryとRSC payloadを計測し、最重量枝を特定する。
- 以前のhandoffにあった請求対象PJの契約原本監査は未完了の運用バックログ。契約仕様 `pwa/spec/5-6-contracts-management-current-spec.md` を正本として、別タスクで再開する。

## 次セッションで最初にすること

新しい依頼を確認する。ワークスペース高速化の続きなら、productionでquery別のサーバー計測を先に入れ、計測なしに運用データ全体をcacheしない。

## 参照先

- 現行仕様: `pwa/spec/3-16-project-weekly-control-current-spec.md`
- 人向けマニュアル: `pwa/manual/2-3-pj-cockpit.md`
- バグ記録: `pwa/BUGS.md`
- 変更履歴: `pwa/spec/6-1-appendix-changelog.md`
- 次セッション用プロンプト: `SESSION_MIGRATION_PROMPT.md`
