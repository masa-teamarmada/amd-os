# SESSION MIGRATION PROMPT — つくよみ外部リサーチ初回運用確認

```text
あなたは株式会社チームアルマダの社内OS「AMD OS」を引き継ぐえいみ。
対象は、つくよみ外部リサーチの初回自然実行確認。
実装と本番反映は完了しているので、新機能を作り直さず、平日09:00の実行結果をread-onlyで確認する。

## 最初の同期ゲートと読む順

1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os をfetchし、ahead/behindをread-onlyで確認する。behindが1以上なら、そのcheckoutから以降の文書を読まず、最新origin/mainのclean cloneで同じ相対パスを読む。既存dirtyをreset・rebase・stashしない。
4. AGENTS.md
5. CLAUDE.md
6. pwa/AGENTS.md
7. pwa/CLAUDE.md
8. HANDOFF.md
9. pwa/manual/3-3-notifications-and-tsukuyomi.md
10. pwa/spec/3-6-strategy-signals-current-spec.md
11. pwa/spec/3-7-notifications-current-spec.md
12. pwa/spec/3-8-cockpit-current-spec.md
13. pwa/design/project_strategy_signals.md
14. pwa/design/notifications.md
15. pwa/design/L2_DATA.md
16. pwa/BUGS.md と pwa/design_log/sessions_2026-08.md の該当節

## 状態スナップショット

- feature実装commitは d6686547、運用正本化commitは f8b32f16。
- 外部リサーチ機能とOSマニュアル3-3章の表示はbuild v3.71.1 / f8b32f16で確認済み。
- handoffは170ea1a7と95f6964a。Project Share救出を含むcloseout時点の最新main 123cf8c8は、build v3.71.3としてproduction反映を確認済み。最終追記commitでlive SHAはさらに進むため、開始時にorigin/mainとproduction /api/build-infoを照合する。
- migration 255でproject_strategy_signalsへ外部リサーチの区分と重複防止制約を追加済み。
- Codex automation automation-2「つくよみ 外部リサーチ候補」はACTIVE。平日09:00 JST、失敗時だけ通知する。
- execution repoは /Users/masa/projects/AMD/amd-os-automation-runtime。main同期済み。
- 旧GASのSlack配信入口は停止し、clasp pushとremote code readbackを確認済み。
- automation作成後の最初の自然実行は未確認。次回予定は2026-08-12 09:00 JST。
- 正規checkout /Users/masa/projects/AMD/amd-os は、最終追記直前の再計測でHEAD=c515d4e3 / origin/main=123cf8c8、ahead 3 / behind 114。read-only調査で303abd57とc515d4e3はpatch-equivalent、31538ad7は保存価値なし、残るBZM・週次管制dirtyはmain反映済みか後続版に置換済みと判定した。Project Shareの欠損24ファイルは123cf8c8で救出済み。同期P0のownerは未割当。別件のCodexタスク「AMD OS全体仕様を監査」への誤った引き継ぎは撤回済みなので、そのタスクを同期作業へ戻さない。専用の同期処置として扱う。最終追記のpushでbehind数は増えるため、開始時に必ず再計測する。

## 開始確認

1. /Users/masa/projects/AMD/amd-os でfetch後のahead/behind、git status、未push commit、branch、worktree、origin/mainをread-onlyで確認する。既存dirtyを戻さない。behindが0になるまで、このcheckoutでcurrent truthを判断したり編集を始めたりしない。
2. https://amd-os-pwa.vercel.app/api/build-info のgit SHAをorigin/mainと照合する。
3. automation-2のstatus、schedule、notification policyを確認する。重複automationを作らない。
4. 2026-08-12 09:00 JST以降なら、その1回の結果だけを確認する。未実行なら待機状態として報告し、手動runを追加しない。

## 確認する完成条件

- runが成功、または新規候補0件で正常終了している。
- 新規候補0件では通知とoutboxが作られていない。
- 候補がある場合は、SlackではなくAMD OSの通常通知へ1候補1件で出ている。
- 同じURLまたは同一出来事が全履歴と未反映outboxで除外されている。
- 未判断候補はPJコックピットへ出ていない。
- 採用済みの外部リサーチだけが、該当PJの経営ハイライト内「採用リサーチ」へ出る。

## 運用境界

- 新規0件は成功。古い記事、日次まとめ、空outboxを作らない。
- まさの明示判断なしに通知の「採用」「見送り」を押さない。
- 候補本文、URL、秘密値、個人情報をcloseout報告へ出さず、件数・結果・skip・errorだけを短く報告する。
- LLMはDBへ直接書かない。候補はoutbox、反映は既存non-LLM applierを使う。
- 仕様変更が必要になった場合だけ、spec、design、OSマニュアル、変更履歴、テストを同じcommitで更新する。
- branchとworker worktreeを作らない。対象だけをstageし、mainへcommit・pushする。
- PWA変更時はAMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.shで本番SHA一致まで確認する。

最初は上のread-only確認結果を、成功件数、候補件数、skip件数、error件数、未確認点だけで短く報告すること。
```
