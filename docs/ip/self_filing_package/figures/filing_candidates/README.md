# Fig.1-Fig.8 filing candidate SVGs（内部候補）

- 作成日: 2026-06-02
- 位置づけ: まさ / 特許出願司令塔が正式提出図面化を判断するための内部候補。JPO提出ファイルそのものではない。
- 重要: 外部送付禁止。JPO提出禁止。弁理士問い合わせ禁止。
- 元ファイル: `docs/ip/self_filing_package/figures/fig1_system_overview.svg` から `fig8_integrated_review_ui.svg`
- 変更方針: 元SVGの白背景、黒線、黒文字、抽象構成要素を維持し、正式図面に不要な可視タイトルを削除した。Fig.8は内部注意文を削除した。

## 候補ファイル

| 図 | 候補SVG | 元SVGからの変更 | readiness |
|---|---|---|---|
| Fig.1 | `fig1_system_overview.svg` | 可視タイトルを削除 | 内部候補としてusable。正式変換後に余白と2値化確認 |
| Fig.2 | `fig2_candidate_evidence.svg` | 可視タイトルを削除 | 内部候補としてusable。下端の余白と文字つぶれ確認 |
| Fig.3 | `fig3_human_approval_master.svg` | 可視タイトルを削除 | 内部候補としてusable |
| Fig.4 | `fig4_protocol_example_structure.svg` | 可視タイトルを削除 | 内部候補としてusable |
| Fig.5 | `fig5_outcome_ledger.svg` | 可視タイトルを削除 | 内部候補としてusable |
| Fig.6 | `fig6_parameter_governance.svg` | 可視タイトルを削除 | 図面形式はusable。ただしWS-5を今回出願に残すかは未判断 |
| Fig.7 | `fig7_before_zero_recommendation.svg` | 可視タイトルを削除 | 図面形式はusable。ただしWS-6を今回出願に残すかは未判断 |
| Fig.8 | `fig8_integrated_review_ui.svg` | 可視タイトルと内部注意文を削除 | 内部候補としてusable。「関連画面群」寄りの表現を維持 |

## 残TODO

1. SVGのまま正式提出ファイルとは断定しない。
2. 提出ソフト又は提出方式に合わせた画像形式へ変換する。
3. 変換後に、余白、線幅、文字サイズ、参照符号、白黒2値化後の読解性を確認する。
4. Fig.6 / Fig.7は、請求項A/B、WS-5、WS-6のまさ判断後に残す / 分割候補へ下げる方針を反映する。
5. 正式画像化後に、明細書の符号説明、請求項、図面説明、営業秘密scanを再実施する。

## 営業秘密scan

- 実案件名、顧客名、個人名、契約条件、実URL、実DB名、実サービス名、実connector名、production DB row、source permalinkは入れていない。
- prompt全文、few-shot、score weight、threshold、calibration、実設定値は入れていない。
- Fig.8元SVGにあった内部注意文は、この候補SVGから削除済み。
