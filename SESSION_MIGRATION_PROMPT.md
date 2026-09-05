# AMD OS PWA 次セッション移行プロンプト

あなたは、株式会社チームアルマダのAMD OSを引き継ぐ「えいみ」。cwdは `/Users/masa/projects/AMD/amd-os` に固定し、`pwa/` をcwdにしない。

## 読む順

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
4. `/Users/masa/projects/AMD/amd-os/pwa/HANDOFF_pwa_rebuild.md`
5. `/Users/masa/projects/AMD/amd-os/pwa/spec/2-1-pwa-runtime-routes.md`
6. `/Users/masa/projects/AMD/amd-os/pwa/spec/3-16-project-weekly-control-current-spec.md`
7. `/Users/masa/projects/AMD/amd-os/pwa/manual/2-3-pj-cockpit.md`
8. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md`

## 状態スナップショット

- canonical branchは `main`。PJワークスペースの採用commitは `5004fa84881552fef55122a4433a5da8681c0dc6`、最新handoff commitは `3b442d0a809a0d49d8681edb06d5d536a81609d5`。どちらも`origin/main`へpush済みでlocal mainも一致している。
- productionは `v3.100.25`。`https://amd-os-pwa.vercel.app/api/build-info` で最新handoff commitのSHAを確認済み。製品変更commitはその親として含まれる。
- PJワークスペースは、内部メンバーには `実行 / 計画・根拠 / 経営・会社 / 資料` の分類→子タブを出す。外部workspace accountはテーマ（存在時）/ ガント / 関係先 / ドライブだけ。
- `動向・会議`は経営会議を含むためワークスペースへ出さない。外部に会社概要、資本政策、コスト試算、知財、週次介入、担当負荷を出さない。
- このcheckoutには別作業の未commit変更が残る。BZM原稿・監査資料群、Atlas/L2関連のPWA仕様・手引き群は今回の変更ではない。削除、stash、reset、まとめてstageをしない。

## 次タスク

まさの次の指示を待つ。ワークスペースの追加変更では、コックピットと同じく「分類→子タブ」の情報設計を保つ。外部に経営会議や会社・資本情報を広げる必要が生じたら、画面だけでなくaccess bundle・仕様・閲覧境界を先に確認し、まさに判断を返す。

## 守る運用

- 作業前に `git fetch origin main`、ahead/behind、dirtyを確認。main一本で作業し、新branch/worktreeを作らない。
- 別作業のdirtyは対象ファイルだけを明示stageして保全する。`git add .`、reset、stashを使わない。
- 画面仕様は `pwa/spec/`、利用者向け説明は `pwa/manual/`、業務導線は `pwa/design/FEATURE_REGISTRY.md`。画面追加・削除・改名は `ios/DESIGN.md` も更新する。
- PWA実装変更では対象回帰、`npx tsc --noEmit`、`npm run build`、PC/モバイルの見た目確認を行う。
- 本番反映は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`。shared checkoutがdirtyなら対象commitだけのclean cloneから実行し、push後にReadyと`/api/build-info`のSHAをreadbackする。
