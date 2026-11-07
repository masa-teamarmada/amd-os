# 月初合意の変更点表示 — 再開用プロンプト

このタスクは完了済み。新しい再現可能な不具合、またはまさからの追加変更依頼が出た場合だけ再開すること。

## 最初に読む順

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/HANDOFF_MONTHLY_AGREEMENT_CHANGE_SUMMARY_20261107.md`
4. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
5. `/Users/masa/projects/AMD/amd-os/pwa/manual/1-1-intro.md`
6. `/Users/masa/projects/AMD/amd-os/pwa/spec/1-3-reconstruction-coverage-audit.md`
7. `/Users/masa/projects/AMD/amd-os/pwa/spec/3-14-monthly-work-agreement-current-spec.md`
8. `/Users/masa/projects/AMD/amd-os/pwa/manual/6-6-member-billing-prompts-spec.md`
9. `/Users/masa/projects/AMD/amd-os/pwa/manual/2-2-monthly-routine.md`
10. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md`

ルートの `HANDOFF.md` と `SESSION_MIGRATION_PROMPT.md` は請求書の立替税率に関する別タスクなので、この件の正本として読まない・上書きしない。

## 状態スナップショット

- リポジトリ: `/Users/masa/projects/AMD/amd-os`
- 正本ブランチ: `main`
- 初期実装コミット: `4812e2558`（現行 `main` に統合済み）
- 製品状態: 月初合意の「今回の変更点」表示、再合意条件の限定、変更理由、修正導線まで実装・仕様化済み
- DB migration / Edge Function / 新規環境変数: なし
- 今回のcloseoutでの製品デプロイ: なし（文書だけ）
- 今回実行した回帰検査: `npm run test:monthly-agreement-diff` 成功
- 素材と正本: 上記仕様・マニュアル・テスト。チャット履歴から再発掘しない

## 現行仕様の要点

- `needs_reagreement` のとき、前回合意と今回案の差を「今回の変更点」として表示する。
- 比較表示はメンバー、合計、PJ、MS、受取予定を日本語で示し、変更前と変更後を読める形にする。
- 生のJSONやハッシュはUIへ出さない。
- 保存済みスナップショットがない旧データは従来案内へフォールバックし、推測で差分を捏造しない。
- 再合意が必要になるのは「担当する仕事」または「受け取る額」が変わった場合だけ。監査用の全スナップショット差分を再合意条件へ戻さない。

## 再開条件と次タスク

新しい不具合が出たら、まさの指摘文と対象メンバー・対象月・対象PJ・期待表示・実表示を先に固定する。その後、PC版Chromeで次を順に確認する。

1. 対象行が本当に `needs_reagreement` か。
2. 前回合意スナップショットと今回案が取得できているか。
3. `diffMonthlyAgreementTerms` が担当する仕事・受取額の差を正しく返すか。
4. 監査用の `diffMonthlyAgreementSnapshots` と再合意判定が混同されていないか。
5. 旧データのフォールバックが、生データ表示や空の変更一覧になっていないか。
6. 修正後は `npm run test:monthly-agreement-diff` と対象画面のPC版Chrome確認を行う。

## 守る運用

- cwdは常に `/Users/masa/projects/AMD/amd-os`。`pwa/` をセッションcwdにしない。
- `/Users/masa/projects/AGENTS.common.md` → リポ固有 `AGENTS.md` → manual/spec の順で読む。
- 新しいブランチやworktreeを作らず、`main`で対象ファイルだけを明示stageする。
- 他workerや別タスクのdirty差分を触らない。`git add .` を使わない。
- PWA表示確認はPC版Chromeだけ。依頼されていないスマホWeb確認や端末エミュレーションはしない。
- 仕様を変えたら、該当 `pwa/spec/`、`pwa/manual/`、各変更履歴を同じコミットで更新する。
- PWAを変えたら、変更を束ねて `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` でpush・本番反映監視まで進める。
- 完了報告では、ローカルテスト、GitHub push、本番反映、実画面確認を別々に書く。未確認を成功扱いしない。
