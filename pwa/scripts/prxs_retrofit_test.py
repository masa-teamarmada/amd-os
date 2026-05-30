#!/usr/bin/env python3
"""
P×R×S 新モデル（A: フラット9軸 Cobb-Douglas）のティエム retrofit 試算。

現行 AMD Score（7軸: σ_SU/TRL/BRL/GRL/SRL/HRL/FRL）に、
潜在規模 P と ライスワーク実益 RW の2軸を足した新式を、ティエム時系列に当てる。

  AMD Score_new = K·(P+1)^αP·∏(XRL+1)^α·(σ_SU+1)^ασ·(FRL+1)^αF·(RW+1)^αRW
                  └P┘        └─ R 到達度 ─┘ └──── S 生存確率(σ_SU·FRL·RW) ────┘

⚠️ 重み・校正・P/RW の値はすべて【仮置き】。retrofit で校正する前提のデモ。
史実（商社化せず RW=0）vs 反実仮想（エアロゲル商社 RW=5）を並べて自走性の効きを見る。
出力: pwa/public/bzm/_prxs_test.png（_ プレフィックス = 検証用、教科書非配信）
"""
import os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "bzm")
DPI = 150
plt.rcParams.update({"figure.facecolor": "white", "axes.facecolor": "white", "font.size": 11})

# --- 現行7軸 ---
A_CUR = {"sigma": 1.3, "trl": 1.0, "brl": 0.6, "grl": 0.3, "srl": 0.2, "hrl": 1.1, "frl": 1.5}
K_CUR = 100_000 / 10 ** sum(A_CUR.values())  # = 0.1

# --- 新9軸（仮置き重み）---
ALPHA_P = 1.0    # 潜在規模（仮）
ALPHA_RW = 0.8   # ライスワーク実益（仮）
A_NEW = {**A_CUR, "P": ALPHA_P, "rw": ALPHA_RW}
K_NEW = 100_000 / 10 ** sum(A_NEW.values())  # 全軸9で IPO=100,000 維持


def score_cur(sigma, trl, brl, grl, srl, hrl, frl):
    v = {"sigma": sigma, "trl": trl, "brl": brl, "grl": grl, "srl": srl, "hrl": hrl, "frl": frl}
    s = K_CUR
    for k, a in A_CUR.items():
        s *= (v[k] + 1) ** a
    return s


def score_new(P, sigma, trl, brl, grl, srl, hrl, frl, rw):
    v = {"P": P, "sigma": sigma, "trl": trl, "brl": brl, "grl": grl, "srl": srl, "hrl": hrl, "frl": frl, "rw": rw}
    s = K_NEW
    for k, a in A_NEW.items():
        s *= (v[k] + 1) ** a
    return s


# theory §9 ティエム時系列（year, σ, TRL, BRL, GRL, SRL, HRL, FRL）
ROWS = [
    (2007.0, 4, 1, 0, 3, 3, 0, 0),
    (2009.0, 5, 1, 1, 4, 4, 1, 2),
    (2011.25, 6, 2, 1, 5, 5, 1, 3),
    (2012.92, 7, 0, 1, 5, 5, 1, 4),   # 2012-11 設立
    (2014.0, 7, 1, 2, 6, 5, 2, 4),
    (2015.0, 7, 3, 2, 6, 5, 2, 4),
    (2017.0, 6, 4, 3, 5, 5, 3, 5),
]
P_FIX = 6          # 潜在規模（透明断熱窓市場、仮・時系列一定）
# 史実: 商社化せず、自走実益ほぼ無し（全期間 RW=0）
RW_HIST = {yr: 0 for yr, *_ in ROWS}
# 反実仮想: 2014頃からエアロゲル商社を立ち上げ、RW が時間で育つ（0→2→4→5）
RW_TRADE = {2007.0: 0, 2009.0: 0, 2011.25: 1, 2012.92: 2, 2014.0: 3, 2015.0: 4, 2017.0: 5}

xs = [r[0] for r in ROWS]
cur = [score_cur(*r[1:]) for r in ROWS]
new_hist = [score_new(P_FIX, *r[1:], RW_HIST[r[0]]) for r in ROWS]
new_trade = [score_new(P_FIX, *r[1:], RW_TRADE[r[0]]) for r in ROWS]

print(f"K_CUR={K_CUR:.4g}  K_NEW={K_NEW:.4g}  Σα_new={sum(A_NEW.values())}")
print(f"{'year':>8} {'current':>10} {'new RW=0':>10} {'new RW=5':>10}  trade/hist")
for i, r in enumerate(ROWS):
    ratio = new_trade[i] / new_hist[i]
    print(f"{r[0]:>8} {cur[i]:>10.1f} {new_hist[i]:>10.1f} {new_trade[i]:>10.1f}  {ratio:>6.2f}x")

fig, ax = plt.subplots(figsize=(9.5, 5.4))
ax.plot(xs, cur, "-o", color="#999999", lw=1.6, ms=4, label="current 7-axis AMD Score")
ax.plot(xs, new_hist, "-s", color="#d62728", lw=1.8, ms=5,
        label="new P×R×S, RW=0 (history: no rice-work)")
ax.plot(xs, new_trade, "-^", color="#2ca02c", lw=1.8, ms=6,
        label="new P×R×S, RW rising (counterfactual: aerogel trading from ~2014)")
ax.axvline(2012.92, color="gray", ls=":", lw=1)
ax.text(2012.99, 1.2, "founding 2012", fontsize=8, color="gray", rotation=90, va="bottom")
ax.set_yscale("log")
ax.set_xlabel("year")
ax.set_ylabel("score (log scale)")
ax.set_title("P×R×S test (A: flat 9-axis) — Tiem retrofit\n"
             f"rice-work (RW) lifts survival prob S; P={P_FIX} fixed; weights provisional",
             fontsize=12)
ax.legend(loc="upper left", fontsize=8.5)
ax.grid(True, which="both", alpha=0.25)
fig.savefig(os.path.join(OUT, "_prxs_test.png"), dpi=DPI, bbox_inches="tight", facecolor="white")
print("wrote public/bzm/_prxs_test.png")
