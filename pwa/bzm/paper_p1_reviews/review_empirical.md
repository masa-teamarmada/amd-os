# Referee Report — "The Before Zero Model: measuring deep-tech ventures and their institutional nurseries before day zero"

**Journal:** Research Policy
**Reviewer role:** Empirical innovation scholar (university spin-outs, technology transfer, entrepreneurship; econometrics)
**Materials reviewed:** Main text (§§1–8) and Supplementary Material (SM-A through SM-E)

---

## 1. Summary

The paper proposes a two-layer measurement system for the pre-founding ("Before Zero") stage of university deep-tech ventures: a multiplicative venture ledger PRS = P·R·S, an additive institutional ledger ERS over eight rubric-scored axes (with a bylaws gate, Proposition 1), and a shared Triple-Helix-flavored macro state σ_SU. Four formal results are claimed: uniqueness of the weighted-sum institutional aggregate via additive conjoint measurement (Theorem 1); prohibition of multiplicative cross-layer combination (Theorem 2); an Arrow-style impossibility — no single "institution-adjusted project score" Φ(g(P,R,S), h(A)) satisfies four axioms C1–C4 (Theorem 3), with three pre-registrable statistical signatures of violation (Corollary 3.1); and derivation of the go/wait decision as an optimal-stopping rule with endogenous threshold (Theorem 4, Proposition 2). Section 6 exercises the system on N = 8 composite cases from the authors' own venture studio (2007–2026), labeled "retrospective calibration, not validation." Section 7 announces a pre-registered falsification program ("Before Zero Studies") with an OSF deposit and a Brier-score failure threshold.

The paper's ambition is unusual and, in places, genuinely valuable: the additive-vs-multiplicative "shape" argument is crisp; the explicit refusal to claim validation from retrospective data is more candid than most submissions in this space; and the falsification commitments (a negative criterion under which the single-score benchmark would be *rehabilitated*) are laudable. However, the manuscript in its current form has three load-bearing problems: (i) the empirical section is unverifiable end-to-end (composite cases, author-scored rubrics with outcomes known, withheld calibration constants, no inter-rater evidence, no sampling frame) and contains internal inconsistencies, including a decision category (NO_GO) that the formal model never defines; (ii) the mathematical apparatus oversells — the core impossibility reduces to a boundary-tie argument needing only two of its four axioms, the exclusion of the most common composite (pure multiplication) rests on a lemma the authors themselves flag as gapped, and 21 declared proof gaps are deferred to an uncited, apparently unpublished "companion monograph"; and (iii) the literature review omits several literatures that are not peripheral but directly on-point, including work that supplies prima facie evidence *against* the paper's most contestable axiom (C3).

---

## 2. Verdict

**Major revision** (borderline reject-and-resubmit). The theoretical contribution is potentially publishable in Research Policy as a measurement/framework paper, but only if: the empirical section is rebuilt to verifiability or explicitly demoted; the SM proof gaps are closed within the paper's own four corners; the registry claims are converted from promissory notes into citable, timestamped artifacts; and the COI machinery is formalized. Each of these is a large change; none is impossible.

---

## 3. Major concerns

### MC1. Section 6's evidentiary basis is inadmissible as currently constituted

The section is governed by this disclosure:

> "The cases are *composites*: identifying details are altered and institutions appear as anonymized types, with fidelity maintained on the variables the model reads."

Composite cases are not anonymized data; they are narratives. If details are altered, no cell of Table 2 is a verifiable observation, and "fidelity maintained on the variables the model reads" is an unverifiable self-attestation — made by authors who operate the studio whose portfolio is being scored (see MC9). Three specific demands:

1. **Composites vs. anonymized singletons.** Distinguish explicitly between merging multiple real cases into one narrative (composite) and masking one real case (anonymization). If Project T blends two projects, the g_TRL = 0 reading and the "decade of stagnation" outcome may belong to different underlying ventures, which would void the vignette. At minimum, certify to the editors a one-to-one case mapping, with editor access to un-composited records. I do not demand public institution names — type-level anonymization is acceptable in this field — but I do demand an auditable trail.

2. **Raw rubric data.** The text claims "Scores are reported at rubric level," but Table 2 contains no rubric scores — no A₁–A₈ per host, no P/R/S readings, only regime, gate, and a three-level slack state. The paper's own distinction (§3) is that rubric *levels* are observable states while only the *calibration constants* mapping them to model ranges are proprietary. Then publish the rubric panel: 8 projects × 8 institutional axes plus the venture-side readings, deposited with the registry (embargo acceptable). Without it, the section's verdicts — including the claim that "additive or averaged score ranks Y *above* T" — cannot be checked even ordinally. Relatedly, SM-D operationalizes only the ERS rubric; **there is no operationalization of P, R, or S anywhere in the main text or SM**, although the venture ledger is the paper's flagship object and both vignettes turn on it. This is the single largest documentation gap in the manuscript.

3. **Information-set discipline and hindsight bias.** For Project Y the text says the P → 0 annihilation "matches the eventual assessment after real resources had been spent discovering it." If the unit-economics arithmetic became available only after resources were spent, then the model's retrospective NO_GO uses information not available at the decision point, and the calibration is circular. For each case, the authors must certify what was knowable at the decision date, and rubric scoring should be re-performed by independent raters blind to outcomes wherever feasible, with inter-rater reliability reported (Cohen's κ or Krippendorff's α). Outcome-aware scoring by the model's authors is a textbook hindsight-bias design (Fischhoff, 1975).

4. **Sampling frame and the empty discordant cells.** State the denominator: eight projects out of how many screened/decided by the studio over 2007–2026? If the eight are a selection, the selection rule matters more than the eight. Further, the implicit 2×2 concordance table has **no discordant cells**: every model-NO_GO case has a bad outcome, every model-GO case is progressing. Note also that the studio-involved decisions (R, L, M, N) all read GO — unsurprising, since the model formalizes the studio's own decision process, making agreement on those cases nearly definitional. The informative cases are only the externally decided ones (T, Y, K, and the unreadable Q); of the five cases with complete outcomes, only four have model readings at all. The paper should state plainly that the effective retrodiction sample is four externally decided cases scored with outcomes known. As written, the section will be read — despite the disclaimers — as 7-for-7 concordance.

### MC2. Table 2 is internally inconsistent, and the GO/WAIT/NO_GO trichotomy is not an object of the theory

Section 5 derives a **binary** threshold rule: GO(t,i) = 𝟙[σ_SU ≥ θ*σ]·g_TRL, i.e., enter or wait. Section 6 then reports a **trichotomy** "GO / WAIT / NO_GO" that is never defined. Specific inconsistencies:

- **Project T** is tabled as "NO_GO (gate)" while the vignette itself concedes: "The model reads NO_GO — more precisely, WAIT on the technology axis." These are different actions with different policy content (WAIT preserves and prices the option; NO_GO kills). Under the paper's own Lemma C.2, a closed gate means all admissible stopping is deferred to t_g — that is WAIT, not NO_GO. The same applies to Project K.
- **Project Y** reads "NO_GO (P → 0)" with g_TRL = 1. The narrative logic (PRS annihilation ⇒ never found, at any σ) is coherent *as a ledger statement*, but it is not delivered by the formal apparatus: P is not an argument of the GO indicator except through θ*(P), and Theorem 4 is proved only for **interior primitives** (assumption A5: "P, B, F interior to the positive orthant"; threshold "strictly interior for interior primitives"). P → 0 is exactly the excluded boundary. If NO_GO is meant as "the entry region is empty" (G − I < 0 for all σ), define it as such and prove it as a corollary; at present the paper's flagship empirical verdict is generated off-theorem. There is also a construct-validity problem: "unit-economics arithmetic drives [P] to zero at physically attainable performance" sounds like a *technology* limitation (R, or the gate) as much as zero *potential scale conditional on full realization*. The P/R boundary is doing unacknowledged work; without a P rubric (MC1.2) the reader cannot adjudicate.
- **The phantom bottom panel.** §6 states: "Across the eight cases read together (Table 2, bottom panel)…" — Table 2 as drafted has no bottom panel. Similarly, "Project Q is retained for the survival panel only" — no survival panel exists.
- **Dangling organizer.** "Two agreements and one instructive tension organize the reading" — the two agreements are presumably T and Y, but the "instructive tension" is never identified anywhere in the section.
- **Column header vs. contents.** The "24-mo outcome" column contains a 15-month censored entry (L) and two rows whose decision points are scheduled for 2026/2027 (M, N) — i.e., three of eight rows cannot have a 24-month outcome class by construction. Y (decided 2025) can only be "complete" via early absorption (termination); state the terminal-state convention. Also reconcile the T vignette's "all warming *toward* the aligned regime" with Table 2's assignment of S₂ (aligned) at T's decision point.

None of these is fatal individually; jointly they signal that the empirical section was written faster than it was checked, which is corrosive in a paper whose selling point is measurement discipline.

### MC3. The "cross-case reading" paragraph oversteps its own Tier discipline

> "…projects hosted at higher-ERS types show faster realization drift and better survival trajectories *conditional on* their venture states, while ERS shows no residual association with outcomes once those trajectories are conditioned on — the qualitative fingerprint C3 predicts. We state this as a descriptive posterior summary under strong priors and small N…"

This sentence asserts a **conditional-independence finding** — precisely the empirical content of axiom C3 — from at most five resolved outcomes scored retrospectively by the axiom's authors. "Descriptive posterior summary under strong priors" is faux-Bayesian varnish: no prior, likelihood, model, or posterior is reported anywhere, and with N = 8 (four usable retrodictions, MC1.4) no conditioning exercise of this kind is possible. The disclaimer does not neutralize the assertion; readers will cite this paragraph as evidence for C3. Either report the actual (toy) model and its output, or — my recommendation — delete the paragraph and state that the panel is too small to exhibit or contradict the C3 fingerprint. As written it does exactly what the paper's Tier vocabulary promises not to do.

### MC4. The theorems oversell relative to what is actually proved, and 21 declared gaps are deferred to an uncited monograph

I credit the authors' candor: the SM flags its own holes with `[GAP:…]` markers (21 by the authors' count). But a Research Policy paper whose contribution is theorems must be self-contained; "the monograph's appendix" is not a citable object (it appears nowhere in the reference list, and its publication status is never stated). Specific instances:

1. **Theorem 3's real content is thinner than its framing.** The SM-B.4 proof is clean and, as the authors themselves note, "only strict monotonicity of Φ in its *second* argument was invoked." Inspect it: the collision is C1 (boundary rows are ties at zero) against C2 (an interior row is strict) — C3 and C4 do essentially no work in the main proof beyond populating the axiom class and licensing the conjoint framing. That is a genuine and useful observation, but it is a two-line boundary-tie argument; the sixty-years-of-Arrow/KLST scaffolding, and claims like "the first impossibility for aggregation across *observation levels*," dress it above its weight class.
2. **Pure multiplication — the composite the introduction's committee actually uses — is not covered by Theorem 3.** Φ(u,v) = u·v is only *weakly* increasing in v at u = 0, so it lies outside the strict-Φ class. Its exclusion rests on (a) Theorem 2, which works by imposing the *institutional-ledger* axiom E1 on the cross-layer composite — a normative premise (why must a ranking score be axis-auditable? that is a governance requirement, not a measurement necessity; state and defend it), and (b) Lemma SM-B.3, whose own GAP note concedes: "the premise that the transmitted side is free of P is underspecified in the skeleton — it requires ∂²g/∂P∂R = ∂²g/∂P∂S = 0, which fails for the flagship g = PRS… The exclusion of pure multiplication therefore rests on the universal-domain reading of C3… The skeleton uses this reading implicitly but does not state it." In other words, the headline "no single score exists" aggregates one solid-but-shallow result and one gap-flagged result. The revision must state the universal-domain reading of C3 as an explicit axiom clause and complete the lemma, or the abstract's claim must be weakened.
3. **Theorem 1's "uniqueness" is bought with an unadvertised cardinality assumption.** Step 2 of SM-A linearizes via E2-s, "a property of the numerals the rubric assigns — the equal-interval design." So the *weighted sum in rubric numerals* is unique only given a rubric designed to be equal-interval — a cardinal assumption about a 0–4 ordinal scale. This sits in direct tension with the main text's own scolding that "nothing prevents practitioners from averaging ordinal levels as if they were cardinal" (§2) and its invocation of Stevens (1946). The honest statement is: conjoint axioms deliver additivity in *some* increasing transforms φ_k; linearity in the levels is a design convention. Additionally, Step 4 concedes a further hole: "[GAP: this cross-K coherence condition is used implicitly… it is not stated there as a separate axiom]" — the single weight vector across observed sets is assumed, not derived. The main text's rhetoric ("the weighted sum is not one convenient formula among many… it is the only admissible form") outruns the mathematics by exactly these two steps.
4. **Theorem 4 / Proposition 2** defer comparison-principle verification, Jacobian non-singularity, smooth-pasting regularity, the regime-ordering coupling argument, and the persistence-perturbation scheme to the monograph (12 GAPs in SM-C alone). For an RP audience the stopping section could survive at "architecture + citation to standard results" level *if* the claims were correspondingly labeled; "proof in SM-C" is currently an over-claim.
5. **σ_SU is unaxiomatized.** The paper axiomatizes two of its three aggregates with great ceremony, then introduces the third — the only state variable the GO operator actually monitors — as a one-sentence shifted geometric mean. Why geometric (joint alignment) rather than min (bottleneck) or weighted sum? The entire comparative-statics edifice conditions on this construction. At minimum, give the same axiomatic or at least robustness treatment (does Table 2's regime assignment survive plausible alternative aggregators?).

### MC5. C3 is the load-bearing axiom, and the existing empirical literature already gives reasons to doubt it — none of which is engaged

The paper correctly identifies C3 as "the most contestable premise, since a direct institutional channel (brand, signaling) would break it" (SM-B.7). But it treats the possibility as hypothetical. It is not. A substantial empirical literature documents *direct* affiliation/endorsement effects on venture outcomes conditional on quality: interorganizational endorsements (Stuart, Hoang and Hybels, 1999, ASQ), reputation premia entrepreneurs pay for affiliation (Hsu, 2004, JF), and certification effects of public grants on subsequent VC funding (Islam, Fremeth and Marcus, 2018, JBV; Howell, 2017, AER). If elite-host affiliation moves investor behavior at a fixed venture state, C3 fails and Theorem 3's impossibility evaporates — the paper's central result is then conditional on an axiom the field has quasi-evidence against. This must be confronted in §4, not discovered by referees.

Worse, the *ordinal* version of C3 risks unfalsifiability by relabeling: any direct value effect can be re-attributed to the survival channel ("endorsements raise S via resource access"), since S is itself a latent construct scored by the authors. The GMM test of SM-B.7 needs an observable that distinguishes "direct channel" from "unmodeled S channel"; none is offered. And the proposed instruments — "policy shifts to funding or staffing rules used as natural experiments" — plausibly violate exclusion *within the authors' own model*: policy shifts move μ_G, hence σ_SU, hence outcomes directly, not only through institutional axes. The revision should (a) name candidate instruments concretely (the 2004 incorporation of Japanese national universities and the associated IP-ownership shift is the obvious in-context shock; Norway's professor's-privilege abolition — Hvide and Jones, 2018 — is the obvious out-of-context one), and (b) show the exclusion restriction is coherent with σ_SU's construction.

### MC6. Corollary 3.1's signatures are not runnable as described

I asked myself whether I could take this section to data tomorrow. I could not, for six reasons:

1. **Outcome scale unstated.** The registry outcome is a 3-class ordinal (progressing/stagnant/terminated). Signatures (i)–(iii) are written as linear-regression sign and coefficient-equality statements. With ordered logit/probit, comparing coefficients across PRS-quartile strata runs into the residual-variance identification problem (Mood, 2010); sign reversals across strata can be generated by distributional artifacts alone. Specify the estimator and the cross-stratum comparison method.
2. **The conditioning variable is proprietary.** PRS-quartiles require PRS, whose scoring rubric is unpublished (MC1.2) and whose calibration constants are withheld. Third parties cannot construct the stratifier; the "field" cannot run the field's test. Also: quartiling on an estimated, error-laden index attenuates within-stratum slopes toward zero — which *mimics* the predicted bottom-quartile null. The pre-registration must include a measurement-error / generated-regressor strategy.
3. **Signatures (ii) and (iii) are near-duplicates** (quartile-varying coefficients tested twice), and the Hausman statistic as displayed is wrong: the χ² degrees of freedom should be the number of restrictions, not dim θ, and the variance-difference form requires the restricted estimator to be efficient under the null — with clustered/robust errors the difference need not be positive semi-definite. A cluster-robust Wald test on ERS×PRS interactions (or a bootstrapped Hausman) is the defensible version.
4. **Signature (i)'s existence is deferred**: "[GAP: the skeleton asserts that reversal-generating composition weights exist within the axiom class but defers the explicit construction… to the monograph's Ch 11 BVAR machinery]." A pre-registered prediction whose generating construction is unpublished is not pre-registered in any meaningful sense. Also, the detection rule mixes standards (posterior probability > 0.95 for (i); frequentist Bonferroni α = 0.05/3 for the family; p < 0.10 for the J test) — harmonize.
5. **The premise conflates the evaluator's scoring rule with the outcome DGP.** "A field that ranks by single scores anyway will leave *statistical scars*" — the scars as formalized are properties of the *outcome-generating process* (non-separability of ERS×PRS in outcomes), not of the committee's ranking behavior. The mapping from "committees rank by Φ(g,h)" to "outcome regressions show quartile-stable ERS coefficients" requires the score to be the conditional expectation of outcomes — an auxiliary assumption never stated. Moreover, quartile-varying institution coefficients can arise from garden-variety complementarity (strong TTOs help good projects more) without any C1–C4 structure; the corollary needs to state which *patterns* of instability are distinctive (the near-zero bottom-quartile slope is the candidate) and which merely reject additivity.
6. **Descriptive premise undocumented, and knockout-gated practice escapes the excluded class.** The claim "Every institution-adjusted score we have encountered in evaluation practice is one of these three" is anecdote. Actual instruments commonly use eligibility knockouts followed by compensatory scoring — a discontinuous rule outside Theorem 3's (continuous, strictly monotone) excluded class, and close to the paper's own recommended "liveness guard + additive aid." If sophisticated practice already gates, the predicted scars may not exist in field data *for that reason* — a null result would then be uninformative about the theorem. The registered program must therefore include an audit of named scoring instruments (e.g., EU EIC evaluation, national gap-fund scoring sheets, JST program rubrics) documenting which are strictly-monotone composites. Absent that, both rejection and non-rejection of the signatures are unattributable. No power analysis, no minimum detectable effect, and no named data source is given for any of the three tests; add all three.

What would *falsify* rather than merely fail to support: a J-test rejection (direct channel exists → C3 false → the impossibility's premise void — the paper says this honestly); quartile-stable, positive ERS coefficients with tight equivalence bounds in a large pooled sample scored by strictly-monotone composite instruments. The "negative criterion" should be restated with equivalence-testing logic (TOST-style bounds): at small N, "all tests fail to reject" is the default outcome of an underpowered design, and the current wording rewards underpower.

### MC7. The Section 7 registry is presently vaporware — and fixable

> "Protocols, rubrics, and outcome definitions are deposited on the Open Science Framework; the registry opens with the studio pipeline described in Section 6…"

Present tense, but no DOI, registration number, or timestamp is given, and the SM says rubric anchor sheets "are maintained in the study's operating protocol" — i.e., not deposited. Either cite the deposit (anonymized-view DOI for review) or rewrite in future tense and stop claiming "registered rather than promised." Four changes would make the registry bite:

1. **Deposit before resubmission**, and file the M and N readings (decision points 2026/2027) as timestamped predictions *now*. These two pending cases are the cheapest possible conversion of rhetoric into risk; a paper that truly believes its falsification posture will do this without being asked.
2. **A Brier threshold needs a comparator.** A raw Brier floor is uninterpretable without the base rate of the 3-class outcome; commit to a Brier *skill* score against (a) the climatological base rate and (b) a pre-specified naive benchmark (e.g., "GO iff TRL ≥ x and any committed funding"), plus a verdict rule: after how many resolved cases, with what CI handling, is failure declared? A studio pipeline yields a handful of decisions per year; without a stopping rule the threshold can be outrun indefinitely. (Terminology: Brier is a calibration-plus-refinement score, not a "discrimination floor"; if discrimination is meant, that is AUC/resolution.)
3. **Independent outcome adjudication.** "Progressing / stagnant / terminated" is judgment-laden at the boundary (T is "stagnant (zombie)"; K "stagnant (deep pivot)" — a pivot could equally be coded progressing). Outcomes must be classified by a party other than the forecaster, under deposited operational definitions.
4. **Performativity firewall.** The studio both issues the GO forecast and then *treats* the venture (capital, EIR placement, program access). Forecasts partially cause outcomes; a well-calibrated registry could reflect the studio's operational skill rather than the measurement system's validity. Either include cases the model reads but the studio does not treat (external ecosystems, as promised), or state explicitly that the prospective test evaluates the model+studio bundle.

### MC8. The literature platform (Section 2) omits directly relevant strands, and one novelty claim is overstated

The five-literature synthesis is well written but incomplete in ways that matter for the paper's claims:

1. **University spin-out process research.** The claim that the pre-founding stage "has no measurement theory" must be squared with the staged/process literature that has described and phased exactly this interval for twenty years: Vohora, Wright and Lockett (2004, Research Policy) on critical junctures; Clarysse et al. (2005, JBV) on incubation strategies; Rasmussen and Borch (2010, Research Policy) on university capabilities; Mustar et al. (2006, Research Policy) on spin-off taxonomies. None appears. These works do not offer an aggregation theory — the paper's gap survives — but a Research Policy submission cannot theorize the pre-founding stage without engaging them.
2. **TTO efficiency and institutional-determinants econometrics.** The institutional ledger has a directly relevant empirical predecessor literature measuring institution-level capability and relating it to spin-out output: Siegel, Waldman and Link (2003, Research Policy); Chapple et al. (2005, Research Policy); Lockett and Wright (2005, Research Policy); Di Gregorio and Shane (2003, Research Policy); O'Shea et al. (2005, Research Policy); Shane and Stuart (2002, Management Science) — the last being the canonical "organizational endowments → start-up performance" design the C3 tests will inevitably be compared to. Axis 7's gate has an empirical literature too: Kenney and Patton (2011, Research Policy) on inventor ownership; Hvide and Jones (2018, AER); Lach and Schankerman (2008, RAND) on royalty incentives.
3. **Entrepreneurial ecosystems and system-level measurement.** The macro layer is an ecosystem construct in all but name: Acs, Autio and Szerb (2014, Research Policy), Stam (2015), Spigel (2017), Autio et al. (2014, Research Policy). Acs et al. is especially pointed because the GEI's "penalty for bottleneck" methodology aggregates *system* components with weakest-link penalization — the exact opposite of the paper's claim that the institutional/system object is additively compensable. The paper may be right; it cannot ignore the disagreement.
4. **Venture quality measurement and prediction.** Guzman and Stern (2020, AEJ: Economic Policy) estimate entrepreneurial quality at founding from observables at scale — the closest existing empirical program to "measuring P before outcomes," and an obvious benchmark for the registry.
5. **VC decision research and conjunctive screening.** The paper's central behavioral claim — ventures are conjunctions, so evaluators should not average — is a live topic in the screening literature: Gompers, Gornall, Kaplan and Strebulaev (2020, JFE); Kaplan and Strömberg (2004, JF); Tyebjee and Bruno (1984, Management Science); Zacharakis and Meyer (1998, JBV); Bernstein, Korteweg and Laws (2017, JF) on which attributes move early-stage investors. Compensatory-vs-noncompensatory decision rules are precisely Table 1's subject; the omission is conspicuous.
6. **Real options in entrepreneurship, macro timing, and the Japanese context.** McGrath (1999, AMR); O'Brien, Folta and Johnson (2003, MDE); Dixit (1989, JPE); Nanda and Rhodes-Kropf (2013, JFE) on hot markets changing what gets funded — directly relevant to σ_SU's decision role. Given the empirical setting is exclusively Japan, the absence of any Japan-specific scholarship (Motohashi, 2005, Research Policy; Kneller, 2007) is untenable, and the "zombie" vignette should engage Caballero, Hoshi and Kashyap (2008, AER), whose subsidy-sustained-zombie mechanism is the same one the T vignette narrates.

Finally, the claim "the merger itself has, to our knowledge, never been theorized" (§2) is stated too strongly given the composite-indicator literature's treatment of hierarchical/multi-level index construction (the Nardo et al. handbook the authors themselves cite discusses aggregation across levels of a hierarchy); the defensible claim is that an *axiomatic impossibility* for venture×institution aggregation is new. Say that instead.

### MC9. Conflict of interest: disclosure is partial, guardrails are absent

The authors run the studio whose cases they score, whose pipeline seeds the registry, and whose "operating data" justifies withholding calibration constants (PF-010). The draft contains **no formal COI statement, no funding disclosure, and no data-availability statement**. Required at minimum:

1. A COI section declaring the authors' economic interest in the studio and in adoption of BZM/ERS by policy or institutional clients (does the studio sell readiness assessments? does BZM adoption steer deal flow to the studio?).
2. A data-availability statement specifying exactly what editors, referees, and future replicators can access: un-composited case records (editor-only), rubric-level panel (deposited, embargo acceptable), calibration constants (escrowed with the registry with named third-party auditor access — "checkable without public disclosure" currently names no checker).
3. Independent scoring with reported IRR (MC1.3) and third-party governance of the registry (the studio cannot be registrar, forecaster, treater, and adjudicator simultaneously; see MC7.3–7.4).
4. Consent/ethics: projects T, Y, K, Q were decided "outside (or prior to) the studio's involvement" — were those founders and institutions consented to being scored and published, even as composites?

I want to be clear that the COI is manageable — practitioner-scholars publishing on their own operations is a respectable tradition — but the current draft handles it by adjectives ("honest labels") rather than mechanisms.

---

## 4. Minor issues

1. **Undefined internal jargon.** "Tier-A vocabulary," "Tier discipline," "Tier-B tasks" are used repeatedly (§§3, 5, 6) but never defined in the paper; they appear to be conventions of the authors' program. Define in §3 or remove. Similarly "PF-010" (SM-C.5) is an internal policy code meaningless to readers.
2. **The companion monograph** is invoked at least six times for load-bearing content (founder-function microfoundation of C1, σ_SU–T_AIG crosswalk, BVAR detection machinery, estimation layer) but never cited, and its status (published? in progress?) is never stated.
3. **Reference-list hygiene.** Works cited in the SM but absent from the reference list: Gorman (1968), Fishburn (1970), Bertola (1998), Caballero (1999) — the SM-C footnote even asserts "full entries in the paper's reference list" for the latter two. Perkmann et al. (2013) uses "et al." in the reference list itself.
4. **SM-A numbering slips**: "Axis numbering follows Section 2" and "the equal-interval design of the Section 2 rubric" — the axes and rubric are defined in §3 and SM-D respectively.
5. **Sen (1977) gloss.** "On weights and measures" concerns informational constraints on welfare judgments; the "an index buries trade-offs that deliberation should surface" reading is a stretch of that particular paper (it fits Sen's later composite-index skepticism better). Adjust attribution.
6. **TRL origin.** Mankins (1995) is the white paper; the scale's published origin is Sadin and colleagues (NASA, late 1980s). "Born as a NASA communication protocol" is fine; the citation could acknowledge the earlier lineage, and Héder (2017) documents the EU diffusion story told in §2's first paragraph.
7. **Uncited empirical claims in §1**: "typically five to fifteen [years]" pre-founding; "By day zero, much of a deep-tech venture's fate is already committed." Both are measurable claims; cite or soften.
8. **"Every member of that committee would separately endorse" (C1–C4).** C3 would *not* be endorsed by a practitioner who believes host brand certifies quality to investors — that is precisely the direct channel. The introduction's rhetorical frame overstates axiom innocuousness; §4's own admission that C3 is "the most contestable premise" contradicts it.
9. **"The Simpson error of Corollary 3.1 committed in a single decision" (§6, T vignette).** A Simpson reversal is a property of aggregated data, not of one decision; the sentence is rhetorically effective and statistically incoherent.
10. **g_TRL determinism vs. the paper's own institutional channel.** The gate is "deterministic… a function of time only" (SM-C.4), yet §5 argues higher ERS "shifts the drift of R (faster realization…)". If institutions accelerate maturation, gate-opening time is institution-dependent and the TRL-orthogonality assumption behind Lemma C.2 is in tension with the C3 narrative. Acknowledge and reconcile (e.g., condition the ramp on ERS at calibration).
11. **Project R's decision point ("mid-2010s")** is vaguer than all other rows — an artifact of composite blurring that illustrates MC1's verifiability problem.
12. **L's outcome cell** ("progressing (censored, 15 mo)") sits under a "24-mo outcome" header; relabel the column "outcome class (24-mo horizon; censoring noted)".
13. **Footnote 1's composite committee vignette** is acceptable with disclosure, but say whether the "institution-adjusted project score" instrument described is documentary (an actual scoring sheet the authors can deposit) or stylized; MC6.6 needs the former.
14. **Abstract** claims "A retrospective calibration on eight deep-tech projects (2007–2026) illustrates the system" — fine — but also "we derive falsifiable statistical signatures of the error committed by 'institution-adjusted' composite rankings," which presumes the field commits it (MC6.6).
15. **Tone.** "Which is, we believe, the first such marriage in this domain"; "everything in it is constructed so that its central claims can be wrong in public"; "Either outcome is the founding transaction of Before Zero Studies." Research Policy tolerates program-building rhetoric, but the density of self-description should be halved; the Popper/Lakatos citations decorate rather than do work.
16. **Mixed decision-theoretic language**: §5 prices WAIT as an option, §6 issues NO_GO verdicts, §7 recommends "extending a viable project's WAIT" — after MC2's fix, sweep the paper for consistent use of the trichotomy.

---

## 5. Specific missing references

Organized by the concern they serve. All are works I am certain exist.

**University spin-out process and institutional determinants (MC8.1, MC8.2)**
- Vohora, A., Wright, M., Lockett, A., 2004. Critical junctures in the development of university high-tech spinout companies. Research Policy 33(1).
- Clarysse, B., Wright, M., Lockett, A., Van de Velde, E., Vohora, A., 2005. Spinning out new ventures: a typology of incubation strategies from European research institutions. Journal of Business Venturing 20(2).
- Rasmussen, E., Borch, O.J., 2010. University capabilities in facilitating entrepreneurship: a longitudinal study of spin-off ventures at mid-range universities. Research Policy 39(5).
- Mustar, P., Renault, M., Colombo, M.G., Piva, E., Fontes, M., Lockett, A., Wright, M., Clarysse, B., Moray, N., 2006. Conceptualising the heterogeneity of research-based spin-offs: a multi-dimensional taxonomy. Research Policy 35(2).
- Di Gregorio, D., Shane, S., 2003. Why do some universities generate more start-ups than others? Research Policy 32(2).
- Lockett, A., Wright, M., 2005. Resources, capabilities, risk capital and the creation of university spin-out companies. Research Policy 34(7).
- O'Shea, R.P., Allen, T.J., Chevalier, A., Roche, F., 2005. Entrepreneurial orientation, technology transfer and spinoff performance of U.S. universities. Research Policy 34(7).
- Shane, S., Stuart, T., 2002. Organizational endowments and the performance of university start-ups. Management Science 48(1).

**TTO efficiency econometrics (MC8.2)**
- Siegel, D.S., Waldman, D., Link, A., 2003. Assessing the impact of organizational practices on the relative productivity of university technology transfer offices: an exploratory study. Research Policy 32(1).
- Chapple, W., Lockett, A., Siegel, D., Wright, M., 2005. Assessing the relative performance of U.K. university technology transfer offices: parametric and non-parametric evidence. Research Policy 34(3).

**Bylaws/ownership regimes — axis 7 and candidate C3 instruments (MC5, MC8.2)**
- Kenney, M., Patton, D., 2011. Does inventor ownership encourage university research-derived entrepreneurship? A six university comparison. Research Policy 40(8).
- Hvide, H.K., Jones, B.F., 2018. University innovation and the professor's privilege. American Economic Review 108(7).
- Lach, S., Schankerman, M., 2008. Incentives and invention in universities. RAND Journal of Economics 39(2).

**Direct-channel (signaling/certification) evidence bearing on C3 (MC5)**
- Stuart, T.E., Hoang, H., Hybels, R.C., 1999. Interorganizational endorsements and the performance of entrepreneurial ventures. Administrative Science Quarterly 44(2).
- Hsu, D.H., 2004. What do entrepreneurs pay for venture capital affiliation? Journal of Finance 59(4).
- Howell, S.T., 2017. Financing innovation: evidence from R&D grants. American Economic Review 107(4).
- Islam, M., Fremeth, A., Marcus, A., 2018. Signaling by early stage startups: US government research grants and venture capital funding. Journal of Business Venturing 33(1).

**Ecosystems and system-level measurement (MC8.3)**
- Acs, Z.J., Autio, E., Szerb, L., 2014. National systems of entrepreneurship: measurement issues and policy implications. Research Policy 43(3).
- Autio, E., Kenney, M., Mustar, P., Siegel, D., Wright, M., 2014. Entrepreneurial innovation: the importance of context. Research Policy 43(7).
- Stam, E., 2015. Entrepreneurial ecosystems and regional policy: a sympathetic critique. European Planning Studies 23(9).
- Spigel, B., 2017. The relational organization of entrepreneurial ecosystems. Entrepreneurship Theory and Practice 41(1).

**Venture quality measurement / prediction (MC8.4, MC7)**
- Guzman, J., Stern, S., 2020. The state of American entrepreneurship: new estimates of the quantity and quality of entrepreneurship for 32 US states, 1988–2014. American Economic Journal: Economic Policy 12(4).

**VC/evaluator decision research — compensatory vs. conjunctive screening (MC6.6, MC8.5)**
- Tyebjee, T.T., Bruno, A.V., 1984. A model of venture capitalist investment activity. Management Science 30(9).
- Zacharakis, A.L., Meyer, G.D., 1998. A lack of insight: do venture capitalists really understand their own decision process? Journal of Business Venturing 13(1).
- Kaplan, S.N., Strömberg, P., 2004. Characteristics, contracts, and actions: evidence from venture capitalist analyses. Journal of Finance 59(5).
- Gompers, P.A., Gornall, W., Kaplan, S.N., Strebulaev, I.A., 2020. How do venture capitalists make decisions? Journal of Financial Economics 135(1).
- Bernstein, S., Korteweg, A., Laws, K., 2017. Attracting early-stage investors: evidence from a randomized field experiment. Journal of Finance 72(2).

**Real options in entrepreneurship and macro timing (MC8.6)**
- Dixit, A., 1989. Entry and exit decisions under uncertainty. Journal of Political Economy 97(3).
- McGrath, R.G., 1999. Falling forward: real options reasoning and entrepreneurial failure. Academy of Management Review 24(1).
- O'Brien, J.P., Folta, T.B., Johnson, D.R., 2003. A real options perspective on entrepreneurial entry in the face of uncertainty. Managerial and Decision Economics 24(8).
- Nanda, R., Rhodes-Kropf, M., 2013. Investment cycles and startup innovation. Journal of Financial Economics 110(2).

**Entrepreneurial method / experimentation (boundary condition for the stopping model; registry design)**
- Sarasvathy, S.D., 2001. Causation and effectuation: toward a theoretical shift from economic inevitability to entrepreneurial contingency. Academy of Management Review 26(2).
- Camuffo, A., Cordova, A., Gambardella, A., Spina, C., 2020. A scientific approach to entrepreneurial decision making: evidence from a randomized control trial. Management Science 66(2).
- Hallen, B.L., Cohen, S.L., Bingham, C.B., 2020. Do accelerators work? If so, how? Organization Science 31(2).

**Japanese context and the zombie mechanism (MC8.6, T vignette)**
- Motohashi, K., 2005. University–industry collaborations in Japan: the role of new technology-based firms in transforming the National Innovation System. Research Policy 34(5).
- Kneller, R., 2007. Bridging Islands: Venture Companies and the Future of Japanese and American Industry. Oxford University Press.
- Caballero, R.J., Hoshi, T., Kashyap, A.K., 2008. Zombie lending and depressed restructuring in Japan. American Economic Review 98(5).

**Methodology (MC1.3, MC6.1)**
- Fischhoff, B., 1975. Hindsight ≠ foresight: the effect of outcome knowledge on judgment under uncertainty. Journal of Experimental Psychology: Human Perception and Performance 1(3).
- Cohen, J., 1960. A coefficient of agreement for nominal scales. Educational and Psychological Measurement 20(1).
- Mood, C., 2010. Logistic regression: why we cannot do what we think we can do, and what we can do about it. European Sociological Review 26(1).
- Eisenhardt, K.M., 1989. Building theories from case study research. Academy of Management Review 14(4).
- Héder, M., 2017. From NASA to EU: the evolution of the TRL scale in Public Sector Innovation. The Innovation Journal 22(2).

---

*End of report.*
