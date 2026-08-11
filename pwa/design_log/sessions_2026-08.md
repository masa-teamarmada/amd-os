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

## 2026-08-08 — 長期戦略試算表の消失を検知して復旧・本番反映（v3.66.0）

2026-07-02 のまさえいMTGセッションが「未 push commit `19e9bfe7` を次セッションで本番反映する」という handoff を残したまま 37 日中断していた。再開して調べたところ、**その commit がローカル履歴からも作業ツリーからも消えていた**ため、commit object から復旧して本番へ出した。

### 何が起きていたか

- 7/2 時点: `main` は origin に対し ahead 7 / behind 17、作業ツリーは 79 ファイル dirty。`deploy.sh` が hard-stop するため push を保留し、交通整理を次セッションへ引き継いだ。
- 8/8 時点: `main` は ahead 6 / behind 67 へ。ahead の中身は立替機能と BZM SPS 2.0 docs に総入れ替わりし、`19e9bfe7` は HEAD の祖先ではなくなっていた。実装 5 ファイルも作業ツリーから消滅。未 commit だったマニュアル・変更履歴・セッションログの追記も同時に失われていた。
- 生き残っていたのは (a) 参照されなくなった commit object 本体、(b) 本番 Supabase の `company_longrange_targets` 10 行。DB 側は無傷だったため、コードだけ戻せば復元できる状態だった。

### 復旧の進め方

- 別セッションが同時刻 (22:48〜22:51) に本体作業ツリーへ書き込み続けていたため、**本体では stash も rebase も一切行わなかった**。root `CLAUDE.md` が許可する「使い捨てクリーンクローン」を作り、そこで origin/main の上に復旧を積んだ。
- 先に `git tag recovery/longrange-19e9bfe7` を打ち、参照されない commit object を GC から保護した。
- 実装 2 ファイル (`longrange-projection.ts` / `LongRangeProjectionPanel.tsx`) は commit object からそのまま取り出した。`management-score/page.tsx` は 37 日ぶんの変更が入っていたため、当時の差分 3 箇所 (import / targets 取得 / パネル描画) を現行コードへ手で当て直した。挿入位置のアンカーは 3 箇所とも当時のまま残っていた。
- migration は 162 番が別内容 (`162_zmp_2026_liability_offsets.sql`) で埋まっていたため 245 番へ改番した。中身は `CREATE TABLE IF NOT EXISTS` + `ON CONFLICT DO UPDATE` で冪等、本番へは 7/2 に適用済み。
- 失われたマニュアル 4-5 の「長期戦略試算表」節と 9-3 変更履歴の行も書き直した。

### 教訓

未 push commit は、放置した日数ぶんだけ「他セッションの履歴操作で消える」確率が上がる。1 セッションで push まで到達できない事情ができたときは、handoff に手順を書くだけでは資産を守れない。詳細は `pwa/BUGS.md` の同日エントリに残した。

## 2026-08-11 — つくよみ外部リサーチをSlackからOS採否へ移行（v3.71.0〜v3.71.1）

### 目的

毎日同じ外部リサーチがSlackへ届く問題を止め、重複していない候補だけをAMD OSで1件ずつ確認し、まさが採用した情報だけをPJコックピットへ蓄積するA案を実装した。

### 実装と運用

- migration 255で`project_strategy_signals`へ`origin_kind`と`research_category`を追加し、外部リサーチの`(project_id, source_hash)`を全statusで一意にした。
- canonical URLと、対象・出来事・発生日・重要差分のfingerprintを、DB全履歴と未反映outboxへ照合するhelperと契約テストを追加した。
- 外部候補は`/notifications`へ1件ずつ通常通知として出し、`採用`は通知metadataのhashと完全一致するcandidateだけをconfirmedにする。`見送り`はrejectedにする。
- PJコックピットの経営ハイライトを`重要な動き`と`採用リサーチ`へ分け、外部はconfirmedだけを後者へ表示する。
- Codex automation `automation-2`を平日09:00 JSTで有効化した。新規0件は通知もoutboxも作らず、失敗時だけautomation通知を出す。
- 旧GASのSlack配信入口はearly returnへ変更し、`clasp push`とremote code readbackまで確認した。
- 人向け運用正本をAMD OSマニュアル3-3章へ集約し、実行SKILLはそのマニュアルを先に読む構造へ変更した。

### 検証

- `npm run test:external-research`、`npm run test:critical-ui`、対象ESLint、production buildを通した。
- production `v3.71.1` / `f8b32f16`で`/api/build-info`を確認した。
- ログイン済み本番マニュアルで、実行時刻、対象7PJ、重複防止、採否、保存先、異常時の表を読み戻した。

### 残る確認

automation作成後の最初の自然な平日09:00実行は未観測。2026-08-12 09:00 JST以降に、成功または候補0件、Slack送信なし、候補がある場合だけOS通知が1候補1件で作られることをread-onlyで確認する。
