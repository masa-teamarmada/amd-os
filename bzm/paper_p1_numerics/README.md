# paper_p1_numerics — SM-C.5 実行記録 (R4b, 2026-07-05)

P1 (Research Policy 論文) の SM-C.5 数値演習の再現パッケージ。Fig.3 (`../paper_p1_fig3.svg`) と SM-C 本文に引用された全数値の出所。

- `solver.py` — 3-regime × (σ,F) 2D obstacle problem の numpy-only ソルバ + 全診断 (mesh/MS-limit/up-set/GEN transversality/sign sweeps/corner exhibits)。実行 ~3秒
- `results.md` — 数値記録 (パラメータ・θ*(k;F) 曲線・診断 A–F・モデル再解釈台帳 n1–n8・rewrite queue)
- `results.json` / `run.log` — 生出力
- `gen_fig3.py` — Fig.3 SVG 生成スクリプト

全パラメータは synthetic・完全開示 (PF-010 の校正定数非公開は §6 の proprietary 値のみに適用、この演習には不適用)。S6 で SM sources として OSF deposit する際はこのディレクトリごと。
