# KUTE月報・共通ヘッダーの引き継ぎ

更新: 2026-10-06 JST。仕事種別: mixed。業務判断はKUTE、開発仕様はAMD OSへ分離。

## 到達点
- KUTE月報の事実訂正とカレンダーは ../kute/docs/MONTHLY_REPORT_REVISION_20261004.md が正本。
- 月報の操作集約、PDFボタン撤去、保存後の両Drive自動配置・PDFだけ再試行を実装済み。
- 日本時間24日まで前月/25日から当月を初期表示。PJメンバー表示を外し3領域ナビをヘッダーへ統合。
- 恒久仕様: pwa/spec/3-2-monthly-reports-current-spec.md、3-8-cockpit-current-spec.md。
- OSマニュアル: pwa/manual/4-8-ms-progress-monthly-report-revision-spec.md、2-3-pj-cockpit.md。API/権限はmanual/9-3-api-reference.md・spec/6-1-api-current-spec.md。
- 開発履歴: pwa/design_log/sessions_2026-10.md。不具合・途中で捨てた実装はpwa/BUGS.md。

## 配信と検証
- 実装commit: 811de384〜d1155664（月報UI/PDF）、ecab9a16（初期月/共通ヘッダー）。他作業の9485bfdeと共にmainへ統合・配信。
- 本番v3.159.9 / SHA 9485bfde88ebaca658528c565a40d26d22e9788dをbuild-infoで読戻し確認。後続文書commitは画面を変えない。
- 日本時間境界12ケース×TZ=UTC/America/Los_Angeles/Asia/Tokyo、型検査、変更対象lint、本番build成功。
- 実コンポーネントの静的描画: PC1440でヘッダー45px、スマホ375/390で117.5px、リンク44px・横overflowなし。
- 実Linux PDF全頁を画像検収。OS StorageのSHA・共有Driveのsize/md5と本文/履歴不変を読戻し。
- 未確認: ログイン後の実クリック。Chrome request-header policy読込エラー、IABはGoogleパスワード画面で停止し自分のタブを閉じた。API・静的描画成功と区別する。
- 適用済みmigration: ios/supabase/migrations/20261004172000_monthly_report_pdf_record.sql。再適用しない。

## 最新PDF
- 提出版: OS workspace UUID 01ff2fbd-88c3-4d70-b69e-7552d964d461、共有Drive ID 1XjWJXhE3Vnkd7VuMBE99LRhtV8nqQ2TA、5頁・1655068 bytes。
- 社内版: OS workspace UUID b7a273e9-e4d3-4b24-aa95-4604b721f469、共有Drive ID 1IN8pVBB-puEKKjQc0cuCSgiKdjVqcJyV、10頁・2260928 bytes。
- private OS Storage・既存DriveのID/場所/権限を維持。提出版SHA e8d6857d22ab71f7774abab0300d81762a96b22060d2c954f6698eb41599d5ce、社内版SHA 22bf762bcbb5d3eef2d48766254f5a8d515e73cf51b991e72b08ce54bc3089f5。

## 次の行動と終了状態
- 最初にfetch/status/build-infoと現行本文を確認。認証済み画面が使える場合に実操作を検証する。
- 新宿企画書は未作成。業務の次行動はKUTE専用HANDOFFへ。
- branch/worktree作成ゼロ。自分の開発差分はpush済み。引き継ぎ文書は0dfa2cdfでmainへpush済み（画面変更なし、skip ci）。local main=origin/main、ahead/behind 0。conflictなし。
- 既存未追跡 SESSION_MIGRATION_PROMPT_task_based_pt_20260922.md は別作業の未完引き継ぎ。所有=タスクpt移行担当/まさ、保持。内容を変えずGit保存するか、まさへ確認中。判断条件=明示回答。無断で削除・移動・stash・今回commitしない。残る場合do not archive。
- 自分のdev server/ブラウザタブは終了。検証用/tmp画像/PDFはローカル診断控えとして保持、認証ファイルauth.json/production.envは削除済み。
- 会話の検討材料は0件。既存の別案件HANDOFFと旧プロンプトは保持。
- 終了中に別チャット「左メニューを三点リーダー化」（01a10d16-952b-7d60-a3cf-e683d1b22a3e）が同じcheckoutで実装を開始。pwa/srcのcockpit/dashboard/nav/project-workspaceおよびDD関連の変更は同チャット所有、こちらでstage/削除しない。同チャットがmainへ保存・配信するのが次の責任。新しい左メニュー仕様を古いヘッダーへ戻さない。

## Dirtyの担当と具体的な処置
| 対象 | 分類・所有者 | 処置・次の判定 | リスク |
|---|---|---|---|
| pwa/src/app/dd/、globals.css、components/cockpit/CockpitView、dashboard、dd、nav、project-workspace、lib/build-info（終了確認時16変更+新規nav3ファイル） | other-worker: 左メニューを三点リーダー化 01a10d16-952b-7d60-a3cf-e683d1b22a3e、active | 同チャットが検証・main保存・配信。こちらは触らない。次判定=同チャット終了時のstatus/build-info | 中: 一括stageすると未検証UIが混入 |
| SESSION_MIGRATION_PROMPT_task_based_pt_20260922.md | preexisting: タスクpt移行担当、quarantine owner=まさ | 内容不変でGit保存するか質問済み、次判定=まさの明示回答。回答まで保持 | 低: 別作業の再開資料、削除すると喪失 |

- safe to remove after approval: なし。
- send back to owner: 上記active UI変更（担当と次処置を記録、メッセージ送信は未承認のため未実施）。
- needs Masa decision: 旧未追跡プロンプトの内容不変Git保存。
- 状態: 自分の成果はcommitted success/main aligned。旧ファイルの判断未了のためdo not archive。現行の別チャット差分はlive作業、古いヘッダーへ戻さない。
