AMD OSのW-Prep Launchを継続する。作業場所は `/Users/masa/projects/AMD/amd-os`。`pwa/` をセッションcwdにしない。

読む順:

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/HANDOFF_W_PREP_LAUNCH_20260729.md`
4. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
5. `/Users/masa/.codex/automations/w-prep-launch/memory.md`
6. `pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/SKILL.md`
7. `pwa/design/db_schema.md` の `project_meeting_summaries` と `projects`
8. `pwa/scripts/l6_prep_notion_context_gate.cjs`

状態:

- 直近runではCalendarの拡張7日窓を直接照合し、5件のupcomingカードを補完して、12件のvisible prep threadを作成・改名・ピン留め・DB session保存した。
- 最終readbackは `ready=1`、`preparing=12`、`claiming=0`、session id未保存=0。PJ不明の4件は保留であり、推測で無関係PJへ入れていない。
- Gitは `main` / `origin/main` が一致。handoff記録はcommit・push済み。デプロイは不要。
- 現行のroot `HANDOFF.md` と `SESSION_MIGRATION_PROMPT.md` は請求書反映作業のため、この運用作業には使わない。

次タスク:

1. 水曜15:00 JSTのW-Prepで、`now()`から実行日+7日目の23:59:59 JSTまでをCalendarから直接確認する。DBだけを見て完了扱いにしない。
2. 確定MTGでDBに無いものは、色履歴、PJ alias、title alias、active/sales projectsを順に使い、確信できるものだけupcomingカードにする。`colorId=4`（2025-06-01以降）と`SolvioraX`はSX/p21として扱う。
3. `list_projects`は呼ばない。各meetingをclaim→readback→thread作成→改名→pin→DB session保存の順に一件ずつ閉じる。null sessionのclaiming/preparingはCalendar実体とvisible threadを照合し、15分未満は他launcherとしてskip、15分以上でthread不在ならfailedに戻してから再claimする。
4. prep workerには日本語でmeeting識別子とAMD OS参照パスを渡す。targetはPJディレクトリ優先、未確定だけ `/Users/masa/projects/AMD`。prep成果物はHTML、Notion AI Meeting Notes context gateの完了状態がreadyの条件。
5. 終了時はDBで`claiming=0`、対象session保存、visible threadのtitle/pinを確認し、自動化memoryへ時刻・thread id・target・skip/hold理由を追記する。Slack DMは既定で送らず、必要な場合だけ既定のえいみBot scriptを使う。

運用:

- 通常のprep threadは相談モード。まさの明示write intentがない限り、資料・DB・Drive・Notionを更新しない。ただし初回prep工程のNotion AI Meeting Notes context注入は必須。
- 1会議に複数threadを作らない。既存session、canonical event id、同一会議の意図を優先して冪等にする。
- raw本文、個人情報、URL、secretは報告・handoffへ出さない。
