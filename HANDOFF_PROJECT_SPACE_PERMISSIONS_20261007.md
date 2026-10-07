# PJの３スペース閲覧・編集権限

まさの依頼：adminにPJごとのコックピット・ワークスペース・DD権限一覧を新設し、新規メンバーへの閲覧・編集付与を可能にする。

正本はpwa/spec/2-1、3-24、5-17、manual/2-6、ios/DESIGN.md。入口は/admin/permissions。内部個別grantは既存所属と独立、外部workspace/DDは従来のgrant。権限は追加型でadmin・既存社内・所属を下げない。DD editは掲載項目編集、外部workspace editは共有資料編集。権限再付与・全社設定はadminだけ。

migration 20261007090000は本番適用済み。Supabase migration履歴にもapplied登録をreadback済み（重複適用不要）。RLSとservice専用RPC、同一transactionの監査を確認。実grantは0、既存の利用者権限は変更していない。grantの保存・読戻しとadmin以外の拒否はrollback付き本番transactionで検証した。

他platformは管理画面未移植。共通DB・capability・APIは利用可能。iOS/macOS/Androidの移植時はscope再確認、既存権限との加算、停止/期限状態、actorを維持する。schema変更を再適用しない。

前セッションのSOL原稿・manual訂正等はSOL担当の変更として保持し、同担当がd1d70969等でcommitしたことを確認。旧SESSION_MIGRATION_PROMPT_task_based_pt_20260922.mdは保管資料で今回の指示に使用しない。

6923efac（v3.161.0）はmain push済み、本番aliasのSHA一致、Vercel TypeScript・630ページbuild成功を確認。画面確認で、同PJの後発検証DDをUUID順で拾う点とスマホダイアログの入力幅を発見しv3.161.1で修正。正式DDは既存DD管理と同じ最初のcreated_atを選び、選択検査を追加。最終画面readbackは完了後に追記する。理論変更なし、BZM同期不要。

## OSマニュアル同期ゲート

| 差分 | マニュアル | 確定仕様 | 全プラットフォーム正本 | 状態 |
| --- | --- | --- | --- | --- |
| adminのPJ×3スペース一覧・付与 | manual/2-6、9-3 | spec/2-1、3-24、6-1 | ios/DESIGN.md | 同期済み |
| 内部個別コンテンツ編集 | manual/2-3、2-6 | spec/2-1、3-23、6-1 | ios/DESIGN.md | 同期済み |
| DD掲載項目の編集委譲 | manual/2-6、9-3 | spec/5-17、6-1 | ios/DESIGN.md | 同期済み |
| 理論・数式 | 対象なし | 対象なし | model/BZM変更なし | 同期不要 |
