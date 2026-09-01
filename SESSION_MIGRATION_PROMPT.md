# 次セッション用プロンプト — ZMP共有ワークスペース

cwd: `/Users/masa/projects/AMD/amd-os`

まず次の順で全文を読む。

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
4. `/Users/masa/projects/AMD/amd-os/pwa/AGENTS.md`
5. `/Users/masa/projects/AMD/amd-os/pwa/manual/1-1-intro.md`
6. `/Users/masa/projects/AMD/amd-os/pwa/spec/1-3-reconstruction-coverage-audit.md`
7. `/Users/masa/projects/AMD/amd-os/HANDOFF_ZMP_WORKSPACE_2026-09-01.md`
8. `/Users/masa/projects/AMD/amd-os/pwa/spec/2-7-ui-design-code-current-spec.md`
9. `/Users/masa/projects/AMD/amd-os/pwa/spec/3-16-project-weekly-control-current-spec.md`
10. `/Users/masa/projects/AMD/amd-os/pwa/manual/2-3-pj-cockpit.md`
11. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md`の`[PWA/project-workspace]`節
12. `/Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-09.md`のZMP節

## 状態スナップショット

- canonical repoは`/Users/masa/projects/AMD/amd-os`、branchは`main`一本。
- 受入済みUI commitは`96d04c63e2d2ced2b8395aa8ca3b7f6f6a463dc3`。
- 現在の本番は`v3.100.14` / `f7495b7a6956c2d38b116ba2199e440328494908`で、受入済みUI commitを祖先に含む。`origin/main`はその後ろにhandoffの`[skip ci]` docs commitだけを持つ。着手時に`git log -5`と`/api/build-info`を再読する。
- 共有ワークスペースは`/project/p19/workspace`、コックピットは`/project/p19/cockpit?tab=gantt`。
- 実装正本は`SxWeeklyControlDashboard.tsx`、`weekly-control.module.css`、`sx-objective-map.module.css`。
- DB migration、schema、RLS、認可、writer、モデル、iOS/macOS/Android、GASは今回変更していない。
- 本件開始前からBZM P1原稿・プレビュー・監査メモと`pwa/design_log/sessions_2026-08.md`に別作業のdirtyがある。本件へ混ぜず、削除・revert・一括stageしない。

## このセッションで確定したこと

- 共有ワークスペースの対象はAMD内部だけではない。外部を含む当該PJメンバーが同じ共有情報を読む。色の変更とメンバー制限を結びつけない。
- ワークスペース外枠はコックピットの設計体系を使う。sky/white/slateを基礎に、white header/panel、AMD Blueの選択tab、見出し左railを使う。
- コックピット側の目的構造は、blue=構造・選択、emerald=完了、amber=当方action待ち・注意、slate=停止・中立。PJや水素の連想から独自green/tealを操作主色にしない。
- global CSS chunkだけへ色tokenを預けない。共有component rootでも`--amd-*`を解決し、fallbackなしのcustom propertyで透明・黒へ脱落させない。
- desktop 1440×900とmobile 391×844で横overflow 0を維持する。mobileの主要操作は44px以上。情報密度を落とす巨大見出し・過剰余白・装飾カード縦積みへ戻さない。

## 次のタスク

この受入範囲の実装は完了している。次は、まさから新しい画面フィードバックが来た場合だけ、その指摘箇所を本番の現物で確認して続ける。先回りして認可・データ構造・対象メンバーを変更しない。

継続作業が入ったら、最初に`git fetch origin main`と`git status --short`を実行し、上記の既存BZM dirtyを保全する。対象ファイルだけを明示stageする。PWA変更は`BUILD_VERSION`、該当spec/manual、附則を同じcommitで更新し、`test:ui-design-code`、`test:zmp-workspace-themes`、`test:critical-ui`、production build、desktop/mobile実寸確認を行う。

本番反映は`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`だけを使い、Vercel CLIの直接deployは行わない。main push後、`/api/build-info`のSHAがHEADと一致するまで確認する。新しいbranch/worktreeは作らない。
