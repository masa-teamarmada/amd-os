# AMD OS / AMDプロトコル self filing まさ decision sheet（内部版）

- 作成日: 2026-06-02
- 位置づけ: self filing package / final consistency review / formal figure readiness 後に残った、まさ判断事項を3問以内へ圧縮した内部decision sheet。法的助言ではない。
- 重要: 実提出版ではない。外部送付禁止。JPO提出禁止。弁理士問い合わせ禁止。
- 記載制限: 実住所、正式氏名、電話番号、識別番号、実案件名、顧客名、個人名、契約条件、未公開知財詳細、prompt全文、few-shot、score weight / threshold / calibration、実DB行、source permalink、実URL、実サービス名、実connector名は書かない。

## 結論

まさ判断は、次の3問だけに圧縮する。

1. **発明の出願範囲**: 請求項A/B、WS-5、WS-6を今回どこまで入れるか。
2. **手続タイミング**: 出願日先取り、審査請求、30条例外をどう扱うか。
3. **出願当日の実行経路**: AMD名義の電子出願で行くか、緊急退避を許すか。

この3問が決まれば、願書実入力、図面正式化、承継メモ、支払、提出後deadline ledgerへ落とせる。

## Q1. 発明の出願範囲をどうするか

**問い**: 請求項A/Bを独立2本で出し、WS-5 / WS-6を今回の従属項に残すか。

### 推奨案

- 請求項A/Bは、現パックどおり **独立2本候補** で出願直前レビューに進める。
- WS-5は、**従属項に残しつつ分割候補にも明記**する。
- WS-6は、**従属 / 補強に留め、独立化しない**。主軸ではなく逃げ道として置く。
- Fig.6 / Fig.7は、今回残す場合でも補助図として扱い、Fig.1-Fig.5を主軸にする。

### 代替案

- 請求項Bを請求項Aの従属側へ寄せる。
- WS-5又はWS-6を今回の請求項から外し、明細書の実施形態 / 分割候補だけに残す。
- WS-6を完全に次回分割候補へ下げ、今回出願はHITL正本化 + protocol/outcome + parameter governance寄りへ絞る。

### リスク

- 独立2本を維持すると、単一性や審査対応で突かれる可能性がある。
- WS-5を強く出しすぎると、現OSではpartialな要素を主軸に見せるリスクがある。
- WS-6を強く出しすぎると、発明該当性、単一性、事業判断方法そのものへの寄りすぎが気になる。
- 外しすぎると、出願後に新規事項として足せない範囲が増える。

### 決めた後に更新するファイル

- `docs/ip/self_filing_package/2026-06-02_claims_filing_draft_internal.md`
- `docs/ip/self_filing_package/2026-06-02_specification_filing_draft_internal.md`
- `docs/ip/self_filing_package/2026-06-02_abstract_filing_draft_internal.md`
- `docs/ip/self_filing_package/2026-06-02_figures_filing_brief_internal.md`
- `docs/ip/self_filing_package/figures/filing_candidates/README.md`
- `docs/ip/self_filing_package/2026-06-02_final_consistency_review_internal.md`

## Q2. 手続タイミングをどうするか

**問い**: 出願日だけ先に取り、審査請求と30条例外をどう扱うか。

### 推奨案

- **出願日は先に取る**。
- **審査請求は後日**にする。出願日から3年以内のdeadline ledgerを作る。
- **30条例外は当日まで要否判断として残す**。まさ回答ベースでは今回申請内容の外部開示なし前提だが、少しでも迷う公開 / 配布 / 投影があるなら、出願同時の適用申請と30日以内の証明書面準備を検討する。

### 代替案

- 出願と同日に審査請求も行う。
- 30条例外を不要と判断し、公開資料メモだけ残す。
- 30条例外を安全側で使う前提にし、証明書面の準備を出願直後タスクへ入れる。

### リスク

- 審査請求を同日にすると費用が増え、請求項数が多いまま請求することになる。
- 審査請求を後日にすると、権利化は遅くなる。deadline管理を落とすと出願が無駄になる。
- 30条例外を不要と決めた後で、発明コアに近い外部開示が見つかるとリスクが残る。
- 30条例外を使う場合、出願同時の手続と30日以内の証明書面を落とせない。

### 決めた後に更新するファイル

- `docs/ip/self_filing_package/2026-06-02_filing_day_checklist_internal.md`
- `docs/ip/2026-06-02_public_disclosure_evidence_checklist_internal.md`
- `docs/ip/self_filing_package/2026-06-02_request_form_draft_internal.md`
- `docs/ip/self_filing_package/README.md`
- `commander_tasks/ip_patent_COMMANDER_TASKS.md`

## Q3. 出願当日の実行経路をどうするか

**問い**: AMD名義の電子出願環境を正ルートにし、緊急時だけ紙出願退避を許すか。

### 推奨案

- 正ルートは **AMD名義の電子出願**。
- 出願前に、電子証明書、申請人利用登録、9桁識別番号、支払方法、インターネット出願ソフト又は書類作成経路を確認する。
- 実住所、正式氏名、電話番号、識別番号はrepoに書かず、出願ソフト又は正式書面で入力する。
- 紙出願は、電子環境が当日どうしても使えない場合の緊急退避に留める。

### 代替案

- 先に紙出願を退避ルートとして準備しておく。
- 弁理士の地雷チェックを1-2時間だけ挟み、代理提出は依頼しない。
- 電子出願環境が整うまで提出日取得を延期する。

### リスク

- 電子証明書、申請人利用登録、識別番号、支払方法で当日止まる可能性がある。
- 紙出願退避は、方式、手数料、電子化、到達日管理でミスが増える。
- 願書実入力欄をrepoへ戻すと、個人情報 / 会社実値の管理リスクが出る。
- 承継メモを正式化しないままAMD名義で出すと、後日の説明コストが残る。

### 決めた後に更新するファイル

- `docs/ip/self_filing_package/2026-06-02_request_form_draft_internal.md`
- `docs/ip/self_filing_package/2026-06-02_assignment_decision_memo_draft_internal.md`
- `docs/ip/self_filing_package/2026-06-02_filing_day_checklist_internal.md`
- `docs/ip/self_filing_package/README.md`
- `commander_tasks/ip_patent_COMMANDER_TASKS.md`

## まさ記入欄

| question | decision | memo |
|---|---|---|
| Q1 発明の出願範囲 | `[ ] 推奨案 / [ ] 代替案 / [ ] 要再整理` |  |
| Q2 手続タイミング | `[ ] 推奨案 / [ ] 代替案 / [ ] 要再整理` |  |
| Q3 出願当日の実行経路 | `[ ] 推奨案 / [ ] 代替案 / [ ] 要再整理` |  |

## 次アクション

1. まさがQ1-Q3を選ぶ。
2. 選択結果を請求項、明細書、願書、図面README、当日チェックリストへ反映する。
3. 正式提出用画像へ変換し、白黒2値化後の実見確認と営業秘密scanを再実施する。
4. 出願当日は `2026-06-02_filing_day_checklist_internal.md` だけを見て、入力、支払、提出、提出後deadline ledgerを処理する。

