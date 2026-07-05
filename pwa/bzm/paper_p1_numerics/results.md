# SM-C.5 executed — numerical record for Figure 3 (paper P1)

**Status.** The SM-C.5 scheme is implemented and RUN (`solver.py`, numpy-only, Python 3.9;
total runtime ≈ 3 s on the session machine). All parameter values below are **synthetic
and fully disclosed**; calibration constants remain withheld under policy PF-010, as the
SM declares. The computed Figure 3 is `fig3.svg` (hand-assembled SVG, style-matched to
`paper_p1_fig1.svg`); raw outputs in `results.json`, full console log in `run.log`.

This record answers the referee's M9 requirements directly: (i) up-set diagnostic (M2),
(ii) one disclosed parameterization outside region R with a sign reversal, (iii) the full
θ*(k;F) curve rather than a single F_ref — which resolves the M4 question empirically.

---

## 0. Model as solved, and the reinterpretation ledger

Entry-normalization problem of SM-C.1 on states (σ, F, k), k ∈ {S0, S1, S2}:

- σ: regime-modulated diffusion; F: runway, dF = (R_net − B)dt with R_net < B, absorbed
  at F = 0; uniformized regime coupling Σ_j π_kj(φ_j − φ_k).
- Entered value G: L_k G + π − rG = 0, G(σ,0,k) = 0, flow π(σ,k) = P·R(σ,k)·S(σ,k) − B.
- Option: max{ L_k V − rV, ψ − V } = 0, V(σ,0,k) = 0; ψ = G − I (baseline, I paid
  externally at entry — the SM's value-matching), and a **jump variant** ψ = G(σ, F−I, k)
  with feasibility F ≥ I (I paid *from* the runway; referee M3(b)); both are run.

Where SM-C.0/C.5 is ambiguous or not well-posed, the following honest readings were
adopted (each one feeds the theory rewrite):

| # | SM locus | Reinterpretation |
|---|---|---|
| n1 | C.0 state (i): dσ = b_k dt + s_k dW, constant b_k | Constant drift makes σ non-stationary (σ → ±∞ a.s.) and the boundary data of C.5 incoherent. Read b_k as a regime-dependent **mean-reversion level**: OU with dσ = κ(m_k − σ)dt + s dW, m_{S0} < m_{S1} < m_{S2}, common vol. |
| n2 | C.2 Step 4 "σ-sections as an ODE system" | Not used. With R_net < B, F is a deterministic clock and the problem is genuinely 2-D and time-inhomogeneous (referee M1); we solve the 2-D problem the SM-C.5 pseudocode itself specifies, and θ* is reported as a **curve over F**. |
| n3 | "uniformized" Π, coupling Σ_j π_kj(V_j−V_k) | Read as generator Q = Π − Id at uniformization rate λ_u = 1/yr; off-diagonal π_kj are per-year switching intensities; π_kk enters only via row-stochasticity. |
| n4 | (A6) post-entry funds law + its [GAP] | Taken literally: same dF = (R_net−B)dt post-entry, no revenue feedback into F (the "earmarked funds" reading of M3(c)); post-entry life is deterministic, T0 = F/(B−R_net). A pre/post decoupling hook exists and is used **only** for the disclosed outside-R exhibit (Diagnostic E). |
| n5 | C.5 boundary "at σ_max impose V = G − I" | Upgraded to V = max(G − I, 0): at small F the entry region is empty (G < I everywhere) and the entered branch is wrong there; max(·,0) is exact under monotonicity of G in (σ,F). Ex-post check passes (see §2). |
| n6 | C.5 band ε_b in the threshold extractor | With the exact/projected obstacle the discrete stopping set is exact (D = 0 on it); ε_b is a float tolerance (1e−11), not a modeling band. |
| n7 | — | Indifference points with ψ ≤ 0 are not booked as entry (relevant only to the jump variant's F = I level). |
| n8 | G's σ-boundaries (unspecified in SM) | Reflecting (zero-flux); the logistic flows are saturated at both ends, so the true G_σ ≈ 0 there. |

## 1. Baseline synthetic parameters (disclosed)

| Object | Value |
|---|---|
| discount r | 0.06 /yr |
| founding cost I | 1.5 |
| opportunity scale P | 4.0 |
| burn B | 1.0 /yr (enters flow **and** funds law) |
| self-revenue R_net | 0.25 /yr → μ_F = −0.75 /yr; T0 = F/0.75 |
| OU κ, s | 0.4 /yr, 0.7 /√yr (common vol) |
| OU levels m_k | (−1.0, 0.0, +1.0) for (S0, S1, S2) |
| R(σ,k) | logistic(1.2·(σ − 0.6 + h_k)) |
| S(σ,k) | 0.25 + 0.70·logistic(1.0·(σ − 0.0 + h_k)) |
| regime shifts h_k | (−0.25, 0.00, +0.25) — flows regime-ordered pointwise |
| Π (uniformized, λ_u=1/yr) | rows: (0.90, 0.08, 0.02) / (0.08, 0.84, 0.08) / (0.02, 0.08, 0.90) |
| grids | σ ∈ [−4, 5], Δσ = 0.04 (226 nodes); F ∈ [0, 6], ΔF = 0.025 (241 levels); F_ref = 4.0 |

Implied anchors: Marshallian flow roots (P·R·S = B) at σ = (0.480, 0.230, −0.021);
perpetual (F→∞, stationary solve) thresholds **θ∞ = (4.68, 2.28, 0.91)**.

## 2. Scheme and its validation

Implicit in σ and in the regime coupling, first-order upwind in F; because μ_F < 0 the
discrete stationary system is lower-triangular across F-levels, so the SM-C.5 fixed-point
loop is executed as a single upward march (one factorization, 240 mat-vecs), with the
pseudocode's obstacle projection per level. A second, independent solve treats each
level's obstacle problem **exactly** as an LCP (Howard policy iteration + block-tridiagonal
Thomas); this bounds the projection's splitting error.

| Check | Result |
|---|---|
| linear-solve residual (reused factorization) | ≤ 1.9e−12 |
| flat-flow analytic G (R·S ≡ const; exact annuity) | max rel err 1.0e−3 (first order in ΔF, as expected) |
| projection vs exact-LCP thresholds (baseline, all 241×3) | max \|Δθ̂\| = 0.080 = 2Δσ, at (F = 0.55, S2) — the steep near-F_min zone; interior offset one-sided (LCP ≥ projection) and ≤ 2 cells; all signs, orderings and curve shapes identical |
| ex-post σ_max check (SM-C.5) | σ_max inside the entry region at **every** (k,F) with nonempty entry region; all finite thresholds ≥ 0.24 interior to the boundary at F ≥ F_min+0.5; range of finite θ̂: [0.64, 4.76] on [−4, 5] |

### Diagnostic B — degenerate limit vs McDonald–Siegel/Dixit–Pindyck

Single regime, frozen F, GBM (drift r−δ, vol s_v·σ), flow π = σ, G = σ/δ exactly;
synthetic check values r = 0.06, δ = 0.03, s_v = 0.2, I = 10 → β₁ = 1.5,
θ_MS = δ·β₁/(β₁−1)·I = **0.9000**.

| mesh | θ̂ numerical | rel. error |
|---|---|---|
| Δσ = 0.005 (N=541) | 0.90122 | **1.4e−3** |
| Δσ = 0.0025 (N=1081) | 0.90061 | **6.8e−4** |

First-order convergence to the closed form; G reproduced to 8.5e−13. Up-set holds.

### Diagnostic A — mesh refinement (2× in both σ and F)

|θ̂(base) − θ̂(refined)| at F_ref = 4: S0 0.0002, S1 0.019, S2 0.018 — all ≤ Δσ/2.
Over all common F-levels with F ≥ F_min + 0.5: sup 0.040 (= Δσ, attained at the steep-zone
edge), median 0.018, p90 0.021. Thresholds are stable to about half a σ-cell.

### Diagnostic C — up-set check (referee M2)

For every (k, F) on the grid, {V − ψ ≤ ε} is an up-set in σ (suffix property):
**0 violations** at the exact stopping set and at relaxed bands ε ∈ {1e−6, 1e−4, 1e−3}·I —
across the baseline (241 levels × 3 regimes), the jump variant, the split-drain exhibit,
the stationary limit and the MS check. No disconnected stopping sets, no near-tangencies,
anywhere in the disclosed parameter neighborhood. (This is a check of the single-crossing
geometry the SM asserts at C.2 Step 1 / [GAP C-G5] — supported here, not proved.)

## 3. Threshold curves θ̂*(k; F) — the paper's central computed object

Baseline (external I). F_min(k) = (0.450, 0.425, 0.425): below it **no entry at any σ**
(max_σ G < I — "forced non-entry", exactly M3(b)'s corrected reading of the F→0 limit).

| F | 0.50 | 0.75 | 1.00 | 1.50 | 2.00 | 2.50 | 3.00 | 3.50 | 4.00 | 4.50 | 5.00 | 5.50 | 6.00 | θ∞ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| S0 | 3.520 | 2.560 | 2.314 | 2.200 | 2.240 | 2.320 | 2.410 | 2.520 | 2.640 | 2.732 | 2.840 | 2.946 | 3.040 | 4.68 |
| S1 | 3.080 | 2.040 | 1.736 | 1.520 | 1.453 | 1.440 | 1.440 | 1.480 | 1.498 | 1.520 | 1.560 | 1.593 | 1.608 | 2.28 |
| S2 | 2.640 | 1.554 | 1.188 | 0.880 | 0.750 | 0.680 | 0.640 | 0.640 | 0.640 | 0.640 | 0.640 | 0.640 | 0.640 | 0.91 |

Regime ordering θ̂*(S0) > θ̂*(S1) > θ̂*(S2): holds at **every** common-feasible F level. ✓

**The F-slope is NOT monotone (headline; referee M4).** Each curve diverges as F ↓ F_min
(forced non-entry), falls steeply (post-entry-slack channel dominant), reaches an interior
minimum, and then **rises** toward the perpetual threshold θ∞(k):

| regime | dip location F_dip | θ̂ at dip | θ̂ at F=6 | rise over [F_dip, 6] | slope sign pattern |
|---|---|---|---|---|---|
| S0 | ≈ 1.3–1.8 | 2.200 | 3.040 | **+0.84** | − on (0.45, 1.3); + on (1.8, 6.0) |
| S1 | ≈ 2.1–3.0 | 1.440 | 1.608 | **+0.17** | − on (0.43, 2.05); + on (3.0, 6.0) |
| S2 | ≈ 2.9 | 0.640 | 0.640 | +0.00 (< mesh tol.) | − on (0.43, 2.9); ≈ 0 on (2.9, 6.0); θ∞ = 0.91 implies an eventual rise beyond the computed F-range |

The positive tail is robust: it appears identically on the 2× refined mesh and in the
exact-LCP solve (e.g. S0 at F = 2/3/4/5/6: base 2.24/2.41/2.64/2.84/3.04; refined
2.24/2.42/2.64/2.85/3.05; LCP 2.29/2.48/2.68/2.90/3.10), with magnitude 4–20× the mesh
tolerance. So **Prop 2(iii)'s sign ∂θ*/∂F < 0 holds only on a band [F_min, F_dip(k)]**
— and the violation is at *large* F, i.e. inside the region R1 as currently written
("F bounded away from zero" excludes the wrong end). Mechanically, the rise is the
waiting-option channel: with more runway, waiting (in particular waiting for a regime
switch) strengthens faster than the entered value at the boundary; it is strongest in the
dormant regime (largest switch upside), invisible on this F-range in the aligned regime
(nothing better to wait for). The 3-regime dip ordering F_dip(S0) < F_dip(S1) < F_dip(S2)
and the rise ordering S0 > S1 > S2 are the computable fingerprint of that mechanism.

**Jump variant (F ↦ F − I, feasibility F ≥ I).** F_min = 1.525 (= I + ΔF) for all k.

| F | 1.525 | 1.60 | 1.80 | 2.00 | 2.50 | 3.00 | 3.50 | 4.00 | 5.00 | 6.00 |
|---|---|---|---|---|---|---|---|---|---|---|
| S0 | 0.520 | 0.600 | 0.755 | 0.856 | 1.080 | 1.253 | 1.412 | 1.560 | 1.834 | 2.066 |
| S1 | 0.240 | 0.320 | 0.440 | 0.511 | 0.640 | 0.738 | 0.821 | 0.880 | 1.000 | 1.114 |
| S2 | −0.028 | 0.040 | 0.120 | 0.160 | 0.240 | 0.280 | 0.320 | 0.350 | 0.391 | 0.412 |

Two structural differences from the baseline, both first-order for the theory:
(i) at the deadline F ↓ I the threshold **collapses down to the Marshallian flow root**
(0.480, 0.230, −0.021) — the option dies worthless below F = I, so just above it the rule
is "enter iff flow-positive" (Boyle–Guthrie forced-early-entry, the purest deadline
effect); (ii) the F-slope is then **positive over the entire feasible range** — Prop
2(iii)'s sign is reversed almost everywhere under this financing convention. Also
θ̂_jump < θ̂_external throughout (paying I out of a long runway is nearly costless at the
margin, so the bar is lower). **The sign of ∂θ*/∂F depends on who pays I** — the
M3(b) modeling choice is not a detail.

## 4. Diagnostic D — Proposition 2 signs at F_ref = 4 (baseline world)

| sweep (range) | θ̂*(S0) | θ̂*(S1) | θ̂*(S2) | sign | Prop 2 |
|---|---|---|---|---|---|
| P: 3.0 → 5.0 | 3.800 → 2.004 | 2.360 → 1.036 | 1.240 → 0.280 | **− − −** (monotone, 9 pts) | ✓ (i) |
| B composite: 0.8 → 1.2 | 2.320 → 2.880 | 1.135 → 1.800 | 0.320 → 0.920 | **+ + +** (monotone) | ✓ (ii) on R |
| B flow-channel only (funds law pinned) | 2.160 → 3.135 | 1.120 → 1.880 | 0.347 → 0.920 | + + + (steeper) | decomposition |
| B pre-entry-drain only (flow & post pinned) | 2.640 → 2.640 | 1.520 → 1.480 | 0.760 → 0.520 | **0 − −** | **reversal** (E) |
| F: (curve, §3) | non-monotone | non-monotone | − then ≈0 | band-limited | ✗ (iii) as stated |
| π_00: 0.80 → 0.96 (prop. rescale) | **2.440 → 2.760 (+)** | 1.480 → 1.520 (+, cross) | 0.629 → 0.640 (≈0, cross) | own-sign **+** | **✗ (iv) for S0** |
| π_11: 0.74 → 0.94 | 2.640 → 2.639 (≈0, cross) | **1.542 → 1.449 (−)** | 0.640 → 0.640 (0, cross) | own-sign − | ✓ (iv) for S1 |
| π_22: 0.80 → 0.96 | 2.640 → 2.637 (≈0, cross) | 1.512 → 1.486 (−, cross) | **0.765 → 0.520 (−)** | own-sign − | ✓ (iv) for S2 |

Notes.
- **π_kk is clean only away from the dormant regime**: under the proportional
  off-diagonal rescaling that the sweep spec prescribes, ∂θ̂*(S0)/∂π_00 > 0 (monotone
  across the sweep): making a *bad* regime stickier raises its bar — the Marshallian
  flow-weight channel beats the shrunk switch-option channel. Prop 2(iv)'s uniform-in-k
  claim fails; it survives for S1 and cleanly for S2 (as the referee's M5(a) predicted,
  with S1 landing on the compliant side under this scheme).
- **Cross-persistence (M5(b))**: ∂θ̂*(S1)/∂π_{S2S2} < 0 (1.512 → 1.486) — the
  "policy credibility" story the main text wants is carried by the *good regime's*
  persistence lowering the *warming* regime's bar, a derivative Prop 2 does not currently
  contain; it is numerically well-behaved and worth stating as its own claim.
- **B decomposition**: the composite + sign is the flow (post-entry-cost) channel minus a
  drain offset; at thin runway (E1 below) the composite sign still does **not** flip in
  this one-F model — the reversal needs the pre/post split (M4's point exactly).

## 5. Diagnostic E — outside region R (the qualifier has content)

- **E(i) pre-entry-drain B sweep** (disclosed decoupling μ_F_post pinned at −0.75, flow-B
  pinned at 1.0, μ_F_pre = R_net − B swept): ∂θ̂*/∂B ≤ 0, strictly negative for S1/S2
  (S2: 0.760 → 0.520 over B ∈ [0.8, 1.2]). Higher burn that hits only the *waiting* stage
  lowers the bar — the Boyle–Guthrie channel isolated, i.e. the B-sign reversal (R2) is
  guarding against. Within-model (no decoupling), the composite sign stayed positive even
  at F_ref = 1.2 (E1: S1 1.223 → 2.040, monotone +), because the same B also truncates
  post-entry life; so the reversal genuinely lives outside the paper's single-F region.
- **E(ii) split-drain world** (μ_F_pre = −1.5, μ_F_post = −0.25, all else baseline):
  θ̂*(S2; F) dips **negative** (min −0.64 at F ≈ 2.2 — GO below the long-run mean), and
  all three curves turn to positive F-slope early (S1 from F ≈ 1.15); LCP spot-check and
  up-set diagnostics pass in this world too (0 violations).
- **E(iii) corners** (flow-B sweep inside the split-drain world): at B = 0.8 regime S2
  stops **everywhere** on the grid (θ̂ = σ_min: GO regardless of macro state); at B = 1.2
  regime S0's interior entry region closes (θ̂ → σ_max). Interior thresholds are not a
  global property of the model — (A5)/interiority is a real restriction, not decoration.

## 5F. Diagnostic F (transversality/GEN check) — theory rewrite R4a, Diag (vii)

Display checked at every reported boundary point θ̂*(k;F), both conventions:
π(θ̂*,k) − c > λ_u·Σ_{j≠k} π_kj·[V−O](θ̂*, F, j) ≥ 0, with c = rI = 0.09 under (E)
(external I) and c = 0 under (J) (F ↦ F−I); λ_u = 1, D_j = V−O of the other regimes
interpolated linearly on the σ-grid at the sub-grid θ̂. (Derivation used: at the
boundary D = D_σ = D_F = 0, so ½s²D_σσ = (π − c) − Σ_{j≠k}π_kj D_j on the continuation
side; GEN is strict positivity of the right side. c = rI under (E) because the constant
I is annihilated by L_k except through discounting; c = 0 under (J) because the F-shift
in O = G(σ, F−I) commutes with the F-independent generator.)

| convention | regime | boundary pts | min margin (LHS−RHS) | at F | RHS range | margin ≤ 0 |
|---|---|---|---|---|---|---|
| (E) c=0.09 | S0 | 223 | **+1.791** | 1.300 (dip) | [0, 0] | none |
| (E) | S1 | 224 | **+1.196** | 3.000 (dip) | [0.002, 0.175] | none |
| (E) | S2 | 224 | **+0.482** | 6.000 | [0.004, 0.178] | none |
| (J) c=0 | S0 | 180 | **+0.041** | 1.525 (=I+ΔF) | [0, 0] | none |
| (J) | S1 | 180 | **+0.010** | 1.525 | [0.001, 0.097] | none |
| (J) | S2 | 180 | **−0.008** | 1.525 | [0.001, 0.095] | 1 of 180 (0.6%), at F = 1.525 only |

Summary. Under (E), GEN holds strictly at **all** 671 boundary points with a wide margin
(min +0.48); the per-regime minima sit exactly at the θ-curve dips (lowest boundary ⇒
lowest boundary flow). The RHS is identically zero for S0 — by the regime ordering plus
the up-set property, S1/S2 are already stopped at θ*(S0), so their D_j vanish and GEN
for the dormant regime reduces to π − rI > 0; the switching term binds most for S2
(worse regimes still waiting at its boundary), peaking at 0.178 ≪ LHS. Under (J), GEN
holds at every interior point but the margin pinches to ~0 as F ↓ I: the boundary
collapses onto the Marshallian flow root (§3), so LHS = π(θ̂) → 0 and RHS → 0 *by
construction*, and the display degenerates at the deadline. The single non-positive
point (S2, first feasible level F = I + ΔF, margin −0.008) is floor-level extraction
noise — θ̂ lands a fifth of a cell below the flow root, making π(θ̂) marginally
negative — not an interior violation; from F = 1.55 on all margins are positive. Net:
GEN has content exactly where R4a needs it (interior boundary points, both conventions)
and degenerates only at the (J) deadline, which the rewrite should exclude from GEN's
scope the way interiority already excludes F ≤ I. Numbers in `results.json`
(`gen_check_E` / `gen_check_J`); implementation `gen_check()` in `solver.py`.

## 6. Figure 3 (computed) — caption

> **Figure 3. The endogenous founding threshold, computed.** Numerical solution of the
> SM-C.5 scheme with synthetic parameter values (disclosed in SM-C.5; calibration
> constants withheld under PF-010). **(a)** Founding threshold curves θ̂*(k; F) per macro
> regime, baseline financing (founding cost I paid at entry). Entry is infeasible below
> F_min ≈ 0.43 (G < I everywhere: forced non-entry); each curve falls steeply as runway
> relaxes the post-entry exit risk, reaches an interior minimum, and rises again toward
> its perpetual level θ∞(k) (right edge) as slack strengthens the waiting option — the
> Prop. 2(iii) sign ∂θ*/∂F < 0 holds on a band, not globally. Dashed: the S1 curve when
> I is paid from the runway (F ↦ F − I): entry is infeasible below F = I and the
> threshold collapses to the Marshallian flow root at the deadline — the sign of the
> F-slope depends on how founding is financed. Regime ordering θ̂*(S0) > θ̂*(S1) > θ̂*(S2)
> holds at every runway level. **(b)** Comparative statics at F_ref = 4: (b1) larger
> opportunities lower the bar (∂θ*/∂P < 0); (b2) burn raises it (∂θ*/∂B > 0) — but a
> burn increase confined to the pre-entry stage lowers it (dashed: the outside-R
> reversal of Prop. 2(ii)); (b3) regime persistence π_kk (off-diagonal mass rescaled
> proportionally) lowers the bar in the aligned and warming regimes but *raises* it in
> the dormant regime — Prop. 2(iv) is regime-specific, not uniform. All panels: grid
> Δσ = 0.04, ΔF = 0.025; thresholds mesh-stable to ~Δσ/2 and verified against an exact
> per-level LCP solve; the McDonald–Siegel degenerate limit is reproduced to 1.4e−3.

## 7. What this feeds back to the theory (rewrite queue)

1. **Prop 2(iii) must be restated.** Computed sign pattern: − on [F_min, F_dip(k)], + on
   [F_dip(k), ∞) toward θ∞(k), with F_dip regime-ordered. R1's "F bounded away from zero"
   fences the wrong end — the violation is at large F. Honest options: claim the sign on
   an explicit band with the dip characterized; or restate per-regime (clean − only for
   the aligned regime on the relevant range); and engage Boyle–Guthrie via the jump
   variant, where the sign flips globally. The F→0 story is **forced non-entry** (obstacle
   collapse) under external I and **Marshallian collapse** (deadline exercise) under
   runway-funded I — the SM's "forced entry or exit" heuristic is the second world.
2. **Prop 2(iv) must be per-regime** under the (now explicit) proportional-rescaling
   scheme: own-persistence sign is + for S0, − for S1/S2. The policy paragraph should
   hang on the cross-derivative ∂θ*(S1)/∂π_{S2S2} < 0, which is the computable version of
   "credible commitment is a founding subsidy".
3. **Theorem 4 as a curve.** The free boundary is a well-behaved curve θ*(k; ·) on
   (F_min(k), ∞); no σ-section/ODE counting is available (n2). The up-set geometry (C-G5)
   held everywhere tested — a named single-crossing assumption plus this diagnostic is a
   defensible package.
4. **The financing of I is first-order** (M3(b)): thresholds, F-slopes and the deadline
   limit all change sign/shape between the external and jump conventions. State one, or
   report both.
5. Corner cases (E(iii)) show interiority is substantive; (A5) should say so.

*Files: `solver.py` (scheme + diagnostics), `results.json` (all numbers), `run.log`
(console record), `gen_fig3.py` (figure generator), `fig3.svg` (Figure 3).*
