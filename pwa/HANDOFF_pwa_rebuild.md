# HANDOFF - AMD OS PWA

## 2026-10-04 — ホームのPJリンクとページの戻る/進む

- PJポートフォリオの研究機関PJとシーズPJは、行に紐づくPJコックピットへ直接つなぐ。PJ未登録の候補は元の詳細へ進む。事業会社PJ・各一覧の入口は維持。
- 共通PageHistoryToolbarを社内枠、認可済み共有ワークスペース、DD閲覧に追加。ブラウザの履歴を使う戻る/進むで、Chromeは履歴境界で無効化。本文の通常フローに配置、印刷/ネイティブ/HUD/専用書斎は対象外。DB・権限・BZM/model変更なし。
- TypeScript、変更ファイルのESLint、ホーム導線契約、critical-ui、DD権限/表示契約が成功。Swift/Androidの履歴UIへは未移植。前セッションの未追跡引き継ぎファイルは維持。

| 新仕様/仕様変更 | design正本 | OSマニュアル章 | 状態 |
|---|---|---|---|
| ホームのPJカードからコックピットへ | spec/2-1、design/SPEC_pwa、ios/DESIGN | manual/2-1 | 同期済み |
| 共通の戻る/進むと対象外の専用画面 | spec/2-1、design/SPEC_pwa、ios/DESIGN | manual/2-1 | 同期済み |
| BZM/model | 理論・計算の変更なし | 対象外 | 棚卸し済み |

## 2026-10-04 — コックピット・ワークスペース・DDの並列化

- DDをコックピット・ワークスペースの分類から外し、共通の領域選択へ独立させた。DD閲覧は分類・子タブ・本文、管理は `/project/[id]/dd?tab=manage`。旧DD子タブURLは独立したDDへ送る。
- 本番 v3.152.3 / ce40465a で3入口・DD閲覧・独立した管理をChromeで確認。狭い幅354pxでもDD/ワークスペースの入口が折り返し、横はみ出しなし・高さ44px。モバイル画像取得は縮尺の不具合があるためDOM寸法を補助証跡とし、実機確認済みとは扱わない。画面台帳に残った管理画面の「旧URL」タイトルも独立領域に合わせて修正、旧項目プレビューだけをdeprecatedとして分離。
- DDの付与とPJ所属は独立のまま。公開設定・DB・APIの認可・PDF出力・表示本文の共通部品は変更なし。BZM/modelは理論変更なしのため同期対象外。Swift/AndroidのDD画面は未移植、ブラウザで開く前提。
- 前セッション由来の未追跡 `SESSION_MIGRATION_PROMPT_task_based_pt_20260922.md` は別作業の引き継ぎ資料として維持し、今回のcommitに含めない。
- 検査: TypeScript・新規DD/領域選択部品のESLint・critical-ui・DD権限/表示/分離・標準フォーマット・参照キャッシュ・workspace所属判定・3者表示モデルが成功。追加の旧 `test:project-workspace-route` は前から存在しない `PROJECT_WORKSPACE_GROUPS` を要求して失敗（現行は `WORKSPACE_TAB_FORMATS`）。CockpitView全体のESLintは既存の3つのeffect内setStateで失敗。対象外の既存実装は変更していない。

| 新仕様/仕様変更 | design正本 | OSマニュアル章 | 状態 |
|---|---|---|---|
| 3領域の並列の入口 | spec/3-8・3-16・3-23・5-17、ios/DESIGN | manual/2-3・2-6 | 同期済み |
| DDの分類・子タブ・管理・旧URL | spec/5-17・2-1 | manual/2-6 | 同期済み |
| BZM/model | 理論・計算の変更なし | 対象外 | 棚卸し済み |


## 2026-10-02 — 支払丸め・少額清算の全PJ共通化（以下のSOL限定記述を更新）

- PJ識別子の条件を撤去。202609以降は共通100円切上げ、202610以降は共通1万円以下残高清算。同じ条件なら同じ結果になることを複数PJ・複数月で回帰検査。
- 保護された過去月はsnapshotの支払/未払/未使用枠を維持して未来へ引継ぐ。cycle印のほか保存済み支払と正式通知書を照合し、保存直前の再確認と更新時刻比較を追加。自動更新routeで欠けていた保護列取得も修正。
- 通常の毎日03:05 JST再計算で全PJへ適用。初回も `scripts/refresh_common_payout_policy.mts` が同じsync関数を呼ぶ。--applyは配信SHA照合後、--verify-onlyは読取照合。更新前後/完了はbilling_logへ記録する。120行・10PJの事前検算で保護1行、失敗0、現金変更はp19の3か月のみ（計540円増）。
- manual/7-1、spec/3-14、各附則、ios/DESIGNを同期。共有DB列追加なし。iOS/macOSの独自計算は未移植、共有JSONの値は共通ルールに従う。BZM/modelは支払実務変更なので対象外。UI構造は変更なし。
- 共有checkoutの既存35パスと未push3件は別作業として保持。今回分は最新mainの一時cloneで分離し、他作業を一括commitしない。

## 2026-10-02 — キャップ由来の少額残高を当月支払へ合算

- SOLの202610以降で、通常配分後の現金メンバーの未払合計が税抜1万円以下なら、支払のある当月へ合算する。capゼロ/別財布積立/非現金/丸めだけの端数は除外。他PJへの有効化は未実施。
- 202612計算分のかる80,100円・ちこ54,200円で残高0、最終振込予定2027年3月。今期総額は854,085円/555,990円のまま。適用/読戻しは `scripts/apply_sol_small_balance_20261002.mts`。既定は読取のみ。
- 検査は支払丸めテストに含む。JSONに任意 `smallBalanceSettlementYen` を追加。全プラットフォーム共有DB列変更なし、iOS/macOSの独自計算へは未移植。元の共有checkoutの別作業35パスと未push3件は保持し、今回の変更はmainの一時cloneで分離。
- 正本spec/3-14・ios/DESIGN、使い方manual/7-1、manual/9-3・spec/6-1附則を同期。BZM/modelは支払時期のみで対象外。UIの構造は変更なし。

## 2026-10-02 — SOL未発行報酬の100円切上げ

- 本番v3.147.3 / `38b8ab2d` 配信済み、対象7か月のDB保存済み。`--verify-only` による書込禁止の再計算照合7件成功。本番ちこ画面で支払配分合計555,990円・加算249円・202701配分4,700円・以後残高0を確認。
- 初回保存後の検査はJSONで省略されるundefinedを誤検知して停止したが、全7件の保存は完了していた。比較をJSON正規化＋順序非依存比較に修正し、再書込せず照合済み。`billing_log` のprepared記録は7件あり、初回verified記録は未作成。照合証跡は本項と読取専用検査結果を正本とする。
- まさ依頼でSOLの202609以降だけ切上げ。加算は会社負担、元本cap・獲得pt・発生報酬は維持。発行済み通知書・保存済み支払明細・他PJは非変更。最終月も切上げ、端数だけの後日支払を解消。
- `scripts/apply_sol_payout_round_up_20261001.mts` は読取検算が既定。反映時は配信SHAを `SOL_ROUND_UP_EXPECTED_SHA` へ指定して `--apply`。7か月限定・保護状態確認・変更前後記録・競合検出・再読込検算あり。既適用時は金額を重ねて加算せず同じ計算結果になる。
- 検算値: 切上げ加算はかる253円・ちこ249円、計502円（税抜）。202701計算分でかる6,900円・ちこ4,700円を配分し両者残高0、202702/03の支払は0。実際の振込予定は計算月の3か月後。
- 他プラットフォームは共有JSONの任意加算項目と、現金額が加算込みであることに注意。ネイティブ独自計算・加算表示は未移植。`ios/DESIGN.md` 更新済み。モデル理論・BZMは運用上の端数処理なので対象外。
- 共有checkoutの既存35パスは別作業として保持。未push3件のうちd4d254a7はpatch同等がmainにあり、残り2件は別作業の未反映。rootのahead3/behind301はこの作業で統合せず、元作業担当がデータ調査・理論・Slack/コックピット変更の採否を確認する。今回の作業は最新mainのclean cloneに分離。

| 新仕様/仕様変更 | design正本 | OSマニュアル章 | 状態 |
|---|---|---|---|
| SOLの切上げ・加算と元本残高の分離 | spec/3-14、ios/DESIGN | manual/7-1 | 同期済み |
| 月別の切上げ加算表示 | spec/3-14 | manual/7-1 | 同期済み |
| 理論/モデル | 変更なし | 対象外 | 支払運用のみ |

## 2026-09-30 — シーズン報酬の発生額と支払配分

- `MonthlyAgreementExperience.SeasonRewardTrend` に発生報酬・前月繰越・翌月繰越・振込予定月を常時表示。sourceYmの棒は「支払配分額」。計算・API・DB・合意hash・支払予定は変更しない。
- SOLの報酬減額案はまさが不採用と決定。現行額を維持する。100円単位の切捨てで残る51円等の精算変更は未実施。
- iOS/macOS/Androidへの共有事項: 同等表示を移植する場合も発生額と支払配分、計算対象月と振込月を分ける。共有スキーマ変更なし。
- 検査: `node scripts/check_season_reward_trend.cjs`。`--serve` は認証不要の固定サンプルだけをlocalhost:4319に表示し、本番データを読み書きしない。
- 正本: spec/3-14、manual/2-2。理論・計算は変更なしのためBZMは対象外。
- 検証: 実部品の描画テスト、TypeScript、ESLint、critical-ui、合意差分、支払丸めテストを通過。Chromeで通常幅と390px幅の固定サンプルを確認。視覚レビューは8/10、横スクロールは表内のみ。
- 共有checkoutは着手時ahead 3 / behind 300（origin/main b9e6300）。既存35パスと未push3件は別作業として保持し、本変更はGitHub mainからのclean cloneで分離。共有checkoutの統合は元作業の担当が内容確認後に行う。今回の変更を一括commitに混ぜない。

## 2026-09-26 — SOLの10月以降業務停止・pt配分

- まさが前日にSOL Slackでかる・ちこへ停止を伝えたとの明示指示。新規委託業務は作らず、年明けの自動復帰も設定しない。
- PWA v3.145.9は参画終了月を報酬計算・将来原価・シーズン予実・MS設計ptへ接続する。2人は `is_active=true` を保持して `leave_ym=202609`。定例会は旧行4〜9月3.5pt・かる、新行10〜3月3.5pt・まさ。コスト試算/DDの将来shareは参画期間でまさへ正規化。総MS107pt、予算分母120pt、契約予算は変更しない。
- 実データ適用は `pwa/scripts/apply_sol_participation_stop_202610.mts`。既定は読取検算。`--apply` は `SOL_PT_EXPECTED_SHA` と本番配信SHAの一致が必須。既適用/部分適用時は再実行せず、`milestone_change_events.metadata_json.operation=sol_participation_stop_202610` の `state` と実データを照合する。
- 9月以前のbilling全行と進捗行は非変更。10月以降の報酬だけ再計算し、停止後新規ptゼロ・過去繰越の支払継続・保存値一致を検査する。通知・契約合意・振込は行わない。
- 他プラットフォーム: DB列追加なし。iOS/macOS/Androidの独自計算・終了月表示は未移植。共有正本は `ios/DESIGN.md`、`manual/7-1`、`manual/6-8`、`spec/3-10`。BZM/modelの理論・パラメータは変更なし、同期対象外。manual/spec附則は同時更新。
- 作業は最新origin/mainからの一時clean clone。元checkoutの未push3件・dirty変更は触らない。

- 最終更新: 2026-09-25 JST

## 2026-09-25 追記 — 支払通知書の立替採用

- かるの2026年9月支払通知書から、承認済み立替2件・82,500円が抜けていた。旧8月PDFを削除した後も `reimbursements.billed_ym=202608` が残り、支払済みと誤認したのが原因。取引先請求月である `billed_ym` は支払判定から外し、現存する `payout_notices.reimbursement_ids` を採用済みの正本にした。
- 通知書が消えた立替は締切を満たす支払月の候補へ自動で戻る。別月に現存する通知書へ載った立替は二重計上しない。再生成と送付前の照合は金額と明細IDの両方を見る。報酬0円の立替単独通知書も先回り生成対象に含める。
- PDFの複数月繰越明細は、未払い残があるとき「4〜6月発生分の一部」のように書く。発生期間と今回支払額を混同しない。
- 9月PDFの実物で66,000円の立替摘要末尾が切れていた。PWAからPDFへ渡す摘要は品目を識別できる長さに整え、原文は申請台帳に残す。GASの折り返し修正 (`bb64a25d`) はGitHubへ保存済みだが、Googleの再認証エラーで本番GASには未反映。現行PDFはPWA側の短い摘要で可読性を担保する。
- 9月の正式PDFは2026-09-25に再生成済み。報酬税抜145,575円・消費税14,558円・承認済み立替82,500円・合計242,633円。Drive保存ファイルと通知書のURLが同じID、送付・振込は未実施。GAS廃止の準備としてPWA内PDF描画/Drive保存候補を追加したが、正式発行と送付は未切替。経理アドレス送信の認証と二重送信防止を解決してから切り替える。
- GAS送付を外す候補コードは `src/lib/finance/payout-notice-native-mail.ts`。専用 `PAYOUT_NOTICE_GMAIL_REFRESH_TOKEN` とGmail送信・エイリアス確認の権限が必要。添付PDFはDriveから読み戻し、名前・サイズ・PDF署名を確認する。送付結果不明時の二重送信防止はまだ未接続なので、本番の送付操作からは呼ばない。
- iOS/macOSの立替申請と取引先請求の経路は変更しない。共有DBの列追加・変更はなく、`billed_ym` の取引先請求月としての意味を維持する。PWA支払経路がこの列を書き換えなくなる点だけをネイティブ担当へ伝える。
- 正本: `manual/6-5-admin-payouts-reward-notice-spec.md`、`design/SPEC_pwa.md`、`src/lib/finance/payout-reimbursements.ts`。9月PDFの再生成・金額と明細の読戻し・本番配信版の確認はこの作業の完了確認で行う。

---

- 更新: 2026-09-23 JST
- セッション: SX（p21）の成果物ptを月初合意・検収・報酬へ接続
- 作業種別: development

## 最新セッションの到達点

- 2026年10月以降のSXでは、新しく始まる成果物MSを月割りで先払いせず、完了証跡つきTODOの検収ptを担当者へ配分する仕組みを追加した。定常MS、他PJ、2026年9月以前は従来の計算を保つ。
- 月初合意には担当成果物、見積pt、検収済みpt、支払枠前の見込み額を別々に表示する。未検収の期限到来タスクは翌月の見込みへ持ち越し、月中の検収だけで再合意にしない。
- 検収台帳は担当者別ptの不変スナップショット。PM/PLが自分の担当でない完了済みTODOを検収し、同一MSの並行検収でもpt上限を超えない。SXの8・9月支払保護が無い間はDBが検収を拒否する。
- 実装は `eb2c809a`（main）。正本は `pwa/spec/3-10`、`3-14`、`3-21`、`3-22`、操作は `pwa/manual/2-9` と `7-1`。開発経過は `pwa/design_log/sessions_2026-09.md`。

## 反映・検証

- `ios/supabase/migrations/20260923001000_sx_task_pt_acceptance_ledger.sql` を `pwa/scripts/apply_ddl.py` から本番DBへ適用。2テーブル・検収RPC・不変トリガをDBでreadback済み。Supabase CLIの `db push --dry-run` は既存のmigration履歴差で停止したため、履歴の一括repairはしていない。
- ローカルの成果物ptテスト、月初合意差分テスト、TypeScript、PWA本番ビルド、`deploy.sh --dry-run` の全ゲートを通過。
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` でmainへpush。productionは `v3.145.1` / `eb2c809a32e7d4f0916cbcef4671d6b8f32b8ac2` でReadyを確認。
- 認証済み画面の視覚確認は未確認。ブラウザ連携がエラーになり、Chromeの画面操作も他の利用と競合したため、配信版のreadbackと区別する。

## 未解決

- SXの8月・9月billing cycleに `reward_paid_at` / `payout_notice_uploaded_at` / `payment_confirmed_at` が無い。支払通知書を保護するまで、現行13MSの凍結・10月開始の5MS・担当/期限/見積ptの本番入力はしない。通知発行・送付は別の金銭実務なので、まさの明示指示なしに実行しない。
- 10月の `member_monthly_work_agreements` は未作成。かる・ちこ・まさの実タスク割当、本人画面のreadback、3か月試行の月次承認運用は未完了。個別TODOの検収権限はPM/PLであり、きよとまさの月次二者承認を追加したとは扱わない。
- CLIのmigration履歴差は未解決。repo管理のSQL実体と本番適用済みDDLはあるが、履歴repairを推測で行わない。

## 次の最初の行動

SXの8・9月の支払通知・保護状態を正規の支払画面とDBで再確認する。保護済みになってから、`3-22` §8.1 の旧MS凍結案を保存前支払検算で選び、まさ/PMと10月の成果物・担当・期限・見積ptを1件ずつ決めてOSへ入力する。月初合意を3人の画面で確認し、未検収0pt→検収pt→報酬キャッシュまで突き合わせる。

## Repo状態と参照

- 配信作業はGitHubのmainから作った使い捨てclean cloneで実行。正規checkout `/Users/masa/projects/AMD/amd-os` は最終fetch時に ahead 3 / behind 263、他作業のdirtyあり。未push 3 commitとdirtyには触っていない。正規checkoutの同期は未完了。
- 仕様: `pwa/spec/3-22-goal-tree-plan.md` / `pwa/spec/3-14-monthly-work-agreement-current-spec.md` / `pwa/spec/3-21-question-tree-current-spec.md`
- 操作: `pwa/manual/2-9-question-tree.md` / `pwa/manual/7-1-reward-calc-spec.md`
- 事故・運用: `pwa/BUGS.md` / `pwa/spec/5-2-development-operations-current-spec.md`

### 2026-09-26 実送付添付による月次書式の訂正

SOLの8月実提出はGmail message `1a05810815d1fd13` の3ページ添付。Driveの6ページ別組版との校正結果だけで提出書式一致と判定してはいけない。SOLは既存OSの提出ビューを復元。CXのGmail message `1a066ad161464b16` は日付・時間・従事内容の1枚であり、OS章立て版と別様式。ユーザーの基準選択を待ち、未確認の従事時間を推計しない。ZMPの8月実提出月報は未確認。

従来提出ビューは `submission-sheet` 直下の章要素を維持する。改頁する本文を余分なdivで包むと、Chromeの `box-decoration-break:clone` と組み合わさって後続ページの本文がクリップされる。実際のPDF全ページを確認し、抽出文字だけで合格にしない。
