# 2026-08 PWA development sessions

## 2026-08-02 — 研究ポートフォリオ中心ホームの本採用と認証client重複是正

### 目的

研究機関リストとシーズリストをAMD OSの母集団として明確にし、PJを契約後の運用レイヤーとして扱う情報設計を、旧`/portfolio-preview`から`/dashboard`へ正式採用した。併せて、dashboard初期表示で出ていたSupabase GoTrue browser client重複警告を解消した。

### 実装

- `/portfolio-preview`は`/dashboard`へredirectし、`/dashboard`を研究ポートフォリオ中心ホームにした。上段は研究機関 → シーズ → PJ運用の優先キュー、下段は既存のPJ運用一覧とaction queue、右カラムはembeddedマイページ。
- desktop右カラムは`sticky`かつ独立scroll、mobile/tabletは`/mypage`への明示リンクにした。ホーム配色は白／graphite／濃紺／AMD blue／cyanの罫線中心へ統一し、淡いベージュの旧skinを使わない。
- `PortfolioPulse`のデータは`/api/dashboard/portfolio-pulse`からserver-sideで読み、browser default clientからECR・シーズを直接読む経路を置かない。ECRとSPSは別指標として表示し、合算しない。
- 資料室はファイルを常時並べず、コックピットからモーダルで開く入口にした。
- browser Supabase clientを`createBrowserSupabase()`の共有singletonへ集約。`vc-data.ts`と`seeds-data.ts`のbrowser経路も共有clientを使い、server側clientは`persistSession: false`と個別storage keyを使うようにした。

### 確認

- `npm run test:portfolio-home-contract` 成功。
- `npm run test:critical-ui` 成功。
- `npx tsc --noEmit` 成功。
- 対象ファイルのESLint 成功。
- `npm run build` 成功。既存のmiddleware convention deprecationとNFT trace警告は残るが、今回の失敗ではない。
- production `v3.56.2`（`4830bcae`）で`/dashboard`をログイン済みbrowserで確認し、consoleは空だった。後続のSXガント変更を含む現行productionは`v3.56.3` / `b8e76070`。

### データ・設計上の残課題

- DB migration、データ修正、再計算はしていない。初回の全件関係監査は未完了。
- `p30`は愛媛大学全体のエコシステム構築PJであり、個別シーズPJではない。
- 研究機関とシーズを2つの母集団にし、PJをその運用レイヤーにするというユーザー意図は確定。研究機関PJとシーズPJのカラム・ライフサイクル差を踏まえ、物理テーブルを分けるかはlive DB監査後に決める。
- `SPEC_pwa.md`とruntime route仕様の「`institution_projects`登録PJを通常PJ一覧へ二重表示しない」契約に対し、`dashboard/page.tsx`は現状`p00`だけを除外している。次セッションで実データ・画面・仕様を照合して解消する。

## 2026-08-05 — SX週次管制: 依存線を直接外せる、読める経路へ（v3.57.22）

- `SxUnifiedTimeline`で、保存済み依存線に見た目を変えない透明10pxのhover hit areaを重ねた。hover中だけ該当線を強調し、ポインタ近くの小さな`外す`で`project_management_schedule_dependencies`をsoft deleteする。接続モード中は削除UIを出さず、mobile/keyboardの既存一覧導線を残した。
- 経路の端点余白を通常44pxから11px、迂回時を20px/16pxから5px/4pxへ縮めた。線は接続元バー右端中央、接続先バー左端中央、MSなら◇中心に接する。視覚バーは10pxへ太くした。
- `npm run test:sx-gantt-dependency-route`、`npm run test:sx-gantt-ui-contracts`、`npm run test:sx-weekly-control`、`npx eslint`、`npx tsc --noEmit`、`npm run build`、`npm run test:critical-ui`を通した。production `v3.57.22`でdesktop hoverの`外す`表示、390pxで横あふれなし、console errorなしを確認した。
