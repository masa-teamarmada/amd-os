## 会社資金繰りの再開文（2026-11-21）

次の共有作業が会社資金繰りなら、先に `SESSION_MIGRATION_PROMPT_COMPANY_CASHFLOW_20261121.md` を読む。詳細正本は `docs/strategy/2026-10-24-company-cashflow-review.md`、状態の要約は `HANDOFF_COMPANY_CASHFLOW_20261121.md`。これは読み取り確認のみで、カード・報酬・会計・外部連絡を変更していない。未追跡の `S01_富士山_日本語.md` は別作業の原稿なので触れない。

---

## 2026-11-21 クローズの再開文

次の共有作業は `SESSION_MIGRATION_PROMPT_CLOSEOUT_20261121.md` を先に読む。作業場所は `/Users/masa/projects/AMD/amd-os`。`main` と `origin/main` は同期している。未追跡 `S01_富士山_日本語.md` は別セッションの原稿で、担当と正本が未確定のため本文を変更・削除・一括保存しない。

---

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


## SOL契約条件の再開文（2026-11-20）

```text
AMD OSのSOL契約条件確認を再開する。作業場所は /Users/masa/projects/AMD/amd-os。

読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/AGENTS.md
4. /Users/masa/projects/AMD/amd-os/HANDOFF_SOL_CONTRACT_TERMS.md
5. pwa/manual/1-1-intro.md → pwa/spec/1-3-reconstruction-coverage-audit.md
6. pwa/spec/5-6-contracts-management-current-spec.md「PJ契約の論点と手続き」→ pwa/manual/6-7-contracts-management-spec.md
7. pwa/design/SPEC_GOVERNANCE.md、pwa/BUGS.md。必要時のみ11月開発履歴。

状態: まさの2026-11-20の指示で一旦終了。SOL「PJ管理 → 契約」の論点・手続き表示は実装babde9f8fで反映済み。今回の終了確認では本番v3.165.28 / 3f182e886が記録前のmain・origin/mainと一致し、元の実装を含む。契約論点の実部品検査も成功。今回の変更は引き継ぎ記録のみ、再公開は不要。最新の実画面・DB・大学の承諾状況は今回再確認していない。

素材と正本: Drive上の260601_請負契約書(260601_270331)_愛媛大学_AMD.PDFを10月8日に読んだ。本文はDrive、短い条項確認結果は契約条件JSON。根拠と識別情報はspec5-6と適用済みmigration492・493。個人情報・再委託は第11条、細則準用は第12条、未定事項協議は第14条を確認。技術・事業情報全般の第三者開示条件、別NDA・仕様書・細則適用版、承認者・承諾形式は当時未確認。

次の依頼の趣旨: 「VCにSOL関連情報を開示するとき、愛媛大の許可が必要か」を、実際の資料と契約から判断できる状態にする。大学由来の非公開情報、公開情報、チームアルマダ独自情報を資料内で特定し、相手VC・目的・資料の版・開示範囲と、適用契約・既存承諾を照合する。契約条項の確認済み表示だけでは個別資料の開示承諾を確認したことにならない。

最初の作業: 再開依頼の範囲を読み、git fetch後の差分と本番を照合する。そのうえで現在の契約原本・関連契約と対象資料を読み取りで確認し、確定条件、確認が必要な相手・事項を根拠付きで提示する。大学やVCへの連絡が必要なら下書きまで。今回の終了依頼から調査・改修・送信を自動再開しない。

運用: main一本、別作業の変更を保持し対象だけ保存する。未追跡のS01_富士山_日本語.mdは今回と関係のない記事原稿。所有者は未特定で本文保持・保存対象外。次の共有作業場所を扱うえいみが、移動・削除・一括保存より前に原稿担当と正本を照合する。適用済み492・493は再実行しない。製品変更時はmanual/spec/附則と他プラットフォーム向け引き継ぎを同期し、対象検査後、正規deploy.shで反映・本番照合する。PCのChromeで確認する。SOL DDは専用ローカル環境で進め、明示的な本番反映指示を待つ。メールは送信せず、権限や共有先も変更しない。
```


## 2026-11-28 支払通知書・月別予定の再開文

```text
AMD OSの支払通知書・月別予定の終了状態から再開する。作業場所は /Users/masa/projects/AMD/amd-os 。

読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/AGENTS.md
4. /Users/masa/projects/AMD/amd-os/HANDOFF_PAYOUT_MONTHLY_PLAN_20261128.md
5. pwa/spec/3-27-payout-notice-current-spec.md → pwa/manual/6-5-admin-payouts-reward-notice-spec.md → pwa/BUGS.md

状態: まさの「閉じておこう」により終了。11/26の月別表の前月表示・実績月集計はe12a5e8e0で反映済み。11/28の終了確認では、後続修正24c568363 / v3.165.33がmain・origin/main・本番で一致した。初期支払月は日本時間の当月。選択した支払月の前月から月別表を表示する。後続の確定額イベントと振込済み控除も保持する。11/26に報告した金額・監査結果は当日の記録であり、現在の金額として転用しない。

作業場所: このチャットの旧パス /Users/masa/.codex/worktrees/f8bd/amd-os は、本体へのシンボリックリンクで復旧済み。独立したGit作業ツリーではない。新しい作業では正規の本体パスを直接使う。旧パスの配下を再帰削除しない。

検証: 終了時に月選択、シーズン集計、確定額上書きの検査が成功。全体構築・ブラウザ・DB更新は終了確認では再実行していない。11/26の実データ監査とPC Chrome確認の所在は専用HANDOFFを参照する。

次の行動: 新しい依頼がある場合だけ再開し、git fetch origin main後に同期・差分と本番を読戻す。数値を調べる場合は対象の支払月・稼働月を分け、通知書・保存支払・member_payout_amount_confirmation_events・実入出金日を照合する。監査スクリプトも後続の確定額イベントを読んでいるか先に確認する。今回の終了依頼から再計算、通知書発行、送付、振込を自動再開しない。

運用: main一本で新しい枝や作業ツリーを作らず、別作業の差分を保持する。既存未追跡のS01_富士山_日本語.mdは別件の記事原稿で、編集・削除・一括保存の対象外。次にその原稿を扱う担当が原稿の正本と保存先を照合する。製品を変更する場合だけmanual/spec/附則を同期し、正規deploy.shで反映・本番確認する。PC Chromeを使い、メールは送信しない。
```
