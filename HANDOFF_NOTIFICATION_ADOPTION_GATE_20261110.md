# 通知の最終採否ゲート 引き継ぎ

- 更新: 2026-11-10 JST
- 仕事種別: development
- 状態: 設計・実装・正本反映・本番反映済み。既存Codex automationは現在停止中

## 完了済み

- `/notifications` の主目的を、L2候補をOS正本へ採用するか不採用にするかの最終判断へ戻した。
- 既存automation id `amd-os-proactive-heartbeat` をその最終レビューownerにし、別automationは作っていない。
- 候補は追加先、変更内容、採用結果、不採用結果、安全なfeedback処理が揃う場合だけ表示対象になる。
- TODO、本人作業、会議記録、復旧、情報共有、結果報告は採否通知へ出さない。
- MTG prepはCodex内で完結し、先手TODOへ複製しない。先手TODOと採否通知は別の面として維持する。
- provider APIや従量課金トークンは使わず、意味レビューはCodex automation自身が行い、DB書込みはvalidator/applierへ限定する。
- 2026-11-10、実行正本に残っていた廃止済み`CLAUDE.md`参照をrepo `AGENTS.md`へ訂正した。製品挙動・DB・画面は変更していない。

恒久仕様は `pwa/spec/3-7-notifications-current-spec.md`、`pwa/spec/2-4-proactive-todo-current-spec.md`、`pwa/spec/5-3-automation-responsibility-current-spec.md`。利用・設計の説明は `pwa/design/notifications.md` と `pwa/scheduled-tasks/amd-os-proactive-heartbeat/SKILL.md` にある。実装履歴は `pwa/design_log/sessions_2026-08.md` の2026-08-12節。

## 現在の外部状態

- automation id: `amd-os-proactive-heartbeat`
- 表示名: `10〜20時毎時 採否判断の候補をレビューする`
- 設定頻度: 10:15〜20:15 JSTの毎時
- 通知方針: failed runs only
- 2026-11-10 readback: `status = PAUSED`

停止理由と停止日時の経緯は未確認。まさの明示なしに再開しない。

## 未解決

- automationを再開するかは未決。再開時は、停止理由を確認してから同じ既存automationだけを有効化する。
- 再開後の最初の自然実行で、候補0件なら通知を作らないこと、候補がある場合は最終採否カードだけが作られること、Slack・メール・Notion・Driveへ書かないことをread-onlyで確認する。

## 次回の最初の行動

1. Gitを最新化し、上記の正本とautomation設定をreadbackする。
2. `PAUSED`の理由を確認し、まさが再開を望む場合だけ既存automationを再開する。
3. 最初の自然実行を監査し、入力件数・approved件数・needs_source件数だけを確認する。候補本文や個人情報は報告しない。

## リポジトリ状態

- closeout記録直前: `main`、HEAD `69a3f5bff`、`origin/main` と一致。
- このcloseoutで変更するのは、この引き継ぎ、再開文、実行正本の廃止済み`CLAUDE.md`参照訂正だけ。
- PWAコード、DB、Vercel、Supabase、automation設定そのものは変更しない。

## 参照先

- 採否通知仕様: `pwa/spec/3-7-notifications-current-spec.md`
- 先手TODOとの境界: `pwa/spec/2-4-proactive-todo-current-spec.md`
- automation責務: `pwa/spec/5-3-automation-responsibility-current-spec.md`
- 設計説明: `pwa/design/notifications.md`
- 実行正本: `pwa/scheduled-tasks/amd-os-proactive-heartbeat/SKILL.md`
- 実装履歴: `pwa/design_log/sessions_2026-08.md`
- 既知の不具合・教訓: `pwa/BUGS.md`
