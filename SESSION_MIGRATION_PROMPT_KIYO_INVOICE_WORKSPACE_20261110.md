# SESSION MIGRATION PROMPT — きよ 請求書作業面

作業場所は `/Users/masa/projects/AMD/amd-os`。`pwa/` をセッションcwdにしない。

## 最初に読む順

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/HANDOFF_KIYO_INVOICE_WORKSPACE_20261110.md`
4. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
5. `pwa/manual/1-1-intro.md`
6. `pwa/spec/1-3-reconstruction-coverage-audit.md`
7. `pwa/design/SPEC_pwa.md` の `/admin/kiyo` と `/admin/invoices`
8. `pwa/design/FEATURE_REGISTRY.md`
9. `pwa/manual/2-6-admin-ops.md`、`pwa/manual/6-6-member-billing-prompts-spec.md`
10. `ios/DESIGN.md`
11. `pwa/BUGS.md`

## 状態

- きよの請求書作業面は、契約条件、13か月の請求実績、対象月の立替精算を同じ画面へ集約済み。
- 入口は `請求書作成`。freeeへ実際に送る最終操作だけは `請求書を発行`。
- `過去滞留` はクリックで解消画面を開き、請求月更新または請求書作成へ進める。
- 全PJの契約条件に `立替の請求上乗せ` を表示する。SXは `上乗せ不可` で、請求候補・確認画面・freee明細のすべてから立替分を除外する。
- 立替があり、上乗せ条件が未抽出のPJは請求書発行を止める。契約書原本以外から可否を推測しない。
- 実装・本番反映の基点は `6dd9929d`。現在のmainにも実装は残っている。
- この文書は既存実装を再開するための記録で、新しい実装・DB変更・本番反映は含まない。Gitの現在地は作業開始時に確認する。
- 同じ作業場所にある他領域の未commit差分は、この引き継ぎの対象外。触らない。

## 次にこの領域を開く場合の作業

1. `git fetch origin --prune` を行い、mainとorigin/mainの差分を確認する。自分の作業対象外の差分は混ぜない。
2. PC版の本番 `/admin/kiyo` で、請求書タブを実認証で開く。
3. `請求書作成`、クリック可能な `過去滞留`、SXの `上乗せ不可` と請求額不算入を確認する。
4. 回帰があれば、表示だけでなく請求候補、確認画面、Edge Functionの3層を同じ修正単位で直す。
5. PWA変更時はmanual・spec・FEATURE_REGISTRY・附則を同じ変更で更新し、対象検査、型検査、本番用生成、PC版Chrome確認を行う。
6. mainへ対象ファイルだけを明示stageしてcommitし、正規の `pwa/scripts/deploy.sh` で本番反映と版情報を確認する。

## 完了条件

- 入口と最終発行の文言が操作の実態と一致する。
- 過去滞留を同じ画面内で解消できる。
- 契約上不可の立替が、どの発行経路からも請求額へ入らない。
- 未抽出を不可へ読み替えず、原本欠測として残す。
- PC版Chrome、本番版情報、DB / Edge Functionの読み戻しで結果を確認する。
- mainとorigin/mainが一致し、この作業由来の未commit・未push・branch・worktreeが残らない。
