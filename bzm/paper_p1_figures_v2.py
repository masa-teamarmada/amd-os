#!/usr/bin/env python3
"""P1論文 (v2) の図を生成する。出力: bzm/figures_v2/*.png

データはすべて凍結版 (main 34aaa284 / 承認 #2026-08-29-1・-2) の正本から取る。
- fig2/fig3: モデルページ §6.I-11-2 の縮退検査表 (凍結版) と、その前身の吸収壁ありの版
- fig4: model/cases/SCORES.md の21件 (凍結版)
ラベルは出版慣習に従い英語。
"""
import os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "figures_v2")
os.makedirs(OUT, exist_ok=True)
DPI = 200

plt.rcParams.update({
    "figure.facecolor": "white", "axes.facecolor": "white",
    "font.family": "sans-serif",
    "font.sans-serif": ["Helvetica Neue", "Helvetica", "Arial", "DejaVu Sans"],
    "font.size": 11, "axes.labelsize": 11.5, "axes.titlesize": 12.5,
    "xtick.labelsize": 10, "ytick.labelsize": 10, "legend.fontsize": 10,
    "axes.spines.top": False, "axes.spines.right": False,
    "axes.linewidth": 0.8, "grid.linewidth": 0.5, "grid.alpha": 0.35,
})

INK = "#1c1c1c"; MUTED = "#6b6b6b"; RULE = "#c9c5bd"
# 出口の形ごとの色 (色覚多様性に配慮した順序尺度)
C_SELF = "#1f4e79"; C_REC = "#4a90c4"; C_LIC = "#7fb069"; C_MA = "#d9a441"
C_IP = "#c47f4a"; C_TERM = "#b8b3aa"; C_UNDEC = "#e0dcd4"

CELLS = ["F1", "F2", "F3", "F4"]
REGS = ["REG-0", "REG-1", "REG-2"]
CELL_NAMES = {"F1": "Process", "F2": "Device", "F3": "Software", "F4": "Service"}

# 凍結版 §6.I-11-2: key=(type,reg) -> dict
FROZEN = {
 ("F1","REG-0"): dict(m4=28.2, self_=28.2, rec=0.0, lic=10.8, ip=3.2, ma=4.0, term=50.2, und=3.7, cont=53.4, v=0.393),
 ("F1","REG-1"): dict(m4=20.6, self_=20.6, rec=0.0, lic=12.8, ip=3.6, ma=5.9, term=52.9, und=4.2, cont=56.5, v=0.336),
 ("F1","REG-2"): dict(m4=0.0,  self_=0.0,  rec=0.0, lic=25.6, ip=4.4, ma=9.6, term=55.9, und=4.3, cont=75.1, v=0.216),
 ("F2","REG-0"): dict(m4=31.2, self_=31.2, rec=0.0, lic=11.9, ip=3.5, ma=4.5, term=46.7, und=2.2, cont=50.3, v=0.437),
 ("F2","REG-1"): dict(m4=23.1, self_=23.1, rec=0.0, lic=14.1, ip=4.0, ma=6.7, term=49.6, und=2.5, cont=53.3, v=0.381),
 ("F2","REG-2"): dict(m4=3.2,  self_=3.2,  rec=0.0, lic=26.7, ip=4.8, ma=12.1, term=50.9, und=2.2, cont=58.2, v=0.268),
 ("F3","REG-0"): dict(m4=31.3, self_=38.6, rec=7.3, lic=13.1, ip=3.0, ma=11.4, term=33.9, und=0.0, cont=38.0, v=0.531),
 ("F3","REG-1"): dict(m4=23.6, self_=29.2, rec=5.6, lic=18.0, ip=4.4, ma=10.8, term=37.5, und=0.1, cont=40.6, v=0.456),
 ("F3","REG-2"): dict(m4=9.1,  self_=13.1, rec=4.0, lic=27.7, ip=5.0, ma=18.4, term=35.8, und=0.0, cont=43.0, v=0.426),
 ("F4","REG-0"): dict(m4=17.3, self_=52.3, rec=35.0, lic=9.8, ip=2.2, ma=8.5, term=27.2, und=0.0, cont=33.5, v=0.458),
 ("F4","REG-1"): dict(m4=13.1, self_=44.0, rec=31.0, lic=13.9, ip=3.5, ma=8.3, term=30.3, und=0.0, cont=35.3, v=0.421),
 ("F4","REG-2"): dict(m4=4.3,  self_=32.4, rec=28.2, lic=20.9, ip=3.8, ma=13.9, term=29.0, und=0.0, cont=37.0, v=0.406),
}
# 吸収壁あり (会社化前も資金切れで終端する定式化) の同一検査
ABSORB_TERM = {("F1","REG-0"):80.0, ("F1","REG-1"):81.0, ("F1","REG-2"):81.4,
 ("F2","REG-0"):76.6, ("F2","REG-1"):77.8, ("F2","REG-2"):77.6,
 ("F3","REG-0"):63.8, ("F3","REG-1"):65.8, ("F3","REG-2"):65.4,
 ("F4","REG-0"):55.3, ("F4","REG-1"):57.0, ("F4","REG-2"):57.0}
ABSORB_SELF = {("F1","REG-0"):11.3, ("F1","REG-1"):8.3, ("F1","REG-2"):0.0,
 ("F2","REG-0"):13.6, ("F2","REG-1"):10.0, ("F2","REG-2"):1.4,
 ("F3","REG-0"):21.9, ("F3","REG-1"):16.6, ("F3","REG-2"):6.9,
 ("F4","REG-0"):33.6, ("F4","REG-1"):28.7, ("F4","REG-2"):21.4}

def save(fig, name):
    p = os.path.join(OUT, name)
    fig.savefig(p, dpi=DPI, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print("wrote", p)

# ---------------------------------------------------------------- Figure 1
def fig1_framework():  # Figure 1 (§4.1)
    fig, ax = plt.subplots(figsize=(7.4, 5.4))
    ax.set_xlim(0, 100); ax.set_ylim(0, 100); ax.axis("off")

    def box(x, y, w, h, title, lines, fc="#ffffff", ec=INK, lw=1.1):
        ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0,rounding_size=1.6",
                                    fc=fc, ec=ec, lw=lw, zorder=2))
        ax.text(x + w/2, y + h - 4.2, title, ha="center", va="center",
                fontsize=10.2, fontweight="bold", color=INK, zorder=3)
        for i, ln in enumerate(lines):
            ax.text(x + w/2, y + h - 10.0 - i*4.6, ln, ha="center", va="center",
                    fontsize=8.2, color=MUTED, zorder=3)

    def arrow(x1, y1, x2, y2, rad=0.0):
        ax.add_patch(FancyArrowPatch((x1, y1), (x2, y2), arrowstyle="-|>", lw=1.2,
                                     color=INK, mutation_scale=13, shrinkA=2, shrinkB=2,
                                     zorder=4, connectionstyle=f"arc3,rad={rad}"))

    # 見出しの式
    ax.text(50, 96, "$V=\\int \\mathbb{E}[\\Pi(\\omega)\\mid\\theta]\\,dB_0(\\theta)$",
            ha="center", va="center", fontsize=14, color=INK)
    ax.text(50, 89.5, "inner: scenario branching (irreducible)    ·    outer: parameter ignorance (reducible)",
            ha="center", va="center", fontsize=8.8, color=MUTED)

    # 左列: 入力2つ
    box(0, 48, 33, 33, "Observable state  $x_t$",
        ["next gate · free and restricted cash", "unresolved rights · incorporation",
         "contract lock-in · active uses", "history · review countdown"], fc="#f7f5f1")
    box(0, 8, 33, 33, "Project parameters  $\\theta$",
        ["conversion capacity · carrier fill", "momentum · technical core",
         "appropriability · ceilings", "counterfactual · self-propulsion"], fc="#f7f5f1")
    ax.text(16.5, 4.0, "estimated from evidence; prior $B_0(\\theta)$",
            ha="center", va="center", fontsize=8.4, style="italic", color=MUTED)

    # 中列: 計画
    box(37, 30, 29, 51, "Registered plan  $\\pi^{\\mathrm{plan}}$",
        ["gate order", "failure branching", "incorporation condition", "offer response",
         "contract policy", "stop rule", "", "conditioned on observables", "— never on $\\theta$"],
        fc="#eef3f7", ec="#1f4e79")
    ax.text(51.5, 25.0, "monthly forward pass", ha="center", va="center",
            fontsize=9.6, fontweight="bold", color=INK)
    ax.text(51.5, 20.0, "deadlines · hazards · draws", ha="center", va="center", fontsize=8.6, color=MUTED)
    ax.text(51.5, 15.6, "rules · cash · absorption", ha="center", va="center", fontsize=8.6, color=MUTED)

    # 右列: 出口と価値
    box(70, 52, 30, 29, "Nine terminal classes",
        ["self-sufficiency (in / after plan)", "licensing · M&A · IP sale",
         "pivot · withdrawal", "liquidation · undecided"], fc="#f4f7f2", ec="#4a7c40")
    box(70, 12, 30, 29, "Value  $V$  (JPY)",
        ["net domestic value added", "− displacement", "− counterfactual",
         "all exits on one scale"], fc="#fbf6ea", ec="#a8801f")

    arrow(33, 64, 37, 61); arrow(33, 24, 37, 44)
    arrow(66, 62, 70, 64)
    arrow(85, 52, 85, 41)
    save(fig, "fig1_framework.png")

def fig4_fifth_premise():  # Figure 4 (§7.5)
    fig, ax = plt.subplots(figsize=(7.4, 3.9))
    keys = [(t, r) for t in CELLS for r in REGS]
    x = np.arange(len(keys)); w = 0.38
    a = [ABSORB_TERM[k] for k in keys]
    b = [FROZEN[k]["term"] for k in keys]
    ax.bar(x - w/2, a, w, label="Cash-out as death (firm premise imported)",
           color="#b8b3aa", edgecolor=INK, linewidth=0.6)
    ax.bar(x + w/2, b, w, label="Cash-out as speed change (fifth premise)",
           color="#1f4e79", edgecolor=INK, linewidth=0.6)
    for xi, (ai, bi) in enumerate(zip(a, b)):
        ax.text(xi + w/2, bi + 1.8, f"−{ai-bi:.0f}", ha="center", fontsize=8.2, color="#1f4e79")
    ax.set_xticks(x)
    ax.set_xticklabels([f"{t}\n{r.replace('REG-','R')}" for t, r in keys], fontsize=9.5)
    ax.set_ylabel("Probability mass ending in termination (%)")
    ax.set_ylim(0, 92); ax.yaxis.grid(True, color=RULE)
    ax.set_axisbelow(True)
    ax.legend(frameon=False, loc="upper right", ncol=1)
    ax.set_title("Modelling pre-incorporation cash-out as death, versus as a change of speed",
                 loc="left", pad=8)
    save(fig, "fig4_fifth_premise.png")

# ---------------------------------------------------------------- Figure 3
def fig5_exit_structure():  # Figure 5 (§7.5)
    fig, ax = plt.subplots(figsize=(7.4, 4.0))
    keys = [(t, r) for t in CELLS for r in REGS]
    x = np.arange(len(keys)); w = 0.62
    d = [FROZEN[k] for k in keys]
    m4 = np.array([v["m4"] for v in d]); rec = np.array([v["rec"] for v in d])
    lic = np.array([v["lic"] for v in d]); ma = np.array([v["ma"] for v in d])
    ip = np.array([v["ip"] for v in d]); term = np.array([v["term"] for v in d])
    und = np.array([v["und"] for v in d])
    layers = [(m4, C_SELF, "Self-sufficiency via production contract"),
              (rec, C_REC, "Self-sufficiency via recurring earnings"),
              (lic, C_LIC, "Licensing"), (ma, C_MA, "M&A"), (ip, C_IP, "IP sale"),
              (term, C_TERM, "Termination"), (und, C_UNDEC, "Undecided")]
    bottom = np.zeros(len(keys))
    for vals, col, lab in layers:
        ax.bar(x, vals, w, bottom=bottom, label=lab, color=col, edgecolor="white", linewidth=0.5)
        bottom += vals
    ax.set_xticks(x)
    ax.set_xticklabels([f"{t}\n{r.replace('REG-','R')}" for t, r in keys], fontsize=9.5)
    ax.set_ylabel("Probability of terminal class (%)")
    ax.set_ylim(0, 113); ax.set_yticks([0,20,40,60,80,100]); ax.yaxis.grid(True, color=RULE); ax.set_axisbelow(True)
    ax.legend(frameon=False, loc="upper center", bbox_to_anchor=(0.5, -0.17), ncol=4, fontsize=9.4, columnspacing=1.4, handlelength=1.4)
    ax.set_title("Exit structure differs by process type and regulatory regime — priced on one scale",
                 loc="left", pad=20)
    for i, t in enumerate(CELLS):
        ax.text(i*3 + 1, 104, CELL_NAMES[t], ha="center", fontsize=10, fontweight="bold", color=INK)
    save(fig, "fig5_exit_structure.png")


# ---------------------------------------------------------------- Figure 4
# model/cases/SCORES.md (凍結版 91385d77) の21件。単位は10億円 (JPY bn)。
# layer: "pre" = 未会社化 (主標本) / "inc" = 会社化済みスピンアウト (遡及評価)
#        "ext" = ドメイン外 (既存企業内シーズ・法人化の意思なし)
SCORES = [
 ("F2·R0", 42.40, 48.97, 58.30, "inc"), ("F1·R0", 14.00, 16.16, 18.33, "inc"),
 ("F2·R0", 9.000, 12.79, 15.91, "pre"),  ("F1·R0", 5.670, 7.690, 11.970, "inc"),
 ("F1·R1", 2.600, 4.580, 6.180, "pre"),  ("F2·R0", 2.620, 3.380, 4.150, "inc"),
 ("F1·R2", 2.900, 2.990, 3.000, "inc"),  ("F2·R0", 0.980, 1.400, 1.700, "pre"),
 ("F1·R0", 0.850, 0.910, 0.970, "inc"),  ("F2·R1", 0.670, 0.680, 0.690, "inc"),
 ("F1·R0", 0.470, 0.620, 0.820, "inc"),  ("F1·R0", 0.340, 0.520, 0.740, "pre"),
 ("F2·R0", 0.470, 0.500, 0.550, "inc"),  ("F1·R0", 0.250, 0.300, 0.360, "inc"),
 ("F1·R0", 0.100, 0.140, 0.400, "inc"),  ("F1·R0", 0.0598, 0.110, 0.150, "pre"),
 ("F2·R0", 0.0928, 0.100, 0.160, "pre"), ("F2·R1", 0.0403, 0.0403, 0.0404, "inc"),
 ("F2·R1", 0.0052, 0.0127, 0.0274, "ext"), ("F2·R1", 0.0048, 0.0053, 0.0061, "inc"),
 ("F3·R0", 0.00045, 0.00105, 0.00519, "inc"),
]

def fig2_scores():  # Figure 2 (§7.1)
    fig, ax = plt.subplots(figsize=(7.4, 5.6))
    n = len(SCORES)
    order = sorted(range(n), key=lambda i: SCORES[i][2])
    style = {"pre": ("#1f4e79", "o", "Pre-incorporation (main sample)"),
             "inc": ("#7fb069", "s", "Incorporated spin-out (retrospective)"),
             "ext": ("#c47f4a", "^", "Outside the domain (excluded)")}
    seen = set()
    letters = "ABCDEFGHIJKLMNOPQRSTU"
    ylabels = []
    for row, i in enumerate(order):
        lab, lo, mid, hi, layer = SCORES[i]
        col, mk, legend = style[layer]
        ax.plot([lo, hi], [row, row], color=col, lw=1.6, alpha=0.55, solid_capstyle="round", zorder=2)
        ax.plot([mid], [row], marker=mk, ms=5.2, color=col, zorder=3,
                label=legend if layer not in seen else None,
                markeredgecolor="white", markeredgewidth=0.6)
        seen.add(layer)
        ratio = hi / lo if lo > 0 else float("nan")
        ax.text(hi * 1.6, row, f"×{ratio:.1f}", va="center", fontsize=8.2, color=MUTED)
        ylabels.append(f"{letters[n-1-row]}  {lab}")
    ax.set_yticks(range(n)); ax.set_yticklabels(ylabels, fontsize=9)
    ax.set_xscale("log")
    ax.set_xlim(2e-4, 4e2)
    ax.set_xlabel("Industrial value creation, JPY billion (log scale)")
    ax.xaxis.grid(True, color=RULE); ax.set_axisbelow(True)
    ax.set_ylim(-0.9, n - 0.1)
    ax.legend(frameon=False, loc="lower right", fontsize=9.4)
    ax.set_title("Twenty-one projects on one screening ledger, at the frozen model version", loc="left", pad=8)
    save(fig, "fig2_score_distribution.png")


# ---------------------------------------------------------------- Figure 3 (dual scoring)
import json as _json
def fig3_dual_scoring():  # Figure 3 (§7.3)
    d = _json.load(open("/tmp/dual_data.json"))
    d = sorted(d, key=lambda x: -x["eli"])
    fig, ax = plt.subplots(figsize=(7.4, 5.2))
    LAYCOL = {"pre": "#1f4e79", "inc": "#7fb069", "ext": "#c47f4a"}
    LAYLAB = {"pre": "Pre-incorporation (main sample)", "inc": "Incorporated spin-out",
              "ext": "Outside the domain"}
    seen = set()
    for row, x in enumerate(d):
        y = len(d) - 1 - row
        rec, eli = x["rec"] / 1e9, x["eli"] / 1e9
        col = LAYCOL[x["layer"]]
        moved = x["ratio"] > 1.05
        if moved:
            ax.annotate("", xy=(eli, y), xytext=(rec, y),
                        arrowprops=dict(arrowstyle="-|>", lw=1.5, color=col,
                                        mutation_scale=11, shrinkA=2, shrinkB=1))
        ax.plot([rec], [y], marker="o", ms=4.6, mfc="white", mec=col, mew=1.4, zorder=3)
        ax.plot([eli], [y], marker="o", ms=5.0, color=col, zorder=4,
                label=LAYLAB[x["layer"]] if x["layer"] not in seen else None)
        seen.add("rec"); seen.add(x["layer"])
        if moved:
            ax.text(max(rec, eli) * 1.7, y, f"×{x['ratio']:.0f}" if x["ratio"] >= 10 else f"×{x['ratio']:.1f}",
                    va="center", fontsize=8.2, color=col)
    ax.set_yticks(range(len(d)))
    ax.set_yticklabels([f'{x["anon"]}  {x["cell"]}' for x in reversed(d)], fontsize=9)
    ax.set_xscale("log"); ax.set_xlim(3e-5, 4e2)
    ax.set_xlabel("Industrial value creation, JPY billion (log scale)")
    ax.xaxis.grid(True, color=RULE); ax.set_axisbelow(True)
    ax.set_ylim(-0.9, len(d) - 0.1)
    from matplotlib.lines import Line2D
    h, l = ax.get_legend_handles_labels()
    h = [Line2D([], [], marker="o", ms=5.2, mfc="white", mec=MUTED, mew=1.4, ls="none")] + h
    l = ["Records only (open marker)"] + l
    ax.legend(h, l, frameon=False, loc="lower right", fontsize=9.0, handletextpad=0.6)
    ax.set_title("Scoring the same projects twice: what the database holds, and what people know",
                 loc="left", pad=8)
    save(fig, "fig3_dual_scoring.png")

if __name__ == "__main__":
    fig1_framework(); fig2_scores(); fig3_dual_scoring(); fig4_fifth_premise(); fig5_exit_structure()
    print("done")
