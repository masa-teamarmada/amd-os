AMD OSのドライブ改善の引き継ぎ。作業場所は /Users/masa/projects/AMD/amd-os。仕事種別は開発。

読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. AGENTS.md、HANDOFF_DRIVE_20261006.md
4. pwa/manual/1-1-intro.md、pwa/spec/1-3-reconstruction-coverage-audit.md
5. pwa/spec/3-8-cockpit-current-spec.md、pwa/spec/3-16-project-weekly-control-current-spec.md、pwa/manual/2-3-pj-cockpit.md
6. pwa/BUGS.md、pwa/spec/5-2-development-operations-current-spec.md、pwa/design/SPEC_GOVERNANCE.md

状態:
- URLコピー20f968b5、常時表示と高密度一覧dd4e6e56、見出し縮小456a0350（統合8d2816aa）はmainと本番へ反映済み。検収時はv3.160.12、Chrome実測でファイル65px・フォルダ49px・見出し46px、コピー後の実貼付も確認。
- 全フォルダのファイルを初期一覧に出し、更新順に表示。URL・所属フォルダ・コピー操作を常設。フォルダを開くと直下へ絞る。表示URLは既存認可付き閲覧URLで、期限付き署名URLをコピーしない。
- 型検査、対象lint、workspace-documents-core、配布ゲート成功。同名競合contractの文言正規表現は既存不整合で失敗。新規DB・環境変数・認可・理論変更なし。Swift等のUIは未移植。
- closeout開始時main d0ece3c4、ahead/behind各0。本番確認はv3.160.15/6e1f408aで本変更を含む。別担当の配信が進行しているため、再開時はfetchとbuild-infoを再確認する。
- 実装・仕様・使い方は上記正本、開発経緯はpwa/design_log/sessions_2026-10.md。元スクリーンショットは会話添付で、一時パスの永続性は保証しない。

次の行動:
今回の依頼は完了、追加実装は不要。まさの「最初から表示」「情報密度を高く」「見出しもコンパクト」を維持する。新しい依頼が来たら現在のPC Chromeで確認してから対象を絞る。URLを追加クリックの裏に戻さない。
別件の古いSESSION_MIGRATION_PROMPT_task_based_pt_20260922.mdは未追跡のまま保護。担当は「タスク方式への変更」（01a0c711-2edc-7cc3-b346-fbe198603454）。再開時に現行仕様・支払保護状態と照合し保存/廃棄を決めるまで、古い指示を実行しない。

運用:
cwdはリポルート、main一本。新しい枝・worktree・子エージェントを作らない。fetchしてbehindを解消し、他担当の差分を一括commit/reset/stashしない。対象ファイルだけstageする。
変更時はmanual/spec/附則と必要なDESIGN・引き継ぎを同期し、実画面の寸法とコピー後の貼付を確認する。PWA配信は AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh でmain push・Ready・配信SHAまで確認。依頼外のDB操作・通知・外部連絡を行わない。
