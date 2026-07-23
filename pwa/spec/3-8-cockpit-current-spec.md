# PJ Cockpit 仕様

> **この章は何か**: `/project/[projectId]/cockpit` の current contract。PJ の状態、月次運用、MS、経営ハイライト、AMD Score、MTGサマリを集約する中心画面。

## Route / Files

| route | file |
|---|---|
| `/project/[projectId]/cockpit` | `pwa/src/app/(app)/project/[projectId]/cockpit/page.tsx` |
| `/project/[projectId]/workspace` | `pwa/src/app/(app)/project/[projectId]/workspace/page.tsx`。PJ限定メンバーにも共有できる研究開発ダッシュボード |
| `/my-projects` | `pwa/src/app/(app)/my-projects/page.tsx`。複数PJへ参加するPJ限定メンバーの入口 |
| `/institutions/[institutionId]/cockpit` | `pwa/src/app/(app)/institutions/[institutionId]/cockpit/page.tsx` wraps an existing project cockpit in institution context |
| main component | `pwa/src/components/cockpit/CockpitView.tsx` |
| data fetch | `pwa/src/lib/supabase-data.ts` (`fetchCockpitFromSupabase`) |
| project documents | `pwa/src/components/cockpit/CockpitProjectDocuments.tsx`, `pwa/src/app/api/project-documents/route.ts` |

## Data Bundle

`CockpitView` receives:

| field | meaning |
|---|---|
| `project` | `project_id`, name, status, category, fee/freeze info, payment terms, `contract_terms_json` summary |
| `currentYm` | current display month |
| `billingCycles` | monthly / finance state |
| `planCycle` / `milestones` / `subItems` / `responsibilities` | value plan and MS。`planCycle.budgetYen` と、同期間の `billing_cycles.extra_budget_yen` 合計で作る `planCycle.extraDesignBudgetYen` を使い、MSリストに本契約/別財布それぞれの設計額と、メンバー別の担当設計額を表示する |
| `progress` | `milestone_monthly_progress` |
| `reports` | `monthly_reports` excerpts and status |
| `members` / `memberMap` | PJ member display |
| `seasonFinance` | current plan cycle のシーズン収支。月次とシーズン合計で、クライアント支払、バッファ、PJ予算、メンバー現金支払、外部メンバー向け未払残、現金収支を返す。役員向け報酬相当額・役員繰越・予算残は検算用データとして保持するが、PJ cockpit では表示しない |
| `msChangeHistory` | `/admin/ms-overview` 保存時に `milestone_change_events` へ残るMS変更履歴。cockpit では折りたたみ確認専用で、変更日時、記録者、MS差分、担当share差分、保存前支払検算サマリを表示する |
| `strategySignals` | L2D-6 `project_strategy_signals` |
| `tasks` | legacy kanban / H-1互換 task。通常PJ cockpit の主要表示には使わない |

`proactive_outbox` / `proactive_loops` / `proactive_loop_events` は 2026-06-27 に廃止済みの旧先手力ループであり、通常PJ / institution cockpit には表示しない。先手TODOの棚卸しは `proactive_todos` を使う `/proactive` と dashboard 上段バッジで扱う。旧 `ProactiveQueuePanel` を cockpit に戻さない。

`project_documents` も `CockpitData` bundle には混ぜず、`CockpitProjectDocuments` が `/api/project-documents?project_id=...` を fetch する。API は authenticated user の `members.email` を `project_members` に解決し、当該PJの active member または admin なら資料一覧を返す。ファイル本体は DB / Supabase Storage に置かず、Google Drive の `projects.drive_folder_id` 配下に作成する資料専用 folder (`AMD OS 資料`) へ保存し、DB には Drive file ID / folder ID / `webViewLink` / name / MIME / size / uploaded_by / timestamps だけを残す。

`tsukuyomi_nudge_queue` は通常PJ / institution cockpit の `CockpitView` へ渡さず、`CockpitNudge` カードも表示しない。既存の `fetchCockpitFromSupabase` が互換用に `nudges` を返す場合でも、この画面では読まない。HUD / dashboard 実験面で同じ queue を使う場合は、それぞれの専用コンポーネントの契約として扱う。

## Permission / Mutation Boundary

`/project/[projectId]/cockpit` は従来どおりAMD内部面。外部のPJ限定メンバーへは公開しない。共有面は `/project/[projectId]/workspace` に分離し、`members.os_access_scope='project'` と active `project_members` の両方で対象PJを限定する。

PJ限定ログインはGoogle OAuthで本人確認した直後に通常のSupabase sessionを破棄し、7日間のHTTP-only署名付きPJセッションへ交換する。署名だけに依存せず、各requestで `members.status='active'`、scope、member ID、active PJ membershipをservice側で再検証する。既存社内テーブルの広いauthenticated RLSを外部ユーザーへ継承させない。`amd_os_is_member()` も `portfolio` / adminだけをtrueにする。

共有ダッシュボードが返す範囲は、PJ名、参加メンバーの表示名 / 役割、週次予定・実績時間、5区分の配分、MS名 / 進捗、抽出済み活動の件数 / source種別 / 最終日。raw本文、source URL、email、契約、請求、報酬、経営ハイライト、会社概要、他PJ情報はDTOへ含めない。PJ限定メンバーのwriteは自分の `project_weekly_effort_entries` だけ、portfolio/adminは当該PJのactive member分を更新できる。

月次 routine 専用の `canEditRoutine` 判定は廃止。`/project/[projectId]/cockpit` / `/hud/project/[projectId]/cockpit` / `/institutions/[institutionId]/cockpit` の page route は PM/admin 判定を持たず、`CockpitView` / `HudCockpitView` に `canEditRoutine` を渡さない。

月次・報酬・資料・MTG の write 権限は、それぞれの API / RLS / admin route が判定する。cockpit 本体は authenticated read と各モーダル/APIへの導線を担当する。

## Institution Card Entry

Research-institution ecosystem work is represented as an ECR institution card first, not as a normal dashboard PJ list item. Dashboard exclusion uses `project_category='ecosystem'` plus the known KUTE row (`p25` / KUTE label) so production data drift does not make KUTE reappear in the normal PJ list. The related project row remains as the operational cockpit data source, so existing MS, monthly, MTG, and cockpit content is preserved.

| institution | related project | behavior |
|---|---|---|
| `inst_kute` | `p25` (KUTE) | `/dashboard` shows KUTE in the research institution ECR list, not in the normal PJ list. The institution card opens `/institutions/inst_kute/cockpit`; `進捗管理` mounts the existing `CockpitView` for `p25` so the current KUTE PJ cockpit content remains reachable |
| `inst_nims` | `p20` (CX / CryoX) | `/dashboard` NIMS card opens `/institutions/inst_nims/cockpit`; the page shows institution summary / readiness snapshot first, then `進捗管理` / `スコア詳細` tabs. `進捗管理` mounts the existing `CockpitView` for `p20` and keeps the MTG tree below it. `スコア詳細` shows ECR axis/criterion detail, not SU AMD Score |

This route is read-only during load. It does not create a duplicate project or write production DB rows. If MS plan data is missing, the embedded normal cockpit shows the existing MS setup banner / monthly note fallback. MTG tree must not be the first visible block after the institution header; research institution cockpit uses the same high-level information architecture as PJ cockpit: summary first, progress tab for operational state, score detail tab for score evidence.

## Initial Modal Rules

| query | behavior |
|---|---|
| `?ym=YYYYMM` | monthly modal を開く |
| `?meeting=<meeting_id>` | MTG詳細 modal を優先。月次 modal と二重起動しない |
| `?tab=score-detail` | SU 系 PJ の `スコア詳細` を初期表示し、SPS / R_net / FRL / XRL evidence と XRL チェックリストを同じ cockpit 内で開く |
| `?tab=company` | 常設「会社概要」タブを初期表示する |
| `?step=<stepId>&ym=YYYYMM` | legacy query。現行 cockpit は step modal を持たず、`step` は解釈しない |

## Major Sections

| section | component | source |
|---|---|---|
| header | `CockpitHeader` | project metadata + PJリスト由来の実行サマリー。PJメンバーに続き、各現行契約を `契約期間` / `請求・振込` / `業務・成果物` / `経費申請` / 必要時だけ `推進条件` の最大5項目で表示する。短文の正本は `projects.contract_terms_json.currentContracts[].terms.cockpitSummary`。請求・振込タイミングは必須表示とし、未確認なら未確認と明示する。知財、秘密保持、解除、責任等の法務条項は通常契約のサマリーへ常設せず `/admin/contracts` に残す。NDAは例外として `契約期間` / `利用目的` / `運用条件` を表示する |
| KUTE annual roadmap | `CockpitKuteAnnualRoadmap` | KUTE (`p25`) only。`CockpitHeader` 直下で、2026-06〜2027-03 の年度内ロードマップを表示する。規程整備レーンは 2027-01 整備完了目途、シーズ発掘 / after GTIE レーンは 2027-03 型化目途。現時点の source は 6/11 キックオフ資料 / `PROJECT_BRIEF` 由来の静的 contract |
| venture status | `CockpitVentureStatus` | `project_ventures`, `project_xrl_log`, related data |
| AMD / Management score hero | `CockpitManagementScoreHero` | AMD Score / Management Score derived data |
| tabs | `CockpitView` | `進捗管理` / `スコア詳細` (該当PJのみ) / `会社概要` (常設・2026-07-16 追加) の display state。SU 系 PJ は 3タブ (進捗管理 / スコア詳細 / 会社概要)、非SU系 PJ は 2タブ (進捗管理 / 会社概要) で、各タブのクリック領域はタブ数で均等分割する |
| score detail tab | `CockpitAmdScoreDetailTab`, `AmdScoreView embedded` | 正規URLは `/project/[projectId]/cockpit?tab=score-detail`。`/api/project/[projectId]/amd-score-detail` から SPS Primary / SPS history / R_net / FRL / XRL evidence と XRL チェックリストを表示し、legacy AMD / M-X-F は comparison と evidence 用に残す。cockpit mount 時に hidden panel として先読みし、client memory cache 5 分TTL + private HTTP cache で再表示待ちを減らす。TTL 超過後にタブが active になったら、表示済み内容を保ったまま背景再取得する。旧 `/venture-map/amd-score/[projectId]` はこのタブへ redirect する (`p99` デモを除く) |
| goals compact | `CockpitGoalsCompact` | value plan / MS。`MilestoneGanttChart` の各MS行に pt / tag / 担当 / 進捗とあわせて `設計額` を表示し、バー上の担当者 chip には担当設計額も併記する。通常MSは plan cycle 予算、`cap_extra` は同期間の別財布予算から按分し、支払確定額としては扱わない |
| MS change history | `CockpitMsChangeHistory` | `milestone_change_events`。今期MSの直下、`CockpitSeasonFinance` の手前に初期折りたたみで表示する。`/admin/ms-overview` の保存イベントと、2026-07-09 backfill の `source='migration'` 基準線を読み、cockpit からは編集しない。契約本文・メール全文・議事録全文・raw source は扱わない |
| season finance | `CockpitSeasonFinance` | `fetchCockpitFromSupabase` が `billing_cycles`, `projects`, `reward_summary_json` から組み立てた `seasonFinance`。MS リスト直下、月次カードより上に表示し、シーズン全体と月次別に `クライアント支払` / `バッファ` / `原資上限` / `PJ予算` / `メンバー支払` / `期末未払` / `収支` を出す。`期末未払` / `未払残` は支払通知対象の外部メンバーへ将来払う残高だけで、役員分の繰越は会社留保側の内部検算へ寄せる |
| project documents | `CockpitProjectDocuments` | 右カラム先頭の資料スペース。drag & drop / file picker で `/api/project-documents` へ multipart upload し、Drive の PJ folder 配下 `AMD OS 資料` folder に新規ファイルとして保存する。同名ファイルは上書きしない。リンク一覧は `project_documents` から取得し、Drive link を新規タブで開く |
| strategy signals | `CockpitStrategySignals` | `project_strategy_signals` |
| company overview tab | `CockpitCompanyOverview` | (2026-07-16 追加、旧 `CockpitGovernance` を統合廃止) 常設「会社概要」タブ本体。会社基本情報 / cap table (`buildCapTableSnapshots` で現在株・完全希薄化後株を算出) / 100%資本構成推移 / 資金調達ラウンド / 転換前証券 (J-KISS等、`convertibleScenario` の別枠試算のみで現在持株比率へは混ぜない) / 株主総会・取締役会 / 年次決算 / Excel・PDF出力。全PJ・終了PJでも常設表示。`project_company_profiles` / `project_equity_transactions` / `project_equity_entries` / `project_convertible_instruments` / `project_financial_periods` / `project_valuation_rounds` / `project_shareholder_meetings` (migration 174)。データは `/api/governance` (`requireMember` gate、members登録済みAMDメンバー全員が閲覧・編集可、admin限定ではない)。cap table は単なる現在断面ではなく、confirmed 状態の株式イベント (`incorporation` / `new_issue` / `in_kind_contribution` 等) と次回ラウンド試算を1つの `CapitalPolicyWorkspace`（資本政策ワークスペース）に統合する (2026-07-16, v3.43.2 で旧 `CapitalTimeline` 横棒 + 別枠マトリクス + 選択イベントだけを再掲する冗長 `cap table｜{event}` セクション + 遠く離れた `NextRoundSimulator` を統合、選択イベント再掲セクションは廃止)。`data-testid="cap-table-history-matrix"` は1つの表になり、列見出しがイベント列 (設立・Seed・QST現物出資 等、日付+短縮ラベル) で、各列見出し直下に縦積み100%持株構成バーが乗る (holderNameベース、共通0-100%スケール)。列見出しは実 `<button>` で focus-visible 対応、クリックでその列が試算のベース断面になる (underline/tint、太い丸角選択枠は使わない)。表の下段は発行済株式・新規発行株式・払込/調達額・発行価額・pre-money・post-moneyの行、続けて株主行 (`shares株 · pct%` の1行コンパクト表記)。最終列は `次回ラウンド（試算）` (`仮・FD` ラベル、青の破線区切り) で、同じ縦積みバー・行構成を試算値で表示する。正史が `incorporation` から始まっていない場合は `capTableOriginWarning` により `data-cap-table-origin-warning` の警告 (「創業時の分を遡って再現できない」旨) をワークスペース内に出し、創業時株式イベントの入力導線を提示する。`data-testid="next-round-simulator"` の次回ラウンド試算列と、そのベースだった保護株主 / 目標比率入力は **2026-07-17、`CapitalPlanWorkspace`（下記 `capital plan` 行）へ置き換え・廃止**。単発・未保存の試算という位置づけと「保護株主」概念そのものが、複数ラウンドを保存して積み上げたい実運用に合わなかったため、名前付きシナリオ + 全フィールド編集可 + freeze 版という設計へ移行した。Excel出力も同シートは廃止し、frozen version からのみ生成する `capital plan` 側の出力に一本化した |
| capital plan (資本政策プラン台帳) | `CapitalPlanWorkspace`、`src/lib/capital-plan.ts`、`/api/governance/capital-plans` | (2026-07-17 追加、旧 `NextRoundSimulator`/保護株主概念を置き換え) 会社概要タブ内、cap table 履歴マトリクスの下に置く、設立からIPOまでの複数ラウンドを1本の資本イベント列で編集・保存できる作業台帳。DB: migration `179_project_capital_plans.sql` の `project_capital_plans` (作業中シナリオ、`amd_os_is_member()` で全AMDメンバーが全PJを閲覧・編集可) と `project_capital_plan_versions` (freeze 時の append-only 確定版、RLSは `SELECT` のみ・`UPDATE`/`DELETE` は trigger で拒否)。migration `180_freeze_capital_plan_derived_document.sql` (build v3.44.5) で `freeze_capital_plan()` の旧4引数シグネチャを明示的に `DROP FUNCTION` した上で `p_document_json` を追加した5引数版へ置き換え済み (テーブル・データへの DROP/ALTER は無し、関数シグネチャ置き換えのみ)。**名前付きシナリオ**: `project_capital_plans` 行ごとに `name` を持ち、複数シナリオを並行して保存できる。**楽観ロック + autosave**: 編集は800msデバウンスで自動保存され (`saveTimer`)、`revision` 列の楽観ロックで他メンバーとの同時編集衝突を検知し、衝突時はサーバー側 revision を提示して再解決させる。**イベント/割当の全数値editable + provenance**: `CapitalEvent` / `EventAllocation` の株数・金額・単価・評価額などすべてのフィールドは `EditableValue { value, source }` で持ち、`source` は `input` / `calculated` / `imported` / `confirmed` / `override` のいずれか。`calculationBasis` (`valuation_and_investment` / `price_and_shares` / `ownership_target` / `manual`) を設定したイベントは `deriveCapitalPlan` が `calculated` 値を自動導出し、`input`/`imported`/`confirmed`/`override` の値は上書きしない。`override` は算出値 (`calculatedValue`) を保持したまま値を手動置換でき、`collectSourceOverrides` で上書き箇所を横断一覧できる。**複数ラウンド連鎖**: `incorporation` から `equity_issue` / `option_pool` / `convertible_issue` / `convertible_conversion` / `secondary` / `share_split` / `ipo` までのイベント種別を任意個 `order` 順に連結し、`recalculateCapTable` / `deriveCapitalPlan` が上流イベントの改定を下流ラウンドへ再帰的に伝播する。**保護株主概念は存在しない**: 目標比率を守る対象を指定する仕組みは無く、`ownership_target` basis のイベントで割当ごとの `targetOwnershipPercentage` を編集するだけ。**縦積み100%グラフ**: cap table 履歴マトリクスと同じイベント列に揃えて、holderName ベースの縦積み100%持株構成バーを表示する。**バリデーションと freeze**: `validateCapitalPlan` が整数株チェック・比率合計100%・pre/post-money整合・セカンダリ相殺・オプションプール整合などを検査し、`severity='error'` が1件でもあれば `checkPublishEligibility().eligible=false` となり freeze ボタンは無効化される (warning のみなら freeze 可、詳細は下記「提出ブロッカーの可視化」「freezeはサーバー側derive済みドキュメントを凍結」)。**VC向けExcel出力は frozen version からのみ**生成でき (`createCapitalPlanXlsx`)、作業中の未freeze内容からは出力できない。出力ブックは「提出情報」(プラン名・凍結version・source_revision・公開日時/者・検証結果件数・provenance凡例・丸め方針・金額単位・比率表示基準などのサマリー)・「資本政策」(イベント列 × 指標行のcap tableで、評価額・調達額・転換条件などの前提もこのシートに載る。列見出しに揃えた縦積み100%持株構成のネイティブ棒グラフ (`percentStacked` bar chart) をこのシート上に埋め込み表示する)・「投資家別」(投資家ごとの出資・保有スケジュール)・「潜在株式・譲渡」(転換前証券・セカンダリ等の潜在希薄化)・「検算」(バリデーション結果・source override 一覧・イベントごとの整合検算) の5シート構成。**マトリクスはモバイルでも表示され続ける**: `CapitalPlanMatrix` は常時表示のままで、`md:hidden` で消えたり選択1イベント表示に置き換わったりはせず、`max-h-[70vh] overflow-auto` の bounded スクロールコンテナ内で全イベント列にアクセスする。行ラベル列 (`sticky left-0`) とイベント列ヘッダー行 (`sticky top-0`、FD比率バー行も測定済みヘッダー高さ分オフセットして追従) は縦横スクロール中も固定表示され続ける。折りたたみ式の「株主・イベント詳細設定」内にある別コンポーネント `EventEditor` (詳細な割当編集フォーム) だけが `md:hidden` 幅で◀/▶ (`onPrev`/`onNext`) の選択イベント切替ナビゲーションを持つ。**basis driver / 自動算出値の表示**: `calculationBasis` ごとにどのフィールドが driver (編集可) か output (自動算出) かが決まり、output セルは通常時グレーの「自動」バッジ、`source:'override'` 時はアンバーの「上書き」バッジを表示する。output セルは✎ボタンで数値を直接上書き入力でき (`forceOverride`、算出値は `calculatedValue` として保持されズレを表示可能)、上書き後は✕「上書きを解除」で自動算出に戻せる。**新規VC割当の空欄金額**: 新規株主追加はまず割当なしの行を作るだけで、`valuation_and_investment` basis のイベントで金額欄を空欄・0のまま残しても株数フィールドは `source:'calculated'` のまま保持され、金額を入力すると `deriveCapitalPlan` が単価から株数を自動算出する。**basisの直接切替は driver/output の source を正規化**: `changeCalculationBasis` は切替先で driver となるフィールドは現在の解決済み値を引き継いで `source:'input'` に、output となるフィールドは同様に `source:'calculated'` に張り替え、役割が変わった時点で意味を失う古い `override` フラグを意図的に消去する (例: `price_and_shares` へ切替ると各割当の単価は空欄化され、イベント単価のみが全割当を駆動する)。**secondaryの売り手はマイナス株数**: `secondary` イベントでは売り手側の割当 `shares` をマイナス値で表現し (買い手はプラス)、イベント内の合計株数が0でなければ `secondary_net_not_zero`、売買代金が一致しなければ `secondary_amount_mismatch` としてバリデーションエラーになる。**convertible_conversionはmanual固定**: `convertible_conversion` イベントは basis セレクタ自体が UI から出ず、`deriveEvent` / `validateCapitalPlan` の両方が `calculationBasis!=='manual'` を拒否する。転換は自動発生せず、負の `convertible` class 割当 (残高消込) とプラスの発行割当をユーザーが手動で入力しない限り `convertible_conversion_missing_consumption` / `convertible_conversion_missing_issuance` でブロックされる。**提出ブロッカーの可視化**: `checkPublishEligibility` は `validateCapitalPlan` と `validateSubmissionCompleteness` (株主名・設立イベント起点・IPO終端・日付整合・各イベント必須項目の解決済みチェックなど) を統合し、`blockingIssues` / `warnings` を返す。ワークスペースはこれを「検証結果（エラー N件 / 警告 N件）」の折りたたみ一覧としてクリック可能な形で表示し (エラー行は赤、警告行はアンバー)、freeze ボタンは `eligible=false` や未保存・保存中・衝突中に無効化されツールチップで理由を示す。**freezeはサーバー側derive済みドキュメントを凍結**: freeze API はまず保存済み `document_json` を `deriveCapitalPlan` にかけてから `checkPublishEligibility` を再検証し、素通りした未derive値のままfreezeされないようにした上で、derive済みの `{holders, events}` を `p_document_json` として `freeze_capital_plan()` (migration 180版、5引数) に渡す。この関数が revision 検証・`project_capital_plan_versions` への insert・working plan 側 `document_json`/`latest_frozen_version` の更新を単一トランザクションで行う |
| grants | `CockpitGrants` | 助成金 / funding 関連 |
| monthly list/modal | `CockpitMonthlyList`, `CockpitMonthlyModal` | `billing_cycles`, reports / reward / progress |
| meeting summaries | `CockpitMeetingSummary` | `project_meeting_summaries` |
| legacy kanban | `CockpitKanbanGas` / `HudCockpitKanbanGas` | `tasks`。PJ cockpit / HUD cockpit の主要導線からは外す |
| freeze / MS status | `CockpitFreezeBackfill` | freeze backfill and read-only MS period status。MS 設計編集は `/admin/ms-overview` に集約する |

`CockpitMeetingSummary` の通常PJ cockpit表示は、一覧本体に `max-height` と `overflow-y-auto` を置かない。議事録カードや予定MTGカードが増えた場合もカード一覧を縦に伸ばし、コックピット全体のページスクロールで読む。HUD cockpit や detail modal の内部スクロールはこの制約の対象外。

## Meeting Summary Notion CTA

`CockpitMeetingSummary` shows `project_meeting_summaries` rows as past MTG summaries plus upcoming/tentative prep cards. Each row and detail modal exposes a Notion transcription path without starting recording from AMD OS:

| data state | UI |
|---|---|
| `notion_url` exists | `Notion文字起こし` opens the Notion page in a new tab |
| `source_kinds='upcoming'` and `notion_url` empty but `source_url` exists | `Calendarから開始` opens the Calendar event so the user can start Notion transcription from Notion/Calendar context |
| no `notion_url` and no usable `source_url` | `Notion未連携` disabled state |

The card header includes `メモ再読込`, which refetches `project_meeting_summaries` for the current project and updates the open detail modal if the selected row was refreshed. This is for cases where L6 later backfills `notion_url` / eventId. The PWA does not call a Notion recording API, does not create Notion pages, and does not perform DB DDL for this CTA.

## Meeting Summary Inline Editing

`CockpitMeetingDetailModal` uses one visible section model for display and edit mode. The `表示内容を編集` action turns the currently displayed sections into textarea controls in place:

| display state | editable source |
|---|---|
| held/dialogue row has `narrative_md` | `title`, `summary_short`, and the visible `narrative_md` body |
| held/dialogue row has no `narrative_md` | `title`, visible `summary_short`, `decided`, `progress`, `next_actions`, `risks` |
| upcoming/tentative row | `title`, `summary_short`, `narrative_md`, `decided`, `progress`, `next_actions`, `risks` through `POST /api/meeting-prep` |

For upcoming/tentative rows, `risks` is labeled as `必ず確認すること`. Legacy values that were written under the older `気をつけたい読み違い` label are not deleted; they are displayed and edited as confirmation items.

## Project Documents Contract

PJ cockpit の「資料」は、PJ全体で使う資料リンク置き場。MTG単位の添付資料 (`meeting_assets`) とは別で、会議に紐づかない提案書・試算表・契約案・参考PDFなどを置く。MTG単位の新規添付は `project_meeting_summaries.meeting_date` と `title` から `YYMMDD_会議名` folder を作り、同じ PJ folder 配下へ保存する。

| item | contract |
|---|---|
| source project folder | `projects.drive_folder_id` |
| dedicated folder | `AMD OS 資料` under the source project folder. Missing if upload時に作成 |
| upload API | `POST /api/project-documents` with `project_id` and `files[]` multipart form |
| list API | `GET /api/project-documents?project_id=<id>` |
| DB table | `project_documents` (`pwa/scripts/migrations/131_project_documents_drive_uploads.sql`) |
| DB payload | Drive file ID / project folder ID / dedicated folder ID / `webViewLink` / file name / MIME / size / uploaded_by / timestamps |
| file body | Google Drive only. DB and Supabase Storage do not store the body |
| duplicate handling | no delete / overwrite. Drive same-name files are allowed, so every upload creates a new file |
| auth | PWA API requires authenticated user. Read/upload/markdown preview/edit are allowed for active `project_members` of the target PJ or admin. Google credential must have Drive write scope and access to the PJ folder |

### MTG単位添付 (`meeting_assets`)

| item | contract |
|---|---|
| UI | `MeetingAssetsPanel` in MTG detail modal |
| upload types | general files, including md / docx / xlsx / pptx / txt / csv / zip / images / PDF |
| new file body | Google Drive only: `projects.drive_folder_id` / `YYMMDD_会議名` / uploaded file |
| folder naming | `YYMMDD` from `project_meeting_summaries.meeting_date`; meeting title sanitized for Drive-safe name |
| duplicate folder | find existing folder with same name under the PJ folder, then reuse |
| DB payload | `meeting_assets` keeps Drive file ID / project folder ID / meeting folder ID / folder name / `webViewLink` / file name / MIME / size / uploaded_by / timestamps |
| legacy compatibility | existing Storage-backed rows remain readable through `/api/meeting-assets/file/{asset_id}` |
| UI save path | show `保存先: PJフォルダ / YYMMDD_会議名`; raw credential/secret values are not shown |
| preview | images/PDF keep existing preview/link behavior; Markdown (`.md` / `.markdown`) opens in an OS modal; other non-preview files use file link + metadata |

If `projects.drive_folder_id` is empty, the panel shows a folder-setting warning. If Google credential is missing or has read-only / no shared-folder permission, upload returns a permission error and the panel keeps a retry action. The rest of the cockpit remains usable.

## Removed PM Routine Step Contract

PM向けの cockpit 右カラム routine step UI は廃止済み。`CockpitRoutine.tsx` / `CockpitRoutineGas.tsx` / `HudCockpitRoutineGas.tsx` / `CockpitRoutine*Modal.tsx` は current implementation から削除し、`?step=` 起動も使わない。

現行の月次導線は `CockpitMonthlyList` / `HudCockpitMonthlyList` から月を選び、`CockpitMonthlyModal` / `HudCockpitMonthlyModal` を開く形に一本化する。月次報告書の軽い確認 nudge は Slack 側に寄せ、OS 上の月次 routine step は発生させない。契約 apply 済みPJでは、請求額は `contract-billing-auto-confirm` と `/admin/invoices` / `/admin/payouts` 側で扱う。

`CockpitMonthlyModal` の月次報告書導線は、全PJ共通の `社内保存用を編集` と、提出が必要なPJだけに出す `提出用` リンクを分ける。社内保存用は `monthly_reports` 本文の生成・修正・FIXを扱い、提出用リンクは `/project/[projectId]/report/[ym]/print?template=...` を新規タブで開く。CX (`p20`) は `template=nims-cx`、SX (`p21`) は `template=ehime-sx`、KUTE (`p25`) は `template=kogakuin-kute` を使い、それ以外のPJは AMD 標準の `PDF` リンクだけを表示する。

## Monthly Modal / API Contract

| modal | trigger | read | write / call | success state |
|---|---|---|---|---|
| `CockpitMonthlyModal` report tab | monthly card / report-only month | `monthly_reports`, `billing_cycles`, MS bundle | `/api/report/generate`, `/api/report/fix`, report edit APIs | `monthly_reports.status='fixed'` or `fixed_at` set |
| `CockpitMonthlyModal` reward/progress tab | monthly card with billing cycle | `milestone_monthly_progress`, `ms_progress_revisions`, `member_activities`, `project_monthly_notes`, `billing_cycles.reward_summary_json` | `/api/rewards/sync`, `/api/progress/estimate`, `/api/progress/confirm`, `/api/progress/revisions`, `/api/progress/batch-save`, `/api/project/monthly-note` | local progress patches + reward summary sync |

## Monthly / Reward Modal Contract

`CockpitMonthlyModal` has two tabs:

| tab | visible when | main responsibility |
|---|---|---|
| `reward` / 進捗確認 | billing cycle exists | MS progress confirmation, reward preview/sync, monthly note for non-MS PJ |
| `report` | report exists or report-only month | monthly report generation/fix/edit |

Important rules:

- `CockpitSeasonFinance` は、PJ cockpit 上で今シーズンの収支を先に見せる安全網。クライアント支払は `contractBackedClientAmount` に `billing_cycles.extra_revenue_json` の別財布**現金入金額**を加算する。別財布の期間按分はPLだけに使い、cash は entry の実入金月を最優先して総額を一括計上する。実入金が未確認なら `invoice_ym`、次に `billing_date` とPJ支払条件で予測月を解決する。schedule_based 契約では `contract_terms_json.monthlySchedule.amountTaxExcl` も予定売上として読む。バッファは `value_plan_cycles.buffer_breakdown_json` のシーズンバッファを優先し、未設定の PJ だけ `billing_cycles.budget_buffer_amount` を読む。原資上限は `(クライアント支払 - バッファ) × 65%`。PJ予算は `budget_yen + extra_budget_yen`、メンバー支払/未払残は `billing_cycles.reward_summary_json` を読む。`未払残` は支払通知対象の外部メンバーに対する `stockYen` だけを合計し、役員の繰越分は未払残に混ぜず会社留保側の内部検算へ含める。表示する `収支` は現金主義で `クライアント支払 - バッファ - メンバー支払` とし、役員向け報酬相当額や未払残はその月の現金流出ではないため含めない。役員向け報酬相当額は検算には含めるが、PJ cockpit では表示しない。期末未払残または PJ予算の原資上限超過が 1 円でもある場合は不足表示にし、報酬計算側で最終月に自動上乗せしてゼロに見せない。
- If a month has a `monthly_reports` row but no `billing_cycles` row, only report tab is shown.
- Reward budget derives from `billing_cycles.budget_yen`; if absent and project is `monthly_fixed`, `projects.fee_amount * 0.65` is used.
- `billing_cycles.reward_summary_json` is cached and refreshed through `/api/rewards/sync` or daily `cron/payout-reward-cache-refresh`.
- MS progress rows with human confirmation are not overwritten by routine estimation.
- `project_monthly_notes` is the current store for advisor / non-MS / MS-missing month progress notes.

## GAS / Edge Bridge Contract

PWA cockpit no longer owns dedicated routine modals. Supabase Edge Functions remain shared infrastructure for `/admin/invoices` / legacy flows and are called through `pwa/src/lib/supabase/edge-functions.ts` when a current caller exists.

| function | caller | purpose |
|---|---|---|
| `issue-invoice` | `/admin/invoices` / legacy invoice API | creates freee invoice or quotation and updates billing row |
| `cancel-invoice` | `/admin/invoices` / legacy invoice API | cancels issued invoice/quotation state |
| `meeting-slots` / `schedule-meeting` / `send-budget-approval-nudge` | legacy infrastructure | no active cockpit routine modal caller after routine UI deletion |

GAS remains relevant for legacy freee/Slack/background automation. New cockpit modal actions should not reintroduce the deleted PM routine step layer without a separate current spec update.

## Failure Mode

| failure | behavior |
|---|---|
| `fetchCockpitFromSupabase` pending | spinner |
| fetch error | error message + reload button |
| score detail API returns 404 | tab shows a compact error; progress tab remains usable |
| report-only month | monthly modal opens report tab only |
| old proactive_outbox row exists | 通常PJ / institution cockpit には表示しない。旧手動seedや `drafted` 行が残っても、PJ 状況面のノイズにしない |
| project_documents table missing | documents panel shows API error; cockpit remains usable |
| projects.drive_folder_id missing | documents panel shows folder-setting warning and upload is blocked |
| Google Drive write permission missing | upload returns permission error; no DB row is inserted |

## Validation

- `npx tsc --noEmit`
- `npm run build`
- dry API contract: `GET /api/project-documents?project_id=<id>` requires authenticated PJ active member or admin auth and returns documents / driveConfigured metadata.
- route smoke after deploy: `/project/<projectId>/cockpit` auth redirect when logged out; logged-in admin sees cockpit.
- query smoke: `/project/<projectId>/cockpit?ym=YYYYMM`, `?meeting=...`; `?step=...&ym=...` must not open a routine step modal.

## この章だけで再構築できること

PJ Cockpit の route、data bundle、初期 query modal、major component map、monthly/reward modal の責務、資料・MTG・D-6 表示、Edge Function bridge の現行境界を再構築できる。

## まだ再構築できないこと

Kanban の詳細 state machine、Meeting detail modal の attachment mutation、Cockpit score tabs の別worker差分、AMD Score hero の全表示 contract は未完。Admin / Finance / Reward spec 化フェーズで reward PDF / payout との境界も追加する。

## 確認したcurrent truth

- `pwa/src/app/(app)/project/[projectId]/cockpit/page.tsx`
- `pwa/src/components/cockpit/CockpitView.tsx`
- `pwa/src/components/cockpit/CockpitMonthlyList.tsx`
- `pwa/src/components/cockpit/CockpitMonthlyModal.tsx`
- `pwa/src/lib/supabase/edge-functions.ts`
- `pwa/src/components/cockpit/CapitalPlanMatrix.tsx`
- `pwa/src/components/cockpit/CapitalPlanWorkspace.tsx`
- `pwa/src/lib/capital-plan.ts`
- `pwa/src/lib/capital-plan-xlsx.ts`
- `pwa/src/app/api/governance/capital-plans/route.ts`
- `pwa/scripts/migrations/179_project_capital_plans.sql`
- `pwa/scripts/migrations/180_freeze_capital_plan_derived_document.sql`

## 未確認 / inferred

- Edge Function 内部の freee / Calendar / Slack side effect は未深掘り。ここでは current PWA caller contract を current truth として固定している。
- cockpit score tabs は別worker作業中のため、この章では未確定扱い。

## 次に見る実装ファイル

- `pwa/src/components/cockpit/CockpitKanbanGas.tsx`
- `pwa/src/components/cockpit/CockpitMeetingDetailModal.tsx`
- `pwa/src/components/cockpit/CockpitManagementScoreHero.tsx`
- `ios/supabase/functions/*`

## SX COO統合経営ワークスペース（2026-07-19 current contract）

`/project/[projectId]/workspace` は、週次エフォート表を補助面へ下げ、週次会議直前にCOOが「いま何が止まり、今日何を決め、次に誰が何をいつ確認するか」を5分で診断する共有経営面とする。初期PJは`p21`だが、DB/APIの正本はPJ一般化した`project_management_*`であり、旧`project_sx_*`は作らない。

### 判定契約

初期画面の上部には、derivedの全体判定（順調 / 注意 / 危機 / 未評価）、理由最大3件、今週決める最大3件、次期限、最終確認日、必須項目充足率、停止中の柱、重大な未確認を一続きで置く。充足率は表示専用で、順調判定の条件にはしない。critical/highのKPIが0件、期限/担当/鮮度/依存/完了条件が不足、閾値外、期限超過、停止、循環依存があれば順調を許さない。将来ゲートは完了証跡ではなく完了条件と現在のKPI/検証根拠で評価し、実績完了時だけ完了証跡を必須にする。

4本柱は同一比較軸で、現在ゲートは未完了のうち依存順・開始済み・期限近いものを決定的に選ぶ。全て完了した柱だけ最後の完了ゲートを表示する。依存待ちと停止は、必須性、lag、予定開始日、期限超過を分けて表示する。4本柱信号帯の各ボタンは、状態・証拠充足（担当/完了条件/測定済みKPI/鮮度確度の4チェックから算出、`SxReactorPanel`）・予定との差（`sxFormatDelta`、確定日は日数、仮置き日は`予測差`表記）・次期限・最大の詰まり（`track.maxIssue`）を同一面で同時に示す。進捗率の主観値を証拠充足へ混ぜない。

### 三つの証明（オンサイトPoCへの実証経路）

`TRL5`は達成状態の補助ラベルに下げ、オンサイトPoCへ進むための主経路を独立した3つの証明対象として管理する: `PoC用リアクター仕様確定` / `確定仕様での動作確認` / `ユニットエコノミクス証明`（完了条件は`SX_COO_DASHBOARD_SPEC_20260719.md` 3.3.2の定義に一致）。

7つの開発テーマ（リアクター構成、処理性能、再現性、スケール成立性、封じ込め、回収、オンサイトPoC。`TRL5`は補助ラベルのみ。スラッグは`tech-reactor-recheck` / `tech-performance-test` / `tech-reproducibility-test` / `tech-scale-test` / `tech-containment-test` / `tech-recovery-test` / `tech-poc-gate`）から3つの証明への接続は、DB非依存の型付き中央マップ `pwa/src/lib/sx-proof-mapping.ts`（`SX_THEME_PROOF_MAP: Record<スラッグ, 証明ID[]>`）で定義し、UIとテストが同じ定義を参照する。各テーマは最低1つの証明へ接続し、未接続のテーマは無い（`scripts/test_sx_proof_mapping.mjs`で検査）。

`SxProofOutcomes`は各証明カードに、関連テーマの評価済み件数/全体件数、状態分布（順調・要確認・停止・未評価の横積みバー）、証拠充足率、判断期限（関連テーマ自身に登録された最も近い予定/予測日）、不足情報を表示する。個別技術試験に期限がない場合は親リアクターの期限を借用せず「未登録」のまま扱う。関連テーマが全件未評価の場合、証拠充足率は`0%`ではなく`null`（表示は「未評価」）として扱い、未評価を達成率0%と誤認させない。接続は7×3のマトリクス（テーマ行 × 証明列、接続時は塗りつぶし丸）で常時可視化する。

### 経営航路の台帳

目的 → 柱の成果目標 → KPI → マイルストーンをPJ内の関連情報として接続する。KPIは`baseline / target / actual / unit / threshold / threshold_rule / threshold_upper / measurement_date / frequency / source / confidence`を持ち、`gte`（以上）、`lte`（以下）、`between`（範囲内）をAPIと計算ロジックで検証する。`actual=0`は値として扱い、`between`の上限欠落やlower > upperは「判定条件不足」とする。

マイルストーンは完了条件、完了証跡、重要度、基準計画版、予測変更理由を持つ。依存は正規化テーブルで必須/任意・lagを保持し、DB triggerがPJ混在と循環を拒否する。手入力statusは表示用の記録であり、overall/trackはderived stateを正本とする。

論点→複数仮説→根拠/反証・不足→次の検証→意思決定→actionの閉ループを、選択ゲートの詳細から同じ文脈で表示する。意思決定は理由、決定者、決定日を持ち、actionは担当、期限、完了条件、完了証跡、次回確認を持つ。会議/更新履歴とfield auditは削除せず追跡できる。

協力機関は機関別に段階（候補 / 情報交換 / 条件整理 / 面談調整 / 検証準備 / 合意確認 / 実行中 / 保留）、合意状態、最終接点、SX側の次アクション、期限、担当、関連ゲート、約束履歴を表示する。約束履歴は相手の約束とSX側の次アクションを分け、相手担当・約束日・一次根拠が揃う場合だけ相手の約束にする。

`project_management_partners`は migration 191 (`191_sx_partner_ledger_upgrade.sql`) で `current_ball_side`（`sx`/`partner`/`shared`/`none`/`unknown`）、`current_ball_owner`、`next_ball_owner`、`target_state`、`due_date_precision`（`day`/`month`/`unknown`）を additive 追加した。既存 `due_date` は目標期限のまま、`due_date_precision` がその期限をどこまで確定できているかを持つ。表示は `sxFormatDueDateWithPrecision()` (`pwa/src/lib/sx-management.ts`) が担い、precision `month` は「2026年8月（日付未確認）」、`unknown` は「期限未設定」に閉じ、存在しない具体日を作らない。既存行の 191 backfill は `owner_label`→`current_ball_owner`、`due_date`の有無→`due_date_precision`（`day`/`unknown`）に限定し、`current_ball_side`は未確認のまま推測しない。DB CHECK `project_management_partners_due_date_consistency_191` が `due_date_precision='unknown'` なら `due_date IS NULL`、`day`/`month`なら `due_date IS NOT NULL` を強制し、management APIの`assertDatePrecisionConsistency()`がcreate/PATCHのmerged値（patch優先、未指定分は既存行の値）で同じ整合性を日本語エラーで事前検証する。

`project_management_partner_interactions`（migration 191 で新設）は協力機関ごとのやり取り履歴を append 型で保持する。列は `project_id, partner_id, interaction_kind`（`meeting`/`email`/`agreement`/`deliverable`/`handoff`/`status_update`/`note`）、`occurred_on` nullable、`occurred_on_precision`（`day`/`month`/`unknown`）、`summary`、`outcome_summary` nullable、`ball_side_after`、`ball_owner_after` nullable、`confidence`、`source_kind`、`source_ref`、`deleted_at`/`deleted_by`/`version`（他 `project_management_*` 表と同水準の soft delete/RLS/`amd_os_can_manage_project_shared_data()` write/service_role/authenticated物理DELETE拒否/`project_management_audit_fields()` field audit/`project_management_touch_updated_at()`）。親guardは `project_management_parent_project_guard('project_management_partners', 'partner_id')` を適用し、`partner_id` が別PJの協力機関を指せないようにする。DB CHECK `project_management_partner_interactions_date_consistency_191` が `occurred_on_precision='unknown'` なら `occurred_on IS NULL`、`day`/`month`なら `occurred_on IS NOT NULL` を強制し、management APIの`assertDatePrecisionConsistency()`が同じ整合性をmerged値で検証する。生メール本文・URLは持たず、`summary`/`outcome_summary`は安全な要約のみ。管理API (`/api/project-workspace/[projectId]/management`) には resource `interaction` を追加し、create/edit/soft-delete/restore、`PARENT_FIELDS.interaction=[["partner_id","project_management_partners"]]`による親PJ検証、`CREATE_RESOURCES`/フォームへの統合を行った。

協力機関パイプライン（`SxPartnerPipeline`）は主要view（重要経路の協力機関）を`dueDate`昇順で並べ、上部に小集計帯（対応中件数 / `current_ball_side='partner'`件数 / `='sx'`件数 / `='unknown'`件数（ボール未確認） / 期限未設定件数）を出す。表は`xl`（1280px）以上、カードは`xl`未満で切り替え、1024-1279pxはカード表示にする（旧`lg`基準は1024-1279pxで固定幅グリッドが外側`overflow-hidden`に切られていたため変更）。表のグリッド列は固定px（機関/役割・現在地・合意・期限/最終接点・関連ゲート/履歴）と`minmax(0,fr)`（現在ボール・次の受け渡し系・合意済み/未合意）を混在させ、実測コンテンツ幅に収めて外側ページの横overflowを作らない。各機関の行/カードは、現在の関係段階（stage rail）→合意バッジ→現在ボール（`sxBallSideLabel()`の側ラベル+`currentBallOwner`の実名）→次の受け渡し（`nextBallOwner`が受け手、`partner.nextCommitment`が次の一手、`targetState`が目標状態の3つを別行で表示し混同させない。次の一手は閉じた行/カードでも常時表示する）→期限（precision付き）→最終接点→合意済み/未合意→関連ゲート/履歴件数/最新記録（`latestRecordSummary()`、`sxLatestInteraction()`）を同一行で密に表示する。目標状態は1行truncateではなく`line-clamp-2`で最低2行まで読める。`sxLatestInteraction()`/`sxSortInteractionsByRecency()`は`occurredOn ?? createdAt.slice(0,10)`を実効キーとした記録時刻ベースの並びで、日付未確認を無条件に既知日付より新しいとは扱わない（将来日付の既知イベントは日付未確認の新規記録に追い越されない）。各行から履歴タイムライン（`sxSortInteractionsByRecency()`）を開閉でき、開くと全履歴と相手の約束/SX側の次アクションが同じ文脈に並ぶ。閉じても最新記録要約は行内に残る。管理者は行内から履歴の追加・編集ができる（`onAddInteraction`/`onEditInteraction`）。優先度低・保留のファインケムは主要viewから除外し、末尾の注記行にのみ機関名を残す（地理名を付けた旧称は表示レイヤーで一切出さない、`sxPartnerDisplay`）。技術試験・資金スナップショット・組織役割・RACI・人員容量は各測定値を画面に描画し、編集可能にする。週次エフォートは柱/マイルストーン/次の成果に接続する。

運用準備、4本柱の詳細比較表、目的→成果→KPI、意思決定の記録、判断→実行→確認、測定・資金・体制・約束、非表示にした共有情報の復元は、低頻度の編集面として単一の`id="management-ledger"` `<details>`「管理台帳・編集」へ集約する。個別の折りたたみボックスを並べず、各サブ機能（新規追加ボタン、編集、復元）は集約後も同一のまま動作する。

新規追加はPOSTで、選択中ゲートから論点 → 複数仮説 → 根拠/反証 → 検証 → 判断 → action → 次回確認を親情報つきで作る。portfolio/adminだけが作成でき、project scopeは閲覧だけ。履歴記録に失敗したPOSTは追加行を補償的にsoft-deleteし、再実行可能な状態に戻す。migration 184は未決分類、約束種類、相手の約束必須条件、親情報の同一PJ検査を補正し、再適用可能である。migration 191は協力機関の現在ボール/次の受け渡し先/目標状態/期限精度の additive 追加、date precision整合CHECK（partners/interactions）、やり取り履歴表 `project_management_partner_interactions` の新設、p21のダイキアクシス/SMBC current truth seed（`source_ref='user:2026-07-23#partner-progress'`）を含み、再適用可能である。partner seedは`ON CONFLICT (project_id,slug) DO UPDATE`でcurrent truth列を再適用のたびに反映する（`deleted_at`/`deleted_by`は対象外、soft-delete済み行を勝手に復元しない）。interaction seedは固定`TIMESTAMPTZ '2026-07-23 00:00:00+09'`起点のオフセットでrecord timestampを保存し（`now()`は使わない）、末尾の件数検査は当該`source_ref`＋想定summaryの件数が下限（daiki-axis 3件/smbc 2件）以上であることを見る（exact countではないため、後からユーザー履歴が増えても再適用できる）。

### 権限・表示境界・レスポンシブ

新規共有情報はAPIとRLSの両方でPJ所属を検証する。soft-delete対象のmember_selectは`deleted_at IS NULL`を含み、重要表はauthenticatedの物理DELETEを拒否する。共有DTOはraw本文、契約原文、報酬、メール本文、内部交渉メモ、source URLを返さない。portfolio/adminは共有情報を更新でき、project scopeは自PJの許可範囲だけ更新する。

1440pxは同一比較軸の表と全体ガント、768pxはカード、390pxは期限順カード/縦ロードマップへ再構成し、ページ全体の水平スクロールを作らない。workspace直リンクでは月初合意モーダルと左デスクトップナビを出さず、stickyセクションナビで経営サマリー/全体計画/論点・仮説/協力機関/実行・体制を移動する。loading / empty / error / disabled / selected / focusを持ち、タップ領域は44px以上、状態は色以外の文言でも伝える。表示文は日本語中心で、内部status・confidence・source・entity/field名は利用者向けラベルへ変換する。
