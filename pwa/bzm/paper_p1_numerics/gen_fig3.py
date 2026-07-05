#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gen_fig3.py — assemble the computed Figure 3 (fig3.svg) from results.json.
Hand-written SVG, style-matched to paper_p1_fig1.svg / old paper_p1_fig3.svg:
Helvetica, grayscale (#222/#555/#888), 2.6 curve strokes, 1.6 axes, italic #666 footer.
No plotting library."""
import json
import numpy as np

res = json.load(open("results.json"))
F = np.array(res["baseline"]["F"])
TH = {n: np.array([np.inf if x is None else x for x in res["baseline"]["theta"][n]])
      for n in ("S0", "S1", "S2")}
THJ = {n: np.array([np.inf if x is None else x for x in res["jump"]["theta"][n]])
       for n in ("S0", "S1", "S2")}
th_inf = res["theta_inf"]
COL = {"S0": "#222", "S1": "#555", "S2": "#888"}

# ---------------- panel (a) geometry ----------------
AX0, AX1, AY0, AY1 = 86.0, 520.0, 470.0, 52.0     # x right, y up (AY0 bottom)
FMAX, THMAX = 6.0, 4.0

def xa(f): return AX0 + (f / FMAX) * (AX1 - AX0)
def ya(t): return AY0 + (t / THMAX) * (AY1 - AY0)

def curve_points(Fv, THv, clip=3.95, step=3):
    """polyline points, clipped at theta=clip with interpolated entry point."""
    pts = []
    fin = np.isfinite(THv)
    idx = np.where(fin)[0]
    prev = None
    for j, i in enumerate(idx):
        t = THv[i]
        if t > clip:
            prev = (F[i], t)
            continue
        if prev is not None and prev[1] > clip and not pts:
            # interpolate crossing of clip level
            f0, t0 = prev; f1, t1 = F[i], t
            lam = (clip - t1) / (t0 - t1)
            pts.append((f1 + lam * (f0 - f1), clip))
        if j % step == 0 or not pts or abs(t - pts[-1][1]) > 0.01 or i == idx[-1]:
            pts.append((F[i], t))
        prev = (F[i], t)
    return pts

def poly(pts, fx, fy):
    s = " ".join(f"{fx(p[0]):.1f},{fy(p[1]):.1f}" for p in pts)
    for p in pts:
        assert 0 <= fx(p[0]) <= 920 and 0 <= fy(p[1]) <= 560, p
    return s

S = []
S.append('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 920 560" '
         'font-family="Helvetica, Arial, sans-serif">')
S.append("""  <!-- Fig. 3 (COMPUTED): Endogenous founding threshold theta*_sigma(k; F) and its
       comparative statics, from the executed SM-C.5 scheme (solver.py).
       SYNTHETIC parameter values, fully disclosed in SM-C.5; calibration constants
       withheld under policy PF-010.

       Caption (for the List of Figures):
       Figure 3. The endogenous founding threshold, computed. Numerical solution of the
       SM-C.5 scheme with synthetic parameter values (disclosed in SM-C.5; calibration
       constants withheld under PF-010). (a) Founding threshold curves theta*(k;F) per
       macro regime, baseline financing (founding cost I paid at entry). Entry is
       infeasible below F_min ~ 0.43 (G < I everywhere: forced non-entry); each curve
       falls steeply as runway relieves post-entry exit risk, reaches an interior
       minimum, and rises again toward its perpetual level theta_inf(k) (right edge) as
       slack strengthens the waiting option - the Prop. 2(iii) sign d theta*/dF < 0
       holds on a band, not globally. Dashed: the S1 curve when I is paid from the
       runway (F -> F - I): entry is infeasible below F = I and the threshold collapses
       to the Marshallian flow root at the deadline - the sign of the F-slope depends on
       how founding is financed. Regime ordering theta*(S0) > theta*(S1) > theta*(S2)
       holds at every runway level. (b) Comparative statics at F_ref = 4: (b1) larger
       opportunities lower the bar (d theta*/dP < 0); (b2) burn raises it
       (d theta*/dB > 0) - but a burn increase confined to the pre-entry stage lowers it
       (dashed: the outside-R reversal of Prop. 2(ii)); (b3) regime persistence pi_kk
       (off-diagonal mass rescaled proportionally) lowers the bar in the aligned and
       warming regimes but raises it in the dormant regime - Prop. 2(iv) is
       regime-specific, not uniform. All panels: grid d sigma = 0.04, dF = 0.025;
       thresholds mesh-stable to ~ d sigma / 2 and verified against an exact per-level
       LCP solve; the McDonald-Siegel degenerate limit is reproduced to 1.4e-3. -->""")
S.append('''  <defs>
    <marker id="ax3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#333"/>
    </marker>
  </defs>''')

# ---- panel (a): frame ----
S.append(f'  <text x="{AX0-14:.0f}" y="34" font-size="14" font-weight="bold" fill="#222">(a) threshold curves θ*(k; F) — computed</text>')
# infeasible band
S.append(f'  <rect x="{xa(0):.1f}" y="{ya(THMAX):.1f}" width="{xa(0.4375)-xa(0):.1f}" height="{ya(0)-ya(THMAX):.1f}" fill="#f2f2f2"/>')
S.append(f'  <text x="{xa(0.21):.1f}" y="{ya(1.15):.1f}" font-size="11" fill="#777" text-anchor="middle" transform="rotate(-90 {xa(0.21):.1f} {ya(1.15):.1f})">no entry: G &lt; I (forced non-entry)</text>')
# F_ref guide
S.append(f'  <line x1="{xa(4):.1f}" y1="{ya(0):.1f}" x2="{xa(4):.1f}" y2="{ya(THMAX):.1f}" stroke="#cccccc" stroke-width="1" stroke-dasharray="2 4"/>')
S.append(f'  <text x="{xa(4):.1f}" y="{ya(THMAX)-6:.1f}" font-size="11" fill="#999" text-anchor="middle">F_ref</text>')
# F = I guide (jump feasibility)
S.append(f'  <line x1="{xa(1.5):.1f}" y1="{ya(0):.1f}" x2="{xa(1.5):.1f}" y2="{ya(0.55):.1f}" stroke="#999" stroke-width="1" stroke-dasharray="3 3"/>')
S.append(f'  <text x="{xa(1.5)+4:.1f}" y="{ya(0.06):.1f}" font-size="11" fill="#888">F = I</text>')
# axes
S.append(f'  <line x1="{AX0}" y1="{AY0}" x2="{AX1+14}" y2="{AY0}" stroke="#333" stroke-width="1.6" marker-end="url(#ax3)"/>')
S.append(f'  <line x1="{AX0}" y1="{AY0}" x2="{AX0}" y2="{AY1-10}" stroke="#333" stroke-width="1.6" marker-end="url(#ax3)"/>')
for f in range(0, 7):
    S.append(f'  <line x1="{xa(f):.1f}" y1="{AY0}" x2="{xa(f):.1f}" y2="{AY0+5}" stroke="#333" stroke-width="1.2"/>')
    S.append(f'  <text x="{xa(f):.1f}" y="{AY0+19}" font-size="11.5" fill="#444" text-anchor="middle">{f}</text>')
for t in range(0, 5):
    S.append(f'  <line x1="{AX0-5}" y1="{ya(t):.1f}" x2="{AX0}" y2="{ya(t):.1f}" stroke="#333" stroke-width="1.2"/>')
    S.append(f'  <text x="{AX0-9}" y="{ya(t)+4:.1f}" font-size="11.5" fill="#444" text-anchor="end">{t}</text>')
S.append(f'  <text x="{(AX0+AX1)/2:.0f}" y="{AY0+40}" font-size="15" fill="#222" text-anchor="middle">financial slack F (runway; gap funds, fellowships, patient revenue)</text>')
S.append(f'  <text x="40" y="{(AY0+AY1)/2:.0f}" font-size="15" fill="#222" text-anchor="middle" transform="rotate(-90 40 {(AY0+AY1)/2:.0f})">founding threshold θ*_σ (macro tailwind required)</text>')

# ---- panel (a): curves ----
for n in ("S0", "S1", "S2"):
    pts = curve_points(F, TH[n])
    S.append(f'  <polyline points="{poly(pts, xa, ya)}" fill="none" stroke="{COL[n]}" stroke-width="2.6"/>')
# jump-variant S1 (dashed)
ptsj = curve_points(F, THJ["S1"])
S.append(f'  <polyline points="{poly(ptsj, xa, ya)}" fill="none" stroke="#555" stroke-width="1.8" stroke-dasharray="7 4"/>')
S.append(f'  <text x="{xa(5.75):.1f}" y="{ya(1.27):.1f}" font-size="11.5" fill="#555" text-anchor="end" font-style="italic">S₁ when I is paid from runway (F↦F−I)</text>')

# dip markers (interior minima)
for n, (fd, td) in {"S0": (1.55, 2.199), "S1": (2.55, 1.440), "S2": (3.0, 0.640)}.items():
    S.append(f'  <circle cx="{xa(fd):.1f}" cy="{ya(td):.1f}" r="4" fill="#fff" stroke="{COL[n]}" stroke-width="1.8"/>')

# curve labels
S.append(f'  <text x="{xa(5.9):.1f}" y="{ya(3.04)-10:.1f}" font-size="13.5" font-weight="bold" fill="#222" text-anchor="end">θ*(S₀) dormant</text>')
S.append(f'  <text x="{xa(5.9):.1f}" y="{ya(1.608)-10:.1f}" font-size="13.5" font-weight="bold" fill="#555" text-anchor="end">θ*(S₁) warming</text>')
S.append(f'  <text x="{xa(4.3):.1f}" y="{ya(0.76):.1f}" font-size="13.5" font-weight="bold" fill="#888" text-anchor="middle">θ*(S₂) aligned</text>')

# theta_inf anchors at right edge
S.append(f'  <line x1="{AX1-8}" y1="{ya(th_inf[1]):.1f}" x2="{AX1+8}" y2="{ya(th_inf[1]):.1f}" stroke="#555" stroke-width="1.4" stroke-dasharray="4 3"/>')
S.append(f'  <text x="{AX1-12}" y="{ya(th_inf[1])+4:.1f}" font-size="11" fill="#666" text-anchor="end">θ∞(S₁)={th_inf[1]:.2f}</text>')
S.append(f'  <line x1="{AX1-8}" y1="{ya(th_inf[2]):.1f}" x2="{AX1+8}" y2="{ya(th_inf[2]):.1f}" stroke="#888" stroke-width="1.4" stroke-dasharray="4 3"/>')
S.append(f'  <text x="{AX1-12}" y="{ya(th_inf[2])+4:.1f}" font-size="11" fill="#666" text-anchor="end">θ∞(S₂)={th_inf[2]:.2f}</text>')
S.append(f'  <text x="{AX1+6}" y="{ya(3.82):.1f}" font-size="11" fill="#666" text-anchor="end">θ∞(S₀)={th_inf[0]:.2f} (off scale ↑)</text>')

# slope annotations
S.append(f'  <text x="{xa(0.85):.1f}" y="{ya(3.58):.1f}" font-size="12" fill="#555">∂θ*/∂F &lt; 0 :</text>')
S.append(f'  <text x="{xa(0.85):.1f}" y="{ya(3.58)+15:.1f}" font-size="12" fill="#555">runway relieves post-entry exit risk</text>')
S.append(f'  <text x="{xa(2.72):.1f}" y="{ya(2.16):.1f}" font-size="12" fill="#555">∂θ*/∂F &gt; 0 : slack strengthens</text>')
S.append(f'  <text x="{xa(2.72):.1f}" y="{ya(2.16)+15:.1f}" font-size="12" fill="#555">the waiting option (→ θ∞)</text>')
S.append(f'  <text x="{xa(2.75):.1f}" y="{ya(0.17):.1f}" font-size="11.5" fill="#666" font-style="italic">○ interior minima — ∂θ*/∂F flips sign</text>')

# ---------------- panels (b1)-(b3) ----------------
BX0, BX1 = 600.0, 880.0

def mini(y_top, y_bot, x_lo, x_hi, y_max, title, xticks, xtickfmt):
    """returns mapping fns + emits frame."""
    def fx(v): return BX0 + (v - x_lo) / (x_hi - x_lo) * (BX1 - BX0)
    def fy(t): return y_bot - (t / y_max) * (y_bot - y_top)
    S.append(f'  <text x="{BX0}" y="{y_top-8:.1f}" font-size="12.5" font-weight="bold" fill="#222">{title}</text>')
    S.append(f'  <line x1="{BX0}" y1="{y_bot}" x2="{BX1}" y2="{y_bot}" stroke="#333" stroke-width="1.3"/>')
    S.append(f'  <line x1="{BX0}" y1="{y_bot}" x2="{BX0}" y2="{y_top}" stroke="#333" stroke-width="1.3"/>')
    for v in xticks:
        S.append(f'  <line x1="{fx(v):.1f}" y1="{y_bot}" x2="{fx(v):.1f}" y2="{y_bot+4}" stroke="#333" stroke-width="1.1"/>')
        S.append(f'  <text x="{fx(v):.1f}" y="{y_bot+15}" font-size="11" fill="#444" text-anchor="middle">{xtickfmt(v)}</text>')
    for t in range(0, int(y_max) + 1):
        S.append(f'  <line x1="{BX0-4}" y1="{fy(t):.1f}" x2="{BX0}" y2="{fy(t):.1f}" stroke="#333" stroke-width="1.1"/>')
        S.append(f'  <text x="{BX0-7}" y="{fy(t)+3.5:.1f}" font-size="10.5" fill="#444" text-anchor="end">{t}</text>')
    return fx, fy

def sweep_lines(rows, fx, fy, dashed=False, only=None, labels=True, lab_dy=(0, 0, 0)):
    arr = np.array([[r[0]] + [np.nan if x is None else x for x in r[1:]] for r in rows])
    for k, n in enumerate(("S0", "S1", "S2")):
        if only is not None and n not in only:
            continue
        pts = [(v, t) for v, t in zip(arr[:, 0], arr[:, k + 1]) if np.isfinite(t)]
        dash = ' stroke-dasharray="6 4"' if dashed else ""
        w = 1.8 if dashed else 2.2
        S.append(f'  <polyline points="{poly(pts, fx, fy)}" fill="none" stroke="{COL[n]}" stroke-width="{w}"{dash}/>')
        if labels:
            S.append(f'  <text x="{fx(pts[-1][0])+5:.1f}" y="{fy(pts[-1][1])+3.5+lab_dy[k]:.1f}" font-size="11" fill="{COL[n]}">{n[0]}{"₀₁₂"[k]}</text>')

# (b1) P sweep
fx, fy = mini(52, 156, 3.0, 5.0, 4.0, "(b1) opportunity scale P — ∂θ*/∂P &lt; 0", [3.0, 4.0, 5.0], lambda v: f"{v:.0f}")
sweep_lines(res["sweep_P"], fx, fy)
S.append(f'  <text x="{BX0}" y="186" font-size="11" fill="#666" font-style="italic">bigger opportunities lower the bar (all regimes)</text>')

# (b2) B sweep
fx, fy = mini(218, 322, 0.8, 1.2, 3.0, "(b2) burn rate B — composite ∂θ*/∂B &gt; 0 on R", [0.8, 1.0, 1.2], lambda v: f"{v:.1f}")
sweep_lines(res["sweep_B_composite"], fx, fy)
sweep_lines(res["sweep_B_preonly"], fx, fy, dashed=True, only=("S2",), labels=False)
S.append(f'  <text x="{fx(1.19):.1f}" y="{fy(0.26):.1f}" font-size="10.5" fill="#888" text-anchor="end" font-style="italic">pre-entry-only B: sign flips</text>')
S.append(f'  <text x="{BX0}" y="352" font-size="11" fill="#666" font-style="italic">pre-entry-only burn lowers the bar (Boyle–Guthrie, outside R)</text>')

# (b3) pi_kk sweeps
fx, fy = mini(384, 488, 0.72, 0.98, 3.0, "(b3) own persistence π_kk — regime-specific sign", [0.75, 0.85, 0.95], lambda v: f"{v:.2f}")
sweep_lines(res["sweep_pi00"], fx, fy, only=("S0",), labels=False)
sweep_lines(res["sweep_pi11"], fx, fy, only=("S1",), labels=False)
sweep_lines(res["sweep_pi22"], fx, fy, only=("S2",), labels=False)
S.append(f'  <text x="{fx(0.965):.1f}" y="{fy(2.76)-1:.1f}" font-size="11" fill="#222">S₀ (+)</text>')
S.append(f'  <text x="{fx(0.945):.1f}" y="{fy(1.449)-6:.1f}" font-size="11" fill="#555">S₁ (−)</text>')
S.append(f'  <text x="{fx(0.965):.1f}" y="{fy(0.52)+11:.1f}" font-size="11" fill="#888">S₂ (−)</text>')
S.append(f'  <text x="{BX0}" y="518" font-size="11" fill="#666" font-style="italic">persistence lowers the bar in S₁/S₂, raises it in dormant S₀</text>')

# ---------------- footer ----------------
S.append('  <text x="460" y="534" font-size="11.5" fill="#666" text-anchor="middle" font-style="italic">Computed via the SM-C.5 scheme (solver.py); synthetic parameter values, fully disclosed in SM-C.5 — calibration constants withheld (PF-010). Grid Δσ=0.04, ΔF=0.025.</text>')
S.append('  <text x="460" y="550" font-size="11.5" fill="#666" text-anchor="middle" font-style="italic">Thresholds mesh-stable to ~Δσ/2; verified against an exact per-level LCP solve; McDonald–Siegel limit reproduced to 1.4×10⁻³. θ*(S₀)&gt;θ*(S₁)&gt;θ*(S₂) at every F.</text>')
S.append('</svg>')

with open("fig3.svg", "w") as f:
    f.write("\n".join(S) + "\n")
print("fig3.svg written,", len("\n".join(S)), "bytes")
