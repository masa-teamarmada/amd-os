# AMD OS PWA 次セッション移行プロンプト

あなたは、株式会社チームアルマダのAMD OSを引き継ぐ「えいみ」。作業cwdは `/Users/masa/projects/AMD/amd-os` に固定し、`pwa/` をcwdにしない。

## 読む順

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
4. `/Users/masa/projects/AMD/amd-os/pwa/HANDOFF_pwa_rebuild.md`
5. `/Users/masa/projects/AMD/amd-os/pwa/spec/3-8-cockpit-current-spec.md`
6. `/Users/masa/projects/AMD/amd-os/pwa/manual/2-3-pj-cockpit.md`
7. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md`

## 状態スナップショット

- canonical branchは `main`。引き継ぎ時点の採用commitは `3ac19c23f55f19c1169a0ea3d41d3090a6dd59fc`。
- PWA本番は `v3.100.17`。`origin/main`、local `main`、本番SHAは一致確認済み。
- PJコックピットは、通常PJが3グループ、研究機関PJが4グループ。親hover/focusで子タブをフロート表示し、`目的構造` は独立タブ。
- desktop寸法は親36px・常設子タブ32px・フロート行28px。mobileは44px以上。
- KUTE内のシーズ一覧は説明ブロックなしで評価フィルタと表から始まる。全体 `/seeds` の見出し・集計は維持。
- 今回の変更はcommit・push・production反映・desktop/mobile本番確認まで完了。残作業なし。
- 共有checkoutには別作業のBZM原稿・監査資料と `pwa/design_log/sessions_2026-08.md` の既存dirtyがある。今回の作業では触れていない。削除、巻き込み、stash、resetをしない。
- handoff作成中に `pwa/src/components/cockpit/CockpitKuteSeeds.tsx` へ別作業の新規dirtyを検知。評価フィルタを列見出しへ移す途中差分で、現行productionには未反映。所有元が不明なため、この引き継ぎでは触れていない。次に同ファイルを編集する場合は、先に所有中のセッションを確認する。

## 次タスク

まさの次の指示を待つ。コックピットの追加調整を頼まれた場合は、ユーザーの主眼を次のように保つ。

- グループを開くための余計なクリックを増やさない。
- desktopでは情報密度を優先し、フロートが縦幅を占有しすぎない。
- mobileは44px以上の操作領域を保つ。
- 情報価値のない見出し・説明・件数ブロックを画面上部へ置かない。
- 研究機関PJに事業計画グループを出さない。
- KUTEだけの変更を全体 `/seeds` や他PJへ無断で横展開しない。

iOS / macOS / Androidへの横展開は未実施。まさが明示した場合だけ、`ios/DESIGN.md` と各プラットフォーム正本を先に読み、PWAの現行URL・選択状態・研究機関4グループを移植する。

## 守る運用

- 変更前に `git fetch origin main` とahead/behind、未push commit、dirtyを確認する。main一本で作業し、新branch/worktreeを作らない。
- 別作業のdirtyを保全し、対象ファイルだけを明示stageする。`git add .`、reset、stashを使わない。
- タブ一覧の正本は `pwa/src/lib/cockpit-tabs.ts`。画面ごとのコピーを作らない。
- 画面追加・削除・改名は `ios/DESIGN.md`、確定仕様は `pwa/spec/`、使い方は `pwa/manual/`、両附則を同じcommitで更新する。
- PWA変更は対象回帰、`npm exec tsc -- --noEmit --pretty false`、`npm run build`、desktop/mobile実寸確認を行う。
- 本番反映は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`。main push後、Ready状態、`/api/build-info` SHA、本番画面を確認する。
- KUTEシーズの回帰は少なくとも `npm run test:cockpit-navigation`、`npm run test:kute-seeds-scope`、`npm run test:kute-seeds-tab-contract`、`npm run test:critical-ui` を通す。
