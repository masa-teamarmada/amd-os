# HANDOFF - AMD OS PWA

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
