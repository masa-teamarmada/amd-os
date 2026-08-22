# Final Publication Readiness Audit

Date: 2026-06-03 JST

Worker: Textbook commander / final publication readiness audit

Scope:
- Review the current Prologue-to-Epilogue story, Field Toolkit, Model Notes, Method Appendix, and route/TOC readiness.
- Do not edit public manuscript body in this pass.
- Do not deploy.

Current branch:
- `codex/textbook-full-story-final-readthrough-polish`
- latest audited commit: `2bbe425`

## Executive verdict

The current manuscript has crossed from "draft material" into a coherent book architecture.

It is not yet a final sales-ready manuscript, but the core objective of finishing the narrative from Prologue to Epilogue is now substantially true on the branch:

- The story opens with an overstrong sentence.
- That sentence travels through evidence, disclosure, company timing, CEO function, WAIT, investor exposure, learning, tailwinds, readiness, founder function, institutional nursery, and integrated readiness.
- The main story closes in the Epilogue with a weaker sentence that can finally be sent.
- Field Toolkit is separated as practical reference.
- Method Appendix is separated as model exposition.

The branch is suitable for main integration after one deliberate release gate. The next risk is not story incompleteness; it is presentation and integration quality.

## What is now publication-shaped

### 1. Narrative spine

The spine is visible:

`strong sentence -> protected line -> weak evidence -> disclosure danger -> early company pressure -> WAIT work -> responsibility gap -> investor exposure -> learning log -> tailwind pressure -> readiness split -> founder-function fit -> institution nursery -> integrated RESOURCE_SHIFT -> evidence-rule update -> epilogue weak sentence`

This is no longer a collection of correct chapters. It is a book-length consequence chain.

### 2. Reader proxy

The young commercialization lead now functions as a reader proxy:

- makes an overclaim;
- learns to weaken language;
- carries weak evidence back into rooms;
- writes the WAIT / RESOURCE_SHIFT / learning artifacts;
- transfers the learning into another case in the Epilogue.

This solves the earlier "framework without protagonist" problem.

### 3. Author directives are retained

The author's core directives are present:

- survival probability;
- earning body;
- delaying incorporation when readiness is not present;
- skepticism toward one-size-fits-all J-curve / IPO pressure;
- small paid evidence as a signal, not a doctrine;
- support actors' local rationality.

These are carried especially in Ch01, Ch06, Ch09, Ch19, the Epilogue, and Method Appendix M8.

### 4. Theory has a home

The model is no longer missing, and it no longer has to interrupt the story.

Current structure:

- Story body: Prologue through Ch21 plus Epilogue.
- Field Toolkit: Ch22 through Ch24.
- Method Appendix: M0 through M8.
- Prototype Model Notes: Ch16 and Ch19.

This solves the "where did the model go?" concern without reverting the book to a formula-first manuscript.

### 5. Route / TOC shape is coherent

The manifest now has:

- Prologue.
- Part 1 through Part 5.
- Epilogue.
- Field Toolkit.
- Method Appendix.

Manifest consistency check passes with no missing or unlisted public manuscript markdown.

## Remaining publication risks

### 1. Model Notes need visual treatment

The two prototype notes are acceptable, but their prose still exposes scaffolding:

- `このModel Noteは`
- `巻末の...を開けばよい`

This can be solved later by UI / markdown rendering:

- smaller optional note treatment;
- link-like appendix callout;
- no need to add more Model Notes yet.

This is a presentation issue, not a story blocker.

### 2. Method Appendix may feel long in public navigation

M0 through M8 is editorially useful, but public navigation may feel heavy.

Possible later fix:

- keep separate files for editing;
- add a Method Appendix landing page;
- visually group the M files as one appendix family.

This should be checked in route/browser review after main integration or local env setup.

### 3. Formula rendering is not final

Formulas currently appear as inline code-style text. That is safe and readable, but not final typography.

Later decision:

- keep inline formulas for accessibility and mobile readability;
- or switch to math blocks if rendering quality is proven.

Do not make this a blocker for main integration.

### 4. Public route visual check still needs real env or deploy

Previous local browser attempt hit middleware env absence. Build passes, but visual inspection needs either:

- local env with Supabase public variables; or
- bundled production/staging deploy after main integration.

This is a release QA task, not a manuscript-writing blocker.

### 5. Sales copy rhythm is still separate

The manuscript is now shaped as a book, but sales-page copy, title/subtitle, back-cover promise, sample chapter choice, and reader persona copy are not finalized.

Do not confuse manuscript readiness with sales package readiness.

## Do not rewrite

Do not do a full-story rewrite now.

Do not re-open Prologue-to-Epilogue architecture unless a cold reader finds a structural contradiction.

Do not add Model Notes to every chapter.

Do not move formulas into Ch00 through Ch14 or Epilogue.

Do not collapse Field Toolkit and Method Appendix.

Do not remove the narrative in order to make the model feel more textbook-like.

## Recommended next gate

Proceed to `main integration execution`.

Reason:

- Branch includes latest `origin/main`.
- Build passed after main merge.
- Manifest consistency passed.
- Story objective is substantially satisfied on the branch.
- Remaining issues are publication polish and release QA, not blockers to integration.

Main integration should still be treated as release-sized:

1. Reconfirm branch clean.
2. Reconfirm `origin/main...HEAD = 0 N`.
3. Run `npm run build`.
4. Fast-forward or merge into `main` from a clean worktree.
5. Push `main`.
6. Decide one bundled deploy, not repeated deploy retries.

## Acceptance gate status

### Pass

- Prologue-to-Epilogue story exists.
- Epilogue closes the central sentence arc.
- Field Toolkit is separated.
- Method Appendix exists.
- Model Notes are limited and optional.
- Forbidden internal/public terms scan has passed in prior implementation checks.
- Build passed after merging latest `origin/main`.
- Manifest consistency passed.

### Conditional pass

- Model Note presentation.
- Method Appendix navigation weight.
- Formula typography.

### Not yet done

- Production/staging visual check.
- Technical notation expert review.
- Sales package copy.

## Final recommendation

Integrate this branch to `main` as the current Textbook story baseline.

After main integration, continue with:

1. Method Appendix / Model Note layout readability.
2. Technical notation review.
3. Production/staging route inspection.
4. Sales copy / publication package.
