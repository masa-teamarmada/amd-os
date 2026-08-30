## SM-B. Gate table, carrier-function table, event-registry format, and plan-rule template

This section gives the complete operating-kit specification behind §4.4 and §6.1–§6.3 of the main text: the standard gate table, the carrier-function decomposition of DP9's $\mathcal F$, the event-registry format, and the plan-rule template. The kit was approved as a whole (approval #2026-08-24-11) and carried unchanged into the frozen model version `a149fc30` used throughout this paper; nothing in it was revised by the later approvals (#2026-08-29-1, -2, -3), which touched coefficient values and per-project inputs, not this structure. What the kit does not fix — the field-specific coefficient values that ride on top of it (gate base rates, award and arrival rates, vacancy delays, expiry windows), and the case-by-case migration of the builder's existing project ledger onto this structure — is separate work, reported in SM-C. All defaults given below are pre-calibration values, stated here to be recalibrated against the builder's realized distribution in a later release. Where the specification given here is not yet exercised by the current reference implementation, that is stated at the point where it matters, not smoothed over.

### SM-B.1 The standard gate table

#### SM-B.1.1 Gates versus observations

A **gate** is an externally verifiable event that advances the position of the observable state, $g_t$; passage may simultaneously update a project-parameter estimate, and which one is declared, gate by gate, in SM-B.1.2. An **observation** is an event that updates only a project-parameter estimate, the funding-window list, or a dated constraint — it never advances $g_t$. The distinction keeps "more evidence arrived" separate from "the project moved forward," and every passage definition below names the party whose action makes it externally verifiable — a peer-reviewed record, an independent replication, the governing authority's own decision, a buyer's payment or signature — so that no gate can be marked passed on the project's own declaration alone (§6.4 of the main text).

#### SM-B.1.2 Gate definitions

**Technical gates** (technical-core validity $\psi$ multiplies the advance probability). "Unit of a trial" fixes how evaluators count a failure (event type 10, the input to R2's branch count, SM-B.4.1); "primary carrier function" is a calibration correspondence — which function number from SM-B.2 the gate's advance is chiefly attributed to — not a computation rule: the carrier-fill factor $\eta_t$ is, regardless, the monthly product over *all* functions (§6.2 of the main text).

| Symbol | Gate | Passage definition (externally verifiable form) | Unit of a trial | Primary carrier function | What passage moves |
|---|---|---|---|---|---|
| T1 | Proof of principle | The claimed function has been demonstrated, under controlled conditions, in a form independently verifiable by a third party (a peer-reviewed paper, public data, a dated experimental record) | Completion of one pre-registered verification plan | 2 | $g_t$ advances; the estimate of $\psi$ |
| T2 | Replication | Reduced to a documented procedure and confirmed reproducible with a different experimenter or apparatus; third-party replication is the top evidence grade | One replication attempt with a different experimenter, apparatus, or institution | 2 | $g_t$ advances; the estimate of $\psi$ |
| T3 | Real-environment or real-scale validation | Performance confirmed under actual conditions of use (field deployment, continuous operation, real samples) or at increased scale (bench, pilot) | Completion of one period of real-environment or real-scale testing | 2 | $g_t$ advances; the estimate of $\psi$ (value does not yet accrue — see the notes below the market-gate table) |
| T4-* | Regulatory or certification gate | One gate per category defined by the governing authority's or certification body's own institutional structure — e.g., T4-Consultation, T4-Clinical-trial (by phase), T4-Application, T4-Approval, T4-Reimbursement-listing; T4-Standards-test for a REG-1 field. Splitting along the regime's own categories is not fragmentation (SM-B.1.4). Treatment splits in two: a *preparation* stage, loaded by conversion capacity $c$ and the carrier-fill factor $\eta_t$ but **not** by technical-core validity $\psi$; and a *review* stage, loaded by neither, advancing as a fixed countdown (the regulatory-review countdown $\varsigma_t$). Clinical trials are treated as a technical gate instead (loaded by $\psi$, $c$, and $\eta_t$): review length is not shortened by conversion capacity, but a trial's own duration and success depend on enrollment, site count, and protocol design. Durations and pass probabilities are coefficient values, given in SM-C | One regulatory application/review cycle | 6, 2 | $g_t$ advances. Approval or reimbursement-listing also raises the evidence grade of $w_u$ |

*Not loading $\psi$ on the T4-* preparation stage is itself a declared approximation of the reference implementation (A15, SM-C), and its direction is known: it biases REG-2 scores somewhat upward, because the preparation phase is not dragged down by technical-core validity the way T1–T3 are.*

**Market gates** ($\psi$ does not load; the symbol is indexed by application $\times$ buyer — e.g., M2$\alpha$-X = application $\alpha$, buyer X, paid proof-of-concept):

| Symbol | Gate | Passage definition | Unit of a trial | Primary carrier function | What passage moves |
|---|---|---|---|---|---|
| M2 | Completion of a paid proof-of-concept | A buyer, as an independent party, has paid consideration above a materiality threshold and completed the evaluation (a billing-and-payment record). Materiality: consideration exceeding half the true cost of the evaluation, or at least 5% of the project's annual burn rate. Nominal payment through a related party, an offset, or a round-trip does not count (the relationship is disclosed in the record). The burn rate used for this test is itself directly measured for only a minority of projects (§6.4 of the main text) | Completion of one paid proof-of-concept with one buyer | 3, 1 | $g_t$ advances; the $w_u$ grade moves to "paid proof-of-concept." No movement to the next grade within 18 months of passage lowers confidence; 24 months without progress pulls the grade back to "interest" (event type 12) |
| M3 | Production terms offered | The buyer has issued price, volume, and quality terms for production in a document bearing an authorized signature and a validity period (a term sheet or basic agreement). A non-binding verbal or internal document leaves the grade at "interest" | One round of terms negotiation with one buyer | 3, 6 | $g_t$ advances; the $w_u$ grade moves to "production terms." Expires after 12 months without progress (recorded under event type 12, which pulls the grade back) |
| M4 | Adoption decision or production contract | Execution of a production contract, or an adoption decision bearing a purchase-order number and an authorized signature. Whether a withdrawal clause exists is recorded | One round of contract negotiation with one buyer | 6, 4 | $g_t$ advances; the $w_u$ grade reaches its top. The application enters $A_t$ |

Notes on the market gates:

- Value — activity within $A_t$ — begins at M4, not at technical validation (T3): a technology that stands up but finds no buyer is not credited with value it has not realized. The specification carries the rise from M4 to full realization as a **ramp fraction** of $A_t$ (0 → 1, default linear over 12 months), applied to both value and sales, while the share parameter $\phi_u$ stays the time-invariant share fixed by appropriability — the ramp is deliberately not folded into $\phi_u$ (a closure check in the model specification, N-2). The current reference implementation does not run this ramp month by month: it has no sales term at all, treats M4 as absorbing, and values what follows analytically (§4.2 of the main text; declared approximations A3 and A10, SM-C).
- A document of expressed interest (e.g., a letter of intent) carrying neither payment nor a binding commitment is not a gate. It is recorded as an observation (event type 11) and moves only the $w_u$ grade to "interest." The missing number M1 is left open deliberately, to keep this line visible in the table.
- Verification of the production-cost floor is not itself a gate: it is recorded as process/cost information (event type 20) and feeds the estimate of the production-cost floor $\underline{c}_u$.
- Repetition and expansion of contract work — the primary growth path for F4/service projects — is recorded as an accumulation of contract events (event type 13) and enters the value side through the realization of the service application. It is not placed on the gate table; contracting is handled by the offer/award process, not the gate sequence.

#### SM-B.1.3 Process type and regulatory regime

Two dimensions are kept separate. **Process type** is set by the physical nature of what is being made; **regulatory regime** is held as an orthogonal attribute, so a medical device is F2 $\times$ REG-2, regenerative medicine is F1 $\times$ REG-2, and software as a medical device is F3 $\times$ REG-2 — combinations, not one axis. The production-cost floor and the required-outlay schedule are drawn from the physical type; the fixed review-period deadlines and the composition of the T4-* sequence are drawn from the regulatory regime.

| Type | Name | Character | Heavy gate |
|---|---|---|---|
| F1 | Process | Materials, chemical, or biological production; behavior changes non-linearly with scale-up; dependent on specialized equipment or plant | T3 (scale-up) |
| F2 | Device | Component integration and yield; the step from prototype to production design is the hard part | T3 (production trial) and M3 |
| F3 | Software | Capital-light, fast to verify; market gates, not technical gates, are the binding constraint | M2–M4 |
| F4 | Service | Measurement, analysis, or contract-work methods; growth is tied to contract-work earnings | M2 (arrives early) |

| Regulatory regime | Meaning | Effect on the gate sequence |
|---|---|---|
| REG-0 | No governing-authority pre-approval required | No T4-* gate |
| REG-1 | A standard or certification is required (a voluntary standard, an industry certification, an export certification) | A T4-Standards-test gate is placed for the relevant application |
| REG-2 | Governing-authority approval is the binding step (medical, regenerative medicine, functional-labeling foods, and similar fields) | A T4-* sequence is placed following the regime's own categories; the review period enters the observable state as a fixed-deadline duration |

Two caveats belong with this table, not smoothed into it. First, canon's own review of what the model does not represent flags that the F3/F4 boundary is, in practice, drawn along a business-model line — whether growth runs through repeated licensed or sold units, or through repeated contracted engagements — rather than strictly by the physical nature of what is produced, which is this table's own stated organizing principle. This is separate from, and additional to, the gaming concern already disclosed in the main text (§6.4): that process type is self-declared and that software and service types score materially better at Tier-0 defaults. Second, a third axis — control of complementary assets such as an incumbent's manufacturing, distribution, or regulatory standing — is named in canon as a candidate for a future version; it is not built, and the classification below is two-dimensional only.

#### SM-B.1.4 Entry and computation rules

1. A project's gate sequence is assembled by selecting from SM-B.1.2's gate types. The same gate type may be placed more than once for applications that are substantively distinguishable — by market, buyer, or specification. A duplicate placement without a substantive distinction is fragmentation (rule 2).
2. **Fragmentation rule.** A subdivision finer than the standard table (e.g., "preparation / execution / reporting" in place of one gate) is displayed as a deviation and, in computation, counted as at most one passage of the underlying gate type regardless of the subdivision. A project with an unapproved deviation outstanding cannot have its evaluation version finalized. Subdivisions that follow the regulatory regime's own categories (the T4-* sequence) are not fragmentation.
3. A gate not on this table may be proposed in the deviation log, in the externally-verifiable form required by SM-B.1.1; once approved, it is added to the standard table. Until approval, the nearest standard gate's base rate is used provisionally, and the substitution is displayed.
4. Rights and internal institutional approvals are not placed on the gate table — they are carried in the observable state as $R_t$, resolved by the rights/approval process described in the main text. Grant award is likewise not placed on the gate table: fundraising is replenishment, not advance.
5. **Correspondence to carrier functions.** Each row above carries a "primary carrier function" column naming the function number from SM-B.2 — a calibration correspondence declaration (which function's vacancy should be observed as delay on which gate), not a computation rule; $\eta_t$ is computed, per §6.2 of the main text, as the monthly product over all functions regardless.

### SM-B.2 Carrier functions (DP9's $\mathcal F$)

#### SM-B.2.1 The eight functions

The management team is decomposed into eight functions, extending a seven-function breakdown of the CEO/CTO title pair with one added market-facing function (Morgeson, DeRue and Karam, 2010, on functional views of leadership in teams, is the reference literature for this decomposition strategy; the correspondence between their fifteen team-leadership functions and the eight below is left to a later release — no claim of a completed mapping is made before that correspondence exists). The line between transferable and non-transferable follows whether a function can be put into words and handed to someone else.

| # | Function | Content | Transferable? | How a vacancy is filled |
|---|---|---|---|---|
| 1 | Evangelist function | Explains the significance and destination of the technology in a way that moves the judgment of buyers, investors, or reviewers. A function, not a title — anyone may hold it, and it may be combined with any other function | No | A search process (the fill prospect $e$ is its success probability) |
| 2 | Technical core | How far is established, and past what point the unknown begins; the feel for replication conditions, rooted in experience that cannot be fully written down | No | In principle, the researcher personally. A **permanent** loss (e.g., on transfer or retirement, with no return) is treated not as a delay but on the hazard side, as a dated constraint or loss — carried by the dedicated technical-core loss hazard $\lambda^{\mathrm{core}}$ (0.8% per year), not by the obsolescence hazard $\lambda^{\mathrm{obs}}$, which applies to active applications and is a different quantity. Where a project declares the technical core vacant on an observed loss, $\lambda^{\mathrm{core}}$ is switched off for that project so the same fact is not counted twice |
| 3 | Application and buyer development | Designing application hypotheses; selecting and developing buyers; judgment on unit economics and pricing terms | Yes | The AMD supply process |
| 4 | Final decision-making and accountability | Deciding to proceed, wait, or stop, and owning the outcome | Yes | The AMD supply process |
| 5 | Fundraising execution | Preparing materials, running meetings, closing terms | Yes | The AMD supply process |
| 6 | External negotiation and contracting | Negotiating terms with firms, investors, and institutions; contract execution | Yes | The AMD supply process |
| 7 | Organization building and operations | Hiring, labor administration, building internal systems (vacancy is the default before incorporation and is not penalized for it); and managing a research organization or joint-research partners | Yes | The AMD supply process, or an industry-liaison office, or a third-party carrier |
| 8 | (Extension slot) | Volume-production supply, quality, and similar functions, to be added by the extension procedure once needed at that stage | — | not specified in the current model version — this slot is currently empty |

Two constraints govern how this table may be used:

- **Fixed granularity.** Because the carrier-fill factor $\eta_t$ is a product taken over vacant functions, the decomposition's granularity itself moves the value it produces. This table fixes that granularity; splitting or merging functions is a version update accompanied by recalibration, and scores from versions with different granularity are not compared.
- **Unranked delays, with one exception.** The vacancy delay $d_f$ is constrained only by "the evangelist's delay $d_e$ is the largest" (fixed in the main text); the ranking of the other seven functions' delays is left as an *output* of the second-wave calibration rather than fixed in advance — fixing the order beforehand would make an ordering error undetectable under the constraint.

#### SM-B.2.2 Judging fill: recency, an evidence floor, and expiry

Function $f$ is **filled** in month $t$ only when all four of the following hold.

1. **Recency.** A working-record entry for that function (event registry type 15, SM-B.3.2) within the trailing 12 months. A 12-month gap reverts the function to vacant. Because inaction is not itself an event, this expiry check is applied mechanically at each evaluation-version update, not triggered by a record.
2. **Multiple time points.** For every function, working-record entries at two or more points at least three months apart are required; a single record made just before evaluation does not establish fill. A function with only one record is displayed as "fill expected" and treated as vacant when the evaluation version is finalized.
3. **An evidence floor, per function.** Evangelist — a record of external explanation in which the person was the one actually presenting (attending or being introduced does not count). Technical core — working evidence of experiments, technical judgment, or replication guidance. Application and buyer development — working evidence of buyer discovery or terms design. Final decision-making — a record of a decision taken in a governing body, together with owning its outcome. Fundraising — working evidence of applications, meetings, or terms negotiation. External negotiation — working evidence of negotiation or execution practice. Organization building — working evidence of hiring, labor administration, or building structure, or of operating a research organization.
4. **Provenance.** For the evangelist function, third-party testimony or the counterpart's own record (the other side's documents or minutes) is required, not merely recommended. For the other functions it is recommended; a record resting on self-report alone is carried at reduced confidence.

A title, a nominal appointment, or a stated intention never establishes fill — the same discipline applied to the fill prospect $e$ itself. Arrival and departure are each recorded as an independent type-15 event, so that the start and end of a vacancy spell can themselves be calibrated. The effect of a type-15 record is conditional: while a function is vacant, the record feeds *both* the relevant project-parameter estimate (e.g., $e$) *and* fill; once a function is already filled, the same record feeds only the continuation of fill. The same working record is never allowed to both release the vacancy delay $d_e$ and raise the estimate of $e$.

### SM-B.3 The event registry

Every observation an evaluator makes enters the registry as one typed row.

#### SM-B.3.1 Row format

| Column | Content |
|---|---|
| Event ID | A unique identifier (project ID + sequence number) |
| Date | The date of the occurrence, distinct from the date of recording |
| Type | One of the 24 types in SM-B.3.2 |
| Summary | One to two sentences; a fact that names its parties |
| Source tag | Document / meeting / third-party testimony / public information. Because university-committee decisions are frequently not public, the recording channel itself is written into the summary — e.g., a copy of a notice forwarded by the institution's liaison contact is recorded as "document," a verbal communication as "meeting" |
| Contracting party | Contract events only: university or company. Income received through the university is treated net of indirect-cost deduction and on the restricted side (the $s^{\mathrm{r}}$ equivalent); it does not enter free funds $s^{\mathrm{f}}$ |
| Target type | The observable state ($g_t$ advance / $R_t$ / $\chi_t$ / the ramp or exit of $A_t$ / $\iota_t$ / setting a dated constraint); a project parameter (naming which component's estimate); the funding-window list (addition or removal); or a rule (a plan-version update). When a pending item blocks a gate, a fundraising step, or incorporation, the link "pending-item ID $\to$ what it blocks" is recorded here |
| Effect | Passage confirmed / a change in an estimate's upper bound, lower bound, or confidence / a grade promotion or demotion / a committee-calendar update (next decidable month) |
| Recorder and evaluation version | Who recorded the event, and which evaluation version it was applied to |

#### SM-B.3.2 Event types (24)

*Funding and fundraising*

| # | Type | Primary effect |
|---|---|---|
| 1 | A public grant awarded | Replenishment $z^{\mathrm{r}}$; the history $n_t$ |
| 2 | A public grant application rejected | The history $n_t$ (a calibration input for the award rate $\phi$) |
| 3 | A public grant reduced or terminated at interim review | Replenishment halted; the history $n_t$ |
| 4 | The funding-window list updated (a call announced or revised, including a non-competitive intramural allocation — e.g., a GAP fund or a president's discretionary fund — becoming known) | The funding-window list |
| 5 | Private funding secured | Replenishment $z^{\mathrm{f}}$; the history $n_t$ |

*Rights and approvals (the institution's own clock)*

| # | Type | Primary effect |
|---|---|---|
| 6 | A rights/approval review submitted, continued, or remanded | Progress of the pending item; the next decidable month (committee calendar) — a calibration input for $\beta_i$ |
| 7 | A rights/approval resolved: employee-invention ownership determined; co-filing consent; licensing terms agreed (at term-sheet level before incorporation); conflict-of-interest approval; approval for concurrent outside employment (recorded as a separate procedure and calendar from conflict-of-interest); or a material-transfer agreement (MTA) | The observable state $R_t$ |
| 8 | A new pending rights/approval item identified | $R_t$ (addition); the link to what it blocks |

*Verification and market*

| # | Type | Primary effect |
|---|---|---|
| 9 | A stage-gate passage (T1–T4-*, M2–M4) | $g_t$ advances; the history $n_t$; the relevant project-parameter estimate; the $w_u$ grade. M4 additionally starts the ramp of $A_t$ |
| 10 | An unsuccessful verification trial (the unit of a trial is defined, gate by gate, in SM-B.1.2 — this keeps subdivision from entering on the failure side) | The history $n_t$ (an input to the R2 branch, SM-B.4.1); the estimate of $\psi$ |
| 11 | A documented expression of buyer interest (a letter of intent or a joint-evaluation agreement; no payment, not binding) | The $w_u$ grade "interest" (this is an observation, not a gate) |
| 12 | Withdrawal or expiry of demand evidence (a post-evaluation rejection notice; withdrawal of production terms; expiry after 12 months without progress; a buyer's staff turnover or purchasing-policy change that halts progress; a competitor's adoption) | Downgrade of the $w_u$ grade; exit of the application from $A_t$; the $\phi_u$ estimate |
| 13 | Execution, amendment, or expiry of a contract-work, joint-research, or paid-proof-of-concept agreement (records the contracting party, the monthly contract value, and closeness to the core business — same-origin / adjacent / unrelated) | The observable state $\chi_t$; realization of the service application (for F4 projects, repetition and multiplication accumulate here). The effect on gate advance ($\gamma$) depends on the closeness band (same-origin = 0). Data obtained through the contract work enters separately, on the evidence side |

*People and organization*

| # | Type | Primary effect |
|---|---|---|
| 14 | Incorporation, or the grant of an institutional venture designation (recorded as separate events; the designation is itself an observable that affects fundraising and outward communication) | $\iota_t$; a fixed-cost increase within $\mu^{\mathrm{f}}$; the funding-window list; the environment term of $e$ |
| 15 | A person's arrival, departure, or working record | Function fill and expiry (SM-B.2.2). For a currently-vacant function only, also the relevant project-parameter estimate (e.g., $e$) |
| 16 | A person's transfer, retirement, or graduation becomes known (a foreseeable event — a student's annual cycle, retirement — is recorded as a dated constraint; a sudden event — e.g., taking another position — is recorded as a departure) | A dated constraint; the function becomes vacant. A permanent loss of the technical core is handled on the hazard side |
| 17 | A change in laboratory or organizational staffing (students, postdocs, or joint-research arrangements) | The estimate of conversion capacity $c$; the burn-rate outlook |

*Environment, project parameters, and sales*

| # | Type | Primary effect |
|---|---|---|
| 18 | A competitor's filing, entry, withdrawal, or commercialization | The estimate of appropriability $\kappa_{\mathrm{IP}}$; of $\alpha_u$ / $L_u$ ($\lambda^{\mathrm{comp}}$ is a derived quantity from $\kappa_{\mathrm{IP}}$ and $\sigma$ and is never listed as a target — this prevents double updating) |
| 19 | Evidence of an application extension (only where third-party data, unit economics, and a path to the ceiling are all three present) | Addition to the application set (realization still begins only at M4) |
| 20 | Process/cost information (a measured cost from a scale-up trial, an equipment quotation, a yield figure) | The estimate of the production-cost floor $\underline{c}_u$; the outlay schedule $\mu_t$ |
| 21 | A sector-environment observation (a change in grant award rates or budgets, private investment levels, the two forms of legitimacy) | Sector momentum $\sigma$ |
| 22 | Re-estimation of a ceiling, a displacement share, or an acceleration schedule (market research, industry statistics, a competitive-landscape review) | The estimates of $\bar P_u$, $\delta_u$, $\alpha_u$ / $L_u$ |
| 23 | A status report (a non-event, opened automatically at every evaluation-version update; records months spent at each gate and what was invested in the meantime) | The estimates of $c$ and $\psi$ (months elapsed without passage are themselves likelihood information about the project parameters, so stalling can be penalized). Time stalled reaches the R2 branch only through $n_t$ |
| 24 | Revision of realized or projected sales for an active application (monthly sales or royalty receipts on record; an updated sales plan) | Sales $y_t$ (the ramp of $A_t$ is tracked separately). Enters the earnings side of the capital-self-sufficiency test |

#### SM-B.3.3 Cross-cutting rules

1. **One event, one entry.** When an event has more than one target, all of them are listed on the same row, and the same component is never hit twice by it. A derived quantity (e.g., $\lambda^{\mathrm{comp}}$) is never itself listed as a target.
2. **Evidence grade.** Promotion is the default; an explicit withdrawal or expiry event (type 12) demotes the grade, for that application and that buyer only. Production terms (M3) auto-expire after 12 months without progress. Independent evidence from multiple buyers within the same grade does not change the grade but does feed the level and confidence of $w_u$ — the breadth of demand is not discarded.
3. **Recording practice.** Sequential entry is the default, but a batch entry from contracts, meeting notes, and email at each evaluation-version update is permitted (dated by the date of occurrence, not the date of entry). A project with thin recording density (few entries in the trailing six months) is flagged "thin record" alongside its evaluation, and thinness is not read as evidence that the project itself is deteriorating. For a thin-record project, the expiry judgment for function fill (SM-B.2.2) is suspended, and a current-status entry (type 15 or 23) is required before the evaluation version is finalized — so that a project that has merely gone unrecorded is not, on that account alone, scored as vacant or stalled.
4. When the right granularity for an entry is unclear, cut at the unit that "could be explained to an external third party as one fact."

### SM-B.4 The plan-rule template

#### SM-B.4.1 The six-item finite-choice branch (R1–R6)

The plan rule $\pi^{\mathrm{plan}}$ is registered from a finite menu across six items; free text is not permitted. A rule may condition only on information observable at time $t$ — the observable state $x_t$, the funding-window list, and contract terms (Revision 1-5) — and never on the project parameters $\theta$, which no party observes. The funding-window list itself is, in the current reference implementation, collapsed into a constant arrival rate (declared approximation A12, SM-C); the items below that condition on named calls (R1's sequencing relative to a specific window, and R3's and R6's funding-window tests) are specified in full here but not yet exercised by that implementation (§4.4 of the main text).

| Item | Choices | Tier-0 default (pre-calibration) |
|---|---|---|
| **R1** Gate order | Selected and sequenced from the standard gate table (SM-B.1); the optimal policy $\pi^{*}$ used for diagnosis holds R1 fixed at the registered choice | The standard order by process type $\times$ regulatory regime. F1/F2: T1$\to$T2$\to$T3$\to$M2$\to$M3$\to$M4. F3/F4: T1$\to$T2$\to$M2$\to$T3$\to$M3$\to$M4. Representative order for REG-2: T1$\to$T2$\to$T4-Consultation (may run parallel with T2) $\to$T3 (a validation that doubles as a clinical trial is recorded as T4-Clinical-trial) $\to$T4-Approval$\to$(T4-Reimbursement-listing)$\to$M3$\to$M4 — R4's default of "after T2" falls, on this order, before entry into governing-authority review |
| **R2** Failure branching | Branches on the count of unsuccessful trials (event type 10; the unit of a trial is defined gate by gate in SM-B.1.2). Reaching $k_{\mathrm{pivot}} \in \{1,2,3\}$ triggers consideration of an application pivot; reaching $k_{\mathrm{exit}} \in \{2,3,4\}$ branches into the four routes (§4.5 of the main text; Revision N1), with $k_{\mathrm{exit}} > k_{\mathrm{pivot}}$. **Automatic branch on stalling:** time stalled at the same gate exceeding twice the expected months-to-passage counts the same as one unsuccessful trial. The expected months-to-passage is computed, when the evaluation version is finalized, as the median of $1/p^{\mathrm{adv}}$ under the evaluation-date prior $B_0$ (the gate-advance hazard of §4.5 of the main text — full expression in SM-A — including the contract-work drag term $(1-\gamma\rho_t)$), and is then held fixed as a constant for that version — the rule itself is not conditioned on the project parameters; this $B_0$-dependence is declared as part of the rule, and the threshold updates only when the version changes. Time stalled feeds only the history $n_t$; a project-parameter estimate is affected only through the status-report event (type 23), which prevents double counting | $k_{\mathrm{pivot}} = 2$; $k_{\mathrm{exit}} = 3$ |
| **R3** Incorporation condition | Incorporate once both "demand evidence" and "a funding prospect" are established. Demand evidence $\in$ {completion of a paid proof-of-concept (default) / production terms offered / technology-first (proceeding without waiting for demand evidence)}. The funding prospect is source-indifferent: any one of the following observable events suffices — a public grant awarded; investment terms agreed (including a form in which an equity round's terms are set together with incorporation); a sales or contract-work agreement (judged by its monthly value, Revision 1-3); or founding capital secured (a subscription agreement) | Demand evidence = completion of a paid proof-of-concept; funding prospect = source-indifferent. (An earlier four-option draft of this rule is absorbed as special cases of this same two-condition pair. An earlier "zero pending rights" default is not used, because it creates a closed loop in which a license can only be signed after incorporation; rights are instead recorded at term-sheet level under event type 7) |
| **R4** Response to realization offers | The gate $g^{*}$ at which consideration of an offer begins: $g^{*} \in \{$after T2 / after T3 / after the field's main gate / always$\}$. (The response itself — licensing, M&A, or IP sale — is realized among the terminal classes described in the main text; R4 governs only the timing at which consideration opens) | REG-2: after T2 (licensing out is, by default, permitted before entry into governing-authority review); otherwise: after T3. A score with $g^{*}$ shifted one gate earlier and one gate later is reported alongside the registered choice |
| **R5** Contract-work policy | An effort cap $\rho_{\max} \in \{0.15, 0.3, 0.5, 0.7\}$; a floor for accepting work, by monthly contract value, $\in \{0,$ 10% of the burn rate, 30% of the burn rate$\}$ | F4: $\rho_{\max}=0.5$; other types: $0.3$. Floor: 10% of the burn rate |
| **R6** Stop condition | Branches into the four routes (§4.5 of the main text; Revision N1 — probability mass is not collapsed into one terminal state) once remaining runway in months falls below $\underline{h} \in \{3,6,9,12\}$ **and** no funding window on the current list could be awarded and disbursed within that remaining runway | $\underline{h} = 6$ |

Registration notes:

- A choice departing from default is displayed, at registration, as a deviation from default, with a one-line reason recorded.
- A rule change is itself recorded as an evaluation-version update (event type "rule"); rules are not rewritten retroactively.
- A default can smuggle direction into a diagnosis — e.g., where the incorporation condition is set becomes the baseline against which "too early" or "too late" is judged. An evaluation run on unmodified Tier-0 defaults carries "by Tier-0 default" in its diagnosis, and default values are to be recalibrated in the second wave to the median of the builder's own realized distribution.

Three implementation gaps bear directly on this table and are stated here, not left to be inferred:

- **R2's pivot branch is not implemented.** The application-pivot branch at $k_{\mathrm{pivot}}$ does not run in the reference implementation; the pivot terminal class is, at present, structurally unreachable in output. This is distinct from the four exit routes at $k_{\mathrm{exit}}$, which are implemented.
- **R4's offer-acceptance decision is not implemented.** The reference implementation accepts every realization offer once consideration opens at $g^{*}$; whether to accept is not yet a modeled choice (declared approximation A8, SM-C; Table 2, DP8 in the main text). R4 as specified above governs only the timing of consideration, and only that part is exercised today.
- **R6's funding-window test runs on a proxy today.** Because the reference implementation carries no live per-window list (approximation A12), the "no window could be awarded and disbursed in time" leg of R6 is evaluated in practice as: expected award probability $\times$ remaining months $< 0.30$ (evidence grade C, provisional; coefficient detail in SM-C).

#### SM-B.4.2 Tier 0: unregistered projects

A project with no registration on file is fully defined by choosing only its process type (F1–F4) and regulatory regime (REG-0–2); SM-B.4.1's default column then stands as its plan rule without further input. Every project therefore has a defined score, and deviations from these defaults are displayed rather than hidden (§4.4 of the main text).

#### SM-B.4.3 The diagnostic grid and registration governance

> **Implementation status.** The mechanism this subsection specifies — searching for the optimal policy $\pi^{*}$ and reporting its gap to the registered plan $\pi^{\mathrm{plan}}$ — is not implemented in the reference implementation. No run currently computes $\pi^{*}$, so the diagnosis this subsection defines cannot yet be reported for any project (declared approximation A14, SM-C; Table 2 of the main text lists DP4's status as "diagnosis pending" for exactly this reason). What follows is the specification this mechanism must satisfy once built; it is given here in full because this appendix's purpose is a replicable format, not a report of current output.

- **The grid** is the direct product of SM-B.4.1's choice sets, with R1 held fixed. Because $\pi^{\mathrm{plan}}$ is, by construction, always a point inside this grid, $V(\pi^{*}) \ge V(\pi^{\mathrm{plan}})$ is guaranteed once $\pi^{*}$ is computed, so "the gap between the registered plan and the optimum" can never come out negative.
- **$\pi^{*}$** is defined as the conditional optimum over R3, R4, and R5 *only*, holding R1 fixed and — this is deliberate — holding R2 (the failure threshold) and R6 (the stop condition) fixed at the registered plan's own values as well. The reason: the scenario value $\Pi$ carries no cost term, so if the exit levers were included in the search, the optimal rule would always be pushed to the most persistent setting available, and the diagnosis would lose its content (a closure check on the main model). Restricting the search this way preserves the diagnosis of incorporation and offer/contract timing (R3/R4/R5) that DP4 exists to measure.
- **Division of labor.** The plan rule is registered by AMD, but approved by someone other than the project's primary evaluator. A non-default choice requires a recorded reason.
- A project where $\pi^{\mathrm{plan}}$ and $\pi^{*}$ diverge by more than a threshold (not yet set — a second-wave item, expected to be stated relative to the score's own reported band) is flagged for review before the score is finalized.
- Because loosening the stop threshold $\underline{h}$ or the failure threshold $k$ moves the score in one direction only — looser always scores higher — a registration looser than default requires a recorded reason and approval.
