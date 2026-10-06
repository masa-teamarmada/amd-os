# SOL 製品説明資料の用途図とTRL

2026-10-06。第3節・第7節の図解改訂を本番反映済み。今回の依頼の未完了作業なし。

- 表示: https://amd-os-pwa.vercel.app/dd/sol?tab=product-description
- 第3節: 色素分解・脱色と金属回収を左右の工程図で比較。処理水の後段接続、菌体の保持・交換、使用済み菌体からの金属抽出・精製を示す。用途ごとの検証条件は2項目で維持。
- 第7節: TRL1〜9の横矢印。現在4、シード目標6、シリーズA期間7、シリーズB期間8。現在は技術台帳の事業概要v1.7、将来は現行フェーズマトリクスで確認。A・Bは資金調達後の開発期間の到達目標。排水処理装置を軸に表示。
- 正本: project_configのp21/product_description。本文と出所2項目だけを更新。採用済みPNG2枚、他設定、DDパッケージ、事業計画は保持。
- 画像: pwa/public/product-images/sol-usage-comparison-v1.svg（5024bytes）、sol-trl-roadmap-v1.svg（7877bytes）。本文はpwa/scripts/data/sol-product-description-20261006.md。旧値一致条件のSQLはsol-product-visual-20261006.sql、1行更新済み。
- 配信: b42fa88a/v3.160.25を正規deploy.shでmainへ配信。3分2秒で公開aliasのSHA一致。DD回帰・配布必須ゲート成功。
- 検証: 本文期待値完全一致、他のp21設定・DD状態・事業計画不変。公開画像4枚は原ファイルとバイト一致。Chrome PC1392×824、本文幅960px。7節・4表・2Mermaid図・4画像、横溢れなし。新図2件を実画面で全体表示して文字・矢印の収まりを確認、品質評価9.0/10。SOL指定に従いPCのみ。
- Drive: 共有ARMADA/p21_sol/261006_製品説明資料/。用途図1tPrs9HWvzwB-WlnUVbpiSr83VMFNBOec、TRL図1xKiqqajZUhVTkNFy6mlaNVtM-vd0KaMR、制作元1pC5NLQWLxOAlzO0ACW22S0UbJNROx53a、改訂メモ1GsAYNAeZHZOXSdmeH-G5iVT4yLUGFPgr。原稿1eGmxBWcJYtBmecQIPsxH9S6j-9Z3gfOiは12290bytesへ更新しクラウド側でサイズ・親フォルダを確認済み。
- 証跡: SOL/work/amie_dd_product_visual_20261006/のdeploy.log、apply-visual.log、visual-readback.json、browser-geometry.json、usage-live.jpg、trl-live.jpg。検証用サーバ・プレビュータブは停止。
- 共有作業: 他担当の会社概要・創業背景の変更を保持し、対象差分だけをmainのclean cloneから配信。後続0d3fd466をcloneへff統合し、共有本体も同じmain・ahead/behind 0/0へ到達。既存未追跡の旧タスク報酬メモは今回の対象外。新規branch・worktreeなし、削除なし、mainへpush済み。対話証拠0件。

## 正本・マニュアル同期の棚卸し

| 層 | 反映先 | 状態 |
|---|---|---|
| 利用方法 | pwa/manual/2-6、manual/9-3 | 用途図・TRLの読み方を反映 |
| 実装仕様 | pwa/spec/5-17、spec/6-1 | SVG配信・根拠・条件付き本文更新を反映 |
| 理論 | pwa/bzm、model | 数式・rubric変更なし |
| 全プラットフォーム | ios/DESIGN.md | PWA図解・Nativeブラウザ運用を反映、Swift追加なし |
| 現行本文 | project_config、scripts/data、Drive原稿 | 同期・読戻し済み |
| 履歴と引き継ぎ | 本書、sessions_2026-10.md、SOL_DD_CONTENTS_PLAN.md | 完了記録 |

次の改訂は現行DB・技術台帳・フェーズ計画を読み直してから本文だけを更新する。今回のSQLは再実行しても旧値が一致しないため0行となる。
