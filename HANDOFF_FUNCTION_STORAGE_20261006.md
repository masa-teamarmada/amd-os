# Functions Storage対策の引き継ぎ

更新: 2026-10-06。仕事種別: 開発。範囲: 原因調査、同梱容量の削減、保存期間設定、再発検査。

## 現在地
- 修正ac3866c9はmainと本番に反映済み。最終確認の本番は17d15894/v3.160.7/dirty:falseで修正を含む。
- 文書API168.70→24.13MB、モデル66.61→34.55MB、月報履歴・つくよみ編集74.2→2.01MB（実traceの重複除去後）。PDF生成5routeの必要資材は維持。
- 保存期間は全状態1日。APIのdeploymentsToKeep:10も確認。保持例外を無視して即時整理・3版限定と判断しない。
- 使用量はチーム10.22GB、amd-os-pwa10.09GB、他PJ約127MB。旧版23件はまさの明示承認後に通常削除済み。正常保持版26→3、現行4aliasと復旧2版を保護。完全消去・課金変更・通知・監視追加なし。履歴使用量の超過表示解消・物理容量の解放時点は未確認。
- build・容量検査・日本語PDF・書斎・モデル数式・公開35章200/社内未認証401を確認。資料室contractの既存正規表現検査だけ失敗（未変更の正規checkoutでも再現）。
- 一時cloneと検証serverは片付け済み。自分のコード・文書はpush済み。リポジトリ全体の終了判定は下の別作業を含めて分ける。

## 2026-10-06 再確認と追加対策
- CLIログインでAPI認証を復旧。保持40件（READY26/CANCELED14）は全て当日作成。1日保存の期限前だった。
- 同一期間のUsage内訳を画面で確認: チーム10.22GBに対しAMD OS単体10.09GB。他PJは約127MB。以前の単体値と今回のチーム値を比較していた点を訂正。画面表示Last 30 Days/Sep 6 3:00–Oct 6 3:00。
- まさの明示承認後、FUNCTION_STORAGE_CLEANUP_PLAN_20261006.mdの23IDだけ通常削除。各回に対象project/READY/現在aliasなし/直近正常3版以外を検査。23件のDELETED応答と一覧からの除外を確認。残存17件（READY3/CANCELED14）。
- 最新dpl_7KH3Q7go4wmLUD3qJaaQ2nN9Hb4yの4aliasは維持。直近復旧候補dpl_FqPBGtuVRodQKWfNSpbcTnddUVCA、dpl_5wcS2PPJNY8uhNZWuUMKCsKBtwFUも維持。
- 公開build-info v3.160.7/17d15894/dirty:false、manual/spec/bzm API未認証401を削除後に確認。Vercel Resourcesでは文書API20.3MB、月報履歴/編集20.3MB。ローカルtraceはroute単位、Vercel表示はgroup単位なので値を同一視しない。
- 全状態1日設定をAPIで再読戻し。公式のGB-monthは日次最大保存量の期間合算。削除後も過去期間のAMD10.09GBは同値で、表示の即時低下や物理解放完了は確認できない。Today表示0Bも現在物理容量の証拠にはしない。

## 残る検収
容量を膨らませる同梱原因の修正・ビルド容量ゲート・1日保存・既存旧版23件の整理は実施済み。Vercelの集計に整理後の日次値が入った時に期間/単位を揃えて確認する。現在のAPIに個々の物理保存容量は出ないため、10.22GB表示の即時解消を約束しない。多数デプロイは1日保存期間内でも一時的に積み上がる。今回の削除承認を将来の定期削除・完全消去への許可として扱わない。

## 正本と検証記録
- 実装仕様: pwa/spec/5-2-development-operations-current-spec.md「Function保存容量の抑制」
- 使い方: pwa/manual/9-2-developer.md、変更履歴manual/9-3・spec/6-1
- 検査: pwa/scripts/check_function_bundle_storage.mjs（package.json postbuild）
- 原因・事故防止: pwa/BUGS.md「Function保存容量が上限超過」
- 開発履歴: pwa/design_log/sessions_2026-10.md「Function保存容量の抑制」
- 次セッション全文: SESSION_MIGRATION_PROMPT.md
- 他のPWA作業: pwa/HANDOFF_pwa_rebuild.md。既存履歴は別担当との共有のため今回一括再編しない。

## 同期ゲート
| 項目 | 仕様 | OSマニュアル | 状態 |
|---|---|---|---|
| 文書/PDFの同梱と容量ゲート | spec/5-2・6-1 | manual/9-2・9-3 | 同期済み |
| 保存期間・未確認量の扱い | spec/5-2 | manual/9-2 | 同期済み |
| ネイティブ・DB・GAS・モデル・画面名 | 変更なし | 対象外 | 対象外 |

## 共有checkoutの所有・終了判定
今回着手時HEAD=origin/main=d715e8f2、ahead/behind=0/0、local branch=mainのみ、登録worktree=本体1つ、conflictなし。最新値はfetch/statusで再確認。

| パス | 分類・所有者 | 保持理由・処理 | 次判定・リスク |
|---|---|---|---|
| pwa/scripts/check_dd_package_contract.mjs、pwa/scripts/check_pwa_critical_ui.cjs、pwa/src/app/(app)/project/[projectId]/cockpit/page.tsx、pwa/src/app/(shared-workspace)/project/[projectId]/workspace/page.tsx、pwa/src/app/dd/[slug]/page.tsx、pwa/src/components/cockpit/CockpitView.tsx、pwa/src/components/dd/DdProjectPageBody.tsx、pwa/src/components/project-workspace/SxWeeklyControlDashboard.tsx、pwa/src/lib/dd-package-server.ts、pwa/src/lib/supabase-data.ts、pwa/src/lib/project-page-prefetch.ts、pwa/src/components/project-space/ | other-worker: 「PJポートフォリオの表示を高速化」01a10f1c-985a-7ae3-912b-7817a8adedac | 実装中の3スペース高速化、同activeチャットが検証・commit・pushを継続。今回のcommit対象外 | 同担当終了時にstatus/readback確認。削除すると作業喪失 |
| SESSION_MIGRATION_PROMPT_task_based_pt_20260922.md | preexisting、quarantine owner=まさ/タスクpt移行担当 | 別作業再開資料。内容不変Git保存は以前のKUTE引き継ぎでも判断待ち。今回削除・移動・commitしない | まさの明示判断時。保持は安全、削除は再開資料喪失 |

3区分: safe to remove after approval=なし、send back to owner=上記activeチャットの実装差分（担当が継続中、こちらから送信なし）、needs Masa decision=旧ptプロンプトのGit保存。

今回成果はmainに保存。表の他担当差分はその後担当が反映済みで、今回の終了時にtracked差分なしを再確認する。旧ptプロンプトは別作業資料としてそのまま保持する。このチャットを閉じても今回成果はmain・正本md・次セッションプロンプトに残る。会話の検討材料: 0件。
