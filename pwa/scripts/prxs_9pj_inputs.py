#!/usr/bin/env python3
"""
P×R×S 新式（フラット9軸 Cobb-Douglas）の 9PJ 横断 retrofit 入力データ。

各PJの「設立時点（または設立準備時点）スナップショット」を、根拠付きで 0-9 化する。
- XRL (TRL/BRL/GRL/SRL/HRL): L2 project_xrl_log の設立時点行を基準（GRL/SRLはL2全null→各md/レーン特性から補完、補完は CONF='low'）。
- sigma (σ_SU): 各 tiem.md 等の Triple Helix 評価 + レーンのマクロ追い風から。
- frl (FRL): 創業体制の経営力（まさ口述ベース）。
- P (潜在規模): Web市場調査（各md「P（潜在規模）」節）を 0-9 へ。
- rnet (収益化指数 R_net, 旧RW): L2の収益事実 + まさ口述。系統I/II区別せず（まさ確定2026-05-30）。

⚠️ 全値は【根拠付きの第一次置き】。0-9 化には主観が入るので各値に rationale を必須併記。
   絶対値ではなく PJ 間の相対順位と形状を見る。重み校正前。
出力: 数値表（stdout）+ レーダー/バー比較図 public/bzm/_prxs_9pj.png（_ = 検証用・非配信）

正式軸名（まさ確定 2026-05-30）: 収益化指数 (R_net)。「RW」は積と誤読されるため廃止。
"""
import os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "bzm")
DPI = 150
plt.rcParams.update({"figure.facecolor": "white", "axes.facecolor": "white", "font.size": 10})

# ---- 重み（仮置き、theory §P×R×S。校正前）----
ALPHA = {"P": 1.0, "sigma": 1.3, "frl": 1.5, "rnet": 0.8,
         "trl": 1.0, "brl": 0.6, "grl": 0.3, "srl": 0.2, "hrl": 1.1}
SUM_A = sum(ALPHA.values())          # = 7.8 (現行7軸6.0 + αP1.0 + αrnet0.8)
K = 100_000 / 10 ** SUM_A            # 全軸=9 で IPO=100,000

# ---- 9PJ 設立(準備)時点スナップショット ----
# 値は 0-9。rationale は根拠（L2=project_xrl_log / md = knowledge/*.md / web = 市場調査 / 口述）。
# P_note / rnet_note は P と 収益化指数 の根拠。
PJ = {
 "tiem(2012設立)": dict(
    P=8, sigma=6, frl=4, rnet=0, trl=0, brl=1, grl=2, srl=2, hrl=2,
    note="L2設立行 TRL3/BRL1/HRL2 だが、まさ訂正で自社内製TRL=0(tiem.md)。"
         "P=8: エアロゲル断熱材→断熱窓247億$射程(tiem.md web)。"
         "σ=6: Triple Helix中-高(tiem.md)。frl=4: まさ個人初起業。"
         "rnet=0: 商社/受託せず(史実)=自走収益ゼロ。grl/srl=2: 省エネ追い風だが規制未整備(補完low)。"),
 "KT(2022設立)": dict(
    P=6, sigma=6, frl=6, rnet=4, trl=4, brl=3, grl=3, srl=4, hrl=3,
    note="L2設立行 TRL4/BRL3/HRL3。P=6: 農業ロボ世界81-152億$/日本15億$へ(KT.md web)。"
         "σ=6: 農業労働力不足の追い風。frl=6: 東北大Tamir+VC(CA)伴走でCOO派遣。"
         "rnet=4: Adam早期販売(系統II,KT.md)。grl/srl補完low。"),
 "CTB(2023設立)": dict(
    P=8, sigma=6, frl=5, rnet=0, trl=4, brl=3, grl=4, srl=5, hrl=4,
    note="L2設立行 TRL4/BRL3/HRL4。P=8: 虚血性脳卒中薬139→259億$(ctb.md web)。"
         "σ=6: AMED神経保護追い風。frl=5: まさCOO+創薬体制。"
         "rnet=0: 創薬で治験中売上ゼロ=F(AMED)依存(まさ見解: RW=0でも型確立でS確保)。"
         "grl4/srl5: 薬事プロセス型確立で社会受容高(補完low)。"),
 "LST(2023設立)": dict(
    P=7, sigma=7, frl=6, rnet=4, trl=4, brl=2, grl=3, srl=5, hrl=3,
    note="L2設立行 TRL4/BRL2/HRL3。P=7: 2030売上300億/BESS年50%成長(LST.md web)。"
         "σ=7: Li資源安保・EV電池リサイクルの強い追い風。frl=6: 星野CEO+まさCOO+UMI(Before0)。"
         "rnet=4: リサイクル先行(年4-12億試算,系統I,LST.md)だが補助金後払いでR_net圧迫。grl/srl補完low。"),
 "JC(2023設立)": dict(
    P=5, sigma=6, frl=3, rnet=2, trl=0, brl=2, grl=4, srl=5, hrl=2,
    note="L2設立行 TRL3/BRL2/HRL2 だが、まさ訂正で設立時自社技術TRL=0(jc.md,SaaSのみ)。"
         "P=5: 産廃5.3兆円だが熱分解油は世界11億$(jc.md web)。σ=6: GXサーキュラー追い風。"
         "frl=3: 小柳氏(理系素養なし)+株主/bizdevがR&D非理解(jc.md)。"
         "rnet=2: 装置販売前夜JB-02A設計中、本命と利害対立(jc.md)。grl/srl補完low。"),
 "BWE(2025設立)": dict(
    P=8, sigma=6, frl=3, rnet=0, trl=4, brl=3, grl=4, srl=5, hrl=3,
    note="L2設立行(2025-04) TRL4/BRL3/HRL3 ※L2のp11は別系列(2019設立)混在に注意→md(BWE.md)設立2025-04-28を採用。"
         "P=8: RED発電グローバル原発1000基相当potential(BWE.md)。σ=6: SIP/省エネ追い風。"
         "frl=3: まりCEO/はるCOO経営未熟(BWE.md)。"
         "rnet=0: 大型装置で初販売遠い、膜外販RW候補も未着手(BWE.md)。grl/srl補完low。"),
 "CX(2026設立前)": dict(
    P=7, sigma=7, frl=6, rnet=3, trl=3, brl=2, grl=3, srl=5, hrl=3,
    note="L2設立前行(2026-04) TRL3/BRL2/HRL3。P=7: 希釈冷凍機5億$+量子計算25億$波及(cx.md web)。"
         "σ=7: 量子に資金殺到=外部資金環境◎。frl=6: 神谷氏+まさ+BuildVC。"
         "rnet=3: アカデミアTES+ADR有料製作(KEK/JAXA実需,系統II先行収益,cx.md)。grl/srl補完low。"),
 "SX(2026設立準備)": dict(
    P=8, sigma=6, frl=6, rnet=2, trl=4, brl=3, grl=3, srl=4, hrl=3,
    note="L2 2026-05行 TRL4/BRL3/HRL3。P=8: 排水処理TAM3兆円/FY35売上200億(sx.md web)。"
         "σ=6: カーボンニュートラル排水追い風。frl=6: 杉浦先生+まさ統括+かる/ちこ体制。"
         "rnet=2: 設立前で売上未発生、装置+サブスク計画(系統II,sx.md)。grl/srl補完low(GMO規制論点で grl やや低め)。"),
 "YD(2019設立相当)": dict(
    P=2, sigma=4, frl=2, rnet=0, trl=4, brl=2, grl=3, srl=4, hrl=2,
    note="L2設立行 TRL4/BRL2/HRL2(p18)。P=2: 波力は原理的UE不成立で天井低い(yd.md web,57円/kWh)。"
         "σ=4: 海洋エネは国内マクロ弱。frl=2: 中山氏(行政書士,開発者でない)。"
         "rnet=0: 販売未到達・自己資金試作のみ(yd.md)。失敗対照群。grl/srl補完low。"),
}

AXES = ["P", "sigma", "frl", "rnet", "trl", "brl", "grl", "srl", "hrl"]
LABELS = {"P": "P", "sigma": "sigma_SU", "frl": "FRL", "rnet": "R_net",
          "trl": "TRL", "brl": "BRL", "grl": "GRL", "srl": "SRL", "hrl": "HRL"}
# 図は英語ラベル（matplotlib デフォルトフォントが日本語非対応のため）
NAME_EN = {
    "tiem(2012設立)": "tiem (2012)", "KT(2022設立)": "KT (2022)", "CTB(2023設立)": "CTB (2023)",
    "LST(2023設立)": "LST (2023)", "JC(2023設立)": "JC (2023)", "BWE(2025設立)": "BWE (2025)",
    "CX(2026設立前)": "CX (2026 pre)", "SX(2026設立準備)": "SX (2026 prep)", "YD(2019設立相当)": "YD (2019)",
}


def score(v):
    s = K
    for a in AXES:
        s *= (v[a] + 1) ** ALPHA[a]
    return s


# 概念分解 P / R(到達度=XRL積) / S(生存=σ·FRL·収益化指数)
def decompose(v):
    P = (v["P"] + 1) ** ALPHA["P"]
    R = np.prod([(v[a] + 1) ** ALPHA[a] for a in ("trl", "brl", "grl", "srl", "hrl")])
    S = ((v["sigma"] + 1) ** ALPHA["sigma"]) * ((v["frl"] + 1) ** ALPHA["frl"]) * ((v["rnet"] + 1) ** ALPHA["rnet"])
    return P, R, S


print(f"K={K:.4g}  Σα={SUM_A}")
print(f"{'PJ':<20}{'P':>4}{'σ':>3}{'F':>3}{'Rnet':>5}{'TRL':>4}{'BRL':>4}{'GRL':>4}{'SRL':>4}{'HRL':>4}{'Score':>10}")
rows = []
for name, v in PJ.items():
    s = score(v)
    rows.append((name, s, v))
    print(f"{name:<20}{v['P']:>4}{v['sigma']:>3}{v['frl']:>3}{v['rnet']:>5}"
          f"{v['trl']:>4}{v['brl']:>4}{v['grl']:>4}{v['srl']:>4}{v['hrl']:>4}{s:>10.0f}")

print("\n--- P / R / S 分解 ---")
print(f"{'PJ':<20}{'P':>10}{'R(XRL積)':>12}{'S(生存)':>12}{'Score':>10}")
for name, s, v in rows:
    P, R, S = decompose(v)
    print(f"{name:<20}{P:>10.1f}{R:>12.1f}{S:>12.1f}{s:>10.0f}")

# ---- 図: スコア横棒（収益化指数で色分け）----
rows_sorted = sorted(rows, key=lambda r: r[1])
names = [NAME_EN[r[0]] for r in rows_sorted]
scores = [r[1] for r in rows_sorted]
rnets = [r[2]["rnet"] for r in rows_sorted]

fig, ax = plt.subplots(figsize=(10, 5.6))
cmap = plt.cm.viridis
cols = [cmap(rn / 9) for rn in rnets]
bars = ax.barh(names, scores, color=cols)
ax.set_xscale("log")
ax.set_xlabel("AMD Score (P x R x S, log scale) -- provisional weights")
ax.set_title("9PJ retrofit (flat 9-axis, founding-time snapshot)\n"
             "color = R_net (revenue self-sustain index); values are evidence-based first-pass, pre-calibration", fontsize=11)
sm = plt.cm.ScalarMappable(cmap=cmap, norm=plt.Normalize(0, 9))
cb = fig.colorbar(sm, ax=ax, pad=0.02)
cb.set_label("R_net (0-9)")
for b, s in zip(bars, scores):
    ax.text(s * 1.05, b.get_y() + b.get_height() / 2, f"{s:.0f}", va="center", fontsize=8)
ax.grid(True, which="both", axis="x", alpha=0.25)
fig.tight_layout()
fig.savefig(os.path.join(OUT, "_prxs_9pj.png"), dpi=DPI, bbox_inches="tight", facecolor="white")
print("\nwrote public/bzm/_prxs_9pj.png")
