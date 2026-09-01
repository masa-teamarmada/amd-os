# HANDOFF — ZMP共有ワークスペース

最終更新: 2026-09-01 JST  
作業種別: development  
対象: 共有ワークスペース再設計とコックピット目的構造の役割色

## 最新セッション

- `/project/p19/workspace`をコックピットの設計体系へ合わせ、sky/white/slateのpage・header・tab・panelへ再設計した。
- `/project/p19/cockpit?tab=gantt`と共有ページの目的構造は、blue=構造・選択、emerald=完了、amber=当方action待ち・注意、slate=停止・中立へ統一した。
- 対象は外部を含む当該PJメンバーのまま。AMD内部だけへの限定、認可、表示対象データ、保存権限の変更はない。
- global CSS chunkの分割・cacheで色tokenが未解決になっても白黒へ脱落しないよう、共用component rootへ確定tokenとfallbackを置いた。
- desktop 1440×900、mobile 391×844で横overflow 0。mobileの主tabとガント／目的構造切替は44px。
- 詳細な実装履歴は`pwa/design_log/sessions_2026-09.md`、事故と再発防止は`pwa/BUGS.md`の`[PWA/project-workspace]`節。

## Repo / 本番

- canonical path: `/Users/masa/projects/AMD/amd-os`
- branch: `main`
- HEAD / origin/main / production: `96d04c63e2d2ced2b8395aa8ca3b7f6f6a463dc3`
- production build: `v3.100.13`
- commits: `d2e305e9`（共有面再設計）、`96d04c63`（mobile切替44px）
- branch / 追加worktree: none

## 未解決

- このセッションの受入範囲には残作業なし。
- iOS/macOS/Androidへ同画面を移植していないが、今回の依頼範囲外。共通DB・モデルは変更していない。
- 次のUI変更は、まさの新しい画面フィードバックを受けてから行う。PJ名や技術領域の連想色を操作主色へ持ち込まない。

## 次の最初の行動

1. `/api/build-info`で`v3.100.13`と上記SHAを確認する。
2. ZMP workspaceの`ガント > 目的構造`とcockpitの同画面を開き、まさの次の指摘箇所を現物で確認する。
3. 変更する場合は、認可を触らず、`spec/2-7`の情報密度・意味色・実寸検証を維持する。

## 正本・参照先

- UIデザインコード: `pwa/spec/2-7-ui-design-code-current-spec.md`
- PJ共有ワークスペース: `pwa/spec/3-16-project-weekly-control-current-spec.md`
- 利用説明: `pwa/manual/2-3-pj-cockpit.md`
- 開発履歴: `pwa/design_log/sessions_2026-09.md`
- バグ・教訓: `pwa/BUGS.md`
- 現行UI: `pwa/src/components/project-workspace/SxWeeklyControlDashboard.tsx`
- 外枠: `pwa/src/components/project-workspace/weekly-control.module.css`
- 目的構造: `pwa/src/components/project-workspace/sx-objective-map.module.css`

## 実行済み検証

- `npm run test:ui-design-code`
- `npm run test:zmp-workspace-themes`
- `npm run test:critical-ui`
- `npm run build`
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`
- 認証済み本番のdesktop/mobile実寸、computed style、build-info readback

## 既存WIP

本件開始前から、BZM P1原稿・プレビュー・監査メモと`pwa/design_log/sessions_2026-08.md`に別作業の未commit変更がある。本件commitへ含めず、deploy時の個別退避後に同じ内容を復元した。所有者はそのBZM作業。次に同領域を再開するセッションが内容を確認してcommit判断する。
