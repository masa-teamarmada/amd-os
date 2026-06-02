# AMD OS / AMDプロトコル self filing package（内部提出形式候補版）

- 作成日: 2026-06-02
- 位置づけ: 完全セルフ出願に向けた、まさ / 特許出願司令塔確認用の内部提出形式候補版。
- 重要: 実提出版ではない。外部送付禁止。JPO提出禁止。弁理士問い合わせ禁止。
- 記載制限: 実案件名、顧客名、個人名、契約条件、未公開知財詳細、prompt全文、score weight / threshold / calibration、実DB行、source permalinkは入れない。

## パック構成

| ファイル | 目的 | readiness |
|---|---|---|
| `2026-06-02_request_form_draft_internal.md` | 願書候補。AMD出願人、まさ単独発明者、代理人なし前提。住所等はプレースホルダー | 提出直前の記入欄確認が必要 |
| `2026-06-02_specification_filing_draft_internal.md` | 明細書提出版候補。A/B二段構え、先行技術別の逃げ方、図面参照、抽象レコード遷移を反映 | 内部提出形式候補として strong |
| `2026-06-02_claims_filing_draft_internal.md` | 特許請求の範囲提出版候補。独立A/B案、従属項、WS-5/WS-6の未判断整理 | まさ判断後に最終番号調整 |
| `2026-06-02_abstract_filing_draft_internal.md` | 要約書候補。400字以内、選択図候補あり | 形式候補として usable |
| `2026-06-02_figures_filing_brief_internal.md` | Fig.1〜Fig.8提出図面清書指示。白黒線画、符号候補、入れる/入れない情報 | 清書者への指示として usable |

## 参照したJPO / 特許庁公式情報

- JPO「特許出願」願書作成方法: https://www.pcinfo.jpo.go.jp/guide/Content/Guide/Patent/Gansho/doc/P_Normal.htm
- JPO「願書: 特許」書類名: https://www.pcinfo.jpo.go.jp/guide/Content/Guide/Patent/Gansho/Kyotsu/PShoruiMei.htm
- JPO「特許出願人」願書欄: https://www.pcinfo.jpo.go.jp/guide/Content/Guide/Patent/Gansho/Kyotsu/PShutsuganNin.htm
- JPO「明細書: 特許」: https://www.pcinfo.jpo.go.jp/guide/Content/Guide/Patent/Meisai/doc/P_Meisai.htm
- JPO「特許請求の範囲: 特許」: https://www.pcinfo.jpo.go.jp/guide/Content/Guide/Patent/SeikyuNoHanni/doc/P_SeikyuHanni.htm
- JPO「要約書: 特許」: https://www.pcinfo.jpo.go.jp/guide/Content/Guide/Patent/Yoyaku/doc/P_Yoyaku.htm
- 特許庁「要約書の概要」: https://www.jpo.go.jp/system/patent/shutugan/sakusei/ygaiyo.html
- JPO「図面: 特許」: https://www.pcinfo.jpo.go.jp/guide/Content/Guide/Patent/Zumen/doc/P_Zumen.htm
- 特許庁「産業財産権関係料金一覧」: https://www.jpo.go.jp/system/process/tesuryo/hyou.html
- 特許庁「電子出願」: https://www.jpo.go.jp/system/process/shutugan/pcinfo/
- JPO「申請人情報・証明書管理ツールについて」: https://www.pcinfo.jpo.go.jp/docs/explanation/cert_tool.html
- 特許庁「発明の新規性喪失の例外規定の適用を受けるための手続について」: https://www.jpo.go.jp/system/laws/rule/guideline/patent/hatumei_reigai.html

## 提出形式パックのreadiness結論

本パックは、完全セルフ出願の内部提出形式候補としては **提出日を取りに行く直前レビューに使える水準**。

ただし、実提出はまだ止める。理由は、願書の個人住所 / 法人住所 / 識別番号 / 電子証明書 / 支払方法が未確認であり、Fig.1〜Fig.8は清書指示であって提出図面そのものではないため。

## 出願前Must残

1. 願書未確認欄: 発明者住所、AMD住所、代表者、電話番号、識別番号、整理番号、提出日、手数料納付方法。
2. 電子出願環境: AMD名義の電子証明書、9桁識別番号、申請人利用登録、インターネット出願ソフト又はさくっと書類作成。
3. 手数料: 特許出願料14,000円。審査請求料は138,000円 + 請求項数 x 4,000円。
4. 審査請求タイミング: 出願同日か、出願日から3年以内に後日請求か。
5. 30条例外要否: 出願と同時の適用申請、出願から30日以内の証明書面が必要か。
6. 承継メモ: 発明者まさからAMDへの特許を受ける権利の承継又は社内決裁メモ。
7. 図面: Mermaidではなく、白黒線画、符号付き、GIF/BMPモノクロ2値相当の提出図面へ清書。

## まさ判断事項（5個以内）

1. 請求項A/Bを独立2本で出すか、A独立 + B従属で出すか。
2. WS-5 system parameter governanceを今回の従属項に残すか、分割候補へ下げるか。
3. WS-6 Before-Zero設立時期推奨を今回の従属項に残すか、分割候補へ下げるか。
4. 出願時は出願料だけで日付を取り、審査請求は後日にするか。
5. 30条例外手続を念のため行うか。

## 営業秘密scan結果

- 実案件名: 記載なし。
- 顧客名 / 個人名: 記載なし。発明者は「まさ」表記又はプレースホルダーのみ。
- 契約条件 / 価格 / 商談ログ: 記載なし。
- prompt全文 / few-shot / comment-to-guidance具体ロジック: 記載なし。
- score weight / threshold / calibration: 記載なし。
- production DB row / 実source permalink / 実URL: 記載なし。
- 未公開知財詳細: 抽象カテゴリに限定。

