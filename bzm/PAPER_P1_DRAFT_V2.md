---
title: "The Before Zero Model: additionality-based valuation of university deep-tech projects before the firm exists"
---

<!-- PAPER_P1_DRAFT_V2.md — S3 full draft. 正本はこの md。HTML は pandoc 生成 (PAPER_P1_PREVIEW_V2.html)。
     状態: v2.6 (2026-08-29)。**入力凍結済み: main 91385d77 / 承認 #2026-08-29-1・-2 + 入力の置き直し**。
     以降のモデル・入力の改訂は本稿の数値に反映せず、次の評価版で扱う (まさ確定 2026-08-29)。
     残る空欄は二重採点の全件分布のみ (計算中)。[verify at S6] タグ = 投稿前照合。著者行は暫定 (共著相談前)。 -->

**Masa Yamaji** — Team ARMADA Inc., Japan. *Author line provisional; declarations at end.*

*Draft v4.1 (full working draft). Target: Journal of Technology Transfer. Word count (main text): ~10,700. The model version and its inputs are frozen (main commit 91385d77; approvals #2026-08-29-1 and #2026-08-29-2 plus the input-placement corrections of 29 Aug 2026 — recorded in SM-G). Five figures are computed at the frozen version; the coefficient elasticities of §7.6 are carried over from the preceding implementation and are labelled as such. No placeholders remain.*

# Abstract {-}

University deep-tech projects are screened, funded, and steered toward incorporation at a stage when no firm exists — yet the instruments used to screen them, from discounted cash flows to readiness levels and composite indicators, all presuppose one. We formalize this as the *Before Zero* measurement problem: no legal entity, no financial statements, no settled management team, no record of the failures; and because a laboratory that runs out of money slows rather than dies, even the absorbing-state logic of survival models imports a firm premise. We present a valuation framework whose object is not the venture but a *registered plan* over an observable monthly state, bringing the additionality logic of ex-post programme evaluation — value net of displacement, net of counterfactual realization, socially discounted — to ex-ante, project-level selection, and pricing every exit form on one yen-denominated scale of net domestic value creation. Developed and operated inside a venture builder and reported as design science, it comes with its operating system: externally verifiable gates, evidence grades that expire, a typed registry, and a calibration plan with explicit identification constraints. Scoring twenty-one live projects twice — from the operating database alone, then with facts obtained by asking — leaves most rankings intact and moves a few by up to two orders of magnitude, usually downward. Withholding inputs singly identifies the asymmetry: financial inputs move scores by a median factor of 2.0 and a maximum of 27, organizational inputs by a median of 1.03 and a maximum of 1.3. The binding constraint on ex-ante selection is the observation system and the instrument's sensitivity to it, not the aggregation formula.

**Keywords:** university spin-outs; deep tech; ex-ante evaluation; additionality; technology transfer; design science

# 1. Introduction

Consider the moment at which a university deep-tech project is screened: a gap-fund committee prices it, a technology transfer office (TTO) triages it, a venture builder decides whether to assemble a team around it. At that moment the project typically has no legal entity, no financial statements, no chief executive, and no revenue, and the paths open to it still include licensing, acquisition, and a modest self-sustaining business as well as the venture-scale company the pitch deck depicts. Yet the instruments available for screening — discounted cash-flow and venture-capital valuations, technology readiness levels, weighted composite scores — were built for objects that have at least some of these attributes. The object being screened is not a firm; the screening tools assume one.

We call the interval between the public disclosure of a research result and the incorporation of a company *Before Zero*. Longitudinal studies of university spin-outs show that the junctures which largely determine what the future firm can become — consolidating intellectual property, sequencing disclosure, assembling the carrying team, timing incorporation itself — concentrate in this interval<sup>[1,2]</sup>. It is also the interval in which evaluation practice is most improvised: committees borrow firm-stage tools, adjust them by feel, and archive the results in databases that record progress but not its absence. This paper treats that improvisation as a measurement problem and reports an instrument built for it.

The instrument transplants a logic that is mature elsewhere. Ex-post program evaluation has long priced public research and development (R&D) by *additionality*: the value a program created net of what incumbents lost and net of what would have happened anyway, discounted at a social rate<sup>[3,4]</sup>. We bring that logic to ex-ante, project-level selection in a domain where the firm does not yet exist. The move that makes this operable is a change in the object of evaluation: what is scored is not the venture — there is none — but a *registered plan*: a set of decision rules, conditioned only on externally observable events, run forward over a monthly observable state. Selection then means asking what a given plan, executed on a given state, is expected to create for domestic industry, in yen.

Methodologically, this is design science research: an artifact designed, implemented, and evaluated inside the operations of one venture builder, reported with design propositions and falsification conditions rather than with claims of external validity (van Aken<sup>[5]</sup>; Romme<sup>[6]</sup>; Gregor and Hevner<sup>[7]</sup>). We state this genre openly because it governs what the paper does and does not claim. The requirement set is disclosed together with its derivation and its rejected alternatives; the coefficients are initial values awaiting calibration, and are labeled as such; the empirical section is a retrospective application plus implementation verification, not a validation.

Two boundary commitments prevent this framework from being read as more than it is. First, "selection" here means replacing the *objective function* of screening; the framework issues no go/no-go decisions and allocates no funds. Those decisions belong to a second tier — in our case an investment vehicle — that weighs the model's output against costs, portfolio constraints, and fiduciary duties. Second, the score V is a gross measure of value creation; the costs of achieving it (public grants consumed, builder capacity absorbed) are deliberately left on the second tier's ledger, and we say so rather than net them invisibly.

The paper contributes three things. First, a formalization of the Before Zero measurement problem as five broken premises — no legal entity, no financial statements, no settled team, no survivorship records, and no absorbing state at zero cash — that jointly disqualify firm-stage instruments (§2). Second, an additionality-based valuation framework whose object is a registered plan, together with the operating system that makes it auditable: externally verifiable gates, evidence grades with expiry, a typed event registry, gaming-resistance rules, and a calibration plan with identification constraints (§4–§6). Third, evidence on *information sufficiency* from scoring twenty-one live projects twice, once from the operating record alone and once with elicited facts (§7): the effect is concentrated rather than diffuse, asymmetric between financial and organizational facts, and absent altogether in the pre-incorporation layer, which relocates the binding constraint of ex-ante selection from the aggregation formula to the observation system and the defaults that stand in for it.

Section 2 states the measurement problem and situates it against the instrument families that might claim it. Section 3 presents the design propositions. Sections 4 and 5 define the framework and the value function; Section 6 the operating system. Section 7 reports the application, and Section 8 the policy implications and the prospective research program.

# 2. The measurement problem

## 2.1 Five broken premises

Four absences define the object. A Before Zero project has: (1) *no legal entity* — there is no boundary that delimits its accounts, contracts, or ownership; (2) *no financial statements* — there is no cash-flow base from which to project, and often no cost series at all; (3) *no settled management team* — the carrier of execution, which firm-stage evaluation treats as an attribute to be scored, is here undetermined and partly a product of the selection decision itself; and (4) *no survivorship record* — projects that quietly end before incorporation leave no registry trace, so any sample drawn from firm records is left-truncated<sup>[8]</sup>.

A fifth premise breaks more quietly. Nearly every quantitative treatment of young-organization survival models death as absorption at zero resources<sup>[9]</sup>. That logic presupposes an entity with payroll to meet. A research laboratory that runs out of project money does not die: it slows down, survives on institutional infrastructure, and waits for the next public grant. Before incorporation, cash-out changes *speed*, not existence. Any valuation that imports absorption-at-zero into this domain therefore imports a firm premise — and, as Figure 4 shows, the error is not decorative: whether cash matters enormously or hardly at all turns out to be the sharpest behavioral difference between the pre- and post-incorporation regimes.

## 2.2 Why the available instrument families break

Table 1 summarizes the mismatch. Discounted cash-flow and venture-capital methods need projections anchored in statements and comparables anchored in firms; the most serious attempt to stretch them toward young companies<sup>[10]</sup> still assumes an operating entity, and the venture-capital model fits deep tech poorly even after incorporation<sup>[11]</sup>. Real options need a definable underlying asset and exercise cost; here even the cost series is undefined. Readiness scales are ordinal and single-axis: they order technical maturity but cannot say what a project is worth, and they collapse when the binding constraint is a missing carrier or an unresolved right. Composite indicators aggregate incommensurable axes under weights whose arbitrariness is well documented; a weighted sum of readiness axes is not a value, and it licenses rank reversals that follow the weights rather than the projects [verify at S6: composite-indicator critique anchor]. Survival models founder on premises four and five at once: their samples are survivors and their absorbing state is a firm's death.

**Table 1. Instrument families and the premise that breaks at Before Zero.**

| Instrument family | Presupposes | What breaks before the firm exists |
|---|---|---|
| DCF / VC method | statements, comparables, an entity | no cash-flow base; no comparable class; no entity boundary |
| Real options | definable underlying, exercise cost | cost series and exercise object undefined |
| TRL / readiness scales | technical maturity is the bottleneck | ordinal, single-axis; silent on value and on non-technical binding constraints |
| Composite indicators | commensurable axes, defensible weights | weights arbitrary; sum is not a value; reversals follow weights |
| Survival / hazard models | firm death as absorbing state; registry samples | left truncation; labs pause instead of dying |
| Program-level additionality evaluation | a defined program with costs and outputs | object itself undefined: no firm, no cost series, no output definition |

## 2.3 What the additionality tradition supplies — and what it lacks here

The tradition we transplant is the strongest of the candidates, which is why its gap matters. Social cost-benefit analysis has selected projects ex ante by shadow-priced net social benefit since the 1970s<sup>[12,13,14]</sup>. Program evaluation of public R&D prices benefits net of counterfactual realization<sup>[3]</sup>, and the "but-for" test was applied project-by-project in the U.S. Advanced Technology Program's selection criteria [verify at S6: ATP statutory criteria citation]. Forecast-mode social-return frameworks operationalize precisely the deductions we need — deadweight (what would have happened anyway), displacement (what incumbents lose), attribution, drop-off [verify at S6: SROI guide edition]. In health technology assessment, value-of-information analysis selects research projects by integrating expected social value over a parameter prior<sup>[15]</sup> — mathematically the same two-stage expectation our score uses.

The closest of these to our purpose is the forecast mode of social-return accounting, and it deserves a precise rather than a dismissive comparison, because it does not require a firm: its object is an intervention and its theory of change, and a Before Zero project is exactly such an intervention. The differences are three, and they are differences of construction rather than of scope. Its denominator is welfare, valued through proxies for outcomes that markets do not price; ours is domestic value added, deliberately narrower and directly comparable to the ledger on which industrial policy is argued. Its estimate is a single expected figure derived from a static logic model; ours is a two-stage expectation over a stochastic process, which separates uncertainty that investigation can reduce from uncertainty it cannot. And its causal object is a fixed programme; ours is a policy over an observable state, so that the same project evaluated under a different plan yields a different value — which is the point of the instrument.

The remaining traditions do inherit their object from elsewhere: a programme with a budget line, a policy with a defined instrument, a trial with a protocol. Here that object is what is missing, and supplying it — a definition of the thing valued, not a new valuation logic — is the contribution.

## 2.4 What the spin-out literature supplies

The phenomenon, unlike the object, is well described. Stage models trace pre-company phases and their junctures<sup>[16,1,17,2]</sup>; TTO studies show that disclosure triage already operates on informal expected value<sup>[18,19,20]</sup>. Nor is ex-ante assessment of pre-incorporation objects itself new. Simple scoring instruments have been applied to inventions before any company exists and checked against later commercial outcomes<sup>[73]</sup>, expert panels have been studied as predictors of early-venture success<sup>[74]</sup>, and the prospective registration design we propose in §8.4 — enrolling cases from first contact rather than from incorporation — is the design principle of the panel studies of new-venture gestation<sup>[75,76]</sup>. The conceptual move of treating an organization-in-formation as an object in its own right predates all of this<sup>[77]</sup>.

What none of this literature supplies is a mapping from stages, scores or gestation events to a money-denominated, plan-conditional value that is indifferent to exit form. The stages are described and the odds are scored; neither is priced. Our claim is emphatically not that Before Zero is unstudied, nor that it has never been assessed ex ante; it is that it has not been *valued* in a way that can be compared across exit forms and added up. That narrower claim is what the rest of the paper defends.

## 2.5 Which counterfactual

One distinction must be fixed before any formalism, because it decides what the number means. *Enterprise-level additionality* nets out what other actors would have realized had this project never existed. *Investor additionality* nets out what would have happened had this particular funder or builder not engaged<sup>[21]</sup>. The two differ whenever a project would have been carried by someone else. This framework measures the former; the builder's own contribution is a separate identification problem left outside (§3.4), and the two coincide only under an assumption we state and register for falsification (§8.4): that in the current Japanese Before Zero population, projects not carried by a dedicated builder are, with high probability, not carried at all.

## 2.6 The gap

No existing apparatus (i) defines a valuation object for a project with no firm attached, (ii) prices its industrial contribution net of displacement and counterfactual realization on a scale indifferent to exit form, and (iii) remains auditable when the evaluated parties can game the inputs. Constructing and operating that apparatus is the contribution this paper reports.

# 3. Design propositions

## 3.1 Derivation and its disclosure

The requirement set was not derived from literature; it was distilled from the 2026 operating decisions of one venture builder (the author's organization) as it screened live university seeds, and each requirement was confirmed or rejected in a logged sequence of design decisions by the builder's lead — who is also the author of this paper. That is self-confirmation, not independent validation, and we name it as such: the log establishes that the requirements were fixed deliberately and traceably, not that anyone outside the organization agrees with them. We report it in the design-science register: as *design propositions* — normative statements about what an artifact for this task must handle — open to falsification through use rather than argued as theory (van Aken<sup>[5]</sup>). The derivation trail, including verbatim decision records, is in Supplementary Material (SM) E; the content-validity step of circulating the propositions to external practitioners<sup>[22]</sup> is registered as future work, not claimed.

## 3.2 The twelve propositions

Table 2 states the twelve design propositions (DP1–DP12), the theoretical footing each rests on, what had to be newly built because the footing literature begins "after the firm exists," and the implementation status of each in the current reference implementation. Two of the twelve are falsifiable claims about the domain — DP2, that cash before incorporation changes speed rather than survival, and DP9, that carrier vacancy delays rather than disqualifies — and both are registered for testing in §8.4. The remainder are design decisions: to denominate in yen, to price all exits on one scale, to treat unit economics as a gate. Decisions of that kind can be judged useful or useless but not true or false, and we do not present them as findings. The last column is deliberate: nothing in this paper's model is presented as implemented when it is approximated or pending.

**Table 2. Design propositions, footings, and implementation status.** *(Implementation status: I = implemented; A = approximated, declared in §7; C = awaiting calibration; P = pending model revision.)*

| # | Design proposition | Theoretical footing | What had to be built | Status |
|---|---|---|---|---|
| DP1 | Conversion capacity: score the rate at which resources become progress, not the resources | Penrose<sup>[23]</sup>; Teece<sup>[24]</sup> | measuring capability at zero revenue, from gate history | I/C |
| DP2 | Strategic slack: cash as a stock whose exhaustion changes the process — but only after incorporation does it kill | Bourgeois<sup>[25]</sup>; Levinthal<sup>[9]</sup>; §2.1 fifth premise | slack for entities without statements; two-account (free/restricted) yen stocks | I / A (accounts collapsed) |
| DP3 | Self-propulsion: earning capacity independent of external finance is value, and a pivot seed | Winborg and Landström<sup>[26]</sup>; Myers and Majluf<sup>[27]</sup> | measuring "can it earn" before any revenue exists | I/C |
| DP4 | Timing window: incorporation can be too early and too late; both sides close | McDonald and Siegel<sup>[28]</sup>; Weeds<sup>[29]</sup> | clocks from calls, tenure, patents, rivals — not market prices | I (diagnosis P) |
| DP5 | Sector momentum: academia–industry–government tailwind conditions award and offer rates | Etzkowitz and Leydesdorff<sup>[30]</sup>; Aldrich and Fiol<sup>[31]</sup> | mapping field momentum onto one project's hazards | I/C |
| DP6 | Money-denominated output: the score is yen, not an ordinal index | decision analysis<sup>[32,33]</sup> | denomination without market prices for the object | I |
| DP7 | Absorb all field conditions that move score precision | structured expert judgment<sup>[34]</sup> | typed registry from evidence to state (§6) | I |
| DP8 | Exit-form independence: production, licensing, M&A, small business — one scale | Wennberg et al.<sup>[35]</sup>; DeTienne et al.<sup>[36]</sup> | nine terminal classes valued identically (§5) | I / A (offers always accepted) |
| DP9 | Carrier as functions: decompose the team into functions; vacancy delays, it does not disqualify | Morgeson et al.<sup>[37]</sup>; Lazear<sup>[38]</sup>; Wasserman<sup>[39]</sup> | evaluating with the carrier undetermined; fill processes | I/A |
| DP10 | Ceiling: the size of the industry the application set could create bounds value | input–output accounting<sup>[40]</sup>; Adner<sup>[41]</sup> | per-application annual domestic value-added ceilings at screening depth | I/C |
| DP11 | Unit economics as a hard gate: no application enters value unless price can exceed cost floor | Wright<sup>[42]</sup>; Gutowski et al.<sup>[43]</sup> | cost floors by process physics before process design exists | P (implemented as a penalty, §5.7) |
| DP12 | Capital intensity: the *gap* between required cumulative funding and current slack drives gates-to-cross | Roberts and Weitzman<sup>[44]</sup>; Audretsch and Mahmood<sup>[45]</sup> | funding-cliff counts under public-grant regimes | I |

## 3.3 Rejected candidate requirements

The boundary of a requirement set is as informative as its content.  Four candidates were considered and rejected, with reasons logged: *inverted-U slack*, because the evidence is from established firms while young private ventures show a positive slope<sup>[46,47]</sup> and Before Zero projects live in chronic scarcity where the descending arm is unobserved; *Monte Carlo simulation* over judgment-quality inputs, since draws add no information to elicited ranges — the implementation uses deterministic grids, at the cost of propagating only four of the thirteen parameters (§7.7); *irreversibility points* as a standalone requirement, their decision content being carried by slack and the timing window; and *IP ownership* as a standalone requirement, rights being one of several gate-blocking items rather than a category above shareholder agreements or unit economics.

## 3.4 Non-independence and exclusions

The propositions are not independent, and treating them as separately scorable axes would reproduce the composite-indicator failure. Slack and capital intensity interact (what matters is the gap); conversion capacity measured by slack increments risks double-counting DP2; learning-curve cost declines are a function of cumulative investment. The framework therefore enforces a one-effect-one-entry discipline at the registry level (§6.3). Two families are excluded by design: the host institution's readiness (a property of the nursery, not the seed — a separate theory), and the causal effect of builder intervention (§2.5). Folding either into the project score would conflate the readiness of the nursery, or the contribution of the builder, with the value of the project itself — three questions that need separate answers.

# 4. The framework

## 4.1 The object of evaluation

The framework's central move is to give the missing object a definition. What is evaluated is a **registered plan over an observable state**: a tuple $(\pi^{\mathrm{plan}}, x_0, B_0)$ consisting of decision rules registered at evaluation time, the observable state at that time, and a prior over parameters that cannot be observed directly. The score answers one question: *what is this plan, run on this state, expected to create for domestic industry?* Nothing in the object requires a firm; incorporation is simply one of the events the plan may trigger.

![](figures_v2/fig1_framework.png)

**Figure 1. The framework.** An observable monthly state and a prior over unobservable project parameters feed a plan registered from a finite template; the plan conditions only on observables, never on the parameters. Running it forward produces scenarios ending in nine terminal classes, each priced on one scale of net domestic value added. The score integrates twice — over scenario branching, which investigation cannot reduce, and over parameter ignorance, which it can.

## 4.2 The observable state

Time advances monthly from the evaluation date, $t = 0, 1, \dots, T$ (evaluation horizon $T = 240$ months, a convention shared across projects; value beyond $T$ is carried by a continuation term, §5.6). The observable state is

$$
x_t = \big(g_t,\ s^{\mathrm{f}}_t,\ s^{\mathrm{r}}_t,\ R_t,\ \iota_t,\ \chi_t,\ A_t,\ n_t,\ \varsigma_t\big),
$$

whose components are the next stage gate; free and use-restricted cash balances in yen; the unresolved rights and approvals, each with its committee calendar; the incorporation flag; the state of any contract-work lock-in; the set of *active applications* — uses that have passed their market gate and are generating value; the history of attempts; and a regulatory-review countdown. Cash follows an explicit monthly transition given in SM-A: burn and fiscal-year expiry draw the balances down, contract earnings, sales and funding inflows replenish them. Three terms in that transition are specification rather than current implementation, and we say so here rather than in an appendix: the reference implementation collapses the two accounts into a single balance with a fixed uplift for unusable funds, does not model fiscal-year expiry or disbursement lags, and carries no sales term, treating the production-contract gate as absorbing and valuing what follows analytically. None of the numbers in §7 depends on the sales term or on the account split.

Hard deadlines — final calls, tenure clocks, rights expiries, fiscal year-ends — enter the state as dated constraints rather than hazards, because their dates are known. One bookkeeping rule governs the two accounts and is easy to get wrong: **balances and outlays must be recorded on the same side**. If a restricted public grant is excluded from the balance, the expenditure it funds must be excluded from the burn rate as well; if it is included, both are. Recording only one side misreads the months of runway by an order of magnitude, and in the wrong direction — a project that has just won a large grant appears to be burning through nothing.

## 4.3 Project parameters and their prior

Thirteen quantities cannot be observed directly and are treated as project parameters $\theta$: conversion capacity, the fill prospect of the evangelist function, sector momentum, process type, technical-core validity, appropriability, and the per-application terms — willingness-to-pay caps, annual domestic value-added ceilings, displacement shares, counterfactual schedules, production-cost floors — together with self-propulsion. Each is estimated at the evaluation date from source-tagged evidence by a four-point elicitation (low, best, high, confidence) in the structured-expert-judgment lineage<sup>[13,48,49]</sup>, yielding the prior $B_0(\theta)$; correlated components share source variables rather than being elicited independently. Definitions are in SM-A.

Two of these deserve their measurement rules stated here. Conversion capacity $c$ — the *speed* at which resources become progress, not the reach of what the project could attempt (§5.1) — is estimated per project as a recency-weighted moving average of the ratio of strategic-slack increments (funds won, gates passed, IP created, relationships, people retained) to the spending that produced them, with pre-incorporation grants credited not at face value but by how much of them became project assets; where spending records do not exist, $c$ is approximated from the *quiet period* — months since the last externally visible positive event — on a declared scale. The quiet period is itself an observable that damps offer-arrival hazards (§5.8). The carrier's functions enter as per-project fill observations: seven of the eight decomposition slots are populated, the eighth being an extension slot reserved for volume-production functions and currently empty. The technical core may be marked vacant only on an observed loss, in which case the blanket loss hazard is switched off so the same fact is not counted twice. Projects without organizational observations keep the population defaults.

One honesty clause governs $\theta$: it is held constant over the horizon *because its variation cannot be separately identified from the gate history, not because capabilities are static*. This is a declared approximation, and it sits in visible tension with the dynamic-capabilities footing of DP1, in which capability is precisely the capacity to change the resource base<sup>[24,50,51]</sup>. Evaluation-version updates (re-estimating $B_0$ as evidence accumulates) are the mechanism that absorbs slow variation; monotone drift of posteriors across versions is one of the registered falsification signals (§8).

## 4.4 Plan rules

The plan $\pi^{\mathrm{plan}}$ is registered from a finite template — gate order; failure branching (retry, pivot, exit thresholds); the incorporation condition (demand evidence plus a funding prospect, source-indifferent); response policy to realization offers (licensing, M&A, IP sale); contract-work policy; and a stop condition. Two restrictions carry the framework's epistemology. First, rules may condition **only on observables** — the state, the funding-window list, contract terms — never on $\theta$, which no party observes (the implementation collapses the window list into a constant arrival rate, so rules conditioning on named calls are specified but not yet exercised); this keeps the scenario measure well-defined and forecloses self-serving rule definitions. Second, registration is by the evaluator from the template, with second-person approval, not by the evaluated project; unregistered projects receive sector defaults (Tier 0), so every project has a defined score, and deviations from defaults are displayed rather than hidden.

The relation to effectuation theory deserves one paragraph, because "register a plan" can be misread as "demand a prediction." What is registered is a *policy* — branching responses to observable events — not a forecast of which branch will occur; the critique of prediction-based planning<sup>[52]</sup> does not bite a conditional rule set, and experimental evidence that entrepreneurs trained to make decision rules explicit terminate and pivot better<sup>[53]</sup> runs in the framework's favor. What the framework genuinely cannot represent is goal transformation — new stakeholders redefining what the project is for — because application sets are fixed within an evaluation version. That is a scope condition, stated as such.

## 4.5 Monthly transition and terminal classes

Each month resolves in a fixed order: dated deadlines; stochastic loss (competitor preemption, demand disappearance, permanent loss of the technical core); the process draws — gate advance, award decisions, offer arrivals, rights resolutions, contract events; rule application; cash update; absorption and self-sufficiency checks; history update. Gate advance is a hazard compounding the sector base rate with technical-core validity on technical gates, conversion capacity, the carrier-fill factor of §6.2, and a drag term for contract work; the expression is in SM-A. Scenarios terminate in nine classes measured on one scale: capital self-sufficiency within or after the 60-month plan horizon, licensing, M&A, IP sale, pivot, withdrawal, liquidation, and undecided continuation. When self-propulsion fails, probability mass does not fall into a single death state but splits across four routes — application pivot, exit-class conversion, licensing fold-down, and return of the rights to the institution (value zero; any later revival is a new project) — with evidence-level asymmetries that prevent early-stage projects from claiming exit value they cannot show. Before incorporation the process does not absorb at zero cash at all: when free funds cannot cover the burn, progress continues at a reduced rate with running expenses carried by the institutional base, and the project re-accelerates on the next award — the fifth premise of §2.1 implemented as a speed rule rather than a death state. After incorporation, cash-out routes into the four-path split, because a company, unlike a laboratory, cannot pause.

## 4.6 The score and its two kinds of uncertainty

For a fixed $\theta$, the plan induces a probability measure over scenarios $\omega$; the conditional value is $v(\theta) = \mathbb{E}[\Pi(\omega) \mid \theta, \pi^{\mathrm{plan}}]$, computed by a forward deterministic grid (no Monte Carlo at judgment-quality inputs), and the score integrates over the prior:

$$
V \;=\; \int v(\theta)\, dB_0(\theta).
$$

The two-stage structure separates uncertainty by what information can do to it. Scenario branching inside $v(\theta)$ is irreducible — more research does not tell you whether the next trial succeeds. Parameter ignorance in $B_0$ is reducible — and because the same computation yields the sensitivity of $V$ to each component of $\theta$, the model reports *which parameter to investigate next*, turning DP7 from a slogan into an output.

## 4.7 Reporting

A score is reported as three numbers — the 10th, 50th, and 90th percentiles of $v(\theta)$ under $B_0$ — plus the ratio upper/lower as an explicit "how much is not yet known," the probabilities of the value-bearing paths, and the continuation-value share, flagged for review when it exceeds half (§5.6). One reading rule prevents a common misinterpretation: the percentiles quantify *parameter ignorance alone* — scenario uncertainty is already integrated inside each $v(\theta)$ — so the band means "what investigation could still narrow," not "the range of what might happen." Grid-convergence error is below 0.3% (§7.5); values are still read to two significant digits, input quality being the binding limit.

# 5. Valuing industrial creation

## 5.1 The value of a scenario

A scenario's value is the discounted sum of the net domestic value added created by its active applications, month by month, plus a terminal continuation value:

$$
\Pi(\omega) \;=\; \sum_{t=1}^{T} \frac{1}{(1+d)^{t/12}} \sum_{u \in A_t(\omega)} \phi_u\, \frac{\bar P_u - \delta_u}{12}\,\big(1 - \alpha_u(t)\big) \;+\; \frac{1}{(1+d)^{T/12}}\, C\!\big(x_T(\omega),\ \theta\big).
$$

Each element earns its place. $\bar P_u$ is the annual domestic value added the application could sustain at maturity — value added in the national-accounts sense, not revenue<sup>[26]</sup> — set as one number per application, because the uncertainty of *reaching* it is carried by scenario probabilities and the ramp-up of $A_t$; giving the ceiling its own distribution would count the same uncertainty twice. That reasoning covers reachability but not the width of the ceiling estimate itself, which §7.7 shows to be the largest single lever on any score and which the reported bands therefore do not propagate. Applications enter $A_t$ only at the adoption gate, ramp over twelve months, and exit by an observed withdrawal or an obsolescence hazard running over the whole active life. The ceiling is bounded by what the project can undertake: applications whose development it has no prospect of financing are excluded rather than left in as distant possibilities — conversion capacity governs the *speed* of progress, not reachability of an application the project cannot fund. Late realization is automatically worth less: the discount sits inside the scenario. One approximation belongs here rather than in the supplement: the implementation evaluates a single principal application rather than summing over the set, since applications sharing a gate sequence would otherwise be counted more than once, so projects with several plausible applications are scored conservatively.

## 5.2 What is counted — and what deliberately is not

The framework prices the value realized by the **project system** — the project and its successors in realization, a licensee or an acquirer — and not the value realized by imitators. The share parameter $\phi_u$ (increasing in appropriability) captures how much of an application's domestic value added the project system can bring into being — the classic determinant of who profits from an innovation<sup>[54]</sup>. A reader trained in the economics of research subsidy will object that weighting by appropriability inverts the usual rationale for public support, which rests on the gap between private and social returns. The objection has force where knowledge spills over freely, and less here: public programmes in this field explicitly select on the strength and defensibility of a proprietary position, so appropriability among projects in scope is high by construction. We nonetheless report $V$ computed without $\phi_u$ alongside the headline value, since the gap between them is largest exactly where imitation is easiest. The second figure costs nothing to produce and the reason is worth stating, because it is a structural property of the framework rather than a convenience: appropriability enters only the accumulation of value and never a hazard, a gate, or a decision rule, so the whole score is exactly proportional to $\phi_u$ — a project's value without the appropriability weighting is its headline value divided by $\phi_u$, verified numerically to eight significant figures. A reader who rejects the weighting can therefore undo it, project by project, from the reported numbers, and a reader who wants the private-value reading rather than the industry-creation one can apply their own share instead.

Two consequences follow. The measure is an **industrial-policy objective, not a welfare quantity**: consumer surplus is not counted, factor opportunity costs are not netted, and we do not call the result social value. And spillovers through imitation — often the majority of an innovation's social return<sup>[55,56]</sup> — are outside the object by design; a selector who wishes to value them needs a different instrument.

## 5.3 Displacement, counterfactual, and the no-double-deduction rule

Two deductions make the measure *net*. Displacement $\delta_u$ removes the domestic value added that incumbent activity loses to the application<sup>[57,58]</sup>. The counterfactual schedule $\alpha_u(t)$ removes what others would have realized anyway: up to an acceleration horizon $L_u$ (estimated from the competitive landscape), only the acceleration wedge counts; beyond it, only the location wedge — the difference between the value arising domestically rather than abroad. Because a domestic competitor's alternative realization is simultaneously displacement-like and counterfactual-like, the two deductions are governed by a single-entry rule: one fact, one deduction, worked through the registry typing (§6.3), never both.

## 5.4 The counterfactual under partial identification

$\alpha_u$ cannot be calibrated, in principle: it is a claim about a world that will not occur. The framework therefore treats it under partial identification<sup>[59]</sup>: competitor audits bound it from below and above, the score is reported across the bounds, and — the operational payoff — we report the **breakeven $\alpha$** at which project rankings flip. Honesty compels one disclosure that a promotional paper would bury: at current default settings, with $L_u = 36$ months and value realization typically beyond it, the deduction binds as a near-constant factor across projects and therefore does *no selection work yet* (measured elasticity $\approx 0$; §7.6). It begins to discriminate exactly for projects that can reach market inside the acceleration horizon — which is where a counterfactual should discriminate.

## 5.5 Discounting

Values are real 2026 yen, discounted at a social rate of $d = 2.0\%$ per year derived from a Ramsey decomposition (pure time preference 0.5–1.0%; elasticity of marginal utility 1–2; long-run per-capita consumption growth 0.3–1.0%), with 1% and 4% reported as sensitivity and any rank reversal under them flagged. Risk carries no premium in $d$ — failure lives in scenario probabilities and parameter ignorance lives in $B_0$ — Damodaran<sup>[10]</sup> makes the corresponding argument for survival-adjusted valuation — and the risk-spreading logic of Arrow and Lind<sup>[60]</sup> covers the idiosyncratic component; what $d$ does not cover, and we flag as a limit, is aggregate covariance of sector momentum with the macroeconomy; the long-horizon end of the schedule is governed by the declining-rate results of Weitzman<sup>[61]</sup> and Gollier<sup>[62]</sup>.

## 5.6 Continuation value

Beyond the horizon, unresolved states are extended under default rules for 120 months and surviving applications receive a perpetuity under the obsolescence hazard; decided scenarios keep only their surviving applications' tails. Because the same hazard runs during and after the horizon, the tail neither double-counts nor gaps. The continuation share of $V$ is reported per project — at current defaults it spans 33.5–75.1% across sector cells (§7.5) — and any project whose value is majority-continuation is review-flagged: the least verifiable assumption is not allowed to dominate a number silently. Construction details are in SM-A.

## 5.7 The unit-economics gate

The specification admits an application into $A_t$ only where the willingness-to-pay cap exceeds the production-cost floor, $m_u = w_u - \underline{c}_u > 0$, with floors drawn from process-type priors (thermodynamic and experience-curve bounds: Gutowski et al.<sup>[43]</sup>; Wright<sup>[42]</sup>; Lafond et al.<sup>[63]</sup>) and updated by evidence. A project none of whose applications clears the gate would accumulate no value. In the reference implementation the gate is softer than the specification: with the ceiling normalized, the condition is assumed satisfied and the unit-margin flag instead enters an economic multiplier that damps award and offer rates. DP11 is therefore specified as a rule inside the model and implemented as a penalty; the hard form is pending, and Table 2 records it as such.

## 5.8 Exit-form independence in operation

Licensing, acquisition, and IP-sale offers arrive as hazards increasing in appropriability, evidence level, momentum, and carrier fill, and damped by the quiet period (§4.3); whether an offer is taken is, in the specification, the plan's decision; the implementation currently accepts every offer, which is one reason the elasticity of value to the licensing arrival rate comes out slightly negative in unregulated cells. The value that follows is the successor's: the tail is scaled by the probability that a licensee (0.60), acquirer (0.75), or IP buyer (0.45) completes the remaining market gates — initial values, all awaiting calibration. Nothing in the scale privileges the IPO-track scenario: a service business that reaches self-sufficiency on repeated contract work books its (smaller) domestic value added on exactly the same ledger, which is DP8 kept honest.

## 5.9 Two numbers, not one

Finally, the measure decomposes in principle into an acceleration wedge (value the world gets earlier — a genuine welfare-relevant gain) and a location wedge (value arising in Japan rather than elsewhere — a transfer between jurisdictions). The reference implementation does not yet emit the two separately, and we flag the consequence rather than leave it implicit: because realization typically falls beyond the acceleration horizon, most of the reported value is the location wedge, and a reader should treat the headline as predominantly a claim about where value arises rather than about whether it arises sooner. Emitting the decomposition per project is a required output of the next version. A selector maximizing the sum is running an industrial policy and should know it; the decomposition is what keeps the beggar-thy-neighbor critique answerable by construction rather than by rhetoric.

# 6. Operating the system

A valuation object that can be gamed is not a measurement. The framework therefore ships with an operating layer whose rules are as much a part of the artifact as the equations.

## 6.1 Gates and evidence grades

Stage gates are defined only by externally verifiable events — third-party replication, standards tests, a paid proof-of-concept above a materiality threshold, production terms bearing an authorized signature — drawn from a standard table by process type and regulatory attribute; splitting a standard gate to farm passage counts is displayed as a deviation and collapsed to one passage in computation. Demand evidence carries graded strength (interest, paid proof-of-concept, production terms, adoption), rises only on defined events, and *expires*: a paid proof-of-concept with no follow-on movement for twenty-four months falls back to "interest"; production terms lapse after twelve. Evidence is not allowed to age into pedigree. The complete table is in SM-B.

## 6.2 Carrier functions

The management team is decomposed into eight functions (evangelist, technical core, application and customer development, decision-making, fundraising, negotiation and contracts, organization building, plus an extension slot), following the functional view of leadership<sup>[63]</sup>. A function counts as filled only on recent, multi-point, evidence-floored *working records* — titles and intentions do not count — and vacancy produces delay, not disqualification: the fill factor $\eta_t = \prod_f (1 - d_f\,\mathbb{1}[\text{vacant}])$ multiplies gate advance, award and offer hazards. Two declared weaknesses bound this design. The product form excludes compensation and threshold effects among vacancies, whereas founding-team evidence suggests function *bundles* matter<sup>[64,65]</sup>; §7.3 shows the practical consequence, which is that the score barely responds to organizational evidence at all. And carrier supply is shared across a builder's portfolio while the model prices projects one at a time, so per-project scores are not portfolio-consistent; in congestion the model overstates simultaneous achievability<sup>[69]</sup>.

## 6.3 The event registry

Every observation enters as one typed row: date, event type from a fixed list spanning funding, rights, verification, market, people and environment, a declared *target* — state component, parameter estimate, funding-window list, or rule version — and its effect. One event, one entry, and derived quantities may not be targets: this is the single-entry bookkeeping that enforces the no-double-count discipline of §3.4 and §5.3. A thin record raises a flag that suspends staleness-driven downgrades rather than punishing a project for its evaluator's silence — record-keeping gaps and project deterioration are different facts and are kept apart. The format is in SM-B.

## 6.4 Gaming resistance, both faces

The design holds where measurement pressure has historically broken evaluation systems<sup>[66,67,68]</sup>: gates cannot be self-attested, evidence demotes on withdrawal, plans are registered by the evaluator with second-person approval, and exit thresholds looser than default require logged justification. It does not hold everywhere. The two highest-leverage inputs — the ceilings, to which $V$ is constructively proportional, and the counterfactual deduction — sit outside the calibration plan, one a per-project investigation item, the other unidentifiable. Four further openings are worth naming because a determined applicant would find them faster than a reviewer: the process type is self-declared, and software and service types score materially better at Tier-0 defaults; the sector-momentum judgment is made centrally once a quarter and moves award rates more than any project-level fact; the materiality threshold that makes a paid proof-of-concept count is a share of the burn rate, itself measured for a minority of projects; and, because the ledger records no rejected applications, the history multiplier is fixed at unity, so accumulated failure is free. None is guarded today.

## 6.5 Evaluator incentives

In this deployment the same organization builds ventures, evaluates them, and — in the person of one individual — designs the instrument and furnishes the judgments it consumes. It does not invest in them; the exposure is to measurement independence, not to financial interest. The countermeasures are declared as design, not achieved fact: priors registered before scoring; the person estimating a project's parameters separated from the person approving its evaluation version; independent re-coding of elicited inputs by a second evaluator; and a prospective registry (§8.4) whose falsification conditions are stated before outcomes arrive. Only the first and last are in place at the frozen version. The dependence itself is disclosed in the declarations and in §7.2.

## 6.6 Calibration with identification constraints

Every coefficient carries a grade — directly evidenced, derived from institutional design, or provisional — and a calibration plan with explicit identification constraints, given in full in SM-F. Three constraints bind hardest and are stated here because they limit what §7 can claim: award rates and window-arrival rates enter observation only as a product and need separate data to split; conversion capacity's median is pinned to 1.0 as a scale convention, so it is not separately identified from gate speeds; and history effects are fixed at unity until state dependence can be separated from heterogeneity. The reason for the last is worth naming, since it is also a gaming opening (§6.4): the builder's ledger records 51 grant awards and **zero rejections**. The coefficient family to which the score is most elastic cannot yet be calibrated from internal data at all, and the registry now auto-generates a pending record at application time so that rejections can no longer silently vanish.


# 7. Application and evidence

## 7.1 Sample, stratification, and freeze

The model was applied to the twenty-one projects on one venture builder's 2026 screening ledger, spanning process, device, software and service types across regulated and unregulated sectors. The ledger is a fund's working list, not a clean Before Zero sample, and the evaluation says so by stratifying it. (a) Six pre-incorporation university seeds are Before Zero applications proper — the **main sample**. (b) Fourteen incorporated spin-outs are scored at the present evaluation date with their present inputs. We considered moving their evaluation date back before incorporation and restricting inputs to information datable to that time, and did not: the operating record is not granular enough to establish what was known when, and an unverifiable reconstruction would be worse than an honest present-tense score. No project was excluded on these grounds — the count of exclusions is zero — so this layer reports how the instrument scores *operating companies*, which is outside the domain the framework is built for and is labelled as such wherever cited. (c) One project lies outside the domain in a second sense: a seed inside an established firm with no incorporation intent.

The freeze is a dated act, not a manner of speaking: model version, coefficient set and every project input were fixed at one commit (identifiers in SM-G), and revisions after that date — the ledger is a live operating instrument and continues to change — are excluded from this paper and carried to the next evaluation version. Figure 2 shows the resulting distribution.

![](figures_v2/fig2_score_distribution.png)

**Figure 2. Scores and what is not yet known about them.** Twenty-one projects at the frozen model version, ordered by median value; the bar spans the 10th to 90th percentile of $v(\theta)$ and the multiplier is their ratio. Values span four orders of magnitude, and the width of what remains unknown varies from a factor of 1.0 to 11.8 — a project can be precisely small or imprecisely large, and the reporting format is built to keep those distinguishable. Marker shape and colour give the sample layer of §7.1.

## 7.2 Dual scoring: what the database knows vs. what people know

The central empirical exercise is deliberately simple. Each project is scored twice under the same frozen model version: once with inputs drawn only from the operating database — grant awards, contracts, patents re-verified at the national registry, stage assessments, project knowledge — and once after *structured elicitation*, the same input schema completed from what the venture builder's own lead knows about each project from working with it. Because the coefficients are identical in both passes, any difference is attributable to information alone.

The classification that decides which inputs belong to which pass was fixed and hashed before any of these scores were computed, and the record of that freeze is deposited with the supplement (SM-D). This matters because an earlier version of this exercise classified inputs, computed, noticed an implausible result, and revised the classification — which leaves no way to distinguish a corrected rule from a tuned one. The rule now applied uniformly is three-way: where the record states a value, that value is used; where it states only a bound — a board paper computing that funds run out in December on zero receipts bounds the cash position from above — the bound is used; and only where the record is silent does the default stand. Applying it moved eleven items, in both directions: a burn rate whose source turned out to be a board paper's cash-flow table returned to the record side, while two projects' cash positions, whose only source was a verbal estimate, moved to the default side.

Two features of the design bound what the comparison means. The informant is one person, and the same person designed the model and wrote this paper; the exercise therefore measures what an experienced evaluator's knowledge adds to an operating record, not what a project's own principals would report. Independent re-coding by a second evaluator is registered as a requirement of the next version (§8.4). And where the database is silent, the first pass falls back to the framework's Tier-0 defaults rather than to ignorance — the default assigns an incorporated project eighteen months of runway at its sector's post-incorporation burn, so a project whose real runway is three months is scored as comfortable rather than as unknown. Movement in this exercise is therefore a function of distance from the default, and the condition is better read as a **default condition** than as the score a careful evaluator would produce from records alone. We treat the difference between default and elicited values, rather than between ignorance and knowledge, as what is being measured.

Eleven of the twenty-one projects had at least one input that could only have come from asking; the other ten were scored identically under both passes by construction. Figure 3 reports the result.

## 7.3 What the record does not hold

![](figures_v2/fig3_dual_scoring.png)

**Figure 3. The same projects, scored twice.** Open markers are the score from the operating database alone; filled markers add facts obtainable only by asking; arrows mark movements above 5%. Ten projects are identical by construction (no inputs on the elicited side); of the eleven that had them, four move by more than a factor of two and the largest ratio is 88. Colour gives the sample layer.

Four things in this picture are worth more than the headline number.

**The movement runs one way, and the top of the ranking does not move.** Of the seven projects that moved by more than 5%, five moved *down* when elicited facts were added: the operating record, left to itself, scores systematically high. For a selector this is the most actionable result here — a database-only score is an upper bound, not an estimate — and it follows mechanically from the default condition of §7.2, since defaults are set at a comfortable level and reality is usually less comfortable. The top four positions were identical under both passes; the reshuffling happened in the middle of the ranking, among the projects a committee would actually be deciding between.

**The effect is concentrated, not diffuse.** The median ratio across all twenty-one projects is 1.00 and the rank correlation between the two passes is 0.93: a selector reading only summary statistics would conclude the record is adequate. It is the tail that matters — four projects move by a factor of two or more, two by an order of magnitude, the largest by a factor of 88 — and rankings shift by up to seven positions. Missing information does not degrade this instrument gracefully; it leaves most estimates untouched and destroys a few.

**The gaps that move rankings are financial, not organizational.** Affected projects were missing several inputs at once, so we identified the contributions by re-scoring each project with one input withheld at a time (34 single-withholding runs; SM-D). Across the twenty-one withholdings of a financial input, the median effect is a factor of 1.96 and the maximum 27: withholding what a project can actually spend moves its score by a median of 3.9 and a maximum of 24, its burn rate by 2.7 and 27, whether unit economics close by up to 4.1, its own earnings by up to 4.4. Across the ten withholdings of an organizational input the median effect is 1.03 and the maximum 1.29 — the evangelist function, missing in seven projects, moves scores by 3%, and the vacancy of the technical core, the single fact that nobody can build the product, by 4%.

That asymmetry is not evidence that people matter less; it is §7.4's limitation seen from the data side. The clearest case is a project whose recorded difficulty is entirely organizational: the only person able to build the product had left, and voting control prevented replacing the chief executive. The framework marks it down by a factor of seventeen — but the withholding analysis attributes almost all of that to its cash position and almost none to the organizational facts a human evaluator would give as the reason. The score is right about the project and wrong about why. Until carrier effects are represented with the strength the founding-team literature reports<sup>[64,65]</sup>, the resistance of these scores to organizational evidence should be read as a property of the instrument rather than of the projects.

**In the main sample the exercise had almost no power, and we report that rather than a null result.** None of the six pre-incorporation projects moved by more than 2%. It would be convenient to read this as evidence that the record is adequate before incorporation, and we cannot: only four of the six had any input on the elicited side at all, and only one of those was financial. The design could not have detected in the main sample the effect it detected elsewhere. Substantively, the financial facts that move scores largely come into existence as documented facts capable of being missed once operations run; before incorporation there is less of that kind of fact to lose, and what elicitation supplied instead was organizational, which the instrument damps. Methodologically, testing information sufficiency where this framework is meant to be used requires collecting financial elicitation for pre-incorporation projects deliberately rather than opportunistically — registered as a design requirement in §8.4.

Full per-project results, the classification procedure that separated record-derived from elicited inputs, and its cross-check against the registry's own source tags are in SM-D.

## 7.4 The structural counterpart: what the model could receive

The dual-scoring result has a structural echo in the model's own development, reported here as one completed design–evaluation cycle. In the version first fielded, only one of the eight carrier functions entered as a per-project input; the technical core was fixed "never vacant" by convention and the rest filled by portfolio-common supply processes. Two live cases exposed the consequence — an incorporated spin-out whose only person able to build the product had left, and a main-sample project whose principal was degrading key negotiations: sweeping the one available input across its full range moved the score by a few percent, and evaluators could represent organizational collapse only by re-assigning *evidence levels*, a workaround neither reproducible across evaluators nor reversible when the organization recovers. The frozen version closes most of the gap — the seven populated functions enter as observations, fed by an organizational registry added to the operating system — but §7.3 shows that opening the input did not open the sensitivity. The episode is the §7.3 lesson read from the model's side, and it is why the falsification registry treats observability, not functional form, as the first thing to test.

## 7.5 Internal verification, kept separate

Synthetic checks verify the implementation, not the world, and are reported as such<sup>[70]</sup>. Degenerate-cell runs at the frozen version behave in the directions practice expects: heavily regulated pharmaceutical-type cells essentially never reach own production within the horizon and realize value through licensing and acquisition instead, while service-type cells reach self-sufficiency largely on recurring contract earnings. Full nine-class probabilities are reported *including* the termination mass (27–56% across cells at Tier-0 defaults): a selector should see the mortality its instrument implies, not only the value-bearing tails. Two classes sit at 0.0% because their mechanisms are unimplemented, the continuation-value share spans 33.5–75.1% across cells with the majority-continuation cells flagged under §5.6's own rule, and grid-convergence error is below 0.3%, so values are read to two significant digits — input quality, not numerics, is the binding limit.

![](figures_v2/fig4_fifth_premise.png)

**Figure 4. What treating a cash-out as a death costs.** The same twelve process-type × regulation cells under two modelling assumptions. A laboratory that exhausts project funds slows and waits for the next award; only an incorporated firm must dissolve.

Full nine-class probabilities are reported *including* the termination mass (27–56% across cells at Tier-0 defaults; before the §4.5 speed rule the same cells showed 55–81%, most of the difference being pre-incorporation projects that previously died at zero cash and now slow down instead): a selector should see the mortality its instrument implies, not only the value-bearing tails. Figure 5 shows the corresponding exit structures, and they differ exactly as practice would predict: heavily regulated process-type cells realize value through licensing and acquisition rather than own production, while service-type cells reach self-sufficiency largely on recurring earnings. Neither pattern is privileged by the measure — which is DP8 visible as a result rather than as an intention.

![](figures_v2/fig5_exit_structure.png)

**Figure 5. Exit structure by process type and regulatory regime.** Terminal-class probabilities at Tier-0 defaults, frozen model version. Every class is priced on the same scale of net domestic value added, so a licensing outcome and a production outcome are comparable rather than ranked by form.

Two classes sit at 0.0% because their mechanisms are unimplemented (application pivot; the plan-vs-optimal timing diagnosis), and the continuation-value share spans 33.5–75.1% across cells, with the six majority-continuation cells flagged under §5.6's own rule. Grid-convergence checks bound numerical error below 0.3% — removing the pre-incorporation absorbing wall removed the scheme's main stiffness — and values are still read to two significant digits, input quality being the binding limit.

## 7.6 Elasticities, and the difference between placing and working

Sweeping every coefficient by ±10% under one definition yields a consistent hierarchy (these elasticities were measured on the implementation preceding the pre-incorporation speed rule and are pending re-measurement at the frozen version; the ordering, not the exact magnitudes, is what we rely on): funding-access coefficients (base award rate, window arrival) rank first everywhere (elasticity ≈ +1.4), gate base-speeds and the counterfactual retention factor follow (≈ ±1.0), obsolescence and appropriability next (≈ 0.7); the rights-resolution rates that dominate practitioner discussion move the score not at all (≈ −0.00), and the counterfactual's *evaluation-date* deduction — the framework's philosophical centerpiece — has measured elasticity 0.000 at defaults, for the horizon reason disclosed in §5.4. The honesty rule this section enforces: *a coefficient placed is not a coefficient at work*, and sixteen declared approximations (A1–A16 in SM-C) mark exactly where the reference implementation substitutes, collapses, or omits what the specification defines.

## 7.7 Ceiling sensitivity as a property of the object

Because $V$ is constructively proportional to the ceiling (A6), the single largest lever on any score is how the addressable market is sliced. Re-basing the same project's ceiling across the standard market conventions moves its value by two to three orders of magnitude, dwarfing every coefficient elasticity in §7.6. We treat this as a property of the measurement object rather than a defect to be smoothed: *ex-ante selection output is order-of-magnitude sensitive to market-slicing conventions*, and a framework that conceals this behind a stable-looking composite is not more robust, only less honest. Three governance rules follow and are implemented: the convention is fixed once — the obtainable slice, net of the share already carried by the take-rate parameter, so the same uncertainty is not counted twice; per-project ceilings are versioned with approval records; and the reported bands are labelled as **not** propagating ceiling uncertainty, since calling a band a confidence interval while its largest driver sits outside it would be the quiet lie this section exists to prevent.

## 7.8 Limits

Everything here is implementation verification plus retrospective application under judgment-quality inputs on one builder's ledger, at pre-calibration coefficients; predictive validity is exactly what the prospective registry (§8.4) is for. The self-propulsion value share awaits a displacement audit (a service business built on work that domestic incumbents would otherwise have done nets to little); the sample's stratification bounds any claim about incorporated projects to the quality of their date-restricted reconstruction; and the dual-scoring exercise inherits two limits of its own — the record-versus-elicited classification is a reading of provenance notes with borderline cases, and most affected projects were missing several inputs at once, so no single parameter can be credited with a movement.

# 8. Policy implications and a research program

## 8.1 For policy

An evaluation object denominated in net domestic value added connects, without translation, to the ledger on which industrial policy is currently argued — economic-security programmes, mission-oriented agencies<sup>[71]</sup>, and the growing family of ARPA-type institutions whose daily work *is* ex-ante, project-level selection [verify at S6: ARIA/SPRIN-D programme documents]. For that audience the framework offers two things a unicorn count cannot: exit-form indifference, an operational answer to the documented misfit between the venture-capital model and deep tech<sup>[11]</sup>; and the acceleration/location distinction, which states openly how much of a project's value is world gain versus jurisdictional transfer — though, as §5.9 notes, the current implementation does not separate the two, and most of the reported value is the location term.

## 8.2 For universities and TTOs

For technology transfer practice the immediate import is not the score but the object: a registered plan gives disclosure triage something definable to evaluate, and the registry gives it an audit trail. The cost is the observation discipline of §6 — which, as §7 demonstrated, is precisely where current records fail: they capture progress and are silent about why progress stopped.

That cost should be stated in hours rather than in principle. Bringing one project to a first evaluation requires reconstructing its gate history, back-filling the registry, collecting working records for the carrier functions, and researching the ceiling, displacement and acceleration terms; a practitioner reviewing this framework estimated thirty to sixty hours per project for that first pass, one to two hours per project per month to maintain, and a further fraction of a full-time role to run the quarterly sector-momentum judgment centrally. At sixty projects a year that is two to three people. An office triaging a hundred invention disclosures a year with a handful of coordinators cannot carry it, and we withdraw any suggestion that the full framework is a disclosure-triage instrument.

What such an office can carry is a subset, and the same practitioner identified it: the registry, the gate table with its evidence grades and expiries, and the "what to investigate next" output — everything except the money. Those components cost a fraction of the total, are the components §7 implicates in the binding constraint, and can be adopted without committing to a yen figure at all. We recommend that sequence explicitly: adopt the observation system first, and add valuation only where the calibration to support it exists.

## 8.3 What this paper does not deliver

The plan-versus-optimal-rule gap — *is this incorporation too early or too late?* — is the framework's designed answer to DP4 and, we believe, its most valuable future output. Its computation (policy search over the registered rule space) is unimplemented, and we have kept its promise out of this paper's results; it is the centerpiece of the second paper, to be built on the calibrated model.

## 8.4 A prospective registry with falsification conditions

The framework's claims are kept falsifiable by a registry declared before outcomes arrive, with left-truncation handled by registering cases from first contact<sup>[8]</sup> — a design principle inherited from the panel studies of new-venture gestation<sup>[75,76]</sup>.

A declaration of this kind is worth only as much as its immutability, and we treat that as a requirement rather than a virtue: the frozen coefficient set, the twenty-one current scores, the input classification, and the five conditions below are deposited with a public repository and cited by persistent identifier, so that a later reader can check what was claimed before the outcomes were known. Because the author is also the operator and the sole informant (§6.5), that external timestamp is the only part of the mitigation that does not rest on the author's word.

Predictive validity for a 240-month value cannot be tested directly, so each condition below is stated against an observable proxy — gate passage, incorporation, a licence, or a stop — with a judge, a horizon and a threshold. The judge is the evaluation-version approver, who is not the estimator of the project's parameters; the horizon is 24 months from deposit for conditions (1)–(4) and 60 months for (5).

## 8.5 The external-validity path

A single further deployment decides more than any argument: if a second organization can run the gate table and registry unmodified, the propositions are design knowledge; if operation turns out to require this builder's tacit judgment, they are an in-house procedure honestly documented. The registry format is public in SM-B precisely to make that test cheap (Van de Ven<sup>[72]</sup>).

# 9. Conclusion

Before a deep-tech company exists there is still something to evaluate — but it is not the company, and treating it as one has made a generation of screening tools quietly unfit. The Before Zero Model gives the interval its own object of evaluation: a registered plan over an observable state, priced by the additionality logic of programme evaluation on a yen scale indifferent to exit form, operated through gates, evidence grades and a typed registry that keep the number auditable, and reported with its uncertainties, approximations and dependencies stated rather than smoothed.

The application taught two things worth more than the scores. Rankings computed from the operating record alone are systematically high and occasionally wrong by an order of magnitude, because records are built to capture progress and are silent about why progress stops. And the instrument responds to what the record misses about money while barely responding to what it misses about people — the score can be right about a project and wrong about why. The binding constraint on ex-ante selection is therefore the observation system and the instrument's sensitivity to it, not the aggregation formula; which is why this paper's operative deliverable is not a formula but a registry, running forward, with its falsification conditions on the record.

# Declarations {-}

**Declaration of competing interest.** The author leads the venture builder whose screening ledger is the object of §7. The author holds no equity in, has made no investment in, and exercises no control over any of the projects scored; several are past engagements in which the author no longer has operational access, and in at least one the author's involvement was limited to administering a public grant. There is accordingly no financial interest that the scores could serve.

What the setting does create is a limitation of measurement independence rather than of interest, and because it bears directly on §7 we state it there as well as here: the same person designed the model, selected the inputs, supplied the elicited facts, and wrote this paper. That limitation would be identical if the projects were unfamiliar ones the author had never worked with, since it concerns who furnishes and judges the information, not what the author stands to gain from it.

**Funding.** This research received no external funding.

**Data availability.** The underlying records are proprietary operational data of the venture builder and contain personal and commercially sensitive information; they cannot be shared. Anonymized summaries sufficient to reconstruct every table, the full coefficient set with provenance grades, the registry and gate-table formats, and the falsification-condition registry are provided in the Supplementary Material.

**Author note.** The author line is provisional; a co-authorship discussion is scheduled on completion of this draft. [To be resolved at S6.]

# Supplementary Material (contents) {-}

SM-A Notation and complete model equations. SM-B Gate table, carrier-function table, event-registry format, and plan-rule template (complete versions; public formats for replication). SM-C Coefficient tables with provenance grades, declared approximations A1–A16, and full elasticity tables. SM-D Application detail: stratified sample; dual-scoring protocol, classification rules and their cross-check against registry source tags, per-project ratios and rank changes; ceiling-sensitivity worked cases. SM-E Design-proposition derivation log and audit-process records (five-persona, three-round adversarial audits). SM-F Calibration plan, identification constraints, and falsification-condition registry. SM-G Version freeze: model version hash (main commit 91385d77), approval identifiers, input freeze date (29 August 2026), the per-project input set as frozen, and the figure-generation script with the data behind every figure.

# References {-}

*Numbered in order of first appearance. DOIs verified for entries carried over from the model canon; entries marked [verify at S6] await final bibliographic verification before submission.*

1. Vohora, A., Wright, M., & Lockett, A. (2004). Critical junctures in the development of university high-tech spinout companies. *Research Policy*, 33(1), 147–175.
2. Rasmussen, E., Mosey, S., & Wright, M. (2011). The evolution of entrepreneurial competencies: A longitudinal study of university spin-off venture emergence. *Journal of Management Studies*, 48(6), 1314–1345.
3. Link, A. N., & Scott, J. T. (2011). *Public Goods, Public Gains: Calculating the Social Benefits of Public R&D*. Oxford University Press.
4. David, P. A., Hall, B. H., & Toole, A. A. (2000). Is public R&D a complement or substitute for private R&D? A review of the econometric evidence. *Research Policy*, 29(4–5), 497–529.
5. van Aken, J. E. (2004). Management research based on the paradigm of the design sciences: The quest for field-tested and grounded technological rules. *Journal of Management Studies*, 41(2), 219–246.
6. Romme, A. G. L. (2003). Making a difference: Organization as design. *Organization Science*, 14(5), 558–573.
7. Gregor, S., & Hevner, A. R. (2013). Positioning and presenting design science research for maximum impact. *MIS Quarterly*, 37(2), 337–355.
8. Yang, T., & Aldrich, H. E. (2012). Out of sight but not out of mind: Why failure to account for left truncation biases research on failure rates. *Journal of Business Venturing*, 27(4), 477–492.
9. Levinthal, D. A. (1991). Random walks and organizational mortality. *Administrative Science Quarterly*, 36(3), 397–420.
10. Damodaran, A. (2009). Valuing young, start-up and growth companies: Estimation issues and valuation challenges. SSRN Working Paper 1418687.
11. Lerner, J., & Nanda, R. (2020). Venture capital's role in financing innovation: What we know and how much we still need to learn. *Journal of Economic Perspectives*, 34(3), 237–261.
12. Little, I. M. D., & Mirrlees, J. A. (1974). *Project Appraisal and Planning for Developing Countries*. Heinemann.
13. Dasgupta, P., Marglin, S., & Sen, A. (1972). *Guidelines for Project Evaluation*. United Nations Industrial Development Organization.
14. Squire, L., & van der Tak, H. G. (1975). *Economic Analysis of Projects*. Johns Hopkins University Press for the World Bank.
15. Claxton, K. (1999). The irrelevance of inference: A decision-making approach to the stochastic evaluation of health care technologies. *Journal of Health Economics*, 18(3), 341–364.
16. Ndonzuau, F. N., Pirnay, F., & Surlemont, B. (2002). A stage model of academic spin-off creation. *Technovation*, 22(5), 281–289.
17. Clarysse, B., Wright, M., Lockett, A., Van de Velde, E., & Vohora, A. (2005). Spinning out new ventures: A typology of incubation strategies from European research institutions. *Journal of Business Venturing*, 20(2), 183–216.
18. Jensen, R., & Thursby, M. (2001). Proofs and prototypes for sale: The licensing of university inventions. *American Economic Review*, 91(1), 240–259.
19. Thursby, J. G., & Thursby, M. C. (2002). Who is selling the ivory tower? Sources of growth in university licensing. *Management Science*, 48(1), 90–104.
20. Siegel, D. S., Waldman, D., & Link, A. (2003). Assessing the impact of organizational practices on the relative productivity of university technology transfer offices: An exploratory study. *Research Policy*, 32(1), 27–48.
21. Brest, P., & Born, K. (2013). When can impact investing create real impact? *Stanford Social Innovation Review*, 11(4), 22–31.
22. Churchill, G. A. (1979). A paradigm for developing better measures of marketing constructs. *Journal of Marketing Research*, 16(1), 64–73.
23. Penrose, E. T. (1959). *The Theory of the Growth of the Firm*. Basil Blackwell.
24. Teece, D. J. (2007). Explicating dynamic capabilities: The nature and microfoundations of (sustainable) enterprise performance. *Strategic Management Journal*, 28(13), 1319–1350.
25. Bourgeois, L. J. (1981). On the measurement of organizational slack. *Academy of Management Review*, 6(1), 29–39.
26. Winborg, J., & Landström, H. (2001). Financial bootstrapping in small businesses: Examining small business managers' resource acquisition behaviors. *Journal of Business Venturing*, 16(3), 235–254.
27. Myers, S. C., & Majluf, N. S. (1984). Corporate financing and investment decisions when firms have information that investors do not have. *Journal of Financial Economics*, 13(2), 187–221.
28. McDonald, R., & Siegel, D. (1986). The value of waiting to invest. *Quarterly Journal of Economics*, 101(4), 707–727.
29. Weeds, H. (2002). Strategic delay in a real options model of R&D competition. *Review of Economic Studies*, 69(3), 729–747.
30. Etzkowitz, H., & Leydesdorff, L. (2000). The dynamics of innovation: From National Systems and "Mode 2" to a Triple Helix of university–industry–government relations. *Research Policy*, 29(2), 109–123.
31. Aldrich, H. E., & Fiol, C. M. (1994). Fools rush in? The institutional context of industry creation. *Academy of Management Review*, 19(4), 645–670.
32. Raiffa, H. (1968). *Decision Analysis: Introductory Lectures on Choices under Uncertainty*. Addison-Wesley.
33. Howard, R. A. (1966). Information value theory. *IEEE Transactions on Systems Science and Cybernetics*, 2(1), 22–26.
34. Cooke, R. M. (1991). *Experts in Uncertainty: Opinion and Subjective Probability in Science*. Oxford University Press.
35. Wennberg, K., Wiklund, J., DeTienne, D. R., & Cardon, M. S. (2010). Reconceptualizing entrepreneurial exit: Divergent exit routes and their drivers. *Journal of Business Venturing*, 25(4), 361–375.
36. DeTienne, D. R., McKelvie, A., & Chandler, G. N. (2015). Making sense of entrepreneurial exit strategies: A typology and test. *Journal of Business Venturing*, 30(2), 255–272.
37. Morgeson, F. P., DeRue, D. S., & Karam, E. P. (2010). Leadership in teams: A functional approach to understanding leadership structures and processes. *Journal of Management*, 36(1), 5–39.
38. Lazear, E. P. (2005). Entrepreneurship. *Journal of Labor Economics*, 23(4), 649–680.
39. Wasserman, N. (2003). Founder-CEO succession and the paradox of entrepreneurial success. *Organization Science*, 14(2), 149–172.
40. Miller, R. E., & Blair, P. D. (2022). *Input-Output Analysis: Foundations and Extensions* (3rd ed.). Cambridge University Press.
41. Adner, R. (2002). When are technologies disruptive? A demand-based view of the emergence of competition. *Strategic Management Journal*, 23(8), 667–688.
42. Wright, T. P. (1936). Factors affecting the cost of airplanes. *Journal of the Aeronautical Sciences*, 3(4), 122–128.
43. Gutowski, T. G., Branham, M. S., Dahmus, J. B., Jones, A. J., Thiriez, A., & Sekulic, D. P. (2009). Thermodynamic analysis of resources used in manufacturing processes. *Environmental Science & Technology*, 43(5), 1584–1590.
44. Roberts, K., & Weitzman, M. L. (1981). Funding criteria for research, development, and exploration projects. *Econometrica*, 49(5), 1261–1288.
45. Audretsch, D. B., & Mahmood, T. (1995). New firm survival: New results using a hazard function. *Review of Economics and Statistics*, 77(1), 97–103.
46. George, G. (2005). Slack resources and the performance of privately held firms. *Academy of Management Journal*, 48(4), 661–676.
47. Vanacker, T., Collewaert, V., & Paeleman, I. (2013). The relationship between slack resources and the performance of entrepreneurial firms: The role of venture capital and angel investors. *Journal of Management Studies*, 50(6), 1070–1096.
48. Colson, A. R., & Cooke, R. M. (2017). Cross validation for the classical model of structured expert judgment. *Reliability Engineering & System Safety*, 163, 109–120.
49. Fairfield, T., & Charman, A. E. (2017). Explicit Bayesian analysis for process tracing: Guidelines, opportunities, and caveats. *Political Analysis*, 25(3), 363–380.
50. Baker, T., & Nelson, R. E. (2005). Creating something from nothing: Resource construction through entrepreneurial bricolage. *Administrative Science Quarterly*, 50(3), 329–366.
51. Sirmon, D. G., Hitt, M. A., Ireland, R. D., & Gilbert, B. A. (2011). Resource orchestration to create competitive advantage: Breadth, depth, and life cycle effects. *Journal of Management*, 37(5), 1390–1412.
52. Sarasvathy, S. D. (2001). Causation and effectuation: Toward a theoretical shift from economic inevitability to entrepreneurial contingency. *Academy of Management Review*, 26(2), 243–263.
53. Camuffo, A., Cordova, A., Gambardella, A., & Spina, C. (2020). A scientific approach to entrepreneurial decision making: Evidence from a randomized control trial. *Management Science*, 66(2), 564–586.
54. Teece, D. J. (1986). Profiting from technological innovation: Implications for integration, collaboration, licensing and public policy. *Research Policy*, 15(6), 285–305.
55. Nordhaus, W. D. (2004). Schumpeterian profits in the American economy: Theory and measurement. NBER Working Paper 10433.
56. Mansfield, E., Rapoport, J., Romeo, A., Wagner, S., & Beardsley, G. (1977). Social and private rates of return from industrial innovations. *Quarterly Journal of Economics*, 91(2), 221–240.
57. Bloom, N., Schankerman, M., & Van Reenen, J. (2013). Identifying technology spillovers and product market rivalry. *Econometrica*, 81(4), 1347–1393.
58. Myers, K. R., & Lanahan, L. (2022). Estimating spillovers from publicly funded R&D: Evidence from the US Department of Energy. *American Economic Review*, 112(7), 2393–2423.
59. Manski, C. F. (2003). *Partial Identification of Probability Distributions*. Springer.
60. Arrow, K. J., & Lind, R. C. (1970). Uncertainty and the evaluation of public investment decisions. *American Economic Review*, 60(3), 364–378.
61. Weitzman, M. L. (1998). Why the far-distant future should be discounted at its lowest possible rate. *Journal of Environmental Economics and Management*, 36(3), 201–208.
62. Gollier, C. (2012). *Pricing the Planet's Future: The Economics of Discounting in an Uncertain World*. Princeton University Press.
63. Lafond, F., Bailey, A. G., Bakker, J. D., Rebois, D., Zadourian, R., McSharry, P., & Farmer, J. D. (2018). How well do experience curves predict technological progress? A method for making distributional forecasts. *Technological Forecasting and Social Change*, 128, 104–117.
64. Beckman, C. M., Burton, M. D., & O'Reilly, C. (2007). Early teams: The impact of team demography on VC financing and going public. *Journal of Business Venturing*, 22(2), 147–173.
65. Klotz, A. C., Hmieleski, K. M., Bradley, B. H., & Busenitz, L. W. (2014). New venture teams: A review of the literature and roadmap for future research. *Journal of Management*, 40(1), 226–255.
66. Ocasio, W. (1997). Towards an attention-based view of the firm. *Strategic Management Journal*, 18(S1), 187–206.
67. Campbell, D. T. (1979). Assessing the impact of planned social change. *Evaluation and Program Planning*, 2(1), 67–90.
68. Espeland, W. N., & Sauder, M. (2007). Rankings and reactivity: How public measures recreate social worlds. *American Journal of Sociology*, 113(1), 1–40.
69. Bevan, G., & Hood, C. (2006). What's measured is what matters: Targets and gaming in the English public health care system. *Public Administration*, 84(3), 517–538.
70. Oreskes, N., Shrader-Frechette, K., & Belitz, K. (1994). Verification, validation, and confirmation of numerical models in the earth sciences. *Science*, 263(5147), 641–646.
71. Mazzucato, M. (2018). Mission-oriented innovation policies: Challenges and opportunities. *Industrial and Corporate Change*, 27(5), 803–815.
72. Van de Ven, A. H. (2007). *Engaged Scholarship: A Guide for Organizational and Social Research*. Oxford University Press.
73. Åstebro, T., & Elhedhli, S. (2006). The effectiveness of simple decision heuristics: Forecasting commercial success for early-stage ventures. *Management Science*, 52(3), 395–409.
74. Scott, E. L., Shu, P., & Lubynsky, R. M. (2020). Entrepreneurial uncertainty and expert evaluation: An empirical analysis. *Management Science*, 66(3), 1278–1299. [verify at S6]
75. Reynolds, P. D., & Miller, B. (1992). New firm gestation: Conception, birth, and implications for research. *Journal of Business Venturing*, 7(5), 405–417. [verify at S6]
76. Carter, N. M., Gartner, W. B., & Reynolds, P. D. (1996). Exploring start-up event sequences. *Journal of Business Venturing*, 11(3), 151–166.
77. Katz, J. A., & Gartner, W. B. (1988). Properties of emerging organizations. *Academy of Management Review*, 13(3), 429–441.
