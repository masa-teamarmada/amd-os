# AMD契約台帳の列分割（2026-10-08）

PWA `/admin/contracts` の1契約1行を全画面幅でHTML表へ統一。状態・期間等の複合セルを32の項目列へ分割。初期は基本情報14列、実務条件26列、全項目32列。見出し/契約名を固定し、PCではPJも固定。未知/0円と契約間の条件分離を保持。契約名から既存モーダル、文書列から現在版を開く。データ/認可/schema/API変更なし。

変更: `pwa/src/components/contracts/ContractLedgerTable.tsx`、`ContractsClient.tsx`。回帰検査: `cd pwa && node --experimental-strip-types scripts/check_contract_ledger_table.mts` と既存contracts-ledger検査。PWAの専用表示のみ実装。iOS/macOS/Androidの専用画面は未移植、`macos/PARITY.md`の未移植項目は維持。

## OSマニュアル同期ゲート

| 棚卸し | 判定 | 根拠 |
|---|---|---|
| manual | 更新 | 6-7の列/横スクロール/詳細の操作、9-3変更履歴 |
| spec | 更新 | 5-6の32列/固定/意味/不明値、6-1変更履歴 |
| bzm | 対象外 | 理論・数式・rubricは変更なし |
| DESIGN | 更新 | ios/DESIGN.mdへ共有仕様の差分と未移植範囲を追記 |
| DB/EF | 対象外 | schema/API/契約データは変更なし |
| 他プラットフォーム | 未移植 | 専用画面の追加移植は今回の対象外 |

表示検証: 試作の実コンポーネントを1280px/390pxで表示。横方向のページはみ出しなし。検証用routeは配布前に削除。本番確認の対象はビルド番号、基本/実務/全項目の列切替、検索、並び順、契約名からのモーダル、390px幅の横スクロール。表示・closeout結果は `.jez/artifacts/design-review.md` と本チャットの最終報告に記録する。

本番の管理メニューを含む狭幅確認により、スマホの固定契約名は120pxとし、列切替は補助ラベルを省いて折返しを防ぐ。ソースの型検査は通過。ローカルwebpack全体ビルドは既存のMyPageContent/mapBundleのroute export制約2件で停止（今回の差分外）。Vercelの通常ビルド成功。本番v3.161.31でPC1392px/実効狭幅354px、14/26/32列切替、並び順、詳細・署名版リンクを確認済み。

## 2026-10-10 終了確認

混合作業。NDA登録の正本はp21/AMD契約台帳と適用済み494 SQL、表示仕様はspec5-6/manual6-7。今回の残件なし。最初の次の行動は新しい依頼を受けて最新状態を確認すること。

origin/main 8d636564、今回の実装はmain aligned。配信はv3.162.13/8e17d62fへ後続更新済み。共有checkoutはmain f2a08962、未コミット0、ahead3/behind31。3件は「承認なしの押印を防ぐ設計」01a11a36-1046-7ea0-a1d8-37c5ba39efa9所有。担当が最新mainと統合し正規反映・監視起動を検証する。ここで他担当のcommitをpushしない。共有checkout全体はdo not archive。今回の終了文書は最新mainのclean cloneからdocsだけ保存する。

開発履歴: pwa/design_log/sessions_2026-10.md。教訓: pwa/BUGS.md「契約表の管理メニュー込み狭幅」。再開文: SESSION_MIGRATION_PROMPT_CONTRACT_COLUMNS_20261010.md（共通SESSION_MIGRATION_PROMPT.mdにも保存）。以前の共通再開文はSESSION_MIGRATION_PROMPT_PAGE_VIEWING_BEFORE_NDA_CLOSEOUT_20261010.mdへ保持。会話の検討材料0件。
