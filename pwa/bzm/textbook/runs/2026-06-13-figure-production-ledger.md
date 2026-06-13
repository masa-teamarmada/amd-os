# 図版制作台帳 — 章頭ストーリー型 全28図

> 2026-06-13 / スタイル承認後の量産。混合モード (matplotlib データ図 / 自著SVG 構造図) + 日本語ラベル。
> 命名: データ図 = `fNN_*.png` (f10〜)、構造図 = `gNN_*.svg` (g01〜)。サンプル4枚は本番名にリネーム。
> 埋め込み記法: `![図 キャプション](/bzm/ファイル名)`。img タグは `.svg` もそのまま表示 (BzmMarkdown l.157)。

## サンプル承認済み (本番名へ確定)

| 旧サンプル名 | 本番名 | 章:行 | 手法 |
|---|---|---|---|
| sample_A_integration_compare.png | f10_integration_compare.png | score-and-bottleneck:83 | matplotlib |
| sample_B_ces_contour.png | f11_ces_contour.png | s-survival:155 | matplotlib |
| sample_C_two_layer.svg | g01_two_layer.svg | model-overview:136 | svg |
| sample_D_clock_rings.svg | g02_clock_rings.svg | field-clocks:63 | svg |

## データ図 (matplotlib) — 残り

| 本番名 | 章:行 | 内容 |
|---|---|---|
| f12_log_scale_ruler.png | score-and-bottleneck:133 | 1〜100,000 対数目盛り。例題45・練習255 のマーカー |
| f13_bottleneck_bar.png | score-and-bottleneck:216 | 律速診断 αi/(Xi+1) 降順横棒。R_net 突出、F・HRL 僅差 |
| f14_pt_staircase.png | p-potential:128 | 時間×P の階段グラフ。用途転換で P(t) ジャンプ |
| f15_slack_inverted_u.png | model-critiques:169 | 余力の逆U字。適正帯・両端の劣化注記 |

> ※ f12/f14/f15 は概念寄りだが「形が数式・論理で決まる」ためデータ図扱い (matplotlib)。
>   既存 f1-f9 と統一感を出す。

## 構造図 (自著SVG) — 残り

| 本番名 | 章:行 | 内容 |
|---|---|---|
| g03_pxrxs_concept.svg | why-valuation-fails:115 / model-overview:73 共用 | P×R×S 三因子の概念図 (山・階段・ランナー)。2章で共用 |
| g04_evolution_genealogy.svg | model-overview:154 | 進化系譜 3世代 年表型 |
| g05_timeline_before_zero.svg | field-before-zero:96 | Before Zero 時間軸帯。フェーズ+不可逆判断 |
| g06_uncertainty_map.svg | field-before-zero:138 | 七つの不確実性の地図 (中央シーズ+7領域) |
| g07_timing_window.svg | field-before-zero:164 | タイミングの窓 (早すぎ/適時/遅すぎ) |
| g08_ip_order.svg | field-gates:87 | 鬼門1 開示順序の時系列 |
| g09_registration_branch.svg | field-gates:156 | 鬼門2 三分岐+登記後連鎖 |
| g10_ceo_decompose.svg | field-gates:227 / field-who-carries:102 共用 | CEO四機能分解 |
| g11_go_wait_vocab.svg | field-gates:270 | GO/WAIT/NO_GO/HOLD 語彙 |
| g12_annual_calendar.svg | field-clocks:77 | 12ヶ月×関係者6帯 年表。締切重なりハイライト |
| g13_support_hollow.svg | field-clocks:113 | 支援の局所最適 (中央研究者+外向き矢印) |
| g14_role_template.svg | field-who-carries:146 | 90日役割メモ テンプレ |
| g15_failure_granularity.svg | field-who-carries:169 | 失敗記録の粒度比較 (粗1行 vs 4分解) |
| g16_toolkit_four.svg | field-toolkit:231 | 四枚の紙の関係図 |
| g17_nursery_two_layer.svg | nursery-ers:156 | 苗床×案件の二層 (加重和 vs 乗法) |
| g18_tam_sam_som.svg | p-potential:102 | TAM/SAM/SOM 同心円+証拠の質の階段 |
| g19_discount_split.svg | model-critiques:65 | 割引率の三つの仕事の分解 |
| g20_retrofit_flow.svg | retrofit-verification:139 | 検証二本立てフロー (retrofit/事前予測) |
| g21_r_five_cards.svg | r-readiness:47 | 「できています」が五枚に割れる扇 |
| g22_trl_matrix.svg | r-readiness:102 | 応用×組織 TRLマトリクス |
| g23_r_vs_y.svg | r-readiness:217 / s-survival:64 関連 | R と y の線引き (特許の二顔) |
| g24_survival_pillars.svg | s-survival:98 | 三要素の代替性 (三本柱+屋根 4パターン) |
| g25_survival_condition.svg | s-survival:64 | 生存条件式 B−R_net≤F の水位図 |

合計: matplotlib 6 (f10-f15) + svg 25 (g01-g25) = 31 図。うち共用で実章TODO 28個を充足。
