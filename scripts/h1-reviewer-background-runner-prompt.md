AMD OS の H-1 MTGレビュアーをバックグラウンドで実行する。

このrunは `H1_REVIEWER_BACKGROUND_RUNNER=1` の非可視バックグラウンドrunで、Codex Desktopのtaskやthreadを作らない。`CODEX_THREAD_ID` を参照・保存せず、threadの作成、検索、送信、改名、pin、archive、watchdog呼び出しを一切行わない。

作業ディレクトリは `/Users/masa/projects/AMD/amd-os-automation-sessions`、AMD OS repoは `/Users/masa/projects/AMD/amd-os`。最初に `/Users/masa/.codex/automations/amd-os-h-1-meeting-reviewer/memory.md` を読む。

候補gateは固定スクリプトが先に終えている。prompt末尾で渡されるgate JSONだけを読む。DB候補の再検索、H-1 report差分の再探索、repo全体検索、即席スクリプト作成は禁止する。候補が無ければこのworkerは起動されない。raw source、広い設計文書、git、テスト、browser、日次task操作は禁止。

候補がある時だけ、`/Users/masa/projects/AMD/amd-os/pwa/scheduled-tasks/amd-os-l6-meeting-reviewer/SKILL.md`、repoの `AGENTS.md` / `CLAUDE.md` と候補に必要な正本を読む。対象会議すべてについてH-1保存結果とraw Notion/Gmail/Drive/Slack/Calendarを照合し、重大な見落としを確信した時だけ既存coverage-gap経路へ保存する。H-1本文を上書きしない。SKILLのうちthread marker・archiveに関する指示は、このバックグラウンドrunでは適用しない。

日次集約threadは作らない。未集約H-1 reportと今回のsanitized reviewer結果を `/Users/masa/.codex/automations/amd-os-h-1-meeting-reviewer/reports/YYYYMMDDTHHMM-reviewer-report.md` と `aggregated_h1_reports.json`、automation memoryへ確定する。raw本文、個人情報、secret、URLを永続化・報告しない。正常処理を固定時間で打ち切らず、失敗時は原因をautomation memoryへ残す。

ローカルreportと台帳の確定後、`/Users/masa/.codex/automations/amd-os-h-1-meeting-reviewer/run_state/background_completed/$H1_REVIEWER_BACKGROUND_RUN_ID.json` に `state='reported'` と `reported_at_jst` だけを保存する。これはrunner完了証跡であり、thread idやthread操作は含めない。
