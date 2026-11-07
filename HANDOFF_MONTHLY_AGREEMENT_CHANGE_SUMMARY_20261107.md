# 月初合意の変更点表示 — 完了記録

- 最終更新: 2026-11-07 JST
- 仕事種別: development
- 状態: 完了。継続作業なし

## 現在地

- 月初合意が `needs_reagreement` のとき、前回合意と今回案の差を「今回の変更点」として表示する実装は `main` に入っている。
- 表示対象は、メンバー、合計、PJ、MS、受取予定。保存済みスナップショットがない旧データでは従来の案内へフォールバックする。
- UIには生のJSONやハッシュを出さず、日本語の項目名と変更前・変更後を表示する。
- 再合意が必要になる条件は「担当する仕事」または「受け取る額」の変更に限定済み。全スナップショット差分は監査用途であり、再合意判定には使わない。
- 初期実装コミット `4812e2558` は現行 `main` に含まれる。その後の再合意条件の限定、変更理由、修正導線も現行仕様へ統合済み。

## 正本

- 仕様: `pwa/spec/3-14-monthly-work-agreement-current-spec.md`
- メンバー向けマニュアル: `pwa/manual/6-6-member-billing-prompts-spec.md`
- 運用マニュアル: `pwa/manual/2-2-monthly-routine.md`
- 仕様変更履歴: `pwa/spec/6-1-spec-changelog.md`
- マニュアル変更履歴: `pwa/manual/9-3-appendix-changelog.md`
- 回帰検査: `pwa/scripts/check_monthly_agreement_diff.mts`

## 今回のcloseout確認

- `npm run test:monthly-agreement-diff` を実行し、次の3項目が成功した。
  - `monthly-work-agreement-diff regression: ok`
  - `expected-reward change explanation: ok`
  - `agreement terms diff: ok`
- 製品コード、DB、環境変数、API、画面仕様の追加変更はしていない。
- 本番画面の再確認と再デプロイは今回実施していない。文書closeoutだけなので不要。

## 未解決タスク

なし。新しい再現可能な不具合が出た場合だけ再開する。

## 再開時の最初の行動

`SESSION_MIGRATION_PROMPT_MONTHLY_AGREEMENT_CHANGE_SUMMARY_20261107.md` の読む順に従い、PC版Chromeで再現条件を固定してから、仕様・実装・保存済みスナップショットのどこで差が生じたかを切り分ける。

## 別件との境界

ルートの `HANDOFF.md` と `SESSION_MIGRATION_PROMPT.md` は、請求書の立替税率に関する未完了タスクの引き継ぎ。今回の完了記録では上書きしない。
