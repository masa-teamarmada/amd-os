# SESSION MIGRATION PROMPT - H-1 Background Operations

```text
cd /Users/masa/projects/AMD/amd-os

あなたはAMD OSのH-1 MTG抽出・H-1レビューのバックグラウンド運用を引き継ぐ。
今回の目的は、会議情報を漏らさず処理しながら、Codexの可視タスクを増やさないこと。

最初に次の順で読む。

1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/CLAUDE.md
4. /Users/masa/projects/AMD/amd-os/AGENTS.md
5. /Users/masa/projects/AMD/amd-os/HANDOFF_H1_BACKGROUND_2026-07-22.md
6. /Users/masa/projects/AMD/amd-os/pwa/scheduled-tasks/README.md
7. /Users/masa/projects/AMD/amd-os/pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md
8. /Users/masa/projects/AMD/amd-os/pwa/scheduled-tasks/amd-os-l6-meeting-reviewer/SKILL.md
9. /Users/masa/projects/AMD/amd-os/scripts/run-h1-background.sh
10. /Users/masa/projects/AMD/amd-os/scripts/run-h1-reviewer-background.sh
11. /Users/masa/projects/AMD/amd-os/scripts/h1-background-runner-prompt.md
12. /Users/masa/projects/AMD/amd-os/scripts/h1-reviewer-background-runner-prompt.md
13. /Users/masa/projects/AMD/amd-os/pwa/scripts/h1_background_candidate_gate.mjs
14. /Users/masa/projects/AMD/amd-os/pwa/scripts/h1_reviewer_candidate_gate.mjs

rootの `SESSION_MIGRATION_PROMPT.md` はBook A、`HANDOFF.md` はKUTE laneの正本。上書きしない。

## 現在状態

- canonical branchはmain。H-1のaccepted commitは `80b1278e` で、現行mainの祖先に含まれる。
- 旧Codex automation `amd-os-l6-meeting-flow` と `amd-os-h-1-meeting-reviewer` は `PAUSED`。
- 現行実行経路はMac LaunchAgent。H-1は毎時15分、reviewerは毎時45分に `codex exec --ephemeral` を起動する。
- 2026-07-22 15:15 JSTのlive確認で、両LaunchAgentは待機中、直近exit codeは0、completion markerは各1件、実行中background processは0件、未archiveのH-1/reviewer可視taskは0件だった。
- archive済みの `AMD OS L2差分レビュー` 23件は2026-05の履歴であり、現行runner起因ではない。
- H-1変更を含むproductionは `v3.47.13 / b4e66414 / main / dirty=false` まで確認済み。作業開始時は必ず現在のbuild-infoを再確認する。

## 最初の監査

1. `git status -sb --untracked-files=all` を実行し、共有checkoutの他lane差分を特定する。自分の対象以外はstage、revert、整形しない。
2. 旧2 automationのstatusがPAUSEDであることを確認する。
3. `launchctl print` で2 LaunchAgentのstate、runs、last exit codeを確認する。
4. H-1/reviewerのcompletion marker数と未archive可視task数をread-onlyで確認する。
5. `curl -fsS https://amd-os-pwa.vercel.app/api/build-info` でmain/dirty=false/current SHAを確認する。

## 固定ルール

- 可視threadを作らない。thread作成・検索・送信・改題・pin・archive・watchdogはrunner内で禁止する。
- `set_thread_archived` や任意の経過時間を終了制御に使わない。候補gate、対象境界、report確定markerで制御する。
- 候補なしでは本文抽出、横断探索、browser、fixture、prep thread操作を行わない。候補があれば条件に合う全件を扱い、件数上限で落とさない。
- stdout/stderrにraw本文が混ざり得る。永続ログへ残さず一時ファイルを終了時に削除する。hand-offや報告にもraw本文、URL、secretを出さない。
- sanitized reportと台帳が確定してからcompletion markerを書く。markerがあるrunはCLIの後段非0だけで重複起動しない。
- W-Prepのvisible prepは別責務。H-1/reviewerからprep threadを作らない。

## 次の一手

まさから障害・仕様変更の依頼がない限り、実装を増やさない。障害がある時だけ、上の監査で作成経路を確定し、該当するrunner、LaunchAgent、または候補gateへ限定して直す。修正後は実行中task数0、marker、exit code、production build-infoまで確認してcloseoutする。
```
