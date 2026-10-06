# SOL会社情報の訂正（2026-10-07）

まさ確認：設立当初は自社の研究開発拠点を持たない。研究開発はすべて愛媛大学杉浦研究室へ委託する。本店はEUICを予定。技術顧問の氏名は中島純一。経営会議は週次。

会社概要・創業背景・組織図の登録値と元原稿を同期した。CTOの担当は研究開発の委託管理と製品化の統括。資本政策・株式実績・公開範囲は維持。旧HANDOFF_SOL_DD_COMPANY_20261006.mdの会議頻度に関する記録は本訂正を優先する。

DB読戻しで3設定が期待値と完全一致。設定全体および関連台帳の誤氏名は0件。既存の3読込処理で形式確認を通過。本番Chrome 1392×824で会社概要・背景第4節・組織図の訂正表示、文字の収まり、ページ横溢れなしを確認。文章のみの訂正でアプリの構造・動作は変更していない。

現行原稿はpwa/scripts/dataのsol-company-incorporation-plan-20261006.json、sol-founding-background-20261006.json/.md、sol-organization-chart-20261007.json。適用済み訂正SQLはsol-company-corrections-20261007.sql。旧登録SQLも現行の会社概要・背景に同期済み。変更前値の照合条件つきSQLなので再実行しない。

確認資料はSOL/work/amie_company_corrections_20261007/のreadback.json、name-audit.jsonとCodex visualizations内のcompany/background/organization-corrected-20261007.png。現行の事業方針はSOL/SOL_DD_CONTENTS_PLAN.mdに記録。今回の未完了作業なし。
