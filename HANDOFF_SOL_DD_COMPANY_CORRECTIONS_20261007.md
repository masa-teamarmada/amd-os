# SOL会社情報の訂正（2026-10-07）

まさ確認：設立当初は自社の研究開発拠点を持たない。研究開発はすべて愛媛大学杉浦研究室へ委託する。本店はEUICを予定。技術顧問の氏名は中島純一。経営会議は週次。

会社概要・創業背景・組織図の登録値と元原稿を同期した。CTOの担当は研究開発の委託管理と製品化の統括。資本政策・株式実績・公開範囲は維持。旧HANDOFF_SOL_DD_COMPANY_20261006.mdの会議頻度に関する記録は本訂正を優先する。

DB読戻しで3設定が期待値と完全一致。設定全体および関連台帳の誤氏名は0件。既存の3読込処理で形式確認を通過。本番Chrome 1392×824で会社概要・背景第4節・組織図の訂正表示、文字の収まり、ページ横溢れなしを確認。文章のみの訂正でアプリの構造・動作は変更していない。

現行原稿はpwa/scripts/dataのsol-company-incorporation-plan-20261006.json、sol-founding-background-20261006.json/.md、sol-organization-chart-20261007.json。適用済み訂正SQLはsol-company-corrections-20261007.sql。旧登録SQLも現行の会社概要・背景に同期済み。変更前値の照合条件つきSQLなので再実行しない。

確認資料はSOL/work/amie_company_corrections_20261007/のreadback.json、name-audit.jsonとCodex visualizations内のcompany/background/organization-corrected-20261007.png。現行の事業方針はSOL/SOL_DD_CONTENTS_PLAN.mdに記録。今回の未完了作業なし。

## 引き継ぎ・結了（2026-10-07）

仕事種別：混合。現行の次セッション入口は/SOL/HANDOFF_DD_COMPANY_20261007.md（絶対ルート/Users/masa/projects/AMD）。内容正本SOL_DD_CONTENTS_PLAN.md、長期索引/Users/masa/projects/knowledge/sol.md、誤補完の教訓はSOL/BUGS.md。実装仕様・manual・開発履歴は初回変更と同期済み。今回の追加は内容訂正と記録のみで新たな製品仕様はない。

引き継ぎ開始時main a7be1d45、origin/mainと一致。訂正9cf09c27を含む。今回の未完了依頼なし、次はまさの新しい依頼を受ける。別案件の旧タスク移行草稿1件は保管資料として保持（管理者：まさ／旧タスク、判断時期：当該案件の再開・整理依頼時）。この草稿を会社情報作業の指示に使わない。

## 2026-10-07 社会課題ページの改訂

今回の社会課題ページ改訂を本番DBへ反映。4節、研究成果5領域、受賞表彰6件。研究開発から生産・販売までの一気通貫の責任、山地・杉浦先生の呼称、カーボンネガティブの条件を明記し、旧第5節は削除。内容正本はSOL/SOL_DD_CONTENTS_PLAN.md、登録原稿は従来と同じsol-founding-background-20261006.json/.md。更新SQLはsol-founding-background-revision-20261007.sql。適用済み・再実行不要。

DB読戻し・既存形式確認・本番Chrome表示を確認。他設定7件・DD2件不変。今回のアプリ構造の変更はなく、本文はデータ更新で即時反映。画面で閲覧する仕様・manualも正規deploy.sh経由で一括配布する。確認資料はSOL/work/amie_founding_background_20261007/。今回の未完了なし。
