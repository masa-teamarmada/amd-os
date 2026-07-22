AMD OS の H-1 Meeting Flow をバックグラウンドで実行する。

このrunは `H1_BACKGROUND_RUNNER=1` の非可視バックグラウンドrunで、Codex Desktopのtaskやthreadを作らない。`CODEX_THREAD_ID` を参照・保存せず、threadの作成、検索、送信、改名、pin、archive、watchdog呼び出しを一切行わない。

作業ディレクトリは `/Users/masa/projects/AMD/amd-os-automation-sessions`、AMD OS repoは `/Users/masa/projects/AMD/amd-os`。最初に `/Users/masa/.codex/automations/amd-os-l6-meeting-flow/memory.md` を読む。

候補gateは固定スクリプトが先に終えている。prompt末尾で渡されるgate JSONだけを読む。`calendar.status` が `connector_required` のときだけ、Google Calendar connectorで now-4h から now+24h を**一度だけ**取得してheld/upcoming候補を補完する。Calendarを取得でき、3種類すべて0件なら、対象なしのsanitized report、automation memory、OS通知を確定して終了する。Notion/Gmail/Drive/Slackの本文取得、Drive folder探索、広い設計文書、git status、fixture test、browser、prep thread操作は禁止。通常3分以内に終える。

候補が1件でもある時だけ `/Users/masa/projects/AMD/amd-os/pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md`、repoの `CLAUDE.md` / `AGENTS.md`、候補に必要な正本を読む。SKILLのうちthread marker・archiveに関する指示は、このバックグラウンドrunでは適用しない。Calendar/DB候補の再検索、repo全体検索、即席スクリプト作成は禁止する。

責務境界:
- H-1は開催済みサマリ、recent none recovery、近傍のnew/変更済みupcoming cardだけを扱う。
- visible prep thread、会議ごとのclaim、Notion AI Meeting Notes context挿入、えいみBot nudgeは `w-prep-launch` の専任。H-1はprep threadを作らず、DMも送らない。
- 日次まとめthreadを作成・検索・送信しない。reviewerが未集約reportがある時だけ集約する。
- 対象条件を満たす開催済みMTGはすべて処理する。件数上限で落とさない。

終了:
- raw本文、個人情報、secret、Drive/Calendar URLを出さない短い日本語のsanitized reportを `reports/` とautomation memoryへ保存し、既存 `npm run notify:h1-report` でOS通知する。
- OS通知が成功したら、`/Users/masa/.codex/automations/amd-os-l6-meeting-flow/run_state/background_completed/$H1_BACKGROUND_RUN_ID.json` に `state='reported'` と `reported_at_jst` だけを保存する。これはrunner完了証跡であり、thread idやthread操作は含めない。
- 正常処理を固定時間で打ち切らない。失敗時は原因をautomation memoryへ残す。
