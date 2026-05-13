# HANDOFF — AMD OS PWA

最終更新: 2026-05-14 (Cyber Dashboard 第2案 / Glass Cube Chamber)
詳細セッションログ: [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) 末尾「2026-05-14 — Cyber Dashboard 第2案 / Glass Cube Chamber」

---

## 最新セッション要約

- Cyber Dashboard 第2案として、既存3D Labを壊さず `CyberGlassCubeDashboard.tsx` を新規作成。
- route は `/mock/dashboard-cyber-glass-cube` と `/dashboard-cyber-glass-cube`。
- 中央に浮遊ガラスキューブPJ群、左右にKPI HUD、床に発光円盤/スキャンリング、背景に生成CanvasTextureを配置。
- `/mock/dashboard-cyber-glass-cube` を auth bypass に追加。
- `npm run build` 成功。local / production で `cube-face-label=6` / `glass-kpi-row=6` / `glass-hud-gauge=6` / `canvas=1` を確認。

## 前セッション要約

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
- new mock URL: `https://amd-os-pwa.vercel.app/mock/dashboard-cyber-glass-cube`
- latest production deployment: `https://amd-os-qo41584t7-armada0130.vercel.app`

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
- production deploy (Glass Cube):
  - deployment URL: `https://amd-os-qo41584t7-armada0130.vercel.app`
  - alias: `https://amd-os-pwa.vercel.app`
  - verified URL: `https://amd-os-pwa.vercel.app/mock/dashboard-cyber-glass-cube`
- production Playwright:
  - `title = 1`
  - `project-orb-label = 6`
  - `xfm-axis-label = 3`
  - `kpi-indicator-svg = 8`
  - CryoX click後 `cockpit-window = 1`
- production Browser (Glass Cube):
  - `cube-face-label = 6`
  - `glass-kpi-row = 6`
  - `glass-hud-gauge = 6`
  - `canvas = 1`

---

## Unresolved / Next

1. Glass Cube案をまさが見て、中央キューブ密度・左右KPI配置・背景生成テクスチャの方向性を判断する。
2. 既存3D Lab (`Cyber3DLab.tsx`) と第2案 (`CyberGlassCubeDashboard.tsx`) を別routeのまま比較する。
3. 次に進めるなら、キューブクリック時のPJ cockpit投影・メンバー/資金/介入レバーの追加HUDを実装する。

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
- 第2案実装: [`src/components/dashboard/CyberGlassCubeDashboard.tsx`](src/components/dashboard/CyberGlassCubeDashboard.tsx)
- routes:
  - `/mock/dashboard-cyber-3d-lab`
  - `/dashboard-cyber-3d-lab`
  - `/mock/dashboard-cyber-glass-cube`
  - `/dashboard-cyber-glass-cube`

---

## Deploy Command

PWA deploy は必ず通知付き script 経由。

```sh
bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh
```

内部で `npx vercel --prod --yes --archive=tgz --cwd /Users/masa/projects/AMD/amd-os` を使う。  
`--cwd .../pwa` は `pwa/pwa` 二重事故になるため禁止。
