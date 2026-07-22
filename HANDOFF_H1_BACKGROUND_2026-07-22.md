# Handoff - H-1 Background Operations

Last updated: 2026-07-22 JST
Target: `/Users/masa/projects/AMD/amd-os`
Topic: H-1 MTG抽出とH-1レビューを、Codexの可視タスクを増やさずに実行する運用

## Current Truth

- Accepted commit: `80b1278e fix(h1): run hourly workers without visible tasks`。現行mainの祖先に含まれる。
- 旧Codex automation `amd-os-l6-meeting-flow` と `amd-os-h-1-meeting-reviewer` はどちらも `PAUSED`。再開しない。
- H-1とreviewerはMac LaunchAgentから `codex exec --ephemeral` で実行する。H-1は毎時15分、reviewerは毎時45分に起動し、実行対象外の時間帯や候補なしなら早期終了する。
- 実行中の可視H-1/reviewer taskは0件。state DBに残る `AMD OS L2差分レビュー` 23件は2026-05のarchive済み履歴で、現行runnerは作成していない。
- 2026-07-22 15:15 JSTの確認では、両LaunchAgentは待機中、直近exit codeは0、各完了markerは1件、H-1/reviewerのバックグラウンドprocessは0件だった。
- productionはH-1変更を含む `v3.47.13 / b4e66414 / main / dirty=false` まで確認済み。以降の別レーンcommitに伴うproduction SHAは、次の作業開始時に再取得する。

## Design

- 入口は軽い候補gateに固定する。候補なしでは本文抽出、横断探索、ブラウザ確認、fixture、可視thread操作を行わない。
- runner環境変数では、thread作成・検索・送信・改題・pin・archive・watchdogをすべて禁止する。
- raw本文を含み得る標準出力は一時ファイルだけへ出し、runner終了時に削除する。永続ログには状態だけを残す。
- sanitized reportと台帳を確定した後にcompletion markerを書く。CLIがreport確定後に非0で終わっても、markerがあれば失敗扱いで重複起動しない。
- visible prepはW-Prep専任。H-1/reviewerはprep threadを作らない。

## Files

- `scripts/run-h1-background.sh`
- `scripts/run-h1-reviewer-background.sh`
- `scripts/h1-background-runner-prompt.md`
- `scripts/h1-reviewer-background-runner-prompt.md`
- `scripts/launchagents/jp.teamarmada.amd-os-h1-background.plist`
- `scripts/launchagents/jp.teamarmada.amd-os-h1-reviewer-background.plist`
- `pwa/scripts/h1_background_candidate_gate.mjs`
- `pwa/scripts/h1_reviewer_candidate_gate.mjs`
- `pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md`
- `pwa/scheduled-tasks/amd-os-l6-meeting-reviewer/SKILL.md`
- `pwa/scheduled-tasks/README.md`

## Next Action

機能変更は不要。次にH-1/reviewerを調査・変更する時は、まず旧automationがPAUSEDであること、LaunchAgentの直近exit code、completion marker、未archiveの可視task数をread-onlyで確認する。可視taskが再発していた場合は、threadを増やさず、作成経路を特定してからその経路だけを止める。

## Guardrails

- `set_thread_archived` を定期実行の後始末に使わない。可視threadをそもそも作らない。
- 任意の時間しきい値で実行中workerを打ち切らない。候補gate、対象境界、report確定markerで終了を制御する。
- runnerの標準出力、source本文、URL、secretを永続ログやhandoffへ残さない。
- root `HANDOFF.md` は現在KUTE lane、root `SESSION_MIGRATION_PROMPT.md` はBook A laneの正本。H-1作業では上書きしない。
- shared checkoutの他worker差分はstage、revert、整形しない。

## Closeout Snapshot

- branch: `main`
- accepted H-1 commit: `80b1278e`
- worktree: root 1件のみ
- local branch: `main`のみ
- H-1 own dirty: 0件
- shared checkout: 別laneの未commit差分が残るため、repo全体は `do not archive`
