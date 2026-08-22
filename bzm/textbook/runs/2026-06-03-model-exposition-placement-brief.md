# Model Exposition Placement Brief

Date: 2026-06-03 JST

Worker: Textbook commander / model exposition strategy

Scope:
- Decide where model explanation, notation, and formulas should live after the current Prologue-to-Epilogue narrative pass.
- Do not edit public manuscript body in this pass.
- Do not add formulas to the story chapters in this pass.
- Do not deploy.

Source basis:
- `pwa/bzm/textbook/runs/2026-06-02-public-book-architecture-reset-brief.md`
- `pwa/bzm/textbook/runs/2026-06-03-full-story-cold-reader-review-prologue-epilogue.md`
- `pwa/bzm/textbook/runs/2026-06-03-field-toolkit-layout-readability-pass.md`
- Current `pwa/bzm/public-manuscript/00` through `25`
- Current Field Toolkit chapters `22` through `24`
- Internal theory source `pwa/bzm/9-2-notation.md`
- Internal theory sources around sigma_SU, XRL, FRL, integrated score, and ERS

## Executive decision

Keep the current Prologue-to-Epilogue narrative intact.

The model should not be inserted as a continuous explanation inside the story. The story now works because one overstrong sentence travels through evidence, disclosure, company timing, CEO function, WAIT, investor exposure, learning, institutional nursery, and finally returns as a weaker sentence that can be sent. Formula blocks inside that arc would make the book start explaining itself at exactly the moment it has learned to move.

Use a two-layer exposition architecture:

1. Short optional Model Notes after selected chapters, where the reader has already felt the need for the concept.
2. A separate Method Appendix for notation, formulas, weighting, score boundaries, and misuse warnings.

The main body may name a model term only after a scene has earned it. The Method Appendix can be technical, but it must be clearly outside the narrative contract.

## Current narrative contract

The current book asks the reader to follow people, documents, rooms, and consequences before it asks them to follow notation.

That contract should stay:

- Prologue to Ch14: field language only, except already-natural decision words.
- Ch15 to Ch21: theory names can appear, but only as labels placed on a problem the reader has already seen.
- Epilogue: no formulas, no model summary, no authorial explanation. The final pressure should remain on the sent sentence.
- Field Toolkit: reference tools for action, not mathematical exposition.
- Method Appendix: the place where formulas and formal notation can be explicit.

## What not to do

Do not retrofit the story into a textbook chapter sequence.

Avoid these moves:

- adding a formula to Prologue, Ch01 through Ch14, or Epilogue;
- explaining BZM before the reader sees field language fail;
- putting a table or derivation immediately after a painful scene;
- using old internal examples or organization-specific vocabulary as public proof;
- reintroducing branded score language in the main public narrative;
- making Ch22 through Ch24 carry both Field Toolkit and model appendix duties;
- turning the young commercialization lead into a model lecturer.

## Placement architecture

The clean structure is:

1. **Story body:** Prologue, Ch01 through Ch21, Epilogue.
2. **Field Toolkit:** Ch22 through Ch24, already separated visually and navigationally.
3. **Model Notes:** short optional notes attached near Ch15 through Ch21, or grouped between Epilogue and Field Toolkit if route design favors fewer interruptions.
4. **Method Appendix:** a separate appendix or route for formulas, notation, weights, boundaries, and glossary.

The preferred implementation is to start with grouped Model Notes rather than inline chapter insertions. That lets the narrative stay untouched while the team tests whether readers want more theory before the Toolkit or after it.

If later inline Model Notes are added, they should be visually smaller than the chapter body, clearly optional, and titled as notes rather than chapter sections.

## Model note candidates

Each Model Note should be 120 to 220 words. It should start from a field question, then offer only the smallest formal handle needed.

### Model Note 1: Why a map exists

Placement: after Ch15, or in a grouped Model Notes section before the Method Appendix.

Purpose: explain why the book moves from field scenes to a map at all.

Allowed content:
- readiness map;
- next uncertainty;
- survival conversation;
- "map, not replacement for judgment."

Avoid:
- formulas;
- score terminology;
- derivation.

### Model Note 2: Five readiness axes

Placement: after Ch16.

Purpose: define TRL, BRL, GRL, SRL, HRL without making Ch16 a glossary.

Allowed content:
- one-sentence definitions;
- reminder that the axes name different unanswered questions;
- axis values as conversational levels, not ranking.

Avoid:
- full weighting;
- integrated score;
- long rubrics.

### Model Note 3: Macro alignment

Placement: after Ch17.

Purpose: explain sigma_SU as a way to stop treating policy, industry, and academia momentum as one undifferentiated tailwind.

Allowed content:
- sigma_SU as a macro alignment label;
- mu_A, mu_I, mu_G as three separate momenta;
- at most one simplified formula if the editor decides the public edition needs it.

Recommended formula policy:
- Put the actual formula in Method Appendix, not in the main story.

### Model Note 4: Founder function

Placement: after Ch18.

Purpose: clarify FRL, F_character, and F_capability as placement design, not personality judgment.

Allowed content:
- founder function;
- what the external candidate can carry;
- what cannot be outsourced;
- why repeat-back and bad-news behavior matter.

Avoid:
- psychometric formulas in the main note;
- founder hero language.

### Model Note 5: Integrated readiness as survival conversation

Placement: after Ch19.

Purpose: explain why the integrated map changes the next action rather than ranking projects.

Allowed content:
- integrated readiness;
- bottleneck / lowest unresolved condition;
- RESOURCE_SHIFT as a decision to subtract work;
- survival probability and earning body as field questions.

Avoid:
- branded score term in public main narrative;
- large numeric claims;
- false precision.

### Model Note 6: Evidence rule update

Placement: after Ch20.

Purpose: explain retrofit as evidence-rule revision, not blame assignment.

Allowed content:
- old evidence rule vs new evidence rule;
- append-only observation;
- why learning logs preserve trust.

Avoid:
- formulas unless the Method Appendix later formalizes update logic.

### Model Note 7: Nursery readiness

Placement: after Ch21, before Epilogue only if it does not weaken the ending; otherwise in Method Appendix.

Purpose: explain ERS and institution readiness after the story has already shown responsibility gaps repeating across cases.

Allowed content:
- unknown vs not_started;
- responsibility pipeline;
- nursery readiness;
- 90-day pilot as operating design.

Avoid:
- ending the narrative with ERS math.

## Method appendix candidates

The Method Appendix should be explicitly non-narrative. It can be technical and skippable.

Recommended appendix structure:

1. **Notation and scale**
   - Value ranges.
   - Why axes use 0 to 9.
   - What the +1 shift prevents.

2. **Macro alignment**
   - sigma_SU.
   - mu_A, mu_I, mu_G.
   - Triple Helix interpretation.
   - State-space equations only here, not in story chapters.

3. **Readiness axes**
   - TRL, BRL, GRL, SRL, HRL.
   - Rubric design principles.
   - Why one high axis cannot rescue an unworked low axis.

4. **Founder function**
   - FRL.
   - F_character and F_capability.
   - Why the model treats founder readiness as fit and complement design.

5. **Integrated readiness**
   - Product-style integrated formula.
   - Weighting policy.
   - Bottleneck sensitivity.
   - Why the number is a conversation starter, not a ranking.

6. **Institutional nursery readiness**
   - ERS.
   - Responsibility pipeline.
   - Unknown vs not_started.
   - Pilot design and stop/expand gates.

7. **Model boundaries and misuse warnings**
   - Do not use the score to force early incorporation.
   - Do not use it to hide uncertainty behind precision.
   - Do not use founder readiness as personality judgment.
   - Do not publish raw field notes or private cases.

## Chapter insertion map

| Location | Action | Reason |
|---|---|---|
| Prologue | No model note | The opening must stay with the overstrong sentence and the silent researcher. |
| Ch01-Ch06 | No formulas | The reader is still learning what the mistake costs. |
| Ch07-Ch10 | No formulas; decision words may stay in-scene | WAIT and RESOURCE_SHIFT must be felt as work before they are formalized. |
| Ch11-Ch14 | No formulas; keep field-language bridge | The middle is already dense. Extra theory here would slow it down. |
| Ch15 | Optional Model Note 1 | The map appears only after repeated field words have failed. |
| Ch16 | Optional Model Note 2 | The five readiness axes can be defined after the five receivers of "ready" are visible. |
| Ch17 | Optional Model Note 3 | Macro alignment can be named after the 8:12 email and corridor board. |
| Ch18 | Optional Model Note 4 | Founder-function terms can be clarified after the 90-day memo. |
| Ch19 | Optional Model Note 5 | Integrated readiness can be explained after RESOURCE_SHIFT changes the room. |
| Ch20 | Optional Model Note 6 | Evidence-rule update belongs after the learning log. |
| Ch21 | Optional Model Note 7, or appendix-only | ERS should not steal the ending from the three papers and the Epilogue. |
| Epilogue | No model note | The final sentence belongs to the send button, not the model. |
| Ch22-Ch24 | Cross-reference only | Field Toolkit should remain practical reference, not formula appendix. |
| Method Appendix | Full formulas and notation | Technical readers can inspect the model without interrupting story readers. |

## Acceptance gate

Any future model-exposition implementation must pass these checks:

- The main narrative remains readable if every Model Note is skipped.
- No formula appears before the field question that earns it.
- No formula appears in Prologue or Epilogue.
- No old internal examples or organization-specific labels appear in public text.
- Public language avoids branded scoring and frames integrated readiness as next action / uncertainty reduction.
- Ch22 through Ch24 remain Field Toolkit, not mixed Toolkit-plus-methodology chapters.
- Method Appendix includes misuse warnings.
- If route, manifest, or UI changes are made, local build is required.
- Production deploy is not required for markdown-only planning changes and should stay quota-aware.

## Next implementation order

1. **Model Appendix TOC draft**
   - Create the public-facing appendix structure without inserting formulas into the story.
   - Decide whether it lives after Field Toolkit or as a separate "Method" route.

2. **Model Note prototype**
   - Draft one or two sample notes, preferably after Ch16 and Ch19.
   - Test whether they feel optional and non-disruptive.

3. **Notation public rewrite**
   - Rewrite old notation material into public-safe language.
   - Remove internal naming, branded scoring, and raw old examples.

4. **Route/main integration review**
   - Merge the story polish branch carefully.
   - Build locally because route/UI changes already exist in this branch.
   - Keep production deploy bundled and quota-aware.

5. **Final publication readiness audit**
   - Check sales-page rhythm, narrative fatigue, appendix clarity, model-exposition clarity, and route/TOC behavior together.
