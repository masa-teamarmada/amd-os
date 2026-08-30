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
