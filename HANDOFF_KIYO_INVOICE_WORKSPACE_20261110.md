# きよ 請求書作業面 引き継ぎ

最終更新: 2026-11-10 JST

## このセッションの結論

- `/admin/kiyo` の請求書作業面は、契約条件、13か月の請求実績、対象月の立替精算を同じ画面で確認できる。
- 作成画面を開く入口は `請求書作成`、freeeへ実際に送る最終操作だけは `請求書を発行`。
- `過去滞留` はクリックでき、請求月の更新または請求書作成へ進める。
- 契約条件には `立替の請求上乗せ` を全PJで表示する。値は `上乗せ可 / 上乗せ不可 / 未抽出` の3状態。
- SXは `上乗せ不可`。画面表示だけでなく、請求候補、確認画面、freeeへ渡す明細から立替分を除外する。
- 立替が存在するのに条件が未抽出のPJは、契約書原本から確認できるまで請求書発行を止める。

実装・DB・Edge Function・本番反映は2026-08-12の `6dd9929d` で完了した。その後の現行mainにも実装は残っている。

## 正本

- 画面仕様: `pwa/design/SPEC_pwa.md` の `/admin/kiyo` と `/admin/invoices`
- 業務手順: `pwa/manual/2-6-admin-ops.md`、`pwa/manual/6-6-member-billing-prompts-spec.md`
- 消してはいけない導線: `pwa/design/FEATURE_REGISTRY.md`
- 全画面対応: `ios/DESIGN.md`
- 実装: `pwa/src/components/admin/AdminInvoiceIssueQueue.tsx`、`pwa/src/components/admin/AdminInvoiceIssueDialog.tsx`
- 発行側の強制条件: `ios/supabase/functions/issue-invoice/index.ts`

## 未解決

このセッション由来の未解決はなし。

契約条件の未抽出PJは、このセッション終了時点では別タスクへ切り出し済み。契約書原本がない場合は `未抽出` のまま維持し、メモやPJ名から可否を推測しない。

## 再開するときの最初の行動

現行mainを取得した後、上記正本と実装を読み、PC版の本番画面で次の3点を確認する。

1. 入口が `請求書作成`、最終操作が `請求書を発行` になっている。
2. `過去滞留` から請求月更新または請求書作成へ進める。
3. SXの立替が請求額へ加算されない。

## 引き継ぎの境界

- 正規checkoutは `/Users/masa/projects/AMD/amd-os` の `main`。再開時は必ず `git fetch origin --prune` で現行状態を確認する。
- この文書は請求書作業面の既存実装を再開するための記録で、新しい実装・DB変更・本番反映は含まない。
- 同じ作業場所にある他領域の未commit差分は、この引き継ぎの対象外。混ぜてstage・commitしない。

## 検証記録

2026-08-12に、対象検査、型検査、本番用生成、PC幅の画面確認、本番版とGit反映、DB条件、Edge Function反映を確認済み。2026-11-10のcloseoutでは再実行していない。
