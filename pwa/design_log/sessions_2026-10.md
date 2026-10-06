# 2026-10 開発セッション

## 2026-10-04 SOL の写しと説明の数字を、培養の LED（449）の後の試算にそろえる（migration 474、Drive・Vercel・claude.ai の写し）

決まり: 試算が変わったら写しを聞かずに直す（まさ 2026-09-17「気づいてるならすべて新しい数字に変えて」、SOL の memory「4か所」）。449（2026-09-22、培養の LED の照明）で古くなっていた。

- **4か所の写し**: ビジネスモデルの「SOLのビジネスモデル」（収益の柱）・「オフサイトの廃液処理の評価」・「菌で処理できる濃さ」、Drive の検証資料（今日の日付のフォルダ `p21_sol/261004_オフサイト廃液処理の検証` に改訂版の md・html。9/14 の原本のフォルダは触らない）、Vercel `sol-offsite-waste-260914`、claude.ai の非公開ページ。オフサイト（SOL工場で処理する形）の1m³あたりの総コストは 色素分解 5,947.6円・6,031.4円 → 14,120.0円・14,203.8円、金属回収 111,322.5円・90,844.2円 → 429,116.6円・342,681.0円（自然株・強化株）。**金属回収は、排熱・排ガス・排液の3つを使っても 341,336.1円・271,745.2円 で、売価 50,000円の5倍を超える**（9/17 の写しでは3つで売価の内だった）。菌体1kgの原価の大半が LED の照明で、3つの切り替えでは下がらないため。菌体費だけで1Lあたり50円に届く濃さは 約3,100mg/L → 約760mg/L
- **収益の柱の金属回収の行**: 「Cu・Ni・Fe はラボで確認、Pb・Dy・Nd は速報」を、2026-10-02 の杉浦先生の説明資料で検証済みになった金属（鉛・クロム・亜鉛・カドミウム・銅・アルミ・鉄・ストロンチウム、実排液を含む）にそろえた（spec 3-20 §3.4 の新しい証跡の決まり。技術タブは 460 で書き換え済み）
- **コスト試算の中に残っていた古い数字**: 449 は明細と版の履歴だけを足し、説明・前提の説明・注意して読むところ・確認事項に 913.2円 などが残っていた（DD で見せる画面）。廃液は説明の菌体1kgの原価、取り込み効率の2つの前提の説明、注記5件（使用回数と回収率の表、色素分解の仮置き、オフサイト、24時間と4時間、年に作る量と初期投資）、確認事項6件。燃料は 438（FAMEポテンシャルを分析値 8・12・13% に置き直し、メタノールで破砕と抽出を同時に）の前の書き方も残っていた: 説明の「切り替えは2つ」「細胞の構造からの試算」、範囲の「細胞を壊して溶媒で」、注記5件（収率・菌体費・分泌株・残渣・構造からの値）、確認事項5件。**確認事項の「動く幅」も同じ前提で計算し直した**（例: 菌体使用回数 50〜682 → 168〜2,720円/m³、4時間の取り込み 875 → 3,422円/m³、培養の物量条件は光の収率の幅 60〜230 kWh/kg で 1,145〜2,833円/m³）。計算に使う値（前提・明細・作業）は変えていない
- **計算の前提**: 2026-09-22 の試算で、工場の排熱・排ガス・排液を使わないとき（3つを使うときの値は文に並べた）。廃液の試算は 2026-10-01 10:06 に画面の保存で3つの切り替えが「入」で保存されている（変更の記録 497〜498、理由なし）。開いたときの数字は3つを使う場合の値（色素分解 402.5円/m³）。保存値は触っていない
- **検査用の写し**: 2つの fixture は、書き換えた欄（説明・前提の説明・燃料の注記と確認事項）だけを同じ文にした。切り替えの値は検査の前提のまま「切」（DB は 10/1 の保存で「入」）。`test:project-cost-model`（廃液 OK・燃料 22 checks・標準フォーマット 8件）
- **生成**: scratchpad `gen_sync.py`（今の文の md5 で止める。数字は `sens.mts` が DB の写しから `computeCostModel` / `computeFuelCostModel` で出す。どちらもコミットしない）。試し実行（ROLLBACK）→ 適用 → 読み戻し

## 2026-10-03 SOL の愛媛訪問の反映と、技術台帳の5つ目の形「QA集」（migration 460・461、v3.148.0）

まさ「今回の瀬戸内ツアーで得られた知見をコックピットに入れていってほしい」「議事録はサマリだけじゃなく一次情報の書き起こしデータもすべて確認すること」「DDパッケージのところにQA集を新たに作ってほしい」「質問された回数の多いものから順にソーティングされるようにして。回数が同じ場合には…重要度で★、★★、★★★の3段階で」。

- **読んだもの**: Notion の議事録6件（10/1 いよぎん・愛知時計電機、10/2 ハタダ・日泉化学・住友金属鉱山・アドバンテック）の要約と書き起こし全文（ローカルの Notion データベース。H-1 の補助スクリプトは書き起こしを 8,000 字で切るので、子ブロックを順に辿って全文を出した）、いよぎん面談の Circleback の記録、10/2 のお礼メール5通。愛知時計電機は録音が冒頭で止まり、最後の数分しか残っていない
- **460（データ）**: MTGカード（いよぎんを新規、10/2 の4枚を書き起こしに合わせて書き直し）、関係先（9件更新・2件追加、窓口はすべてまさ）、やり取り履歴11件・ボール7件、技術タブ（検証済みの金属、取り込みの順番、10Lリアクター、カートリッジ、菌の量、低温、PoC用の実排液5件）、ビジネスモデル「顧客の現場で分かったこと」、タスク2件（社名の確認、COO候補の探索）。愛知時計電機は「協業の余地がないと分かっただけ」（まさ）なのでカードを作らず、議事録の台帳を no_material にした
- **書き起こしの聞き違い**: 「山下さん」「山井さん」→ まさ、「コリブス」「ホリグス」→ DAVP の堀淵さん、「記憶帳」「紀北町」→ 愛媛県鬼北町（Notion の AI 要約は三重の紀北町と書いていた）。半減期は「0.2分と十数秒」で、えいみは一度「約2分」と読み違えた。Circleback の「約0.2分（十数秒）」で正した
- **ルールの変更（spec 3-20 §3.4）**: 杉浦先生の 10/2 の説明資料に「鉛・クロム・亜鉛・カドミウム・銅・アルミ・鉄・ストロンチウムは検証済み」とあるのに、技術タブは「これから評価」のままだった。えいみがこれを食い違いとして報告したところ、まさ「検証済みだよ。新しい証跡でそう書かれているなら、そっちを正本にするルールにしないとどんどん食い違いが増えるよ」。新しい一次情報があれば行を書き換え、両方残して要確認にするのは同じ時期の食い違いだけにした
- **餌と分解**: 「糖に分解されていれば取り込んで分解する」（10/2 先生）を、技術タブの「炭素源はCO2だけ」と食い違うと報告したら、まさ「餌になるかどうかと分解するかどうかは別の話じゃないのかな」。台帳では増殖の炭素源（CO2）と有機物の分解（COD低減）を分けて書いた。分解の仕組みは未確認のまま
- **461（DDL＋データ）＋コード**: `project_tech_topics.block_kind` に `qa` を足し、`QaBlock`（tech-blocks.tsx）と並びの関数 `sortQaEntries`（project-tech.ts）を作った。並びは画面で毎回計算する（回数 → ★ → sort_order）。入力フォームは qa のとき質問・答え・回数・重要度の欄になる。技術タブ・ワークスペース・DD が同じ部品で描く。並びの検査 `check_tech_qa_sort.mts` を `test:dd-package`（deploy 前ゲート）に入れた
- **SOL の QA集**: 19問。回数は「その質問が出た面談の数」で、こちらから先に説明しただけのものは数えない。聞かれた相手は社名を伏せて業種で書いた（面談で社名を出さないと約束しているため）。DD の「事業概要」の先頭に公開で載せた（パッケージは未公開・閲覧権限0件のまま）
- **確認**: `tsc`、`test:dd-package`、`test:critical-ui`、`test:reference-data-cache`、`test:model-formula-canon`、会議カードの品質ゲート（5件とも通過）。460・461 は試し実行（ROLLBACK）→ 適用 → 読み戻し

## 2026-10-02〜03 支払通知書の摘要を「支払月＋対象の稼働月＋未払い残高」の3行へ（v3.147.9〜v3.148.4、GAS @1504・@1505）

まさ「ちこの支払通知書だけど、4−6月稼働分ってなってるのは間違いじゃない？ 4月分にも満たない額だと思うんだけど」。

- **原因**: ちこ (ID007) の SOL (p21) は月次の支払枠で発生分を払い切れず、4月 119,893円・5月 119,893円・6月 120,363円が積み上がっていた。9月支払 87,185円の明細は、繰越の鎖を遡った範囲全体で「SOL 4〜6月発生分の一部」と書かれ、4月分にも届かない額が3か月分に見えていた（金額自体は正しい）。
- **途中の版**: ①「今回の支払が当たる月」を古い月から順に当てて「4月発生分の一部」「4〜5月発生分（4月の残りと5月の一部）」と書いた（v3.147.9）→ まさ「発生分の一部とか書くとややこしくない？ ◯月支払分、とかじゃダメなの？」。②支払月だけにすると、登録番号を両者載せた通知書を仕入明細書として使う場合の取引期間が抜けるため、1行目を支払月、2行目に対象の稼働月とした（v3.148.1、GAS @1504）→ まさ「『2026年4月の稼働』って書いたら、4月稼働分は87,185円しかもらえないのか？ってならない？」。③3行目に未払い残高を添えた（v3.148.4、GAS @1505）。
- **確定形**（manual 6-5「明細の摘要」）: `SOL 業務委託料（10月お支払分）` / `対象：2026年4〜5月の稼働` / `未払い残高 258,933円（税抜、翌月以降にお支払いします）`。3行目は本契約の未払いが残る行だけ。部品は `pwa/src/lib/payout-source-span.ts` の `allocatePaidMonths`・`payoutLineDescription`・`payoutTargetText`・`payoutRemainingText`。GAS 064 は `targetText` / `remainingText` を U+2028 で運び、摘要セル内の改行に戻して描く。
- **備考欄は空のまま**: 8/28 にまさが備考の繰越説明を消した判断（fb53ca0c）は維持。3行目は明細の中の一行として置いた。
- **作り直し**: 書式更新日時 `PAYOUT_NOTICE_PDF_TEMPLATE_UPDATED_AT` を上げ、`/api/cron/payout-notice-prebuild?ym=202610` を手動で叩いて未送付の10月支払分（ID003・ID007・ID009）を作り直した。ZMP の3人（ID004・ID008・ID026）は月初合意の gate で止まったまま（今回の変更と無関係）。メール送信なし。
- **送付済み9月分の差し替え版**: 送付済み通知書は `sent_protected` で上書きできないので、GAS `payoutCreatePwaNoticePdf` を直接呼んで同じ番号 PN202609-003・作成日 9/28 の差し替え版PDFだけを作った（DBの `pdf_url` / `sent_at` / `paid_on` は元のまま）。最終版は Drive `1PIeIaTGkTkjBIEKs-wIOyeQ5p3yc9D-t`。途中の版2つ（`1iC7jhFexfhm7Yzvac-ZpapGNlfDhic_3`・`1NveHsrt7tCUAzvCMfY_c0MVhhKRYVK4F`）は同名で同じフォルダに残り、削除はまさ判断。
- **GAS の反映**: clasp の認証が `invalid_rapt` で切れていたため、まさに `clasp login` を実行してもらった。push 前に `clasp pull` で本番の223ファイルを取り、本流と1ファイルずつ比べた。本番は bb64a25d（立替明細の折り返し）が未反映で本流より古いだけだったので、本流の内容で push → `deploy --deploymentId`（@1504、@1505）。
- **確認**: `test:payout-source-span`（ちこの実データ 4〜8月の例を追加）、`check_pwa_critical_ui.cjs`、`tsc`、deploy.sh の検査一式。作り直したPDF（9月差し替え版・10月分）を Drive から取り出して画像で目視。
- **未対応**: 送付済みで旧表記のままの通知書（例: かるの8月支払 145,575円「4〜6月発生分の一部」）は差し替えていない。2行目の稼働月を残すかは税理士・きょうこさん確認待ち（不要なら `payoutTargetText` の行を外すだけ）。

## 2026-10-03〜04 PWAのタブ表示と、作業フォルダの自動追従（v3.148.2 / v3.149.1 / v3.154.4）

まさ「pwaアプリだけど、chromeみたいに複数タブを許容するようにしてほしい」「その作業フォルダの遅れの解消もしておいて」「こういうことが起きないような仕組みを作ってほしい」「１と３やってほしい」。

- **タブ表示**（`7620e8f0`、v3.148.2）: `public/manifest.json` に `display_override: ["tabbed", "standalone"]`。Chromium の `runtime_enabled_features.json5` で `WebAppTabStrip` は ChromeOS だけ stable、それ以外は experimental（`DesktopPWAsTabStrip`）。まさの Chrome 154（Mac）に `enable-desktop-pwas-tab-strip` の flag があり、未有効だったことを確認。flag を有効にした端末だけタブ列が出る。手順は manual 2-1「アプリ版でタブを並べる」、仕様は spec 2-1。画面側に `display-mode` の分岐が無いことを確認。まさの端末で flag を入れたあとの実画面は未確認。
- **作業フォルダの追従**: 311件遅れ・書きかけ35件・未push 3件を3者比較で仕分け、控え（`/Users/masa/projects/AMD/amd-os-root-dirty-20261003/`）を取ってまさ承認で追従。最新版に無かった記録2件は `7f4d6e5a` で移設（`HANDOFF_CONTRACT_DRAFT_2026-09-25.md`、本ファイル8月分の OIST 節）。経緯は BUGS 2026-10-03。
- **再発防止**（`80a9e159` v3.149.1、`e4c83d0c` v3.154.4）: `scripts/root-checkout-sync.py`。8通りの使い捨て repo と、当日の状態の再現で確認。`.claude/hooks/git_dirty_guard.sh`（git 管理外）の session_start で `--quarantine on` 実行。30分ごとの LaunchAgent（plist は `scripts/launchagents/` に同梱）はまさ判断で不採用。
- **捨てた案**: 最新版とぶつからない古い書きかけ（追跡ファイルの変更・削除）まで72時間放置で隔離する拡張。auto mode の安全装置が「他の作業への干渉」として止め、まさの「1と3」にも含まれないため入れていない。
- **auto mode の安全装置**: 書きかけの破棄・フック編集は会話内の承認では通らなかった。フック編集はまさに権限モードを「毎回確認」へ切り替えてもらって通した。


## 2026-10-05 DD・3領域の引き継ぎ

開発履歴のみ。正本spec/3-24・5-17・3-23、manual/2-1・2-3・2-6、ios/DESIGNへ同期済み。ホーム導線・履歴UI、領域並列化、DDプレビュー/一覧削除、ページ対照表、指定ページ追加と沿革改名、最後に正本本文共通化を実施。タブだけ共通/掲載QA抜粋案は廃止。最新修正のDB/schema/env追加なし（以前の469は適用済み）。BUGSへ根因記録。共有の月次報告書作業は保全。専用HANDOFF_dd_spacesへ現在地を保存。

ファイル単位の本文共通化変更（A=新規、M=変更。初期データ引数と共通取得関数、再現試験を含む）:
```text
M	ios/DESIGN.md
M	pwa/HANDOFF_pwa_rebuild.md
M	pwa/design/governance_action_items.md
M	pwa/manual/2-6-admin-ops.md
M	pwa/manual/9-3-appendix-changelog.md
M	pwa/package.json
A	pwa/scripts/check_dd_shared_page_data.mts
M	pwa/scripts/check_killer_factor_catalog_contract.mjs
M	pwa/scripts/check_project_format_contract.mjs
M	pwa/scripts/check_project_workspace_route_contract.mjs
M	pwa/scripts/check_pwa_critical_ui.cjs
A	pwa/scripts/register_relative_ts.mjs
M	pwa/spec/3-23-project-format-current-spec.md
M	pwa/spec/3-24-project-surface-pages-current-spec.md
M	pwa/spec/5-17-dd-package-current-spec.md
M	pwa/spec/6-1-appendix-changelog.md
M	pwa/src/app/api/governance/capital-plans/route.ts
M	pwa/src/app/api/governance/killer-factors/route.ts
M	pwa/src/app/api/governance/route.ts
M	pwa/src/app/api/project-tech/route.ts
M	pwa/src/app/dd/[slug]/items/[itemId]/page.tsx
M	pwa/src/app/dd/[slug]/page.tsx
M	pwa/src/components/cockpit/CapitalPlanWorkspace.tsx
M	pwa/src/components/cockpit/CockpitCapitalPlan.tsx
M	pwa/src/components/cockpit/CockpitCompanyOverview.tsx
M	pwa/src/components/cockpit/CockpitCostModel.tsx
M	pwa/src/components/cockpit/CockpitCostTab.tsx
M	pwa/src/components/cockpit/CockpitFinancialProjection.tsx
M	pwa/src/components/cockpit/CockpitFuelCostModel.tsx
M	pwa/src/components/cockpit/CockpitKillerFactorCatalog.tsx
M	pwa/src/components/cockpit/CockpitTechnology.tsx
M	pwa/src/components/cockpit/ProjectCostFormat.tsx
M	pwa/src/components/cockpit/ProjectFinanceFormat.tsx
M	pwa/src/components/cockpit/finance-format-client.ts
M	pwa/src/components/dd/DdAdminPanel.tsx
A	pwa/src/components/dd/DdDocumentsPage.tsx
M	pwa/src/components/dd/DdPackageTop.tsx
M	pwa/src/components/dd/DdProjectPageBody.tsx
M	pwa/src/components/project-workspace/SxWeeklyControlDashboard.tsx
M	pwa/src/components/workspace-documents/WorkspaceDocumentRoom.tsx
M	pwa/src/lib/build-info.ts
M	pwa/src/lib/dd-project-page-types.ts
M	pwa/src/lib/dd-project-pages-server.ts
A	pwa/src/lib/project-capital-plan-data.ts
A	pwa/src/lib/project-capital-plan-server.ts
A	pwa/src/lib/project-finance-page-data.ts
A	pwa/src/lib/project-finance-page-server.ts
A	pwa/src/lib/project-governance-server.ts
A	pwa/src/lib/project-killer-factor-types.ts
A	pwa/src/lib/project-killer-factors-server.ts
A	pwa/src/lib/project-tech-server.ts

M	pwa/scripts/check_project_fuel_cost_model.mts
M	pwa/src/lib/project-finance-page-data.ts
M	pwa/src/lib/project-killer-factor-types.ts

M	pwa/HANDOFF_pwa_rebuild.md
M	pwa/scripts/check_capital_plan_workspace.mts
M	pwa/spec/5-17-dd-package-current-spec.md

M	pwa/HANDOFF_pwa_rebuild.md
M	pwa/src/components/cockpit/CockpitCompanyOverview.tsx
M	pwa/src/lib/build-info.ts
```


## 2026-10-05 月次報告書の対象期間変更・9月限定修正のcloseout

- 仕事種別: development（生成仕様と運用データ修正）。0648e03eで月初〜暦上月末を正本仕様・manual・M群/M-1指示へ反映し、正規deployの必須検査と本番SHA確認が成功。生成25日16:00は維持。クラウドroutineも限定指示差替え→保存→編集画面再読込で新規則あり/旧1〜25日なし。
- 9月CX/KUTE提出版は対象期間とKUTE冒頭説明だけ9/30へ更新。置換を逆適用して修正前本文との完全一致を検証し、提出版validator両件ok/formatMatch=true。monthly_report_external_saveによる編集履歴とDB読戻しbody_matchesを確認。SOLは既に9/30、未変更。Drive PDF更新は未実施。
- 原因: 8/29の25日発火化で対象期間まで25日に固定していた。解決: 生成日と暦月の対象期間を分離。未来予定の実績化は引き続き禁止。新規schema/env/route/モデル変更なし。
- 引き継ぎはroot HANDOFF_monthly_report_period.mdとSESSION_MIGRATION_PROMPT.md。既存共通HANDOFFの他チャット差分は未変更。共有checkoutに残る22パスはactive「9月月報の記載を修正」由来とread_threadで確認。9/22の未追跡タスク移行案も保存維持。main整合・branch/worktree・配信を監査済み、共有checkout全体はarchive不可。会話の検討材料0件。

## 2026-10-05 月次報告書の操作集約とPDF自動保存

- 仕事種別: development。月・版のプルダウン、編集・保存を同一操作列に集約し、重複ヘッダー・PDF保存ボタンを撤去。履歴入口を本文末尾へ移動。PDFは認可済み保存APIから自動生成し、private OSドライブとPJ共有Driveへ保存・bytes読戻しする。既存PDFのID・場所・権限を維持。PDFだけの再試行は本文と履歴を追加保存しない。
- 紙面検証でstyled-jsxのCSSがscript無効のSSR描画へ出ないことを検出し、紙面CSSをserver-rendered styleへ変更。Nextのhidden suspenseコンテナから紙面を取り出し、日本語fontを同梱。本文は変更しない。
- 検証: 認証済みHTTPでp25/202609本文とcompact controls、未認証PDF APIの拒否を確認。実HTMLとCSSの静的描画は1440×900で操作列53px、390×844で142px、横overflowなし。PDFはA4全5頁を画像確認し、操作列・編集履歴の印刷混入なし。Chromeの拡張接続とローカルGoogleログインは利用できず、操作確認は静的描画とAPI検証で代替。本番Google連携の認証取得は既存read-only routeで確認。
- deploy bundle: このUI・PDF保存・関連spec/manual/registryと回帰検査をmainへ保存し、正規deploy scriptでpush。本番build-info SHA一致、PDF保存API、OSドライブ一覧とStorage SHA、共有Drive size/md5を反映後に検収する。rollbackは本変更commitをrevertしてpatch versionを上げ、正規deployする。
- 既存未追跡SESSION_MIGRATION_PROMPT_task_based_pt_20260922.mdは本件の成果物ではなく保持。branch/worktreeは作成なし。秘密値・raw会話の恒久保存なし。

- 本番v3.159.3では提出版PDFのOS Storage・共有Drive保存と読戻しは成功、最後の保存記録の本文URL filterが失敗。長い日本語本文をPOST RPCへ移し、本文保存と同じadvisory lock下でPDF参照だけ条件更新する `monthly_report_pdf_record` をSupabaseへ適用。schemaの正本はios/supabase migration、本文・履歴に影響なし。v3.159.4でクライアント側の呼出を反映して再検収する。

- 実Vercel PDFの画像検収で、desktop専用のHiragino/Meiryo指定がLinuxのOpenSansへfallbackし日本語字形が消えることを検出。PDF描画時だけ全textへ同梱Noto Sans JPを適用し、本文の全文字でfont faceを明示load、読込み失敗なら保存前に停止する。Macの描画成功だけでは合格にしない。v3.159.5で本番PDFを再生成し画像検収する。

- 月報PDFの本番全ページ検収で、社内版表紙の18mm画面paddingが印刷時にも残り確定情報だけ次ページへ流れることを確認。v3.159.6は印刷時のcover-sheet paddingのみ無効化し、本文と画面組版を維持。実PDFの表紙・後続本文のページ境界を検証する。

## 2026-10-06 月報の初期月とコックピット見出し

まさ依頼で、月報の初期月をJST24日まで前月・25日から当月へ変更。1月の年跨ぎ、UTC日付とJSTの25日境界、うるう月を実行可能な検査に追加。PJメンバー文字列をヘッダーから外し、既存の3領域ナビを同一行へ集約。リンク認可・データ・帳票本文・PDF保存は維持。実装箇所はCockpitHeader／CockpitView／ProjectSurfaceNav／CockpitMonthlyReports／monthly-report-default-month。別セッションのDDキラー要素修正と既存の移行メモは対象外。

## 2026-10-06 KUTE月報UIの引き継ぎ・終了整理

- 開発の実装/検証はmainのecab9a16と並行SOL作業9485bfdeに含まれ、v3.159.9のbuild-info SHA一致を再確認。本文・Drive PDF・カレンダーの業務根拠はKUTE目的別mdへ分離。
- 引き継ぎ入口: ../../HANDOFF_KUTE_MONTHLY_REPORT_20261006.md、../../SESSION_MIGRATION_PROMPT.md。前の月報期間移行プロンプトはrootのSESSION_MIGRATION_PROMPT_monthly_report_period_previous.mdへ内容維持で控えた。
- 長文URL/RPC、Linuxフォント、印刷余白、skip ci混在、ブラウザ検証境界をBUGS.mdへ症状/原因/解決策/教訓で記録。新規env/秘密種別/テーブル追加なし（RPC migrationのみ適用済み）。
- manual/spec/registryは実装時に同期済み。今回は画面に出ない終了文書のみをcommitする。旧未追跡タスクpt移行ファイルは別作業として保持、保存可否はまさへ確認。

## 2026-10-06 全体メニュー・3スペースの左ナビ 本番検証

本番確認: 7f6cb1cc / v3.159.11をproduction aliasのbuild-infoで照合。Chromeで1440×900・390×844指定（ブラウザ110%）の全体メニューの開閉・ラベル・余白と閉じた後のフォーカス復帰を確認。コックピット会社情報→ワークスペース→DDの左メニューと本文、狭幅DDの開閉・ページ選択を確認し、UI品質8/10。ホームPJ運用リンクの実DOMに `target="_blank"`・`rel="noopener noreferrer"` を確認（通常クリックによる新タブの実着は自動操作では確認できず）。コックピットのゴールツリーは初回に管制データ取得失敗を表示したが、会社概要の取得と切替は成功。本文取得の再現調査はナビ変更から分離して扱う。共有DB・公開付与・掲載状態に書込みなし。今回の変更はmain/push済み、新規branch/worktreeなし。別セッションの未追跡handoffは保持しており、統合する場合はその報酬移行作業の担当が判断する。

## 2026-10-06 契約リスト・DD表示選択 v3.159.15

開発。全PJの3領域に共通契約リストを配置し、採用済み契約を関連PJで集計。専用GET/PATCHとcontract-list server/client、限定DTO、DD server filterを追加。DD変更はinternal admin/portfolio memberとworkspace manager、閲覧のみの利用者は拒否。既存PJサービス契約条件は維持。migration482適用済み、dd_visible=false初期値とSOLいよぎんNDAのaccepted/under_review/未締結/dd_visible=trueをreadback。条項・署名・期間は推定しない。元メールの送受信・添付公開・外部付与は変更なし。

検証: 型検査、新規ファイルESLint、critical-ui、project-format、reference-data-cache、DD package、実route/loaderによるproject-contract-listテスト通過。実NDA1件とsigned_at/date=nullを確認。v3.159.14の決議3一覧はPC Chromeで実表示確認。v3.159.15は公式deploy.shで配信し、PCで3領域の表示とオンオフ往復を検証する。Webスマホ検証・Swift変更はまさ指定で対象外。共通ページ原則・専用変更範囲はspec5-17/3-24・FEATURE_REGISTRY・manual2-3/2-6・ios/DESIGNに同期。理論/model変更なし。

共有checkout: mainのみ。今回の変更ファイルは本commit対象、既存未追跡SESSION_MIGRATION_PROMPT_task_based_pt_20260922.mdはタスク報酬移行担当の資料として保持（次判定は同担当がspec3-14/完了履歴と照合）、今回stage/deleteしない。検証の/tmpログ・.jez証跡はlocal temporary。対話証拠0件（製品仕様をrepo正本へ記載、個人の価値観として保存しない）。

### 契約リスト 配信後の検証・終了

f0c30d0f6ffa7a7387aff44d7cf8d3d994161c88 / v3.159.15がproduction aliasのbuild-infoと一致（公式deploy.sh、4分45秒）。新APIの未認証GETは401。PC Chromeのコックピットで5件・NDA1件・両当事者・確認中/未締結・表示チェックを実画面確認し、UI品質8.5/10。チェックをoffへ操作してDB falseをreadback。実server loaderと本番DBで内部5/DD0を確認後、当該NDAだけtrueへ復帰し、内部5/DD1、未締結維持をreadback。現在DD表示オン。

まさがChromeをMeetタブへ切り替えたため、ワークスペースとDDの実画面およびworkspaceチェック操作は未検証。タブへの限定接続もrequest-header policy読込みで2回失敗し、会議中のUI操作を停止した。代替は共通本文/導線の回帰・実route/loaderテストと本番DB読取り。会議のカメラ/マイク/参加操作は変更なし。Webスマホ検証・Swift変更なし。検証の一時scriptはignored .jezへ移し、秘密値/原メール/契約本文は保存しない。

終了分類: development、main aligned、committed success。恒久仕様はspec5-17/3-24・manual2-3/2-6・FEATURE_REGISTRY・DESIGN、本ログは開発検証記録のみ。今回のproduct変更はmainへ統合・push・配信済み。conflictなし、今回のtracked dirtyなし。既存未追跡handoffはタスク報酬移行担当の所有物として保持、次判定は同担当のspec3-14/完了履歴照合。安全に消す対象なし、まさ判断が必要な新規残件なし。対話証拠0件。残るPC追加画面確認は次にブラウザを利用できるときの検証範囲として明示し、実施済みとは扱わない。

## 2026-10-06 SOLの契約リスト掲載範囲 v3.159.17

開発修正。関連PJだけでAMD業務契約まで掲載した点を訂正。共通のproject_contract_scope/project_party_nameを追加し、project_party/project_relatedかつacceptedだけを一覧・件数・PATCH対象にする。scopeはDB取得時とprojectionで絞り、DD表示をオンにしても対象外契約を昇格させない。migration483適用済み。ユーザーが明示指定したNDAだけproject_related、既存4件だけstudio_service、元台帳/採用状態/契約状態は保持。PJ番号・相手先によるコード特例なし。新たな契約は未分類から確認後に採用する。UI/Swift/財務数値/外部付与/メール送信は変更なし。spec5-17/3-24、manual2-3/2-6、FEATURE_REGISTRY、DESIGN、HANDOFF、changelogを同期。検証は実route/loader regression・型検査・対象ESLint、本番DBとの実loader readback。前回のPC共通本文形状は維持。既存他セッションの未追跡handoffは保持・stageしない。

本番DBと実server loaderのreadback: SOL内部リスト1件/DD1件、対象は指定NDAの主キーのみ、未締結・表示オン。元台帳のaccepted5件は保存されている。scope4件はstudio_service、NDA1件はproject_related。型検査・対象ESLint・実route/loaderの掲載範囲/PATCH/非表示版テスト・DD回帰通過。並行のメニュー変更ba363e8a/23fe973fは既にmainへcommitされ、同じpush束に含まれる。今回の変更によりBUILD_VERSIONをv3.159.17へ進める。

## 2026-10-06 全体メニュー「≡」とDD資料目録の本番確認

- 本番 v3.159.16 / 23fe973f21d996db1e63aacf80908bfc96976209 のbuild-infoをreadback。正規deploy.sh経由でmainへpushし、2分36秒でReady。
- ChromeのPC画面（通常のブラウザ幅約1532px）でDD左メニューを確認。会社概要・資本政策表・株主名簿・次回ラウンドタームシートが独立し、長い資料名は左列内で折り返す。株主名簿とタームシートは各ページ見出しと「資料未登録」。資本政策表では既存の保存済みプランを表示。
- ホーム左上の三本線を目視確認し、ホーム・コックピット双方で全体メニューが開いた。Escapeで閉じ、開くボタンへフォーカスが戻った。確認用タブは閉じた。UI品質8/10、PCで重なり・文字切れなし。今回のWeb確認はPCのみ。
- DDページの資料名・18入口・23互換キー・空状態・DD認可の検査、標準フォーマット、型検査、変更部品のESLint、本番向けbuild、deploy必須ゲートが成功。
- 共有checkoutで同時編集された契約掲載範囲の文書をindexだけで別作業へ分離し、元の作業ファイルは保持した。本番反映はmainのクリーンな一時cloneから実施。契約範囲の後続478f37beは別セッションのcommitで、今回のnavigation差分とは分離。
- DB・GAS・数式・ネイティブの変更なし。SESSION_MIGRATION_PROMPT_task_based_pt_20260922.mdは別セッションの引き継ぎとして保持。

### 掲載範囲修正の配信後確認

478f37be1314b1dd4c9f6cdd90695a372f3c8907 / v3.159.17は公式deploy.shで4分28秒で本番反映。production aliasのbuild-infoで同一SHA、未認証GET=401を確認。反映後も実server loaderと本番DBで内部リスト1/DD1・指定NDAのみ・未締結/DD表示オンを再確認。元台帳の採用済み5件は保持。PC画面の再確認はCua接続/Statsig取得エラーで実施できず、今回のUI形状・操作は未変更として前回共通本文の確認と実route/loader回帰を代替にした。モバイル/Swift検証なし。

終了: development、main aligned、committed success。恒久仕様/手順はspec5-17/3-24、manual2-3/2-6、DESIGN、FEATURE_REGISTRY。今回のコードとmigrationはmain/push/本番反映済み、conflictなし。既存未追跡SESSION_MIGRATION_PROMPT_task_based_pt_20260922.mdはタスク報酬移行担当の所有資料として保持し、同担当がspec3-14/完了履歴で採否を判定する。今回の一時script・証跡はignored .jez、各検査ログは/tmp。対話証拠0件（製品仕様の訂正としてrepo正本に保存）。


## 2026-10-06 Function保存容量の抑制・引き継ぎ

- 原因・対策はspec/5-2、manual/9-2・9-3、spec/6-1へ同期。実装ac3866c9、検証記録d723980a、並行作業との統合db51c543。文書APIの静的分岐、next.configのtrace除外/同梱限定、postbuild容量検査の新規script/package登録、版数18を変更。DB・環境変数・秘密値・GAS・ネイティブ・モデル本文は変更なし。
- trace重複除去後: 文書API168.70→24.13MB、モデル66.61→34.55MB、月報履歴/つくよみ編集74.2→2.01MB。PDF生成5routeは88.4〜88.6MBでChromium/fontを保持。Vercelの保存量へ直接換算しない。
- 実施: npm run build、node scripts/check_function_bundle_storage.mjs、test:bzm-reader、test:model-formula-canon、test:monthly-report-pdf、変更コードESLint、git diff --check成功。既存test:workspace-documents-contractだけ失敗し未変更の正規checkoutでも再現。
- 正規deploy.shでmain push・本番Readyとac3866c9/v3.159.18/dirty:falseを確認。公開35章200、社内manual/spec/bzm未認証401。本番は後続の並行作業b6138915/v3.159.19へ進み、今回の修正を含むことを確認。
- amd-os-pwaの保存期間を全状態30→1日へ変更して読戻し。deploymentsToKeep:10も返る。使用量画面を反映後に再読込しても10.09GB。旧版整理・集計待ちで、超過解消は未確認。
- docs-only mergeの[skip ci]抜けによる重複ビルド予約は取り消し済み。原因・対応・教訓はBUGSに記録。一時cloneと検証serverは終了済み。
- closeoutはHANDOFF_FUNCTION_STORAGE_20261006.mdへ現在地/次の一手/他担当dirty帰属を保存。SESSION_MIGRATION_PROMPT.mdを今回用に更新し、従来KUTE全文はSESSION_MIGRATION_PROMPT_KUTE_20261006.mdへ内容不変で保存。会話の検討材料0件。

## 2026-10-06 ホーム・3スペース表示速度の改善と本番検収

実装46dd85cd/5981449a/f6a0d3a4、配布v3.159.19→21→23。同時進行のFunction容量・資本政策表・DD資料/ナビの変更をmainで保持した。ホームは他集計完了後のマウント待ち、履歴を含む大きなDTO、シーズ関連の分割読取が原因。先行取得、ホーム用DTO、60秒保持と同時要求の集約、1000行越えの安定ページングに変更した。3スペースは全ページの部品を初期配布、コックピットのサイクルごとの全PJ進捗再読取、DDの全公開項目読取と監査の直列待ちが原因。選択部品の分割、既存認可済みloaderでの並行先読み、PJ/MS限定のまとめ読取、DD header/documents/fullモードと監査の並行化へ変更。実画面で発見した同一PJのタブ切替のRSC待ちは、NextのNative History統合でURLと本文をその場で切替えるよう修正した。

実DBの旧/新取得を各3回比較（認証・監査・利用者回線・画面描画を除く）: ホーム1093→295ms/1,210,314→358,405 bytes、コックピット1318→561ms/24→18要求/867,523→662,569 bytes、DD会社概要634→249ms/15→11要求/27,798→2,964 bytes。コックピットの現在/過去データは配列順を正規化して一致。初期route entry JSのgzipはコックピット823,864→209,427、workspace647,839→105,764、DD572,205→141,221 bytes（選択ページの追加chunk・認証・通信を含まない）。数式・DB schema・開示範囲は変更していない。

検証: loader実行を含む`test:project-space-loading`（200キー/1000行境界、過去MS、読取失敗、DD読取モード・再認可・監査、実page handlerのURL保持とserver navigationゼロ）、home/critical-ui/DD/cache/format/workspace/3領域契約、tsc、対象ESLint、production buildと容量ガード。workspace routeの古い固定ラベル検査は現行の共通定義に同期。公開build-infoはv3.159.23/f6a0d3a4/main/dirty=false。実Chromeの検収範囲と画像はHANDOFFに記録。PC/スマホのホーム・ガントは横はみ出し0。開発成果はspec/manualとHANDOFFへ同期、会話の検討材料は0件。


## 2026-10-06 資本政策表の株主行の情報密度改善・closeout

# 資本政策表の株主行の密度改善 — 検証記録

2026-10-06 JST。実装commit: 56c6461d。本番反映SHA: bca5c497e919eab4c8f31d8ac795791c1aaa8016、v3.159.20、dirty:false。deploy.sh成功（2分41秒）。変更前: v3.159.19。

## 対象
共通CapitalPlanMatrix。株主1人1行、FD比率と前回比（ポイント）、非ゼロ出資額だけ補足。出資額編集と株数内訳は個別/一括展開。DB・計算エンジン・権限・Excelは変更なし。Native未変更。

## 検証
- 資本政策エンジン、資本政策ワークスペース、DDの閲覧・正本データ、critical UI、対象eslint、TypeScript成功。
- production build・Function容量ゲート成功。deploy.shの全必須ゲート成功。
- 実DB読み取り12株主×7ラウンドから実部品を静的描画し、Chromeで配置と大きい金額の表示を確認。確認用HTMLは削除。
- 本番AMD OS専用Chromeウインドウで株主一覧の1行表示、FD比率・前回比・出資額を確認。CEOの＋から出資額・株数・発行済・FD株数の4行を開き、閉じることを確認。
- 本番PC画面約1414×1089物理ポイント、拡大率110%。表内の横スクロールは既存どおり。株主12人の全行が同じ画面に収まり、名称と数値の重なりなし。UI品質8.5/10。WebはPC確認（既存handoffのPC運用）。モバイルの実画面確認は未実施、44pxの操作と表内スクロール契約は維持。

## 除外と同期
前から残るSESSION_MIGRATION_PROMPT_task_based_pt_20260922.mdと、共有mainで進行する別セッションの未push作業は保持。共有checkoutでは変更を消さずfetchし、今回の実装がorigin/mainに含まれることと同じ部品の差分なしを確認した。

## 反映経路と復旧
正規deploy.shからmain push。関連spec/manualとiOS DESIGN/HANDOFFを同じ実装commitに含めた。復旧が必要な場合は今回の実装commitを取り消す通常commitを作り、配信版より新しい版数へ上げて正規deploy.shで反映する。履歴の巻戻しや直接Vercel deployは使わない。

### 実装commitの変更ファイル（13件）

```text
ios/DESIGN.md
pwa/HANDOFF_pwa_rebuild.md
pwa/design/FEATURE_REGISTRY.md
pwa/design/cockpit.md
pwa/manual/2-3-pj-cockpit.md
pwa/manual/9-3-appendix-changelog.md
pwa/scripts/check_capital_plan_workspace.mts
pwa/spec/3-24-project-surface-pages-current-spec.md
pwa/spec/3-8-cockpit-current-spec.md
pwa/spec/5-17-dd-package-current-spec.md
pwa/spec/6-1-appendix-changelog.md
pwa/src/components/cockpit/CapitalPlanMatrix.tsx
pwa/src/lib/build-info.ts
```

恒久仕様はspec/manualへ反映済み。新規route/API/schema/環境変数/鍵/モデル変更なし。開発検証だけの履歴であり事業方針の変更なし。後続本番f6a0d3a4/v3.159.23にも実装を含む。引き継ぎは../../HANDOFF_CAPITAL_PLAN_DENSITY_20261006.md。

## 2026-10-04 PJ概要の標準フォーマット化・事業の一言の会社概要への移動・報酬形態への改名（CXセッション）

まさの指摘「PJの概要にそもそも出資とかテンポラリーな情報が入ってるのがおかしい」「そもそも概要って、PJ作ったときに作ったら、それ以降書き換えることはないのでは？」「これは会社の概要じゃなくてPJの概要なわけだから、もっとPJとしての情報が必要なのでは？」→「1で進めて」。

- 実装（v3.155.0、commit 991bcfe）: PJ概要を `ProjectOverviewFormat` の9項目（PJの定義5・今の状態4）に。定義は `project-formats.ts` の `PROJECT_OVERVIEW_*`・`AMD_REVENUE_KINDS`（鍵の承認追加）。API `/api/project/[projectId]/overview`（GET=メンバー、PATCH=管理者）と `/business-summary`（GET=メンバー＋共有WS、PATCH=管理者）、参照系3層。事業の一言は会社概要「事業の概要」（`CompanyBusinessSummarySection`）。つくよみの追記マージ（description-merge・`CockpitDescriptionDetailModal`）とチャット道具 `update_short_long_description` を削除。検査 `test:project-overview` を deploy に追加。
- migration 468（適用済み）: `project_definitions`・`project_business_summaries`（RLS 管理者書き込み、履歴トリガー）。`project_ventures.short/long_description` は同期トリガーで写す控え、直書きは `project_ventures_business_summary_guard` で拒否。13PJを写し12PJの文から一時情報を除去。CX沿革の Build VC と未来の設立予定を除去。`tsukuyomi.system` から道具の行を除去（llm_prompt_revisions）。
- 修正（v3.156.2）: 設立前の会社を「設立済み」と出していた（会社概要の設立日欄が計画日）→ 法人状態を先に見る。契約の状態を日本語化。事業の概要を会社概要の最上段へ（別セッションの DD 用 `initialData` を保持して統合）。
- 改名（v3.156.4・migration 471）: 「AMDの稼ぎ方」→「AMDの報酬形態」（まさ「下品なので」）。CX の PJの定義を登録（業務委託料2件・株式・先方の窓口）。
- データ（migration 472）: 技術台帳の「稼ぎ方」「稼ぐ」→「収益モデル」「収益を得る」（SOL 2記事・LiSTie 1か所）。
- 途中で捨てた案: 保存時の禁止語リスト（DBトリガーの正規表現）。まさ「リストアップした単語だけ止めるっていう設計の意図が全然分からん」で取り下げ、入口の数で止める設計に変更。
- 検証: tsc・関連契約検査・next build、本番でCX/ZMP/愛媛大学/AMD本体のPJ概要、CX会社概要、Venture Map、SOL競合比較を確認。

## 2026-10-06 資本政策表のエラー修正・配布検収

最終検収: v3.159.25は通常deployでReady（2分5秒）、公開build-infoはSHA369f2923024f26a23cae63f1cc61c20f8f8a6451/main/dirty=false。最終ソースのlocal production buildも627ページ・Function容量ゲート成功。本番SOLの資本政策表は旧常設文言なし、エラー3→2件（同じ割当不足を統合）。割当カード→シリーズAの詳細設定を開いて+割当追加へフォーカス、調達条件カード→計算基準へフォーカスをChromeで確認。本番の値・割当・保存・提出版確定操作は行っていない。前セッションの未追跡メモのみ保持。

メタ説明の監査はspec/audits/ui-meta-copy-20261006.md（PWA33/iOS1/Mac128候補）。他画面の文言は未削除。

## 2026-10-06 SOL資本政策の既存保存経路を検証

計画条件と採用根拠は /Users/masa/projects/AMD/SOL/IYOGIN_FINANCING_MATERIALS.md の「シリーズAのOS反映」が正本。既存本番UIと自動保存APIでrevision8→16。DB読戻し・画面再読込み・検証エラー0/警告0・提出可能を確認。提出版の確定は未実行。株主一覧と他イベントの入力条件の不変を検査し、派生値のみ再計算。追加のコード・スキーマ・配布変更なし。


## 2026-10-06 左ナビ・複数タブ・DD資料目録・組織図の完了記録
仕事種別:開発。全体メニューを≡へ収納、3スペースを並列左ナビへ移動、ホームのPJリンクを別タブへ。DDを資料名の目録へ揃え、資本政策表/株主名簿/次回タームシートを分離、経営陣略歴と従業員名簿を分離し後者はDDへ出さない。定款・規程類等を含む33資料。調査根拠はspec5-17に保存済み。
タブ題名にPJ・領域・ページと選択印を反映。青灰色の非選択枠と白い選択タブへ変更。共通組織図の縦型ひな形をe46751a7/v3.160.2で追加。後続の登録組織図は別作業のHANDOFF_ORGANIZATION_CHART_20261006.mdを参照。
左ナビを28px・上下4px、全幅ホバー#dbe9f5・選択中#cde4f7へ変更（245cc242、同期後fbfa8056/v3.160.5）。共有dirtyを保持してmainの使い捨てclean cloneから正規deploy。後続mainを正規checkoutへ統合しcloneを除去。
本番ワークスペースでは全体button44pxが下段に勝つ問題を発見。PC.menu .rowを優先した17d15894/v3.160.7を正規deploy、5分47秒で成功。公開SHA一致、実画面と表示中19行の28px計測を確認。ローカル共通部品だけの判断を改めた経緯はBUGSへ保存。
検証:test:critical-uiと配布ゲート成功、PC ChromeでDD/コックピットのホバーとワークスペースの行高を確認。PWA=PC、スマホ=Swiftというまさの指定後はPCのみ確認。環境変数・鍵・schema・モデル・Nativeの追加変更なし。一時preview route/server/tab/clone除去済み。証跡はignored .jez/artifacts。
恒久仕様spec2-1/2-7/3-23/3-24/5-17、manual2-1と附則、共通DESIGN/FEATURE_REGISTRYへ反映済み。専用引き継ぎは../../HANDOFF_PROJECT_NAV_20261006.md、再開文は../../SESSION_MIGRATION_PROMPT.md。旧資本政策プロンプトを内容不変で別名保持。旧タスク報酬の未追跡メモは前担当の判断待ちとして保護し、本タスクに混ぜない。

## 2026-10-06 SOL 経営陣略歴
まさの依頼により、公式プロフィールから略歴を登録。DD teamの共通本文と認可後loaderを接続。project_config既存表を利用。公開や閲覧権限の変更なし。Swiftの略歴表示は未移植。

### SOL経営陣略歴の検証・結了（2026-10-06）
実装4a7f56cc、本番v3.160.15をbuild-infoとChrome PC画面で確認。登録値はDB読み戻しで完全一致。プロフィール1名、学歴職歴29行、受賞8件。本文領域1148pxで横溢れなし。型検査、変更箇所lint、test:dd-package、登録値/未登録/不正形式のparser検査、本番反映ゲート成功。マニュアル2-6とdb_schemaに登録/表示の説明を補完。新規API・環境変数・表・権限変更はない。Swift未移植。個人の略歴内容と素材はSOL_DD_CONTENTS_PLAN.md参照。

## 2026-10-06 ドライブURL常時表示・高密度一覧・見出し縮小の結了

仕事種別:開発。URLコピー20f968b5/v3.160.8、常時表示と全フォルダ一覧dd4e6e56/v3.160.9、見出し456a0350・統合8d2816aa/v3.160.12を正規deploy.shで配信した。Readyとbuild-infoのSHA一致を確認。Chromeの実ファイルURLをコピーしネイティブ貼付で完全一致を確認した。PC実測ファイル65px、フォルダ49px、見出し87→46px、タイトル20px・移動ボタン28px。狭い幅の44px操作領域は保持。

初案は「URLを表示」ダイアログで、利用者から常時表示を求められたため一覧へ出した。フォルダを逐次開く初期表示も全フォルダのファイル一覧に変更。所属フォルダ・URL・操作を同時に見せる。コピー失敗時のみ手動選択へ案内し、期限付き署名URLは共有しない。

TypeScript、対象ESLint、workspace-documents-core、配布必須検査成功。workspace-documents-contractは既存routeの同名競合メッセージと検査文言の不一致で失敗（本変更ではAPIを変更せず）。操作検証と区別して記録する。仕様3-8/3-16/附則、manual2-3/附則、FEATURE_REGISTRY・ios/DESIGNを同期。新規schema・環境変数・認可・理論変更なし、NativeUI未移植。

専用引き継ぎは../../HANDOFF_DRIVE_20261006.md、再開文../../SESSION_MIGRATION_PROMPT_DRIVE_20261006.md。前の汎用再開文は内容不変で別名保全。共有checkoutの別担当差分を混ぜずmainのclean cloneを使用。旧タスク報酬の未追跡メモは前担当の現行照合待ちで保護。今回の検証に使った一時clone・ログは成果がmainに含まれることを確認後に除去する。closeout時の本番v3.160.15/6e1f408aは本変更を含むが別担当の後続配信は進行中。

## 2026-10-06 DD左メニューの分類・幅・視認性改善
仕事種別: 開発。まさの案了承により技術開発と製造を統合し、33資料を7分類へ。6つの開閉見出しは初期全展開、開示資料は下部常設。af482837で実装。155dc6c1/v3.160.13でDDのみPC幅240→200px、間隔12px・内側8px、灰色背景・境界・現在地表示、短い字下げへ。資料名を省略せず折返し、検索は閉じた分類も横断し解除時に元の状態へ。スマホdrawer264px、44pxタップ領域を確認。
新規ファイルなし。DD_NAVIGATION_GROUPS、DdNavigation、ProjectSpaceLayoutの任意compact指定とDD呼出し、共通ナビCSSを変更。分類固定lockとDD検査契約を更新。test:dd-package、test:project-format、tsc --noEmit、production buildと正規配布ゲート成功。本番ChromeのPC/狭幅で幅、検索、開閉、選択移動を検証。参考はCarbonとAtlassian、根拠はspec5-17へ。DB/schema/権限/鍵/環境変数/model/Native変更なし。
最初の監視は他担当後続版に追い越されたため祖先関係と同一差分を確認し、自分の古い監視だけ停止。2回目は共有dirtyを保持して一時clean main cloneから正規deployし、Ready2分23秒、SHA155dc6c1を確認。clone除去済み。後続事業計画1e23112eは別担当。closeout本番読戻しv3.160.15/6e1f408a、main d0ece3c4/origin一致。後続配布を今回の未完了作業に含めない。
恒久仕様はspec5-17/3-24/附則、manual2-3/2-6/附則と共通DESIGNへ実装commitで同期済み。専用引き継ぎは[HANDOFF_DD_NAVIGATION_20261006.md](../../HANDOFF_DD_NAVIGATION_20261006.md)、再開文は[SESSION_MIGRATION_PROMPT.md](../../SESSION_MIGRATION_PROMPT.md)。旧Function Storage文を内容不変で保存。既存報酬移行メモは担当判断まで保護。会話の検討材料0件。

closeout文書の[skip ci] pushは後続1e23112eの未配布画面差分を保護するpre-pushに停止された。省略指定を外して通常pushへ修正。後続担当はさらに開発課題を実装中で、当該dirtyは担当継続として保護。


## 2026-10-06 いよぎんNDA登録と契約リストの密度修正
仕事種別:開発。a47660bdで既存p21契約へ先方受領版・変更履歴付き修正案の2版と確認済み4履歴を登録。データ登録484は適用済み。新しい表・カラム・環境変数・APIキー・権限の追加なし。署名待ち・未締結、期間未確認を保持。
初期の一覧下へ全契約の文書・履歴を縦積みする案は、数十件への増加と情報密度の指摘で撤去。1e85e608/v3.160.14で1契約1行、検索・状態絞り込み・並び順、選択契約だけの表モーダルへ変更。project-contract-list-view.ts追加、既存contract-list GETへ認可済みcontractId/日時+IDカーソルの詳細取得を追加。初期は最新版のみ、履歴20件ずつ。同時刻のID順も安定化。DDは追加文書・メール経緯を取得しない。
検証:test:project-contract-list、tsc、production build、deploy.shゲート成功。ローカル60契約×60履歴の検索と20→40→60件追加、実loader同時刻60履歴の欠落・重複ゼロ。PC本番で2版・4履歴を確認。390px幅も検証。一時mock/preview3ファイルとdev serverを除去。証跡はCodex visualizations/2026/10/06/01a110c7-3254-7d63-a9b0-6157d2af9d19。
共通AGENTS.common.md:152へ余白カード反復の絶対禁止を保存・readback。恒久仕様spec5-6/5-17/5-10、manual2-3/2-6、DESIGN、changelogへ反映済み。Swift未移植。再開文はroot SESSION_MIGRATION_PROMPT.md、最終引き継ぎはroot HANDOFF_CONTRACT_EVIDENCE_20261006.md。旧pwa/HANDOFFは実装時記録で、最終状態はrootを読む。
closeout時は他担当の財務/DD差分とremote更新が重なりff-onlyが拒否されたため、共有dirtyを保持して最新mainの一時clean cloneで文書のみ保存。今回の実装はmain祖先、公開本番は後続v3.160.15/4a7f56ccでdirty:falseを確認。個人特性の対話証拠は0件。

## 2026-10-06 SOL DD製品説明資料の初稿

仕事種別: 開発。まさが合意した構成で本文7節・工程図2件を作成し、既存project_configのp21/product_descriptionへ1行登録。装置・継続供給・排水処理・金属回収に加え、出荷待ち在庫シアノが脂質を分泌して燃料原料を生産する開発構想を記載。研究報告、製品構想、残る実証条件を区別。DD認可後にPJとkeyを限定して取得する共通表示を既存入口へ接続。未登録の空状態を維持。
型検査、対象lint、DD回帰、production build成功。DB本文完全一致（SHA256 5fb3e4fe5ca23b31e53231dbfddff34e96e68adb4e8578be5758b419c0089d27）、他のp21設定3件とパッケージ状態の不変を確認。スキーマ・RLS・公開設定・DD付与・正式PDFは追加変更なし。Swift未移植。配布とPC Chromeの表示検証を続ける。引き継ぎHANDOFF_SOL_DD_PRODUCT_20261006.md。

初回配信c9193b78/v3.160.19は2分52秒でalias SHA一致。Chrome実画面でMermaidラベルの文字切れを発見。本文のp全子孫指定がSVG内pへ14px/28pxを適用し、図の12px/18px計測（2行枠36px）と不一致。本文直下のpだけへ限定して修正し、図の寸法と文字寸法の一致を最終確認する。登録本文は変更しない。

最終確認: df52e6d2/v3.160.20を正規配布し3分5秒で本番alias SHA一致。Chrome PC1392×824、本文幅960px、本文7節・表5件・SVG工程図2件。図14ラベルの文字寸法と枠寸法を測り文字切れ0、ページ全体の横溢れ0を確認。全体・設置運用・顧客判断条件・燃料生産・製品化の表を実画面で検証し、視覚評価8.5/10。PCのみというSOL指定に従いモバイル検証を追加しない。本文登録値・既存p21設定3件・DDパッケージ状態を最終readbackで再確認して不変。
Drive原稿は共有ARMADA/p21_sol/261006_製品説明資料/製品説明資料_初稿.md、file id 1eGmxBWcJYtBmecQIPsxH9S6j-9Z3gfOi。クラウド側メタデータで同名・10163bytes・親フォルダを確認し同期済み。証跡はSOL/work/amie_dd_product_20261006のDB receipt・build/deploy logs・browser-geometry.json・product-after.jpg・product-fuel.jpg。初稿作成の未完了作業なし。

## 2026-10-06 SOL採用写真と工程比較図

まさの明示採用により外観v2と工程比較図v1を製品説明資料の冒頭へ掲載。画像は生成物の画素を加工せず同一バイトで配置。一般的な凝集沈殿・汚泥脱水とSOLリアクター・菌体回収・金属精製を上下に比較し、前後処理と開発構想表示を残す。一次出所は栗田工業の凝集沈殿・汚泥処理解説。本文7節・5表・2Mermaid図は維持。当該PJ/keyの旧値一致条件で更新し、他設定・DDパッケージ・権限は追加変更しない。
共有mainの編集中に別担当のca62284aが先行したため、対象差分を保存し最新mainの一時clean cloneへ統合。別担当のIPOガント・コスト表示は維持し、版数をv3.160.23へ更新。本番反映後、DB一致・配信画像のバイト一致・Chrome PC実画面を確認する。

採用画像の最終確認: 13575f2c/v3.160.23を正規deploy.shで5分15秒で配信。公開alias SHA一致。旧値一致条件のSQLは1行更新、本文SHA256 c0073b115786eb55f04828da57b57485d3a99b00014623c17922854794aaf758。DB期待値完全一致、他のp21設定5件とDDパッケージ状態は不変。公開画像2枚は原画像とバイト一致。Chrome PC1392×824・本文幅960pxで画像2枚の読込と比率保持、上下比較図全体の文字と注記、7節・5表・2Mermaid図、横溢れなしを確認。UI評価8.5/10。原画像・生成メモ・更新原稿をDrive同フォルダへ保存しクラウド側の名前・サイズ・親を確認。原稿11063bytes。検証後に別担当の753bed6aが先行したので共有mainへff同期し保持。今回の依頼の未完了なし。最終引き継ぎはroot HANDOFF_SOL_DD_PRODUCT_MEDIA_20261006.md。
