# 次セッションへの引き継ぎ（2026-09-16）

あなたは株式会社チームアルマダのAMD OSを引き継ぐえいみ。cwdは `/Users/masa/projects/AMD/amd-os` に固定し、`pwa/` をcwdにしない。

## 読む順

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/HANDOFF.md`
4. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
5. `/Users/masa/projects/AMD/amd-os/pwa/HANDOFF_pwa_rebuild.md`
6. `/Users/masa/projects/AMD/amd-os/pwa/spec/3-21-question-tree-current-spec.md`
7. `/Users/masa/projects/AMD/amd-os/pwa/manual/2-9-question-tree.md`
8. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md` の 2026-09-16 単独タスク採否の節

## 状態スナップショット

- canonical `origin/main`: `142294f046b11b3672c39f90631c060ec3645b3c`（単独タスク採否の製品変更 `3df5371a949d5c27eb03594ab640651872054432` を含む）。PWA本番は `v3.140.7`、`https://amd-os-pwa.vercel.app/api/build-info` で製品変更のSHAを確認済み。
- タスクタブの「承認待ちのタスク」は `POST { resource: "proposal_bulk", decision, ids }` が正本。承認は単独タスクとして残り、却下は論理削除する。DB migrationはない。
- PWAの `だよ` / `してね` / `てね` / `でね` はcritical UI検査で禁止済み。新規経路の契約検査は `npm run test:question-tree-task-review`、`npm run test:critical-ui` にも組み込み済み。
- 正規checkout `/Users/masa/projects/AMD/amd-os` は他セッション作業を含め `d4d254a7`、`origin/main`よりahead 3 / behind 210、29パスdirty。今回の作業では触っていない。reset、stash、`git add .`、他人の変更のcommitをしない。実装が必要ならまず最新mainから使い捨てclean cloneを作る。

## 次に扱うときの注意

- まさの要望は、OS上に残るビジネスらしくない会話調表現を根絶すること。禁止語の単純走査を回避するのではなく、対象画面の文脈に合う業務文へ直す。
- 却下は候補を論理削除する操作。本番で試すなら、まさが指定した候補だけを対象にし、事前値と復元方法を控える。確認目的だけで実データを却下しない。
- PWA反映は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`。`npx vercel` は使わない。production確認は `/api/build-info` のSHAで行う。
- 今回はdeploy wrapperの全ゲート、`git diff --check`、本番の更新後表示を確認済み。`npm run lint` は今回と無関係な既存違反310件で失敗しているため、直すなら別タスクとして原因を分類する。
