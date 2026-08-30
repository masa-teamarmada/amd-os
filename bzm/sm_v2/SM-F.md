## SM-F. Calibration plan, identification constraints, and the falsification-condition registry

This supplement gives, in full, three things the main text states only in summary: the calibration
plan behind §6.6's claim that "every coefficient carries a grade... and a calibration plan with
explicit identification constraints"; the three identification constraints §6.6 names as binding
hardest; and the five-condition falsification registry §8.4 commits to depositing. It also reports
where the main text's own cross-references to that registry do not, on inspection, line up with the
registry's five conditions. It does not repeat the coefficient-by-coefficient provenance-grade table,
the sixteen declared approximations, or the elasticity and reporting-band tables — those are SM-C's.

**Version.** The calibration plan (F.1) and the identification constraints (F.2) are read from the
source of record, `model/MODEL_VERSION_LEDGER.md` §5.9 and §6.I (consulted read-only; nothing there
was modified in preparing this supplement). The calibration break reported in F.3 is likewise from
the source of record, cross-checked against the main text's own disclosure of it (§7.5). The five
falsification conditions in F.4 restate, in full, the form these conditions held in the working draft
immediately before the length trim of 29 August 2026 (v4.0), which compressed this passage of §8.4 to
a cross-reference for word count while preserving its claims; no revision since that trim has altered
them. Numbers not otherwise dated are at the frozen model version, main commit `a149fc30` (approvals
#2026-08-29-1, -2, -3, plus the input re-placement of 29 August 2026).

---

### F.1 The calibration plan

Every coefficient in the reference implementation is a pre-calibration initial value (SM-C tabulates
the provenance grade — direct evidence, derived from institutional design, or provisional — for each
one). The source of record's §6.I-12 sets out, coefficient family by coefficient family, what data
would calibrate it, how much of that data is required before the initial value may move at all, and
what stands in the way of identifying it even once that data exists. Table F-1 restates that plan in
full.

**Table F-1. The calibration plan.**

| Coefficient family | What it governs | Data source | Independent events required | Identification constraint | Priority |
|---|---|---|---|---|---|
| Window-arrival rate and baseline award rate ($\nu^{\mathrm{win}}$, $\phi_{\mathrm{base}}$) | How often a funding opportunity appears, and how often an application to it succeeds | Application, award and **rejection** records | 150 applications | Enters observation only as a product of the two rates; splitting them needs application counts and award outcomes as separate observations. Until rejections accumulate, restricted to a hierarchical model over public statistics | Top |
| Gate-speed common multiplier ($\mathrm{scale}$ on $M_g$) and conversion capacity ($c$) | How fast a project clears its next gate, and how much of that speed is the project's own | Gate-passage dates, progress reports | 100 gate passages | $c$'s population median is fixed at 1.0 as an identification convention, not an estimate. $\mathrm{scale}$, the gate-distance coefficients, and $c$ cannot be told apart from one another given only gate-passage timing, so are estimated jointly around that fixed point, with a shrinkage prior on the type-level multiplier | Top |
| Burn rate ($\mu$) | Monthly cash consumption | Monthly profit-and-loss records, headcount/structure changes | 6 months per project | The spend boundary (what counts) and the free/restricted allocation rule must be fixed before fitting | Top |
| Counterfactual schedule and share parameter ($\alpha_u$, $\phi_u$) | What a competitor would have realized anyway; how much of an application's value the project system captures | Industry statistics, competitor inventories | — | $\alpha_u$ describes a world that does not occur and is unobservable **in principle**. It is bounded per project from a competitor audit and reported through sensitivity, not fitted | Excluded from calibration |
| Vacancy-delay coefficients ($d_{f,g}$) | How much a vacant carrier function slows gate advancement | Vacancy/fill transition dates, gate-passage dates | 130 transitions | Joint estimation as a proportional-hazards model with project-level random effects and time-varying covariates; collapsed to two parameters until the count is reached. $d_{2,g}$ (the technical core) is excluded from estimation by the convention that function 2 is never marked vacant | High |
| Licence-offer arrival rate and post-transfer completion probability ($\nu_k$, $q_{\mathrm{lic}}$) | How often a licensing offer arrives, and how often the licensee then completes the remaining market gates | Offer records, the national survey of industry–academia collaboration activity, tracked post-transfer outcomes | 100 arrivals; 20 tracked post-transfer | — | High — in regulated (pharmaceutical-type) cells almost all realized value runs through licensing and acquisition rather than own production (source of record §6.I-11-3), so these two coefficients carry unusual weight there |
| Hazard rates ($\lambda$: competitor preemption, demand disappearance, obsolescence) | How often a project's opportunity disappears from an outside cause | Competitor filings and entries, project-stop records | 30 stops | Left-truncation correction required | Medium |
| Rights/approval resolution rates ($\beta_i$) | How fast an unresolved right or approval clears | Submission and resolution dates, by type | 10 per type | — | Low — measured elasticity is approximately −0.00 (SM-C) |
| Contract-work drag ($\gamma$) | How much accepting contract work slows gate advancement | Gate-passage speed, contracted periods compared with uncontracted | 200 project-months under contract | Only contracts meeting the same external-verification bar as the gate table count as the same source | Low |
| History multiplier ($m_n$) | Whether an accumulated history of failed attempts should itself change future hazards | — | — | Fixed at 1 until it can be identified at all (F.2, constraint 3) | — |

**None of this has moved the initial values yet.** The source of record states a stop rule
explicitly: while the required event count is unmet, the initial value stands. By that rule, every
row above is still at its Tier-0 placeholder, with one qualification that is a different kind of
update rather than a calibration: approval #2026-08-29-2 opened per-project input channels for the
burn rate and for the seven populated carrier-function fills, so where a project's own records supply
a value, it substitutes for the population default on that project alone. That is case-by-case
substitution, not the population-level fit the table describes, and it changes nothing about what any
*other* project's default is.

The missing half of the top row is also the one calibration input the reference implementation cannot
simply wait for. The source of record notes that the builder's ledger held fifty-one recorded grant
awards and zero recorded rejections at the frozen version; a hierarchical model over public statistics
is therefore the only route to the award-rate/window-arrival split until that changes. The
remediation already built into the registry — an "application pending" record generated automatically
at the time of application, with a mandatory update to "awarded" or "rejected" on outcome, and an
alert on records left pending too long — is a structural fix for the *recording* gap, not a completed
calibration. It creates the possibility of eventually reaching 150 applications with real award/
rejection labels; it does not itself supply them yet.

One further check belongs here because it is easy to mistake for a calibration, and the source of
record explicitly warns against the mistake. Before this framework, the builder screened projects
against bands (`seed_screening_bands`) denominated in the same discounted net-domestic-value-added
quantity as $V$, but computed before multiplying by an attainment probability — the upper bound if
everything went right. The source of record is explicit that $\bar P_u$ must not be back-solved from
those bands: the direction of inference runs from a per-application market-size estimate into the
score, never the reverse. What the old bands remain useful for is a one-directional sanity check —
a $V$ computed under BZM 3.0 that *exceeds* the corresponding old band indicates an input or
implementation error, not a calibration result — and that check is gaming-resistance and internal
consistency, not part of the calibration plan above.

---

### F.2 Three identification constraints

§6.6 of the main text names three constraints as binding hardest, on the grounds that they limit what
§7's results can claim, and states that they are "given in full in SM-F." This section is that.

**1. The award rate and the window-arrival rate are observationally inseparable.** Both govern how a
funding opportunity turns into money, but the operating record only ever shows their product: an
award, when it happens, does not by itself say whether it was a common opportunity converted at an
ordinary rate or a rare opportunity converted almost every time it appeared. Separating them needs
application counts and award outcomes as independent observations, and the source of record sets the
bar at roughly 150 applications with reliable outcome labels (F.1). That count is not reachable
without the rejection-recording fix described above: at zero recorded rejections, every award looks
like a certainty, and the two rates cannot be told apart from ledger data even in principle. Until the
count is reached, this pair is restricted to a hierarchical model fitted to public statistics —
published award rates and application volumes — rather than to the builder's own history.

**2. Conversion capacity's population median is a scale convention, not an estimate.** The model
needs one fixed point against which gate speed is measured, and BZM 3.0 supplies it by declaring the
population median of conversion capacity ($c$) to be 1.0. That half of the constraint does not
resolve with more data, because it is not a claim about the world to be estimated — it is the
definition of the ruler's zero point. What *does* depend on data is the other half: the gate-speed
common multiplier, the gate-distance coefficients, and $c$ cannot be told apart from one another given
only how fast projects actually clear gates, so the three are fitted jointly, anchored at the fixed
median, once roughly 100 gate passages have accumulated, with a shrinkage prior on the type-level
multiplier to keep the joint fit from wandering. In short: the ruler's zero point is fixed by
convention and will not move; the marks along it are still being calibrated and have not been yet.

**3. History effects are fixed at unity because they cannot currently be identified at all, not
because the model asserts they are absent.** Separating a genuine effect of accumulated history
(state dependence — a project that has failed before is changed by that failure) from unobserved
heterogeneity (a project that has failed before was simply always the kind of project that fails) is a
hard identification problem on its own terms. The source of record adds that AMD's ledger cannot
currently attempt it at all, because it holds fifty-one grant awards and no recorded rejections.
Estimating a history effect from a record with no failures in it would not converge to a small effect
— it would diverge, and diverge in a way that conceals its own diagnosis, since the fitted parameter
would carry a number without carrying identified information. §6.4 of the main text names this
constraint as simultaneously a gaming opening: a coefficient the model cannot estimate is a
coefficient that cannot penalize an applicant for accumulating failed attempts. What would resolve it:
the same rejection-recording fix as constraint 1, run long enough to accumulate genuine failures,
together with an estimation strategy capable of separating state dependence from heterogeneity once
those failures exist. The source of record does not yet specify that second piece, and this
supplement does not supply one either.

---

### F.3 A calibration that was working, and broke

One absolute-level calibration in this framework had actually been fitted to something outside the
model, and it is currently unusable. Before approval #2026-08-29-1, own-production (gate M4)
attainment probabilities were matched, through a common multiplier ($\mathrm{scale}$), to external
statistics — published award rates and application-publication data. Approval #2026-08-29-1 then
changed how a pre-incorporation project is treated on running out of money: instead of terminating —
the absorbing-state treatment survival models default to, which the main text's fifth premise (§2.1)
argues is a firm premise wrongly imported into a domain with no firm — the project slows while funds
are nearly gone and re-accelerates on its next award.

Removing that absorbing state mechanically raised every Tier-0 attainment level. The source of
record's own comparison reports M4 attainment and capital self-sufficiency roughly doubling to
tripling across all twelve process-type × regulatory-regime cells — for instance F1×REG-0 from 11.3%
to 28.2%, F2×REG-0 from 13.6% to 31.2% — the termination mass that had sat near 80% in the worst cells
falling to roughly half that, and the median score $V$ roughly doubling. That is a level shift caused
by a structural change to the model, not new information about the world, and the multiplier fitted
before the revision is now a fit to a regime the model no longer implements.

The source of record states plainly that the resulting levels are pre-calibration, and that
re-fitting $\mathrm{scale}$ against external statistics is outstanding — "the next stage" — as of the
frozen version. The main text carries the same disclosure at §7.5 and extends it: because the same
revision also removed the numerical stiffness a hard absorbing wall had introduced at the cash
boundary, the *relative* structure across cells and the *direction* of every comparison (which cells
terminate more, which realize value through licensing rather than production) are treated as
informative, while the *absolute* levels are not anchored to anything outside the model. No claim in
the main text rests on an absolute level.

One consequence follows for a reader moving between this section and SM-C: the elasticity and
reporting-band tables there (source of record §6.I-11-4/-5) were measured on the implementation
immediately *before* this revision and have not been re-measured since. They are not wrong for having
been measured then, but they describe a system whose absolute levels have since moved by a factor the
tables do not reflect. Re-measuring them is bound to the same outstanding recalibration as
$\mathrm{scale}$ — it is one piece of work, not two.

---

### F.4 The falsification registry

§8.4 of the main text commits to depositing "the five conditions below" with a public repository,
each stated against an observable proxy, with a judge, a horizon and a threshold, so that a later
reader can check what was claimed before outcomes were known. The length trim that produced the
current main text (v4.0, 29 August 2026) compressed that paragraph to a cross-reference, moving its
detail here while stating that no claim was dropped in doing so. Table F-2 restates the five
conditions as they stood immediately before that compression; nothing has altered them since.

**Shared elements, stated once.** The judge for all five conditions is the evaluation-version
approver — under the separation of duties the main text describes at §6.5 and the source of record
requires at §6.D-3, a role held by someone other than the person who estimated the project's
parameters. The horizon is 24 months from deposit for conditions (1)–(4) and 60 months for condition
(5); condition (5)'s own threshold is stated in terms of that 60-month mark, which is the same
plan-horizon constant (source of record, revision K8) that elsewhere separates within-horizon from
after-horizon capital self-sufficiency.

**Table F-2. The falsification registry.**

| # | Condition | What is tested | Observable proxy | Threshold | Testable now? |
|---|---|---|---|---|---|
| 1 | Ceiling stability | Whether the per-project ceiling ($\bar P_u$) is a stable measurement or an artefact of how the addressable market is sliced — the largest single lever on any score (§7.7) | Per-project ceiling values, compared across evaluation versions | If more than a quarter of per-project ceilings move by more than a factor of two across versions with no new market evidence recorded, rankings are an artefact of market-slicing convention, and the ceiling procedure itself must be replaced | Yes, from the next evaluation-version revision onward |
| 2 | Breakeven-$\alpha$ flips | Whether the counterfactual deduction ($\alpha_u$) — reported under partial identification (§5.4) because it is unobservable in principle — is nonetheless doing real selection work | The identity of the top five projects by score, evaluated across the bounds a documented competitor audit places on $\alpha$ | If the top-five identity changes within those bounds, the deduction moves from being reported as a sensitivity to being redesigned | Yes, wherever a competitor audit exists |
| 3 | Dual-scoring convergence and default calibration | Whether the gap between record-only and elicited scores (§7.2–§7.3) is closable by better records; separately, whether the instrument's near-total insensitivity to organizational facts in the pre-incorporation sample is a data problem or a functional-form problem | The ratio of record-only to elicited scores for the financial inputs currently shown to move rankings, re-measured after the registry redesign now in operation; and the same dual-scoring exercise repeated on the pre-incorporation sample after three specific changes | Persistent order-of-magnitude gaps falsify the claim that the observation system can be completed. Separately: financial elicitation must be collected *deliberately* for pre-incorporation projects rather than opportunistically — in the present sample, only one of the four pre-incorporation projects with any elicited input had a financial one (§7.3); carrier effects must be represented with the strength the founding-team literature reports; and Tier-0 defaults must be re-estimated on the pre-incorporation population specifically. If pre-incorporation scores still do not respond after those three changes, the finding is that the framework measures its own priors rather than the projects | Partially — the convergence half is testable now; the pre-incorporation half needs the redesigned elicitation protocol first |
| 4 | Carrier-function interactions | Whether vacancy across the eight carrier functions acts independently on gate advancement (the current product-form fill factor $\eta_t = \prod_f(1-d_f\mathbb{1}[\mathrm{vacant}])$), or whether functions interact in bundles, as the founding-team literature cited at §6.2 suggests | Gate passage, conditioned on vacancy indicators and their pairwise interactions, via a proportional-hazards test | A pairwise interaction significant at the 5% level falsifies the product form and forces a bundle representation | **No** — needs 130 accumulated vacancy-to-fill transitions, the same threshold the calibration plan sets for $d_{f,g}$ (F.1). The source is explicit that until that count is reached the condition is not testable, and says so rather than implying an ongoing test |
| 5 | Regime asymmetry | DP2 / the fifth premise (§2.1, §4.5): that pre-incorporation cash exhaustion changes a project's *speed*, not its survival | Gate passage among registered pre-incorporation projects, following a fund-exhaustion event | If, at 60 months, more than half of the pre-incorporation projects that exhaust their funds show no further gate passage within 24 months of exhaustion, the speed-rule treatment is rejected and the absorbing-state formulation (death at zero cash) is reinstated | Yes, for any pre-incorporation project that has both exhausted its funds and been tracked 24 further months |

**No condition above carries a threshold this supplement invented.** Every number in Table F-2 — the
quarter of ceilings, the factor of two, the 5% significance level, the 130 transitions, the 60 months,
the half of projects, the 24 months of no further gate passage — is quoted from the source. Where the
source gives a mechanism without a further number, this supplement says so rather than supplying one.

**Where this registry does not close the loop the main text opens elsewhere.** Two claims are
cross-referenced to this registry in other sections of the main text and correspond to none of the
five conditions above.

- §2.5 states that enterprise-level and investor-level additionality "coincide only under an
  assumption we state and register for falsification (§8.4): that in the current Japanese Before Zero
  population, projects not carried by a dedicated builder are, with high probability, not carried at
  all." No condition above tests this. (In the working draft, this cross-reference read "(§8)" — the
  policy section as a whole — before the same length-trim commit that compressed the registry
  tightened the citation to "(§8.4)" specifically; the five conditions were not changed to match.)
- §4.3 states that "monotone drift of posteriors across versions is one of the registered
  falsification signals (§8)." This cites the section generally rather than §8.4 by number, and no
  condition above operationalizes it either — though the source of record already requires a related
  check as ordinary practice, independent of this registry: every new evaluation version is checked
  for time-consistency across the version sequence, i.e., whether $B_0$, the funding-opportunity list,
  or the rules have been drifting in one direction rather than settling.

This supplement reports both as open items rather than resolving them by assumption. Either the
additionality-equivalence claim and the posterior-drift signal need their own numbered conditions,
each with a proxy, judge, horizon and threshold, or the cross-references at §2.5 and §4.3 should be
corrected to cite the general commitment to falsifiability (§8, or §8.4's framing paragraph) rather
than "the five conditions" specifically. Which correction is right is an authorial decision this
supplement does not make.

**One further looseness, smaller than the two above.** Table 2 of the main text (§3.2) states that
DP9 — "carrier vacancy delays, it does not disqualify" — is, together with DP2, "registered for
testing in §8.4." DP2 maps cleanly onto condition (5). Condition (4) is the nearest match for DP9, but
it tests a narrower and different claim: not whether vacancy delays rather than disqualifies, but
whether the *functional form* of how several simultaneous vacancies combine is multiplicative (as
currently implemented) or interactive. A vacancy that disqualifies rather than delays is a different
failure mode from a vacancy whose interaction with other vacancies is under-weighted, and condition
(4) as written tests only the second. This is noted rather than corrected, since correcting it would
mean writing a sixth condition this supplement has no source for.

---

### F.5 What this supplement does not cover

Coefficient-by-coefficient provenance grades, the sixteen declared approximations (A1–A16), and the
full elasticity and reporting-band tables are SM-C's. The stratified sample, the dual-scoring protocol
and its classification rules, and the ceiling-sensitivity worked cases that condition (1) above will
eventually draw on are SM-D's. The audit trail behind the twelve design propositions is SM-E's. The
frozen model-version hash, approval identifiers, and input-freeze date this supplement's "Version"
note depends on are SM-G's. `model/MODEL_VERSION_LEDGER.md` was consulted read-only in preparing this
supplement; nothing in it was changed.
