# PAPER_P1_SM.md — Supplementary Material (Online) draft

*P1 の SM。本文 = `PAPER_P1_DRAFT.md`。SM-A/B/C は証明エージェント起草 → えいみ検収で統合。SM-D/E はえいみ直書き。*

---

# Supplementary Material for "The Before Zero Model: measuring deep-tech ventures and their institutional nurseries before day zero"

## SM-A. Proofs for Section 3 (Theorems 1, 2 and Proposition 1)

This supplement gives complete proofs of the three formal results of Section 3: the weighted-sum representation of the institutional readiness score ERS (Theorem 1), the precondition-gate structure of the bylaws axis (Proposition 1), and the prohibition of multiplicative cross-layer combination with the project readiness score PRS (Theorem 2). Axis numbering follows Section 3; axis 7 is the bylaws (institutional-design) axis.

### SM-A.1 Setup, notation and axioms

**Profiles and observed sets.** An institutional profile is a vector $A=(A_1,\dots,A_8)\in([0,4]\cup\{\bot\})^8$, where $A_k$ is the rubric level of capability axis $k$ and $\bot$ marks an axis whose level has not been observed. The observed set is $K_{\mathrm{obs}}(A)=\{k:A_k\neq\bot\}$. For nonempty $K\subseteq\{1,\dots,8\}$ write $X_K=\prod_{k\in K}[0,4]$, and let $\mathbf{0}_K,\mathbf{4}_K$ denote the profiles constant at levels $0$ and $4$. The primitive of the theory is a family of institutional readiness orderings $\succsim_K$ on $X_K$, one for each observed set: profiles are compared within an observational equivalence class (equal $K$), and every score is reported together with its $K_{\mathrm{obs}}$. Assessment emits integer levels $\{0,1,2,3,4\}$; following the source model we treat each axis domain as the continuum $[0,4]$ with the five rubric levels as landmarks. [GAP: restricted solvability and the Archimedean condition below are stated on the continuum $[0,4]$, whereas assessment produces only five levels per axis; the extension of $\succsim_K$ to intermediate values is assumed in the source architecture rather than constructed.]

**Definition SM-A.1 (additive conjoint structure).** For $|K|\ge 2$, the pair $(X_K,\succsim_K)$ is an *additive conjoint structure* if: (i) $\succsim_K$ is a *weak order* (complete, transitive); (ii) *independence*: the ordering induced on any one axis by fixing the remaining axes does not depend on where they are fixed; (iii) *double cancellation*, whose indifference version is the *Thomsen condition*: for axes $k\neq k'$, levels $a,b,c$ on $k$ and $x,y,z$ on $k'$, if $(a,y)\succsim(b,z)$ and $(b,x)\succsim(c,y)$ then $(a,x)\succsim(c,z)$, all other axes held fixed; (iv) *restricted solvability*: whenever varying axis $k$ alone brackets a target profile from above and below, some level of axis $k$ matches it exactly; (v) *Archimedean*: every bounded standard sequence (levels equally spaced in readiness terms) is finite; (vi) *essentiality*: each axis in $K$ can on its own reverse at least one comparison. See Krantz, Luce, Suppes and Tversky (1971, ch. 6, Def. 6.7 and adjacent definitions), hereafter KLST, and Luce and Tukey (1964).

**Axioms.** The paper imposes on each $\succsim_K$, and on any score $F_K$ representing it:

- **E1 (separability).** Ordinal form: independence, clause (ii) above. Cardinal form, meaningful once the score scale is fixed (see Step 5 below): $\partial^2 F_K/\partial A_k\,\partial A_{k'}=0$ for $k\neq k'$ — the contribution of one axis is assessable without knowing the others (Debreu, 1960; Gorman, 1968).
- **E2 (compensability).** Any two observed axes trade at finite positive rates; no observed axis is individually fatal to the institution. Its *strong form* E2-s encodes the equal-interval design of the Section 3 rubric: a rubric increment $\delta$ on axis $k$ is exactly compensated by a rubric decrement on axis $k'$ at a rate $w_k/w_{k'}$ that does not depend on the base levels.
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
with $w_k>0$ by strict monotonicity. E2-s is a property of the numerals the rubric assigns — the equal-interval design of Section 3 — and it collapses each $\varphi_k$ to a linear function of them.

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

## SM-B. Theorem 3 and its corollaries: the dynamic foundation

This supplement proves Theorem 3 and its two corollaries and constructs the model class in which Section 4 states them. The foundation is dynamic: the institution-adjusted value $f$ is not a primitive scalar constrained by axioms but is *defined* as the expected discounted value of the venture under institution-dependent dynamics — the same object whose optimization Section 5 studies, so Sections 4 and 5 share one value function. Three consequences organize the section. First, the structural properties Section 4 states informally — annihilation C1′, institutional monotonicity C2′, continuity C4′ — are derived, not assumed (Lemma SM-B.1), and the class is non-empty by exhibition, so the existence question for the system C1′–C4′ is settled by construction. Second, the channel statement C3′ — institutional axes enter only the laws of motion of the venture state — is the *definition of the model class*, not a restriction on a given function. This dissolves a type problem that any static formulation of the channel carries: a display such as $df/dA_k=f_R\,\partial R/\partial A_k+f_S\,\partial S/\partial A_k$ must read $R$ and $S$ simultaneously as free coordinates of $f$ and as functions of $A$; here $(R,S)$ are states, $A$ parameterizes their laws of motion, and $f$ is the value functional of the resulting process — each symbol has one type. Third, the impossibility is proved where it matters: for *weakly* monotone composites — the class evaluation practice actually uses — under either of two richness conditions with observable content (SM-B.3–B.4), the strictly monotone case having been disposed of first as the boundary phenomenon it is (SM-B.2).

### SM-B.1 The nurturing-environment class

A venture ledger state is $x=(P,R,S)\in X:=\mathbb{R}_{+}\times[0,1]\times[0,1]$: $P$ the potential scale, constant along a venture's path; $R$ realization readiness, with $R=1$ marking completion of the pre-founding journey; $S$ the survival state. An institutional profile is $A\in\mathcal{A}:=[0,4]^{8}$, the eight rubric axes of Section 3. The *death set* is $\mathcal{D}_0:=\{x:\min(P,S)=0\}$; states with $\min(P,S)>0$ are *live* (interior). $R$ is deliberately absent from $\mathcal{D}_0$ — $R=0$ is a normal live early state, not a boundary of the model; Lemma SM-B.1(b) develops the point.

**Definition SM-B.1 (nurturing environments; the benchmark subclass $\mathfrak{D}$).** A *nurturing environment* $e$ specifies laws of motion for the venture state in which the institutional profile enters only through the coefficients:

**C3′ (channel structure, definitional).** *$A$ appears in the laws of motion of $(R,S)$ — and, in the general case, of slack $F$ and of the exposure to $\sigma_{SU}$ innovations — and nowhere else; venture value is the expected discounted payoff generated by those laws.*

The *deterministic benchmark subclass* $\mathfrak{D}$ consists of pairs $e=(\lambda,r)$ with $r\ge0$ and a hazard-intensity function $\lambda:[0,1]\times\mathcal{A}\to\mathbb{R}_{+}$, continuous and non-increasing in each $A_k$, generating
$$\frac{dR_t}{dt}=1,\qquad \frac{dS_t}{dt}=-S_t\,\lambda(R_t;A),$$
with $S=0$ and $P=0$ absorbing with zero flow, completion when $R$ reaches $1$ (at $\tau=1-R_0$), and value the discounted completion payoff $f_e(x;A):=e^{-r\tau}\,P\,S_{\tau}$. Since $R_t=R+t$, integrating the linear equation for $S$ gives $S_\tau=S\exp\big(-\int_0^{1-R}\lambda(R+t;A)\,dt\big)$, i.e., substituting $u=R+t$,
$$f_e(P,R,S;A)\;=\;P\,S\,\exp\Big(-r(1-R)-\int_R^1\lambda(u;A)\,du\Big).$$
Equivalently, $S_t$ is the probability that a venture facing hazard rate $\lambda(R_t;A)$ is still alive at $t$, and $f_e=\mathbb{E}\big[e^{-r\tau}P\,\mathbf{1}\{\text{alive at }\tau\}\big]$: the state reading and the hazard reading coincide. Thicker nurseries lower the hazard along the *remaining* maturation path $[R,1]$, and value integrates that reduction over exactly the road still to be travelled — the exposure structure that drives SM-B.3.

The general class extends $\mathfrak{D}$ with C3′ kept as the defining restriction: $(R,S,F)$ is a strong Markov process, each $A_k$ enters its generator monotonically (drift of $R$ up, hazard behind $S$ down, slack accumulation up, loading on $\sigma_{SU}$ innovations up), and $A$ appears nowhere outside the generator. Section 5's dynamics are exactly of this form, and one point deserves emphasis: financial slack $F$ and the $\sigma_{SU}$-exposure — the carriers through which Section 5 and SM-D route the funding axis $A_5$ and the interface axes $A_4$, $A_8$ — are *inside* the licensed channel by construction, so the stopping model and the channel structure are consistent by definition, not by assumption. Because death states are absorbing with zero flow, every member satisfies C1′ directly from the definition of value; the remaining structural properties transfer from $\mathfrak{D}$ by the coupling and comparison arguments standard in the stopping literature (McDonald and Siegel, 1986; Dixit and Pindyck, 1994). We cite rather than reproduce these because nothing below uses them: every result of this supplement is proven inside $\mathfrak{D}$, and impossibility theorems need verified witnesses, not the largest possible class. Members of the class are called *admissible*.

**Lemma SM-B.1 (well-posedness, structure, non-emptiness).** *For every $e\in\mathfrak{D}$, with $\Lambda:=\max\lambda$ (finite, $\lambda$ being continuous on a compact domain):*

*(a) (C4′) $f_e$ is well defined, $0\le f_e\le PS\le P$, and jointly continuous in $(x,A)$.*

*(b) (C1′) If $\min(P,S)=0$ then $f_e(x;A)=0$ for every $A$, and $\mathcal{D}_0$ is absorbing. $R$ does not annihilate: if $\min(P,S)>0$ then $f_e(P,0,S;A)\ge PS\,e^{-r-\Lambda}>0$.*

*(c) (C2′) $f_e$ is non-decreasing in each $A_k$; at live $x$ it increases strictly along an increment $t\,e_k$, $t>0$, if and only if the remaining-path response is strict, $\int_R^1\big[\lambda(u;A+te_k)-\lambda(u;A)\big]\,du<0$. When $\lambda$ is $C^1$ in $A_k$,*
$$\frac{\partial f_e}{\partial A_k}(x;A)=-f_e(x;A)\int_R^1\frac{\partial\lambda}{\partial A_k}(u;A)\,du\;>\;0\qquad\text{wherever }f_e>0\text{ and }\int_R^1\frac{\partial\lambda}{\partial A_k}\,du<0.$$

*(d) $f_e$ is non-decreasing in $P$, $S$ and $R$: strictly in $P$ (resp. $S$) wherever $S>0$ (resp. $P>0$), and strictly in $R$ wherever $f_e>0$ and $r+\lambda(R;A)>0$.*

*The class is non-empty — $\lambda\equiv\lambda_0>0$ is a member, as are the two witness environments of SM-B.3, whose channels are operative — and every member satisfies C1′–C4′.*

*Proof.* All claims are read off the closed form. (a) The exponent is $\le0$ ($r\ge0$, $\lambda\ge0$), giving the bounds. Continuity: $\lambda$ is bounded and uniformly continuous on $[0,1]\times\mathcal{A}$, so $(R,A)\mapsto\int_R^1\lambda(u;A)\,du$ is continuous — $\big|\int_R^1-\int_{R'}^1\big|\le\Lambda|R-R'|$, and $\sup_u|\lambda(u;A)-\lambda(u;A')|\to0$ as $A'\to A$ — and $f_e$ is a product and composition of continuous maps. (b) The factor $PS$ vanishes on $\mathcal{D}_0$, for every $A$; absorption holds because $P$ is constant, $S=0$ is a fixed point of $dS_t=-S_t\lambda\,dt$, and both states are absorbing with zero flow by specification. At $R=0$, $\int_0^1\lambda\,du\le\Lambda$ gives the lower bound. (c) $A$ enters the closed form only through $-\int_R^1\lambda(u;A)\,du$, so at live $x$
$$\frac{f_e(x;A+te_k)}{f_e(x;A)}=\exp\Big(-\int_R^1\big[\lambda(u;A+te_k)-\lambda(u;A)\big]\,du\Big),$$
which is $\ge1$ since $\lambda$ is non-increasing in $A_k$, and $>1$ exactly when the integrated response is strict; the displayed derivative is the chain rule with differentiation under the integral. (d) $\partial f_e/\partial P=Se^{(\cdot)}$, $\partial f_e/\partial S=Pe^{(\cdot)}$, and $\partial f_e/\partial R=\big(r+\lambda(R;A)\big)f_e$ by the Leibniz rule. $\square$

*Remark.* Part (b) is a design decision the model class makes and the paper defends: annihilation is carried by $P$ and $S$ only — the weakest-link boundary (Kremer, 1993) runs through potential and survival — while $R=0$ is a live state with strictly positive option value. An unrealized seed is an option, not a corpse: the gap-fund axis ($A_5$) exists precisely to fund seeds at $R\approx0$, and a model that killed them at the boundary would delete the very objects that funding channel exists for. Section 6's instant-fail type dies of $P\to0$, not of low $R$.

### SM-B.2 Boundary degeneracy of strictly increasing composites

Write $\succsim_e$ for the value ordering induced on $X\times\mathcal{A}$: $(x,A)\succsim_e(x',A')$ iff $f_e(x;A)\ge f_e(x';A')$. A triple $(g,h,\Phi)$ — $g:X\to\mathbb{R}$, $h:\mathcal{A}\to\mathbb{R}$, $\Phi:\mathbb{R}^2\to\mathbb{R}$ — *represents* $\succsim_e$ if
$$f_e(x;A)\ge f_e(x';A')\iff \Phi\big(g(x),h(A)\big)\ge\Phi\big(g(x'),h(A')\big)\qquad\text{for all pairs};$$
the biconditional transports strict inequalities and ties: $f_e>f_e'$ iff $\Phi>\Phi'$, and $f_e=f_e'$ iff $\Phi=\Phi'$. Call the institutional channel *operative* at a live state $x^{*}$ if there are an axis $k$, a profile $A^{\circ}$ and $t>0$ with $f_e(x^{*};A^{\circ}+te_k)>f_e(x^{*};A^{\circ})$.

**Lemma SM-B.2 (boundary degeneracy).** *Let $e$ be admissible with the channel operative somewhere. Then no triple with $\Phi$ strictly increasing in each argument represents $\succsim_e$.*

*Proof.* At the operative $x^{*}$ the representation gives $\Phi(g(x^{*}),h(A^{\circ}+te_k))>\Phi(g(x^{*}),h(A^{\circ}))$; were $h(A^{\circ}+te_k)\le h(A^{\circ})$, monotonicity of $\Phi$ would force $\le$; hence $h(A^{\circ}+te_k)>h(A^{\circ})$. On any boundary row $x_a\in\mathcal{D}_0$, C1′ gives $f_e(x_a;A^{\circ}+te_k)=f_e(x_a;A^{\circ})=0$, so the representation requires a tie at $x_a$ — while the $h$-gap and strict increase of $\Phi$ in its second argument force a strict gap. Contradiction. $\square$

This is the easy result, and we frame it as such: a function forced to vanish on a set where its institutional factor should still separate points cannot be strictly institution-sensitive there. It is an instance, transported across observation levels, of the known phenomenon that veto and annihilation structures defeat strictly monotone separable representations in noncompensatory aggregation (Fishburn, 1976; Bouyssou and Marchant, 2007); in separability language, C1′ negates single-factor independence of the institutional sector (Gorman, 1968; Blackorby, Primont and Russell, 1978). Its practical bite is limited. The composites evaluation practice actually uses — pure multiplication $g(x)h(A)$ with $g=0$ on the death set, geometric blends, CES aggregates with complements, min gates — are *weakly* monotone: flat in the institution exactly on the death set, sensitive off it, so they escape the lemma untouched. The real question is whether weakly monotone composites survive. They do not, under either of two richness conditions with observable content.

### SM-B.3 Two richness conditions and their witnesses

**Condition SH (stage-contingent operability).** *There exist axes $k\neq k'$, a base profile $A^{\circ}$, increments $t,s>0$, and live states $x_{\mathrm{lo}},x_{\mathrm{hi}}$ such that*
$$f_e(x_{\mathrm{lo}};A^{\circ}+te_k)>f_e(x_{\mathrm{lo}};A^{\circ}+se_{k'})\qquad\text{and}\qquad f_e(x_{\mathrm{hi}};A^{\circ}+te_k)<f_e(x_{\mathrm{hi}};A^{\circ}+se_{k'}).$$

This is the direct form: an institutional comparison that strictly reverses across venture strata. A structural sufficient condition in $\mathfrak{D}$ is stage-disjointness of the response supports — axis $k$ operative on early strata ($\lambda$ responds to $A_k$ only at low $u$), axis $k'$ on late strata. Its economic content is a standard fact of technology-transfer practice: incubation and entrepreneurship support ($A_3$) and seed scouting ($A_1$) act early in the realization journey, while licensing execution ($A_2$) and the corporate interface ($A_4$) act late, when there is something to license and someone to interface with (cf. the rubric anchors of SM-D.1). Different institutional capabilities bind at different venture stages.

**Witness (SH).** In $\mathfrak{D}$ take, for $\beta>0$ and $\lambda_0\ge8\beta$,
$$\lambda(u;A)=\lambda_0-\beta\,\mathbf{1}\big[u\in[0,\tfrac{3}{5})\big]\,A_k-\beta\,\mathbf{1}\big[u\in[\tfrac{3}{5},1]\big]\,A_{k'},$$
so that $\lambda\ge\lambda_0-4\beta\ge4\beta>0$ on the whole rubric range and $\lambda$ is non-increasing in each axis. (The stage cutoff can be smoothed to meet the continuity clause of Definition SM-B.1: replacing each indicator by a piecewise-linear ramp on an $\varepsilon$-window around $u=\tfrac{3}{5}$ perturbs every integral below by at most $8\beta\varepsilon$, hence every log-ratio below by at most $16\beta\varepsilon$, while the strict log-gaps displayed are $\beta/5$ and $2\beta/5$ — so any $\varepsilon<1/80$ preserves both strict inequalities; we compute with the sharp cutoff for arithmetic transparency.) Take one rubric step on each axis, $A:=A^{\circ}+e_k$ and $A':=A^{\circ}+e_{k'}$ (any base with $A^{\circ}_k,A^{\circ}_{k'}\le3$), and states $x_{\mathrm{lo}}=(P,0,S)$, $x_{\mathrm{hi}}=(P,\tfrac{3}{5},S)$, any $P,S>0$. In value ratios the discount and base-profile terms cancel; only the increments' integrated hazard reductions remain. At $x_{\mathrm{lo}}$ ($R=0$),
$$\int_0^1\lambda(u;A)\,du=\int_0^1\lambda(u;A^{\circ})\,du-\tfrac{3}{5}\beta,\qquad\int_0^1\lambda(u;A')\,du=\int_0^1\lambda(u;A^{\circ})\,du-\tfrac{2}{5}\beta,$$
so $f_e(x_{\mathrm{lo}};A)/f_e(x_{\mathrm{lo}};A')=\exp\big(\tfrac{3\beta}{5}-\tfrac{2\beta}{5}\big)=e^{\beta/5}>1$. At $x_{\mathrm{hi}}$ ($R=\tfrac{3}{5}$) the remaining path $[\tfrac{3}{5},1]$ misses the support of axis $k$ entirely, so
$$\int_{3/5}^1\lambda(u;A)\,du=\int_{3/5}^1\lambda(u;A^{\circ})\,du,\qquad\int_{3/5}^1\lambda(u;A')\,du=\int_{3/5}^1\lambda(u;A^{\circ})\,du-\tfrac{2}{5}\beta,$$
and $f_e(x_{\mathrm{hi}};A)/f_e(x_{\mathrm{hi}};A')=\exp\big(0-\tfrac{2\beta}{5}\big)=e^{-2\beta/5}<1$. SH holds with $t=s=1$: one rubric step on the early axis beats one on the late axis for a seed at the start of its journey, and loses to it for a seed past the early stage.

**Condition ED (exposure-duration asymmetry).** Institutions act over the venture's *remaining* journey, and ventures differ in how much journey remains. Direct form: *there exist live states $x,x'$ and profiles $A\le A'$ (componentwise, $A'$ strictly better on an operative axis) such that*
$$f_e(x;A)>f_e(x';A)\qquad\text{and}\qquad f_e(x;A')<f_e(x';A')$$
— a *venture* comparison that strictly reverses as the institution strengthens.

**Witness (ED).** In $\mathfrak{D}$ take the stage-uniform hazard $\lambda(u;A)=c\,(4-A_k)$ with $c>0$ (i.e. $\lambda_0=4c$ exactly; any $\lambda_0\in[4c,6c)$ delivers both signs below, and $\lambda_0=4c$ is cleanest) and $r=0$; $\lambda\ge0$ on the rubric range and is non-increasing in $A_k$. The closed form reads $f_e=PS\,e^{-c(4-A_k)(1-R)}$. Take a nearly-done and an early state half a journey apart, $x=(P,\tfrac{3}{4},S)$ and $x'=(P',\tfrac{1}{4},S')$, with mass ratio $P'S'=e^{c}\,PS$ (feasible since $P$ is unbounded: e.g. $S'=S$, $P'=e^{c}P$), and let $A'$ improve $A$ by the full rubric range on axis $k$: $A_k=0$, $A'=A+4e_k$. Then
$$\log\frac{f_e(x;A)}{f_e(x';A)}=\log\frac{PS}{P'S'}+c\,(4-A_k)\Big[\big(1-\tfrac{1}{4}\big)-\big(1-\tfrac{3}{4}\big)\Big]=-c+\frac{c\,(4-A_k)}{2},$$
which at $A_k=0$ equals $-c+2c=c>0$ — the nearly-done seed wins at the weak nursery — and at $A'_k=4$ (hazard zero) equals $-c<0$ — the early seed wins at the strong one. Raw values make the mechanism visible: at $A_k=0$, $f_e(x;A)=PS\,e^{-c}$ against $f_e(x';A)=PS\,e^{-2c}$; at $A'_k=4$, $f_e(x;A')=PS$ against $f_e(x';A')=e^{c}PS$. Less remaining hazard favors the nearly-realized seed at a weak nursery; a strong nursery's nursing compounds over the early seed's longer remaining road ($1-R'=\tfrac{3}{4}$ against $1-R=\tfrac{1}{4}$) and reverses the ranking.

Two features of the pair deserve note. First, in the ED witness the institutional ordering itself is venture-uniform — $f_e(\cdot\,;A')\ge f_e(\cdot\,;A)$ everywhere, by Lemma SM-B.1(c) — and the hazard is stage-uniform, so this witness satisfies ED while violating SH; it is the *venture* comparison that flips. SH and ED are logically independent mechanisms: SH reverses institutional comparisons across venture strata, ED reverses venture comparisons across institutional strength. Second, both conditions are *empirical statements with observable content*, not normative axioms: whether early-acting and late-acting capabilities exist, and whether institutional value scales with remaining exposure, are inspectable features of a technology-transfer environment. They play exactly the role that domain richness plays in preference-aggregation impossibilities (Arrow, 1963), and the registered program of Section 7 treats them as premises to be audited, not assumed.

### SM-B.4 Theorem 3: the single-index impossibility

**Theorem 3 (single-index impossibility).** *Let $e$ be an admissible environment satisfying SH or ED. Then there exist no functions $g$ of the ledger state, $h$ of the institutional profile, and $\Phi:\mathbb{R}^2\to\mathbb{R}$ such that $\Phi(g(x),h(A))$ represents the value ordering $\succsim_e$ — that is, $f_e(x;A)\ge f_e(x';A')\iff\Phi(g(x),h(A))\ge\Phi(g(x'),h(A'))$ for all pairs — with $\Phi$ non-decreasing in its institutional argument (under SH), or with $\Phi$ non-decreasing in its venture argument (under ED).*

*Proof.* Under SH, let $(A,A',x_{\mathrm{lo}},x_{\mathrm{hi}})$, $A=A^{\circ}+te_k$, $A'=A^{\circ}+se_{k'}$, realize the reversal. The representation at $x_{\mathrm{lo}}$ requires $\Phi(g(x_{\mathrm{lo}}),h(A))>\Phi(g(x_{\mathrm{lo}}),h(A'))$; were $h(A)\le h(A')$, $\Phi$ non-decreasing in its institutional argument would force $\le$; hence $h(A)>h(A')$. At $x_{\mathrm{hi}}$ the true order requires $\Phi(g(x_{\mathrm{hi}}),h(A))<\Phi(g(x_{\mathrm{hi}}),h(A'))$; but $h(A)>h(A')$ and monotonicity force $\ge$. Contradiction. Under ED the argument is symmetric in the first coordinate: $f_e(x;A)>f_e(x';A)$ forces $g(x)>g(x')$, and then $f_e(x;A')<f_e(x';A')$ requires $\Phi(g(x),h(A'))<\Phi(g(x'),h(A'))$ while $g(x)>g(x')$ and monotonicity in the venture argument force $\ge$. $\blacksquare$

*Remarks.* (i) *Scope.* Nothing was assumed about $g$ and $h$ — no monotonicity, no continuity; the only structure used is that the institutional information reaches the score through a single index used monotonically (under ED, symmetrically, the venture information). The excluded class therefore contains every composite in evaluation practice — pure multiplication, weighted addition, geometric and CES blends, min/max gates, lexicographic hybrids — and every monotone recalibration of any of them. Practice endorses monotonicity in *both* arguments — a better venture score, or a better institution score, should never lower the composite — so either richness condition alone is fatal.

(ii) *Why a static axiomatization cannot deliver this.* On the static domain, weakly monotone separable scores consistent with annihilation and institutional monotonicity exist: $f=\min\big(PRS,\kappa(A)\big)$, with $\kappa$ any strictly increasing index calibrated to the institution's induced response, vanishes with the venture ledger and never decreases in any argument, and an axiom system that constrains $f$ pointwise cannot exclude it. What excludes it is stage-contingency of the *dynamics*: under SH the value ordering of two institutions genuinely reverses across venture strata, and no single institutional index — however cleverly calibrated — can lie on both sides of a reversal. The dynamic foundation is therefore not a technical reformulation of Section 4 but the source of the theorem's content.

(iii) *Tightness.* Where the channel is inoperative ($\lambda$ free of $A$), $f_e$ does not depend on $A$ and $\Phi(g,\mathrm{const})$ with $g=f_e$ trivially represents $\succsim_e$. In stage-uniform, duration-degenerate corners of the class the same holds on restricted slices: with $\lambda(u;A)=\bar\lambda(A)$ and comparisons confined to a common readiness $R=\bar R$, the closed form is exactly multiplicative, $f_e=[PS]\cdot[e^{-(r+\bar\lambda(A))(1-\bar R)}]$, and the monotone composite $\Phi(g,h)=g\,h$ represents that slice of $\succsim_e$. The exclusions are thus tied to the named structures: where the channel is null the composite is trivially available, and where stage-contingency and duration heterogeneity are both switched off, monotone composites can represent restricted slices of the ordering. Whether they can represent the full ordering in such degenerate corners is not needed here and not claimed. The premises are observable: SH and ED belong to the registered program of Section 7, so the theorem's empirical discipline is explicit.

(iv) *Boundary versus interior.* Lemma SM-B.2's obstruction lives on the death boundary; Theorem 3's lives at live states — both witnesses have $\min(P,S)>0$. The impossibility bites exactly where committees operate: on pre-screened live portfolios from which the corpses have already been removed.

### SM-B.5 Corollary 3.2: the portfolio impossibility

**Corollary 3.2 (portfolio impossibility).** *Let $\mathfrak{E}$ be a family of admissible environments such that for some axis $k$, profile $A^{\circ}$, increment $t>0$ and live state $x^{*}$ there are $e,e'\in\mathfrak{E}$ with the channel operative in $e$ — $f_e(x^{*};A^{\circ}+te_k)>f_e(x^{*};A^{\circ})$ — and null in $e'$ — $f_{e'}(x^{*};A^{\circ}+te_k)=f_{e'}(x^{*};A^{\circ})$. Then no single triple $(g,h,\Phi)$ — indeed no environment-blind function $F(x,A)$ whatsoever — represents $\succsim_e$ for every $e\in\mathfrak{E}$.*

*Proof.* A single $F$ assigns one order to the pair $\{(x^{*},A^{\circ}+te_k),(x^{*},A^{\circ})\}$; representing $\succsim_e$ requires the strict order, representing $\succsim_{e'}$ requires the tie. $\blacksquare$

*Remark.* This is the Arrow-style reading of the paper's result: as in Arrow (1963), what defeats the aggregation rule is richness of the admissible *domain* — a committee portfolio spanning technology domains whose response structures differ — not any single profile. It is the formal statement of the committee-room fact that one formula is applied to forty seeds drawn from forty response structures. We state its weight honestly: the proof is immediate and the content is entirely in the domain condition (a hazard responsive to $A_2$ in a licensing-driven domain, unresponsive where the binding constraint lies elsewhere). The within-environment Theorem 3, which defeats the single index inside one fixed response structure, is the sharper result.

### SM-B.6 Corollary 3.1: three falsifiable signatures as registered diagnostics

**Setting.** Suppose practice ranks — and funds, and therefore samples — by a single monotone composite $V=\Phi(g(x),h(A))$, while the data are generated by an admissible environment with operative, stage-contingent channels (SH; under ED the same wedge enters through the $(1-R)$ scaling of the institutional increment). Theorem 3 locates the error exactly: $h(A)$ is a venture-uniform institutional index, while institutional value is stage-contingent. Let $y$ be a realized outcome ordered as $f_e$, and let $\gamma_k^{\mathrm{pool}}$ and $\gamma_k^{q}$ denote the coefficient on $A_k$ in outcome regressions estimated pooled and within venture strata ($\mathrm{PRS}$-quartiles $q=1,\dots,4$). We register (i)–(iii) below as *diagnostics* of the wedge between a venture-uniform institutional index and stage-contingent institutional value. They are not on an equal footing, and we say so: (ii) is derivable directly from SH/ED; (i) additionally requires a selection mechanism; (iii) is (ii) in estimator-contrast form.

**(i) Simpson reversal (Simpson, 1951).** Under the class, every within-stratum institutional slope is non-negative (Lemma SM-B.1(c)), and the pooled coefficient is a mixture of within-stratum slopes plus a between-stratum composition term, itself non-negative wherever thicker institutions migrate ventures upward through the transmitted response. A *sign* reversal, $\operatorname{sign}(\gamma_k^{\mathrm{pool}})\neq\operatorname{sign}(\gamma_k^{q})$, therefore requires a negative ingredient beyond non-negative within-stratum slopes and non-negative composition. The natural ingredient is selection of the observed sample on the score itself: only ventures funded or founded under the composite are observed, and conditioning on $V$ — a function of both layers — is collider conditioning that induces negative dependence between the venture and institution strata within the observed sample. [GAP: the explicit selection-on-score data-generating process behind (i) — the collider construction and the parameter region in which the pooled sign flips — is specified in the registered-program protocol, not here.]

**(ii) Quartile instability.** The diagnostic that follows most directly. Under SH the institutional slope genuinely varies across venture strata — SH *is* that statement translated into regression language: the same one-step axis contrast is positive where the axis is operative and null, or rank-reversed against another axis, where it is not. Under ED the institutional increment scales with remaining exposure: in the ED witness $\log f_e$ is linear in $A_k$ with coefficient $c\,(1-R)$, so early strata carry strictly larger institutional slopes than late strata by construction. Either way, a stratum-common institutional coefficient is misspecified. Test:
$$\frac{\big|\gamma_k^{q}-\gamma_k^{q'}\big|}{\mathrm{SE}\big(\gamma_k^{q}-\gamma_k^{q'}\big)}>2\ \text{ for some pair }(q,q'),$$
equivalently an $\mathrm{ERS}\times\mathrm{PRS}$ interaction whose 95% region excludes zero. This Wald/interaction form is the primary registered test.

**(iii) Hausman divergence (Hausman, 1978).** Let $\hat\theta_{\mathrm{pool}}$ impose stratum-common institutional coefficients and $\hat\theta_{\mathrm{cond}}$ leave them stratum-free. Were a venture-uniform institutional index adequate, both estimators would converge to the same limit and
$$H=(\hat\theta_{\mathrm{cond}}-\hat\theta_{\mathrm{pool}})'(\hat V_{\mathrm{cond}}-\hat V_{\mathrm{pool}})^{-}(\hat\theta_{\mathrm{cond}}-\hat\theta_{\mathrm{pool}})\ \sim\ \chi^2_{q},\qquad q=\operatorname{rank}\big(\hat V_{\mathrm{cond}}-\hat V_{\mathrm{pool}}\big),$$
would be central, with $q$ the number of equality restrictions the pooled specification imposes (a generalized inverse accommodates the rank-deficient contrast); under SH or ED the pooled estimand is a weight-dependent blend distinct from the conditional estimands, and $H$ rejects. The statistic adds no identifying content beyond (ii) — it is the same misspecification read as an estimator contrast — and (ii)'s interaction form remains the primary registered test.

**Negative criterion (falsifiability commitment).** The single-score benchmark is rehabilitated on the data only if all three diagnostics fail to reject — each at Bonferroni-corrected $\alpha=0.05/3\approx0.0167$, holding the family-wise error rate at 5% — *and* the channel-completeness test of SM-B.7 also fails to reject ($p\ge0.10$). Any one firing diagnostic supports the empirical content of Theorem 3, with the stated caveat for (i), whose evidential weight is conditional on the registered selection mechanism.

### SM-B.7 The Hansen $J$ test: channel completeness

The diagnostics of SM-B.6 test consequences of the theorem within the maintained class; the class structure itself is testable, and the two exercises must not be conflated. C3′ says that institutional axes affect value only through the laws of motion of $(R,S,F)$ and the $\sigma_{SU}$-exposure; a *direct* channel — a brand or halo premium accruing at a fixed venture path — lies outside the class and would void Theorem 3's premises. The tested hypothesis is therefore *channel completeness*: the licensed carriers exhaust the transmission from $A$ to value. Writing $\rho_k^{R},\rho_k^{S},\rho_k^{F},\rho_k^{\sigma}$ for the responses of the four carriers to axis $k$, the moment conditions equate the measured total effect of axis $k$ on the value process with the effect transmitted through the measured carrier responses:
$$E\Big[\Big(\frac{df_e}{dA_k}-\frac{\partial f_e}{\partial R}\,\rho_k^{R}-\frac{\partial f_e}{\partial S}\,\rho_k^{S}-\frac{\partial f_e}{\partial F}\,\rho_k^{F}-\frac{\partial f_e}{\partial \sigma_{SU}}\,\rho_k^{\sigma}\Big)\cdot z\Big]=0,$$
with $z$ a vector of instruments built from shocks to institutional axes external to the venture state (policy shifts to funding or staffing rules used as natural experiments). The bracketed factor is the direct-channel residual — the total institutional effect net of everything transmitted through the four carriers — so the restriction tests completeness of the licensed channel as a whole, not a two-term subset of it: the slack and exposure responses sit inside the null exactly as they sit inside the class (SM-B.1). With $\dim(m)>\dim(\theta)$, where $m$ stacks the moments across axes and instruments and $\theta$ collects the parameters of $(f_e,\rho)$, Hansen's (1982) overidentification statistic
$$J=N\,g_N(\hat\theta)'\,\hat W\,g_N(\hat\theta)\ \sim\ \chi^2_{\dim(m)-\dim(\theta)}$$
is central under channel completeness, with the conservative rejection region $p<0.10$ (loosened because failing to reject is the informative outcome for a premise). Decision matrix: $J$ rejects $\Rightarrow$ a direct institutional channel exists, the environment lies outside the class, and the premises of Theorem 3 are void regardless of the diagnostics; $J$ fails to reject and any diagnostic fires $\Rightarrow$ the class stands and single-score practice is contradicted; $J$ fails to reject and no diagnostic fires $\Rightarrow$ the negative criterion of SM-B.6 applies and the scalar benchmark is empirically admissible on the data. [GAP: the instrument list, the estimating system for $(\partial f_e/\partial R,\dots,\rho_k^{\sigma})$, and the pre-registration protocol are specified in the registered-program protocol, not here.]

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
| C1′–C4′ | structural properties of the nurturing class (C3′ = channel restriction) | §4 |
| SH / ED | richness conditions: stage-contingent operability / exposure-duration asymmetry | §4 |
| $f(P,R,S;A)$ | institution-adjusted value (value function of a nurturing environment; admits no single-score representation) | §4 |
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
| 2026-07-03 | S5後半 R8: SM-A の誤参照3箇所 (Section 2 → Section 3) 修正 (socialchoice minor #4) | えいみ |
| 2026-07-03 | S5後半 R1: SM-B 全面差し替え — 動学的価値関数基盤。nurturing-environment class 𝔇 (閉形式 f=PS·exp(−r(1−R)−∫λ))、C1′-C4′ を構造的性質として導出 (Lemma SM-B.1、非空性込み)、C3′ をクラス定義に昇格 (型エラー解消、F/σ-exposure をチャネル内に = 自己違反解消)。境界退化 = Lemma SM-B.2 (strict 合成のみ、noncompensatory 系譜に接続)。SH/ED 豊富性条件 + 閉形式証人 (e^{β/5}/e^{−2β/5}、±c)。新 Theorem 3 = 弱単調合成 (乗法/CES/min 含む) の排除。Cor 3.2 (portfolio/universal domain) 新設。B.6 を registered diagnostics 化 ((ii) primary / (i) は selection 要 / (iii) χ² df を制約数 q に修正)。B.7 を channel completeness 化 (4キャリア moment)。SM-B の GAP 5→2 (残: B.6 selection-DGP / B.7 instruments)。エージェント起草→えいみ検収 (検収修正3点: ε<1/80 明示・tightness 主張軟化・df 修正) | えいみ |
