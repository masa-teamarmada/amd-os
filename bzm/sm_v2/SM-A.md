## SM-A. Notation and complete model equations

### A.0 Scope, sources, and reading rules

This section carries the complete symbol inventory and the complete set of equations of the evaluation framework at the model version frozen for this paper (main commit `a149fc30`; approvals #2026-08-29-1, -2 and -3, together with the input-placement corrections of 29 August 2026). The freeze record itself is in SM-G.

The division of labour across the supplement is as follows. SM-A gives the objects, the equations, and the order in which they resolve. Coefficient values, their provenance grades, the elasticity tables, and the sixteen declared approximations A1–A16 are in SM-C. The standard gate table, the carrier-function decomposition, the event-registry format, and the plan-rule template are in SM-B. The calibration plan and the identification constraints are in SM-F. Where a numerical constant is quoted below it is quoted because it is a *convention* fixed in the model definition — the horizon, the discount rate, the extension length, the ramp — and not because it is a measured output.

Four reading rules govern the whole section.

**Specification and implementation are distinguished at every equation.** Each equation is stated in the form the specification defines. Wherever the reference implementation substitutes, collapses, or omits a term, the divergence is named on the spot with its approximation identifier (A1–A16) or, where the model canon records the item as simply absent, as an unimplemented element. The paper's honesty rule — a coefficient placed is not a coefficient at work — applies equally to equations: an equation written here is not thereby an equation exercised. Section A.12 indexes every divergence in one place.

**Units.** All money is real yen at the evaluation date; the ceiling growth rate is zero by default, and any non-zero value would have to be made consistent with the growth term in the Ramsey decomposition behind $d$. Time is monthly throughout. Tabulated hazards are annualized continuous-time rates and convert as monthly rate $=$ annual rate $/12$.

**Normalization.** Under approximation A6 the reference implementation normalizes each application's annual net increase to unity, so a computed score carries units of present value per yen per year of net domestic value added; converting to yen requires multiplying by the application's own $\bar P_u - \delta_u$. Every equation below is written in the unnormalized yen form of the specification.

**Cross-references.** The model canon numbers the subsections of its model definition §5.1–§5.11 and refers to them internally by their trailing digit — its closure table writes "§2" for §5.2, "§4" for §5.4, and so on. Table SM-A.1 reproduces those declaration and use sites in the canon's own notation, so a reader checking SM-A against the canon can follow the pointers without translation; the right-hand column maps each to the subsection of SM-A that carries the equation.

---

### A.1 The complete symbol table

Table SM-A.1 reproduces the closure table of the model canon (§5.10). Its closure claim is that every quantity appearing in an equation appears in the table, and every quantity in the table appears in an equation or a process definition. The claim holds for the rows below. It does not hold for the whole model as frozen: five groups of symbols that do appear in equations are absent from the canon's closure table, and they are listed separately in Table SM-A.2 rather than silently folded into Table SM-A.1.

**Table SM-A.1. Symbols, with declaration and use sites.** Section references in the "declared" and "used" columns are to the model canon's internal numbering of its model definition (§2 = §5.2, §3 = §5.3, and so on).

| Symbol | Reading | Declared | Used | Here |
|---|---|---|---|---|
| $t,\ T$ | month index; evaluation horizon ($T = 240$ months, a convention shared across projects) | §2 | §2–§8 | A.2 |
| $x_t = (g_t, s^{\mathrm{f}}_t, s^{\mathrm{r}}_t, R_t, \iota_t, \chi_t, A_t, n_t, \varsigma_t)$ | the observable state | §2 | §4–§8 | A.2 |
| $g_t$ | the next stage gate | §2 | §4–§8 | A.2 |
| $s^{\mathrm{f}}_t,\ s^{\mathrm{r}}_t$ | free and use-restricted cash balances (yen) | §2 | §2, §5 | A.2, A.3 |
| $R_t$ | the unresolved rights and approvals, each with its committee calendar | §2 | §4, §5 | A.2, A.5 |
| $\iota_t$ | the incorporation flag | §2 | §2, §5, §6 | A.2, A.3 |
| $\chi_t$ | the state of any contract-work lock-in | §2 | §2, §4 | A.2, A.5 |
| $A_t$ | the set of active applications — uses that have passed their market gate and are generating value | §2 | §2, §5, §7 | A.2, A.9 |
| $n_t$ | the history of attempts | §2 | §4, §5, §6 | A.2, A.5 |
| $\varsigma_t$ | a regulatory-review countdown | §2 | §4, §5 | A.2, A.5 |
| $\mu^{\mathrm{f}}_t,\ \mu^{\mathrm{r}}_t$ | burn on the free / restricted account | §2 | §2, §5 | A.3 |
| $y_t$ | sales | §2 | §2, §5 | A.3 |
| $z^{\mathrm{f}}_t,\ z^{\mathrm{r}}_t$ | funding inflows to each account | §2 | §2, §4 | A.3 |
| $\ell_t$ | fiscal-year expiry of use-restricted funds — the portion that cannot be carried over | §2 | §2, §5 | A.3 |
| $\rho_t$ | the share of effort committed to contract work ($0 \le \rho_t \le 1$; set by $\chi_t$) | §2 | §2, §4 | A.3, A.5 |
| $\rho_t\, r$ | contract earnings for the month | §2 | §2, §5 | A.3 |
| $\lambda^{\mathrm{obs}}$ | obsolescence hazard, running over the whole active life of an application | §2 | §2, §5, §7 | A.2, A.9, A.10 |
| $\theta = (c, e, \sigma, \tau_{\mathrm{proc}}, \psi, \kappa_{\mathrm{IP}}, \{w_u\}, \{\bar P_u\}, \{\delta_u\}, \{\alpha_u(\cdot)\}, \{L_u\}, \{\underline{c}_u\}, r)$ | the project parameters | §3 | §4, §7, §8 | A.4 |
| $c$ | conversion capacity | §3 | §4 | A.4 |
| $e$ | the fill prospect of the evangelist function | §3 | §4 | A.4 |
| $\sigma$ | sector momentum | §3 | §4, §5 | A.4 |
| $\tau_{\mathrm{proc}}$ | process type | §3 | §4, §7 | A.4 |
| $\psi$ | technical-core validity | §3 | §4 | A.4 |
| $\kappa_{\mathrm{IP}}$ | appropriability | §3 | §4, §5, §7 | A.4 |
| $\{w_u\}$ | willingness-to-pay caps, carried with an evidence grade | §3 | §7 | A.4 |
| $\{\bar P_u\}$ | annual domestic value-added ceilings, one number per application | §3 | §4, §7 | A.4, A.9 |
| $\{\delta_u\}$ | displacement — the annual domestic value added lost by incumbent activity, in the same units as $\bar P_u$ | §3 | §4, §7 | A.4, A.9 |
| $\{\alpha_u(\cdot)\}$ | counterfactual schedules | §3 | §7 | A.4, A.9 |
| $\{L_u\}$ | acceleration horizons ($L_u = 36$ months by default) | §3 | §7 | A.4, A.9 |
| $\{\underline{c}_u\}$ | production-cost floors | §3 | §7 | A.4, A.9 |
| $r$ | self-propulsion (yen per month at full effort commitment) | §3 | §2, §4 | A.3, A.4 |
| $B_0(\theta)$ | the prior over project parameters | §3 | §8, §9 | A.4, A.11 |
| $\kappa_g$ | gate coefficients — the base speed of gate $g$ | §4 | §4 | A.5 |
| $\eta_t$ | the carrier-fill factor | §4 | §4, §5, §6 | A.5 |
| $d_{f,g}$ | gate distance — the delay coefficient of a vacancy in function $f$ at gate $g$ | §4 | §4 | A.5 |
| $\mathcal F$ | the gate family — the decomposition of carrier functions | §4 | §4 | A.5 |
| $\gamma$ | drag term — the degree to which contract work slows gate passage | §4 | §4 | A.5 |
| $\phi$ | award rate | §4 | §5 | A.5 |
| $\nu^{\mathrm{win}}$ | window-arrival rate | §4 | §5 | A.5 |
| $\nu_k$ | offer-arrival rates, $k \in \{\text{licensing}, \text{M\&A}, \text{IP sale}\}$ | §4 | §5 | A.5 |
| $\nu_c$ | contract-arrival rate | §4 | §5 | A.5 |
| $\beta_i$ | the resolution rate of rights-or-approval item $i$, by item type | §4 | §5 | A.5 |
| $\psi_g$ | gate-specific technical-core loading | §4 | §5 | A.5 |
| $t_q,\ m_q$ | the quiet period and its multiplier | §4 | §4, §7-2, §3 | A.4, A.5, A.7 |
| $\lambda^{\mathrm{comp}},\ \lambda^{\mathrm{dem}}$ | competitor-preemption and demand-disappearance hazards | §5 | §5 | A.5, A.6 |
| $\pi^{\mathrm{plan}}$ | the registered plan | §6 | §7, §8 | A.4, A.6 |
| $\pi^{*}$ | the optimal policy within the declared rule class | §6 | §7, §8 | A.11 |
| $\Pi(\omega)$ | the value of scenario $\omega$ | §7 | §7, §8 | A.9 |
| $d$ | the social discount rate ($d = 2.0\%$ per year, real) | §7 | §7 | A.9 |
| $\phi_u$ | the share parameter — the fraction of an application's annual domestic value added the project system can bring into being | §7 | §7 | A.9 |
| $C(x_T, \theta)$ | the continuation term | §7 | §7, §8 | A.10 |
| $m_u = w_u - \underline{c}_u$ | the unit margin | §7 | §4, §7 | A.5, A.9 |
| $v(\theta)$ | the value conditional on project parameters | §8 | §8 | A.11 |
| $V$ | the score | §8 | §8 | A.11 |
| $q_o$ | terminal-class probabilities | §8 | §8 | A.8, A.11 |
| $P_o$ | path probabilities — the value of a scenario conditional on its terminal class | §8 | §8 | A.11 |
| $Q(h)$ | history multiplier — the cumulative probability of reaching capital self-sufficiency by elapsed month $h$ | §8 | §8 | A.11 |

**Table SM-A.2. Symbols that appear in equations but not in the canon's closure table.** The canon's closure table was written at the model definition of 24 August 2026 and has not been extended for the amendments N1 (the four routes), N2 (the economic multiplier), the private-funding arrival rate, the permanent-loss hazard on the technical core, or the permanent form of the continuation term settled in the canon's operating kit. Every symbol below is defined in the canon, and every one is used in an equation reproduced in this section; none of them is in the closure table. We list them rather than quietly extending Table SM-A.1, because the discrepancy is a property of the frozen version and a reader reconstructing the model from the canon alone will meet it.

| Symbol | Reading | Defined in the canon at | Here |
|---|---|---|---|
| $p^{\mathrm{adv}}_t,\ p^{\mathrm{award}}_w,\ p^{\mathrm{offer}}_{k,t},\ p^{\mathrm{offer}}_{c,t},\ p^{\mathrm{res}}_{i,t}$ | the monthly draw probabilities of gate advance, award, realization offer, contract offer, and rights resolution | §5.4 | A.5 |
| $m_\theta$ | the economic multiplier — the loading of the ceiling and the unit-margin flag on award and private-funding rates | §5.4 (amendment N2) | A.5 |
| $P^{\mathrm{ref}},\ \beta_P,\ \beta_m,\ \underline m,\ \overline m$ | the reference ceiling; the ceiling loading; the unit-margin uplift; the bounds on $m_\theta$ | §5.4, values in the operating kit | A.5 |
| $\nu^{\mathrm{eq}}$ | the arrival rate of private funding offers; defined only after incorporation | §5.4 | A.5 |
| $\lambda^{\mathrm{core}}$ | the hazard of permanent loss of the carrier of the technical core | operating kit §6.I-7 only | A.6 |
| $\pi^{\mathrm{use}},\ \pi^{\mathrm{cls}},\ \pi^{\mathrm{lic}},\ \pi^{\mathrm{ret}}$ | the four routes taken when self-propulsion fails, summing to one | §5.7-2 (amendment N1) | A.7 |
| $q^{\mathrm{lic}},\ q^{\mathrm{ma}},\ \zeta,\ w,\ \mathrm{tail}(t)$ | successor completion probabilities; the fold-down discount; the probability mass reaching the branch; the forward value from the branch point | §5.7-2 | A.7 |
| $H_C,\ Y_t,\ \bar y_u,\ \mathrm{Ann}(\cdot),\ \pi^{0},\ h$ | the extension length; the monthly net increase; the surviving per-application monthly net increase at the end of the extension; the residual perpetuity factor; the Tier 0 default rule set; elapsed months past $T$ | operating kit §6.E-3 | A.10 |
| $k_{\mathrm{pivot}},\ k_{\mathrm{exit}},\ \underline h,\ g^{*},\ \rho_{\max},\ a$ | the plan-rule thresholds: pivot count, exit count, months of runway, offer-consideration gate, effort cap, applications per month | plan-rule template (SM-B) | A.6 |

---

### A.2 Time and the observable state

Time advances monthly from the evaluation date, $t = 0, 1, \dots, T$, with $T = 240$ months. The horizon is a convention, applied identically to every project and never derived from a project's own circumstances; value arising beyond it is carried by the continuation term of A.10. The horizon can be a convention only because the decay of the value tail is governed by discounting and by the obsolescence hazard rather than by where the horizon is cut, which is why every report states the split between value realized inside $T$ and value carried by $C$.

The observable state is the nine-tuple

$$
x_t = \big(g_t,\ s^{\mathrm{f}}_t,\ s^{\mathrm{r}}_t,\ R_t,\ \iota_t,\ \chi_t,\ A_t,\ n_t,\ \varsigma_t\big).
$$

**$g_t$, the next stage gate.** The position of the project in the standard gate table (SM-B): the gate it must next pass. Gates are defined only by externally verifiable events. Passage advances $g_t$ and may simultaneously update parameter estimates, but the two effects are declared separately in the event registry so that one fact is not counted twice.

**$s^{\mathrm{f}}_t$ and $s^{\mathrm{r}}_t$, the two cash balances, in yen.** Free funds carry no restriction on use. Use-restricted funds — public grants above all — may be applied only to eligible expenditure and may expire at the fiscal year end. Months of runway, $s_t / \mu_t$, is a derived display quantity, not a state component.

**$R_t$, the unresolved rights and approvals.** The set of open items — invention ownership, joint-filing consent, licence terms, conflict-of-interest and outside-work approvals — each carried with its progress and with the committee calendar that governs when a decision can be issued at all. Open items block the gates, the funding events, the incorporation decision, and the offer acceptances to which they are tied.

**$\iota_t$, the incorporation flag.** Binary. Incorporation is not a dated plan item but the consequence of a rule (A.6); the flag records whether that rule has fired.

**$\chi_t$, the contract-work lock-in.** Whether a contract is running, the months of commitment remaining, the share of effort committed $\rho$, the monthly contract amount in yen, the contracting entity (university or company), and the proximity of the work to the project's own technology (same-source, adjacent, unrelated). The lock-in changes only on contract events; effort commitment cannot be varied freely month by month while a contract runs.

**$A_t$, the set of active applications.** An entry application joins on passage of its market gate — the adoption decision or production contract — and reaches its full rate through a ramp (0 to 1, linear over twelve months by default). Extension applications join on a documented extension event; realized contract work joins as a service application, which is the mechanism by which contract earnings can become an industry. Two exits operate: event-driven exit on demand disappearance, contract termination, or withdrawal of the evidence, and stochastic exit at the obsolescence-and-substitution hazard $\lambda^{\mathrm{obs}}$ (an annual rate; distinct from $\lambda^{\mathrm{dem}}$, which kills demand for the project as a whole). Both value and sales arise only over this set.

**$n_t$, the history of attempts.** The summary of trials and outcomes at each gate and of award decisions. Plan rules may condition on it.

**$\varsigma_t$, the regulatory-review countdown.** Undefined until an application is filed; once filed it decrements by one each month and the gate resolves at zero. It is neither a dated constraint (the date is not known in advance) nor a waiting time driven by a hazard (once started, the duration is determined), which is why no other state component can carry it.

Dated constraints — final calls, tenure and retirement clocks, rights expiries, fiscal year ends — enter the state as constraints effective in their month, not as hazards, because their dates are known.

---

### A.3 The cash transition

The two balances evolve as

$$
s^{\mathrm{f}}_{t+1} = s^{\mathrm{f}}_t - \mu^{\mathrm{f}}_t + \rho_t\, r + y_t + z^{\mathrm{f}}_t,
\qquad
s^{\mathrm{r}}_{t+1} = s^{\mathrm{r}}_t - \mu^{\mathrm{r}}_t + z^{\mathrm{r}}_t - \ell_t .
$$

$\mu^{\mathrm{f}}_t$ and $\mu^{\mathrm{r}}_t$ are the month's burn on each account, drawn from the project's expenditure schedule; fixed costs raise $\mu^{\mathrm{f}}$ after incorporation, and expenditure eligible for restricted funds is allocated to $\mu^{\mathrm{r}}$ first. Only expenditure that the project funds from what it has itself raised is counted; salaries, facilities and overhead borne by the university are outside the boundary. Where a person on a university appointment works partly for the company, the apportionment must be recorded in the registry and only the apportioned share of full cost enters $\mu$; absent that record the conservative default is to treat the cost as university-borne and exclude it.

$\rho_t r$ is contract earnings for the month, the product of the effort share committed and self-propulsion. Contract income received through the university is treated net of institutional overhead and credited to the restricted side, so it does not enter free funds; only company-side contract income does. $y_t$ is sales from active applications — own implementation and licensee royalties — scaled by the ramp; it is a cash-flow quantity and is deliberately not the same object as the industrial value added $\bar P_u$. $z^{\mathrm{f}}_t$ and $z^{\mathrm{r}}_t$ are the month's inflows, private funding to the free account and public awards to the restricted account. $\ell_t$ is the fiscal-year-end expiry of restricted funds that cannot be carried forward.

One bookkeeping rule governs the pair and is stated as a rule because it is easy to violate in one direction only: balances and the outlays they fund must be recorded on the same side. Excluding a restricted grant from the balance while leaving the expenditure it funds inside the burn rate misstates runway by an order of magnitude, and in the direction that makes a project which has just won a large grant look as though it is burning nothing.

**Running out of cash is treated differently before and after incorporation.** Before incorporation ($\iota_t = 0$) there is no cash-out terminal state at all. While the project's own funds cover the month's expenditure it advances at its normal rate; while they are effectively exhausted the *rate of advance falls* — by a factor of $0.35$ at the current pre-calibration setting — with running costs carried by the institutional base and therefore not deducted, applications for public funding continue, and an award restores the original rate. The relation between funds and speed is deliberately a two-level step rather than a continuous function: there is no material from which to calibrate a continuous form, and the things money buys at this stage — hiring a person, buying equipment and consumables — arrive in steps. The rule that stops self-propulsion (R6 in the plan-rule template) is a company decision and does not apply before incorporation, and the capital-self-sufficiency test is always run against the project's true burn rate, since a project whose spending has simply stopped is not self-sufficient.

After incorporation ($\iota_t = 1$), a month in which $s^{\mathrm{f}}_t < 0$ and the shortfall cannot be met from eligible restricted funds does not end the scenario either: probability mass enters the four-route split of A.7. Because the balance is a state variable, when a project runs out depends on its history rather than on a fixed clock; this is the point at which the framework's structure corresponds to the random-walk-to-absorption family of organizational mortality models, and it is the only point at which it does.

*Divergences.* Under A1 the reference implementation collapses the two balances into a single balance and represents the unusable portion as a fixed 15% uplift on the burn rate; pre-incorporation contract earnings are added to that single balance, so the free/restricted distinction the specification imposes on them is lost. Under A9 the fiscal-year mechanics are absent altogether: awards are added in full in the month of the decision, with no year-start lump payment, no year-end expiry $\ell_t$, no three-month lag on reimbursement-basis instruments, and no disbursement period; the effect is to make cash exhaustion arrive slightly later than specified. Under A10 there is no sales term $y_t$: the production-contract gate is treated as absorbing and everything beyond it is valued analytically, so the term appears in the equation above and not in the computation. Under A11 private funding has no closing probability — an arrival is treated as a receipt — which pushes value upward. None of the results reported in the paper depends on the sales term or on the account split.

---

### A.4 Project parameters and the prior

Thirteen quantities cannot be observed directly. They are collected in

$$
\theta = \big(c,\ e,\ \sigma,\ \tau_{\mathrm{proc}},\ \psi,\ \kappa_{\mathrm{IP}},\ \{w_u\},\ \{\bar P_u\},\ \{\delta_u\},\ \{\alpha_u(\cdot)\},\ \{L_u\},\ \{\underline{c}_u\},\ r\big)
$$

and are held fixed over the horizon. The reason for holding them fixed is an identification reason and not a substantive claim: their variation cannot be separated from the gate history with the data available. Slow variation is absorbed by re-estimating $B_0$ at each evaluation version.

**$c$, conversion capacity.** The multiplier converting resources committed into speed of advance — not the reach of what a project might attempt. It is estimated per project as the ratio of the increment in strategic slack produced by an action (funds won, gates passed and hence evidence grade raised, intellectual property created, customer relationships formed, people retained) to the expenditure that produced it, compared against the sector base speed, and carried as a recency-weighted moving average rather than a cumulative ratio — a cumulative ratio dilutes the stall of a project that used to be fast. Funds raised before incorporation are not credited at face value: what counts is how much of them turned into project assets, since the same grant can produce a portfolio of filings and demonstrated scale-up in one project and unrelated research output in another. Where expenditure records do not exist, $c$ is approximated from the quiet period on a declared scale (SM-C).

**$e$, the fill prospect of the evangelist function.** The prospect that the function of explaining what the technology means and where it can reach — enough to move the judgement of customers, investors and reviewers — is carried by someone in this project. It is a property of the function, not of a named person or title: anyone may carry it and it may be combined with other functions. It is measured by an inventory of the people around the project and their recorded activity. Where no search has been made it is set to a wide, neutral prior and is lowered only on a search that found no one. Titles, nominal roles, and a researcher's stated intention to found a company are not admissible inputs.

**$\sigma$, sector momentum.** Recorded per cell of the twelve-cell process-type-by-regulatory-regime classification by comparing the most recent twenty-four months against the preceding twenty-four on three observations: the movement of public award rates or budgets, the movement of private investment, and legitimacy events (a standard set or revised, an industry body founded, a regulator building out a regime). Two or more observations moving the same way give $\sigma = \pm 1$; otherwise $\sigma = 0$. It enters as a direct multiplier on the award rate, the offer-arrival rates, the contract-arrival rate, and the competitor-preemption hazard.

**$\tau_{\mathrm{proc}}$, process type.** One of four types decided by the physics of what is being made — process, device, software, service. The required expenditure schedule and the prior over the production-cost floor are both drawn from it, which is what keeps the two consistent. The regulatory regime is a separate, orthogonal attribute.

**$\psi$, technical-core validity.** Reproducibility, and performance when scaled. It has exactly two uses: as a multiplier on advance at technical gates, and as a shared precondition — no application enters $A_t$ until the technical gates are passed, so a project whose technical core does not stand has no application that stands.

**$\kappa_{\mathrm{IP}}$, appropriability.** Estimated from claim breadth, freedom to operate against third-party patents, and the closure of alternative routes. It has three effects: the share $\phi_u$ that the project system can bring into being domestically, the competitor-preemption hazard, and the offer-arrival rates.

**$\{w_u\}$, willingness-to-pay caps.** Per application, carried with an evidence grade — interest, payment for a proof-of-concept, production terms offered, production contract. Payment for a proof-of-concept alone does not raise the grade to the production level.

**$\{\bar P_u\}$, annual domestic value-added ceilings.** The annual domestic value added the application could sustain at maturity, in the national-accounts sense — output net of purchased inputs — and not revenue. One number per application, with no distribution placed on it. The reason is structural: the value equation factors into ceiling, whether the application becomes active, and the share, and the uncertainty of *reaching* the ceiling is already carried by the scenario probabilities and the transition of $A_t$; giving the ceiling its own distribution would count that uncertainty twice. Applications with an existing market take the domestic annual figure from industrial statistics; applications that create a market take a conditional figure for the annual value added if the application comes to exist.

**$\{\delta_u\}$, displacement.** The portion of the ceiling that consists of domestic value added lost by incumbent activity. It enters as a level in the same units as $\bar P_u$, not as a ratio.

**$\{\alpha_u(\cdot)\}$ and $\{L_u\}$, the counterfactual schedule and the acceleration horizon.** How much of application $u$ others would have realized anyway, and when. The schedule is a two-level step in time: up to the acceleration horizon $L_u$, measured from the evaluation date, the deduction is the evaluation-date rate; beyond it, the deduction rises to the level at which only the location difference — value arising domestically rather than abroad — remains as contribution. $L_u$ is estimated from the competitive landscape as a bounded interval, with 36 months as the default for applications facing active competition. The origin of $L_u$ is the evaluation date and not the realization date in the scenario, which is an approximation in the direction of overstating contribution for slowly realizing scenarios; the canon requires that direction to be declared and watched in calibration.

**$\{\underline{c}_u\}$, production-cost floors.** Prior drawn from the process type on thermodynamic and experience-curve grounds, updated on observation — measured cost, equipment quotations, yield.

**$r$, self-propulsion.** Earnings in yen per month from contract work and paid proofs-of-concept at full effort commitment. It is set per project by writing down what the project would actually contract to do — system development for a software project, composite development with other materials for a materials project, distribution of a competitor's product — and placing an annual figure; the per-type default is an initial value used only before the project-specific investigation, and is overwritten once an estimate exists. The post-incorporation ceiling reaches the hundreds of millions of yen per year.

**$B_0(\theta)$, the prior.** Placed at the evaluation date from source-tagged evidence by a four-point elicitation — low, best, high, confidence — run as individual estimation, exchange of reasons, re-estimation, then aggregation, in the structured-expert-judgement tradition. Spread is carried multiplicatively, as a geometric mean with a geometric standard deviation, rather than additively. Correlated components are not elicited independently: they share their source variables, the process type and the technical core. Inside the model $\theta$ does not move; when evidence accumulates the prior is re-placed and the whole score recomputed as a new evaluation version.

*Divergence.* The scale of $c$ is a convention: its population median is pinned to 1.0, which means it is not separately identified from the gate base speeds (SM-F). The reported band is computed on a grid over four components of $\theta$ only — $c$, $\psi$, $\sigma$ and $r$, on a $3 \times 3 \times 3 \times 2$ lattice, 54 points (A7) — so the percentiles of A.11 are percentiles over that sub-grid and not over the full thirteen-dimensional prior; the direction is to understate the width. Under A16 a project with several applications is computed on its principal application alone, because summing over applications that share a gate sequence would count that sequence more than once; the direction is to understate value.

---

### A.5 The processes

#### A.5.1 Gate advance

$$
p^{\mathrm{adv}}_t = 1 - \exp\!\big(-\,\kappa_{g_t} \cdot \psi_{g_t} \cdot c \cdot \eta_t \cdot (1 - \gamma \rho_t)\big).
$$

$\kappa_{g_t}$ is the base speed of the gate, drawn from a table indexed by process type and gate kind — a stratified baseline hazard, with project-specific factors entering multiplicatively, in the proportional-hazards form. $\psi_{g_t}$ equals technical-core validity $\psi$ at technical gates and 1 elsewhere. $\eta_t$ is the carrier-fill factor. $\gamma$ is the degree to which contract work slows passage, and is indexed by the proximity of the contract to the project's own technology: same-source work, which doubles as verification of the core technology, has $\gamma = 0$ and does not consume the project at all, with any resulting data entering separately as evidence; adjacent work sits between; unrelated work is the reference point. Qualifying as same-source requires an externally checkable condition — the contract deliverable must be referenced as gate evidence through the same registry event — and contract work that does not meet it is treated as adjacent.

#### A.5.2 The carrier-fill factor

$$
\eta_t = \prod_{f \in \mathcal F} \big(1 - d_f \cdot \mathbb 1[\text{function } f \text{ is vacant at } t]\big).
$$

$\mathcal F$ is the fixed decomposition of the functions a management team must carry (SM-B). A vacancy is a delay, not a deduction: the coefficients $d_f$ are indexed by gate, written $d_{f,g}$, and are calibrated from the observed relationship between the duration of a vacancy and the delay in passing the gate, which is what makes them falsifiable. The one order constraint imposed in advance is that the evangelist function carries the largest coefficient among the gates for which it is the principal function; the ordering of the remaining functions is an output of calibration rather than an input, so that an error in the ordering cannot be hidden by the constraint. A vacancy at the evaluation date is not itself penalized: transferable functions fill through a supply process with an expected time to fill, and the evangelist function fills through a search process whose success probability depends on $e$.

The factor enters in three places, not one: gate advance, the award rate, and the offer-arrival rates. Carrier fill that raises only the speed of advance would contradict the definition of the evangelist function, which is defined by its effect on the judgement of investors and reviewers as well as customers. On the award and offer rates the loading is taken over the subset of functions relevant to each, with its own coefficients (SM-C).

Because the granularity of $\mathcal F$ enters a product, granularity itself moves the value: the decomposition is fixed, and any change to it is a version change requiring recalibration. Scores computed at different granularities are not compared.

#### A.5.3 Awards, funding windows, and private funding

Funding opportunities with known dates and amounts are held as a list. New opportunities arrive at rate $\nu^{\mathrm{win}}(\sigma)$, increasing in sector momentum; opportunities leave the list not at a rate but by their own final-call date, held as a dated constraint. The probability of an award at opportunity $w$ is

$$
p^{\mathrm{award}}_w = \phi\big(\sigma,\ n_t,\ g_t,\ \eta_t,\ m_\theta\big),
\qquad
\phi = \mathrm{clip}\big(\phi_{\mathrm{base}} \cdot m_\sigma \cdot m_g \cdot m^{\phi}_\eta,\ \underline\phi,\ \overline\phi\big) \cdot m_\theta ,
$$

with the base rate fixed by a normalization condition against observed programme award rates, $m_\sigma$ the momentum multiplier, $m_g$ the evidence-grade multiplier read from $g_t$, and $m^{\phi}_\eta$ the carrier loading. An award is replenishment, not advance: it changes the cash balance and does not move $g_t$.

"Award" refers only to succeeding in an application to a public call. Private funding — venture capital, corporate investors — is not applied for and is not called an award: it arrives at its own rate $\nu^{\mathrm{eq}}$, defined only after incorporation.

The economic multiplier is

$$
m_\theta \;=\; \mathrm{clip}\!\left(\left(\frac{\max_u\big(\bar P_u - \delta_u\big)}{P^{\mathrm{ref}}}\right)^{\beta_P} \cdot \frac{1 + \beta_m\,\mathbb 1\big[\exists u:\ m_u(\theta) > 0\big]}{1 + \beta_m},\ \ \underline m,\ \ \overline m\right).
$$

$P^{\mathrm{ref}}$ is the reference ceiling at which the multiplier equals one; $\beta_P$ is the loading of the ceiling, and it is larger for private funding than for public awards, since an investor prices the size of the opportunity directly; $\beta_m$ is the uplift for the existence of at least one application whose unit margin is positive; $\underline m$ and $\overline m$ bound the multiplier so that ceiling size alone cannot move the award rate without limit. The denominator $1 + \beta_m$ is a normalization: at the reference ceiling with a positive unit margin the multiplier is exactly one, so the base award rate continues to denote the same reference project; without it the base rate would be lifted twice. The multiplier is applied outside the clip on $\phi$, because the clip bounds the award function's own domain while the effect of ceiling size is bounded by $\underline m$ and $\overline m$ — clipping in both places would truncate the same variation twice.

$m_\theta$ is a function of the project parameters and not of the observable state. The distinction is what keeps the construction free of circularity: "this project has money now, so it scores well" would be a dependence on the state, whereas "this project is sound, so it attracts money" is a dependence on the parameters, and only the second is represented.

The history argument $n_t$ is present in the award function's argument list but its multiplier is pinned to unity at this version, because state dependence cannot be separated from unobserved heterogeneity without rejection data and the builder's ledger records no rejections at all (§7.5 of the paper; SM-F). Placing a value for something unidentified would leave an unidentified structure carrying a number.

#### A.5.4 Realization offers and the quiet period

$$
p^{\mathrm{offer}}_{k,t} = 1 - \exp\!\big(-\,\nu_k(\kappa_{\mathrm{IP}},\ g_t,\ \sigma,\ \eta_t,\ m_q)\big), \qquad k \in \{\text{licensing},\ \text{M\&A},\ \text{IP sale}\},
$$

with $\nu_k$ increasing in appropriability, in the evidence grade implied by the gates passed, in sector momentum, and in carrier fill, and damped by the quiet-period multiplier $m_q$. Whether an offer is accepted is, in the specification, decided by the plan rule.

The quiet period $t_q$ is the number of months since the last externally visible positive event — a funding round closed, a product launched, a partnership, an award, a large public grant; in registry terms, gate passage, public award, private funding, a contract signature, or an application extension. Its role is to observe the freshness of strategic slack: whether a project can attract a licensing or acquisition conversation is a function of its slack, and a project with no visible movement does not receive approaches. The multiplier applies to the offer-arrival rates and to the availability of a taker in routes ② and ③ of A.7; the same scale is used for the approximation of $c$ in projects without expenditure records. Double counting is blocked explicitly: where $c$ can be estimated from expenditure records, the quiet period is used only as the multiplier, and where $c$ was approximated from the quiet period, the same absence of progress does not enter $c$ a second time through the registry.

#### A.5.5 Contract offers

$$
p^{\mathrm{offer}}_{c,t} = 1 - \exp\!\big(-\,\nu_c(r,\ \sigma,\ n_t)\big),
$$

with the arrival rate increasing in self-propulsion — whether the project has a form of work it can sell — in momentum, and in track record. Acceptance is decided by the plan rule. Accepting raises $\chi_t$, which fixes the remaining months of commitment and the effort share $\rho$; the effort share cannot be reduced at will while the contract runs. Delivered contract work carries a transition that adds a service application to $A_t$, which is the path by which contract earnings can become a saleable industry in their own right.

#### A.5.6 Rights and approvals

For each open item $i \in R_t$, a duration estimate is held as an interval, together with the institution's committee calendar as a set of dated constraints, and

$$
p^{\mathrm{res}}_{i,t} = 1 - \exp\!\big(-\,\beta_i\big),
$$

where item types whose decision can be issued only at a committee meeting can resolve only in those months. Unresolved items block the gates, funding events, incorporation, and offer acceptances to which they are tied.

*Divergences.* Under A12 the funding-window list is not held at all: it is collapsed to a constant arrival rate, so $\nu^{\mathrm{win}}$ is not implemented and plan rules that condition on named calls are specified but not exercised. Under A4 the rights items are collapsed to a fixed count of two with a single average resolution rate, so the item-type and institution-size structure is not implemented. Under A2 the contract state is reduced to two states with an expiry hazard, and the effort share is always at its cap. Under A5 the automatic branch on stalling at a gate is approximated by a hazard-position expression that does not depend on elapsed months at the gate. Under A8 every offer is accepted, because no acceptance rule is implemented; this is the reason the elasticity of value to the licensing arrival rate comes out slightly negative in unregulated cells. Under A15 the technical-core loading is not applied to the preparation stage of regulatory gates, which overstates scores in the heavily regulated regime. Under A6 the unit-margin gate is not enforced as a gate at all: with the ceiling normalized the condition is assumed to hold, and the unit-margin flag acts only through $m_\theta$.

---

### A.6 The monthly transition, in order

Each month resolves in a fixed order. The order is part of the specification, since several of the steps would give different results if permuted.

1. **Dated constraints.** Constraints falling in the month are applied: final calls, tenure and retirement dates, rights expiries, and the fiscal-year expiry of restricted funds $\ell_t$.
2. **Stochastic loss.** External death is drawn at
   $$\lambda_t = \lambda^{\mathrm{comp}}(\kappa_{\mathrm{IP}},\ \sigma) + \lambda^{\mathrm{dem}},$$
   competitor preemption and the disappearance of demand. Only genuinely stochastic losses belong here.
3. **The process draws.** Gate advance, award decisions, offer arrivals, rights resolutions, and the start and expiry of contracts, as in A.5.
4. **Rule application.** The registered plan decides the next action: incorporate, accept an offer, pivot, withdraw, or continue.
5. **Cash update.** The transition of A.3.
6. **Absorption and self-sufficiency checks.** After incorporation, cash exhaustion routes into the four-route split of A.7. Before incorporation there is no absorption at zero cash; the rate of advance falls while funds are effectively exhausted. Capital self-sufficiency is reached when repeatable earnings — contract earnings $\rho_t r$ and sales $y_t$ together — cover required expenditure for twelve months, tested against the project's true burn rate.
7. **History update.** The month's outcomes are added to $n_t$.

The plan $\pi^{\mathrm{plan}}$ applied at step 4 is registered from a finite template with no free text (SM-B): gate ordering; branching on failure, with a pivot threshold $k_{\mathrm{pivot}}$ and an exit threshold $k_{\mathrm{exit}} > k_{\mathrm{pivot}}$ counted in failed attempts, where the unit of an attempt is defined by the gate table; the incorporation condition, which requires demand evidence and a funding prospect and is indifferent to the source of the latter; the gate from which realization offers are considered; the contract-work policy, as an effort cap $\rho_{\max}$ and a minimum monthly contract value; the condition for ceasing self-propulsion, as a runway threshold $\underline h$ combined with the absence of any opportunity on the list that could arrive in time; and the application policy, as a maximum number of applications per month. Rules may condition only on information observable at $t$ — the state including the history summary, the opportunity list, and contract terms — and never on $\theta$, which no party observes. This restriction is what makes the scenario measure well defined for each fixed $\theta$, and it forecloses rules defined in terms of quantities only the evaluated project could claim to know. Registration is performed by the evaluator from the template with second-person approval, not by the project; projects without a registration receive the sector defaults, so every project has a defined score, and any departure from the defaults is displayed with a recorded reason.

*Divergence — the loss channels.* The permanent loss of the carrier of the technical core is listed among the loss channels in the paper's account of the ordering and carries a rate, $\lambda^{\mathrm{core}}$, in the coefficient tables (SM-C), where it interacts with the per-project vacancy specification: a project that has recorded an observed loss of the technical core has the blanket hazard switched off, so that the same fact is not counted twice. The model definition's own expression for step 2, reproduced above, has two terms and not three, and $\lambda^{\mathrm{core}}$ does not appear in the canon's closure table; the carrier-function table still records the connection of permanent loss to the loss rate as deferred work. The three statements cannot all be current. We reproduce the two-term expression because it is what the model definition states, and record the third channel here rather than absorbing it silently into the formula.

*Divergence — the diagnostic.* The comparison of the registered plan against the value-maximizing rule in the same class is specified as a standing diagnostic and is not implemented (A14), so the framework's own measurement of whether incorporation is early or late is not produced at this version. This is discussed further at A.11.

---

### A.7 The four routes when self-propulsion fails

When self-propulsion cannot continue, probability mass does not fall into a single death state. It splits across four routes,

$$
\big(\pi^{\mathrm{use}},\ \pi^{\mathrm{cls}},\ \pi^{\mathrm{lic}},\ \pi^{\mathrm{ret}}\big), \qquad \sum \pi = 1 ,
$$

whose conditions and destinations are as follows.

**① Application pivot, $\pi^{\mathrm{use}}$.** Available where the technical gates have been passed and at least one application remains unattempted. It does not terminate: the scenario returns to the head of the market gates, the failure history is reset to zero, and computation continues. Its value is whatever the continued computation produces.

**② Exit-class conversion, $\pi^{\mathrm{cls}}$.** Available after incorporation and at evidence grade 4 or above. The scenario terminates in the M&A class, valued at the forward tail scaled by the probability that the acquirer completes the remaining market gates.

**③ Licensing fold-down, $\pi^{\mathrm{lic}}$.** Available at evidence grade 3 or above. The scenario terminates in the licensing class, valued at the forward tail scaled by the licensee's completion probability and by a discount for the terms available to a project that has given up on self-propulsion.

**④ Return to research, $\pi^{\mathrm{ret}}$.** The residual, always available. The scenario terminates in the withdrawal class at value zero. If someone later builds a business from the same rights, it is counted as a different project.

Only routes ② and ③ accumulate value:

$$
\Delta V \;=\; w\left(\pi^{\mathrm{lic}}\,q^{\mathrm{lic}}\,\zeta \;+\; \pi^{\mathrm{cls}}\,q^{\mathrm{ma}}\right)\cdot \mathrm{tail}(t),
$$

where $w$ is the probability mass arriving at the branch, $q^{\mathrm{lic}}$ and $q^{\mathrm{ma}}$ are the successors' completion probabilities, $\zeta$ is the fold-down discount, and $\mathrm{tail}(t)$ is the forward value from that point. The canon gives $\mathrm{tail}(t)$ as a computed quantity — the value of A.9 evaluated forward from $t$ — and does not give it a closed form; no closed form is supplied here.

Two multipliers apply to the availability of a taker in routes ② and ③: the economic multiplier $m_\theta$, since a large ceiling makes a taker easier to find, and the quiet-period multiplier $m_q$, since a project with no visible movement does not attract one. The evidence-grade thresholds are not relaxed in compensation: without evidence to show, market size does not by itself produce a counterparty.

Below evidence grade 2, only routes ① and ④ are available. This asymmetry is what prevents an early-stage project from booking exit value it cannot demonstrate. After incorporation with cash exhausted, route ① is unavailable, because a company must be wound up rather than quietly repurposed, and its mass moves to liquidation. The branch is entered on any of three triggers: the accumulated failure count reaching $k_{\mathrm{exit}}$, cash exhaustion, or the plan's stop condition. Two situations bypass the branch entirely and fall to withdrawal: a project already at zero funds on the evaluation date, and the disappearance of the technology or the demand itself.

---

### A.8 The nine terminal classes

Every scenario terminates in exactly one of nine classes, all measured on the same scale of net domestic value added:

1. **Capital self-sufficiency within the plan horizon** — repeatable earnings covering required expenditure for twelve months, reached within 60 months of the evaluation date.
2. **Capital self-sufficiency after the plan horizon** — the same condition reached later.
3. **Licensing.**
4. **M&A.**
5. **IP sale.**
6. **Pivot** — termination through the plan's application-change branch at $k_{\mathrm{pivot}}$.
7. **Withdrawal** — route ④ of A.7, together with projects already at zero funds on the evaluation date and projects whose technology or demand has disappeared. It is not a board resolution to withdraw; it is the rights returning to the research institution.
8. **Liquidation** — cash exhaustion after incorporation where route ① is unavailable.
9. **Undecided continuation** — still undecided at the end of the continuation extension.

The 60-month plan horizon that separates classes 1 and 2 is a convention applied identically to every project. It is a different quantity from the evaluation horizon $T = 240$ months and the two are not interchangeable.

The classes exist for the internal arithmetic as much as for reporting: unless the probabilities over all paths sum to one, the accumulation of value is not sound, so $\sum_o q_o(\theta) = 1$ holds by construction and the classification rule is fixed before computation. What is *reported* is deliberately narrower, and A.11 states the rule.

*Divergence.* Class 6 is structurally empty at this version. The application-change branch at $k_{\mathrm{pivot}}$ in the plan-rule template is not implemented, and the degenerate-cell check accordingly returns a pivot probability of exactly zero in all twelve process-type-by-regulatory-regime cells. The class is part of the specification and part of the arithmetic; it receives no mass in the reference implementation, and results should be read with one of the nine classes understood as unreachable. Route ① of A.7, which is also called an application pivot, is a different object: it does not terminate, and its absence from the terminal-class distribution is by construction rather than by omission.

---

### A.9 The value of a scenario

A scenario $\omega$ is one realized sequence of the observable state from month 0 to the end of the horizon under a fixed $\theta$ and the registered plan. Its value is

$$
\Pi(\omega) \;=\; \sum_{t=1}^{T} \frac{1}{(1+d)^{t/12}} \sum_{u \in A_t(\omega)} \phi_u\, \frac{\bar P_u - \delta_u}{12}\,\big(1 - \alpha_u(t)\big) \;+\; \frac{1}{(1+d)^{T/12}}\, C\!\big(x_T(\omega),\ \theta\big).
$$

The inner sum runs over the applications active in month $t$. The annual net increase $\bar P_u - \delta_u$ is divided by twelve to match the monthly summation; carrying the annual figure into a monthly sum was a closure error corrected in the model definition, and the division is stated explicitly here for that reason. The share $\phi_u$ is the fraction of that net increase the project system — the project and its successors in realization, a licensee or an acquirer — can bring into being domestically; it is placed as an affine function of appropriability and is time-invariant, with the ramp of a newly active application carried by the transition of $A_t$ and not folded into $\phi_u$. The factor $1 - \alpha_u(t)$ applies the counterfactual deduction on the two-level time schedule of A.4.

Three properties of the equation are structural rather than parametric, and each has a consequence for how a score may be read.

*Late realization is automatically worth less.* The discount sits inside the scenario rather than being applied to an expected date, so a scenario that reaches market in month 150 is priced against a scenario that reaches it in month 60 without any additional adjustment.

*Appropriability enters only accumulation.* $\phi_u$ appears in no hazard, no gate, and no decision rule. The score is therefore exactly proportional to it, and a reader who rejects the appropriability weighting can divide rather than re-simulate.

*Where the value arises is decided at M4, not at technical proof.* An application enters $A_t$ only on passing its market gate; technical demonstration alone adds nothing, which is what prevents a project that works but has no buyer from carrying value.

The unit-economics gate belongs to this equation as a rule: with $\theta$ fixed, $m_u(\theta) = w_u - \underline{c}_u$ is a single number, and the plan admits to $A_t$ only applications with $m_u(\theta) > 0$. A project none of whose applications clears the gate accumulates nothing, and the width of a score reflects the mixture of that test over $B_0$: a project with no application whose unit economics visibly close has its lower percentile pulled down. This is a rule inside the model and is a different object from the go / no-go decision taken by the people using the output.

*Divergences.* The unit-economics gate is not enforced (A6, A.5); the sum over applications is collapsed to the principal application (A16); the discount rate carries no risk premium by design, failure being priced in the scenario probabilities and parameter ignorance in the prior, and the sensitivities at 1.0% and 4.0% required by the canon are reported with any rank reversal flagged. Two simplifications in the direction of overstating the tail are declared and unresolved at this version: $\delta_u$ is time-invariant, which is rigid over a multi-decade tail, and the decline of $\phi_u$ beyond the remaining life of the rights, whose clock starts at the filing date rather than the evaluation date, is not implemented.

---

### A.10 The continuation term

Beyond the horizon the state is extended under default rules and the surviving applications receive a residual perpetuity:

$$
C(x_T, \theta) \;=\; \mathbb{E}\Big[\ \sum_{h=1}^{H_C} \frac{Y_{T+h}}{(1+d)^{h/12}} \;+\; \frac{1}{(1+d)^{H_C/12}} \sum_{u \in A_{T+H_C}} \bar y_u \cdot \mathrm{Ann}(d, \lambda^{\mathrm{obs}}) \ \Big|\ x_T,\ \theta,\ \pi^{0}\Big],
$$

where

$$
Y_t = \sum_{u \in A_t} \phi_u \frac{\bar P_u - \delta_u}{12} \big(1-\alpha_u(t)\big),
\qquad
\mathrm{Ann}(d, \lambda^{\mathrm{obs}}) = \frac{q}{1-q},
\qquad
q = \big(1 - \lambda^{\mathrm{obs}}/12\big)\,(1+d)^{-1/12}.
$$

The construction has four parts and each answers a specific way of getting the tail wrong.

**The obsolescence hazard runs during the horizon as well as after it.** An active application leaves $A_t$ at the same monthly rate before and after $T$. This is why the tail decays through discounting and obsolescence rather than through the placement of the horizon, and it is the precondition for treating $T$ as a convention. Placing the hazard only at the terminal point would distort the level by the length of the active period.

**The extension is run under the default rules, not the registered plan.** Undecided states are extended for $H_C = 120$ months under the Tier 0 defaults $\pi^{0}$, because nobody has registered a plan for the period beyond the horizon. Ramp, exit and event draws continue during the extension, and a scenario that settles during the extension is reclassified into its actual terminal class — so "undecided continuation" means undecided at $T + H_C$, not undecided at $T$.

**The term applies to settled states too, not only to undecided ones.** A scenario that has settled through licensing, acquisition or capital self-sufficiency still has applications generating domestic value added after the horizon; a settled state is not re-extended under the default rules, but its active applications' survival process continues. Omitting this would strip the tail from exactly the scenarios that settled early, and would systematically undervalue early realization.

**The perpetuity is the continuation of the same hazard.** At the end of the extension, the applications still surviving receive a residual monthly perpetuity at the factor above, in which $q$ combines the monthly survival probability under the obsolescence hazard with the monthly discount factor. Because it is the same hazard continued, the perpetuity neither double-counts the extension nor leaves a gap at the join.

Two operating rules attach to the term. The simplified form — a perpetuity on the active applications alone, without the extension — is an internal check used during implementation and is not used in comparison or reporting, since it assumes activity never lapses and can therefore exceed the full form. And the share of the score carried by $C$ is reported for every project, with any project whose value is majority-continuation flagged for individual review: the least verifiable assumption in the construction is not permitted to dominate a number without anyone noticing. The choice of $H_C$ moves the level very little, since the decay is carried by the hazard and the discount rather than by the switch point; the choice of what the extension assumes does move it, which is why the flag exists.

---

### A.11 The conditional value, the score, and what is reported

For fixed project parameters the plan induces a probability measure over scenarios, and the conditional value is the expectation of scenario value under it. The score integrates that over the prior:

$$
v(\theta) \;=\; \mathbb E\big[\ \Pi(\omega)\ \big|\ \theta,\ \pi^{\mathrm{plan}}\big],
\qquad\qquad
V \;=\; \int v(\theta)\, dB_0(\theta).
$$

The two integrations are not a decomposition for convenience. They separate uncertainty by what information can do to it: the branching inside $v(\theta)$ is irreducible, in that no amount of investigation reveals whether the next trial succeeds, while the ignorance in $B_0$ is reducible, and because the same computation yields the sensitivity of $V$ to each component of $\theta$, the model reports which parameter to investigate next.

$v(\theta)$ is computed by forward accumulation over the observable state, including $A_t$, on a deterministic grid rather than by simulation. Where the state cannot be carried at the chosen discretization, the canon requires the aggregation — the cash increment, the representative set of applications — to be declared and the resulting error displayed; grid-convergence error at this version is below 0.3%, which is why scores are read to two significant digits with input quality, not numerical error, as the binding limit.

The score computed under the registered plan is the score. The value under the optimal rule is not the score, because assuming optimal behaviour would erase exactly the timing gap the framework is built to measure. The optimal rule $\pi^{*}$ is instead sought inside the same declared finite rule class — a lattice of threshold settings, searched exhaustively by forward evaluation — and the difference between it and the registered plan is reported alongside as a diagnostic of whether incorporation is early or late, whether the exit condition is loose or tight, and whether contract work is over- or under-taken. Because the rules condition on the observable state while the parameters remain unknown, this optimization does not decompose as a dynamic program and no backward-induction claim is made for it.

**Reported quantities.** A score is reported as three numbers — the 10th, 50th and 90th percentiles of $v(\theta)$ under $B_0$, with the mean $V$ alongside for reference — plus the ratio of upper to lower as an explicit statement of how much is not yet known. The percentiles quantify parameter ignorance alone, scenario uncertainty being already integrated inside each $v(\theta)$.

The path probabilities reported are only those on which value arises: capital self-sufficiency, licensing, M&A and IP sale, and their sum. The zero-value paths — withdrawal, liquidation, undecided continuation — are the remainder and are not indicators. The terminal-class probabilities are not listed as headline figures, and the withdrawal share in particular is not placed in the leading columns of a ledger: the instrument measures industrial value creation, not the probability of failure.

Three further quantities are defined as outputs of the same computation:

- $q_o(\theta)$, the probability that a scenario ends in terminal class $o$, with $\sum_o q_o(\theta) = 1$ by construction;
- $P_o(\theta) = \mathbb E[\Pi \mid \theta, o]$, the value conditional on the terminal class, a reporting quantity whose primitive definition lives on the $\Pi$ side;
- $Q(h)$, the cumulative probability of reaching capital self-sufficiency by elapsed month $h$, which is what makes projects at different starting points comparable on a common elapsed-time axis.

*Divergences.* The band is computed over a four-component sub-grid of $\theta$ (A7, A.4), which understates its width. Three of the defined outputs are not produced at this version: $P_o(\theta)$, $Q(h)$, and the ranking of which parameter to investigate next. The policy search is not implemented (A14), so the diagnostic against $\pi^{*}$ — the framework's own measurement of the timing question — is specified and not available. The absolute level is additionally uncalibrated at this version: the common scale factor that had aligned the rate of reaching the production-contract gate with external statistics no longer holds after the change to the pre-incorporation cash rule, and re-calibration of the level is outstanding. Any statement about the absolute level of a score at this version carries that qualification; statements about ordering do not depend on it.

---

### A.12 Index of divergences between specification and implementation

The table below indexes, in one place, every point at which this section states an equation that the reference implementation does not evaluate as written. The identifiers are those of the canon's approximation table, reproduced in full with directions and magnitudes in SM-C. Items marked "—" are recorded in the canon as unimplemented elements rather than as declared approximations.

| Where | What the specification states | What the frozen implementation does | Id |
|---|---|---|---|
| A.3 | two accounts, free and use-restricted | one balance, unusable portion as a 15% burn uplift; pre-incorporation contract earnings enter the single balance | A1 |
| A.3 | fiscal-year lump payment, year-end expiry $\ell_t$, reimbursement lag, disbursement period | award added in full in the decision month | A9 |
| A.3 | sales term $y_t$ | absent; the production-contract gate is absorbing and the sequel is valued analytically | A10 |
| A.3 | private funding closes with some probability | arrival treated as receipt | A11 |
| A.4 | band over the full prior | band over a $3\times3\times3\times2$ grid in $c, \psi, \sigma, r$ | A7 |
| A.4, A.9 | sum over the application set | principal application only | A16 |
| A.5 | funding-window list with $\nu^{\mathrm{win}}$ | constant arrival rate; window list absent | A12 |
| A.5 | rights items by type and institution scale | two items at a single average resolution rate | A4 |
| A.5 | contract state with remaining commitment months | two states with an expiry hazard; effort always at cap | A2 |
| A.5 | stalling branch keyed to elapsed months at the gate | hazard-position approximation, elapsed months not used | A5 |
| A.5, A.6 | acceptance of an offer decided by the plan rule | every offer accepted | A8, — |
| A.5 | technical core loads the preparation stage of regulatory gates | not loaded | A15 |
| A.5, A.9 | unit-economics gate admits applications to $A_t$ | ceiling normalized to 1; condition assumed satisfied; the flag acts only through $m_\theta$ | A6, — |
| A.5 | review period separated into regulator and applicant time | not separated | A13 |
| A.6 | permanent loss of the technical core as a loss channel | rate exists and is used, but the model definition's step-2 expression carries two terms and the closure table omits it | — |
| A.8 | nine terminal classes | the pivot class receives no mass in any cell | — |
| A.11 | policy search and the timing diagnostic | not implemented | A14 |
| A.11 | $P_o(\theta)$, $Q(h)$, and the next-parameter ranking | not emitted | — |
| A.9 | separate emission of the acceleration and location wedges | not emitted separately | — |

Three items in the canon are recorded as absent from the model itself rather than from the implementation, and are noted here because a reader may otherwise look for them in the equations above: complementarity between vacancies, since $\prod (1-d_f)$ implies substitutability; liability of newness, since the loss hazards do not depend on months since incorporation; and control of complementary assets — access to an incumbent's manufacturing, distribution, and regulatory standing — which is proposed as a third axis for a later version and is not represented at this one.
