# H-1 バックグラウンド運用 引き継ぎ

- 更新: 2026-11-10 JST
- 仕事種別: development
- 対象: H-1 MTG抽出、予定カード、Notion議事録メタデータ補完
- 状態: 恒久仕様と実装はmainに存在するが、定期実行は2026-10-15以降停止中

## 現在地

- H-1はMac LaunchAgentから `codex exec --ephemeral` を起動し、可視タスクを作らずに処理する。旧Codex automationは再開しない。
- Notion議事録の `eventId` / `PJ` / メンバー / `日付` 空欄は、本文を読まず、全履歴を25件ずつ巡回する。最大8ページを走査し、次回カーソルを保存する。末尾到達時は周回数を増やして先頭へ戻る。
- 空欄値だけを補完し、既存値は上書きしない。メンバーは既存relationを保持した和集合だけ。Calendar・PJ・AMDメンバーを一意に照合できない項目は書かない。書込み後は同じページを再取得して確認する。
- 2026-08-19にCLI側Notion OAuthを完了し、CLI接続とH-1本体の成功、25件走査、次回カーソル保存を確認した。
- 2026-10-14 21:15 JSTまで定期実行は成功。全履歴巡回は30周まで進み、最後の正常runは空欄候補25件を確認して補完0件だった。
- 2026-10-15 09:15 JST以降は定期実行が連続失敗。2026-11-10 09:15 JST時点で安全状態は連続失敗39回、最後のreportは2026-10-14のまま。
- 現行の失敗診断ファイルは `exit=1` だけで、原因行が空。原因は未確認。認証切れ、CLI起動、モデル指定、runner内部失敗を推測で決めない。
- `run_state` には古い `background.lock.stale.*` が多数残る。削除前に、実行中processがないことと再発原因を通常Mac環境で確認する。

## 次回の最初の作業

1. 通常のMac環境でGitを最新化し、`main` と `origin/main`、未送信記録、共有checkoutの未保存ファイルを確認する。
2. LaunchAgentの登録名をplistから確認し、state / runs / last exit codeを読む。実行中H-1 processと現在のlockを確認する。
3. `codex mcp list` でNotionが `OAuth` になっていることを確認し、本文を読まない `--probe` を1回だけ実行する。
4. probeが失敗したら、raw本文を残さず、CLIの終了理由を診断ファイルへ確実に残すようrunnerを直す。空の診断を成功扱いしない。
5. probe成功後にH-1を1回だけ実行し、report作成、失敗数のリセット、Notion巡回カーソル更新を読み戻す。
6. 古いlock退避フォルダは、実行中processがないことと再発防止を確認してから、安全な個別対象として整理する。

## 固定ルール

- 可視thread、prep thread、日次まとめthreadをH-1から作らない。visible prepはW-Prep専任。
- 会議候補0件でもNotionメタデータ空欄scanを行ってから終了を判定する。
- Notion空欄scanだけのrunでは議事録本文、メール本文、Drive本文、Slack本文を読まない。
- raw本文、URL、秘密値、個人情報を永続ログ、report、handoffへ残さない。
- candidate / prepared / applied / readback_verified / skipped / failedを分ける。補完0件は正常。
- 失敗時はNotion巡回カーソルを進めない。
- まさの判断や操作が不要な更新・変更なしではOS通知を作らない。

## 正本と実装

- 現行仕様: `pwa/spec/3-3-meeting-flow-current-spec.md`
- 利用・運用: `pwa/manual/8-3-l2-extraction-routines-spec.md`
- 詳細設計: `pwa/design/meeting_summaries.md`
- 候補gate: `pwa/scripts/h1_background_candidate_gate.mjs`
- Notion補完契約: `pwa/scripts/h1_notion_metadata_contract.mjs`
- runner: `scripts/run-h1-background.sh`
- runner指示: `scripts/h1-background-runner-prompt.md`
- 回帰検査: `pwa/scripts/check_h1_background_contract.mjs`、`pwa/scripts/check_h1_notion_metadata_contract.mjs`
- 不具合記録: `pwa/BUGS.md`
- 再開文: `SESSION_MIGRATION_PROMPT_H1_BACKGROUND.md`

## リポジトリ状態

- この引き継ぎ、不具合記録、再開文は2026-11-10のcloseoutでmainへ記録する。
- 次回は作業前に `git fetch origin --prune` を行い、mainと共有先の一致、未送信記録、未保存ファイルを確認する。
- H-1以外の未保存ファイルは、所有する作業ごとに扱う。このH-1引き継ぎを更新するために編集・削除・stageしない。
- このH-1 closeoutで新しいbranch / worktreeは作っていない。
