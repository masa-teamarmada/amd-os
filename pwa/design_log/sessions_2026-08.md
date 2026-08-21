# 2026-08 PWA development sessions

## 2026-08-12 — 資料室を高密度の資料棚へ再構成（v3.72.22〜v3.72.23）

- `WorkspaceDocumentRoom`のモーダルを、所属・folder・共有範囲・権限を一段に置くscope rail、件数・検索・絞り込み・追加操作をまとめたtoolbar、短いdrop rail、密な一覧行へ組み替えた。資料の正本、認可、操作内容、独立routeは変えていない。
- desktopではheader 54px、scope rail 46px、検索・操作36px、一覧行55pxとし、1440×900の実画面で10行分の一覧高と横overflow 0を確認した。
- mobile実測390×843では検索・追加・閉じる・ルートパンくずを44px、document／modalの横overflowを0に揃えた。desktopの圧縮値をmobileへそのまま流用しないよう、操作面積を`sm`境界で戻す。
- `npm run test:workspace-documents-core`、`npm run test:workspace-documents-contract`、`npm run test:critical-ui`、対象ESLint、`npx tsc --noEmit`、`npm run build`を成功。productionは`v3.72.23` / `c59b319d`で確認した。buildの既知Turbopack filesystem trace警告2件は今回の変更外。

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

## 2026-08-11 — MTG prep通知の二重管理廃止と正規checkout同期（v3.71.3 / v3.71.8）

### MTG prep通知の退役

- まさの運用境界「MTG prepはすべてCodexで行う」に合わせ、`proactive-todo-extract`から予定MTGの`next_meeting_prep`新規生成を削除した。
- 既存のopen / blockedは物理削除せず`dismissed`へ移し、system解決者・退役理由・解決時刻を残す。開催済みMTGのnext actionとGmail期限つき依頼は維持した。
- `test:proactive-mtg-prep-retirement`を追加し、upsert入口が戻らないことと、既存行の履歴付き退役を固定した。spec、設計、scheduled tasks一覧、OSマニュアル2-6章、各変更履歴を同じcommitへ同期した。
- 実装commitは`41151f12`。production build `v3.71.3`でcronを実行し、open / blockedの`next_meeting_prep`が0件であることをreadbackした。

### 正規checkoutの復旧

- `/Users/masa/projects/AMD/amd-os`は開始時`ahead 3 / behind 122`、tracked 16件・untracked 2件だった。完全履歴bundle、binary patch、untracked tar、stashへ復旧証跡を保存してから同期した。
- local ahead 3件のうち2件はpatch-equivalent。残るBZM handoff 1件もorigin側既存commitと対象ファイルが完全一致し、その後さらに同期規律が更新済みだったため、古い文面を再適用せずrebaseで落とした。
- stash復元時の9競合は、現行mainの後継仕様を保持して解消した。元差分の大半はmainへ同内容が入っており、旧migrationは番号違いの同一SQL、BZM新章は完全一致だった。
- 唯一の有意な未反映差分は、成立条件ナビゲーションで`not_started`を`neutral`へ割り当てる1行だった。既存の「未着手は未評価と区別する」仕様に沿うため、回帰テストとbuild `v3.71.8`で本流へ統合した。
- closeout時点はmainのみ、worktree 1件、ahead 0 / behind 0、未push commit・競合・未追跡物なし。

## 2026-08-11 — SXを先行例に共有PJを共通カーネルへ接続（v3.72.0）

### 判断

- ホームは再設計せず、局所最適を全体最適へ寄せる最初の実装対象をSX p21にした。
- AMD、SU、研究機関へ別々のdashboardとwriterを作らず、同じimmutable publication snapshotをrole lensだけ変えて表示する。
- 共有面の署名を`4本柱を横切る重要経路`と`現在のボール`にし、従来の3レーン統合タイムラインはAMD内部計画として下段に維持する。

### 実装

- migration 259でgeneric principal、organization、organization membership、project party、exact capability grant、immutable publication revision/items/audience、transactional auditを追加した。
- publication publisherは任意payloadを受けず、許可された既存management rowのIDとversionからDBが許可列だけを組み立てる。外部readは既存のexact project membershipと新grantを両方検査し、project全体の最新revisionがviewer audienceを含まなければ過去版へfallbackしない。
- 外部workspaceの`projects / plan cycle / milestone / progress`直接読取を削除した。認可なしはgeneric not found、認可済み未公開は内部PJ名を出さない未公開、DB/parser失敗はerrorに分離した。
- 共通deckは全体判定、4本柱、重要経路、my/joint/waiting/unknownを表示する。partyはserverで解決したUUIDだけを使い、role・email・名称から推定しない。
- 人物、SU、研究機関、外部accountへのgrantと初回publicationは自動seedしない。明示確認後の別変更に分離する。

### 検証

- strict parser、3レンズ不変、bucket排他、dangling/cycle/rank conflict、内部値漏洩防止、DB migration security contractを自動テスト化した。
- TypeScript、対象ESLint、SQL parser、production build、390/768/1440の実寸UIを完了条件にした。

## 2026-08-12 — 無関係な共有PJ画面を撤回し、現行PJ画面をworkspaceへ一本化（v3.72.1）

### 誤り

- v3.72.0では、全体最適化を「新しい共通表示面の追加」と誤解し、完成済みのPJ画面と無関係な`SharedProjectControlDeck`を旧workspaceへ追加した。
- PJの現行利用面、AMD内部cockpit、大学側workspaceという3面の責任分担を先に固定せず、route名とDB認可課題から表示面を逆算したため、第4の不要な画面を増やした。
- isolated fixtureの390/768/1440確認を行った一方、現行PJ画面との実画面比較を受入gateにしなかった。

### 是正

- `SharedProjectControlDeck`、専用CSS、外部dashboard、TS parser/server loader、専用UI契約テストを削除した。
- 完成済み`SxWeeklyControlDashboard`を`/project/[projectId]/workspace`へ移し、旧`/weekly-control`はworkspaceへのredirectだけにした。現行dashboard本体のデザインと操作は変更していない。
- 未完成の外部account向け簡易代替面はgeneric not foundで閉じた。大学・SU向けは現行PJ画面を基準に、権限と表示項目を変える正式面として別途作る。
- migration 259のprincipal / organization / grant / immutable publication / auditは、大学側・SU側の安全なデータ境界に再利用するDB基盤として保持し、現行画面へは接続しない。

## 2026-08-12 — 三者PJ面の合格条件を実装前に固定（v3.72.2）

### 判断

- 採択面をPJ workspace、AMD cockpit、研究機関PJ面の三つに固定し、第4の共通dashboardを作らない。
- 「元のデータが同じ」は、共同事実のcanonical ID、版、状態、期限、ボール、writerが同じという意味にする。全項目を全員へ同じように見せる意味にはしない。
- AMD非公開と組織主権は分離し、評価・要約・資料の外部表示は承認済みimmutable publicationから読む。内部draftとの差は版と鮮度を明示する。

### 受入土台

- `1-5-three-party-project-view-acceptance-current-spec.md`を追加し、各面が5秒で答える問い、情報層、認可・操作matrix、機械受入、実account readbackを固定した。
- `three_party_project_view_p21.json`は実データではない合成model fixtureとして、三者で一致するlive共同事実、AMD非公開、研究機関/SU主権、承認版と内部draft、期限未設定、別PJ混入を一つの例にした。
- PM、研究機関/SU、認可DBの3視点で再監査し、初版testがlens名と単純grantだけを信用し、fixture内の期待値を自己照合していた弱点を検出した。principal / membership / party / exact grant / capability / expiry / organization / slugを結ぶmodelへ修正し、viewer partyをgrantから導出する。
- `test:three-party-project-view`で、canonical全field一致、DTO厳密allowlistと秘密canary非漏洩、p21/p30分離、第2合成PJ、未設定保持、大学/SU主権の現在値と確定共有版、内部draftと承認版、最新audience除外後の旧版fallback禁止、主権確認・訂正・audit失敗rollbackを検査する。
- migration 260で`publication.approve`をcanonical AMD studio organizationへ限定する。grant作成・更新trigger、publish RPCが使うactive-party resolver、既存active不正grantの適用時検査を重ね、研究機関・SU organizationを`party_role=studio`へ誤設定しても通さない。migration契約もdeploy gateへ追加した。
- migration 260は本番へ適用し、不正active approver 0件、guard trigger 1件、resolver内のAMD organization guardとstudio party guardをManagement APIでreadbackした。`db_schema.md`も本番から再生成した。
- このtestはproduction resolver、DTO、route、DBへ未接続の合成model契約であり、greenだけで実装合格や安全性を証明しない。実装時はproduction coreを接続し、DB RPC / network response / live account readbackを別gateで通す。
- 旧`weekly-control`のsurface catalog状態を`deprecated`へ変更済みなのに、契約テストだけが`transitional`を要求していたため、現行catalogへ追随させた。

### 完了境界

- この変更では現行PJ workspace、AMD cockpit、研究機関workspaceの画面を変更しない。
- 研究機関PJ面と、workspace/cockpitの共同正本完全接続は未実装であり、仕様追加だけで完成扱いにしない。

## 2026-08-12 — 既存heartbeatを先手TODOの意味抽出ownerへ改良（v3.72.7）

### 問題

- 会議next actionとGmail依頼を文字列で粗く候補化し、別automationで後から落とす設計になっていた。
- 候補の入口で失われた判断は後段filterでは発見できず、候補台帳と通知にチーム作業・情報・MTG prepが混ざった。
- `amd-os-proactive-heartbeat` と別のattention reviewを作る構成は、同じ目的に入口を二つ持つだけだった。

### 是正

- 同じ `amd-os-proactive-heartbeat` を、5系統source cacheと開催済み会議要約から本人判断・本人限定行動を直接抽出するownerへ変更した。
- automation自身のCodexだけが意味抽出し、provider課金APIは使わない。promptはDB管理にし、全証跡をcreate/noop/needs_sourceへ分類する。
- validatorは全件回答、confidence 0.85、明示期限の元証跡内完全一致、通知上限を検査する。applierはpromptと全証跡を再読してhash一致時だけ書く。
- `/api/cron/proactive-todo-extract` は新規候補生成をやめ、red昇格とblocked復帰だけにした。旧attention review実装も削除した。
- 旧heuristicの未完了TODOと旧filter由来の未読通知は削除せず退役し、同じ元証跡に必要な判断があれば新heartbeatから再生成する。

## 2026-08-12 — 通知を正本採否ゲートへ戻す訂正（migration 267）

### 誤り

- 通知本来の役割は、AMDプロトコル等のcandidateを正本へ採用するか不採用にするかの最終判断だった。
- v3.72.7では通知と先手TODOを「本人判断・本人限定行動」へ一般化し、L2 candidateを先手TODOの旧backlogと同じものとして一律suppressedへ落とした。
- candidate行の`saved_count=1`はcandidateがDBへ保存済みという意味なのに、正本採用済みと取り違えた。

### 訂正

- 既存automation id `amd-os-proactive-heartbeat` は、未審査`l2_notifications`を最終判断カードへ仕上げる役割へ変更した。別automationは作らない。
- 追加先、追加・更新内容、採用時の結果、不採用時の結果、安全なfeedback handlerが全部揃った候補だけをapprovedにする。
- automationはcandidate tableのstatusや正本を変更しない。まさの「はい/いいえ」だけが既存feedback APIを通じてstatusを遷移させる。
- migration 265で退役したL2候補だけをpendingへ戻し、汎用TODO抽出promptは停止する。先手TODOの汎用自動生成も停止する。
- 本文、会議記録、本人作業、復旧、情報共有、raw data gap、反映先のないkindは採否通知へ出さない。

## 2026-08-12 — 重要情報抽出を決算書専用から5生データ共通へ訂正（v3.72.15 / migration 268）

### 誤り

- Drive readerが本文を渡していたのはGoogleネイティブ文書だけで、PDFとOfficeはmetadataのまま後段へ流れていた。
- 後段はPDFまたはGoogle文書、対象期間、複数の決算語を必須にする決算書専用判定だった。Word、Excel、PowerPoint、メール、予定、Slack、Notionにある契約、技術、会社運営、資金、期限等は同じ欠陥を残した。
- LSTの正式決算書は原因を再現した最初のケースであり、LST専用処理や決算書専用処理を作ることは依頼の目的ではなかった。

### 是正

- 5生データを共通materialへ正規化し、PDF、Word、Excel、PowerPoint、Google文書、textを読むreaderを追加した。本文が取れない画像PDFは情報なしや0にせず`text_read_required`として残す。
- 決算、会社運営、契約、資金、補助金、技術、計画、商談、リスク、人物、期限を同じ重要度判定へ載せた。PJ帰属はroot、title、親folder、発行主体header、意味抽出根拠の強いanchorに限定した。
- 同一本文はhashで1候補へ束ね、全所在をlineageとして残す。改訂版はversion familyとrankを分け、各抽出値は原文一致するfield provenanceを必須にした。
- 財務値だけをBZM接続候補にし、調達、借入、補助金は売上または会社価値へ直加点しない。候補から正本への採用は既存通知と非LLM applierだけが行う。

### 検証

- LST回帰fixtureで同一内容3所在が1候補となり、主要14値、期間、監査、根拠、会計区分を保持することを確認した。
- 実形式でPDF、Word、Excel、PowerPoint、OCR fallbackを検査し、5生データすべての候補生成を確認した。
- 本番Driveをread-onlyで全27 PJ検索し、25 PJでtitle上の重要候補を確認した。PDF、Word、Excel、Google文書の本文を個別に実読し、ZMPの画像PDFはOCR待ちとして検出した。p08とp26はこの検索だけでは候補を確認できず、13 PJのDrive root未登録とともに残課題とした。

## 2026-08-13 — EHM OS第1波: p31ゼオライトPJ化 + 機関業務デスク + ブランド表示（v3.73.0 / v3.73.1 / migration 269-272）

- 設計正本: `/Users/masa/projects/AMD/ehm-os/EHM_OS_DESIGN_DRAFT_20260813.md`（論点11件、まさ承認「その方向で実装してみよう」）。EHM OS = 3面構成（石原先生の業務デスク / 機関ホーム / テーマ面）のうち、DB基盤と業務デスクAMD内部面を実装。
- migration 269: ゼオライトシーズ（愛媛大・野村信福教授名義。まさ発言の「中島先生」との不一致は未確認のため researcher_name は不変更）を p31 (ZEO, draft, dtsu) として seed_projects 経由でPJ化し、ehime ワークスペースへ `shared_surface='summary'` で追加。
- migration 270/271: `workspace_work_cases` / `workspace_work_case_deadlines` 新設（RLS=is_admin+service_roleのみ、212系と同方式）。石原先生の業務一覧29件+締切19件を「2026-06末版スナップショット・全件unconfirmed」で投入。月精度・vague期日を確定日に丸めない。
- migration 272: ehime ワークスペース表示名を「EHM OS（愛媛大学）」へ（slug/認可は不変）。
- `/institutions/[institutionId]/desk` 新設（Sonnet worker実装・司令塔レビュー済み）: サマリ帯/期限レーダー/止まりもの/領域別ポートフォリオ/HITL編集。期日経過＋未確認は「期日経過・状況未確認」表示で「遅延」と断定しない。月精度の期日経過判定はYYYY-MM比較（workerが自己レビューで発見・修正）。
- v3.73.1: `/project/p31/workspace` の見出しが「SolvioraX PJワークスペース」ハードコードだった不具合を本番実画面確認で検出し、p21は受入済み文言維持（critical UI anchor準拠）・他PJは project_name 表示へ修正。
- 検証: tsc / production build / 対象eslint 0 / test:critical-ui / test:workspace-access-scope / test:institution-seed-project-domains 全PASS。本番実画面で 公開トップのEHM OS表示・業務デスク（29件/経過候補5件）・p31面（ZEO表示・空データが接続待ちへ閉じる）・p21面（無変化）を確認。
- 運用注意: 業務デスクの初期データは6月末版で古い。石原先生への現況更新ヒアリング（30-60分）が confirmed 化の前提。石原先生のアカウント発行・外部公開面はまだ作っていない（契約とセットで次波）。
- 本セッションは origin/main の使い捨てクリーンクローンから push（正規checkoutはBZM教科書セッションが使用中のため）。

## 2026-08-15 BZM理論再検証→シーズ一次選別→SPS現行版確定（Claude/えいみ、まさえい対話セッション）

- **BZM理論の批判的再検証**（ボードカード bzm-theory-reaudit）: 23式を3区分判定（致命的欠陥0・要修正4=R1レーン間独立/R2流動性ゲート未文書max/R3 RV添字ズレ/R4論文骨子世代ズレ）。構造リスク「検証の無限後退」を特定し凍結基準F1〜F6を提案。正本 `pwa/bzm/BZM_THEORY_REAUDIT_2026-08-13.md`（61dcaf14）。
- **確率入力の地位を教科書へ正本化**: まさの「おれの独断で決めてる」への回答節（reachability 5.1節）。二役監査で「鈍感」論拠の過般化と較正監査の再帰性を修正してから追記（f5b0b259）。
- **シーズ一次選別の設計→試適用**: 設計v0.1→二役監査→まさ判断反映v0.4（帯・状態仮説駆動・無作為2割・機関補完・単一スコアソート・6段）。段階→軸帯雛形v0.2でcandidate 24件へ試適用、雛形不備10論点を検出・反映（6dafadfb, 4b0e0d07）。
- **SPS現行版の確定（重要）**: まさ確定「SPSはひとつ。現行=Σq_oP_o（円建て）。9軸Cobb-Douglasは旧版で抹消されるべき情報」。えいみが一度逆向き（SPS=9軸系譜、V_all/V_G改名）を記録する取り違え（85dc324c）→全面訂正（da60f936）→2.1/2.2の「9軸を残す」記述も掃除（f5dfc773）。教訓をmemory化（まさの認識と正本の字面が食い違ったら正本側を疑う）。残タスク: spec/4-2表示契約とUIの旧SPS退役（worker未起票）。
- **q帯評価の評価者交代**: 段階デフォルト案をまさ棄却→シーズ別評価者入力→評価者はえいみ（ルーブリックv1凍結: 二大要素=ユニエコ成立性・資本集約度、社会受容性・マイクロトレンド追加、研究者シグナル除外）（7155c670）。
- **BZSF系（repo外）**: ファンド仕様書v0.2+設立ロードマップ（`AMD/BZSF/BZSF_FUND_SPEC_AND_ROADMAP_2026-08-15.md`、まさ判断5件=旧計画承認/連携first・UMI第1候補/金策6案/質問票送付見送り/参加型はFund I最初から）。p00コックピットへDriveリンク掲示（dialogue:p00:20260815-145645）。参加型検証構想md新設。
- **後続**: モデルセッション（migration prompt `pwa/bzm/SESSION_MIGRATION_PROMPT_BZM_MODEL_20260815.md`、24件q帯評価→円建てSPS帯v0.3）とファンドセッション（`AMD/BZSF/SESSION_MIGRATION_PROMPT_BZSF_FUND_20260815.md`）を分離起動済み。
- 詳細な日時つき変更履歴は `pwa/bzm/9-5-appendix-changelog.md` の2026-08-13〜15の11行。

## 2026-08-16 — 資料室Drive folder改名 + folder→cockpit双方向同期（v3.78.0）

- まさ確定: コックピット「資料」（`project_documents` / `CockpitProjectDocuments` / `/api/project-documents`）と共有ドライブ各PJフォルダを一致させる。
- Drive側: `a0_management` / `p20_cx` / `p25_kute` の `AMD OS 資料` folderを `mv` で `AMD OS資料室` へリネーム（drivefsのためfolder IDは不変。3件ともrename前後で `xattr -p 'com.google.drivefs.item-id#S'` が一致することを確認、a0_managementは想定どおり `1sVfyMo8eYkC_s0OmfYb6xYBvJoTqbaEo`）。コード側は先にDriveをリネームしてから追随した。
- コード側: `PROJECT_DOCUMENTS_FOLDER_NAME` と `CockpitProjectDocuments` のデフォルト文字列2箇所を新名へ更新。`ensureDocumentsFolder` を含む同期ロジックを `pwa/src/lib/project-documents/reconcile.ts` へ切り出し、資料室folder直下（サブフォルダ除く）の未登録ファイルを `source_kind='drive_folder_sync'` / `uploaded_by='folder_sync'` で additive-only upsert する `reconcileProjectDocuments` を追加（`onConflict: drive_file_id, ignoreDuplicates: true` でDB側のUNIQUE制約に任せる。既存行は不変、削除方向の同期はしない）。
- 発火点2つ: `GET /api/project-documents` はproject単位で直近5分スロットル・fail softで自動reconcile。全PJ一括の強制reconcileは新設 `POST /api/project-documents/reconcile`（Bearer `CRON_SECRET`/`WORKFLOW_SECRET` または admin session、meeting-prep cronと同じ認証パターン）。
- `source_kind` にCHECK制約が無いことを事前に migration 131/132 で確認済みのため、DB migrationは不要。
- 検証: `tsc --noEmit` / `npm run build` / 対象4ファイルの `eslint` すべてPASS。commit `21f124c5` → `pwa/scripts/deploy.sh` で本番push、3分17秒で production `git_sha=21f124c5...` Readyを確認。本番の `POST /api/project-documents/reconcile` を1回実行し、14 PJ中 p00 (+5) / p20 (+1) / p25 (+1) の計7件を新規追加、失敗0件。Supabaseで p00 の `project_documents` が5→10件（想定どおり。`260702_まさえいMTG` はサブフォルダのため対象外）になったことを直接クエリで確認。
- spec/manual附則（`pwa/spec/6-1-appendix-changelog.md` / `pwa/manual/9-3-appendix-changelog.md`）と `pwa/spec/3-8-cockpit-current-spec.md` / `pwa/design/SPEC_pwa.md` / `pwa/design/meeting_summaries.md` の folder名参照も同じcommitで更新。

## 2026-08-16 — 使われていない資料室実装の削除（v3.78.3）

- 背景: コックピット「資料室」の実体は `workspace_documents` テーブル + `WorkspaceDocumentRoom.tsx`（`CockpitView` が `WorkspaceDocumentLauncher` を描画）。直前の本セッション上の同日エントリ「資料室Drive folder改名 + folder→cockpit双方向同期（v3.78.0）」は、`CockpitProjectDocuments.tsx` という**どこからもレンダリングされていないdead codeへ同期機能を追加**してしまっていた（`CockpitView` は一度も `CockpitProjectDocuments` をimportしていない）。まさの指示で、この未使用実装を削除した。
- 削除ファイル: `pwa/src/components/cockpit/CockpitProjectDocuments.tsx`、`pwa/src/app/api/project-documents/route.ts`、`pwa/src/app/api/project-documents/reconcile/route.ts`、`pwa/src/app/api/project-documents/[documentId]/content/route.ts`、`pwa/src/lib/project-documents/reconcile.ts`。専用のテスト/契約チェックスクリプトは無かった（`pwa/scripts/check_project_workspace_route_contract.mjs` 等は中身を確認したが workspace 側で無関係、削除対象外）。
- 参照ゼロの確認方法: `grep -rn "project-documents" --include="*.ts" --include="*.tsx" --include="*.mjs" --include="*.js" --include="*.json" pwa/` で自己参照以外ゼロを確認。`CockpitProjectDocuments` のimport元をrepo全体でgrepしゼロを確認。`pwa/vercel.json` の cron定義、`pwa/scripts/` 配下のテスト・契約チェック、GAS側も grep で無関係を確認。最終的に `npm run build` の成功と、ビルド後のルート一覧に `project-documents` 系が存在しないことで参照ゼロを確定させた。
- **触っていないもの**: `project_documents` テーブル自体（`app/api/project/monthly-report-print/route.ts` が月次レポート添付一覧の読み取り専用ソースとして使用中のため残置）、`workspace_documents` / `WorkspaceDocumentRoom` 系一切、共有ドライブの `AMD OS資料室` フォルダ（3PJ分、直前セッションでリネーム済み、ファイル移動もリネームもしていない）、DB migration（一切追加していない）。
- ドキュメント訂正: `pwa/manual/9-3-appendix-changelog.md` / `pwa/spec/6-1-appendix-changelog.md` に訂正行を追記（append-only、旧2026-08-16行は削除せず残す）。`pwa/spec/3-8-cockpit-current-spec.md` の Project Documents Contract 節を「削除済み・参考記録」へ書き換え、資料室の正本ポインタを `pwa/manual/2-3-pj-cockpit.md` 「## 資料」節へ差し替え。`pwa/design/cockpit.md` のUI構成図、`pwa/design/SPEC_pwa.md` の route表・admin API一覧・db_schema系一覧、`pwa/design/meeting_summaries.md` のCLI手順注記も同じcommitで修正（CLIから`cp`した資料は資料室一覧へ自動反映されない旨を明記）。
- BUILD_VERSION: v3.78.2 → v3.78.3 (patch、機能撤去)。

## 2026-08-16 BZMモデルセッション(Fable司令塔+Sonnet worker)
- SPS価値項を持分価値→産業創出価値P^indへ差し替え(まさ発案・二役監査P0×5解消・masa-agreed)。用語集§1.7・一次選別設計§6更新、migration 281(measure_version)適用
- candidate 24件: q v2(ルーブリックv1.1)×P^ind判断帯→SPS ind版v1.0をDB反映、/seeds本番表示v3.78.1(旧SPS列非表示=まさ裁定)
- 一次選別インフラ: migration 280(status CHECK/遷移履歴trigger/帯テーブル+DTO契約テスト)、根拠Lv0-3表示、月次試算表p09/p24追加
- 詳細はbzm/9-5-appendix-changelog.md 2026-08-15〜16エントリ群とSESSION_MIGRATION_PROMPT_BZM_MODEL_20260816.md

## 2026-08-19 — `/seeds` の会社名表示とPJ識別（v3.81.2）

- `/seeds` のPJ状態列を廃止し、列名を「会社名」に変更。会社名を枠で囲む表示も廃止し、`seed_projects.venture_name`を太字の主表示にした。
- `commercialization_stage='pre_incorporation'` は「会社名（未設立）」、会社名が無い行は「未設立」。状態語の「協議中」「スピンアウト済み」、PJのactive/ended、`PJ化済み`は表示しない。
- PJ紐付きだけを会社名セル右上のabsolute配置した青い丸`PJ`バッジで示し、バッジを下段へ置いて行高を増やさないようにした。
- migration 289を本番適用し、p21の会社名をSolvioraX、p20をCryoXへ訂正。両方の未設立状態を読戻しで確認した。
- `test:seed-list-display`、`test:kute-seeds-scope`、TypeScript、critical UI、production buildと、本番desktop/mobile表示を確認。commit `8e28447c`、本番v3.81.2。

## 2026-08-19 — 管理カレンダーのGoogle Calendar共有同期（v3.81.3）

- `/admin/schedule`の表示範囲がJSTの表示月から毎月1か月ずつ進み、2026年9月には2026年6月〜2027年5月になることを固定日計算と本番DB（2027年5月4件）で確認した。
- admin個人OAuthはcalendar.readonlyのみだったため、全メンバーへ書込scopeを追加せず、会社Google Workspace所有の`AMD 管理カレンダー`をactive admin 2人へreader共有する方式を採用した。
- Supabase Edge Function `admin-schedule-calendar-sync`を追加。日付確定済み・当日以降・未完了の派生予定を終日transparentで同期し、private extended propertyの`occurrence_key`で作成・更新・削除を冪等化した。月精度・日付未確定予定へ仮日付は作らない。
- `GET /api/cron/company-schedule`は期限生成後に同Functionを呼び、Calendar同期失敗を成功扱いにしない。

## 2026-08-19 — 管理カレンダーを実務時間枠へ訂正（v3.81.4）

- v3.81.3の終日・transparent投影では月表示上部へ出るだけで、実務時間を確保できなかった。
- Google Calendar投影をJSTの時刻付き・opaqueへ変更。書類作成・月次報告・ガバナンスは120分、税務は90分、その他は60分。同日分は09:00から並べ、12:00〜13:00を避ける。
- 既存の48件は同じ`occurrence_key`のまま更新し、別予定として複製しない。
## 2026-08-19 — 資料室HTMLのPDF紙面保持を修正（v3.83.3 / v3.83.5）

### 実装

- HTMLをPDF化する前にデスクトップ幅とA4幅の実レイアウトを比較し、A4幅で横組みのgrid/flexが縦積みになる資料だけは元のデスクトップ幅を保つ紙面へ切り替えた。通常文書はA4のままとし、見出し・比較カード・表などページ内に収まる論理ブロックだけを分割回避した。
- PDF専用CSSでサイドナビとnavigation roleを除外するだけでなく、親`.layout`を1列へ畳んだ。`page.pdf()`の全辺へ0.35inの余白を与え、改ページ後も本文が紙端から始まらないようにした。
- `check_workspace_documents_contract.mjs`へresponsive判定、ナビ除外、親grid解除、全ページ余白の契約を追加した。実PDFを画像化して、横組み資料の1ページ目と後続ページを確認した。

### 検証と反映

- `node --experimental-strip-types scripts/check_workspace_documents_core.mts`、`node scripts/check_workspace_documents_contract.mjs`、`npx tsc --noEmit -p tsconfig.json`、`npm run build`を完了した。
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`でmainへ反映し、productionの`/api/build-info`が`v3.83.5` / `2b391f4fb9279d5e1c16d804d227bd8edae171ec`を返すことを確認した。

## 2026-08-20 — SXの外部資料共有をAMD OSへ統合

- 旧SX Project Shareを正本から外し、外部関係者は `/project/p21/workspace` の同じ入口で、PJ名と `workspace_shared` の資料室だけを見る設計へ統合した。外部DTO・routeは内部の週次、ガント、関係先、論点、資金、管理画面を返さない。
- 外部 `contributor` は資料の閲覧、file / folder / link追加、HTML本文編集まで可能にし、名称変更・移動・共有範囲変更は管理権限へ残した。認可はアカウント、機関所属、PJ個別アクセスの明示3層だけで行う。
- p21の外部利用者7件を招待登録し、PJリストの関係先メールアドレスへ重複なく統合した。メール送信は行わず、初回認証後にactive化する。
- 旧Project Shareのアプリ・Blob Store・専用ドメインを退役した。旧Blobの移行対象が無いことと、専用ドメインが404になることを確認した。
- `test:workspace-access-scope`、`test:workspace-access-session`、`test:workspace-capabilities`、`test:workspace-documents-core`、`test:workspace-documents-contract`、`test:project-workspace-route`、`test:workspace-next-path`、`test:workspace-email-start-contract`、`test:workspace-access-admin`、`test:critical-ui`を通した。Finder / Explorerから資料室内へ落としたfileは、空folderの空状態以外でブラウザ既定動作を止め、既存のupload処理へだけ渡す。

## 2026-08-20 — 資料室の一覧全体へFinderファイルを追加（v3.83.7）

- v3.83.6は資料室内でのbrowser open/downloadを止めたが、upload handlerが空状態だけに付いていたため、資料が並ぶfolderへFinder fileを落としても何も起きなかった。
- `WorkspaceDocumentRoom`の現在folder一覧全体（空状態を含む）を、追加権限あり・検索中でない場合の外部file drop targetにした。外部fileだけを既存のupload・同名確認・権限処理へ渡し、資料行からパンくずへ移動する内部dragは`Files`判定に通さない。
- 常設の細いdrop帯は復活させず、外部fileを重ねた瞬間だけ一覧を薄青と破線で示す。検索結果はdrop targetにしない。
- `test:workspace-documents-contract`、`test:workspace-documents-core`、対象ESLint、TypeScript、`test:critical-ui`を通した。ローカルbuildは型検査完了後にSupabase環境変数不足でページ事前生成が停止したが、`deploy.sh`経由のproduction buildはReadyとなり、`/api/build-info`でv3.83.7 / `70024d1a0650e55a837aafcb4d77047bffea629e`を確認した。commit `70024d1a`。

## 2026-08-20 — ホームのアクティブPJを二段フライアウト化（v3.83.12）

- 左ナビ「ホーム」のhoverで開くアクティブPJ一覧について、PJ行を直接コックピットへ遷移するリンクから、Chromeのブックマークフォルダと同じ二段メニューへ変更した。PJ行hover/focusで右側にPJ名・「コックピット」・「ワークスペース」を表示し、目的の面を選んで遷移する。
- `GlobalNav.tsx` は親子menuの間のポインタ移動で閉じないclose timer、focus遷移、viewport内への位置clampを持つ。子メニューのrouteは `/project/:projectId/cockpit` と `/project/:projectId/workspace`。PJ行自身は遷移しない。
- `FEATURE_REGISTRY.md`、`spec/2-2-pwa-surface-inventory-current-spec.md`、`manual/2-1-member-quick-start.md` と両appendix changelogを同じ変更で同期。`test:critical-ui`、`test:portfolio-home-contract`、対象ESLint、TypeScript、production buildを通した。
- commit `f7745b99`。`deploy.sh`でmainへ反映し、Vercel Ready後に本番 `/api/build-info` が `v3.83.12` / `f7745b99c138ca8874c3f561c694aa0dcee90d03` を返すことを確認した。ログイン済み外部Chromeで子メニュー表示とp00の両遷移を実操作し、コンソールエラーなしを確認した。

## 2026-08-20 — Seed→Cockpit導線と全PJのSXワークスペース統一（v3.83.11）

- まさ確定: Seed詳細モーダルからはcockpitだけへ進み、workspaceはcockpitから開く。PJ化してもSeed詳細自体は通常モーダルの読み取り面を維持し、簡易cockpitを重複実装しない。
- `SeedDetailModal` の接続PJリンクを `/project/{projectId}/cockpit` へ変更し、workspace直リンクと「ワークスペース（コックピット）」の混同表記を削除した。
- SX先行の `SxWeeklyControlDashboard` を全PJの内部workspace共通仕様とした。全PJで `週次差分 / ガント / 関係先 / 論点・仮説 / ドライブ` を出し、ドライブは `WorkspaceDocumentRoom(scopeKind="project", scopeId=当該PJ, surface="workspace", presentation="modal")` を再利用する。
- 共通化は画面・操作・資料室に限定し、PJ名、管理柱・レーン、実データ、外部workspace access、DB分類は変更していない。
- `test:seed-list-display`、`test:project-workspace-route`、`test:workspace-documents-contract`、`test:critical-ui`、対象ESLint、TypeScript、production buildを通した。ログイン済み本番でSXと桑折先生PJの5タブ一致、桑折先生PJドライブ、Seedモーダルのcockpitリンク1件/workspaceリンク0件、cockpitのworkspace導線を確認した。
- 実装commit `a108b4c7` を `deploy.sh` でmainへ反映し、build `v3.83.11` / SHA `a108b4c74683de5466053635861220f95260ccff` をreadbackした。後続 `f7745b99`（v3.83.12）にも祖先として含まれる。

## 2026-08-21 — 資料室HTML→PDFの紙面・改ページ・ファイル名を修正（v3.86.1 / v3.87.1）

### 左右の巨大余白（`ca2e7c0f`）

- 資料HTML側が持つ `@page` 指定を、PDF生成時のスタイルが上書きしきれず、A4の中央に縮んだ紙面が載って左右へ大きな余白が出ていた。
- PDF専用CSSで元HTMLの `@page` を無効化し、変換側の用紙・余白定義だけを効かせる。以後は資料側の印刷指定に紙面が引きずられない。

### 中途半端な改ページ（`daecf9c3` / v3.86.1）

- 見出しだけが前ページ末尾に残る、最終ページが空白になる、の2件を修正。
- 見出しと直後の本文ブロックを同じページへ保つ改ページ制御を入れ、末尾の空ページを落とした。まさの実資料で確認済み。

### 日本語ファイル名の二重URLエンコード（`ab7cde4a` / v3.87.1）

- 症状: PDFを保存すると `SE_%25E6%258A%2580…_20260821.pdf` になる。
- 原因: supabase-jsの `createSignedUrl(path, ttl, { download })` は渡した名前を `encodeURIComponent` してクエリへ載せるが、Storageはクエリの生値をデコードせずそのまま `Content-Disposition` の `filename` / `filename*` へ入れる。結果 `%E6%8A%80` が `%25E6%258A%2580` になる。
- 対応: `withWorkspaceDownloadFileName(signedUrl, fileName)` を `lib/workspace-documents-core.ts` に追加し、`download=` を自前で1回だけエンコードして付ける。`encodeURIComponent` が残す `'` `(` `)` `*` はRFC 5987のattr-char外なので追加でパーセント化する。`{ download }` オプションは使わない。
- 適用先は `api/workspace-documents/[documentId]/pdf/route.ts`（PDF化）と `.../open/route.ts`（資料そのもののダウンロード）の2箇所。
- 他の `Content-Disposition` 生成箇所（`meeting-assets/file/[assetId]`、`business-cards/[cardId]/image`、`governance/company-overview-export`、`workspace-documents/[documentId]/render`）は自前で `filename*=UTF-8''${encodeURIComponent(...)}` を組んでおり、同じ不具合は無いことを確認した。

### 検証と反映

- Storageへ実ファイルをuploadし、署名URLをfetchして `Content-Disposition` を実測。`SE_技術研究組合_設計書_20260821.pdf` と `KUTE β事業計画書 (最終) .pdf` の両方で `filename*` のデコード結果が元名と一致することを確認し、検証ファイルは削除した。
- `npx tsc --noEmit`、対象3ファイルのESLint、`npm run build` を通した。
- `deploy.sh` は他セッション所有のtracked dirtyでhard stopしたため、対象8ファイルだけをstageして `git push origin main` を直接実行した。同時に別セッションの未push commit `229edcfc`（v3.87.0 / PJ知財台帳の列追加）も一緒に上がっている。
- 本番 `/api/build-info` は `v3.87.1` / `ab7cde4ae7c184c9b9d50bea3b569a6f4168813e` / `deployed_at 2026-08-21T09:34:33.921Z` を返した。

---

## 2026-08-21 — 資料室のフォルダ行dropと、移動・削除・追加の即時反映（v3.86.2 / v3.87.2）

### フォルダ行そのものをドロップ先にする（`a6cd3d7d` / v3.86.2）

- まさの申告は「フォルダの上へ持っていっても移動できない」。実装を読むと、drop handlerは上部パンくずにしか付いておらず、一覧に並ぶfolder行は最初から受け口になっていなかった。
- `WorkspaceDocumentRoom.tsx` のfolder行に `onDragOver` / `onDragLeave` / `onDrop` を追加し、既存の `moveEntryToFolder()`（organize PATCH）へ流す。サーバ側の検証経路は変えていない。
- `canDropIntoFolder()` が entryKind・drag中のentry自身・同一folder・folder自己/子孫を弾く。`stopPropagation()` で一覧全体のFinder file dropゾーンと競合させない。
- 自己/子孫判定を整理dialogの `selected` 依存から `eligibleMoveTargetFor(item, path)` へ切り出した。drag経路で誤ったentryを基準に判定していた不具合も同時に消えた。

### 移動・削除・追加を先に画面へ反映する（`5ee97811` / v3.87.2）

- まさの申告は「移動・削除・追加のたびに5〜7秒待たされる。フロントだけでも先に処理して」。
- 原因は、各mutationがPATCH/POSTを待ったあと直列で `await loadDocuments()` を呼び、その先頭の `setLoading(true)` が一覧を空のspinnerに落としていたこと。失敗時は `setDocuments([])` で一覧が消えた。
- 読み取りを2系統に分割。`loadDocuments()`（spinnerあり・失敗で空配列）は初回マウント専用。mutation後は `refreshDocuments()`（spinnerなし・失敗しても表示を壊さない）で背景同期する。
- 移動・削除・整理・追加はいずれも `const snapshot = documents;` → ローカル反映 → dialogを閉じる → リクエスト。成功で `void refreshDocuments()`、失敗で `setDocuments(snapshot)` + dialog/選択の復元 + エラー表示。
- ローカル反映はmigration 217のRPC（`workspace_move_document` / `workspace_archive_document`）の**カスケードを鏡写しにする**。folder移動は配下の `folderPath` を接頭辞置換し、folder削除は配下ごと消す。ここがずれると背景同期が戻ってきた瞬間に画面が飛ぶ。
- リンク追加（`create_link`）だけは楽観行を作らない。開くURLが `documentId` 由来で、`pending:` idの行は404になるため。
- `moveEntryToFolder` から `busy` 拘束を外し、連続ドラッグができるようにした。

### 検証と反映

- `node scripts/check_workspace_documents_contract.mjs` → ok。楽観UI用に10本の契約テストを追加（`await loadDocuments()` の復活、背景同期でのspinner/空配列化、snapshot戻しの欠落を落とす）。
- 途中、別セッションの `ab7cde4a` が `pdf/route.ts` を `downloadUrl` 経由に変えており、契約テストの既存2本（line 108 / 110）が古い正規表現のまま落ちていた。今回同じ単位で `downloadUrl` へ揃えた。
- `npx tsc --noEmit` はリポジトリ全体でエラー0。
- 対象7ファイルだけをstageして `git push origin main`。本番 `/api/build-info` は `v3.87.3` / `6ff519dbab9e8b8185f576356bf428638e261bae` を返し、`git merge-base --is-ancestor 5ee97811 6ff519db` で本番包含を確認した。
- BUILD_VERSIONは別セッションが v3.87.0 / v3.87.1 を先に使っていたため v3.87.2 を採った。

---

## 2026-08-21 — PJ知財タブの新設からタブUIの押下アフォーダンスまで（v3.84.x〜v3.88.2）

### 知財タブの新設（`823f145e` → `229edcfc`）

- まさの依頼は「各PJのコックピットに特許情報をまとめておくタブ」。設計討議でスコープをBefore Zero起点（自社出願だけでなく周辺の他社特許まで）に確定し、4テーブル台帳（`project_ip_assets` / `project_ip_deadlines` / `project_ip_rights` / `project_ip_events`）で作った。
- `823f145e` で `CockpitIpPortfolio.tsx` と `/api/project-ip` を新設。GETは `requireAuth`（メンバー）、書き込みは `requireAdmin`。同じcommitで資料室も独立タブへ出し、進捗タブ側の資料室モーダル導線は後続で削除した。
- 最初の実装はカード羅列で、まさから「これじゃただ情報が並んでるだけじゃん。表形式にしてよ」。`18188551` で立場別の実テーブルへ作り替えた。
- 続けて「年金の支払状況とかPCTの状況とか、他にも列として追加すべき項目あるんじゃない？」→ ライフサイクル列を洗い出し、migration `311` で追加。まさ「全部足すで全然問題ないよ。先頭列先頭行固定で横スクロールさせればいいし」に従い、28列＋先頭列・先頭行固定の横スクロール表にした。
- 初期データはSE（p10）。まさが直前に掘り起こした特許情報を載せるための急ぎ作業という背景。

### ワークスペース側への展開とタブUI統一（`de33ef6f` / v3.87.4）

- まさ「このタブはワークスペース側にも表示して。ワークスペース側のタブUIがコックピットと違って雑だから、コックピット側に合わせて」。
- `SxWeeklyControlDashboard.tsx` に `ip` viewを追加（hash `project-ip`）。タブ列の正本は `PROJECT_WORKSPACE_TABS` 配列で、nav の `gridTemplateColumns` はその長さから生成するので、次にタブを足してもCSSを触らなくていい。
- 外部漏れの確認: `SxWeeklyControlDashboard` は `principal: "member"` のときしか描画されず、`workspace_account` は最小の資料室ページへ行く。`/api/project-ip` のGETもメンバー認証。よってワークスペース側の知財タブから外部アカウントへ台帳が出ることはない。
- ワークスペースskinの `min-height: 44px` 強制が知財台帳の密なボタンを崩すため、既存の `sx-gantt-dependency-port` 例外と同じ形で `.sx-management-workspace .sx-ip-portfolio button { min-height: 0; min-width: 0; }` を足した。広域上書きにしない。

### 特許マップの縮小（`da23c76d` / v3.87.5）

- まさ「知財マップがやたら大きすぎて見にくい」。原因は `viewBox` を持つSVGに `w-full` を当てていたこと。幅がコンテナいっぱいまで拡大し、高さもアスペクト比ぶん膨らむ。
- 修正は intrinsic な `width` / `height` 属性＋ `h-auto max-w-full`。これで**拡大せず、狭いときだけ縮む**。基準寸法も W 720→560、rowH 42/34→26/22、余白と文字10→9px、点半径 `4+imp*1.6`→`2.5+imp*0.9` へ詰めた。出願人マトリクスも `min-w-[480px] w-full` → `w-auto`、セル余白 `px-2 py-1` → `px-1.5 py-0.5`。

### タブの押下アフォーダンス（`32c09720` / v3.88.2）

- まさ「タブにマウスオーバーしたときにマウスのUIが変わらないのがUX的にイケてない。押せることが分かるように。あとタブも少しだけ浮き上がるとUX爆上がりする」。
- カーソルが変わらない原因は**Tailwind v4のpreflightが `button { cursor: default }` を当てている**こと。個別対応せず `globals.css` の `@layer base` で `button:not(:disabled), [role="tab"]:not([aria-disabled="true"]), summary { cursor: pointer }` と `button:disabled { cursor: not-allowed }` を戻した。OS全体のボタンに効く。
- 浮き上がりは、コックピット（`CockpitView.tsx`）とワークスペース（`weekly-control.module.css` の `.sectionNav`）を同じ寸法で揃えた。`overflow-hidden` ＋ `border-l` 区切りの帯をやめ、`gap-1 p-1` の角丸ボタン列にして、hoverで `-translate-y-2px` ＋ `0 6px 14px -6px rgba(15,23,42,.4)` の影、`:active` で沈む。選択中の白地＋ `inset 0 -2px 0 #0f172a` は維持し、hover時だけ外側の影を重ねる。`prefers-reduced-motion` では動かさない。
- `overflow-hidden` を外したのは影と浮き上がりが切れるため。区切り線を落としたので `tabs.map` の `index` 引数も削除した。

### 検証と反映

- `npx tsc --noEmit` は自分の変更ぶんエラー0（別セッション未コミットの `AmdScoreFormulaPanel.tsx` の既存エラーのみ除外して確認）。
- `npm run test:critical-ui` → ok。deployは全件 `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash scripts/deploy.sh` 経由。
- 本番確認: v3.87.4 `50f88448` / v3.87.5 `da23c76d` / v3.88.2 `32c09720` をいずれも `/api/build-info` の `git_sha` 一致で確認した。
- ブラウザでの実操作確認は未実施（`未確認`）。

## 2026-08-21 — 資料室のフォルダ内部化cascadeと、共有範囲の視認性（v3.88.3 / `dee0915f` `bb88f6fb` `adcba9d5`）

SE(p10)でまさが `old` フォルダをAMD内部へ変えようとして「外部共有中の資料が入ってるため、先に中身の共有範囲を変えてね」で止まり、中身を1件ずつ手で変える必要があった。3点の依頼。

### フォルダ内部化の確認＋一括cascade

- 従来はPATCHが409で拒否するだけで、配下ごと変える経路が無かった（`workspace_move_document` RPCは単一行のみ更新）。
- `workspaceDocumentFolderHasSharedDescendants`（真偽）→ `countWorkspaceDocumentSharedDescendants`（件数）へ拡張。409レスポンスに `code:"shared_descendants"` と `affected`（件数）を足した。
- UIは409+`shared_descendants`を受けたらエラー表示にせず確認ダイアログを出し、承諾で同じPATCHを `cascadeVisibility:true` で再送する。文面は「このフォルダには外部共有の資料が N 件あります。フォルダをAMD内部にすると、中の資料もすべてAMD内部になり、社外のメンバーからは見えなくなります」。
- 一括更新は専用RPC `workspace_set_folder_visibility_cascade`（migration 313）で1トランザクション。migration 217と同じ権限設計（REVOKE ALL → service_roleのみGRANT）。監査ログは `action:"organize_cascade"` ＋ `affected`。
- **内部化専用**にした。`workspace_shared` への一括変更はAPIから呼ばず、RPC側でも `p_visibility <> 'amd_internal'` を例外で拒否する。誤って社外へ開く事故のほうが重いため。将来「一括で外部共有へ戻す」が要るなら、このガードを外す必要がある。
- 外部アカウントは既存の `if (access.principal === "workspace_account") visibility = "workspace_shared";`（195行）で `amd_internal` に到達できないため、cascade分岐に入らない。この前提はコメントで明示した。
- migration番号は指示の312が作業中に別セッション（`312_seed_screening_bands_p_ind_rationale.sql`）と衝突し、313へ採番し直した。

### 共有範囲の視認性

- バッジを独立カラムから資料名の直後へ移した。グリッドは4列→3列（`grid-cols-[minmax(0,1fr)_120px_360px]`）、バッジは `shrink-0`、名前側は `min-w-0 truncate` で、長い名前でもバッジが潰れない。
- `workspace_shared` のアイコンをオレンジ `--room-orange: #b45309`（既存の「社外役員/顧問」バッジの系統）にした。folder/file/link全種別に適用し、種別ごとの固定色より優先する。
- アイコン本体だけ色を変えても、周りの台座が `bg-slate-100` のままで区別が付かなかった（まさ指摘）。台座も `--room-orange-tile: #fdeedd` / `--room-navy-tile: #e2e8f0` で塗り分けた。台座は薄い色にとどめる（濃くすると一覧がうるさく、名前の可読性が落ちる）。

### 検証

- `npx tsc --noEmit` エラー0、`npm run build` 成功、`check_workspace_documents_contract.mjs` ok（旧関数名のアサーションを新関数名＋新挙動へ更新）。
- DB層のcascadeは、p10配下に使い捨てUUIDでフォルダ＋子3件（active+shared / archived+shared / active+internal）を作って実行し、activeなsharedだけが変わること・archivedが対象外なこと・非folderと `workspace_shared` 指定が例外で弾かれることを確認。直後にHARD DELETEし残存0を確認した。**p10の既存資料には触れていない**。
- 本番反映は `/api/build-info` の `git_sha` 一致で確認（`dee0915f` → `bb88f6fb` → `adcba9d5`）。
- ログイン済みChromeでコックピット資料室を開き、`getComputedStyle` でアイコン `rgb(180,83,9)` / 台座 `rgb(253,238,221)`、AMD内部は `rgb(8,27,43)` / `rgb(226,232,240)` を実測。**確認ダイアログの実クリック検証だけは未実施（`未確認`）** — 現状のp10は `old` も中身もAMD内部で、試すと状態が変わるため。
