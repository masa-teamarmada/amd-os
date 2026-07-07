# SESSION MIGRATION PROMPT - AMD OS MTG card ghost fix

```text
cd /Users/masa/projects/AMD/amd-os

読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. HANDOFF.md
4. pwa/spec/3-3-meeting-flow-current-spec.md
5. pwa/spec/2-4-proactive-todo-current-spec.md
6. pwa/manual/2-3-pj-cockpit.md
7. pwa/BUGS.md
8. pwa/design_log/sessions_2026-07.md の "2026-07-08 — MTGカード 予定/準備/日程未確定 亡霊解消"
9. CLAUDE.md / pwa/CLAUDE.md

状態スナップショット:
- MTGカードの「準備/日程調整中」亡霊修正は完了済み。
- production: https://amd-os-pwa.vercel.app
- implementation build-info before handoff docs push: v0.39.7 / 80cd1fe557282e8bced855c60426735aab62de90 / dirty=false
- after handoff closeout, /api/build-info may show a later docs-only commit on top of v0.39.7. Re-check the endpoint for exact current SHA.
- accepted commits:
  - bec4159810c59f76f4fe115ce7c14e65dfb66f32: fix(pwa): clear stale meeting prep ghosts
  - 80cd1fe557282e8bced855c60426735aab62de90: fix(pwa): fold undated meetings into schedule list
- まさ確認済み: 2026-07-08「調整中なくなった」。
- 作業は /tmp/amd-os-mtg-ghost-fix-1783401569 の clean disposable clone で実施。canonical checkout /Users/masa/projects/AMD/amd-os は preexisting dirty / ahead / behind が多いので current truth としてそのまま信用しない。

今回の仕様:
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
- 基本的にはなし。MTG-card ghost fix は完了。
- もしまた「残ってる」と言われたら、まず画面左上 version と /api/build-info が v0.39.7 以上か確認する。
- そのうえで該当 row の project_meeting_summaries を読む。確認順は source_kinds / meeting_id prefix / meeting_start_at / calendar_event_id / prep_status / generated_by_model。
- 推測でDB rowを削除・上書きしない。まず表示predicateのどこに入ったかを分類する。

運用ルール:
- /Users/masa/projects/AGENTS.common.md を最初に読む。
- AMD OSでは main push が本番deploy。PWA変更時は build version を bump し、AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh で push/build監視まで進める。
- branch は作らない。dirty は branch/worktree 作成理由にしない。必要なら clean disposable clone で対象差分だけ扱う。
- git add . は使わない。対象ファイルだけ stage。
- canonical checkout /Users/masa/projects/AMD/amd-os の preexisting dirty/branch debt はこの修正と混ぜない。cleanupするなら専用closeoutで証跡保存・分類してから。
```
