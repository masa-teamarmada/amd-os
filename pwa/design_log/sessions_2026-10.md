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
