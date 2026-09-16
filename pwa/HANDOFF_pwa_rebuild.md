# HANDOFF - AMD OS PWA

- 更新: 2026-09-16 JST
- セッション: PJ共有ワークスペースの会社情報・PJ管理境界の是正
- 作業種別: development

## 最新セッションの到達点

- コックピットはAMDメンバー限定、`/project/[projectId]/workspace`はAMD外を含む当該PJメンバー限定のまま。URL、利用者区分、`resolveSharedWorkspaceAccess`の判定は変えていない。
- コックピットの`PJ管理`はAMD内部で定義する`PJ概要`だけを持つ。会社概要は両面共通の`会社情報`へ独立させ、ワークスペースの分類は `進捗管理 / 事業計画 / ドライブ / 会社情報` を `COCKPIT_GROUP_LABELS` から参照する。外部PJメンバーは既存の進捗管理・ドライブ・会社基本情報・資本政策に加え、事業計画の技術 / 競合比較 / ビジネスモデル / 事業計画 / コスト試算 / コスト試算（燃料） / 知財を読む。技術・競合比較・ビジネスモデル・事業計画・コスト試算・知財・資本政策は未登録でも空状態の入口を残し、燃料試算だけはデータがあるPJに出す。
- `project-tech` / `project-cost-model` / `project-ip` / `governance` のGETは当該PJのactive workspace membershipを再確認して共有の読み取りだけを許可する。会社概要の外部読み取りには会社基本情報を含めるが、キラー要素カタログはワークスペースでマウントも取得もせず、`killer-factors` APIはAMD memberのまま閉じる。POST/PATCH/DELETEと編集ボタンはAMD側の既存権限のまま。PJ概要・動向・会議・Slack・スコア詳細・週次介入・担当負荷はコックピットだけに残す。
- 正本: `pwa/spec/2-1-pwa-runtime-routes.md`、`pwa/spec/3-16-project-weekly-control-current-spec.md`、`pwa/manual/2-3-pj-cockpit.md`。DB migrationはない。

## 反映・検証

- commit / production: `main`の本変更コミットを `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` で反映する。commitとproductionの照合は`/api/build-info`の`git_sha`を正とする。
- 実行済み: `npm run test:project-workspace-route`、`npm run test:critical-ui`、`npm run test:project-cost-model`、`npm run test:reference-data-cache`、変更ファイルに絞ったeslint、`npx tsc --noEmit`。deploy scriptが同じ回帰ゲートを再実行する。
- ローカル画面はSupabaseの公開URL・anon keyがない検証cloneでは起動できない。UIの構造・モバイルの横スクロール・44px操作領域はソースと契約テストで確認済み。本番反映後は外部PJ memberでの実画面確認を残す。

## 関連する直前の状態

- ゴールツリーのTODO移動（`bf0a34c`）は、最上位TODOを承認済みで開いている論点へ移す機能。TODOの親子・日程・担当・前後関係は変えず、論点との線だけを移す。複数論点に付くTODOは`移し替える`/`両方に残す`を選ぶ。実データは動かしていない。
- 単独TODOの採否復旧（`3df5371a`）は、`POST { resource: "proposal_bulk", decision, ids }` が正本。承認は単独タスクを残し、却下は論理削除する。実データの却下操作は未実行。

## Repo状態

- canonical `origin/main` は新しい作業の直前に `git fetch origin main` で確認し、その上へrebaseしてから1回だけdeployする。
- 正規checkout `/Users/masa/projects/AMD/amd-os` は他セッション由来のdirtyと分岐を持つ。開始時に `git status -sb` で実数を確認する。reset、stash、削除、`git add .`、他人の変更のcommitをしない。

## 未解決

- ローカル画面の実機確認は、cloneにSupabase公開環境変数を置かない方針のため未実施。本番反映後に、外部PJメンバーの読み取り表示と編集ボタン不在を確認する。
- PWA全体のlintは今回と無関係な既存違反で失敗する。修正時は別タスクとして発生源を分類する。

## 次の最初の行動

共有面をさらに広げる前は、`pwa/spec/2-1-pwa-runtime-routes.md` と `pwa/spec/3-16-project-weekly-control-current-spec.md` を読み、コックピットのAMDメンバー限定とワークスペースのPJメンバー限定を変えない。

## 参照先

- 実装履歴: `pwa/design_log/sessions_2026-09.md`
- バグ・教訓: `pwa/BUGS.md`
- 現行仕様: `pwa/spec/2-1-pwa-runtime-routes.md` / `pwa/spec/3-16-project-weekly-control-current-spec.md`
- OSマニュアル: `pwa/manual/2-3-pj-cockpit.md`
