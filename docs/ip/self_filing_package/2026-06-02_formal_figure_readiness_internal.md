# AMD OS / AMDプロトコル formal figure readiness（内部版）

- 作成日: 2026-06-02
- 位置づけ: Fig.1-Fig.8 SVG画像候補を、正式提出図面化の直前レビューに近づけるための内部点検メモ。法的助言ではない。
- 重要: 実提出版ではない。外部送付禁止。JPO提出禁止。弁理士問い合わせ禁止。
- 禁止事項: DB write禁止。production DB接続禁止。Web公開削除/変更禁止。
- 作業範囲: `figures/*.svg`、`figures/README.md`、明細書候補、請求項候補、図面brief、図面clean draft、final consistency reviewのローカル突合。
- 方式確認: Web調査は行わず、既存のJPO方式メモにある「黒色で鮮明、着色しない、符号はアラビア数字、オンライン手続では線図等をモノクロ2値画像として扱う」という前提だけを使用した。最新方式のlive確認は残課題。

## 結論

Fig.1-Fig.8は、内部レビュー用SVGとしてはusable。今回、正式提出図面候補に近づけるため、`figures/filing_candidates/` に候補SVG一式を作成した。

ただし、これらは **JPO提出ファイルそのものではない**。残るBlockerは、SVGから提出方式に合う画像形式への変換、変換後の白黒2値化確認、余白 / 線幅 / 文字サイズ / 参照符号の実見確認、Fig.6 / Fig.7 / 請求項A-Bのまさ判断、最新JPO方式確認である。

## 作成した内部候補

| path | 内容 |
|---|---|
| `docs/ip/self_filing_package/figures/filing_candidates/` | Fig.1-Fig.8の内部提出候補SVG一式 |
| `docs/ip/self_filing_package/figures/filing_candidates/README.md` | 候補SVGの変更点、残TODO、営業秘密scan |

変更点:

1. 元SVGは内部レビュー用として保持した。
2. `filing_candidates/*.svg` では、正式図面に不要な可視タイトルを削除した。
3. `filing_candidates/fig8_integrated_review_ui.svg` では、内部注意文を削除した。
4. SVGの可視要素は、白背景、黒線、黒文字、参照符号、抽象構成要素に限定した。

## 共通readiness

| check | result | note |
|---|---|---|
| XML / SVG構文 | OK | `python3` + `xml.etree.ElementTree` で元SVG8件、候補SVG8件をparse確認 |
| 白黒 | OK | 可視要素は白背景、黒線、黒文字。色、グラデーション、スクリーンショットなし |
| 線幅 | 内部候補OK | 主線 `2px`、補助枠 `1.8px`。正式画像化後に線が痩せないか確認 |
| 文字サイズ | 内部候補OK / 変換後TODO | title削除後、本文は主に18px、small 15px、label 14px。2値化後の実見確認が必要 |
| 余白 | 内部候補OK / 変換後TODO | 図ごとにviewBox内余白あり。ただし提出ソフト変換時の縮小・トリミング確認が必要 |
| 参照符号 | 概ねOK | 100-340が明細書の符号説明と対応。300は「証拠参照 / 異種証拠参照」の表記ゆれを正式化前に統一するとよい |
| 図名 / 内部注意文 | 候補側で改善済み | 元SVGの可視タイトルとFig.8内部注意文は候補SVGから削除済み |
| 明細書 / 請求項対応 | 概ねOK | Fig.6 / Fig.7は未判断要素として残る |
| 営業秘密 | 重大混入なし | 実名、実URL、実DB名、実connector名、prompt全文、score実値なし |

## Fig.1-Fig.8 readiness

| 図 | readiness | 修正点 | 残Blocker / TODO | 対応関係 |
|---|---|---|---|---|
| Fig.1 | Internal filing candidate | 候補SVGで可視タイトル削除 | 変換後に余白、線幅、300系接続の見え方を確認。選択図候補なので縮小時の可読性を優先 | 請求項1-16、明細書【0021】-【0023】、【0041】-【0045】 |
| Fig.2 | Internal filing candidate | 候補SVGで可視タイトル削除 | 下端の `150 Review presentation` が変換後に切れないか確認 | 請求項1-3,9,15,16、明細書【0024】-【0025】、【0039】-【0040】 |
| Fig.3 | Internal filing candidate | 候補SVGで可視タイトル削除 | approve / reject / comment のlabelが2値化後も読めるか確認 | 請求項1,3-5,10,15,16、明細書【0026】-【0028】、【0039】-【0041】 |
| Fig.4 | Internal filing candidate | 候補SVGで可視タイトル削除 | ER図風の1:N関係が正式図面として読みやすいか、変換後に線と文字を確認 | 請求項5-7,9,10,15,16、明細書【0029】-【0030】、【0033】、【0041】-【0042】 |
| Fig.5 | Internal filing candidate | 候補SVGで可視タイトル削除 | 分岐diamondと yes/no label の視認性を確認 | 請求項6,8-10,15,16、明細書【0031】-【0033】、【0042】 |
| Fig.6 | Conditional candidate | 候補SVGで可視タイトル削除 | WS-5を今回出願へ残すか分割候補へ下げるか未判断。正式提出対象に含めるかはまさ判断後 | 請求項11-12,10,15,16、明細書【0034】-【0035】、【0043】 |
| Fig.7 | Conditional candidate | 候補SVGで可視タイトル削除 | WS-6を今回出願へ残すか分割候補へ下げるか未判断。図面としては主軸に見せすぎない配置を維持 | 請求項13-14,10,15,16、明細書【0036】-【0037】 |
| Fig.8 | Improved candidate | 候補SVGで可視タイトルと内部注意文を削除 | 「同一画面」ではなく「関連画面群」寄りで最終化するかはまさ判断。ただし現OS整合上は関連画面群寄りが安全 | 請求項1,3-5,8-16、明細書【0026】、【0032】、【0035】、【0038】-【0039】 |

## Fig.8内部注意文の扱い

元SVGには、内部確認用の注意文として `Abstract display only` と、実スクリーンショット等を使っていない旨の説明が図中に入っていた。実値混入ではないが、正式図面には不要なため、候補SVGでは削除した。

削除後も、営業秘密境界は `filing_candidates/README.md` と本メモに残し、図面そのものには内部注意文を入れない。

## 残Blocker

1. **提出方式変換**
   - SVGのまま提出できるとは扱わない。
   - 提出ソフト / 方式に合わせて、モノクロ2値相当の画像へ変換する必要がある。

2. **変換後の実見確認**
   - 余白、線幅、文字サイズ、参照符号、矢印、分岐label、下端の切れを確認する。

3. **最新JPO方式確認**
   - 今回はWeb調査を行っていない。
   - 出願直前に、画像形式、サイズ、余白、モノクロ2値、符号、オンライン手続の最新条件を公式情報で確認する。

4. **まさ判断事項**
   - 請求項A/Bを独立2本で出すか。
   - WS-5 / Fig.6を今回出願に残すか。
   - WS-6 / Fig.7を今回出願に残すか。
   - 審査請求タイミング。
   - 30条例外要否。

5. **表記ゆれ**
   - 参照符号300は、明細書では `証拠参照`、図面READMEでは `異種証拠参照` として扱われている。意味は同じ範囲だが、正式提出前に表記を統一する。

## 提出直前TODO

1. `figures/filing_candidates/*.svg` を提出方式に合う画像形式へ変換する。
2. 変換画像を白黒2値化し、参照符号と小さいlabelの視認性を実見確認する。
3. Fig.1を選択図にする場合、縮小後でも全体構成が読めるか確認する。
4. Fig.6 / Fig.7を今回出願に残すか、分割候補へ下げるかを反映する。
5. Fig.8は「関連画面群」表現を維持するか、同一画面寄りに寄せるかを最終判断する。
6. 明細書【図面の簡単な説明】、【符号の説明】、請求項10-14、図面READMEの符号対応を再同期する。
7. 正式画像化後に、営業秘密scanを再実施する。

## 営業秘密scan

| category | result |
|---|---|
| 実案件名 / 顧客名 / 個人名 / 契約条件 | 混入なし |
| prompt全文 / few-shot / comment-to-guidance具体ロジック | 混入なし |
| score weight / threshold / calibration / 実設定値 | 混入なし |
| production DB row / source permalink / 実URL / 実DB名 | 混入なし |
| 実サービス名 / 実connector名 / connector認証 / 監視復旧情報 | 混入なし |
| 実画面スクリーンショット / 実UIデザイン | 混入なし |

## Readiness conclusion

**Formal figure readiness: Conditional / internally improved.**

Fig.1-Fig.8は、内部提出候補SVGとして一段前進した。特にFig.8の内部注意文と全図の長い可視タイトルは候補側から削除済み。

まだ正式提出図面ではない。最短の次アクションは、候補SVGを提出方式に合う画像へ変換し、白黒2値化後の可読性と符号対応を実見確認すること。
