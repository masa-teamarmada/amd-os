# SESSION MIGRATION PROMPT - AMD OS H-1 recurring MTG cards

```text
cd /Users/masa/projects/AMD/amd-os

まず `HANDOFF.md` を読んで。次に `pwa/design/meeting_summaries.md` と `pwa/design/L2_DATA.md`、その次に `pwa/BUGS.md` を読んで。続けて `pwa/manual/2-3-pj-cockpit.md`、`pwa/manual/3-2-data-and-extraction.md`、`pwa/manual/8-3-l2-extraction-routines-spec.md`、`pwa/design_log/sessions_2026-06.md` の最新 `2026-06-19 — H-1 recurring 予定MTGカード series 集約修正` を読んで。

今回の current truth:
- H-1 future Calendar 予定MTGカードは、recurring/定例 series ごとに次回1枚だけ表示する。
- `pwa/src/lib/meeting-series.ts` が cockpit / HUD 共通の series grouping helper。
- `CockpitMeetingSummary` / `HudCockpitMeetingSummary` は raw upcoming rows ではなく `groupUpcomingMeetingsBySeries` の series card を表示し、予定 count も series card 数。
- `calendar-sync` は recurring series の2件目以降を `recurring_series_future_occurrence` で skip する。
- DB `project_meeting_summaries` には `recurring_event_id` 列が無いので、既存カードは `calendar_event_id` / `meeting_id` / title から復元する。title に `定例` / `月次` / `毎月` / `weekly` / `monthly` 等がある場合は曜日を外して `PJ + normalized title + 開始時刻` で束ねる。曜日を key に入れると月次定例がまた複数カードになる。
- v0.28.7 は曜日入り fallback で月次定例を畳めず、v0.28.8 で補正。本番反映済み。その後 production は v0.28.10 / `75df41af` まで進行。

作業前に必ず:
1. `git fetch origin main`
2. `git status -sb`
3. `git log --left-right --oneline main...origin/main`
4. `curl -sS https://amd-os-pwa.vercel.app/api/build-info`

注意:
- まだ重複が見える場合は、その card の `title`, `meeting_date`, `meeting_start_at`, `calendar_event_id`, `meeting_id`, `source_kinds` を `project_meeting_summaries` で確認し、`looksSeriesLikeTitle` の対象語か key 設計を追加する。
- `git add .` は使わない。dirty が残っていたら、対象ごとに stage/commit/carry-forward を分ける。
- この handoff docs commit は local-only の可能性がある。`main...origin/main [ahead 1, behind 1]` なら、まず `git status -sb` で finance/admin dirty 一式を確認する。payout/reward/monthly agreement 系の dirty は H-1 由来ではないので、解決または隔離してから local handoff commit を現行 `origin/main` に載せる。
- PWA の本番反映は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` で main push + Vercel build 監視まで行う。
```
