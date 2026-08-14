# AMD OS Handoff

最終更新: 2026-08-14 JST

対象: 請求対象PJの契約原本監査、資料室リンク、SX現行契約の台帳・コックピット反映

作業種別: 非開発PJ運用（本番データ更新）

## 今回の到達点

- SX（p21）の締結済み請負契約書を契約台帳の押印版として登録し、現行契約を `signed` として確認した。
- SXコックピットの契約上の実行条件を、原本から確認した月額請求、検収後60日以内の支払、毎月の完了通知・検査、再委託の事前承認へ更新した。立替上乗せ不可は既存の確定値を維持した。
- SX資料室に締結済み原本を契約フォルダ、現行見積書を「入札・調達」フォルダへAMD内部限定でリンクした。
- CX（p20 / NIMS）資料室の「入札・調達」に、現行の仕様・見積合わせ・提出書類、本見積書、前年度の入札一式をAMD内部限定でリンクした。
- NIMS（p28）は連携覚書であり、個別有償支援は都度書面の扱い。今回確認した範囲では、この覚書に直結する入札一式はなかった。

## 正本と現在地

- 契約条件の正本: `contracts.operational_terms_json`。PJコックピット表示は `projects.contract_terms_json.currentContracts[]`。
- 契約台帳の運用仕様: `pwa/spec/5-6-contracts-management-current-spec.md`。
- 資料室のリンク先はAMD OS本番の各PJ資料室。Drive共有範囲は変更せず、すべてAMD内部で登録した。
- 今回の本番読戻しで、SXコックピットに「申請不可」「契約代金に含む。立替のクライアント請求上乗せ不可」を表示することを確認した。
- durable note: 不要。再利用すべきPJ運用事実は契約台帳・コックピット・資料室に正規登録済みであり、別のプロジェクト文書へ重複保存しない。

## Repo状態

- canonical path: `/Users/masa/projects/AMD/amd-os`
- branch / HEAD: `main` / `9d262b03`
- `origin/main` と一致、ahead 0 / behind 0、未push commit 0、dirty 0。
- 今回はコード・仕様・スキーマ変更なし。OSマニュアル同期は対象外（既存画面からのデータ登録のみ）。

## 未解決

- 当初依頼の「請求書作成画面に出る全PJ」の原本監査は、SXとCX/NIMS関連の更新後も全件完了として再集計していない。残りのinvoice対象PJについて、現行の締結済み原本または現行契約台帳の有無を再監査する。
- 原本不在のPJは `expenseReimbursementAllowed` を推測で埋めず、未抽出のまま「原本欠測」として残す。

## 次セッションで最初にすること

請求書作成画面に出るPJを現在の本番から一覧化し、SX（p21）を除外して、原本あり・原本欠測・candidate適用待ちを数で整理する。契約条件は原本または現行契約台帳だけを根拠にし、既存の candidate → review → apply 境界を守る。

## 参照先

- 契約仕様: `pwa/spec/5-6-contracts-management-current-spec.md`
- コックピット仕様: `pwa/spec/3-8-cockpit-current-spec.md`
- 人向け契約運用: `pwa/manual/6-7-contracts-management-spec.md`
- 次セッション用プロンプト: `SESSION_MIGRATION_PROMPT.md`
