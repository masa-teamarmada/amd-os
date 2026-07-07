# SESSION MIGRATION PROMPT - AMD OS closeout-ready current state

```text
cd /Users/masa/projects/AMD/amd-os

読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. HANDOFF.md
4. CLAUDE.md
5. pwa/AGENTS.md
6. pwa/CLAUDE.md
7. pwa/manual/1-1-intro.md
8. pwa/spec/1-1-overview.md
9. pwa/spec/1-2-document-layer-migration-map.md
10. pwa/spec/1-3-reconstruction-coverage-audit.md
11. pwa/design/README.md
12. 次タスクに関係する pwa/spec / pwa/manual / pwa/design の正本
13. pwa/BUGS.md
14. pwa/design_log/sessions_2026-07.md

状態スナップショット:
- canonical repo: /Users/masa/projects/AMD/amd-os
- branch: main
- HEAD / origin/main: 04a3a55d0cf62c48b588c8ba8f0c140cc41a022d
- production: https://amd-os-pwa.vercel.app
- production /api/build-info observed during closeout:
  - build_version: v0.39.7
  - git_sha: 04a3a55d0cf62c48b588c8ba8f0c140cc41a022d
  - git_branch: main
  - dirty: false
- git status: clean
- local main vs origin/main: ahead 0 / behind 0
- registered worktree: /Users/masa/projects/AMD/amd-os [main] only
- local branches: main only
- closeout status: archive ok for the repo session

直近で完了した成果:
- MTGカードの「予定/準備/日程未確定」亡霊修正は完了済み。
- まさ確認済み: 2026-07-08「調整中なくなった」。
- accepted commits:
  - bec4159810c59f76f4fe115ce7c14e65dfb66f32: fix(pwa): clear stale meeting prep ghosts
  - 80cd1fe557282e8bced855c60426735aab62de90: fix(pwa): fold undated meetings into schedule list
  - 04a3a55d0cf62c48b588c8ba8f0c140cc41a022d: docs(handoff): record meeting card ghost closeout
- 設計同期済み:
  - pwa/spec/3-3-meeting-flow-current-spec.md
  - pwa/spec/2-4-proactive-todo-current-spec.md
  - pwa/manual/2-3-pj-cockpit.md
  - pwa/manual/9-3-appendix-changelog.md
  - pwa/spec/6-1-appendix-changelog.md
  - pwa/BUGS.md
  - pwa/design_log/sessions_2026-07.md

MTGカード修正の現行仕様:
- 予定MTG欄に出す日時確定 row は、source_kinds に upcoming token を持ち、upcoming_tentative token を持たず、meeting_start_at が現在時刻より後のものだけ。
- 日程未確定 row (source_kinds=upcoming_tentative) は別の「日程調整中MTG」欄を作らず、同じ「予定MTG / 準備中」欄に入れる。日付欄は「日程未確定」。
- meeting_id が upcoming: で始まるだけでは準備カード扱いしない。source_kinds が notion/gmail/drive/slack/calendar など開催済みソースへ変わっている row は開催済み側として扱う。
- 開催済み議事録に表示する MTG準備情報は、手動準備または prep worker 成果があるものだけ。calendar-future-sync の薄いテンプレートは出さない。
- next_meeting_prep TODO は、紐づく予定MTGの開始時刻を過ぎたら自動で done にする。

検証済み:
- npx tsc --noEmit
- npm run test:critical-ui
- predicate 小テスト (future upcoming / started upcoming / pending tentative / old tentative / held-source upcoming-id)
- git diff --check
- npm run build
- AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh
- production /api/build-info 確認
- production cron cleanup: closed_expired_prep=13
- cleanup 後、開始済みMTGに紐づく open/blocked next_meeting_prep は 0
- KUTE p25 の新判定では予定欄は未来3件のみ。スクショにあった 2026-06-23 / 2026-06-22 row は予定欄に入らない。

次タスク:
- MTG-card ghost fix に関しては基本なし。
- もしまさから「まだ残ってる」と言われたら、まず画面左上 version と /api/build-info が v0.39.7 以上か確認する。
- そのうえで該当 row の project_meeting_summaries を読む。確認順は source_kinds / meeting_id prefix / meeting_start_at / calendar_event_id / prep_status / generated_by_model。
- 推測でDB rowを削除・上書きしない。まず表示predicateのどこに入ったかを分類する。
- 新しい AMD OS 作業を始める場合は、HANDOFF の first next action のコマンドで current truth を再確認してから、該当 spec/manual/design 正本を読む。

運用ルール:
- /Users/masa/projects/AGENTS.common.md を最初に読む。
- AMD配下PJでは AMD level memory (/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md) も冒頭で読む。
- AMD OSでは branch を作らない。main で直接 commit & push。
- dirty は branch/worktree 作成理由にしない。必要なら main を checkout した disposable clean clone で対象差分だけ扱い、closeout で状態を明記する。
- git add . は使わない。対象ファイルだけ stage。
- PWAコード変更時は src/lib/build-info.ts の BUILD_VERSION を bump する。
- PWA本番反映は main push = Vercel自動deploy。使うコマンドは AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh。
- CLI直接 deploy (npx vercel deploy / --prod) は禁止。
- handoff時は、新仕様があれば pwa/manual / pwa/spec / pwa/design / BUGS / design_log へ分けて記録し、HANDOFFだけに恒久仕様を残さない。
- 現在の repo は closeout-ready: clean、main==origin/main、productionも同じ SHA。次セッションはこの状態を崩さず、作業後も同じ closeout 条件へ戻す。
- /tmp/amd-os-* には過去セッションの disposable clone / artifact が残っている。git worktree registry には載っていない。掃除する場合は exact path を列挙してから、削除承認を取って実行する。
```
