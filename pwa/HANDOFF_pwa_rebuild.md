# HANDOFF — AMD OS PWA

最終更新: 2026-05-14 (Cyber Dashboard 3D Lab / XFM空間 + PJ球体化 + HUD品質ルール修正)
詳細セッションログ: [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) 末尾「2026-05-14 — Cyber Dashboard 3D Lab / XFM空間 + PJ球体化」

---

## 最新セッション要約

- Cyber Dashboard 3D Lab を、CSSカード中心から three.js の3D空間表現へ寄せた。
- PJカードは廃止し、各PJを X/F/M score に従う3D発光球体として配置。
- `x` = X、`y` = F、`z` = M の軸表示を追加。
- `Studio Core KPI` / `AMD Value Proof` はX-Y平面に倒した床面HUDとして配置。
- 球体クリック → 2回パルス → 球体上方へPJ cockpit投影、の流れに変更。
- 「主役かどうかではなく、このUIの品質を落とすCSSグラフィックは禁止」「発光/投影/レーザー/粒子はthree.js側」を設計ルール化。
- Vercel deploy の 15000 files 制限を踏んだため、正本deploy scriptに `--archive=tgz` を追加。

---

## Repo State

- canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- branch: `main`
- latest pushed feature commit: `7b571c7 Move cyber dashboard projects into XFM space`
- handoff/docs commit: this commit (`git log -1 --oneline` で確認)
- unpushed commits: なしにすること
- uncommitted files: なしにすること
- production alias: `https://amd-os-pwa.vercel.app`
- verified URL: `https://amd-os-pwa.vercel.app/mock/dashboard-cyber-3d-lab`

---

## Verification Done

```sh
cd /Users/masa/projects/AMD/amd-os/pwa
npm run build
```

- local Playwright: `http://localhost:3007/mock/dashboard-cyber-3d-lab`
  - `project-orb-label = 6`
  - old `.cyber3d-project-card = 0`
  - `kpi-indicator-svg = 8`
  - `xfm-axis-label = 3`
  - CryoX click後 `cockpit-window = 1`
- production deploy:
  - deployment: `dpl_AyrfeaqFYReZuDhUS7VkbDDLEJ6c`
  - alias: `https://amd-os-pwa.vercel.app`
- production Playwright:
  - `title = 1`
  - `project-orb-label = 6`
  - `xfm-axis-label = 3`
  - `kpi-indicator-svg = 8`
  - CryoX click後 `cockpit-window = 1`

---

## Unresolved / Next

1. まさが「別アイディアも形にしたい」と言っているので、次セッション冒頭で新案の方向性を聞く。
2. 現行3D Labは壊さず、別案は別URL/別componentで試す。
3. Cyber HUDを続ける場合は、`Cyber3DLab.tsx` のPJ球体/XFM軸/床面KPIを起点に、視覚密度とthree.jsエフェクトを上げる。

---

## First Next Action

1. `git fetch --all --prune && git status -s && git log --branches --not --remotes --oneline`
2. `pwa/design/README.md` → `pwa/design/cyber_hud_design_code.md` → `pwa/design/cyber_dashboard_content_design.md` → `pwa/BUGS.md` の順で読む。
3. `https://amd-os-pwa.vercel.app/mock/dashboard-cyber-3d-lab` を開き、現行到達点を目視する。
4. まさに「次の別アイディアはどの方向でモック化する？」と聞いてから、別routeで作る。

---

## Pointers

- HUD品質ルール: [`design/cyber_hud_design_code.md`](design/cyber_hud_design_code.md)
- ダッシュボード情報設計: [`design/cyber_dashboard_content_design.md`](design/cyber_dashboard_content_design.md)
- PWA仕様: [`design/SPEC_pwa.md`](design/SPEC_pwa.md)
- 設計md入口: [`design/README.md`](design/README.md)
- バグ/教訓: [`BUGS.md`](BUGS.md)
- 作業ログ: [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md)
- 実装: [`src/components/dashboard/Cyber3DLab.tsx`](src/components/dashboard/Cyber3DLab.tsx)
- routes:
  - `/mock/dashboard-cyber-3d-lab`
  - `/dashboard-cyber-3d-lab`

---

## Deploy Command

PWA deploy は必ず通知付き script 経由。

```sh
bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh
```

内部で `npx vercel --prod --yes --archive=tgz --cwd /Users/masa/projects/AMD/amd-os` を使う。  
`--cwd .../pwa` は `pwa/pwa` 二重事故になるため禁止。
