AMD OS全体最適化を、2026-11-10の現行状態から再開する。作業場所は `/Users/masa/projects/AMD/amd-os`。`pwa/` をセッションの作業場所にしない。

読む順:

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/HANDOFF_OS_GLOBAL_OPTIMIZATION_SX_20261110.md`
4. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
5. `/Users/masa/projects/AMD/amd-os/pwa/manual/1-1-intro.md`
6. `/Users/masa/projects/AMD/amd-os/pwa/spec/1-3-reconstruction-coverage-audit.md`
7. `/Users/masa/projects/AMD/amd-os/pwa/manual/2-3-pj-cockpit.md`
8. `/Users/masa/projects/AMD/amd-os/pwa/spec/3-6-strategy-signals-current-spec.md`
9. `/Users/masa/projects/AMD/amd-os/pwa/spec/3-3-meeting-flow-current-spec.md`
10. `/Users/masa/projects/AMD/amd-os/pwa/spec/3-23-project-workspace-integration-current-spec.md`
11. `/Users/masa/projects/AMD/amd-os/pwa/design/FEATURE_REGISTRY.md`
12. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md`

状態スナップショット:

- 2026-08の全体最適化では、現行SXワークスペースと無関係な共有PJ画面を作ってしまい、削除した。完成済みのPJ管制は正式なワークスペースへ一本化済み。
- コックピットへ追加した「いま動かすもの」と「AMDがいま動かす判断」も削除済み。未評価の柱、未完了62件、過去期限、クリックできない集計を独立表示する案は採用されていない。
- 採用した構造は、同じ `project_management_*` 正本と変更履歴をワークスペースから既存D-6（経営ハイライト）とH-1（議事録）へ渡す方式。保存時にLLMを同期処理として呼ばず、別台帳へ複製せず、件数上限で切らない。
- D-6は経営に効く完了事実だけを通常の候補審査へ通す。H-1は変更履歴を会議文脈として読み、Notion・Gmail・Slack等の会議資料と一致した内容だけを会議結果へ使う。経営ハイライトの根拠から元のワークスペース項目へ戻れる。
- 実装commitは `360d8836a`、当時の本番確認版は `v3.72.29`。2026-10-04にSX専用から全PJ共通へ拡張され、2026-11-10の現行仕様・コードにも残っている。
- このcloseoutでは製品コード、DB、環境変数を変更していない。PWA再配布は不要。現行ソース内の版番号は `v3.165.21`だが、本番URLの版情報はこのcloseoutでは再確認していない。
- 作成前の共有checkoutは `main` / HEAD `69a3f5bff`。別会話のcloseoutが同じcheckoutで進行していたため、次回は必ず取得し直して現在値を確認する。

次タスク:

1. `git fetch origin main`を行い、`HEAD...origin/main`と未送信commitを確認する。遅れがあれば作業前にff-onlyで解消し、別作業の未保存ファイルを混ぜない。
2. PCのChromeでSXのワークスペース、SXコックピット、経営ハイライト、直近議事録を順に開く。スマホ幅のWeb確認は行わない。
3. 実データ1件を選び、ワークスペース上の完了変更→変更履歴→D-6候補またはH-1文脈→採用後の表示→元項目への戻り先までを追う。各段階を、DB保存、候補生成、審査、画面表示、本番反映に分けて確認する。
4. 途中で情報が欠ける場合、その最初の切断点を次の改善対象にする。先に新しいダッシュボード、件数カード、独立ページを作らない。
5. 途切れが無い場合は、SX以外のPJを一つ選び、同じ正本・役割別表示・経営ハイライト・議事録の流れが成立するか確認する。全PJを一度に改修せず、最初の欠損を一箇所ずつ直す。
6. 変更する場合は、利用手順、現行仕様、業務導線、各附則、必要な回帰検査を同じ変更で更新する。PWA変更後は正規の反映スクリプトでmainへ送り、本番の版情報とPC画面を読戻す。

守ること:

- 基本構造は「元の業務データは同じ、利用者ごとに表示・操作・非表示項目が違う」。PJメンバー用ワークスペースとチームアルマダ内部コックピットで別の正本を作らない。
- コックピットへワークスペースの全件一覧をそのまま転載しない。経営ハイライトや議事録など既存の業務成果へ必要な情報だけを、既存審査を通して使う。
- 「未完了N件」のような集計を出す場合は、押した後に全件を確認・更新・完了できることが必要。行動先のない集計は追加しない。
- LLMは意味づけと候補化に使い、保存のたびの同期や正本間コピーには使わない。同期は決定論的な変更履歴と識別子で行う。
- main一本。新しいbranchや作業ツリーを作らない。対象ファイルだけを明示して記録し、`git add .`は使わない。
- PWAはPCのChromeで確認する。まさはスマホではSwift版を使うため、依頼がない限りスマホWeb確認や追加実装は行わない。


## 契約フローの再開文（2026-11-12）

AMD OSの契約フローを再開する。作業場所は /Users/masa/projects/AMD/amd-os。

読む順: /Users/masa/projects/AGENTS.common.md → /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md → HANDOFF_CONTRACT_WORKFLOW.md → AGENTS.md → pwa/spec/5-6-contracts-management-current-spec.md → pwa/manual/6-7-contracts-management-spec.md → pwa/BUGS.md。

2026-11-12の確認では、製品の main と本番 v3.165.23 は b8dcfe4ce で一致。Word/PDF下書き、ファイル選択・ドロップ、版履歴、矢印付き6段階は 0bd15180 で反映済み。実案件の矢印表示は確認済み。独立デザイナー監査と新経路の実Drive保存は未確認。前回の画面証跡は /Users/masa/.codex/visualizations/2026/10/08/01a11a36-1046-7ea0-a1d8-37c5ba39efa9/workflow-evidence-v3/review.md。

まさは一旦休止を指定。再開指示が来たら、まず最新の本番・仕様と保存検証の既存記録を照合する。まだ未確認なら、登録を許可された案件・文書で、PCのChromeからWord下書きの登録→管理部門の契約フォルダの実ファイル→版履歴を確認する。本番の試験契約を捏造しない。承認対象は固定した最終PDF、承認はきよ、押印と締結版照合は別工程。契約メール監視は10月20日に停止済みで、再開しない。適用済みの移行は再実行せず、製品修正が必要ならmainの正規反映手順を使う。

## SOL外部開示の再開用（2026-11-12）

```text
作業場所は /Users/masa/projects/AMD/amd-os。次の順で読む。
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/HANDOFF_SOL_EXTERNAL_DISCLOSURE_20261112.md
4. 上の引き継ぎが指す開示仕様・マニュアル、最後に pwa/BUGS.md

10月の修正はmainと本番へ反映済み。11月12日の本番はv3.165.23、b8dcfe4ceで、記録前の手元mainと一致。検証資料の場所は引き継ぎに記載。未完の実装はない。
再開依頼があれば、最新main・本番・対象の権限を先に照合する。目的は無料のSOL側Slackの履歴保全。AMD社内Slackの保存や共有を戻さず、会議・活動は公開確認済みだけを表示する。削除した人物評価や元の文言を復元しない。
SOL DDの修正は /Users/masa/projects/AMD/SOL/DD_LOCAL_PREVIEW.md の専用環境で行い、まさの明示指示まで本番・配布物・出力ジョブを更新しない。Webの表示確認はPCのChromeで行う。
```
