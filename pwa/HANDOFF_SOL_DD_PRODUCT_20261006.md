# SOL 製品説明資料の引き継ぎ

更新: 2026-10-06。仕事種別: development（製品説明本文の登録と表示）。

## 依頼と内容
まさと合意した7節を作成。培養・在庫から排水処理と金属回収へつながる製品、装置と継続供給、用途、設置と作業、顧客の判断条件、在庫シアノによるバイオ燃料生産、製品化の現在地。2つの工程図と用途・役割・現在地の表を置く。在庫維持中に脂質を分泌する株で燃料原料を生産・回収する開発構想を含め、研究の報告と実証未了を分ける。

## 正本と登録
- 表示: https://amd-os-pwa.vercel.app/dd/sol?tab=product-description
- 登録値: project_configのp21/product_description。既存1行の追加のみ。version=1、title、summary、bodyMd、sourceRefs。
- 原稿と適用SQL: scripts/data/sol-product-description-20261006.md、同.sql。SQLはON CONFLICT DO NOTHINGで適用済み。更新時は現行値を読み、意図した改訂だけを反映する。
- 素材: 現行SOL技術台帳の排水処理・金属回収・菌体供給・バイオ燃料と事業モデル、コスト試算の分泌株注記。
- 原稿保存先: Drive共有ARMADA/p21_sol/261006_製品説明資料/製品説明資料_初稿.md。
- 仕様5-17と3-24、マニュアル2-6、FEATURE_REGISTRY、ios/DESIGNを同期。ネイティブDDへの追加移植は今回含めない。

## 検証と反映
型検査、対象lint、test:dd-package、production build成功。DBの登録値は原稿と完全一致。本文7節・工程図2件。他のp21設定3件、DDパッケージ状態を登録前後で照合し不変。DD閲覧付与・正式PDF掲載設定の追加変更なし。本番表示の完了証跡はsessions_2026-10.mdへ追記する。

## 配布単位
この製品表示と原稿・SQL・仕様だけをmainへcommitし正規deploy.sh経由で反映。開始時からある未追跡SESSION_MIGRATION_PROMPT_task_based_pt_20260922.mdは触らない。ロールバックする場合は表示変更のrevertを新しい版番号で正規配布し、登録本文は読取り可能な原稿として保持する。自動化・メール・Slack送信は追加しない。
