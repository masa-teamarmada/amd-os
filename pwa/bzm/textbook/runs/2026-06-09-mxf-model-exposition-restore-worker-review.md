# Textbook MXF model exposition restore worker review

Date: 2026-06-09 JST

## Review target

- Commit: `93e4694 docs(textbook): restore mxf model exposition`
- Role: independent worker review of the direct commander commit, with minimal correction if needed.

## Verdict

Accept with small governance corrections.

The commit restores the old MXF/BZM model exposition without overwriting the current narrative spine. The story chapters keep their scenes first, then add short Model Notes; the detailed equations and notation live mainly in Method Appendix M0/M1/M2/M3/M4/M5/M7. This matches the latest direction: keep the narrative, and reinsert model explanation between the story and appendix layers.

## Coverage check

- `MXFモデル` / `M×X×F`: restored in M0 and M5.
- `sigma_SU`, `mu_A`, `mu_I`, `mu_G`, Triple Helix alignment: restored in Ch17 and M2.
- State-space model, transition matrix, eigenvalues, and GO gate: restored in M2.
- XRL group: TRL / BRL / GRL / SRL / HRL and `X = product((x + 1)^alpha_x)` restored in Ch16 and M3.
- FRL: `F_character`, `F_capability`, ALQ/Grit/Resilience, and CES/FRL formula restored in Ch18 and M4.
- Integrated readiness: `S = K * product((X_i + 1)^alpha_i)`, `S = k * M * X * F`, bottleneck/sensitivity `alpha_i / (X_i + 1)` restored in Ch19 and M5.
- ERS: unknown vs not_started, responsibility pipeline, `s = (lv - 1) / 4`, `A_k`, and `ERS = 100 * sum(w_k * A_k)` restored in Ch21 and M7.
- Misuse warnings: ranking/score reading is explicitly rejected; the model is framed as a conversation about next uncertainty, RESOURCE_SHIFT, survival probability, and earning body.

## Corrections made by this worker

- Updated `pwa/bzm/textbook/COMMANDER_TASKS.md` so the Textbook ledger no longer repeats the old deploy approval gate as current worker policy.
- Shortened the 2026-06-09 ledger entry to review status, artifacts, and md-only verification/deploy state.
- Updated the original restore note so push/deploy guidance matches the latest worker prompt: no approval waiting, no micro-deploy churn, record any push/deploy if later performed.

## Verification

- `git diff --check`: passed.
- Conflict marker scan: no hits.
- Public forbidden term scan on changed public manuscript files: no hits.
- H1 count on changed public manuscript files: all exactly one.
- Old template phrase scan: no hits.
- Narrative chapter table scan for Ch16/17/18/19/21: no markdown tables added.
- Build not run: md-only changes, no manifest/code touched.

## Push/deploy

No push or deploy performed.
