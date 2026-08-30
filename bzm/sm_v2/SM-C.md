## SM-C. Coefficient tables, declared approximations, and elasticities

This supplement holds the numeric layer of the framework: every coefficient the reference
implementation reads, the provenance grade attached to each, the sixteen approximations by which
the implementation departs from the specification, and the full elasticity and reporting-band
tables that §7.6 of the main text cites in summary form.

**Version.** All coefficients below are at the frozen model version, main commit `a149fc30`
(approvals #2026-08-29-1, -2, -3, plus the input re-placement of 29 August 2026). The coefficient
sections of the source of record are unchanged between that commit and the working copy from which
this supplement was compiled. Two tables are the exception and are marked where they appear:
the elasticities (§C.13) and the reporting bands (§C.14) were measured on the implementation
*preceding* the pre-incorporation speed rule and have not been re-measured. §C.13 states the
caveat in the form the source of record uses; it must not be dropped.

**Status of every number.** These are pre-calibration initial values. Approval of a value means
"begin here," not "this level is correct." $v(\theta)$ is computed on a deterministic forward grid;
no Monte Carlo sampling is used at any point. Statements in the "reference implementation" columns
below are as declared by the source of record; the implementation source was not independently
re-read for this supplement, and nothing here should be read as a verification of it.

**Two things called a grade.** *Provenance grade* (A/B/C, §C.1) records where a coefficient's
number came from. *Evidence grade* $g_t \in \{0,\dots,6\}$ is a state component recording how far a
project's demand and technical evidence has advanced. They are unrelated, and several tables carry
both.

**Units and labels.** Money is yen: JPY million and JPY billion. Process types are F1 process,
F2 device, F3 software, F4 service; regulatory regimes are REG-0 unregulated, REG-1 standards-tested,
REG-2 medically regulated. Rates given as annual are continuous-time hazards; the monthly hazard is
the annual figure divided by twelve.

---

### C.1 Provenance grades

**Table C-1. Provenance grades and the two exclusion rules.**

| Grade | Main-text wording (§6.6) | Definition in the source of record |
|---|---|---|
| A | directly evidenced | The number can be read directly off a public statistic or an internal measurement, with a fixed source page cited |
| B | derived from institutional design | The level is derived from the design of an institution or from the literature, not read off directly |
| C | provisional | A provisional placement |
| — (fixed) | — | Approved as settled; not a calibration target |

Two exclusion rules bind the assignment. A value that satisfies only an ordering or rank constraint
is **not** called B. A single observation ($n = 1$) is **not** an A-grade basis for a class default.
Calibration replaces C first, then B.

The great majority of coefficients below carry grade C. Only two families carry A — regulatory
review durations, read off published agency records — and three carry B: public award rates,
clinical phase pass probabilities, and the award-function base rate. This distribution, not any
single value, is the honest summary of the numeric layer's maturity.

---

### C.2 Conventions that govern every coefficient

**Table C-2. The two-stage gate-speed convention.**

| Quantity | Value |
|---|---|
| Minimum preparation period | $M^{\mathrm{min}}_g = \mathrm{round}(0.40\,M_g)$ — no passage occurs during it |
| Residual (hazard-bearing) period | $M^{\mathrm{res}}_g = M_g - M^{\mathrm{min}}_g$ |
| Conversion | $\kappa_g = 1/M^{\mathrm{res}}_g$ |
| Mean wait after preparation | $1/(1-\exp(-\kappa_g)) \approx M^{\mathrm{res}}_g + 0.5$ months |
| Median wait after preparation | $\ln 2 \cdot M^{\mathrm{res}}_g$ months |
| Mean total time on a gate | $M_g + 0.5$ months (for $M_g \ge 3$) |
| Gates with nominal $M_g \le 2$ | No waiting time; preparation and review only |

The $M_g \le 2$ test is applied to the **nominal** duration, before the common multiplier
$\mathrm{scale}$ is applied. Applying it afterwards would let a calibration sweep switch the
convention on and off discontinuously. The R2 stagnation reference is the 85th percentile of the
two-stage distribution (revision K6) — specified but not implemented; see A5.

**Table C-3. Sector-momentum multipliers $m_\sigma$, by what they act on.**

| Acts on | Headwind ($\sigma = -1$) | Neutral ($\sigma = 0$) | Tailwind ($\sigma = +1$) |
|---|---|---|---|
| Award rate $\phi$ | 0.61 | 1.00 | 1.65 |
| Realization-offer arrival $\nu_k$ | 0.67 | 1.00 | 1.49 |
| Contract-work arrival $\nu_c$ | 0.74 | 1.00 | 1.35 |
| Competitor-preemption hazard $\lambda^{\mathrm{comp}}$ | 0.74 | 1.00 | 1.35 |

Grade C throughout. $\sigma$ is judged on a fixed unit — the twelve process-type × regulatory-regime
cells — centrally, once a quarter, under version control. The rule: compare the last 24 months with
the preceding 24 on three tests — (i) public-call award rate or budget moved by $\pm 20\%$ or more,
(ii) private investment moved by $\pm 20\%$ or more, (iii) at least one legitimacy event (a standard
set or revised, an industry body founded, a regulator building out its regime). Two or more tests
moving the same way give $\pm 1$; otherwise 0. Reversing $\sigma$ carries the same governance as a
plan-rule change: primary evidence attached to the registry, approved by someone other than the
person who judged it. This is a one-way lever with a large reach and is flagged as such in §C.11.

**Table C-4. Evidence-grade multipliers, by evidence grade $g_t$.**

| Multiplier | 0 | 1 | 2 | 3 | 4 | 5 | 6 | Grade |
|---|---|---|---|---|---|---|---|---|
| $m_g$ — on the award rate $\phi$ (base point $g_t = 2$) | 0.60 | 0.85 | 1.00 | 1.15 | 1.35 | 1.35 | 1.35 | C |
| $m_g^{\mathrm{offer}}$ — on realization-offer arrival $\nu_k$ | 0.20 | 0.35 | 0.50 | 1.00 | 1.60 | 2.20 | 2.50 | C |
| $m_g^{c}$ — on contract-work arrival $\nu_c$ | 0.5 | 0.5 | 0.8 | 0.8 | 1.3 | 1.3 | 1.3 | C |

Evidence grades: 0 before T1; 1 at T1; 2 at T2; 3 at T3 or clinical Phase I; 4 at M2, Phase II or a
standards test; 5 at M3 or Phase III; 6 at M4 or regulatory approval. Regulatory gates raise the
grade on the same footing as technical and market gates: to a reviewer, a customer or an investor,
clearing a clinical phase is evidence at least as strong as clearing a technical gate.

---

### C.3 Gate base speeds

**Table C-5. $M_g$, nominal months per gate, by process type.** Grade C throughout. A common
multiplier $\mathrm{scale}$ (initial value 1.00, a calibration parameter) applies to the whole table.

| Gate | F1 process | F2 device | F3 software | F4 service |
|---|---|---|---|---|
| T1 principle demonstration | 14 | 12 | 7 | 7 |
| T2 reproducibility | 10 | 9 | 5 | 5 |
| T3 verification at real scale and in a real environment | 28 | 22 | 10 | 10 |
| M2 paid proof-of-concept completed | 15 | 13 | 7 | 5 |
| M3 production terms presented | 14 | 18 | 10 | 10 |
| M4 adoption decision, production contract | 16 | 14 | 10 | 8 |

The gate sequences into which these durations are placed (by process type × regulatory regime) are
in SM-B.

**Table C-6. T4-* regulatory and certification gates (revision K5).** Preparation carries
conversion capacity $c$ and the carrier-fill factor $\eta_t$; review is a deterministic countdown
carrying neither. Clinical trials are treated as technical gates and carry $\psi$, $c$ and $\eta_t$.

| Gate | Treatment | Preparation $M$ (months) | Review (months, deterministic) | Pass probability | Grade |
|---|---|---|---|---|---|
| T4 pre-submission consultation | preparation + review | 6 | 2 | 0.95 | C |
| T4 standards test | preparation + review | 9 | 3 | 0.85 | C |
| T4 clinical trial Phase I | technical | 24 | — | 0.60 | B |
| T4 clinical trial Phase II | technical | 36 | — | 0.33 | B |
| T4 clinical trial Phase III | technical | 48 | — | 0.55 | B |
| T4 clinical trial (medical device) | technical | 24 | — | 0.70 | B |
| T4 approval (drug, standard review) | preparation + review | 12 | 11 | 0.90 | preparation C, review **A** |
| T4 approval (device, standard review) | preparation + review | 9 | 12 | 0.90 | preparation C, review **A** |
| T4 reimbursement listing | preparation + review | 2 | 3 | 0.95 | C |

Review durations are set by a declared rule: take the integer nearest the median of the published
total review period. Published 10.8 months rounds to 11; 11.4 and 11.7 round to 12. The phase-wise
product $0.60 \times 0.33 \times 0.55 \times 0.90 = 9.8\%$ falls inside the 8–10% cumulative
Phase-I-to-approval rate published for the field, which is the check that keeps the individual
phase values honest as a set rather than one at a time.

Two boundary rules matter. The published total review period is the sum of the regulator's own
review time and the applicant's response time; the model does not separate them, and preparation is
therefore treated as excluding response time (A13). Preparation also excludes ethics review, which
enters instead as an independent open item under revision K4: Phase-I preparation of 10 months
(the $M^{\mathrm{min}}$ of $M = 24$) composed with ethics review (2 months preparation, a monthly
committee, 0.55 per round, expectation 1.8 months) gives about 13.8 months, inside the 12–18 months
clinical practice expects.

---

### C.4 Carrier functions

The eight carrier functions are: 1 evangelist, 2 technical core, 3 application and customer
development, 4 decision-making, 5 fundraising, 6 negotiation and contracts, 7 organization building,
8 an extension slot reserved for volume-production functions and currently empty. Vacancy produces
delay, not disqualification: $\eta_t = \prod_{f}(1 - d_{f,g}\,\mathbb 1[\text{vacant}])$.

**Table C-7. $d_{f,g}$, the delay coefficient of a vacancy, by gate.** Non-zero only in the cells
where a function is the primary carrier for that gate; every other cell takes
$d_{\mathrm{other}} = 0.05$. Grade C throughout.

| Gate | Primary-carrier vacancies | All other functions |
|---|---|---|
| T1, T2, T3 | function 2 technical core = **1.00** (no advance) | 0.05 |
| T4-* preparation | function 6 negotiation 0.25; function 2 technical core 0.35 | 0.05 |
| T4 clinical trial | function 6 negotiation 0.30; function 2 technical core 0.35 | 0.05 |
| M2 | function 3 application and customer 0.30; function 1 evangelist 0.35 | 0.05 |
| M3 | function 3 application and customer 0.30; function 6 negotiation 0.25 | 0.05 |
| M4 | function 6 negotiation 0.30; function 4 decision-making 0.20 | 0.05 |

The technical core is by convention not vacant, revised to a conditional convention under approval
#2026-08-29-2: a project may declare $f_2 < 1$ where the carrier of the technical core is observed
to have been lost at the evaluation date. Where it is declared, the blanket loss hazard
$\lambda^{\mathrm{core}}$ is switched off for that project so the same loss is not counted twice as
both a rate and a state, and the declared fill does not change over the horizon because the
technical core is not a function the portfolio supply process can fill. $d_{2,g} = 1.00$ therefore
returns to the calibration set, to be measured once projects that declare it exist; it does not
fire at Tier-0 defaults.

The product form treats vacancies as **substitutes** — each additional vacancy does less marginal
harm. Founding-team evidence points the other way, toward complementarity. The form cannot represent
that; the limitation is recorded in §C.12.2 and is not an approximation with a number attached.

**Table C-8. Lower bounds on $\eta_t$ implied by the not-vacant convention on the technical core.**
The bound differs by gate: it is lowest where the primary carriers are functions that can be vacant.

| Gate | Lower bound on $\eta_t$ |
|---|---|
| T1, T2, T3 | 0.735 |
| T4-* preparation | 0.580 |
| T4 clinical trial | 0.542 |
| M2 | **0.371** |
| M3 | 0.428 |
| M4 | 0.456 |

**Table C-9. Vacancy fill and the carrier multipliers on award and offer hazards.**

| Quantity | Value | Grade |
|---|---|---|
| Fill rate, transferable functions 3–7 (portfolio supply process) | $\kappa_{\mathrm{sup}} = 1/12$ per month | C |
| Fill rate, evangelist function 1 (search process, scaled by $e$) | $\kappa_e = 1/18$ per month | C |
| Fill rate, technical core (function 2) | carried by the researcher; not vacant by convention | convention |
| Ordering constraint | $\kappa_e < \kappa_{\mathrm{sup}}$, declared | — |
| $d^{\phi}_1$ — evangelist vacancy, on the award rate | 0.30 | C |
| $d^{\phi}_5$ — fundraising vacancy, on the award rate | 0.25 | C |
| $d^{\nu}_1$ — evangelist vacancy, on offer arrival | 0.35 | C |
| $d^{\nu}_6$ — negotiation vacancy, on offer arrival | 0.15 | C |
| Lower bound on the carrier multiplier, award rate | 0.525 | — |
| Lower bound on the carrier multiplier, offer arrival | 0.553 | — |

Fill probability depends only on months elapsed since the evaluation date, so it is not carried in
the state; the expectation over all 64 vacancy patterns is pre-computed exactly, per month and per
gate. This is an exact expectation, not an approximation, and is recorded here because it is easily
mistaken for one.

---

### C.5 Funding: the award function and its supply

The award function is

$$
\phi = \mathrm{clip}\big(\phi_{\mathrm{base}} \cdot m_\sigma \cdot m_g \cdot m^{\phi}_\eta,\ 0.03,\ 0.70\big)\cdot m_\theta,
\qquad \phi_{\mathrm{base}}^{(j)} \cdot \overline{m}^{(j)} = \hat p^{(j)},
$$

where $\overline{m}$ is the weighted mean of the multipliers across the applicant population and
$\hat p^{(j)}$ the observed award rate of institution class $j$. The economic multiplier $m_\theta$
is applied **outside** the clip (revision N2): the clip exists to bound the award function's own
domain, and $m_\theta$ carries its own bounds, so clipping twice would be double-truncation.

**Table C-10. Award-function coefficients.**

| Coefficient | Value | Grade |
|---|---|---|
| $\phi_{\mathrm{base}}$ base award rate | 0.28, under the normalization $\overline{m} \approx 0.5$ | **B** |
| Clip bounds on $\phi$ | 0.03 – 0.70 | convention |
| $P^{\mathrm{ref}}$ reference ceiling | JPY 30 billion per year of annual domestic value added | C |
| $\beta_P$ ceiling loading | 0.25 on public awards; 0.45 on private funding | C |
| $\beta_m$ unit-economics loading | 0.40 | C |
| $\underline m,\ \overline m$ bounds on $m_\theta$ | 0.4 – 2.5 | C |
| Rate at which eligible funding windows come into view | 0.50 calls per month | C |
| Reference award amount used in the mixture | JPY 30 million | C |
| R7 applications per month $a$ | $a \in \{1,2,3\}$; Tier-0 default $a = 1$ | convention |

$\phi_{\mathrm{base}}$ is graded B rather than A for a stated reason: the normalization requires
$\overline{m}$, and the evidence-grade distribution of the applicant population has not been
obtained, so $\overline{m} \approx 0.5$ is assumed rather than measured. Calibration priority is
highest here; §C.13 shows why.

**Table C-11. Institution classes.**

| Class | Observed award rate | Amount per award | Disbursement | Grade |
|---|---|---|---|---|
| Internal allocation (GAP funds, presidential discretionary) | held over the range 0.20–0.35 | JPY 30 million and JPY 78 million observed ($n = 2$) | prepaid, monthly | C |
| Industry–academia joint type | 0.089 (2025 only) | JPY 17 million | reimbursement | award rate **B**, amount C |
| Large-scale technology development | 0.238 (2025 only) | JPY 58 million | reimbursement | award rate **B**, amount C |
| Talent and entrepreneurship support | 0.187 (2025 only) | not yet obtained | reimbursement | award rate **B** |
| Municipal and foundation | not yet obtained | JPY 3.79 million observed ($n = 1$) | prepaid | C |

The award rates are graded B, not A, for two stated reasons: the normalization constant
$\overline{m}$ is not estimated, and the rates come from a single fiscal year across three
programmes, so year-to-year variation in budgets and thematic priorities is not averaged out. They
rise to A when a multi-year average is available.

Two exclusion rules apply. Programmes with fewer than 50 applications are not used for class
defaults. A single SBIR-Phase-3-equivalent observation (JPY 1.5 billion, $n = 1$) is excluded from
the defaults because on its own it would nullify the cash-out test for any project it touched;
where it applies it is entered as a project-specific window.

The fiscal-year rules — public funds paid as a lump at the start of the fiscal year, unused balance
expiring at year end through $\ell_t$, a three-month lag on reimbursement-type disbursement,
internal allocations and private funding prepaid monthly — are specification, **not implementation**
(A9).

**Table C-12. Private funding and window creation.**

| Coefficient | Value | Grade |
|---|---|---|
| $\nu^{\mathrm{eq}}$ private-funding arrival, post-incorporation only | 0.030 per month | C |
| Amount per event, REG-0 and REG-1 | JPY 100 million | C |
| Amount per event, REG-2 | JPY 500 million | C |
| $\nu^{\mathrm{win}}$ creation of new funding windows | $0.10 \cdot m_\sigma$ per month | C |
| Window removal | by the dated final call held on the window, not by a rate | convention |

Amounts are split by regulatory regime because JPY 100 million cannot carry a clinical development
period. No closing probability is placed on private funding — arrival is treated as receipt (A11) —
and the window list itself is not held (A12).

---

### C.6 Offers and contract work

$$
\nu_k = \nu_k^{\mathrm{base}}\cdot(0.4+1.2\,\kappa_{\mathrm{IP}})\cdot m_g^{\mathrm{offer}}\cdot m_\sigma\cdot m^{\nu}_\eta\cdot m_q .
$$

$m_q$ is the quiet-period multiplier (Table C-20); projects whose quiet period has not been observed
take $m_q = 1.0$.

**Table C-13. Realization-offer arrival rates $\nu_k^{\mathrm{base}}$, per month (annual rate in
parentheses).** Grade C throughout.

| Regime | Licensing | M&A | IP sale |
|---|---|---|---|
| REG-0 (F1, F2) | 0.0030 (3.5%/yr) | **0.0004 (0.5%/yr)** | 0.0010 (1.2%/yr) |
| REG-0 (F3, F4) | 0.0025 (3.0%/yr) | **0.0010 (1.2%/yr)** | 0.0008 (1.0%/yr) |
| REG-1 | 0.0030 | **0.0004 (0.5%/yr)** | 0.0010 |
| REG-2 | **0.0060 (7.0%/yr)** | **0.0050 (5.9%/yr)** | 0.0012 |

The M&A rates for REG-0 and REG-1 were cut sharply under approval #2026-08-29-3: acquisitions of
deep-tech start-ups are rare relative to the formation rate, and the ones that occur are
predominantly positive-momentum acquisitions rather than distress sales. The positive-momentum
side is carried by $m_g^{\mathrm{offer}}$, which reaches 1.6–2.5 at evidence grades 4 and above, so
lowering the base rate does not remove offers to projects that have advanced. Software and service
types are held above materials and equipment types because business acquisition does occur there.
REG-2 is unchanged: licensing-out and acquisition are the industry's principal routes in
pharmaceuticals and medical devices. Pre-incorporation M&A is structurally zero
($\nu_{\mathrm{M\&A}} = 0$ while $\iota_t = 0$).

**Table C-14. $q_k$, the probability that a successor clears the remaining market gates.**

| Exit form | $q_k$ | Reason given | Grade |
|---|---|---|---|
| M&A | 0.75 | the acquirer holds both the resources and the intent to continue development | C |
| Licensing | 0.60 | the licensee must carry the technology to production itself | C |
| IP sale | 0.45 | the buyer may not practise the right at all | C |

A settled offer is valued as $\Pi_{\mathrm{offer}} = q_k \cdot \Pi_{\mathrm{tail}}(t + \text{months
remaining to M4})$. What the measure prices is not the transaction value but the net domestic value
added the technology goes on to create: an acquisition at any headline price contributes only the
present value of the annual domestic value added the business sustains.

**Table C-15. Contract work.**

| Coefficient | Value | Grade |
|---|---|---|
| $\nu_c$ contract-offer arrival | $0.05\cdot(r/r_{\mathrm{ref}})^{1/2}\cdot m_\sigma\cdot m_g^{c}$ per month | C |
| $r_{\mathrm{ref}}$ reference self-propulsion | JPY 0.693 million per month | C |
| Contract expiry hazard | $1/12$ per month | C |
| $\nu_c^{\mathrm{base}}$ by process type | single value; type differences are carried by $r$ alone | convention |
| $m_n^c$ history multiplier on contract arrival | not placed | — |
| $\gamma$ drag, same-origin contract work | 0 | fixed |
| $\gamma$ drag, adjacent | 0.5 | C |
| $\gamma$ drag, unrelated | 1.0 | definitional base point |

Contract work multiplies the gate-advance hazard by $(1 - \gamma \rho_t)$. "Same origin" carries an
externally verifiable test — the contract's deliverable must be referenced as gate evidence by the
same registry event — and contract work that fails the test is treated as adjacent.

*Note on $r_{\mathrm{ref}}$.* The source of record states $r_{\mathrm{ref}} = 0.693$ and derives it
as the geometric mean of a set of per-type self-propulsion defaults that differs from the per-type
defaults given in Table C-19; the derivation is unresolved in the source of record and the value in
force is 0.693.

---

### C.7 Rights-resolution rates and loss hazards

**Table C-16. Rights-resolution rates $\beta_i$ — default types.** Grade C
throughout. Institutions without a dedicated intellectual-property function take resolution
probability $\times\,0.7$ and preparation $+1$ month.

| Open item | Default committee calendar | Preparation (mean months) | Resolution probability per round |
|---|---|---|---|
| Determination of employee-invention ownership | monthly | 1 | 0.70 |
| Joint-filing consent — counterpart a national university or institute | round trips over 3–6 months | 2 | 0.35 |
| Joint-filing consent — counterpart a private firm | as above | 2 | 0.20 |
| Joint-filing consent — counterpart an overseas institution | as above, plus export-control screening | 2 | 0.15 |
| Licence terms agreed (term-sheet level) | as arising, monthly | 3 | 0.15 |
| Conflict-of-interest approval | quarterly, with ad-hoc review for high-risk cases | 1 | 0.70 |
| Secondary-employment approval | fixed processing period of 1 month (0.5–1 month) | 1 | — |
| Material transfer agreement | as arising, monthly; overseas shipment and biological materials handled separately | 1 | 0.35 |

**Table C-17. Rights-resolution rates $\beta_i$ — additional types enabled conditionally on project attributes (revision K4).**
Grade C throughout.

| Open item | Trigger | Default |
|---|---|---|
| Security export-control classification | material transfer or technology transfer to an overseas institution; a filing with a foreign co-inventor | preparation 1 month, as arising, 0.50 per month; controlled technologies add 3–6 months for the licence application |
| Ethics review (institutional review board, animal experiment committee) | clinical research, clinical trials, or animal experiments | monthly, preparation 2 months, 0.55 per round |
| Student-inventor assignment consent | a student among the inventors | as arising, 0.25 per month |
| Amendment of the joint research agreement | extension of applications; change to the scope of the practising right | as arising, 0.25 per month |
| Negotiation through a technology licensing office | institution operates a TLO | adds one round to licence-terms agreement |
| Institutional approval for facility use | continued use of university facilities after incorporation | quarterly, 0.70 |

The reference implementation does not read either table: it collapses the whole family to two open
items at an average resolution rate of 0.18 per month (A4). Committee-calendar entry is enforced
structurally rather than by exhortation — the calendar field is mandatory at project registration
and an evaluation version cannot be finalized without it — because a collection regime that is
merely encouraged makes the default the de facto standard.

**Table C-18. Loss hazards $\lambda$.** $\lambda^{\mathrm{comp}} = 3.0\%/\text{yr} \cdot (1.6 - 1.2\,
\kappa_{\mathrm{IP}}) \cdot m_\sigma$.

| Hazard | Annual rate | What it represents | Grade |
|---|---|---|---|
| $\lambda^{\mathrm{comp}}$ base | 3.0% | competitor preemption | C |
| $\lambda^{\mathrm{dem}}$ | 2.0% | the demand itself disappears | C |
| $\lambda^{\mathrm{core}}$ | 0.8% | permanent loss of the carrier of the technical core | C |
| $\lambda^{\mathrm{obs}}$ | 5.0% | obsolescence or substitution of an **active** application; leaves $A_t$ on the value side rather than entering $\lambda_t$ | fixed |

At $\kappa_{\mathrm{IP}} = 0.55$ the first three sum to 5.62% per year, giving cumulative loss of
43.1% at ten years and 67.6% at twenty. Calibration priority is medium, and these are explicitly
included in the sensitivity set: $\lambda^{\mathrm{obs}}$ is the fifth-ranked coefficient by
elasticity (§C.13), which is why its value is stated in the main text rather than held here.

---

### C.8 The prior, burn rates, and the Tier-0 project

**Table C-19. $B_0$ defaults over project parameters.**

| Component | Default | Grade |
|---|---|---|
| $c$ conversion capacity | lognormal, median 1.0, geometric standard deviation 1.65 (10th percentile 0.53, 90th 1.90). Where a per-project estimate exists, the **centre** is replaced and the geometric standard deviation of 1.65 is kept. The population median of 1.0 remains an identification convention | convention + C |
| $\psi$ technical-core validity | conditioned on the evidence grade at the **start of the evaluation version**: grade 0 → 0.45, 1 → 0.65, 2 → 0.80, 3 and above → 0.92; width $\pm 0.15$ | C |
| $\kappa_{\mathrm{IP}}$ appropriability | conditioned on the rights position alone: no filing 0.15, filed 0.55, granted with freedom-to-operate confirmed 0.75, narrow claims 0.35; width $\pm 0.15$ | C |
| $\sigma$ sector momentum | unobserved projects take $\Pr(-1) = 0.25$, $\Pr(0) = 0.50$, $\Pr(+1) = 0.25$ | C |
| $e$ evangelist fill prospect | median 0.5, range 0.2–0.8 | fixed |
| $r$ self-propulsion | 0.25 probability of zero, 0.55 at the median, 0.20 at 2.5× the median. Pre-incorporation medians: F1 JPY 0.6 million, F2 0.6, F3 0.9, F4 1.3 per month; post-incorporation $\times\,4.0$ | C |
| $f_1 \dots f_7$ carrier fill | per-project input in $[0,1]$ at the evaluation date. $f_1$ is $e$ under another name. $f_2$ defaults to 1. $f_3 \dots f_7$, where specified, mean "filled at the evaluation date with probability $f$, the remaining $1-f$ filled by the supply process"; omitted functions keep the prior behaviour (vacant at the evaluation date, filled by the supply process) | C |

Keeping the per-project estimate as a re-centring rather than a point estimate is deliberate: a
point estimate would discard the parameter uncertainty the reported band exists to express. The
first pass of carrier-fill inputs is populated only where a clear observation exists, with the
basis recorded item by item; everything else keeps the default, and projects switch to the full
rule of SM-B once a working record has accumulated.

Self-propulsion $r$ is gross margin — what remains to the project after direct costs when all
available effort is applied — not revenue. Treating it as revenue would leave the effort required
to deliver contract work off the expenditure side and make capital self-sufficiency trivially
attainable. Left at these defaults the upper reach of $r$ stops at roughly JPY 62.4 million per
year, short of the contract sizes projects actually receive; the value presumes per-project
over-writing.

**Table C-20. The quiet-period scale.** One scale serves two uses: the approximation of $c$ where
spending records do not exist, and the offer-arrival multiplier $m_q$. Grade C; piecewise linear
between the listed points.

| Quiet period $t_q$ | Approximate $c$ / $m_q$ |
|---|---|
| 0 months (a positive event within the recent window) | 1.00 |
| 12 months | 0.50 |
| 24 months | 0.10 |
| 36 months and beyond | 0.05 (floor) |

Double counting is blocked in both directions. Where $c$ can be estimated from spending records,
the quiet period is used only for $m_q$; where $c$ was approximated from the quiet period, the same
absence of progress does not act on $c$ a second time through the progress-report event type.

**Table C-21. Burn rate $\mu$, JPY million per month.** Grade C throughout.

| Process type | Pre-incorporation | Post-incorporation |
|---|---|---|
| F1 process | 1.5 | 4.5 |
| F2 device | 1.3 | 4.0 |
| F3 software | 1.0 | 3.5 |
| F4 service | 0.9 | 3.3 |

| Related quantity | Value | Grade |
|---|---|---|
| Unusable share of use-restricted funds | 0.15 | C |
| Indirect cost rate on contract income routed through a university | 30% | C |

The boundary rule: only expenditure met from funds the project itself raised counts toward $\mu$.
Salaries, equipment and overheads already borne by the university do not. Where a person on
university books works partly for the company, an apportionment ratio must be recorded by
employment contract or memorandum as a registry event, and only that ratio times full cost enters
$\mu$; with no such record the conservative default applies and none of the cost enters. The
post-incorporation level covers one to two business-side staff at full cost of JPY 0.6–1.0 million
each per month plus rent, social insurance and professional fees at JPY 0.3–0.5 million per month,
with the increment held at no less than JPY 2.5 million per month across types because the build-up
does not vary by type. Only four monthly profit-and-loss records exist internally, two of them
forward plans, so these cannot be set from measurement; calibration priority is highest.

Per-project burn rates enter under approval #2026-08-29-2: an actual or recently planned monthly
expenditure replaces the default on the side matching the project's incorporation state at the
evaluation date. Where a pre-incorporation project's observed spend exceeds the post-incorporation
default, the observed figure becomes the post-incorporation floor, since spending does not fall on
incorporation. Pre-incorporation projects may additionally supply a planned post-incorporation
spend (#2026-08-29-3), applied as $\max(\text{plan}, \text{observation})$ so that a deliberate
small start is not overwritten by a type default. Observed spends departed from the defaults by
factors of roughly 2 to 9 across the projects where records exist.

**Table C-22. Tier-0 representative-project assumptions.** These set the withdrawal rate directly
and are therefore stated rather than buried. They are defaults, not fixtures: the implementation
accepts a per-project observable state and over-writes only the items supplied.

| Item | Value | Grade |
|---|---|---|
| Cash at the evaluation date | 18 months of the pre-incorporation burn rate | C |
| Open rights and approvals at the evaluation date | 2 items | C |
| Evidence grade at the evaluation date | grade 0 (before T1) | convention |
| Plan horizon (separates within-horizon from after-horizon terminal classes) | 60 months (revision K8) | C |
| $\kappa_{\mathrm{IP}}$ | 0.55 (filed) | C |
| $\rho_{\max}$ ceiling on effort given to contract work | 0.3 for F1, F2, F3; 0.5 for F4 | fixed |
| $k_{\mathrm{exit}}$ failed attempts before the R2 branch | 3 | fixed |
| $\underline h$ remaining months under R6 | 6; the accompanying "no window arrives in time" test is replaced, under the no-window-list approximation, by "award prospect × remaining months < 0.30" | C |
| $g^{*}$ evidence grade at which offer consideration begins (R4) | grade 3 (past T3) for REG-0 and REG-1; grade 2 (past T2) for REG-2 | fixed |
| Evidence grade required as demand evidence for incorporation (R3) | grade 4 (past M2) for REG-0 and REG-1; grade 3 for REG-2, whose representative sequence has no M2 | C |

---

### C.9 The value side

**Table C-23. Value-side coefficients.**

| Coefficient | Default | Grade |
|---|---|---|
| $\phi_u = \phi_0 + \phi_1 \kappa_{\mathrm{IP}}$ share parameter | $\phi_0 = 0.25$, $\phi_1 = 0.55$ | C |
| $\alpha_u$ **location-difference level** (from $L_u$ onward) | 0.85 — 15% is retained as contribution | C |
| $\alpha_u$ **evaluation-date deduction** (up to $L_u$) | a per-project investigation item; Tier-0 provisional value 0.30 | C |
| $L_u$ acceleration horizon | 36 months (the active-competition side of the settled pair; 120 months where no competitor is visible) | fixed |
| $q_k$ successor completion probability | M&A 0.75, licensing 0.60, IP sale 0.45 | C |
| $y_t$ sales before the production contract | as a share of the pre-incorporation burn rate by evidence grade 0–6: 0 / 0 / 0 / 0.10 / 0.35 / 0.80 / 1.00; $\times\,2.0$ post-incorporation. Represents paid proof-of-concept work, sample sales and initial shipments. Distinct from $\bar P_u$ and acting only on cash flow | C |
| $q_{\mathrm{self}}$ industry size where capital self-sufficiency is reached on contract and service income | 0.35 of the ceiling of the seed's own application | C |
| $\lambda^{\mathrm{obs}}$ obsolescence | 5.0% per year | fixed |
| $H_C$ continuation extension | 120 months; determines the continuation-value share directly | fixed |
| Ramp-up of an active application | 12 months, linear | fixed |
| Value discount by terminal form | M4 reached = the full tail; an offer = $q_k \times$ the delayed tail; capital self-sufficiency on recurring income = 0.35 × the tail; undecided continuation = 0.15 × the tail | C |

$y_t$ is placed and graded here but is **not read** by the reference implementation (A10).

The evaluation-date deduction is measured at elasticity 0.000 under Tier-0 defaults. The reason is
structural rather than numerical: with $L_u = 36$ months and mean time to M4 running 64 to 203
months, value accrues almost entirely beyond the acceleration horizon, so the coefficient acts only
on projects that reach market inside 36 months.

**Table C-24. The four routes taken when self-propulsion fails (revision N1).**
$\Delta V = w\,(\pi^{\mathrm{lic}} q^{\mathrm{lic}} \zeta + \pi^{\mathrm{cls}} q^{\mathrm{ma}})
\cdot \mathrm{tail}(t)$.

| Route | Base probability | Condition | Value | Grade |
|---|---|---|---|---|
| ① application pivot $\pi^{\mathrm{use}}$ | 0.35, times the share of untouched applications remaining | a technical gate has been cleared and $u_{\mathrm{left}} > 0$ | does not terminate; the computation continues from the head of the market gates with the failure history reset | C |
| ② exit-class conversion $\pi^{\mathrm{cls}}$ | **0.02** (from 0.20, approval #2026-08-29-3) | incorporated and evidence grade $\ge 4$ | $q^{\mathrm{ma}} \times$ the tail | C |
| ③ licensing fold-down $\pi^{\mathrm{lic}}$ | **0.05** (from 0.30, approval #2026-08-29-3) | evidence grade $\ge 3$ | $q^{\mathrm{lic}} \times \zeta \times$ the tail | C |
| ④ return of the rights to the institution $\pi^{\mathrm{ret}}$ | the remainder; always available | — | **zero**; a later revival by anyone is counted as a different project | fixed |
| $\zeta$ discount on a licence agreed after abandoning self-propulsion | 0.70 | — | — | C |

Routes ② and ③ are multiplied by the economic multiplier $m_\theta$ and the quiet-period multiplier
$m_q$; the evidence-grade thresholds are held fixed, because without evidence to show, no
counterparty appears however large the market. Below grade 2 only ① and ④ are available, which is
what stops early-stage projects from claiming exit value they cannot demonstrate. An incorporated
project that runs out of cash cannot take route ①, because liquidation proceedings intervene, and
that mass goes to liquidation. Branching occurs on three triggers: cumulative failures reaching
$k_{\mathrm{exit}}$, cash-out, or the R6 stop condition. A project already at zero cash on the
evaluation date, or one whose technology or demand has itself disappeared, takes none of the four
and falls to withdrawal.

**Table C-25. Fixed conventions shared by every project.**

| Convention | Value | Grade |
|---|---|---|
| $T$ evaluation horizon | 240 months | fixed |
| $d$ social discount rate | 2.0% per year, real; 1.0% and 4.0% always reported alongside | fixed |
| $C$ continuation form | perpetual: extend $H_C = 120$ months under default rules, then a perpetuity on the surviving active applications under the obsolescence hazard | fixed |
| Plan horizon separating the nine terminal classes | 60 months | C |
| M2 evidence expiry | confidence lowered at 18 months, grade reverted at 24 | fixed |
| M3 evidence expiry | 12 months | fixed |
| $\mathcal F$ granularity | eight functions; re-partitioning requires a version update with re-calibration | fixed |
| $m_n$ history multiplier | **fixed at 1** — state dependence cannot be separated from unobserved heterogeneity, and the internal ledger records zero rejected applications, so estimation diverges | not placed |
| Pre-incorporation advance rate while cash is near zero | $\times\,0.35$; expenditure is not deducted, being carried by the institutional base | C |

$m_n = 1$ is not a placement but a refusal to place. Putting an initial value on a quantity that
cannot be identified would leave an unidentifiable structure in the model carrying a number.

---

### C.10 Where the numbers came from

Award-rate observations are drawn from three 2025 public programmes: an industry–academia joint
programme (651 applications, 58 awards), a pioneering research programme (84 applications, 20
awards), and an entrepreneurship-support programme (166 applications, 31 awards). Regulatory review
durations come from published records: 10.8 months total review for standard-review drugs, and 11.4
and 11.7 months for standard-review new medical devices. University procedure defaults come from
two universities' published invention-notification and intellectual-property procedures. Internal
measurement supplies the award amount distribution across 51 awards — and **zero rejections**,
which is the reason $m_n$ is fixed at 1 — and four monthly profit-and-loss records, two of them
forward plans.

Four source obligations are declared outstanding at the frozen version and are to be discharged
before the next approval: the three award-count citations point at programme index pages whose
contents are replaced over time and must be repointed at fixed pages stating the results; the
phase-wise clinical durations and success rates must be added to the source list to confirm their
B grade; the licensing arrival rate must be repointed at the national industry–academia
collaboration survey, being grade C at present; and the award rates must be widened from one
fiscal year to a multi-year average.

---

### C.11 One-way levers: every C-grade coefficient with non-zero elasticity

A coefficient that a project can influence, that carries a provisional value, and that moves the
score in one direction is an opening. The complete list at the frozen version:

$M_g$ and the common multiplier $\mathrm{scale}$; $\phi_{\mathrm{base}}$; the collapsed
funding-window arrival rate; $\nu_k^{\mathrm{base}}$; $\nu_c^{\mathrm{base}}$; $\nu^{\mathrm{eq}}$;
$q_{\mathrm{lic}}$; both levels of $\alpha_u$; $\phi_0$ and $\phi_1$; $L_u$;
$\lambda^{\mathrm{comp}}$, $\lambda^{\mathrm{dem}}$, $\lambda^{\mathrm{core}}$;
$\lambda^{\mathrm{obs}}$; every cell of $d_{f,g}$ and $d_{\mathrm{other}}$; the four carrier
multipliers; $\kappa_{\mathrm{sup}}$ and $\kappa_e$; every step of $m_g$, $m_g^{\mathrm{offer}}$
and $m_g^{c}$; $\sigma$ and its multiplier table itself; the closeness bands of $\gamma$;
$p^{\mathrm{pass}}$; $\beta_i$; the unusable share of use-restricted funds; $\mu$; $r$; and
$\kappa_{\mathrm{IP}}$.

Per-project over-writing is admitted only where real data exists — committee calendars, actual
review durations, the competitive position. For $d_{f,g}$ the monitored operation is not the
individual cell but a uniform reduction across the primary-carrier cells, which is the form the
manipulation would take.

---

### C.12 The sixteen declared approximations

Placing a value and having it enter the computation are different things. The table below is the
complete register of the second: where the reference implementation substitutes, collapses, or
omits what the specification defines. The direction column states which way the score moves as a
result, where that can be said at all.

**Table C-26. Declared approximations A1–A16.**

| # | What the specification defines | What the reference implementation does | Direction |
|---|---|---|---|
| A1 | Two balances, free $s^{\mathrm{f}}$ and use-restricted $s^{\mathrm{r}}$, with separate burn, fiscal-year expiry $\ell_t$, and pre-incorporation contract earnings routed to the restricted side net of the 30% university indirect cost (revision 1-3) | Collapses the two into a single balance and treats the unallocatable portion as a 15% uplift on the burn rate; pre-incorporation contract earnings also enter the single balance, so the restricted/free distinction is lost | Not determinable — raising the burn and losing the distinction push opposite ways |
| A2 | $\chi_t$ carries the remaining lock-in months, the contracted monthly amount, the contracting entity and the closeness to the core business; plan rule R5 sets the effort share $\rho \le \rho_{\max}$ | Two contract states, with remaining lock-in approximated by an expiry hazard of mean 12 months; $\rho$ is always $\rho_{\max}$ | Neutral |
| A3 | $A_t$ admits contract-derived service applications, which carry value and act as the seed for a pivot | Handles active applications as an analytic tail after the M4 gate; contract-derived service applications carry no value | Understates value |
| A4 | Fourteen typed open rights-and-approval items (Tables C-16, C-17), each with its committee calendar, preparation period and per-round resolution probability, split by whether the institution has a dedicated intellectual-property function | Collapses the family to two open items at an average resolution rate of 0.18 per month | Neutral (elasticity −0.00) |
| A5 | The R2 stagnation reference is the 85th percentile of the two-stage gate duration distribution (revision K6) | Approximates automatic stagnation branching at the hazard position as $\Pr = (1-p^{\mathrm{adv}})\cdot 0.15\,p^{\mathrm{adv}}$, with no dependence on months elapsed | Neutral (elasticity −0.09) |
| A6 | One annual domestic value-added ceiling $\bar P_u$ per application, with displacement $\delta_u$ deducted (revision M1) | Normalizes the ceiling to 1; the output is a present value per yen of annual domestic net increase. Converting to yen requires multiplying by $\bar P_u - \delta_u$ | Convention |
| A7 | The score band is the 10th, 50th and 90th percentiles of $v(\theta)$ under the full prior $B_0$ | Produces the band on a grid over $c$, $\psi$, $\sigma$, $r$ (3×3×3×2 = 54 points) | Understates the band |
| A8 | Whether an arriving offer is accepted is decided by the registered plan; the R4 default fixes only the evidence grade $g^{*}$ at which consideration **begins** | Accepts every offer unconditionally, including where acceptance is disadvantageous | Biases the effect of the licensing arrival rate negative |
| A9 | Public funds paid as a lump at the start of the fiscal year, unused balance expiring at year end through $\ell_t$, a three-month lag on reimbursement-type disbursement, and a disbursement period | None of these; the whole award is added in the month of the award | Shows cash-out somewhat later than it occurs |
| A10 | Sales $y_t$ enter the free-cash transition of §4.2 and the capital self-sufficiency test of §4.5, on the stage profile of Table C-23 | Carries no $y_t$; treats reaching M4 as absorbing | Neutral (replaced by the tail) |
| A11 | Private funding arrives as an opportunity and must then close | Places no closing probability; arrival is treated as receipt | Overstates value |
| A12 | Funding windows are held as a dated list with amounts, new windows created at $\nu^{\mathrm{win}} = 0.10\,m_\sigma$ per month and removed at their dated final call; plan rules may condition on the list | Holds no list; collapses it to a constant arrival rate of 0.50 calls per month. $\nu^{\mathrm{win}}$ is not implemented | Neutral |
| A13 | The published total review period is the sum of the regulator's review time and the applicant's response time, which would be separated so that gate preparation excludes response time | Does not separate them, no source giving the split being available | Shows the review as longer |
| A14 | $\pi^{*}$, the best rule within the declared finite rule class, found by policy search and reported as its difference from the registered plan — the measurement of the timing-window requirement | No policy search; the too-early / too-late incorporation diagnosis is not produced | The diagnosis is missing |
| A15 | Gate advance carries technical-core validity $\psi$ on technical gates; revision K5 splits regulatory gates into preparation and review and treats preparation as institutional procedure rather than technical work | Regulatory-gate preparation carries no $\psi$ (clinical trials remain technical gates and do carry it) | Overstates REG-2 scores slightly |
| A16 | Value is summed over the set of applications $u \in A_t$ | Computes a single principal application, because summing per-application computations would count the same gate sequence more than once; other applications are reported separately for reference | Understates value, by dropping all but the principal application |

#### C.12.1 What is *not* an approximation

Carrier fill depends only on months elapsed since the evaluation date, so it is not carried in the
state; the expectation over all 64 vacancy patterns is pre-computed **exactly**, per month and per
gate. It appears in the same part of the implementation as several of the approximations above and
is recorded here so it is not mistaken for one.

#### C.12.2 Structural omissions that carry no approximation number

Eleven further gaps are recorded by the source of record as things the model does not represent.
They are distinct from A1–A16: an approximation substitutes for something the specification defines,
whereas these are absent from the specification as well, and closing them requires a model revision
rather than an implementation change.

1. Complementarity among vacancies. The product form $\prod(1-d_f)$ implies substitutability.
2. Liability of newness and the honeymoon period. The hazards are constant in months since incorporation.
3. Control of complementary assets — access to an incumbent's production capacity, distribution, or regulatory standing. Under consideration as a third axis for the next version.
4. The rule for whether to accept an offer (the specification side of A8).
5. $\pi^{*}$ and the incorporation-timing diagnosis (the specification side of A14).
6. Sales $y_t$ (the specification side of A10).
7. The unit-economics gate as a hard admission rule: normalizing the ceiling assumes it always passes.
8. Three of the reporting quantities the specification derives — $P_o(\theta)$, $Q(h)$, and "what to investigate next" — are not emitted.
9. $q_{\mathrm{pivot}}$. The application-pivot branch of R2 is not implemented, so one of the nine terminal classes is structurally zero.
10. The F3/F4 boundary is drawn on business model, which conflicts with the standing rule that process type is determined by the physics of what is made.
11. The industry size attributed to a project that reaches self-sufficiency on contract and service income ($q_{\mathrm{self}} = 0.35$) has no per-project investigation behind it: the requirement's route entered the computation but its value level remains a sector default.

Item 9 is worth separating out, because it is the one place where a zero in a reported table has no
entry in Table C-26: the pivot class reads 0.0% for a structural reason, not a measured one.

---

### C.13 Elasticities

> **Version caveat — read before any number in this section.** The source of record states
> explicitly, of the elasticities and the reporting bands, that they "remain the values measured
> on the implementation preceding the revision, and will be re-measured together with the
> re-calibration of the absolute level" (a note carried at the head of its verification section,
> under approval #2026-08-29-1). Both tables therefore predate the pre-incorporation speed
> rule and are **not** at the frozen version `a149fc30`, unlike every other table in this
> supplement. The revision that removed the pre-incorporation absorbing state raised score levels
> across all cells and broke the calibration of the common multiplier that had matched
> own-production attainment rates to external statistics; that re-calibration is outstanding.
> The main text (§7.6) relies on the **ordering**, not the magnitudes, and no claim in the paper
> rests on the absolute level of any figure below.

Every coefficient is swept by the same definition: the level is multiplied and divided by 1.1. One
exception is declared and is a correction to an earlier method. The retention factor $1-\alpha_u$
is swept rather than $\alpha_u$ itself, because $\alpha_u$ sits close to 1 and a multiplicative
sweep takes it outside its domain, collapsing value to zero and breaking the band. An earlier
version swept probability-type coefficients on the odds ratio while dividing by the same
denominator and calling the result an elasticity, which reported $\alpha$ at roughly one-sixth of
its true value and produced a different conclusion about calibration priority.

**Table C-27. Full elasticity table, F1 × REG-0, $\theta$ at its median. All 22 coefficients,
measured under one definition.**

| Coefficient | Elasticity |
|---|---|
| Base award rate $\phi_{\mathrm{base}}$ | **+1.43** |
| Funding-window arrival rate | **+1.43** |
| Common multiplier on gate durations $M_g$ | **−1.03** |
| Retained-contribution share $1-\alpha$ | **+0.96** |
| Obsolescence hazard $\lambda^{\mathrm{obs}}$ | −0.70 |
| Appropriability $\kappa_{\mathrm{IP}}$ | +0.67 |
| Share-parameter slope $\phi_1$ | +0.52 |
| Share-parameter intercept $\phi_0$ | +0.43 |
| Unusable share of use-restricted funds | −0.39 |
| Competitor-preemption hazard $\lambda^{\mathrm{comp}}$ | −0.28 |
| Successor completion probability $q_{\mathrm{lic}}$ | +0.22 |
| Demand-disappearance hazard $\lambda^{\mathrm{dem}}$ | −0.20 |
| Carrier supply rate $\kappa_{\mathrm{sup}}$ | +0.10 |
| Stagnation branching | −0.09 |
| Evangelist search rate $\kappa_e$ | +0.08 |
| Licensing offer arrival rate | **−0.04** |
| Vacancy of a non-primary function $d_{\mathrm{other}}$ | −0.03 |
| Contract-work arrival rate $\nu_c$ | −0.01 |
| Private-funding arrival rate $\nu^{\mathrm{eq}}$ | +0.00 |
| **Rights-resolution rate $\beta_i$** | **−0.00** |
| Acceleration horizon $L_u$ | 0.00 |
| Probability of zero self-propulsion | 0.00 |

One row needs its referent stated, because the name is shared with a coefficient that is not
implemented. The **funding-window arrival rate** swept here is the constant 0.50 calls per month
to which the dated window list is collapsed under A12 — not $\nu^{\mathrm{win}}$, the rate at which
new windows are created, which the specification defines and the implementation does not read.
The main text abbreviates the swept quantity as "window arrival" (§7.6).

The ordering is specific to F1 × REG-0 and changes by cell.

**Table C-28. Top six coefficients in three cells.**

| Rank | F1 × REG-0 | F3 × REG-0 | F1 × REG-2 |
|---|---|---|---|
| 1 | funding-window arrival +1.43 | funding-window arrival +1.32 | base award rate +1.50 |
| 2 | base award rate +1.43 | base award rate +1.32 | funding-window arrival +1.50 |
| 3 | $M_g$ common multiplier −1.03 | retained contribution +0.95 | **appropriability +1.09** |
| 4 | retained contribution +0.96 | obsolescence −0.70 | retained contribution +0.96 |
| 5 | obsolescence −0.70 | appropriability +0.59 | **successor completion +0.88** |
| 6 | appropriability +0.67 | $M_g$ common multiplier −0.58 | obsolescence −0.70 |

Five readings follow, and each carries a consequence.

**Funding access ranks first in every cell**, so it is where calibration must start. The two
coefficients concerned enter observation only as a product, which is the identification constraint
that also prevents the strict ordering of adjacent projects from being identified.

**Gate duration is not universally important.** The common multiplier on $M_g$ ranks third in
F1 × REG-0, sixth in F3 × REG-0, and eighth in F1 × REG-2 at −0.45. A framework that fixed a single
"speed matters this much" weight would be wrong in two cells out of three.

**In REG-2 the two coefficients ranking third and fifth are appropriability and the successor
completion probability**, and the latter is grade C with no external corroboration. The
least-verified coefficient in the table carries the second-largest effect in that regime, which is
one reason the source of record treated REG-2 cautiously.

**The rights-resolution rate has elasticity −0.00.** The quantity that technology
transfer practice discusses in the finest detail barely moves the score under these defaults, and
its calibration priority is set low accordingly. This is a result about the model under Tier-0
defaults, not a claim that rights work does not matter in the field.

**The licensing arrival rate has a negative elasticity, −0.04, and this is an artifact of A8.**
With $q_{\mathrm{lic}} = 0.60$ and every offer accepted, a higher arrival rate delivers more offers
that should have been declined. The sign is specific to REG-0: in F1 × REG-2 the same coefficient
is **+0.38**, because self-directed attainment is structurally near-impossible there and an offer
is the only exit. A negative sign that flips with the regime is the signature of a missing decision
rule rather than a property of the domain.

**Monotonicity.** All 22 coefficients were differentiated numerically at $\pm 10\%$ across
F1 × REG-0, F3 × REG-0 and F1 × REG-2, and **no sign reversal was detected**. The scope of that
statement should be read narrowly: it is a local perturbation at three representative cells, and it
is not a test designed to find the two reversal mechanisms the audit named — a faster gate leading
to earlier incorporation and so to higher fixed costs, and a higher contract-work arrival rate
leading to accepted contracts that slow advance where $\gamma > 0$.

One further measurement sits outside Table C-27 and is reported in the coefficient section rather
than the elasticity section: the **evaluation-date** counterfactual deduction has elasticity
**0.000** at Tier-0 defaults, for the horizon reason given under Table C-23. Table C-27's
retained-contribution row does not state which of the two $\alpha_u$ levels was swept; the source
of record reports 0.000 for the evaluation-date level.

---

### C.14 The bands used for reporting

The reported band is the signed bundle of the top five coefficients — each moved simultaneously in
the direction that lowers, then raises, the score. This is coefficient uncertainty, and it is a
different quantity from the parameter-ignorance band of the main text, which is the 10th/50th/90th
percentiles of $v(\theta)$ under $B_0$ (A7).

**Table C-29. Reporting bands from the signed bundle of the top five coefficients.** Subject to the
version caveat of §C.13.

| Cell | Pessimistic | Base | Optimistic |
|---|---|---|---|
| F1 × REG-0 | 0.017 | 0.173 | 0.755 |
| F3 × REG-0 | 0.044 | 0.301 | 1.172 |
| F1 × REG-2 | 0.006 | 0.061 | 0.334 |

**Table C-30. Convention sensitivity, F1 × REG-0.** Same version caveat.

| Convention | Low | Middle | High |
|---|---|---|---|
| Sector momentum $\sigma$ | headwind 0.078 | neutral 0.173 | tailwind 0.257 |
| Social discount rate $d$ | $d = 4\%$ → 0.110 | $d = 2\%$ → 0.173 | $d = 1\%$ → 0.224 |

Two reading rules apply to these tables. Values are read to two significant digits throughout,
because the coarseness of the $\theta$ grid (A7) dominates; grid-convergence error is bounded below
0.3% at the frozen version and is not the binding limit. And the score $V$ appearing in the
degenerate-cell check is a mixture over the 54-point $\theta$ grid, whereas the $V$ of the
convergence check is a single point at the $\theta$ median: the same symbol denotes different
quantities, and they must not be placed side by side. The source of record does not state which of
the two the bands in Table C-29 use.

---

### C.15 Quantities not specified at the frozen version

The following are absent by design or by state of collection, and are listed so that a reader does
not mistake silence for a value.

**Deliberately out of scope for the coefficient tables** — these are per-project investigation
items and cannot be set by a sector default: the willingness-to-pay caps $w_u$; the annual domestic
value-added ceilings $\bar P_u$; the displacement shares $\delta_u$; the production-cost floors
$\underline c_u$; the evaluation-date counterfactual deduction $\alpha_u$; the acceleration horizon
$L_u$ per application; and the per-project value of self-propulsion $r$.

**Not yet obtained**: the award rate for the municipal and foundation class, and the award amount
for the talent and entrepreneurship class (Table C-11).

**Deliberately not placed**: the history multiplier $m_n$, held at 1 until state dependence can be
separated from unobserved heterogeneity (Table C-25); and $m_n^c$, its counterpart on contract
arrival (Table C-15).

**Not separately stated by the source of record**: whether the bands of Table C-29 are computed at
the $\theta$ median or over the $\theta$ grid; which of the two $\alpha_u$ levels the +0.96
elasticity row of Table C-27 refers to; and the provenance grade of the pass probability, as
distinct from the preparation and review durations, in the two approval rows of Table C-6.

**Awaiting a firing project**: $d_{2,g} = 1.00$ returns to the calibration set only once a project
declares a vacant technical core; it does not fire at Tier-0 defaults (Table C-7).
