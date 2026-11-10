AMD OSの通知最終採否ゲートを、既存automationの停止状態確認から再開する。作業場所は `/Users/masa/projects/AMD/amd-os`。`pwa/` をセッションの作業場所にしない。

読む順:

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/HANDOFF_NOTIFICATION_ADOPTION_GATE_20261110.md`
4. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
5. `/Users/masa/projects/AMD/amd-os/pwa/manual/1-1-intro.md`
6. `/Users/masa/projects/AMD/amd-os/pwa/spec/1-3-reconstruction-coverage-audit.md`
7. `/Users/masa/projects/AMD/amd-os/pwa/spec/3-7-notifications-current-spec.md`
8. `/Users/masa/projects/AMD/amd-os/pwa/spec/2-4-proactive-todo-current-spec.md`
9. `/Users/masa/projects/AMD/amd-os/pwa/spec/5-3-automation-responsibility-current-spec.md`
10. `/Users/masa/projects/AMD/amd-os/pwa/design/notifications.md`
11. `/Users/masa/projects/AMD/amd-os/pwa/scheduled-tasks/amd-os-proactive-heartbeat/SKILL.md`
12. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md`

状態:

- 通知の主目的は、L2候補をOS正本へ採用するか不採用にするかの最終判断。TODO、本人作業、会議記録、復旧、情報共有、結果報告は採否通知へ混ぜない。
- MTG prepはCodex内で完結し、先手TODOへ複製しない。先手TODOと採否通知は別の面。
- 既存automation id `amd-os-proactive-heartbeat` が、未審査`l2_notifications`へ追加先、変更内容、採用結果、不採用結果を補う。別automationは作らない。
- provider APIや従量課金トークンは使わない。Codex automation自身が意味レビューし、DB書込みは非LLM validator/applierだけが行う。
- 設定頻度は10:15〜20:15 JSTの毎時、通知方針はfailed runs only。
- 2026-11-10の設定readbackではautomationは`PAUSED`。停止理由と停止経緯は未確認。明示なしに再開しない。
- 実行正本に残っていた廃止済みrepo `CLAUDE.md`参照は、2026-11-10 closeoutでrepo `AGENTS.md`へ訂正した。製品挙動、DB、画面、automation設定は変えていない。

次タスク:

1. `git fetch origin --prune`後、main、dirty、ahead/behindを確認する。別作業の変更を戻さず、対象ファイルだけを扱う。
2. Codexのautomation設定をreadbackし、`PAUSED`の理由を確認する。
3. まさが再開を望む場合だけ、別automationを作らず既存`amd-os-proactive-heartbeat`を再開する。
4. 最初の自然実行を監査する。候補0件ならreview JSON・通知・空payloadを作らないこと、候補がある場合は最終採否カードだけを作ることを確認する。
5. `proactive_todos`、`app_notifications`、`meeting_notifications`を入力にも出力にも使わず、Slack、メール、Notion、Driveへ書かないことを確認する。
6. 報告はPhase A/Bの入力件数、approved件数、needs_source件数だけにし、候補本文、個人情報、URL、秘密値を出さない。

守ること:

- main一本で進め、新しいbranchやworktreeを作らない。
- `git add .`を使わず、対象ファイルだけを明示stageする。
- 正本採否候補を先手TODOへ変換しない。MTG prepをOSへ複製しない。
- `saved_count`を採用済みの意味にしない。根拠または安全な採否処理が足りない候補は`needs_source`とし、推測で補完しない。
- automationを再開・更新した場合は、設定readbackと最初の自然実行を別々に検証する。
- PWA変更が生じた場合だけPCのChromeで確認し、正規の反映スクリプトで本番の版情報まで読戻す。依頼がない限りスマホWeb確認は行わない。
