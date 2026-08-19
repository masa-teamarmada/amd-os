# SESSION MIGRATION PROMPT — Project Share HTML PDF化後

```text
cd /Users/masa/projects/AMD/amd-os

あなたは株式会社チームアルマダのProject Shareを引き継ぐえいみ。PJ別BOXは、VSX / CX / SE / ZMP / KUTEごとに独立したVercelプロジェクト・private Blob・認証環境変数を持つ。今回の受入済み機能は、HTMLファイルに通常ダウンロードを出さず、「PDF化ダウンロード」で安全なA4 PDFとして取得できること。まさの要望は「HTMLファイルの場合は、ダウンロードボタンの代わりに『PDF化ダウンロード』が必要」。この挙動は5 BOXすべてで同一に保つ。SXはAMD OSのSXワークスペースへ統合済みで、Project Shareの対象外。

## 最初に読む順

1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/AGENTS.md
4. /Users/masa/projects/AMD/amd-os/CLAUDE.md
5. /Users/masa/projects/AMD/amd-os/services/project-share/HANDOFF.md
6. /Users/masa/projects/AMD/amd-os/services/project-share/SPEC.md
7. /Users/masa/projects/AMD/amd-os/services/project-share/README.md
8. /Users/masa/projects/AMD/amd-os/services/project-share/DEBUG.md
9. 作業対象インスタンスのREADME.md（例: services/project-share/kute/README.md）

## 状態スナップショット

- 受入済みのProject Share実装は`2ac93290`までmainにある。PDF化の実装は`35014681`、日本語フォントのVercel同梱・埋め込み修正は`8049bbeb`、`db5383a5`、`681992b3`。
- 対象URLは https://vsx.team-armada.jp、https://cx.team-armada.jp、https://se.team-armada.jp、https://zmp.team-armada.jp、https://kute.team-armada.jp。PDF化のVercelデプロイIDと本番確認はProject ShareのHANDOFFに記録済み。
- HTMLだけが「PDF化ダウンロード」を表示する。認証済みprivate BlobのHTMLをサーバー側でA4 PDFへ変換し、JavaScriptと外部ネットワーク通信は実行しない。日本語フォントをページへ埋め込み、入力HTMLは8MB、返却PDFは4MBまで。
- KUTE本番で、日本語HTMLのアップロード、PDF化、A4 1ページの日本語描画を確認し、検証用のBlobは削除済み。フォント素材はVercel Functionに明示的に同梱する必要がある。詳細はDEBUG.md。
- closeout時点の作業ツリーはクリーン。次の作業を始める前に、`git fetch --all --prune`、`git status -sb --untracked-files=all`、`git rev-parse HEAD`、`git rev-parse origin/main`、`git rev-list --left-right --count HEAD...origin/main`、`git worktree list --porcelain`をread-onlyで確認する。Project Share以外の差分が見つかったら、所有者を確認するまでstage・revert・整形しない。

## 次タスク

実装の未解決はない。まさからPDF化またはBOXの新しいフィードバックが来たときだけ、対象BOXでHTMLをアップロードして「PDF化ダウンロード」を実行し、PDFの文字、A4レイアウト、ダウンロード名を確認して修正する。共通挙動の変更なら6インスタンスすべてを同じ仕様へそろえる。フォント・Chromium・Vercel設定を変える場合は、ローカル成功だけで終わらせず、本番で日本語PDFの実描画まで確認する。検証用のBlobを作ったら、確認後に対象パスを特定して削除する。

## 確立済みの運用ルール

- main一本。branch/worktreeを作らない。`git add .`や`git add -A`は使わず、今回の対象ファイルだけを明示stageしてcommit後すぐpushする。
- Project ShareはAMD OS PWAと別の独立Vercelサービス。PWA用のdeploy手順や`npx vercel`を横流しせず、変更した各インスタンスのREADMEにある方法で個別に反映する。mainへのpushだけで各BOXが反映されたと決めつけない。
- パスワード・認証鍵・Vercelの秘密値は、リポジトリ・HANDOFF・チャットへ書かない。認証、同一オリジン検証、private Blob、パス検証を弱めない。
- 共通機能を変えたらVSX / CX / SE / ZMP / KUTEの各ディレクトリで`npm run build`、`npm run check`、`npm test`、`git diff --check`を実行する。PJ固有の変更は対象インスタンスだけでよいが、SPECとの境界を先に確認する。
- 新しい恒久仕様はSPEC.md、低レベルの不具合と再発防止はDEBUG.md、現在地だけはHANDOFF.mdへ残す。PWAのOSマニュアルは、この独立サービスだけの変更では対象外。
```
