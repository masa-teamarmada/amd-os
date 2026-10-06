# OS画面のメタ説明監査（2026-10-06 JST）

資本政策表の「保存された資本政策表を社内承認とVC提出に使用します。」と計算工程を説明する常設段落を削除。検証カードは修正欄へ移動する操作に変更。以下の他画面は今回の依頼に沿った洗い出しであり、まだ削除していない。

PWA 33箇所、iOS 1箇所、Mac版128箇所を記録。PWAの画面部品・ページから表示文字列を構文木で抽出し周辺コードを確認。ネイティブはSwiftUIのText/画面subtitleに定義された文言を抽出した候補で、全画面の実機表示や現行入口との接続は未確認。コメント・設計文書は対象外。GAS/独立サービスの画面ソースでは、同種の検索語に該当する表示本文を特定しなかった。Androidディレクトリは現checkoutにない。DB由来の自由記述と動的な外部エラー全文は別監査となり、この静的抽出でOS内の全文章を網羅したとは扱わない。

対象は、実装・保管・投影・更新責務を説明する本文。操作名、入力単位、根拠・確認日、未登録、保存中/保存失敗、削除・送信前の確認は残す。単語「保存」「正本」を含むだけで削除しない。

## PWA：削除・短縮する説明（14箇所）

保管場所・取得元・画面の作り方の説明を削る。業務内容、個別値/共通係数、未登録や読込み失敗の状態、操作・関連PJへのリンクは維持する。コスト試算の空状態は、隣接するDB名・role_key・計算エンジンの説明も同じ対象。

| 場所 | 現行文言 |
|---|---|
| [KnowledgeMapView.tsx:276](../../../pwa/src/components/knowledge-map/KnowledgeMapView.tsx#L276) | OS内のL2とmanual/specを、判断・PJ・人・会議・根拠・教科書化へ束ねた読み取り専用マップ。 ノードを押すと展開し、右側で根拠の置き場所を確認できる。 |
| [MaterialsKnowledgeView.tsx:202](../../../pwa/src/components/knowledge-map/MaterialsKnowledgeView.tsx#L202) | 読み取り専用 / 質問機能なし |
| [AllPjIntroductionModal.tsx:191](../../../pwa/src/components/dashboard/AllPjIntroductionModal.tsx#L191) | 選択 PJ の最新データを Supabase から集約しています… |
| [VentureMapView.tsx:538](../../../pwa/src/components/venture-map/VentureMapView.tsx#L538) | 領域別パラメータ（最新推定値・Supabase macro_lane_weights から取得） |
| [Bzm30ScorePanel.tsx:572](../../../pwa/src/components/bzm30/Bzm30ScorePanel.tsx#L572) | の正本から、 記号の意味はその式の記号表から取っている。右の2列が、その記号に |
| [ModelCurrentFormulas.tsx:34](../../../pwa/src/components/model/ModelCurrentFormulas.tsx#L34) | 本文（§5・§6）に出てくる式を出現順に並べたもの。式・説明とも正本から拾っている。行を押すとその節へ飛ぶ。 |
| [ModelCanonSections.tsx:191](../../../pwa/src/components/model/ModelCanonSections.tsx#L191) | 上の式に出てくる記号の意味です。説明はすべて正本の記号表から読んでいます。 同じ記号を複数の正本が説明している場合は、どれも消さずに併記します。 |
| [DdAdminPanel.tsx:96](../../../pwa/src/components/dd/DdAdminPanel.tsx#L96) | 各ページはコックピット・ワークスペースと同じ内容を表示する。ここでは共有資料と正式版PDFに含める項目を選ぶ。 |
| [CockpitCostModel.tsx:570](../../../pwa/src/components/cockpit/CockpitCostModel.tsx#L570) | このタブは、想定している系・CAPEX/OPEX の内訳・成立ライン・確度の低いパラメータを1画面で見るためのもの。 正本は AMD OS の DB（ |
| [CockpitVentureMetaEditModal.tsx:108](../../../pwa/src/components/cockpit/CockpitVentureMetaEditModal.tsx#L108) | ユーザー向けの PJ 名は `projects.project_name` が正本。ここでは変更しない。 |
| [CockpitOrgSection.tsx:136](../../../pwa/src/components/cockpit/CockpitOrgSection.tsx#L136) | 機能の一覧をモデル正本から読めなかったので、この表は出していない。 正本側の見出しか表の形が変わった可能性がある（画面が古い機能の一覧を持ち続けないための挙動）。 |
| [CockpitProjectOverview.tsx:227](../../../pwa/src/components/cockpit/CockpitProjectOverview.tsx#L227) | 契約期間・請求と振込・業務と成果物・経費申請。数字と条件は締結済み契約の読み取りで、ここでは編集しない。 |
| [page.tsx:156](../../../pwa/src/app/(app)/institutions/page.tsx#L156) | AMDとの契約有無に関係なく蓄積する正本一覧。契約した機関には、同じ行へPJ運用レイヤーを重ねる。 |
| [page.tsx:176](../../../pwa/src/app/(app)/institutions/[institutionId]/cockpit/page.tsx#L176) | 研究機関の箱はこの画面に残し、MS進捗・MTGサマリ・月次サマリは既存の関連PJデータをそのまま使う。 |

## PWA：必要な案内を保って書き直す（19箇所）

単純削除しない。保存と未保存、計算範囲、資料の未登録、権限・未対応による制約を判断できることが必要。DB/API/Supabase等の内部語を利用者の言葉へ置き換え、更新日時は短い状態表示へまとめる。

| 場所 | 現行文言 |
|---|---|
| [NotificationsClient.tsx:395](../../../pwa/src/components/notifications/NotificationsClient.tsx#L395) | 承認しても、この画面からBZM本文を直接書き換えない。後続のローカル反映処理が、承認済み候補だけをBZMのmdへ追記する。 |
| [NotificationsClient.tsx:420](../../../pwa/src/components/notifications/NotificationsClient.tsx#L420) | はい/いいえ/コメントは admin/tsukuyomi の学習リストに残る。安全に反映できる候補は「はい」でSupabaseへ反映する。 |
| [NotificationsClient.tsx:812](../../../pwa/src/components/notifications/NotificationsClient.tsx#L812) | この通知は古いOS snapshotと外部ソースの差分から出てる。下の根拠がすでにDBへ取り込まれている場合は、取り込み済み表示が先頭に出る。 |
| [NotificationsClient.tsx:2721](../../../pwa/src/components/notifications/NotificationsClient.tsx#L2721) | この通知種別は、対応する正本行の詳細表示がまだ個別実装されていないか、通知作成後に候補行が移動/統合されている可能性がある。通知本文と下の確認先を見て判断してください。 |
| [ContractsClient.tsx:1563](../../../pwa/src/components/contracts/ContractsClient.tsx#L1563) | 契約の正本行を作成し、版・押印証跡はあとから文書として追加する。 |
| [InstitutionRegulations.tsx:244](../../../pwa/src/components/institutions/InstitutionRegulations.tsx#L244) | 外部文書を正本として優先。作成途中の版と次の決裁をここで管理する。 |
| [AdminTsukuyomiClient.tsx:246](../../../pwa/src/components/admin/AdminTsukuyomiClient.tsx#L246) | PWA投稿APIの接続待ち |
| [AdminScheduleClient.tsx:488](../../../pwa/src/components/admin/AdminScheduleClient.tsx#L488) | migration 178 を適用してから再生成して。既存の契約・債務データはこの画面から書き換えないよ。 |
| [AdminPaymentsClient.tsx:373](../../../pwa/src/components/admin/AdminPaymentsClient.tsx#L373) | 期限の近い順。金額・期日・納付済みの正本は支払義務台帳で、この画面からは直せない。 |
| [MemberPayoutBreakdownModal.tsx:412](../../../pwa/src/components/admin/MemberPayoutBreakdownModal.tsx#L412) | 表示している金額は保存済みの報酬計算 ( |
| [SxWeeklyControlDashboard.tsx:5144](../../../pwa/src/components/project-workspace/SxWeeklyControlDashboard.tsx#L5144) | タスクを削除したよ。DBへ同期中 |
| [SxWeeklyControlDashboard.tsx:5181](../../../pwa/src/components/project-workspace/SxWeeklyControlDashboard.tsx#L5181) | MSを削除したよ。DBへ同期中 |
| [SxUnifiedTimeline.tsx:1387](../../../pwa/src/components/project-workspace/SxUnifiedTimeline.tsx#L1387) | 依存線を外したよ。DBへ同期中 |
| [CashLedgerPanel.tsx:650](../../../pwa/src/components/admin/cash/CashLedgerPanel.tsx#L650) | 残高はこの画面が毎回その場で足し引きして出している |
| [CockpitCostModel.tsx:428](../../../pwa/src/components/cockpit/CockpitCostModel.tsx#L428) | 書き換えた数字の一覧。「この値を保存」を押すと正本に書き、全員の画面に反映される。 |
| [CockpitMonthlyModal.tsx:1712](../../../pwa/src/components/cockpit/CockpitMonthlyModal.tsx#L1712) | 報酬サマリーをSupabaseへ保存中... |
| [CockpitFuelCostModel.tsx:366](../../../pwa/src/components/cockpit/CockpitFuelCostModel.tsx#L366) | 書き換えた数字の一覧。「この値を保存」を押すと正本に書き、全員の画面に反映される。 |
| [ProjectCostFormat.tsx:279](../../../pwa/src/components/cockpit/ProjectCostFormat.tsx#L279) | 書き換えた数字の一覧。「この値を保存」を押すと正本に書き、全員の画面に反映される。 |
| [page.tsx:84](../../../pwa/src/app/(app)/institutions/[institutionId]/regulations/[regulationId]/page.tsx#L84) | 外部正本が未登録のため、OS内の管理情報を表示している。 |

支払通知書の送信前確認（AdminPayoutsClient）、ログインリンクを同じブラウザで開く案内、候補採否の変更対象、未確認/未入力、報酬計算時点、根拠資料リンク、理論/設計書の参照先そのものは削除対象としない。

## ネイティブ：表示文言の候補一覧（129箇所）

iOS 1、Mac版128。PWAとの同等性、保存先、API/RLS/DB等を説明する文を記録。個々の操作上必要な範囲・制約を保って簡略化する。今回ネイティブの実装・起動・配布は変更していない。

| プラットフォーム | 場所 | 現行文言 |
|---|---|---|
| iOS | [MilestoneManagementSheet.swift:87](../../../ios/AMDOS/Features/Cockpit/MilestoneManagementSheet.swift#L87) | PWAのMS管理に合わせて、タイトル・pt・達成条件・サブ項目をここで更新できます。保存時に sub item と progress も反映します。 |
| Mac | [AMDOSMacApp.swift:125](../../../macos/AMDOSMac/AMDOSMacApp.swift#L125) | 既存のSupabase認証・権限境界を使うよ。PJ限定ログインは招待されたPJだけを表示する。 |
| Mac | [AdminFeatureViews.swift:39](../../../macos/AMDOSMac/Features/AdminFeatureViews.swift#L39) | 各画面は管理者認証を通したPWA APIまたはRLS付き読み取りだけを使う。 |
| Mac | [AdminFeatureViews.swift:237](../../../macos/AMDOSMac/Features/AdminFeatureViews.swift#L237) | PWA Admin Companyと同じレビュー待ちキューを、プロフィール・チーム・沿革・メディアに分けて確認 |
| Mac | [AdminFeatureViews.swift:292](../../../macos/AMDOSMac/Features/AdminFeatureViews.swift#L292) | PWA AdminMembersTableの members.id + patch 契約で更新 |
| Mac | [AdminFeatureViews.swift:316](../../../macos/AMDOSMac/Features/AdminFeatureViews.swift#L316) | 口座情報はPWAのメンバー台帳にも編集経路がないため、ここでは変更しない。 |
| Mac | [AdminFeatureViews.swift:443](../../../macos/AMDOSMac/Features/AdminFeatureViews.swift#L443) | PWAの支払義務・継続支払い・領収書実績同期を同じ管理APIで扱う |
| Mac | [AdminFeatureViews.swift:602](../../../macos/AMDOSMac/Features/AdminFeatureViews.swift#L602) | 金額未確認を0円にせず、PWA obligations PATCHへ保存 |
| Mac | [AdminFeatureViews.swift:616](../../../macos/AMDOSMac/Features/AdminFeatureViews.swift#L616) | PWA recurring PATCH / 予算同期 |
| Mac | [AdminFeatureViews.swift:1232](../../../macos/AMDOSMac/Features/AdminFeatureViews.swift#L1232) | PWAと同じく、数字以外を除いて6桁まで保存する。空欄は稼働月 \(cycle.ym) に戻す。 |
| Mac | [AdminFeatureViews.swift:2060](../../../macos/AMDOSMac/Features/AdminFeatureViews.swift#L2060) | 支払通知書の発行・保存済みPDF確認・送付内容確認を、PWAと同じ権限境界で扱う |
| Mac | [AdminFeatureViews.swift:2159](../../../macos/AMDOSMac/Features/AdminFeatureViews.swift#L2159) | 最新DBの住所・宛名・登録番号で、差分検出を無視して再生成するよ。金額が変わっていなくても、台帳やラベルの修正を反映したい時だけ使ってね。 |
| Mac | [AdminFeatureViews.swift:2165](../../../macos/AMDOSMac/Features/AdminFeatureViews.swift#L2165) | PWAと同じ保存処理で、報酬キャッシュを再計算して monthly_reward_payout と未送付の payout_notices を月次スナップショットへ同期する。送付済み通知書は履歴保護のため更新しない。 |
| Mac | [AdminFeatureViews.swift:2190](../../../macos/AMDOSMac/Features/AdminFeatureViews.swift#L2190) | 対象はPWA APIと同じ。最新の支払明細に加えて、既存の未送付通知書も含める。送付済み、通知除外、役員は除く。 |
| Mac | [AdminFeatureViews.swift:2219](../../../macos/AMDOSMac/Features/AdminFeatureViews.swift#L2219) | 確認用PDFはDB保存なし・正式PDFは更新しない。本番PDFは最新スナップショットを同期してから正式PDFを更新する。 |
| Mac | [AdminFeatureViews.swift:3614](../../../macos/AMDOSMac/Features/AdminFeatureViews.swift#L3614) | 1契約1行で、実務条件・版履歴・抽出根拠をPWAと同じ管理境界で扱う |
| Mac | [AdminFeatureViews.swift:4378](../../../macos/AMDOSMac/Features/AdminFeatureViews.swift#L4378) | PWAと同じactive文化コンテンツを、カテゴリ階層または都道府県からたどる |
| Mac | [AdminFeatureViews.swift:4381](../../../macos/AMDOSMac/Features/AdminFeatureViews.swift#L4381) | jp_culture_items テーブルにコンテンツを追加してください |
| Mac | [AdminFeatureViews.swift:4422](../../../macos/AMDOSMac/Features/AdminFeatureViews.swift#L4422) | PWA admin monthly-work-agreementsのメンバー別状態・再合意・レビュー件数 |
| Mac | [AdminFeatureViews.swift:4426](../../../macos/AMDOSMac/Features/AdminFeatureViews.swift#L4426) | PWA admin/private-wikiのadmin_private境界で人物情報を作成・確認 |
| Mac | [AdminFeatureViews.swift:4432](../../../macos/AMDOSMac/Features/AdminFeatureViews.swift#L4432) | PWA management-knowledgeの分類・成熟度・再利用条件と本文を保存 |
| Mac | [AdminFeatureViews.swift:4467](../../../macos/AMDOSMac/Features/AdminFeatureViews.swift#L4467) | PWAと同じ候補・確定・アーカイブ、具体事例、結果観測をここで扱う |
| Mac | [AdminFeatureViews.swift:4474](../../../macos/AMDOSMac/Features/AdminFeatureViews.swift#L4474) | PWAと同じく、新形式の候補とは分けて扱うよ。再抽出するか、まとめてアーカイブできる。 |
| Mac | [AdminFeatureViews.swift:4479](../../../macos/AMDOSMac/Features/AdminFeatureViews.swift#L4479) | outcome ledger はまだ空だよ。PWAと同じく、ここでは既存観測の上書きや追加はしない。 |
| Mac | [AdminFeatureViews.swift:4512](../../../macos/AMDOSMac/Features/AdminFeatureViews.swift#L4512) | 正本から再生成し、根拠を添えた行動履歴だけをPWA APIへ記録する |
| Mac | [AdminFeatureViews.swift:4534](../../../macos/AMDOSMac/Features/AdminFeatureViews.swift#L4534) | PWAと同じく、支払義務の行動履歴はこの画面から追加できない。 |
| Mac | [AdminFeatureViews.swift:4572](../../../macos/AMDOSMac/Features/AdminFeatureViews.swift#L4572) | 請求・バッファ・メンバー原資・AMDマージン・pt比予実をPWAと同じ検算で確認 |
| Mac | [AdminFeatureViews.swift:4654](../../../macos/AMDOSMac/Features/AdminFeatureViews.swift#L4654) | Gmail / Calendar / 議事録から抽出された活動を、PWA同様にPJ × メンバーで集約 |
| Mac | [AdminFeatureViews.swift:4767](../../../macos/AMDOSMac/Features/AdminFeatureViews.swift#L4767) | 管理ページのコンテキスト・学習・質問導線を、実在するPWA APIへ接続 |
| Mac | [AdminFeatureViews.swift:4789](../../../macos/AMDOSMac/Features/AdminFeatureViews.swift#L4789) | PWA governanceのプロジェクト選択・会社概要・株主・要対応を同じ認可経路で確認 |
| Mac | [AdminFeatureViews.swift:4843](../../../macos/AMDOSMac/Features/AdminFeatureViews.swift#L4843) | PWAと同じ追加・削除操作を認可済みAPIへ委譲 |
| Mac | [AdminFeatureViews.swift:5100](../../../macos/AMDOSMac/Features/AdminFeatureViews.swift#L5100) | PWAと同じ保存前reward検算を通して、MS・担当share・役割・タスクを一括編集 |
| Mac | [AdminFeatureViews.swift:5313](../../../macos/AMDOSMac/Features/AdminFeatureViews.swift#L5313) | settings RLSの読み書きと、PWA settings/cron-runの操作境界 |
| Mac | [AdminSettingsTsukuyomiParityViews.swift:221](../../../macos/AMDOSMac/Features/AdminSettingsTsukuyomiParityViews.swift#L221) | Raw / L2 / Cron Control とDB設定をPWA共有の管理境界で扱う |
| Mac | [AdminSettingsTsukuyomiParityViews.swift:239](../../../macos/AMDOSMac/Features/AdminSettingsTsukuyomiParityViews.swift#L239) | この操作はPWAと同じく設定レコードを削除するよ。 |
| Mac | [AdminSettingsTsukuyomiParityViews.swift:245](../../../macos/AMDOSMac/Features/AdminSettingsTsukuyomiParityViews.swift#L245) | PWAの運用カタログ。停止中の操作はここから起動せず、既存のCodex/レビュー導線を使う。 |
| Mac | [AdminSettingsTsukuyomiParityViews.swift:624](../../../macos/AMDOSMac/Features/AdminSettingsTsukuyomiParityViews.swift#L624) | PWAの投稿ブリッジは未実装のまま。Mac側も投稿操作を有効化しない。 |
| Mac | [ReferenceFeatureViews.swift:212](../../../macos/AMDOSMac/Features/ReferenceFeatureViews.swift#L212) | PWAの正本markdownを章一覧から選び、同じslugで読む |
| Mac | [ReferenceFeatureViews.swift:295](../../../macos/AMDOSMac/Features/ReferenceFeatureViews.swift#L295) | PWAと同じ章の構成・順序・状態を表示。未着手のBZM章もここから開ける。 |
| Mac | [ReferenceFeatureViews.swift:346](../../../macos/AMDOSMac/Features/ReferenceFeatureViews.swift#L346) | PWAと同じ未着手章。本文が追加されるまで、章の概要と完成済み章を確認できる。 |
| Mac | [ReferenceFeatureViews.swift:567](../../../macos/AMDOSMac/Features/ReferenceFeatureViews.swift#L567) | PWAと同じgit管理Markdownを、テーマ・目次・本文検索から横断して読む |
| Mac | [ReferenceFeatureViews.swift:569](../../../macos/AMDOSMac/Features/ReferenceFeatureViews.swift#L569) | AMD OS の使い方・データの裏側・過去判断・開発手順の正本。テーマから入り、気になる章へ横移動しながら全体像を掴む。 |
| Mac | [ReferenceFeatureViews.swift:680](../../../macos/AMDOSMac/Features/ReferenceFeatureViews.swift#L680) | PWA Markdown正本 |
| Mac | [ExploreParityFeatureViews.swift:1345](../../../macos/AMDOSMac/Features/ExploreParityFeatureViews.swift#L1345) | PWAのPoC Hubと同じ研究シーズ × PoC先の組み合わせ、ヒアリング、PoC設計、案件化ステータスを操作する |
| Mac | [ExploreParityFeatureViews.swift:1638](../../../macos/AMDOSMac/Features/ExploreParityFeatureViews.swift#L1638) | PWAのLv1–5 / N/A・根拠メモと制度整備・規程比較を、同じAPIへ自動保存 |
| Mac | [ExploreParityFeatureViews.swift:2293](../../../macos/AMDOSMac/Features/ExploreParityFeatureViews.swift#L2293) | PWAと同じ材料台帳・118元素・知識ノードを、読み取り専用で横断する |
| Mac | [ExploreParityFeatureViews.swift:2310](../../../macos/AMDOSMac/Features/ExploreParityFeatureViews.swift#L2310) | 採掘形態・副産物構造・精製工程を、PWAと同じ材料台帳から確認する。 |
| Mac | [ExploreParityFeatureViews.swift:2556](../../../macos/AMDOSMac/Features/ExploreParityFeatureViews.swift#L2556) | PWAのKnowledge Mapと同じ、Protocol・PJ知識・人・MTG・Signal・XRL・月次・教科書化候補を一つの地図として読む。raw全文は入れない。 |
| Mac | [ExploreParityFeatureViews.swift:3133](../../../macos/AMDOSMac/Features/ExploreParityFeatureViews.swift#L3133) | PWA fetchVcListと同じく、VC・ファンド・AMD PJ出資・コンタクト・接触日・未確認ニュースを集約 |
| Mac | [ExploreParityFeatureViews.swift:3262](../../../macos/AMDOSMac/Features/ExploreParityFeatureViews.swift#L3262) | PWA VcDetailBody / VcEditBodyのファンド・出資先・担当者・PJ関係・ニュースを読み書きする |
| Mac | [ExploreParityFeatureViews.swift:3808](../../../macos/AMDOSMac/Features/ExploreParityFeatureViews.swift#L3808) | PWAの未確認ニュースをVerify / Dismissし、提案ファンドを同じRLS境界へ反映 |
| Mac | [ExploreParityFeatureViews.swift:4369](../../../macos/AMDOSMac/Features/ExploreParityFeatureViews.swift#L4369) | PWAの会社全体スコア・月次試算表・根拠・経営シグナルを同じデータ境界で確認 |
| Mac | [ExploreParityFeatureViews.swift:4408](../../../macos/AMDOSMac/Features/ExploreParityFeatureViews.swift#L4408) | amd_management_score_snapshots に現在月以前のsnapshotがありません。PWAと同じく最新のraw収集・再計算を確認してね。 |
| Mac | [ExploreParityFeatureViews.swift:4419](../../../macos/AMDOSMac/Features/ExploreParityFeatureViews.swift#L4419) | PWAと同じlive inputを取得して、保存せず既存のfinance simulation APIで再計算する。  |
| Mac | [ExploreParityFeatureViews.swift:4855](../../../macos/AMDOSMac/Features/ExploreParityFeatureViews.swift#L4855) | PWAのatlas_decisionsと同じ判断・理由・振り返り予定・結果を記録する |
| Mac | [ExploreParityFeatureViews.swift:6153](../../../macos/AMDOSMac/Features/ExploreParityFeatureViews.swift#L6153) | PWAと同じストーリー・シグナルを、検索・整理・統合する |
| Mac | [ExploreParityFeatureViews.swift:6435](../../../macos/AMDOSMac/Features/ExploreParityFeatureViews.swift#L6435) | 「\(source.title)」のシグナルを統合先に移し、このストーリーを閉じる。PWAの `/api/atlas/merge-stories` と同じ処理だよ。 |
| Mac | [ExploreParityFeatureViews.swift:6567](../../../macos/AMDOSMac/Features/ExploreParityFeatureViews.swift#L6567) | PWAと同じ inbox → accepted / held / rejected の審査境界 |
| Mac | [ExploreParityFeatureViews.swift:6643](../../../macos/AMDOSMac/Features/ExploreParityFeatureViews.swift#L6643) | PWAと同じく、すべての inbox シグナルを accepted へ更新する |
| Mac | [ExploreParityFeatureViews.swift:6674](../../../macos/AMDOSMac/Features/ExploreParityFeatureViews.swift#L6674) | 全方位アンテナの根拠URLを必須にして、PWAと同じInboxへ送る |
| Mac | [ExploreParityFeatureViews.swift:6828](../../../macos/AMDOSMac/Features/ExploreParityFeatureViews.swift#L6828) | 世界×日本のズレマップで使うテーマを、PWAの管理APIで編集・確定する |
| Mac | [ExploreParityFeatureViews.swift:6852](../../../macos/AMDOSMac/Features/ExploreParityFeatureViews.swift#L6852) | 既存ストーリーをPWAのテーマクラスタリングAPIで解析する。候補を確認・編集して「テーマ確定」を押すまでDBには保存しない。 |
| Mac | [ExploreParityFeatureViews.swift:6965](../../../macos/AMDOSMac/Features/ExploreParityFeatureViews.swift#L6965) | 世界の動き × 日本の動き × ギャップをPWAと同じ atlas_divergences から確認 |
| Mac | [WorkParityFeatureViews.swift:675](../../../macos/AMDOSMac/Features/WorkParityFeatureViews.swift#L675) | PWAのOS通知・要対応・L2抽出・MTGレビューを同じ認可境界で確認する |
| Mac | [WorkParityFeatureViews.swift:1030](../../../macos/AMDOSMac/Features/WorkParityFeatureViews.swift#L1030) | PWAと同じ submitted → PM承認 → admin承認の申請・承認フロー |
| Mac | [WorkParityFeatureViews.swift:1502](../../../macos/AMDOSMac/Features/WorkParityFeatureViews.swift#L1502) | PWAのOCR候補→人手確認→PJ知識同期。確認APIの全フィールドとPJ 1件以上の必須条件を保持 |
| Mac | [WorkParityFeatureViews.swift:2271](../../../macos/AMDOSMac/Features/WorkParityFeatureViews.swift#L2271) | PWAと同じメンバー認可で、当月報酬・6か月の担当PJ・MS進捗・今週の活動を確認 |
| Mac | [WorkParityFeatureViews.swift:2293](../../../macos/AMDOSMac/Features/WorkParityFeatureViews.swift#L2293) | \(store.weeklyActivities.count) 件 · PWAの週次抽出結果 |
| Mac | [WorkParityFeatureViews.swift:2431](../../../macos/AMDOSMac/Features/WorkParityFeatureViews.swift#L2431) | PWAのA-J集約APIから、本文・進捗・会議・体制・財務・添付を同じ月次単位で確認 |
| Mac | [WorkParityFeatureViews.swift:4342](../../../macos/AMDOSMac/Features/WorkParityFeatureViews.swift#L4342) | PWA CockpitViewの進捗・スコア・会社概要・月次判断を、プロジェクト単位の実データで操作 |
| Mac | [WorkParityFeatureViews.swift:4583](../../../macos/AMDOSMac/Features/WorkParityFeatureViews.swift#L4583) | PJイベントはまだないよ。PWAと同じイベントを追加すると、スコア・XRLの根拠に使える。 |
| Mac | [WorkParityFeatureViews.swift:4842](../../../macos/AMDOSMac/Features/WorkParityFeatureViews.swift#L4842) | PWA MonthlyModalと同じ /api/progress/confirm の manual 操作。保存はこのMSだけに反映する。 |
| Mac | [WorkParityFeatureViews.swift:4862](../../../macos/AMDOSMac/Features/WorkParityFeatureViews.swift#L4862) | 進捗の保存・推定・採否はPWAと同じadmin権限が必要だよ |
| Mac | [WorkParityFeatureViews.swift:5108](../../../macos/AMDOSMac/Features/WorkParityFeatureViews.swift#L5108) | PWA project-documents API |
| Mac | [WorkParityFeatureViews.swift:5274](../../../macos/AMDOSMac/Features/WorkParityFeatureViews.swift#L5274) | PWAと同じ助成金台帳で編集する。 |
| Mac | [WorkParityFeatureViews.swift:5290](../../../macos/AMDOSMac/Features/WorkParityFeatureViews.swift#L5290) | PWAと同じ会議履歴・予定MTGを確認できる。 |
| Mac | [WorkParityFeatureViews.swift:5408](../../../macos/AMDOSMac/Features/WorkParityFeatureViews.swift#L5408) | PWAと同じ project_events を更新する |
| Mac | [WorkParityFeatureViews.swift:5441](../../../macos/AMDOSMac/Features/WorkParityFeatureViews.swift#L5441) | 構造化はプレビューで確認してから保存する。保存される本文とmetaはPWAと同じイベント行に入る。 |
| Mac | [WorkParityFeatureViews.swift:5480](../../../macos/AMDOSMac/Features/WorkParityFeatureViews.swift#L5480) | 削除後はPWAと同じイベント履歴・グラフから消える。 |
| Mac | [WorkParityFeatureViews.swift:5753](../../../macos/AMDOSMac/Features/WorkParityFeatureViews.swift#L5753) | PWAと同じ対話型修正依頼。提案の生成・やり直しでは保存せず、「適用」で初めて正本を更新するよ。 |
| Mac | [WorkParityFeatureViews.swift:6430](../../../macos/AMDOSMac/Features/WorkParityFeatureViews.swift#L6430) | 添付の作成・変更・削除はPWAと同じくadmin権限が必要 |
| Mac | [WorkParityFeatureViews.swift:10123](../../../macos/AMDOSMac/Features/WorkParityFeatureViews.swift#L10123) | 資本政策マトリクス・検算・凍結版はこのプランを正本として編集する。保存は800ms後にPWA APIへ直列送信する。 |
| Mac | [WorkParityFeatureViews.swift:11180](../../../macos/AMDOSMac/Features/WorkParityFeatureViews.swift#L11180) | PWA /dashboard の判断、PJ比較、請求、経営スコア、研究機関ECR、会社コンテンツ |
| Mac | [AdminScheduleParityView.swift:177](../../../macos/AMDOSMac/Features/AdminScheduleParityView.swift#L177) | 正本から生成した期限を確認し、日付・金額・担当者はここで直接変更しない |
| Mac | [AdminScheduleParityView.swift:184](../../../macos/AMDOSMac/Features/AdminScheduleParityView.swift#L184) | 正本テーブルの読み込みに失敗している項目があるよ。生成元を確認してから再生成して。 |
| Mac | [AdminScheduleParityView.swift:409](../../../macos/AMDOSMac/Features/AdminScheduleParityView.swift#L409) | 支払義務の完了は既存の支払正本で更新する。ここから行動履歴は追加できない。 |
| Mac | [PoCParityFeatureViews.swift:570](../../../macos/AMDOSMac/Features/PoCParityFeatureViews.swift#L570) | PWAと同じシーズ・PoC先・案件候補を並べ、ヒアリング、謝礼、契約、資金、収益分配まで追う |
| Mac | [VentureParityFeatureViews.swift:252](../../../macos/AMDOSMac/Features/VentureParityFeatureViews.swift#L252) | PWAと同じ AMD Score = K·M·X·F のlog寄与空間。M=σ_SU、X=XRL5、F=FRLを正規化して表示する |
| Mac | [VentureParityFeatureViews.swift:481](../../../macos/AMDOSMac/Features/VentureParityFeatureViews.swift#L481) | PWA CoupledOscillatorと同じ P / B / I_R / N / V / R、Velocity Verlet、年月スクラバー、外力・恒久シフト |
| Mac | [VentureParityFeatureViews.swift:746](../../../macos/AMDOSMac/Features/VentureParityFeatureViews.swift#L746) | PWA現行の n=3（学・産・官）/ m=6（P・B・V・R・I_R・N）/ p=3（海外政策・災害・地政学）を同じseedで再計算する |
| Mac | [VentureParityFeatureViews.swift:856](../../../macos/AMDOSMac/Features/VentureParityFeatureViews.swift#L856) | PWA SuDetailViewのventure概要、XRL 5層、レーン別マクロ指数を同時に読む |
| Mac | [VentureParityFeatureViews.swift:951](../../../macos/AMDOSMac/Features/VentureParityFeatureViews.swift#L951) | PWAと同じ公開SU × XRL 5層（TRL / BRL / HRL / GRL / SRL）の積層時系列。選ぶとSU詳細を開ける |
| Mac | [VentureParityFeatureViews.swift:1360](../../../macos/AMDOSMac/Features/VentureParityFeatureViews.swift#L1360) | PWAのView A〜Cを、project_ventures・macro_index_log・papers_log・macro_lane_weightsの実データから読む |
| Mac | [VentureParityFeatureViews.swift:1407](../../../macos/AMDOSMac/Features/VentureParityFeatureViews.swift#L1407) | 縦軸=マクロ指数（実線）/ 論文数（破線）、ピン=公開SUの設立タイミング。PWAと同じ基準系列を表示し、Supabase実測がある年だけその値で上書きする。 |
| Mac | [VentureParityFeatureViews.swift:1654](../../../macos/AMDOSMac/Features/VentureParityFeatureViews.swift#L1654) | PWAと同じ5領域の指標集計。総合温度 = 0.4·マクロ + 0.2·論文 + 0.2·政策 + 0.2·投資密度（投資密度はPWAの現行算出式どおりマクロと論文の中間値）。 |
| Mac | [VentureParityFeatureViews.swift:2363](../../../macos/AMDOSMac/Features/VentureParityFeatureViews.swift#L2363) | PWAのSPS primary一覧。P/R_net未入力はスコアを出さず、review待ちとして残す |
| Mac | [VentureParityFeatureViews.swift:2471](../../../macos/AMDOSMac/Features/VentureParityFeatureViews.swift#L2471) | PWA AmdScoreViewのSPS hero、M/P/R/S・Legacy M×X×F、時系列、根拠、Tsukuyomi修正導線 |
| Mac | [VentureParityFeatureViews.swift:2478](../../../macos/AMDOSMac/Features/VentureParityFeatureViews.swift#L2478) | 評価行がありません。PWAと同じく、評価行がない状態ではSPSを算出しない。 |
| Mac | [VentureParityFeatureViews.swift:2507](../../../macos/AMDOSMac/Features/VentureParityFeatureViews.swift#L2507) | 評価値が未入力のため表示できるスコアがありません。NULLを0として偽装しない。 |
| Mac | [VentureParityFeatureViews.swift:2568](../../../macos/AMDOSMac/Features/VentureParityFeatureViews.swift#L2568) | 空欄はNULLとして保存し、PWAと同じくスコアを表示しない。入力値は最新評価行へ保存する。 |
| Mac | [VentureParityFeatureViews.swift:2620](../../../macos/AMDOSMac/Features/VentureParityFeatureViews.swift#L2620) | PWAと同じく、値を直接書き換えずに各軸をクリックしてつくよみに根拠付きの修正を依頼する。 |
| Mac | [VentureParityFeatureViews.swift:2674](../../../macos/AMDOSMac/Features/VentureParityFeatureViews.swift#L2674) | \(axis.label) の値を直接更新しない。PWAと同じつくよみの `update_amd_score_input` 経路に依頼する。 |
| Mac | [VentureParityFeatureViews.swift:2862](../../../macos/AMDOSMac/Features/VentureParityFeatureViews.swift#L2862) | 評価行がまだない。PWAと同じく、先にAMD Scoreの評価行を作成してから使う。 |
| Mac | [VentureParityFeatureViews.swift:3083](../../../macos/AMDOSMac/Features/VentureParityFeatureViews.swift#L3083) | PWA AmdScoreRetrofitと同じく、αを変更したときの全PJ Legacy scoreをシミュレーションし、保存する |
| Mac | [ScreenViews.swift:315](../../../macos/AMDOSMac/Features/ScreenViews.swift#L315) | PWAと同じSupabaseセッション・認可境界で接続 |
| Mac | [WorkspaceView.swift:38](../../../macos/AMDOSMac/Features/WorkspaceView.swift#L38) | PWAの仕事をMacで続ける |
| Mac | [AdminPrivateWikiPromptsParityViews.swift:624](../../../macos/AMDOSMac/Features/AdminPrivateWikiPromptsParityViews.swift#L624) | プロンプト本文をコードへ戻さず、PWAと同じ管理APIで編集する |
| Mac | [AdminPrivateWikiPromptsParityViews.swift:703](../../../macos/AMDOSMac/Features/AdminPrivateWikiPromptsParityViews.swift#L703) | PWAと同じく、この一覧は参照専用。正本はスプシ側で管理する。 |
| Mac | [WorkFeatureViews.swift:110](../../../macos/AMDOSMac/Features/WorkFeatureViews.swift#L110) | 報酬額や個人情報はPWAと同じ認可境界で表示するよ。 |
| Mac | [WorkFeatureViews.swift:172](../../../macos/AMDOSMac/Features/WorkFeatureViews.swift#L172) | PWAと同じadmin認可の保存経路で、請求・報告・支払条件を更新 |
| Mac | [WorkFeatureViews.swift:189](../../../macos/AMDOSMac/Features/WorkFeatureViews.swift#L189) | 除外と違い、このPJのメンバー行がDBから消える。業務記録があれば次に件数を表示して、強制削除の確認を取るよ。 |
| Mac | [WorkFeatureViews.swift:305](../../../macos/AMDOSMac/Features/WorkFeatureViews.swift#L305) | PJの月次報告を読み、必要なら既存の生成・修正APIへ依頼 |
| Mac | [WorkFeatureViews.swift:319](../../../macos/AMDOSMac/Features/WorkFeatureViews.swift#L319) | admin-onlyのPWA通知配送。認可拒否・配送失敗と0件を分けて表示 |
| Mac | [WorkFeatureViews.swift:327](../../../macos/AMDOSMac/Features/WorkFeatureViews.swift#L327) | PJ・発生日・摘要・領収書をそろえて、PWAの申請APIへ送信 |
| Mac | [WorkFeatureViews.swift:370](../../../macos/AMDOSMac/Features/WorkFeatureViews.swift#L370) | PWAと同じ月次snapshotの担当内容と予定額を確認して合意する |
| Mac | [WorkFeatureViews.swift:411](../../../macos/AMDOSMac/Features/WorkFeatureViews.swift#L411) | この月に担当するPJとマイルストーンを、PWAと同じsnapshotから表示してるよ。 |
| Mac | [WorkFeatureViews.swift:567](../../../macos/AMDOSMac/Features/WorkFeatureViews.swift#L567) | PWA ContractsClientと同じadmin API。契約・証跡・シグナルを分けて確認 |
| Mac | [WorkFeatureViews.swift:610](../../../macos/AMDOSMac/Features/WorkFeatureViews.swift#L610) | approved internalの会社プロフィール・チーム・沿革を、PWA Companyと同じRLSで読む |
| Mac | [ExploreFeatureViews.swift:88](../../../macos/AMDOSMac/Features/ExploreFeatureViews.swift#L88) | requireAuthのauto-tagでタグを得て、atlas_signals RLS insertへ送る |
| Mac | [ExploreFeatureViews.swift:98](../../../macos/AMDOSMac/Features/ExploreFeatureViews.swift#L98) | discovered候補をRLS updateで確認・見送りする |
| Mac | [ExploreFeatureViews.swift:163](../../../macos/AMDOSMac/Features/ExploreFeatureViews.swift#L163) | 未確認vc_newsをRLS updateで確認・見送りする |
| Mac | [ExploreFeatureViews.swift:194](../../../macos/AMDOSMac/Features/ExploreFeatureViews.swift#L194) | 既存の評価データを壊さず、再計算APIを確認付きで実行 |
| Mac | [ExploreFeatureViews.swift:286](../../../macos/AMDOSMac/Features/ExploreFeatureViews.swift#L286) | PWAの6要素連成振動を、時間・外力・ジャンプ操作で再現 |
| Mac | [ExploreFeatureViews.swift:287](../../../macos/AMDOSMac/Features/ExploreFeatureViews.swift#L287) | PWA Triple HelixのA行列を操作し、状態軌道と安定性を確認 |
| Mac | [ExploreFeatureViews.swift:289](../../../macos/AMDOSMac/Features/ExploreFeatureViews.swift#L289) | PWAのSU/XRL時系列をプロジェクト選択と期間フィルターで読む |
| Mac | [AdminP2ParityViews.swift:230](../../../macos/AMDOSMac/Features/AdminP2ParityViews.swift#L230) | PWAと同じ判断カードを、分類・成熟度・出典・再利用条件ごとに編集する |
| Mac | [AdminP2ParityViews.swift:233](../../../macos/AMDOSMac/Features/AdminP2ParityViews.swift#L233) | PJをまたいで再利用する判断カード。保存・archive は PWA の admin API だけを使うよ。 |
| Mac | [AdminP2ParityViews.swift:700](../../../macos/AMDOSMac/Features/AdminP2ParityViews.swift#L700) | PWAと同じ月のメンバー別合意状態、修正要望、支払・未払い残を確認する |
| Mac | [AdminP2ParityViews.swift:895](../../../macos/AMDOSMac/Features/AdminP2ParityViews.swift#L895) | PWAと同じく、ここは読み取りと再現性指標だけ。採否の操作は通知で続けるよ。 |
