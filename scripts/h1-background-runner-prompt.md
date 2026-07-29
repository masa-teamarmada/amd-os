AMD OS の H-1 Meeting Flow をバックグラウンドで実行する。

このrunは `H1_BACKGROUND_RUNNER=1` の非可視バックグラウンドrunで、Codex Desktopのtaskやthreadを作らない。`CODEX_THREAD_ID` を参照・保存せず、threadの作成、検索、送信、改名、pin、archive、watchdog呼び出しを一切行わない。

作業ディレクトリは `/Users/masa/projects/AMD/amd-os-automation-sessions`、AMD OS repoは `/Users/masa/projects/AMD/amd-os`。最初に `/Users/masa/.codex/automations/amd-os-l6-meeting-flow/memory.md` を読む。

候補gateは固定スクリプトが先に終えている。prompt末尾で渡されるgate JSONだけを読む。`calendar.status` が `connector_required` のときだけ、Google Calendar connectorで now-4h から now+24h を**一度だけ**取得してheld/upcoming候補を補完する。**Notion/Gmail/Drive/Slackの本文取得が禁止なのは、held/recovery/upcomingの3種類すべてが0件のときだけ**。Calendarを取得でき、3種類すべて0件なら、対象なしのsanitized reportとautomation memoryだけを確定して終了する。**変化がない場合はOS通知を作らない。**

候補が1件でもある時は、その対象会議に限って、記録・ひも付けに必要な範囲でCalendar添付・Notion/Gmail/Drive/Slackの本文取得や関連ソース取得を行ってよい。無関係な候補の探索的な本文取得、Drive folder探索、広い設計文書read、git status、fixture test、browser操作、prep thread操作は候補の有無にかかわらず禁止。通常3分以内に終える。

候補が1件でもある時だけ `/Users/masa/projects/AMD/amd-os/pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md`、repoの `CLAUDE.md` / `AGENTS.md`、候補に必要な正本を読む。SKILLのうちthread marker・archiveに関する指示は、このバックグラウンドrunでは適用しない。Calendar/DB候補の再検索、repo全体検索、即席スクリプト作成は禁止する。

内部制約（connector未接続・権限不足・rate limit等）でソースが取得できない、またはソースが不足していて記録・ひも付けを確定できない場合は、まさの判断が要る内容なら `review_required` を使う。次回scheduled runが自動で再試行できる範囲の一時的な失敗（rate limitの一時超過など）は、そのrunでは通知せずreportとautomation memoryにだけ記録し、後続runに委ねる（=無理に `blocked` にしない）。`blocked` を使うのは、まさが取るべき**具体的な行動**・**直接の対象URL**・**完了条件**の3点がすべて揃っていて、それ以外にまさにできることがない場合だけに限定する。

責務境界:
- H-1は開催済みサマリ、recent none recovery、近傍のnew/変更済みupcoming cardだけを扱う。
- visible prep thread、会議ごとのclaim、Notion AI Meeting Notes context挿入、えいみBot nudgeは `w-prep-launch` の専任。H-1はprep threadを作らず、DMも送らない。
- 日次まとめthreadを作成・検索・送信しない。reviewerが未集約reportがある時だけ集約する。
- 対象条件を満たす開催済みMTGはすべて処理する。件数上限で落とさない。

終了:
- raw本文、個人情報、secret、Drive/Calendar URLを出さない短い日本語のsanitized reportを `reports/` とautomation memoryへ必ず保存する。報告の最初に「H-1は、終わった会議の記録、議事録なしの再確認、前後24時間の予定カード、ノーション議事録のひも付けを整える定期確認」と書く。
- OS通知を作るのは次だけ: 会議記録・予定カード・ノーションひも付けを新規保存または更新した (`updated`)、人の判断が必要 (`review_required`)、必要な処理が止まった (`blocked`)。既存カードの確認だけ、候補なし、変更なしはOS通知を作らない。通知する時だけ `cd /Users/masa/projects/AMD/amd-os/pwa && npm run notify:h1-report -- --outcome "<updated|review_required|blocked>" --run-key "$H1_BACKGROUND_RUN_ID" --body-file <sanitized_report_file>` を使う。
- `--outcome review_required` と `--outcome blocked` はどちらも `--action-required "<まさが取る具体的な行動>"` `--action-url "<直接開くURL>"` `--completion-condition "<何が起きたら完了か>"` の3つが必須。`--action-label` は任意。3つを埋められない状態は`blocked`ではなく`review_required`にする。
- reportを保存し、OS通知が必要な場合はその成功後に、`/Users/masa/.codex/automations/amd-os-l6-meeting-flow/run_state/background_completed/$H1_BACKGROUND_RUN_ID.json` に `state='reported'` と `reported_at_jst` だけを保存する。これはrunner完了証跡であり、thread idやthread操作は含めない。
- 正常処理を固定時間で打ち切らない。失敗時は原因をautomation memoryへ残す。
