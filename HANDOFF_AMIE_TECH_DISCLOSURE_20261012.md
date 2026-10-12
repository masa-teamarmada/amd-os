# 技術情報の開示範囲

2026-10-12。技術ページを4段階に分類し、社内原本から指定したDD概要だけをサーバーで投影する。原本の内容更新後は再確認まで非掲載。通常DD/外部workspace/選択項目/PDFで同じ境界を適用。

適用済み：pwa/scripts/migrations/502_amie_tech_disclosure_policy.sql、pwa/scripts/data/amie_sol_tech_disclosure_20261012.sql。再実行しない。SOLの23本文/248行を仕分け、通常DD15本文/121行。原内容の変更0件。許諾・DD権限・財務の更新なし。

正本：spec3-20/5-17、manual2-3/2-6、ios/DESIGN。検査：test:tech-disclosure/test:dd-package。全件仕分けと通常DDの掲載原稿・検証証拠はDrive p21_sol/261012_技術情報の開示区分。Swift/macOSの区分編集UIは未移植、追加JSON列は旧decode互換。

本番画面確認後、検証結果と残課題をDriveの検証記録へ追記する。次は杉浦先生の追加資料の照合、大学・顧客の許諾確認、大学利用権と採算の精査。

画面保存で原理説明の原本をdd_summaryへ修正（内部の事業前提が混在するため）。全271件の最終区分はDD判断131・限定116・核心24。公表範囲と出典が照合できた独立項目を今後publicへ分類する。連続保存の内部HTTPキャッシュ遅延も修正。初回SQLは適用履歴であり、現行の分類はDBとDriveの仕分け一覧を正本とする。
