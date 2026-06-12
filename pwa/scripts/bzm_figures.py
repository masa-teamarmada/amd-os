#!/usr/bin/env python3
"""
BZM 教科書・論文用データ図を生成する。
出力先: pwa/public/bzm/*.png

データ図 (数式・確定データから決まる図) のみ生成する。
概念図 (二層構造フロー G1 / Triple Helix 螺旋 G3) は外部画像生成が要るのでここでは作らない。
retrofit 時系列 (F3) は B 案 = theory §9 の各時点軸値を Cobb-Douglas に入れて
自己整合再計算した AMD Score をプロットする (= 期待値の転記ではなく数式から決まる
データ図なので捏造ではない)。専門家期待値との乖離は論文 §5.4 限界1 で別途明示。

ラベルは出版慣習に従い英語 (matplotlib 日本語フォント依存を避ける)。
正本: pwa/design/amd_score.md / institution_readiness.md。
"""
import os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D  # noqa: F401

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "bzm")
os.makedirs(OUT, exist_ok=True)
DPI = 150

plt.rcParams.update({
    "figure.facecolor": "white",
    "axes.facecolor": "white",
    "font.size": 11,
    "axes.titlesize": 13,
})


def save(fig, name):
    path = os.path.join(OUT, name)
    fig.savefig(path, dpi=DPI, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print("wrote", os.path.relpath(path))


# ---------------------------------------------------------------------------
# F1: σ_SU shifted-geometric-mean surface vs min-rule (μ_G fixed)
# σ_SU = ((μ_A+1)(μ_I+1)(μ_G+1))^(1/3) - 1
# ---------------------------------------------------------------------------
def fig_f1():
    a = np.linspace(0, 9, 60)
    i = np.linspace(0, 9, 60)
    A, I = np.meshgrid(a, i)
    g = 4.5  # μ_G fixed
    sigma = ((A + 1) * (I + 1) * (g + 1)) ** (1 / 3) - 1
    minrule = np.minimum(np.minimum(A, I), g)

    fig = plt.figure(figsize=(11, 4.6))
    ax1 = fig.add_subplot(1, 2, 1, projection="3d")
    ax1.plot_surface(A, I, sigma, cmap="viridis", edgecolor="none", alpha=0.95)
    ax1.set_title(r"$\sigma_{SU}$: shifted geometric mean")
    ax1.set_xlabel(r"$\mu_A$"); ax1.set_ylabel(r"$\mu_I$"); ax1.set_zlabel(r"$\sigma_{SU}$")
    ax1.set_zlim(0, 9)

    ax2 = fig.add_subplot(1, 2, 2, projection="3d")
    ax2.plot_surface(A, I, minrule, cmap="magma", edgecolor="none", alpha=0.95)
    ax2.set_title(r"min rule (full complement)")
    ax2.set_xlabel(r"$\mu_A$"); ax2.set_ylabel(r"$\mu_I$"); ax2.set_zlabel("min")
    ax2.set_zlim(0, 9)

    fig.suptitle(r"F1. $\sigma_{SU}$ avoids zero-collapse near a single low axis ($\mu_G=4.5$)", y=1.02)
    save(fig, "f1_sigma_su_surface.png")


# ---------------------------------------------------------------------------
# F2: damped spiral from complex eigenvalue pair of state-transition A
# ---------------------------------------------------------------------------
def fig_f2():
    # continuous-time mode: rotation (period T) + decay (time-constant tau)
    T = 12.0      # oscillation period (quarters)
    tau = 18.0    # decay time-constant
    beta = 2 * np.pi / T
    alpha = -1 / tau
    t = np.linspace(0, 48, 800)
    r = np.exp(alpha * t)
    x = r * np.cos(beta * t)
    y = r * np.sin(beta * t)
    z = t  # time as third axis (spiral toward equilibrium over time)

    fig = plt.figure(figsize=(7.5, 6))
    ax = fig.add_subplot(111, projection="3d")
    ax.plot(x, y, z, color="#1f77b4", lw=2)
    ax.scatter([x[0]], [y[0]], [z[0]], color="crimson", s=40, label="t=0")
    ax.scatter([0], [0], [z[-1]], color="green", s=40, label="equilibrium")
    ax.set_title(r"F2. Damped spiral: complex eigenvalue pair $\lambda=\alpha\pm i\beta$"
                 + "\n" + r"(period $T=2\pi/\beta$, decay $\tau=-1/\alpha$)")
    ax.set_xlabel("Re (deviation)"); ax.set_ylabel("Im (deviation)"); ax.set_zlabel("time (quarters)")
    ax.legend(loc="upper left")
    save(fig, "f2_state_space_spiral.png")


# ---------------------------------------------------------------------------
# F4: ERS 8-axis radar (worked example 7-1 axis scores)
# ---------------------------------------------------------------------------
def fig_f4():
    labels = ["1 Seeds", "2 IP/TLO", "3 Incub.", "4 Industry",
              "5 Funding", "6 Talent", "7 Govern.", "8 Policy"]
    A_k = [0.75, 0.50, 0.50, 0.25, 0.25, 0.50, 0.75, 0.50]  # worked example 7-1
    N = len(labels)
    angles = np.linspace(0, 2 * np.pi, N, endpoint=False).tolist()
    vals = A_k + A_k[:1]
    angles_c = angles + angles[:1]

    fig, ax = plt.subplots(figsize=(6.5, 6.5), subplot_kw=dict(polar=True))
    ax.plot(angles_c, vals, color="#2c7fb8", lw=2)
    ax.fill(angles_c, vals, color="#2c7fb8", alpha=0.25)
    ax.set_xticks(angles)
    ax.set_xticklabels(labels, fontsize=10)
    ax.set_ylim(0, 1)
    ax.set_yticks([0.25, 0.5, 0.75, 1.0])
    ax.set_yticklabels(["0.25", "0.50", "0.75", "1.00"], fontsize=8)
    # highlight the gap axes (4 & 5)
    for idx in (3, 4):
        ax.scatter(angles[idx], A_k[idx], color="crimson", s=60, zorder=5)
    ax.set_title("F4. ERS 8-axis radar (worked example 7-1)\n"
                 "ERS = 50.0%; gaps at axis 4 (Industry) & 5 (Funding)", y=1.08)
    save(fig, "f4_ers_radar.png")


# ---------------------------------------------------------------------------
# F5: bottleneck bar = alpha_i / (X_i + 1)
# ---------------------------------------------------------------------------
def fig_f5():
    axes = ["σ_SU", "TRL", "BRL", "GRL", "SRL", "HRL", "FRL"]
    alpha = {"σ_SU": 1.3, "TRL": 1.0, "BRL": 0.6, "GRL": 0.3, "SRL": 0.2, "HRL": 1.1, "FRL": 1.5}
    # illustrative current axis values (0-9)
    X = {"σ_SU": 5, "TRL": 3, "BRL": 4, "GRL": 6, "SRL": 5, "HRL": 4, "FRL": 3}
    sens = [alpha[a] / (X[a] + 1) for a in axes]
    colors = ["#cccccc"] * len(axes)
    top = int(np.argmax(sens))
    colors[top] = "crimson"

    fig, ax = plt.subplots(figsize=(8, 4.6))
    bars = ax.bar(axes, sens, color=colors, edgecolor="black", linewidth=0.6)
    ax.set_ylabel(r"marginal sensitivity  $\alpha_i / (X_i+1)$")
    ax.set_title("F5. Bottleneck = argmax of marginal sensitivity\n"
                 f"(illustrative X; bottleneck here: {axes[top]})")
    for b, s in zip(bars, sens):
        ax.text(b.get_x() + b.get_width() / 2, s + 0.005, f"{s:.3f}",
                ha="center", va="bottom", fontsize=8)
    ax.set_ylim(0, max(sens) * 1.18)
    save(fig, "f5_bottleneck_bar.png")


# ---------------------------------------------------------------------------
# F3: Tiem retrofit AMD Score time-series (B-plan: self-consistent recompute)
# S = K * prod (X_i + 1)^alpha_i, with theory §9 axis values per time point.
# ---------------------------------------------------------------------------
_ALPHA = {"sigma": 1.3, "trl": 1.0, "brl": 0.6, "grl": 0.3, "srl": 0.2, "hrl": 1.1, "frl": 1.5}
_K = 0.1


def amd_score(sigma, trl, brl, grl, srl, hrl, frl):
    vals = {"sigma": sigma, "trl": trl, "brl": brl, "grl": grl, "srl": srl, "hrl": hrl, "frl": frl}
    s = _K
    for k, a in _ALPHA.items():
        s *= (vals[k] + 1) ** a
    return s


def fig_f3():
    # (year_x, sigma, trl, brl, grl, srl, hrl, frl) — theory §9 のティエム経時評価
    rows = [
        (1995.0, 2, 0, 0, 1, 1, 0, 0),
        (2000.0, 3, 0, 0, 2, 2, 0, 0),
        (2005.0, 4, 0, 0, 3, 3, 0, 0),
        (2007.0, 4, 1, 0, 3, 3, 0, 0),   # 中西 PMSQ 発明
        (2009.0, 5, 1, 1, 4, 4, 1, 2),
        (2010.0, 5, 1, 1, 4, 4, 1, 3),
        (2011.25, 6, 2, 1, 5, 5, 1, 3),  # 東日本大震災
        (2012.83, 7, 2, 1, 5, 5, 1, 4),  # 2012-10
        (2012.92, 7, 0, 1, 5, 5, 1, 4),  # 2012-11 設立 (TRL=0)
        (2014.0, 7, 1, 2, 6, 5, 2, 4),
        (2015.0, 7, 3, 2, 6, 5, 2, 4),
        (2017.0, 6, 4, 3, 5, 5, 3, 5),   # 2017 実際
    ]
    xs = [r[0] for r in rows]
    ys = [amd_score(*r[1:]) for r in rows]

    found_x, found_y = 2012.92, amd_score(7, 0, 1, 5, 5, 1, 4)
    cf_x, cf_y = 2017.0, amd_score(6, 5, 3, 5, 5, 3, 5)  # 仮想 2017 設立 (TRL=5)
    ratio = cf_y / found_y

    fig, ax = plt.subplots(figsize=(9, 5.2))
    ax.plot(xs, ys, "-o", color="#1f77b4", lw=1.8, ms=5,
            label="self-consistent AMD Score (axis values → Cobb-Douglas)")
    ax.scatter([found_x], [found_y], color="crimson", s=100, zorder=6,
               label=f"actual founding 2012 (TRL=0): {found_y:.0f}")
    ax.scatter([cf_x], [cf_y], color="green", marker="*", s=260, zorder=6,
               label=f"counterfactual founding 2017 (TRL=5): {cf_y:.0f}")

    ax.annotate("", xy=(cf_x, cf_y), xytext=(found_x, found_y),
                arrowprops=dict(arrowstyle="->", color="gray", ls="--", lw=1.3))
    ax.text(2014.6, (found_y * cf_y) ** 0.5, f"≈{ratio:.0f}×",
            color="black", fontsize=14, fontweight="bold", ha="center")
    ax.annotate("founding: TRL gate unmet\n(self-tech not ready)", xy=(found_x, found_y),
                xytext=(2009.2, found_y * 2.3), fontsize=8, color="crimson",
                arrowprops=dict(arrowstyle="->", color="crimson", lw=0.8))

    ax.set_yscale("log")
    ax.set_xlabel("year")
    ax.set_ylabel("AMD Score (log scale)")
    ax.set_title("F3. Tiem retrofit: self-consistent AMD Score time-series\n"
                 "founding (TRL gate unmet) vs counterfactual 2017 (gate met)")
    ax.legend(loc="upper left", fontsize=8)
    ax.grid(True, which="both", alpha=0.25)
    save(fig, "f3_retrofit_timeseries.png")
    print(f"  F3: founding={found_y:.1f}, counterfactual={cf_y:.1f}, ratio={ratio:.2f}x")


# ---------------------------------------------------------------------------
# F6: Strategic slack (x, y) plane — concept map with one annotated trajectory
# 正本: BZSF/PRS_STRATEGIC_SLACK_OVERVIEW_20260612.html Ch9 /
#       CX/AMD OS 資料/DTSU_STRATEGIC_SLACK_MODEL_20260609.md §2-4
# ---------------------------------------------------------------------------
def fig_f6():
    fig, ax = plt.subplots(figsize=(9.2, 5.6))

    # loss-of-control zone & line
    ax.axhspan(-3, 0, color="crimson", alpha=0.10)
    ax.axhline(0, color="crimson", lw=2.2)
    ax.text(0.25, -1.7, "y = 0 : loss-of-control line\n(bankruptcy / fire-sale M&A / heavy dilution / subordinate license)",
            color="crimson", fontsize=9, va="center")

    # commercialization line
    ax.axvline(9, color="seagreen", lw=2.0, ls="--")
    ax.text(9.12, 27, "commercialization line\n(BEP / self-sustaining)", color="seagreen", fontsize=9)

    # illustrative trajectory
    seg = [
        (0.6, 7), (1.8, 5.5),            # pre-founding: limited-purpose funds
        (1.8, 24),                        # founding jump
        (3.6, 16),                        # PoC & disclosure: spend y, buy x
        (3.6, 23),                        # grant refill
        (5.6, 13),                        # bigger PoC / pilot
        (5.6, 27),                        # fundraising
        (9.0, 14),                        # run to the line
    ]
    xs = [p[0] for p in seg]; ys = [p[1] for p in seg]
    ax.plot(xs, ys, color="navy", lw=2.2, marker="o", ms=4, zorder=5)

    ax.annotate("founding:\ncapital raises y", xy=(1.8, 24), xytext=(0.4, 30),
                fontsize=9, color="navy",
                arrowprops=dict(arrowstyle="->", color="navy", lw=0.9))
    ax.annotate("PoC & disclosure:\nspend y to buy x", xy=(2.8, 19.8), xytext=(2.9, 8.5),
                fontsize=9, color="navy",
                arrowprops=dict(arrowstyle="->", color="navy", lw=0.9))
    ax.annotate("grant / paid PoC / fundraising:\nrefill y (vertical jump)", xy=(5.6, 27), xytext=(5.0, 33),
                fontsize=9, color="navy",
                arrowprops=dict(arrowstyle="->", color="navy", lw=0.9))
    ax.annotate("reach the line with y > 0\n= survive with control", xy=(9.0, 14), xytext=(6.6, 19.5),
                fontsize=9, color="seagreen",
                arrowprops=dict(arrowstyle="->", color="seagreen", lw=0.9))

    # bargaining power note: two slopes
    ax.plot([6.2, 7.6], [6.5, 5.4], color="gray", lw=1.6)
    ax.plot([6.2, 7.6], [6.5, 1.6], color="gray", lw=1.6, ls=":")
    ax.text(7.75, 5.2, "high bargaining power:\nsame Δx, small Δy", fontsize=8, color="dimgray")
    ax.text(7.75, 1.4, "low bargaining power:\nsame Δx, large Δy", fontsize=8, color="dimgray")

    ax.set_xlim(0, 12.6); ax.set_ylim(-3, 38)
    ax.set_xlabel("commercialization progress  x")
    ax.set_ylabel("strategic slack  y  (months of control)")
    ax.set_title("F6. The strategic-slack plane: reach the line before y hits zero")
    ax.grid(True, alpha=0.2)
    save(fig, "f6_slack_plane.png")


# ---------------------------------------------------------------------------
# F7: Strategic slack over time — the sawtooth chart
# Before Zero (limited-purpose funds) -> founding jump -> growing burn ->
# refills (grant / paid PoC / Series A) -> BEP. Counterfactual without refills
# hits y = 0 before reaching BEP.
# ---------------------------------------------------------------------------
def fig_f7():
    fig, ax = plt.subplots(figsize=(9.6, 5.4))

    # main path: piecewise linear, slope steepens as burn grows
    t_pts = [0, 12, 12, 24, 24, 33, 33, 42, 42, 54, 54, 60]
    y_pts = [6, 4.5, 24, 14, 22, 13, 18, 6, 24, 7, 7, 8.5]
    ax.plot(t_pts, y_pts, color="navy", lw=2.4, zorder=5,
            label="strategic slack y(t) — refilled on the way")

    # counterfactual: founding capital only, no refill
    t2 = [12, 24, 36, 40]
    y2 = [24, 14, 2.5, 0]
    ax.plot(t2, y2, color="crimson", lw=1.8, ls="--",
            label="no refill: y hits 0 before BEP (loss of control)")
    ax.scatter([40], [0], color="crimson", s=70, zorder=6, marker="x")

    # zones / lines
    ax.axhline(0, color="crimson", lw=2.0)
    ax.axhspan(-2.5, 0, color="crimson", alpha=0.10)
    ax.axvspan(0, 12, color="goldenrod", alpha=0.08)
    ax.axvline(54, color="seagreen", lw=1.8, ls="--")

    # annotations
    ax.text(1.0, 26.5, "Before Zero:\nno company yet —\ngrants & institutional\nresources only", fontsize=8.5, color="goldenrod")
    ax.annotate("founding: seed capital\n(burn also starts)", xy=(12, 24), xytext=(14.5, 30),
                fontsize=9, color="navy", arrowprops=dict(arrowstyle="->", color="navy", lw=0.9))
    ax.annotate("grant adopted", xy=(24, 22), xytext=(25.5, 27.5),
                fontsize=9, color="navy", arrowprops=dict(arrowstyle="->", color="navy", lw=0.9))
    ax.annotate("paid PoC /\njoint-research fee", xy=(33, 18), xytext=(34.0, 24.5),
                fontsize=9, color="navy", arrowprops=dict(arrowstyle="->", color="navy", lw=0.9))
    ax.annotate("fundraising\n(Series A)", xy=(42, 24), xytext=(44.5, 29.5),
                fontsize=9, color="navy", arrowprops=dict(arrowstyle="->", color="navy", lw=0.9))
    ax.annotate("burn grows as commercialization nears\n(pilot, manufacturing, QA, sales prep)",
                xy=(48, 13), xytext=(28, 3.2), fontsize=8.5, color="dimgray",
                arrowprops=dict(arrowstyle="->", color="dimgray", lw=0.8))
    ax.text(54.8, 13.5, "BEP: gross margin\ncovers burn —\ndecline stops", color="seagreen", fontsize=9)

    ax.set_xlim(0, 64); ax.set_ylim(-2.5, 36)
    ax.set_xlabel("time (months)")
    ax.set_ylabel("strategic slack  y  (months of control)")
    ax.set_title("F7. The sawtooth: spend, refill, and reach BEP before y = 0")
    ax.legend(loc="upper right", fontsize=8.5)
    ax.grid(True, alpha=0.2)
    save(fig, "f7_slack_sawtooth.png")


# ---------------------------------------------------------------------------
# F8: trajectory patterns on the (x, y) plane
# healthy / zombie / quick-death / sawtooth (grant-funded, e.g. drug discovery)
# 正本: PRS_STRATEGIC_SLACK_OVERVIEW Ch14 (図5)
# ---------------------------------------------------------------------------
def fig_f8():
    fig, ax = plt.subplots(figsize=(9.2, 5.4))

    ax.axhline(0, color="crimson", lw=2.0)
    ax.axhspan(-2, 0, color="crimson", alpha=0.10)
    ax.axvline(9, color="seagreen", lw=1.8, ls="--")
    ax.text(9.15, 2.0, "commercialization\nline", color="seagreen", fontsize=9)
    ax.text(0.2, -1.4, "y = 0: loss of control", color="crimson", fontsize=9)

    # healthy
    hx = [1, 1.8, 1.8, 3.5, 3.5, 5.5, 5.5, 9.0]
    hy = [6, 5, 22, 14, 21, 12, 25, 13]
    ax.plot(hx, hy, color="seagreen", lw=2.2, label="healthy: refills and progress mesh")

    # zombie
    zx = [1, 1.6, 2.1, 2.5, 2.8, 3.0]
    zy = [18, 13, 8.5, 4.5, 1.8, 0]
    ax.plot(zx, zy, color="darkorange", lw=2.2, label="zombie: x crawls while y bleeds out")
    ax.scatter([3.0], [0], color="darkorange", marker="x", s=70)

    # quick death
    qx = [1, 1.5, 1.8]
    qy = [9, 3, 0]
    ax.plot(qx, qy, color="crimson", lw=2.2, label="quick death: low ceiling, early exit")
    ax.scatter([1.8], [0], color="crimson", marker="x", s=70)

    # sawtooth (grant-funded)
    sx = [1, 2.3, 2.3, 3.8, 3.8, 5.3, 5.3, 6.8, 6.8, 9.0]
    sy = [7, 2.5, 10, 4, 11, 4.5, 12, 5, 13, 6]
    ax.plot(sx, sy, color="mediumpurple", lw=2.2,
            label="sawtooth: grant-refilled, low-variance path (e.g. drug discovery)")

    ax.set_xlim(0, 12.2); ax.set_ylim(-2, 30)
    ax.set_xlabel("commercialization progress  x")
    ax.set_ylabel("strategic slack  y  (months of control)")
    ax.set_title("F8. Survival structures differ even when snapshots look alike")
    ax.legend(loc="upper right", fontsize=8.5)
    ax.grid(True, alpha=0.2)
    save(fig, "f8_slack_trajectories.png")


if __name__ == "__main__":
    import sys
    targets = sys.argv[1:]
    all_figs = {
        "f1": fig_f1, "f2": fig_f2, "f3": fig_f3, "f4": fig_f4, "f5": fig_f5,
        "f6": fig_f6, "f7": fig_f7, "f8": fig_f8,
    }
    if targets:
        for t in targets:
            all_figs[t]()
        print(f"done. {', '.join(targets)} generated.")
    else:
        for fn in all_figs.values():
            fn()
        print("done. F1-F8 generated (F3 = self-consistent retrofit recompute, B-plan).")
