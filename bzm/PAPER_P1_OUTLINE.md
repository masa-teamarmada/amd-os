# PAPER_P1_OUTLINE.md — S2 段落 outline (英語)

> **投稿停止中の旧アウトライン（2026-07-29）**：Book A版の旧定理撤回とBZM 2.0の主張境界を反映していないため、このまま本文化または投稿へ用いない。P1固有の追加条件を持つ定理は別途再検証する。再設計の正本は`BZM_2_0_REVISION_REQUIREMENTS.md`、決定はD-062。

*位置づけ: P1 (Research Policy 論文) の S2 成果物。L1 = `PAPER_P1_MASTER_PLAN.md`、進捗 = `PAPER_P1_PROGRESS.md`。各段落 = 「番号 (words) — claim | math | cites」。S3 では各エントリを 1 段落の英文に展開する。日本語の注記は起草用スキャフォールドで、S3 で消える。*

*初版: 2026-07-03。タイトル (b) 確定反映。*

---

## Front matter

- **Title**: *The Before Zero Model: measuring deep-tech ventures and their institutional nurseries before day zero* (まさ確定 2026-07-03、字面の微調整は S4-S5 でのみ)
- **Abstract** (~150w、S4 で最終化): Deep-tech ventures born from universities accumulate — or fail to accumulate — most of their value before incorporation, yet this "Before Zero" stage has no measurement theory. We propose the Before Zero Model (BZM): a two-layer observation system with a multiplicative venture ledger (PRS) and a weighted-sum institutional ledger (ERS), linked by a Triple-Helix macro state (σ_SU). We prove the two ledgers cannot be merged: under four mild axioms, no single score combining venture and institutional readiness exists (an Arrow-style impossibility), and we derive falsifiable statistical signatures of the error committed by "institution-adjusted" composite rankings. A weighted sum is shown to be the unique admissible institutional aggregate, and the go/wait decision emerges as the optimal-stopping rule operating on the two ledgers. A retrospective calibration on eight deep-tech projects (2007–2026) illustrates the system. We close by registering a falsification program for Before Zero Studies.
- **Keywords**: deep-tech ventures; university spin-outs; readiness measurement; technology readiness levels; Triple Helix; impossibility theorem; real options; research commercialization
- **Highlights** (5, ≤85 chars each, S4 で最終化): (1) A measurement theory for ventures before incorporation ("Before Zero") / (2) Venture readiness is multiplicative; institutional readiness is additive / (3) No single score can combine the two layers: an impossibility theorem / (4) Composite "institution-adjusted" rankings leave testable statistical scars / (5) Go/wait timing derived as optimal stopping on the two ledgers

### 論文内 記号・番号規律 (モノグラフとの対応)

| 論文 | モノグラフ | 注記 |
|---|---|---|
| Axioms **E1-E4** (ERS: separability / compensability / missing-visibility / monotonicity) | Ch 9 の A1-A4 | 論文内で Ch 10.4 系と衝突するためリネーム |
| Axioms **C1-C4** (cross-layer: PRS annihilation / ERS monotonicity / causal-channel / continuity) | Ch 10.4 の (A1)-(A4) | C = combination |
| Theorem 1 (ERS additive representation) | Ch 9 Thm 9.1+9.2 統合 | 証明 SM-A |
| Proposition 1 (axis-7 precondition gate) | Ch 9 Prop 9.3 | — |
| Theorem 2 (no double counting) | Ch 9 Thm 9.4 | §4 への bridge |
| **Theorem 3 (impossibility)** | Ch 10.4 Thm 3 | 番号を維持 (flagship) |
| Corollary 3.1 (falsifiable signatures) | Ch 10.4 系 3.1 | Simpson / quartile / Hausman |
| Theorem 4 (GO optimal stopping) | Ch 5.5 命題 5.5.2 | 証明 SM-C |
| Proposition 2 (comparative statics) | Ch 5.5 命題 5.5.3 | — |
| 記号 | `terminology_glossary.md` §3-4 準拠 | ℛ 系 (RT) は論文に出さない |

---

## §1 Introduction (1,150w, 8 paras)

- **1.1** (150) Opening vignette (composite disclosure in footnote): a national screening panel ranks ~40 university deep-tech seeds by "institution-adjusted project score" = project score × institutional coefficient; re-weighting swaps two seeds' ranks; the panel treats it as calibration to be tuned. Claim: it is not a calibration problem — it is a structural impossibility, and this paper proves it. | — | —
- **1.2** (150) The object: deep-tech ventures gestate value **before incorporation** — TRL maturation, IP, regulatory path, team formation — often over 5–15 years inside universities/national labs. Define **Before Zero** = the pre-founding stage; "day zero" = incorporation. | — | Shane 2004; Perkmann et al. 2013; Grimaldi et al. 2011
- **1.3** (140) The evaluation gap: valuation needs cash flows or comparables — absent before day zero. Practice fills the void with readiness scales and scorecards; policy increasingly demands composite rankings for fund allocation. | — | Mankins 1995; EC Horizon SRL; Nardo et al. 2008 (OECD/JRC)
- **1.4** (160) Proposal: the **Before Zero Model (BZM)** — a two-layer observation system. Venture ledger PRS = P×R×S (multiplicative); institutional ledger ERS (weighted sum over 8 axes); macro state σ_SU (Triple-Helix momentum) on which the venture ledger's dynamics condition. "Two ledgers" metaphor introduced. | PRS = P·R·S; ERS = 100·Σw_kA_k/Σw_k; σ_SU | —
- **1.5** (160) Main result 1 (**Theorem 3**): under four mild axioms (C1-C4) no single score f(P,R,S;A) merging the layers exists; pure multiplication, pure addition, and any monotone composite each fail a specific axiom; **Corollary 3.1** gives the statistical scars (Simpson reversal, quartile instability, Hausman rejection) that composite practice leaves in data. | f ≠ Φ(g(PRS),h(A)) | Arrow 1963 (positioning)
- **1.6** (140) Main results 2 & 3: **Theorem 1** — the weighted sum is the *unique* admissible institutional aggregate (conjoint measurement); **Theorem 4** — the go/wait rule is derived, not asserted: an optimal-stopping first-order condition on the two ledgers with endogenous threshold θ_σ*. Measurement first; operation as consequence. | — | KLST 1971; Dixit & Pindyck 1994
- **1.7** (130) Contributions to RP readership: (i) measurement theory for an unmeasured stage; (ii) impossibility as policy guardrail (what *not* to build); (iii) a falsification-registered research program — **Before Zero Studies**. | — | —
- **1.8** (120) Roadmap + scope declaration (deep-tech, Japanese university/national-lab context; generalization = empirical question). | — | —

## §2 Two evaluation problems, one field (1,050w, 7 paras)

- **2.1** (150) Readiness levels: TRL's origin and diffusion; extensions (BRL/SRL/HRL); strengths (communication protocol) vs limits — ordinal single-axis scales with no aggregation theory and no institution side. | — | Mankins 1995; Olechowski et al. 2020; EC Horizon SRL
- **2.2** (150) Composite indicators and their discontents: weighting arbitrariness, compensability confusion, rank reversals; Sen's measurement critique; Alkire-Foster's identification/aggregation discipline as the principled exception. | — | Nardo et al. 2008; Greco et al. 2019; Sen 1977; Alkire & Foster 2011
- **2.3** (150) University spin-out research: TTO efficiency, GAP funds, incubation, EIR — institution-level capabilities studied *separately* from venture-level quality; yet evaluation practice merges them into one number. The merger itself has never been theorized. | — | Bozeman 2000; Shane 2004; Munari et al. 2016; Hayter et al. 2018
- **2.4** (150) Triple Helix: qualitative program + quantitative operationalization (mutual information T_AIG); what it lacks: a venture-facing state variable that decision rules can condition on. σ_SU fills this slot (concept ≠ T_AIG; formal cross-walk in monograph, one-line pointer). | T(AIG) | Etzkowitz & Leydesdorff 2000; Leydesdorff 2003
- **2.5** (150) Real options and entry timing: irreversible investment under uncertainty; R&D applications; thresholds are firm-level and exogenous to any measurement system — no bridge from readiness measurement to stopping rules. | — | McDonald & Siegel 1986; Dixit & Pindyck 1994; McGrath 1997
- **2.6** (150) The measurement-theoretic tradition: Arrow's axiom-collapse template; Debreu's additive representations; KLST conjoint measurement — powerful, rarely imported into innovation evaluation. This paper does the import. | — | Arrow 1963; Debreu 1960; KLST 1971; Luce & Tukey 1964
- **2.7** (150) Synthesis of the gap: no framework simultaneously (i) respects venture multiplicativity, (ii) derives institution additivity, (iii) proves the two cannot merge, (iv) yields the timing rule. BZM = that framework. | — | —

## §3 The two-layer observation system (1,500w, 10 paras)

- **3.1** (150) Primitives: project i, institution j, time t; what is observable before day zero (rubric-scored axes, macro series, burn/funding states); the observation problem stated. | — | —
- **3.2** (160) Venture ledger: PRS = P×R×S with P = potential scale, R = realization readiness, S = survival probability. Multiplicative rationale = weakest-link economics (O-ring): failure in any factor annihilates the venture; scale-free reading ("what kills the deal"). | PRS = P·R·S | Kremer 1993; Cobb & Douglas 1928
- **3.3** (140) Macro state σ_SU: momenta (μ_A, μ_I, μ_G), shifted geometric mean; role = the state variable that S's dynamics and the GO rule condition on; regime structure (S0/S1/S2) previewed. | σ_SU = ∛∏(μ+1) − 1 | Etzkowitz & Leydesdorff 2000; Leydesdorff 2003
- **3.4** (150) Institutional ledger: 8 axes (bylaws/IP/GAP/HR/EIR/network/education/track-record; rubric 0-4, SM-D); axioms **E1** separability, **E2** compensability, **E3** missing-visibility (unknown ≠ not-started), **E4** monotonicity — each grounded in TTO practice. | A_k ∈ [0,4] ∪ {⊥} | Sen 1977; Rubin 1976
- **3.5** (170) **Theorem 1** (additive representation): E1-E4 + continuity + Thomsen/double-cancellation ⇒ ERS = 100·Σw_kA_k/(4Σw_k), unique up to affine transform. Proof sketch (conjoint measurement); full proof SM-A. Weighted sum is not a *choice* — it is the only admissible form. | Thm 1 | KLST 1971; Debreu 1960; Wakker 1989
- **3.6** (140) **Proposition 1** (precondition gate): axis 7 (institutional bylaws) enters as gate g(A_7)·F_rem — "44% readiness with zero bylaws is idle capacity"; Alkire-Foster identification-then-aggregation analogy. | ERS = 100·g(A_7)·F_rem | Alkire & Foster 2011
- **3.7** (150) **Theorem 2** (no double counting): any multiplicative cross-combination ERS^α·PRS^(1−α) violates E1 (∂²S/∂A_k∂PRS ≠ 0); admissible couplings are additive shortlists or conditional gates. Bridge: is *any* single score possible? → §4. | Thm 2 | —
- **3.8** (130) Why the shapes differ economically: a venture is a conjunction of necessary conditions; an institution is a portfolio of partially substitutable capabilities. Diagnostic reading: ledger 1 answers "what kills this deal", ledger 2 answers "what should we build next". | — | —
- **3.9** (150) Operationalization & honesty: ordinal rubrics (Stevens scale discipline), unknown-vs-not-started coding, composite/type-name disclosure, calibration constants withheld as calibration procedure (not results). | — | Stevens 1946; Little & Rubin 2019
- **3.10** (150) Fig. 1 walkthrough: two ledgers + σ_SU + GO operator preview; notation table SM-E. | Fig.1 | —

## §4 The impossibility theorem (1,700w, 11 paras)

- **4.1** (150) The temptation formalized: evaluators seek f(P,R,S;A) ∈ ℝ — one number per (project, institution) pair — for screening, allocation, national rankings. State the question honestly: does such an f exist under requirements everyone would accept? | f: ℝ³₊×ℝᴷ₊ → ℝ₊ | —
- **4.2** (160) **Axiom C1** (PRS annihilation): min(P,R,S) = 0 ⇒ f = 0. Justification: venture mortality logic; the founder function's delegation-impossible core (CES ρ<0, min-limit) — one paragraph, no development (monograph pointer). | C1 | Kremer 1993
- **4.3** (150) **Axiom C2** (ERS monotonicity): a better nursery never lowers a project's value, strictly raises it somewhere. Uncontroversial; even composite advocates accept it. | C2 | —
- **4.4** (170) **Axiom C3** (causal-channel restriction): institutions affect value only through R and S dynamics — ∂f/∂A_k = (∂f/∂R)(∂R/∂A_k) + (∂f/∂S)(∂S/∂A_k). The DAG discipline that blocks double counting; empirically disciplined via GMM overidentification (registered; §7). | C3 | Hansen 1982
- **4.5** (140) **Axiom C4** (continuity on the interior): no knife-edge value jumps from marginal rubric moves; technical but substantively mild. | C4 | —
- **4.6** (180) **Theorem 3**: no f satisfying C1-C4 admits f = Φ(g(P,R,S), h(A)) with strictly increasing Φ, g, h. Plain reading: "institution-adjusted project score" — *any* monotone composite of a venture score and an institution score — cannot exist. Not a modeling taste; a theorem. | Thm 3 | —
- **4.7** (170) Proof architecture (full proof SM-B): Arrow's axiom-collapse template rebuilt on conjoint measurement — C1×C3 tension makes the Thomsen/double-cancellation condition constructively fail, blocking Debreu's additive route; monotone re-scalings cannot repair it (KLST Ch 6). | — | Arrow 1963; Debreu 1960; KLST 1971
- **4.8** (150) Three-way collapse (Table 1): pure multiplication PRS·ERS — satisfies C1, violates C3 (double counting); pure addition αPRS+βERS — satisfies C3, violates C1 (dead ventures ranked alive); general monotone composite — fails Thomsen. Every practical composite is one of the three. | Table 1 | —
- **4.9** (170) **Corollary 3.1** (falsifiable signatures): if a field uses single scores anyway, data will show (i) Simpson reversal — institution coefficients flip sign between pooled and PRS-quartile-conditional estimates; (ii) quartile instability; (iii) Hausman rejection of pooled vs conditional estimators. The theorem *predicts the scars of its own violation*. | 系3.1 | Simpson 1951; Hausman 1978
- **4.10** (160) What survives the impossibility: (a) additive shortlisting with *public, explicit* trade-off weights (a decision aid, not a measurement); (b) conditional gating PRS | A_7 ≥ L; (c) full governance separation of the ledgers. Impossibility ⇒ design guidance, not nihilism. | — | —
- **4.11** (150) Kinship and distance: Arrow (preference aggregation), Holmström-Milgrom (multitask distortion), index-number problems — ours is an aggregation impossibility *across observation levels* (project × institution), a domain not previously axiomatized. | — | Holmström & Milgrom 1991; Nelson & Winter 1982 (contrast)
 
## §5 Operating on the two ledgers: the GO operator (1,400w, 9 paras)

- **5.1** (150) From measurement to operation (D-061 framing): the ledgers are the contribution; we now show the system is *actionable* — the go/wait decision emerges as a stopping rule on the measured state, not as a checklist. | — | —
- **5.2** (160) Setup: founder-institution pair chooses stopping time τ: sup_τ E[∫_τ^∞ e^{-rt}(P·R·S − B)dt − I] s.t. financing constraint (B − R_net) ≤ F; σ_SU follows a K=3 regime process; deterministic TRL ramp g_TRL. | 最適停止プリミティブ | Dixit & Pindyck 1994; McDonald & Siegel 1986
- **5.3** (150) Value function on coupled regimes: HJB system; existence/uniqueness via viscosity solutions (statement only; SM-C). | coupled HJB | Crandall, Ishii & Lions 1992
- **5.4** (170) **Theorem 4**: value-matching + smooth-pasting ⇒ unique implicit threshold θ_σ*(P, F, B, Π); GO(t,i) = 𝟙[σ_SU(t) ≥ θ_σ*]·g_TRL(t). The folk checklist becomes a first-order condition; the threshold is *endogenous* to project economics and regime credibility. | Thm 4 | —
- **5.5** (160) **Proposition 2** (comparative statics as policy levers): ∂θ*/∂P < 0 (larger market ⇒ found earlier), ∂θ*/∂B > 0 (burn pressure ⇒ demand more tailwind), ∂θ*/∂F < 0 (GAP/runway ⇒ act on weaker signals), ∂θ*/∂π_kk < 0 (credible regimes lower the bar). Instrument map: subsidy→P, GAP fund→F, cost discipline→B, policy credibility→Π. | Prop 2 | —
- **5.6** (140) g_TRL orthogonal factorization: under conditional independence of macro regime and tech ramp, GO separates multiplicatively — "macro-ready but tech-not" and "tech-ready but macro-not" are *distinct, non-compensable* failure modes (TIEM preview). | GO = 𝟙[σ≥θ*]·g_TRL | —
- **5.7** (130) WAIT as option value: delay is not indecision but a priced option; quantifies the field's folk wisdom of "too early". | — | McGrath 1997
- **5.8** (170) Two-layer coherence: ERS shifts the *dynamics* (R, S drifts and σ_SU-jump exposure) — exactly the C3 channel — so institutional investment lowers effective thresholds *without ever entering a single score*. The operator proves the two-ledger governance is complete: nothing is lost by refusing the composite. | — | —
- **5.9** (120) Scope note (Tier A): σ_SU process estimation/identification deferred to the registered program; this paper calibrates, it does not estimate. | — | —

## §6 Retrospective calibration: eight projects (1,000w, 6 paras)

- **6.1** (170) Design & disclosure: 8 deep-tech projects from one studio's operating records (2007–2026); composite cases, type-named institutions; **retrospective calibration, explicitly not validation**; selection and survivorship caveats stated up front. | — | (disclosure)
- **6.2** (170) Table 2: per project — σ_SU regime at decision point, TRL gate, F state, model reading (GO/WAIT/NO_GO), actual decision, 24-month outcome class. Rubric-level only; calibration constants withheld (procedure described). | Table 2 | —
- **6.3** (170) Vignette 1 — TIEM (zombie type): σ_SU high (macro tailwind flooding) ∧ TRL ≈ 0 ⇒ model reads NO_GO/WAIT; actual early founding ⇒ decade-scale stagnation. Any monotone composite would have let the macro compensate the tech — the Simpson error of Corollary 3.1, live. | — | —
- **6.4** (150) Vignette 2 — YD (instant-fail type): P-bottleneck (unit economics infeasible at physical limits) ⇒ multiplicative annihilation despite a passing TRL gate; a composite ranks YD above TIEM; the ledger separation catches what the composite blurs. | — | —
- **6.5** (170) Cross-case reading (Tier A vocabulary): type-level ERS differences co-move with R,S drift channels as C3 predicts — descriptive posterior summaries under strong priors; no identification claimed. | — | —
- **6.6** (170) Limitations: N=8, single studio, retrospective, composite disclosure; the honest statement of what *would* falsify BZM leads into §7. | — | —

## §7 Policy implications and a research program (700w, 5 paras)

- **7.1** (150) For evaluators: retire institution-adjusted single rankings; run two ledgers with explicit coupling rules — additive shortlists with public weights, or conditional gates (PRS | A_7 ≥ L). | — | —
- **7.2** (140) For institutions: ERS is gap diagnosis, not a beauty contest; axis-7 precondition first ("bylaws before showcases"); build-next guidance from the additive form's decomposability. | — | —
- **7.3** (140) For policy design: instruments move different margins (P vs F vs B vs Π) — Proposition 2 turns instrument choice into comparative statics; timing support (extending WAIT) is a distinct lever from founding pushes. | — | —
- **7.4** (150) The research program — **Before Zero Studies**: registered falsifiers (Corollary 3.1 signatures with Bonferroni-corrected α; Brier threshold on GO discrimination), prospective registry protocol (OSF), pre-committed effect sizes; invitation to replicate on other ecosystems. | — | Popper 1959; Lakatos 1970 (light touch)
- **7.5** (120) Boundary: deep-tech, Japanese university/national-lab origin, pre-founding stage; portability is an empirical question the registry is built to answer. | — | —

## §8 Conclusion (300w, 2 paras)

- **8.1** (150) Recap: a measurement theory for the stage where ventures are decided; two ledgers by mathematical necessity (Theorems 1-3), operated by a derived stopping rule (Theorem 4). | — | —
- **8.2** (150) Before day zero, value is real but unmeasured; BZM makes it measurable — and the impossibility theorem guards the practice from rebuilding the single score. Founding statement of Before Zero Studies. | — | —

---

## S3 起草順 (L1 §7): §4 → §3 → §5 → §6 → §2 → §1 → §7 → §8

## 参考文献マスタ (S3 で確定、~55件想定の核)

Arrow 1951/1963; Debreu 1960; Krantz-Luce-Suppes-Tversky 1971; Luce & Tukey 1964; Wakker 1989; Fishburn 1970; Gorman 1968; Sen 1970/1977; Atkinson 1970; Alkire & Foster 2011; Foster-Greer-Thorbecke 1984; Stevens 1946; Rubin 1976; Little & Rubin 2019; Simpson 1951; Hausman 1978; Hansen 1982; Holmström & Milgrom 1991; Kremer 1993; Cobb & Douglas 1928; Arrow-Chenery-Minhas-Solow 1961; Leontief 1936; Nelson & Winter 1982; Schumpeter 1934; Etzkowitz & Leydesdorff 2000; Leydesdorff 2003; Mankins 1995; Olechowski et al. 2020; EC Horizon SRL; Nardo et al. 2008; Greco et al. 2019; Shane 2004; Perkmann et al. 2013; Grimaldi et al. 2011; Bozeman 2000; Munari et al. 2016; Hayter et al. 2018; Dixit & Pindyck 1994; McDonald & Siegel 1986; McGrath 1997; Bertola 1998; Caballero 1999; Crandall-Ishii-Lions 1992; Popper 1959; Lakatos 1970。*S3 規律: 全引用は実在確認 (書誌 DB 照合) してから本文に入れる。LLM 幻覚引用の混入は S5 で全件再照合。*

## Changelog

| Date | What | By |
|---|---|---|
| 2026-07-03 | S2 初版 (58 paras / 9,100w 本文 + front matter)。タイトル (b) 反映、E/C 公理リネーム、定理番号マップ | えいみ |
