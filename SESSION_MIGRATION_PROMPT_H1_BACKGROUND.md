# H-1 バックグラウンド運用の再開

作業場所は `/Users/masa/projects/AMD/amd-os`。`pwa/` をセッションの作業場所にしない。

読む順:

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `HANDOFF_H1_BACKGROUND_2026-07-22.md`
4. `AGENTS.md`
5. `pwa/manual/1-1-intro.md`、`pwa/spec/1-3-reconstruction-coverage-audit.md`
6. `pwa/spec/3-3-meeting-flow-current-spec.md`、`pwa/manual/8-3-l2-extraction-routines-spec.md`、`pwa/design/meeting_summaries.md`
7. `scripts/run-h1-background.sh`、`scripts/h1-background-runner-prompt.md`
8. `pwa/scripts/h1_background_candidate_gate.mjs`、`pwa/scripts/h1_notion_metadata_contract.mjs`
9. `pwa/BUGS.md`

状態:

- H-1は可視タスクを作らないMac LaunchAgent運用。旧Codex automationは再開しない。
- 2026-10-14 21:15 JST以降、H-1の定期実行は停止している。2026-11-10時点の連続失敗は39回で、失敗理由は未確認。
- Notionメタデータ補完は、本文を読まず、空欄だけを一意照合で補完し、保存後に同じページを読み戻す。候補0件は正常。
- 現在の診断は終了番号だけで原因行が空になる。認証、CLI、モデル指定、runner内部のどれが原因かは未確認。

次の作業:

1. Gitの最新状態と共有checkoutの未保存差分を確認する。
2. LaunchAgentの登録名、状態、直近終了理由、実行中process、現在のlockを読み取る。
3. Notion接続がOAuthであることを確認し、本文を読まないprobeを1回だけ実行する。
4. probeが失敗した場合は、外部本文・URL・秘密値を残さずに終了理由を診断へ記録するようrunnerを直す。
5. probe成功後にH-1を1回だけ実行し、report、失敗数、Notion巡回カーソルを読み戻す。
6. 古いlock退避物は、実行中processが無いことと再発原因を確認してから個別に整理する。

固定ルール:

- H-1から可視thread、準備thread、日次まとめthreadを作らない。
- 候補、準備済み、反映済み、読戻し済み、見送り、失敗を区別する。
- 失敗時にNotion巡回カーソルを進めない。
- raw本文、URL、秘密値、個人情報を永続ログや引き継ぎへ残さない。
