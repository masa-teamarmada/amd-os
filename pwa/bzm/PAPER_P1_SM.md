# PAPER_P1_SM.md — Supplementary Material (Online) draft

*P1 の SM。本文 = `PAPER_P1_DRAFT.md`。SM-A/B/C は証明エージェント起草 → えいみ検収で統合。SM-D/E はえいみ直書き。*

---

# Supplementary Material for "The Before Zero Model: measuring deep-tech ventures and their institutional nurseries before day zero"

## SM-A. Proofs for Section 3 (Theorems 1, 2 and Proposition 1)

This supplement gives complete proofs of the three formal results of Section 3: the weighted-sum representation of the institutional readiness score ERS (Theorem 1), the precondition-gate structure of the bylaws axis (Proposition 1), and the prohibition of multiplicative cross-layer combination with the project readiness score PRS (Theorem 2). Axis numbering follows Section 2; axis 7 is the bylaws (institutional-design) axis.

### SM-A.1 Setup, notation and axioms

**Profiles and observed sets.** An institutional profile is a vector $A=(A_1,\dots,A_8)\in([0,4]\cup\{\bot\})^8$, where $A_k$ is the rubric level of capability axis $k$ and $\bot$ marks an axis whose level has not been observed. The observed set is $K_{\mathrm{obs}}(A)=\{k:A_k\neq\bot\}$. For nonempty $K\subseteq\{1,\dots,8\}$ write $X_K=\prod_{k\in K}[0,4]$, and let $\mathbf{0}_K,\mathbf{4}_K$ denote the profiles constant at levels $0$ and $4$. The primitive of the theory is a family of institutional readiness orderings $\succsim_K$ on $X_K$, one for each observed set: profiles are compared within an observational equivalence class (equal $K$), and every score is reported together with its $K_{\mathrm{obs}}$. Assessment emits integer levels $\{0,1,2,3,4\}$; following the source model we treat each axis domain as the continuum $[0,4]$ with the five rubric levels as landmarks. [GAP: restricted solvability and the Archimedean condition below are stated on the continuum $[0,4]$, whereas assessment produces only five levels per axis; the extension of $\succsim_K$ to intermediate values is assumed in the source architecture rather than constructed.]

**Definition SM-A.1 (additive conjoint structure).** For $|K|\ge 2$, the pair $(X_K,\succsim_K)$ is an *additive conjoint structure* if: (i) $\succsim_K$ is a *weak order* (complete, transitive); (ii) *independence*: the ordering induced on any one axis by fixing the remaining axes does not depend on where they are fixed; (iii) *double cancellation*, whose indifference version is the *Thomsen condition*: for axes $k\neq k'$, levels $a,b,c$ on $k$ and $x,y,z$ on $k'$, if $(a,y)\succsim(b,z)$ and $(b,x)\succsim(c,y)$ then $(a,x)\succsim(c,z)$, all other axes held fixed; (iv) *restricted solvability*: whenever varying axis $k$ alone brackets a target profile from above and below, some level of axis $k$ matches it exactly; (v) *Archimedean*: every bounded standard sequence (levels equally spaced in readiness terms) is finite; (vi) *essentiality*: each axis in $K$ can on its own reverse at least one comparison. See Krantz, Luce, Suppes and Tversky (1971, ch. 6, Def. 6.7 and adjacent definitions), hereafter KLST, and Luce and Tukey (1964).

**Axioms.** The paper imposes on each $\succsim_K$, and on any score $F_K$ representing it:

- **E1 (separability).** Ordinal form: independence, clause (ii) above. Cardinal form, meaningful once the score scale is fixed (see Step 5 below): $\partial^2 F_K/\partial A_k\,\partial A_{k'}=0$ for $k\neq k'$ — the contribution of one axis is assessable without knowing the others (Debreu, 1960; Gorman, 1968).
- **E2 (compensability).** Any two observed axes trade at finite positive rates; no observed axis is individually fatal to the institution. Its *strong form* E2-s encodes the equal-interval design of the Section 2 rubric: a rubric increment $\delta$ on axis $k$ is exactly compensated by a rubric decrement on axis $k'$ at a rate $w_k/w_{k'}$ that does not depend on the base levels.
- **E3 (missing-visibility).** The aggregate is the *family* $\{F_K\}$: the symbol $\bot$ is never mapped into $[0,4]$, the score depends only on observed coordinates, $K_{\mathrm{obs}}$ is disclosed alongside the score, and $A_k=\bot$ ("unknown") is treated differently from $A_k=0$ ("not started").
- **E4 (monotonicity).** Improving any observed axis never lowers readiness: $F_K$ is nondecreasing in each $A_k$, strictly increasing in essential axes.
- **(C) Continuity.** Each $\succsim_K$ has closed upper and lower contour sets on $X_K$.

### SM-A.2 Proof of Theorem 1

**Theorem 1 (weighted-sum representation, unique up to positive affine transformation).** *Let the family $\{\succsim_K\}$ satisfy E1–E4, (C), restricted solvability, the Archimedean condition and Thomsen/double cancellation. Then there exist weights $w_1,\dots,w_8>0$ such that each $\succsim_K$ is represented by*
$$\mathrm{ERS}(A)\;=\;100\cdot\frac{\sum_{k\in K_{\mathrm{obs}}}w_k A_k}{4\sum_{k\in K_{\mathrm{obs}}}w_k},$$
*and any score representing $\succsim_K$ additively in rubric units is a positive affine transformation of $\mathrm{ERS}$.*

The engine of the proof is the additive conjoint representation theorem, which we state in the form applied.

**Fact SM-A.1 (additive conjoint representation).** *Let $(X_K,\succsim_K)$ be an additive conjoint structure with every axis essential. Then there exist strictly increasing functions $\varphi_k:[0,4]\to\mathbb{R}$, $k\in K$, with*
$$A\succsim_K B\iff \sum_{k\in K}\varphi_k(A_k)\;\ge\;\sum_{k\in K}\varphi_k(B_k),$$
*and under (C) the $\varphi_k$ may be taken continuous. If $\{\psi_k\}$ is another such family, then $\psi_k=a\varphi_k+b_k$ for some common $a>0$ and constants $b_k$.* This is KLST (1971, ch. 6, Thm 6.2) for two axes together with its $n$-component extension in the same chapter; the original two-factor result is Luce and Tukey (1964), the topological route under continuity is Debreu (1960) and Wakker (1989), and the uniqueness formulation follows Fishburn (1970).

**Proof of Theorem 1.**

*Step 1 (additive representation).* Fix $K$ with $|K|\ge 2$ (for $|K|=1$ the score is a single monotone function and all claims below are immediate). E1 in ordinal form is exactly independence; with double cancellation, restricted solvability, the Archimedean condition, essentiality (implied by strict E4) and (C), the hypotheses of Fact SM-A.1 hold, so $\succsim_K$ is represented by $\sum_{k\in K}\varphi_k(A_k)$ with $\varphi_k$ continuous and strictly increasing. For $|K|\ge 3$ double cancellation is redundant given the remaining axioms (KLST, ch. 6); it is assumed uniformly because two-axis observed sets occur. Equivalently, E1 plus (C) yields additive separability by the overlapping-factors argument of Debreu (1960) and Gorman (1968), so that any representing score has the form $F_K=\Phi\!\left(\sum_k\varphi_k(A_k)\right)$ with $\Phi$ strictly increasing.

*Step 2 (linearization by E2-s).* E2 makes the substitution rate $\varphi_k'(A_k)/\varphi_{k'}'(A_{k'})$ (where derivatives exist) finite and positive: no axis is lexicographically prior, none individually fatal. E2-s says more: for every increment $\delta>0$, the representation gain $\varphi_k(t+\delta)-\varphi_k(t)$ is independent of $t$, because a fixed rubric step trades against other axes at a level-independent rate $w_k/w_{k'}$. A monotone solution of this increment equation on an interval is affine:
$$\varphi_k(t)=w_k t+c_k,\qquad w_k>0,$$
with $w_k>0$ by strict monotonicity. E2-s is a property of the numerals the rubric assigns — the equal-interval design of Section 2 — and it collapses each $\varphi_k$ to a linear function of them.

*Step 3 (calibration to the normal form).* $\sum_k(w_kA_k+c_k)$ and $\sum_k w_kA_k$ differ by a constant, hence represent the same ordering; the constants $c_k$ may be dropped. Adopt the paper's calibration convention $F_K(\mathbf{0}_K)=0$ and $F_K(\mathbf{4}_K)=100$: an institution with nothing started on any observed axis reads $0$, one fully institutionalized on every observed axis reads $100$. The unique positive affine transformation of $\sum_{k\in K}w_kA_k$ meeting both conditions is
$$F_K(A)=100\cdot\frac{\sum_{k\in K}w_kA_k}{4\sum_{k\in K}w_k},$$
since at $\mathbf{4}_K$ the numerator equals $4\sum_{k\in K}w_k$.

*Step 4 (renormalization over $K_{\mathrm{obs}}$, licensed by E3).* Applying Steps 1–3 on each $X_K$ and setting $K=K_{\mathrm{obs}}(A)$ yields the statement's formula. E3 is what makes the $K$-dependent denominator the right object: an axis with $A_k=0$ remains in $K_{\mathrm{obs}}$, contributing $0$ to the numerator while its weight $w_k$ stays in the denominator, whereas an axis with $A_k=\bot$ leaves both numerator and denominator. Thus "unknown" and "not started" receive different scores by construction, and the missing axis remains visible through the reported pair $(\mathrm{ERS},K_{\mathrm{obs}})$. At the interpretive level this renormalization is honest in the spirit of Rubin (1976): the score acknowledges the mechanism that hides an axis by carrying $K_{\mathrm{obs}}$ explicitly, rather than silently imputing a default level for what was never assessed. The statement uses a single weight vector across observed sets, which requires that the trade-off rate between two observed axes not depend on which further axes happen to be observed. [GAP: this cross-$K$ coherence condition is used implicitly in the source architecture whenever one weight vector serves every $K_{\mathrm{obs}}$; it is not stated there as a separate axiom.]

*Step 5 (uniqueness).* Let $V$ represent $\succsim_K$ additively in rubric units, $V=\sum_{k\in K}\psi_k(A_k)$. By the uniqueness clause of Fact SM-A.1, $\psi_k=a\,w_kA_k+b_k$ with common $a>0$, so $V=a\sum_kw_kA_k+b$, a positive affine transformation of $\mathrm{ERS}$; conversely every positive affine transformation represents the same ordering. Fixing the endpoint calibration of Step 3 selects $\mathrm{ERS}$ uniquely within this class. Because the class is closed exactly under positive affine maps, the vanishing of cross-partials in E1's cardinal form is scale-invariant ($\partial^2(aF+b)/\partial A_k\partial A_{k'}=a\,\partial^2F/\partial A_k\partial A_{k'}$), so E1's two readings are mutually consistent. Finally, only the ratios $w_k/w_{k'}$ bind trade-offs; any normalization such as $\sum_kw_k=1$, including the paper's default of equal weights, is a transparent value judgement in the sense of Sen (1977), not a quantity recovered from the axioms. $\blacksquare$

### SM-A.3 Proof of Proposition 1

**Proposition 1 (precondition gate on axis 7).** *Assume $7\in K_{\mathrm{obs}}$ and let $F(A_{-7})=\sum_{k\in K_{\mathrm{obs}}\setminus\{7\}}w_kA_k\,/\,4\sum_{k\in K_{\mathrm{obs}}\setminus\{7\}}w_k\in[0,1]$ be the Theorem-1 aggregate over the remaining observed axes. Under (G1)–(G3) below,*
$$\mathrm{ERS}(A)=100\cdot g(A_7)\cdot F(A_{-7}),$$
*where $g:[0,4]\to[0,1]$ is a nondecreasing gate — by default the step $g(0)=0$, $g(1)=0.25$, $g(a)=1$ for $a\ge 2$, or a steep sigmoid variant.*

Proposition 1 is *not* a corollary of Theorem 1: it describes a deliberately heterogeneous structure in which E2 is withdrawn for axis 7 alone — a bylaws blackout is individually fatal — while E1–E4 continue to hold among the remaining axes. The architecture is the identification-then-aggregation scheme of Alkire and Foster (2011): a cutoff decision on the precondition dimension first settles whether the institution is in the frame at all, and only then does the Theorem-1 aggregation run over the remaining dimensions; the product form mirrors their multiplicative decomposition of the adjusted headcount.

The gate axioms, for the section orderings of the full score $S(A_7,A_{-7})$:

- **(G1) Precondition.** There is a threshold level $L$ (default $L=2$) such that (a) if $A_7=0$ the profile is readiness-equivalent to $\mathbf 0$ regardless of $A_{-7}$, and (b) if $A_7\ge L$ readiness coincides with the Theorem-1 aggregate over the remaining axes: $S(A_7,A_{-7})=100\,F(A_{-7})$.
- **(G2) Conditional consistency.** For each fixed $A_7=a$, the induced ordering over $A_{-7}$ is the Theorem-1 ordering on $K_{\mathrm{obs}}\setminus\{7\}$.
- **(G3) Within-level ratio preservation.** For each fixed $a$ with $S(a,\mathbf 4_{-7})>0$, relative scores equal relative aggregates: $S(a,A_{-7})/S(a,\mathbf 4_{-7})=F(A_{-7})$.

**Proof.** Define $g(a):=S(a,\mathbf 4_{-7})/100$. If $S(a,\mathbf 4_{-7})>0$, (G3) gives $S(a,A_{-7})=100\,g(a)F(A_{-7})$ directly; if $S(a,\mathbf 4_{-7})=0$, then by (G2) and E4 all profiles at gate level $a$ score $0$, which is again $100\,g(a)F$ with $g(a)=0$. (G1)(a) forces $g(0)=0$; (G1)(b) forces $g(a)=1$ for $a\ge L$; E4 applied to axis 7 makes $g$ nondecreasing, hence $g:[0,4]\to[0,1]$. This yields the displayed factorization. On $(0,L)$ the axioms bound $g$ only between $0$ and $1$. [GAP: the intermediate value $g(1)=0.25$ is fixed by rubric-design convention in the source architecture, not derived from the axiom block; only $g(0)=0$ and $g\equiv1$ on $[L,4]$ follow from (G1).] [GAP: (G3) is the minimal premise delivering the product form; the source architecture asserts the multiplicative decomposition directly, on the Alkire–Foster analogy, rather than deriving it from a stated primitive.] $\blacksquare$

*Remarks.* (i) If $A_7=\bot$ the gate has no argument, and E3 requires the gated score itself to be reported as missing rather than defaulted. (ii) Replacing the step by a steep sigmoid preserves E4 and (C) and approximates the step arbitrarily closely; the choice is an implementation matter. (iii) The monograph embeds $F$ in a one-parameter constant-elasticity family $\left(\sum_{k\neq7}w_kA_k^{\rho}/\sum_{k\neq7}w_k\right)^{1/\rho}$ that degenerates to the weighted sum as $\rho\to1$ (and to log-multiplicative and min forms as $\rho\to0$ and $\rho\to-\infty$); the paper works throughout with the $\rho=1$ member, which is the Theorem-1 aggregate used above.

### SM-A.4 Proof of Theorem 2

**Theorem 2 (no multiplicative cross-layer combination).** *Let $E:=\mathrm{ERS}(A)$ be the Theorem-1 score and let $P:=\mathrm{PRS}>0$ be the project readiness score, a strictly increasing differentiable function of project variables $(P_1,\dots,P_J)$ only, multiplicative in form $P=\prod_jP_j^{\beta_j}$, $\beta_j>0$, as in Section 3. For any $\alpha\in(0,1)$ the combination $S=E^{\alpha}P^{1-\alpha}$ violates E1: at every interior point, $\partial^2S/\partial A_k\,\partial P\neq0$ for every observed axis $k$, and $\partial^2S/\partial A_k\,\partial A_{k'}\neq0$ for every pair $k\neq k'$.*

**Proof.** By Theorem 1, $\partial E/\partial A_k=c_k$ with the constant $c_k:=25\,w_k/\sum_{j\in K_{\mathrm{obs}}}w_j>0$ — the constancy of $c_k$ across the whole domain is precisely E1 and E2-s at work inside the institutional layer. Treat $S$ as a function of $(A,P)$ on the interior region $E>0$, $P>0$. Then
$$\frac{\partial S}{\partial A_k}=\alpha E^{\alpha-1}P^{1-\alpha}c_k,\qquad
\frac{\partial^2 S}{\partial A_k\,\partial P}=\alpha(1-\alpha)\,E^{\alpha-1}P^{-\alpha}c_k\;>\;0,$$
so the cross-layer bilinear term is everywhere nonzero. Through the multiplicative form of $P$, the same holds axis by axis on the project side:
$$\frac{\partial^2 S}{\partial A_k\,\partial P_j}=\alpha(1-\alpha)\,E^{\alpha-1}P^{1-\alpha}\,\frac{\beta_j c_k}{P_j}\;>\;0,$$
an $8\times J$ block of strictly positive cross-partials: the marginal credit for a one-level improvement of institutional axis $k$ depends on the state of every project axis, so institutional capability is counted a second time through the project channel. Within the institutional layer, for $k\neq k'$,
$$\frac{\partial^2 S}{\partial A_k\,\partial A_{k'}}=\alpha(\alpha-1)\,E^{\alpha-2}P^{1-\alpha}c_kc_{k'}\;<\;0,$$
so E1 fails also in its literal within-layer form: the contribution of one axis is no longer assessable without knowing the others. No admissible recalibration repairs this: by Theorem 1's uniqueness clause the admissible score maps are positive affine, and $a S+b$ has the same cross-partials scaled by $a>0$. Taking logarithms would restore additivity between $\log E$ and $\log P$, but $\log S$ is not a positive affine transformation of any admissible score, and in rubric units $\partial^2\log S/\partial A_k\,\partial A_{k'}=-\alpha\,c_kc_{k'}/E^{2}\neq0$, so separability among the eight axes still fails. $\blacksquare$

**Corollary (admissible cross-layer couplings).** *(i) Additive coupling $S_{+}=\alpha'P+\beta'E$, $\alpha',\beta'>0$: all cross-partials vanish identically, $\partial^2S_{+}/\partial A_k\,\partial P=0$ and $\partial^2S_{+}/\partial A_k\,\partial A_{k'}=0$, so E1 holds, and E3, E4 are inherited from each layer. (ii) Conditional coupling $P\mid A_7\ge L$: PRS is reported only when the institutional precondition of Proposition 1 is met; no composite scalar is formed, hence no cross term arises, and the rule is the project-level extension of the Proposition-1 gate. (iii) By Theorem 2, every multiplicative coupling $E^{\alpha}P^{1-\alpha}$, $\alpha\in(0,1)$, is excluded.* $\blacksquare$

The three results together give the shape claim of Section 3 its precise content: the project layer and the institutional layer answer to different axiom systems, so their aggregates take different functional forms by necessity, and the only couplings that respect both systems are additive or conditional — never multiplicative.

## SM-B. Proof of Theorem 3 and Corollary 3.1

### SM-B.1 Setup, domains, and the two readings of C3

A venture state is $x=(P,R,S)\in\mathbb{R}^3_{+}$, the closed non-negative orthant; boundary points with $\min(P,R,S)=0$ belong to the domain precisely so that axiom C1 has content. An institutional profile is $A=(A_1,\dots,A_K)\in\mathbb{R}^K_{+}$. The value function is $f:\mathbb{R}^3_{+}\times\mathbb{R}^K_{+}\to\mathbb{R}_{+}$; $\mathrm{Int}$ denotes the open orthant in the venture argument.

**C1 (venture annihilation).** $\min(P,R,S)=0\ \Rightarrow\ f(P,R,S;A)=0$ for every $A$. Economically it is the weakest-link boundary of an O-ring technology (Kremer 1993): no institutional environment attached to a broken chain carries value. (In the monograph, C1 is the $\rho\to-\infty$, i.e. min, limit of a CES aggregator over $(P,R,S)$ with posterior mass concentrated on $\rho<0$; here we take C1 as primitive.)

**C2 (institutional monotonicity).** $f$ is non-decreasing in each $A_k$ everywhere, and strictly increasing in at least one axis at some interior point: there exist $(x^{*},A^{*})$ with $x^{*}\in\mathrm{Int}$, an axis $k^{*}$, and $t>0$ such that $f(x^{*};A^{*}+t e_{k^{*}})>f(x^{*};A^{*})$.

**C3 (causal-channel restriction).** *Smooth (differential) version:* at interior points, for every $k$,
$$\frac{df}{dA_k}=\frac{\partial f}{\partial R}\frac{\partial R}{\partial A_k}+\frac{\partial f}{\partial S}\frac{\partial S}{\partial A_k},$$
where $\rho_k:=\partial R/\partial A_k$ and $\sigma_k:=\partial S/\partial A_k$ are the response derivatives of the venture-state dynamics to the $k$-th institutional axis ($A$ enters the laws of motion of $R$ and $S$; it does not act on $P$). The left side is the total derivative of value along an institutional perturbation with the state co-moving; equivalently, the direct partial of $f$ in $A_k$, net of the transmitted terms, vanishes. *Ordinal (conditional-independence) version:* conditional on the venture state and on the $(R,S)$-response it induces, institutional axes carry no additional value — if $A,A'$ induce the same $(R,S)$-response at $x$, then $f(x;A)=f(x;A')$. Each use below flags the version in force: SM-B.2 uses the strongest frozen-state ordinal form; the main proof (SM-B.4) uses no smoothness — only C1, C2, C4 and the operative interior channel that C3 *permits*; the smooth version reappears in Lemma SM-B.3 and SM-B.7.

**C4 (interior continuity).** $f$ is jointly continuous on $\mathrm{Int}\times\mathbb{R}^K_{+}$ and continuous in $A$ on the C1 boundary. C4 supplies the order-density and solvability conditions under which conjoint-measurement necessity applies, and extends the argument to non-smooth monotone composites.

**Theorem 3.** *No $f$ satisfying C1–C4 admits a representation $f(x;A)=\Phi(g(P,R,S),h(A))$ with $g$, $h$, $\Phi$ strictly increasing ($g$ in each of $P,R,S$; $h$ in each $A_k$; $\Phi$ in each argument).*

The proof follows the Arrow (1963) axiom-collapse template: each axiom is individually innocuous, but the target representation class forces a profile configuration on which they collide. The collision is rebuilt as a constructive failure of the conjoint-measurement conditions of Krantz, Luce, Suppes and Tversky (1971, ch. 6), with Debreu (1960) blocking the additive escape route.

### SM-B.2 The smooth case

**Proposition SM-B.1 (frozen-state case).** *Read C3 in the frozen-state ordinal form: conditional on the current venture state alone, institutional axes carry no additional value, i.e. $f(x;A)=f(x;A')$ for all $A,A'$. Then no representation $f=\Phi(g,h)$ with $h,\Phi$ strictly increasing exists.*

*Proof.* Fix any $x$, any $A$, any axis $k$, any $t>0$. Since $h$ is strictly increasing, $h(A+te_k)>h(A)$; since $\Phi$ is strictly increasing in its second argument,
$$f(x;A+te_k)=\Phi\big(g(x),h(A+te_k)\big)>\Phi\big(g(x),h(A)\big)=f(x;A),$$
so $f$ moves while the venture state is held fixed — contradicting frozen-state C3. $\square$

Differentiability shortens this to one line ($\partial f/\partial A_k=\Phi_2\,\partial_k h>0$ against a null frozen-state partial), but as the display shows, even the smooth case needs no derivative.

### SM-B.3 Why the smooth case is not the theorem

Two reasons.

First, the frozen-state reading of C3 is too strong to be the axiom. It flattens every row $A\mapsto f(x;A)$, so it contradicts C2 on its own, with or without a separable representation; under it the axiom class is empty and the "impossibility" is vacuous. The chain-rule version is the axiom. It *permits* $f$ to depend on $A$ — thicker institutional nurseries raise venture value — but requires every unit of that dependence to flow through the response of the $(R,S)$ dynamics; what it excludes is a direct channel (a brand or signaling premium accruing at a fixed venture path). Under the chain-rule version, rows genuinely slope in $A$, and the one-line contradiction of SM-B.2 evaporates: a separable score $\Phi(g,h)$ is not instantly absurd, because $h(A)$ could in principle track exactly the transmitted contribution of $A$. Indeed pure multiplication with $g=PRS$ satisfies the chain-rule display identically for dynamics with $\rho_k/R+\sigma_k/S=\partial_k\log h$ (Remark in Lemma SM-B.3 below), so C3 alone cannot exclude separability.

Second, the genuine obstruction lies in the tension between the C1 boundary and the C3-operative interior: on the annihilation stratum all institutional comparisons are ties (rows flat at $0$), while at the C2 point they are strict. The institutional factor is therefore ranked differently at different venture states, and detecting the contradiction with a possibly non-smooth $\Phi$ requires order-theoretic, not differential, machinery — conjoint measurement.

### SM-B.4 Main proof: conjoint machinery and the constructive failure

**Lemma SM-B.2 (necessity; Krantz, Luce, Suppes and Tversky 1971, ch. 6; Debreu 1960).** *Let $\succsim$ be the order induced by $f$ on $X\times Y$ with $X=\mathbb{R}^3_{+}$, $Y=\mathbb{R}^K_{+}$.*
*(i) If $f=\Phi(g,h)$ with $\Phi$ strictly increasing in each argument, then $\succsim$ is sign-consistent (single-factor independent) in the institutional factor: for all $A,A'$, the sign of $f(x;A)-f(x;A')$ is the same for every $x$.*
*(ii) If the order moreover admits an additive representation $\tilde g(x)+\tilde h(A)$ — delivered under independence, the Thomsen/double-cancellation condition, restricted solvability, and the Archimedean condition (Krantz et al. 1971), or under Debreu's (1960) topological conditions — then double cancellation holds: $f(x^{a};A^{b})=f(x^{b};A^{a})$ and $f(x^{b};A^{c})=f(x^{c};A^{b})$ imply $f(x^{a};A^{c})=f(x^{c};A^{a})$.*

*Proof of (i).* $\operatorname{sign}\big[\Phi(g(x),h(A))-\Phi(g(x),h(A'))\big]=\operatorname{sign}\big[h(A)-h(A')\big]$, which is free of $x$. $\square$

Independence is the first-order necessary condition for *any* monotone composite; Thomsen is the additional condition characterizing the additive subclass. Debreu (1960) is what blocks the additive escape: were independence to survive, C4-continuity plus solvability would upgrade the composite to an additive representation, so refuting independence refutes the whole composite class and a fortiori additivity.

**Proof of Theorem 3.** Suppose $f$ satisfies C1–C4 and $f=\Phi(g,h)$ with all three maps strictly increasing. Construct the profile quadruple of the skeleton.

*Interior strict row.* By C2, take $x^{b}:=x^{*}\in\mathrm{Int}$ and the institutional pair $A^{b}:=A^{*}$, $A^{c}:=A^{*}+te_{k^{*}}$ with
$$f(x^{b};A^{c})>f(x^{b};A^{b}).$$
Under C3 this comparative static is transmitted through the $(R,S)$ response — the channel is operative at $x^{*}$; C2 supplies the strict ranking directly.

*Boundary flat row.* By C1, take $x^{a}:=(0,R_a,S_a)$ on the annihilation boundary:
$$f(x^{a};A^{b})=f(x^{a};A^{c})=0.$$

*Collision.* From the interior row, since $g(x^{b})$ is fixed and $\Phi$ is monotone in its second argument, $h(A^{c})\le h(A^{b})$ would force $f(x^{b};A^{c})\le f(x^{b};A^{b})$; hence $h(A^{c})>h(A^{b})$. Applying strict monotonicity of $\Phi$ in its second argument on the boundary row,
$$0=f(x^{a};A^{c})=\Phi\big(g(x^{a}),h(A^{c})\big)>\Phi\big(g(x^{a}),h(A^{b})\big)=f(x^{a};A^{b})=0,$$
a contradiction. Equivalently: the two rows rank the pair $(A^{c},A^{b})$ differently, refuting the sign-consistency that Lemma SM-B.2(i) makes necessary. No smoothness was used, and only strict monotonicity of $\Phi$ in its *second* argument was invoked, so the excluded class is in fact wider than the statement requires. C4 enters in two places: it makes the induced order a bona fide conjoint structure so that Lemma SM-B.2 applies verbatim; and if the modeler insists on the open orthant, C1 acts through limits — by C4, rows with $x^{a}$ close enough to the boundary are flat within any $\varepsilon>0$ over the pair $\{A^{b},A^{c}\}$, while the representation forces a fixed positive gap, giving the same contradiction. $\blacksquare$

**Remark SM-B.1 (boundary singularity of $\Phi$; the skeleton's Thomsen reading).** Writing $g_0:=g(0,R,S)$, C1 forces $\Phi(g_0,h(A))=0$ for all $A$ while $h$ ranges over a non-degenerate interval — exactly the boundary condition extracted above, contradicting strict increase of $\Phi$ in its second argument. The monograph skeleton phrases the same collision as a constructive failure of double cancellation: the annihilation row makes every institutional comparison cancel, the interior rows refuse to cancel, and the Thomsen consequent $f(x^{a};A^{c})=f(x^{c};A^{a})$ — a tie between a boundary pair and an interior pair — fails whenever $x^{c}$ is interior with $f(x^{c};A^{a})>0$. [GAP: the skeleton does not construct the two antecedent indifferences $f(x^{a};A^{b})=f(x^{b};A^{a})$ and $f(x^{b};A^{c})=f(x^{c};A^{b})$ needed to instantiate the double-cancellation schema, nor does it derive the interior positivity $f(x^{c};A^{a})>0$ from C1–C4 (the monograph imports interior positivity from its Ch 7 F-CES core); the restricted-solvability construction via C4 is deferred there. The sign-consistency refutation above is complete without these steps, and it is what the full strength of the theorem — exclusion of every monotone composite, not only additive ones — requires.]

**Remark SM-B.2 (axiom minimality and scope).** Per the skeleton's independence check: dropping C1 readmits pure addition; dropping C3 readmits pure multiplication (in the universal-domain sense of Lemma SM-B.3); dropping C2 makes the exclusion trivial; dropping C4 readmits step-function composites on pathological domains. If the institutional layer is degenerate, $h(A)\equiv\text{const}$, the composite collapses to a re-scaling of $g$ and the exclusion is empty: single-layer scalar quality indices lie outside the theorem's scope, which is precisely its two-layer content.

### SM-B.5 Three-way collapse

**Lemma SM-B.3 (pure multiplication: C1 holds, C3 fails).** *Let $f=g(x)\,h(A)$ with $g,h$ strictly increasing, $g=0$ on the annihilation boundary (e.g. $g=PRS$), $h>0$. Then C1 holds, and — under the reading below — C3 fails.*

*Proof (smooth case, local $C^1$).* The product form gives $df/dA_k=g(x)\,\partial_k h(A)$; the C3 display gives $df/dA_k=h(A)\big[(\partial g/\partial R)\rho_k+(\partial g/\partial S)\sigma_k\big]$. Equating, for all $(x,A)$:
$$g(x)\,\partial_k h(A)=h(A)\Big[\tfrac{\partial g}{\partial R}\rho_k+\tfrac{\partial g}{\partial S}\sigma_k\Big].$$
The skeleton's step: the right side is a function of $(R,S,A)$ only, so differentiating in $P$ yields $(\partial g/\partial P)\,\partial_k h=0$ for all $k$; since $\partial g/\partial P>0$, $\partial_k h\equiv 0$, contradicting the strict clause of C2, which under the product form must be carried by $h$. $\square$

[GAP: the premise that the transmitted side is free of $P$ is underspecified in the skeleton — it requires $\partial^2 g/\partial P\partial R=\partial^2 g/\partial P\partial S=0$, which fails for the flagship $g=PRS$; there $P$ cancels from both sides and the display is satisfiable by dynamics with $\rho_k/R+\sigma_k/S=\partial_k\log h$. The exclusion of pure multiplication therefore rests on the universal-domain reading of C3: the display must hold for every admissible transmission configuration, including configurations with $\rho_k=\sigma_k=0$ at some $(x,A)$ where $\partial_k h>0$, which forces $g\,\partial_k h=0$ there and contradicts C2. The skeleton uses this reading implicitly but does not state it.]

*Interpretation.* Multiplication makes the institution a venture-independent multiplier — a direct channel bypassing the $(R,S)$ dynamics — and imposes a substitutability pattern between the two layers, whereas C1 and C3 jointly encode non-substitutability in the sense of the multitask problem of Holmström and Milgrom (1991): venture components cannot be compensated by institutional thickness, only nursed through $R$ and $S$.

**Lemma SM-B.4 (pure addition: C3's spirit holds, C1 fails).** *Let $f=g(x)+h(A)$. Then C1 fails unless C2 does.*

*Proof.* The additive form is compatible with the chain-rule display for suitable dynamics ($\partial_k h$ matched by the transmitted terms), the sense in which it respects C3's spirit. But C1 at $x^{0}=(0,R_0,S_0)$ requires $g(x^{0})+h(A)=0$ for all $A$, hence $h\equiv-g(x^{0})$, a constant — contradicting the strict clause of C2, which under the additive form must be carried by $h$. $\square$

An "institutional baseline plus venture bonus" score thus assigns positive value to dead ventures in thick nurseries. Debreu (1960) makes the case sharp: the additive form is exactly the representation his conditions deliver, and C1 is the axiom those conditions cannot absorb.

**Lemma SM-B.5 (general monotone composite).** *Any $\Phi(g,h)$ with all maps strictly increasing fails the sign-consistency/double-cancellation requirements on the quadruple of SM-B.4.* This is the theorem's main content, and it completes the skeleton's one-to-one mapping: (a) multiplication keeps C1 and breaks C3; (b) addition keeps C3's spirit and breaks C1; (c) every remaining composite breaks the conjoint conditions that C1–C4 jointly force.

*Bridge (two-layer non-commutativity).* "Screen by venture first, then weight by institution" and "pool by institution first, then rank by venture" produce different orderings, because the institutional ranking of a pair is venture-stratum-contingent: tied on the annihilation stratum, strict at the C2 point. Its statistical shadow is the stratum dependence of institutional coefficients exploited next.

### SM-B.6 Corollary 3.1: three falsifiable signatures

**Setting.** Practice ranks by a single score $V=\Phi(g,h)$ (strictly increasing components) while the data-generating process respects C1–C4. Let $y$ be the realized outcome ordered as $f$, and let $\gamma_k$ denote the coefficient on $A_k$ in a regression of $y$ on $(A,\text{controls})$, estimated on the pooled sample ($\gamma_k^{\mathrm{pool}}$) and within PRS-quartiles $q=1,\dots,4$ ($\gamma_k^{q}$). Theorem 3 says the score's institutional comparisons are venture-uniform while the true ones are venture-contingent; the three signatures are projections of that wedge onto standard statistics.

**(i) Simpson reversal (Simpson 1951).** Under C1–C4 the within-stratum institutional slope varies by construction: approximately zero on the bottom, near-annihilation quartile; strictly positive where the channel is operative. The pooled coefficient is a convex combination of within-quartile slopes plus a between-quartile composition term, non-zero because $A$ co-moves with the venture stratum through the transmitted $(R,S)$ response (C3): thick institutions migrate ventures upward across quartiles. For composition terms of sufficient magnitude the pooled sign opposes some within-quartile sign, $\operatorname{sign}(\gamma_k^{\mathrm{pool}})\neq\operatorname{sign}(\gamma_k^{q})$ for some $q$ — an aggregation reversal. A single-score world cannot generate this pattern, since sign-consistency makes the institutional comparison stratum-free. [GAP: the skeleton asserts that reversal-generating composition weights exist within the axiom class but defers the explicit construction and the detection rule (posterior probability $>0.95$) to the monograph's Ch 11 BVAR machinery.]

**(ii) Quartile instability.** Under the score model with a common link, institution coefficients are quartile-stable by construction (one $h$ for all ventures); under C1–C4 they cannot be: $\gamma_k^{1}\approx 0\neq\gamma_k^{q}$ at operative strata. Test: $|\gamma_k^{q}-\gamma_k^{q'}|/\mathrm{SE}(\gamma_k^{q}-\gamma_k^{q'})>2$ for some pair $(q,q')$, equivalently an ERS$\times$PRS interaction whose 95% region excludes zero. [GAP: the equivalence between "no link-adjusted interaction" and separability at the estimating-equation level (link choice, priors, MCMC settings) is specified in monograph Ch 11, not in the skeleton.]

**(iii) Hausman divergence (Hausman 1978).** Let $\hat\theta_{\mathrm{pool}}$ impose quartile-common institutional coefficients and $\hat\theta_{\mathrm{cond}}$ leave them quartile-free. Were a single score adequate, both estimators would converge to the same limit and
$$H=(\hat\theta_{\mathrm{cond}}-\hat\theta_{\mathrm{pool}})'(\hat V_{\mathrm{cond}}-\hat V_{\mathrm{pool}})^{-1}(\hat\theta_{\mathrm{cond}}-\hat\theta_{\mathrm{pool}})\ \sim\ \chi^2_{\dim\theta}$$
would be central; under C1–C4 the pooled limit is a weight-dependent blend distinct from the conditional limits, so $H$ diverges and rejects at $p<0.05$.

**Negative criterion (falsifiability commitment).** The single-score benchmark is rehabilitated on the data only if all three signatures fail to reject — each at Bonferroni-corrected $\alpha=0.05/3\approx 0.0167$, holding the family-wise error rate at 5% — *and* the axiom-level Hansen $J$ below also fails to reject ($p\ge 0.10$). Any one firing signature supports the empirical content of Theorem 3.

### SM-B.7 The Hansen $J$ test of C3 (axiom-level)

The three signatures test the *consequences* of the theorem under the maintained axioms. C3 itself — the most contestable premise, since a direct institutional channel (brand, signaling) would break it — is testable separately as an overidentification restriction (Hansen 1982), and this test must not be conflated with (i)–(iii). Write the smooth C3 display as the moment condition
$$E\Big[\Big(\frac{df}{dA_k}-\frac{\partial f}{\partial R}\rho_k-\frac{\partial f}{\partial S}\sigma_k\Big)\cdot z\Big]=0,$$
with $z$ a vector of instruments built from shocks to institutional axes external to the venture state (policy shifts to funding or staffing rules used as natural experiments). With $\dim(\text{moment})>\dim(\theta)$, where $\theta$ collects the parameters of $(f,\rho,\sigma)$, the rank condition and the degree-of-freedom count give
$$J=N\,g_N(\hat\theta)'\hat W g_N(\hat\theta)\ \sim\ \chi^2_{\dim(m)-\dim(\theta)}$$
under C3, with the conservative rejection region $p<0.10$ (loosened because failing to reject is the informative outcome for a premise). Decision matrix: $J$ rejects $\Rightarrow$ a direct institutional channel exists, C3 fails, and Theorem 3's premise is void regardless of the signatures; $J$ fails to reject and any signature fires $\Rightarrow$ the axioms stand and single-score practice is contradicted; $J$ fails to reject and no signature fires $\Rightarrow$ the negative criterion applies and the scalar benchmark is empirically admissible. [GAP: the instrument list, the estimating system for $(\partial f/\partial R,\partial f/\partial S,\rho_k,\sigma_k)$, and the pre-registration protocol are specified in the monograph's Ch 11 and Ch 26b, beyond the skeleton.]

## SM-C. Optimal stopping: proofs for Theorem 4 and Proposition 2

This supplement records the optimal-stopping theory behind the paper's GO gate. Monograph correspondence (ch. 5.5): Lemma C.1 = Prop. 5.5.1; Theorem 4 = Prop. 5.5.2, with existence input from Prop. 5.5.1; Proposition 2 = Prop. 5.5.3; Lemma C.2 = Prop. 5.5.4. Proofs are given at the level of architecture; steps the monograph defers to its Appendix A.5.5 are marked `[GAP: ...]` rather than reconstructed. The index $i$ labels ventures; primitives $(P,F,B,\Pi)$ are venture-specific; the regime is fully observed (belief-dependent extension out of scope).

### C.0 Primitive problem and standing assumptions

The founder–institution pair, modeled as a single joint-value-maximizing agent, chooses a stopping time $\tau$ solving

$$\sup_{\tau}\ \mathbb{E}\Big[\int_{\tau}^{\infty} e^{-rt}\big(P\cdot R(t)\cdot S(t)-B(t)\big)\,dt \;-\; I \,\Big|\,\mathcal{F}_0\Big]\qquad \text{s.t.}\quad (B-R_{\mathrm{net}})\le F .$$

Entry is one-shot and irreversible with sunk cost $I$: before day zero the pair holds an option on a venture, not a venture (McDonald and Siegel 1986; McGrath 1997). Following the monograph we set $B(t)\equiv B$, a constant burn parameter.

State variables. (i) Market alignment $\sigma_{SU}(t)\in\mathbb{R}$ follows a regime-modulated diffusion $d\sigma=b_k\,dt+s_k\,dW_t$, where $k_t\in\{S_0\ \text{dormant},\,S_1\ \text{warming},\,S_2\ \text{aligned}\}$ is a $K=3$ Markov regime process with row-stochastic (uniformized) transition matrix $\Pi=(\pi_{kj})$. (ii) Runway $F_t$ obeys $dF=(R_{\mathrm{net}}-B)\,dt$, with $F=0$ absorbing (forced exit; all flows cease) — the monograph's declared dynamic implementation of the displayed financing constraint. (iii) The deterministic TRL gate $g_{TRL}(t)\in\{0,1\}$ restricts admissible stopping times to the gate-open set $\mathcal{T}_g=\{\tau:g_{TRL}(\tau)=1\}$; C.1–C.3 condition on an open gate, Lemma C.2 restores it.

The flow payoff is $\pi(\sigma,F,k)=P\cdot R(\sigma,k)\cdot S(\sigma,k)-B$, where $R$ (realization readiness) and $S$ (survival probability) are the paper's upstream constructs (Section 3), treated here as primitives with the stated regularity.

Standing assumptions. **(A1)** $r>0$; $\pi$ bounded, Lipschitz in $(\sigma,F)$, non-decreasing in $\sigma$ (implicit in the monograph); $(\sigma,F,k)$ is strong Markov. **(A2)** $b_k,s_k$ Lipschitz, $s_k$ non-degenerate. **(A3)** $\Pi$ irreducible: no absorbing regime. **(A4)** $I>0$ constant. **(A5)** Interior primitives: $P,B,F$ interior to the positive orthant, $P/B$ non-extreme (excluding the monograph's degenerate cases). **(A6)** Post-entry runway follows the same funds law. `[GAP: the skeleton records a single funds equation and never separately specifies the post-entry drift; we read R_net as including post-entry project revenue.]`

Entered value. $G(\sigma,F,k)=\mathbb{E}\big[\int_0^{T_0}e^{-rt}\pi\,dt\big]$ with $T_0=\inf\{t:F_t=0\}$ solves the coupled linear system $\mathcal{L}_kG+\pi-rG=0$, $G(\sigma,0,k)=0$, where for $\varphi(\cdot,\cdot,k)$

$$(\mathcal{L}_k\varphi)(\sigma,F)=b_k\varphi_\sigma+\tfrac12 s_k^2\varphi_{\sigma\sigma}+(R_{\mathrm{net}}-B)\varphi_F+\sum_j\pi_{kj}\big[\varphi(\sigma,F,j)-\varphi(\sigma,F,k)\big].$$

### C.1 Well-posedness (Lemma C.1 = monograph Prop. 5.5.1)

Waiting yields no flow, so the pre-entry value is $V(\sigma,F,k)=\sup_\tau\mathbb{E}\big[e^{-r\tau}(G-I)(\sigma_\tau,F_\tau,k_\tau)\,\mathbf{1}_{\tau<T_0}\big]$ (never entering yields zero). Dynamic programming gives the coupled variational inequality

$$\max\big\{\,\mathcal{L}_kV-rV,\;(G-I)-V\,\big\}=0,\qquad k\in\{S_0,S_1,S_2\},$$

with $V(\sigma,0,k)=0$, $V\to0$ as $\sigma\to-\infty$, and $V$ bounded above by the entered-value envelope as $\sigma\to+\infty$ (all recorded in the skeleton).

*Remark C.1.* The skeleton writes the HJB in a translated normalization, $\max\{\mathcal{L}_kV+\pi-rV,\,0\}=0$ with stopping set $\{V=0\}$. `[GAP: the translation between the two normalizations — via the Feynman–Kac representation of G — is not spelled out in the skeleton; we work in the entry normalization, which its own value-matching condition presupposes.]`

**Lemma C.1.** Under (A1)–(A5): (a) $V$ exists, is bounded and Lipschitz; (b) $V$ is the unique viscosity solution (Crandall, Ishii and Lions 1992) of the coupled system with the stated boundary conditions; (c) $V$ is non-decreasing in $\sigma$ and in $F$; (d) $V(\cdot,\cdot,S_2)\ge V(\cdot,\cdot,S_1)\ge V(\cdot,\cdot,S_0)$.

*Proof sketch.* (a) Boundedness of $\pi$ with $r>0$ bounds $G$, hence $V$; Lipschitz data give Lipschitz continuity. (b) The strong Markov property yields the dynamic programming principle, hence the viscosity sub- and supersolution properties. The switching term is a monotone coupling, so the system is weakly coupled in the sense required for a comparison principle in the Crandall–Ishii–Lions framework; comparison gives uniqueness. `[GAP: the growth and regularity conditions under which comparison holds for the K=3 coupled system are checked in monograph Appendix A.5.5, not reproduced here.]` (c) Monotone coupling of trajectories in the initial state, $\pi$ non-decreasing in $\sigma$, and survival non-decreasing in $F$. (d) `[GAP: the regime ordering is asserted as monograph Prop. 5.5.1(d); the coupling argument (regime-ordered flows plus irreducibility) is deferred to its appendix.]` $\square$

### C.2 Proof of Theorem 4 (= monograph Prop. 5.5.2)

**Theorem 4.** Under (A1)–(A5), value-matching and smooth-pasting determine, for each regime $k$, a unique implicit threshold $\theta^*_\sigma(k)=\Phi_k(P,F,B,\Pi)$; the optimal policy is $GO(t,i)=\mathbf{1}[\sigma_{SU}(t)\ge\theta^*_\sigma(k_t)]\cdot g_{TRL}(t)$; the threshold is strictly interior for interior primitives and continuous in $(P,F,B,\Pi)$.

*Step 1 (free boundary).* Let $\mathcal{C}=\{V>G-I\}$ be the continuation region; on $\mathcal{C}$, $\mathcal{L}_kV=rV$. Per regime and runway level the entry region is an up-set in $\sigma$: $\{\sigma\ge\theta^*_\sigma(k;F)\}$. `[GAP: the single-crossing property behind this threshold geometry is asserted from monotonicity of V and G in σ; verification is in the monograph appendix.]`

*Step 2 (value-matching).* Continuity of the viscosity solution forces $V=G-I$ on $\partial\mathcal{C}$, i.e. $V(\theta^*_\sigma(k),F,k)=G(\theta^*_\sigma(k),F,k)-I$.

*Step 3 (smooth-pasting).* $\partial V/\partial\sigma=\partial G/\partial\sigma$ at $\sigma=\theta^*_\sigma(k)$. With $s_k$ non-degenerate the boundary is regular for the $\sigma$-diffusion; a kink in the pasted function would admit a locally profitable boundary perturbation (the second-order argument of Dixit and Pindyck 1994); monotonicity (Lemma C.1(c)) and irreducibility (A3) exclude tangency degeneracies. `[GAP: the C¹-pasting regularity conditions are checked under K=3 coupling in monograph Appendix A.5.5; the free-boundary regularity theory invoked there is not reproduced.]`

*Step 4 (implicit system and uniqueness).* At each runway level the $\sigma$-sections of the continuation equation form three coupled second-order equations. `[GAP: the skeleton treats these sections as an ODE system, leaving the runway-drift term's role in that reduction unrecorded.]` Selecting bounded solutions consumes one constant per regime; the six pasting conditions then balance three integration constants plus three unknown boundaries. Eliminating $V$ yields a finite system $\Psi(\theta_{S_0},\theta_{S_1},\theta_{S_2};P,F,B,\Pi)=0$. For interior primitives the Jacobian $\partial\Psi/\partial\theta$ is non-singular — degenerate cases (extreme $P/B$, absorbing regimes) are excluded by (A3)/(A5) `[GAP: non-singularity itself is checked in the monograph appendix]` — so the implicit function theorem gives a locally unique, continuously differentiable $\Phi_k(P,F,B,\Pi)$; Step 1's up-set geometry upgrades local to global uniqueness, and continuity in primitives follows.

*Step 5 (interiority).* As $\sigma\to-\infty$, $G-I<0\le V$, so entry is strictly suboptimal; as $\sigma\to+\infty$ the waiting premium $V-(G-I)$ vanishes against the entered-value envelope and entry becomes optimal. Hence $-\infty<\theta^*_\sigma(k)<+\infty$ for interior primitives.

*Step 6 (policy and verification).* Itô's formula on the pasted $C^1$ candidate shows $e^{-rt}V$ is a supermartingale everywhere and a martingale on $\mathcal{C}$, so the threshold rule attains the supremum; the gate multiplies in by Lemma C.2, giving $GO(t,i)=\mathbf{1}[\sigma_{SU}(t)\ge\theta^*_\sigma(k_t)]\cdot g_{TRL}(t)$. $\square$

*Remark C.2 (four-component decomposition).* $\theta^*_\sigma(k)$ separates into (a) the Marshallian break-even root of $G=I$; (b) a Dixit–Pindyck uncertainty premium increasing in the regime-$k$ diffusion loading $s_k^2$; (c) a Bertola (1998) irreversibility premium scaling with $I$ and degenerate at $I=0$; (d) a regime-switching option-value term determined by $\Pi$ (switching toward better regimes raises the value of waiting in bad ones). In the single-regime geometric-Brownian limit the threshold collapses to the McDonald and Siegel (1986) / Dixit and Pindyck (1994) closed form, the monograph's analytic anchor.

### C.3 Proof of Proposition 2 (= monograph Prop. 5.5.3)

**Proposition 2.** On the empirically relevant parameter region $\mathcal{R}$ defined below: $\partial\theta^*/\partial P<0$, $\partial\theta^*/\partial B>0$, $\partial\theta^*/\partial F<0$, $\partial\theta^*(k)/\partial\pi_{kk}<0$, and $\theta^*(S_0)>\theta^*(S_1)>\theta^*(S_2)$.

*The region $\mathcal{R}$.* (R1) Interior primitives with non-singular Jacobian (Theorem 4, Step 4), $F$ bounded away from zero. (R2) For the burn-rate sign only, the monograph's qualifier: the waiting-cost effect is dominated by the post-entry-cost effect; the recorded sufficient condition is runway $F$ sufficiently large and $\Pi$ stationary over the decision horizon.

*Method.* Implicit differentiation of $\Psi=0$: $\partial\theta^*/\partial x=-(\partial\Psi/\partial\theta)^{-1}(\partial\Psi/\partial x)$ for $x\in\{P,B,F,\pi_{kk}\}$. Smooth-pasting makes the boundary displacement second-order (an envelope property), so each sign reduces to the relative boundary sensitivities of entered and waiting values.

(i) *Price.* $\partial G/\partial P=\mathbb{E}\int e^{-rt}RS\,dt>0$, and at the boundary the entered value gains more than the waiting value, which responds only via the diffusion–regime detour, so the crossing moves down: $\partial\theta^*/\partial P<0$.

(ii) *Burn rate.* Two opposing channels: a waiting-cost channel — higher $B$ drains runway toward the absorbing barrier, making waiting costlier and pushing $\theta^*$ down — and a post-entry-cost channel — higher $B$ lowers $\pi$ and hence $G$ everywhere, pushing $\theta^*$ up. On $\mathcal{R}$ (R2: barrier remote, switching stationary) the post-entry channel dominates and $\partial\theta^*/\partial B>0$. Outside $\mathcal{R}$ the sign can reverse; the paper claims it only on $\mathcal{R}$.

(iii) *Runway.* Exit risk near the barrier depresses the entered value, so $\partial G/\partial F>0$ strictly (the monograph's type-A "GO postponed on thin runway" structure), while the waiting value is less $F$-sensitive at the boundary on $\mathcal{R}$; hence $\partial\theta^*/\partial F<0$: financial slack lowers the entry hurdle. `[GAP: the skeleton records a heuristic F→0 limit (threshold collapse, "forced entry or exit"); its reconciliation with interior monotonicity is deferred to the monograph's exit-hazard chapter, and R stays away from F=0.]`

(iv) *Persistence.* Differentiate along a row-stochastic perturbation raising $\pi_{kk}$ with off-diagonal mass rescaled proportionally. `[GAP: the skeleton does not record which compensation scheme its sign is proved under.]` Higher own-persistence raises the weight of regime-$k$ flows in $G$ and shrinks component (d) of Remark C.2 — waiting to switch regimes is worth less when switching is rarer — so on $\mathcal{R}$, $\partial\theta^*(k)/\partial\pi_{kk}<0$.

(v) *Regime ordering.* By Lemma C.1(d) and regime-ordered flows, the gap $(G-I)-V$ at fixed $\sigma$ is ordered across regimes, so the crossing points are reversely ordered: $\theta^*(S_0)>\theta^*(S_1)>\theta^*(S_2)$. `[GAP: the skeleton records this as a sketch from value monotonicity in k; the dominance argument on the pasting system is completed in its appendix.]`

Cross-venture dispersion in $(P,F,B)$ disperses thresholds — the microfoundation for lumpy-entry aggregation in the sense of Caballero (1999); Figure 3 (C.5) displays the ordering and the four slopes. $\square$

*Remark C.3 (scope).* Monograph Prop. 5.5.3 additionally characterizes an event-time jump of $\theta^*$ under a two-stage transition-matrix construction ($\Pi^{\mathrm{pre}}\to\Pi^{\mathrm{post}}$), outside the paper's single-$\Pi$ setting and not reproduced here.

### C.4 Orthogonal factorization of the TRL gate (Lemma C.2 = monograph Prop. 5.5.4)

*TRL-orthogonality (assumption).* The macro regime process and the TRL ramp are conditionally independent given the regime path, $\sigma_{SU}\perp g_{TRL}\mid k$; and $g_{TRL}$ is declared deterministic, a function of time only, bounded, and non-decreasing; its functional form is left to the monograph's estimation layer.

**Lemma C.2.** Under TRL-orthogonality the optimal policy separates multiplicatively, $GO(t,i)=\mathbf{1}[\sigma_{SU}(t)\ge\theta^*_\sigma(k_t)]\cdot g_{TRL}(t)$, with $\theta^*_\sigma$ the Theorem 4 threshold: the gate shifts feasibility, not the threshold.

*Proof sketch.* In the paper's binary baseline the non-decreasing gate opens once, at the deterministic date $t_g=\inf\{t:g_{TRL}(t)=1\}$, so $\mathcal{T}_g=\{\tau\ge t_g\}$ and the constrained problem is the unconstrained problem restarted at $t_g$. Conditional independence implies the continuation values, hence the pasting system $\Psi=0$, carry no dependence on the ramp; time-homogeneity of $(\sigma,F,k)$ makes $\theta^*$ date-invariant. After $t_g$ the optimal rule is therefore the Theorem 4 threshold rule; before $t_g$ every admissible policy is idle, so the product form holds: the gate enters the admissibility set, not the generator. `[GAP: the skeleton derives the factorization by an HJB variable-separation argument whose details it does not record; the graded [0,1]-valued ramp case (sigmoid, piecewise-linear, Gompertz candidates) is declared but not proved here — the paper uses only the binary gate.]` $\square$

### C.5 Numerical scheme for Figure 3 (specification only)

*Purpose.* Figure 3 reports $\hat\theta^*(k)$, $k\in\{S_0,S_1,S_2\}$, at baseline and traces the four comparative-statics sweeps of Proposition 2. Calibration constants are withheld under policy PF-010; every symbol below ($P_0,B_0,F_{\mathrm{ref}},\Pi_0,r_0,I_0,\dots$) is a placeholder, and no numerical output is reported.

*Grids and boundaries.* Uniform grids $\sigma\in[\sigma_{\min},\sigma_{\max}]$ ($N_\sigma$ nodes) and $F\in[0,F_{\max}]$ ($N_F$ nodes), with three regime layers; the problem is stationary conditional on an open gate, so no time grid. Boundary data follow Lemma C.1: $V=0$ at $F=0$ and at $\sigma=\sigma_{\min}$ (proxying $\sigma\to-\infty$); at $\sigma_{\max}$ impose the entered branch $V=G-I_0$, with $\sigma_{\max}$ far above the provisional threshold, checked ex post to lie inside the entry region.

*Scheme.* First solve the linear coupled system $\mathcal{L}_kG+\pi-r_0G=0$ for $G$ (one sparse solve; discretization as in the pseudocode). Then iterate the regime-coupled obstacle problem.

```text
inputs: P0, B0, F_ref, Pi0, r0, I0, grids (N_sigma, N_F), tol eps, band eps_b
G <- solve  L_k G + pi - r0 G = 0           # entered value, coupled linear solve
V <- max(G - I0, 0)                         # initialization
repeat
  for k in {S0, S1, S2}:
      W(.,.,k) <- implicit finite-difference step of  L_k V - r0 V = 0
                  # upwind drifts, central diffusion, Pi0-row coupling
  V_new <- max(W, G - I0)                   # obstacle (entry) branch
  delta <- sup_norm(V_new - V);  V <- V_new
until delta < eps
theta_hat(k; F) <- min{ sigma_j : V(sigma_j,F,k) - (G(sigma_j,F,k) - I0) <= eps_b }
report theta_hat(k) at F = F_ref
```

*Sweeps.* For each $x\in\{P,B,F_{\mathrm{ref}},\pi_{kk}\}$, vary $x$ over a placeholder interval $[x_{\mathrm{lo}},x_{\mathrm{hi}}]$ holding the rest at baseline — for $\pi_{kk}$, rescale off-diagonal mass proportionally to preserve row-stochasticity — and recompute $\hat\theta^*(k)$. Figure 3 then shows (panel a) the baseline ordering $\hat\theta^*(S_0)>\hat\theta^*(S_1)>\hat\theta^*(S_2)$ and (panels b–e) $\hat\theta^*(k)$ against each swept primitive, one line per regime.

*Diagnostics required before the figure is accepted.* (i) Mesh refinement: halving both mesh widths moves each $\hat\theta^*$ by less than a preset tolerance. (ii) Degenerate-limit check: a single-regime geometric-Brownian collapse must reproduce the McDonald and Siegel (1986) / Dixit and Pindyck (1994) closed-form threshold within tolerance. (iii) Sign check: sweep slopes and regime ordering must agree with Proposition 2 on the swept region (a check of the code against the theory, not evidence for the theory). The regime-filtering and smoothing layers of the monograph's estimation pipeline are not needed: Figure 3 conditions on the regime directly.

---

Citations (full entries in the paper's reference list): Bertola 1998; Caballero 1999; Crandall, Ishii and Lions 1992; Dixit and Pindyck 1994; McDonald and Siegel 1986; McGrath 1997.

## SM-D. The ERS rubric and the eight-project calibration panel

### SM-D.1 The eight institutional axes

Each axis is scored on a five-level ordinal rubric (0–4) anchored by observable institutional states — documents, staffed functions, and operating track records — rather than judgment scales. The full anchor sheets are maintained in the study's operating protocol; the table below summarizes what each axis observes and the logic of its anchors. Blank-sheet checklists are deliberately not reproduced: the rubric is designed to be scored from evidence, and the registered program (Section 7 of the main text) deposits the scoring protocol with the registry.

| Axis | Observes | Level-0 anchor (illustrative) | Level-4 anchor (illustrative) | Main text correspondence |
|---|---|---|---|---|
| $A_1$ Seed scouting & technology assessment | How systematically the institution finds and evaluates commercializable seeds | No scouting function; discovery is accidental | Standing scouting process with documented technology-assessment criteria and periodic review | feeds $R$ drift |
| $A_2$ IP & licensing (TLO function) | Patenting discipline, licensing practice, disclosure management | No institutional IP management | Professionalized TLO with negotiated licenses and disclosure-before-publication discipline | feeds $R$, $S$ |
| $A_3$ Incubation & entrepreneurship support | Space, mentoring programs, entrepreneurship education | None | Dedicated incubation with active mentoring and curricular support | feeds $R$ |
| $A_4$ Industry-collaboration interface | Corporate joint-research windows, alliance management | Ad hoc personal contacts only | Standing corporate interface converting industrial interest ($\mu_I$) into project commitments | exposure to $\sigma_{SU}$ innovations |
| $A_5$ Funding access (incl. gap funds) | Pre-founding capital: gap funds, POC programs, seed access | None | Operating gap-fund/POC programs with follow-on investor connections | feeds $F$ (slack) |
| $A_6$ Entrepreneurial management talent | EIR/CXO supply, founder-matching capacity | None | Standing EIR pool with placement track record | feeds $S$ hazard |
| $A_7$ Bylaws & governance (precondition) | Legal pathway for founding: spin-out rules, COI rules, equity/leave policies | No rules; each case improvised | Complete, exercised bylaws (spin-out, COI, equity, leave) | Proposition 1 gate $g(A_7)$ |
| $A_8$ Government & policy linkage | Access to national/regional programs and policy channels | None | Standing policy interface converting programs ($\mu_G$) into project resources | exposure to $\sigma_{SU}$ innovations |

Two coding rules from the main text (E3) bear repeating: an axis that cannot be evidenced is coded $\perp$ (unknown) and excluded from $K_{obs}$ — it is never silently imputed to zero — and "not started" (evidence of absence) is a 0, which *is* included. The renormalization over $K_{obs}$ in Theorem 1 is what makes this honesty representationally harmless.

### SM-D.2 The calibration panel behind Table 2

The eight projects of Section 6 are composites drawn from one studio's operating records (2007–2026). For each project, the panel records at the founding-decision point: the macro regime assignment ($S_0/S_1/S_2$, assigned retrospectively under the calibration procedure of Section 3 from the three momenta series); the technology-gate reading ($g_{TRL} \in \{0,1\}$, with the domain-specific provisional mapping for drug discovery flagged); the slack state ($F$: low / mid / high, from funding records); the venture-ledger reading and the model's implied decision; the decision actually taken and by whom (studio-involved or external); and the outcome class at 24 months (progressing / stagnant / terminated; right-censored where applicable). Calibration constants mapping rubric levels into model ranges are described procedurally in the main text and withheld as values; the theorems are invariant to them, and the prospective registry deposits them under embargo so that the pre-registered predictions of Section 7 are checkable without public disclosure.

### SM-D.3 Momenta series construction (summary)

The three momenta are constructed from observable series per domain: $\mu_A$ from publication dynamics in the seed's research domain; $\mu_I$ from industrial commitment indicators (corporate participation, procurement signals); $\mu_G$ from policy budgets and program calls. Each series is smoothed, growth-transformed, and mapped to a bounded momentum scale before entering $\sigma_{SU} = \sqrt[3]{\prod (\mu + 1)} - 1$. Series definitions and windows are part of the deposited protocol; regime boundaries ($S_0/S_1/S_2$) are calibrated, not estimated, in this paper (Tier discipline of Section 3).

## SM-E. Notation

| Symbol | Object | First appears |
|---|---|---|
| $P$ | potential scale of the opportunity (venture ledger) | §3 |
| $R$ | realization readiness (venture ledger) | §3 |
| $S$ | survival probability (venture ledger) | §3 |
| $\mathrm{PRS}$ | venture ledger score $P \cdot R \cdot S$ | §3 |
| $A_k$ | institutional axis $k$ score, $[0,4] \cup \{\perp\}$ | §3 |
| $K_{obs}$ | set of observed (non-$\perp$) axes | §3 |
| $w_k$ | axis weight (Theorem 1) | §3 |
| $\mathrm{ERS}$ | institutional ledger score (weighted sum, Theorem 1) | §3 |
| $g(A_7)$ | bylaws precondition gate (Proposition 1) | §3 |
| $\mu_A, \mu_I, \mu_G$ | academic / industrial / governmental momenta | §3 |
| $\sigma_{SU}$ | macro-alignment state, $\sqrt[3]{\prod(\mu+1)} - 1$ | §3 |
| $S_0, S_1, S_2$ | macro regimes (dormant / warming / aligned) | §3 |
| $\Pi = (\pi_{k\ell})$ | regime transition matrix | §5 |
| E1–E4 | axioms on institutional aggregation | §3 |
| C1–C4 | axioms on cross-layer combination | §4 |
| $f(P,R,S;A)$ | candidate single score (shown not to exist) | §4 |
| $\Phi(g, h)$ | separable representation ruled out by Theorem 3 | §4 |
| $\gamma_k^{pool}, \gamma_k^{q}$ | pooled / quartile-conditional institution coefficients (Corollary 3.1) | §4 |
| $\tau$ | founding (stopping) time | §5 |
| $B$ | burn rate | §5 |
| $I$ | irreversible founding cost | §5 |
| $F$ | financial slack | §5 |
| $R_{net}$ | self-generated revenue before risk capital | §5 |
| $V(\sigma, F, k)$ | value function (regime $k$) | §5 |
| $\theta_\sigma^*$ | endogenous founding threshold (Theorem 4) | §5 |
| $g_{TRL}(t)$ | deterministic technology gate $\in \{0,1\}$ | §5 |
| $\mathrm{GO}(t,i)$ | founding operator $\mathbb{1}[\sigma_{SU} \geq \theta_\sigma^*] \cdot g_{TRL}$ | §5 |

## Changelog

| Date | What | By |
|---|---|---|
| 2026-07-03 | 骨格新設 + SM-D (rubric 8軸 正本準拠・panel・momenta) + SM-E (記号表) | えいみ |
| 2026-07-03 | SM-A/B/C を証明エージェント起草→えいみ検収で統合。[GAP] 計21件 (A:4 / C:12 / B:5) は S5・モノグラフ付録での解消対象として保持 | えいみ |
