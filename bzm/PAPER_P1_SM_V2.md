---
title: "Supplementary Material — The Before Zero Model: additionality-based valuation of university deep-tech projects before the firm exists"
---

<!-- PAPER_P1_SM_V2.md — v2 補足資料の統合版。**編集はしない。**
     正本は bzm/sm_v2/SM-{A..G}.md の7ファイルで、このファイルは
     `python3 bzm/tools/build_sm_v2.py` で連結して作る生成物。
     記号・用語・版の共通契約は bzm/PAPER_P1_SM_V2_GLOSSARY.md。 -->

*Supplement to the main text. Section numbers of the form §n.m refer to the main text; sections of the
form SM-X refer to this document. The model version, its approvals, and the frozen input set behind
every number are in SM-G.*

# Contents {-}

**SM-A** Notation and complete model equations. **SM-B** Gate table, carrier-function table,
event-registry format, and plan-rule template. **SM-C** Coefficient tables with provenance grades,
declared approximations A1–A16, and elasticity tables. **SM-D** Application detail: the stratified
sample, the dual-scoring protocol, the classification rule and its freeze, per-project results, and
the documented ceiling re-basing. **SM-E** Derivation log and audit record. **SM-F** Calibration plan,
identification constraints, and the falsification registry. **SM-G** Version freeze.



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
| $d_{f,g}$ | vacancy delay coefficient — the delay coefficient of a vacancy in function $f$ at gate $g$ | §4 | §4 | A.5 |
| $\mathcal F$ | the decomposition of management-team functions — the decomposition of carrier functions | §4 | §4 | A.5 |
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
| $P_o$ | the value conditional on ending in each terminal class — the value of a scenario conditional on its terminal class | §8 | §8 | A.11 |
| $Q(h)$ | cumulative probability of reaching capital self-sufficiency by month $h$ — the cumulative probability of reaching capital self-sufficiency by elapsed month $h$ | §8 | §8 | A.11 |

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

The history argument $n_t$ is present in the award function's argument list but its multiplier is pinned to unity at this version, because state dependence cannot be separated from unobserved heterogeneity without rejection data and the builder's ledger records no rejections at all (§6.6 of the paper, where the constraint is stated; §6.4, where it is also named as a gaming opening; SM-F). Placing a value for something unidentified would leave an unidentified structure carrying a number.

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

The the value conditional on ending in each terminal class reported are only those on which value arises: capital self-sufficiency, licensing, M&A and IP sale, and their sum. The zero-value paths — withdrawal, liquidation, undecided continuation — are the remainder and are not indicators. The terminal-class probabilities are not listed as headline figures, and the withdrawal share in particular is not placed in the leading columns of a ledger: the instrument measures industrial value creation, not the probability of failure.

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

## SM-D. Application detail

This section supplies what §7 reports in summary: how the twenty-one projects were stratified, how
the dual-scoring exercise was run, the rule that decided which inputs belong to which pass and how it
was cross-checked, the per-project results, and the one ceiling re-basing we can document.

### SM-D.1 The sample and its three layers

The sample is the whole of one venture builder's 2026 screening ledger — twenty-one projects, no
selection within it. It is a fund's working list rather than a clean Before Zero sample, and the
evaluation says so by stratifying rather than by pretending otherwise.

**(a) Pre-incorporation university seeds — six projects.** These are Before Zero applications proper
and are the paper's main sample. **(b) Incorporated spin-outs — fourteen projects**, scored at the
present evaluation date with their present inputs. We considered moving their evaluation date back
before incorporation and restricting inputs to what was datable to that time, and did not: the
operating record is not granular enough to establish what was known when. No project was excluded on
these grounds; the count of exclusions is zero. This layer therefore reports how the instrument scores
*operating companies*, which is outside the domain the framework is built for, and it is labelled as
such wherever it is cited. **(c) One project lies outside the domain in a second sense**: a seed
inside an established firm with no incorporation intent.

The layer assignment follows the incorporation flag in the registry, with one deliberate exception:
the project in layer (c) is incorporated, but the firm it sits inside pre-dates the seed and no
separate entity is intended, so the Before Zero question does not apply to it.

### SM-D.2 The dual-scoring protocol

Each project is scored twice under the same frozen model version and the same coefficients.

1. **Default condition.** Inputs are taken from the operating database alone — grant awards, contracts,
   patents re-verified at the national registry, stage assessments, recorded project knowledge. Where
   the record is silent, the reference implementation supplies the Tier-0 default for the project's
   type and regime. It does *not* supply ignorance: the default assigns an incorporated project
   eighteen months of runway at its sector's post-incorporation burn, so a project whose real runway
   is three months is scored as comfortable rather than as unknown.
2. **Elicited condition.** The same input schema is completed with what the venture builder's own lead
   knows about each project from working with it.

Because the coefficients are identical in both passes, any difference is attributable to information
alone. The name matters for what the exercise can claim: the first pass measures distance from the
defaults, not distance from ignorance, which is why §7.2 calls it the default condition rather than a
records-only condition.

**Two features bound the interpretation.** The informant is one person, and that person also designed
the model and wrote this paper; the exercise measures what an experienced evaluator's knowledge adds
to an operating record, not what a project's own principals would report. And the elicited condition
is not a ground truth — it is a second reading by the same instrument with more inputs filled.

### SM-D.3 The classification rule, and how it was frozen

Which inputs belong to which pass is decided by a three-way rule, applied uniformly:

- **(a) the record states a value** → that value is used in both passes;
- **(b) the record states only a bound** — a board paper computing that funds run out in December on
  zero receipts bounds the cash position from above — → the bound is used in the default pass;
- **(c) the record is silent** → the Tier-0 default stands in the default pass.

Thirty items fell to (c) and four to (b). An earlier version of this exercise classified inputs,
computed, noticed an implausible result, and revised the classification, which leaves no way to
distinguish a corrected rule from a tuned one. The rule above was therefore **fixed and hashed before
any of these scores were computed**; the hashes and the commit are in SM-G. Applying it moved eleven
items relative to the earlier attempt, in both directions: a burn rate whose source turned out to be a
board paper's cash-flow table returned to the record side, while two projects' cash positions, whose
only source was a verbal estimate, moved to the default side. The effect came out *smaller* than under
the flawed classification — the maximum ratio fell from ×85.7 to ×88.2 in the tail but the count of
projects moving by a factor of two fell from five to four, and the rank correlation rose from 0.895 to
0.933 — which is the direction a genuine correction should move a result that had been inflated.

**Cross-check.** The classification was made by reading each input's recorded justification, not by
trusting a source tag. Three cases were re-checked against the raw justification text and all three
followed the rule: a burn rate sourced to a dated board paper with a page reference classified to (a);
a cash position and burn rate whose justification is an explicit verbal estimate ("probably around two
million a month") classified to (c); a financing round whose justification cites an amount absent from
the funding-round table and attributed to one person's memory classified to (c).

### SM-D.4 Per-project results

Money is in billions of yen. Ratios are the larger value over the smaller, so they are ≥ 1 in both
directions, and the direction column carries the sign. Ten projects are identical by construction
because no input of theirs falls outside the record.

| ID | Layer | Type × regime | Default condition (¥bn) | Elicited (¥bn) | Ratio | Direction | Rank | Inputs outside the record |
|---|---|---|---|---|---|---|---|---|
| A | Incorporated spin-out | F2·R0 | 16.772 | 16.772 | ×1.00 | — | 1 → 1 | — |
| B | Pre-incorporation (main sample) | F2·R0 | 12.842 | 12.842 | ×1.00 | — | 2 → 2 | conversion capacity |
| C | Incorporated spin-out | F1·R0 | 8.712 | 8.712 | ×1.00 | — | 3 → 3 | — |
| D | Incorporated spin-out | F1·R0 | 7.193 | 7.193 | ×1.00 | — | 4 → 4 | — |
| E | Pre-incorporation (main sample) | F1·R1 | 4.353 | 4.353 | ×1.00 | — | 6 → 5 | — |
| F | Incorporated spin-out | F1·R0 | 4.658 | 3.273 | ×1.42 | down | 5 → 6 | burn rate, free funds |
| G | Incorporated spin-out | F2·R0 | 3.231 | 3.231 | ×1.00 | — | 7 → 7 | — |
| H | Incorporated spin-out | F1·R2 | 1.994 | 2.957 | ×1.48 | up | 9 → 8 | burn rate |
| I | Pre-incorporation (main sample) | F2·R0 | 1.385 | 1.385 | ×1.00 | — | 10 → 9 | — |
| J | Incorporated spin-out | F2·R1 | 0.324 | 0.629 | ×1.94 | up | 14 → 10 | free funds, quiet period |
| K | Incorporated spin-out | F1·R0 | 0.482 | 0.482 | ×1.00 | — | 12 → 11 | — |
| L | Pre-incorporation (main sample) | F1·R0 | 0.461 | 0.459 | ×1.01 | down | 13 → 12 | evangelist fill |
| M | Incorporated spin-out | F1·R0 | 3.016 | 0.182 | ×16.54 | down | 8 → 13 | burn rate, evangelist fill, free funds, technical-core vacancy, appropriability, own earnings, unit economics |
| N | Incorporated spin-out | F2·R0 | 0.180 | 0.180 | ×1.00 | — | 16 → 14 | — |
| O | Incorporated spin-out | F1·R0 | 0.284 | 0.120 | ×2.37 | down | 15 → 15 | burn rate, evangelist fill, free funds, own earnings, unit economics |
| P | Pre-incorporation (main sample) | F1·R0 | 0.106 | 0.106 | ×1.00 | — | 17 → 16 | — |
| Q | Pre-incorporation (main sample) | F2·R0 | 0.103 | 0.100 | ×1.02 | down | 18 → 17 | evangelist fill, free funds |
| R | Outside the domain | F2·R1 | 1.040 | 0.012 | ×88.18 | down | 11 → 18 | burn rate, evangelist fill, free funds, decision-making vacancy, unit economics |
| S | Incorporated spin-out | F2·R1 | 0.006 | 0.006 | ×1.04 | down | 19 → 19 | evangelist fill, free funds |
| T | Incorporated spin-out | F2·R1 | 0.002 | 0.002 | ×1.00 | — | 21 → 20 | — |
| U | Incorporated spin-out | F3·R0 | 0.002 | 0.001 | ×2.37 | down | 20 → 21 | burn rate, evangelist fill, free funds, own earnings, sector momentum, unit economics |

Aggregated by layer, the asymmetry that §7.3 reports is visible directly:

| Layer | n | Median ratio | Max ratio | Moved >5% | Direction of movement |
|---|---|---|---|---|---|
| Pre-incorporation (main sample) | 6 | ×1.00 | ×1.02 | 0 | — |
| Incorporated spin-out | 14 | ×1.04 | ×16.54 | 6 | 4 down, 2 up |
| Outside the domain | 1 | ×88.18 | ×88.18 | 1 | 1 down, 0 up |

The main sample is where the framework is meant to be used and is also where the exercise has no
power: only four of the six had any input outside the record at all, and only one of those was
financial. The design could not have detected there the effect it detected among incorporated
projects, and §7.3 reports that as a limitation rather than as a null result.

### SM-D.5 Single-withholding runs

Because affected projects were missing several inputs at once, the contributions were separated by
re-scoring each project with one input withheld at a time — thirty-four runs. Ratios below are against
that project's elicited score, and the median is the middle element of the sorted list.

| Input withheld | Kind | n | Median ratio | Max ratio |
|---|---|---|---|---|
| Free funds | financial | 8 | ×3.88 | ×24.00 |
| Burn rate | financial | 6 | ×2.67 | ×26.84 |
| Unit economics | financial | 4 | ×1.55 | ×4.05 |
| Appropriability | rights | 1 | ×1.41 | ×1.41 |
| Own earnings | financial | 3 | ×1.09 | ×4.38 |
| Technical-core vacancy | organizational | 1 | ×1.04 | ×1.04 |
| Evangelist fill | organizational | 7 | ×1.03 | ×1.29 |
| Quiet period | environmental | 1 | ×1.01 | ×1.01 |
| Decision-making vacancy | organizational | 1 | ×1.00 | ×1.00 |
| Sector momentum | environmental | 1 | ×1.00 | ×1.00 |
| Conversion capacity | organizational | 1 | ×1.00 | ×1.00 |

By kind: financial n = 21, median ×1.96, maximum ×26.8; organizational n = 10, median ×1.03, maximum
×1.29; rights n = 1, ×1.41; environmental n = 2, median ×1.01.

The asymmetry is a property of the instrument before it is a claim about projects. §7.4 gives the
reason from the model side: carrier effects are represented by a product of vacancy delays that
excludes compensation and threshold effects, so organizational facts move the score less than the
founding-team literature would predict. The clearest case is the project whose recorded difficulty was
entirely organizational — the only person able to build the product had left, and voting control
prevented replacing the chief executive — where the framework marks the project down by a factor of
seventeen but attributes almost all of it to the cash position. The score is right about the project
and wrong about why.

### SM-D.6 Ceiling re-basing: the one documented case

The score responds more than proportionally to the ceiling (§7.7), so a worked case matters more than
a sensitivity sweep. One project in the ledger has a recorded re-basing at project level. Its ceiling
was first set to the full addressable slice, ¥6.65bn per year, and then narrowed to the range the
project could actually carry, ¥1.33bn per year, on the judgement that development it cannot fund is
not a use it can reach. Nothing else about the project changed in that revision.

| | Ceiling (¥bn/yr) | Score, median (¥bn) |
|---|---|---|
| Full addressable slice | 6.65 | 0.98 |
| Range the project can carry | 1.33 | 0.14 |
| Factor | ÷5.0 | ÷7.0 |

The project's rank in the ledger fell from eighth to fifteenth across the same revision, but five other
projects had inputs corrected in it, so that movement is not attributable to the ceiling alone and we do
not report it as such. The ceiling and the score are single-project, single-cause and are.

The score moves by more than the ceiling does, which is the second channel of §7.7 showing up in a
real case: the ceiling also sets the economics multiplier that raises the award hazard, so narrowing
it removes both value and the funding that would have reached it.

**We do not generalize from one case.** All twenty-one ceilings carry the lowest evidence grade at the
frozen version and their slicing ratios are provisional, so the input the score is most sensitive to is
also the one the ledger currently supports least. That is stated here, in §7.7, and in the calibration
plan (SM-F) rather than left for a reader to infer.

## SM-E. Derivation log and audit record

§3.1 states that the requirement set was distilled from one venture builder's 2026 operating decisions
and confirmed by that builder's lead, who is also the author, and that this is self-confirmation rather
than independent validation. This section is the trail behind that statement: where the propositions
came from, what adversarial review they were put through, what the review changed, and what it did not
resolve.

### SM-E.1 How the propositions were derived

The twelve design propositions were not read off a literature. They were extracted from decisions the
builder actually made while screening live university seeds during 2026 — which projects to take,
which to decline, what to demand before committing, when to stop — and each was then either confirmed
or rejected in a logged sequence of design decisions.

Two properties of that log matter for what it can support. It is **traceable**: sixty-eight decisions
in the model's source of record carry the decision-maker's own words as the recorded justification,
attached to the specific rule they settled, so a later reader can see which sentence fixed which rule.
And it is **not independent**: the person whose decisions were extracted, the person who confirmed
them, and the author of this paper are the same person. The log therefore establishes that the
requirements were fixed deliberately and can be audited, not that anyone outside the organization
agrees with them. Circulating the propositions to external practitioners for content validity is
registered as future work in §8, not claimed here.

### SM-E.2 The adversarial audit

Before the framework was approved for use, each design step was put through an adversarial review by
five standing perspectives, in three rounds. The five are a management scholar, an economist, a founder
who had taken a deep-tech venture from incorporation to public listing, a venture capitalist, and a
university industry-liaison director. Each reviewed independently; the perspectives were not shown one
another's findings within a round, and none was asked to confirm the design.

Findings were graded: **P0** blocks approval until fixed, **P1** must be answered but does not block,
**P2** is recorded for a later stage.

| Round | Object | P0 | P1 |
|---|---|---|---|
| 1 | First formulation of the scoring step | 23 | 36 |
| 2 | Second formulation, after round-1 fixes | 9 | 14 |
| 3 | Third formulation, closure verification | 8 (new) | — |

The counts fell but did not reach zero, and the third round is the one worth reporting honestly: it was
run as a closure check on a formulation that had already survived two rounds, and it still returned
blocking findings. One of them was arithmetic — the value expression was summing an annual quantity
month by month, which inflated the score by roughly a factor of twelve. A framework whose own third
adversarial round finds a twelve-fold error is not a framework whose first round can be trusted to have
found everything, and we report the sequence rather than only its endpoint.

**What the rounds changed.** Round 1 found that the scoring step had no closed expression at all — a
skeleton rather than a function — that the terminal-class set was not derived so the output type was not
closed, and that the top-level expression assumed independence between values conditional on the terminal class and path
values, which violated the framework's own stated discipline. Round 2 found that optional stopping had
been collapsed into a pre-chosen calendar date, losing the content of the theory it cited. Round 3
found the arithmetic error above, and that a policy-search object the text described could not be
computed on the rule class the framework had defined. Each of these changed the specification, not the
prose about it.

### SM-E.3 What the audit did not resolve

Eight items survived round 3 as non-blocking residuals and are carried openly rather than closed:

1. Excluding the evangelist function from the builder's own supply process sits in tension with the
   design principle that the builder supplies carriers later.
2. Accepting a contract-work offer is not named in the plan-rule vocabulary, although the model
   processes it.
3. Deviation from the standard gate table is surfaced to the evaluator but does not automatically
   change the evidence grade or the reported band.
4. The throughput limit of a single technology-transfer officer across simultaneous projects is not
   represented in the rights-resolution rate.
5. How committee-calendar data is to be obtained is undesigned, and the route chosen determines whether
   a confidentiality barrier applies.
6. The drag term for contract work is absent from the calibration list.
7. How to set a willingness-to-pay band from proof-of-concept payment evidence alone is unsettled.
8. The precedence between the pivot class and in-horizon capital self-sufficiency is not stated for
   scenarios in which both would apply — which is one reason the pivot class being structurally empty
   (§4.5) has not yet forced the question.

None of these blocks use; all of them are places where a later reader can check whether the framework
was tightened or left as it was.

### SM-E.4 Candidate requirements that were rejected

The boundary of a requirement set carries as much information as its content. Four candidates were
considered and rejected with reasons logged, and they are listed in §3.3: an inverted-U relationship
between slack and performance, rejected because the evidence comes from established firms while young
private ventures show a positive slope and Before Zero projects live in chronic scarcity where the
descending arm is not observed; Monte Carlo simulation over judgment-quality inputs, rejected because
draws add no information to elicited ranges — at the cost, declared in §4.7, that the implementation
propagates only four of the thirteen parameters; irreversibility points as a standalone requirement,
whose decision content is carried by slack and the timing window; and intellectual-property ownership as
a standalone requirement, rights being one of several gate-blocking items rather than a category above
shareholder agreements or unit economics.

### SM-E.5 Review of this manuscript

The manuscript was put through a second adversarial exercise before submission, distinct from the design
audit above: five reviewer perspectives — a journal editor, an evaluation economist, a technology-transfer
researcher, a methodologist, and a practitioner — plus a check of every reference against its source.

The outcome was not favourable and is reported as it stands. The editor perspective returned a desk
reject on submission requirements and on the structure of the empirical section, with re-submission
invited. The evaluation economist and the technology-transfer researcher both returned major revision,
the latter conditioning acceptance on three points concerning the coincidence of designer, operator,
evaluator, and sole informant in one person. The methodologist returned major revision. The practitioner
returned a conditional yes, the condition being that yen figures not be placed in front of a selection
committee — which is why §4.7 reports ranks in bands rather than as points.

The reference check found no fabricated citation. It did not check whether each in-text citation number
pointed at the reference that supports the claim; a later pass found five that did not, all introduced by
a single mechanical edit, and all corrected. That distinction — verifying entries versus verifying
pointers — is the kind of gap this section exists to record.

The heaviest class of finding was the one the framework is designed to prevent in others: six places
where the manuscript described a capability in the present tense that the reference implementation did
not have. All six were checked against the implementation, all six were confirmed, and the manuscript now
declares the gap at the point of the claim rather than in an appendix.

### SM-E.6 What is not claimed

The audits above are adversarial but internal. No external party has reviewed the propositions for
content validity, no second evaluator has independently re-coded the inputs of §7, and the framework has
not been operated by an organization other than the one that built it. Each of these is registered in §8
as a condition on which the design knowledge in this paper stands or falls.

## SM-F. Calibration plan, identification constraints, and the falsification-condition registry

This supplement gives, in full, three things the main text states only in summary: the calibration
plan behind §6.6's claim that "every coefficient carries a grade... and a calibration plan with
explicit identification constraints"; the three identification constraints §6.6 names as binding
hardest; and the five-condition falsification registry §8.4 commits to depositing. It also reports
where the main text's own cross-references to that registry do not, on inspection, line up with the
registry's seven conditions. It does not repeat the coefficient-by-coefficient provenance-grade table,
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
| Gate-speed common multiplier ($\mathrm{scale}$ on $M_g$) and conversion capacity ($c$) | How fast a project clears its next gate, and how much of that speed is the project's own | Gate-passage dates, progress reports | 100 gate passages | $c$'s population median is fixed at 1.0 as an identification convention, not an estimate. $\mathrm{scale}$, the vacancy delay coefficients, and $c$ cannot be told apart from one another given only gate-passage timing, so are estimated jointly around that fixed point, with a shrinkage prior on the type-level multiplier | Top |
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
common multiplier, the vacancy delay coefficients, and $c$ cannot be told apart from one another given
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

§8.4 of the main text deposits seven conditions with a public repository, each stated against an
observable proxy, with a judge, a horizon and a threshold, so that a later reader can check what was
claimed before outcomes were known. The history is worth recording because it bears on how much the
deposit is worth: the length trim that produced v4.0 (29 August 2026) removed all five conditions
then in force while leaving the sentence that promised them, so for one day the main text committed
to conditions it did not state. They were restored on 30 August from the pre-trim text, and two more
were added at the same time (below). Table F-2 restates conditions (1)–(5) as they stood before the
trim; nothing has altered them since.

**Shared elements, stated once.** The judge for all seven conditions is the evaluation-version
approver — under the separation of duties the main text describes at §6.5 and the source of record
requires at §6.D-3, a role held by someone other than the person who estimated the project's
parameters. The horizon is 24 months from deposit for conditions (1)–(4) and (6), and 60 months for conditions
(5) and (7); condition (5)'s own threshold is stated in terms of that 60-month mark, which is the same
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

**Two conditions added on 30 August 2026 to close cross-references the main text was making.** Two
claims elsewhere in the main text cited this registry while corresponding to none of conditions
(1)–(5). Rather than weaken the cross-references, both were operationalized in the same form as the
five above and are now conditions (6) and (7) of §8.4.

- §2.5 states that enterprise-level and investor-level additionality "coincide only under an
  assumption we state and register for falsification (§8.4): that in the current Japanese Before Zero
  population, projects not carried by a dedicated builder are, with high probability, not carried at
  all." This is now **condition (6), builder substitutability**: the registry records projects the
  builder declines or exits, so the assumption is testable directly — if more than a quarter of them
  are carried to incorporation by another party within 24 months of the builder's exit, the two
  additionality concepts do not coincide in this population and must be reported separately.
- §4.3 states that "monotone drift of posteriors across versions is one of the registered
  falsification signals." This is now **condition (7), parameter constancy**: once three consecutive
  evaluation versions have accumulated, if the posterior median of any project parameter moves in the
  same direction across all three for more than a quarter of projects, the constant-parameter
  approximation is absorbing real variation rather than ignorance. Like condition (4) it is not
  testable until the count is reached, and the main text says so rather than implying an ongoing test.
  Independently of this registry, the source of record already requires a related
  check as ordinary practice, independent of this registry: every new evaluation version is checked
  for time-consistency across the version sequence, i.e., whether $B_0$, the funding-opportunity list,
  or the rules have been drifting in one direction rather than settling.

The thresholds in (6) and (7) — a quarter of exits, a quarter of projects across three versions —
are stated choices rather than derived quantities, exactly as the thresholds in (1)–(5) are, and the
main text says so. What makes them binding is not their derivation but that they are deposited before
the outcomes arrive.

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

## SM-G. Version freeze

Every number in the main text is computed at one model version with one input set, both fixed on a
dated commit before the results were read. This section records what was frozen, so that a later
reader can check that the claims preceded the outcomes.

### SM-G.1 What was frozen

| Item | Value |
|---|---|
| Model version | `a149fc30` (main branch, 29 August 2026) |
| Approvals included | `#2026-08-29-1`, `#2026-08-29-2`, `#2026-08-29-3`, plus the input-placement corrections of 29 August 2026 |
| Input freeze date | 29 August 2026 |
| Scores computed | 29 August 2026, latest run 14:33 UTC |
| Reference implementation | `model/tools/bzm30_forward.cjs` at the frozen commit |
| Input classification (§7.2) | frozen and hashed *before* any dual-scoring run: SHA-256 `2019525…8b7dcdf` (machine-readable) and `f2986fb…60b0411` (documented), commit `a4534aef` |
| Figure generation | `bzm/paper_p1_figures_v2.py`, with the data behind every figure inline in the script |

The three approvals are, in order: modelling a pre-incorporation cash-out as a change of speed rather
than a terminal state, together with conversion capacity $c$ and the quiet period $t_q$; per-project
carrier-function fills $f_1$–$f_7$ and per-project burn rates; and a realistic treatment of distress
exits, together with a planned post-incorporation burn rate. The third changes the Tier-0 defaults and
therefore the degenerate-cell results; this matters for reading Figure 4 (SM-G.3).

Revisions after this date are excluded from this paper. The ledger is a live operating instrument and
has continued to change; those changes belong to the next evaluation version.

### SM-G.2 The frozen input set

Twenty-one projects, identified by the anonymous labels used throughout §7 and ordered by their
elicited median value. Money is in millions of yen. An em-dash means the field is empty in the
registry, in which case the reference implementation supplies the Tier-0 default for the project's
type and regime — this is the "default condition" of §7.2, and the distance from those defaults is
what §7.3 measures.

**Observable state at the evaluation date.**

| ID | Layer | Type × regime | Evidence stage | Incorporated | Free cash | Burn / month | Planned post-inc. burn | Own earnings / month | Unit economics close | Unresolved rights | Under contract | Uses left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | incorporated | F2 × REG-0 | 3 | yes | 7000 | 150 | — | 5 | yes | 1 | no | 0 |
| B | pre-inc | F2 × REG-0 | 1 | no | 20 | 0.1 | 1.5 | 0.1 | no | 2 | no | 0 |
| C | incorporated | F1 × REG-0 | 4 | yes | 224.2 | 15.4 | — | 0.3 | yes | 0 | no | 0 |
| D | incorporated | F1 × REG-0 | 5 | yes | 100 | 10 | — | 3 | yes | 0 | no | 0 |
| E | pre-inc | F1 × REG-1 | 1 | no | 5 | 0.5 | — | 0.1 | no | 2 | no | 0 |
| F | incorporated | F1 × REG-0 | 3 | yes | 38 | 2 | — | 0.1 | no | 2 | no | 0 |
| G | incorporated | F2 × REG-0 | 5 | yes | 115.9 | 8.3 | — | 1 | no | 1 | no | 0 |
| H | incorporated | F1 × REG-2 | 2 | yes | 247 | 1.3 | — | 0.1 | no | 2 | no | 0 |
| I | pre-inc | F2 × REG-0 | 1 | no | 18 | 0.2 | — | 0.1 | no | 2 | no | 0 |
| J | incorporated | F2 × REG-1 | 3 | yes | 148 | 1.5 | — | 0.1 | no | 2 | no | 0 |
| K | incorporated | F1 × REG-0 | 2 | yes | 6 | 2 | — | 0.2 | no | 1 | no | 0.5 |
| L | pre-inc | F1 × REG-0 | 2 | no | 78 | 6.7 | 7 | 0.1 | yes | 2 | no | 0 |
| M | incorporated | F1 × REG-0 | 3 | yes | 2 | 2 | — | 0.3 | no | 1 | no | 0 |
| N | incorporated | F2 × REG-0 | 4 | yes | 136 | 13.6 | — | 1 | yes | 1 | no | 0 |
| O | incorporated | F1 × REG-0 | 4 | yes | 30 | 3 | — | 0.8 | no | 0 | no | 0 |
| P | pre-inc | F1 × REG-0 | 1 | no | 3 | 0.2 | — | 0.1 | no | 2 | no | 0 |
| Q | pre-inc | F2 × REG-0 | 1 | no | 2 | 0.1 | — | 0.1 | no | 2 | no | 0 |
| R | outside | F2 × REG-1 | 2 | yes | 24 | 4 | — | 0.6 | no | 1 | yes | 0 |
| S | incorporated | F2 × REG-1 | 5 | yes | 31.4 | 6.6 | — | 0.5 | no | 0 | no | 0 |
| T | incorporated | F2 × REG-1 | 3 | yes | 5 | 1.5 | — | 0.1 | no | 1 | no | 0 |
| U | incorporated | F3 × REG-0 | 2 | yes | 3 | 0.7 | — | 0.5 | no | 0 | no | 0 |

**Project parameters and the ceiling.** Carrier-function fills $f_2$–$f_7$ are stated only where an
organizational observation exists; projects without one keep the population defaults. $f_1$ is the
evangelist function and appears as $e$. The eighth slot is an extension reserved for volume-production
functions and is empty at this version.

| ID | Sector momentum $\sigma$ | Evangelist fill $ | Appropriability $\kappa_{\mathrm{IP}}$ | Conversion capacity $ | Quiet period (months) | $ | $ | $ | $ | $ | $ | Net annual ceiling |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | 1 | 0.8 | 0.55 | 1.5 | 0 | — | — | — | — | — | — | 98796.2 |
| B | 1 | 0.6 | 0.55 | 1 | 1 | — | — | — | — | — | — | 26880 |
| C | 1 | 0.8 | 0.55 | 1.2 | 2 | — | — | — | — | — | — | 17115 |
| D | 0 | 0.45 | 0.55 | 0.8 | 18 | — | — | — | — | — | — | 11812.5 |
| E | 0 | 0.4 | 0.35 | 0.7 | 2 | — | — | — | — | — | — | 20790 |
| F | 1 | 0.55 | 0.55 | 1 | 2 | — | — | — | — | — | — | 9800 |
| G | 0 | 0.7 | 0.55 | 1.1 | 3 | — | — | — | — | — | — | 3500 |
| H | 0 | 0.6 | 0.55 | 1 | 3 | — | — | — | — | — | — | 9292.5 |
| I | 1 | 0.35 | 0.35 | 1 | 6 | — | — | — | — | — | — | 4137 |
| J | 0 | 0.6 | 0.55 | 1 | 1 | — | — | — | — | — | — | 1890 |
| K | 0 | 0.3 | 0.55 | 0.2 | 27 | — | — | — | — | — | — | 59850 |
| L | 0 | 0.55 | 0.15 | 0.9 | 3 | — | — | — | — | — | — | 4961.2 |
| M | 1 | 0.2 | 0.35 | 0.1 | 24 | 0 | — | — | — | — | — | 17955 |
| N | 1 | 0.6 | 0.55 | 0.9 | 1 | — | — | — | — | — | — | 2520 |
| O | 0 | 0.25 | 0.55 | 0.2 | 23 | — | — | — | — | — | — | 1330 |
| P | 1 | 0.35 | 0.15 | 0.75 | 6 | — | — | — | — | — | — | 630 |
| Q | 0 | 0.2 | 0.35 | 0.1 | 24 | — | — | — | — | — | — | 3500 |
| R | 0 | 0.25 | 0.55 | 0.3 | 19 | — | — | 0.3 | — | — | — | 13945 |
| S | -1 | 0.4 | 0.55 | 0.2 | 18 | — | — | — | — | — | — | 700 |
| T | -1 | 0.25 | 0.35 | 0.1 | 38 | — | — | — | — | — | — | 1750 |
| U | 0 | 0.3 | 0.15 | 0.15 | 36 | — | — | — | — | — | — | 175 |

### SM-G.3 Which figure is computed at which version

Figures 2, 3 and 5 are computed at the frozen version. Figure 4 is not, and the reason is a
methodological one rather than an oversight.

| Figure | Content | Model version | Source |
|---|---|---|---|
| 1 | Framework schematic | — (contains no computed quantity) | drawn |
| 2 | Score distribution, 21 projects | `a149fc30` | stored scores, full precision |
| 3 | Dual scoring, 21 projects × 2 conditions | `a149fc30` | `bzm/tools/dual_scoring.cjs` |
| 4 | Two modelling assumptions compared | **coefficient set preceding `#2026-08-29-3`, both arms** | degenerate-cell checks |
| 5 | Terminal-class structure, 12 cells | `a149fc30` | degenerate-cell check at the frozen version |

Figure 4 compares the probability mass ending in termination when a pre-incorporation cash-out is
modelled as a death against the same quantity when it is modelled as a slowdown. The comparison is
only meaningful if the two arms share a coefficient set. The absorbing-wall arm exists only for the
implementation preceding the first of the three approvals, and re-computing it at the frozen set would
require re-introducing an absorbing state into the reference implementation. We therefore hold **both**
arms at the earlier set and say so, rather than pairing one frozen arm with one superseded arm and
reporting the difference as if it isolated the assumption. The frozen version's own termination masses
(Figure 5, 32–59% across cells) sit within about two points of the speed-rule arm shown in Figure 4,
so the comparison is not sensitive to the gap.

### SM-G.4 What the freeze does not cover

Three things are outside it, and each is stated where it bears on a claim in the main text.

1. **The absolute level is not calibrated.** Raising Tier-0 levels by removing the pre-incorporation
   absorbing state broke the calibration of the common multiplier that had matched own-production
   attainment rates to external statistics. Re-calibration is outstanding. The degenerate-cell checks
   establish directions and relative structure; no claim in this paper rests on the level (§7.5).
2. **The elasticities of §7.6 were measured on the preceding implementation** and are labelled as such
   there and in SM-C. The ordering, not the magnitudes, is what the text relies on.
3. **The registry is not a public dataset.** The underlying records are proprietary operating data of
   a single venture builder. What is deposited is this section: the model version, the approvals, the
   classification hashes, the per-project input set above, and the figure-generation script with its
   data. That is enough to recompute every number in §7 given the reference implementation, and not
   enough to identify a project from this document alone.
