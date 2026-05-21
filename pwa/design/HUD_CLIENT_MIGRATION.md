# HUD Client Migration Direction

最終更新: 2026-05-15

## 結論

HUD Client は、現行 PWA を壊さずにもう1系統として複製し、実用しながら少しずつ HUD 化する。

`/dashboard` や `/project/[projectId]/cockpit` の現行UXを直接変更しない。
HUD版は `/hud` 配下に置き、DB/API/書き込み処理は現行と共有する。

## 絶対に守ること

1. 現行版のUX・情報・操作を1つも落とさない。
2. 現行コンポーネントを直接HUD化しない。
3. HUD化する部品は、必ずHUD側へ複製してから変更する。
4. 見た目を先に作って情報を後から足さない。
5. 現行と表示項目・操作・DB書き込みの parity が取れた部品だけ差し替える。
6. 請求月変更、月次ルーティンステータス、各modal、MS更新、task更新などの実用操作を消さない。
7. `/hud` 全体の視覚言語は `design/hud_visual_language.md` を正本にし、暗いWebカード量産へ戻さない。

## 正しい構造

```txt
現行版
  /dashboard
  /project/[projectId]/cockpit
  CockpitView
  components/cockpit/*

HUD版
  /hud/dashboard
  /hud/project/[projectId]/cockpit
  HudCockpitView
  components/hud/*
```

HUD側は現行のデータ取得・保存処理を共有するが、UIファイルは別に持つ。
現行版の見た目を変える必要が出た場合でも、それはHUD化とは別タスクとして扱う。

## 移行手順

### Phase 0: 複製ベースライン

- `/hud/dashboard` と `/hud/project/[projectId]/cockpit` を実用routeとして維持する。
- HUD cockpitは現行 `CockpitView` の構造をコピーした `HudCockpitView` を使う。
- まだHUD化していない子部品は既存 `components/cockpit/*` を参照してよい。
- ただし、子部品をHUD化する時点で必ず `components/hud/*` へ複製する。

### Phase 1: 低リスク部品からHUD化

先に表示専用に近い部品から進める。

- Header
- Nudge
- Meeting summary
- Venture status summary

### Phase 2: 操作あり部品をHUD化

必ず現行との parity checklist を作ってから進める。

- Monthly list / Monthly modal entry
- Routine status / Routine modal entry
- MS / sub-item toggle
- Task status update

### Phase 3: HUD表現を強める

parity が取れた部品だけ、HUDらしいフレーム、レイヤー、発光、密度を足す。
CSSだけでHUDオブジェクトを作るのではなく、必要なビジュアル資産はthree.js / CanvasTexture / 画像生成を使う。

## Parity Checklist

各部品をHUD化する前に、最低限この表を埋める。

| 項目 | 現行 | HUD | OK |
|---|---|---|---|
| 表示されるデータ項目 |  |  |  |
| クリック/入力操作 |  |  |  |
| 開くmodal |  |  |  |
| DB/API書き込み |  |  |  |
| 権限制御 |  |  |  |
| 空/エラー/未設定状態 |  |  |  |
| mobile/横幅不足時 |  |  |  |

## 現在の状態

- `/hud/dashboard` は現行dashboardのデータ取得を共有するHUD route。
- `/hud/project/[projectId]/cockpit` は現行cockpitと同じデータ取得・権限判定を使う。
- `HudCockpitView` は現行 `CockpitView` からコピーしたHUD側の複製ベースライン。
- `HudCockpitView` 自体は `components/hud/` に独立しているため、ここを変更しても現行 `CockpitView` は変わらない。
- まだHUD化していない子部品は `components/cockpit/*` を参照している。
- 次にやるべきことは、子部品を1つずつ `components/hud/*` へ複製し、parity checklist を満たしたものだけHUD化すること。

## 検証ログ

- 2026-05-15:
  - `HudCockpitView` を preserve mount ではなく、現行 `CockpitView` のHUD側コピーへ変更。
  - `npm run build` 成功。
  - 以下の部品を現行からHUD側へ複製し、HUD routeだけで使用するよう差し替え。
    - `HudCockpitHeader`
    - `HudCockpitNudge`
    - `HudCockpitMeetingSummary`
    - `HudCockpitMonthlyList`
    - `HudCockpitRoutineGas`
    - `HudCockpitGoalsCompact`
    - `HudCockpitKanbanGas`
    - `HudCockpitVentureStatus`
    - `HudCockpitFreezeBackfill`
  - 維持した操作:
    - PJ config導線
    - つくよみメモ全件表示
    - MTGサマリの過去表示/展開/Notionリンク
    - 月次カードクリックによるMonthly modal
    - MS進捗内訳展開
    - 請求月ピッカーと `billing_cycles.invoice_ym` 更新
    - ルーティンstepクリックによる既存modal起動
    - MS sub-item toggle と `toggleSubItemStatus`
    - task drag/drop・status modal と `updateTaskStatus`
    - Venture status の各編集modal導線
    - freeze period backfill summary
  - `npm run build` 成功。
  - `MS/Goals` と `Tasks/Kanban` のHUD側コピー後も `npm run build` 成功。
  - `VentureStatus` のHUD側コピー後も `npm run build` 成功。
  - `FreezeBackfill` のHUD側コピー後も `npm run build` 成功。
  - `HudCockpitView` の白背景を暗色HUD gridへ修正。
  - `HudCockpitMonthlyModal` を追加し、現行 `CockpitMonthlyModal` の機能を維持したままDialog/surfaceをHUD化。
  - `HudCockpitVentureStatus` のAMDスコアグラフをHUD信号表示へ寄せ、グラフ本体と最新スコアpillクリックを `/venture-map/amd-score/[projectId]` 直行に変更。
  - `AmdScoreView` を暗色HUD shell化し、経時グラフを発光line / fill / HUD popupへ更新。
  - `npm run build` 成功。
  - production deploy: `https://amd-os-44aviz20z-armada0130.vercel.app` -> alias `https://amd-os-pwa.vercel.app`
  - 背景のradial glowが44pxタイル反復していた事故を修正。HUD背景はsquare gridではなく、薄い水平scanline + sparse vertical guideへ変更。
  - 白surface対策として `amd-hud-page-skin` を追加し、Atlas / Seeds / VC / AMD Score / Retrofitの既存UIを暗色HUD skinで包む。
  - `/hud/atlas` / `/hud/seeds` / `/hud/vcs` / `/hud/venture-map/amd-score/retrofit` を追加。実装とDB/APIは現行と共有し、HUD配下から開ける。
  - AMD Score detailのhero / M-X-F詳細カード / 行hoverをHUD色へ追加調整。
  - `npm run build` 成功。route一覧に上記 `/hud/*` 追加を確認。
  - production deploy: `https://amd-os-kjz79jpl3-armada0130.vercel.app` -> alias `https://amd-os-pwa.vercel.app`
  - `/hud` 配下では現行 `GlobalNav` を非表示にし、HUD shell navのみ表示。
  - `TripleHelixMatrix` の白抜けを修正。
  - Atlasの分野/タグfilterをHUD line chipへ変更。
  - Atlas/Seeds/VCの周辺routeも `/hud/*` 配下に追加し、HUD内リンクはHUD配下を維持するよう修正。
  - `npm run build` 成功。route一覧は114 pages。
  - Atlas mapのcanvas描画をHUD向けに調整。
    - ノード外側にdomain色のradial glowを追加。
    - ノード本体に発光shadowと白/cyan edgeを追加。
    - ラベルは黒文字を廃止し、dark outline + cyan/amber textへ変更。
    - link線をgrayから薄いcyan glowへ変更。
  - Atlasの分野/タグchipは、HUD line frameを維持しつつ元の色識別を復活。
  - HUD skin配下で `text-primary` / `text-blue-700` などlight UI由来の濃色テキストが黒背景に沈まないよう、色token overrideを追加。
  - Seeds statusの `調査中` などをHUD背景で読める淡色badgeへ変更。
  - VC listのactive fund / AMD PJ investment / PJ contact chipをHUD背景で読める発光badgeへ変更。
  - `npm run build` 成功。route一覧は114 pages。
  - production deploy: `https://amd-os-kmk1rx5sv-armada0130.vercel.app` -> alias `https://amd-os-pwa.vercel.app`
  - production verification:
    - `/hud/atlas/map` -> `/auth/login?next=%2Fhud%2Fatlas%2Fmap`
    - `/hud/atlas` -> `/auth/login?next=%2Fhud%2Fatlas`
    - `/hud/seeds` -> `/auth/login?next=%2Fhud%2Fseeds`
    - `/hud/vcs` -> `/auth/login?next=%2Fhud%2Fvcs`
    - `/hud/dashboard` -> `/auth/login?next=%2Fhud%2Fdashboard`
  - HUD shell nav overlap fix:
    - `HudShell` のsticky基準を `top-11` から `top-0` へ変更し、GlobalNav非表示のHUD routeでページ内ボタンを隠さないよう修正。
    - HUD背景のfixed layerも `top-11` 前提を廃止。
  - `/hud/notifications` routeを追加し、HUD nav / HUD dashboardから404にならないよう修正。
  - Atlas map canvas描画は、force graph初期tickで `x/y/globalScale` が未確定でも落ちないようfinite guardを追加。
  - HUD route滞在中は `body.amd-hud-body` を付け、Dialog portalでbody直下に出る月次ルーティン各modalにもHUD dark skinを適用。
  - `npm run build` 成功。route一覧に `/hud/notifications` を確認。
  - production deploy: `https://amd-os-ci1lnfvon-armada0130.vercel.app` -> alias `https://amd-os-pwa.vercel.app`
  - production verification:
    - `/hud/notifications` -> `/auth/login?next=%2Fhud%2Fnotifications`
    - `/hud/atlas/map` -> `/auth/login?next=%2Fhud%2Fatlas%2Fmap`
    - `/hud/atlas` -> `/auth/login?next=%2Fhud%2Fatlas`
    - `/hud/dashboard` -> `/auth/login?next=%2Fhud%2Fdashboard`
  - Chrome visual verification:
    - ログイン済みChromeで `https://amd-os-pwa.vercel.app/hud/atlas/map` を開き、This page couldn't load が再発しないことを確認。
    - HUD shell nav と Atlas Map のページ内操作ボタンが重ならないことを確認。
  - Atlas map label density adjustment:
    - 重要ノード / 高signal / zoom時以外のラベル表示を抑え、黒背景上で読めるcyan/amberラベルに整理。
  - `npm run build` 成功。
  - production deploy: `https://amd-os-hmrtapykt-armada0130.vercel.app` -> alias `https://amd-os-pwa.vercel.app`
  - production verification:
    - `/hud/notifications` -> `/auth/login?next=%2Fhud%2Fnotifications`
    - `/hud/atlas/map` -> `/auth/login?next=%2Fhud%2Fatlas%2Fmap`
    - `/hud/atlas` -> `/auth/login?next=%2Fhud%2Fatlas`
    - `/hud/dashboard` -> `/auth/login?next=%2Fhud%2Fdashboard`

## 次セッションの最初の確認

1. `pwa/design/HUD_CLIENT_MIGRATION.md` を読む。
2. `pwa/HANDOFF_pwa_rebuild.md` を読む。
3. `git status -s` で途中差分を見る。
4. `/hud/project/[projectId]/cockpit` が現行と同じ情報・操作を持っているか確認する。
5. 変更する前に、対象部品の parity checklist を作る。
