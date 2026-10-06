# SOL 製品説明資料の採用画像

2026-10-06。まさが採用した装置外観v2と工程比較図v1をそのまま掲載済み。

- 表示: https://amd-os-pwa.vercel.app/dd/sol?tab=product-description
- 正本: project_configのp21/product_description。既存JSON5項目を維持し、本文の冒頭に2画像と説明を追加。7節・5表・2Mermaid図は維持。
- 静的画像: pwa/public/product-images/sol-reactor-concept-v2.png、sol-process-comparison-v1.png。画像の加工なし。前者2086597bytes、後者1626120bytes。
- 更新原稿: pwa/scripts/data/sol-product-description-20261006.md。更新SQL: sol-product-photo-20261006.sql。旧値一致条件で1行だけ更新済み。再実行は既に更新済みなので0行となる。
- SOL方式は開発構想。一般的な凝集沈殿・汚泥脱水の工程は栗田工業の一次解説を参照。必要な前後処理は廃液ごとに検証する。図の省略は薬剤・廃棄物ゼロの保証ではない。
- Drive: 共有ARMADA/p21_sol/261006_製品説明資料/。写真v2: 1BBVeclP7SgIkbS2isVr-t-a6CPkLMSme、比較図v1: 1eLqDNWeN1a7ihlQKA3GBU-w7a8U8BThF、比較生成メモ: 1AecoBeHpCb-ofo2a1-xI85TBVYr8VdLS、更新原稿: 1eGmxBWcJYtBmecQIPsxH9S6j-9Z3gfOi。原稿11063bytes、親フォルダをクラウド側で確認済み。

## 検証と反映

実装13575f2c/v3.160.23を正規deploy.shでmainへ配信し5分15秒で本番aliasのSHA一致を確認。production buildと配布必須ゲート成功。共有checkoutに別担当のca62284aが先行したため、対象差分だけを最新mainの一時clean cloneへ統合して配布し、元checkoutは今回の差分と別担当の先行変更を含むmainへff同期した。元checkoutの未追跡の旧タスク報酬メモは触らない。

DB本文の期待値完全一致、他のp21設定5件とDDパッケージ状態の不変、公開PNG2枚の原画像とのバイト一致を確認。本文SHA256: c0073b115786eb55f04828da57b57485d3a99b00014623c17922854794aaf758。

Chrome PC1392×824、本文幅960pxで両画像の読み込み・比率保持・上下比較図全体の視認性・横溢れなしを確認。UI評価8.5/10。SOLのPC指定に従いモバイル検証なし。Swift画面への移植は今回も行わず既存ブラウザ閲覧を維持。新規API・schema・RLS・DD付与・正式版PDF掲載選択の変更なし。

証跡はSOL/work/amie_dd_product_media_20261006/のdeploy.log、apply-photo.log、media-readback.json、browser-geometry.json、photo-live.jpg、comparison-live.jpg。今回の依頼の未完了作業なし。

## 正本・マニュアル同期の棚卸し

| 層 | 反映先 | 状態 |
|---|---|---|
| 利用方法 | pwa/manual/2-6、manual/9-3 | 写真・比較図と開発構想表示を反映 |
| 実装仕様 | pwa/spec/5-17、spec/6-1 | 静的画像、出所、条件付き本文更新を反映 |
| 理論 | pwa/bzm、model | 数式・rubric変更なし |
| 全プラットフォーム | ios/DESIGN.md | PWA画像掲載・Nativeブラウザ運用を反映 |
| 現行本文 | project_config、scripts/data、Drive原稿 | 同期と読戻し済み |
| 反映・証跡 | 本書、sessions_2026-10.md、SOL_DD_CONTENTS_PLAN.md | 完了記録 |
