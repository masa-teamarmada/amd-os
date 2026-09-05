# HANDOFF - AMD OS PWA

- 更新: 2026-09-06 JST
- セッション: PJワークスペースの目的別グループ化と閲覧境界の整理
- 作業種別: development

## 最新セッションの到達点

- `/project/{projectId}/workspace` を、上段の分類と子タブからなる二段ナビへ変更した。
  - `実行`: テーマ（あるPJだけ）/ 週次差分 / ガント / 目的構造 / 関係先 / 論点・仮説
  - `計画・根拠`: PJ概要 / 技術 / 事業計画
  - `経営・会社`: 会社概要 / 資本政策 / コスト試算 / 知財
  - `資料`: ドライブ
- PCは分類のhover/focusで子タブをフロート表示し、touch端末は選択中分類の子タブ列を常時表示する。子タブの操作領域は44px以上。
- 外部workspace accountはテーマ（存在時）/ ガント / 関係先 / ドライブだけ。`動向・会議`は経営会議を含むためワークスペースへ出さず、会社・資本・コスト・知財・週次介入も出さない。
- 目的構造は同じ管理bundleの別表示のまま。DB、API、環境変数、migrationは追加していない。

## 反映・検証

- 製品変更commit: `5004fa84881552fef55122a4433a5da8681c0dc6`。handoff更新commit: `3b442d0a809a0d49d8681edb06d5d536a81609d5`（前者を含む）。
- production: `v3.100.25`、`/api/build-info` の `git_sha` が `3b442d0a809a0d49d8681edb06d5d536a81609d5` と一致。
- 実行済み: `npm run test:project-workspace-route`、`npm run test:critical-ui`、`npx tsc --noEmit`、`npm run build`、`git diff --check`。
- 本番でSolvioraXのワークスペースを開き、分類ナビ、PJ概要、会社概要、資本政策を確認済み。外部範囲はroute contractでallowlist外を拒否することを確認済み。

## Repo状態

- branch: `main`。`origin/main` と一致（ahead 0 / behind 0）。今回作成したbranch / worktree: なし。
- 実装・仕様・マニュアル・履歴はcommit・push済み。main pushによるproduction buildもReady。
- このcheckoutには別作業の未commit変更が残る。BZM原稿/監査資料群、ならびにAtlas・L2関連のPWA仕様/手引き群で、今回の変更ではない。削除・stash・reset・巻き込みcommitをしない。
- quarantine owner: それぞれの作業を開始した共有checkoutの担当者。次に触る担当者は、作業開始前に`git status --short`と差分を読み、対象単位でcommitする。未分類のまま本セッションが処分できる状態ではない。

## 未解決

- 今回のワークスペース変更に残作業なし。
- リポ全体のarchive/closeoutは、上記の別作業dirtyを担当者がcommitまたは明示的に処分するまで不可。

## 次の最初の行動

まさの次の指示を待つ。ワークスペースを続けるなら、先に `pwa/spec/3-16-project-weekly-control-current-spec.md` と `pwa/manual/2-3-pj-cockpit.md` を読み、外部allowlistを広げずに扱う。

## 参照先

- 現行仕様: `pwa/spec/3-16-project-weekly-control-current-spec.md`、`pwa/spec/2-1-pwa-runtime-routes.md`
- OSマニュアル: `pwa/manual/2-3-pj-cockpit.md`
- 存在契約: `pwa/design/FEATURE_REGISTRY.md`
- 実装履歴: `pwa/design_log/sessions_2026-09.md`
- 仕様履歴: `pwa/spec/6-1-appendix-changelog.md`、`pwa/manual/9-3-appendix-changelog.md`
- バグ・教訓: `pwa/BUGS.md`
