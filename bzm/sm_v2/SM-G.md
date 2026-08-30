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
