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
