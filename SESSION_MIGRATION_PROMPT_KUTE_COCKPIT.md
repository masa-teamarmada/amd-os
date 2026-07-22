# SESSION MIGRATION PROMPT — KUTEコックピット研究者別シーズ

```text
cd /Users/masa/projects/AMD/amd-os

あなたはAMD OSのKUTEコックピット継続worker。branch/worktreeを作らず、既存mainで、共有checkoutにある他workerの未コミット変更を保持して進める。

## 最初に読む順

1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/HANDOFF.md
4. /Users/masa/projects/AMD/amd-os/AGENTS.md
5. /Users/masa/projects/AMD/amd-os/CLAUDE.md
6. /Users/masa/projects/AMD/amd-os/pwa/AGENTS.md
7. /Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md
8. /Users/masa/projects/AMD/amd-os/pwa/design/SPEC_pwa.md
9. /Users/masa/projects/AMD/amd-os/pwa/design/seeds.md
10. /Users/masa/projects/AMD/amd-os/pwa/design/cockpit.md
11. /Users/masa/projects/AMD/amd-os/pwa/design/FEATURE_REGISTRY.md
12. /Users/masa/projects/AMD/amd-os/pwa/manual/2-3-pj-cockpit.md
13. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md
14. /Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-07.md の「KUTEコックピット研究者グルーピング」節

rootの /Users/masa/projects/AMD/amd-os/SESSION_MIGRATION_PROMPT.md はBook A司令塔08のcanonical prompt。KUTE作業では上書きしない。

## 状態スナップショット（2026-07-22 closeout時点）

- canonical repo: /Users/masa/projects/AMD/amd-os
- branch: main
- handoff作成前baseline HEAD / origin/main: c45a8654 / c45a8654（ahead 0 / behind 0）。handoff bundleの最終commitは `git log -1 --format=%H -- HANDOFF.md` で確認する
- KUTE accepted commit: ece458b49589dee3eb47c5476967113f40e6980f
- handoff作成前production: v3.47.13 / b4e664146a9e3576b5f094740770a2e7760618ee / main / dirty=false。handoff bundle push後は `/api/build-info` を再確認する
- KUTE実装はproductionへ反映済み。DB migrationはなく、既存seeds行も変更していない。
- 2026-07-21確認時の工学院大学データ: 研究者7名・シーズ9件。高橋義典先生は3シーズ。
- visual evidence:
  - /Users/masa/.codex/visualizations/2026/07/20/019f7dad-70e3-7982-98ad-84574a53d48e/kute-researcher-group/desktop-1440.png
  - /Users/masa/.codex/visualizations/2026/07/20/019f7dad-70e3-7982-98ad-84574a53d48e/kute-researcher-group/mobile-390.png
  - /Users/masa/projects/AMD/amd-os/.jez/artifacts/design-review.md

closeout時点のKUTE外dirty。勝手にstage/revertしない:

- pwa/bzm/book-a-ch-1.md — active Book A session bzm-54
- HANDOFF_H1_BACKGROUND_2026-07-22.md / SESSION_MIGRATION_PROMPT_H1_BACKGROUND.md — H-1 background closeout lane
- pwa/supabase/.temp/cli-latest — Supabase CLI cache

## 今回までに完了したこと

まさのフィードバックは「高橋先生のシーズが2つに分かれて見える。1人の先生が複数シーズを持つことは今後もあるので、DBはその仕組みのはず」というものだった。実DBでは高橋義典先生は2件ではなく3件だった。

DBの正しい粒度は研究者1行ではなく、技術×用途のシーズ1件につき1行。したがってDB行を結合・削除せず、比較UIだけを研究者単位にグループ化した。全研究者に同じ見出し帯を出し、その直下に案件行を保持する。グループ境界は同一org_name＋NFKC/連続空白/前後空白を正規化したresearcher_name。研究者名未登録はシーズIDごとの独立グループにする。SPS等で並び替えてもグループを分断せず、グループ内だけを並べ替える。

主な実装:

- pwa/src/components/cockpit/CockpitKuteSeeds.tsx
- pwa/src/lib/kute-seeds-scoring.ts
- pwa/src/lib/seeds-data.ts
- pwa/scripts/check_kute_seeds_scope.mts

正本同期:

- pwa/design/seeds.md
- pwa/design/cockpit.md
- pwa/design/FEATURE_REGISTRY.md
- pwa/manual/2-3-pj-cockpit.md
- pwa/manual/9-3-appendix-changelog.md
- pwa/BUGS.md
- pwa/design_log/sessions_2026-07.md

## 次タスク

KUTE研究者グルーピング自体に未完了作業はない。次セッションの最初の一手はread-only監査:

1. git fetch --all --prune
2. git status -sb --untracked-files=all
3. git rev-list --left-right --count main...origin/main
4. curl -fsS https://amd-os-pwa.vercel.app/api/build-info でmain/dirty=false/current SHAを確認
5. Supabaseまたはauthenticated画面で、工学院大学のseed件数・研究者グループ数・高橋先生のシーズ数を再確認

まさから新しいフィードバックがない限り、再実装、DB統合、架空のresearcher_id追加、seed行の削除はしない。次の要望が来たら、既存のgroupSeedsByResearcher()/sortSeedGroups()境界を拡張する。

既知の未解決境界は、DBに研究者マスタ/研究者IDがないこと。敬称、姓名順、別名など意味的な表記揺れまで統合する必要が出た場合だけ、既存seeds正本を壊さない研究者正本を別途設計する。現時点では実装しない。

## 運用ルール

- main一本。branch/worktreeを作らない。dirtyを理由にbranchへ逃げない。
- shared checkoutではgit add . / git add -Aを使わず、対象ファイルだけを明示stageする。
- 他workerのdirtyを含めない。必要ならmainのdisposable clean cloneでdeployする。
- Global Seedsを唯一の正本にし、KUTE専用seed台帳を作らない。
- 内部メモ、source_detail、axis_evidence、evaluatorを大学向け一覧へ出さない。
- unknownはunknownのまま表示し、スコアや資料URLを捏造しない。
- UI変更時はdesign/interface方針、desktop/mobile Playwright、console/page error、body overflow、詳細モーダルを確認する。
- PWAコード変更時はBUILD_VERSIONをpatch bumpし、関連design/manual/changelogを同じbundleで同期する。
- production反映は AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh のみ。npx vercel直接deployは禁止。
- closeoutではcloseout_inventory.sh、main/origin/production整合、dirty owner/action/risk、worktree/branch残数を明記する。
```
