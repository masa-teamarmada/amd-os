# SESSION MIGRATION PROMPT - AMD OS Atlas/HUD handoff

```text
cd /Users/masa/projects/AMD/amd-os

まず `HANDOFF.md` を読んで。次に仕様正本として `pwa/design/atlas.md` を読み、そのあと `pwa/manual/4-2-atlas-macrotrend-signal-spec.md`、`pwa/manual/5-2-hud-and-venture-map-spec.md`、`pwa/BUGS.md`、`CLAUDE.md`、`AGENTS.md`、`pwa/CLAUDE.md` を読んで。

今回の current truth:
- Atlas 通常UIは HUD ではない。
- `/atlas` top の tag chip は色付き。dynamic Tailwind class 依存ではなく inline palette で表示する。
- `/atlas/map` は通常 Atlas の domain palette / readable label / non-HUD edge を使う。
- HUD glow / dark shell / cyan link / outlined label / monospace shell は `/hud/atlas/*` 側だけ。
- `amd-hud-page-skin` は shared `(app)` layout に置かない。HUD skin は `components/hud/HudShell.tsx` 配下の `/hud/*` route-local。
- 通常 `/atlas/macrotrends` は `/atlas/divergence` へ redirect。HUD 実験版は `/hud/atlas/macrotrends`。

作業開始前に必ず:
1. `git fetch origin main --prune`
2. `git status -sb --untracked-files=all`
3. `git log --left-right --oneline main...origin/main`
4. `curl -fsSL https://amd-os-pwa.vercel.app/api/build-info`
5. `git diff --name-status`

最初の一手:
1. production が handoff 時点の最新 version / commit / dirty=false になっているか確認する。
2. ログイン済みブラウザで `/atlas` -> `/atlas/map` reload -> `/dashboard` を確認し、HUD skin が通常 route に残らないことを見る。
3. Atlas/HUD の追加修正をする場合は、通常 route と `/hud/*` route の skin boundary を壊さない。

残っている別bundle dirty:
- notification stop / meeting flow / task notification WIP
- contract / monthly agreement docs WIP
- Admin/Kiyo WIP
- meeting-assets / project-label WIP
- H-1 prep outbox markdowns
- `gas-slack/.clasp.json` local artifact

守ること:
- AMD OS は main 一本。BUILD_VERSIONを巻き戻さない。
- PWA deploy が必要なら `.vercel/project.json` が `amd-os-pwa / prj_raZW3HSKIszzPUwNTHfy7xDGzLHm` であることを確認し、`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` を使う。
- `git add .` は絶対に使わない。選んだ bundle のファイルだけ個別 stage。
- shared parent layout に広域 visual skin を載せない。
```
