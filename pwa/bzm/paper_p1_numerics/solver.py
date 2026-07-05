#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
solver.py — Executed SM-C.5 numerical scheme for Figure 3 (Before Zero model, paper P1).

SYNTHETIC PARAMETERS ONLY. Calibration constants are withheld under policy PF-010;
every numerical value in `baseline_params()` is a disclosed synthetic placeholder.
numpy-only (no scipy on this machine).

--------------------------------------------------------------------------------------
MODEL SOLVED (entry normalization, SM-C.1 / Remark C.1)
--------------------------------------------------------------------------------------
States: sigma in R (macro alignment), F >= 0 (runway), k in {S0,S1,S2} (regime).

  d sigma = b_k(sigma) dt + s dW,   b_k(sigma) = kappa*(m_k - sigma)   [OU-type]
  d F     = mu_F dt,  mu_F = R_net - B < 0                             [deterministic clock]
  regime switching: uniformized row-stochastic Pi at rate lambda_u = 1/yr,
     coupling operator (Q phi)_k = sum_j pi_kj (phi_j - phi_k) = ((Pi - Id) phi)_k.

Flow (entered):  pi(sigma,k) = P * R(sigma,k) * S(sigma,k) - B, with
  R(sigma,k) = logistic(aR*(sigma - cR + h_k))                  in (0,1)
  S(sigma,k) = Slo + (Shi-Slo)*logistic(aS*(sigma - cS + h_k))  in (Slo,Shi)
  h_{S0} < h_{S1} < h_{S2}  =>  flows regime-ordered pointwise (Lemma C.1(d) input).

Entered value G:  L_k G + pi - r G = 0,  G(sigma,0,k)=0  (absorbed: forced exit).
Pre-entry value V (no flow while waiting):
  max{ L_k V - r V ,  psi - V } = 0,   V(sigma,0,k)=0,
  psi = G - I                         [baseline: I paid externally at entry]
  psi = G(sigma, F - I, k), F >= I    [jump variant: I paid FROM runway; infeasible F < I;
                                       no second -I (cost IS the runway loss)]

Boundary data (SM-C.5, amended where the SM spec is not well-posed — see NOTES):
  V(sigma_min, F, k) = 0                        (SM: proxy for sigma -> -inf)
  V(sigma_max, F, k) = max(G - I, 0)            (SM says "entered branch G - I"; we take
                                                 max(.,0): at low F the entry region is
                                                 EMPTY (G<I everywhere) and V=0 is the
                                                 correct never-enter value; justified by
                                                 monotonicity of G in sigma and F; the
                                                 ex-post check "sigma_max inside the entry
                                                 region whenever it is nonempty" is run)
  G: reflecting (zero-flux) at both sigma ends  (flows are saturated logistics there;
                                                 SM leaves G's sigma-boundary unspecified)

--------------------------------------------------------------------------------------
SCHEME (SM-C.5 pseudocode, made level-exact)
--------------------------------------------------------------------------------------
Uniform grids. Upwind first-order drifts, central diffusion, Pi-row coupling — exactly
the pseudocode stencil. Because mu_F < 0, the F-upwind difference makes the discrete
stationary system LOWER-TRIANGULAR across F-levels: the pseudocode's global fixed-point
loop is therefore equivalent to a single upward march in F,

   [ (r + c) Id - A_sigma - Q ] X_i = c X_{i-1} + src,   c = |mu_F| / dF,

(implicit in sigma and in the regime coupling; one 3N x 3N solve per level, matrix
constant across levels so it is factorized once), followed at each level by the entry
obstacle  V_i = max(X_i, psi_i)  — the pseudocode's own projection step. This projected
marching scheme is the PRIMARY scheme. As a verification pass, the per-level obstacle
problem is also solved EXACTLY as a linear complementarity problem (Howard policy
iteration + block-tridiagonal 3x3 Thomas solve); agreement of the extracted thresholds
bounds the projection (splitting) error.

Threshold extraction: on each (k, F-level), the stopping set is {D <= eps}, D = V - psi
(exact zeros by construction). theta_hat = first stopped node, refined sub-grid by the
smooth-pasting extrapolation D ~ const*(theta - sigma)^2 (linear extrapolation of
sqrt(D) from the last two continuation nodes). The pseudocode's min-node extractor is
also reported. Up-set diagnostic: the stopping set must be a suffix in sigma.

--------------------------------------------------------------------------------------
NOTES: SM reinterpretations needed for well-posedness (feed the theory rewrite)
--------------------------------------------------------------------------------------
(n1) SM-C.0 writes d sigma = b_k dt + s_k dW with constant b_k. A constant-drift BM has
     no stationary regime distinction and pushes sigma to +/-inf a.s.; we read b_k as a
     regime-dependent MEAN-REVERSION LEVEL (OU, common vol), b_k(sigma)=kappa*(m_k-sigma),
     m_{S0}<m_{S1}<m_{S2}. Boundary conditions then make honest sense.
(n2) F is a deterministic clock (R_net < B): the problem is genuinely 2-D and
     time-inhomogeneous (deadline T0 = F/(B-R_net)); SM-C.2 Step 4's "sigma-sections as
     an ODE system" reduction is NOT used (cf. referee M1). theta* is a CURVE in F.
(n3) Uniformized coupling: Sigma_j pi_kj (V_j - V_k) with row-stochastic Pi is the
     generator Q = Pi - Id at uniformization rate lambda_u = 1/yr (off-diagonal pi_kj =
     per-year switching intensities). pi_kk enters only through 1 - sum(off-diag).
(n4) (A6) read literally: post-entry runway follows the SAME funds law dF = (R_net-B)dt
     (no revenue feedback into F; "earmarked funds" reading of referee M3(c)); post-entry
     life is the deterministic T0(F). A pre/post decoupling hook (mu_F_pre, mu_F_post)
     exists and is used ONLY for the disclosed outside-R exhibit (Diagnostic E).
(n5) V(sigma_max)=G-I upgraded to max(G-I,0) — see boundary block above.
(n6) eps_b band: with the exact/projected obstacle the discrete stopping set is exact
     (D = 0 on it); eps_b is a pure float tolerance (1e-11), not a modeling band.
(n7) Entry requires psi > 0 to count as entry (indifference V=psi=0, e.g. entering with
     zero post-jump runway, is not booked as entry).
--------------------------------------------------------------------------------------
"""
import json
import time
import warnings
import numpy as np

# macOS Accelerate BLAS emits spurious divide-by-zero/overflow FPE flags in matmul on
# aarch64 even for perfectly finite, well-conditioned inputs (verified: cond(M)~25,
# np.dot and manual row sums agree bit-for-bit and raise nothing). Cosmetic only;
# real solve quality is guarded by the per-march residual checks and finiteness asserts.
warnings.filterwarnings("ignore", message=".*encountered in matmul")

EPS_STOP = 1e-11    # |D| tolerance identifying the stopping set (exact zeros expected)
PSI_GUARD = 1e-12   # entry counted only where obstacle psi > this (note n7)


# ----------------------------------------------------------------------------- params
def baseline_params():
    """Fully disclosed SYNTHETIC parameter values (placeholders per PF-010)."""
    return dict(
        # economics
        r=0.06,          # discount rate (/yr)
        I=1.5,           # founding cost (sunk)
        P=4.0,           # opportunity scale
        B=1.0,           # burn rate (/yr) — enters BOTH the flow and the funds law
        Rnet=0.25,       # self-generated revenue (/yr); mu_F = Rnet - B = -0.75
        # OU macro state (note n1)
        kappa=0.4,       # mean-reversion speed (/yr)
        s=0.7,           # common diffusion vol (/sqrt yr)
        m=(-1.0, 0.0, 1.0),      # regime-dependent OU levels, S0 < S1 < S2
        # flow response functions (synthetic logistics)
        h=(-0.25, 0.0, 0.25),    # regime level shifts (ordered flows)
        aR=1.2, cR=0.6,          # R(sigma,k) = logistic(aR (sigma - cR + h_k))
        aS=1.0, cS=0.0,          # S in (Slo,Shi)
        Slo=0.25, Shi=0.95,
        # uniformized regime transition matrix (lambda_u = 1/yr), rows sum to 1 (note n3)
        Pi=((0.90, 0.08, 0.02),
            (0.08, 0.84, 0.08),
            (0.02, 0.08, 0.90)),
        # grids (dsig = 0.04, dF = 0.025 at baseline; sigma_max chosen so that all
        # finite thresholds, incl. the perpetual limits theta_inf, stay >~0.9 interior)
        sig_min=-4.0, sig_max=5.0, Nsig=226,
        F_max=6.0, NF=241, F_ref=4.0,
        # variants / hooks
        entry_mode="external",   # "external": psi=G-I | "jump": psi=G(F-I), F>=I
        muF_pre=None,            # pre-entry funds drift override (default Rnet-B)
        muF_post=None,           # post-entry funds drift override (default Rnet-B)
        flow_const=None,         # if not None: R*S == flow_const (analytic G check)
    )


def logistic(x):
    return 1.0 / (1.0 + np.exp(-x))


def R_fun(sig, k, p):
    return logistic(p["aR"] * (sig - p["cR"] + p["h"][k]))


def S_fun(sig, k, p):
    return p["Slo"] + (p["Shi"] - p["Slo"]) * logistic(p["aS"] * (sig - p["cS"] + p["h"][k]))


def flow_mat(sig, p):
    """pi(sigma,k) as (Nsig, 3)."""
    out = np.empty((len(sig), 3))
    for k in range(3):
        rs = (p["flow_const"] if p["flow_const"] is not None
              else R_fun(sig, k, p) * S_fun(sig, k, p))
        out[:, k] = p["P"] * rs - p["B"]
    return out


# ------------------------------------------------------------------- operator assembly
def sigma_tridiag(b, svec, dsig, reflect=True):
    """Monotone upwind/central tridiagonal generator coefficients (lo, di, up).
    Row sums are zero (generator). reflect=True folds mirror ghosts at both ends."""
    D2 = 0.5 * svec**2 / dsig**2
    up = D2 + np.maximum(b, 0.0) / dsig
    lo = D2 + np.maximum(-b, 0.0) / dsig
    di = -(lo + up)
    if reflect:
        up = up.copy(); lo = lo.copy()
        up[0] += lo[0]; lo[0] = 0.0
        lo[-1] += up[-1]; up[-1] = 0.0
    return lo, di, up


def assemble_M(p, sig, c_F, dirichlet_ends):
    """M = (r + c_F) Id - A_sigma - Q on the flattened grid (index j*3+k).
    dirichlet_ends=True replaces sigma-end rows with identity (used for V)."""
    N = len(sig)
    dsig = sig[1] - sig[0]
    A = np.zeros((3 * N, 3 * N))
    for k in range(3):
        b = p["kappa"] * (p["m"][k] - sig)
        svec = np.full(N, p["s"])
        lo, di, up = sigma_tridiag(b, svec, dsig, reflect=True)
        idx = np.arange(N) * 3 + k
        A[idx, idx] = di
        A[idx[1:], idx[:-1]] = lo[1:]
        A[idx[:-1], idx[1:]] = up[:-1]
    Q = np.asarray(p["Pi"]) - np.eye(3)
    for j in range(N):
        A[3 * j:3 * j + 3, 3 * j:3 * j + 3] += Q
    M = (p["r"] + c_F) * np.eye(3 * N) - A
    if dirichlet_ends:
        for j in (0, N - 1):
            for k in range(3):
                row = 3 * j + k
                M[row, :] = 0.0
                M[row, row] = 1.0
    return M


# ------------------------------------------------------------------------ G and V march
def grids(p):
    sig = np.linspace(p["sig_min"], p["sig_max"], p["Nsig"])
    F = np.linspace(0.0, p["F_max"], p["NF"])
    return sig, F


def mu_F(p, which):
    default = p["Rnet"] - p["B"]
    v = p["muF_pre"] if which == "pre" else p["muF_post"]
    v = default if v is None else v
    assert v < 0, "funds drift must be negative (R_net < B)"
    return v


def march_G(p, sig, F):
    """Entered value G on (NF, Nsig, 3). One factorization, NF-1 mat-vecs."""
    dF = F[1] - F[0]
    c = -mu_F(p, "post") / dF
    M = assemble_M(p, sig, c, dirichlet_ends=False)
    Minv = np.linalg.inv(M)
    piv = flow_mat(sig, p).reshape(-1)
    G = np.zeros((len(F), 3 * len(sig)))
    for i in range(1, len(F)):
        G[i] = Minv @ (c * G[i - 1] + piv)
    # residual quality check of the reused inverse (last level)
    res = np.max(np.abs(M @ G[-1] - (c * G[-2] + piv)))
    return G.reshape(len(F), len(sig), 3), res


def obstacle(p, G, F):
    """psi (NF, Nsig, 3) and feasibility mask (NF,). Note n7 for psi>0 guard downstream."""
    NF = len(F)
    if p["entry_mode"] == "external":
        return G - p["I"], np.ones(NF, dtype=bool)
    # jump variant: psi_i = G_{i-mshift}; infeasible below F = I
    dF = F[1] - F[0]
    mshift = int(round(p["I"] / dF))
    assert abs(mshift * dF - p["I"]) < 1e-9, "grid must place I on an F-node (jump variant)"
    psi = np.full_like(G, -np.inf)
    psi[mshift:] = G[:NF - mshift]
    feas = np.zeros(NF, dtype=bool)
    feas[mshift:] = True
    return psi, feas


def march_V_projected(p, sig, F, G):
    """PRIMARY scheme: implicit level solve + obstacle projection (SM-C.5 operator)."""
    N = len(sig)
    dF = F[1] - F[0]
    c = -mu_F(p, "pre") / dF
    M = assemble_M(p, sig, c, dirichlet_ends=True)
    Minv = np.linalg.inv(M)
    psi, feas = obstacle(p, G, F)
    V = np.zeros((len(F), N, 3))
    top = np.maximum(psi[:, N - 1, :], 0.0)          # Dirichlet at sigma_max (note n5)
    top[~feas] = 0.0
    for i in range(1, len(F)):
        rhs = (c * V[i - 1]).reshape(-1)
        rhs[0:3] = 0.0                               # sigma_min Dirichlet
        rhs[3 * (N - 1):3 * N] = top[i]              # sigma_max Dirichlet
        X = (Minv @ rhs).reshape(N, 3)
        V[i] = np.maximum(X, psi[i]) if feas[i] else X
    return V, psi, feas


# ------------------------------------------------ exact per-level LCP (verification)
def build_blocks(p, sig, c):
    """Base block-tridiagonal (3x3 blocks) of M = (r+c)Id - A - Q, Dirichlet sigma-ends."""
    N = len(sig)
    dsig = sig[1] - sig[0]
    Q = np.asarray(p["Pi"]) - np.eye(3)
    Lb = np.zeros((N, 3, 3)); Db = np.zeros((N, 3, 3)); Ub = np.zeros((N, 3, 3))
    for k in range(3):
        b = p["kappa"] * (p["m"][k] - sig)
        svec = np.full(N, p["s"])
        lo, di, up = sigma_tridiag(b, svec, dsig, reflect=True)
        Lb[:, k, k] = -lo
        Ub[:, k, k] = -up
        Db[:, k, k] = (p["r"] + c) - di
    Db -= Q[None, :, :]
    for j in (0, N - 1):                              # Dirichlet rows
        Lb[j] = 0.0; Ub[j] = 0.0; Db[j] = np.eye(3)
    return Lb, Db, Ub


def block_thomas(Lb, Db, Ub, rhs):
    N = len(Db)
    Cp = np.empty((N, 3, 3)); dp = np.empty((N, 3))
    Tinv = np.linalg.inv(Db[0])
    Cp[0] = Tinv @ Ub[0]; dp[0] = Tinv @ rhs[0]
    for j in range(1, N):
        T = Db[j] - Lb[j] @ Cp[j - 1]
        Tinv = np.linalg.inv(T)
        Cp[j] = Tinv @ Ub[j]
        dp[j] = Tinv @ (rhs[j] - Lb[j] @ dp[j - 1])
    X = np.empty((N, 3))
    X[N - 1] = dp[N - 1]
    for j in range(N - 2, -1, -1):
        X[j] = dp[j] - Cp[j] @ X[j + 1]
    return X


def march_V_lcp(p, sig, F, G, max_howard=80):
    """VERIFICATION scheme: per-level LCP min(MX - rhs, X - psi) = 0 solved exactly by
    Howard policy iteration (active rows -> identity) + block-Thomas."""
    N = len(sig)
    dF = F[1] - F[0]
    c = -mu_F(p, "pre") / dF
    Lb0, Db0, Ub0 = build_blocks(p, sig, c)
    psi, feas = obstacle(p, G, F)
    V = np.zeros((len(F), N, 3))
    top = np.maximum(psi[:, N - 1, :], 0.0); top[~feas] = 0.0
    interior = np.zeros((N, 3), dtype=bool); interior[1:N - 1, :] = True
    active = np.zeros((N, 3), dtype=bool)
    scale = p["r"] + c
    for i in range(1, len(F)):
        rhs0 = c * V[i - 1]
        rhs0[0] = 0.0
        rhs0[N - 1] = top[i]
        psi_i = psi[i]
        feas_i = feas[i]
        if not feas_i:
            active[:] = False
            V[i] = block_thomas(Lb0, Db0, Ub0, rhs0)
            continue
        ok = interior & np.isfinite(psi_i)
        active &= ok                                   # warm start from previous level
        for _ in range(max_howard):
            Lb = Lb0.copy(); Db = Db0.copy(); Ub = Ub0.copy(); rhs = rhs0.copy()
            jj, kk = np.where(active)
            Lb[jj, kk, :] = 0.0; Ub[jj, kk, :] = 0.0
            Db[jj, kk, :] = 0.0; Db[jj, kk, kk] = 1.0
            rhs[jj, kk] = psi_i[jj, kk]
            X = block_thomas(Lb, Db, Ub, rhs)
            # residuals under the BASE operator, comparably scaled
            MX = np.einsum("jab,jb->ja", Db0, X)
            MX[1:] += np.einsum("jab,jb->ja", Lb0[1:], X[:-1])
            MX[:-1] += np.einsum("jab,jb->ja", Ub0[:-1], X[1:])
            res_cont = (MX - rhs0) / scale
            res_stop = X - psi_i
            new_active = ok & (res_stop < res_cont)
            if np.array_equal(new_active, active):
                break
            active = new_active
        V[i] = np.maximum(X, psi_i)                    # exact up to float on stop set
    return V, psi, feas


# --------------------------------------------------------------- threshold extraction
def extract_thresholds(V, psi, feas, sig):
    """Per (F-level, regime): theta_hat (sub-grid), theta_node (pseudocode extractor),
    up-set flag of the exact stopping set. Returns dict of arrays (NF, 3)."""
    NF, N, _ = V.shape
    dsig = sig[1] - sig[0]
    theta = np.full((NF, 3), np.inf)
    theta_node = np.full((NF, 3), np.inf)
    upset = np.ones((NF, 3), dtype=bool)
    for i in range(NF):
        if not feas[i]:
            continue
        D = V[i] - psi[i]
        for k in range(3):
            stop = (D[:, k] <= EPS_STOP) & (psi[i][:, k] > PSI_GUARD)
            if not stop.any():
                continue
            j0 = int(np.argmax(stop))
            upset[i, k] = bool(stop[j0:].all())
            theta_node[i, k] = sig[j0]
            if j0 >= 2:
                sq1 = np.sqrt(max(D[j0 - 1, k], 0.0))
                sq2 = np.sqrt(max(D[j0 - 2, k], 0.0))
                if sq2 > sq1 > 0.0:
                    th = sig[j0 - 1] + sq1 * dsig / (sq2 - sq1)
                    theta[i, k] = min(max(th, sig[j0 - 1]), sig[j0])
                else:
                    theta[i, k] = sig[j0] - 0.5 * dsig
            else:
                theta[i, k] = sig[j0]
    return dict(theta=theta, theta_node=theta_node, upset=upset)


def upset_relaxed(V, psi, feas, Iscale):
    """Relaxed-band up-set check: is {D <= eps} a suffix for eps in rel*I? (Diag C)."""
    NF = V.shape[0]
    out = {}
    for rel in (1e-6, 1e-4, 1e-3):
        eps = rel * Iscale
        viol = 0
        for i in range(NF):
            if not feas[i]:
                continue
            D = V[i] - psi[i]
            for k in range(3):
                stop = (D[:, k] <= eps) & (psi[i][:, k] > PSI_GUARD)
                if stop.any():
                    j0 = int(np.argmax(stop))
                    if not stop[j0:].all():
                        viol += 1
        out[rel] = viol
    return out


def slope_sign_pattern(theta, F, tol=1e-5):
    """Sign pattern of d theta / d F along the curve (finite part). Returns segments."""
    segs = []
    fin = np.isfinite(theta)
    idx = np.where(fin)[0]
    if len(idx) < 2:
        return segs
    cur_sign, seg_start = None, None
    for a, b in zip(idx[:-1], idx[1:]):
        if b != a + 1:
            cur_sign = None
            continue
        d = theta[b] - theta[a]
        sgn = 0 if abs(d) <= tol else (1 if d > 0 else -1)
        if sgn != cur_sign:
            if cur_sign is not None:
                segs.append((float(F[seg_start]), float(F[a]), cur_sign))
            cur_sign, seg_start = sgn, a
    segs.append((float(F[seg_start]), float(F[idx[-1]]), cur_sign))
    return segs


# ------------------------------------------------------------------------- run wrapper
def run_model(p, lcp_verify=False):
    sig, F = grids(p)
    G, resG = march_G(p, sig, F)
    V, psi, feas = march_V_projected(p, sig, F, G)
    th = extract_thresholds(V, psi, feas, sig)
    out = dict(sig=sig, F=F, G=G, V=V, psi=psi, feas=feas, resG=resG, **th)
    out["upset_relaxed"] = upset_relaxed(V, psi, feas, p["I"] if p["I"] > 0 else 1.0)
    if lcp_verify:
        Vl, psil, feasl = march_V_lcp(p, sig, F, G)
        thl = extract_thresholds(Vl, psil, feasl, sig)
        both = np.isfinite(th["theta"]) & np.isfinite(thl["theta"])
        with np.errstate(invalid="ignore"):
            gaps = np.where(both, np.abs(np.nan_to_num(th["theta"] - thl["theta"], nan=0.0,
                                                       posinf=0.0, neginf=0.0)), 0.0)
        out["lcp_theta"] = thl["theta"]
        out["lcp_theta_gap_max"] = float(gaps.max())
        i, k = np.unravel_index(np.argmax(gaps), gaps.shape)
        out["lcp_gap_at"] = (float(F[i]), int(k))
        out["lcp_theta_onlyone"] = int(np.sum(np.isfinite(th["theta"]) != np.isfinite(thl["theta"])))
        out["lcp_V_gap_max"] = float(np.max(np.abs(V - Vl)))
    assert np.isfinite(V).all() and np.isfinite(G).all()
    return out


# ------------------------------------------------------ Diagnostic F: GEN transversality
def gen_check(p, out):
    """(GEN) transversality display at the free boundary (theory rewrite R4a, Diag (vii)):
        pi(theta*(k;F), k) - c  >  lambda_u * sum_{j!=k} pi_kj * D(theta*, F, j)  >= 0,
    with D = V - O on the continuation side. Derivation: at the boundary D = D_sigma =
    D_F = 0, and L_k D - rD = pi - c there, so 0.5 s^2 D_sigmasigma =
    (pi - c) - sum_{j!=k} pi_kj D_j; GEN is strict positivity of the right side.
    c = rI under (E) (O = G - I: the constant I is annihilated by L_k except through
    discounting); c = 0 under (J) (O = G(sigma, F - I): the F-shift commutes with the
    F-independent generator). Post-processing only: D_j of the other regimes is
    interpolated linearly on the sigma-grid at the sub-grid theta_hat. lambda_u = 1
    (note n3), so the switching intensities are the off-diagonal pi_kj themselves."""
    sig, F = out["sig"], out["F"]
    V, psi, feas, theta = out["V"], out["psi"], out["feas"], out["theta"]
    Pi = np.asarray(p["Pi"])
    c = p["r"] * p["I"] if p["entry_mode"] == "external" else 0.0
    res = {"c": c}
    for k in range(3):
        margins, rhs_all, Fs = [], [], []
        for i in range(len(F)):
            th = theta[i, k]
            if not (feas[i] and np.isfinite(th)):
                continue
            rs = (p["flow_const"] if p["flow_const"] is not None
                  else R_fun(np.array([th]), k, p)[0] * S_fun(np.array([th]), k, p)[0])
            lhs = p["P"] * rs - p["B"] - c
            rhs = 0.0
            for j in range(3):
                if j != k:
                    Dj = V[i, :, j] - psi[i, :, j]
                    rhs += Pi[k, j] * float(np.interp(th, sig, Dj))
            margins.append(lhs - rhs); rhs_all.append(rhs); Fs.append(F[i])
        margins = np.array(margins); Fs = np.array(Fs); rhs_all = np.array(rhs_all)
        viol = margins <= 0.0
        res[f"S{k}"] = dict(
            n_boundary_points=int(len(margins)),
            min_margin=float(margins.min()),
            argmin_F=float(Fs[int(np.argmin(margins))]),
            frac_nonpositive=float(viol.mean()),
            viol_F=[float(f) for f in Fs[viol]],
            rhs_min=float(rhs_all.min()), rhs_max=float(rhs_all.max()))
    return res


# ------------------------------------------------- stationary (F -> inf) perpetual limit
def stationary_model(p, sig_min=-4.0, sig_max=8.0, dsig=0.04):
    """Perpetual (no-runway) limit: solve the stationary regime-coupled problem
       G_inf: (r - A - Q) G = pi ;  V_inf: max{(A+Q)V - rV, (G_inf - I) - V} = 0
    by dense Howard policy iteration. Returns theta_inf per regime (F -> inf anchor
    for the theta(k;F) curves; NOT part of the SM-C.5 spec — used as a diagnostic)."""
    N = int(round((sig_max - sig_min) / dsig)) + 1
    q = dict(p); q["sig_min"] = sig_min; q["sig_max"] = sig_max; q["Nsig"] = N
    sig = np.linspace(sig_min, sig_max, N)
    M0 = assemble_M(q, sig, 0.0, dirichlet_ends=False)     # r Id - A - Q, reflecting
    piv = flow_mat(sig, q).reshape(-1)
    Ginf = np.linalg.solve(M0, piv).reshape(N, 3)
    psi = Ginf - q["I"]
    Mv = assemble_M(q, sig, 0.0, dirichlet_ends=True)
    rhs0 = np.zeros(3 * N)
    rhs0[3 * (N - 1):] = np.maximum(psi[N - 1], 0.0)
    interior = np.zeros((N, 3), dtype=bool); interior[1:N - 1] = True
    active = interior & (psi > 0) & (sig[:, None] > sig_max - 1.5)
    idx = np.arange(3 * N)
    X = None
    for _ in range(300):
        Msys = Mv.copy(); rr = rhs0.copy()
        af = active.reshape(-1)
        Msys[af, :] = 0.0
        Msys[idx[af], idx[af]] = 1.0
        rr[af] = psi.reshape(-1)[af]
        X = np.linalg.solve(Msys, rr)
        res_cont = (Mv @ X - rhs0) / q["r"]
        res_stop = X - psi.reshape(-1)
        new_active = interior & (res_stop < res_cont).reshape(N, 3)
        if np.array_equal(new_active, active):
            break
        active = new_active
    Vinf = np.maximum(X.reshape(N, 3), psi)
    th = extract_thresholds(Vinf[None, :, :], psi[None, :, :], np.array([True]), sig)
    return dict(theta_inf=[float(x) if np.isfinite(x) else None for x in th["theta"][0]],
                upset=bool(th["upset"].all()), sig_max=sig_max)


def theta_at(out, Fval):
    i = int(round(Fval / (out["F"][1] - out["F"][0])))
    return out["theta"][i].copy()


# --------------------------------------------------------------------- MS / DP check
def ms_check(r=0.06, delta=0.03, sv=0.2, I=10.0, N=541, smax=2.7):
    """Single-regime, frozen-F GBM collapse vs McDonald–Siegel/Dixit–Pindyck closed form.
    Flow pi(x) = x, GBM drift (r - delta) x, vol sv x. G(x) = x/delta exactly.
    Closed form: theta_MS = delta * beta1/(beta1-1) * I."""
    sig = np.linspace(0.0, smax, N)
    dsig = sig[1] - sig[0]
    b = (r - delta) * sig
    svec = sv * sig
    lo, di, up = sigma_tridiag(b, svec, dsig, reflect=False)
    A = np.zeros((N, N))
    idx = np.arange(N)
    A[idx, idx] = di
    A[idx[1:], idx[:-1]] = lo[1:]
    A[idx[:-1], idx[1:]] = up[:-1]
    # entered value G: (r - A) G = pi, Dirichlet G(smax) = smax/delta (analytic, check only)
    Mg = r * np.eye(N) - A
    rhs = sig.copy()
    Mg[-1, :] = 0.0; Mg[-1, -1] = 1.0; rhs[-1] = smax / delta
    # row 0 is natural (b=s=0): r G = 0 -> G(0)=0
    G = np.linalg.solve(Mg, rhs)
    gerr = float(np.max(np.abs(G - sig / delta) / (1.0 + sig / delta)))
    # option: LCP max(A V - r V, (G - I) - V) = 0, V(0)=0, V(smax)=G(smax)-I (stopping)
    psi = G - I
    Mv = r * np.eye(N) - A
    Mv[0, :] = 0.0; Mv[0, 0] = 1.0
    Mv[-1, :] = 0.0; Mv[-1, -1] = 1.0
    rhs0 = np.zeros(N); rhs0[-1] = psi[-1]
    interior = np.zeros(N, dtype=bool); interior[1:-1] = True
    active = interior & (psi > 0) & (sig > 0.8 * smax)      # init guess high
    for _ in range(200):
        Msys = Mv.copy(); rr = rhs0.copy()
        Msys[active, :] = 0.0
        Msys[idx[active], idx[active]] = 1.0
        rr[active] = psi[active]
        X = np.linalg.solve(Msys, rr)
        res_cont = (Mv @ X - rhs0) / r
        res_stop = X - psi
        new_active = interior & (res_stop < res_cont)
        if np.array_equal(new_active, active):
            break
        active = new_active
    V = np.maximum(X, psi)
    D = V - psi
    stop = (D <= EPS_STOP) & (psi > PSI_GUARD)
    j0 = int(np.argmax(stop))
    sq1 = np.sqrt(max(D[j0 - 1], 0.0)); sq2 = np.sqrt(max(D[j0 - 2], 0.0))
    theta_num = sig[j0 - 1] + sq1 * dsig / (sq2 - sq1) if sq2 > sq1 > 0 else sig[j0]
    # closed form
    a2 = 0.5 * sv * sv
    b1 = (r - delta) - a2
    beta1 = (-b1 + np.sqrt(b1 * b1 + 4.0 * a2 * r)) / (2.0 * a2)
    theta_ms = delta * beta1 / (beta1 - 1.0) * I
    return dict(beta1=float(beta1), theta_ms=float(theta_ms), theta_num=float(theta_num),
                rel_err=float(abs(theta_num - theta_ms) / theta_ms), G_relerr=gerr,
                upset=bool(stop[j0:].all()), N=N)


# -------------------------------------------------------------------- flat-flow check
def flat_flow_check():
    """R*S == const c0: G(F) = (P c0 - B)(1 - e^{-r T0})/r exactly, T0 = F/|mu_F|.
    Validates the F-marching/upwind/discount and the (vanishing) regime coupling."""
    p = baseline_params()
    p["flow_const"] = 0.5
    sig, F = grids(p)
    G, _ = march_G(p, sig, F)
    mu = abs(mu_F(p, "post"))
    exact = (p["P"] * 0.5 - p["B"]) * (1.0 - np.exp(-p["r"] * F / mu)) / p["r"]
    num = G[:, len(sig) // 2, 1]
    rel = np.abs(num[1:] - exact[1:]) / np.abs(exact[1:])
    return float(rel.max())


# ------------------------------------------------------------------------------- main
def fmt_th(v):
    return "   inf" if not np.isfinite(v) else f"{v:6.3f}"


def main():
    t0 = time.time()
    results = {"policy_note": "synthetic parameter values, fully disclosed; "
                              "calibration constants withheld under PF-010"}
    log = []

    def say(s):
        print(s)
        log.append(s)

    # ---------------- Diagnostic B: degenerate limit (MS/DP) ----------------
    ms1 = ms_check(N=541)
    ms2 = ms_check(N=1081)
    say(f"[MS ] beta1={ms1['beta1']:.6f} theta_MS={ms1['theta_ms']:.6f}")
    say(f"[MS ] N=541 : theta_num={ms1['theta_num']:.6f} rel_err={ms1['rel_err']:.2e} "
        f"(G rel err {ms1['G_relerr']:.1e}, up-set {ms1['upset']})")
    say(f"[MS ] N=1081: theta_num={ms2['theta_num']:.6f} rel_err={ms2['rel_err']:.2e}")
    results["ms_check"] = {"N541": ms1, "N1081": ms2}

    # ---------------- flat-flow analytic G check ----------------
    ferr = flat_flow_check()
    say(f"[G  ] flat-flow analytic check: max rel err = {ferr:.2e} (first-order in dF)")
    results["flatflow_relerr"] = ferr

    # ---------------- perpetual (F -> inf) anchor ----------------
    stat = stationary_model(baseline_params())
    say(f"[inf ] perpetual thresholds theta_inf(k) = {stat['theta_inf']} "
        f"(up-set {stat['upset']}; stationary grid to sigma={stat['sig_max']})")
    results["theta_inf"] = stat["theta_inf"]

    # ---------------- baseline ----------------
    p = baseline_params()
    base = run_model(p, lcp_verify=True)
    sig, F = base["sig"], base["F"]
    say(f"[base] G-march residual {base['resG']:.2e}; "
        f"LCP-vs-projection: max|dtheta|={base['lcp_theta_gap_max']:.2e} "
        f"at (F={base['lcp_gap_at'][0]:.3f}, k={base['lcp_gap_at'][1]}) "
        f"(levels disagreeing on feasibility: {base['lcp_theta_onlyone']}), "
        f"max|dV|={base['lcp_V_gap_max']:.2e}")
    say(f"[base] up-set (exact stop set): violations = {int((~base['upset']).sum())}"
        f" ; relaxed bands {base['upset_relaxed']}")
    thF = base["theta"]
    iref = int(round(p["F_ref"] / (F[1] - F[0])))
    say(f"[base] theta_hat at F_ref={p['F_ref']}: "
        + "  ".join(f"{n}={fmt_th(thF[iref, k])}" for k, n in enumerate(("S0", "S1", "S2"))))
    # F_min per regime (first F with finite theta)
    Fmin = [float(F[np.isfinite(thF[:, k])].min()) if np.isfinite(thF[:, k]).any() else None
            for k in range(3)]
    say(f"[base] F_min(k) (entry first feasible): {Fmin}")
    # ordering check over common feasible F
    common = np.all(np.isfinite(thF), axis=1)
    order_ok = bool(np.all((thF[common, 0] > thF[common, 1]) & (thF[common, 1] > thF[common, 2])))
    say(f"[base] regime ordering theta(S0)>theta(S1)>theta(S2) on common-feasible F: {order_ok}")
    # slope pattern
    pat = {k: slope_sign_pattern(thF[:, k], F) for k in range(3)}
    for k, n in enumerate(("S0", "S1", "S2")):
        say(f"[base] dtheta/dF sign segments {n}: {pat[k]}")
    # boundary distance
    fin = thF[np.isfinite(thF)]
    say(f"[base] threshold range [{fin.min():.3f}, {fin.max():.3f}] on grid "
        f"[{sig[0]}, {sig[-1]}]; min gap to sigma_max = {sig[-1] - fin.max():.3f}")
    # sigma_max inside entry region whenever nonempty (ex-post SM check)
    bad = 0
    for i in range(len(F)):
        D = base["V"][i] - base["psi"][i]
        for k in range(3):
            stopk = (D[:, k] <= EPS_STOP) & (base["psi"][i][:, k] > PSI_GUARD)
            if stopk.any() and not stopk[-1]:
                bad += 1
    say(f"[base] ex-post: sigma_max outside entry region while nonempty: {bad} levels")
    results["baseline"] = dict(
        F=list(map(float, F)),
        theta={n: [None if not np.isfinite(x) else float(x) for x in thF[:, k]]
               for k, n in enumerate(("S0", "S1", "S2"))},
        theta_at_Fref={n: (None if not np.isfinite(thF[iref, k]) else float(thF[iref, k]))
                       for k, n in enumerate(("S0", "S1", "S2"))},
        Fmin=Fmin, order_ok=order_ok, slope_pattern={str(k): pat[k] for k in pat},
        upset_violations=int((~base["upset"]).sum()),
        upset_relaxed={str(k): v for k, v in base["upset_relaxed"].items()},
        lcp_theta_gap_max=base["lcp_theta_gap_max"],
        lcp_V_gap_max=base["lcp_V_gap_max"], resG=float(base["resG"]),
        theta_min=float(fin.min()), theta_max=float(fin.max()))

    # ---------------- Diagnostic F: GEN transversality (both conventions) ----------------
    genE = gen_check(p, base)
    say(f"[GEN ] (E) c=rI={genE['c']:.3f}: " + " | ".join(
        f"S{k}: min margin {genE[f'S{k}']['min_margin']:+.4f} at F={genE[f'S{k}']['argmin_F']:.3f}, "
        f"viol {genE[f'S{k}']['frac_nonpositive']*100:.1f}% of {genE[f'S{k}']['n_boundary_points']}"
        for k in range(3)))
    for k in range(3):
        if genE[f"S{k}"]["viol_F"]:
            say(f"[GEN ] (E) S{k} nonpositive-margin F levels: {genE[f'S{k}']['viol_F']}")
    results["gen_check_E"] = genE

    # ---------------- Diagnostic A: mesh refinement ----------------
    p2 = baseline_params(); p2["Nsig"] = 451; p2["NF"] = 481
    ref = run_model(p2, lcp_verify=False)
    thR = ref["theta"][::2]        # common F levels
    both = np.isfinite(thF) & np.isfinite(thR)
    # exclude the steep near-divergence zone: compare where F >= Fmin+0.5
    stable = np.zeros_like(both)
    for k in range(3):
        if Fmin[k] is not None:
            stable[:, k] = F >= (Fmin[k] + 0.5)
    sel = both & stable
    with np.errstate(invalid="ignore"):
        gaps = np.abs(np.where(sel, np.nan_to_num(thF - thR, nan=0.0, posinf=0.0,
                                                  neginf=0.0), 0.0))[sel]
    dmax = float(gaps.max()); dmed = float(np.median(gaps)); d90 = float(np.quantile(gaps, 0.9))
    dref = {n: float(abs(thF[iref, k] - thR[iref, k])) for k, n in enumerate(("S0", "S1", "S2"))}
    say(f"[mesh] |theta_base - theta_refined|: at F_ref {dref}; over F>=Fmin+0.5: "
        f"sup {dmax:.4f}, median {dmed:.4f}, p90 {d90:.4f} (dsig base {sig[1]-sig[0]:.3f})")
    results["mesh"] = dict(at_Fref=dref, sup=dmax, median=dmed, p90=d90,
                           note="2x refinement in both sigma and F; steep near-divergence "
                                "band (F < Fmin+0.5) excluded from the stats")

    # robustness of the large-F positive slope (deadline story): base vs refined vs LCP
    rob = {}
    for Fv in (2.0, 3.0, 4.0, 5.0, 6.0):
        ib = int(round(Fv / (F[1] - F[0])))
        ir = int(round(Fv / (ref["F"][1] - ref["F"][0])))
        rob[Fv] = dict(
            base=[float(x) if np.isfinite(x) else None for x in thF[ib]],
            refined=[float(x) if np.isfinite(x) else None for x in ref["theta"][ir]],
            lcp=[float(x) if np.isfinite(x) else None for x in base["lcp_theta"][ib]])
        say(f"[rob ] F={Fv}: base {['%.3f' % x for x in thF[ib]]} | "
            f"refined {['%.3f' % x for x in ref['theta'][ir]]} | "
            f"lcp {['%.3f' % x for x in base['lcp_theta'][ib]]}")
    results["slope_robustness"] = {str(k): v for k, v in rob.items()}

    # ---------------- jump variant (F -> F - I at entry) ----------------
    pj = baseline_params(); pj["entry_mode"] = "jump"
    jmp = run_model(pj)
    thJ = jmp["theta"]
    FminJ = [float(F[np.isfinite(thJ[:, k])].min()) if np.isfinite(thJ[:, k]).any() else None
             for k in range(3)]
    say(f"[jump] theta_hat at F_ref: "
        + "  ".join(f"{n}={fmt_th(thJ[iref, k])}" for k, n in enumerate(("S0", "S1", "S2")))
        + f" ; F_min(k)={FminJ} ; up-set violations={int((~jmp['upset']).sum())}")
    patJ = {k: slope_sign_pattern(thJ[:, k], F) for k in range(3)}
    results["jump"] = dict(
        theta={n: [None if not np.isfinite(x) else float(x) for x in thJ[:, k]]
               for k, n in enumerate(("S0", "S1", "S2"))},
        theta_at_Fref={n: (None if not np.isfinite(thJ[iref, k]) else float(thJ[iref, k]))
                       for k, n in enumerate(("S0", "S1", "S2"))},
        Fmin=FminJ, slope_pattern={str(k): patJ[k] for k in patJ},
        upset_violations=int((~jmp["upset"]).sum()))
    for k, n in enumerate(("S0", "S1", "S2")):
        say(f"[jump] dtheta/dF sign segments {n}: {patJ[k]}")
    genJ = gen_check(pj, jmp)
    say(f"[GEN ] (J) c=0: " + " | ".join(
        f"S{k}: min margin {genJ[f'S{k}']['min_margin']:+.4f} at F={genJ[f'S{k}']['argmin_F']:.3f}, "
        f"viol {genJ[f'S{k}']['frac_nonpositive']*100:.1f}% of {genJ[f'S{k}']['n_boundary_points']}"
        for k in range(3)))
    for k in range(3):
        if genJ[f"S{k}"]["viol_F"]:
            say(f"[GEN ] (J) S{k} nonpositive-margin F levels: {genJ[f'S{k}']['viol_F']}")
    results["gen_check_J"] = genJ

    # ---------------- Diagnostic D: Prop 2 sweeps at F_ref ----------------
    def sweep(param_setter, values, tag, lcp_spot=None):
        rows = []
        for v in values:
            ps = baseline_params()
            ps["F_max"] = ps["F_ref"]
            ps["NF"] = int(round(ps["F_ref"] / 0.025)) + 1
            param_setter(ps, v)
            o = run_model(ps, lcp_verify=(lcp_spot == v))
            th = o["theta"][-1]     # F = F_ref level
            rows.append([float(v)] + [None if not np.isfinite(x) else float(x) for x in th])
            if lcp_spot == v:
                say(f"[{tag}] spot LCP check at {v}: max|dtheta|={o['lcp_theta_gap_max']:.2e}")
        say(f"[{tag}] " + " | ".join(
            f"{r[0]:.3g}: " + ",".join("inf" if x is None else f"{x:.3f}" for x in r[1:])
            for r in rows))
        return rows

    say("--- P sweep (expect theta down in P, all regimes) ---")
    results["sweep_P"] = sweep(lambda ps, v: ps.update(P=v),
                               [3.0, 3.25, 3.5, 3.75, 4.0, 4.25, 4.5, 4.75, 5.0], "P")

    say("--- B sweep, composite (flow + funds law; expect theta up in B on R) ---")
    results["sweep_B_composite"] = sweep(lambda ps, v: ps.update(B=v),
                                         [0.80, 0.85, 0.90, 0.95, 1.00, 1.05, 1.10, 1.15, 1.20],
                                         "B.comp")

    say("--- B sweep, flow-channel only (funds law pinned at baseline) ---")
    def set_flowB(ps, v):
        ps.update(B=v, muF_pre=-0.75, muF_post=-0.75)
    results["sweep_B_flowonly"] = sweep(set_flowB,
                                        [0.80, 0.85, 0.90, 0.95, 1.00, 1.05, 1.10, 1.15, 1.20],
                                        "B.flow")

    say("--- B sweep, pre-entry-drain channel only (flow & post-entry law pinned) ---")
    def set_preB(ps, v):
        ps.update(B=1.0, muF_pre=ps["Rnet"] - v, muF_post=-0.75)
    results["sweep_B_preonly"] = sweep(set_preB,
                                       [0.80, 0.85, 0.90, 0.95, 1.00, 1.05, 1.10, 1.15, 1.20],
                                       "B.pre")

    say("--- pi_kk sweeps, proportional off-diagonal rescale (own-regime theta) ---")
    def set_pkk(k):
        def f(ps, v):
            Pi = np.asarray(baseline_params()["Pi"], dtype=float).copy()
            off = Pi[k].copy(); off[k] = 0.0
            Pi[k] = off * (1.0 - v) / off.sum()
            Pi[k, k] = v
            ps["Pi"] = tuple(map(tuple, Pi))
        return f
    results["sweep_pi00"] = sweep(set_pkk(0), [0.80, 0.84, 0.88, 0.92, 0.96], "pi00")
    results["sweep_pi11"] = sweep(set_pkk(1), [0.74, 0.79, 0.84, 0.89, 0.94], "pi11")
    results["sweep_pi22"] = sweep(set_pkk(2), [0.80, 0.84, 0.88, 0.92, 0.96], "pi22")

    # ---------------- Diagnostic E: outside region R ----------------
    say("--- E1: composite B sweep at thin runway F_ref=1.2 ---")
    def sweepE1(values):
        rows = []
        for v in values:
            ps = baseline_params()
            ps["B"] = v
            ps["F_max"] = 1.2; ps["NF"] = 49; ps["F_ref"] = 1.2
            o = run_model(ps)
            th = o["theta"][-1]
            rows.append([float(v)] + [None if not np.isfinite(x) else float(x) for x in th])
        say("[E1] " + " | ".join(
            f"{r[0]:.3g}: " + ",".join("inf" if x is None else f"{x:.3f}" for x in r[1:])
            for r in rows))
        return rows
    results["E1_B_thinF"] = sweepE1([0.80, 0.90, 1.00, 1.10, 1.20])

    say("--- E2: split-drain world (muF_pre=-1.5, muF_post=-0.25): theta(k;F) curve ---")
    pe = baseline_params(); pe["muF_pre"] = -1.5; pe["muF_post"] = -0.25
    ext = run_model(pe, lcp_verify=True)
    thE = ext["theta"]
    patE = {k: slope_sign_pattern(thE[:, k], F) for k in range(3)}
    say(f"[E2] LCP spot check: max|dtheta|={ext['lcp_theta_gap_max']:.2e}; "
        f"up-set violations={int((~ext['upset']).sum())}")
    for k, n in enumerate(("S0", "S1", "S2")):
        say(f"[E2] dtheta/dF sign segments {n}: {patE[k]}")
    results["E2_splitdrain"] = dict(
        muF_pre=-1.5, muF_post=-0.25,
        theta={n: [None if not np.isfinite(x) else float(x) for x in thE[:, k]]
               for k, n in enumerate(("S0", "S1", "S2"))},
        slope_pattern={str(k): patE[k] for k in patE},
        upset_violations=int((~ext["upset"]).sum()),
        lcp_theta_gap_max=ext["lcp_theta_gap_max"])

    say("--- E2b: B sweep (composite of the two pinned channels) in split-drain world ---")
    def set_E2b(ps, v):
        ps.update(B=v, muF_pre=-1.5, muF_post=-0.25)
    results["E2b_B_splitdrain"] = sweep(set_E2b, [0.80, 0.90, 1.00, 1.10, 1.20], "E2b")

    results["params_baseline"] = {k: v for k, v in baseline_params().items()}
    results["runtime_sec"] = time.time() - t0
    results["log"] = log
    with open("results.json", "w") as f:
        json.dump(results, f, indent=1)
    say(f"[done] total {results['runtime_sec']:.1f} s -> results.json")


if __name__ == "__main__":
    main()
