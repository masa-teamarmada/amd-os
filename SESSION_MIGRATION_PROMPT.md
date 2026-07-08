# SESSION MIGRATION PROMPT - AMD OS W-Prep Launch

```text
cd /Users/masa/projects/AMD/amd-os

読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/HANDOFF.md
4. /Users/masa/projects/AMD/amd-os/CLAUDE.md
5. /Users/masa/projects/AMD/amd-os/AGENTS.md
6. /Users/masa/projects/AMD/amd-os/pwa/AGENTS.md
7. /Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md
8. /Users/masa/projects/AMD/amd-os/pwa/spec/3-3-meeting-flow-current-spec.md
9. /Users/masa/projects/AMD/amd-os/pwa/scheduled-tasks/README.md
10. /Users/masa/projects/AMD/amd-os/pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/SKILL.md
11. /Users/masa/projects/AMD/amd-os/pwa/design/L2_DATA.md
12. /Users/masa/projects/AMD/amd-os/pwa/manual/2-3-pj-cockpit.md
13. /Users/masa/projects/AMD/amd-os/pwa/manual/3-2-data-and-extraction.md
14. /Users/masa/projects/AMD/amd-os/pwa/manual/8-3-l2-extraction-routines-spec.md
15. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md
16. /Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-07.md
17. /Users/masa/.codex/automations/w-prep-launch/automation.toml
18. /Users/masa/.codex/automations/w-prep-launch/memory.md

状態スナップショット:
- canonical repo: /Users/masa/projects/AMD/amd-os
- branch: main
- automation id: w-prep-launch
- active automation file: /Users/masa/.codex/automations/w-prep-launch/automation.toml
- automation memory: /Users/masa/.codex/automations/w-prep-launch/memory.md
- schedule: 毎週水曜 15:00 JST。見た目どおり、まさのローカル時間の15:00として扱う。
- expected post-closeout git state:
  - HEAD / origin/main: same after final push
  - ahead 0 / behind 0
  - worktree registry: /Users/masa/projects/AMD/amd-os [main] only
  - local branch: main only
  - dirty files may remain only in unrelated Atlas/MS lanes listed below
- production deploy is not meaningful for this W-Prep closeout because this bundle is docs/SKILL/automation prompt. If app code changes later, re-check /api/build-info and follow AMD OS PWA deploy rules.

このセッションで直したこと:
- W-Prep Launch は週1回の visible prep thread 起動レーン。
- 候補抽出は Calendar + DB の両方を見る。DB-only scan は禁止。CalendarにあるがDB未同期のMTGも落としてはいけない。
- 7日以内の確定 upcoming MTGをすべて確認する。件数上限や主観で間引かない。
- active/sales PJのみ対象。tentative、TBD弱重複、calendar-backed canonical row がある重複は除外する。
- `list_projects` は呼ばない。
- `create_thread` 前に必ず会議ごとのclaimをDBで取る。
- `prep_worker_session_id` がある行、`prep_worker_status in ('claiming','preparing','ready')` の行、同じ calendar_event_id で別canonical rowが ready/preparing のものは起動しない。
- thread作成後はすぐ `prep_worker_session_id`, `prep_worker_status='preparing'`, `prep_worker_spawned_at=now()` を保存する。
- thread title は `{meeting_title} prep` にする。
- thread作成後は必ず `set_thread_pinned` でピン留めする。ピン留めツールが本当に無い場合だけタイトルとIDを報告する。
- create_thread target は対象PJディレクトリ。例: SX -> /Users/masa/projects/AMD/SX, KUTE -> /Users/masa/projects/AMD/kute, ZMP -> /Users/masa/projects/AMD/ZMP, CX -> /Users/masa/projects/AMD/CX, SE -> /Users/masa/projects/AMD/SE。
- PJディレクトリを確定できない場合だけ fallback target は /Users/masa/projects/AMD。/Users/masa/projects/AMD/amd-os をprep thread作業場にしない。
- worker prompt は日本語。英語にしない。
- `~/knowledge/...` 参照は /Users/masa/projects/knowledge/... に解決する。
- worker prompt には AMD OS repo path /Users/masa/projects/AMD/amd-os をDB更新・参照パスとして明記する。ただし作業ディレクトリにはしない。
- worker は `pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/SKILL.md` と `pwa/scripts/l6_prep_notion_context_gate.cjs` を読む。
- Notion AI Meeting Notes context gate が `needs_insert` のままなら `ready` にしない。
- Phase 1-10完遂後、該当行へ prep artifact / readiness / `prep_worker_status='ready'` を保存する。
- raw本文、URL、secretを報告に出さない。

prep worker の最初の見え方:
- まさが入ってきた時点で、単なる「会議冒頭のセリフ」を出さない。
- 事前に完了しておくこと:
  1. これまでのMTGの流れを把握する
  2. 今回のMTGの位置づけと着地点を推定する
  3. その着地点に到達するためにまさがやるべきことを推定する
- 最初の可視メッセージはその3点の報告から入り、最後に `これであってる？どうする？` と聞く。

prep資料ルール:
- 共有フォルダに作るMTG資料は、AMD OS design code に従ったHTML資料を主成果物にする。
- Google Docs / Markdown / Slides / Sheets を主成果物にしない。必要なら補助出力だけ。
- HTMLは自己完結してレビュー可能にする。
- 参照するデザイン正本:
  - /Users/masa/projects/AMD/amd-os/pwa/src/lib/exec_summary/template.css
  - /Users/masa/projects/AMD/amd-os/pwa/src/lib/exec_summary/template_section.html
  - /Users/masa/projects/AMD/amd-os/pwa/design/cyber_hud_design_code.md
  - /Users/masa/projects/AMD/amd-os/pwa/design/hud_visual_language.md

仕様同期済み:
- /Users/masa/projects/AMD/amd-os/pwa/spec/3-3-meeting-flow-current-spec.md
- /Users/masa/projects/AMD/amd-os/pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/SKILL.md
- /Users/masa/projects/AMD/amd-os/pwa/scheduled-tasks/README.md
- /Users/masa/projects/AMD/amd-os/pwa/design/L2_DATA.md
- /Users/masa/projects/AMD/amd-os/pwa/manual/2-3-pj-cockpit.md
- /Users/masa/projects/AMD/amd-os/pwa/manual/3-2-data-and-extraction.md
- /Users/masa/projects/AMD/amd-os/pwa/manual/8-3-l2-extraction-routines-spec.md
- /Users/masa/projects/AMD/amd-os/pwa/manual/9-3-appendix-changelog.md
- /Users/masa/projects/AMD/amd-os/pwa/BUGS.md
- /Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-07.md
- /Users/masa/projects/AMD/amd-os/HANDOFF.md
- /Users/masa/projects/AMD/amd-os/SESSION_MIGRATION_PROMPT.md

未解決 / dirty:
- 以下はW-Prep closeout対象外。勝手にrevert/stageしない。
  - /Users/masa/projects/AMD/amd-os/pwa/scripts/atlas_signal_review_tool.mjs
  - /Users/masa/projects/AMD/amd-os/pwa/src/app/api/admin/ms-overview/route.ts
  - /Users/masa/projects/AMD/amd-os/pwa/src/components/admin/AdminMsOverviewClient.tsx
  - /Users/masa/projects/AMD/amd-os/pwa/src/lib/admin/ms-overview-calc.ts
- Atlas file は disabled-ingest retryable tempfail handling のWIPに見える。Atlas laneで検証してcommit/revert判断。
- MS 3 files は design amount を `budget × pt ratio` に寄せるWIPに見える。採用するなら spec/manual/test/version/deploy まで新bundleとして扱う。

次タスク:
1. まず `git status -sb --untracked-files=all`, `git log -3 --oneline`, `git rev-list --left-right --count origin/main...HEAD` を確認する。
2. W-Prepを触るなら、automation.toml と memory.md を絶対パスで読み、今回のルールが残っていることを確認する。
3. まさから「prepが漏れている」と言われたら、Calendar + DB の7日窓で再確認する。DBだけで判断しない。
4. 既存 `prep_worker_session_id` または preparing/ready がある会議に追加threadを立てない。
5. 新しくthreadを立てたら、必ず title rename と pinning までやる。

運用ルール:
- /Users/masa/projects/AGENTS.common.md を最初に読む。
- AMD配下では /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md も冒頭で読む。
- AMD OSでは branch を作らない。main で直接 commit & push。
- dirty は branch/worktree 作成理由にしない。git add . は使わず、対象ファイルだけstage。
- PWAコード変更時は /Users/masa/projects/AMD/amd-os/pwa/src/lib/build-info.ts の BUILD_VERSION をbumpする。
- PWA本番反映は main push = Vercel自動deploy。通常は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` を使う。CLI直接deployは禁止。
- handoff時は、新仕様を pwa/manual / pwa/spec / pwa/design / BUGS / design_log へ分けて記録し、HANDOFFだけに恒久仕様を残さない。
```
