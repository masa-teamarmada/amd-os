# SESSION MIGRATION PROMPT - AMD OS MTG Prep Notion Context Gate

```text
cd /Users/masa/projects/AMD/amd-os

まず `HANDOFF.md` を読んで。次に仕様正本として `pwa/spec/3-3-meeting-flow-current-spec.md` を読み、そのあと `pwa/BUGS.md`、`pwa/manual/2-3-pj-cockpit.md`、`pwa/manual/8-3-l2-extraction-routines-spec.md`、`CLAUDE.md`、`AGENTS.md`、`pwa/CLAUDE.md` を読んで。

今回の current truth:
- MTG prep は Notion AI Meeting Notes 用の固有名詞・略称・論点 context を「作っただけ」では ready にしてはいけない。
- `pwa/scripts/l6_prep_notion_context_gate.cjs` が target page と marker を判定する。
- target page があり marker 未挿入の `needs_insert` は中間状態。worker は append-only insert → page 再fetch → gate再実行をする。
- `prep_worker_status='ready'` に進めるのは、`prep_readiness_reasons.notion_ai_context.status` が `injected` / `already_present` / `not_found` / `write_failed` / `ambiguous` / `wrong_page` / `skipped_after_meeting` のいずれかになった時だけ。
- 既存 `prep_notion_page_id` が過去 page を指す場合は `wrong_page`。過去 page へ追記しない。

作業開始前に必ず:
1. `git fetch origin main --prune`
2. `git status -sb --untracked-files=all`
3. `git log --left-right --oneline main...origin/main`
4. `npm --prefix pwa run test:l6-prep-notion-context-gate`
5. `rg -n "l6_prep_notion_context_gate|needs_insert|prep_concierge|codex exec|create_thread" pwa/scheduled-tasks pwa/spec/3-3-meeting-flow-current-spec.md pwa/manual/8-3-l2-extraction-routines-spec.md`

最初の一手:
1. live H-1 automation の prompt / scheduler が、この repo の prep worker SKILL と `l6_prep_notion_context_gate.cjs` を参照しているか確認する。
2. 実際の upcoming MTG 1件で、Notion AI Meeting Notes page に marker が入り、再fetch後に `injected` または `already_present` で保存されることを確認する。
3. 次に、Phase P の spawn / notification contract を整理する。現状の repo には古い `codex exec` / auto Slack DM wording が残っている箇所がある。まさの最新期待は visible Codex thread、未承認 auto DM なし、Slack送信は明示依頼時だけ Eimi名義。

守ること:
- `git add .` は使わない。選んだ bundle のファイルだけ個別 stage。
- raw Gmail / raw Slack / raw Notion / raw Drive 本文を durable artifact に出さない。
- Notion context は作成と実挿入確認を分ける。`needs_insert` のまま ready 保存しない。
- PWA deploy が必要なら `.vercel/project.json` が `amd-os-pwa / prj_raZW3HSKIszzPUwNTHfy7xDGzLHm` であることを確認し、`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` を使う。
```
