# Model Appendix TOC Draft

Date: 2026-06-03 JST

Worker: Textbook commander / model appendix architecture

Scope:
- Draft the public-facing Method Appendix table of contents.
- Preserve the current Prologue-to-Epilogue narrative.
- Do not edit public manuscript body in this pass.
- Do not add formulas to story chapters in this pass.
- Do not deploy.

Source basis:
- `pwa/bzm/textbook/runs/2026-06-03-model-exposition-placement-brief.md`
- `pwa/bzm/textbook/runs/2026-06-03-full-story-cold-reader-review-prologue-epilogue.md`
- Internal notation source `pwa/bzm/9-2-notation.md`
- Internal theory sources for sigma_SU, XRL, FRL, integrated readiness, and ERS

## Executive decision

Add model exposition as a separate Method Appendix, not as new explanatory weight inside the story.

The appendix should be allowed to be mathematical, but it must be written as public-facing support for the story, not as a return to the old internal textbook. Its job is to answer a reader who finishes the narrative and asks, "What is the model underneath this judgment?"

The recommended title is:

`Method Appendix — モデル補遺`

The appendix should sit after the Field Toolkit, or be reachable as a separate appendix route from the public manuscript navigation. It should not appear between Ch21 and the Epilogue. The story should still close before the reader is asked to inspect notation.

## Reader promise

The Method Appendix promises three things:

1. The narrative judgments are not just taste. They can be mapped to explicit variables.
2. The model is a decision aid, not a machine that decides whether a company should exist.
3. The formulas make uncertainty visible; they must not hide uncertainty behind false precision.

The appendix should help technically minded readers, reviewers, university operators, and investors see how the field language connects to formal structure.

It should not try to persuade the reader emotionally. The story has already done that work.

## Appendix structure

### Appendix M0: How to read the model

Purpose:
- Set expectations before notation appears.
- Explain that the model is a map of unresolved conditions, not a ranking of researchers or projects.

Must include:
- values are approximate;
- scores are conversation surfaces;
- low axes matter because they show the next uncertainty to reduce;
- the model should not force premature incorporation.

Formula level:
- none.

Public safety:
- Do not use branded score naming.
- Do not imply that a high number equals "start a company now."

### Appendix M1: Notation and scale

Purpose:
- Introduce the shared scale and notation used by the rest of the appendix.

Must include:
- 0 to 9 axis scale;
- `+1` shift;
- why a low unresolved condition should remain visible;
- distinction between observation, interpretation, and decision.

Candidate formulas:
- show the `+1` shift only in words first;
- no integrated formula yet.

Public safety:
- Avoid old internal naming around score products.
- Keep examples generic and composite.

### Appendix M2: Macro alignment

Purpose:
- Formalize why tailwinds are conditions, not permission.
- Separate academia, industry, and government momentum.

Must include:
- `sigma_SU`;
- `mu_A`, `mu_I`, `mu_G`;
- Triple Helix as three momenta that can be misaligned;
- why a strong public grant, corporate interest, and policy trend can still fail to prove readiness.

Candidate formulas:
- `sigma_SU = (((mu_A + 1)(mu_I + 1)(mu_G + 1))^(1/3)) - 1`
- Optional state-space equations only in a deeper subsection.

Public safety:
- Make clear that macro alignment cannot substitute for budget-owner evidence or disclosure safety.

### Appendix M3: Readiness axes

Purpose:
- Formalize the five readiness axes that appear in Ch16.

Must include:
- TRL: technical maturity;
- BRL: business and customer path maturity;
- GRL: governance, regulation, and disclosure maturity;
- SRL: social acceptance and use-context maturity;
- HRL: human resources and operating capacity maturity.

Candidate formulas:
- none required in the main subsection.
- optional axis rubric examples can be listed later, but not as a large table in the first draft.

Public safety:
- Do not let TRL dominate.
- Explain that the question is not "which axis is impressive?" but "which unresolved axis can break the next step?"

### Appendix M4: Founder function and role fit

Purpose:
- Formalize why founder readiness is a placement and complement question, not a personality verdict.

Must include:
- FRL;
- F_character;
- F_capability;
- repeat-back behavior;
- bad-news behavior;
- what can be carried by an external candidate and what cannot simply be outsourced.

Candidate formulas:
- keep psychometric formula out of first public draft unless a later expert review asks for it.
- If included later, put ALQ / Grit / Resilience in a technical note, not the main appendix flow.

Public safety:
- Avoid founder hero framing.
- Avoid treating the researcher as deficient because they do not want to become CEO.

### Appendix M5: Integrated readiness

Purpose:
- Show how the model combines macro alignment, readiness axes, and founder function into a survival conversation.

Must include:
- integrated readiness as a map, not a ranking;
- low-axis / bottleneck logic;
- why RESOURCE_SHIFT follows from the model;
- survival probability and earning body as decision questions, not slogans.

Candidate formulas:
- `S = K * product((X_i + 1)^alpha_i)`
- `dS/dX_i = alpha_i * S / (X_i + 1)`
- bottleneck as the axis where the next unit of work matters most.

Public safety:
- Do not use large numerical score examples that create false precision.
- Do not call the number a universal startup score.
- Explain that weights are calibration choices and should be stated, tested, and revised.

### Appendix M6: Evidence rules and retrofit

Purpose:
- Formalize what changed after the field case failed, paused, or shifted.

Must include:
- old evidence rule;
- new evidence rule;
- append-only observation;
- why learning logs protect relationships better than blame narratives;
- how a payment refusal can update the map without being treated as failure.

Candidate formulas:
- none required in first public draft.
- Future version may include a simple update schema, but only if it stays readable.

Public safety:
- Do not turn retrofit into hindsight scoring.
- Preserve the idea that weak evidence should remain weak.

### Appendix M7: Institutional nursery readiness

Purpose:
- Formalize the institutional layer after Ch21 and the Field Toolkit.

Must include:
- ERS;
- unknown vs not_started;
- responsibility pipeline;
- 90-day pilot charter;
- stop / expand gate.

Candidate formulas:
- `s = (lv - 1) / 4`
- `A_k = mean(axis k sub-scores)`
- `ERS = 100 * sum(w_k * A_k)`

Public safety:
- Do not treat support-menu count as readiness.
- Make the pipeline of responsibility more important than the presence of programs.

### Appendix M8: Misuse warnings

Purpose:
- Close the model appendix with guardrails.

Must include:
- Do not use the model to force early company formation.
- Do not use the model to punish researchers for not being founders.
- Do not use the model to justify overstrong deck sentences.
- Do not publish raw field notes or private cases.
- Do not treat small paid work as automatically good; ask whether it strengthens or narrows the future.
- Do not treat J-curve / IPO language as the only legitimate path for every seed.

Candidate formulas:
- none.

Public safety:
- This section should explicitly preserve the author directives around survival probability, earning body, delayed incorporation, and skepticism toward one-size-fits-all J-curve pressure.

## Route and file strategy

Recommended first implementation:

1. Create appendix markdown files under `pwa/bzm/public-manuscript/`.
2. Keep them after Field Toolkit in the manifest under a new section label:
   - `Method Appendix — モデル補遺`
3. Use slugs with a clear appendix prefix:
   - `26-method-how-to-read-the-model.md`
   - `27-method-notation-and-scale.md`
   - `28-method-macro-alignment.md`
   - `29-method-readiness-axes.md`
   - `30-method-founder-function.md`
   - `31-method-integrated-readiness.md`
   - `32-method-evidence-rules.md`
   - `33-method-institutional-nursery.md`
   - `34-method-misuse-warnings.md`

Alternative:
- Use one long appendix file if navigation clutter becomes a problem.

Preference:
- Start with multiple short appendix files, because each model unit can then be reviewed and revised independently.

## Model note relationship

Model Notes are optional bridges. They should not duplicate the appendix.

Recommended relationship:

- Ch16 note points to Appendix M3.
- Ch17 note points to Appendix M2.
- Ch18 note points to Appendix M4.
- Ch19 note points to Appendix M5.
- Ch21 or Field Toolkit note points to Appendix M7.

Do not add all notes at once. Prototype two notes first:

1. Ch16 readiness axes.
2. Ch19 integrated readiness / RESOURCE_SHIFT.

If those notes interrupt the story, keep the main body note-free and rely on appendix navigation.

## Acceptance gate

The first implementation of the Method Appendix must pass:

- The Prologue-to-Epilogue story reads unchanged if the appendix is skipped.
- No model formula appears before Ch15.
- No model formula appears in the Epilogue.
- Appendix language is public-facing and does not reintroduce internal project vocabulary.
- Formulas are paired with misuse warnings and field interpretation.
- Integrated readiness is framed as next action / uncertainty reduction, not ranking.
- Founder readiness is framed as role fit and complement design, not personal judgment.
- ERS is framed as responsibility pipeline and operating design, not support-menu count.
- If manifest or route code changes, `npm run build` must pass.
- Production deploy remains bundled and quota-aware.

## Next implementation order

1. **Method Appendix stub implementation**
   - Add appendix markdown files with H1, purpose, and TODO body.
   - Add manifest section.
   - Run local build.

2. **Public notation rewrite**
   - Rewrite `9-2-notation.md` into public-safe appendix prose.
   - Keep formulas, but remove internal naming and false precision.

3. **Model Note prototype**
   - Add only two optional notes after Ch16 and Ch19, or create a grouped notes page.
   - Review interruption cost before expanding.

4. **Appendix cold-reader review**
   - Ask whether the appendix helps technical readers without making the story feel like a bait-and-switch.

5. **Route/main integration review**
   - Merge the story polish branch and appendix changes in an ordered batch.
   - Build locally.
   - Deploy only when quota policy and main integration gate say it is worth bundling.
