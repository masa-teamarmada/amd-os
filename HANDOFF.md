# AMD OS Handoff

Last updated: 2026-06-30 JST
Target: `/Users/masa/projects/AMD/amd-os`
Topic: Monthly report contract metadata in `/admin/projects` / PJ cockpit + Calendar work blocks

## Latest Session Summary

See `pwa/design_log/sessions_2026-06.md` section "2026-06-30 — 月次報告書ルールの admin/projects / cockpit 反映 + Calendar 作成枠".

- `/admin/projects` now has a `月次報告` column backed by `projects.contract_terms_json`.
- PJ cockpit header now shows monthly report status, timing, deadline, format, required items, and notes from the same JSON.
- Contract Apply / extraction maps monthly report submission fields from `contract_terms.extracted_terms_json` into `projects.contract_terms_json`.
- Production DB was updated for CX (`p20`), SX (`p21`), and KUTE (`p25`). KUTE explicitly says: `契約上の義務はないが要提出：フォーマットは自由`.
- Google Calendar recurring work blocks were created and then adjusted against existing calendar events, using each PJ color.

## Repo / Production State

- canonical branch: `origin/main`
- accepted product commits:
  - `6d3b95b7 Add monthly report contract rules to project ledger`
  - `f75ca7ff Refine monthly report contract metadata`
- production `/api/build-info` verified on 2026-06-30 JST:
  - `build_version`: `v0.36.35`
  - `git_sha`: `f75ca7ff5fda5fa590ad63606d3dde5a8c772aee`
  - `git_branch`: `main`
  - `dirty`: `false`
- main/default alignment: `main aligned` for the accepted monthly-report product change.

## Verification Run

- Production build-info confirmed `v0.36.35 / f75ca7ff / main / dirty=false`.
- Calendar event search confirmed created monthly-report blocks for July 2026 through the relevant contract windows.
- Calendar availability freebusy endpoint returned `ACCESS_TOKEN_SCOPE_INSUFFICIENT`; event-list search was used as the working availability source.
- No build/test was run in this closeout-only handoff pass. The product commits were already deployed before this handoff.

## Calendar Work Blocks

All events are on the primary calendar, busy/opaque, self accepted, 10-minute popup reminder, no Google Meet.

| PJ | Event title | Color | Timing after adjustment | Series / exception |
|---|---|---:|---|---|
| CX | `＋CX 月次報告書作成` | `9` | 10:00-12:00 on the first Wed/Thu in the 23-28 window | `COUNT=3`; Sep 2026 instance moved from Wed 2026-09-23 to Thu 2026-09-24 because 9/23 is all-day `不在` |
| SX | `＋SX 月次報告書作成` | `4` | 08:00-10:00 on the first Mon/Tue in the 23-28 window | `COUNT=9`, July 2026 through March 2027 |
| KUTE | `＋KUTE 月次報告書作成` | `11` | 16:00-18:00 on the first Mon/Tue in the 23-28 window | `COUNT=9`, July 2026 through March 2027 |

Event master IDs:
- CX: `0qsea368as49a2h1ihfdhs21ok`
- SX: `tsotvrhp2b8cea8u9kkq8sdo1c`
- KUTE: `5fi9qjkvjnm27t2dblmb0nd4v4`

## DB Current Values

| PJ | project_id | monthly report current truth |
|---|---|---|
| CX | `p20` | rule `要確認`; timing `月次`; deadline `指定なし`; format `指定なし`; required items `業務実施計画書、月次進捗報告（詳細項目は未確認）` |
| SX | `p21` | rule `要提出`; timing `月次請求時`; deadline `請求書提出時`; format `指定なし`; required items `指定なし` |
| KUTE | `p25` | rule `要提出`; timing `月次`; deadline `指定なし`; format `自由`; required items `指定なし`; note `契約上の義務はないが要提出：フォーマットは自由` |

## Dirty / Untracked Classification

The visible root checkout `/Users/masa/projects/AMD/amd-os` is behind `origin/main` and contains separate WIP. Do not sweep it with broad staging.

| group | class | owner guess | resolution action | risk |
|---|---|---|---|---|
| notification / L2 / meeting-flow docs and TS files | other-worker | notification / H-1 worker | send back to owner or cleanup worker for bundle commit/revert decision | medium: mixed commit can alter notification/meeting behavior |
| contract / monthly agreement proposal + docx | other-worker | contract/legal worker | keep as WIP, commit only with contract bundle | medium: legal draft provenance can blur |
| Admin Kiyo / meeting-assets replace / project-labels / migration 153 | other-worker | admin/kiyo and meeting-assets worker | owner must finish tests/spec/manual or discard | high: untracked routes/imports can break production if partially committed |
| H-1 prep worker outbox markdowns | other-worker artifact | H-1 prep worker | decide gitignore vs artifact commit in that worker | low-medium: repo noise and privacy/provenance confusion |
| `gas-slack/.clasp.json` | deploy-link-local | GAS Slack worker | verify project identity; do not commit without owner | medium: local clasp link can point to wrong GAS project |
| `ios/supabase/.temp/project-ref` | deploy-link-local | local Supabase tooling | leave local or handle in dedicated cleanup | low |

## Unresolved Tasks

- None for the accepted monthly-report product change and Calendar scheduling work.
- Separate cleanup owner is still needed for the visible root checkout dirty groups above.

## First Next Action

1. Read this `HANDOFF.md`.
2. Then read `pwa/spec/5-6-contracts-management-current-spec.md`, `pwa/spec/3-8-cockpit-current-spec.md`, `pwa/manual/6-2-admin-projects-members-ledger-spec.md`, `pwa/manual/2-3-pj-cockpit.md`, and `pwa/BUGS.md`.
3. Run:

```bash
cd /Users/masa/projects/AMD/amd-os
git fetch origin main --prune
git status -sb --untracked-files=all
curl -fsS 'https://amd-os-pwa.vercel.app/api/build-info'
```

4. If continuing this lane, verify logged-in `/admin/projects` and the three PJ cockpits (`p20`, `p21`, `p25`) show the monthly report details, not just `要提出`.
5. If changing Calendar placement again, use bounded event-list search for the 23-28 windows; the freebusy endpoint may be unavailable with current connector scope.

## Archive Decision

handoff required.

Reason: the accepted monthly-report bundle is main / production aligned, and Calendar work is complete. The overall visible workspace still has separate WIP groups that need owner cleanup before the root checkout can be archived as clean.
