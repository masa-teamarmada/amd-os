# 組織図の登録表示

2026-10-06。SolvioraXの設立時組織案を、既存の組織図ページへ登録。全PJ同じ表示処理でproject_config.organization_chartを読む。

- 会議体：株主総会 → 経営会議 → 代表取締役／CEO。
- 部署：経営企画部・技術開発部。CTOが開発統括、現場の中核担当は未定。未許可の個人名は登録していない。
- 協業先：杉浦研（共同研究）、ダイキアクシス（リアクター共同開発）、ツウテック（培養装置共同開発）。技術開発部と両矢印、役割は箇条書き。
- コックピット・共有ワークスペースは認可済みの専用GET、DDは既存の入場・掲載認可後にサーバ初期値を渡す。DD閲覧者は汎用APIを呼ばない。
- proposedの登録値を「組織案」と表示。未登録は既存ひな形、読取失敗はエラー。正式な役員・雇用・登記・契約の合意として確定しない。
- DBスキーマ・既存プロフィール・資本政策・従業員名簿・公開権限・正式版PDFは変更なし。
- ネイティブiOS/macOS/Androidは未移植。PWAの同一データ契約を移植する場合はspec 3-23に従う。

## 検証と反映

test:organization-chart、test:reference-data-cache、TypeScript全体検査、test:no-project-special-cases、test:project-format、test:dd-packageは通過。DB登録値を読み戻し、2部署・3協業先・proposedと完全一致を確認。本番v3.160.6 / 4a90431eadbe5c756e14b90604baf1a48cc6bc41をdeploy.sh経由で反映し、api/build-infoのSHA一致と本番ワークスペース画面を確認済み。2部署・3協業先・19件の役割箇条書き、CTO統括、実務中核未定、両矢印を確認。スマホ確認はユーザー指定で実施していない。

## マニュアル同期

| 新仕様 | 正本 | OSマニュアル | 状態 |
|---|---|---|---|
| 登録済み組織・協業図の共通表示 | spec 3-23 | manual 2-1「組織図を見る」 | 同期済み |
| DDのサーバ初期値と既存認可 | spec 3-23 / 既存5-17 | manual 2-1 / 既存7-2 | 表示説明同期、認可手順は不変 |
| 理論・評価 | 変更なし | bzm | 対象外 |

反映用checkoutは /Users/masa/projects/AMD/SOL/work/amie_os_organization_20261006。共有root checkoutの未確定作業を分離し、origin/mainの公開済みナビゲーション変更を取り込んだ。登録と画面readbackの記録はSOLのoutputs/amie_261005_15mo_9f334f8e/に保存する。

共有root checkoutの自分の変更だけを照合して除去し、公開済みmainをfast-forwardで取り込んだ。他担当のナビゲーション変更と既存未追跡ファイルは保全。PWAの必須deploy検査は全件通過。資料HTMLは内容・数字を保持し31.39%短縮、HTML/XLSXとも同一Drive IDの更新と同期SHA一致を確認済み。
