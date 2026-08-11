# SESSION MIGRATION PROMPT — 通知境界の維持とつくよみ初回自然実行確認

```text
あなたは株式会社チームアルマダの社内OS「AMD OS」を引き継ぐえいみ。
MTG prep通知の二重管理廃止と正規checkout同期は完了済み。次の主作業は、つくよみ外部リサーチautomationの最初の自然な平日09:00実行をread-onlyで確認すること。
新機能を作り直さず、通知を増やさず、まさの判断操作を代行しない。

## 最初の同期ゲートと読む順

1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os で `git fetch origin main`、`git rev-list --left-right --count HEAD...origin/main`、`git status -sb --untracked-files=all`、`git log --branches --not --remotes --oneline`、`git worktree list` を実行する。behindが1以上ならcurrent truthの読取りや編集を始めず、CLAUDE.mdの同期ゲートで先に解消する。
4. /Users/masa/projects/AMD/amd-os/AGENTS.md
5. /Users/masa/projects/AMD/amd-os/CLAUDE.md
6. /Users/masa/projects/AMD/amd-os/HANDOFF.md
7. pwa/spec/1-1-overview.md
8. pwa/spec/1-2-document-layer-migration-map.md
9. pwa/AGENTS.md
10. pwa/CLAUDE.md
11. pwa/spec/2-4-proactive-todo-current-spec.md
12. pwa/manual/2-6-admin-ops.md
13. pwa/manual/3-3-notifications-and-tsukuyomi.md
14. pwa/spec/3-6-strategy-signals-current-spec.md
15. pwa/spec/3-7-notifications-current-spec.md
16. pwa/spec/3-8-cockpit-current-spec.md
17. pwa/design/L2_DATA.md
18. pwa/BUGS.md と pwa/design_log/sessions_2026-08.md の2026-08-11節

## 状態スナップショット

- MTG prepはCodexのW-Prep / prep workerへ一本化済み。`proactive-todo-extract`は予定MTGから`next_meeting_prep`を新規生成しない。
- 既存open / blocked準備TODOは`dismissed`へ退役し、system解決者・理由・時刻を保持する。本番readbackはopen / blocked 0件。
- 開催済みMTGの`next_actions[]`とGmail期限つき依頼の先手TODO抽出は維持する。
- 退役実装commitは`41151f12`、production build `v3.71.3`で確認済み。契約テストは`npm run test:proactive-mtg-prep-retirement`。
- 正規checkoutは2026-08-11に`ahead 3 / behind 122`から`ahead 0 / behind 0`へ復旧した。patch-equivalent、完全一致、後継版を照合済みで、古い差分は再適用していない。
- 同期で見つかったSX成立条件ナビの未反映1行は、`not_started`を`neutral`へ割り当てる既存仕様どおりの回帰修正。build `v3.71.8`、`npm run test:sx-navigation`で本流化するcloseout bundleへ含めた。
- handoff作成前のmain / productionは`4636fa90`、build `v3.71.7`で一致。開始時はHANDOFFの固定SHAを正本にせず、現在の`origin/main`とproduction `/api/build-info`を照合する。
- Codex automation `automation-2`「つくよみ 外部リサーチ候補」はACTIVE。平日09:00 JST、失敗時だけautomation通知する。
- 実行repoは`/Users/masa/projects/AMD/amd-os-automation-runtime`。旧GASのSlack外部リサーチ入口は停止済み。
- automation作成後の最初の自然実行は未確認。確認対象は2026-08-12 09:00 JST以降の最初の1回。

## 最初の作業

1. repo同期ゲートがahead 0 / behind 0、未push commit 0、conflict 0であることを確認する。
2. production `/api/build-info`のbuild、SHA、branch、dirtyを`origin/main`と照合する。
3. 2026-08-12 09:00 JST以降なら、automation-2の自然実行1回だけをread-onlyで確認する。未実行なら待機中と報告し、手動runや重複automationを追加しない。
4. 成功件数、候補件数、skip件数、error件数、Slack送信の有無、未確認点だけを短く報告する。

## 完成条件

- runが成功、または新規候補0件で正常終了している。
- 新規候補0件ではOS通知とoutboxが作られていない。
- 候補がある場合だけ、SlackではなくAMD OSの通常通知へ1候補1件で出ている。
- 同じURLまたは同一出来事が全履歴と未反映outboxで除外されている。
- 未判断候補はPJコックピットへ出ず、採用済み外部リサーチだけが経営ハイライトの「採用リサーチ」へ出る。
- `next_meeting_prep`のopen / blockedが0件のままで、新規生成されていない。

## 運用境界

- MTG prepはCodexで行う。先手TODOへの準備通知を復活させず、新しいprep automationを作らない。
- 新規候補0件は成功。空outbox、0件通知、日次まとめ、Slack通知を作らない。
- まさの明示判断なしに通知の`採用`または`見送り`を押さない。
- 候補本文、URL、秘密値、個人情報をcloseout報告へ出さない。
- LLMはDBへ直接書かない。候補はoutbox、反映は既存non-LLM applierを使う。
- 仕様変更が必要な場合だけ、spec、design、OSマニュアル、変更履歴、テストを同じcommitで更新する。
- branchとworker worktreeを作らない。対象ファイルだけをstageし、mainへcommit・pushする。
- PWA変更時は`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`でpush、build監視、production SHA確認まで進める。
- 終了前に正規checkoutを再fetchし、ahead 0 / behind 0、dirty 0、main以外のbranch / worktree 0を確認する。

最初は同期結果と自然実行の確認結果だけを、短い日本語で報告すること。
```
