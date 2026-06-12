# Sessions Log — 2026-05 (AMD OS PWA) — Part 2 (05-14〜05-22)

PWA セッション作業ログ (月内分割 part2)。索引・最新分は `sessions_2026-05.md` 参照。仕様 `SPEC_pwa.md` / バグ `BUGS.md` / 引き継ぎ `HANDOFF_pwa_rebuild.md`。

---

## 2026-05-14 — Cyber Dashboard 3D Lab / XFM空間 + PJ球体化

#### きっかけ
まさが PWA ダッシュボードを「3D宇宙空間にWebサイトが浮かぶ」方向へ育てたいと要望。
途中で「CSSで頑張り続けるとゴールに辿り着かない」と明確に指摘があり、HUD系デザインの判断ルールも md 化した。

#### 実装したこと

- `/mock/dashboard-cyber-3d-lab` と `/dashboard-cyber-3d-lab` の3D Labを継続改修。
- `src/components/dashboard/Cyber3DLab.tsx`
  - PJカード表示を廃止し、各PJを X/F/M score に従って3D空間上の発光球体として配置。
  - world `x` = X、world `y` = F、world `z` = M の軸表示を追加。
  - `Studio Core KPI` / `AMD Value Proof` をX-Y平面に倒した床面HUDとして配置。
  - 球体クリック → 2回パルス → 球体上方へPJ cockpit投影、の流れに変更。
  - 発光球体、リング、投影面、レーザーは three.js geometry/material/light を正本にした。
- `pwa/design/cyber_hud_design_code.md`
  - 「主役だけ」ではなく、このUIの品質を落とすCSSグラフィックは禁止、と明文化。
  - 発光/投影/レーザー/粒子/空間スキャンは three.js 側で作るルールを追加。
- `pwa/design/cyber_dashboard_content_design.md`
  - KPI/AMD Value Proof の情報設計と、現行3D Lab実装の位置付けを追記。
- `pwa/design/README.md` / `pwa/design/SPEC_pwa.md`
  - Cyber Dashboard / HUD 設計mdへの導線と route 説明を追加。
- `pwa/scripts/deploy.sh`
  - Vercel upload の 15000 files 制限回避のため `--archive=tgz` を追加。

#### 途中で捨てた/修正したアプローチ

- CSSカードを3D空間に貼る方向は破棄。まさの要求レベルでは「カードを奥に置いた風」では足りず、PJ表現自体をthree.jsオブジェクト化する必要があった。
- CSSの `box-shadow` / `drop-shadow` で投影光やレーザーを合わせる方向は破棄。カメラを回した時に角/接続がズレるため、three.js座標で管理する。
- 旧カード投影用 `ProjectionBeam` / `ProjectCard` / `HudInfoPanel` は削除。次回CSSカードへ戻らないため。

#### Verification

- `npm run build` 成功。
- local Browser:
  - URL: `http://localhost:3007/mock/dashboard-cyber-hud-wall`
  - `canvas = 1`
  - `cyber-hud-wall = 1`
  - CX module click後、右下の `SELECTED MODULE` が `CRYOX` に切り替わることを目視確認。
- production deploy:
  - deployment URL: `https://amd-os-adtarl839-armada0130.vercel.app`
  - alias: `https://amd-os-pwa.vercel.app`
- production Browser:
  - URL: `https://amd-os-pwa.vercel.app/mock/dashboard-cyber-hud-wall`
  - `canvas = 1`
  - `cyber-hud-wall = 1`
  - CX module click後、右下の `SELECTED MODULE` が `CRYOX` に切り替わることを目視確認。
  - console error = 0

#### まさレビュー後の追加修正

- カードがふわふわ動くとHUD感が下がるため、PJ/KPI/Alert/Ticker/Selectedパネルの位置移動を停止。
- PJカードのフレーム画像をCanvasTexture内で高密度化。
  - 切り欠き外形
  - 内部回路線
  - コーナーノード
  - 上下の端子バー
  - 右側のバーコード状ディテール
- 中央レーダーは意味を持たせにくいため廃止。
- 代わりに `VALUE CONVERSION CORE` を配置。
  - `INPUT SIGNAL`
  - `AMD INTERVENTION`
  - `VALUE PROOF`
  を選択PJごとに接続して表示する。
- local Browserで固定カード / 高密度PJフレーム / `VALUE CONVERSION CORE` / CX click後 `CRYOX` 切替を確認。
- production deploy:
  - deployment URL: `https://amd-os-68eu9c09c-armada0130.vercel.app`
  - alias: `https://amd-os-pwa.vercel.app`
- production Browser:
  - URL: `https://amd-os-pwa.vercel.app/mock/dashboard-cyber-hud-wall`
  - `canvas = 1`
  - `cyber-hud-wall = 1`
  - CX module click後、右下の `SELECTED MODULE` が `CRYOX` に切り替わることを目視確認。
  - 固定カード / 高密度PJフレーム / `VALUE CONVERSION CORE` 表示確認。
  - console error = 0

#### まさレビュー後の追加修正 2

- PJカード外側の細いthree.jsフレームを削除。
- CanvasTexture内の水色フレームを太くし、白い芯線 + シアン発光 + 太い外光の3層へ変更。
- 横ライン背景をパネル形状でclipし、枠外にはみ出ないよう修正。
- 中央Value Flow裏のパルスリングを削除。
- KPIの回転リングを廃止。静的な分割リング + segmented load bar のHUDインジケーターへ変更。
- `useFrame` 検索でHUD Wall内のふわふわ/回転表現が消えていることを確認。
- local BrowserでPJカード枠、KPIインジケーター、console error = 0を確認。
- production deploy:
  - deployment URL: `https://amd-os-i1we0o4y2-armada0130.vercel.app`
  - alias: `https://amd-os-pwa.vercel.app`
- production Browser:
  - URL: `https://amd-os-pwa.vercel.app/mock/dashboard-cyber-hud-wall`
  - `canvas = 1`
  - `cyber-hud-wall = 1`
  - CX module click後、右下の `SELECTED MODULE` が `CRYOX` に切り替わることを目視確認。
  - PJ外側thin frame削除 / 太い水色フレーム / KPI静的HUDインジケーター表示確認。
  - console error = 0
- Playwright local:
  - URL: `http://localhost:3007/mock/dashboard-cyber-3d-lab`
  - `project-orb-label = 6`
  - old `.cyber3d-project-card = 0`
  - `kpi-indicator-svg = 8`
  - `xfm-axis-label = 3`
  - CryoX click 後 `cockpit-window = 1`
- Vercel production deploy:
  - deployment: `dpl_AyrfeaqFYReZuDhUS7VkbDDLEJ6c`
  - alias: `https://amd-os-pwa.vercel.app`
  - URL: `https://amd-os-pwa.vercel.app/mock/dashboard-cyber-3d-lab`
- Playwright production:
  - `title = 1`
  - `project-orb-label = 6`
  - `xfm-axis-label = 3`
  - `kpi-indicator-svg = 8`
  - CryoX click 後 `cockpit-window = 1`

#### Commits

- `3cb5cd0` — Codify HUD graphic fidelity rules
- `7b571c7` — Move cyber dashboard projects into XFM space

#### 次回メモ

- まさは「別アイディアも形にしたい」と言っているので、次セッション冒頭は実装を続ける前に別案の方向性を聞く。
- Cyber HUD を続ける場合は、既存 `Cyber3DLab.tsx` を壊さず、別 URL / 別 component で新案を作るのが安全。
- このUIでは、クオリティを落とすCSSグラフィックは作らない。発光・投影・レーザー・粒子・3D配置は three.js 側で実装判断する。

---

## 2026-05-14 — Cyber Dashboard 第2案 / Glass Cube Chamber

#### きっかけ
まさが添付画像ベースで、参考画像のようなHUD空間の中央にガラス状キューブを複数浮かべ、左右の空きスペースにKPIインジケーターを置く第2案を要望。
既存XFM球体版は壊さず、別route / 別componentで比較できる形にした。

#### 実装したこと

- `src/components/dashboard/CyberGlassCubeDashboard.tsx`
  - 中央に浮遊ガラスキューブPJ群を配置。
  - 初版はCSS/HTMLラベルやパネルのオブジェクト感が残っていたため、まさ指摘を受けて破棄。
  - PJ code / PJ名 / XFM指標はCanvasTextureに焼き、キューブ表面にthree.js planeとして貼る形へ変更。
  - 床面に発光円盤、放射線、スキャンリングをthree.js geometryで実装。全面グリッドは参考画像に合わせて削除。
  - 背景HUD、KPI数値、選択中PJ表示はcomponent内でCanvasTexture生成。
  - 左に `Studio Core KPI`、右に `AMD Value Proof` のHUDパネルを配置。フレーム/リング/線はthree.js geometry。
  - 初期表示の読みやすさを優先し、OrbitControlsのautoRotateはOFF。
  - まさ指摘 #2 を受け、床面HUDを再分解:
    - 中心核を白い強グロー + pointLight に変更。
    - リング中心を単一原点に統一。
    - 太い分割アーク + 中心寄り細リングへ整理。
    - 96本放射線を廃止し、少数の接続回路ライン + 発光ノードへ変更。
- route追加:
  - `/mock/dashboard-cyber-glass-cube`
  - `/dashboard-cyber-glass-cube`
- `src/lib/supabase/middleware.ts`
  - 公開モック確認用に `/mock/dashboard-cyber-glass-cube` をauth bypassへ追加。
- 設計docs:
  - `design/SPEC_pwa.md` にroute説明を追加。
  - `design/cyber_dashboard_content_design.md` にGlass Cube variantを追記。
  - `HANDOFF_pwa_rebuild.md` を次回入口へ更新。

#### Verification

- `npm run build` 成功。
- local Browser:
  - URL: `http://localhost:3007/mock/dashboard-cyber-glass-cube`
  - `cube-face-label = 6`
  - `glass-kpi-row = 6`
  - `glass-hud-gauge = 6`
  - `canvas = 1`
- production deploy:
  - deployment URL: `https://amd-os-qo41584t7-armada0130.vercel.app`
  - alias: `https://amd-os-pwa.vercel.app`
- production Browser:
  - URL: `https://amd-os-pwa.vercel.app/mock/dashboard-cyber-glass-cube`
  - `cube-face-label = 6`
  - `glass-kpi-row = 6`
  - `glass-hud-gauge = 6`
  - `canvas = 1`

---

## 2026-05-14 — Cyber Dashboard 第2案やり直し / HUD Tactical Wall

#### きっかけ
まさレビューで Glass Cube 案は「全然ダメ」「3D感は欲しいが、glass cubeみたいになるとカオス」と判断。
前の案を引きずらず、別route / 別componentでゼロから作り直す方針になった。

#### 方針

- 視点は固定。OrbitControlsで回すUIにしない。
- 3D感は、カメラではなくHUDコンポーネントの奥行き、重なり、空間レイヤーで出す。カード本体のふわふわ移動は使わない。
- 参考画像のようなHUDコンポーネント密度を重視する。
- キューブ/物体中心ではなく、PJ/KPI/Proof/AlertをHUDモジュールとして並べる。
- CSSでHUDオブジェクトを作らない。CSSはcanvas土台だけにし、HUDパネル/ゲージ/レール/フレーム/発光は three.js geometry / CanvasTexture 側で作る。

#### 実装したこと

- `src/components/dashboard/CyberHudWallDashboard.tsx` を新規作成。
  - 固定カメラの `HUD Tactical Wall`。
  - 背景はCanvasTextureで高密度HUD回路を生成。
  - PJはCanvasTexture化した高密度HUDモジュールとして表示。
  - `Studio Core KPI` / `AMD Value Proof` / `SYS_STATUS` / `NEXT ACTIONS` / `SELECTED MODULE` をHUDパネル化。
  - リングゲージ、progress rail、分割バー、選択bracket、奥行きrailはthree.js geometryで実装。
  - 各HUDパネルは空間レイヤーに固定配置。`useFrame`由来のふわふわ/回転は除去。
  - PJクリック時は別ページへ遷移せず、同一3D空間内に `PJ Cockpit Spatial View` を展開。
  - `PJ Cockpit Spatial View` は既存PJコックピットの内容に合わせ、`PJ Status` / `MS & Goals` / `Monthly` / `Actions` / `Routine` をCanvasTexture + three.js connectorで表示。
  - 一時的に入れた `ATLAS` / `COCKPIT` / `MONTHLY` のOS Portal案は撤回。AtlasはPJごとのコンテンツではなくAMD OS全体の外部環境・判断地図として扱う。
- route追加:
  - `/mock/dashboard-cyber-hud-wall`
  - `/dashboard-cyber-hud-wall`
- `src/lib/supabase/middleware.ts`
  - `/mock/dashboard-cyber-hud-wall` をauth bypassへ追加。
- 設計docs:
  - `design/SPEC_pwa.md` にHUD Tactical Wall routeを追加。
  - `design/cyber_dashboard_content_design.md` にGlass Cube廃案判断とHUD Tactical Wall仕様を追記。
  - `HANDOFF_pwa_rebuild.md` を次回入口へ更新。

#### Verification

- `npm run build` 成功。
- local Browser:
  - URL: `http://localhost:3007/mock/dashboard-cyber-hud-wall`
  - `canvas = 1`
  - CX module click後、同一3D空間内に `PJ COCKPIT SPATIAL VIEW` / `PJ STATUS` / `MS / GOALS` / `MONTHLY` / `ACTIONS` / `ROUTINE` 表示確認
  - `OVERVIEW` パネルクリックでoverview復帰確認
  - console error = 0
- production deploy:
  - deployment URL: `https://amd-os-miewd41e5-armada0130.vercel.app`
  - alias: `https://amd-os-pwa.vercel.app`
- production Browser:
  - URL: `https://amd-os-pwa.vercel.app/mock/dashboard-cyber-hud-wall`
  - `canvas = 1`
  - CX module click後、PJ Cockpit Spatial View表示確認
  - console error = 0

#### 追加調整: PJ Focus readability / overlap pass

まさレビューで「PJ項目の中身をもっと移植」「背面カードの重なりを沈める」「focusフレームを強くする」「背景を端まで」「文字が小さい」と指摘。

- `CyberHudWallDashboard.tsx`
  - PJ Focus中は global `SYS_STATUS` / `STUDIO CORE KPI` / `AMD VALUE PROOF` / `NEXT ACTIONS` を非表示にし、PJ cockpitの前景レイヤーを優先。
  - 背面PJカードはselected含めてdim。前景cockpitカード群の背後にthree.js planeの遮蔽プレートを入れ、重なり部分を暗く沈める。
  - `PJ STATUS` / `MS / GOALS` / `MONTHLY` / `ACTIONS` / `ROUTINE` の行数を増やし、既存PJ cockpit側の要素 (Status / MS / 月次 / Kanban/Nudge / Routine) へ寄せた。
  - Focusフレームは従来のlineSegmentsだけでなく、three.js box geometryの太い発光バーを追加。
  - Focus / dock CanvasTextureの解像度と文字サイズを上げ、背景HUD textureを画面端まで伸ばした。
- local verification:
  - `npm run build` 成功。
  - `http://localhost:3007/mock/dashboard-cyber-hud-wall` をPlaywright/Chromeで確認。
  - focus screenshot: `/tmp/amd-hud-wall-focus-local-2.png`
  - console error = 0
- production deploy:
  - deployment URL: `https://amd-os-p57e4z2w5-armada0130.vercel.app`
  - alias: `https://amd-os-pwa.vercel.app`
- production verification:
  - URL: `https://amd-os-pwa.vercel.app/mock/dashboard-cyber-hud-wall`
  - focus screenshot: `/tmp/amd-hud-wall-focus-prod.png`
  - canvas = 1 / console error = 0

#### 追加調整: frame quality / dock interaction rebuild

まさレビューで「フレームUIをサボっている」「直線オブジェクトを適当につないだだけ」「接点処理がない」「背景が枠と無関係」「dockをクリックしても何も動かない」「遮蔽したと言いながら後ろの文字が透けている」と指摘。

- `CyberHudWallDashboard.tsx`
  - Focus/dock `TexturePanel` にNormal blendingを追加。前景cockpitは加算合成ではなくNormal blendingで貼り、黒い背景面が背面文字を遮蔽するよう変更。
  - `fillPanelBase`を作り直し。厚い外周グロー、白芯線、接点プレート、内部回路レール、下部接続レールをCanvasTexture内で一体描画。
  - 外付けの太いbox frame依存をFocus/dockから撤去し、フレームをパネル自体の造形へ寄せた。
  - `FocusDock` stateを追加し、`PJ STATUS` / `MS / GOALS` / `MONTHLY` / `ACTIONS` / `ROUTINE` の各dockクリックで中央cockpit内容が切り替わるよう実装。
  - Focus背面は硬い黒矩形ではなく、CanvasTextureのradial veilで沈めるよう変更。
- verification:
  - `npm run build` 成功。

#### 追加実装: HUD dashboard fidelity follow-up / member action data / routine icons

- まさ追加レビュー:
  1. 左上version textがまだframeからはみ出す。
  3. PJ略称部分が「frame内frame」ではなく別frameになっている。bar間隔もさらに狭く、Fがframeと被らないように。
  5. 右上属性cardのfont拡大、frame線と文字の重なり解消。
  6-7. Macrotrend設計mdを日本語化してから評価。
  10. PJ row内sparklineをdummyではなくAMDスコアgraphへ。
  11. non active PJをactive下のtoggleに折りたたむ。
  12. KPI sub indicatorをmain indicatorへ近づけ、HUDの無駄空間を削減。
  13. PJ親frameの連続hatch削除、子frame上hatch削除、下hatch低明度化。
  14. Next Action Queueをログインmemberの実taskへ。
  15. 月次routine各taskにHUD icon画像を生成・配置。
- `HudControlCenterDashboard`:
  - brand frameをさらに縮小し、subtitle/versionのline-heightを圧縮。
  - Project row SVGを再設計し、左略称bayを親row内のchamberとして描画。
  - bar間隔を `space-y-0`、bar heightを5pxへ調整。
  - 親ProjectBoard hatchを削除、row上hatchを削除、row下hatchを低明度化。
  - `scoreHistory` propを追加し、PJ row sparklineをAMDスコア系列へ差し替え。
  - active PJを先頭表示、non active PJをtoggle配下へ折りたたみ。
  - KPI mini ringsを小型化してmain ringへ近づけた。
  - right user mini cardsのfontを拡大し、線と文字の重なりを除去。
- `/hud/dashboard` page:
  - `fetchAllAmdScoreInputs` + `fetchActiveAlpha` + `computeCockpitAmdScoreSeries` でPJ別score historyを生成。
  - `tasks.assignee` がログインmemberに一致するopen taskと、`member_app_notifications` 未読をNext Action Queueへ渡す。
- `macrotrend_atlas_seeds_architecture.md`:
  - 英語版を削除し、日本語版へ全面置換。
- `HudCockpitRoutineGas`:
  - step idごとに `/hud/routine-icons/*.svg` を表示。
  - 追加icon: budget / meeting / report / reimburse / invoice / send。
- verification:
  - `npm run build` 成功。
  - local `http://localhost:3010/hud/dashboard/embed?debug=1` をChrome headlessでscreenshotし、frame/row/hatch/KPI配置を確認。

#### 追加実装: Macrotrend page + HUD frame thinning follow-up

- まさ追加レビュー2:
  - PJ rowは「閉じた子フレーム」の中に「略称用の内側フレーム」がある形がモック正。
  - Macrotrend設計方針OKなので実装。
  - KPI mini ringsは小さくせず元サイズ、main indicatorへ近づける。意味不明な横線は削除。
  - row hatchは5個に減らす。
  - Next Action Queueの右 `P2` を `◯月度` へ。titleはtask名だけ。左objectはPJ略称frameへ。
  - 主要frameはもっと細く、かすれ気味に。
- `HudControlCenterDashboard`:
  - Project row outer frameを閉じたrow frameへ変更し、左略称は `InitialsBayFrameSvg` のinner frameとして内包。
  - row hatchを5個へ削減。
  - KPI mini ringを元の16サイズへ戻し、section内では `-mt-8` でmain indicatorへ寄せた。
  - `KpiPanelFrameSvg` の補助横線を削除。
  - `KpiPanelFrameSvg` / `ProjectBoardFrameSvg` / `QueueBoardFrameSvg` のstroke幅とopacityを落とし、strokeDasharrayでかすれ感を付与。
  - `ActionQueueItem` の左アイコンを廃止し、PJ略称inner frameへ差し替え。右表示はpriorityではなく `periodLabel`。
- Macrotrend実装:
  - `/atlas/macrotrends` を追加。
  - `/hud/atlas/macrotrends` を追加。
  - 既存 `atlas_stories` / `atlas_signals` / `atlas_divergences` / `seeds` を、世界課題クラスターにキーワード紐付けして包含表示。
  - Atlas topに `Macrotrend` 導線を追加し、`トレンド` 表記を `差分` へ変更。
  - Seeds topに `Macrotrend別` 導線を追加。
- verification:
  - `npm run build` 成功。
  - local `http://localhost:3010/hud/dashboard/embed?debug=1` をChrome headlessでscreenshotし、閉じたrow frame / inner acronym frame / 5 hatches / thin faded frameを確認。
- production deploy:
  - alias: `https://amd-os-pwa.vercel.app`
  - inspect-only deployment URL: `https://amd-os-jwpl25zu9-armada0130.vercel.app`
- production verification:
  - `/venture-map/amd-score/p20` は未ログイン時 `/auth/login?next=%2Fventure-map%2Famd-score%2Fp20` へredirect。
  - production bundleに `Score Scope` / `M/X/F Signal Stack` / `lg:grid-cols-[minmax(0,1fr)_340px]` が含まれることを確認。
- production deploy:
  - alias: `https://amd-os-pwa.vercel.app`
  - inspect-only deployment URL: `https://amd-os-b6ssl6st2-armada0130.vercel.app`
- production verification:
  - `/venture-map/amd-score/p20` は未ログイン時 `/auth/login?next=%2Fventure-map%2Famd-score%2Fp20` へredirect。
  - ログイン済みChromeで `https://amd-os-pwa.vercel.app/venture-map/amd-score/p20?v=20260516-hud-pass` を開き、M/X/F HUD bars と neon formula panel の反映を確認。

#### 追加実装: AMD Score graph layout / signal stack pass

- まさレビューで「棒グラフがHUDからかけ離れている」「上の折れ線グラフも大きすぎて見えにくい」「折れ線グラフの右に棒グラフを持ってきて」と指摘。
- `AmdScoreView`:
  - `TimeSeriesChart` と `BalanceBar` を同一gridに統合し、desktopでは左に小型score scope、右にM/X/F signal stackを配置。
  - 折れ線グラフのviewBoxを `800x220` -> `640x178` に縮小し、panel heightも右側計器と揃えた。
  - `M / X / F Balance Vector` を横長progress barから、斜めframe + axis bay + 18個の短尺signal cell + scan marker + percentに変更。
  - まだ完全にHUD reference品質ではないため、`M/X/Fが横棒グラフに見えすぎる` は `一部達成` として継続管理。
- verification:
  - `npm run build` 成功。
- production deploy:
  - deployment URL: `https://amd-os-cmo538xke-armada0130.vercel.app`
  - alias: `https://amd-os-pwa.vercel.app`
- production verification:
  - `/hud/dashboard` -> `/auth/login?next=%2Fhud%2Fdashboard` (未ログイン時redirect確認)

#### 追加実装: Dashboard density / element-level delta pass

まさレビューで「全体的にスカスカ」「1要素ずつ分解して違いを比較し、違うなら修正」と指摘。

- Project Signal Board:
  - 表示PJ数をmock同様5件に固定。
  - board height / row height / row gapを詰め、密度を上げた。
  - title colorをwhite寄りからmockのcyanへ修正。
  - Project row frameを再調整:
    - left abbreviation bayをhex/chamfer形状へ寄せた。
    - right FILE tabをmock寄りの薄いcyan tabへ変更。
    - row内のhatchを破線strokeではなく平行四辺形polygon連続に変更。
    - inner vertical line / top-bottom lineを細く調整。
  - Project name / subtitle / metric bar / sparklineのサイズを詰めた。
- Alert:
  - min-height / paddingを縮小し、mockの横長alert moduleに近づけた。
  - frame line widthを細くし、赤色を `#ff3347` / `#ff5f6d` 系に統一。
  - `SYSTEM ALERT` / `n件のアラート` / リスク行のfont sizeと色をmock寄りに調整。
  - warning triangleのstroke width / sizeを縮小。
  - VIEW buttonを赤frame・赤文字へ修正。
  - bottom hatchを破線strokeではなく平行四辺形polygon連続へ変更。
- verification:
  - `npm run build` 成功。

#### 追加実装: Dashboard mock-only correction pass

まさレビューで「参照モックは `dashboard_hud.png` の1枚のみ」「アラート以外も乖離している項目を抽出して、モック画像の通りに修正」と指摘。

- reference rule:
  - 今後のdashboard visual fidelityは repo root の `dashboard_hud.png` のみを参照する。
  - 過去の赤い円形alert HUDのような別方向の連想は禁止。
- extracted deltas:
  - Alert: 円形HUDではなく、横長チャンファー矩形 / 左alert icon bay / 中央件数 / 右VIEW / 下部red hatch。
  - Project rows: VC矩形ではなく、左hex ID bay / 右FILE tab / 横長segmented row / 中央下hatch。
  - Next Action rows: icon bay / right FILE tab / priority right alignmentのfile card。
  - KPI: 左大型ringが主役。panel frameは薄いcyan、ringとsub indicatorsの密度を戻す。
- implementation:
  - `AlertFrameSvg` を横長チャンファー矩形へ作り直し、中央ring/arc要素を全削除。
  - `ProjectRowFrameSvg` を追加し、project rowをmockのfile row構造へ変更。
  - `QueueItemFrameSvg` を追加し、next action rowをmockのfile card構造へ変更。
  - `KpiPanelFrameSvg` / `ProjectBoardFrameSvg` / `QueueBoardFrameSvg` を追加し、各大枠をmockに合わせた薄いpanelへ変更。
- verification:
  - `npm run build` 成功。
- deploy hygiene:
  - repo root deploy archiveに `.claude/worktrees` / `node_modules` / `.next/dev` が混ざらないよう `.vercelignore` を追加。
  - これによりupload sizeが約781MB級から46.1MBへ減少。
- production deploy:
  - deployment URL: `https://amd-os-nleq6s7w6-armada0130.vercel.app`
  - alias: `https://amd-os-pwa.vercel.app`
- production verification:
  - `/hud/dashboard` -> `/auth/login?next=%2Fhud%2Fdashboard`
  - `/hud/control-center-rail-backplate-v2.png` -> 200

#### 追加実装: Dashboard frame unification pass

まさレビューで「KPI / Project / Queue のframeはVCと同じにして、すべてのframeを統一」「KPIサブ項目が下にはみ出る」「Alert frameがモックと違う」と指摘。

- Normal HUD frames:
  - `HudPanel` / `ProjectSignalRow` / `ActionQueueItem` / footer をVC系の薄いrectangular frame (`VcPanelSvg`) に統一。
  - Studio / Project / Queue 用に作った個別frameは使用しない方針へ変更。
- Studio Core KPI:
  - ring max widthを縮小し、top marginを詰めた。
  - sub indicatorを小型化し、grid margin/gapを詰めてpanel内に収める。
- Alert:
  - 通常panelとは別のred alert layerとして、赤モックの左右arc / central ring / top-bottom ticksを持つframeへ変更。
- verification:
  - `npm run build` 成功。
- production deploy:
  - deployment URL: `https://amd-os-pttih1s13-armada0130.vercel.app`
  - alias: `https://amd-os-pwa.vercel.app`
- production verification:
  - `/hud/dashboard` -> `/auth/login?next=%2Fhud%2Fdashboard`
  - `/hud/control-center-rail-backplate-v2.png` -> 200
  - `/hud/project-row-frame-v1.png` -> 200

#### 追加実装: Dashboard mock fidelity correction

まさレビューで「top railが横に引き伸ばされている」「モックよりコンテンツが減っている」「左右フレームは画像埋め込みではなくcodeで作る」と指摘。

- top control rail:
  - 中央rail画像を `h-full w-full` で引き伸ばす実装を廃止。
  - 中央decorative railは `object-contain` で縦横比を維持。
  - 左AMD OS frameをcode描画に変更し、version `v2.6.0 HUD` を表示。
  - 右user/status frameをcode描画に変更し、ログインユーザーの `code_name` / `member_id` / 現在時刻 / online status を表示。
- Studio Core KPI:
  - モックの左大型control moduleに寄せた専用frameへ変更。
  - 大型indicatorを「総合ポイント」に変更。現時点ではdummy score、下段小indicatorは先手力 / 工数 / 収支 / 営業。
- panel frames:
  - Project Signal Board / Next Action Queue / Alert に専用frame SVGを追加。
  - generic chamfer frameより、モックの細い外枠・弱い角アクセント・scanline密度に寄せた。
- verification:
  - `npm run build` 成功。

#### 追加修正: HUD背景事故修正 / Atlas・Seeds・VC・Retrofit HUD route

まさレビューで「背景の四角の連続がキモい」「一部オブジェクトが白背景」「retrofit / atlas / seeds / vc もHUD化」「スコア詳細をもっとHUDらしく」と指摘。

- 背景修正:
  - `HudCockpitView` / `HudShell` / `AmdScoreView` のbackground-sizeを修正。
  - radial glowがgrid単位で反復していた事故を解消。
  - square gridではなく、薄い水平scanline + sparse vertical guideに変更。
- 共通HUD skin:
  - `src/app/globals.css` に `amd-hud-page-skin` を追加。
  - Atlas / Seeds / VC / AMD Score / Retrofit の既存UIを、現行ロジックを保ったまま暗色HUD skinで包む。
- HUD route:
  - `/hud/atlas`
  - `/hud/seeds`
  - `/hud/vcs`
  - `/hud/venture-map/amd-score/retrofit`
  - いずれもDB/API/実装は現行routeと共有し、HUD配下から開ける。
- `HudShell`:
  - navに Seeds / VC / Score Retrofit を追加。
- AMD Score detail:
  - score heroを発光HUD object化。
  - M/X/F detail cardのinline白背景を撤去し、暗色surface + cyan/pink borderに変更。
  - detail rowのhover/total/bottleneck色をHUD向けに変更。
- verification:
  - `npm run build` 成功。
  - route一覧に `/hud/atlas`, `/hud/seeds`, `/hud/vcs`, `/hud/venture-map/amd-score/retrofit` 表示。
- production deploy:
  - deployment URL: `https://amd-os-kjz79jpl3-armada0130.vercel.app`
  - alias: `https://amd-os-pwa.vercel.app`
- production verification:
  - `/hud/dashboard` -> `/auth/login?next=%2Fhud%2Fdashboard`
  - `/hud/atlas` -> `/auth/login?next=%2Fhud%2Fatlas`
  - `/hud/seeds` -> `/auth/login?next=%2Fhud%2Fseeds`
  - `/hud/vcs` -> `/auth/login?next=%2Fhud%2Fvcs`
  - `/hud/venture-map/amd-score/retrofit` -> `/auth/login?next=%2Fhud%2Fventure-map%2Famd-score%2Fretrofit`

#### 追加修正: HUD nav重複解消 / Atlas周辺route / Mカード白抜け

まさレビューで「Mの白抜けが残っている」「現行メニューとHUDメニューが重複」「Atlas map/trendもHUD化忘れ」「分野とタグがHUDから遠い」と指摘。

- `/hud` 配下では現行 `GlobalNav` を非表示にし、HUD shell navのみ表示。
- `TripleHelixMatrix`
  - μカード、σ_SU、M、C行列、coverage noteの白surfaceを暗色HUD surfaceへ変更。
  - code / inline backgroundの白抜けは `amd-hud-page-skin` 側でも上書き。
- Atlas
  - 分野 / タグ filter chipを丸いカラーチップから、暗色HUD line chipへ変更。
  - `/hud/atlas` から Map / Trend / Decisions / Inbox / Admin へ遷移しても `/hud/atlas/...` を維持するようにリンクを修正。
- 追加HUD routes:
  - `/hud/atlas/map`
  - `/hud/atlas/divergence`
  - `/hud/atlas/decisions`
  - `/hud/atlas/inbox`
  - `/hud/atlas/inbox/submit`
  - `/hud/atlas/admin/themes`
  - `/hud/seeds/[id]`
  - `/hud/seeds/inbox`
  - `/hud/vcs/[id]`
  - `/hud/vcs/[id]/edit`
  - `/hud/vcs/inbox`
- Seeds/VCのlist/detail/inbox戻り導線もHUD配下では `/hud/seeds` / `/hud/vcs` を維持。
- verification:
  - `npm run build` 成功。
  - route一覧は114 pages。
- production deploy:
  - deployment URL: `https://amd-os-hcxvlq1w3-armada0130.vercel.app`
  - alias: `https://amd-os-pwa.vercel.app`
- production verification:
  - `/hud/dashboard` -> `/auth/login?next=%2Fhud%2Fdashboard`
  - `/hud/atlas/map` -> `/auth/login?next=%2Fhud%2Fatlas%2Fmap`
  - `/hud/atlas/divergence` -> `/auth/login?next=%2Fhud%2Fatlas%2Fdivergence`
  - `/hud/seeds/inbox` -> `/auth/login?next=%2Fhud%2Fseeds%2Finbox`
  - `/hud/vcs/inbox` -> `/auth/login?next=%2Fhud%2Fvcs%2Finbox`
- production deploy:
  - deployment URL: `https://amd-os-44aviz20z-armada0130.vercel.app`
  - alias: `https://amd-os-pwa.vercel.app`
- production verification:
  - `/hud/dashboard` -> `/auth/login?next=%2Fhud%2Fdashboard`
  - `/hud/project/p25/cockpit?ym=202605` -> `/auth/login?...next=%2Fhud%2Fproject%2Fp25%2Fcockpit%3Fym%3D202605`
  - `/venture-map/amd-score/p25` -> `/auth/login?next=%2Fventure-map%2Famd-score%2Fp25`

#### 追加調整: HUD cockpit color / Monthly modal / AMD Score detail

まさレビューで「コックピット背景が白」「月次モーダルもHUD化」「AMDスコアのグラフと詳細ページを一番かっこよく」「AMDスコアクリックで直接詳細へ」と指摘。

- `src/components/hud/HudCockpitView.tsx`
  - HUD cockpit clone bodyの白背景を撤去し、暗色grid + cyan/pink glowへ変更。
  - 過去MS期間・警告・凍結/再開badgeなど、残っていた白/薄色surfaceをHUD色へ寄せた。
- `src/components/hud/HudCockpitMonthlyModal.tsx`
  - 新規追加。
  - 現行 `CockpitMonthlyModal` をそのまま利用し、請求月変更・月次保存・進捗保存などの機能を落とさず、Dialog/surface/input/tableをHUD化するglobal wrapper。
- `src/components/hud/HudCockpitVentureStatus.tsx`
  - AMD Score graphをcyan発光line / signal fill / HUD score pillへ更新。
  - グラフ本体と最新score pillのクリック先を `/venture-map/amd-score/[projectId]` に変更。
- `src/components/venture-map/AmdScoreView.tsx`
  - AMD Score detail pageを暗色HUD shellへ変更。
  - 経時グラフを発光line / fill / HUD popupへ更新。
- verification:
  - `npm run build` 成功。
- production deploy:
  - deployment URL: `https://amd-os-pxa07t255-armada0130.vercel.app`
  - alias: `https://amd-os-pwa.vercel.app`
- production deploy:
  - deployment URL: `https://amd-os-ei31xa9zk-armada0130.vercel.app`
  - alias: `https://amd-os-pwa.vercel.app`
- production deploy:
  - deployment URL: `https://amd-os-60xv4810y-armada0130.vercel.app`
  - alias: `https://amd-os-pwa.vercel.app`
- production deploy:
  - deployment URL: `https://amd-os-axmlj8kn0-armada0130.vercel.app`
  - alias: `https://amd-os-pwa.vercel.app`

#### 追加実装: HUD Cockpit component migration pass 1

まさレビューで「次からはじゃなくてどんどん進めて」と指摘。

- 現行 `components/cockpit/*` は触らず、HUD側コピーを追加。
- 追加:
  - `src/components/hud/HudCockpitHeader.tsx`
  - `src/components/hud/HudCockpitNudge.tsx`
  - `src/components/hud/HudCockpitMeetingSummary.tsx`
  - `src/components/hud/HudCockpitMonthlyList.tsx`
  - `src/components/hud/HudCockpitRoutineGas.tsx`
  - `src/components/hud/HudCockpitGoalsCompact.tsx`
  - `src/components/hud/HudCockpitKanbanGas.tsx`
  - `src/components/hud/HudCockpitVentureStatus.tsx`
- `HudCockpitView` で以下をHUD側コピーへ差し替え。
  - Header
  - つくよみメモ
  - MTGサマリ
  - 月次リスト
  - 月次ルーティン
  - MS / Goals
  - Tasks / Kanban
  - Venture status
- parity維持:
  - PJ config導線
  - つくよみメモ全件表示
  - MTGサマリの過去表示/展開/Notionリンク
  - 月次カードクリック -> `CockpitMonthlyModal`
  - MS進捗内訳展開
  - 請求月ピッカー -> `billing_cycles.invoice_ym` 更新
  - routine step click -> 既存routine modal
  - MS sub-item toggle -> `toggleSubItemStatus`
  - task drag/drop・status modal -> `updateTaskStatus`
  - Venture status の各編集modal導線
- verification:
  - `npm run build` 成功。
  - local Chrome/Playwright: `/tmp/amd-hud-wall-focus-reframe-final-local.png`, console error = 0。
  - production deploy: `https://amd-os-n8dllkf60-armada0130.vercel.app` -> alias `https://amd-os-pwa.vercel.app`。
  - production Chrome/Playwright: `/tmp/amd-hud-wall-focus-reframe-prod.png`, canvas = 1, console error = 0。

#### 追加調整: cockpit live data bridge

まさレビューで「実際のコックピットのコンテンツを実装していってほしい」と要望。

- `CyberHudWallDashboard.tsx`
  - 既存PJコックピットと同じ `fetchCockpitFromSupabase(projectId)` をHUD Wallから呼ぶようにした。
  - `p20/p25/p06/p21/p14` はSupabase cockpit dataでPJカード/Focus/dockを上書き。`p29` はDB row不在で406になるため、現時点ではfetch対象から外してmock fallback。
  - PJカード: `project_name` / `status` / `project_type or client_name` / 実MS進捗 / next actionを反映。
  - `PJ STATUS`: status / type / members count / plan period / data source。
  - `MS / GOALS`: weighted MS progress / next milestone / total pt / owner。
  - `MONTHLY`: current billing cycle / report / meeting / budget。
  - `ACTIONS`: open task / nudge / blocker sub-item / owner。
  - `ROUTINE`: budget / meeting / invoice / report routine state。
  - 日本語MS名など長い実データは `fitHudText` で縮小 + ellipsisし、HUD枠からはみ出さないようにした。
  - 初期表示でKUTE実データが見えるよう、fetch順は `p25` を優先。Supabase auth lock warningを避けるため、並列fetchではなく逐次fetch + incremental state updateにした。
- local verification:
  - `npm run build` 成功。
  - KUTE Focus + MS dock: `/tmp/amd-hud-wall-cockpit-live-kute-fit-local-2.png`
  - AER/SE Focus + Actions dock: `/tmp/amd-hud-wall-cockpit-live-local-2.png`
  - console error = 0
- production deploy:
  - deployment URL: `https://amd-os-4z6g6ipss-armada0130.vercel.app`
  - alias: `https://amd-os-pwa.vercel.app`
- production verification:
  - KUTE Focus + MS dock: `/tmp/amd-hud-wall-cockpit-live-prod-priority.png`
  - canvas = 1 / console error = 0 / cockpit fetch warning = 0 / Supabase auth lock warning = 0

#### 追加調整: spatial workspace / full cockpit mount

まさレビューで「現行のコックピットと同じ使いやすさを、HUDの雰囲気を壊さず実現できるか試したい」「PJコックピットにあるコンテンツをすべてこっちにも実装して」と要望。

- `CyberHudWallDashboard.tsx`
  - HUD canvasはPJ横断/空間選択レイヤーとして残し、同一ページ前景に `CockpitSpatialWorkspace` を追加。
  - `PJ STATUS` / `MS / GOALS` / `MONTHLY` / `ACTIONS` / `ROUTINE` dockクリックで、ページ遷移なしにspatial workspaceを開く。
  - workspace内部には既存 `CockpitView` をそのままマウントし、元PJコックピットのコンテンツを再利用。
    - `CockpitHeader`
    - `CockpitVentureStatus`
    - `CockpitGoalsCompact`
    - `CockpitKanbanGas`
    - `CockpitMonthlyList` / `CockpitMonthlyModal`
    - `CockpitMeetingSummary`
    - `CockpitRoutineGas` / routine各modal
    - `CockpitNudge`
  - `?project=p25&dock=ms&workspace=1` のspatial deep linkを追加し、HUD内workspace状態をURLから直接再現できるようにした。
- Supabase client hygiene:
  - `src/lib/supabase/client.ts` をbrowser singleton化。
  - read-only anon clients (`supabase-data.ts`, `venture-status-data.ts`, `amd-score-data.ts`, `CockpitNarrativeModal.tsx`) は `persistSession: false` + module別 `storageKey` を設定し、HUD workspaceで元CockpitViewをマウントしてもGoTrueClient/lock warningが出ないようにした。
- local verification:
  - `npm run build` 成功。
  - URL: `http://127.0.0.1:3010/mock/dashboard-cyber-hud-wall?project=p25&dock=ms&workspace=1`
  - workspace screenshot: `/tmp/amd-hud-wall-spatial-workspace-deeplink-local.png`
  - workspace sections: `年間マイルストーン` / `月次ルーティン` / `つくよみメモ` / `MTGサマリ`
  - Monthly modal入口: true
  - Routine modal入口: true
  - auth warning = 0 / console error = 0
- production deploy:
  - deployment URL: `https://amd-os-1r8iort45-armada0130.vercel.app`
  - alias: `https://amd-os-pwa.vercel.app`
- production verification:
  - URL: `https://amd-os-pwa.vercel.app/mock/dashboard-cyber-hud-wall?project=p25&dock=ms&workspace=1`
  - workspace screenshot: `/tmp/amd-hud-wall-spatial-workspace-prod.png`
  - Monthly modal入口: true
  - Routine modal入口: true
  - auth warning = 0 / console error = 0

#### 追加方針転換: HUD Client v0 / writable parallel client

まさレビューで「ダッシュボードから全ページすべて複製して、そっちを実際にDBへの書き込みも可能にしておいて、実用で使いながら少しずつHUD化していく」方針へ転換。

- 方針:
  - mock/bypassの3D実験ではなく、通常ログイン配下の `/hud` を実用HUD Clientとして育てる。
  - DB/API/保存処理は現行と共有し、書き込みも可能にする。
  - 現行 `/dashboard` / `/project/[projectId]/cockpit` は壊さず、HUD版routeから少しずつUIを置換する。
- 追加:
  - `src/components/hud/HudShell.tsx`
    - HUD専用の暗色shell、HUD nav、grid背景、Classic導線。
  - `src/app/(app)/hud/layout.tsx`
    - `/hud` 配下にHudShellを適用。
  - `src/app/(app)/hud/page.tsx`
    - `/hud` -> `/hud/dashboard` redirect。
  - `src/app/(app)/hud/dashboard/page.tsx`
    - 現行dashboardと同じ `fetchProjectsFromSupabase` / `fetchBillingStatusFromSupabase` を使用。
  - `src/app/(app)/hud/project/[projectId]/cockpit/page.tsx`
    - 現行cockpitと同じ `fetchCockpitFromSupabase` / `CockpitView` / PM権限判定 / initial ym/step modal を使用。
  - `DashboardGrid`
    - `projectHrefPrefix` と `variant="hud"` を追加。
    - HUD版ではPJリンク先を `/hud/project/[projectId]/cockpit` に差し替え。
- verification:
  - `npm run build` 成功。
  - route一覧に `/hud`, `/hud/dashboard`, `/hud/project/[projectId]/cockpit` 表示。
  - local unauthenticated `/hud/dashboard` -> `/auth/login` redirect確認。
- production deploy:
  - deployment URL: `https://amd-os-9mhxv281k-armada0130.vercel.app`
  - alias: `https://amd-os-pwa.vercel.app`
- production verification:
  - URL: `https://amd-os-pwa.vercel.app/hud/dashboard`
  - 未ログイン時は `/auth/login` にredirect確認。

#### 追加調整: HUD Cockpit preserve mode

まさレビューで「現行サイトのUXから落とさずにHUD化しないと意味ない」「請求月変更が消えている」「月次ルーティンのステータスが見えない」「ひとつも情報を落とさないで」と指摘。

- 判断:
  - HUD native v1 のようにコックピット全体を独自再構成すると、既存 `CockpitView` の情報/操作/状態遷移を取りこぼす。
  - 実用HUD Clientでは、見た目より先に現行機能の完全維持を優先する。
  - 今後のHUD化は、現行コンポーネントと表示項目/操作/DB書き込み parity が確認できた小単位だけ置き換える。
- `src/components/hud/HudCockpitView.tsx`
  - 独自HUDコックピットを撤回。
  - 既存 `CockpitView` をそのままマウントする preserve wrapper へ変更。
  - HUD化は外側のchrome / rail / grid shellのみに限定。
  - 現行の請求月変更、Monthly modal、Routine status、Routine各modal、MS sub-item toggle、Task status update、Nudge、meeting summary、venture statusを落とさない。
- `/hud/project/[projectId]/cockpit/page.tsx`
  - 引き続き `HudCockpitView` 経由で表示するが、内側は既存 `CockpitView` をそのまま利用。
- verification:
  - `npm run build` 成功。
  - route一覧に `/hud`, `/hud/dashboard`, `/hud/project/[projectId]/cockpit` 表示。
- production deploy:
  - deployment URL: `https://amd-os-ckd5g28bm-armada0130.vercel.app`
  - alias: `https://amd-os-pwa.vercel.app`
- production verification:
  - URL: `https://amd-os-pwa.vercel.app/hud/project/p25/cockpit`
  - 未ログイン時は `/auth/login` にredirect確認。

#### 追加方針固定: HUD Client migration direction

まさレビューで「マウントしたら少しずつHUD化できない」「現行版が変わる」「全部複製して少しずつHUD化していく方向だったはず」「毎回方向性が途中で変わるからmdに方向性を書いて」と指摘。

- `design/HUD_CLIENT_MIGRATION.md` を追加。
- 固定方針:
  - 現行 `/dashboard` / `/project/[projectId]/cockpit` は壊さない。
  - HUD版は `/hud` 配下に複製して育てる。
  - 現行コンポーネントを直接HUD化しない。
  - HUD化する部品は必ず `components/hud/*` 側へ複製してから変更する。
  - DB/API/保存処理は現行と共有する。
  - 現行と表示項目・操作・DB書き込み parity が取れた部品だけ差し替える。
  - 請求月変更、月次ルーティンステータス、各modal、MS更新、task更新は絶対に落とさない。
- `HANDOFF_pwa_rebuild.md` の First Next Action に `design/HUD_CLIENT_MIGRATION.md` を最初に読む手順を追加。
- `src/components/hud/HudCockpitView.tsx` を preserve wrapper ではなく、現行 `CockpitView` からのHUD側コピーへ変更。
  - 現行 `CockpitView` は触らない。
  - HUD routeだけが `HudCockpitView` を使う。
  - 子部品はまだ既存 `components/cockpit/*` を参照しているため、次から部品単位で `components/hud/*` へ複製してHUD化する。
- verification:
  - `npm run build` 成功。

#### 追加調整: HUD readable color pass / Atlas map glow

まさレビューで「Atlas mapはノード発光させよう」「文字が黒で見えない」「Atlasの分野とタグは色がなくなってる」「Seedsの調査中が見えない」「VC listのFUND横が黒くて見えない」と指摘。

- `src/app/(app)/atlas/map/page.tsx`
  - canvas nodeにdomain色のradial glowを追加。
  - node本体にshadow glowとcyan/white edgeを追加。
  - labelを黒文字からdark outline + cyan/amber textへ変更。
  - link線をgrayからthin cyanへ変更。
- `src/app/(app)/atlas/page.tsx`
  - 分野/タグfilter chipをHUD line frameのまま、CSS variableで色を保持する方式へ変更。
- `src/app/globals.css`
  - `amd-hud-page-skin` 配下で `text-primary` / `text-blue-700` / `text-emerald-700` / `text-amber-700` などlight UI由来の濃色テキストをHUD向け淡色へoverride。
  - `atlas-hud-chip` は `--chip-rgb` / `--chip-color` を使って色付きHUD chipとして描画。
- `src/lib/seeds-data.ts`
  - `SEED_STATUS_COLOR` をdark HUDで読めるbadge classへ変更。`調査中` はsky tone。
- `src/app/(app)/vcs/page.tsx`
  - active fund status / AMD PJ investment / PJ contact chipをHUD向け発光badgeへ変更。
- verification:
  - `npm run build` 成功。route一覧は114 pages。
- production deploy:
  - deployment URL: `https://amd-os-kmk1rx5sv-armada0130.vercel.app`
  - alias: `https://amd-os-pwa.vercel.app`
- production verification:
  - `/hud/atlas/map` -> `/auth/login?next=%2Fhud%2Fatlas%2Fmap`
  - `/hud/atlas` -> `/auth/login?next=%2Fhud%2Fatlas`
  - `/hud/seeds` -> `/auth/login?next=%2Fhud%2Fseeds`
  - `/hud/vcs` -> `/auth/login?next=%2Fhud%2Fvcs`
  - `/hud/dashboard` -> `/auth/login?next=%2Fhud%2Fdashboard`

#### 追加調整: HUD shell overlap / notifications / routine modal dark skin

まさレビューで「上のメニューバーにAtlas Map等ボタンが隠れる」「Atlas mapがThis page couldn't loadになる」「notificationsが404」「月次ルーティンの各モーダルが白ベース」と指摘。

- `src/components/hud/HudShell.tsx`
  - HUD routeでは現行GlobalNavが非表示なので、sticky基準を `top-11` から `top-0` へ変更。
  - fixed背景layerも `top-11` 前提を廃止。
  - `document.body` に `amd-hud-body` を付け、body直下にportalされるDialogにもHUD skinを効かせる。
- `src/app/(app)/hud/notifications/page.tsx`
  - `/notifications` の実装をHUD routeからも開けるよう追加。
  - `dynamic` はNextの静的解析に合わせて再exportせず、HUD page側で明示。
- `src/app/(app)/hud/dashboard/page.tsx`
  - 通知センターリンクを `/hud/notifications` へ変更。
- `src/app/(app)/atlas/map/page.tsx`
  - `nodeCanvasObject` に `x/y/globalScale` のfinite guardを追加。force graph初期tickで座標未確定でもcanvas runtime errorに落ちないよう修正。
- `src/app/globals.css`
  - `.amd-hud-body [data-slot="dialog-content"]` とルーティン内confirm overlayにHUD dark surface / cyan border / dark inputs / semantic toast colorsを適用。
- verification:
  - `npm run build` 成功。route一覧に `/hud/notifications` 表示。
- production deploy:
  - deployment URL: `https://amd-os-ci1lnfvon-armada0130.vercel.app`
  - alias: `https://amd-os-pwa.vercel.app`
- production verification:
  - `/hud/notifications` -> `/auth/login?next=%2Fhud%2Fnotifications`
  - `/hud/atlas/map` -> `/auth/login?next=%2Fhud%2Fatlas%2Fmap`
  - `/hud/atlas` -> `/auth/login?next=%2Fhud%2Fatlas`
  - `/hud/dashboard` -> `/auth/login?next=%2Fhud%2Fdashboard`

#### 追加実装: Dashboard Mock Fidelity / density correction

まさレビューで「Project Signal Boardを5件固定にするのは違う。問題は件数ではなく、モックに比べて間がスカスカなこと」「PJ数はいくらでも増やせる設計じゃないとダメ」と指摘。

- `Project Signal Board` の `slice(0, 5)` を撤廃し、全PJを表示対象に戻した。
- board内部を高密度scroll listにして、PJ数が増えても同じcontrol center面の中で扱える構造へ変更。
- Project Signal Board outer frame / row frame / left abbreviation bay / FILE tab / inner separators を、参照モック `dashboard_hud.png` の薄いcyan line / chamfered module / parallelogram hatchに寄せて再調整。
- Alert moduleはredのみで構成し、cyan混入を避ける方向へ再調整。
  - 横長chamfered red frame
  - 左warning triangle
  - right VIEW button red frame
  - bottom parallelogram hatch
- `hud-signal-scroll` のscrollbarをHUD色に追加。
- verification:
  - `npm run build` 成功。

#### 追加実装: Dashboard generated backplate pass

まさレビューで「3枚目のcontrol center railが近い」「上下の幅が太すぎる」「モックと同一かどうかだけで判断」と指摘。

- generated image backplate:
  - `public/hud/control-center-rail-backplate-v2.png`
    - top control railを画像生成し直し、モックに近い横長railとしてcrop。
    - 実装側ではDOM文字を重ねず、生成画像のCONTROL CENTER / AA-01 / subtitleをそのまま使う。
  - `public/hud/project-row-frame-v1.png`
    - PJ signal row用の固定サイズframe backplateを生成。
    - PJ名 / status / score / value liftなど実データ文字はDOMのまま維持。
- coded frame refinement:
  - VC / Partner Network系panelの外枠線・角アクセント・ring strokeをモックに合わせて弱く細く調整。
  - 「存在感を足す」ではなく、reference mockとの差分を潰す判断に切り替え。
- verification:
  - `npm run build` 成功。

#### 追加実装: HUD Dashboard typography / chassis quality pass

まさレビューで「下地はいい感じ」「それぞれのパーツのクオリティを上げたい」「フォントをモックに近づけたい」「固定サイズのframeは画像生成でやったら早いのでは」と指摘。

- 方針:
  - 実データが乗るframe / click領域 / hoverやstatus変化はSVG componentで保持する。
  - 画像生成はdecorative backplate / chassis texture / 背面の微細な塗装に使う。
  - PJ名、KPI値、status、button label、table/list本体は画像に焼き込まない。
- `design/hud_visual_language.md` に `SVG vs Generated Image` の実装方針を追記。
- HUD display fontとして `Rajdhani` を導入。
  - HUD page / dashboard / SVG text / `font-mono`系のHUD表示をRajdhani寄りに補正。
  - 日本語は既存fallbackで可読性を維持。
- `HudControlCenterDashboard` のframeをquality pass。
  - 1px borderではなくmodule chassisとして描画。
  - chamfered corners / thick cyan plate / white corner connector / red tick / scanline / bottom tick marksを追加。
  - PJ row / action queue / metric railではmodule frame variantを使用。
- verification:
  - `npm run build` 成功。
  - headless Chrome visual checkはauth redirectで `/auth/login` に落ちるため、未ログイン環境ではdashboard本体のスクショ不可。
- production deploy:
  - deployment URL: `https://amd-os-ihfbz1vzi-armada0130.vercel.app`
  - alias: `https://amd-os-pwa.vercel.app`
- production verification:
  - `/hud/dashboard` -> `/auth/login?next=%2Fhud%2Fdashboard` (未ログイン時redirect確認)

#### 追加実装: Dashboard HUD rail / metric strip / VC module refinement

まさレビューで「添付画像1のheader部分はそのまま貼ればよいのでは」「添付2/3は画像生成しなくてもコーディングで十分作れそう」と指摘。

- `HudControlCenterDashboard` の上部3カードheaderを廃止し、横長のsingle HUD railへ再構成。
  - AMD OS block / Control Center title / AA-01 block / circuit connector lineを1枚の制御盤として表示。
- Top Metricsを添付2寄せで再構成。
  - 5分割のmetric strip、縦separator、dotted background、AMD Scoreの小型tick barを追加。
- VC / Partner Networkを添付3寄せで再構成。
  - HudPanel汎用枠ではなく専用panel SVGへ変更。
  - Meetings / Term Sheet / Invested のリングを専用 `VcRing` へ変更。
  - partner chipをMicrosoft / Google / AWS / NVIDIA / ... の横並びmoduleへ変更。
- verification:
  - `npm run build` 成功。
- production deploy:
  - deployment URL: `https://amd-os-km29aaplh-armada0130.vercel.app`
  - alias: `https://amd-os-pwa.vercel.app`
- production verification:
  - `/hud/dashboard` -> `/auth/login?next=%2Fhud%2Fdashboard` (未ログイン時redirect確認)

#### 追加設計: HUD Visual Language

まさレビューで「移行はだいぶできたので、ここからHUDのクオリティを上げたい」「参考画像のようなcontrol center / red alert系をOS全体のデザインコードにしたい」と指摘。

- `design/hud_visual_language.md` を追加。
- 通常時の方向性を `cyan control center` として固定。
  - dark navy / graphite base
  - dotted circuit grid
  - cyan / electric blue line
  - coralは小さなsignalとして使う
  - cardではなく制御盤moduleとして見せる
- alert時の方向性を `red threat console` として固定。
  - black / blood red / hot red
  - central warning core
  - segmented ring / bracket frame / tick marks
  - 通常UI内の赤badgeではなく、別レイヤーの警告装置として表示
- signature:
  - Signal Board / Circuit Command Plane
  - dotted circuit grid
  - stepped cyan frame
  - segmented KPI ring / bar
  - file-tab labels
  - alert時だけred command layer
- image generation policy:
  - 生成すべき: background texture、decorative chassis asset、alert core texture、prototype reference sheet
  - 生成しない: 実データ文字、ボタン、入力、PJ名、金額、score、status、テーブル本体
- `design/README.md` と `design/cyber_hud_design_code.md` から参照。

#### 追加実装: HUD Dashboard Control Center

まさレビューで「画像生成mockがドンピシャ」「このくらい情報量多くていい」「このまま忠実に実装してほしい」と指摘。

- 画像生成mockを `design/assets/hud_dashboard_control_center_mock_20260515.png` に保存。
- `/hud/dashboard` を `HudControlCenterDashboard` へ差し替え。
- 実装した構成:
  - top control rail
  - Studio Core KPI segmented ring
  - System Status module
  - top metric rail
  - Project Signal Board
  - Next Action Queue
  - red System Alert module
  - Atlas / Seeds / VC / AMD Score bottom strips
- 維持した操作:
  - PJ moduleクリック -> `/hud/project/[projectId]/cockpit`
  - `PJ INTRO EXPORT` -> 既存 `AllPjIntroductionModal`
  - Atlas / Seeds / VC / Score / Notifications導線
- 125%表示のChromeで右側queueがはみ出したため、main grid / project row の固定幅を流動幅に修正。
- verification:
  - `npm run build` 成功。
- production deploy:
  - initial deployment URL: `https://amd-os-kammt684u-armada0130.vercel.app`
  - final deployment URL: `https://amd-os-5xhbvaen7-armada0130.vercel.app`
  - alias: `https://amd-os-pwa.vercel.app`
- Chrome visual verification:
  - `https://amd-os-pwa.vercel.app/hud/dashboard` をログイン済みChromeで開き、control center layout / right queue収まり / PJ cockpitリンク遷移を確認。
- Chrome visual verification:
  - ログイン済みChromeで `https://amd-os-pwa.vercel.app/hud/atlas/map` を開き、This page couldn't load が再発しないことを確認。
  - HUD shell nav と Atlas Map のページ内操作ボタンが重ならないことを確認。
- `src/app/(app)/atlas/map/page.tsx`
  - 初期表示でラベルが密集しないよう、重要ノード / 高signal / zoom時だけラベルを強める。
- verification:
  - `npm run build` 成功。
- production deploy:
  - deployment URL: `https://amd-os-hmrtapykt-armada0130.vercel.app`
  - alias: `https://amd-os-pwa.vercel.app`
- production verification:
  - `/hud/notifications` -> `/auth/login?next=%2Fhud%2Fnotifications`
  - `/hud/atlas/map` -> `/auth/login?next=%2Fhud%2Fatlas%2Fmap`
  - `/hud/atlas` -> `/auth/login?next=%2Fhud%2Fatlas`
  - `/hud/dashboard` -> `/auth/login?next=%2Fhud%2Fdashboard`

#### Handoff: HUD Dashboard Control Center fidelity continuation

- 2026-05-16 session end handoff created.
- `HANDOFF_pwa_rebuild.md` was slimmed to current state + next action.
- `BUGS.md` gained `[pwa/hud-dashboard] Project Signal Board の密度改善指示を「5件固定」と誤読してPJ数可変設計を壊した`.
- Next session should continue the checklist against repo root `dashboard_hud.png` until all items are `達成`.

#### 追加実装: HUD Dashboard Control Center density / alert red pass

- まさ指定どおり、参照モックは repo root `dashboard_hud.png` のみとして継続。
- Project Signal Board:
  - 5件固定には戻さず、PJ数可変 + scroll listを維持。
  - main gridの中央幅を広げ、panel gap / padding / row gapを詰めた。
  - row heightを 66px -> 57px へ圧縮し、PJ名・status・health ring・FILE tabを小型化。
  - outer frameに上部notch / 太めprimary line / board hatchを追加。
  - row frameは略称bayのchamfer、内側separator、bottom/top parallelogram hatchを増やした。
- Alert module:
  - cyan由来のborder/textを排し、red-onlyのstroke / hatch / warning textへ寄せた。
  - SYSTEM ALERT、件数、予算超過/検収遅延、VIEW buttonをモック寄せで小さくした。
  - warning triangleは小型の赤outlineへ変更。
- checklist:
  - PJ数可変は `達成`。
  - row frame / hatch / abbreviation bay / alert red-only は `達成寄り`。
  - 全体密度と内側線位置はまだ `一部達成` として継続。
- verification:
  - `npm run build` 成功。
- production deploy:
  - deployment URL: `https://amd-os-djegq4uwi-armada0130.vercel.app`
  - alias: `https://amd-os-pwa.vercel.app`
- production verification:
  - `/hud/dashboard` -> `/auth/login?next=%2Fhud%2Fdashboard` (未ログイン時redirect確認)

#### 追加実装: Dashboard metric-frame removal / unified PJ row / score detail cyber bars

- まさレビューで「添付のフレームは使わない」「その分projectのフレームを上に広げる」「各PJフレームがモックと違って2つに分裂している」「詳細スコアページのM/X/F横棒グラフがサイバー感ない」と指摘。
- `HudControlCenterDashboard`:
  - 添付の横長metric frame (`TopMetrics` / `MetricRailSvg`) を削除。
  - Project Signal Boardを上に拡張し、`min-h` / scroll領域を拡大。
  - Project row frameを1枚外形へ描き直し、左略称bayを外枠内の区画として扱うよう修正。
  - 略称bayと本文frameが別々に浮いて見える2分裂を解消。
- `AmdScoreView`:
  - `M / X / F Balance Vector` をHUD panel化。
  - 各横棒を segmented rail + glow fill + scan marker + M/X/F bay付きのサイバーHUD表示へ変更。
- verification:
  - `npm run build` 成功。
- production deploy:
  - deployment URL: `https://amd-os-pp1dvh44o-armada0130.vercel.app`
  - alias: `https://amd-os-pwa.vercel.app`
- production verification:
  - `/hud/dashboard` -> `/auth/login?next=%2Fhud%2Fdashboard` (未ログイン時redirect確認)
  - `/venture-map/amd-score/p20` -> `/auth/login?next=%2Fventure-map%2Famd-score%2Fp20` (未ログイン時redirect確認)

#### 運用修正: Vercel deployment URL を確認URLとして案内しない

- まさ指摘: `https://amd-os-pp1dvh44o-armada0130.vercel.app` のような deployment URL を渡すと、現行バージョンOSに飛ぶ/確認導線として紛らわしい。
- 原因:
  - `amd-os-<hash>-armada0130.vercel.app` は Vercel deployment inspection 用のURLとして扱うべきで、まさのブラウザ確認URLではない。
  - 完了報告で deployment URL を前面に出すと、canonical alias と固定deploy URLの役割が混ざる。
- 対応:
  - `pwa/scripts/deploy.sh` の完了表示を `https://amd-os-pwa.vercel.app` 優先へ変更。
  - deployment URL は `Inspect-only deployment URL` としてのみ表示。
  - 今後まさに渡す確認URLは `https://amd-os-pwa.vercel.app/...` に固定。

#### 追加実装: STAPA投影資料用 HUD Dashboard embed route

- STAPA投影資料から AMD OS HUD dashboard をiframe表示するため、公開embed route `/hud/dashboard/embed` を追加。
- 通常の `/hud/dashboard` は認証必須 + `X-Frame-Options: DENY` + `frame-ancestors 'none'` のまま維持。
- embed routeだけ `frame-ancestors 'self' http://127.0.0.1:8766 http://localhost:8766` を許可し、`X-Frame-Options` を送らないheaderに分離。
- `middleware` の未ログインredirect対象から `/hud/dashboard/embed` を除外。
- local verification:
  - `npm run build` 成功。
  - `next start -p 3010` 後、`curl -I http://localhost:3010/hud/dashboard/embed` で 200 / frame-ancestors許可 / X-Frame-Optionsなしを確認。
  - `curl -I http://localhost:3010/hud/dashboard` は従来通り 307 login redirect / `X-Frame-Options: DENY` を確認。

#### 追加実装: AMD Score detail HUD designer pass

- まさレビューで「HUD感が全然ない」「HUDデザイナーとして合格ライン」「下の数式もネオンカラーで見やすく、フォント大きく」と指摘。
- `AmdScoreView`:
  - `M / X / F Balance Vector` を通常progress barからHUD計器モジュールへ再設計。
  - 外枠frame、M/X/F axis bay、segmented rail、20/40/60/80 guide、parallel hatch、scan marker、glow percentを追加。
  - row height / typographyを上げ、各軸の存在感を強めた。
- `AmdScoreFormulaPanel`:
  - 白/紫カードを撤廃し、dark HUD frame + dotted grid + cyan/sky/rose/amber neon moduleに統一。
  - LaTeX数式の色・glow・font sizeを上げ、display式も読みやすくした。
  - Cobb-Douglas / M / X / F / α weights / rate-limiting をそれぞれHUD block化。
- verification:
  - `npm run build` 成功。

#### 追加実装/設計: HUD dashboard row fidelity + Macrotrend architecture pass

- まさレビュー 2026-05-17:
  1. 左上version numberが切れている。
  2. `Studio Score KPI` / `Next Action Queue` の文字がframeと被る。
  3. PJ子フレームをモックへ忠実に寄せる。棒グラフ形状は現状維持、bar間隔だけ詰める。
  4. M/X/Fはそれぞれ Macrotrend / XRL / FRL。
  5. 右上frame内カードに `ID:001` / `admin ON` などの属性を入れる。
  6. Macrotrendは世界課題・数十年変化の上位mapで、Atlas/Seedsを包含するべき。
  7. それに伴うcron/automation設計案が必要。
  8. AMD Score graph Y軸は0-100k固定ではなく変化が見えるrange。
  9. PJ cockpit AMD Score graph X軸をscore detailと合わせる。
- `HudControlCenterDashboard`:
  - 左上brand frameを 350px/96px から 318px/84px 相当に縮小、title/subtitle/versionのfont/spacingを圧縮。
  - `KpiPanelFrameSvg` / `QueueBoardFrameSvg` を top 12px 下げ、panel titleとの被りを解消。
  - 右上user frame内の4 mini cardsを `ID:001` / `admin ON` / `db OK` / member code 表示へ変更。
  - Project row frameを再設計。左略称bayを大型化し、本体と連結。top/bottom hatch数増、FILE tagをgauge手前へ移動。
  - M/X/F legendとrow bar順を `M Macrotrend` / `X XRL` / `F FRL` に修正。
  - bar形状は維持し、縦間隔のみ `space-y-[1px]` へ圧縮。
- `AmdScoreView` / `AmdScoreFormulaPanel`:
  - M/X/F説明を Macrotrend / XRL / FRL に統一。
- `CockpitVentureStatus` / `HudCockpitVentureStatus`:
  - AMD Score chartのY軸を実データlog範囲へfit。
  - AMD Score chartのX軸をscore seriesの評価日ベースへ変更し、score detail pageの軸思想に合わせた。
  - XRL chartは従来どおり founded_at / xrl observations / events / today を含むrangeを維持。
- Macrotrend architecture:
  - `pwa/design/macrotrend_atlas_seeds_architecture.md` を新規作成。
  - `/atlas/divergence` は「世界×日本差分抽出」と位置付け、Macrotrendの子分析へ下げる。
  - 新上位階層: `Macrotrend issue -> transition thesis -> Atlas evidence -> divergence -> seed clusters -> AMD decisions`。
  - cron案: cheap ingestionはVercel cron、重いissue/thesis/seed-fit判断はCodex automation + JSON outbox + deterministic apply。
- verification:
  - `npm run build` 成功。

#### 追加実装: HUD dashboard follow-up fidelity / Macrotrend source / Codex automation pass

- まさレビュー 2026-05-17 follow-up:
  - Project rowの左略称inner frameは「閉じた子フレーム内の内側フレーム」にし、細部もモック単位で合わせる。
  - `◯月度` はHUDとして弱いので英語/短縮表記へ変更する。
  - かすれは破線ではなく、周期性や急な途切れのない自然なHUD fadeとして扱う。
  - Next Action Queueは月次ルーティンの正式タスク名を一字一句そのまま使う。
  - 背景に薄い非均一dot gridを追加する。
  - PJ rowのM/X/F barsはダミーではなく実データへ差し替える。
  - Macrotrendはすべてsource URL付き、clickable card化、MECE/必要十分性の根拠を示す。
  - 情報収集cronはGAS/VercelではなくCodex automationで検討・実装する。
  - PJ cockpitもHUD dashboardの雰囲気に合わせるため、まずmock imageを作る。
- `HudControlCenterDashboard`:
  - Project row outer frame / left initials inner frameを再調整。左上装飾、右上短斜線、右側二重線、右下二重線、下辺/左下の実線化を追加。
  - frameの破線表現を撤廃し、低opacity base stroke + irregular highlight segmentsで自然なかすれ方向へ変更。
  - 背景にdeterministicな非均一dot SVG layerを追加。
  - Project row M/X/F barsを `amd_score_inputs` 由来の実データへ差し替え。M=Macrotrend(sigmaSU), X=XRL average, F=FRL。
  - Next Action Queueは月次ルーティン由来の `請求額確定` / `報告会日程調整` / `月次報告書FIX` / `請求書送付` / `入金確認` を使い、右labelは `M05` 形式へ変更。
- Macrotrend page:
  - `/atlas/macrotrends` と `/hud/atlas/macrotrends` を追加。
  - issue clusterごとにsource URLを表示し、Atlas evidence / divergence / seeds cardsをclickableにした。
  - 5分類は現時点の作業仮説として明示し、MECE/必要十分性はCodex automationで証拠収集と欠落/重複検出を継続する設計にした。
- Codex automation:
  - `AMD Macrotrend Evidence Review` (`amd-macrotrend-evidence-review`) を作成。
  - Weekly Monday 07:30 JST相当で、source URL付きmacrotrend evidence収集、MECE gap/overlap review、JSON outbox生成までを行う。DBへ直接書かない。
- PJ cockpit:
  - dashboard HUD方向へ寄せるためのmock SVGを `pwa/design/assets/hud_cockpit_mock_20260517.svg` に追加。
- verification:
  - `npm run build` 成功。

#### 追加実装: HUD row geometry / Macrotrend authorized backbone / no-score correction

- まさレビュー 2026-05-17 follow-up 2:
  - Project row形状は、長方形の4隅cutとして再解釈。左上/右下は大きく、右上/左下は小さく切り取る。二重線は右辺まで伸ばし、外枠との間隔を狭くする。
  - `エネルギー余剰化` はAI/data center需要増と矛盾して見えるため、エネルギーissueを再定義する。
  - MacrotrendはAMD独自分類で断定せず、authorized backboneを使って言い切れる構造にする。
  - Codex automationからSupabaseへどう記録されるかを明確化する。
  - `M05` は月表記として弱いため `2026.05` 形式へ変更する。
  - no score PJにbarsが出ていたのはhash fallback残りなので撤廃する。
- `HudControlCenterDashboard`:
  - Project row outer frame / initials inner frameを4隅cut ruleで再描画。
  - 実scoreがないPJはM/X/F barsを表示せず、`NO SCORE` railに変更。ringも `--` 表示。
  - 全体平均M/X/Fは実scoreがあるPJだけで算出。
  - frameの可視揺らぎを強めるため、HUD全体に非周期のwear/scratch layerを追加。
  - queue period labelを `2026.05` 形式へ変更。
- Macrotrend:
  - authoritative backboneを `UN 2030 Agenda / 17 SDGs` と `WEF Global Risks Report 2026` に変更。
  - energy issueを `電力需要増大とグリッド制約` へ修正。
  - energyは `AI/data center由来の電力需要増` / `送配電容量・系統接続待ち` / `再エネの時間帯余剰と出力抑制` / `重要鉱物・設備供給制約` に分解し、それぞれsource URLとSeeds fitを表示。
  - 各issueに `authoritativeMap` と `subIssues / Seeds Link` を追加。
- Automation:
  - `AMD Macrotrend Evidence Review` promptを更新。
  - `/Users/masa/.codex/automations/amd-atlas/outbox/macrotrend-YYYYMMDD-HHMMSS.json` を生成するよう指定。
  - 既存LaunchAgent `jp.teamarmada.amd-os-ms-outbox-applier` が5分ごとに `atlas_signal_review_tool.mjs apply-outbox-dir` を実行し、`/api/atlas/signals-ingest` 経由でSupabase `atlas_signals` に記録する。
- verification:
  - `npm run build` 成功。

#### 追加実装: HUD frame thinning / Macrotrend evidence chain / score bar correction

- まさレビュー 2026-05-17 follow-up 3:
  - PJ rowの内側線は二重線ではなく追加線1本。左下斜線から右辺2/3まで、外枠との距離はさらに半分。
  - 左上cutには小さい三角形の塗りつぶしobjectを置く。
  - PJ row fontが大きすぎるので縮小。
  - Macrotrendは公式文書を置くだけでなく、文書内の内容 -> 社会課題選定 -> サブ課題 -> seeds がページ内でつながる必要がある。
  - 社会課題は番号、サブ課題は `3-1` 形式で番号付け。
  - wear/scratch揺らぎは一度かなり強くする。
  - M/X/F barsは単純な0-9換算ではなく、score詳細ページのM/X/F達成率と揃える。
  - すべてのframe線が太いので、PJ signal child frame相当に寄せる。太いaccentは半分、光は強め。
  - PJ row右ring scoreが何か分かるようにする。
- `HudControlCenterDashboard`:
  - Project row内側線を1本に整理し、左下から右側2/3までの追加線へ変更。
  - 左上cutにcyan塗り三角形を追加。
  - Project row status font / ring sizeを縮小。右ring labelは `M/X/F AVG` に変更。
  - Brand/User/Studio/Signal/Queue/Action/Initials frame の太いstrokeを概ね半分にし、opacityを上げてglowで見せる方向に調整。
  - wear/scratch layerを260本 + red 44本へ増やし、strokeも太くして一度かなり視認できる強度へ変更。
- `hud/dashboard/page.tsx`:
  - M/X/F barsをscore詳細ページと同じ max-normalized contribution で算出。
  - M = `contributions.sigma_SU / 10^α_sigma`。
  - X = `TRL*BRL*GRL*SRL*HRL contribution / 10^Σα_X`。
  - F = `FRL contribution / 10^α_F`。
- Macrotrend:
  - 各issueに `What The Sources Say` を追加。
  - social issue cardsを `1.` `2.` 形式で番号付け。
  - sub issue cardsを `1-1` 形式で番号付け。
  - sub issue右側にlinked seeds chipsを表示し、issue -> sub issue -> seedsの視覚リンクを追加。
- verification:
  - `npm run build` 成功。

#### 追加実装/引き継ぎ: HUD Dashboard raw M/X/F correction + PJ Cockpit imagegen handoff

- まさレビュー 2026-05-17 follow-up 4:
  - Project rowの左上三角は、フレーム内の飾りではなく「角の欠けた部分を三角形で埋める」形にする。ただしフレームとは間隔を空ける。
  - 子フレーム内側線は左下〜右辺まで連続させ、線の太さ/色はフレームと同一にする。
  - 左上辺と右下辺の角度がズレているため同じ角度へ揃える。
  - Macrotrend UIは四角と矢印を増やすだけでは不十分。現状UIを無視してゼロから構築するならどうするかを再考。three.jsを活かす。
  - HUD frameのかすれは諦め、追加された無数の縦線/横線を全部消す。
  - SXのMが詳細ページの `12.44` ではなく `15.71` になっていた。ダッシュボードでは一切再計算せず、コックピット/詳細ページの値をコピーする。
  - PJ Cockpit mockはSVGではなく画像生成が必須。
- `hud/dashboard/page.tsx`:
  - Project Signal Board のM/X/F入力行選択を、AMD Score詳細ページと同じ `evaluated_at <= today` の最新行へ修正。
  - これにより future / retrofit row を拾ってSXのMが `15.71` になる事故を避ける。
  - 表示値はraw contribution。Mは最大値を置かず、`10^α_sigma` 正規化もしない。
- `AmdScoreView` / `design/amd_score.md`:
  - Mは理論最大値を置かない方針を明記。
  - `/hud/dashboard` は詳細ページと同じ今日以前の最新評価行からM/X/Fをコピーするルールを追記。
- `hud_visual_language.md` / `BUGS.md`:
  - 全画面scratch overlayでframeのかすれを表現する方針を禁止。
  - `HudFrameWearLayer` は次回削除対象として記録。
- PJ Cockpit image generation:
  - image generation toolで初回PJ Cockpit HUD mockを生成。
  - repo copy: `pwa/design/assets/hud_cockpit_generated_mock_20260517.png`
  - source copy: `/Users/masa/.codex/generated_images/019e3060-3757-7153-84cd-417ffa0d1042/ig_01285d624d981508016a097383c2208191a779fc5c7efa08ba.png`
  - まさ評価: 雰囲気OK。ただしMSリスト、月次モーダル等のコンテンツが欠けているため、次回は現行cockpitコンテンツ全量をpromptへ入れて再生成する。
- 現行cockpitコンテンツ棚卸し:
  - Project Header / PJ Status / Milestone Matrix / Next Period Setup / Past MS Periods / Task Control Kanban / Monthly List / Freeze Backfill / Meeting Summary / Right Column / Monthly Modal 3 tabs / Step Modals。
- verification:
  - `npm run build` 成功。
  - `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` 成功。
  - user-facing URL: `https://amd-os-pwa.vercel.app`
  - inspect-only deployment URL: `https://amd-os-cu7k6itn8-armada0130.vercel.app`

#### 追加実装: PJ Cockpit full-content imagegen / HUD scratch removal / Macrotrend 3D flow

- まさ指示 2026-05-17 continuation:
  - PJ Cockpit HUD mockを画像生成toolで再生成。SVG/HTML/CSS代替は禁止。
  - 現行cockpitの全コンテンツ棚卸しをpromptへ入れる。
  - `HudFrameWearLayer` を削除し、全画面scratch overlayを撤廃。
  - PJ Signal Board子フレームは、左上cut三角・左下から右辺への内側線・左上辺/右下辺の角度揃えを再調整。
  - SXのMは詳細ページと同じraw値 `12.44` になるか確認。
  - Macrotrend UIは四角カードUIを捨て、three.jsで source -> issue -> sub issue -> seeds の立体flowとして再構築。
- PJ Cockpit image generation:
  - image generation toolで full-content mock を再生成。
  - repo copy: `pwa/design/assets/hud_cockpit_generated_mock_full_20260517.png`
  - source copy: `/Users/masa/.codex/generated_images/019e3526-6ddf-7ac3-aa50-96602be0a39b/ig_05470c98ca5bda5a016a0982d68c0c81918ab8bae23cd44606.png`
  - promptには Project Header / PJ Status / Milestone Matrix / Next Period Setup / Past MS Periods / Task Kanban / Monthly List / Freeze Backfill / Meeting Summary / Right Column / Monthly Modal 3 tabs / Step Modals を入れた。
- `HudControlCenterDashboard`:
  - `HudFrameWearLayer` と呼び出しを削除。
  - Project row / initials bay frameを再調整。左上三角はcutの欠け部分を少し離して埋める位置へ寄せ、内側線は左下から右辺まで連続させた。
- `/hud/dashboard` SX M:
  - Supabase現物で p21 の today以前最新行 `2026-04-30T00:00:00+00:00 / l2_extract_sonnet` を確認。
  - M raw contribution は `12.44`。dashboard側は `latestVisibleScoreInput(evaluated_at <= today)` から同じraw contributionを作る。
- Macrotrend:
  - `/atlas/macrotrends` / `/hud/atlas/macrotrends` の Evidence Graph 部分を three.js `Canvas` へ差し替え。
  - 奥側: official sources、中央: macro issue core、前景: sub issue、最前面: linked Seeds というZ-depth構造にした。
  - source URL、社会課題番号、サブ課題番号、Seed linkは維持。
- verification:
  - `npm run build` 成功。
  - `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` 成功。
  - production alias: `https://amd-os-pwa.vercel.app`
  - user-facing HUD URL: `https://amd-os-pwa.vercel.app/hud/dashboard`
  - production HEAD check: `/hud/dashboard` と `/hud/atlas/macrotrends` は未ログイン時 `307 -> /auth/login?...` を確認。

#### 追加実装: PJ略称フレーム再修正 / Macrotrend Terrain Map / Signal Board表示名修正

- まさレビュー 2026-05-17 continuation:
  - 略称フレーム左上の三角形は、添付画像のように欠け部分へ三角形を1つ埋める形にする。不要な破片オブジェクトは削除。
  - 略称フレーム内側線は左下〜下辺〜右下〜右辺までつなげ、両端は略称フレームに接する形で止める。
  - 略称フレームが横長すぎるため、添付CX例の比率へ寄せる。
  - Macrotrend 3D flowは四角を立体化しただけで全体感が分からないため、Terrain Map設計に変更。
  - Dashboard PJ Signal BoardのM/X/F数値は小数以下を四捨五入。
  - 略称フレーム内は1文字ではなく `SX` のような short label、右側は正式名称 `SolvioraX` を表示。他PJも同様。
- `HudControlCenterDashboard`:
  - Project row gridの略称列を縮め、略称frameを `76px -> 62px` へ変更。
  - 略称frame左上に三角形を1つだけ配置。
  - 内側線を `M5.4 35.4 L9.4 39.3 H48 L59 30` として左下〜下辺〜右下〜右辺へ接続。
  - `formatSignalValue()` を整数丸めへ変更。
  - row titleは `project.displayName || project.projectName` を表示。
  - initialsは `shortLabel || projectName` から生成し、`SX` / `CX` / `CTB` などをそのまま表示。
- `supabase-data.ts`:
  - `DashProject` に `displayName` / `shortLabel` を追加。
  - `fetchProjectsFromSupabase()` で `project_ventures.display_name` / `short_label` をjoin相当に追加取得。
- Macrotrend:
  - `/atlas/macrotrends` / `/hud/atlas/macrotrends` の中央可視化を Terrain Map へ差し替え。
  - issueを山として表示し、山の高さ=urgency、色温度=opportunity gap、山麓粒子=Seeds coverage、周囲ring=evidence volume とした。
  - bottom stripに gap target 上位3件を表示し、「課題感が強いのにSeedsが手薄」な領域が一目で分かる方向へ変更。
- verification:
  - `npm run build` 成功。
  - `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` 成功。
  - production alias: `https://amd-os-pwa.vercel.app`
  - production HEAD check: `/hud/dashboard` と `/hud/atlas/macrotrends` は未ログイン時 `307 -> /auth/login?...` を確認。

#### 追加実装: OS生データ差分レビューのCodex主導化 / L2拡張 / CTB凍結履歴DB化

- まさ相談 2026-05-17:
  - 月次モーダルの進捗推定品質が低く、GAS/reportGAS任せではなく、Codex automationで5生データとOSデータの差分をレビューする運用へ寄せたい。
  - SupabaseはOS正本であり、生データではない。5生データは Gmail / Drive / Calendar / Slack / Notion。
  - GAS Sheetはバックアップ・人間確認用であり、リアルタイム差分レビューの正本として参照しない。
- L2データ設計:
  - `project_registry_diffs` をL2 7番目として定義。PJメンバー、関係先メール、partner、raw-data route、請求先などOS台帳との差分候補を扱う。
  - `project_xrl_evidence` と `project_founding_members` をL2 8番目として定義。HRLだけでなく TRL / BRL / GRL / SRL などXRL算定根拠を保持する。
  - L2_DATA / project_registry_diffs / xrl_evidence / notifications に、差分通知、はい/いいえ、コメント、つくよみ学習リスト投入の流れを追記。
- automation / helper:
  - `pwa/scripts/ms_progress_review_tool.mjs` を拡張。LLMは outbox JSON 生成まで、DB反映は deterministic helper `apply-outbox` / `apply-outbox-dir` が担当する。
  - snapshot refreshがsandboxネットワーク制限で落ちても、local snapshotがあれば observation-only review を継続する運用にした。
  - cron内で outbox apply しないようにし、`AMD_OS_AUTOMATION_APPLY_OUTBOX=1` がある時だけ apply する安全弁を追加。
  - LaunchAgent `jp.teamarmada.amd-os-ms-outbox-applier` を作成し、5分ごとに `/Users/masa/.codex/automations/amd-os-ms/outbox` と `/Users/masa/.codex/automations/amd-atlas/outbox` をnon-LLMでapplyする。
- 実適用:
  - `/Users/masa/.codex/automations/amd-os-ms/outbox/20260517-011458-diff-review.json` をapply。notifications 11 / revisions 4 / registryDiffs 2 / xrlEvidence 6。
  - `/Users/masa/.codex/automations/amd-os-ms/outbox/20260517-071504-diff-review.json` をapply。notifications 5 / revisions 0 / registryDiffs 2 / xrlEvidence 3。
  - failed配下に古いoutboxが2件残っているが、後続outboxで大半が再生成済みのため未再適用。
- Atlas:
  - まさが課金回避のため停止済みだった `atlas collect daily` について、PWAの `vercel.json` から `/api/cron/atlas-collect` を削除し、`vercel.disabled-crons.json` に退避。
  - `pwa/scripts/atlas_signal_review_tool.mjs` を追加。`health` / `recent` / `apply-outbox` / `apply-outbox-dir` を持つ。
  - helperの `fetch failed` 対策として static DNS / `https.request` fallback を入れ、`health` と `recent` が通ることを確認。
  - automation `AMD Atlas外部シグナルレビュー` は、healthをhard gateにせず、web/source searchが可能ならoutbox生成まで進むプロンプトへ更新。
- CTB凍結履歴:
  - CTBは一度202412で終了/凍結し、その後再開し、202605で再凍結した。単一の `projects.freeze_from_ym` では表現不能。
  - migration `061_project_freeze_periods.sql` を追加し、`project_freeze_periods` テーブルをlive DBへ適用。
  - CTBに `202501 -> 202604 closed` と `202605 -> null active` の2行を登録。
  - `projects.freeze_from_ym` は現在状態キャッシュとして `202605`、`restart_expected_ym` はnullに更新。
  - `ms_progress_review_tool.mjs` の snapshot / local-snapshot に `projectFreezePeriods` を含めた。
- verification:
  - `node pwa/scripts/ms_progress_review_tool.mjs refresh-snapshot --ym 202605`
  - `node pwa/scripts/ms_progress_review_tool.mjs local-snapshot --project p06 --ym 202605`
  - `node pwa/scripts/atlas_signal_review_tool.mjs health`
  - `node pwa/scripts/atlas_signal_review_tool.mjs recent --hours 48 --limit 5`
  - `launchctl print gui/$(id -u)/jp.teamarmada.amd-os-ms-outbox-applier`
  - `npx vercel --prod --yes --cwd /Users/masa/projects/AMD/amd-os`
  - production alias: `https://amd-os-pwa.vercel.app`
  - deploy id: `dpl_5nkdCtkvhQYuBJfqhB9tSmmmXqAg`

#### 追加実装: PJ略称フレーム三角撤退 / Macrotrend 3D Mindmap / Challenergy表記

- まさレビュー 2026-05-17 continuation:
  - PJ Signal Board子フレーム左上の三角形は再現が不安定なため諦め、代わりに左上の斜めライン自体を太く発光させる。
  - Macrotrend Terrain Map は X/Y軸の意味が弱く「山が並んでいるだけ」に見えるため、社会課題 → 小項目課題 → Seeds/論文数 の3Dマインドマップへ作り直す。
  - Dashboard上のチャレナジー上段表示は `Challenergy`、下段は `株式会社チャレナジー` のままにする。
- `HudControlCenterDashboard.tsx`:
  - `InitialsBayFrameSvg` の三角polygonを削除。
  - 左上カットライン `M17 3 L3 15` を太いcyan発光strokeで上書きし、細い白cyanの芯線を重ねた。
- `supabase-data.ts`:
  - dashboard用表示名normalizeを追加し、`p24` または `チャレナジー` 表記を `Challenergy` に変換。
  - `clientName` は既存DB値をそのまま使うため、下段は `株式会社チャレナジー` のまま。
- `atlas/macrotrends/page.tsx`:
  - Terrain Map実装を削除し、`MacrotrendMindmap` に置換。
  - X軸を `SOCIAL ISSUE -> SUB ISSUE -> PAPERS / SEEDS` に固定し、抽象度の意味を持たせた。
  - Y軸は大項目社会課題の系列、Z方向/発光はAtlas news/story量。
  - `papers_log` をclient側で取得し、各サブ課題の推定ASPI domainに紐づく最新paper_countを表示。
  - selected issueのサブ枝にはSeeds候補を最大3件ずつsatellite表示し、下部stripに active branch の papers / seeds / news を表示。
- verification:
  - `cd /Users/masa/projects/AMD/amd-os/pwa && npm run build` 成功。
  - `cd /Users/masa/projects/AMD/amd-os/pwa && bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` 成功。
  - production alias: `https://amd-os-pwa.vercel.app`
  - production HEAD check: `/hud/dashboard` と `/hud/atlas/macrotrends` は未ログイン時 `307 -> /auth/login?...` を確認。

#### 追加実装: PJ Signal Board役割表示 / Macrotrend展開モーション

- まさレビュー 2026-05-17 continuation:
  - 略称フレームは手作り感が強いため、太線案は撤退。固定サイズのHUDパーツとして画像/一枚絵化する方針を次候補にする。
  - Dashboard PJ Signal Boardは、略称右側の英語PJ名を廃止してPJ番号 (`p21` など) を表示。
  - 下段の正式名称/クライアント名表示を廃止し、`PL / PM / Closer` を表示。
  - Macrotrendは、初期状態を大項目課題ノードの円形配置に変更。
  - 大項目クリックで小項目ノードが展開、小項目クリックでSeeds hubと論文数が浮かぶ状態に変更。
  - ノードはpointer dragで位置移動できるようにした。
- `HudControlCenterDashboard.tsx`:
  - row titleを `project.projectId` に変更。
  - sublineを `project.roleLine` に変更。
  - 略称フレームから太線の手描き感を弱め、gradient stroke + glow filter のシンプルな一体フレームへ寄せた。
- `supabase-data.ts`:
  - `DashProject.roleLine` を追加。
  - `fetchProjectsFromSupabase()` で `project_members` と `members.code_name` を取得し、`PL xx / PM yy / Closer zz` を生成。
- `atlas/macrotrends/page.tsx`:
  - `expandedIssueId` / `expandedSubKey` を導入。
  - 初期状態は大項目課題のみを円形配置。
  - issue clickでsub issueノード、sub clickでpaper/seeds hubとSeed satelliteを表示。
  - R3F pointer eventsで各nodeのdrag offsetを保持し、`AnimatedGroup` で位置変化をlerp。
- verification:
  - `cd /Users/masa/projects/AMD/amd-os/pwa && npm run build` 成功。
  - `cd /Users/masa/projects/AMD/amd-os/pwa && bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` 成功。
  - production alias: `https://amd-os-pwa.vercel.app`
  - production HEAD check: `/hud/dashboard` と `/hud/atlas/macrotrends` は未ログイン時 `307 -> /auth/login?...` を確認。

#### 追加実装: 生成HUDフレーム採用 / Macrotrend 2D Force Map化

- まさレビュー 2026-05-17 continuation:
  - 略称フレーム/PJフレームを画像生成toolで生成し、生成案を表示。品質OKのため採用方向。
  - PJフレームは初回生成が横幅不足だったため、横長専用フレームを追加生成し、repo/publicへ保存。
  - Macrotrend 3Dはドラッグ時にカメラが動き操作しづらいため、Atlas Mapと同じ2D force graphへ戻す。
  - 子ノード展開済みの状態で他ノードをクリックしても閉じないよう、展開状態はSetで蓄積。
  - 子ノード出現が一瞬すぎる問題は、force simulation再加熱 + link directional particles + node pulseで展開感を強める。
- generated assets:
  - source sheet: `/Users/masa/.codex/generated_images/019e3526-6ddf-7ac3-aa50-96602be0a39b/ig_0e88f4959d28c6a4016a099969b8f08191b30cdc4326006a9e.png`
  - repo copy: `pwa/design/assets/hud_signal_frames_generated_20260517.png`
  - initials public asset: `pwa/public/hud/hud_initials_frame_generated_20260517.png`
  - wide row source: `/Users/masa/.codex/generated_images/019e3526-6ddf-7ac3-aa50-96602be0a39b/ig_0e88f4959d28c6a4016a099a71397c8191b0da30ae1e04ea52.png`
  - wide row public asset: `pwa/public/hud/hud_project_row_frame_wide_cropped_20260517.png`
- `HudControlCenterDashboard.tsx`:
  - `ProjectRowFrameSvg` をgenerated row frame `<img>` に差し替え。
  - `InitialsBayFrameSvg` をgenerated initials frame `<img>` に差し替え。
- `atlas/macrotrends/page.tsx`:
  - `ForceGraph2D` を導入。
  - 初期表示はissueノードのみ。
  - issue clickでsub issue nodesを追加、sub clickでseedHub + seed nodesを追加。
  - `expandedIssueIds` / `expandedSubKeys` は閉じずに蓄積。
  - drag endでnodeをpinできる。
- verification:
  - `cd /Users/masa/projects/AMD/amd-os/pwa && npm run build` 成功。
  - `cd /Users/masa/projects/AMD/amd-os/pwa && bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` 成功。
  - production alias: `https://amd-os-pwa.vercel.app`
  - production HEAD check: `/hud/dashboard` と `/hud/atlas/macrotrends` は未ログイン時 `307 -> /auth/login?...` を確認。

#### 追加実装: PJ Signal Board一体型生成フレーム採用

- まさレビュー 2026-05-17 continuation:
  - 略称フレームとPJフレームが別物に見える問題は、略称ベイ込みのPJ row frameを画像生成して一体化する方針でOK。
  - PJフレームの斜めラインが大きすぎる違和感を避けるため、略称ベイと外枠の斜め角度を揃えた生成フレームへ差し替え。
- generated assets:
  - chroma source: `pwa/design/assets/hud_project_row_integrated_frame_chroma_20260517.png`
  - alpha source: `pwa/design/assets/hud_project_row_integrated_frame_alpha_20260517.png`
  - cropped public asset: `pwa/public/hud/hud_project_row_integrated_frame_alpha_cropped_20260517.png`
- `HudControlCenterDashboard.tsx`:
  - `ProjectRowFrameSvg` を略称ベイ込みのgenerated row frame `<img>` に差し替え。
  - PJ Signal Board row内では `InitialsBayFrameSvg` の重ね置きを廃止し、画像側の略称ベイにlive textだけを重ねる。
  - row高さを `min-h-[78px]` に拡大し、略称ベイ内の `SX` / `CX` などが収まるよう列幅を再調整。
- verification:
  - `cd /Users/masa/projects/AMD/amd-os/pwa && npm run build` 成功。
  - `cd /Users/masa/projects/AMD/amd-os/pwa && bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` 成功。
  - production alias: `https://amd-os-pwa.vercel.app`
  - production HEAD check: `/hud/dashboard` は未ログイン時 `307 -> /auth/login?...` を確認。

#### 追加実装: Next Action Queue略称フレーム統一 / AAA demo signal

- まさレビュー 2026-05-17 continuation:
  - 一体型PJ row frameの略称ベイだけを切り抜き、Next Action Queueの略称frameにも適用。
  - PJ Signal Boardの略称フレーム右側の空きが広いため、grid先頭列を詰めてPJ番号/役割ラインを左寄せ。
  - イベント表示用に `AAA` demo signalを作り、Project Signal Board最上段に固定表示。
- generated assets:
  - initials crop public asset: `pwa/public/hud/hud_initials_frame_integrated_crop_alpha_20260517.png`
- `HudControlCenterDashboard.tsx`:
  - `InitialsBayFrameSvg` を一体型PJ row frameから切り抜いた画像へ差し替え。
  - Next Action Queue itemの左padding/略称frameサイズを新しい略称ベイに合わせて調整。
  - `demoSignalProject` (`p00` / `AAA`) と `demoScoreHistory` を追加。
  - `buildSignals()` は通常PJの前にAAAを挿入し、sortでもAAAを先頭pin。
  - AAAのsparklineは 2年間で `1,000 -> 20,000` に伸びるdemo history、Signal Board sparkline右上に最新値を表示。
- current PJ Signal Board sort:
  - `AAA` demo signal は常に先頭。
  - それ以外は `active` statusを先、その後 `projectName.localeCompare(..., "ja")`。
  - 非activeは `Non Active Projects` 折りたたみ内に同じ並びで表示。
- verification:
  - `cd /Users/masa/projects/AMD/amd-os/pwa && npm run build` 成功。
  - `cd /Users/masa/projects/AMD/amd-os/pwa && bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` 成功。
  - production alias: `https://amd-os-pwa.vercel.app`
  - production HEAD check: `/hud/dashboard` は未ログイン時 `307 -> /auth/login?...` を確認。

#### 追加実装: AAA demo cockpit / AMD Score detail

- まさレビュー 2026-05-17 continuation:
  - `AAA` demo signalが見えるようになったため、イベント用にcockpit pageとscore detail pageもdummy dataだけで作成。
  - demo PJ番号は `p99`。
- `demo-aaa-data.ts`:
  - `AAA_PROJECT_ID = "p99"`。
  - `aaaCockpitData`: Autonomous Adaptive Assembly のcockpit用dummy data。MS、月次、tasks、nudges、member activitiesを含む。
  - `aaaScoreInputs`: 2024-06から24か月分のAMD Score input dummy data。AMD支援2年で `1,000 -> 20,000` classへ伸びる想定。
  - `aaaVenture`: AMD Score detail用のventure dummy data。
- `hud/project/[projectId]/cockpit/page.tsx`:
  - `p99` の場合はSupabase取得をバイパスし、専用のHUD demo cockpitを描画。
  - demo cockpitから `/venture-map/amd-score/p99` へ遷移可能。
- `venture-map/amd-score/[projectId]/page.tsx`:
  - `p99` の場合はDBを読まず、`AmdScoreView` にdemo venture + demo score inputsを渡す。
- `AmdScoreView.tsx`:
  - `p99` のscore detailから戻るcockpit linkだけ `/hud/project/p99/cockpit` に変更。
- `HudControlCenterDashboard.tsx`:
  - AAA row click先を `/hud/project/p99/cockpit` に変更。
- verification:
  - `cd /Users/masa/projects/AMD/amd-os/pwa && npm run build` 成功。
  - `cd /Users/masa/projects/AMD/amd-os/pwa && bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` 成功。
  - production alias: `https://amd-os-pwa.vercel.app`
  - production HEAD check: `/hud/project/p99/cockpit` と `/venture-map/amd-score/p99` は未ログイン時 `307 -> /auth/login?...` を確認。

#### 追加実装: AAA score整合 / cockpit mock寄せ開始

- まさレビュー 2026-05-18:
  - AAAのscore historyが等間隔かつ滑らかすぎるため、SX graphのように不規則な日付間隔と上下の揺れを持つ時系列へ変更。
  - AAAのAMD Scoreを `28,522` に変更。
  - Dashboard上のAAAは `M=12.44 / X=127.234 / F=18.02` とし、`M × X × F = 28,522` になるよう統一。
  - AAA cockpit内にも同じM/X/Fバーを追加。
  - `/Users/masa/Downloads/cockpit.png` は存在しなかったため、repo内の `pwa/design/assets/hud_cockpit_generated_mock_full_20260517.png` を基準にcockpit HUD化を開始。
- `demo-aaa-data.ts`:
  - `aaaDemoMxf` を追加し、AAA dashboard/cockpitのM/X/F/score正本にした。
  - `aaaScoreHistory` を不規則に上下する24点へ変更。終端は `28,522`。
  - `aaaScoreDates` を不規則な日付間隔へ変更。
  - `aaaScoreInputs` はscore historyから逆算したaxis levelで生成し、score detailの最新値も `28,522` になるようにした。
- `HudControlCenterDashboard.tsx`:
  - AAA rowは `aaaDemoMxf` / `aaaScoreHistory` を参照。
  - AAAのM/X/Fだけ小数表示にして、他PJの整数丸めは維持。
- `hud/project/[projectId]/cockpit/page.tsx`:
  - AAA cockpit上部をmock寄せのHUD headerへ変更。
  - 略称ベイ、PROJECT ID、CLIENT/STATUS/CONFIG/PM/TEAM/LAST UPDATE、AMD SCORE枠、M/X/F signal cardsを追加。
  - cockpit内のtrend chartは日付ベースのx座標へ変更し、等間隔に見えないようにした。
- verification:
  - `cd /Users/masa/projects/AMD/amd-os/pwa && npm run build` 成功。
  - `cd /Users/masa/projects/AMD/amd-os/pwa && bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` 成功。
  - `12.44 * 127.23447687635391 * 18.02 = 28,522` を確認。
  - production alias: `https://amd-os-pwa.vercel.app`
  - production HEAD check: `/hud/dashboard`、`/hud/project/p99/cockpit`、`/venture-map/amd-score/p99` は未ログイン時 `307 -> /auth/login?...` を確認。

#### 追加修正: AAA cockpitを共通HUD cockpitへ復帰

- まさレビュー 2026-05-18:
  - AAAだけ別仕様のcockpitになっていたため、全PJ cockpit UI改修の前提としてAAAも現行の共通HUD cockpitへ戻す。
  - 今後のcockpit mock寄せはAAA専用UIではなく、全PJ共通の `/hud/project/[projectId]/cockpit` 側で進める。
- `hud/project/[projectId]/cockpit/page.tsx`:
  - `p99` 専用の `AaaDemoCockpit` / `AaaSignalCard` を削除。
  - `p99` の場合だけSupabase取得をbypassし、`demo-aaa-data.ts` の `aaaCockpitData` を共通 `HudCockpitView` に渡す形へ変更。
  - 通常PJは従来通り `fetchCockpitFromSupabase(projectId)` とPM権限判定を使う。
- verification:
  - `cd /Users/masa/projects/AMD/amd-os/pwa && npm run build` 成功。
  - `cd /Users/masa/projects/AMD/amd-os/pwa && bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` 成功。
  - production alias: `https://amd-os-pwa.vercel.app`

#### 追加実装: 共通HUD cockpit mock寄せ pass 1

- まさレビュー 2026-05-18:
  - AAAを共通cockpitに戻したので、次に全PJ共通の `/hud/project/[projectId]/cockpit` を `hud_cockpit_generated_mock_full_20260517.png` に寄せる。
- `HudCockpitHeader.tsx`:
  - 旧い小型headerを廃止し、モックの横長command headerへ変更。
  - 左に略称/IDベイ、中央に `PROJECT COCKPIT v2.6.0` / PJ名 / client名、右に CLIENT / STATUS / CONFIG / TEAM / CURRENT YM / DB のtelemetry blockを配置。
  - 右端に `ID: 001` / admin / CONFIG / ROLE / MODE の小型terminalを追加。
- `HudCockpitView.tsx`:
  - 全体最大幅を `1540px` へ拡大し、モック寄りの横長2カラム (`main + 286px ops rail`) に再構成。
  - Venture Status、Milestone Matrix、Next Period Setup、Task Control、Monthly List、Meeting Summary、Routine、NudgeをHUD panel wrapperで包み、角切りフレーム/上部斜線チップを共通付与。
  - MSとNext Periodを横並び、MonthlyとMeeting Summaryを横並びにして、縦積みカード感を弱めた。
- `hud/project/[projectId]/cockpit/page.tsx`:
  - route上部の補助headerを削除し、共通cockpit自体が画面先頭になるよう変更。
- verification:
  - `cd /Users/masa/projects/AMD/amd-os/pwa && npm run build` 成功。
  - `cd /Users/masa/projects/AMD/amd-os/pwa && bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` 成功。
  - production alias: `https://amd-os-pwa.vercel.app`
  - production HEAD check: `/hud/project/p99/cockpit` は未ログイン時 `307 -> /auth/login?...` を確認。

#### 追加実装: 共通HUD cockpit 自己レビュー pass 2

- えいみ自己レビュー:
  - 実画面をChromeで `/hud/project/p99/cockpit` に開き、mockと比較。
  - 最大差分は、mockのヘッダー直下にある `M/X/F score cards + AMD Score Trend + AMD Score State + Risk/Status` rowが実画面に無いこと。
  - MS matrix / monthly / routineの密度調整より先に、読み始めのsignal stripを復活させる方がfidelityに効くと判断。
- `HudCockpitView.tsx`:
  - `HudCockpitSignalStrip` を追加。
  - `M / X / F` raw contribution card、score trend SVG、score dial、risk/status panelを共通cockpit header直下に配置。
  - `p99` は `demo-aaa-data.ts` の `aaaDemoMxf` / `aaaScoreHistory` を正本に使用。
  - `p21/p06/p20` はdashboard表示と同じorder感の暫定snapshotを表示し、それ以外は `NO DATA` fallback。
- verification:
  - `cd /Users/masa/projects/AMD/amd-os/pwa && npm run build` 成功。
  - `cd /Users/masa/projects/AMD/amd-os/pwa && bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` 成功。
  - production alias: `https://amd-os-pwa.vercel.app`

#### 追加実装: 共通HUD cockpit 自己レビュー pass 3

- えいみ自己レビュー:
  - mockでは `Milestone Matrix` がMS ID / title / pt / owner / share / role / period / sub itemsの表として最初から読める。
  - 実画面は折りたたみ前提で、表ではなくheaderだけに見えやすかったため、操作UIよりHUD readabilityを優先して固定表へ変更。
  - mock右端の `Step Modal Stack` が通常画面から見えるのに、実画面ではroutine内に埋もれていた。
  - mock下部の `Monthly Modal` が、通常状態でも大きな操作盤として存在していたため、現在月のmodal previewを常設した。
- `HudCockpitGoalsCompact.tsx`:
  - Annual/Routine/Bufferの縦リストを、`MS ID / MS Title / Pt / Owner / Share / Role / Period / Sub Items` の固定tableへ変更。
  - 下部に `Weighted MS Average` barを追加。
- `HudCockpitView.tsx`:
  - `HudStepModalStack` を追加し、右railに Budget / Meeting / Report / Invoice / Invoice Send の小型step stackを常時表示。
  - `HudMonthlyModalPreview` を追加し、現在月の Progress Check / Report / Invoice previewを下段に常設。
  - 既存の実モーダルは壊さず、previewの `OPEN` から従来の `HudCockpitMonthlyModal` を開ける。
- verification:
  - `cd /Users/masa/projects/AMD/amd-os/pwa && npm run build` 成功。
  - `cd /Users/masa/projects/AMD/amd-os/pwa && bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` 成功。
  - production alias: `https://amd-os-pwa.vercel.app`

#### 追加実装: 共通HUD cockpit 自己レビュー pass 4

- まさ指示:
  - deploy -> えいみ実画面チェック -> mock差分修正を止めずに繰り返す。
  - CSSだけで近づかないときは画像生成をサボらず使う。
- image generation:
  - CSS header frameは手作り感と文字重なりが残ったため、空のPJ cockpit header frameを画像生成。
  - generated source: `pwa/design/assets/hud_cockpit_header_frame_clean_chroma_20260518.png`
  - chroma key removal後のproject asset:
    - `pwa/public/hud/hud_cockpit_header_frame_clean_alpha_trim_20260518.png`
    - `pwa/design/assets/hud_cockpit_header_frame_clean_alpha_trim_20260518.png`
- `HudCockpitHeader.tsx`:
  - 新しい透明PNGの横長HUD frameを背景に使用。
  - 略称ベイ、PJ名、STATUS/CONFIG/TEAM/CURRENT YM、OPS/DB/CONFIGをReact overlayで再配置。
  - 生成画像内の疑似テキストとReact文字が衝突しないよう、blank frame assetへ置換。
- `HudCockpitGoalsCompact.tsx`:
  - `Weighted MS Average` をsub item完了数ではなく、月次progress raw値から計算するよう変更。
  - AAAでは `79%` がMS matrix下部に出る。
- `HudCockpitView.tsx`:
  - 右railの `HudStepModalStack` をroutineより上に移動。
  - disabled HTML属性でstep buttonsが実画面上クリップ/不可視化されていたため、`aria-disabled` + click guardへ変更。
  - Step stack親の高さを明示し、button列が `overflow-hidden` で切れないように修正。
- verification:
  - `cd /Users/masa/projects/AMD/amd-os/pwa && npm run build` 成功。
  - `cd /Users/masa/projects/AMD/amd-os/pwa && bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` 成功。
  - Chromeで `https://amd-os-pwa.vercel.app/hud/project/p99/cockpit` を確認。
  - ヘッダーの生成HUD frame、M/X/F strip、AMD Score 28,522、MS Matrix 79%、右rail Step Modal Stackが実画面で表示されることを確認。

#### 追加実装: HUD dashboard / Macrotrend mindmap pass 5

- まさ指示:
  - cockpit 2段目も画像生成で寄せる。
  - dashboardのPJカードから `PL / PM / Closer` を削除し、右端にStudio Core KPIと同じ中心空きの `先手力` indicatorを追加。
  - next action queueの略称フレームが少し大きく下にはみ出るため縮小。
  - Macrotrend mindmapはAtlas Map寄りに、背景dragで全体pan、node dragで隣接nodeも引っ張る。Seedsの論文数はSeed nodeにせず小項目node上の数字にする。
- image generation:
  - cockpit signal stripの空フレームを画像生成し、chroma key除去/trim後に配置。
  - generated source: `pwa/design/assets/hud_cockpit_signal_strip_chroma_20260518.png`
  - project asset:
    - `pwa/public/hud/hud_cockpit_signal_strip_alpha_trim_20260518.png`
    - `pwa/design/assets/hud_cockpit_signal_strip_alpha_trim_20260518.png`
- `HudCockpitView.tsx`:
  - `HudCockpitSignalStrip` を生成PNG背景 + React overlayへ変更。
  - M/X/F cards、AMD Score Trend、AMD Score State、Risk/Statusを生成フレーム内の6 bayに配置。
- `HudControlCenterDashboard.tsx`:
  - `ProjectSignalRow` の `PL / PM / Closer` 行を削除し、client / project label表示へ変更。
  - row右端へ `ProjectInitiativeRing` を追加。AAAは `96`、他PJは既存signal scoreとdeterministic fallbackから算出。
  - row gridを詰め、score / sparkline / initiativeが横並びで収まるよう調整。
  - next action queueの略称フレームを `74x44` 相当から `62x36` 相当へ縮小。
- `MacrotrendMindmap`:
  - react-force-graph-2d化を試したが本番Chromeでcanvasが透明になったため、確実に表示される2D custom mapへ切り替え。
  - 初期状態は大項目nodeを円形配置。
  - 大項目clickで小項目nodeを追加、小項目clickで関連Seed nodeを追加。展開済みnodeは閉じない。
  - 空白dragでmap全体をpan。
  - node dragで対象nodeと隣接nodeを連動移動。
  - paper_countはSeed hub/nodeを作らず、小項目node上に `NN papers` として表示。
- verification:
  - `cd /Users/masa/projects/AMD/amd-os/pwa && npm run build` 成功。
  - `cd /Users/masa/projects/AMD/amd-os/pwa && bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` 成功。
  - Chromeで `https://amd-os-pwa.vercel.app/hud/dashboard` を確認。PJ card右端の先手力ring、PL/PM/Closer削除、next action queue略称フレーム縮小を確認。
  - Chromeで `https://amd-os-pwa.vercel.app/hud/atlas/macrotrends` を確認。mindmap node表示、大項目click後のpaper_count付き小項目node表示を確認。

#### 追加実装: HUD Project Signal Board / cockpit / management score fidelity pass

- まさレビュー 2026-05-19:
  - PJ rowの生成frame内で、M/X/F bar、折れ線graph、AMD SCORE、先手力ring、PL/PM/Closerの位置がブラウザ幅で崩れる問題を継続修正。
  - cockpit header / signal stripの円frameがブラウザ幅変更で楕円化する問題を、DOM overlayではなく画像frameのaspect ratio維持で修正。
  - Dashboard左上の `STUDIO HEALTH` を `AMD MANAGEMENT SCORE` に変更し、`amd_management_score_snapshots` 最新行を読む構成へ変更。
- `HudControlCenterDashboard.tsx`:
  - Project Signal Board rowを生成PNG frame + React overlay方式に整理。
  - M/X/Fは棒グラフゾーン内に収まるよう、label/value固定 + bar可変へ調整。
  - 折れ線SVGが横に伸びない原因は `viewBox` defaultの縦横比維持だったため、`preserveAspectRatio="none"` を追加。
  - DOMで追加した縦区切り線は、生成画像内の線と重なり4本化したため削除。
  - AMD SCOREは折れ線ゾーン内の右カラムへ統合し、余白込みの大きな独立objectにならないよう縮小。
  - NO SCORE objectは、棒グラフゾーン + 折れ線/scoreゾーンの実幅へ寄せて縮小。
  - 右端zoneは先手力ringとPL/PM/Closerが右端に張り付きすぎないよう左へ寄せた。
- `HudCockpitHeader.tsx` / `HudCockpitView.tsx`:
  - 円frameをDOM/SVGで上書きするscrub overlayを削除。
  - generated header frame / signal strip frameは `aspect-ratio` 優先にし、`min-height` による縦横比破壊を避ける。
- `HudCockpitVentureStatus.tsx`:
  - AAA cockpitでもSXと同系のventure status graphを表示するため、p99時はp21のventure status / score inputを取得してAAA cloneへ変換。
- `amd-score-derived.ts` / `demo-aaa-data.ts`:
  - dashboard/cockpit/score detailのscore計算を同一derived helperへ寄せた。
  - AAAの旧dummy scoreを削除方向にし、P99-AAAはSXのM/X/Fを1.05倍したdemo cloneとして扱う。
- verification:
  - `cd /Users/masa/projects/AMD/amd-os/pwa && npx tsc --noEmit` 成功。
  - `cd /Users/masa/projects/AMD/amd-os/pwa && npx eslint src/components/hud/HudControlCenterDashboard.tsx` はerrorなし、既存 `<img>` warningのみ。
  - `cd /Users/masa/projects/AMD/amd-os/pwa && npm run build` 成功。
  - `cd /Users/masa/projects/AMD/amd-os/pwa && bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` 成功。
  - Browserで `https://amd-os-pwa.vercel.app/hud/dashboard/embed` を1600幅中心に確認。未ログインembedはNO SCORE表示のため実データ折れ線までは確認不可だが、row frame / no score / right zoneの幅は確認済み。

#### 次回予定: Macrotrend fidelity pass

- まさ指示 2026-05-19:
  - Macrotrendはマインドマップ的コンテンツが主役なので、文字説明を下げ、mindmapをより上に表示する。
  - 5テーマ分類の根拠を、根拠資料つきで説明する。
  - Macrotrend mapの動作をAtlas Mapと同じ仕様にする。node dragで隣接nodeも引っ張る、空白dragでmap全体pan、展開済みnodeは閉じない、motion feelを揃える。

#### 追加実装: Macrotrend fidelity pass

- まさ指示 2026-05-19:
  - マインドマップをfirst viewport上位へ移動し、文字説明・根拠説明は下へ移動。
  - 5テーマ分類の理由を、既存md / DB / seed設計、UN SDGs、WEF Global Risks Report 2026、ASPI / OpenAlex mapping を確認して説明。
  - Macrotrend mapのdrag / pan / click展開をAtlas Mapへ寄せる。Seedsは全部node化せず、小項目node上に論文数を表示。
- `atlas/macrotrends/page.tsx`:
  - headerを短くし、`MacrotrendMindmap` を最上段の主コンテンツに変更。issue selectorを右railへ移動。
  - Selected Issue詳細、coverage basis、source claims、Atlas/Divergence/Seeds panelsはmap下へ移動。
  - `Why Five Themes` セクションを追加。UN 2030 Agenda / WEF Global Risks Report 2026 / ASPI Critical Technology Tracker / OpenAlex Works API のsource cardと、各themeのSDG/WEF tag、ASPI lane、live evidence countsを表示。
  - 初期表示で選択中issueを展開し、他issueをclickしても既存展開は閉じないようにした。
  - 空白dragでmap pan、node dragで隣接nodeを `0.38` ratioで連動移動。drag中はtransitionを切り、click後は600ms easingへ寄せた。
  - Seed node生成を廃止し、小項目node上に `NN papers` / `seeds N` を表示。具体Seedsは下段panelから辿る。
  - 未使用になっていた3D / react-force-graph 実験コードとimportを削除。
- 根拠確認:
  - repo docs: `pwa/design/macrotrend_atlas_seeds_architecture.md`, `pwa/design/aspi_lanes.md`, `pwa/design/db_schema.md`, `pwa/src/lib/aspi-lanes.ts`。
  - live DB counts: `atlas_signals=668`, `atlas_stories=219`, `atlas_divergences=54`, `seeds=148`, `papers_log=128`。latest `papers_log` は 8 ASPI lane すべて `2026-04-01` 行あり。
- verification:
  - `cd /Users/masa/projects/AMD/amd-os/pwa && npx tsc --noEmit` 成功。
  - `cd /Users/masa/projects/AMD/amd-os/pwa && npm run build` 成功。
  - `cd /Users/masa/projects/AMD/amd-os/pwa && bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` 成功。
  - production alias: `https://amd-os-pwa.vercel.app`
  - production HEAD check: `/hud/dashboard` と `/hud/atlas/macrotrends` は未ログイン時 `307 -> /auth/login?...` を確認。
  - Browserで `http://localhost:3100/hud/atlas/macrotrends` を開いたが、in-app browserは未ログインのため `/auth/login?next=...` へredirect。認証後実画面確認が必要。

#### 追加実装: Macrotrend ASPI 8 taxonomy alignment

- まさレビュー 2026-05-19:
  - 元文献は5分類を明確に定義しているわけではなく、WEFは33 risksのnetwork、UNは17 goals / 169 targetsである。
  - AMD Score / M算定ではASPI 8 domainを使っているため、Macrotrendだけ別の5分類を正本化する理由が弱い。
  - 以後は、まさの指摘にそのまま反応する前に、既存の正本体系・DB設計・算定ロジックと整合するかを一段メタに確認する。
- `CLAUDE.md`:
  - `メタ判断セルフチェック` を追加。UI都合で新分類/新概念を増やしていないか、既存体系と整合するか、まさより一段メタに見て方向が良いかを自問してから回答・実装するルールを明記。
- `pwa/design/macrotrend_atlas_seeds_architecture.md`:
  - primary taxonomyをASPI Critical Technology Tracker 8 domainに揃える方針へ修正。
  - UN SDGs / WEF Global Risks Report 2026は上位分類ではなく、ASPI domain nodeに重ねるrisk / issue networkとして扱う。
  - 旧5テーマは正本分類ではなく、必要ならAMD focus preset / 表示フィルタに格下げ。
- `pwa/src/app/(app)/atlas/macrotrends/page.tsx`:
  - Macrotrend top nodeを5 issueからASPI 8 domainへ変更。
    - `advanced_ict`
    - `advanced_materials_manufacturing`
    - `ai_technologies`
    - `biotechnology`
    - `defence_space_robotics_transport`
    - `energy_environment`
    - `quantum`
    - `sensing_timing_navigation`
  - 各domainにASPI tech cluster由来のsub issue nodeを配置し、cross-domain edgeを薄線で表示。
  - `Why Five Themes` を廃止し、`Taxonomy Alignment` としてASPI 8がM算定・`papers_log`・`macro_index_log`・`project_ventures.lanes` と揃うことを説明。
  - Atlas domain prefix / legacy seed lane → ASPI domain mappingを使って、live evidence countsを8domain側へ寄せた。
  - node drag後にclick展開が発火しないよう、drag移動量がthresholdを超えたpointerでは次のclickを抑止。
- verification:
  - `cd /Users/masa/projects/AMD/amd-os/pwa && npx tsc --noEmit` 成功。
  - `cd /Users/masa/projects/AMD/amd-os/pwa && npm run build` 成功。
  - `cd /Users/masa/projects/AMD/amd-os/pwa && bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` 成功。
  - production alias: `https://amd-os-pwa.vercel.app`
  - production HEAD check: `/hud/dashboard` と `/hud/atlas/macrotrends` は未ログイン時 `307 -> /auth/login?...` を確認。
  - Playwrightで `https://amd-os-pwa.vercel.app/hud/atlas/macrotrends` を開き、未ログイン時 `/auth/login?next=%2Fhud%2Fatlas%2Fmacrotrends` へredirectすることを確認。ログイン済み実画面での最終目視は未実施。

#### 追加実装: Macrotrend initial child-node open pass

- まさレビュー 2026-05-20:
  - ASPI 8 domain + sub issue nodeの量なら、最初から子nodeまで開いた状態のほうがよい。
- `atlas/macrotrends/page.tsx`:
  - `expandedIssueIds` の初期値を全ASPI domainに変更し、データ更新時も全domainが展開済みになるよう同期。
  - ASPI 8 domain配下のsub issue nodeを初期表示からすべて出す。
  - 全展開時に上下が切れにくいよう、domain ring半径を `286 -> 236`、child radiusを `78` に調整。
  - helper textを「open by default」前提へ更新。
- `macrotrend_atlas_seeds_architecture.md` / `HANDOFF_pwa_rebuild.md`:
  - Macrotrend mapはcollapse/expandではなく、初期全表示 + pan / drag / selectを主操作にする方針へ更新。

#### 追加実装: Macrotrend decision map / reimbursement PWA / notifications admin-only

- まさレビュー 2026-05-20:
  - Macrotrend mapは大分類/中分類を見るだけだと情報量が薄い。目的は「世界変化の説明」ではなく「AMDが次に掘る領域を決める」こと。
  - Swift版だけになっていた立替精算をPWAにも戻す。領収書添付も必要。
  - 通知がadmin以外にも見えて既読化されている疑いがあるため、誰が見られるか確認し、admin-onlyへ締める。
- `atlas/macrotrends/page.tsx`:
  - ASPI 8 domain + issue nodeのmapに `papers` / `news` / `diff` / `seeds` / `momentum` / `coverage` / `gap` を追加。
  - 選択したissue nodeの右panelに `Seed search` / `Japan gap review` / `Atlas synthesis` / `Venture thesis` / `Evidence watch` のAMD actionを表示。
  - dragは位置調整として扱い、drag後click選択は抑止。
- `reimburse/page.tsx`:
  - PWAから立替の新規申請 / submitted状態の編集・削除を復活。
  - PJ、発生日、費目、税込金額、税率、摘要、交通費詳細をSwift版に合わせて入力可能。
  - 領収書添付はprivate Storage bucket `reimbursement-receipts` に保存し、`reimbursements.receipt_storage_paths` / `receipt_file_names` へ保持。
  - PM承認待ち (`submitted`) とadmin承認待ち (`pmApproved`) をPWA上で処理可能にした。
- Supabase migration:
  - `065_reimbursement_receipts.sql` 適用済み。receipt columns + private bucket + authenticated own-folder upload policy。
  - `066_notifications_admin_only.sql` 適用済み。`l2_notifications` / `meeting_notifications` / `app_notifications` / `l2_feedbacks` を `members.is_admin=true` のadmin authenticated限定へ変更。
- 通知DB確認:
  - admin: `まさ <masa@team-armada.jp>`, `きよ <kyoko@team-armada.jp>`。
  - active non-admin 11名は旧RLSでは直URL/API経由で読める状態だった。anonもSELECT可能だった。
  - migration後、anon clientで4テーブルすべて `permission denied` を確認。
  - 既読戻し: `l2_notifications=87`, `meeting_notifications=10`, `app_notifications=35` の既読を未読へ戻した。
  - 現状、既読は削除されずDBに蓄積し続ける。UIは最新100件 + 既読折りたたみ。
- verification:
  - `cd /Users/masa/projects/AMD/amd-os/pwa && npx tsc --noEmit` 成功。
  - `cd /Users/masa/projects/AMD/amd-os/pwa && npm run build` 成功。
  - `cd /Users/masa/projects/AMD/amd-os/pwa && bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` 成功。
  - production alias: `https://amd-os-pwa.vercel.app`
  - production HEAD check: `/hud/dashboard`, `/reimburse`, `/hud/notifications`, `/hud/atlas/macrotrends` は未ログイン時 `307 -> /auth/login?...` を確認。

#### 追加修正: reimbursement server-side save / notification read_at split

- まさレビュー 2026-05-20:
  - PWAから立替精算の登録がまだできない。
  - 通知は未読へ戻したはずなのに、画面上では未読なしに見える。
  - 通知詳細の「はい」「いいえ」ボタンも見えない。
- `reimburse/page.tsx` / `/api/reimbursements`:
  - browser direct INSERT / Storage uploadをやめ、申請/編集はserver-side API経由に変更。
  - API側でログインuserを確認し、service_roleで `reimbursements` INSERT/UPDATE と private bucket `reimbursement-receipts` uploadを行う。
  - RLS/Storage policy差異でPWA登録が止まるリスクを下げた。
- `067_notification_read_at_split.sql`:
  - `l2_notifications.read_at` / `meeting_notifications.read_at` を追加。
  - `notified_at` はiOS/APNs配信済み marker、`read_at` はPWA上の人間既読 markerとして分離。
  - 既存 `read_at` は全NULLへ戻し、PWA未読数を `l2=87`, `meeting=10`, `app=51` へ復旧。
- `NotificationsClient` / `GlobalNav` / `Dashboard`:
  - PWA未読カウント・未読フィルタ・未読に戻す操作を `read_at` 基準へ変更。
  - 回答ボタンを `はい・反映` / `いいえ・不採用` / `コメントだけ送信` として明示。

#### 追加修正: notification answered state

- まさレビュー 2026-05-20:
  - 通知で「はい」を押した後も「はい」「いいえ」が表示され続けるのが不自然。
  - 回答した通知は未読ではなく既読側へ移動してほしい。
- `NotificationsClient`:
  - `answeredMap` を追加し、送信成功後は当該通知を `回答済み` 表示へ切り替える。
  - 既存 `l2_feedbacks` が紐づく通知も回答済み扱いにして、回答ボタンを再表示しない。
  - 送信成功時に `read_at` を更新し、未読フィルタから外して既読セクションを開く。

#### 追加修正: answered tab / protocol notification split / ended PJ on HUD

- まさレビュー 2026-05-20:
  - 回答した通知は `回答済み` タブへ移動してほしい。
  - AMDプロトコル candidate は3件まとめではなく、1件ずつ個別通知にしてほしい。
  - HUD版OSで `ended` ステータスのPJも Project Signal Board 本体に表示したい。
- `NotificationsClient`:
  - `回答済み` タブを追加。`[はい]` / `[いいえ]` / コメント feedback がある通知は未対応/未読から外し、回答済み側へ表示。
  - protocol通知の `scope_key=YYYYMM:protocol:<protocol_id>` を解釈し、該当 protocol_id の `protocols` + `protocol_examples` だけを詳細表示。
- `gas/155_L2KnowledgeExtractor.js`:
  - protocol notification を `project_id + ym` 集約から、`scope_key=YYYYMM:protocol:<protocol_id>` の1候補1通知へ変更。
  - 月次再抽出時は `YYYYMM:protocol:*` の個別 feedback も `_l2_loadFeedbackBlock_` で取り込む。
  - `npx @google/clasp push` は Google 再認証 `invalid_rapt` で未反映。再ログイン後に push 必要。
- `HudControlCenterDashboard`:
  - Project Signal Board 本体の表示対象を `active` + `ended` に変更。
  - `active` と `ended` を混ぜて AMD SCORE 高スコア順に表示。
  - `sales` / `draft` / `frozen` / `lost` / unknown は `Other Project Files` 折りたたみへ移動。

#### 追加実装: Operations Settings / score input row consistency

- まさレビュー 2026-05-20:
  - LSTの経営会議データ収集タイミングを聞いた流れで、OSの設定ページに Raw Data / L2 Data / cron頻度 / 手動cron実行を一覧化したい。
  - ended PJのLSTで、M/X/F数値が見えないのにスコアが出ているように見える。
- `/settings`:
  - `OperationsSettingsClient` を追加し、Raw Data sources / L2 datasets / Cron Control をadmin-onlyで表示。
  - cron operation catalog (`operations-catalog.ts`) を新設。GAS runFunc と PWA cron routeを同じUIから選べるようにした。
  - Run Params textareaで `{"args":[...]}` / `{"query":{...}}` を編集し、`Run Now` で `/api/settings/cron-run` を叩く。
  - server-sideでadmin確認後、GASは `mode=pwaApi&action=runFunc`、PWAは `Authorization: Bearer CRON_SECRET` を付けて実行する。
- AMD Score:
  - p07 LSTの `amd_score_inputs` をDB確認。`2026-04-30` のlatest visible rowは `mu_a=7, mu_i=7, mu_g=8, trl=7, brl=7, grl=6, srl=7, hrl=7, frl=8` で、解析済み。
  - `2026-05-31` rowも存在するが、現在日付 `2026-05-20` 時点のUIでは future row として除外される。
  - `latestVisibleScorableScoreInput` を追加し、HUD signal metrics / AMD Score detail が「今日以前かつ μ_A/μ_I/μ_G がある最新行」を使うよう統一。スコアだけ有効行、M/X/Fだけ別の未完成行を見るズレを防止。

#### 追加修正: LST ended cockpit live operation gating

- まさレビュー 2026-05-20:
  - LST cockpitを見てもM/X/Fのところにデータが入っていない。
  - endedなのに先手力パラメータと月次ルーティンが生きている。
- 原因:
  - HUD cockpit上部の `HudCockpitSignalStrip` はDBではなく `COCKPIT_SIGNAL_SNAPSHOTS` のhardcoded辞書を見ていた。辞書は `p21/p06/p20` だけで、`p07` はNO DATA。
  - `HudCockpitHeader` は `project.status !== active` でもfallback `38` を先手力として表示していた。
  - `HudStepModalStack` はroutine表示判定の外にあり、endedでも常時表示。
  - 次期MS設定バナーもstatusを見ず、期間切れならendedにも表示。
- 修正:
  - `HudCockpitSignalStrip` を `amd_score_inputs + amd_score_alpha` から算定する実データ表示へ変更。hardcoded snapshotはfallbackのみ。
  - p07 latest visible row (`2026-04-30`) から `M=15.71 / X=745.57 / F=27 / score=31,625` が出ることをDBで確認。
  - `isLiveOperationalProject()` を追加し、`active/sales` かつ凍結/再開待ちでないPJだけ、先手力・Step Modal Stack・月次ルーティン・次期MS設定を表示。
  - ended等の非live PJでは、HUD headerは先手力リングではなく lifecycle seal を表示。
  - 通常版Cockpitにも同じlive operation判定を適用。

#### 追加修正: Project Signal Board right-zone spacing

- まさレビュー 2026-05-21:
  - Project Signal Boardで、AMD SCOREと先手力ringの間が不自然に空いている。
  - 先手力を左に寄せれば、PL/PM/Closerのフォントをもう少し大きくできる。
- `HudControlCenterDashboard`:
  - `ProjectInitiativeRing` のdesktop配置を `left 79.2% / width 58px` から `left 74.8% / width 62px` へ調整。
  - ring SVGを `54px` から `56px` へ拡大。
  - PL/PM/Closer blockを `left 85.7% / width 9.1% / font 8px` から `left 82.6% / width 13.6% / font 9px` へ調整。
  - score zone右側に空白が残りすぎないよう、先手力ringとrole labelsを一体の右側zoneとして詰めた。
- verification:
  - `cd /Users/masa/projects/AMD/amd-os/pwa && npx tsc --noEmit` 成功。
  - `cd /Users/masa/projects/AMD/amd-os/pwa && npm run build` 成功。
  - `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` 成功。
  - production HEAD check: `/hud/dashboard` は未ログイン時 `307 -> /auth/login?next=%2Fhud%2Fdashboard`。

### 2026-05-21 — Management Score / Finance Ops / SX cash timing

#### 入力確認

- まさ依頼:
  - managementの月次試算表にSXの6月開始・8月初回入金想定を入れたい。
  - 月次試算表へ情報が入ってきたら更新できる仕組みがほしい。
  - Gmailに届くサブスク領収書は実績へ入り、毎月発生しそうなら予算へforward-fillしたい。
  - 自動振替は月次試算表内ではなくadminの経理ページで慎重に管理したい。
- `/Users/masa/projects/AMD/SX/仕様書_FY2026_draft.md`:
  - 対象期間は `2026-06-01` から `2027-03-31`。
  - 月額金額は明示なし。
- Drive見積書 `Q-0000000065`:
  - 税抜小計 `10,480,000円`、消費税 `1,048,000円`、税込合計 `11,528,000円`。
  - 業務期間は `2026-06-01` から `2027-03-31`。
  - 請求方法は月次請求。
- まさ訂正:
  - 既存 `2,570,000円` はFY25の `11-3月分` で、FY26月額ではない。
  - FY26は見積書の税抜小計 `10,480,000円` を10か月で割って、PL売上 `1,048,000円/月` とする。

#### 実装

- `pwa/src/lib/finance/monthly-pl-simulation.ts`
  - `MonthlyPlProject.cashDelayMonths` / `cashStartYm` を追加。
  - 売上発生月の `revenue` と、資金繰り上の `cashInflow` を分離。
  - `pjDetails.payload.cashRevenue` を保存し、project行でも当月cash入金額を追えるようにした。
- `pwa/scripts/import_monthly_pl_budget.cjs`
  - `pj13` を `SX_FY25_11-03` に変更。
  - `startYm=202606`, `type=spot`, `monthlyRevenue=2570000`。FY25 11-3月分を6月スポット売上/入金として扱う。
  - `pj14` を `SX_FY26` として追加。
  - `startYm=202606`, `endYm=202703`, `type=fixed`, `monthlyRevenue=1048000`, `internalMemberCost=367000`, `cashDelayMonths=2`, `cashStartYm=202608`。
- DB:
  - `npm run import:monthly-pl-budget` 実行済み。
  - `202606` SX_FY25_11-03 project_revenue = `2,570,000`。
  - `202606` SX_FY26 project_revenue = `1,048,000`, cashRevenue = `0`。
  - `202608` SX_FY26 project_revenue = `1,048,000`, cashRevenue = `1,048,000`。

#### Slack / OS取り込み確認

- Slack現物:
  - `#p21_sx` 2026-05-08: 入札書類受領、愛媛大学から人件費積算のための追加情報依頼。
  - `#p21_sx` 2026-05-15: つくよみ週次レポートで「愛媛大学との入札案件では、人件費積算に関する情報提供を完了」と記載。
- OS側:
  - `project_meeting_summaries`: 2026-04-16社内MTGに「愛大入札説明書受領、参考見積書提出、5/7締切」あり。
  - `project_knowledge`: 2026-05-21時点で「愛媛大学 入札が2026-05-25 14:00開札予定」等が存在。
  - `member_activities`: 202604に「愛大入札説明書受領・参考見積書提出（締切5/7）」あり。
  - `source_cache`: Gmail/Driveの入札関連は多数あるが、Slack元メッセージ自体は未保存。
- 結論: OSは入札トピックを拾えている。ただしSlack一次証跡がL2 source refsへ十分に残っていないため、Slack→L2/source_cacheの回収導線が次課題。

#### Slack source refs / backfill

- `pwa/src/lib/sources/slack-source-cache.ts`
  - Slack channel history + thread replies を、`source_cache(source='slack')` へ保存する共通collectorを追加。
  - `metadata_json.source_url` / `permalink` / `text_sha256` / `text_preview` / file refs を保持。
  - L2や通知にはSlack全文を保存しない。`content_text` は短いsnippet + thread excerpt + source refに限定。
- `pwa/src/app/api/sources/slack/collect/route.ts`
  - `CRON_SECRET` 認証付きのPWA APIを追加。
  - `projectId`, `ym`, optional `maxMessages`, `includeBots` で `projects.slack_channel_id` からSlackを収集。
  - source refs 取り込み完了自体は通知しない。後続のL2抽出やOS台帳差分で表示データが変わった場合だけ通知する。
- `pwa/scripts/ms_progress_review_tool.mjs`
  - `collect-slack --project <id> --ym <YYYYMM>` を追加。
  - production PWA API経由でSlack source refsを保存できる。
- `pwa/src/app/api/progress/revisions/route.ts`
  - MS修正提案の根拠取得が `source_cache.source='gmail'` 固定だったため、全sourceを見るよう変更。
  - これで Slack source refs が保存後に revision evidence へ入る。
- `pwa/src/app/api/cron/member-activities/route.ts`
  - 入力に `source_cache` refs を追加。
  - monthly_reports / project_meeting_summaries にまだ反映されていないSlack発言でも、進捗イベントL2の再抽出に使える。
- backfill:
  - production alias反映後、active 5 PJ (CTB/SE/ZMP/CX/SX) × `202603-202605` を実行。
  - 保存件数: CTB `61/112/1`, SE `0/3/0`, ZMP `86/78/33`, CX `139/74/68`, SX `128/64/27`。
  - DB確認: `source_cache(source='slack')` は対象PJ×月で計 `991` 件。p21/SX 4-5月で愛媛大学入札・見積・人件費関連のSlack source refsを確認。
  - p21/SX の `member_activities` を source refs込みで再抽出。`202603=15`, `202604=14`, `202605=13` 件。入札関連として `愛媛大学入札説明書受領・参考見積書提出（入札締切5/7）`、`愛媛大学入札：追加質問への回答・積算根拠資料を提出` を確認。

#### Admin Finance Ops

- migration `068_finance_operations.sql`
  - `company_finance_recurring_items`
  - `company_finance_receipt_events`
  - admin-only RLS (`amd_os_current_user_is_admin()`)
  - GAS baseline fixed_cost 16件をseed。ただし二重計上防止で `budget_forward_fill=false`。
- `/admin/finance`
  - recurring itemsの台帳UIを追加。
  - amount / period / auto debit / withdrawal account / budget forward-fill を直接編集可能。
  - `同期` で `company_budget_monthly` に `source='finance_recurring_item'` としてforward-fill。
- API:
  - `/api/admin/finance/recurring`: recurring item作成/更新/budget同期。
  - `/api/admin/finance/receipts`: receipt event作成/実績同期。
  - receipt actual sync は `company_actual_monthly` に `source_ref=company_finance_receipt_events:<id>` で書く。

#### Management Score接続

- `collectManagementScoreRawData` が以下をfinance signalとして読むよう変更。
  - `company_finance_recurring_items`
  - `company_finance_receipt_events`
- `npm run collect:management-score-raw -- --ym=202606` 成功。
  - `runId=5760391d-880a-42a7-947c-30f06aedd06c`
  - internal signals `407`
- `npm run calculate:management-score -- --ym=202606` 成功。
  - `snapshotId=0926cfcf-6188-4c4f-b6b8-568d05a14f56`
  - total `44`, finance `61`, confidence `0.63`

#### verification

- `npx tsc --noEmit` 成功。
- `npm run build` 成功。
- `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` 成功。
- production alias: `https://amd-os-pwa.vercel.app`
- production HEAD check: `/hud/dashboard` は未ログイン時 `307 -> /auth/login?next=%2Fhud%2Fdashboard`。

#### Monthly Reward UI cleanup

- `CockpitMonthlyModal` の「今月の報酬予定額 / メンバー別配賦」セクションを削除。
  - 理由: `planCycle.budgetYen / totalPoints` ベースのフロント暫定計算で、`reward_summary_json` 正本の「メンバー報酬」と金額がズレるため。
  - 月次モーダルでは保存済み `reward_summary_json` の「メンバー報酬」だけを表示する。
- SX `202601-202603` の5月一括請求確認で、RewardV2のcapが `invoice_ym` を見ず稼働月ごとの `monthlyBudget65` になっていることを確認。
  - `gas/059_RewardV2_Ops.js` から月次cap圧縮を削除。
  - PWA月次モーダルからcap表示・本来額/今月支払の分岐を削除。
  - Supabase `billing_cycles.reward_summary_json` 既存29行からcap関連フィールドを削除し、`cappedFrom` があった行は本来額へ戻した。
  - 初回の `npx @google/clasp push` は `invalid_grant / invalid_rapt` で失敗したが、再実行で `Script is already up to date.` まで確認。
  - 次対応は新規「繰延モーダル」ではなく、既存の請求書作成タスク / 支払通知書作成タスクで `invoice_ym` 対象月を集約して扱う。
- verification:
  - `node --check gas/059_RewardV2_Ops.js` 成功。
  - `npx @google/clasp push` 成功 (`Script is already up to date.`)。
  - `npx @google/clasp status` で `059_RewardV2_Ops.js` がtracked fileであることを確認。
  - `npx tsc --noEmit` 成功。
  - `npm run build` 成功。
  - `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` 成功。
  - production alias: `https://amd-os-pwa.vercel.app`
  - DB確認: `reward_summary_json` のcap関連フィールド残存 `0`。SX報酬合計は `202601=407,464`, `202602=789,971`, `202603=508,820`。

#### Admin Payouts invoice_ym aggregation

- 旧 `/admin/payouts` は存在しない `monthly_reward_payout.amount_yen` を前提にした手入力UIだったため、現行DBスキーマと不一致。
- `pwa/src/app/api/admin/payouts/route.ts`
  - `requireAdmin()` + `service_role` で支払月対象データを取得・保存。
  - 対象cycleは `billing_cycles.invoice_ym = targetYm`、または `invoice_ym IS NULL AND ym = targetYm`。
  - `reward_summary_json.members` から `monthly_reward_payout(project_id, ym, member_id, earned_pt, base_pay, bonus_pt, total_pay)` を upsert。
  - メンバー別合計を `payout_notices(member_id, ym, total_yen)` に upsert。`sent_at` / `notice_no` / `pdf_url` は支払通知書発行側の正本として保持。
  - `members.exclude_from_payout_notice=true` のメンバーは支払明細には残すが、`payout_notices` の自動生成対象からは除外する。
- `pwa/src/components/admin/AdminPayoutsClient.tsx`
  - 支払月select、対象cycle一覧、メンバー別支払内訳、保存済み差分、通知額ステータスを表示。
  - 手入力配賦を廃止し、保存済み `reward_summary_json` からのみ支払明細を作る。
  - 「PJ予算チェック」を追加。支払月内の対象cycleごとに `billing_cycles.budget_yen` (= 報酬として支払ってよいPJ予算) と報酬支払予定額を比較し、超過 / PJ予算未設定 / 入金未確認を表示。
  - 対象cycle行、メンバー別支払の内訳行、PJ予算チェック行をクリックすると、該当PJ・該当ymの `CockpitMonthlyModal` をオンデマンドで開く。
  - 月次モーダルを閉じた後は cockpit cache を破棄し、支払月データを再読込する。
- DB確認:
  - SX projectは `p21`。
  - `invoice_ym=202605` のSX対象cycleは `202601`, `202602`, `202603`。
  - 報酬額は `202601=407,464`, `202602=789,971`, `202603=508,820`、合計 `1,706,255`。
  - メンバー別合計は `ID003=880,122`, `ID001=540,908`, `ID007=217,484`, `ID002=67,741`。
  - 実装時点では対象 `monthly_reward_payout` 既存行は `0`。画面の「支払データ保存」で作成する。

#### ZMP monthly fixed budget / report tab routing

- ZMP (`p19`) の月次モーダルで「メンバー報酬」表が消える原因を確認。
  - `billing_cycles.reward_summary_json` が未生成。
  - `projects.fee_type` / `fee_amount` が `null`。
  - `value_plan_cycles.budget_yen` が `0`。
  - そのため `CockpitMonthlyModal` がpt単価を作れず、報酬セクション自体を非表示にしていた。
- DB修正:
  - `projects.p19`: `fee_type='monthly_fixed'`, `fee_amount=300000`。
  - `PC-p19-202601-202612`: `budget_yen=2340000` (= 300,000 × 65% × 12か月), `total_points=100`。
- `CockpitRoutineBudgetModal`
  - メンバー配賦額入力/表示を削除。
  - 月額固定PJでは「今月も¥300,000でおけ？」として請求額のみ確認するUIへ変更。
  - submit時は `member_allocations_json=null` を明示して、旧配賦JSONを増やさない。
- `fetchCockpitFromSupabase` / `CockpitMonthlyModal`
  - `projects.fee_type` / `fee_amount` をコックピットデータとして返し、月次モーダルへ渡す。
  - `reward_summary_json` 未生成でも、plan cycle予算または月額固定額から `ptUnit` を算出し、MS進捗delta × 担当shareでメンバー報酬をプレビュー表示する。
  - DB確認では ZMP `202605` のpreviewは `ptUnit=23,400`、メンバー別に `まさ 2.2pt/51,480円`, `うめ 0.45pt/10,530円`, `あび 0.51pt/11,934円`, `こう 0.06pt/1,404円`, `しん 0.18pt/4,212円`。
- 月次ルーティン:
  - `reportFix` は旧 `CockpitRoutineReportFixModal` ではなく、`CockpitMonthlyModal` の `report` タブを直接開くように変更。
  - 通常コックピットとHUDコックピット両方で、URL `?step=reportFix` 初期表示も `report` タブへ揃えた。
- verification:
  - `npx tsc --noEmit` 成功。

#### raw_data_ingested notification removal

- まさ確認: `/notifications` に `CX: Slack生データ取り込み (68件)` が表示された。
- 調査結果:
  - 差分検出ルールにマッチしたのではない。
  - `/api/sources/slack/collect` と `pwa/scripts/backfill_slack_source_cache.cjs` が、`source_cache` 保存後に `l2_notifications(l2_kind='raw_data_ingested')` を無条件upsertしていた。
  - `/api/sources/gmail/collect` も同様にGmail取り込み完了通知を作っていた。
- 修正:
  - Slack/Gmail source collect APIから `raw_data_ingested` 通知生成を削除。
  - Slack backfill scriptから通知生成を削除。
  - `NotificationsClient` の `raw_data_ingested` 詳細表示/deep link/cost estimateを削除。
  - 既存誤通知 `14` 件を `l2_notifications` から削除。`source_cache` は消さず、`3575` 件残存を確認。
- 正本ルール:
  - `source_cache` はsource refs / short snippet / hash / permalinkの証跡キャッシュ。
  - 取り込み完了は通知しない。通知はOS表示データ・台帳・L2正本に差分が出た時だけ作る。

#### Admin Payouts PJ budget confirmation + ZMP event backfill

- `/admin/payouts` のPJ予算未設定問題を修正。
  - SX `202601-202603` のように、稼働後に複数月分の委託料が後から確定するケースを支払月adminで扱う。
  - `/api/admin/payouts` に `PATCH` を追加。
    - body: `ym`, `projectId`, `invoiceYm`, `sourceYms`, `clientAmountYen`, `bufferYen`。
    - `clientAmountYen × 65% - bufferYen` をPJ予算総額にし、対象稼働月へ報酬支払予定額比率で配分。
    - 各 `billing_cycles` に `budget_yen`, `budget_reported_amount`, `budget_buffer_amount`, `budget_confirmed_at/by` を保存。
  - `AdminPayoutsClient` のPJ予算チェックに「確定待ちのPJ予算」を追加。
    - 未設定グループを `projectId + invoiceYm` でまとめる。
    - 入力モーダルで業務委託料、バッファ、65%後PJ予算、支払予定、残り、月別配分を確認して保存。
  - 月次モーダルのメンバー報酬欄に、月別PJ予算・支払予定・残りを追加。
- ZMP `202601` の進捗イベント0件を調査。
  - `member_activities=0` だったが、`source_cache=14`, `monthly_reports=1`, `project_meeting_summaries=2` は存在。
  - 原因は source refs 拡張後に過去月 `202601-202603` の `cron/member-activities` backfillが未実行だったこと。
  - production cronを `projectId=p19` 指定で手動実行し、`202601=11`, `202602=12`, `202603=9` 件を保存。

#### SX MS#1 split + reportFix sync

- まさ指摘: SX.MS#1 が「事業計画・資本政策・知財戦略策定」と1つにまとまっており、4月に知財戦略だけ進んだ場合でも旧share `まさ30% / かる50% / ちこ20%` で報酬配分されるのは変。
- DB対応:
  - project `p21`, active plan cycle `PC-p21-202604`。
  - 旧 `MS-PC-p21-202604-1` を `事業計画策定` 13ptへ変更。responsibility = かる70% / まさ30%。
  - 新規 `MS-PC-p21-202604-1-capital` = `資本政策策定` 7pt。responsibility = まさ100%。
  - 新規 `MS-PC-p21-202604-1-ip` = `知財戦略策定` 5pt。responsibility = ちこ80% / まさ20%。
  - 後続MSの sort_order を+2し、active cycle合計は120ptを維持。
  - 旧MS#1の4月PM確認「事業計画と資本政策は進捗なし。知財戦略だけ進んでる」を、事業計画0% / 資本政策0% / 知財戦略100%へ移管。
  - SX `202604` / `202605` の `billing_cycles.ms_progress_summary_json` をクリア。
- 設計メモ:
  - `milestone_responsibility.share` は「そのMSで進んだptの配分比率」。
  - 成果物が独立して進むなら別MSに分ける。1MS + shareは、同じ成果物を複数人で一体として進める場合だけ使う。
- 追加調査: SX `202601` の月次報告書は確定済みなのに月次ルーティン `月次報告書FIX` が未完了。
  - `monthly_reports.MR_p21_202601`: `status='fixed'`, `fixed_at=2026-03-20T19:59:00Z`, `final_content` あり。
  - `billing_cycles(p21,202601).report_fixed_at` が `null` のため、UIの `!!bc.reportFixedAt` 判定に引っかかっていた。
  - DBを同期し、PWA data layerに `monthly_reports.fixed_at` / `status='fixed'` / `final_content` フォールバックを追加。

#### Protocol result field correction

- まさ指摘: プロトコル通知で `結果` が勝手に `結果・学習` として生成されていた。
- 調査:
  - DB `llm_prompts.protocol.extract` が `結果・学習` まで出力対象にしていた。
  - 既存protocol 88件の本文に `結果・学習` section、`protocol_examples` 23件に非null resultがあった。
  - UIは `criteria` を読まず、関連事例を1つの要約行として表示していた。
- 修正:
  - `protocol.extract` は `分岐点 / 判断材料 / アクション` の3要素だけを抽出し、resultはnull固定。
  - 既存protocol本文から結果sectionを削除、example resultをnull化。
  - GAS `155_L2KnowledgeExtractor.js` に結果section除去 + `protocol_examples.result=null` 固定 + source hash bumpを追加。
  - Notifications/Admin UIは関連事例を `分岐点 / 判断材料 / アクション` の構造で表示。
- 設計ルール:
  - `結果` はアクション後に実際に起きたことを後追いで記録する欄。自動抽出時点では作らない。

#### Annual MS period UI restored

- まさ指摘: 年間MS設定ウィンドウから各MSの期間設定UIがまた消えていた。
- 調査:
  - `CockpitNextPeriodSetup` にPlanCycle全体の開始/終了はあるが、MSごとの開始/終了入力がなかった。
  - `value_milestones` にMS別期間の保存列もなかったため、UIだけ戻してもまた消える構造だった。
- 修正:
  - migration `069_value_milestone_periods.sql` で `value_milestones.period_start_ym` / `target_ym` を追加。
  - 年間MS設定モーダルに `MS開始` / `MS終了` を復元し、新規/既存MSに保存。
  - `/api/progress/ms-schedule` はGAS推定よりDBのMS別期間を優先。
  - production確認時にGAS schedule呼び出しが `invalid key` で502になったため、SupabaseのMS別期間へfallbackして `ok:true` を返すようにした。
  - Cockpit/HUDのMS表示も `ms.periodStartYm` / `ms.targetYm` を優先。
- 再発防止:
  - `pwa/scripts/check_next_period_ms_period_ui.cjs` と `npm run test:next-period-ui` を追加。
  - 年間MS設定UIを触ったら、`MS開始` / `MS終了`、DB列、schedule override が消えていないことを自動チェックする。

#### Monthly routine hardening: Gantt MS / cap stock / event edit / PJ category

- #2 protocol結果:
  - 既存DBを再確認し、protocol本文内 `結果・学習` / `## 結果` と `protocol_examples.result` 非null が0件であることを確認。
  - migration `070_protocol_result_observations.sql` を適用し、結果は単一field上書きではなく `protocol_result_observations` の時系列ledgerで追跡する設計にした。
  - 1m/3m/6m/12m/24mなどの観測点をappend-onlyで残し、後年に評価が反転しても古い観測を消さない。
- #4 年間MS:
  - `CockpitGoalsCompact` / `HudCockpitGoalsCompact` の旧リスト表示を廃止し、`MilestoneGanttChart` に集約。
  - 各MSの開始〜終了月を月列上のbarで表示し、bar内に担当者shareと割当ptを表示。
- #5 報酬キャップ:
  - ZMPのように報酬支払がPJ予算を超えるケースに備え、月次キャップを再導入。
  - 今月払ってよいPJ予算を超えた分は member別 `stockYen` として翌月以降に繰越。
  - 月次モーダルと `/admin/payouts` に、要支払 / 支払 / 繰越入 / 現ストック / キャップ発動を表示。
  - GAS `059_RewardV2_Ops.js` / `055_ProjectCockpit_Api.js` にも同じsummary fieldsを復帰し、`clasp push` 済み。
- #6 進捗イベント編集:
  - `/api/progress/events` に `PATCH` を追加し、title/content/milestone/origin/impact/depthを編集可能にした。
  - 月次モーダルの進捗イベントカードに編集UIを復活。
  - `check_pwa_critical_ui.cjs` / `npm run test:critical-ui` を追加し、MS期間UI、Gantt、報酬cap/stock、進捗イベント編集、admin.payouts、project category、AMD Score対象分岐をまとめて検査する。
- #7 PJ分類:
  - migration `071_project_category.sql` で `projects.project_category` を追加。値は `dtsu` / `ecosystem` / `advisor`。
  - KUTE (`p25`) は `ecosystem`、LST (`p07`) は `advisor` に初期補正。
  - `/admin/projects` に分類列を追加し、cockpit/headerにも表示。
  - ecosystem PJはAMD Score対象外として、cockpitのAMD Scoreセクションと `amd-score-l2-refresh` 抽出対象から除外。
  - advisor PJはstatusがendedでも source/backfill 系の対象にできるよう、member-activities/hourly-estimate/activities infer/slack backfill の対象条件に `project_category=advisor` を追加。

#### Notification raw_data_gap detail repair

- #8 raw_data_gap通知:
  - CTB `202605:raw:drive-monthly-slide` は、OS表示データの追加ではなく「Drive月次進捗スライドがsnapshot/sourceChecklistに未反映」というgap通知だった。
  - DBの `metadata_json.evidence_refs` には Drive / Notion / Calendar の根拠が入っていた。
  - PWA通知詳細UIが `project_id + ym` の `source_cache` を丸ごとlazy fetchしていたため、後からbackfillされたSlack rowが通知の中身のように表示されていた。
  - `raw_data_gap` は `metadata_json.evidence_refs` を優先表示し、fallbackでも source_cache の短いsnippet/source_url/hashだけを出すよう修正。
  - Slack collectorの `content_text` も今後は短いsnippet/thread excerptに抑える。

#### Member weekly activity extraction

- #9 メンバー別の週次活動:
  - `/api/cron/member-weekly-activities` を追加。
  - Gmail / OSから読める共有メンバーカレンダー / 既存 `source_cache` を週次で読み、参加者emailを `members.email`、PJを `projects.report_emails` / PJ名 / client名に突合して、`member_activities(source='member_weekly')` に保存する。
  - PJ判定では、member emailや `@team-armada.jp` を `report_emails` matchに使わない。`report_emails` は関係先/PJ専用アドレスであり、メンバー所属を示すものではない。
  - 通知承認やregistry diffから `projects.report_emails` を更新する経路でも、`members.email` と `@team-armada.jp` は追加しない。
  - 短いPJ名 (`SE` 等) は単語境界でmatchし、security/invoice/通知系メールは除外する。
  - Google Workspaceログイン時に `calendar.readonly` / `gmail.readonly` を要求し、callbackでCalendar APIを読めることを確認。未許可ならOSに入れず、`members.google_calendar_status` を `missing/error` にする。
  - 週次抽出cronは、`google_calendar_status = connected` のメンバーだけを抽出対象にする。未ONのメンバーは保存しないが、ON済みメンバーの抽出は止めない。`info` / `つくよみ` など非ログイン系は対象外。
  - `/admin/members` にCalendar列を追加し、各メンバーのカレンダー共有状態を表示。非ログイン系は `対象外`。
  - `/mypage` に「今週やったこと」カードを追加し、月曜〜日曜(JST)の `member_activities.item_date` を表示。
  - `member_activities` を入力にする既存L2 (member_knowledge等) からも利用できるよう、別テーブルではなく既存L2入力テーブルへ寄せた。
  - Vercel cronは毎日18:00 JST (`0 9 * * *`)。前日18:00〜当日18:00の24hを抽出する。
  - #17 SE/CX混入修正: `member-activities` は `monthly_reports.status='invalid'` を入力に使わず、source_cache / meeting / report本文に別PJの強いaliasだけが出て現PJaliasが出ない場合は抽出入力から除外する。既存のp10誤データは source_cache 3件、member_activities 6件を削除し、p10向けCryoX/Kiutra XRL候補2件とあきPJメンバー候補1件を rejected にした。
  - 追加確認でp10に残っていた旧Slack source_cacheのNIMS/CX系1件も削除し、p10のCryoX/Kiutra/NIMS系 source_cache / member_activities / active XRL候補は0件にした。

#### Notifications / founding members / admin member hardening

- #12 ecosystem:
  - `venture-xrl-refresh` / `founding-members-extract` / `frl-grit-resilience-extract` / `ms_progress_review_tool` で `projects.project_category='ecosystem'` を AMD Score / XRL対象外に統一。
  - DB確認: ecosystem (`p12`, `p25`, `p23`) の未reject XRL候補と未読score系通知は0件。
- #13/#14 admin members:
  - migration `074_members_last_login_at.sql` で `members.last_login_at` を追加。
  - `/auth/callback` でCalendar確認成功時に `last_login_at` を更新。
  - `/admin/members` に最終ログイン列を戻し、最終ログインが新しい順に並べる。
- #15 monthly modal:
  - MSタイトルを1行目、期間・担当share・pt・進捗%を2行目に移し、長いMS名が数文字で潰れないようにした。
- #16 Tsukuyomi MS revision:
  - 「提案20%」は `ms_progress_revisions.revised_pct`、つまりOK確定時に保存される当月時点の累積進捗率。
  - UI表示を `現 X% → 累計提案 Y%` に変更。
- #18 founding members:
  - `founding-members-extract` の定義を「創業者 / CEO候補 / 技術創業者 / PI など創業コア」に限定。
  - VC / 協業先 / 顧客 / 行政 / advisor-only / AMDサポートだけの人物はプロンプトと保存前フィルタの両方で除外。
  - 既存の非コア58件を `status='invalid'` にして表示・HRL根拠から外した。
- #19 founding members edit:
  - `CockpitMembersModal` の創業コア候補欄に、つくよみ修正依頼UIを追加。
  - `/api/founding-members/revise` を追加し、修正指示 → つくよみ案 → OK確定で `project_founding_members` をupsert/invalid化する。
- #20 notification apply gate:
  - 通知に出る候補は、通知画面で「はい」を押したものだけ正本反映するルールへ整理。
  - GAS 155の `member_knowledge` / `project_knowledge` は `status='candidate'` で保存し、PWA feedback APIの「はい」で `active`、「いいえ」で `rejected` にする。
  - `protocols` は candidate → 「はい」で active、「いいえ」で rejected。
  - `founding_members` は LLM抽出時 `tentative` → 「はい」で active、「いいえ」で invalid。

#### 関連メンバー (HRL根拠) を SU+AMD 限定に整理

- まさ指摘: コックピットの「関連メンバー (HRL 評価のベース)」モーダルで `project_founding_members` の品質が低い。
  - JOYCLE (p09) で `山地正洋` と `まさ` が両方 active (= 同一人物の重複)。
  - 大学・研究機関 (小柳裕太郎 / 野田 / 野田先生) が混入。「HRL根拠には会社のメンバー + AMDメンバー以外は入れてはいけない」。
  - 5/22 cleanup で「上原 / 小屋 / 小林 / 斎藤 / 本橋 / 赤土 / 赤津」が invalid 化されていたが、これらは AMDサポートではなく JC社員。
  - サブセクション「LLM 抽出 創業コア候補」というラベル自体が違和感。関連メンバー誰でも書く欄であり、創業コア限定じゃない。
- 方針確定 (まさ判断):
  - HRL に算入するのは「該当SU 社員 + AMD 伴走メンバー」だけ。大学・研究機関 / VC / 顧客 / 行政 / 産業パートナーは HRL根拠外として `status='invalid'` にする。
  - AMDメンバーは必ず `members.code_name` で記録。フルネーム (`山地正洋`) / 姓のみ (`山地`) は重複扱いで invalid。
  - SU側 (= AMD code_name に該当しない人物) は `category='startup'` + `affiliation=<SU名>` で表記。AMD と SU の二重表記 (`JOYCLE / AMD`) は使わない。
  - UI ラベルは「関連メンバー候補」に統一 (= 創業コア限定ではない)。
- 実装:
  - migration `075_related_members_cleanup.sql`:
    - `category` COMMENT に `'startup'` を追加 (CHECK 制約はないので application 層で強制)。
    - HRL根拠外 (`university` / `vc` / `partner_company` / `government` / `individual`) で active な行を invalid 化。
    - AMD member 重複表記 (フルネーム + 姓のみ + スペース付き) を invalid 化。
    - `category='amd'` で AMD code_name に一致しない person を `category='startup'` へスライド + `affiliation` から ` / AMD` 表記を除去。
    - JOYCLE p09 の JC社員候補 (上原 / 小屋 / 小林 / 斎藤 / 本橋 / 赤土 / 赤津) を `category='startup'` + `status='active'` に復活。
  - cron `founding-members-extract` を `PROMPT_REV='v3_2026-05-22_related_members_su_plus_amd'` にバンプ:
    - AMD code_name alias map を `members` から取得して prompt に注入。
    - LLM 出力時に AMD は `code_name` で表記、SU社員は `category='startup'` を強制。
    - 保存前 filter `classifyMember` で `category in ('university','vc','partner_company','government','individual')` を reject。
    - 同一人物の重複は alias 解決後に dedup。
    - 通知タイトルを「創業メンバー更新」→「関連メンバー更新」に。
  - `/api/founding-members/revise` も同じ alias / category 規約に揃え、`ALLOWED_CATEGORIES = {amd, startup, unknown}` に絞る。
  - `pwa/src/lib/founding-members-data.ts`:
    - `FoundingMemberCategory` に `'startup'` 追加。
    - `CATEGORY_LABEL_JP['startup']='該当SU 社員 / 創業候補'`、`CATEGORY_COLOR['startup']='bg-sky-...'`。
    - `HRL_INCLUDED_CATEGORIES = {'amd','startup'}` を export。
    - `estimateHrlFromMembers` を `HRL_INCLUDED_CATEGORIES` に限定 (= 大学・研究機関 / VC は HRL から除外)、`coreCount` は CEO / 技術 / 事業 の 3 段階に。
    - `fetchFoundingMembersSummary.total` も HRL 算入対象だけに。
  - `CockpitMembersModal.tsx` / `CockpitFoundingMembersModal.tsx`:
    - サブセクション見出し「LLM 抽出 創業コア候補」→「LLM 抽出 関連メンバー候補」。
    - バナー「つくよみに創業メンバー修正依頼」→「つくよみに関連メンバー修正依頼」、例文も SU + AMD 想定に。
    - textarea placeholder「創業メンバーの追加・除外…」→「関連メンバーの追加・除外… (AMD は code_name で)」。
    - `CATEGORY_ORDER` を `['amd','startup','unknown', ...HRL根拠外]` に並び替え。
    - モーダルタイトル「{ventureName} 創業メンバー」→「{ventureName} 関連メンバー」、説明文に「対象は該当SU+AMDのみ、大学・研究機関 / VC / 顧客 / 行政 / 産業パートナーは HRL根拠外」と明示。
  - 設計md (`pwa/design/xrl_evidence.md` / `cockpit.md` / `L2_DATA.md`) の HRL 根拠定義を SU+AMD 限定に書き換え。
- DB cleanup 後 JOYCLE p09 active: `まさ (amd)` + `Bat-Erdene / 上原 / 小屋 / 小林 / 斎藤 / 本橋 / 赤土 / 赤津 (startup, JC)` の 9 名。
- 次セッション課題: production deploy 後に `cron/founding-members-extract?project_id=p09` を再走して LLM v3 prompt の品質を確認。他 active SU (CTB/SE/ZMP/CX/SX) も再走対象。

#### Admin Payouts後追い予算リスク表示

- まさ指摘: SXのように稼働後に委託料が確定するケースでは、事前ルールが曖昧だと「想定ほど予算が出なかった」「途中で破談になった」時に揉める。
- 方針:
  - `invoice_ym !== ym` かつ `budget_yen` 未設定の対象は `後追い予算未確定` と表示し、正式な予算超過判定は保留する。
  - 確定税抜委託料を入力した時点で `税抜委託料 × 65% - バッファ` をPJ予算総額にし、対象稼働月の報酬支払予定額比率で配分する。
  - 確定PJ予算が報酬支払予定を下回る場合は `予算不足` として赤表示し、支払可否 / 減額 / 追加請求 / バッファを人間合意してから保存する。
  - PJが `projects.status='lost'` の場合は `失注/破談: 予算なし` と表示し、支払原資なしの個別確認対象にする。
- 実装:
  - `/admin/payouts` のPJ予算チェックに `後追い予算未確定` / `予算不足` / `失注/破談: 予算なし` の状態表示と補足文を追加。
  - PJ予算確定モーダルに、未入力時・予算不足時・予算内時の合意メッセージを追加。
  - 正本md (`design/routine.md`, `design/SPEC_pwa.md`) に後追い予算未確定の運用ルールを追記。

#### 支払条件のadmin正本化 + 入金確認nudge/freee同期

- まさ指摘:
  - `payment_due_rule` のような変数名で説明されても、どの画面のどの値か分からない。
  - PJごとの設定はコックピットconfigではなくadminでやるべき。
  - SXは入金済みなのにOSは入金未確認。adminが入力していないだけで、OSからadminへのnudgeも入力UIも弱い。
  - freee会計の入金履歴を拾えば、admin回答忘れでも入金確認済みにできるはず。
- 方針:
  - 画面上の言葉は「支払条件」「支払月」「入金確認」に統一。
  - `/admin/projects` をPJごとの契約・請求・支払条件の正本にし、コックピットheaderから `/project/[projectId]/config` 導線を消す。
  - 支払条件 (`発行月末` / `翌月末` / `翌月25日`) は `projects.payment_due_rule` に保存。旧 `payment_due_day` は互換fallbackだけにする。
  - 請求書支払期日、`/admin/payouts` の支払月自動判定、Slack入金確認nudgeを同じ helper (`payment-rules.ts`) で計算する。
  - `billing_cycles.invoice_ym` が明示されている場合は個別上書きとして優先。空の場合は支払条件から支払月を計算する。
- 実装:
  - `src/lib/payment-rules.ts` を追加し、支払条件ラベル・支払期日・支払月計算を共通化。
  - `AdminProjectsTable` の「支払期日」列を「支払条件」に変更し、`projects.payment_due_rule` をselect編集できるようにした。
  - `CockpitRoutineInvoiceModal` は `projects.payment_due_rule` を読んで支払期日を計算するよう変更。
  - `CockpitHeader` から `⚙️ config` リンクを削除。
  - `/api/admin/payouts` は `invoice_ym` 空のcycleを「当月締め当月支払」扱いにせず、PJ支払条件から支払月を計算して対象化する。
  - `src/lib/payment-confirmation.ts` / `src/lib/payment-groups.ts` を追加。
  - `/api/cron/payment-confirm-nudges` を追加。active admin (`members.is_admin=true`) へSlack DMし、ボタンは:
    - `予定通り入金済み`: signed token 付き `/api/admin/payment-confirm?mode=expected` で即時反映。
    - `金額を入力`: signed token 付き `/payment-confirm` で実額入力。
  - `/api/admin/payment-confirm` を追加。signed tokenを検証して `billing_cycles.payment_confirmed_at` / `payment_confirmed_by` / `status='payment_confirmed'` を更新し、実額・source・freee照合情報を `billing_log.detail` に保存。
  - `/payment-confirm` を追加。Slackから開く実額入力フォーム。
  - `/api/cron/freee-payment-sync` を追加。freee会計の収入取引 (`/api/1/deals`, `type=income`) を支払月で取得し、取引先ID・請求番号・金額で照合。支払済みなら同じ入金確認処理へ流す。
  - `vercel.json` に `freee-payment-sync` (09:10 JST) と `payment-confirm-nudges` (09:30 JST) を追加。
- 設計md:
  - `design/SPEC_pwa.md` に admin/projects 正本化、payment-confirm API、2つのcronを追加。
  - `design/routine.md` に支払条件・入金確認の正本ルールを追加。
  - `design/notifications.md` に入金確認nudgeの扱いを追加。
  - `design/cockpit.md` にコックピットconfig導線を置かないルールを追記。

#### 支払条件の稼働月基準化 + MS管理対象PJの整理

- まさ指摘:
  - `admin.projects.支払条件` は請求書発行月基準ではなく、稼働月基準で表す。
  - 5月稼働分を6月に請求して6月末支払の場合は `翌月末`。`発行月末` という表現は使わない。
  - DTSU PJとエコシステム構築PJでMS計画が無い場合はMS設定を促す。advisorなど非MS管理PJではMS進捗を抽出せず、毎月の進捗だけを月次モーダルに記録する。
- 実装:
  - `payment-rules.ts` の支払条件を稼働月基準へ変更。UI選択肢は `当月末 / 当月25日 / 翌月末 / 翌月25日 / 翌々月末 / 翌々月25日`。
  - 旧 `issue_month_*` は互換入力として `next_month_*` に読み替え、DB migration `081_payment_due_rule_work_month_basis.sql` で正本値から消す。
  - `/admin/payouts` の説明・PJ予算確定モーダルは「支払月」表現に統一。
  - `cron/hourly-estimate` と `activities/infer` の全PJ対象を active DTSU / ecosystem に限定。
  - `progress-estimator` は非MS管理PJを `monthly note only` としてLLM抽出せず、MS管理対象PJでMS計画/項目が無い場合は `project_config_gap` 通知を upsert。
  - Cockpit / HUD Cockpit は非MS管理PJではMSカード・過去MS・MS設定バナーを出さず、月次モーダルの月次ノートに毎月の動きを残す導線にする。

#### admin.members 最終ログインが全員空の修正

- まさ指摘: `/admin/members` のOS最終ログインが全員「データなし」。まさ自身はログイン済みなのに反映されていない。
- 原因:
  - 実装は `/auth/callback` でCalendar確認に成功したタイミングだけ `members.last_login_at` を更新していた。
  - `last_login_at` 列追加前からログイン済みの既存セッションは `/auth/callback` を再通過しないため、実際にOSを使っていても `last_login_at` が null のまま残った。
- 実装:
  - middlewareで authenticated user の通常ページアクセスを見たら、1時間に1回だけ `members.last_login_at` を service_role でtouchする。
  - Supabase Auth `last_sign_in_at` から既存ログイン履歴を一回backfillし、まさ / きよ / かる / りり / ちこ / あび / info の `last_login_at` を復元した。

#### 通知詳細のXRL scope不整合 / raw_data_gap stale表示修正

- まさ指摘:
  - `SX: BRL根拠候補を追加する？` で、通知本文はあるのに「抽出された行が見つかりませんでした」と表示される。
  - `SX: 5/21社内MTGがOS未取り込み` と出るが、OSが認識しているなら取り込めるはず。
  - `CX: 5月進捗スライドが0/0pt` / `OS未取り込み` が何を意味するか分かりにくい。
- 調査結果:
  - `xrl_evidence` は通知 `scope_key=202605:sx-miura-finechem-brl`、正本 `project_xrl_evidence.ym=202605` で、PWA詳細とfeedback APIが完全一致検索して候補行を見失っていた。
  - SX 5/21社内MTGは `project_meeting_summaries` に取り込み済み。raw_data_gap通知は古いsnapshot差分由来で、live DBの取り込み済み状態を反映していなかった。
- 実装:
  - 通知詳細の `xrl_evidence` は `scope_key` から `YYYYMM` を抽出し、`metadata_json.axis/evidence_kind/evidence_source_hash` で候補行を絞り込む。
  - `/api/notifications/feedback` のXRL承認/却下も同じ正規化で `project_xrl_evidence` を `confirmed` / `rejected` に遷移する。
  - `meeting-not-ingested` 系raw_data_gapは展開時に `project_meeting_summaries` をlive確認し、取り込み済みなら「OS取り込み済み」を先頭表示する。
  - `BUGS.md` / `design/notifications.md` / `design/xrl_evidence.md` に再発防止ルールを追記。

#### 関連メンバーのAMD本名alias重複修正

- まさ指摘:
  - 関連メンバーで `まさ` と `山地正洋` が別人として表示される。
  - L2抽出が本当にmd正本を見ているか、どのmdを見ていて、AMDメンバー情報がそこにあるか確認したい。
- 調査結果:
  - `cron/founding-members-extract` は SU 別 md を直接読むのではなく、`/Users/masa/projects/knowledge/<slug>.md` を `project_ventures.master_md_text` に同期した本文をpromptに注入している。
  - AMDメンバー一覧mdはpromptには直接入れていない。AMDメンバー正規化は Supabase `members` の `code_name` + `member_name` から alias map を作る設計。
  - `members` には `ID001 / code_name=まさ / member_name=山地 正洋` が入っており、alias map自体は `山地正洋` → `まさ` を作れる。
  - ただし過去cleanupが `status='active'` だけを対象にしており、後続migrationで `category='university'` の `山地正洋` が `tentative` として復帰したため、表示対象に残っていた。
- 実装:
  - `cron/founding-members-extract` の既存メンバー参照から `invalid` 行を除外。
  - migration `082_related_members_amd_alias_canonical.sql` を追加し、`members.member_name` 由来の本名 / 空白除去 / 姓 alias を code_name 行へ集約してから alias 側を invalid 化。
  - 本番DBへ適用済み。`status != invalid` の `山地正洋` 行は0件になり、BWEの旧 `山地正洋` は `まさ / AMD / amd_support / tentative` に集約済み。

#### admin.payments status文言統一 / ZMP reward_summary未保存原因 / MS未設定月の月次ノート化

- まさ指摘:
  - `admin.payments` の `配賦確定` という言葉はもう使っていないので、`予算確定` に統一する。
  - ZMP 4月稼働分の報酬額が payouts に出ない理由は、単に `reward_summary_json` が無いだけでなく、なぜ保存されていないのかまで説明が必要。
  - MSが設定されていない月も情報を拾うこと自体は正しい。MSがある月はMS進捗へ、MSがない月は月次モーダルの月次ノートへ入れるべき。
- 調査結果:
  - ZMP (`p19`) `202604` は `projects.fee_type='monthly_fixed'` / `fee_amount=300000`、対象PlanCycle・MS・責任配分・`milestone_monthly_progress` は存在する。
  - ただし `billing_cycles(202604).reward_summary_json` / `monthly_reward_payout` が空。コード上も `reward_summary_json` は cockpit 月次モーダルがクライアント側でpreview表示するだけで、DBへ保存するwriterが存在しなかった。
  - `/admin/payouts` は `reward_summary_json.members` だけを正本として `monthly_reward_payout` を生成するため、previewに報酬額が見えてもDB未保存月はpayoutsに出ない。
- 実装:
  - `AdminBillingMatrix` の予算確定完了時 status を `allocation_confirmed` ではなく `budget_confirmed` で保存するよう変更。
  - `AdminPayoutsClient` は旧DB値 `allocation_confirmed` も表示上は `予算確定` として扱う。
  - migration `083_budget_confirmed_status_unification.sql` を追加し、既存 `allocation_confirmed` を `budget_confirmed` へ寄せる。
  - `progress-estimator` は、非MS管理PJまたは対象月にMS計画/有効MS項目が無い場合、`project_config_gap` 通知を作らず、`monthly_reports` + `project_meeting_summaries` を `project_monthly_notes` に保存する。
  - `cron/hourly-estimate` はactive PJ全体を見に行き、MS管理対象外は月次ノートonlyで処理する。
  - migration `084_clear_stale_ms_config_gap_notifications.sql` を追加し、旧ロジックの `missing_ms_plan` / `missing_ms_items` 通知を削除する。
- 予防策:
  - `reward_summary_json` は cockpit preview の副産物にせず、サーバー側の報酬サマリ生成を正本化する。MS進捗更新・予算確定・admin payouts保存前のいずれかで、`billing_cycles.reward_summary_json` を必ず生成/更新する仕組みにする。

#### admin.projects PJ名編集 / 関連メンバー通知文言統一

- まさ指摘:
  - p20 のPJ名に `CryoX（仮称）` と出るので `（仮称）` を削除したい。
  - PJ名がUI上で編集できないのはよくない。`admin.projects` で編集できるようにする。
  - `創業メンバー更新` 通知は、実際には `関連メンバー` の更新なので文言を直す。
- 実装:
  - `AdminProjectsTable` のPJ名セルをクリック編集対応にし、`/api/admin/projects/[id]` 経由で `projects.project_name` を保存できるようにした。
  - migration `085_project_name_and_related_member_notification_labels.sql` を追加。本番DBへ適用済み。
  - p20 `project_ventures.display_name` は `CryoX`、`master_md_text` 内の `仮称` 表記は削除済み。
  - 既存 `l2_notifications(l2_kind='founding_members')` の `創業メンバー更新` / `CryoX（仮称）` タイトルを `関連メンバー更新` / `CryoX` へ置換済み。新規cronは既に `関連メンバー更新` で作る。

#### admin.payouts PJ別収支表に役員相殺を統合

- まさ指摘:
  - 役員除外分を別枠で示すのではなく、PJごとの収支全体の中で見たい。
  - クライアントからAMDへの支払額、バッファ、PJ予算、各メンバーへの支払額を並べる。
  - 役員分は支払額と同額を足して相殺し、最終収支がいくらかをPJごとに示す。
- 実装:
  - `AdminPayoutsClient` の別枠「役員除外分」カードを削除。
  - PJ別収支 / 予算チェック表を追加し、PJごとに `クライアント支払 / バッファ / PJ予算 / 非役員支払 / 役員分 / 役員相殺 / 最終収支` を表示。
  - メンバー別行では、非役員は通常支払、役員ONメンバーは `役員 / 支払対象外` とし、`支払額` と `相殺 +同額` を出して収支影響0にする。
  - 保存対象の `monthly_reward_payout` は従来通り役員を除外し、表示上の収支説明だけに役員相殺を入れる。

#### #10 reward_summary_json のSupabase正本化 / ZMP 202604 backfill

- まさ指摘:
  - OSはSupabaseを表示するツールのはずなので、Supabaseに入っておらずUI上だけで表示される業務データは無くしたい。
  - ZMPの報酬がpayoutに出るようにしたい。
  - 他PJ/他月も、月次モーダルで報酬額が表示されるならpayoutでも表示され、そのデータがSupabaseに入っている設計にする。
- 原因:
  - Cockpit月次モーダルは `billing_cycles.reward_summary_json` が空のとき、ブラウザ側で `buildRewardPreview()` を作って表示していた。
  - そのpreviewをDBへ保存するwriterが無く、`admin.payouts` は `reward_summary_json.members` だけを見るため、ZMP `202604` がpayoutsに出なかった。
- 実装:
  - `src/lib/reward-summary.ts` を追加。MS進捗・責任配分・PlanCycle・PJ委託料から報酬サマリーを生成し、`billing_cycles.reward_summary_json` に保存するサーバー側正本にした。
  - `/api/rewards/sync` を追加。月次モーダルは未保存previewを出さず、まずSupabaseへ保存してから保存済み報酬サマリーを表示する。
  - `progress-estimator` / `progress/confirm` / `progress/revisions` / `progress/batch-save` は進捗保存後に報酬サマリーもsyncする。
  - `admin/payouts` は表示前に対象cycleの `reward_summary_json` をsyncするため、月次モーダルで表示できる報酬はpayoutsでも同じ正本から表示される。
  - `scripts/backfill_reward_summaries.ts` を追加し、production Supabase 135 cycleをscan、20 cycleをsync済み。ZMP `p19:202604` は `totalPaySum=110,740`、メンバー別明細も `reward_summary_json` に保存済み。
- 仕様変更:
  - OS UI上だけに存在する報酬previewは禁止。
  - 報酬額を表示する場合は、必ず `billing_cycles.reward_summary_json` に保存済みの値を表示する。

#### #15 PWA/GAS background cron の停止

- まさ指摘:
  - 生データ抽出はCodex automationへ寄せたはずなのに、GAS/Vercel cronがまだ走ってAnthropic課金が続いている。
  - `/api/cron/hourly-estimate`、Atlas系、member activities、venture narrative、relearn、founding members、grant/vc/seeds/kaken等を止めたい。
- 原因:
  - 以前止めたのは一部のAtlas/Claude scheduled taskで、Vercel `pwa/vercel.json` のcron群と、GAS `154_PwaCronCaller.js` からPWA cronを叩くアダプタが別経路で残っていた。
  - Vercel cronを外しても、GAS time-triggerが `/api/cron/hourly-estimate` やASPI系を直接叩く構造だった。
- 実装:
  - `pwa/vercel.json` の `crons` を空配列に変更。本番deploy後はVercel scheduled cronは作られない。
  - `pwa/vercel.disabled-crons.json` に停止した全cronと復旧条件を記録。
  - `gas/154_PwaCronCaller.js` に kill switch を追加し、`nav_pwa_pingHourlyEstimate` / ASPI ping 系は即disabled responseを返す。
  - `nav_pwa_disableAllPwaCronTriggers_()` を追加し、GAS側の既存PWA cron triggerを削除できる入口を用意。
  - 旧GAS抽出cronも停止: `060_RewardV2_Estimator.js`、`056_RewardScoring_Trigger.js`、`153_MeetingHourlyTrigger.js`、`152_NavigatorCron.js`、`155_L2KnowledgeExtractor.js` にkill switchを追加。
  - `clasp push` は `invalid_rapt` で未反映。ただし既存本番GASの `nav_l2_pruneDuplicateTriggers` をWebApp経由で呼び、live triggerは削除済み。削除: `nav_pwa_pingHourlyEstimate` 1件、`nav_pwa_pingWeeklyAspiSet1/2` 各1件、`nav_member_knowledge_pollAll` 1件、`nav_project_knowledge_pollAll` 1件、`nav_protocol_pollAll` 1件、`nav_meeting_pollRecentlyEndedEvents` 1件、`reward_trigger_dailyExtract` 1件。
  - Operations Settingsは `/settings` ではなく `/admin/settings` に統合。`/settings` routeとGlobalNavの一般設定リンクは削除。cron台帳は停止済みcronを全件表示し、停止中は `Run Now` できないUIにした。
- 仕様変更:
  - LLM課金が発生する定期抽出cronは停止。Codex automationを一次実行系にする。
  - PWA cron route自体は手動検証用に残すが、自動scheduleからは外す。復旧はownerが費用とtrigger sourceを明示してから行う。
  - Raw/L2/Cron台帳はadmin専用画面で見る。一般ユーザー向け `/settings` は持たない。

#### #2 SX入金確認 / freee同期 / Slack nudge

- まさがお願いしていたこと:
  - SXがまだ入金未確認になっている理由を知りたい。
  - freeeから入金情報が取れていないのか確認したい。
  - admin向けSlack nudgeが本当に実装・送信される状態か確認したい。
- どう解決したか:
  - production `/api/cron/freee-payment-sync?ym=202605&dryRun=1` を確認し、`Freee token refresh failed: 401 invalid_client` を特定。freee入金履歴は取得できていないため、freee OAuth credentials / refresh token の再認証が必要。
  - production `/api/cron/payment-confirm-nudges?ym=202605&dryRun=1` を確認し、SXとadmin宛先 (まさ/きよ) の対象抽出自体はできていると確認。
  - ただしVercel cron停止中で自動送信されず、admin手動送信UIも無かったため、`/api/cron/payment-confirm-nudges` にadmin認証POSTを追加し、`/admin/payouts` に「入金確認nudge」ボタンを追加。
  - まさ確認によりSX `p21:202601-202603` は入金済みとして、本番Supabaseの `payment_confirmed_at` / `payment_confirmed_by` / `status='payment_confirmed'` を更新し、`billing_log.detail` に `manual_admin_correction` として記録。
- できるようになったこと:
  - SX `202601-202603` は入金確認済みとしてOSに反映済み。
  - 入金確認nudgeは、cron復旧なしでも `/admin/payouts` からadminが手動送信できる。
  - freee同期の未動作原因はコードロジックではなく認証 (`invalid_client`) として切り分け済み。

#### #16 ZMP.202604 PJ予算データなし

- まさがお願いしていたこと:
  - ZMP `202604` のPJ予算が `/admin/payouts` で「データなし」になっている理由を知りたい。
- どう解決したか:
  - production DBを確認し、`budget_reported_amount=300000` と `reward_summary_json.capBudgetYen=195000` は存在していたが、`billing_cycles.budget_yen` がnullだったことを特定。
  - `/admin/payouts` のPJ予算列は `billing_cycles.budget_yen` を正本として見るため、「データなし」になっていた。
  - `syncRewardSummaryForCycle()` が、月額固定PJまたは `budget_reported_amount` があるcycleでは `billing_cycles.budget_yen = 請求額×65% - バッファ` も保存するように修正。
  - production `p19:202604` を再syncし、`budget_yen=195000`, `reward_summary_json.totalPaySum=110740` を確認済み。
- できるようになったこと:
  - 月額固定PJのPJ予算はUIだけの計算値ではなく、Supabase `billing_cycles.budget_yen` に保存される。
  - 月次モーダルで報酬が見える月は、payoutsでも同じSupabase正本からPJ予算・報酬を見られる。

#### #17 admin.payouts 収支表の縦型化

- まさがお願いしていたこと:
  - `/admin/payouts` の全体収支や各PJ収支が横並びカードだと計算しにくい。
  - 普通のPL表のように、項目を縦、PJを列にしてほしい。
  - 一番左の列を全体収支、次列から各PJの収支にし、PJが多い場合は横スクロールを許容したい。
- どう解決したか:
  - `/admin/payouts` のPJ別収支を、横並びカードから「項目縦 / データ列: 全体収支, 各PJ」の表に変更。
  - 稼働月、クライアント支払、バッファ、PJ予算、支払予定、役員分、役員相殺、最終収支、メンバー別支払を同じ表に収めた。
  - PJが増えた場合は横スクロールするレイアウトにした。
- できるようになったこと:
  - 全体収支とPJ別収支を同じ勘定項目で横比較できる。
  - 役員分の相殺も各PJ列の中で見えるため、計算の流れを追いやすくなった。

#### #18 月次ルーティン 請求額確定のPL Slack nudge

- まさがお願いしていたこと:
  - 月次ルーティンの「請求額確定」でPLに申請しても、PL側にnudgeが来ない。
  - ボタン付きのSlack nudgeが来るようにしたい。
- どう解決したか:
  - `/api/notify/pl-review` は存在していたが、`chat.postMessage(channel=userId)` のプレーンDMで、`conversations.open` を使っておらず、ボタンも無かった。
  - `/api/notify/pl-review` を `conversations.open` でDMを開いて送る方式へ変更。
  - Slack messageに「コックピットで確認」ボタンを追加。
  - `CockpitRoutineBudgetModal` のPL確認依頼ラベルを `予算確定` から、画面ステップ名と同じ `請求額確定` に変更。
- できるようになったこと:
  - `project_members.is_pl=true` のPLへ、請求額確定の確認依頼がボタン付きSlack DMで届く。
  - PLはボタンから対象PJのコックピットへ戻って確認できる。

#### #2 入金確認の根本対策

- まさがお願いしていたこと:
  - SXの入金済みをデータだけ直しても、次月また同じになるので根本解決したい。
- どう解決したか:
  - LLM課金を生むcronは停止したまま、LLM非使用の支払運用cronだけをVercelに戻した。
  - `freee-payment-sync` は毎日09:10 JST、`payment-confirm-nudges` は毎日09:30 JSTに実行される。
  - freee同期が `invalid_client` などで失敗した場合は、active adminにSlackで失敗理由を通知し、その後の入金確認nudgeで手動確認できるようにした。
- できるようになったこと:
  - freeeで照合できればadmin回答なしで入金確認済みになる。
  - freeeが死んでいても失敗がSlackで見え、同日中にadmin確認nudgeが飛ぶ。

#### #16 / #18 請求額確定からPJ予算確定までの根本対策

- まさがお願いしていたこと:
  - ZMPのように月次モーダルでは金額が見えるのに、payoutsではPJ予算がデータなしになる状態をなくしたい。
  - PL Slack nudgeには請求額・バッファ・PJ予算を出し、`承認する` / `差し戻す` ボタンを付けたい。
  - OSモーダルにも承認ボタンが必要。請求額の下の `0` 表示も消したい。
- どう解決したか:
  - `/api/admin/budget-approval` を追加し、Slackボタン・OSボタンの承認/差し戻しを同じAPIに集約。
  - 承認時は `billing_cycles.status='budget_confirmed'`、`budget_yen=請求額×65%−バッファ`、`budget_confirmed_at/by` を同時に保存。
  - PL Slack nudgeは請求額・バッファ・PJ予算を明記し、`承認する` / `差し戻す` / `OSで確認` の3ボタンにした。
  - `CockpitRoutineBudgetModal` に承認/差し戻しボタンを追加し、`0 && <InfoRow>` が画面に `0` として出るReact事故を修正。
- できるようになったこと:
  - 申告だけで止まらず、承認アクションでSupabase正本の `budget_yen` が確定する。
  - 次回以降も、月額固定・変動にかかわらず「請求額申告 → PL/admin承認 → PJ予算確定 → payouts反映」の流れになる。

#### #19 社外役員PJの月次ルーティン除外

- まさがお願いしていたこと:
  - 社外役員PJは月次ルーティン不要なので発生させない。
- どう解決したか:
  - `projects.project_category='advisor'` のPJは `CockpitRoutineGas` で月次タスクを出さない。
  - `/mypage` の通知生成・期限超過による報酬除外判定からもadvisor PJを除外。
- できるようになったこと:
  - LST / SE / CLG などの社外役員/顧問PJに、請求額確定や報告書FIXなどの月次ルーティンが発生しない。

#### #20 マイページ「今週やったこと」の受信メール混入防止

- まさがお願いしていたこと:
  - 受信しただけのメールやメール本文が、そのまま「今週やったこと」に出ないようにしたい。
- どう解決したか:
  - Gmail直取得は `SENT` / `DRAFT` のみを活動扱いにし、活動メンバーもメール参加者全員ではなく送信者だけにした。
  - `source_cache` 経由のGmailも、社内メンバーが送信者のものだけ活動扱いにした。
  - `/mypage` 表示側でも、古い `source_subkind` 不明のGmail週次行を表示しないガードを追加。
  - 表示文はメール本文ではなく「メールを送信」「返信ドラフトを作成」「予定に参加/主催」の行動要約に変換。
- できるようになったこと:
  - 招集通知や受信メール本文が、まさの「やったこと」として表示されない。
  - 今週の活動は、本人の送信・下書き・参加/主催予定など、行動として説明できるものだけになる。

#### #2 LLMなしcronの復旧 / freee同期の現状

- まさがお願いしていたこと:
  - LLMを使わないcronまで止めていたなら想定外なので、止めたものを確認し、あれば復活させたい。
  - freeeからの入金履歴収集が本当にできる状態か確認したい。
- 原因:
  - LLM課金停止のため `vercel.json` を空にしたとき、LLMを使わない `member-weekly-activities` / `papers-quarterly-ingest` / `sync-pj-facts` / `macro-aggregate-indicators` まで一緒にscheduleから外れていた。
  - `freee-payment-sync` のコード経路はあるが、本番dryRunで `Freee token refresh failed: 401 invalid_client`。freee OAuth credentials / refresh token が無効で、入金履歴取得の手前で落ちている。
- どう解決したか:
  - LLMを使わない4本を `pwa/vercel.json` に戻し、`pwa/vercel.disabled-crons.json` からも外した。
  - `/admin/settings` のOperations台帳でも4本をactive扱いに戻し、LLM系cronだけをdisabledとして残した。
  - `freee-payment-sync` のdryRun失敗時はSlack失敗通知を飛ばさないようにし、本番確認でadmin DMが増えないようにした。
- できるようになったこと:
  - 非LLMのデータ同期/集計cronは本番deploy後に自動実行へ戻る。
  - freee入金同期は実装済みだが、現時点では認証再設定が終わるまで実データ取得できない、と切り分け済み。

#### #20 OkuDoor共同開発が「今週やったこと」に出ない理由

- まさがお願いしていたこと:
  - うめ/あびと3人でOkuDoorシステム開発をオンラインで進めた活動が、なぜ検出できていないか知りたい。
- 原因:
  - production Supabaseの `projects` に OkuDoor/Oku/Door に一致するPJが存在しない。
  - `member-weekly-activities` はPJ名・client名・PJ専用メール等でPJに紐づかない予定を捨てていたため、projects未登録の社内開発MTGは保存対象外になっていた。
  - うめ/あびの `members.google_calendar_status` は `missing` で、OSから直接読めるカレンダーはまさ側に限られる。まさの読めるカレンダー/source_cacheに予定が無い場合は抽出できない。
- どう解決したか:
  - 登録PJに一致しない場合でも、社内メンバー2名以上が参加し、開発/実装/MTG/オンライン等の共同作業語がある予定・source_cacheは AMD共通活動 (`p00`) として保存するfallbackを追加した。
  - このfallbackはGmail/source_cache/Calendarの各抽出経路に入れた。
- できるようになったこと:
  - OkuDoorがprojects未登録でも、まさの読めるカレンダーまたはsource_cacheに予定があれば、社内共同開発として「今週やったこと」に出せる。
  - うめ/あび側のカレンダーだけにある予定は、引き続きGoogle Calendar共有が必要。
  - deploy後、`2026-05-21 18:00 - 2026-05-22 18:00 JST` のまさ分を再抽出し、`ZeMAシステム設計MTG` (まさ/うめ/あび) を含む3件を `member_activities(source='member_weekly')` に保存済み。

#### #21 マイページ「いまやること」の担当外TODO混入

- まさがお願いしていたこと:
  - `/mypage` の「いまやること」に、そのユーザーが担当していないTODOまで入っていないか確認したい。
- 原因:
  - 旧実装は `project_members.is_active=true` の参加PJすべてに対して月次ルーティンTODOを生成していた。
  - `is_pm` / `is_pl` を見ておらず、ただ参加しているだけのPJでも請求書発行・報告書FIXなどが出る設計だった。
- どう解決したか:
  - `/mypage` のTODO生成を `project_members.is_pm` / `is_pl` で絞るようにした。
  - PMはそのPJの月次ルーティン全体、PLは請求額確定だけ、PM/PLでない参加メンバーには月次ルーティンTODOを出さない。
- できるようになったこと:
  - 「いまやること」は参加PJ一覧ではなく、そのユーザーの担当roleに基づく個人TODOになる。

#### #20 OkuDoor / ZeMA を ZMP に紐づけ

- まさがお願いしていたこと:
  - OkuDoor と ZMP、ZeMA と ZMP が紐づいていないなら、まずそこを解決したい。
  - OkuDoorの共同開発が「今週やったこと」に出ない根本原因も、projects未登録ではなくZMP alias未設定なのではないか確認したい。
- 原因:
  - production Supabaseの `projects` は ZMP (`p19`) だけが存在し、OkuDoor / ZeMA / 奥ドアは `projects` / `project_ventures` / `project_partners` に紐づいていなかった。
  - そのため、週次活動抽出は `ZeMAシステム設計MTG` や `OkuDoor` をZMP活動として判定できなかった。
- どう解決したか:
  - `project_knowledge` に `category='alias'`, `status='active'`, `project_id='p19'` として `OkuDoor` / `Okudoor` / `奥ドア` / `ZeMA` を登録。
  - `/api/cron/member-weekly-activities` と `/api/cron/member-activities` が `project_knowledge(category='alias')` をPJ名判定に使うように変更。
  - 社内共同開発fallbackでも OkuDoor / ZeMA / 奥ドアは AMD共通 (`p00`) ではなく ZMP (`p19`) に寄せるようにした。
- できるようになったこと:
  - OkuDoor / ZeMA / 奥ドアが Calendar / Gmail / source_cache / 議事録に出た場合、ZMP (`p19`) の活動として保存される。
  - 一般の社内共同作業だけは、引き続きAMD共通 (`p00`) に逃がせる。

#### #21 「今週やったこと」を議事録ベースの成果文へ

- まさがお願いしていたこと:
  - 「予定を主催: SX MTG ファインケム@八重洲」のような予定名ではなく、Notion議事録から実際の進捗を読んでほしい。
  - SXは「SXのPoCの先候補を新たに獲得できる可能性を上げた」、OkuDoorは「うめあびと3人で開発を行い、LINEとの連携が完了した」のように出したい。
- 原因:
  - `project_meeting_summaries` にはSXファインケムMTGのNotion/Gmail要約があったが、`member-weekly-activities` は Calendar / Gmail / source_cache だけを見ていた。
  - そのため、議事録の `progress` / `decided` ではなくカレンダー題名から「予定を主催/参加」を作っていた。
- どう解決したか:
  - `/api/cron/member-weekly-activities` が同期間の `project_meeting_summaries` を読み、calendar event idまたは同日同題名で予定と突合するようにした。
  - 議事録がある予定は、calendar行を抑制し、`source_kind='meeting_summary'` として成果文を保存する。
  - SXファインケム / 北陸工場 / PoC / 実証実験の文脈は「SXのPoC先候補を新たに獲得できる可能性を上げた」に変換する。
  - OkuDoor / ZeMA / LINE / LIFF / 公式アカウントの文脈は「うめ・あびと3人でOkuDoorシステム開発を行い、LINEとの連携が完了した」に変換する。
  - `/mypage` 側は `meeting_summary` を「議事録」由来として表示し、既存の「予定を主催: 予定を主催: ...」二重prefixも除去する。
- できるようになったこと:
  - Notion議事録に進捗があるMTGは、単なる予定参加ではなく、成果ベースで「今週やったこと」に出る。
  - カレンダー題名だけでは説明できない重要進捗を、Supabaseの `project_meeting_summaries` を経由してMyPageに反映できる。

#### #2 freee入金同期をできる状態まで復旧する作業

- まさがお願いしていたこと:
  - freeeは「実装経路はあるが認証が401で落ちている」で止めず、入金履歴を取得できる状態まで進めたい。
- ここまで分かったこと:
  - local `.env.local` / Supabase `freee_oauth_tokens` のrefresh tokenは同じだが、freee token refreshは `401 invalid_grant`。client credentialsは通っているが、refresh tokenが期限切れ/失効している状態。
  - Vercel production envは local と異なる `FREEE_CLIENT_ID` / `FREEE_CLIENT_SECRET` / `FREEE_COMPANY_ID` が入り、`FREEE_REFRESH_TOKEN` も未設定だったため、本番は `invalid_client` で落ちていた。
  - Googleログインはfreee側で「外部連携されていない」と弾かれたため、freee IDログインで新しいOAuth refresh tokenを取得する必要がある。
  - PWA `freee-client` のrefresh token保存処理が `freee_oauth_tokens.service` でupsertしていたが、DB正本は `token_key` 主キー。存在しない列で保存が失敗し、refresh tokenローテーションが次回に引き継がれない再発バグがあった。
- どう解決したか:
  - `freee-client` は `freee_oauth_tokens(token_key='default')` を正として読み書きするように修正。
  - `FREEE_REFRESH_TOKEN` envが未設定でも、Supabaseに最新refresh tokenがあればそれを使えるようにした。
  - `company_id` もSupabaseのtoken行を優先し、Vercel envのcompany idが古い場合でもDB正本に寄るようにした。
  - OAuth取得スクリプトは新tokenを `.env.local` / `.env.production.local` だけでなくSupabaseにも保存し、ログにはrefresh token本体ではなくsha8だけを出すようにした。
  - Vercel production の `FREEE_CLIENT_ID` / `FREEE_CLIENT_SECRET` / `FREEE_COMPANY_ID` をlocal正本に揃えてredeploy。production dryRunのエラーは `invalid_client` から `invalid_grant` に変わり、client認証のズレは解消済み。
- 次の作業:
  - freee保存パスワードの利用確認を得てfreee IDログインし、OAuth authorize callbackから新refresh tokenを取得する。
  - `.env.local` / `.env.production.local` / Supabase `freee_oauth_tokens` / Vercel production env を同じcredentialセットに揃える。
  - 本番 `/api/cron/freee-payment-sync?ym=202605&dryRun=1` が token error ではなく freee deal照合結果を返すことを確認する。

#### #20 OkuDoor alias正本と表記修正

- まさがお願いしていたこと:
  - 「奥ドア」は不要で、代わりに「OkuDoor」を使う。
  - 各PJのaliasがどこを正本として参照しているか、`project_knowledge(category='alias')` と `CFG_Alias` / `CFG_PJAlias` の関係を知りたい。
- 原因:
  - 既存設計ではPJ alias正本は外部スプシ `CFG_PJAlias`。GASの `CalendarToNotionMinutes.js` / `159_PJAliasDebug.js` と設計ログにも「コード内alias禁止、CFG_PJAliasが唯一正本」と書かれている。
  - ただしPWAの週次活動抽出では、Supabaseだけでruntime判定するために、臨時で `project_knowledge(category='alias')` を読ませていた。
  - その臨時aliasに `奥ドア` をactive登録してしまっており、正本ルールとも表記方針ともズレていた。
- どう解決したか:
  - production Supabaseのp19 aliasで `奥ドア` を `status='rejected'` に変更し、active aliasは `OkuDoor` / `Okudoor` / `ZeMA` に限定。
  - コード内の `奥ドア` hardcodeを削除。
  - `pwa/design/mypage.md` / `HANDOFF_pwa_rebuild.md` に、alias正本は `CFG_PJAlias`、`project_knowledge(category='alias')` はPWA runtime用の暫定ミラーで正本ではない、と明記。
- できるようになったこと:
  - UI/抽出では `OkuDoor` 表記に寄る。
  - `project_knowledge(category='alias')` を正本と誤解せず、今後は `CFG_PJAlias` からSupabase runtime mirrorへ同期する設計に寄せられる。

#### #21 「今週やったこと」を生データ統合抽出へ修正

- まさがお願いしていたこと:
  - 議事録を優先する、カレンダーより議事録を優先する、という低い設計ではなく、すべての生データと複数生データのつながりから「実務として何をこなしたか」のシグナルを取ってほしい。
  - 以前出した `SXのPoC先候補...` / `OkuDoorシステム開発...` の2文が本当にLLM抽出なのか、手作業なのか知りたい。
- 原因:
  - 以前の修正は `project_meeting_summaries` がある予定でcalendar行を抑制し、議事録由来の成果文に置き換える設計だった。
  - しかも2文はLLMの一発抽出ではなく、SXは議事録要約からのルール変換、OkuDoorはNotion確認後に不足していた `project_meeting_summaries` 行を手で補ったものだった。
- どう解決したか:
  - `/api/cron/member-weekly-activities` で Calendar / Gmail / source_cache / `project_meeting_summaries` を `projectId + memberId + event/thread/title` 単位に束ねる `source_fusion` に変更。
  - Calendarのdescription/TODOも根拠として扱い、議事録だけを優先しないpromptに変更。
  - Anthropicが使える環境ではgroupごとに実務成果文を生成し、使えない/失敗した場合だけfallback要約を保存する。
  - 保存時の `raw_metadata` に `source_kind='source_fusion'`, `source_kinds`, `evidence_refs`, `synthesis_method`, `synthesis_confidence` を残し、後からどの生データをつないだか追えるようにした。
- できるようになったこと:
  - 「予定を主催」ではなく、カレンダーTODO・議事録・メール・source_cacheを束ねた活動単位で「実務として何を進めたか」を表示できる。
  - 手補正で作った2文に依存せず、次回以降も同じ構造で抽出できる。

#### #2 freee入金同期を口座明細まで拡張

- まさがお願いしていたこと:
  - freeeのパスワード入力後に「存在しないアプリケーション」エラーが出たので、入金履歴取得をできる状態まで進めたい。
  - SXは実際には入金済みなので、freeeから自動確認できるようにしたい。
- 原因:
  - freeeアプリ `AMD_OS連携` 自体は存在していた。エラー原因は、freee側のコールバックURLが `urn:ietf:wg:oauth:2.0:oob` なのに、取得スクリプトがローカルHTTP callbackをデフォルトで使っていたこと。
  - さらに既存同期はfreee会計の収入取引 (`/api/1/deals`) だけを見ていた。SXの5月入金はfreeeの「取引」ではなく、取引登録前の銀行口座明細 (`/api/1/wallet_txns`) に `2026-05-11 / 2,992,000円 / 振込 ダイ）エヒメダイガク` として存在していた。
- どう解決したか:
  - OAuth取得スクリプトのデフォルトredirectをfreeeアプリ設定に合わせて `urn:ietf:wg:oauth:2.0:oob` に変更。ローカルcallbackを使う場合だけ `--local-callback` を指定する。
  - まさの認可コードから新refresh tokenを取得し、`.env.local` / `.env.production.local` / Supabase `freee_oauth_tokens(token_key='default')` に保存。
  - refresh tokenは使用時にローテーションされるため、疎通確認でも返却された新tokenを必ずSupabaseへ保存する運用に修正。
  - `/api/cron/freee-payment-sync` が `wallet_txns(entry_side=income)` も読み、金額またはPJ別 `project_knowledge(category='payment_alias')` で照合するように変更。
  - SX (`p21`) には `payment_alias='エヒメダイガク'` を登録し、愛媛大学の銀行明細摘要をSX入金として照合できるようにした。
- できるようになったこと:
  - freee API認証は `invalid_client` / `invalid_grant` ではなく正常に通る。
  - freee取引登録前でも、銀行明細に入金があればOSの入金確認に使える。
  - adminがSlack nudgeに回答し忘れても、freee口座明細から明確に一致する入金は自動で `billing_cycles.payment_confirmed_at` へ反映できる。

#### #21 OkuDoor週次活動を参加者全員のマイページへ反映

- まさがお願いしていたこと:
  - OkuDoorシステム開発の件が、うめ・あびの2名のマイページにも掲載される仕組みになっているか確認したい。
- 原因:
  - 週次活動cronが、Calendar接続済みメンバーだけを `buildMemberMatcher` に渡していた。
  - そのため、まさの共有カレンダーや議事録にうめ・あびの参加者emailが入っていても、うめ・あび本人の `member_activities(source='member_weekly')` 行は作られていなかった。
- どう解決したか:
  - `/api/cron/member-weekly-activities` で「読むカレンダー」と「保存対象メンバー」を分離。
  - 読むカレンダーは `google_calendar_status='connected'` のメンバーだけにしつつ、保存対象はactiveな人間メンバー全員に変更。
  - `/api/mypage/weekly-activities/refresh` も本人カレンダー未接続を即エラーにせず、他メンバー共有カレンダー/議事録/source_cacheに参加者として出る活動は抽出できるようにした。
- できるようになったこと:
  - OkuDoorのように共有カレンダー・議事録に複数AMDメンバーが参加者として出ている活動は、参加者全員のマイページに保存・表示できる。

#### #22 コードネームをメンバーマイページリンク化

- まさがお願いしていたこと:
  - OS全体で、文章中に各メンバーのコードネームが出るとき、そのメンバーのマイページへ飛ぶリンクを付けたい。
- どう解決したか:
  - `LinkedMemberText` 共通UIを追加し、activeメンバーの `code_name` を文章中で検出して `/mypage?memberId=<member_id>` にリンクするようにした。
  - `/mypage` はadmin閲覧時のみ `memberId` queryで他メンバーのページを表示できるようにした。
  - まずマイページの週次活動/今月の活動/進捗文、通知画面の見出し/詳細/フィードバック、ナビ右上のコードネームに適用した。
- できるようになったこと:
  - 文章中の「まさ」「うめ」「あび」などが青字リンクになり、クリックで対象メンバーのマイページへ移動できる。

#### #23 /admin/payouts のロード遅延をキャッシュ表示へ修正

- まさがお願いしていたこと:
  - `/admin/payouts` がやたら遅い。もし毎回計算しているなら、キャッシュを置いてすぐ表示してほしい。
- 原因:
  - GAS呼び出しではなく、`GET /api/admin/payouts` が表示のたびに `syncRewardSummariesForBillingCycles()` を実行し、対象cycleの `billing_cycles.reward_summary_json` を再生成していた。
- どう解決したか:
  - 通常GETは `billing_cycles.reward_summary_json` の報酬キャッシュを読むだけに変更。
  - 明示的な「報酬キャッシュ再計算」ボタン、支払データ保存、PJ予算確定だけが `refreshRewards` で再計算する。
- できるようになったこと:
  - `/admin/payouts` の通常表示は既存キャッシュを使い、重い再計算は手動操作へ分離された。

#### #24 clasp login をブラウザ認可待ちまで進めて GAS push 完了

- まさがお願いしていたこと:
  - `invalid_grant / invalid_rapt` のまま終わらせず、いつも通りブラウザでログイン要求が来るところまで進めてほしい。
- どう解決したか:
  - `cd /Users/masa/projects/AMD/amd-os/gas && npx --yes @google/clasp@latest login` を実行し、Googleログイン画面まで開いた。
  - まさの認可後、`npx --yes @google/clasp push` を再実行した。
- できるようになったこと:
  - GAS 221ファイルの `clasp push` が成功し、`invalid_rapt` による未反映状態は解消した。

#### #25 支払通知書発行UIを復活

- まさがお願いしていたこと:
  - `/admin/payouts` から実際に支払通知書を発行するためのUIが消えているので復活してほしい。
- どう解決したか:
  - `/api/admin/payouts` に `PATCH action=update_notice` を追加し、`payout_notices.notice_no` / `pdf_url` / `sent_at` を更新できるようにした。
  - `/admin/payouts` に「支払通知書発行」セクションを追加。番号発行、PDF URL保存、送付済みにする、未送付に戻すを画面から操作できるようにした。
- できるようになったこと:
  - 支払データ保存後、メンバー別の支払通知書発行状態を同じ画面で管理できる。

#### #26 実装済み機能が勝手に消えることへの根本対策

- まさがお願いしていたこと:
  - 実装済み要素が別セッションで勝手に消えていくのを防ぐ施策を講じてほしい。
  - OSの全機能がmdに書き出されているべきではないか。
- どう解決したか:
  - `pwa/design/FEATURE_REGISTRY.md` を追加し、重要UIの「消してはいけない業務導線」を画面単位で登録する運用にした。
  - `/admin/payouts` の報酬キャッシュ、縦型PJ収支表、支払通知書発行、入金確認nudge、月次モーダル導線を必須機能として登録した。
  - `npm run test:critical-ui` に `FEATURE_REGISTRY.md` と `/admin/payouts` の支払通知書/キャッシュ/API anchor 検査を追加した。
- できるようになったこと:
  - 重要UIを消す変更は、正本mdと回帰テストの両方を更新しないと通りづらくなった。

#### #23 follow-up 報酬キャッシュを毎日再計算するcron化

- まさがお願いしていたこと:
  - `/admin/payouts` をキャッシュ表示にするだけでは、キャッシュを更新するトリガーがない。毎日午前3時などで再計算してほしい。
- どう解決したか:
  - `/api/cron/payout-reward-cache-refresh` を追加し、対象支払月の `billing_cycles.reward_summary_json` を事前更新するようにした。
  - `vercel.json` に毎日 03:05 JST 相当の cron を追加した。
  - operation catalog / Feature Registry / SPEC / L2_DATA / BUGS に、表示時再計算ではなく定期再計算でキャッシュを温める運用を記録した。
- できるようになったこと:
  - `/admin/payouts` の通常表示は即時キャッシュ参照、重い再計算は毎日cron・手動ボタン・保存系操作に分離される。

#### #25 follow-up 改善版PDFフォーマットで支払通知書発行を復活

- まさがお願いしていたこと:
  - GAS時代のPDFフォーマットは低品質だったので戻さず、PWAで改善した支払通知書フォーマットを復活してほしい。
  - PDF URL入力欄ではなく、前のように「PDFで確認」できる導線に戻してほしい。
- どう解決したか:
  - `/api/admin/payouts` に `PATCH action=issue_notice_pdf` を追加し、PWA側の報酬内訳・通知額を正としてPDF発行payloadを作るようにした。
  - GAS側に `payoutCreatePwaNoticePdf` を追加し、PWAから受け取った改善版内訳を既存PDFビルダーへ渡してDriveへ保存するようにした。
  - `/admin/payouts` の支払通知書発行UIからPDF URL入力欄を消し、「PDFで確認」「再発行」「送付済みにする」「未送付に戻す」の操作に戻した。
- できるようになったこと:
  - 支払データ保存後、画面から改善版フォーマットのPDFを発行・確認でき、発行結果だけが `payout_notices` に保存される。

#### #26 follow-up 仕様ドリフト防止を一般的な開発手法に寄せる

- まさがお願いしていたこと:
  - 重要UIだけでなく、すべての機能を余さず設計へ書き起こし、バイブコーディングで勝手に仕様が変わらないよう一般的な方法を取り入れてほしい。
- どう解決したか:
  - GitHub Spec Kit / ADR / BDD の考え方を確認し、AMD OS向けに `pwa/design/SPEC_GOVERNANCE.md` を追加した。
  - 設計の正本を Capability Catalog / Functional Spec / Data Contract / ADR / Executable Spec / Traceability に分ける運用へ整理した。
  - `pwa/design/README.md` から仕様統制ルールへ到達できるようにした。
- できるようになったこと:
  - 今後は機能追加・削除・置換時に、実装だけでなく設計正本と回帰テストの更新を同じ単位で扱う。

#### #25 follow-up 2 支払通知書3操作をメンバー別支払へ統合

- まさがお願いしていたこと:
  - 「メンバー別支払」の各行に `支払通知書発行` / `PDF確認` / `送付` の3ボタンを置けば、別の支払通知書発行セクションは不要ではないか。
  - PDF確認ボタンがなぜグレーアウトしているのか、どうなるとアクティブになるのか知りたい。
- どう解決したか:
  - `/admin/payouts` の別セクションをやめ、`PayoutNoticeActions` を「メンバー別支払」テーブル行へ統合した。
  - `支払通知書発行` は `monthly_reward_payout` 保存済み (`row.isSaved`) の行だけ活性化する。
  - `PDF確認` は既存 `payout_notices.pdf_url` があればPDFを開く。PDF未発行時も、支払データ確定前に確認用PDFを生成して開けるようにする。確認用PDFは `payout_notices` に保存せず、正式な `支払通知書発行` / `送付` は支払データ保存後に行う。
  - `送付` はPDF発行後だけ活性化し、送付済みなら同じボタンで `送付取消` に変わる。
- できるようになったこと:
  - 支払通知書の発行・確認・送付状態が、各メンバーの支払行と1対1で見える。

#### #26 follow-up 2 md正本へ書き込まれる仕組みと新セッション読書順

- まさがお願いしていたこと:
  - 新しく追加したmdファイルに、現状仕様と今後追加仕様がどう書き込まれていくのか設計を知りたい。
  - 新しいセッションでそこを読んでから開発に着手する設計になっているか確認したい。
- どう解決したか:
  - `SPEC_GOVERNANCE.md` に「現状は実装者が同じcommitでmd正本を更新する」「DB schemaは `dump_schema.py` で生成する」「design_logは正本にしない」を明記した。
  - 今後の機能追加は Capability Catalog / Functional Spec / Data Contract / ADR / Executable Spec / Traceability のどこへ書くかを定義した。
  - `pwa/AGENTS.md` と `pwa/CLAUDE.md` の読書順に `L2_DATA.md`、`FEATURE_REGISTRY.md`、`SPEC_GOVERNANCE.md`、テーマ別mdを入れた。
- できるようになったこと:
  - 新セッションは入口mdから仕様正本へ辿ってから実装に入る。

#### #27 経営・事業シグナル L2 9を実装

- まさがお願いしていたこと:
  - コックピットのMSリストの下に、経営上の重要方針・事業上の進捗などをまとめたセクションを追加したい。
  - そこへ入るデータを、生データからCodex automationで抽出するL2データとして構築したい。
- どう解決したか:
  - `project_strategy_signals` テーブルを追加し、production Supabaseへmigration適用済み。
  - `CockpitStrategySignals` を追加し、cockpitのMSリスト直下に `経営・事業シグナル` を表示するようにした。
  - `ms_progress_review_tool.mjs` の outbox applier が `strategySignals` を `project_strategy_signals` へupsertできるようにした。
  - `l2_notifications(l2_kind='project_strategy_signal')` の通知詳細表示と「はい/いいえ」による confirmed/rejected 遷移を追加した。
  - Codex automation `AMD OS 経営・事業シグナルレビュー` を作成し、outbox `/Users/masa/.codex/automations/amd-os-strategy-signals/outbox/*.json` を非LLM applierが拾う構成にした。
  - `project_strategy_signals.md` / `L2_DATA.md` / `cockpit.md` / `SPEC_pwa.md` / `FEATURE_REGISTRY.md` / `SPEC_GOVERNANCE.md` を更新した。
- できるようになったこと:
  - MS進捗より上位の重要判断・重要進捗・リスクを、根拠付きL2としてコックピットに出せる。

#### #27 follow-up 過去データから経営・事業シグナルをbackfill

- まさがお願いしていたこと:
  - コックピットにセクションはできたが中身がないと修正できないので、過去データをbackfillしてほしい。
- どう解決したか:
  - `backfill_strategy_signals_from_activities.mjs` を追加。既存 `member_activities` を `ym` 範囲で読み、impact・キーワード・除外語の決定的ルールで経営・事業シグナル候補を作る。LLM/GASは使わない。
  - 生成した outbox を `ms_progress_review_tool.mjs apply-outbox` で反映し、`project_strategy_signals` と `l2_notifications(l2_kind='project_strategy_signal')` を同時に作成する。
- できるようになったこと:
  - 202601-202605の既存 `member_activities` から40件をbackfill済み。内訳は `p06:8`, `p07:4`, `p19:10`, `p20:8`, `p21:10`。
  - cockpitの `経営・事業シグナル` に候補が表示され、`/notifications` から「はい/いいえ」で confirmed/rejected にできる状態になった。

#### #25 follow-up 3 支払通知書PDFフォーマットを改善版へ完全復旧

- まさがお願いしていたこと:
  - 先月一緒に作った改善版の支払通知書PDFフォーマットだけを復活してほしい。古いGAS版や古いロゴは認めない。
  - 支払データ確定前でも、まずPDFフォーマットを確認できるようにしてほしい。
- どう解決したか:
  - `gas/064_PayoutFreeeNotice.js` の `payoutBuildNoticePdfBlob_` を2026-04改善版に戻した。白地、青アクセント、公式ロゴ画像、`お支払金額` box、青ヘッダ明細表、税内訳、支払予定/方法/振込先/備考の構成。
  - `/api/admin/payouts` に `preview_notice_pdf` を追加。`PDF確認` は既存PDFがなければ確認用PDFを生成して開くが、`payout_notices` には保存しない。
  - ログイン済みChromeで `/admin/payouts?ym=202605` から `かる ID003` の確認用PDFを発行し、Google Drive PDFで改善版フォーマットを目視確認した。
- できるようになったこと:
  - メンバー別支払行から `支払通知書発行` / `PDF確認` / `送付` を操作できる。
  - 支払通知書PDFのフォーマット確認は、支払データ保存前でも可能になった。

#### #26 follow-up 3 PDFフォーマット退行防止をmd正本とcritical-uiに接続

- まさがお願いしていたこと:
  - 復活した支払通知書PDFフォーマットが、もう二度と勝手に消えない状態か確認したい。
- どう解決したか:
  - `pwa/design/FEATURE_REGISTRY.md` に支払通知書PDFフォーマットの見た目契約を追加した。
  - `pwa/scripts/check_pwa_critical_ui.cjs` が `gas/064_PayoutFreeeNotice.js` を読み、改善版anchor (`PAYOUT_LOGO_FILE_ID`, `PAYOUT_LOGOTYPE_FILE_ID`, `お支払金額`, `摘要`, `小計（税抜）`, `備考` など) と退役済みanchor (`setValue("team ARMADA")`, `brandCell`, `支払通知書番号`) を検査するようにした。
  - `pwa/design/SPEC_pwa.md` と `gas/CLAUDE.md` にも、支払通知書PDFフォーマットとロゴ用ScriptPropertiesの正本情報を反映した。
- できるようになったこと:
  - 次セッションはDriveや過去PDFを掘り起こさず、`FEATURE_REGISTRY.md` と `gas/064_PayoutFreeeNotice.js` から改善版フォーマットを特定できる。
  - 旧フォーマットや古いテキストロゴへ戻す変更は `npm run test:critical-ui` で落ちる。

#### #27 follow-up 2 経営・事業シグナルbackfill候補をログイン済みChromeで本番表示確認

- まさがお願いしていたこと:
  - p19 / p20 / p21 など backfill 済み候補ありの PJ で、cockpit の MSリスト直下に「経営・事業シグナル」セクションが本番で正しく出ているか実画面で確認したい。
- どう解決したか:
  - ログイン済みChromeで `/project/p19/cockpit` / `/project/p20/cockpit` / `/project/p21/cockpit` を順に開き、年間マイルストーンの直下に `経営・事業シグナル 8件` のセクションが出ており、日付 / signal_type chip / impact chip / decision_state chip / candidate chip / title / summary / 根拠件数つきで候補がレンダリングされているのを目視した。
- できるようになったこと:
  - cockpit 上で MS の上位レイヤとして「重要方針・事業進捗・リスク」を見られる導線が本番で機能している。
  - 表示は直近8件にcapされており、9件以上ある backfill 済み PJ も画面が荒れない。

#### #27 follow-up 3 通知の「はい/いいえ」が project_strategy_signals.status を実 DB で書き換える流れを本番で実操作

- まさがお願いしていたこと:
  - `/notifications` で `l2_kind='project_strategy_signal'` の通知から「はい」「いいえ」が、`project_strategy_signals.status` を `confirmed` / `rejected` に書き換える流れが本番で動くか実操作で確認したい。
- どう解決したか:
  - 既存の backfill 候補を勝手に確定/却下しないよう、`p00 (AMD)` スコープで `[AMDOS_NOTIFY_TEST-YES]` と `[AMDOS_NOTIFY_TEST-NO]` のテスト用 strategy signal と対応する `l2_notifications` を 2 件ずつ作った。
  - ログイン済みChromeから `/notifications` を開き、YES 通知カードを展開して「はい・反映」をクリック。未対応カウントが 92 → 91 に減り、回答済みが 21 → 22 に増えた。
  - NO 通知カードを展開して「いいえ・不採用」をクリック。未対応カウントが 91 → 90 に減り、回答済みが 22 → 23 に増えた。
  - Supabase REST で `project_strategy_signals` を直接 SELECT し、YES 行が `status='confirmed' / confirmed_by='まさ'`、NO 行が `status='rejected' / confirmed_by='まさ'` になり、`confirmed_at` も入っていることを確認した。
  - テスト用 signal と通知は最後に DELETE で cleanup 済み。
- できるようになったこと:
  - `/api/notifications/feedback` の `updateStrategySignalCandidates` が、`scope_key` 由来の `ym` と通知 `metadata_json.signal_source_hash` でターゲット候補を一意に特定し、`status` を `confirmed` / `rejected` に更新するフローが、本番Supabaseで実動作することの実証が取れた。
  - 「はい/いいえ」を押した通知が未対応リストから即時に回答済みタブへ移動するUI挙動も実際に確認できた。

#### #28 支払通知書PDF golden 画像差分テスト追加

- まさがお願いしていたこと:
  - 改善版PDFのフォーマットをさらに強く守るために、golden PNGを固定して画像差分テストを追加したい。
- どう解決したか:
  - `tmp/pdfs/generated/` にあった `支払通知書_PREVIEW-202605-ID003_ID003_202605.pdf.png` (= 改善版PDFを 1 ページ目だけ PNG にレンダリングしたもの) を `pwa/scripts/__fixtures__/payout_notice_golden.png` として fixture に固定した。
  - 同じ PNG の SHA256 (`c6a0384d877dddf5ee7daee535d0cf192fc0acfcc81db475db77fd48ea91209a`) を `payout_notice_golden.png.sha256` に保存。
  - `pwa/scripts/check_payout_notice_pdf_golden.cjs` を追加し、デフォルトでは fixture PNG の存在と SHA256 一致を検査する。`--diff <input.png>` で外部 PNG を golden と SHA256 で突合するモードも持たせた。バイト完全一致を要求するため、新規 PNG が許容範囲ならまさが目視確認したうえで fixture を更新する運用にした。
  - `package.json` に `test:payout-notice-pdf` script を追加し、`pwa/scripts/check_pwa_critical_ui.cjs` の最後で `require()` して `npm run test:critical-ui` でも検査するようにした。
  - `FEATURE_REGISTRY.md` / `SPEC_pwa.md` / `BUGS.md` に golden 運用と更新手順を明文化した。
- できるようになったこと:
  - 支払通知書PDF改善版の見た目契約が、文字列 anchor (GAS 側のコード) + golden PNG (rendered 結果) の二段ガードで守られるようになった。
  - GAS の `payoutBuildNoticePdfBlob_` を意図的に更新した場合は、まさが新PDFを目視確認 → PNG化 → fixture と SHA256 を上書きして commit する運用が正本化された。
  - 同じスクリプトを `--diff` モードで使うことで、新規生成PDFをPNG化したファイルと goldenを差分検査できるので、CI / 本番運用での回帰検知も同じ仕組みに乗せられる。

#### #29 cockpit を案C レイアウト (3 カラム + Hero) に組み替え

- まさがお願いしていたこと:
  - cockpit の左右に大きく余白がある「真ん中だけ使う」UIをやめて、画面幅をフルに使う構成にしたい。
  - 経営・事業シグナルやMSなどコンテンツが増えてきた今、画面内の情報量を優先したUIに変えたい。
- えいみが出した3案:
  - 案A: 2カラム拡張 + sticky 右レール (= 既存構造の余白だけ潰す)
  - 案B: HUDタイル グリッド 2x3 (= cyber dashboard 寄り)
  - 案C: 上 hero フル幅 + 下 3カラム + 最下全幅カンバン
- どう解決したか:
  - まさが案Cを選んだので、cockpit container を `max-w-[1060px]` から `max-w-[1600px]` に拡張し、左 720px / 右 sticky 220px の旧 2 カラム構造を解体した。
  - 上 Hero として `CockpitVentureStatus` 内の AMD Score 折れ線と XRL 折れ線を `xl:flex-row` で横並びにし、xl 未満 (= 1280px未満) では従来の縦並びに自動 fallback するようにした。
  - メインボードは `grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_300px]` の3カラム。col1 = 今期MS + 次期MS設定 + 過去の期間、col2 = 経営・事業シグナル、col3 = ステータスバッジ + 月次ルーティン + nudge (lg 以上で sticky top-12)。
  - 下段は `grid lg:grid-cols-2` で月次カード一覧 / (休止期間 + MTGサマリ) を並べる。最下段に TODO カンバンを `tasks.length > 0` のときだけ全幅で表示。
  - 旧 IIFE 内に絡んでいた MS 設定バナーロジックは `renderMsSetupBanner()` 関数として CockpitView 内部に分離し、col1 から呼ぶ形にした。
  - `pwa/scripts/check_pwa_critical_ui.cjs` に `max-w-[1600px]` / `lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_300px]` / `lg:sticky lg:top-12` / `xl:flex-row` / `renderMsSetupBanner` の anchor を追加し、`expectNotIncludes` で `max-w-[1060px]` と 旧 left/right 2カラムへの巻き戻りを禁止した。
  - `cockpit.md` / `FEATURE_REGISTRY.md` / `SPEC_pwa.md` を同時に更新して案Cレイアウトを正本化した。
- できるようになったこと:
  - 1920px ディスプレイで Above the fold に Header + AMD Score chart + XRL chart + 3 カラムの主要モジュールが一望できる。
  - 「過去 (XRL / AMD Score 推移)」「現在進捗 (今期MS)」「経営判断 (シグナル候補)」「今月オペ (ルーティン)」が視覚的に整理され、画面内の情報量が一気に増えた。
  - レスポンシブも `lg` (1024px) / `xl` (1280px) breakpoint で順次グレースフルに縦並びへ崩れるので、ノートPCやモバイル幅でも壊れない。

#### #30 SX/FC MTG 結果の整理 + pwaApi POST対応 + 「会話→正本md昇格」設計md (2026-05-23 えいみセッション)

- まさがお願いしていたこと:
  - 2026-05-22 FCとのMTG (八重洲) で出た拡張機会を整理して、本来のミッション (FC北陸PoC) と副次的に出てきた4方面の戦略機会を切り分けてほしい
  - その結果を `knowledge/sx.md` (SU 経営判断の正本) と PJ コックピットの MTG サマリ枠と SX Slack チャンネルにつくよみ名義で共有してほしい
  - mdは個人ディレクトリ (`/Users/masa/projects/knowledge/`) でチームに見えないので、共有導線はコックピットのMTGサマリ
  - 「これだけ濃い経営判断材料が会話だけで消えるのもったいない」と感じている → 「会話→正本md昇格」の仕組みを設計してほしい (KAGAMI ではなく amd-os 側で)
- 主な変更:
  - **`knowledge/sx.md` 更新** (個人 git 外 md):
    - 「2026-05-22 拡張機会の発見」セクション追加。4方面の機会 (キャッシュ層=FC北陸メッキ排水 / 国策層1=閉鎖鉱山レアアース廃水 / 国策層2=南鳥島レアアース採掘＋下水道19元素 / アップサイド=ペロブスカイト鉛リサイクル) + 新規論点 (塩水耐性シアノ品種改良＋国費獲得仮説 / GMO規制 / シアノ酸素耐性の値 / 流動層リアクター×ビーズ固定化) + アクションアイテム
    - 発生源の流れ: 5/13 JAFCO面談で出た閉鎖鉱山レアアース廃水を 5/22 FC 見正氏に共有 → 見正氏が南鳥島レアアース・下水道19元素・ペロブスカイト等に波及。ほとんどの拡張機会発信は見正氏
    - 外部関係者テーブルに JAFCO新谷氏 / FC宮崎 (営業部長) / FC見正 (東京工科大客員教授・リグノマテリアCTO) を追加
    - 意思決定ログ 2 行追加 (5/13 JAFCO発・5/22 FC波及)
    - 「masa」表記を「まさ」に統一 (チームメンバー codeName と揃える)
  - **PJコックピット MTGサマリ更新** (Supabase `project_meeting_summaries.meeting_id = 1gl7lhgfp25aqvpq8gvjan747s`):
    - 既存自動抽出内容を keep しつつ、JAFCO 経緯・見正氏波及・塩水耐性品種改良仮説・CEO 問題・GMO規制議論未済 を summary_short / decided / progress / next_actions / risks に追記
    - `source_hash` は元のまま保持 (次回 cron が誤って上書きしないように)
    - `source_kinds = "notion+gmail+manual_eimi"`, `generated_by_model = "manual:eimi-claude-2026-05-23"` で manual edit と識別可能に
    - PWA env の `SUPABASE_SERVICE_ROLE_KEY` で直接 Supabase REST API を叩いて upsert (GAS 8KB制限を回避するためのルートとして 2026-05-23 確立)
  - **Slack 投稿** (#p21_sx, ts: 1779539254.928589):
    - つくよみ名義で 1 投稿に統合。出席者 (AMD側: <@U04PJK178JV> / FC側: 宮崎・見正)、ミッション達成 (FC北陸PoC前向き合意)、JAFCO発の話の波及経緯、4 方面機会、新規論点、次の山場 (5/27 三菱総研・5/27 SX定例・5/29 大阪ペロブスカイト講演)、コックピット MTGサマリへの誘導 URL
    - 投稿入口: `pwaApi runFunc fn=slackNotifyPostToChannel_` (= `SLACK_BOT_TOKEN` 使用、bot user `U0A663YPJNQ`)。`slackNotifyPostToChannelTsukuyomi_` は別 bot で #p21_sx に居らず `not_in_channel` を返す (gas/DEBUG.md 2026-05-23 参照)
  - **GAS pwaApi POST 経由対応** (URL 8KB 制限回避):
    - `80_SlackWebhook.js` の `doPost` 冒頭に `if (mode === "pwaApi") return doGet(e);` 追加。`001_Router.js` への doPost 追加は 80_ との衝突で無効化されてた (GAS 後勝ち罠、gas/DEBUG.md 2026-05-23 参照)
    - clasp v3 と古い `~/.clasprc.json` の互換問題を退避→fresh login で解決
    - `clasp deploy --deploymentId AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G --description "v1472_pwaApi_doPost_via_slack_webhook"` 完了
    - `gas/CLAUDE.md` の「GAS関数を CLI/curl から実行する手順」セクションに POST 経由の node fetch 例追記、「Slack 投稿」「Supabase REST 直叩き」セクションを新規追加
  - **「会話→正本md昇格」設計md 新規作成** (`pwa/design/su_knowledge_promotion_loop.md`):
    - Personal OS Loop (`kagami/PERSONAL_OS_LOOP.md`) の C-2 を SU 知識領域に拡張した姉妹設計
    - 5パーツ (A 自動同期 / B えいみ能動追記 / C-1 admin UI で承認 / C-2 えいみが md 追記 / D 各機能が SU knowledge を参照)
    - 新規データモデル (`su_knowledge` / `su_knowledge_extracts` / `su_knowledge_promotions` / `su_knowledge_changelog`)
    - 抽出 cron 設計 + 安全装置 + Phase 1〜6 の段階的実装パス
    - KAGAMI ではなく amd-os 配下 (個人 OS vs チーム OS の境界線、まさ判断 2026-05-23)
- できるようになったこと:
  - 任意チャンネル + 任意テキストの長文を `pwaApi runFunc` 経由 POST で投稿可能 (GAS 8KB制限を回避)。今回 args 4907 字を 1 投稿で送信
  - Supabase 直叩きルートを `gas/CLAUDE.md` に正本化し、長文 row (10KB+) の upsert も GAS 経由せず実行可能
  - SX p21 のコックピット MTGサマリ枠を見れば、5/22 FC MTG の経営判断・拡張機会・新規論点・CEO 問題・GMO 議論等の全体像がチームに見える
  - SU 知識領域の Personal OS Loop 相当 (会話→正本md昇格ループ) の設計 md が次セッション用に整理された

---

