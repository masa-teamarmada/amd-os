---
name: amd-os-l2-weekly-vc-funding-signals
description: AMD OS weekly L2 evidence routine for W-1 (= old L2 15 VC News / Funding Signals). Runs as a Claude routine on claude.ai/code/routines, weekly Saturday 09:00 JST. Collects reviewable VC news, fund formation, investment activity, dry powder, and fundraising-related public signals for AMD deeptech strategy. Does not revive PWA/Vercel LLM cron, does not auto-confirm VC/fund records, and emits candidates / outbox / blocked summary when the safe write path is unclear.
---

# AMD OS Weekly VC / Funding Signals routine (W-1)

> **これは何か**: 旧 L2 ⑮ VC News / Funding Signals を **W-1** として weekly cadence に分離した Claude routine。
> D/M へ混ぜない。H は Codex専用なのでここにも混ぜない。

## Current truth

- **target runtime**: Claude routine `amd-os-l2-weekly-vc-funding-signals`
- **cadence**: weekly Saturday 09:00 JST (`0 9 * * 6`)
- **scope**: old L2 ⑮ only
- **target tables**: `vc_news`, `vcs`, `vc_funds`, `vc_investments`, `project_vc_relations`
- **stance**: review first。明確な safe write path がない場合は DB に直接書かず、review outbox / blocked summary に止める。

Claude routine と呼べるのは、Claude Routines UI上で存在し、`ACTIVE`、`next run`、`last run` または初回 one-off evidence を確認できるものだけ。`SKILL.md` の存在は登録済み証拠ではない。

## Read first

1. `pwa/spec/3-1-l2-data-extraction-current-spec.md`
2. `pwa/spec/5-3-automation-responsibility-current-spec.md`
3. `pwa/manual/8-3-l2-extraction-routines-spec.md`
4. `pwa/manual/5-1-research-assets-vc-seeds-scholar-spec.md`
5. `pwa/design/vc_list.md`
6. `pwa/design/db_schema.md`

## Hard rules

- Do not revive or schedule PWA `/api/cron/vc-discover` as an active Vercel cron.
- Do not use PWA / Vercel background LLM cron for W-1.
- Do not deploy, apply migrations, run DDL, or push code.
- Do not write private/raw source body text.
- Do not auto-confirm VC, fund, investment, or project relation records without review.
- Store only source URL, title, date, short summary, source hash, candidate mapping, confidence, and duplicate key.
- If source reliability, duplicate matching, schema, or write path is unclear, stop as review-required / blocked summary instead of improvising.

## Inputs

- Public VC / fund / startup funding announcements and reliable business media.
- Existing AMD OS VC data: `vcs`, `vc_funds`, `vc_investments`, `project_vc_relations`, `vc_news`.
- Existing AMD OS project context only as needed for relation candidates. Do not expose private project notes in output.

## Output contract

Emit reviewable candidates for:

- `vc_news`: news item candidates linked to known or candidate VC.
- `vcs`: new VC stub candidates only when identity confidence is high.
- `vc_funds`: fund formation / close / target / dry powder candidates.
- `vc_investments`: investment activity candidates.
- `project_vc_relations`: relation candidates only when project relevance is clear.

Each candidate must include:

- `source_url`
- `source_title`
- `source_date` when available
- `summary_short`
- `source_hash`
- candidate entity keys
- `confidence`
- duplicate / already-known decision
- review reason

## Run summary

Return a concise summary:

- sources checked
- candidates emitted by table
- duplicates skipped
- blocked items and reasons
- human review decisions needed

Do not include raw article bodies, private source text, tokens, secrets, or personal information.
