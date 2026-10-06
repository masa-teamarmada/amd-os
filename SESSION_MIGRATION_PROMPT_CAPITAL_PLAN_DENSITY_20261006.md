資本政策表の情報密度改善を引き継いで。作業場所は /Users/masa/projects/AMD/amd-os。

読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. AGENTS.md、HANDOFF_CAPITAL_PLAN_DENSITY_20261006.md
4. pwa/spec/3-8-cockpit-current-spec.md、pwa/spec/3-24-project-surface-pages-current-spec.md、pwa/spec/5-17-dd-package-current-spec.md
5. pwa/BUGS.md、pwa/manual/2-3-pj-cockpit.md、pwa/design_log/sessions_2026-10.md

現在地:
- 「出資額がほぼーで情報密度が低い、行間も広い」という依頼は実装・本番PC確認まで完了。実装56c6461d、本番初回bca5c497/v3.159.20。最新照合ではf6a0d3a4/v3.159.23にも実装を含む。
- 共通CapitalPlanMatrixを株主1人1行に変更。FD比率を主表示、前回比をポイントで補足、非ゼロ出資額だけ表示。＋から出資額・株数・発行済株数・FD株数の4行を開閉する。
- コックピット・ワークスペース・DD共通。DDは閲覧専用。データ・計算・権限・Excel・ネイティブアプリの変更なし。
- 資本政策、DD、critical UI回帰、型検査、対象eslint、production buildと配信ゲート成功。本番PCで12株主の一覧とCEO詳細の開閉を確認。スマホ実画面は未確認、Webの検証はPCのみ。
- 詳しい検証と13ファイルの変更履歴はdesign_log、恒久仕様は上記spec/manualに保存。確認用の複製と一時ファイルはcloseoutで削除する。

次の行動:
- この依頼の未実装事項はない。追加の見た目の指摘が届いた場合だけ、現行の本番PC画面とデータを読み、該当部分を修正する。資本政策の金額・ラウンド条件を推測で変更しない。
- 開始時にgit fetch/statusと/api/build-infoを再取得し、固定SHAへ戻さない。
- 共有mainのCapitalPlanWorkspace.tsx、capital-plan.ts、capital-plan-issue-action.tsは別担当の進行中変更。担当未確定時の確認担当は次の共有main作業者。stage/削除せず担当の受入・コミット後に再判定する。
- 旧未追跡SESSION_MIGRATION_PROMPT_task_based_pt_20260922.mdはSOL DD整備チャットで保存可否をまさへ確認中。その返答に従う。SOLの引き継ぎはSESSION_MIGRATION_PROMPT_SOL_DD_20261006.mdとpwa/HANDOFF_dd_spaces.mdを参照。

運用:
- main一本。共有checkoutの他担当差分をreset/stash/delete/一括commitしない。今回の作業用cloneに新規branch/worktreeは作っていない。
- 変更時はspec/manualと附則を同期し、対象ファイルだけ保存。PWA配信はAMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.shから行い、本番SHAを確認する。
- Turbopack用node_modulesをclone外へsymlinkしない。clone内部に依存を用意する。秘密値や実データの確認HTMLをGitやログに残さない。
