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
closed, and that the top-level expression assumed independence between path probabilities and path
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
