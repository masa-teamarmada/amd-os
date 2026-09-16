# HANDOFF - AMD OS PWA

- 更新: 2026-09-16 JST
- セッション: OS全体の変更履歴・安全な戻し操作・外部アクセス要求
- 作業種別: development

## 最新セッションの到達点

- `amd_os_data_change_history`とpublic schemaの336監査triggerを本番適用済み。`/admin/change-history`は実行者・日時・対象行・変更前後を新しい順に表示し、追加/変更/削除で絞り込む。秘密値は伏せ、大きい値は省略、履歴は追記専用。記録は2026-09-16以降で、過去分は遡及生成しない。
- 安全な履歴だけ「この変更を戻す」を表示する。現在値が当該履歴の変更後と一致する場合だけ同一transactionで逆操作し、戻し操作も元履歴へのlink付きで履歴に残す。秘密値・大きい値・主キーなし・競合・戻し済みは対象外。
- 未許可の外部メールのlogin要求を`workspace_access_requests`へ記録し、まさ（ID001）へSlack DMする。研究機関workspaceが一意な要求はDMまたは`/admin/access`から`readonly`・`invited`で許可/拒否できる。PJ/対象未特定は管理画面で権限範囲を選び、停止済みaccount/grantは自動復活しない。開発中の実Slack通知は送っていない。
- migration `20260916223000`は本番適用・migration台帳repair・readback済み。正本は`pwa/spec/2-1-pwa-runtime-routes.md`、`pwa/manual/2-6-admin-ops.md`、`pwa/design/SPEC_pwa.md`、`ios/DESIGN.md`。

## 反映・検証

- DB: migration全文を本番transaction内でrollback検証し、追加/変更/削除の3種類を実際に戻すsmoke test成功後、本番適用。table/function/336 trigger/必須列をreadback済み。
- PWA: `test:data-change-history`、workspace access系回帰、`test:critical-ui`、`test:surface-catalog-contract`、`npx tsc --noEmit`が成功。通常`next build`はNext 16.3.0の既存依存解決（`@vercel/turbopack/postcss`）で失敗し、今回の型・契約検査は成功。deploy wrapperでproduction buildを再確認する。
- commit / production: この文書と同一commitを`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`で反映し、`/api/build-info`の`git_sha`を照合する。

## 関連する直前の状態

- PJ共有ワークスペースは会社情報とPJ管理の境界を是正済み。会社基本情報・資本政策は共有するが、キラー要素カタログはAMD member限定で、外部ワークスペースでは取得も描画もしない。
- ゴールツリーのTODO移動（`bf0a34c`）は、最上位TODOを承認済みで開いている論点へ移す機能。TODOの親子・日程・担当・前後関係は変えず、論点との線だけを移す。複数論点に付くTODOは`移し替える`/`両方に残す`を選ぶ。実データは動かしていない。
- 単独TODOの採否復旧（`3df5371a`）は、`POST { resource: "proposal_bulk", decision, ids }` が正本。承認は単独タスクを残し、却下は論理削除する。実データの却下操作は未実行。

## Repo状態

- canonical `origin/main` は新しい作業の直前に `git fetch origin main` で確認し、その上へrebaseしてから1回だけdeployする。
- 正規checkout `/Users/masa/projects/AMD/amd-os` は他セッション由来のdirtyと分岐を持つ。開始時に `git status -sb` で実数を確認する。reset、stash、削除、`git add .`、他人の変更のcommitをしない。

## 未解決

- service role経由の既存処理でactor header/行の帰属列が無い変更は、個人名ではなく`OS自動処理`と表示する。既存writerへactorを足す場合は別変更として行う。
- 新しいpublic tableを追加するmigrationは末尾で`amd_os_refresh_data_change_history_triggers()`を呼び、監査対象へ加える。

## 次の最初の行動

新しいpublic tableを追加するときは監査trigger refreshを同じmigrationに含める。戻す経路を増やす場合も`amd_os_undo_data_change`を迂回してbrowserから直接DBを逆操作しない。

## 参照先

- 実装履歴: `pwa/design_log/sessions_2026-09.md`
- バグ・教訓: `pwa/BUGS.md`
- 現行仕様: `pwa/spec/2-1-pwa-runtime-routes.md` / `pwa/spec/3-16-project-weekly-control-current-spec.md`
- OSマニュアル: `pwa/manual/2-3-pj-cockpit.md`
