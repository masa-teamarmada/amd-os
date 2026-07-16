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
from matplotlib import font_manager
from mpl_toolkits.mplot3d import Axes3D  # noqa: F401

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "bzm")
os.makedirs(OUT, exist_ok=True)
BOOK_A_OUT = os.path.join(OUT, "book-a")
os.makedirs(BOOK_A_OUT, exist_ok=True)
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


def book_a_style():
    """Use a local Japanese font for Book A figures without changing old figure labels."""
    font_candidates = [
        "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc",
        "/System/Library/Fonts/ヒラギノ角ゴシック W2.ttc",
        "/System/Library/Fonts/ヒラギノ角ゴシック W1.ttc",
        "/System/Library/Fonts/ヒラギノ明朝 ProN.ttc",
    ]
    for font_path in font_candidates:
        if os.path.exists(font_path):
            font_manager.fontManager.addfont(font_path)
            jp = font_manager.FontProperties(fname=font_path).get_name()
            plt.rcParams.update({
                "font.family": jp,
                "axes.unicode_minus": False,
            })
            break
    else:
        plt.rcParams.update({
            "font.sans-serif": [
                "Hiragino Sans",
                "Hiragino Kaku Gothic ProN",
                "Yu Gothic",
                "Noto Sans CJK JP",
                "Arial Unicode MS",
                "DejaVu Sans",
            ],
            "axes.unicode_minus": False,
        })
    plt.rcParams.update({
        "figure.facecolor": "white",
        "axes.facecolor": "white",
        "font.size": 11,
        "axes.titlesize": 13,
    })


def save_book_a(fig, name):
    path = os.path.join(BOOK_A_OUT, name)
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


# ---------------------------------------------------------------------------
# F9: hype-driven valuation vs fact-based readiness (why-valuation-fails)
# Same project, two numbers: valuation swings with the hype cycle while
# fact-based readiness accumulates as a monotone staircase.
# ---------------------------------------------------------------------------
def fig_f9():
    fig, ax = plt.subplots(figsize=(9.4, 5.2))
    t = np.linspace(0, 8, 400)

    # hype-cycle valuation: boom -> trough -> slow recovery, plus mild noise-free wiggle
    hype = 10 + 38 * np.exp(-((t - 2.0) ** 2) / 0.9) + 14 / (1 + np.exp(-(t - 6.2)))
    ax.plot(t, hype, color="crimson", lw=2.4, label="valuation (expectation-driven)")

    # readiness staircase: monotone, slow
    steps_t = [0, 1.2, 2.6, 3.4, 4.8, 5.6, 6.8, 8]
    steps_v = [4, 8, 12, 18, 22, 30, 36, 40]
    ax2 = ax.twinx()
    ax2.step(steps_t, steps_v, where="post", color="navy", lw=2.4,
             label="readiness (fact-based, irreversible)")

    # divergence annotation
    ax.annotate("same project,\ndifferent numbers", xy=(2.1, 47), xytext=(3.1, 50),
                fontsize=10, color="dimgray",
                arrowprops=dict(arrowstyle="->", color="dimgray", lw=0.9))
    ax.annotate("hype peak:\nnothing changed inside", xy=(2.0, 48.5), xytext=(0.2, 56),
                fontsize=9, color="crimson",
                arrowprops=dict(arrowstyle="->", color="crimson", lw=0.9))
    ax2.annotate("data, patents, paid validation:\nonly accumulates", xy=(5.6, 30), xytext=(4.6, 14),
                 fontsize=9, color="navy",
                 arrowprops=dict(arrowstyle="->", color="navy", lw=0.9))

    ax.set_xlabel("time (years)")
    ax.set_ylabel("valuation (expectation)", color="crimson")
    ax2.set_ylabel("readiness (facts)", color="navy")
    ax.set_ylim(0, 62); ax2.set_ylim(0, 62)
    ax.tick_params(axis="y", labelcolor="crimson")
    ax2.tick_params(axis="y", labelcolor="navy")
    ax.set_title("F9. The same project, two numbers: hype swings, readiness accumulates")
    lines1, labels1 = ax.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax.legend(lines1 + lines2, labels1 + labels2, loc="lower right", fontsize=9)
    ax.grid(True, alpha=0.2)
    save(fig, "f9_hype_vs_readiness.png")


# ---------------------------------------------------------------------------
# Book A matplotlib batch2: 8 confirmed figures + 4 provisional worked examples
# 出力先: pwa/public/bzm/book-a/*.png
# 既存F1-F9は英語ラベルのまま維持し、Book A用だけ日本語ラベルで再制作する。
# ---------------------------------------------------------------------------
BOOK_A_BLUE = "#2a4d8f"
BOOK_A_ORANGE = "#e07a5f"
BOOK_A_GREEN = "#3a7a4a"
BOOK_A_PURPLE = "#7b5ea7"
BOOK_A_GREY = "#8b8f9f"


def book_a_fig_4_2():
    book_a_style()
    t = [0, 2, 2, 4.5, 4.5, 7, 7, 10]
    p = [2, 2, 4, 4, 6.5, 6.5, 8.5, 8.5]
    fig, ax = plt.subplots(figsize=(7.6, 4.6))
    ax.plot(t, p, color=BOOK_A_BLUE, lw=2.6, zorder=3)
    ax.fill_between(t, 0, p, color=BOOK_A_BLUE, alpha=0.06)

    for x, ymid, label in [
        (2, 3.0, "隣接用途の発見"),
        (4.5, 5.25, "産業文脈の書き換え"),
        (7, 7.5, "標準・規格への接続"),
    ]:
        ax.annotate("", xy=(x, ymid + 1.0), xytext=(x, ymid - 1.0),
                    arrowprops=dict(arrowstyle="->", color=BOOK_A_ORANGE, lw=1.6))
        ax.text(x + 0.12, ymid, label, fontsize=9, color=BOOK_A_ORANGE, va="center")

    ax.axhline(2, color=BOOK_A_GREY, ls="--", lw=1.2)
    ax.text(9.8, 2.2, "当初用途の天井", ha="right", fontsize=9, color="#666")
    ax.text(0.15, 8.85, r"$P(t)=\max_{u\in U(t)}P_u$", fontsize=12, color="#333")
    ax.set_xlabel("時間")
    ax.set_ylabel("天井 P(t)")
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 9.5)
    ax.set_title("図4-2  Pは測るものであると同時に、動かすもの")
    ax.set_xticks([])
    ax.grid(axis="y", alpha=0.2)
    for s in ["top", "right"]:
        ax.spines[s].set_visible(False)
    save_book_a(fig, "book-a-fig-4-2.png")


def book_a_fig_7_3():
    book_a_style()

    def sigma_su(vals):
        return float(np.prod(np.array(vals) + 1.0) ** (1 / 3) - 1.0)

    patterns = [
        ("三者が揃う\n真の進展", [0.60, 0.60, 0.60], 0.72),
        ("学だけ跳ねる\nハイプ/先回り", [1.50, 0.15, 0.15], 0.38),
        ("追い風は強いが\n社会受容が低い", [0.60, 0.60, 0.60], 0.16),
    ]
    labels = [p[0] for p in patterns]
    values = np.array([p[1] for p in patterns])
    social = np.array([p[2] for p in patterns])
    sigmas = [sigma_su(v) for v in values]
    x = np.arange(len(patterns))
    width = 0.18
    offsets = [-1.5 * width, -0.5 * width, 0.5 * width, 1.5 * width]

    fig, ax = plt.subplots(figsize=(8.8, 4.9))
    series = [
        (r"$\mu_A$ 学", values[:, 0], BOOK_A_BLUE, None),
        (r"$\mu_I$ 産", values[:, 1], BOOK_A_GREEN, None),
        (r"$\mu_G$ 官", values[:, 2], BOOK_A_ORANGE, None),
        ("社会受容", social, "#aaaaaa", "//"),
    ]
    for i, (name, data, color, hatch) in enumerate(series):
        ax.bar(x + offsets[i], data, width, label=name, color=color,
               edgecolor="white", linewidth=0.8, hatch=hatch, zorder=3)

    for xi, sig in zip(x, sigmas):
        ax.text(xi, 1.72, rf"$\sigma_{{SU}}\approx{sig:.2f}$",
                ha="center", va="bottom", fontsize=10, color="#333")
    ax.text(x[2], 0.33, "ここだけ\n別の時計", ha="center", va="center",
            fontsize=9, color="#666")

    ax.set_xticks(x)
    ax.set_xticklabels(labels)
    ax.set_ylim(0, 1.9)
    ax.set_ylabel("強度・受容の教材値")
    ax.set_title("図7-3  追い風は値だけでなく、内訳と社会受容を分けて読む")
    ax.legend(loc="upper right", ncol=4, fontsize=8.5, frameon=False)
    ax.grid(axis="y", alpha=0.2, zorder=0)
    for s in ["top", "right"]:
        ax.spines[s].set_visible(False)
    save_book_a(fig, "book-a-fig-7-3.png")


def book_a_fig_8_1():
    book_a_style()
    fig, ax = plt.subplots(figsize=(9.0, 5.4))
    ax.axhspan(-3, 0, color="crimson", alpha=0.10)
    ax.axhline(0, color="crimson", lw=2.0)
    ax.text(0.02, -1.7, "y=0: 主導権喪失ライン", color="crimson", fontsize=9, va="center")

    ax.axvline(1.0, color=BOOK_A_GREEN, lw=2.0, ls="--")
    ax.text(1.01, 27, "事業化ライン", color=BOOK_A_GREEN, fontsize=9, va="center")

    seg = [
        (0.06, 7), (0.18, 5.5),
        (0.18, 24),
        (0.38, 16),
        (0.38, 23),
        (0.62, 13),
        (0.62, 27),
        (1.00, 14),
    ]
    xs = [p[0] for p in seg]
    ys = [p[1] for p in seg]
    ax.plot(xs, ys, color="navy", lw=2.2, marker="o", ms=4, zorder=5)

    ax.annotate("設立:\n資本金で縦に跳ぶ", xy=(0.18, 24), xytext=(0.05, 30),
                fontsize=9, color="navy",
                arrowprops=dict(arrowstyle="->", color="navy", lw=0.9))
    ax.annotate("PoC・開示:\nyを使ってxを買う", xy=(0.30, 19.5), xytext=(0.36, 7.6),
                fontsize=9, color="navy",
                arrowprops=dict(arrowstyle="->", color="navy", lw=0.9))
    ax.annotate("助成金・調達:\n余力を補充", xy=(0.62, 27), xytext=(0.55, 33),
                fontsize=9, color="navy",
                arrowprops=dict(arrowstyle="->", color="navy", lw=0.9))
    ax.annotate("y>0のまま到達", xy=(1.00, 14), xytext=(0.76, 19.5),
                fontsize=9, color=BOOK_A_GREEN,
                arrowprops=dict(arrowstyle="->", color=BOOK_A_GREEN, lw=0.9))

    ax.set_xlim(0, 1.18)
    ax.set_ylim(-3, 38)
    ax.set_xlabel("事業化への到達度 x")
    ax.set_ylabel("戦略余力 y（月）")
    ax.set_title("図8-1  (x,y)平面で見る、余力を使って到達度を買う道のり")
    ax.grid(True, alpha=0.2)
    save_book_a(fig, "book-a-fig-8-1.png")


def _book_a_xy_sample_paths():
    rng = np.random.default_rng(8202)
    months = np.arange(49)
    dx = rng.normal(0.02, 0.015, 48)
    burn = rng.normal(1.0, 0.3, 48)
    jump = rng.random(48) < 0.05
    if not jump.any():
        jump[[10, 29]] = True

    def run(with_jump):
        x_vals = [0.2]
        y_vals = [30.0]
        jump_months = []
        for i in range(48):
            x_next = max(0.0, min(1.08, x_vals[-1] + max(dx[i], -0.01)))
            y_next = y_vals[-1] - max(burn[i], 0.1)
            if with_jump and jump[i]:
                y_next += 8
                jump_months.append(i + 1)
            x_vals.append(x_next)
            y_vals.append(y_next)
        return np.array(x_vals), np.array(y_vals), jump_months

    return months, run(False), run(True)


def book_a_fig_8_2():
    book_a_style()
    months, diffusion, with_jump = _book_a_xy_sample_paths()
    x_d, y_d, _ = diffusion
    x_j, y_j, jump_months = with_jump

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(8.8, 6.0), sharex=True,
                                   gridspec_kw={"height_ratios": [1, 1.1]})
    ax1.plot(months, x_d, color=BOOK_A_BLUE, lw=2.0, label="拡散のみ")
    ax1.plot(months, x_j, color=BOOK_A_ORANGE, lw=2.0, ls="--", label="拡散+ジャンプ")
    ax1.axhline(1.0, color=BOOK_A_GREEN, lw=1.5, ls="--")
    ax1.text(48, 1.01, "事業化ライン", ha="right", va="bottom", fontsize=9, color=BOOK_A_GREEN)
    ax1.set_ylabel("到達度 x")
    ax1.set_ylim(0.15, 1.1)
    ax1.grid(True, alpha=0.2)
    ax1.legend(loc="upper left", fontsize=9, frameon=False)

    ax2.plot(months, y_d, color=BOOK_A_BLUE, lw=2.0, label="拡散のみ")
    ax2.plot(months, y_j, color=BOOK_A_ORANGE, lw=2.0, ls="--", label="拡散+ジャンプ")
    ax2.axhline(0, color="crimson", lw=1.7)
    for jm in jump_months:
        ax2.scatter([jm], [y_j[jm]], color=BOOK_A_ORANGE, s=45, zorder=5)
        ax2.annotate("+8か月", xy=(jm, y_j[jm]), xytext=(jm + 1, y_j[jm] + 4),
                     fontsize=8.5, color=BOOK_A_ORANGE,
                     arrowprops=dict(arrowstyle="->", color=BOOK_A_ORANGE, lw=0.8))
    ax2.set_xlabel("月")
    ax2.set_ylabel("戦略余力 y（月）")
    ax2.set_ylim(min(y_d.min(), y_j.min()) - 2, max(y_j.max(), y_d.max()) + 8)
    ax2.grid(True, alpha=0.2)
    fig.suptitle("図8-2  同じ出発点でも、ジャンプの有無で軌跡の見え方が変わる", y=0.995)
    save_book_a(fig, "book-a-fig-8-2.png")


def book_a_fig_8_4():
    book_a_style()
    fig, ax = plt.subplots(figsize=(9.2, 5.4))
    ax.axhline(0, color="crimson", lw=2.0)
    ax.axhspan(-2, 0, color="crimson", alpha=0.10)
    ax.axvline(1.0, color=BOOK_A_GREEN, lw=1.8, ls="--")
    ax.text(1.01, 2.0, "事業化\nライン", color=BOOK_A_GREEN, fontsize=9)
    ax.text(0.02, -1.4, "y=0: 主導権喪失", color="crimson", fontsize=9)

    paths = [
        ("自走型", [0.10, 0.18, 0.18, 0.36, 0.36, 0.58, 0.58, 1.00],
         [6, 5, 22, 14, 21, 12, 25, 13], BOOK_A_GREEN),
        ("ゾンビ型", [0.10, 0.16, 0.21, 0.25, 0.28, 0.30],
         [18, 13, 8.5, 4.5, 1.8, 0], "darkorange"),
        ("即落型", [0.10, 0.15, 0.18],
         [9, 3, 0], "crimson"),
        ("鋸歯型", [0.10, 0.24, 0.24, 0.40, 0.40, 0.56, 0.56, 0.72, 0.72, 1.00],
         [7, 2.5, 10, 4, 11, 4.5, 12, 5, 13, 6], "mediumpurple"),
    ]
    for label, xs, ys, color in paths:
        ax.plot(xs, ys, color=color, lw=2.2, label=label)
        ax.text(xs[-1] + 0.018, ys[-1], label, color=color, fontsize=9, va="center")
    ax.scatter([0.30, 0.18], [0, 0], color=["darkorange", "crimson"], marker="x", s=70)

    ax.set_xlim(0, 1.20)
    ax.set_ylim(-2, 30)
    ax.set_xlabel("事業化への到達度 x")
    ax.set_ylabel("戦略余力 y（月）")
    ax.set_title("図8-4  四つの軌跡型は、同じ断面でも生存構造が違う")
    ax.legend(loc="upper right", fontsize=8.8, frameon=False)
    ax.grid(True, alpha=0.2)
    save_book_a(fig, "book-a-fig-8-4.png")


BOOK_A_WEIGHTS = {
    "F": 1.6,
    "σ_SU": 1.2,
    "HRL": 1.0,
    "TRL": 0.9,
    "P": 0.9,
    "R_net": 0.7,
    "BRL": 0.5,
    "GRL": 0.4,
    "SRL": 0.3,
}
BOOK_A_EXAMPLE_X = {
    "P": 6,
    "TRL": 2,
    "BRL": 1,
    "GRL": 4,
    "SRL": 4,
    "HRL": 2,
    "σ_SU": 7,
    "R_net": 0,
    "F": 3,
}


def _book_a_sps(values):
    k = 100000 / (10 ** sum(BOOK_A_WEIGHTS.values()))
    score = k
    for axis, alpha in BOOK_A_WEIGHTS.items():
        score *= (values[axis] + 1) ** alpha
    return score


def _normalize_0_100(vals):
    vals = np.asarray(vals, dtype=float)
    span = vals.max() - vals.min()
    if span == 0:
        return np.zeros_like(vals)
    return (vals - vals.min()) / span * 100


def book_a_fig_9_1():
    book_a_style()
    moving_axis = "R_net"
    xs = np.linspace(0, 9, 181)
    weighted = []
    minimum = []
    cobb = []
    for x in xs:
        values = dict(BOOK_A_EXAMPLE_X)
        values[moving_axis] = x
        weighted.append(sum(BOOK_A_WEIGHTS[a] * values[a] for a in BOOK_A_WEIGHTS))
        minimum.append(min(values.values()))
        cobb.append(_book_a_sps(values))

    fig, ax = plt.subplots(figsize=(8.6, 4.8))
    ax.plot(xs, _normalize_0_100(weighted), color=BOOK_A_GREY, lw=2.2, label="加重和")
    ax.plot(xs, _normalize_0_100(minimum), color="crimson", lw=2.2, label="min")
    ax.plot(xs, _normalize_0_100(cobb), color=BOOK_A_BLUE, lw=2.6, label="Cobb-Douglas")
    ax.axvline(BOOK_A_EXAMPLE_X[moving_axis], color="#999", ls=":", lw=1.2)
    ax.text(BOOK_A_EXAMPLE_X[moving_axis] + 0.1, 8, "例題の現在地\nR_net=0",
            fontsize=9, color="#666")
    ax.set_xlabel(r"動かす軸: $R_{\mathrm{net}}$（0→9）")
    ax.set_ylabel("比較用に0〜100へ正規化")
    ax.set_title("図9-1  束ね方が違うと、一軸改善の見え方も変わる")
    ax.legend(loc="lower right", frameon=False)
    ax.grid(True, alpha=0.2)
    for s in ["top", "right"]:
        ax.spines[s].set_visible(False)
    save_book_a(fig, "book-a-fig-9-1.png")


def book_a_fig_9_2():
    book_a_style()
    score = 72
    fig, ax = plt.subplots(figsize=(8.2, 2.7))
    ax.set_xscale("log")
    ax.set_xlim(1, 100000)
    ax.set_ylim(0, 1)
    ax.axhline(0.5, color="#444", lw=1.6, zorder=1)
    for v in [1, 10, 100, 1000, 10000, 100000]:
        ax.plot([v, v], [0.44, 0.56], color="#444", lw=1.2)
        ax.text(v, 0.30, f"{v:,}", ha="center", fontsize=9, color="#444")
    ax.plot([score], [0.5], "o", color=BOOK_A_BLUE, ms=11, zorder=5)
    ax.annotate("例題スコア\n約72", xy=(score, 0.5), xytext=(260, 0.80),
                ha="left", fontsize=10, color=BOOK_A_BLUE,
                arrowprops=dict(arrowstyle="->", color=BOOK_A_BLUE, lw=1.2))
    ax.text(1, 0.64, "シーズの気配", ha="left", va="top", fontsize=9, color="#777")
    ax.text(100000, 0.64, "全軸最高\n=100,000", ha="right", va="top", fontsize=9, color="#777")
    ax.text(50000, 0.12, "1桁 = 1段階として読む", ha="center",
            fontsize=9, color=BOOK_A_ORANGE, style="italic")
    ax.set_title("図9-2  統合スコアは対数の物差しで読む")
    ax.set_yticks([])
    ax.set_xticks([])
    ax.set_xticks([], minor=True)
    ax.tick_params(axis="x", which="both", length=0)
    for s in ["top", "right", "left", "bottom"]:
        ax.spines[s].set_visible(False)
    save_book_a(fig, "book-a-fig-9-2.png")


def book_a_fig_9_3():
    book_a_style()
    rows = sorted(
        [(axis, BOOK_A_WEIGHTS[axis], BOOK_A_EXAMPLE_X[axis]) for axis in BOOK_A_WEIGHTS],
        key=lambda r: -r[1] / (r[2] + 1),
    )
    names = [r[0] for r in rows]
    ratio = [r[1] / (r[2] + 1) for r in rows]
    y = np.arange(len(rows))[::-1]

    fig, ax = plt.subplots(figsize=(7.9, 4.8))
    colors = [BOOK_A_BLUE] * len(rows)
    colors[0] = BOOK_A_ORANGE
    bars = ax.barh(y, ratio, color=colors, height=0.62, zorder=3)
    for bar, yi, (name, alpha, x_val), rt in zip(bars, y, rows, ratio):
        ax.text(rt + 0.015, yi, f"{rt:.3f}", va="center", fontsize=9.5,
                color="#333", fontweight="bold")
        if rt > 0.18:
            ax.text(0.012, yi, f"α={alpha:g}, X={x_val:g}", va="center", fontsize=8,
                    color="#fff")
        else:
            ax.text(rt + 0.105, yi, f"α={alpha:g}, X={x_val:g}", va="center",
                    fontsize=8, color="#777")
    ax.set_yticks(y)
    ax.set_yticklabels(names)
    ax.set_xlabel(r"限界収益  $\alpha/(X+1)$")
    ax.set_xlim(0, 0.82)
    ax.set_title(r"図9-3  律速軸は $R_{\mathrm{net}}$、次に F と HRL が続く")
    ax.annotate("次の一手:\n対価を得る検証", xy=(0.7, y[0]), xytext=(0.49, y[0] - 1.15),
                fontsize=9.5, color=BOOK_A_ORANGE, fontweight="bold",
                arrowprops=dict(arrowstyle="->", color=BOOK_A_ORANGE, lw=1.3))
    ax.grid(axis="x", alpha=0.2)
    for s in ["top", "right"]:
        ax.spines[s].set_visible(False)
    save_book_a(fig, "book-a-fig-9-3.png")


def book_a_fig_11_1():
    book_a_style()
    labels = [
        "1 シーズ\n技術評価", "2 知財\nTLO", "3 起業\n支援", "4 産学\n接続",
        "5 資金\n接続", "6 経営\n人材", "7 規程\nガバナンス", "8 政策\n連携",
    ]
    scores = [0.65, 0.45, 0.55, 0.30, 0.35, 0.40, 0.25, 0.60]
    ecr = np.mean(scores) * 100
    angles = np.linspace(0, 2 * np.pi, len(labels), endpoint=False).tolist()
    vals = scores + scores[:1]
    angles_c = angles + angles[:1]

    fig, ax = plt.subplots(figsize=(6.9, 6.6), subplot_kw=dict(polar=True))
    ax.plot(angles_c, vals, color=BOOK_A_BLUE, lw=2)
    ax.fill(angles_c, vals, color=BOOK_A_BLUE, alpha=0.22)
    ax.set_xticks(angles)
    ax.set_xticklabels(labels, fontsize=9)
    ax.set_ylim(0, 1)
    ax.set_yticks([0.25, 0.50, 0.75, 1.00])
    ax.set_yticklabels(["0.25", "0.50", "0.75", "1.00"], fontsize=8)
    for idx in (3, 4, 6):
        ax.scatter(angles[idx], scores[idx], color="crimson", s=64, zorder=5)
    ax.set_title(f"図11-1 仮案  ECR 8軸充足率（架空例）\nECR={ecr:.1f}%、赤点は優先ギャップ", y=1.10)
    save_book_a(fig, "book-a-fig-11-1.png")


def book_a_fig_12_2():
    book_a_style()
    groups = ["高ECR層", "低ECR層", "合算"]
    a_success = np.array([18, 16, 34])
    a_total = np.array([30, 80, 110])
    b_success = np.array([55, 3, 58])
    b_total = np.array([100, 20, 120])
    a_rate = a_success / a_total
    b_rate = b_success / b_total
    x = np.arange(len(groups))
    width = 0.34

    fig, ax = plt.subplots(figsize=(8.0, 4.8))
    ax.bar(x - width / 2, a_rate * 100, width, color=BOOK_A_BLUE, label="施策A")
    ax.bar(x + width / 2, b_rate * 100, width, color=BOOK_A_ORANGE, label="施策B")
    for xi, ar, br, at, bt in zip(x, a_rate, b_rate, a_total, b_total):
        ax.text(xi - width / 2, ar * 100 + 1.5, f"{ar*100:.0f}%\n(n={at})",
                ha="center", fontsize=8.5, color=BOOK_A_BLUE)
        ax.text(xi + width / 2, br * 100 + 1.5, f"{br*100:.0f}%\n(n={bt})",
                ha="center", fontsize=8.5, color=BOOK_A_ORANGE)
    ax.annotate("層別ではAが上", xy=(0, 62), xytext=(0.35, 72),
                fontsize=9.5, color=BOOK_A_BLUE,
                arrowprops=dict(arrowstyle="->", color=BOOK_A_BLUE, lw=1.0))
    ax.annotate("合算するとBが上", xy=(2.18, 49), xytext=(1.52, 64),
                fontsize=9.5, color=BOOK_A_ORANGE,
                arrowprops=dict(arrowstyle="->", color=BOOK_A_ORANGE, lw=1.0))
    ax.set_xticks(x)
    ax.set_xticklabels(groups)
    ax.set_ylim(0, 82)
    ax.set_ylabel("成功率（架空データ）")
    ax.set_title("図12-2 仮案  層を混ぜると、Simpson反転が起きる")
    ax.legend(loc="upper right", frameon=False)
    ax.grid(axis="y", alpha=0.2)
    for s in ["top", "right"]:
        ax.spines[s].set_visible(False)
    save_book_a(fig, "book-a-fig-12-2.png")


def book_a_fig_15_2():
    book_a_style()
    classes = ["IPO", "大型M&A", "小型M&A", "持続型\n小事業", "ライセンス"]
    values = np.array([120, 35, 8, 3, 1.2])
    probs = np.array([0.015, 0.04, 0.16, 0.55, 0.75])
    allocations = {
        "全ユニコーン案": np.array([14, 6, 0, 0, 0]),
        "分散ポートフォリオ": np.array([3, 4, 5, 5, 3]),
    }
    colors = [BOOK_A_BLUE, BOOK_A_PURPLE, BOOK_A_GREEN, BOOK_A_ORANGE, "#9aa0b4"]

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11.2, 4.9),
                                   gridspec_kw={"width_ratios": [1.65, 0.80]})
    bottoms = np.zeros(len(allocations))
    labels = list(allocations.keys())
    totals = []
    for idx, cls in enumerate(classes):
        contrib = np.array([allocations[label][idx] * values[idx] * probs[idx] for label in labels])
        totals = contrib if idx == 0 else totals + contrib
        ax1.bar(labels, contrib, bottom=bottoms, color=colors[idx], edgecolor="white",
                linewidth=0.8, label=cls)
        bottoms += contrib
    for xi, total in enumerate(bottoms):
        ax1.text(xi, total + 0.6, f"期待還流\n{total:.1f}", ha="center", fontsize=9.5,
                 color="#333", fontweight="bold")
    ax1.set_ylabel("期待還流（架空単位）")
    ax1.set_title("出口クラス別の期待還流")
    ax1.legend(loc="upper center", bbox_to_anchor=(0.5, -0.18),
               ncol=3, fontsize=8.5, frameon=False)
    ax1.grid(axis="y", alpha=0.2)

    concentration_risk = [0.82, 0.43]
    ax2.bar(labels, concentration_risk, color=[BOOK_A_ORANGE, BOOK_A_GREEN], width=0.55)
    for xi, v in enumerate(concentration_risk):
        ax2.text(xi, v + 0.03, f"{v:.2f}", ha="center", fontsize=10, color="#333")
    ax2.set_ylim(0, 1.0)
    ax2.set_ylabel("集中リスク（教材値）")
    ax2.set_title("リスクの違い")
    ax2.grid(axis="y", alpha=0.2)
    for ax in (ax1, ax2):
        for s in ["top", "right"]:
            ax.spines[s].set_visible(False)
    fig.subplots_adjust(bottom=0.26, wspace=0.34)
    fig.suptitle("図15-2 仮案  全ユニコーン案と出口分散案を比べる", y=1.03)
    save_book_a(fig, "book-a-fig-15-2.png")


def book_a_fig_16_2():
    book_a_style()
    names = [f"案件{i}" for i in range(1, 9)]
    pred = np.array([0.85, 0.70, 0.65, 0.55, 0.45, 0.35, 0.25, 0.15])
    outcome = np.array([1, 1, 0, 1, 0, 0, 1, 0])
    brier_each = (pred - outcome) ** 2
    brier = brier_each.mean()
    eps = 1e-9
    logloss = -(outcome * np.log(pred + eps) + (1 - outcome) * np.log(1 - pred + eps)).mean()
    x = np.arange(len(names))

    fig, ax = plt.subplots(figsize=(9.0, 4.9))
    ax.bar(x, pred, color=BOOK_A_BLUE, alpha=0.82, label="予測確率 p")
    ax.scatter(x, outcome, color=BOOK_A_ORANGE, s=58, zorder=5, label="実際の結果 o")
    for xi, p, o, err in zip(x, pred, outcome, brier_each):
        ax.plot([xi, xi], [p, o], color="#555", lw=1.1, alpha=0.65)
        ax.text(xi, max(p, o) + 0.045, f"{err:.2f}", ha="center", fontsize=8.3, color="#555")
    ax.text(0.15, 0.10, f"Brier score = {brier:.3f}\nlog-loss = {logloss:.3f}",
            fontsize=10, color="#333",
            bbox=dict(boxstyle="round,pad=0.35", facecolor="white", edgecolor="#cccccc"))
    ax.set_xticks(x)
    ax.set_xticklabels(names)
    ax.set_ylim(0, 1.12)
    ax.set_ylabel("確率 / 結果")
    ax.set_title("図16-2 仮案  予測確率は、結果と突き合わせて採点する")
    ax.legend(loc="upper right", frameon=False)
    ax.grid(axis="y", alpha=0.2)
    for s in ["top", "right"]:
        ax.spines[s].set_visible(False)
    save_book_a(fig, "book-a-fig-16-2.png")


if __name__ == "__main__":
    import sys
    targets = sys.argv[1:]
    default_figs = {
        "f1": fig_f1, "f2": fig_f2, "f3": fig_f3, "f4": fig_f4, "f5": fig_f5,
        "f6": fig_f6, "f7": fig_f7, "f8": fig_f8, "f9": fig_f9,
    }
    book_a_batch2 = {
        "book-a-4-2": book_a_fig_4_2,
        "book-a-7-3": book_a_fig_7_3,
        "book-a-8-1": book_a_fig_8_1,
        "book-a-8-2": book_a_fig_8_2,
        "book-a-8-4": book_a_fig_8_4,
        "book-a-9-1": book_a_fig_9_1,
        "book-a-9-2": book_a_fig_9_2,
        "book-a-9-3": book_a_fig_9_3,
        "book-a-11-1": book_a_fig_11_1,
        "book-a-12-2": book_a_fig_12_2,
        "book-a-15-2": book_a_fig_15_2,
        "book-a-16-2": book_a_fig_16_2,
    }
    all_figs = {**default_figs, **book_a_batch2}
    if targets:
        for t in targets:
            if t == "book-a-batch2":
                for fn in book_a_batch2.values():
                    fn()
            else:
                all_figs[t]()
        print(f"done. {', '.join(targets)} generated.")
    else:
        for fn in default_figs.values():
            fn()
        print("done. F1-F8 generated (F3 = self-consistent retrofit recompute, B-plan).")
