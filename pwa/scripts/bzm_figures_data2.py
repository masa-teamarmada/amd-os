#!/usr/bin/env python3
"""
BZM 教科書・章頭ストーリー型のデータ図 第2弾 (f12-f15)。
混合モード / 日本語ラベル (Hiragino)。
出力先: pwa/public/bzm/fNN_*.png

f12: 対数の物差し (1〜100,000)。例題45・練習255 のマーカー (score-and-bottleneck:133)
f13: 律速診断の横棒 αi/(Xi+1) 降順 (score-and-bottleneck:216)
f14: P(t) の階段グラフ (p-potential:128)
f15: 余力スラックの逆U字 (model-critiques:169)
"""
import os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "bzm")
os.makedirs(OUT, exist_ok=True)
DPI = 150

JP_FONT = "/System/Library/Fonts/ヒラギノ角ゴシック W1.ttc"
font_manager.fontManager.addfont(JP_FONT)
JP = font_manager.FontProperties(fname=JP_FONT).get_name()

plt.rcParams.update({
    "figure.facecolor": "white", "axes.facecolor": "white",
    "font.family": JP, "font.size": 11, "axes.titlesize": 13,
    "axes.unicode_minus": False,
})

BLUE = "#2a4d8f"
ORANGE = "#e07a5f"
GREEN = "#3a7a4a"
GREY = "#9aa0b4"


def save(fig, name):
    path = os.path.join(OUT, name)
    fig.savefig(path, dpi=DPI, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print("wrote", os.path.relpath(path))


# ---------------------------------------------------------------------------
# f12: 対数の物差し (1〜100,000)
# ---------------------------------------------------------------------------
def fig_f12():
    fig, ax = plt.subplots(figsize=(8.2, 2.6))
    ax.set_xscale("log")
    ax.set_xlim(1, 100000)
    ax.set_ylim(0, 1)
    ax.axhline(0.5, color="#444", lw=1.6, zorder=1)

    # 桁の目盛り
    for v in [1, 10, 100, 1000, 10000, 100000]:
        ax.plot([v, v], [0.44, 0.56], color="#444", lw=1.2)
        ax.text(v, 0.30, f"{v:,}", ha="center", fontsize=9, color="#444")

    # マーカー (45 と 255 は近いので左右にずらして衝突回避)
    for v, lbl, col, tx, dy, ha in [
            (45, "例題プロジェクト (約45)", BLUE, 13, 0.80, "right"),
            (255, "練習問題プロジェクト (約255)", GREEN, 900, 0.80, "left")]:
        ax.plot([v], [0.5], "o", color=col, ms=11, zorder=5)
        ax.annotate(lbl, xy=(v, 0.5), xytext=(tx, dy), ha=ha, fontsize=9.5,
                    color=col, fontweight="bold",
                    arrowprops=dict(arrowstyle="->", color=col, lw=1.2))

    # 両端の意味
    ax.text(1, 0.63, "シーズの気配\n(多くの軸がゼロ)", ha="left", va="top",
            fontsize=9, color="#888")
    ax.text(100000, 0.63, "全軸最高\n= 100,000", ha="right", va="top",
            fontsize=9, color="#888")
    ax.text(50000, 0.12, "1 桁 = 1 段階 (差や比ではなく桁で読む)", ha="center",
            fontsize=9, color=ORANGE, style="italic")

    ax.set_title("統合スコアは対数の物差しで読む")
    ax.set_yticks([])
    for s in ["top", "right", "left"]:
        ax.spines[s].set_visible(False)
    ax.spines["bottom"].set_visible(False)
    ax.set_xticks([])
    ax.set_xticks([], minor=True)  # log の minor tick を消す
    ax.tick_params(axis="x", which="both", length=0)
    save(fig, "f12_log_scale_ruler.png")


# ---------------------------------------------------------------------------
# f13: 律速診断の横棒 αi/(Xi+1) 降順
# 正本の例題値 (score-and-bottleneck:198-208)
# ---------------------------------------------------------------------------
def fig_f13():
    # (軸, α, X)
    axes = [("R_net", 0.8, 0), ("F", 1.5, 3), ("HRL", 1.1, 2), ("TRL", 1.0, 2),
            ("BRL", 0.6, 1), ("σ_SU", 1.3, 7), ("P", 1.0, 6), ("GRL", 0.3, 4),
            ("SRL", 0.2, 4)]
    rows = sorted(axes, key=lambda r: -r[1] / (r[2] + 1))
    names = [r[0] for r in rows]
    ratio = [r[1] / (r[2] + 1) for r in rows]
    y = np.arange(len(rows))[::-1]

    fig, ax = plt.subplots(figsize=(7.8, 4.6))
    bars = ax.barh(y, ratio, color=BLUE, height=0.62, zorder=3)
    bars[0].set_color(ORANGE)  # 律速を強調

    for yi, (nm, a, x), rt in zip(y, rows, ratio):
        note = f"α={a} × 1/(X+1)=1/{x + 1}"
        if rt > 0.30:
            # 幅のある棒は内訳を棒の中・値を右端に
            ax.text(0.012, yi, note, va="center", fontsize=8, color="#fff")
            ax.text(rt + 0.015, yi, f"{rt:.3f}", va="center", fontsize=9.5,
                    color="#333", fontweight="bold")
        else:
            # 短い棒は値→内訳を続けて右側に出す (重なり回避)
            ax.text(rt + 0.015, yi, f"{rt:.3f}", va="center", fontsize=9.5,
                    color="#333", fontweight="bold")
            ax.text(rt + 0.105, yi, note, va="center", fontsize=8, color="#888")

    ax.set_yticks(y)
    ax.set_yticklabels(names, fontsize=10)
    ax.set_xlabel("限界収益  α / (X + 1)  ＝ 重要度 × 伸びしろ  （軸 i ごと）")
    ax.set_xlim(0, 1.18)
    ax.set_title("律速診断 — 次の一手は最も伸びしろのある軸 (例題)")
    ax.annotate("律速軸: R_net\n(対価を得る検証)", xy=(0.8, y[0]),
                xytext=(0.92, y[0] - 0.7), fontsize=9.5, color=ORANGE,
                fontweight="bold", ha="left",
                arrowprops=dict(arrowstyle="->", color=ORANGE, lw=1.3))
    ax.grid(axis="x", alpha=0.2)
    for s in ["top", "right"]:
        ax.spines[s].set_visible(False)
    save(fig, "f13_bottleneck_bar.png")


# ---------------------------------------------------------------------------
# f14: P(t) の階段グラフ — 用途転換のたびに天井が跳ね上がる
# ---------------------------------------------------------------------------
def fig_f14():
    t = [0, 2, 2, 4.5, 4.5, 7, 7, 10]
    p = [2, 2, 4, 4, 6.5, 6.5, 8.5, 8.5]
    fig, ax = plt.subplots(figsize=(7.6, 4.6))
    ax.plot(t, p, color=BLUE, lw=2.6, zorder=3)
    ax.fill_between(t, 0, p, color=BLUE, alpha=0.06)

    # ジャンプのラベル
    jumps = [(2, 3, "隣接用途の発見"), (4.5, 5.25, "産業文脈の書き換え"),
             (7, 7.5, "標準・規格への接続")]
    for x, ymid, lbl in jumps:
        ax.annotate("", xy=(x, ymid + 1.1), xytext=(x, ymid - 1.0),
                    arrowprops=dict(arrowstyle="->", color=ORANGE, lw=1.6))
        ax.text(x + 0.12, ymid, lbl, fontsize=9, color=ORANGE, va="center")

    ax.axhline(2, color=GREY, ls="--", lw=1.2)
    ax.text(9.8, 2.2, "当初用途の天井", ha="right", fontsize=9, color="#888")

    ax.set_xlabel("時間 →")
    ax.set_ylabel("天井 P(t)")
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 9.5)
    ax.set_title("P は測るものであると同時に、動かすもの")
    ax.set_xticks([])
    ax.grid(axis="y", alpha=0.2)
    for s in ["top", "right"]:
        ax.spines[s].set_visible(False)
    save(fig, "f14_pt_staircase.png")


# ---------------------------------------------------------------------------
# f15: 余力スラックの逆U字
# ---------------------------------------------------------------------------
def fig_f15():
    x = np.linspace(0, 10, 300)
    # 逆U字 (山頂 x=5.5 付近)
    perf = -((x - 5.5) ** 2) * 0.9 + 27
    perf = np.clip(perf, 0, None)
    fig, ax = plt.subplots(figsize=(7.6, 4.6))
    ax.plot(x, perf, color=BLUE, lw=2.8, zorder=3)

    # 適正帯
    ax.axvspan(4.2, 6.8, color=GREEN, alpha=0.10)
    ax.text(5.5, 4, "適正帯", ha="center", fontsize=10, color=GREEN, fontweight="bold")

    # 両端の劣化
    ax.text(1.4, 9, "余力不足\n実験できない\n交渉で譲歩を強いられる", ha="center",
            fontsize=8.8, color=ORANGE)
    ax.text(8.7, 9, "余力過多\n規律喪失\n検証の先送り", ha="center",
            fontsize=8.8, color=ORANGE)

    ax.set_xlabel("余力 (スラック) の水準 →")
    ax.set_ylabel("組織のパフォーマンス")
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 30)
    ax.set_title("余力は多すぎても少なすぎても効きが落ちる (逆U字)")
    ax.set_xticks([])
    ax.set_yticks([])
    for s in ["top", "right"]:
        ax.spines[s].set_visible(False)
    ax.text(5, -3.2, "H の読み方: 低すぎる H だけでなく、x が停滞したままの高すぎる H も警戒帯",
            ha="center", fontsize=8.5, color="#666", transform=ax.transData)
    save(fig, "f15_slack_inverted_u.png")


if __name__ == "__main__":
    fig_f12()
    fig_f13()
    fig_f14()
    fig_f15()
    print("done")
