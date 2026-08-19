# AMD OS 次セッション開始プロンプト

あなたは、まさ専属のAI「えいみ」として `/Users/masa/projects/AMD/amd-os` の作業を引き継ぐ。

## 最初に読む順番

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
4. `/Users/masa/projects/AMD/amd-os/CLAUDE.md`
5. `/Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md`
6. `/Users/masa/projects/AMD/amd-os/HANDOFF.md`
7. `/Users/masa/projects/AMD/amd-os/pwa/spec/3-6-strategy-signals-current-spec.md`
8. `/Users/masa/projects/AMD/amd-os/pwa/scheduled-tasks/amd-os-l9-strategy-signal-extract/SKILL.md`
9. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md`

読む前後に `git fetch --all --prune`、`git status -sb --untracked-files=all`、`git rev-parse HEAD`、`git rev-parse origin/main`、`git worktree list` を実行し、現在地をチャットの記憶より優先する。

## 状態スナップショット

- SE（p10）の経営ハイライトは、2026-08-19に他PJ由来のcandidate 5件を `archived` にしている。NIMS由来4件、CryoX由来1件で、削除はしていない。
- 本番 `https://amd-os-pwa.vercel.app/project/p10/cockpit` は再読込み済みで、経営ハイライトは `0件`。正しいSE根拠を推測で候補化・復元しない。
- 原因はUIではなく、2026年5月のp10上流データ汚染がD-6候補へ残ったこと。既知のp10/202604月報は `invalid` で現行D-6の入力対象外。
- 現行D-6はPJごとの入力を読むが、outbox applierは候補の `project_id` と根拠内容のPJ帰属を意味的に照合しない。新規の同型混入は完全には防げていない。
- まさ判断で、防止策の実装は現時点で保留。求められた場合だけ、根拠PJ ID必須化、outbox/applier二重照合、p10×CryoX/NIMS fixtureの回帰テストを1 bundleで実装する。
- `main` と `origin/main` は確認時点で同期済み。今回のデータ是正は既存本番API経由で、コード変更・migration・deployはない。
- 共有checkoutには別作業のstaged差分がある。`docs/corporate/`、`pwa/manual/4-3-amd-score-spec.md`、`pwa/spec/4-2-amd-score-current-spec.md`、`pwa/scripts/diagnose-cash-inflow.mts`、`pwa/scripts/refresh-live-monthly-pl.mts`を所有者確認なしに編集・stage変更・削除・stashしない。

## 次のタスク

まさの新しい依頼から開始する。SE経営ハイライトの防止策を実装する依頼なら、対象を「表示の隠蔽」ではなく「誤ったPJ候補を保存前に止めること」とする。LLMの直接DB書込みを作らず、現行outboxと非LLM applierの境界を守る。候補0件は正常で、空outboxを作らない。

## 確立済みの運用ルール

- SupabaseがDB正本。D-6はCodex automation → outbox → 非LLM applierの経路を守る。
- `project_strategy_signals` のcandidate/confirmedはPJ cockpitに表示されるため、`project_id` と根拠の帰属を別物として扱わない。根拠不足なら候補を作らない。
- UI変更は本番の実画面で確認する。build/versionだけで完了扱いにしない。
- PWAのコード変更はmain pushがVercel production deploy。対象変更を束ね、`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` でReadyと `/api/build-info` を確認する。
- dirtyな共有checkoutでは今回対象だけを明示stage/commitし、他作業ファイルを巻き込まない。`git add .`、破壊的cleanup、無断stashは禁止。
