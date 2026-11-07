# HANDOFF - W-Prep Launch 2026-07-29

- 更新: 2026-07-29 JST
- 作業種別: non-development project work / automation operation
- 正本: `/Users/masa/.codex/automations/w-prep-launch/memory.md`
- `design_log/`: 未更新。今回の作業は実装履歴ではない。

## 現在地

- 拡張7日窓のGoogle Calendarを直接照合し、確定MTGのうち既存のカードがない5件を `project_meeting_summaries` にupcomingとして作成した。
- 12件のvisible prep threadを作成、改名、ピン留めし、それぞれのsession idをDBへ保存した。既存の1件はすでにreadyだったため重複起動していない。
- 最終DB readbackは `ready=1`、`preparing=12`、`claiming=0`、session id未保存=0。PJを確定できない4件は保留のままにした。
- Slack DMは送っていない。個別prepの内容・資料・Notion contextの以後の作業は各visible prep threadが担当する。

## Git状態

- `main` HEAD `2b813db63` は `origin/main` と一致。
- このhandoff作成前は未コミット・未追跡差分なし。今回のhandoffファイルだけをcommitしてpushする。
- 本作業はプロダクト変更・デプロイ対象ではない。main impactはhandoff記録のみ。

## 未解決

- 保留4件はPJのactive/sales対応を確定できていない。PJ確定後にだけupcomingカード作成とprep launchを再評価する。
- 次の週次起動時は、同じ拡張7日窓をCalendarから直接照合し、null sessionのclaimを起動済みとみなさない。

## 最初の次作業

1. `/Users/masa/.codex/automations/w-prep-launch/memory.md` の最新run記録を読む。
2. Calendar直読みによる対象抽出、DBカード補完、meeting単位のclaim-readback、visible thread作成・改名・ピン留め・session保存を一件ずつ完結する。
3. 最後にDBで `claiming=0` と対象行のsession保存を確認し、memoryへ実績と保留理由を追記する。

## 参照先

- 自動化の実績と保留理由: `/Users/masa/.codex/automations/w-prep-launch/memory.md`
- workerの実行契約: `pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/SKILL.md`
- DB正本: `pwa/design/db_schema.md`
- 既存のroot `HANDOFF.md` と `SESSION_MIGRATION_PROMPT.md` は請求書反映作業のものなので変更していない。
