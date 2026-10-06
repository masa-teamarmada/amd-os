# 資本政策表の情報密度改善 — 2026-10-06

仕事種別: 開発。依頼は実装・本番反映・PC確認まで完了。追加実装の依頼待ち。

## 現在地

実装56c6461d、本番初回bca5c497/v3.159.20。後続f6a0d3a4/v3.159.23にも含まれる。株主1人1行のFD比率・前回比・非ゼロ出資額表示と詳細開閉を本番PCで確認済み。

## 正本と履歴

- 製品仕様: pwa/spec/3-8、3-24、5-17。共通DESIGNとFEATURE_REGISTRYも同期済み。
- 操作説明: pwa/manual/2-3-pj-cockpit.md、変更履歴9-3。
- 変更13ファイル、テスト・ビルド・配信・画面検証: pwa/design_log/sessions_2026-10.md の本件節。
- cloneの依存symlink失敗の教訓: pwa/BUGS.md。
- 次回プロンプト: SESSION_MIGRATION_PROMPT_CAPITAL_PLAN_DENSITY_20261006.md。共通入口SESSION_MIGRATION_PROMPT.mdにも同文を保存。
- 別担当SOL DDの既存プロンプトは内容不変でSESSION_MIGRATION_PROMPT_SOL_DD_20261006.mdへ保全。

## 次の一手

追加の見た目の指摘が来たら共通ルール→現行spec→本番PCを確認して修正する。数値・未確定ラウンド条件の更新は今回の対象外。ネイティブ変更なし。

## closeout境界

- 本件のbranch/worktree作成0。確認用clone /tmp/amd-os-capital-density-20261006 は検証履歴保存と統合確認後に削除する。
- 共有mainのCapitalPlanWorkspace.tsx、capital-plan.ts、capital-plan-issue-action.tsは別担当。保持理由は資本政策の進行中修正。確認担当は次の共有main作業者、判定条件は担当の受入・コミット時。削除・一括stageは実装消失の危険がある。
- 旧未追跡SESSION_MIGRATION_PROMPT_task_based_pt_20260922.mdは「SOLのDDパッケージ不足を洗い出す」（01a107d5-ee58-78c2-9c87-942ea2286f50）のcloseoutで保存可否確認中。返答後に同担当が処理する。本件で無断処理しない。
- 本件はmain aligned。共有repo全体は上記並行作業と確認待ちがあるためdo not archive。追加の対話証拠0件（製品設計はrepo正本へ保存）。
