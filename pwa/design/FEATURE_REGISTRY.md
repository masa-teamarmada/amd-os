# PWA Feature Registry

AMD OS PWA の重要機能を、画面単位で「消してはいけない契約」として列挙する。

このファイルは実装の詳細仕様ではなく、回帰防止用の登録簿。画面・API・DBのいずれかから機能を削る場合は、同じ commit でこの登録を更新し、理由を残す。未更新のまま UI を削除しない。

## 運用ルール

- 新しい業務導線を追加したら、このファイルか該当 `pwa/design/*.md` に機能契約を残す。
- `design_log/` は作業ログであり正本ではない。恒久仕様は `pwa/design/` 配下へ入れる。
- `npm run test:critical-ui` は、この登録簿と実装内の重要 anchor を検査する。
- 重要 UI を置き換える場合は、旧 anchor を消す前に新 UI の anchor と仕様を登録する。

## /manual

目的: AMD OS の使い方・仕様・運用履歴の正本を、読み手が自力で検索し、必要ならページ限定つくよみに質問できる状態にする。

必須機能:

- 左カラム検索: `pwa/manual/*.md` から生成した `ManualSearchDocument` を使い、章タイトル / summary / 見出し / 本文 / 画面パス / テーブル名を横断検索する。検索結果は章番号・タイトル・抜粋・topic/screen chip を出し、該当 `/manual/[slug]` へ遷移できる。
- 章本文と目次の維持: `/manual` はセクション別目次、`/manual/[slug]` は本文 + 左目次を表示し、検索を使っても既存の `ManualMapClient` / `MarkdownView` 導線を消さない。
- ページ限定つくよみ: `ManualTsukuyomiFloat` は `/manual` と `/manual/[slug]` だけに出す。global layout の visible mascot を復活させない。
- Gemini Q&A: `POST /api/manual/tsukuyomi/ask` は `GEMINI_API_KEY` と `gemini-2.5-flash` で該当章のマニュアル本文を根拠に回答し、「ここ見たらOK」の参照章リンクを返す。DB 書き込み、PJ 修正 tool、`tsukuyomi_chat_logs` 保存は持たせない。

回帰防止:

- global `TsukuyomiChatBridge` は従来どおり invisible event bridge のまま。`Mascot.tsx` を `(app)/layout.tsx` に戻さない。
- マニュアル章の追加・削除・構成変更は `pwa/src/app/(app)/manual/manual-chapters.ts` と `pwa/design/os_manual.md`、必要なら `pwa/manual/9-3-appendix-changelog.md` を同じ作業単位で更新する。

## /knowledge-map

目的: 元素・鉱物・鉱石・樹脂・高分子を「材料 → 供給 → 用途 → AMDとの接点」で横断し、高校生でも世界の材料事情・研究テーマ・事業機会・供給リスクを数分で比較できる AMD Materials workspace として使う。従来の L2 / manual / spec / BZM ノウハウ地図も `材料マップ` tab に残す。

必須機能:

- read-only route: `/knowledge-map` は DB write、LLM 呼び出し、外部 NotebookLM 同期を行わない。
- materials lenses: `全体` / `元素` / `鉱物・鉱石` / `樹脂・高分子` / `材料マップ` / `比較` を切り替えられる。画面内の質問フォームや生成AI回答欄は持たない。
- periodic table: 118元素を周期表配置で表示し、`注目度` / `需要` / `供給不安` / `AMD相性` の4軸を切り替えられる。注目度は淡黄→黄→橙→赤→深紅の熱色で表示し、評価済みcellには平易な日本語の主用途を置く。供給不安4は`警戒`、5は`危機`をcell上端と供給警報帯に常時重ね、選択中のheat軸にかかわらず見落とさせない。周期表cell内に`4/5`等の数値は表示せず、評価値は初期の定性評価として根拠を併記し、未評価を低評価やゼロと混同させない。
- element insight: 評価済み元素cellを押すと、用途・供給警報・直近公表相場・5年価格推移・産出国構成を絞って示すmodalを即時表示する。`詳細を開く`で同じmodalを拡張し、評価理由、埋蔵・需給、循環・代替、AMD接点、sourceを追加表示する。相場は代表取引品目、単位、公表時点、非live値であることを明示する。世界生産が非公表の品目は輸入供給元等の代替指標であることを円グラフの注記に出す。
- ranking and navigation: `全体`の元素・鉱物・樹脂入口は矢印だけでなくカード全面を操作対象にする。総合値は独立した編集点を持たず、`注目度 + 需要 + 供給不安 + AMD相性` の4指標合計（20点満点）とする。周期表以外の全体ランキング、鉱物一覧、樹脂一覧、比較列は4指標合計の高い順に並べる。別に、全材料を横断する`需給の崩れランキング`を専用の偏りの強さ（5点満点）で並べる。不足だけでなく供給過剰と価格乱高下も区別し、原因、供給が詰まる工程、評価時点、確からしさを併記する。
- materials detail: 重要元素、代表的な鉱物・鉱石、代表的な樹脂・高分子は、項目を押した直後に要点の小窓を開き、特徴、用途、需給の向き・原因、供給国を示す。`詳細を開く`で同じ小窓を拡張し、埋蔵・供給、代替・循環性、材料の流れ、AMDとの接点、出典リンクを読める。本文と固定ラベルは高校生が辞書なしで読める自然な日本語を原則とし、化学記号や業界略称は日本語の説明を添える。樹脂は追加で、何を原料に、どの重合・重縮合・硬化等の工程で作るかを平易な日本語で示す。
- compare: familyを跨いで2〜4件を比較trayへ追加し、同じ評価軸と用途・供給・循環性・AMD相性を並べて見られる。
- data sources: `protocols` / `project_knowledge` / `member_knowledge` / `project_meeting_summaries` / `project_strategy_signals` / `project_xrl_evidence` / `monthly_reports` / `textbook_insight_candidates` の件数と直近代表 row を読む。
- graph controls: 検索、domain filter、expand/collapse、zoom、node detail panel、source route link を持つ。
- source hygiene: メール全文、Slack全文、議事録全文、資料全文を fetch / 保存 / 表示しない。短い L2 text、summary、source ref、status だけを使う。
- source discipline: 市況・埋蔵量・生産国・需給は source と評価時点を示す。精密値を持たない初期版では、推測値を実測値のように表示しない。

回帰防止:

- `/knowledge-map` route、GlobalNav 導線、materials workspace、118元素の周期表、比較tray、`KnowledgeMapView`、`fetchKnowledgeMapData` を消す変更は、`FEATURE_REGISTRY.md`、`/spec/2-1`、`/spec/2-2`、manual 2-5 を同時に更新する。
- NotebookLM export を追加するときも、OS 側が正本で、NotebookLM はコピー先という境界を崩さない。

## /business-cards

目的: スマホで受け取った名刺を撮影し、OCR候補を人が確認してPJへ紐付け、連絡先台帳とPJナレッジを同時に育てる。

必須機能:

- GlobalNav: 動かすグループに `名刺` と `/business-cards` を置く。
- iOS tab: `MainTabView` は旧 `月次ルーティン` tabを出さず、`PJ進捗 / 名刺 / 設定` の順で `BusinessCardsView` を置く。native shell は `/native/business-cards` を使う。
- mobile capture: カメラ起動 (`capture="environment"`) と写真ライブラリ選択を持ち、送信前に長辺1800px目安へ縮小する。
- review gate: OCR結果を自動確定しない。`processing` → `needs_review` または `ocr_failed` に止め、氏名と1件以上のPJを人が確認した PATCH だけ `confirmed` にする。
- PJ link: 複数PJを選択でき、確定時に `business_card_project_links` と `project_knowledge(category='people', source='business_card', status='active')` を同期する。
- private boundary: 画像は private Storage `business-cards` に置き、認証済みAMDメンバー向け image route だけで読む。email / phone / address / 画像 / raw OCR は `project_knowledge` に複製しない。
- prompt management: OCR prompt は `llm_prompts.prompt_key='business_card.ocr'` を正本にし、コードへ本文を直書きしない。
- recovery: OCR失敗でも画像と名刺行を残し、手入力して確定できる。

回帰防止:

- `pwa/scripts/check_pwa_critical_ui.cjs` が route、GlobalNav、iOS tab順 / 旧月次ルーティンtab不在、カメラ入力、確認ボタン、PJ複数選択、private image route、OCR prompt migration、D-3同期を検査する。
- この導線を削除・薄くする変更は、`/spec/2-5`、manual 2-8、`/spec/2-1`、`/spec/2-2`、D-3 current spec を同時に更新する。

## /poc

目的: Seeds の研究シーズとPoC先を一次入力として持ち、その掛け合わせからヒアリング論点、PoC条件、謝礼、契約、資金、収益分配まで案件化する。

必須機能:

- GlobalNav: 探索グループに `PoC` と `/poc` を置く。Seedsの下流にある案件化棚なので、Admin配下へ移さない。
- data sources: `seeds` / `poc_companies` / `poc_matches` / `projects` / `members` を読む。`seeds` は研究シーズ正本として再利用し、PoC固有のPoC先・条件・質問は `poc_*` に置く。
- source hygiene: Notion議事録、Gmail、Slack、Drive、Web本文やURLを保存・表示しない。`source_ref` / `source_note` は短い参照名だけにする。
- add seed: シーズ名、機関、地域、PI/研究者、領域、用途・業界タグ、キーワード、概要、担当、状態、次アクションを `seeds` に保存できる。
- add PoC destination: PoC先名、規模感、地域、業界タグ、PoC相性、過去PoC/紹介経路、謝礼、担当、状態、次アクションを `poc_companies` に保存できる。
- PoC destination list: PoC先を比較表で表示し、業界タグ、地域、規模感、状態、PoC相性、謝礼・履歴、案件数、次アクションを横並びで比較できる。業界タグ、地域、規模感、状態などのタグで候補先を絞り込める。
- pairing queue: シーズごとに既存案件と上位PoC先候補を並べ、候補の `案件化` で相性仮説・ヒアリング論点・PoC条件の初期案を `poc_matches` に生成できる。
- inline status: 案件候補とPoC先の状態は一覧上で更新できる。

回帰防止:

- `pwa/scripts/check_pwa_critical_ui.cjs` が `/poc` route、GlobalNav導線、`seeds` / `poc_companies` / `poc_matches` data access、シーズ追加、PoC先追加、PoC先候補リスト、案件化キューを検査する。
- `/poc` を消す/薄くする変更は、`poc_matching.md`、`SPEC_pwa.md`、manual 2-5 / 5-1、`/spec/2-1` を同時に更新する。

## /admin/japanese-culture-map

目的: 日本文化コンテンツを admin 側の知識ビューとして読み、`jp_culture_items` をマインドマップと日本地図で俯瞰する。

必須機能:

- admin-only route: 実画面は `/admin/japanese-culture-map` に置き、`/admin` layout の admin gate を通す。通常の資料ナビと共通左サイドナビの Admin group からは外し、admin 画面内の `AdminSidebar` にだけ置く。
- read-only view: 画面は `jp_culture_items.status='active'` を読み、DB write、LLM 呼び出し、外部同期を行わない。
- 2 view: 大分類→中分類→アイテムのマインドマップと、都道府県→市区町村の日本地図を切り替えられる。
- legacy redirect: 旧 `/japanese-culture-map` はブックマーク互換だけ残し、`/admin/japanese-culture-map` へ redirect する。

回帰防止:

- GlobalNav の一般「資料」グループや共通 Admin group へ戻さない。導線は `AdminSidebar` にだけ置く。
- `pwa/scripts/check_pwa_critical_ui.cjs` は `GlobalNav.tsx` に `日本文化` / `/admin/japanese-culture-map` / `/japanese-culture-map` が戻ったら落とす。
- route を消す変更は、`FEATURE_REGISTRY.md`、`/spec/2-1`、`/spec/2-2`、manual 2-6、`design/os_manual.md` を同時に更新する。

## /admin/* shell

目的: admin 業務画面では admin 専用メニューと本文だけを表示し、通常の共通メニューと admin メニューが横に二重表示される状態を作らない。

必須機能:

- menu replacement: `AppShell` がブラウザ側の現在 pathname を見て、`/admin/*` では `GlobalNav` の代わりに `AdminSidebar` を同じ左端へ表示する。ダッシュボードから画面内リンクで admin へ移動しても通常メニューを残さない。
- single sidebar: `(app)/admin/layout.tsx` は admin 権限 gate と本文余白だけを持ち、`AdminSidebar` を追加描画しない。
- exit: `AdminSidebar` の先頭から `/dashboard` へ戻れ、現在の build version も確認できる。
- width: admin 本文は単一サイドバーの残り幅を使う。二重サイドバーや入れ子の横レイアウトで業務表を圧迫しない。
- mobile: 狭い画面では48pxの操作レールだけを残し、adminメニューは開閉式のdrawerにする。常時192px幅で本文を圧迫しない。

回帰防止:

- `pwa/scripts/check_pwa_critical_ui.cjs` が `AppShell` の menu replacement と、admin layout に `AdminSidebar` が無いことを検査する。

## /admin/contracts

目的: admin が、AMDと各PJの契約関係を「1行 = 1契約」で追い、契約書を開かずに期間・金額・支払・業務範囲・成果物・費用負担・知財・利用・秘密保持・再委託・解除・責任・押印証跡を確認する。

必須機能:

- 対象境界: 主台帳は `relationship_scope='amd_contract'` のみ。AMD以外の当事者間契約、雛形、当事者未確認の自動候補は隔離し、AMDという文字列だけで昇格させない。
- 契約台帳: Drive folder、MTG、議事録、版違い、形式違いを行として混ぜず、1契約1行で状態・期間・金額/支払・業務/成果物・費用/報告・権利/制限/リスクを比較できる。
- 契約同一性: `canonical_contract_id` で同じ契約の既存記録を結ぶ。移行前だけ契約名から作業語を除いた候補で暫定集約し、送付確認・微修正・DocuSign依頼は契約詳細の関連記録として読む。
- 実務条件モーダル: 行を開くとモーダルを表示し、契約当事者・状態/押印・PJ反映を先頭に、期間/更新、金額/支払、業務/成果物、費用負担、知財/利用、秘密保持/制限、解除/責任、文書/根拠を確認できる。文書と版、関連記録は別タブに分ける。
- PJ反映: `is_current_for_project=true` の契約を `projects.contract_terms_json.currentContracts[]` へ契約ID単位で同期し、各PJコックピットの「現行・進行中の契約条件」に表示する。複数契約の条件は混ぜない。
- 幅: 台帳は本文の利用可能幅をすべて使う。狭い画面は押し潰した表や横スクロールにせず、契約ごとの要約表示へ切り替える。
- 固定列: 一番左を PJ、次を契約名とし、この2列は横スクロール中も左に固定する。
- evidence boundary: 契約書ファイル、修正案、押印版、会議上の言及は `contract_documents` / `contract_signals` / `contract_terms` の証跡として扱い、台帳行を水増ししない。

回帰防止:

- `pwa/scripts/check_pwa_critical_ui.cjs` が台帳の最低幅、PJ → 契約名の列順、2列の固定表示、AMD当事者境界、1契約1行、実務条件モーダル、PJコックピット反映の実装アンカーを検査する。
- 表示境界を変える時は、`/spec/5-6` と manual 6-7 を同時に更新する。

## /admin/invoices

目的: admin/きよが、締め済み稼働月の請求書発行を上から処理する。旧 `/admin/billing` は廃止済みで、互換のため `/admin/invoices` へ redirect する。

必須機能:

- 左メニュー導線: AdminSidebar には `請求書発行` と `/admin/invoices` を置く。`Billing` 表記へ戻さない。
- 発行キュー: 直近13か月の締め済み稼働月 (= 現月は含めず前月まで) の `billing_cycles` と `projects.status IN ('active','ended','frozen')` を読む。発行対象は `start_ym` 以降、`end_ym` 以前、`freeze_from_ym` より前、かつ請求額がある行だけ。未来月、請求額ゼロ、請求しないPJ、期間外の空cycleは出さない。
- filter: 初期表示は `未完了` (= `発行待ち / 要確認 / 設定不足 / 過去滞留`)。きよの作業順に `未完了 / 発行待ち / 要確認 / 設定不足 / 過去滞留 / 発行済み / 送付済み / 入金済み / すべて` を置く。`発行待ち` は対象月でそのまま押せるもの、`要確認` は対象月の請求額が読めないもの、`設定不足` は対象月の freee取引先未設定など OS 設定で止まるもの、`過去滞留` は請求月 (`invoice_ym || ym`) が対象月より古い未発行行。稼働月が古くても請求月が対象月なら滞留扱いにしない。
- 発行条件: 各行には `取引先 / 金額` の完了状態だけを小さく表示する。報告書FIXと立替精算は請求書発行の blocker にしない。`支払通知 / 報酬支払` など、請求書発行と直接関係しない全ステップ横並び chip を主画面に戻さない。
- 状態クリック: `要確認 / 設定不足 / 過去滞留` の状態バッジまたは行操作を押すと詳細モーダルを開き、`freee取引先 / 請求額` の発行前チェックを、何を直せば解消するかの説明つきで出す。`設定不足` では freee取引先をプルダウンで選択して保存でき、保存後は同じ請求先の未発行行を再判定する。
- 請求書発行: `発行待ち` 行の主操作にだけ `発行` / `請求書を発行` ボタンを置き、`AdminInvoiceIssueDialog` から `issue-invoice` Edge Function を呼ぶ。単なる `invoice_issued_at` 手動更新で発行済みに見せない。
- 発行モーダル: iOS `InvoiceStepView` / 旧 GAS `cpOpenInvoiceModal` と同じ発行仕様を維持する。件名、基本明細行、契約月額との差分確認、前月明細引き継ぎ、承認済み立替の読み取り専用明細、調整行、請求日、支払期日、備考、発行済み情報、発行取消を出す。件名とヘッダーは `client_name` を使い、`project_name` / `project_id` など AMD 内部呼称を請求書発行モーダルや freee 件名に出さない。単なる件名/日付/全行だけの薄いモーダルへ戻さない。
- 請求額表示: 明細合計 (`invoice_base_lines_json`) を最優先し、なければ確定請求額 (`budget_reported_amount`)、月額固定契約だけ `projects.fee_amount` へ fallback する。PJ 予算 (`budget_yen`) は AMD 側の原資/報酬予算なので、請求発生判定や請求額 fallback に使わない。
- 幅: admin 業務表として列幅を保ち、狭い画面では表本体を横スクロールさせる。列を圧縮して文字やボタンを重ねない。
- 明細保存: 発行前に `invoice_base_lines_json` / `invoice_subject` を保存できる。発行後は `invoice_issued_at` / `freee_invoice_number` / `invoice_pdf_url` が `billing_cycles` に反映される。
- 互換: `/admin/billing` は画面を持たず `/admin/invoices` に redirect する。

回帰防止:

- `pwa/scripts/check_pwa_critical_ui.cjs` が `/admin/invoices` route、`/admin/billing` redirect、AdminSidebar 導線、`AdminInvoiceIssueQueue`、`FreeePartnerPicker`、`AdminInvoiceIssueDialog` の `基本明細行 / 立替精算 / 調整行 / 備考 / 発行を取り消す`、`issue-invoice` anchor を検査する。
- 旧 PM 月次 routine へ請求書発行を戻さない。請求書発行・送付は admin 業務のままにする。

## /monthly-agreement

目的: 月初に、本人が「何への合意か」「何を確認するか」を迷わず理解し、各PJの担当内容と予定額を対応づけて合意できるようにする。

必須機能:

- 状態の明示: ヘッダー直下に横幅いっぱいの状態欄を置き、`合意状態：未合意 / 条件更新あり / 合意済み / 対象外` のいずれかと、その理由を一文で表示する。状態値だけの `未確認` と、対象が曖昧な `確認不要` は使わない。
- 確認対象の明示: 状態欄の直下に `確認して合意する内容` を置き、`01 担当する仕事` と `02 その対価としての予定額` をそれぞれ独立した全幅セクションとして縦に並べる。`01` は全PJの担当内容、`02` は予定額合計と同じPJ順の内訳を表示する。契約上の必須事項を表の小見出しへ戻さず、必須領域では12px未満の文字を使わない。
- 操作順序: `確認して合意` は全PJの確認内容より後ろに置く。`修正要望` は隣の副操作から必要なときだけ開く。合意済み / 対象外では主ボタンを状態表示へ切り替える。
- 参考情報: 支払い状況、予定額の根拠、snapshot ID、PJ詳細は、合意操作より後ろの初期状態で閉じた `参考情報` にまとめる。
- 回帰確認: `320 / 375 / 768 / 1280px` で横overflowがないことに加え、5秒で `01` と `02` の位置と内容を指せること、縮小表示でも状態→`01`→`02`→主操作の順序が判別できることを完了条件にする。
- 強制表示: 背景クリックで一時的に閉じても合意状態は保存しない。未合意のまま再入場した場合は再表示する。

回帰防止:

- `pwa/scripts/check_pwa_critical_ui.cjs` が状態接頭辞、4状態、確認する2点、各PJ内の担当内容と予定額、主操作より前に確認領域があること、参考情報の折りたたみ、修正要望の開閉を検査する。
- `320 / 375 / 768 / 1280px` で document の横overflow、状態欄の圧縮、別PJをまたいだ確認項目の並び替わりを認めない。

## /admin/finance

目的: 法人の支払義務を出金前から一元管理し、きよへのSlack通知と月次資金繰りを同じ正本から動かす。

必須機能:

- 支払義務台帳: `company_payment_obligations` を正本に、金額・期日未確認の候補も `needs_review` で保持する。
- 自動収集: 継続支払い、承認済み経費、報酬通知、finance/tax系 action item、active admin + info Gmail を日次同期する。
- 二重計上防止: 各義務に `additive` / `included_in_budget` を持たせ、追加流出だけ月次CFとcashを減らす。
- きよ通知: `members.code_name='きよ'` を動的に解決し、期限前・当日・期限超過・要確認をDMする。通知履歴の一意制約で同じ段階をexact-onceにする。
- 管理操作: `/admin/finance#payment-obligations` で作成・修正・支払済み更新ができる。継続支払い・領収イベントの既存機能は維持する。
- 月次表示: `/management-score` の月次試算表に展開可能な `支払義務` 行を置き、支払内容、期日、金額状態、予算内/追加流出を表示する。

正本仕様: [`pwa/manual/6-9-company-payment-obligations-spec.md`](../manual/6-9-company-payment-obligations-spec.md)

## /admin/payouts

目的: 支払月単位で、対象cycleの報酬確認、PJ別収支確認、支払データ同期状態、支払通知書発行、入金確認nudgeを一画面で運用する。

必須機能:

- 支払月選択: `ym=YYYYMM` でメンバー支払月を選び、稼働月 `billing_cycles.ym` を `/admin/projects` の `projects.payment_due_rule` / `payment_due_day` で集約する。`billing_cycles.invoice_ym` はクライアント請求月なので、メンバー支払月判定には使わない。
- 高速初期表示: 通常GETは `billing_cycles.reward_summary_json` の報酬キャッシュを読むだけにする。毎回 `syncRewardSummariesForBillingCycles()` を再計算しない。先12か月の capped 投影 (`forecastCapped`) も `forecastCycles.reward_summary_json` から集計し、画面を開いただけで全PJの `computeForwardCappedMemberCosts()` を走らせない。
- SSR初回データ: `/admin/payouts` page は `loadTargetData(currentYm, { includeAgreementGate: false })` をサーバー側で実行し、`AdminPayoutsClient initialData` へ渡す。初回 client GET を省き、月変更・手動再計算・write後の再取得だけ `/api/admin/payouts` を使う。
- 月初合意gateの後追い表示: 初期表示GETは支払データ本体を先に返し、月初合意gateは `gateOnly=1` の別GETで後追い取得する。保存・発行・送付などのwrite actionではサーバー側gateを必ず実行する。
- 報酬キャッシュ再計算: 明示的な「報酬キャッシュ再計算」操作または保存系処理だけが `refreshRewards=1` / `refreshRewards: true` で再計算する。
- 0円キャッシュ: 報酬対象メンバーがいない月も `reward_summary_json.members=[]` の0円キャッシュとして保存し、`forecastCapped` では key 有りの0円として扱う。`null` の未計算扱いにして budget fallback へ落とさない。
- 報酬キャッシュ日次更新: `payout-reward-cache-refresh` cron が毎日03:05 JSTに、前月 + 当月から先12か月のメンバー支払月、および同じ窓内の稼働月について `billing_cycles.reward_summary_json` を再生成する。支払月対象は `projects.payment_due_rule` / `payment_due_day` で判定し、`billing_cycles.invoice_ym` は使わない。手動で `ym=YYYYMM&lookahead=11` を付けると、指定月から先12か月のキャッシュを作れる。
- 予定担当比率のみ: 報酬計算は MS の期間按分で当月消化ptを出し、`milestone_responsibility.share` で分配する。活動ログ由来の実績配分や手入力報酬 override は使わない。
- 支払額の同期: 画面の支払額・PDF生成の元データは、最新の `billing_cycles.reward_summary_json` から計算した値を正にする。`monthly_reward_payout.total_pay` と `payout_notices.total_yen` は保存済み額で表示値を固定するためではなく、夜間の先回り生成または正式PDF発行時に同期される税抜スナップショットとして扱う。`/admin/payouts` を開いただけでは保存しない。送付操作は同期・PDF生成を行わず、保存済み正式PDFが最新DBと一致するかだけを照合する。
- 月初合意支払gate: `member × 稼働月 × PJ` で未合意 / 条件更新あり / 修正要望中を server-side に止める。2026年6月以前の稼働月 (`source_ym <= 202606`) は導入前/移行月として gate 上 `合意済` 扱いにし、2026年7月以降から通常判定にする。6月は契約改定前かつシステム未完成期間だったため、合意条件として支払いを止めない。移行月だけで blocker が無い場合、admin UI は個別メンバー一覧ではなく「対象支払行 / 移行月スキップ / blocker 0」の summary を表示する。
- 縦型PJ収支表: 「全体収支」列とPJ列を並べ、クライアント支払、バッファ、本契約cap、本契約支払、別財布支払、役員分、役員相殺、本契約残り、メンバー別支払を確認できる。
- 先12か月 目的別4表 + メンバー別支払予定: `/admin/payouts` と `/management-score` 下部表の両方で、先12か月を `先12か月 キャッシュ支払` / `先12か月 会社留保` / `先12か月 報酬債務` / `先12か月 cap超過チェック` の4表に分ける。会社留保を支出扱いしない。会社留保は `cap/売上枠 - 外部支払` として読む。報酬債務は外部メンバーへの月末残高なので12か月分を足さず、各月残・ピーク・最終月残で見る。役員の未充当繰越は会社留保側の内部検算に寄せ、報酬債務には混ぜない。cap超過チェックだけが `報酬需要 - cap/売上枠` を見る。`/admin/payouts` には、行=非役員・支払対象メンバー、列=稼働月の `先12か月 メンバー別支払予定` 表も置き、セルクリックで PJ 別 `totalPay` / 本契約 / 別財布 / 発生額 / pt / 未払い残を確認できる。
- 手入力予算確定なし: `/admin/payouts` では請求額や追加支払枠を手入力して `billing_cycles.budget_yen` を書き換えない。契約から解ける通常capと、MSタグから解ける別財布発生だけを表示する。
- 別財布支払: ZMP のような月額固定PJは通常枠を `fee_amount × 65%` に保ち、OkuDoor追加開発など追加受託分は `tag='cap_extra'` のMSとして `extraBasePay` / `extraPaidYen` / `extraCompanyReserveYen` に分ける。画面上で `本契約発生` / `別財布発生` / `別財布使用` を別表示する。
- 支払データ同期: `payout-notice-prebuild` cron と正式な発行 action が、`monthly_reward_payout` に明細、`payout_notices.total_yen` にメンバー別通知額を税抜で保存する。cron は同期後に正式PDFまで先回り生成し、画面表示中の自動POSTは行わない。開きっぱなしの画面は 60 秒ごとに read-only 再取得し、同期状態だけ追随する。役員または `exclude_from_payout_notice` のメンバーは通知対象外にする。保存時点ではメール送信せず、金額が変わった未送付PDF、現行テンプレート更新時刻より古い未送付PDF、または `members.updated_at` より古い未送付PDFを再生成対象へ戻す。最新支払計算に対応する明細が無い未送付 `payout_notices` は孤立レコードとして削除する。送付済み通知書は `force=true` でも上書きしない。通常の差分は発行時に自動同期するため状態バッジを出さず、月初合意gate・本契約cap blocker がある場合だけ `同期できない` と表示し、admin override または blocker 解消を待つ。
- メンバー別支払の税区分: `メンバー別支払` / 月初合意 gate / 先12か月メンバー別支払予定の詳細で、`支払額` は税抜と税込を併記する。DB (`monthly_reward_payout.total_pay` / `payout_notices.total_yen`) は税抜を保存し、GAS PDF生成時に消費税10%を上乗せする。
- 支払通知書発行: `メンバー別支払` は admin/payouts の主作業表なので、サマリ直下・報酬債務台帳より上に置く。「メンバー別支払」行に `支払通知書発行` / `PDF確認` / `送付` の3操作を置き、見出しにも `全員分PDF一括発行` / `確認用PDF生成` / `強制再発行` を置く。行の `PDF確認` は保存済み正式PDFを開くだけで、PDF生成は行わない。PDF未生成またはメンバー台帳更新後で古い場合は先に `支払通知書発行` / `強制再発行` で正式PDFを作り直す。`確認用PDF生成` は `PREVIEW-...` の確認用PDFを作るが、`payout_notices` には保存しない。`payout-notice-prebuild` は支払データ同期後に正式PDFを事前生成する。正式な個別 `支払通知書発行` と全員分PDF一括発行は、サーバー側で最新計算額を同期し、その後 DB を再読込して最新の `members.contractor_name` / `member_address` / `invoice_registration_number` を使ってから `payout_notices.notice_no` / `pdf_url` を保存する。`強制再発行` は金額差分が無くても最新メンバー台帳と現行テンプレートで作り直す。一括PDF生成で失敗または強制再発行なのに未送付PDFが未再生成になった場合は `ok: false` として画面に失敗を出す。`送付` はPDF生成・再生成を行わず、保存済み正式PDFが最新DBと一致し、確認用PDFではなく、未送付である場合だけ確認モーダルを開く。確認モーダルの `はい・送信` は保存済み正式PDFを添付して `keiri@team-armada.jp` から実メール送信し、成功後に `sent_at` を保存する。PDF URLの手入力欄は置かない。
- 支払通知書PDFフォーマット: 正本は `gas/064_PayoutFreeeNotice.js` の `payoutBuildNoticePdfBlob_`。2026-04改善版の白地・青アクセント・正本ロゴ画像フォーマットを維持する。admin/payouts の支払額 (`monthly_reward_payout.total_pay` / `payout_notices.total_yen`) は税抜として扱い、PDF上で消費税10%を上乗せして「お支払金額」「合計（税込）」に表示する。宛先は `members.contractor_name` (= 未設定時は `member_name` / `code_name`) と `members.member_address`、メンバー側インボイス登録番号は `members.invoice_registration_number` を使い、PDF上のラベルは宛先側・発行者側とも `登録番号` とする。発行者側の値には AMD のインボイス登録番号 (`T7021001064067`) を表示する。必須要素は、中央青見出し `支払通知書`、青ライン、右上右寄せの `作成日` / `通知書番号`、右端に揃えた公式ロゴ画像 (`PAYOUT_LOGO_FILE_ID` / `PAYOUT_LOGOTYPE_FILE_ID`) と会社名・住所・`登録番号`、「お支払金額」サマリbox、青ヘッダ明細表 (`摘要` / `数量` / `単価` / `金額`)、右寄せ合計 (`小計（税抜）` / `消費税（10%）` / `合計（税込）`)、`支払予定日` / `支払方法` / `備考`。PDFには振込先欄を出さない。旧GASの黒罫線フォーマット、テキストで作った `team ARMADA` ロゴ、PDF URL手入力欄へ戻さない。
- 入金確認nudge: `payment-confirm-nudges` を手動実行でき、Slack DMの `/payment-confirm` とつながる。
- 月次モーダル導線: cycle明細やPJ収支表の稼働月から `CockpitMonthlyModal` を開き、報酬根拠に戻れる。

回帰防止:

- `pwa/scripts/check_pwa_critical_ui.cjs` が `/admin/payouts` の支払通知書PDF確認、報酬キャッシュ、報酬キャッシュ日次cron、縦型PJ収支表、GAS側の改善版支払通知書PDFフォーマット anchor を検査する。
- `pwa/scripts/check_pwa_critical_ui.cjs` が `本契約発生` / `別財布発生` / `regularBasePay` / `extraBasePay` anchor も検査する。
- 支払通知書PDFの golden PNG は `pwa/scripts/__fixtures__/payout_notice_golden.png` (改善版フォーマットの 1 ページ目を PNG 化したもの) を正本とし、`pwa/scripts/__fixtures__/payout_notice_golden.png.sha256` に SHA256 を固定する。`npm run test:critical-ui` が golden の存在と SHA256 一致を検査し、 fixture が壊れていれば落ちる。
- 改善版PDFを意図的に更新したら、まさが新PNGを目視確認したうえで `payout_notice_golden.png` と `payout_notice_golden.png.sha256` を再生成して commit する。新規 PDF を PNG 化したファイルとの突合は `npm run test:payout-notice-pdf -- --diff <input.png>` で同じスクリプトを再利用する。
- この画面で UI を削る変更は、`FEATURE_REGISTRY.md` と `SPEC_pwa.md` を同時に更新する。

## /admin/kiyo

目的: きよ向けに、active PJ の月次の支払・立替精算・請求書送付確認を 1 画面で横断確認する read-only 台帳。

必須機能:

- 月選択: `ym=YYYYMM` で対象月を選ぶ。未指定時は JST の当月。
- メンバー支払額: `/admin/payouts` と同じ `loadTargetData(ym, { includeAgreementGate: false })` を使い、`expectedEntries` のうち active PJ の明細だけをメンバー別・PJ別に集計する。表示のために `syncRewardSummariesForBillingCycles()` を走らせない。
- 立替精算: 選択月の `reimbursements` を active PJ 行だけで表示し、`submitted` / `pmApproved` / `approved` / `billed_ym` を PM待ち / 経理待ち / 承認済 / 反映済に分ける。
- 請求書送付: active PJ の `billing_cycles.invoice_ym=ym`、または `invoice_ym IS NULL` の cycle を `projects.payment_due_rule` で支払月判定した対象cycleを集約する。`invoice_sent_at` は送付済み判定、`invoice_sent_by` または `billing_log` に `keiri@team-armada.jp` の証跡がある場合だけ `keiri確認` とする。
- 証跡境界: `invoice_sent_at` があっても keiri 証跡が無ければ `要確認` と表示する。送付元を断定しない。

回帰防止:

- `/admin/kiyo` は確認専用。支払保存、PDF生成、メール送信、立替承認、請求送付の write action を追加しない。
- active 以外のPJを表示しない。inactive / ended / frozen / sales / lost はこの画面の対象外。
- AdminSidebar の `きよ` 導線、`/admin/kiyo` route、keiri 証跡境界を消す変更は、`FEATURE_REGISTRY.md` と `SPEC_pwa.md` を同時に更新する。

## /admin/season-pl

目的: 1 PJ × 1 シーズン (plan cycle) ごとに「請求額がいくらで、内訳がどうで、差し引きどうなるか」を全 PJ で常時確認できる予実表。シーズン頭に「予算」を確定し、毎月の入金・支払で「実績」が埋まる。pt単価過大・未割当pt・cap/原資不整合 (ZMP)・役員 stock 非収束といった歪みを、まさが不安なく一目で検知できる安全網にする。設計正本は `pwa/design/season_budget_actual.md`。

必須機能:

- 一覧 + 詳細の 2 段: 一覧トップは全 active plan cycle を 1 行ずつ (PJ / 請求額 / バッファ / 原資 / pt単価 / 閉じ✓✗ / 未割当pt / 原資=Σcap / 役員収束) で出し、警告ありの行を上に持ち上げる。行クリックで①収入②配分③メンバー別のフル予実表を出す。
- 集計の正本ロジック: `src/lib/season-pl.ts` の `computeSeasonPl` 純関数。`reward-summary.ts` の月次集計 (`buildRewardSummary`) を plan cycle 全期間に集約し、cap + stock 繰越連鎖を内部で効かせる。API `GET /api/admin/season-pl` は一覧 (`mode=list`)、`?planCycleId=` で詳細 (`mode=detail`) を返す。手入力で `budget_yen` を書き換える導線は持たない (= 表示・検算専用)。
- ① 収入: 契約期間内の billing 月を `contractBackedClientAmount` で集約した請求額 (税抜・シーズン合計) を予算、`payment_confirmed_at` 済みの合計を実績入金として出す。契約開始前の事前稼働月は請求額に乗らない。
- ② 配分: バッファ内訳 (`value_plan_cycles.buffer_breakdown_json` の `{items:[{label,amount}],total}`、未設定時は原資から逆算)、メンバー原資 (= `value_plan_cycles.budget_yen` = (請求額−バッファ)×65%)、AMD マージン (35%) を並べ、`バッファ + 原資 + マージン == 請求額` の閉じ検算を必ず出す。
- ③ メンバー別 pt 比予実: 獲得pt (シーズン累計) × pt単価 = 予算取り分、実支払累計 (非役員=現金 / 役員=会社留保)、最終月末の未払い残 stock、差 (実支払+stock − 予算取り分, 最終的に 0 が正) を member 行で出す。役員 (`is_officer`) は「会社留保」、非役員は「現金支払」で分ける。member 名は `/mypage?memberId=` リンク。
- 別財布 (cap_extra) プールの pt単価分離 (2026-07-09 pt正本更新): plan cycle に `tag='cap_extra'` の MS があるとき、pt単価を `regularPtUnitYen` (= 本契約原資 ÷ シーズン期間月数×10pt) と `extraPtUnitYen` (= Σ `billing_cycles.extra_budget_yen` ÷ Σcap_extra effective pt) に分離する。cap_extra effective pt は、明示 `points > 0` があれば明示pt、未設定/0なら MS期間月数×10pt。member の予算取り分は `regularEarnedPt×regular単価 + extraEarnedPt×extra単価` で計算 (`budgetShareYen` / うち `extraBudgetShareYen`)。これをしないと別財布 pt も `原資÷total_points` で薄める旧汚染と同型になり member 収束Δが全員ズレる。`computeSeasonPl` は `regularPtUnitYen` / `extraPtUnitYen` / `extraPoolBudgetYen` / `extraPointsSum` を返す。
- 検算フラグ (この画面の目的): `閉じ検算` (バッファ+原資+マージン=請求額)、`未割当pt` (total_points − Σ MS points、宙吊り pt / 担当無し MS)、`原資=Σ月cap` (`budget_yen` = Σ `billing_cycles.budget_yen` = 本契約のみ、別財布 `extra_budget_yen` は別列で混ざらない)、`pt単価` (regular pt単価 = (請求額−バッファ)×65%÷regular pt と一致)、`役員stock収束` (最終月で役員 stock が 0)。別財布が完済すれば最終月の対象 member の extraStock=0、残 stock は本契約 regularStock のみになる。

回帰防止:

- `pwa/scripts/check_pwa_critical_ui.cjs` が `/admin/season-pl` の一覧・詳細・検算 anchor (`シーズン予実表` / `closes` / `unassignedPt` / `budgetMatchesMonthlyCaps` / `officerStockConverges`) と、`computeSeasonPl` / `buffer_breakdown_json` の集計 anchor を検査する。
- AdminSidebar の `シーズン予実` 導線、`/admin/season-pl` route、`/api/admin/season-pl` を消す変更は、`FEATURE_REGISTRY.md` と `pwa/design/season_budget_actual.md` を同時に更新する。
- 「未割当pt」は `Σ(earnedPt) < total_points` ではなく `total_points − Σ(MS points)` で見る (= 期中は消化が total 未満で正常。MS で裏打ちされない pt 単価分母の穴だけを検出する)。この判定を earnedPt 比較へ戻さない。

## /admin/ms-overview

目的: 全 active plan cycle の MS 設計を 1 画面で一望し、MS 本体・期間・pt・tag・担当 share と設計額を編集・確認する設計画面。「pt 配分が他 MS と比べて妥当か」「メンバー間の担当量と設計額がおかしくないか」をシーズン予実表 (= 実消化) と切り離して、`plannedShare` ベースの pt 配分で判断する。`/admin/season-pl` が「閉じてるか」を見る安全網なのに対し、こちらは「設計の歪み」を見る設計画面。仕様正本は `pwa/manual/6-8-admin-ms-overview-spec.md`。

必須機能:

- 表示単位: 全 active plan cycle (`status in (active, confirmed, fixed, draft)`) を `budget_yen` 大きい順に並べたアコーディオン。各 PJ ブロックは初期折りたたみ、先頭 PJ のみ開いた状態で出す。
- 集計の正本ロジック: `/api/admin/ms-overview` (`src/app/api/admin/ms-overview/route.ts`) と `src/lib/admin/ms-overview-calc.ts` は、MS pt と `plannedShare` から **pt配分と設計額** を組み立てる。支払額に見える円換算 (`points × pt単価` を支払確定額として見せる、メンバー年額など) は作らない。実際の支払額は `reward-summary.ts` / `/admin/season-pl` / `/admin/payouts` 側だけが正本。設計額は `effectivePoints × plannedShare × designUnitYen` の目安表示。
- PJ ブロック構造: ① メトリクスカード 4 枚 (合計pt / 本契約pt / 別財布pt / PJ予算残または不足額。設計額・設計単価・保存前支払検算を含む。個人名カードは出さない)、② 全MS (pt順) (MS 名 + 期間 + tag、pt、設計額、pt比、担当 share)、③ メンバー別 pt配分 / 設計額 (`codeName` + 本契約濃 + 別財布淡 の積み上げ横バー + 合計pt + 設計額)、④ tag 凡例 (normal #1D9E75 / routine #888780 / cap_extra #7F77DD)。
- 別財布 (cap_extra) プールは pt 配分として分離。`tag` が cap_extra 系 (`cap_extra` / `extra_contract` / `contract_extra` / `cap_outside` / `uncapped`) の MS は extraPt に積み、通常 MS は regularPt に積む。
- 編集モード (2026-07-09 更新): PJ ブロックごとに「編集モード」トグル。MS 名 / pt / tag / 期間 (`period_start_ym` / `target_ym`) / 完了条件 / 担当 share・役割・担当タスク / MS追加・無効化を編集できる。編集カードは左に MS 基本情報、右にメンバー share 表を置く 2 ペイン構成。pt は編集カード内の数値入力 + pt配分スライダーに加え、MS 一覧先頭の **全MS 編集テーブル** でも調整できる。全MS 編集テーブルは MS名 / tag / 期間 / pt / pt配分スライダー / 設計額 / メンバーのエフォート / 無効化を同じ行に出し、上段だけで MS名・期間・pt と金額感を確認できる。通常 MS のスライダー範囲は編集開始時点の最大 pt × 1.5 を右端に固定し、ドラッグ中に max を変えない。通常 MS の pt を動かすと `regularPointBasis - Σ(non-cap_extra MS effectivePoints)` の **残り割り振り可能pt** をリアルタイム表示する。担当 share 表は 2 カラムにせず、メンバー1人=1行で `メンバー / share / 役割 / 担当pt / 担当設計額 / 担当タスク` を並べる。`cap_extra` の pt は「別財布pt」として編集でき、明示 `points > 0` なら明示pt、未設定/0なら MS 期間月数×10ptで自動算出する。変更のたびに `src/lib/admin/ms-overview-calc.ts` の `recomputeMsOverview` で メトリクス / MS pt比 / MS設計額 / 担当 share 行の担当pt・担当設計額 / メンバー別 pt配分・設計額 を JS 側でリアルタイム再計算する (= API 不要)。算定式は `memberPt=ΣeffectivePoints×share`, `memberDesignYen=ΣeffectivePoints×share×designUnitYen`。`milestone_monthly_contribution_allocations.actual_share` は読まない (plannedShare のみ)。編集モード ON 直後の上部保存バーとフッターの両方に「↻ DB値に戻す」「保存して DB へ反映」を持ち、保存先 DB / reward 再計算 / 保存前支払検算まで表示する。cockpit 側には MS 設計の保存口を置かない。
- 保存前支払検算: `POST /api/admin/ms-overview/{planCycleId}` (body `{ milestones: [...], deletedMilestoneIds: [...] }`) は DB を書き換えず、編集後MS案で protected 月の旧 reward cache と新計算値を比較し、`rewardPreview.status` (`safe` / `warning` / `blocked`) を返す。画面は `blocked` の間「保存不可」として保存ボタンを無効化し、`memberImpacts` でメンバー別の追加支払 / 差額控除 / 本契約・別財布内訳を表示する。`budgetImpact` では支払済み固定 / 実績未照合 / これから支払予定 / 外部メンバーの期末未払い残 / 原資上限 / PJ予算残を表示し、クライアント支払は本契約 + 別財布売上、schedule_based 契約では `contract_terms_json.monthlySchedule.amountTaxExcl`、バッファは `value_plan_cycles.buffer_breakdown_json` 優先で読む。期末未払い残は支払通知対象の外部メンバー分だけを blocker 判定し、役員繰越は会社留保側の内部検算へ寄せる。メンバー支払義務のPJ予算超過、または `PJ予算 > (クライアント支払 - バッファ) × 65%` の原資超過も blocker とする。freee銀行出金と `monthly_reward_payout` 明細が一致した支払済み実績を固定した結果の赤字見込みを warning にする。旧 reward cache が無い、次回精算先の未保護月が無い、差額控除がシーズン内で吸収できない可能性がある、または支払済み印はあるが実支払証跡と明細額が未照合の月がある場合は blocker とする。別財布は protected 月に `extraPaidYen` がある場合だけ本人別差額を作り、未払い在庫だけの端数差では差額台帳を作らない。閲覧モードで cycle を開いた時点でも同じ POST 検算を走らせ、既存状態が blocked なら MS 一覧の上に `MS編集停止中` を出す。`source_ym < 202607` の旧制度合意済み月は新ポイント制の差額控除へ使わない。
- 編集モード保存: `PUT /api/admin/ms-overview/{planCycleId}` (body `{ milestones: [...], deletedMilestoneIds: [...] }`) は保存前支払検算をサーバー側でも再実行し、`blocked` なら 409 で保存前に止める。通過したら (a) `value_milestones` を upsert / 無効化 (`cap_extra` points は明示ptがあれば明示pt、未設定/0なら MS 期間×10ptへ正規化)、(b) `milestone_responsibility` を保存値で置換、(c) `value_plan_cycles.total_points = シーズン期間月数×10 + Σcap_extra effective pt` 再計算、(d) protected 月の差額を `reward_member_liability_offsets` に本人別で記録、(e) 変更前後の MS / 担当 share 差分と保存前支払検算サマリを `milestone_change_events` に記録、(f) `syncRewardSummariesForProject` で未保護月だけ reward 再計算する。protected 月差額が出る場合は `milestone_change_events.revision_id` と `reward_member_liability_offsets.revision_id` を一致させる。payload の MS が同じ plan_cycle に属するかを `plan_cycle_id` 突合で検査し、他 PJ への巻き込み更新を防ぐ。

回帰防止:

- `pwa/scripts/check_pwa_critical_ui.cjs` が `/admin/ms-overview` の route / page / client / sidebar anchor (`MS一覧` / `全MS` / `メンバー別 pt配分` / `設計額` / `担当設計額` / `cap_extra` / `編集モード` / `MS追加` / `担当share` / `担当pt` / `全MS pt配分スライダー` / `pt配分スライダー` / `残り割り振り可能pt` / `保存先 DB` / `保存前支払検算` / `保存不可` / `MS編集停止中` / `memberImpacts` / `budgetImpact` / `PJ予算残` / `支払済み固定` / `実績未照合` / `これから支払予定` / `期末未払い残` / `milestone_change_events` / `DB値に戻す` / `保存して DB へ反映` / `recomputeMsOverview` / `memberPointTotals`) を検査する。
- 上段メトリクスは 4 枚固定。3枚化、または 4 枚目を個人名カードへ戻す変更は禁止。4 枚目は `budgetImpact` 由来の `PJ予算残` / `不足額` / `予算不足` / `原資超過` を表示する。
- AdminSidebar の `MS一覧` 導線、`/admin/ms-overview` route、`/api/admin/ms-overview` (GET / PUT)、`src/lib/admin/ms-overview-calc.ts` を消す変更は、`FEATURE_REGISTRY.md` と `pwa/manual/6-8-admin-ms-overview-spec.md` を同時に更新する。
- 支払額に見える円換算を `/admin/ms-overview` に戻さないこと。`/admin/ms-overview` の円表示は設計額の目安に限り、実支払額は reward cache / season-pl / payouts 側だけで見る。
- 別財布判定 (cap_extra 系 tag) は `src/lib/admin/ms-overview-calc.ts` の `isCapExtraTag` を共有し、`season-pl.ts` の `CAP_EXTRA_MILESTONE_TAGS` と一字一句揃える (= 増やすときは両方更新)。

## /admin/private-wiki

目的: admin だけが、AMDメンバー・取引先・クライアント・研究者・外部協力者などの人物単位の趣味・プライベート・関係性メモを PJ ごとに保存・検索・更新できる。

必須機能:

- admin-only route: `/admin` layout の admin gate 内に置き、通常 PJ cockpit、公開ページ、研究機関外部 workspace から参照しない。
- PJ別グルーピング: `private_wiki_entries.project_id` で PJ 別に grouping し、null は AMD 全体 / 未紐付けとして扱う。
- 手作業編集: 追加 / 編集 / archive が UI からできる。直接削除を主導線にしない。
- フィルタ: 検索、PJ、人物種別、status で絞り込める。検索対象には人物名、所属、関係性、誕生日、出身地、居住地、接点、家族、タブー、本文メモ、source を含める。
- 人物文脈: 誕生日 (`birthday_label`)、出身地 (`origin_label`)、居住地 (`residence_label`)、接点 (`contact_context`)、家族 (`family_note`)、タブー (`taboo_note`) を本文メモとは別に表示・編集できる。
- evidence 表示: `source_kind` / `source_ref` / `source_excerpt` / `confidence` / `updated_by` を一覧上で確認できる。
- source hygiene: `source_excerpt` は短い抜粋だけ。メール全文・議事録全文・資料全文を保存する場所にしない。
- API 境界: browser 直接DB writeではなく `/api/admin/private-wiki` の `requireAdmin()` + service_role 経由で list/create/update/archive する。

回帰防止:

- `private_wiki_entries.visibility` は `admin_private` 固定。別画面へ再利用するときは `FEATURE_REGISTRY.md` と `/spec/2-1` を先に更新し、admin-only を崩さない。
- 旧 `tags` は既存互換のため DB に残すだけ。UI/API の入力欄・フィルタ・必須アンカーとして戻さない。
- seed は入れない。必要なテストデータはダミーだけにする。

## /admin/management-knowledge

目的: admin だけが、PJ横断で再利用できる経営ノウハウを判断カードとして保存・検索・更新できる。

必須機能:

- admin-only route: `/admin` layout の admin gate 内に置き、通常 PJ cockpit、公開ページ、研究機関外部 workspace から参照しない。
- PJ任意紐付け: `management_knowledge_entries.project_id` は nullable。null は AMD 全体で再利用する知見として扱う。
- 手作業編集: 追加 / 編集 / archive が UI からできる。直接削除を主導線にしない。
- フィルタ: 検索、PJ、category、maturity、tag、status で絞り込める。
- 知見の骨格: `title` / `category` / `route_type` / `maturity` / `summary` / `body_md` / `reusable_when` / `next_check` / `tags` を持つ。
- evidence 表示: `source_kind` / `source_ref` / `source_excerpt` / `confidence` / `updated_by` を一覧上で確認できる。
- source hygiene: `source_excerpt` は短い抜粋だけ。メール全文・議事録全文・資料全文を保存する場所にしない。
- API 境界: browser 直接DB writeではなく `/api/admin/management-knowledge` の `requireAdmin()` + service_role 経由で list/create/update/archive する。
- 初期カード: `/Users/masa/projects/AMD/kagawa/2026-07-03_roundtable_commercialization_type_memo.md` から Proto-RT / Roundtable 型の知見を seed する。

回帰防止:

- AdminSidebar の `経営ノウハウ` 導線、`/admin/management-knowledge` route、`/api/admin/management-knowledge`、`management_knowledge_entries` を消す変更は、`FEATURE_REGISTRY.md` と `/spec/2-1` を同時に更新する。
- `maturity` は `raw_note` / `hypothesis` / `field_tested` / `playbook` に分け、思いつきと再利用可能な型を同じ状態として扱わない。
- 人物の趣味・関係性メモは `/admin/private-wiki` に置き、この台帳へ混ぜない。

## /dashboard

目的: まさと司令塔が全PJの現状と、今日先に打つべき一手を最初に見る入口。

必須機能:

- 先手 TODO バッジ: dashboard 上段に `ProactiveTodoBadge` を出し、`proactive_todos.status='open'` の件数 / 期限超過件数 / red件数を 1 行で見せて `/proactive` フルページへ送る。バッジは admin (= `members.is_admin=true`) のみ表示で、非 admin は枠ごと消す。詳細仕様: [`pwa/spec/2-4-proactive-todo-current-spec.md`](../spec/2-4-proactive-todo-current-spec.md)。**旧 `ProactiveQueuePanel` 経由の `proactive_outbox` 表示 (= 5段ループ盤面の実行段) は 2026-06-27 廃止**。司令塔セッション運用の消滅と完了UI不在が理由 (詳細: spec 2-4 末尾)。dashboard 上段 (= 旧 `LoopKernelBoard` / 旧 `ProactiveQueuePanel`) からは両方とも除去済み。
- 抽出状況: dashboard 上段に admin 限定の `ExtractionStatusCard` を出す。Gmail / Drive / Calendar / Slack / Notion ごとの「OSへ最後に保存された証跡」と「MTG抽出で実際に使えた時刻」を分けて並べ、月次対象PJのメール・Slack・Drive設定不足は「設定が必要」に集約して `/admin/projects` へ送る。保存証跡の古さを接続異常と扱わず、未読の再認証通知、PJ設定不足、Calendar接続エラーだけを対応事項として出す。`project_config_gap` は採否通知に出さない。
- PJ台帳の Slack CH 列: `projects.slack_channel_not_required=true` を「チャンネルなし」チェックで編集できる。これは未設定ではなく意図的にSlackチャンネルを使わないPJを示し、抽出状況の設定不足から外す。チェック時は古い `slack_channel_id` を空にする。PJ台帳の見出し行は縦横スクロール中も固定する。
- AMD全体 累計実績カード: dashboard 上段の `FundingStatsCard` は、資金調達ラウンドと助成金・補助金を会社別/行別に表示する。累計値は `amd_contribution_status in ('full','partial')` の AMD貢献額だけで計算し、`none` / `unreviewed` はリストには残すが累計には入れない。投資家別内訳・持株比率・cap table snapshot は dashboard API に返さない。
- PJ一覧: Active / Sales-Draft / Ended-Frozen の横長 stripe 一覧を維持する。KUTE (`p25`) など研究機関エコシステム構築PJは通常PJ一覧に二重表示せず、研究機関ECRリスト側へ寄せる。
- 左メニューのボード: マウスオーバーまたはキーボードフォーカスで、右側に全アクティブPJの一覧を出す。各行は対応するPJコックピットへ遷移し、一覧は固定せず `projects.status='active'` を読む。ボード本体の `/dashboard` 導線は維持する。フライアウトはナビのスクロール領域にクリップされない上位レイヤーで表示し、画面下端では一覧部分だけをスクロールさせる。
- 研究機関ECRリスト: PJ一覧と同じ左/mainカラム内で、PJ一覧の直下に `InstitutionReadinessList` を表示し、PJリストの続きとして苗床レイヤーを確認できるようにする。MyPage右カラムの下や全幅下段に落とさない。表示名はPJ名を主タイトルに寄せ、KUTE / KGW / NIMS を title、工学院大学 / 香川大学 / 物質・材料研究機構を subtitle にする。KUTEカードは `/institutions/inst_kute/cockpit`、NIMSカードは `/institutions/inst_nims/cockpit` へ遷移する。
- Company Content shelf: 研究機関ECRリストの下に、`CompanyContentShelf` を4カラムで表示する。列はメンバー / 沿革 / メディア掲載 / photo。`member_profiles` / `company_history_events` / `media_assets` の approved rows を優先し、未適用環境では既存 `members` + `project_members`、`project_events` / `project_ventures`、photo permission placeholder に fallback する。Notion photo URL や個人情報本文は表示しない。
- MyPage embed: `/dashboard` 右カラムでは `<MyPageContent embedded showMonthlyProjects={false} />` を使い、「今週やったこと」より下の月別PJカードを出さない。`/mypage` 単体では従来どおり月別PJカードを維持する。
- Dashboard上部: Management Score と明示 action queue を維持する。月次ルーティン由来の自動タスクは生成しない。

## /tasks (deprecated)

目的: `/tasks` 画面が廃止済みであることと、残す互換面を明示する。

廃止済み:

- GlobalNav の `タスク` 導線。
- `/tasks` page route。
- `TasksClient` のマインドマップ / ガント / 業務デスク UI。
- `npm run agent:tasks` helper。

残すもの:

- `tasks` table は cockpit legacy kanban / H-1 next action 互換のため残す。
- `/api/tasks` は既存 caller 互換として残す。browser client から直接 `tasks` を更新しない。
- `/api/task-calendar/register-tasks` は H-1 の次アクション登録として残す。通知・Slack nudge は廃止済み `/tasks` ではなく対象 PJ cockpit へ向ける。
- `/api/task-calendar/schedule-plan` は Calendar 作業枠 dry-run planner として残す。

回帰防止:

- `/tasks` 画面や GlobalNav 導線を復活させない。
- `tasks` 既存カンバン列 (`task_id`, `project_id`, `title`, `status`, `assignee`, `priority`) の意味を変えない。
- DB物理削除、DROP、既存 row の一括削除はしない。
- DDL変更時は `pwa/scripts/migrations/` と `/spec/5-7-task-management-current-spec` を同時更新する。

## /project/[projectId]/cockpit

目的: PJの現在地、MS進捗、資料、経営ハイライト、月次カード、MTGサマリを一画面で見る。

必須機能:

- レイアウト: `max-w-[1600px]` の幅広 container、上 Header → hero (PJ Status) → 進捗管理本文へ進む案C系構成。通常時は MS / 月次側と、資料 / 経営ハイライト / ガバナンス / 助成金 / MTGサマリ側の 2 カラム。凍結中 / 再開予定などのステータスバッジがある時だけ右カラムを出す。`max-w-[1060px]` + 左 720 / 右 220 の旧 2 カラムには戻さない。最下段の旧 TODO かんばんと旧 `ProactiveQueuePanel` は主要導線から外す。
- Header契約サマリー: `CockpitHeader` はPJ名/status/分類に加え、PJリスト正本からPJメンバー、契約条件、業務委託料、支払い条件、提出物の有無、月次報告書の提出ルール、立替精算の発生額/不可を表示する。提出物/月次報告/立替精算は `projects.contract_terms_json.deliverablesRequired` / `deliverablesNote` / `monthlyReportSubmissionRule` / `monthlyReportSubmissionNote` / `expenseReimbursementAllowed` / `expenseReimbursementNote` を読む。立替精算は不可PJだけ `不可`、OK運用のPJは `expenseReimbursementNote` の発生額/実務メモを主値にする。コックピットから `/admin/projects` や旧configへ飛ばす導線は置かない。
- KUTE年度内ロードマップ: `projectId === 'p25'` では Header 直下に `CockpitKuteAnnualRoadmap` を表示する。6/11キックオフ資料 / `PROJECT_BRIEF` の年度内スケジュールを根拠に、規程整備 (`2027-01` 完了目途) とシーズ発掘 / after GTIE (`2027-03` 型化目途) を同じ横軸で見せる。研究機関コックピット `/institutions/inst_kute/cockpit` でも同じ `CockpitView` 経由で表示する。
- 上 hero: PJ ごとに出し分け。p00 (= AMD 会社全体) は `CockpitManagementScoreHero` で AMD Management Score の時系列折れ線 + 最新値カード。SU 系 PJ は `CockpitVentureStatus` 内で AMD Score 折れ線と XRL 折れ線を `xl:flex-row` で横並びにする。`xl` 未満では縦並びへ自動 fallback する。
- Hero 下タブ: SU 系 PJ は `進捗管理` / `スコア詳細` を切り替える。AMD Score / XRL hero はタブ外に置いて常時表示し、`進捗管理` に従来の cockpit 本文、`スコア詳細` に `AmdScoreView` の embedded 表示を出す。正規URLは `/project/[projectId]/cockpit?tab=score-detail` で、SPS / R_net / FRL / XRL evidence と XRL チェックリストを同じタブに集約する。旧 `/venture-map/amd-score/[projectId]` はここへ redirect (`p99` デモを除く)。
- 今期MSリスト: `CockpitGoalsCompact` / `MilestoneGanttChart` でMS期間、pt、担当、sub item、MS単位の `設計額`、担当者ごとの `担当設計額` を表示する。設計額は通常MSなら `value_plan_cycles.budget_yen`、`cap_extra` なら同期間の `billing_cycles.extra_budget_yen` 合計を、それぞれの有効ptで按分する目安で、支払確定額ではない。MS 設計編集は `/admin/ms-overview` に集約し、cockpit / HUD cockpit からは編集しない。
- MS変更履歴: `CockpitMsChangeHistory` を今期MSの直下、`CockpitSeasonFinance` の手前に初期折りたたみで表示する。正本は `/admin/ms-overview` 保存時に追加される `milestone_change_events` と、2026-07-09 backfill の `source='migration'` 基準線。表示は確認専用で、変更日時、記録者、追加/無効化/更新されたMS、担当share差分、保存前支払検算の状態、追加支払/差額控除の合計を出す。契約本文、メール全文、議事録全文、raw source は保存・表示しない。cockpit 側には MS 設計の保存口を置かない。
- 今シーズン収支: `CockpitSeasonFinance` をMS変更履歴の下、月次カードの手前に表示する。シーズン合計と月次行で `クライアント支払` / `バッファ` / `原資上限` / `PJ予算` / `メンバー支払` / `期末未払` / `収支` を出す。クライアント支払は `contractBackedClientAmount` + 別財布売上、schedule_based 契約では `contract_terms_json.monthlySchedule.amountTaxExcl`、バッファは `value_plan_cycles.buffer_breakdown_json` 優先、原資上限は `(クライアント支払 - バッファ) × 65%`、PJ予算は `budget_yen + extra_budget_yen`、メンバー支払・未払残は `reward_summary_json` を正本にする。`期末未払` / `未払残` は支払通知対象の外部メンバーへ将来払う残高だけを表示し、役員の未充当繰越は会社留保側の内部検算へ寄せる。`収支` は現金主義で `クライアント支払 - バッファ - メンバー支払` とし、役員向け報酬相当額や未払残は含めない。役員向け報酬相当額は検算には含めるが、PJ cockpit では表示しない。期末未払または原資超過が 1 円でも残る場合は `不足` 表示と赤い停止帯を出し、報酬計算側の自動上乗せでゼロに見せない。
- 先手TODO: 旧 `proactive_outbox` 由来の `ProactiveQueuePanel` は通常PJ / institution cockpit に表示しない。`資料作成済み` など旧司令塔状態の手動seedがPJ状況面に残ると読解ノイズになるため。先手TODOの棚卸しは `proactive_todos` + `/proactive` + dashboard 上段バッジで扱う。
- 経営ハイライト: MSリスト横の col2 として `CockpitStrategySignals` を表示し、`project_strategy_signals` の candidate/confirmed を日付・type・impact・summary・source refs付きで表示する。
- 月次モーダル: 月次カードから `CockpitMonthlyModal` を開き、report / reward / invoice を確認できる。routine step 起動は廃止済み。p00 (= AMD 会社全体) でも他 PJ と同じく月次カード + 月次モーダルが出る (`billing_cycles` を 12 行 backfill 済)。
- PM月次ルーティン: 廃止済み。cockpit の col3 に月次 step/TODO は出さず、月次状態は月次カード + `CockpitMonthlyModal` で確認する。
- 旧 nudge カード: 通常PJ cockpit には `CockpitNudge` / `tsukuyomi_nudge_queue` 由来カードを出さない。通知・軽い確認は Slack や専用面へ寄せ、コックピット本文の読解を妨げない。
- MTGサマリ: `CockpitMeetingSummary` 各行に source link (Notion / Slack / Drive / Gmail / Calendar event の元データへ直リンク) を `元 ↗` の形で出す。各行クリック時は `?meeting=<meeting_id>` を URL に反映し、共有 URL から同じ detail modal を auto-open できるようにする。`summary_short` は一覧カードの2行サマリとして出す。通常PJ cockpitの一覧本体には `max-height` と `overflow-y-auto` を置かず、カードが増えた場合はコックピット全体のページスクロールで読む。`source_kinds='upcoming'` の row は「予定MTG / 準備中」ブロックに出し、`決めること / 準備物` を表示する。H-1が現在時刻の前後24時間にある確定Calendar予定を、M系メンテが今後60日の確定Calendar予定を `POST /api/meeting-prep/calendar-sync` に渡すことで、前回議事録が空のPJでも未来MTGカードを作る。`source_kinds='upcoming_tentative'` や `meeting_id` が `upcoming:` で始まるだけの row は日程未確定の仮置きとして「日程調整中MTG」ブロックに残し、確定予定 count には含めない。予定MTG詳細では、配列を箇条書きで並べるのではなく `narrative_md` の「初見ブリーフ」を主役にし、「会議後に残したい状態」「いまの状況」「当日までに揃えるもの」「必ず確認すること」を文章カードとして見せる。既存 `risks` の内容は破壊せず、この「必ず確認すること」として表示・編集する。MTG詳細モーダルの「表示内容を編集」は、表示している section を同じ位置で textarea 化する。通常MTG / dialogue は `narrative_md` が表示されている場合は `narrative_md` を編集し、raw 配列表示の場合だけ `decided / progress / next_actions / risks` を編集する。予定MTGは同じ `POST /api/meeting-prep`、通常MTG / dialogue は `POST /api/meeting-summary/manual-update` で保存する。MTG詳細モーダルには「つくよみに修正依頼」を置かず、LLM再解釈ではなく手動編集を正本にする。詳細モーダル上部には `PDF保存` / `議事録コピー` / `準備メモコピー` / `共有URLコピー` を置き、PDFは共有用DOMを `html2canvas` + `jsPDF` で直接保存、議事録コピーは `narrative_md` / fallback section から会議後サマリだけのプレーンテキスト、準備メモコピーは `## 参考: 会議前準備メモ` 以降または紐づく prep row の本文、URLは既存 `?meeting=` deep link を使う。詳細モーダルの「添付資料」は `meeting_assets` に、ファイル選択 / drag & drop / clipboard paste / browser screen capture の4経路で一般ファイルを保存できる。新規添付実体はDriveの `PJフォルダ / YYMMDD_会議名` に置き、保存先をカード上に表示する。旧Storage添付は互換表示し、`POST /api/meeting-assets/insert-markdown` で `narrative_md` に Markdown 画像/リンクとして挿入できる。`dialogue:*` で始まる meeting_id は「提案整理」チップ付きで識別し、`CockpitMeetingDetailModal` でラベルを「提案前の論点整理 (チームへの相談)」に置き換える (= 「決まったこと」と書かない)。dialogue meeting は `narrative_md` があれば 1 本の Markdown narrative として表示する。`narrative_md` は `POST /api/dialogue-meeting/narrate` で生成する。各 TopicList の項目は border-l フレーム枠ではなく、`<ul>` + 太字 / マーカー / 見出しの強弱で読ませる。
- 開催済みMTG本文の表現契約: `## 🎯背景` / `## 📊経緯` は段落、`## ✅決まったこと` / `## ▶️次の一手` / `## ⚠️残課題` は1項目1論点の `- ` 箇条書きにする。番号付きリストとチェックボックスは使わない。
- MTG PDFの添付契約: `PDF保存` は共有用本文の後ろに `meeting_assets` の PDF / PNG / JPEG を `sort_order` 順で連結する。投影資料を先、参加者共有資料を後に並べ、資料へのリンク一覧だけで済ませない。
- MTG詳細Markdownのメンバーリンク: `CockpitMeetingDetailModal` で表示する `narrative_md` / `summary_short` / raw 配列 / 予定MTGブリーフは `MarkdownView memberLinks` を通し、active AMDメンバーの `members.code_name` が standalone mention として出る場合だけ `/mypage?memberId=<members.member_id>` へリンクする。既存 Markdown link / code / pre は対象外で、`しかるべき` の `かる`、`こうして` の `こう` のような部分一致はリンクしない。

回帰防止:

- `pwa/scripts/check_pwa_critical_ui.cjs` が `経営ハイライト`、`CockpitStrategySignals`、`project_strategy_signals`、`project_strategy_signal`、`CockpitMsChangeHistory`、`MS変更履歴`、`milestone_change_events`、`CockpitSeasonFinance`、`今シーズン収支`、`クライアント支払`、`期末未払` の anchor を検査する。
- MTGサマリの予定MTG block / `POST /api/meeting-prep` / `POST /api/meeting-prep/calendar-sync` / `MeetingPrepInlineEditor` / `POST /api/meeting-summary/manual-update` / `MeetingSummaryInlineEditor` / `MeetingAssetsPanel` / `POST /api/meeting-assets` / `PDF保存` / `議事録コピー` / `準備メモコピー` / `共有URLコピー` も `check_pwa_critical_ui.cjs` で検査する。
- 案C レイアウト anchor (`max-w-[1600px]`、`lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_300px]`、`xl:flex-row` Hero) も `check_pwa_critical_ui.cjs` で検査する。`max-w-[1060px]` や旧 left/right 2 カラム構造に巻き戻ったら `npm run test:critical-ui` で落ちる。

## /institutions/[institutionId]/cockpit

目的: 研究機関カードから、機関の箱を保ったまま関連PJの進捗・月次・MTG履歴へ入る。

必須機能:

- KUTEカードは `/dashboard` の研究機関ECRリストから `/institutions/inst_kute/cockpit` へ遷移する。KUTEは通常PJリストには二重表示せず、既存KUTE PJ (`p25`) は関連PJコックピットのデータソースとして残す。
- NIMSカードは `/dashboard` の研究機関ECRリストから `/institutions/inst_nims/cockpit` へ遷移する。NIMS OS導入は正式PJ `p28` として扱い、CX `p20` は初期ユースケースとして分ける。
- 研究機関コックピットは `inst_kute -> p25` / `inst_nims -> p28` の静的関連付けを使い、既存PJコックピットの `CockpitView` を同画面にマウントする。これによりMS進捗、月次カード/モーダル、MTGサマリを既存データのまま使う。
- 上部にECR充足率、関連PJ、今期MS件数、MTG履歴件数を出す。
- `project_meeting_summaries` を月ごとに束ねたMTGツリーを表示し、各行から通常PJコックピットのMTG詳細 (`?meeting=`) へ遷移する。
- `/institutions/[institutionId]` の詳細画面からも研究機関コックピットと通常PJコックピットへ戻れる。

## 株主・ガバナンス + 要対応 (2026-06-15 追加、2026-07-16 会社概要タブへ統合)

設計: `pwa/design/governance_action_items.md`。DB: migration `137_governance_and_action_items.sql` (`action_items` / `project_shareholders` / `project_valuation_rounds` / `project_shareholder_meetings`)、`174_project_company_overview_and_equity_ledger.sql` (`project_company_profiles` / `project_equity_transactions` / `project_equity_entries` / `project_convertible_instruments` / `project_financial_periods` + `amd_os_is_member()` gate 関数)。

- **PJ cockpit 常設「会社概要」タブ** (`CockpitCompanyOverview`、`CockpitView` のタブ列 `進捗管理` / (`スコア詳細`) / **`会社概要`** の3本目として全PJ常設。2026-07-16、col2 の `CockpitStrategySignals` 直下にあった旧 `CockpitGovernance` を削除しこのタブへ統合): 基本情報 (商号/法人番号/資本金/機関設計/決算月等、`project_company_profiles`)、株式イベント台帳 (`project_equity_transactions` + `project_equity_entries`) 由来の cap table、発行済/完全希薄化後 (FD) 株式数、確定株式イベントを積み上げた 100% 資本構成推移タイムライン、資金調達ラウンド (`project_valuation_rounds`)、J-KISS/SAFE/CB 等の転換前証券 (`project_convertible_instruments`)、総会・取締役会 (`project_shareholder_meetings`)、年度決算 (`project_financial_periods`)、Excel (`downloadCompanyOverviewXlsx`) / PDF (html2canvas+jsPDF) 出力を1画面に集約する。`status='planned'` の計画株式イベントは法的現在値の cap table (`buildCapTableSnapshots`) に混ぜず、転換前証券の転換見込株式数 (`convertibleScenario`) も現在の持株比率には混ぜない。`project_company_profiles.registered_issued_shares` (登記上の発行済株式数) と株式イベント台帳合計の tie-out を `capTableTieOut` で常時表示する。**まさ確定仕様により、全PJを members 登録済みの AMD メンバー全員が閲覧・編集できる (admin 限定ではない)**。データは `/api/governance` (`requireMember` gate。従来の admin 限定から 2026-07-16 に変更) から client fetch。既存 `project_shareholders` は互換表示用に残し、cap table の opening balance へ非破壊 backfill 済み。削除禁止理由: 終了後も残る AMD 持分・ガバナンス可視化 + 会社の基本情報から資本政策までを1つの正本に集約する (まさ確定 2026-06-15 / 2026-07-16)。
- **cap table 履歴マトリクス + 次回ラウンド試算** (2026-07-16 追加): 会社概要タブの cap table は現在断面だけでなく、confirmed 状態の株式イベントを積み上げた holderName ベースの100%推移タイムラインと、`data-testid="cap-table-history-matrix"` の創業からのラウンド別水平マトリクス (発行済株式・新規発行・調達額・発行価額・pre/post-money・holderName別株数比率) を持つ。正史が `incorporation` から始まらない場合は `capTableOriginWarning` が `data-cap-table-origin-warning` の警告を出し「創業時のシェアを遡って再現できない」旨を明示、創業時株式イベントの入力導線 (`onAddFoundingEvent`) を提示する。`data-testid="next-round-simulator"` の次回ラウンド試算は、ベース断面・pre-money・調達額・post-round SOプール目標・「転換前証券を含める」明示トグル (`includeConvertibles`)・保護株主と目標最低比率を入力に、`computeNextRoundScenario` / `minimumPreMoneyForTarget` / `nextRoundSensitivity` (いずれも `src/lib/company-overview.ts`) で発行価格・新規投資家株数・SOプール・post-money・完全希薄化後・保護株主の目標維持に必要な最低pre-money・感度分析を算出する。未入力 (`estimated_conversion_shares` 未設定) の転換前証券株数を推測することはない。**この試算は未保存・仮の数値で、確定した現在値の cap table や法的な株式イベント台帳には一切反映しない**。Excel 出力 (`downloadCompanyOverviewXlsx`) も UI と同じ計算エンジンを再利用し、`ラウンド別cap table` シートに履歴マトリクスを、`次回ラウンド試算` シートに上記シミュレーションを (未保存の仮シミュレーションである旨の注記付きで) 書き出す。削除禁止理由: 現在値だけでなく資本政策の経緯と将来ラウンドの意思決定材料を1つの正本タブに揃えるため (まさ確定 2026-07-16)。
- **migration `175_lst_cap_table_history.sql`** (2026-07-16): LST (`p07`) の cap table 正史を `xlsx:LST_captable_250415.xlsx` から復元。migration 174 の自動生成 opening_balance を void にし、創業 (`incorporation`, 星野毅 普通株30,000株)・Seed新株発行 (`new_issue`, UMI3号投資事業有限責任組合 シード種優先株式15,000株)・QST現物出資 (`in_kind_contribution`, QST 普通株式2,500株) の3件の confirmed 株式イベントを `project_valuation_rounds` (Seed / QST ラウンド) と紐付けて再構築する。最終断面は合計47,500株、星野毅63.1579% / UMI 31.5789% / QST 5.2632%。この復元内容は LST 固有の事実であり、他PJへの一般ルールではない。
- **要対応（期日順）面** (`ActionItemsPanel`): `/dashboard` の上段 action queue と `/notifications` 先頭。全PJ横断 + personal/company scope の `action_items` を期日順 + 「あと何日/期限超過」chip で表示、「対応済にする」で `status=responded`。成功時は押した行だけを即座に外し、一覧全体の再読込はしない。更新失敗時だけ元の位置へ戻す。データは admin 限定 API `/api/action-items`。削除禁止理由: 期日付き inbound 義務を埋もれさせない導線 (まさ確定 2026-06-15)。会社概要タブにも同じ confirmed action_items を「会社運営の要対応」として表示する (PJ cockpit 側の要対応面)。
- **`/admin/governance`**: 株主/ラウンド/総会/要対応の手動記録 CRUD。AdminSidebar に「🏛 株主・ガバナンス」。ページ自体は Admin route 配下のナビからのみ導線があるが、下流 `/api/governance` は 2026-07-16 以降 `requireMember` (members 登録済み AMD メンバーなら誰でも書き込み可) のため、admin 専用の書き込み経路ではなくなっている。`action_items` を扱う `/api/action-items` は引き続き `requireAdmin`。
- **`/api/governance/extract`**: Gmail/Drive/Calendar 等から抽出された総会・取締役会・書面決議候補の受け口。既定は `l2_coverage_gaps` review candidate、`apply=true` のときだけ `project_shareholder_meetings` に canonical insert。`attachments` に `content_base64` / `data_url` があれば、確認済み反映時に `projects.drive_folder_id` 直下の `YYMMDD_会議名` folder へ保存し、Drive link を `attachments_json` に残す。削除禁止理由: LST の取締役書面決議のようなメール由来ガバナンス履歴を資料リンク込みで OS 化するための入口 (まさ依頼 2026-06-16)。
- **`/admin/projects` の「総会」「役会」checkbox + `/api/cron/governance-email-sweep`**: `projects.governance_watch_shareholder_meetings` / `governance_watch_board_meetings` がONのPJだけ、`report_emails` とのGmailやりとりを総会/役会keywordで狭く検索し、`/api/governance/extract` に candidate / apply を渡す。削除禁止理由: D-14G の検索範囲をPJ台帳から明示的に制御し、全メール横断の誤検知・取りこぼしを減らすため (まさ依頼 2026-06-16)。
- 既存 `tasks` は H-1 / cockpit 互換の旧データレーン。`action_items` は5生データ抽出 + 採否ループ + personal scope を持つ inbound 義務で、`tasks` table を置換しない。
