# Notion Company Content Dry Run

Date: 2026-06-04

Scope: Team ARMADA / AMD company content migration for member list, history, and photo/media.

## Sources Verified

| source | notion id / collection | status |
|---|---|---|
| AMD page | `14097749-c608-80ec-90d5-cc7d9376f114` | verified |
| member list database | `13497749-c608-80ab-a466-fa3c470639ae` / `collection://4f13723c-7383-4834-9b48-9ede8b59f014` | verified |
| history database | `1656ecbd-4cad-407f-b819-5791c3a85333` / `collection://6767aaab-c268-4bd6-af60-21845c715fe1` | verified |
| representative photo/history page | `40f2847f-238a-4592-b6be-d384582dcbf9` | verified |

## Dry-Run Result

| lane | result |
|---|---|
| member profiles | representative member pages and DB search results fetched. `125_company_content_notion_seed.sql` seeds only rows whose Notion member can be resolved to existing `members.member_id`; Notion-only people are intentionally skipped |
| history | database schema and AMD-related rows fetched. `125_company_content_notion_seed.sql` seeds the verified AMD company history rows into `company_history_events` |
| photo/media | Notion has member photos. No URL was copied into repo data. Seed creates admin-only `media_assets` review rows for confirmed member-photo presence; actual Storage import and permission/consent review remain required before display |
| company profile | AMD page properties and page structure verified. Strategy/internal body must be split from company profile copy before approval |

## Blockers Before Production Import

- Apply reviewed migration `pwa/scripts/migrations/124_company_content_tables.sql`.
- Apply reviewed seed `pwa/scripts/migrations/125_company_content_notion_seed.sql` after `124`.
- Re-run Notion row export with a working data-source query path or an approved connector workaround before trying to import Notion-only people or full profile detail.
- Resolve Notion PJ relation URLs to `projects.project_id`.
- Resolve skipped Notion member pages to `members.member_id` before importing them.
- Upload reviewed images into Supabase Storage and fill `storage_bucket`, `storage_path`, and `thumbnail_path`.
- Keep media rows at `needs_review` unless `usage_permission` and `consent_status` are known.

## Safety Notes

- Do not write raw Notion body, expiring Notion file URLs, personal memo body, or private wiki content into public/internal surfaces.
- LLM/import helpers may create only `imported` or `needs_review`.
- `/company` should show only approved rows.
- `/admin/company` is the review queue and can show imported metadata without exposing raw source bodies.
