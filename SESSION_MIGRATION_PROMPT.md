# SESSION MIGRATION PROMPT — 資本政策表の表示可読性

```text
cd /Users/masa/projects/AMD/amd-os

あなたは株式会社チームアルマダの社内OS「AMD OS」を引き継ぐえいみ。資本政策表は、全ての金額・株数を3桁ごとのカンマで読み、セル幅が狭くても自動算出金額を省略記号で隠さない。FD比率の棒と凡例は株主を即座に見分けられる色・外周・境界線を使うが、色に成功・警告・エラーの状態意味を持たせない。追加のUI変更や調査は、以下の正本を読んでから着手する。

## 最初に読む順

1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/HANDOFF.md
4. /Users/masa/projects/AMD/amd-os/AGENTS.md
5. /Users/masa/projects/AMD/amd-os/CLAUDE.md
6. /Users/masa/projects/AMD/amd-os/pwa/AGENTS.md
7. /Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md
8. /Users/masa/projects/AMD/amd-os/pwa/spec/3-8-cockpit-current-spec.md の `CapitalPlanMatrix` / `capital plan` 節
9. /Users/masa/projects/AMD/amd-os/pwa/design/FEATURE_REGISTRY.md の資本政策表可読性規約
10. /Users/masa/projects/AMD/amd-os/pwa/manual/2-3-pj-cockpit.md の「数値と株主識別の表示」
11. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md の `[pwa/capital-plan]` 項目
12. /Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-07.md の「資本政策表の金額可読性と株主構成の識別性」節

## 状態スナップショット

- canonical cwd / branch: `/Users/masa/projects/AMD/amd-os` / `main`。実装commitは `e58b1d89`（金額表記・省略解消）と `23055bed`（色識別）。handoff文書のcommitでHEADが進むため、開始時は必ず `git status -sb --untracked-files=all`、`git rev-parse HEAD`、`git rev-parse origin/main`、`git rev-list --left-right --count HEAD...origin/main`、`git worktree list --porcelain`、`curl -fsS https://amd-os-pwa.vercel.app/api/build-info` をread-onlyで取り直す。
- production UIは実装時点で `v3.52.4` / `23055bed` を確認済み。資本政策表はdesktopと390px幅で、金額の全額表示、棒と凡例の識別、ページ横あふれなし、表だけの意図した横スクロール、console error 0件を確認している。
- 変更箇所は `pwa/src/components/cockpit/CapitalPlanMatrix.tsx`。DB、API、保存形式、`capital-plan.ts` の計算、権限、migrationは変更していない。

## 次タスク

未解決の実装はない。まさから資本政策表について追加フィードバックが来たときだけ、production `/project/p21/cockpit?tab=business-plan` をdesktopと390px幅で確認し、何を読めるようにしたいかを画面上の対象セル・棒・凡例に対応付けてから直す。金額や株主名など判断に必要な値を `…` で隠さず、色を状態意味へ流用せず、モバイルで表を選択1イベント表示へ置き換えない。

## 確立済みの運用ルール

- main一本。branch/worktreeを新規作成しない。対象ファイルだけを明示stageし、`git add .` / `git add -A` は使わない。
- PWAコードまたはユーザー表示を変えるときは `pwa/src/lib/build-info.ts` をpatch bumpし、関連するspec・design・manual・changelog・BUGS・development design logを同じ変更単位で同期する。
- PWA本番反映は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` を使う。生の `git push` や `npx vercel` 直接deployは使わない。deploy後はVercel Readyとproduction `/api/build-info` のSHAを確認する。
- UI変更はDOMやlintだけで閉じず、ログイン済み実画面のdesktopとmobileで、初見で判断できること、意図しない横あふれとconsole errorがないことを確認する。
```
