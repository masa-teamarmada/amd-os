# Functions Storage対策の引き継ぎ

更新: 2026-10-06。仕事種別: 開発。範囲: 原因調査、同梱容量の削減、保存期間設定、再発検査。

## 現在地
- 修正ac3866c9はmainと本番に反映済み。最終確認の本番はb6138915/v3.159.19/dirty:falseで修正を含む。後続db51c543は検証記録のみ。
- 文書API168.70→24.13MB、モデル66.61→34.55MB、月報履歴・つくよみ編集74.2→2.01MB（実traceの重複除去後）。PDF生成5routeの必要資材は維持。
- 保存期間は全状態1日。APIのdeploymentsToKeep:10も確認。保持例外を無視して即時整理・3版限定と判断しない。
- 使用量の最終実測はamd-os-pwa10.09GB。超過解消は未確認。手動のdeployment削除、完全消去、課金変更、通知・監視追加なし。
- build・容量検査・日本語PDF・書斎・モデル数式・公開35章200/社内未認証401を確認。資料室contractの既存正規表現検査だけ失敗（未変更の正規checkoutでも再現）。
- 一時cloneと検証serverは片付け済み。自分のコード・文書はpush済み。リポジトリ全体の終了判定は下の別作業を含めて分ける。

## 2026-10-06 再確認
- まさから使用量が10.22GBへ増加したとの報告。これはユーザー報告値で、今回の画面ではグラフが読み込めず独立確認できていない。
- 公開build-infoはv3.160.7/17d15894/dirty:false。ac3866c9の修正とpostbuild容量検査がこの本番commitにも含まれることをGitで確認した。
- Vercel CLIの保存tokenはAPIで403/invalidToken。接続MCPも取得できず、最新保持件数・個別容量・設定の再読戻しは未確認。秘密値を表示せず認証復旧が必要。
- 検収基準の補正: 公式は日次最大保存量を期間合算したGB-monthで集計する。使用量表示の増加だけでは現在の実保存量の増加とは判定できず、整理後に当月累計が下がることも保証できない。「表示が下がるまで待つ」だけでは検証として不足。

## 次の一手
認証復旧後に現在の保持中deployment/alias/保持例外・個別bundle容量と、Usage画面の対象期間・集計指標を別々に確認する。実保存量が上限内で今後も増え続けないことを検収し、すでに計上された期間使用量とは分けて報告する。10.22GBへの増加分の原因と超過解消は未確認。手動削除が必要なら具体的ID・影響を確定してまさへ確認。

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
確認時HEAD=origin/main=db51c543、ahead/behind=0/0、local branch=mainのみ、登録worktree=本体1つ、conflictなし。最新値はfetch/statusで再確認。

| パス | 分類・所有者 | 保持理由・処理 | 次判定・リスク |
|---|---|---|---|
| pwa/scripts/check_dd_package_contract.mjs、pwa/scripts/check_pwa_critical_ui.cjs、pwa/src/app/(app)/project/[projectId]/cockpit/page.tsx、pwa/src/app/(shared-workspace)/project/[projectId]/workspace/page.tsx、pwa/src/app/dd/[slug]/page.tsx、pwa/src/components/cockpit/CockpitView.tsx、pwa/src/components/dd/DdProjectPageBody.tsx、pwa/src/components/project-workspace/SxWeeklyControlDashboard.tsx、pwa/src/lib/dd-package-server.ts、pwa/src/lib/supabase-data.ts、pwa/src/lib/project-page-prefetch.ts、pwa/src/components/project-space/ | other-worker: 「PJポートフォリオの表示を高速化」01a10f1c-985a-7ae3-912b-7817a8adedac | 実装中の3スペース高速化、同activeチャットが検証・commit・pushを継続。今回のcommit対象外 | 同担当終了時にstatus/readback確認。削除すると作業喪失 |
| SESSION_MIGRATION_PROMPT_task_based_pt_20260922.md | preexisting、quarantine owner=まさ/タスクpt移行担当 | 別作業再開資料。内容不変Git保存は以前のKUTE引き継ぎでも判断待ち。今回削除・移動・commitしない | まさの明示判断時。保持は安全、削除は再開資料喪失 |

3区分: safe to remove after approval=なし、send back to owner=上記activeチャットの実装差分（担当が継続中、こちらから送信なし）、needs Masa decision=旧ptプロンプトのGit保存。

今回成果はcommitted success/main aligned。リポジトリ全体はdo not archive（他担当作業中、旧ptプロンプトの保存判断未了）。このチャットを閉じても今回成果はmain・正本md・次セッションプロンプトに残る。会話の検討材料: 0件。
