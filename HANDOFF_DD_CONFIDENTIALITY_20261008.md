# DDスペース全体の秘密指定

2026-10-08。ユーザー承認済みの標準表示による秘密指定を実装。詳細はpwa/spec/5-17の2026-10-08節、使い方はmanual/2-6。原本・契約・開示権限を保持し、資料配送に指定を付ける。NDA成立は判定しない。

| 新仕様/仕様変更 | design正本 | OSマニュアル章 | 状態 |
|---|---|---|---|
| 全ページ・直接資料への秘密指定 | spec/5-17、FEATURE_REGISTRY、ios/DESIGN | manual/2-6 | 同期済み |
| 通知付きZIP・PDF/Excel秘密表示 | spec/5-17 | manual/2-6 | 同期済み |
| 提供内容の識別値・受領確認の監査 | spec/5-17 | manual/2-6 | 同期済み |
| 変更履歴 | spec/6-1 | manual/9-3 | 同期済み |
| DB列・RLS・契約・既存付与 | 変更なし | 対象外 | 同期不要 |
| 理論/model | 変更なし | 対象外 | 同期不要 |
| ネイティブ | ios/DESIGN | ブラウザ運用 | 独立DD未移植 |

検証と反映結果は完了時に追記。Chrome接続はrequest-header policyエラー。無関係の作業差分は触らない。

検証: 本番用Nextビルドとfunction bundle size検査成功。新規test:dd-confidentiality/既存test:dd-package成功。会社概要Excelの既存単独検査は旧シート名「ラウンド別cap table」を期待するため失敗し、HEAD版を差し込んだ変更前でも同一失敗を再現。対象外の古い期待値は変更しない。新検査で元シートのXML（セル・数値・参照）不変を確認済み。
