# PJ管理の自社名刺案

更新: 2026-10-12。開発実装・初期登録・本番画面の確認済み。納品対象版v3.162.25。

## 使える画面

- 各PJの社内コックピット「PJ管理 > 名刺案」: `/project/{projectId}/cockpit?tab=card-designs`
- 管理者の全PJ一覧: `/admin/card-designs`
- PDF閲覧: `/project/{ownerProjectId}/card-designs/{designId}/assets/{assetId}`。原本の取得入口も同じ面に表示。

名刺は一種類一行。氏名・ブランド・版・承認/発注状態を比較し、表裏・編集元・入稿PDF・過去版を開く。交換相手の名刺は既存 `/business-cards`、自社名刺は本台帳で管理する。

## 現行正本

実装契約は `pwa/spec/3-25-project-card-designs-current-spec.md`、使い方は `pwa/manual/2-3-pj-cockpit.md`「自社の名刺案」。DDL/RLS/RPCは `ios/supabase/migrations/20261012072118_amie_project_card_designs.sql` と `20261012092110_amie_card_active_members.sql`。どちらも本番適用済み。APIと直接RLSの双方でactiveな社内メンバーだけに限定。

所有PJ・対象者キー・種類を系列とし、最新版の案と承認版のポインタを分ける。新案は承認済み入稿版を更新しない。PDFをハッシュ付きprivate Storageへ固定保存し、再取得してSHA256照合。編集元はDrive参照。電話・メール・住所を抽出しDBへ複製しない。保存/承認は競合照合とトランザクション、保存は再送キーで冪等化。

共有Driveの各PJ登録ルート直下に `0_名刺` を一つ置く。AMDはa0_management、SOLはp21_sol。フォルダの準備は0件なら作成・1件なら再利用・複数なら停止。外部ワークスペース/DDへの自動公開、印刷会社への自動注文はない。

## 初期登録

|名刺|所有PJ|関連PJ|現行状態|
|---|---|---|---|
|チームアルマダ単独r8|p00|p00|承認・発注済み。100枚、アラベール200kg。到着未確認|
|SOL単独2026-09-27|p21|p21|承認・発注済み。従来の正本を保持|
|SOL＋チームアルマダr7|p21|p00/p21|確認待ち・未発注|

Driveフォルダ・ファイルIDは従来正本を保持。PDFの写しは計9個、台帳の資料リンクは16個。承認状態は既存の証跡だけを採用。

## 検証と引き継ぎ

型/重点UI/共通PJフォーマット/参照キャッシュ/本番ビルド/正規反映前の全検査を実行。旧承認版保持、競合、再送、匿名・外部・直接書込み拒否をSQLで確認し、fixtureはROLLBACK。利用停止者16件のhelper拒否、authenticatedとしてactive adminの読取り/停止者0件を確認。メンバー行を変更しない検査で実施。

ChromeでAMD/SOLのPJ管理、管理者全PJ一覧、PDF描画、AMD入稿PDF閲覧、Googleスライド編集元、未登録PJを確認。PC1487px、スマホ320pxで新しい領域の文字収まり・44px操作・表内横スクロール・body幅を点検。自己デザイン点検8.5/10。iOS/macOS/Android専用画面は未移植。

開発記録: `pwa/design_log/2026-10-12_project_card_designs.md`。保存/配信の最新receiptと確認画像は共有Drive `a0_management/0_名刺/261012_OS登録確認/`。名刺制作/注文の業務正本は親フォルダの `BUSINESS_CARDS.md`、現況は `HANDOFF_BUSINESS_CARDS.md`。
