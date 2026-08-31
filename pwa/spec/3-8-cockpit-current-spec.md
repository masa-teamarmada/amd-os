# PJ Cockpit 仕様

> **この章は何か**: `/project/[projectId]/cockpit` の current contract。PJ の状態、月次運用、MS、経営ハイライト、AMD Score、MTGサマリを集約する中心画面。

## Route / Files

| route | file |
|---|---|
| `/project/[projectId]/cockpit` | `pwa/src/app/(app)/project/[projectId]/cockpit/page.tsx` |
| `/project/[projectId]/workspace` | `pwa/src/app/(shared-workspace)/project/[projectId]/workspace/page.tsx`。PJの正本。`SxWeeklyControlDashboard`を表示する |
| `/my-projects` | `pwa/src/app/(app)/my-projects/page.tsx`。複数PJへ参加するPJ限定メンバーの入口 |
| `/institutions/[institutionId]/cockpit` | `pwa/src/app/(app)/institutions/[institutionId]/cockpit/page.tsx` wraps an existing project cockpit in institution context |
| `/institutions/[institutionId]/regulations/[regulationId]` | 外部正本がない規程のOS内台帳・版履歴。外部正本が登録された版は外部リンクを優先する |
| main component | `pwa/src/components/cockpit/CockpitView.tsx` |
| data fetch | `pwa/src/lib/supabase-data.ts` (`fetchCockpitFromSupabase`) |
| project documents (資料室) | `pwa/src/components/workspace-documents/WorkspaceDocumentRoom.tsx` (コックピットの `資料室` タブが `presentation="modal"` で埋め込む)、`pwa/src/app/api/workspace-documents/**`。詳細は `pwa/manual/2-3-pj-cockpit.md` 「## 資料」節と `pwa/spec/2-1-pwa-runtime-routes.md`。旧 `CockpitProjectDocuments` / `pwa/src/app/api/project-documents/**` / `pwa/src/lib/project-documents/reconcile.ts` はどこからも参照されていないdead codeだったため2026-08-16 (v3.78.3) に削除した |

この章のcurrent contractはAMD内部のcockpitだけを扱う。PJワークスペースのcurrent contractは `3-16-project-weekly-control-current-spec.md`、全体の情報境界は `1-4-os-convergence-current-spec.md`、PJ・AMD・研究機関の三者受入は `1-5-three-party-project-view-acceptance-current-spec.md` を正本とする。

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
| `strategySignals` | L2D-6 `project_strategy_signals`。internal の candidate/confirmed と、external_research の confirmed を別取得して結合する |
| `tasks` | legacy kanban / H-1互換 task。通常PJ cockpit の主要表示には使わない |

`proactive_outbox` / `proactive_loops` / `proactive_loop_events` は 2026-06-27 に廃止済みの旧先手力ループであり、通常PJ / institution cockpit には表示しない。先手TODOの棚卸しは `proactive_todos` を使う `/proactive` と dashboard 上段バッジで扱う。旧 `ProactiveQueuePanel` を cockpit に戻さない。

`CockpitData` bundle にも資料一覧は混ぜず、`CockpitView` は独立タブ `資料室` (`?tab=documents`) を持ち、そのタブが active な時だけ `WorkspaceDocumentRoom` (`presentation="modal"`) をマウントする。マウント時に `scope_kind=project` で `/api/workspace-documents` を fetch する。旧 `WorkspaceDocumentLauncher` (右カラム先頭のモーダル起動ボタン) は 2026-08-21 にまさ確定で廃止し、component ごと削除した。正本は `workspace_documents` テーブルとprivate Storage `workspace-files`。管理権限ではfolder内のentryをパンくず（`資料`直下を含む）へドラッグし、既存`organize` PATCHで移動する。一覧のfolder行自体もdrop先で、`canDropIntoFolder()`がfolder以外・drag中のentry自身・現在と同じfolder・folder自己/子孫をclientで弾き、drop中の行だけ青くする。drop先・共有範囲・folderの自己/子孫禁止はサーバーで再検証し、同一folderへのdropはno-op。タッチ/keyboardは既存の整理dialog保存先selectを使う。move / archive / organize / create_folder はclient-first: `documents` のsnapshotを取り、`applyLocalOrganize()` / `applyLocalArchive()` で即座にstateを書き換え (folderは配下の `folderPath` 書き換え・配下ごと除去まで migration 217 の RPC cascade と同じ意味論を再現)、dialogを閉じてから PATCH/POST を投げる。成功後は `refreshDocuments()` (spinnerへ切り替えず、失敗しても `setDocuments([])` しない背景同期) で確定結果へ揃える。失敗時はsnapshotへ戻し、dialog/選択を復元してerrorを出す。`loadDocuments()` (spinner付き全件読み込み) はmount時のみ。mutation後に `await loadDocuments()` を復活させない (5-7秒の空白spinnerの原因)。create_link は open href が `documentId` 由来のため楽観行を作らず、POST応答の行をappendする。回帰防止は `scripts/check_workspace_documents_contract.mjs`。詳細な契約 (folder/link/file種別、同名確認、削除の扱い、権限境界) は `pwa/manual/2-3-pj-cockpit.md` 「## 資料」節を正本とする。

**削除履歴 (2026-08-16, v3.78.3)**: `project_documents` テーブルを実体とする旧 `CockpitProjectDocuments` コンポーネントと `GET/POST /api/project-documents`、`POST /api/project-documents/reconcile`、`src/lib/project-documents/reconcile.ts` は、`CockpitView` からどこからも呼ばれていないdead codeだったため削除した。2026-08-16 (v3.78.0) セッションでこのdead codeへ「Drive資料室folder → `project_documents` additive-only同期」機能を追加してしまっていたが (下記changelog該当行)、UIとして表示されたことは一度も無い。`project_documents` テーブル自体は `app/api/project/monthly-report-print/route.ts` が月次レポート添付一覧の読み取り専用ソースとして使い続けるため削除しない。共有ドライブの `AMD OS資料室` フォルダ名・folder ID (rename済み) はこの削除と無関係にそのまま維持する。

`tsukuyomi_nudge_queue` は通常PJ / institution cockpit の `CockpitView` へ渡さず、`CockpitNudge` カードも表示しない。既存の `fetchCockpitFromSupabase` が互換用に `nudges` を返す場合でも、この画面では読まない。HUD / dashboard 実験面で同じ queue を使う場合は、それぞれの専用コンポーネントの契約として扱う。

`CockpitStrategySignals` は経営ハイライト内に `重要な動き` と `採用リサーチ` の2棚を持つ。前者は従来の internal candidate/confirmed、後者は通知で採用済みの external_research confirmed だけを表示する。外部リサーチの未採用候補、見送り、過去の重複候補を cockpit に混ぜない。

## Permission / Mutation Boundary

`/project/[projectId]/cockpit` は従来どおりAMD内部面。外部のPJ限定メンバーへは公開しない。共有面は `/project/[projectId]/workspace` に分離し、`members.os_access_scope='project'` と active `project_members` の両方で対象PJを限定する。

PJ限定ログインはGoogle OAuthで本人確認した直後に通常のSupabase sessionを破棄し、7日間のHTTP-only署名付きPJセッションへ交換する。署名だけに依存せず、各requestで `members.status='active'`、scope、member ID、active PJ membershipをservice側で再検証する。既存社内テーブルの広いauthenticated RLSを外部ユーザーへ継承させない。`amd_os_is_member()` も `portfolio` / adminだけをtrueにする。

共有ダッシュボードが返す範囲は、PJ名、参加メンバーの表示名 / 役割、週次予定・実績時間、5区分の配分、MS名 / 進捗、抽出済み活動の件数 / source種別 / 最終日。raw本文、source URL、email、契約、請求、報酬、経営ハイライト、会社概要、他PJ情報はDTOへ含めない。PJ限定メンバーのwriteは自分の `project_weekly_effort_entries` だけ、portfolio/adminは当該PJのactive member分を更新できる。

Tallyは別クライアントから、正規PJへ完全一致で紐づいた週別の作業時間・MTG時間を `tally_weekly_effort_entries` へ同期する。既存の `project_weekly_effort_entries` を上書き・合算しない。ワークスペースの「Tally集計」は同週の作業・MTG・合計を出所付きで表示し、Tally同期設定にはPJ表示名とMTG検索語だけを保存する。フォルダ絶対パス、会議題名、Google認証情報は保存しない。書込みは `tally-sync` Edge Function が専用キー・PJ/メンバー実在・値域・重複週を検証して行い、直近365日の範囲だけを置換する。

月次 routine 専用の `canEditRoutine` 判定は廃止。`/project/[projectId]/cockpit` / `/hud/project/[projectId]/cockpit` / `/institutions/[institutionId]/cockpit` の page route は PM/admin 判定を持たず、`CockpitView` / `HudCockpitView` に `canEditRoutine` を渡さない。

月次・報酬・資料・MTG の write 権限は、それぞれの API / RLS / admin route が判定する。cockpit 本体は authenticated read と各モーダル/APIへの導線を担当する。

## Institution Card Entry

Research-institution ecosystem work is represented as an ECR institution card first, not as a normal dashboard PJ list item. Dashboard exclusion uses `project_category='ecosystem'` plus the known KUTE row (`p25` / KUTE label) so production data drift does not make KUTE reappear in the normal PJ list. The related project row remains as the operational cockpit data source, so existing MS, monthly, MTG, and cockpit content is preserved.

| institution | related project | behavior |
|---|---|---|
| `inst_kute` | `p25` (KUTE) | `/dashboard` shows KUTE in the research institution ECR list, not in the normal PJ list. The institution card opens `/institutions/inst_kute/cockpit`; `進捗管理` mounts the existing `CockpitView` for `p25` so the current KUTE PJ cockpit content remains reachable. `SU関連規程` は全機関共通台帳のKUTE行を表示し、旧ハードコード配列は持たない |
| `inst_nims` | `p20` (CX / CryoX) | `/dashboard` NIMS card opens `/institutions/inst_nims/cockpit`; the page shows institution summary / readiness snapshot first, then `進捗管理` / `スコア詳細` tabs. `進捗管理` mounts the existing `CockpitView` for `p20` and keeps the MTG tree below it. `スコア詳細` shows ECR axis/criterion detail, not SU AMD Score |

This route is read-only during load. It does not create a duplicate project or write production DB rows. If MS plan data is missing, the embedded normal cockpit shows the existing MS setup banner / monthly note fallback. MTG tree must not be the first visible block after the institution header; research institution cockpit uses the same high-level information architecture as PJ cockpit: summary first, progress tab for operational state, score detail tab for score evidence.

### SU関連規程台帳

全研究機関共通の比較表は、10種類の学内規程・運用文書に「外部助成・起業後支援ルール」を加えた11種別を表示する。JST等の外部制度は大学の学内規程と同じ種類へ混ぜず、`external_program_support` として分離する。

愛媛大学 (`inst_ehime`) は、2026-08-21に確認できた大学発ベンチャー認定、兼業・労働時間内兼業・クロスアポイントメント、利益相反、知的財産、共同研究等、大学発ベンチャー支援制度の公式規程・案内を正本リンク付きで保持する。共有機器利用と支援細則は支援制度の存在までは確認済みだが、利用条件・料金・安全管理・責任分界が未確認なので `review` とする。設立後の愛媛大学×SolvioraX共同研究は既存制度の存在とは分け、石原先生から出た提案段階・実施未合意として記録する。

JST「起業後支援の手引き」は外部制度欄に置く。PSI事務局回答で研究開発期間中の起業自体は可能、起業のみなら事前申請不要だが起業日前日でGAPファンド支援終了、大学側継続支援またはSU直接支援はPF審査・JST確認等が必要という現在地を記録する。12/18設立は固定日ではなく目安であり、審査日程に合わせて後ろ倒しできる前提を崩さない。

## Initial Modal Rules

ZMP（p19）限定の`テーマ`タブは`?tab=themes`から開く。既定は進捗管理のまま、他PJの同queryは進捗管理へ戻す。`CockpitProjectControl`の既存認可済みworkspace bundleと`ProjectThemeRoutes`を再利用し、別のテーマ台帳やfetch経路を作らない。4テーマの仕事・MTG・論点・成果目標に加え、同じ`project_management_*`を読むガント／目的構造と関係先への索引を表示する。水素の経緯はガントのタスクと関係先接点へ正規化し、profileの経緯JSONを二重編集しない。コックピットへのアクセス権は拡大しない（2026-09-01、詳細は3-16）。

KUTE限定の完了表示（2026-08-31）: `projectId=p25 && entity=task && state=complete` の期間バーを `#047857` で全幅塗りつぶし、desktop/mobileとも「完了」を緑のbadgeで示す。`status=completed` の判定を使用し、保存済み進捗率が0でも完了の表示を優先する。他PJ、MSマーカー、未確認タスクの表示は不変。2026-09-01の今期タスク再編では、成果物または開催後記録を確認できたR01/R02/R03/R08/S01/K01/K02/K03/K04だけを `status=completed`、`progress_pct=100`、`actual_end`ありで登録した。文書作成完了を大学の決裁・施行へ、調査完了を実証受注・事業化成功へ拡張しない。回帰チェック: `node scripts/check_kute_gantt_completion.cjs` と `node scripts/check_kute_seeds_tab_contract.cjs`。

KUTE (`p25`) の `?tab=seeds` は専用「シーズ」タブを復元する。許可リストは `src/lib/cockpit-tabs.ts` の `COCKPIT_TABS` と共有し、他PJの同queryは `progress` へフォールバックする。KUTEの比較表は初回訪問後hidden保持で再取得と絞り込みリセットを防ぐ。他研究機関の進捗管理内の比較表は変更しない。横展開はKUTEでの設計合意後に行う（2026-08-31）。

KUTEガントの年度末マーカーは「年度末 YYYY-MM（目途）」で、会社の「設立」や確定日と表示しない。旧ロードマップ由来 (`source_ref` が `KUTE年度内ロードマップ /` で始まる) の6件は履歴としてsoft-deleteし、2026-09-01の再編行は `KUTE FY2026 task review / <ID>` を出典にする。日程根拠がない行は `planned_start/planned_end=NULL` とし、表示用の仮日程を捏造しない。時間軸は6区分の非表示phaseコンテナで2026-05〜2027-04を確保する。DBの `progress_pct` はNOT NULLのため未完了行は0を保存するが、進捗未登録と0%確定を同一視しない。

| query | behavior |
|---|---|
| `?ym=YYYYMM` | monthly modal を開く |
| `?meeting=<meeting_id>` | MTG詳細 modal を優先。月次 modal と二重起動しない |
| `?tab=score-detail` | SU 系 PJ の `スコア詳細` を初期表示する。最上段が「現行SPS｜産業創出価値」の評価カード、その下が BZM 3.0 のスコアパネル。2026-08-27 に BZM 2.2 暫定パイロットと旧モデルのアーカイブトグルをこのタブから外した (下記 score detail tab 行が正本) |
| `?tab=weekly` / `?tab=gantt` / `?tab=partners` / `?tab=issues` | PJ管制の4タブを初期表示する。中身はPJワークスペースと同一 (下記 project control tabs 行が正本) |
| `?tab=overview` | 常設「PJ概要」タブを初期表示する。2026-08-28 (まさ依頼) にコックピット最上段の「契約上の実行条件」と PJ の見出し・担当・事業概要・XRL進捗 (`CockpitVentureStatus`) をこのタブへ移した |
| `?tab=business-plan` | 常設「事業計画」タブを初期表示する。2026-08-21 (v3.87.3) に全PJ常設へ拡大した (旧: SX `p21` のみ) |
| `?tab=company` | 常設「会社概要」タブを初期表示する |
| `?step=<stepId>&ym=YYYYMM` | legacy query。現行 cockpit は step modal を持たず、`step` は解釈しない |

## Major Sections

| section | component | source |
|---|---|---|
| header | `CockpitHeader` | project metadata + PJリスト由来の実行サマリー。PJメンバーに続き、各現行契約を `契約期間` / `請求・振込` / `業務・成果物` / `経費申請` / 必要時だけ `推進条件` の最大5項目で表示する。短文の正本は `projects.contract_terms_json.currentContracts[].terms.cockpitSummary`。請求・振込タイミングは必須表示とし、未確認なら未確認と明示する。知財、秘密保持、解除、責任等の法務条項は通常契約のサマリーへ常設せず `/admin/contracts` に残す。NDAは例外として `契約期間` / `利用目的` / `運用条件` を表示する |
| KUTE FY2026 work ledger | `CockpitProjectControl` → `SxWeeklyControlDashboard` → `SxUnifiedTimeline` | KUTE (`p25`) の今期業務を6区分・38タスクへ再編し、`?tab=gantt` の全体ガントに通常の編集可能なタスクとして描画する。区分は認定制度7、関連6規程12、シーズ発掘6、桑折先生8、自走化・連携4、年度報告1。契約、開催後議事録、規程台帳、8月業務報告、作成済み成果物で仕事と完了条件を分解し、根拠を確認できた9件だけ完了。旧6件は移行直後から編集・依存関係がないことをpreflightで確認してsoft-deleteし、物理削除しない。旧2 track ID/keyはFK整合のため保持し、表示labelを認定制度/シーズ発掘へ更新。新4 track、4 outcome、4 phaseを追加し、既存objectiveと2 outcome/phaseを再利用する。日付根拠がない行はNULL、報告書の予定はprovisional。data migration `ios/supabase/migrations/20260901184500_kute_fy2026_task_rebuild.sql`。スキーマ、RLS、API、シーズタブ、他PJは不変。旧 `CockpitKuteAnnualRoadmap` は戻さない。 |
| KUTE 規程・内規 | `CockpitKuteRegulations` | KUTE (`p25`) only。`/project/p25/cockpit?tab=regulations` の専用タブ。契約対象の7規程（兼業、知財・ライセンス、出資・新株予約権、共同研究、利益相反、認定、共有機器利用）を最上段に置き、認定委員会内規・支援細則・認定審査チェックシートは随伴する認定運用文書として分離する。行は進捗順に並べ、`S0 対象確定 → S1 原典確認 → S2 AMD原案 → S3 学内調整 → S4 決裁・施行` の5段階バー、現状、次ゲート、次ゲートの時期、実在する資料と途中版数を密度高く示す。行ごとに一律の最終期限を置かず、全体工程として8月の残り6規程素案、9/4の修正案・進捗確認、9〜11月の学内議論・修正、1月の施行版・様式・運用フローを表示する。原案未作成・原典回収待ちはリンクを偽装せず明示する。文書実体はKUTE共有Driveの版管理フォルダへ集約し、画面にはメール本文・個人情報・secretを保存・表示しない。 |
| venture status | `CockpitVentureStatus` | **置き場所は「PJ概要」タブ (`?tab=overview`)**。2026-08-28 まさ「さっき貼ったオブジェクト全部移動して」で、コックピット上段からこのタブへ丸ごと移した。タブより上に残るのは `CockpitHeader` だけで、コックピットを開いた直後は進捗管理の中身が最初に目に入る。中身はPJの見出し行 (アウトカム / レーン / 設立 / 起源機関 / PL・PM・クローザー / 事業概要 / 沿革・メンバー・事業会社) と XRL進捗グラフ。同じ 2026-08-28 に `Bzm22CockpitSummary` の$J/P/Q/S$も外した (8-27 に「古いモデルの試算結果」としてスコア詳細から外したのと同じもので、ここにだけ残っていた)。`Bzm22CockpitSummary` コンポーネントと単体画面 `?view=summary` は残すが、コックピットからは出さない。現行SPSの凍結評価は読むが、カードはスコア詳細タブが唯一の置き場所で、ここには「最新版未評価 →」バッジだけ出す。XRLは`ResizeObserver`で実寸を測り、その幅・高さをSVG座標系へ使う。mobileは600pxの内部横スクロールだけを許す。回帰防止は `scripts/check_pwa_critical_ui.cjs` と `scripts/check_bzm_2_2_pilot_ui_contract.mts`。`project_ventures`, `project_xrl_log`, related data |
| AMD / Management score hero | `CockpitManagementScoreHero` | AMD Score / Management Score derived data |
| tabs | `CockpitView` | `進捗管理` / `週次差分` / `ガント` / `関係先` / `論点・仮説` / `スコア詳細` (該当PJのみ) / `事業計画` (常設) / `コスト試算` (常設) / `規程・内規` (KUTE `p25`のみ) / `知財` / `資料室` / `PJ概要` (常設) / `資本政策表` (常設) / `会社概要` (常設) の display state。`資本政策表` は 2026-08-29 (まさ依頼) に会社概要から独立させた。`PJ概要` と管制4タブ (`週次差分` / `ガント` / `関係先` / `論点・仮説`) は 2026-08-28 (まさ依頼) 追加。`事業計画` は 2026-08-21 (v3.87.3) に全PJ常設へ拡大した。各タブのクリック領域はタブ数 (`tabs.length`) で均等分割するので、タブ追加時に grid の列数計算を触る必要はない |
| score detail tab | `CockpitAmdScoreDetailTab`, `CurrentSpsAssessmentCard`, `Bzm30ScorePanel` | 正規URLは `/project/[projectId]/cockpit?tab=score-detail`。2026-08-27 (まさ「古いモデルの試算結果は、混乱の元になるのですべて削除してほしい」) に、BZM 2.2 暫定パイロット (`Bzm22ProvisionalObservatory`)、旧SPS帯の内訳、最下部の `現行SPS / BZM 2.1` `BZM 2.0` `旧SPS履歴 / Legacy AMD` アーカイブトグルをこのタブから外した。現在この面にあるのは上から2つだけ。(1) `CurrentSpsAssessmentCard` — 2026-08-28 まさ依頼でコックピット上部 hero から移した「現行SPS｜産業創出価値」の評価カード。`band` を渡さない呼び方に固定し、評価済みか / SPS帯 / 根拠レベル / 評価日 / 対応シーズ / 版と評価ID だけを出す (帯の定義式・算出過程・q要因は 8-27 に外した「古いモデルの試算結果」なので戻さない)。読み取りは `src/lib/current-sps-client.ts` の参照系キャッシュ経由で固定し、`/api/project/[projectId]/sps-current` の素の fetch へ戻さない (guard: `scripts/check_pwa_critical_ui.cjs` / `scripts/check_reference_data_cache_contract.mjs`)。(2) `Bzm30ScorePanel` — シーズ詳細と同じパネル。同じPJをPJ側から見てもシーズ側から見ても同じ数字・同じ根拠が出る。`seed_projects` にシーズが紐づいていないPJでは、空にせず何を登録すれば算出できるかを出す。`Bzm22TimeLedger` (イベントと月次試算表・年度別の事業・資金推移) は 2026-08-21 (v3.88.3) に事業計画タブへ移設済み。コックピット上部とHUDには独立した試算表ボタンを置かない。旧 `/venture-map/amd-score/[projectId]` はこのタブへredirectする（`p99`デモを除く） |
| business plan tab | `CockpitBusinessPlan`, `src/lib/sx-business-plan.ts`, `src/lib/sx-business-plan-xlsx.ts` | 全PJ常設 (2026-08-21 v3.87.3)。**2026-08-29 に全PJ共通部分だった `CapitalPlanWorkspace` (100%株主構成推移と資本政策プラン台帳) の掲載をやめた** (まさ「SXは事業計画タブに資本政策表を作っちゃってるから、これを削除しておいてほしい」)。資本構成は資本政策表タブが唯一の入口。この結果、SX固有の表もBZM 2.2の試算も無いPJでは事業計画タブに共通の中身が残らないので、「このPJの事業計画はまだ登録されていないよ。株主構成と資本政策は「資本政策表」タブで見てね。」の空状態を出す (空の表を偽装しない)。以下は掲載していた当時の記述 — 全PJ共通部分は `CapitalPlanWorkspace` の100%株主構成推移と資本政策表だけで、資本政策プラン未作成のPJでは空の表を偽装せず「まだ資本政策プランがありません」の案内と3種の作成導線 (`+ IPOまでの標準プラン` / `+ 確定履歴から作成` / `+ 空のプラン`) を出す。SX (`p21`) だけは `showSxDetail` で共通部分の上下にSX固有の (1) 4開発レーン×5フェーズの表と (3) 年次試算表を足す (`SX_BUSINESS_PLAN_PHASES` はSXハードコードのため他PJへ出さない)。BZM 2.2 pilot 対象PJ (= スコア詳細タブを持つPJ) では、フェーズ表の下に `Bzm22TimeLedgerSection` (`data-testid="bzm22-time-ledger-section"`) を置く。中身は `Bzm22TimeLedger` そのもので、2026-08-21 (v3.88.3) にスコア詳細タブから移設した「イベントと月次試算表」と「年度別の事業・資金推移」。`/api/project/[projectId]/bzm-2-2-pilot` を `src/components/cockpit/bzm-2-2-pilot-client.ts` の共有キャッシュ経由で読み、スコア詳細タブと同じ payload を二重取得しない。404 (pilot 対象外PJ) では section 自体を出さず、エラーカードも出さない。gate月はスコア詳細タブのブラウザ内シミュレーターではなく登録月 (`calculationTrace.inputs.gates[].month`) を使う。表示順は (1) 4開発レーン×5フェーズの表 (SXのみ)、(2) 月次試算表と年度別推移 (pilot対象PJのみ)、(3) 年次試算表 (SXのみ)、(4) `CapitalPlanWorkspace` の100%株主構成推移と資本政策表。数字系の表をまとめ、資本構成を最後に置く。共通の枠は直接的な表題・項目名だけで構成し、PJ固有の事業仮説はフェーズのセルと計画データに置く。フェーズ表の直下の `data-testid="sx-phase-matrix-xlsx-export"` は、表示と同じフェーズ条件・4レーンの活動/費用/出口条件/XRLだけを横長1シートで出力する。先頭2行とレーン列を固定し、数式開始記号の文字列は無害化する。クライアント内のダウンロードだけで、API・DB・保存済み計画を更新しない。年次試算の直下には初期閉じの `data-testid="sx-annual-parameters"` があり、年次の売上・原価・助成金・人員・役員/社員別の報酬・旅費・消耗品費・その他設備投資・IPO以外の資金調達、4段階の自社工場の建設年度/投資額、IPO年度/公募額を変えると、PL・設備投資・株式調達・期末現預金を再導出する。これはページ内の未保存シナリオで、保存済みの資本政策・会社情報を更新せず再読み込みで初期値に戻る。フェーズ表の各セルは活動、予算、出口条件、関連XRLを持ち、列見出しはフェーズ総額、調達源、固定費バーン上限、5軸到達XRLを持つ。資本政策の作業台帳は 2026-08-21 (v3.87.3) に全PJで会社概要タブから事業計画タブへ移した (SXは2026-07-28に先行移動済み)。会社概要タブ側からは `CapitalPlanWorkspace` を完全に外し、確定済みの調達・転換前証券の記録だけを残す。migration 196 はSXの初期原案を1件投入したもので、他PJのプランは自動生成しない |
| goals compact | `CockpitGoalsCompact` | value plan / MS。`MilestoneGanttChart` の各MS行に pt / tag / 担当 / 進捗とあわせて `設計額` を表示し、バー上の担当者 chip には担当設計額も併記する。通常MSは plan cycle 予算、`cap_extra` は同期間の別財布予算から按分し、支払確定額としては扱わない |
| MS change history | `CockpitMsChangeHistory` | `milestone_change_events`。今期MSの直下、`CockpitSeasonFinance` の手前に初期折りたたみで表示する。`/admin/ms-overview` の保存イベントと、2026-07-09 backfill の `source='migration'` 基準線を読み、cockpit からは編集しない。契約本文・メール全文・議事録全文・raw source は扱わない |
| season finance | `CockpitSeasonFinance` | `fetchCockpitFromSupabase` が `billing_cycles`, `projects`, `reward_summary_json` から組み立てた `seasonFinance`。MS リスト直下、月次カードより上に表示し、シーズン全体と月次別に `クライアント支払` / `バッファ` / `原資上限` / `PJ予算` / `メンバー支払` / `期末未払` / `収支` を出す。`期末未払` / `未払残` は支払通知対象の外部メンバーへ将来払う残高だけで、役員分の繰越は会社留保側の内部検算へ寄せる |
| project documents (資料室) | `WorkspaceDocumentRoom` (`?tab=documents` タブ) | 独立タブ。旧「資料室を開く」ボタン (`WorkspaceDocumentLauncher`) は2026-08-21廃止。契約詳細は `pwa/manual/2-3-pj-cockpit.md` 「## 資料」節を正本とする。旧 `CockpitProjectDocuments` (dead code) は2026-08-16 v3.78.3 で削除済み |
| strategy signals | `CockpitStrategySignals` | `project_strategy_signals` |
| project control tabs | `CockpitProjectControl`, `SxWeeklyControlDashboard` (embedded), `/api/project/[projectId]/workspace-bundle` | (2026-08-28 まさ「コックピットとワークスペースを統合できそうじゃない？」→「コックピット側を12タブにしよう」) `週次差分` / `ガント` / `関係先` / `論点・仮説` の4タブ。PJワークスペース (`/project/[projectId]/workspace`) と**同じ `SxWeeklyControlDashboard` を埋め込みモード (`embedded` + `view`) で共有**し、二重実装を作らない。埋め込み時はコンポーネント自前のタイトル行・タブ列・ページ枠を出さず、表示タブは `CockpitView` のタブ列が決める。画面内の導線 (関係先→ガント等) は `onViewChange` でコックピットのタブへ戻す。4タブは1つのマウントを共有するので、行き来しても束を読み直さない。束は可変系なのでキャッシュせず、baseline へ理由付きで登録済み。**認可**: この route は `getCurrentMemberAccess()` だけで認可する AMD メンバー専用面で、外部アカウントの認可解決を持ち込まない (`scripts/check_pwa_critical_ui.cjs` が禁止アンカーで固定)。外向けの共有ワークスペースは `(shared-workspace)` 配下の別ルートのまま残し、認可の境界をルートで持つ設計を変えない |
| project overview tab | `CockpitProjectOverview`, `CockpitVentureStatus`, `CockpitManagementScoreHero` | (2026-08-28 まさ依頼で追加) 常設「PJ概要」タブ (`?tab=overview`)。コックピット最上段にあったものの置き場所で、上から順に (1) PJの姿 = `CockpitVentureStatus` (p00 は `CockpitManagementScoreHero`、ecosystem PJ は AMD Score 対象外なので出さない)、(2) 契約上の実行条件 = `CockpitProjectOverview`。どちらも開いた時だけマウントする。契約は現行契約ごとに、現行契約ごとに `契約期間` / `請求・振込` / `業務・成果物` / `経費申請` / 必要時だけ `推進条件` の最大5項目を出す (NDAは `契約期間` / `利用目的` / `運用条件`)。短文の正本は `projects.contract_terms_json.currentContracts[].terms.cockpitSummary`。読むだけで編集はせず、知財・秘密保持・解除・責任・準拠法などの詳細条項は admin 契約台帳が正本 (`pwa/spec/5-6-contracts-management-current-spec.md`)。最上段の `CockpitHeader` に残すのは PJ名・状態・分類・PJメンバー・共有ワークスペース導線だけ |
| company overview tab | `CockpitCompanyOverview` | (2026-07-16 追加、旧 `CockpitGovernance` を統合廃止。2026-08-21 v3.87.3 に `CapitalPlanWorkspace` を事業計画タブへ移し、`showCapitalPlan` prop ごと削除した) 常設「会社概要」タブ本体。ここに残るのは登記・契約等の証跡に基づく確定済みの記録で、ラウンド計画の編集は事業計画タブが正本。会社基本情報 / cap table (`buildCapTableSnapshots` で現在株・完全希薄化後株を算出) / 100%資本構成推移 / **資本政策表・資金調達ラウンド・転換前証券は 2026-08-29 に独立タブ `?tab=capital-policy` へ移設済み** (下記 `capital policy tab` 行が正本。会社概要側に残るのは発行済株式・完全希薄化後・直近企業価値のKPIカードまで) (J-KISS等、`convertibleScenario` の別枠試算のみで現在持株比率へは混ぜない) / 株主総会・取締役会 / 年次決算 / Excel・PDF出力。全PJ・終了PJでも常設表示。`project_company_profiles` / `project_equity_transactions` / `project_equity_entries` / `project_convertible_instruments` / `project_financial_periods` / `project_valuation_rounds` / `project_shareholder_meetings` (migration 174)。データは `/api/governance` (`requireMember` gate、members登録済みAMDメンバー全員が閲覧・編集可、admin限定ではない)。cap table は単なる現在断面ではなく、confirmed 状態の株式イベント (`incorporation` / `new_issue` / `in_kind_contribution` 等) と次回ラウンド試算を1つの `CapitalPolicyWorkspace`（資本政策ワークスペース）に統合する (2026-07-16, v3.43.2 で旧 `CapitalTimeline` 横棒 + 別枠マトリクス + 選択イベントだけを再掲する冗長 `cap table｜{event}` セクション + 遠く離れた `NextRoundSimulator` を統合、選択イベント再掲セクションは廃止)。`data-testid="cap-table-history-matrix"` は1つの表になり、列見出しがイベント列 (設立・Seed・QST現物出資 等、日付+短縮ラベル) で、各列見出し直下に縦積み100%持株構成バーが乗る (holderNameベース、共通0-100%スケール)。列見出しは実 `<button>` で focus-visible 対応、クリックでその列が試算のベース断面になる (underline/tint、太い丸角選択枠は使わない)。表の下段は発行済株式・新規発行株式・払込/調達額・発行価額・pre-money・post-moneyの行、続けて株主行 (`shares株 · pct%` の1行コンパクト表記)。最終列は `次回ラウンド（試算）` (`仮・FD` ラベル、青の破線区切り) で、同じ縦積みバー・行構成を試算値で表示する。正史が `incorporation` から始まっていない場合は `capTableOriginWarning` により `data-cap-table-origin-warning` の警告 (「創業時の分を遡って再現できない」旨) をワークスペース内に出し、創業時株式イベントの入力導線を提示する。`data-testid="next-round-simulator"` の次回ラウンド試算列と、そのベースだった保護株主 / 目標比率入力は **2026-07-17、`CapitalPlanWorkspace`（下記 `capital plan` 行）へ置き換え・廃止**。単発・未保存の試算という位置づけと「保護株主」概念そのものが、複数ラウンドを保存して積み上げたい実運用に合わなかったため、名前付きシナリオ + 全フィールド編集可 + freeze 版という設計へ移行した。Excel出力も同シートは廃止し、frozen version からのみ生成する `capital plan` 側の出力に一本化した |
| killer factor catalog | `CockpitKillerFactorCatalog`、`/api/governance/killer-factors`、`src/lib/killer-factor-risk.ts` | (2026-08-09 追加、2026-08-10 段階評価へ更新、migration 246 / 249 / 250) 会社概要タブの基本情報直下。`killer_factor_catalog` は全PJ共通マスタで、追加triggerが全既存PJへ `project_killer_factor_states` を補完し、新規PJ作成時も全有効要素を補完する。`operating_mode='prevention'` はAMDが発生前に塞ぐ予防統制で `preventive_action` / `timing_guidance` を必須とし、PJ状態を `unchecked / not_started / in_progress / implemented / controlled` の成熟度4段階と `breached`（統制逸脱）で持つ。`operating_mode='monitoring'` は常時監視で `unchecked / clear / watch / warning / occurred` の悪化度4段階。状態確定時は `status_on` / 非空の `evidence_note` / `recorded_by_member_id` / `recorded_at` が必須、予防統制だけ任意の `target_on` を持つ。DB triggerは方式と状態の不整合を拒否し、旧buildから予防項目へ来る`occurred`を`breached`へ正規化する。GETは全体集計も返し、`occurred / breached`が1件以上なら`critical`、次に`warning / not_started / in_progress`があれば`attention`、次に`unchecked`があれば`unknown`、次に`watch / implemented`があれば`watch`、全件が`clear / controlled`なら`stable`。未確認を安全へ加算しない。UIはfilterを使わず予防統制と常時監視を群見出しで同時表示し、desktopは全体判定+5区分件数と初版7件を`1440×900`で一覧できる44〜64px行、mobileは横スクロールなし。members登録済みAMDメンバーが`requireMember`経由で一覧・共通要素追加・PJ別状態更新を行う。初版7型のうちガバナンスは予防統制、残り6型は常時監視。通知、成功確率再計算、LLM呼び出しは行わない |
| capital policy tab (資本政策表) | `CockpitCapitalPolicy` / `CapitalPolicyTable` / `CapitalRoundsTable` (`pwa/src/components/cockpit/`)、`buildCapitalPolicyTable()` (`src/lib/company-overview.ts`)、共有プリミティブ `company-overview-ui.tsx` | (2026-08-29 追加。まさ「確定済みの調達・潜在株式のところは正式な資本政策表にするべき。全PJとも、ちゃんと表形式に」→ 同日「資本政策表は会社概要から独立させて、新タブにしてほしい。会社概要タブのコンテンツが増えすぎて見にくいので」) **常設の独立タブ** `/project/[projectId]/cockpit?tab=capital-policy`。会社概要タブの旧「確定済みの調達・潜在株式」カード一覧を正式な資本政策表へ置き換え、そのまま独立タブへ切り出した**全PJ共通**面。会社概要 = 登記・総会・年度決算などの会社そのものの記録、資本政策表 = 資本構成の記録、という分担にする。株式イベント / ラウンド / 転換前証券の追加ダイアログはこのタブが持つ (会社概要側からは削除。旧 `CockpitCompanyOverview` の株式イベントダイアログはトリガーが無く到達不能だった不具合もここで解消)。列 = confirmed の `project_equity_transactions`、行 = 株主で、まさが実務で使う cap table 雛形 (`captable_240819.xlsx`) と同じ項目構成にそろえる。1ラウンド = 7項目 (`新規割当分` / `発行済株数` / `払込金額` / `顕在株比率` / `新規発行SO` / `発行済SO` / `潜在込比率`)。行は `holder_type` でグループ化して区分ごとに小計を出し (並びは `founder` → `amd` → `masa` → `vc` → `angel` → `corporate` → `employee` → `other`)、最下段に `合計` / `発行価額` / `調達金額` / `累計調達金額` / `プレ時価総額（顕在）` / `ポスト時価総額（顕在）` / `ポスト時価総額（潜在込）` を置く。**SOは証券種別の名前に依存せず `完全希薄化後 - 顕在` で分離する**ので、`新株予約権` 等の表記ゆれに影響されない。`status='planned'` のイベントは列にしない (計画は事業計画タブの `CapitalPlanWorkspace` が正本)。発行価額とpre/postは連携ラウンド (`project_valuation_rounds`) の登録値を優先し、無ければ台帳から導出する (発行価額 = 払込合計 ÷ 新規発行株数、pre = 直前列の発行済株数 × 発行価額、post = 当列の発行済株数 × 発行価額)。先頭列には pre を作らない。株主がまだ登場していない列はセル自体を持たず、画面は `－` を出す (0株と区別する)。`増減・払込の列を隠す` ボタンで `発行済株数` / `顕在株比率` / `潜在込比率` の3項目に絞れる。**縦方向のcontainer scrollを作らず `overflow-x-auto` だけを持つ** (`CapitalPlanMatrix` と同じ規律。縦に切ると合計・時価総額の行へ到達できなくなる)。株主列は `sticky left-0` で固定し、**区分見出し行は1セルに閉じて `colSpan` で全列を覆わない** (全列を1つの `th` で span すると containing block と同幅になり sticky が効かない)。株式イベント台帳が空のPJでは資本政策表を出さず、`CapitalRoundsTable` (日付 / ラウンド / 発行価額 / 調達金額 / 累計調達金額 / プレ / ポスト / リード投資家) だけを出して、株主別内訳には株式イベント登録が要る旨を案内する。台帳があるPJでも `CapitalRoundsTable` は資本政策表の下に常に出し、**株式イベントに紐づかない計画ラウンド・J-KISS検討行が表から消えないようにする**。列見出しの直下には **FD比率（完全希薄化後）の縦積み100%グラフ** を置く (`FdOwnershipBar`。2026-08-29 まさ「棒グラフでビジュアライズしてあるところは優れてるから、これは今の資本政策表に追加しておいてほしい」で、事業計画タブの資本政策プラン台帳から持ってきた見せ方)。株主ごとの色は `HOLDER_PALETTE` (Okabe-Ito 系8色) を株主の並び順で割り当て、**株主名の左のスウォッチが凡例を兼ねる**。色は株主の識別だけに使い、状態の意味は持たせない。ヘッダーの行見出しは `資本イベント` / `FD比率（完全希薄化後）` / `株主` の3行で、いずれも `sticky left-0`。**ラウンド見出しとグラフはグループ内で左寄せ**にする (中央寄せだと、スマホ幅で1ラウンド分の7列が画面より広く、先頭ラウンドの名前もグラフも見えないまま余白だけが残る)。転換前証券も同じタブ内でカードではなく表 (保有者 / 種別・状態 / 発行日・期限 / 元本 / 評価上限 / ディスカウント / 転換見込株式) にした。Excel出力の `資本政策表` シート (旧 `ラウンド別cap table`) も同じ `buildCapitalPolicyTable()` から生成し、画面と項目構成をそろえる。回帰防止は `npm run test:capital-policy-table` (`pwa/scripts/check_capital_policy_table.mts`) |
| capital plan (資本政策プラン台帳、**2026-08-29 に画面から外した**) | `CapitalPlanWorkspace`、`src/lib/capital-plan.ts`、`/api/governance/capital-plans` | **2026-08-29 まさ「SXは事業計画タブに資本政策表を作っちゃってるから、これを削除しておいてほしい」で、事業計画タブからの結線 (`CockpitBusinessPlan` の `<CapitalPlanWorkspace>`) を外した。資本構成の入口は資本政策表タブ一本にする。** コンポーネント・`/api/governance/capital-plans`・`project_capital_plans` / `project_capital_plan_versions` は削除していないので、必要になれば結線を戻すだけで復活する (保存済みプランは p20 / p21 の2件)。`scripts/check_pwa_critical_ui.cjs` は `CockpitBusinessPlan.tsx` に対する `expectNotIncludes` に張り替えてあり、黙って復活しないことを保証する。以下は結線されていた当時の仕様 — (2026-07-17 追加、旧 `NextRoundSimulator`/保護株主概念を置き換え。2026-08-21 v3.87.3 に置き場所を全PJで会社概要タブ→事業計画タブへ移動) 事業計画タブ内に置く、設立からIPOまでの複数ラウンドを1本の資本イベント列で編集・保存できる作業台帳。DB: migration `179_project_capital_plans.sql` の `project_capital_plans` (作業中シナリオ、`amd_os_is_member()` で全AMDメンバーが全PJを閲覧・編集可) と `project_capital_plan_versions` (freeze 時の append-only 確定版、RLSは `SELECT` のみ・`UPDATE`/`DELETE` は trigger で拒否)。migration `180_freeze_capital_plan_derived_document.sql` (build v3.44.5) で `freeze_capital_plan()` の旧4引数シグネチャを明示的に `DROP FUNCTION` した上で `p_document_json` を追加した5引数版へ置き換え済み (テーブル・データへの DROP/ALTER は無し、関数シグネチャ置き換えのみ)。**名前付きシナリオ**: `project_capital_plans` 行ごとに `name` を持ち、複数シナリオを並行して保存できる。**楽観ロック + autosave**: 編集は800msデバウンスで自動保存され (`saveTimer`)、`revision` 列の楽観ロックで他メンバーとの同時編集衝突を検知し、衝突時はサーバー側 revision を提示して再解決させる。**イベント/割当の全数値editable + provenance**: `CapitalEvent` / `EventAllocation` の株数・金額・単価・評価額などすべてのフィールドは `EditableValue { value, source }` で持ち、`source` は `input` / `calculated` / `imported` / `confirmed` / `override` のいずれか。`calculationBasis` (`valuation_and_investment` / `price_and_shares` / `ownership_target` / `manual`) を設定したイベントは `deriveCapitalPlan` が `calculated` 値を自動導出し、`input`/`imported`/`confirmed`/`override` の値は上書きしない。`override` は算出値 (`calculatedValue`) を保持したまま値を手動置換でき、`collectSourceOverrides` で上書き箇所を横断一覧できる。**複数ラウンド連鎖**: `incorporation` から `equity_issue` / `option_pool` / `convertible_issue` / `convertible_conversion` / `secondary` / `share_split` / `ipo` までのイベント種別を任意個 `order` 順に連結し、`recalculateCapTable` / `deriveCapitalPlan` が上流イベントの改定を下流ラウンドへ再帰的に伝播する。**保護株主概念は存在しない**: 目標比率を守る対象を指定する仕組みは無く、`ownership_target` basis のイベントで割当ごとの `targetOwnershipPercentage` を編集するだけ。**縦積み100%グラフ**: cap table 履歴マトリクスと同じイベント列に揃えて、holderName ベースの縦積み100%持株構成バーを表示する。**バリデーションと freeze**: `validateCapitalPlan` が整数株チェック・比率合計100%・pre/post-money整合・セカンダリ相殺・オプションプール整合などを検査し、`severity='error'` が1件でもあれば `checkPublishEligibility().eligible=false` となり freeze ボタンは無効化される (warning のみなら freeze 可、詳細は下記「提出ブロッカーの可視化」「freezeはサーバー側derive済みドキュメントを凍結」)。**VC向けExcel出力は frozen version からのみ**生成でき (`createCapitalPlanXlsx`)、作業中の未freeze内容からは出力できない。出力ブックは「提出情報」(プラン名・凍結version・source_revision・公開日時/者・検証結果件数・provenance凡例・丸め方針・金額単位・比率表示基準などのサマリー)・「資本政策」(イベント列 × 指標行のcap tableで、評価額・調達額・転換条件などの前提もこのシートに載る。列見出しに揃えた縦積み100%持株構成のネイティブ棒グラフ (`percentStacked` bar chart) をこのシート上に埋め込み表示する)・「投資家別」(投資家ごとの出資・保有スケジュール)・「潜在株式・譲渡」(転換前証券・セカンダリ等の潜在希薄化)・「検算」(バリデーション結果・source override 一覧・イベントごとの整合検算) の5シート構成。**マトリクスはモバイルでも表示され続ける**: `CapitalPlanMatrix` は常時表示のままで、`md:hidden` で消えたり選択1イベント表示に置き換わったりはせず、`max-h-[70vh] overflow-auto` の bounded スクロールコンテナ内で全イベント列にアクセスする。行ラベル列 (`sticky left-0`) とイベント列ヘッダー行 (`sticky top-0`、FD比率バー行も測定済みヘッダー高さ分オフセットして追従) は縦横スクロール中も固定表示され続ける。折りたたみ式の「株主・イベント詳細設定」内にある別コンポーネント `EventEditor` (詳細な割当編集フォーム) だけが `md:hidden` 幅で◀/▶ (`onPrev`/`onNext`) の選択イベント切替ナビゲーションを持つ。**basis driver / 自動算出値の表示**: `calculationBasis` ごとにどのフィールドが driver (編集可) か output (自動算出) かが決まり、output セルは通常時グレーの「自動」バッジ、`source:'override'` 時はアンバーの「上書き」バッジを表示する。output セルは✎ボタンで数値を直接上書き入力でき (`forceOverride`、算出値は `calculatedValue` として保持されズレを表示可能)、上書き後は✕「上書きを解除」で自動算出に戻せる。**新規VC割当の空欄金額**: 新規株主追加はまず割当なしの行を作るだけで、`valuation_and_investment` basis のイベントで金額欄を空欄・0のまま残しても株数フィールドは `source:'calculated'` のまま保持され、金額を入力すると `deriveCapitalPlan` が単価から株数を自動算出する。**basisの直接切替は driver/output の source を正規化**: `changeCalculationBasis` は切替先で driver となるフィールドは現在の解決済み値を引き継いで `source:'input'` に、output となるフィールドは同様に `source:'calculated'` に張り替え、役割が変わった時点で意味を失う古い `override` フラグを意図的に消去する (例: `price_and_shares` へ切替ると各割当の単価は空欄化され、イベント単価のみが全割当を駆動する)。**secondaryの売り手はマイナス株数**: `secondary` イベントでは売り手側の割当 `shares` をマイナス値で表現し (買い手はプラス)、イベント内の合計株数が0でなければ `secondary_net_not_zero`、売買代金が一致しなければ `secondary_amount_mismatch` としてバリデーションエラーになる。**convertible_conversionはmanual固定**: `convertible_conversion` イベントは basis セレクタ自体が UI から出ず、`deriveEvent` / `validateCapitalPlan` の両方が `calculationBasis!=='manual'` を拒否する。転換は自動発生せず、負の `convertible` class 割当 (残高消込) とプラスの発行割当をユーザーが手動で入力しない限り `convertible_conversion_missing_consumption` / `convertible_conversion_missing_issuance` でブロックされる。**提出ブロッカーの可視化**: `checkPublishEligibility` は `validateCapitalPlan` と `validateSubmissionCompleteness` (株主名・設立イベント起点・IPO終端・日付整合・各イベント必須項目の解決済みチェックなど) を統合し、`blockingIssues` / `warnings` を返す。ワークスペースはこれを「検証結果（エラー N件 / 警告 N件）」の折りたたみ一覧としてクリック可能な形で表示し (エラー行は赤、警告行はアンバー)、freeze ボタンは `eligible=false` や未保存・保存中・衝突中に無効化されツールチップで理由を示す。**freezeはサーバー側derive済みドキュメントを凍結**: freeze API はまず保存済み `document_json` を `deriveCapitalPlan` にかけてから `checkPublishEligibility` を再検証し、素通りした未derive値のままfreezeされないようにした上で、derive済みの `{holders, events}` を `p_document_json` として `freeze_capital_plan()` (migration 180版、5引数) に渡す。この関数が revision 検証・`project_capital_plan_versions` への insert・working plan 側 `document_json`/`latest_frozen_version` の更新を単一トランザクションで行う |
| grants | `CockpitGrants` | 助成金 / funding 関連 |
| monthly list/modal | `CockpitMonthlyList`, `CockpitMonthlyModal` | `billing_cycles`, reports / reward / progress |
| meeting summaries | `CockpitMeetingSummary` | `project_meeting_summaries` |
| legacy kanban | `CockpitKanbanGas` / `HudCockpitKanbanGas` | `tasks`。PJ cockpit / HUD cockpit の主要導線からは外す |
| freeze / MS status | `CockpitFreezeBackfill` | freeze backfill and read-only MS period status。MS 設計編集は `/admin/ms-overview` に集約する |

`CockpitMeetingSummary` の通常PJ cockpit表示は、一覧本体に `max-height` と `overflow-y-auto` を置かない。議事録カードや予定MTGカードが増えた場合もカード一覧を縦に伸ばし、コックピット全体のページスクロールで読む。HUD cockpit や detail modal の内部スクロールはこの制約の対象外。

### SX business plan: GRL・資本政策・年次試算（2026-07-28）

- `SX_BUSINESS_PLAN_PHASES[].targetXrl.grl` は内閣府SIPの **Governance Readiness Level** を表す。社会実装に必要な制度・規制・標準・ガイドラインの成熟度であり、値域は `1..8`。SXのフェーズ到達値は Phase 0 / Seed / A / B / C-IPO で `1 / 3 / 5 / 6 / 8`。採用、役割分担、社内統制はGRLでなくHRLへ置く。
- `CapitalPlanMatrix` は縦方向にcontainer scrollを作らず `overflow-x-auto` のみを持つ。各株主は初期状態でFD比率サマリー1行だけを表示し、実button（`aria-expanded`）で金額・株数・発行済株式数・完全希薄化後株式数を展開する。全株主の一括展開/折り畳みも提供する。
- `CapitalPlanMatrix` の金額・株数などの数値は表示時に3桁ごとのカンマで区切る。自動算出を含む金額セルは省略記号で値を隠さず、列幅とセル内折り返しで全額を読めるようにする。FD比率の縦積み棒と凡例は、識別しやすいカテゴリ配色、凡例swatchの外周、隣接segmentの細い境界線を使う。色は株主を見分けるためだけのもので、成功・警告・エラーなどの状態意味を持たない（2026-07-31）。
- 年次試算はすべて百万円の整数・3桁区切りで表示する。`sxAnnualProjectionWithCash()` は売上原価と役員報酬/給与・賞与/研究開発費/その他販管費から営業利益を導出し、助成金収入（特別利益）と圧縮損（特別損失）から税引前利益（簡易）を導出する。資金繰りの助成金入金は別フィールドで、期末現預金には加えるが、圧縮損とは相殺しない。税金・借入・運転資金増減は未反映。
- SX（p21）の`Bzm22TimeLedger`（事業計画タブ）はP/Lの同じ月列へ、月初資金、営業C/F（営業利益代用の簡易値）、設備投資、株式調達、融資、助成金等入金、月次純C/F、月末資金を続ける。融資未登録は0円でなく未計画。PSI Step 2の6,000万円はPhase 0非希薄化資金の同一cashなのでFY2027へ再計上しない。採択額7,800万円は`project_grants`の採択証拠として表示するが、`disbursed_yen`未登録の間は実績入金へ置き換えない。BZM経済CFはJ/P用の別計算。表外に`単位：百万円`を一度だけ置き、月・金額は右寄せ、等幅数字、14px以上で表示する。
- `Bzm22TimeLedger`の月次表直下には`data-testid="bzm22-annual-finance-chart"`を置く。4月始まりFYで表示済みの月次P/L・C/Fだけを集計し、FY列を左から右へ連続させる。上段「事業構造」は売上（基準線上）、費用内訳（基準線下の積層）、営業利益（中央の細線）を共通尺度で比較する。下段「資金レール」はP/Lと別尺度で、株式調達・助成金等入金・年次純C/Fを同じFY列へ揃える。調達は売上ではない。設立前PJ支出はNewCo P/L・営業利益に混ぜず、資金レールの独立棒「NewCo P/L外」として表示する。mobileでもFY列を圧縮して同じ横軸を維持し、意図しない横スクロールを作らない。
- LiSTie（p07）は、取締役会資料に月別で記載されたC/Fを`project_monthly_cashflow`から読む。P/Lの行数やBZM経済CFで資金繰りを補完せず、実績・見込の状態を分けて、資料にある12か月分だけを表示する。
- 2026-08-17改定: グラフ本体は`max-w-6xl`に抑え、年度内の各系列棒を同じ`w-4`幅で統一する。上段「事業構造」は売上（基準線上）、費用内訳（基準線下の積層）、営業利益（基準線をまたぐ同幅の棒）を共通尺度で比較する。下段「資金レール」はP/Lと別尺度で、株式調達・助成金等入金・年次純C/F（および該当時の設立前PJ支出）を同幅棒で同じFY列へ揃える。グラフ直下の「年度別数値」表はFY列を再利用し、売上・費用計・全費用内訳・営業利益・資金項目・設立前PJ支出の正確な値を読める。表だけはmobileで意図的な横スクロールを許可する。

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

## Project Documents Contract (削除済み — 2026-08-16 v3.78.3)

PJ cockpit の「資料室」は `資料室` タブ (`WorkspaceDocumentRoom.tsx`) / `workspace_documents` テーブルが正本。契約詳細は `pwa/manual/2-3-pj-cockpit.md` 「## 資料」節、API境界は `pwa/spec/2-1-pwa-runtime-routes.md` を参照。

以下はこの節にかつて記載されていた、`projects.drive_folder_id` 配下の `AMD OS資料室` folder + `project_documents` テーブル + `CockpitProjectDocuments` コンポーネントによる旧実装の契約。`CockpitProjectDocuments` は `CockpitView` からどこからも呼ばれていないdead codeで、実際に画面へ表示されたことは一度も無かったため、API・コンポーネント・同期ロジックとも2026-08-16 (v3.78.3) に削除した。`project_documents` テーブル自体は `app/api/project/monthly-report-print/route.ts` が月次レポート添付一覧の読み取り専用ソースとして使うため残す:

| item | contract (削除済み、参考記録) |
|---|---|
| source project folder | `projects.drive_folder_id` |
| dedicated folder | `AMD OS資料室` under the source project folder (renamed from `AMD OS 資料` on 2026-08-16 via drivefs `mv`; folder ID unchanged) |
| upload API | ~~`POST /api/project-documents`~~ (removed) |
| list API | ~~`GET /api/project-documents`~~ (removed) |
| reconcile API | ~~`POST /api/project-documents/reconcile`~~ (removed) |
| reconcile logic | ~~`src/lib/project-documents/reconcile.ts`~~ (removed) |
| DB table | `project_documents` (`pwa/scripts/migrations/131_project_documents_drive_uploads.sql`)。テーブルは残置、月次レポート印刷の読み取り専用ソースとしてのみ現役 |

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

`CockpitMonthlyModal` は月次報告書の直接入口を持たず、該当PJの**ドライブで開く**だけを置く。社内版 (`template=internal`) と提出版 (`template=submission`) は `月次報告書 / YYYY年M月` の仮想entryから開く。主要成果物も同じfolderのfile/linkに集約し、社内版の「主要成果物」欄から認可済みrouteで開く。提出先名を操作ラベルへ埋め込まない。旧 template (`nims-cx` / `ehime-sx` / `kogakuin-kute`) は既存 URL 互換のため route だけが受理する。提出版は `monthly_reports_external.body_md` を業務遂行レポートへ差し込み、章ごとの強制改頁を入れず自然改頁で流す。

## Monthly Modal / API Contract

| modal | trigger | read | write / call | success state |
|---|---|---|---|---|
| `CockpitMonthlyModal` 社内版本文 panel (`本文を編集`) | monthly card / report-only month | `monthly_reports`, `billing_cycles`, MS bundle | `/api/monthly-report/manual-update`, `/api/report/fix` (いずれも非LLM) | `monthly_reports.status='fixed'` or `fixed_at` set |
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

資料室 (`資料室` タブ / `WorkspaceDocumentRoom`) の failure/validation は `pwa/manual/2-3-pj-cockpit.md` 「## 資料」節と `pwa/spec/2-1-pwa-runtime-routes.md` の `workspace-documents` 系 validation (`test:workspace-documents-core` / `test:workspace-documents-contract`) を正本とする。

## Validation

- `npx tsc --noEmit`
- `npm run build`
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

## 旧SX COO統合経営ワークスペース（2026-07-19履歴・2026-08-12廃止）

以下は削除済み `ProjectWorkspaceDashboard` の設計履歴であり、現行UIの要件として再実装しない。`/project/[projectId]/workspace` は既存の完成済み `SxWeeklyControlDashboard` へ一本化し、旧 `/weekly-control` は同URLへredirectする。PJ・AMD・大学の三者設計に存在しない第4の共通画面を新設しない。

### 判定契約

初期画面の上部には、derivedの全体判定（順調 / 注意 / 危機 / 未評価）、理由最大3件、今週決める最大3件、次期限、最終確認日、必須項目充足率、停止中の柱、重大な未確認を一続きで置く。充足率は表示専用で、順調判定の条件にはしない。critical/highのKPIが0件、期限/担当/鮮度/依存/完了条件が不足、閾値外、期限超過、停止、循環依存があれば順調を許さない。将来ゲートは完了証跡ではなく完了条件と現在のKPI/検証根拠で評価し、実績完了時だけ完了証跡を必須にする。

4本柱は同一比較軸で、現在ゲートは未完了のうち依存順・開始済み・期限近いものを決定的に選ぶ。全て完了した柱だけ最後の完了ゲートを表示する。依存待ちと停止は、必須性、lag、予定開始日、期限超過を分けて表示する。4本柱信号帯の各ボタンは、状態・証拠充足（担当/完了条件/測定済みKPI/鮮度確度の4チェックから算出、`SxReactorPanel`）・予定との差（`sxFormatDelta`、確定日は日数、仮置き日は`予測差`表記）・次期限・最大の詰まり（`track.maxIssue`）を同一面で同時に示す。進捗率の主観値を証拠充足へ混ぜない。

### 三つの証明（オンサイトPoCへの実証経路）

`TRL5`は達成状態の補助ラベルに下げ、オンサイトPoCへ進むための主経路を独立した3つの証明対象として管理する: `PoC用リアクター仕様確定` / `確定仕様での動作確認` / `ユニットエコノミクス証明`（完了条件は`SX_COO_DASHBOARD_SPEC_20260719.md` 3.3.2の定義に一致）。

7つの開発テーマ（リアクター構成、処理性能、再現性、スケール成立性、封じ込め、回収、オンサイトPoC。`TRL5`は補助ラベルのみ。スラッグは`tech-reactor-recheck` / `tech-performance-test` / `tech-reproducibility-test` / `tech-scale-test` / `tech-containment-test` / `tech-recovery-test` / `tech-poc-gate`）から3つの証明への接続は、DB非依存の型付き中央マップ `pwa/src/lib/sx-proof-mapping.ts`（`SX_THEME_PROOF_MAP: Record<スラッグ, 証明ID[]>`）で定義し、UIとテストが同じ定義を参照する。各テーマは最低1つの証明へ接続し、未接続のテーマは無い（`scripts/test_sx_proof_mapping.mjs`で検査）。

`SxProofOutcomes`は各証明カードに、関連テーマの評価済み件数/全体件数、状態分布（順調・要確認・停止・未評価の横積みバー）、証拠充足率、判断期限（関連テーマ自身に登録された最も近い予定/予測日）、不足情報を表示する。個別技術試験に期限がない場合は親リアクターの期限を借用せず「未登録」のまま扱う。関連テーマが全件未評価の場合、証拠充足率は`0%`ではなく`null`（表示は「未評価」）として扱い、未評価を達成率0%と誤認させない。接続は7×3のマトリクス（テーマ行 × 証明列、接続時は塗りつぶし丸）で常時可視化する。

### 経営航路の台帳

#### 表示構造（Round 16）

`/project/[projectId]/workspace` は desktop で GlobalNav サイドバーを使わず、ワークスペース内部専用の 152px 幅セクションナビ（`lg:grid-cols-[152px_minmax(0,1fr)]`）を左に固定表示する。mobile/tablet は同じナビが横スクロールの上部帯になる（「左サイドバーが一切無い」という記述は誤り）。事業化ロードマップのタイトルは固定の「9か月」表記ではなく、データから導出した絶対期間ラベル（現在は 2026年7月〜2027年3月）を `事業化ロードマップ` 直下に表示する（`SxNineMonthTimeline`、`formatPeriodLabel(months)`）。論点・仮説台帳は desktop では意味的な表（セマンティックテーブル）、mobile/tablet では高密度な key/value 行に再構成する。関係先リストはdesktopで 関係先 / 関係段階・要対応 / 直近接点 / 現在ボール・期限 / 関連・操作 の5列固定register、mobile/tabletでは同じ1社1行DOMを縦積みにする。保有事項・約束・全接点・目標状態は行の「詳細」に保持し、初期比較面へ重複列を作らない。短い action系ラベルは `nominalizeSxActionLabel` で名詞止めに整形して表示し、地の文・根拠テキストはそのまま加工しない。`project_management_partners.next_ball_owner` と `project_management_partner_work_items.handoff_to` は DB/API 互換のために残る legacy 列で、UI の表示・編集フォームどちらにも出さない（migrationなし）。

目的 → 柱の成果目標 → KPI → マイルストーンをPJ内の関連情報として接続する。KPIは`baseline / target / actual / unit / threshold / threshold_rule / threshold_upper / measurement_date / frequency / source / confidence`を持ち、`gte`（以上）、`lte`（以下）、`between`（範囲内）をAPIと計算ロジックで検証する。`actual=0`は値として扱い、`between`の上限欠落やlower > upperは「判定条件不足」とする。

マイルストーンは完了条件、完了証跡、重要度、基準計画版、予測変更理由を持つ。依存は正規化テーブルで必須/任意・lagを保持し、DB triggerがPJ混在と循環を拒否する。手入力statusは表示用の記録であり、overall/trackはderived stateを正本とする。

論点→複数仮説→根拠/反証・不足→次の検証→意思決定→actionの閉ループを、選択ゲートの詳細から同じ文脈で表示する。意思決定は理由、決定者、決定日を持ち、actionは担当、期限、完了条件、完了証跡、次回確認を持つ。会議/更新履歴とfield auditは削除せず追跡できる。

関係先は機関別に段階（候補 / 情報交換 / 条件整理 / 面談調整 / 検証準備 / 合意確認 / 実行中 / 保留、= stage rail。維持）、合意状態、最終接点、期限、担当、関連ゲート、約束履歴を表示する。約束履歴は相手の約束とSX側の次アクションを分け、相手担当・約束日・一次根拠が揃う場合だけ相手の約束にする（この境界は 2026-07-24 の二車線再実装後も不変）。「台帳の詳細・編集」内の約束カード（`PartnerLedgerDetails`）は完了・停止・取消を含む全件を、`status`（open/in_progress/completed/blocked/cancelled、`HOLDING_STATUS_TONE`/`LABEL`共有）・`completedOn`・`nextReviewOn`・`confidence`（`sxConfidenceLabel`）・`promisedOn`と`dueDate`の両方・`counterpartyOwner`/`sxOwner`の両ownerを常時表示し、権限に関わらず誰でも読める（2026-07-24 最終監査残件是正、旧: `commitmentKind`でownerを片方だけ条件表示していた）。`commitment.evidence`は常に「一次根拠」とだけ表示し「完了の証拠」と呼ばない。約束カードは`HoldingRow`と同じ形式の「出典: {`sxSourceKindLabel(commitment.sourceKind)`} ({`sxSourceRefDisplayLabel(commitment.sourceRef)`}) ・ 最終確認 {`lastVerifiedAt`} ・ 確度 {`confidence`}」行も表示する（2026-07-24 RD最終差し戻し是正: 従来この行が抜けており、commitmentの出典が保有事項プレビューにしか出ていなかった）。`sourceRef`はここでも`sxSourceRefDisplayLabel()`を必ず経由し、raw URLや内部tracking key文字列を直接表示しない。

`project_management_partners`は migration 191 (`191_sx_partner_ledger_upgrade.sql`) で `current_ball_side`（`sx`/`partner`/`shared`/`none`/`unknown`）、`current_ball_owner`、`next_ball_owner`、`target_state`、`due_date_precision`（`day`/`month`/`unknown`）を additive 追加した。既存 `due_date` は目標期限のまま、`due_date_precision` がその期限をどこまで確定できているかを持つ。表示は `sxFormatDueDateWithPrecision()` (`pwa/src/components/project-workspace/sx-visual-shared.tsx`) が担い、precision `month` は「2026年8月（日付未確認）」、`unknown` は「期限未設定」に閉じ、存在しない具体日を作らない。DB CHECK `project_management_partners_due_date_consistency_191` が `due_date_precision='unknown'` なら `due_date IS NULL`、`day`/`month`なら `due_date IS NOT NULL` を強制し、management APIの`assertDatePrecisionConsistency()`がcreate/PATCHのmerged値（patch優先、未指定分は既存行の値）で同じ整合性を日本語エラーで事前検証する。

`project_management_partner_interactions`（migration 191 で新設）は協力機関ごとのやり取り履歴を append 型で保持する。列は `project_id, partner_id, interaction_kind`（`meeting`/`email`/`agreement`/`deliverable`/`handoff`/`status_update`/`note`）、`occurred_on` nullable、`occurred_on_precision`（`day`/`month`/`unknown`）、`summary`、`outcome_summary` nullable、`ball_side_after`、`ball_owner_after` nullable、`confidence`、`source_kind`、`source_ref`、`deleted_at`/`deleted_by`/`version`（他 `project_management_*` 表と同水準の soft delete/RLS/`amd_os_can_manage_project_shared_data()` write/service_role/authenticated物理DELETE拒否/`project_management_audit_fields()` field audit/`project_management_touch_updated_at()`）。migration 192 (`192_sx_partner_role_and_work_items.sql`) で `actor_side`（`sx`/`partner`/`shared`/`unknown`。DB CHECK `project_management_partner_interactions_actor_side_check_192`）と `actor_label` nullable を additive 追加した。`actor_side` は「その接点を行った側」、`ball_side_after` は「以後ボールを持つ側」で、意味の異なる別データ。`actor_side` を `ball_side_after` から逆算しない（既存行は`unknown`のまま開始。p21 seedの既知4件だけ current-truth backfill: NDA=shared、試作リアクター製作完了=partner、初回面談=shared、窓口移管方針=sx。「2026年8月の納品予定を確認した」は一次情報でどちら側が確認したか確定できないため`unknown`のまま明示的に残す — ボール保持側からの推測は禁止。`source_ref='user:2026-07-23#partner-progress'`）。親guardは `project_management_parent_project_guard('project_management_partners', 'partner_id')` を適用し、`partner_id` が別PJの協力機関を指せないようにする。DB CHECK `project_management_partner_interactions_date_consistency_191` が `occurred_on_precision='unknown'` なら `occurred_on IS NULL`、`day`/`month`なら `occurred_on IS NOT NULL` を強制し、management APIの`assertDatePrecisionConsistency()`が同じ整合性をmerged値で検証する。生メール本文・URLは持たず、`summary`/`outcome_summary`は安全な要約のみ。管理API (`/api/project-workspace/[projectId]/management`) には resource `interaction` を追加し、create/edit/soft-delete/restore、`PARENT_FIELDS.interaction=[["partner_id","project_management_partners"]]`による親PJ検証、`CREATE_RESOURCES`/フォームへの統合を行った。

**関係先の役割・関係状態の正規化**（migration 192 で新設 `project_management_partner_roles`。`source_kind`/`source_ref`列はcurrent_truth/manual/importedの既存契約と揃え、CREATE TABLE時点から必須にする。seedのべき等性は`source_ref`単独で判定し（`deleted_at IS NULL`条件を付けない）、ユーザーが後からsoft-deleteした行を再適用で新規active行として復活させない。migration末尾のverificationも同じくsource_ref基準の履歴件数で判定し、正当なsoft-delete後の再適用を失敗させない）: 機関ごとに役割（`role_kind`: `joint_development`共同開発 / `contract_manufacturing`製造委託 / `customer`顧客 / `shareholder_investor`株主・投資 / `government`自治体 / `media`メディア / `financial_institution`金融機関 / `university_research`大学・研究機関 / `support_organization`支援機関 / `other`その他 / `unclassified`未分類）と関係状態（`relationship_state`: `candidate`候補 / `in_progress`進行中 / `established`成立 / `on_hold`保留 / `ended`終了 / `unconfirmed`未確認）の2軸で多対多に正規化する。1partnerにつき`is_primary=true`の行は有効行内で最大1つ（unique partial index `project_management_partner_roles_one_primary_192 ON (partner_id) WHERE is_primary AND deleted_at IS NULL`）、副分類（`is_primary=false`）は複数持てる。`role_kind`は既存自由記述（`partners.role_label`）から推測せず、安全に確定できない機関は`unclassified`に閉じる。表示は `sxRoleDisplayLabel(roleKind, relationshipState)`（`pwa/src/lib/sx-partner-holdings.ts`）が役割+状態を「共同開発先」「共同開発候補先」等の複合ラベルへ組み合わせ、`on_hold`/`ended`/`unconfirmed`は複合サフィックスを作らず役割名のみ＋別バッジで状態を示す。p21 current-truth (`source_ref='user:2026-07-24#partner-role-normalization'`): 愛媛大学=大学・研究機関、SMBC=金融機関、Partners Fund=株主・投資候補（`relationship_state='candidate'`を明示指定、`relationship_stage`由来の自動導出より優先）、ダイキアクシス/EWIR候補機関A/ファインケムは`unclassified`のまま（表示役割の自由文`role_label`は保持）。`relationship_state`は上記3件を除き既存`relationship_stage`からの決定的な正規化（`candidate→candidate`、`information_exchange`〜`agreement_confirmation`→`in_progress`、`executing→established`、`on_hold→on_hold`）で、事実の推測ではなく既存structured columnの粗い再分類。

**当方/先方の保有事項台帳**（migration 192 で新設 `project_management_partner_work_items`）: 列は `project_id, partner_id, side`（`sx`/`partner`/`shared`/`unknown`）、`item_kind`（`task`/`question`/`deliverable`/`decision`/`approval`/`response`）、`title`、`detail` nullable、`owner_label` nullable、`status`（`open`/`in_progress`/`waiting`/`blocked`/`on_hold`/`completed`/`cancelled`）、`due_date` nullable、`due_date_precision`（`day`/`month`/`unknown`、DB CHECK `project_management_partner_work_items_due_date_consistency_192`）、`completion_criteria` nullable（確認できない完了条件は空のまま、勝手に作らない）、`completed_on`/`completion_evidence`/`accepted_by`/`accepted_on`（すべてnullable。完了の監査可能性のために追加）、`handoff_to` nullable、`related_milestone_id` nullable（他表と同水準の soft delete/RLS/parent guard/field audit/touch updated_at）。1機関に複数の保有事項を側別に持て、`nextCommitment`一本へ潰さない。完了の監査契約: `status='completed'`は`completion_criteria`/`completion_evidence`/`completed_on`が既に埋まっていることが必須（DB CHECK `pm_partner_work_items_completion_check_192`、旧名`project_management_partner_work_items_completion_requirements_192`はPostgresの63byte識別子制限で実DBでは`project_management_partner_work_items_completion_requirements_1`へ黙って切り詰められRLS testが失敗したため2026-07-24に短縮名へrename）、さらに`item_kind='deliverable'`かつ完了なら`accepted_by`/`accepted_on`も必須（DB CHECK `pm_partner_work_items_acceptance_check_192`、旧名`project_management_partner_work_items_deliverable_acceptance_192`も同様の理由で短縮）。確認できない完了は空欄のまま`completed`にせず、事実を捏造しない。API (`assertWorkItemCompletionRequirements()`)がPOST/PATCH双方でmerged値を同じ条件で検証し、型（`SxPartnerWorkItem.completedOn`/`completionEvidence`/`acceptedBy`/`acceptedOn`）・編集フォーム（`ProjectWorkspaceDashboard`のEDIT_FIELDS/createFieldsFor）・表示（`HoldingRow`の完了条件行）まで揃える。既存 `project_management_partner_commitments`（相手の約束/SX側の次アクション、相手担当・約束日・一次根拠が揃う場合だけ相手の約束、という既存境界は不変）は削除・意味変更せず、UI表示では有効な commitment を対応側（`counterparty_promise`→先方、`sx_followup`→当方）の保有事項へ統合表示するだけ（`sxHoldingsForPartner()`、`pwa/src/lib/sx-partner-holdings.ts`）。統合先の`SxHoldingItem`は`sourceEvidence`（commitmentの一次根拠、状態に関わらず存在しうる）と`completionEvidence`（work itemの完了の証拠、`status='completed'`のときだけ）を別フィールドとして持ち、UIも「一次根拠:」「完了の証拠:」を別行で表示する（2026-07-24 P1是正: 従来はcommitment.evidenceをcompletionEvidenceへ誤って詰め、未完了のcommitmentの一次根拠が「完了の証拠」に見えるバグがあった）。`SxHoldingItem`は`sourceKind`/`sourceRef`/`lastVerifiedAt`/`confidence`も持つ（2026-07-24 最終監査残件是正、同日RD最終差し戻しで`sourceRef`の欠落を修正）: work item・commitmentのどちらも`project_management_partner_work_items`/`project_management_partner_commitments`双方にネイティブの`source_ref`列を持つため、`mapCommitment()`（`pwa/src/lib/sx-management.ts`）が`SxPartnerCommitment.sourceRef`へ転写し、`commitmentToHoldingItem()`（`pwa/src/lib/sx-partner-holdings.ts`）がそれを`SxHoldingItem.sourceRef`へそのまま転写する（値が無いcommitmentは`null`のまま、捏造しない）。`HoldingRow`（優先2件プレビュー・全件監査リスト共有）は`sxSourceKindLabel()`（current_truth/manual/imported）と`sxSourceRefDisplayLabel()`（raw URLは「外部リンク（詳細は編集画面で確認）」、`user:YYYY-MM-DD#topic`形式の内部tracking keyは「手動記録 YYYY-MM-DD」に整形しrawな値を画面へ出さない）を使い「出典・最終確認・確度」行を表示する。p21 current-truth (`source_ref='user:2026-07-24#partner-work-items'`): ダイキアクシス先方=試作リアクター納品（期限2026-08 month精度、担当未確認、handoff=SX受入確認担当未確認）、ダイキアクシス当方=納品日と受入確認条件を確認（期限unknown、担当未確認）、SMBC当方=石原先生から窓口変更案内（期限unknown、担当石原先生、handoff=まさ）、SMBC当方=窓口引継ぎと直接連絡開始（`waiting`、期限unknown、担当まさ）。

`SxPartnerPipeline`（2026-07-24 二車線ボール管制。同日中のCOO/研究開発/UIUX監査是正後の確定版）は全機関を1本の共有罫線台帳で表示する（旧: 重要経路の協力機関だけを主要viewに出し、優先度低・保留は末尾注記のみに縮退させていた表示は廃止。全件を管制から消さない）。

**管制帯（単位別、2026-07-24 4回目のUIUX是正で「緊急／ボール／母数」の順へ並び替え。まず読むべき緊急度を先頭に置く）**: `sxComputeControlBandCounts()`はpartner単位の品質集計とholdings単位の緊急集計を明確に分ける。母数行の品質集計（`totalPartners`全関係先/`activePartners`対応中/`deferredPartners`保留/`endedPartners`終了/`unclassifiedPartners`未分類/`unorganizedPartners`台帳0件先/`organizedCoveragePct`登録率）は保留（`deferredLowPriority`）・終了（`sxIsPartnerEnded`）を含む全関係先を分母にする — 保留・終了だからといって「全関係先」から消えない。`activePartners`は保留と終了の両方を除外する。`unorganizedPartners`/`organizedCoveragePct`は当方/先方いずれかのレーンの保有事項が0件のactive機関を数える——レーンが空であることが「未整理」なのか「確認済みで実際に0件」なのかを区別するreviewed flagが無いため、確認済み0件と断定しない（表示は「台帳0件先」「登録率N%（対応中M先中）」で、確定的な「未整理」「組成率」という言い回しは使わない、2026-07-24 4回目是正）。ボール行（`totalHoldings`未完了事項/`sxHeld`当方保有/`partnerHeld`先方保有/`sharedHeld`共同/`sideUnknown`保有側未確認/`bothSidesHeldPartners`双方保有先）と緊急行（`blockedHoldings`停止/`overdue`期限超過/`dueSoon`7日以内/`dueMonthPrecision`月精度期限/`dueUnset`期限未設定/`ownerUnconfirmed`担当未確認）はいずれもactive（非deferred・非ended）partnerの保有事項だけを分母にする。`overdue`/`dueSoon`は`due_date_precision='day'`の項目だけを対象にし（`sxIsHoldingOverdue`/`sxIsHoldingDueSoon`）、month精度は`dueMonthPrecision`という別バケットに分離するため、month精度の未来期限が誤って「期限超過」に数えられることも、Holding表示で赤く塗られることもない。mobileは行ごとに`overflow-x-auto`の単一行横スクロール（折り返さない）＋十分な右余白と`focus-visible`リング（`SCROLL_HINT_CLASS`）＋非フェードのaria-hidden矢印（`ScrollHintArrow`、sm+では非表示）＋`tabIndex={0}`のkeyboard到達性（2026-07-24 4回目是正、同日の最終監査残件是正で末尾指標を薄くする`mask-image`のcontent-fadeを撤去しこの形へ変更）。分類別件数ナビ（`sxPrimaryRoleKindCounts()`、2026-07-24 4回目是正で保留・終了を含む全partnerを集計するよう変更 — active限定だと、対象が保留・終了機関しかいない分類のチップが恒久的に0件のまま出せず、その分類がCategoryNavから絶対に選べなくなる問題があったため）は補助filter chipとして残り、色は選択状態だけに使い分類ごとの色分け（虹色）はしない。選択チップには色に加え`✓`グリフと`aria-pressed`を持たせ、色だけに依存した選択表現をしない。mobileは`overflow-x-auto`の単一行横スクロール＋十分な右余白/focus-visibleリング/非フェードの`ScrollHintArrow`。

**初期表示のgroupBy**: `sxGroupPartnersByPrimaryClassification()`がactive（非deferred・非ended）partnerを主分類（`roleKind`×`relationshipState`）ごとにグループ化し、見出し（`<h4>`）＋件数を1度だけ表示する。同じ`roleKind`でも`relationshipState`が違えば別グループ（「共同開発先」と「共同開発候補先」は常に別枠、統合しない）。`unclassified`は`sxRoleDisplayLabel`が常に状態と複合する（「未分類・候補」「未分類・成立」等、2026-07-24仕様転換——旧・状態を無視した一律「未分類」は廃止）ため見出しだけで区別できる。`joint_development`等の分類済みroleは`in_progress`/`established`のように複合ラベルが同じ文字列（「XX先」）になる場合があるため、見出しに`（${state}）`を必ず併記し、各行の役割行にも`・${state}`を併記する（unclassifiedは複合ラベルに既に含むため二重表示しない）。グループ内は共有の表示ソートキー（`sxPartnerDisplaySortKey`＝active holdingの直近期限→partner期限→未設定）で並べ、これは各行に実際に表示される期限と完全に一致する。`unclassified`グループは常に末尾。CategoryNav（補助filter chip）で絞り込むと対象`roleKind`のグループと、保留/終了のtrailing sectionも同じ`roleKind`だけに絞られる。

**関係先比較タブ（2026-08-01 現行）**: PoC候補先とVCは同一partner台帳を絞る横断表示であり、独立台帳や固有段階は作らない。`全関係先 / PoC候補先 / VC` は排他的に切り替え、PoC候補先は既存のPoC判定、VCは保存済みroleの`role_kind='shareholder_investor'`だけで判定する。名称から分類を推測しない。PoC候補先/VCタブでは役割groupを比較主軸から外し、全対象を1本のcompact row一覧にする。主列は`関係先 / 現在の状況 / ゴール / 詰まり・PJ影響 / 次にやること / 担当・期限 / 現在地の根拠 / 履歴・保有`。`現在の状況`には現在地stepだけ、`ゴール`には目標状態だけを表示する。確認済み接点（古い順）→現在地→未完了work item→次の一手→ゴールの可変`進行状況`は詳細モーダルへ移し、会社名下railと詳細内の進行blockが同じ`buildPartnerProgressSteps()`の配列を受け、件数と順序を必ず一致させる。行全体を1つの詳細ボタンにして、どの表示セルからでも同じモーダルを開く。停止・期限超過・7日以内・情報更新要・当方ボール・判定材料不足は進行stepと別の関係先単位判定として扱う。並びは要対応→当方ボール→期限→直近接点で決め、旧固定段階をtie-breakにも使わない。全履歴・保有事項・目標・編集は行下へ展開せずモーダルに表示する。要対応集計は表示中partner単位へ追随し、全対象件数と表示件数を分ける。行自身の会社名短縮は限定文型だけを「先方」へ置き換え、保存値・詳細履歴・複合名・第三者名は変更しない。通常の関係先一覧も現在ボールの側だけでなく担当者名を表示する。migration 211はDAVPを既存ダイキアクシスの技術納品行と混ぜず別partnerとし、BNV・いよぎんキャピタルとともに`shareholder_investor/unconfirmed`で登録する。合意・接触・ボール・期限・ゴールは根拠がないため未確認のままにする。

**旧レイアウト（2026-07-24時点。2026-07-30の5列1社1行とPoC比較レンズにより初期表示は廃止）**: 各機関行は1440px（`xl:`）で「関係先/段階・当方保有・先方保有・次の一手・目標状態・現在ボール・期限・やり取り履歴」の7列共有罫線行（`rowGridCols`＝`xl:grid-cols-[128px_minmax(130px,1fr)_minmax(130px,1fr)_120px_120px_108px_124px]`）。768px（`md:`〜`xl:`未満）と390px（base）はどちらも当方保有/先方保有の二車線（`grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:grid-cols-[1fr_1fr]`）のみで、関係先名・次の一手・目標状態・現在ボール・期限・やり取り履歴の各ブロックは二車線の両方にまたがる全幅ブロックとして縦積みする（列を割り当てない）。いずれもページ全体の横overflowは0、カードの入れ子は作らない（同一DOM構造をCSS grid-cols/col-start/row-startだけで再配置し、幅ごとに別JSXツリーへ分岐させない）。当方保有・先方保有の各セル（`HoldingsCell`）は`side='sx'`/`side='partner'`だけを対象にし（共有・未確認は複製しない）、優先度順（`sxSortHoldingsByPriority`＝blocked最優先→day精度期限超過→day精度→month精度→期限未設定）の優先2件＋「ほかN件」ボタン（クリックで行を展開し、既定で開いた「台帳の詳細・編集」内の全件監査リストへ到達）を表示する（2026-07-24追記: 旧・期限昇順のみの並びから変更、詳細後述）。双方/共同（`side='shared'`）と`side='unknown'`も同じ`HoldingsCell`（優先2件＋「ほかN件」）で表示し、無制限列挙はしない（2026-07-24追記、詳細後述）。保有事項は角丸カードをやめ、共有罫線＋左ステータス線（`HoldingRow`/`HOLDING_STATUS_LINE`）の高密度行にした。各保有事項は`related_milestone_id`からゲート名（`gateAndProofForItem()`）を表示し、そのゲートが7開発テーマに該当する場合だけ証明名まで解決、未接続は項目単位で「ゲート未接続」と明示して推測しない。現在ボール・期限は現在ボール（`currentBallSide`/`currentBallOwner`）と直近期限だけを示す独立ラベル付きブロックで、次の一手/目標状態とは混在させない（次の受け渡し先という可視項目は存在しない）。`project_management_partners.next_ball_owner`と`project_management_partner_work_items.handoff_to`はDB/API互換のためだけに残るlegacy列で、表示にも編集フォームにも出さない。7列目「やり取り履歴」列は、その機関に関連する全マイルストーンのタイトルを列挙する詳細ではなく、`gateAndProofForItem()`/`SX_THEME_PROOF_MAP`から解決した「関連ゲート」「寄与する証明」（7開発テーマに該当する場合だけ証明名まで解決、未接続は「証明 未接続」と明示して推測しない）、`latestRecordSummary()`による「最新記録」の3ラベル付き要約と、履歴を開くトリガーを持つ（`sxSortInteractionsByRecency()`、日付未確認は記録時刻basisで並び、将来日付の既知イベントに追い越されない）。

**やり取り履歴**: `InteractionTimeline`は本文だけを持ち、分類編集/保有事項編集/約束カードは分離した別`<details>`「台帳の詳細・編集」（`PartnerLedgerDetails`）へ移した（履歴の実高に混ぜない。2026-07-24 4回目是正で`open`属性を外し、この`<details>`は既定で閉じた44pxの`<summary>`だけを表示し、ユーザー操作で初めて開く）。履歴イベント行（`InteractionRow`、2026-07-24 4回目是正でgrid化）は共有/未確認/通常すべて共通の1イベント1本・全幅罫線行（`h-16`固定＋`overflow-hidden`、上下2段・角丸色面なし）で、mobileは`grid-cols-[56px_minmax(0,1fr)_64px_44px]`（日付＋種別／本文／ボール／編集）、`md`以上は`md:grid-cols-[56px_68px_minmax(130px,1fr)_64px_44px]`で行為主体（`actor_side`は`ball_side_after`から逆算しない。`shared`=「共同」、`unknown`=「行為主体未確認」、`sx`/`partner`は`actorLabel`か既定の「当方」「先方」）が独立68px列に分かれる。mobileでは行為主体は本文列の先頭に小さいラベルとして畳み込まれる（例:「当方：要約テキスト」）。要約/結果（`actor_side`に関わらず常にフル表示、外部閲覧者も同じ内容が見える）、以後のボール（`→ ${ballSideLabel}`）を横に並べ、日付・行為主体・要約・結果・ボールはすべて`truncate`+`title`属性を持ち、切り詰められても全文をtitleで確認できる。編集ボタンは44px角アイコン（`h-11 w-11`）を行末に独立配置し、本文の行高に影響しない。aria-labelへ関係先名と対象名/要約を含める（`${partnerName} - ${summary}を編集`）。履歴DOMは1系統（同一`id="sx-partner-history-${partnerId}"`を持つ要素は幅ごとに複製しない）。履歴セクションのヘッダーは`canManage && onAddInteraction`（`canAddInteraction`）で真の時だけ`grid-cols-[minmax(0,1fr)_44px]`（左＝最終接点・記録数・合意/成果物/引継ぎ件数を横一行`overflow-x-auto`＋非フェードの`ScrollHintArrow`（sm+含め常時表示）で表示、`mobile折返し禁止`なのでどの幅でもスクロールのまま。右＝44px角アイコンの「履歴を追加」ボタン）、read-only（管理不可、または`onAddInteraction`未指定）では`grid-cols-1`のみで右の44px列・`gap`とも確保しない（2026-07-24 5回目是正 = COO差し戻し2点目、`InteractionRow`が既に持つ「read-onlyに空編集列を見せない」grid切替と揃えた）。`InteractionRow`はtruncate表示のため、mobile touchでも全文へ到達できるよう「台帳の詳細・編集」内（既定閉のまま）に新設`InteractionFullRow`による「やり取り履歴（全文・全件）」一覧を追加した（2026-07-24 最終監査残件是正）。occurred date/kind・行為主体・summary/outcome全文・以後のボールを非truncateで表示し権限に関わらず誰でも読める、編集ボタンのみ`canManage`。`InteractionTimeline`本体の表側previewは総件数に関係なく必ず`sorted.slice(0, 3)`（`preview`）だけを`InteractionRow`へ渡し、3件+header<=260の静的高さ予算を件数非依存で維持する（2026-07-24 5回目是正 = COO差し戻し1点目、旧実装は`sorted`全件を描画しており件数超過時に予算を超えていた）。ヘッダーの集計（記録/合意/成果物/引継ぎ件数）は常に`partner.interactions`全件基準のまま変えず、preview件数と乖離してよい。`sorted.length > 3`の時だけpreview直下に「表示3 / 全N件・全文は「台帳の詳細・編集」へ」（read-only時は「台帳の詳細」へ、summaryの権限別文言と一致させる。2026-07-24 追加是正: 旧実装は`canManage`に関わらずこの注記だけ「台帳の詳細・編集」固定だった）の短い注記を出し、closed（既定閉）の「台帳の詳細・編集」内`InteractionFullRow`一覧（全文・全件）は変更しない。「台帳の詳細・編集」`<summary>`の文言は`canManage`で分岐し（COO差し戻し3点目）、`canManage`時は従来どおり「台帳の詳細・編集」、read-only時は「台帳の詳細」（編集導線が無いのに「編集」を含む文言を見せない）。`InteractionRow`の`h-16`固定はそのまま維持する。

優先度低・保留（`deferredLowPriority`）の機関は末尾の`<details>`「保留・低優先（重要経路外）」内へ、他と同じ`PartnerRow`コンポーネントで1行表示し、管制帯の品質集計（全関係先/未分類等）には含めつつholdings系の分母からは除外する。行全体の`opacity`は使わず、`border-l-4`＋淡い背景＋「・保留」文言・状態バッジだけで保留を示す。`relationship_state='ended'`の機関（`sxIsPartnerEnded()`）は保留とは別単位で、同じ行UIのまま末尾の別`<details>`「終了（対応中から除外）」へ入れる（2026-07-24追記、詳細は上のUIUX是正パラグラフ参照）。どちらのtrailing sectionもCategoryNavの絞り込み対象。地理名を付けた旧称は表示レイヤーで一切出さない（`sxPartnerDisplay`は`partner.name`をそのまま使い、slugベースの上書き辞書は廃止。DB側の名称は migration 190 で既に「ファインケム」へ補正済み）。管理者は行内から「編集」「分類を追加」「保有事項を追加」「履歴を追加」に到達でき、`ProjectWorkspaceDashboard`側で`onEditPartner`/`onAddRole`/`onEditRole`/`onAddWorkItem`/`onEditWorkItem`/`onAddInteraction`/`onEditInteraction`へ配線する。すべての操作可能要素は対象名を含むaria-labelと`focus-visible`リングを持ち、本文は11px以上・補助文言は10px以上に統一する（`text-[9px]`は使わない）。技術試験・資金スナップショット・組織役割・RACI・人員容量は各測定値を画面に描画し、編集可能にする。週次エフォートは柱/マイルストーン/次の成果に接続する。

二車線集計/分類/グルーピングの純粋関数（`sxHoldingsForPartner`/`sxAllHoldingsForPartnerAudit`/`sxComputeControlBandCounts`/`sxPrimaryRoleKindCounts`/`sxRoleDisplayLabel`/`sxIsPartnerEnded`/`sxSortHoldingsByPriority`/`sxGroupPartnersByPrimaryClassification`/`sxPartnerDisplaySortKey`/`sxIsHoldingOverdue`/`sxIsHoldingDueSoon`/`sxIsHoldingMonthPrecision`/`sxIsHoldingDueUnset`等）は `pwa/src/lib/sx-partner-holdings.ts` に分離した。`sx-management.ts`は`import "server-only"`のためクライアントコンポーネントから値importできず（型importのみ許容）、`sx-visual-shared.tsx`はこのファイルから re-export して両者の境界を守る。`npm run test:sx-partner-holdings`（`scripts/test_sx_partner_holdings.mjs`）が保有事項フィルタ・side別集計・day精度限定のoverdue/dueSoon・month精度別バケット・期限未設定境界・担当未確認判定・partner品質集計のdeferred含有・holdings系のdeferred除外・bothSidesHeldPartners・分類別カウント（2026-07-24 4回目是正でdeferred/ended含む全partner集計に変更）・複合ラベル生成（unclassifiedの状態複合含む）・表示ソートキー・groupByのroleKind×relationshipState分離とunclassified末尾ソート・`sxIsPartnerEnded`のon_hold非混同・`sxSortHoldingsByPriority`のblocked優先tier・`sxPartnerHasBlockedHolding`/`sxPartnerPrioritySortKey`のblocked partner最優先ソート・`sxAllHoldingsForPartnerAudit`の全ステータス包含・`endedPartners`/`unorganizedPartners`/`organizedCoveragePct`/`blockedHoldings`の集計を検査する。

**2026-07-24 UIUX/COO再監査是正（同日中2回目）**: 履歴行（`InteractionRow`）を旧3レーングリッド（`col-span-3`のrounded色面ブロック）から、shared/unknown/通常すべて共通の1イベント1本・全幅罫線行（`min-h-[64px]`、上下2段や角丸色面なし）へ作り直した。同一行に日付＋種別、行為主体（`共同`/`行為主体未確認`/`当方`/`先方`＋actorLabel）、要約/結果、以後のボール（`→ ${ballSideLabel}`）を横並びで持ち、編集ボタン（44px）は行末に独立配置して本文の行高を増やさない。保有事項の優先表示は`sxSortHoldingsByPriority(items, today)`（`pwa/src/lib/sx-partner-holdings.ts`）に統一し、旧・期限昇順だけの並びを「`status='blocked'`最優先→day精度期限超過→day精度（期限近含む残り）→month精度→期限未設定」の5段tierに置き換えた（blocked項目は自身の期限に関わらず常に上位2件に入る）。shared/unknown保有も`side='sx'`/`'partner'`と同じ`HoldingsCell`（優先2件＋「ほかN件」）へ統一し、無制限列挙をやめた。行を展開すると「台帳の詳細・編集」`<details>`が既定で開き（`open`属性）、新設の「保有事項の詳細（完了・停止を含む全件）」リスト（`sxAllHoldingsForPartnerAudit()`＝全ステータスを対象、`HoldingRow`を再利用）が権限に関係なく全員へ表示される。`SxHoldingItem`に`detail`/`completedOn`/`completionEvidence`/`acceptedBy`/`acceptedOn`を追加し、値がある場合は誰でも読める。編集ボタン（`Pencil`アイコン）だけが`canManage`条件。分類ラベル（`sxRoleDisplayLabel`）は`unclassified`でも常に状態と複合する（例: 「未分類・候補」「未分類・成立」）よう仕様転換し、`in_progress`/`established`のように複合ラベルが同じ文字列（「XX先」）になる2状態は、分類グループ見出し（`<h4>`＋（状態）併記）と各行の役割行（`・${state}`併記）の両方で必ず視覚的に区別する。`relationship_state='ended'`は`deferredLowPriority`（`on_hold`）と別単位として扱い、`sxIsPartnerEnded()`で判定、`activePartners`/holdings系分母から除外しつつ`totalPartners`には含め、末尾に専用`<details>`「終了（対応中から除外）」を追加した。保留・終了どちらのtrailing sectionもCategoryNavの`activeRoleKind`絞り込みを継承する（フィルタ中は選択roleに合う機関だけを表示）。管制帯（`ControlBand`）は「母数／ボール／緊急」の3行へ再構成し、mobileは行ごとに`overflow-x-auto`の単一行横スクロール（折り返さない）にした。品質集計に`endedPartners`（終了）、`unorganizedPartners`（当方/先方いずれかのレーンが0件＝「確認済み0件」と断定できない未整理機関数）、`organizedCoveragePct`（両レーンとも保有事項が確認できているactive機関の割合）を追加し、holdings系緊急集計に`blockedHoldings`（停止件数、side問わず）を追加した。「未完了保有事項」は「未完了事項」、「双方に保有ありの関係先」は「双方保有先」へ短縮。当方/先方レーンの空表示は「まだないよ」（＝確認済みゼロと誤読される文言）をやめ、「未整理（当方側/先方側の確認未実施）」に変更した——レーンが空でも「未確認」であって「ゼロと確認済み」ではないため。CategoryNavは`aria-pressed`、選択チップの`✓`グリフ（色だけに依存しない選択表現）、`focus-visible`リング、mobileでの`overflow-x-auto`単一行横スクロールを追加した。各機関行は`<article aria-labelledby="sx-partner-name-${partnerId}">`（機関名`<p>`のidと対応）へ変更し、分類グループ見出しは`<p>`から`<h4>`へ昇格した。

**2026-07-24 UIUX/COO再監査是正（同日中4回目）**: 上記のグリッド化・管制帯並び替え・台帳0件先/登録率改称・CategoryNav全partner集計は本文（このセクション内の各段落）へ直接反映済み。この段落は本文に統合しにくい残りの変更点を記録する。**provenance再スタンプの復活**: management APIのPATCH (`src/app/api/project-workspace/[projectId]/management/route.ts`) は、直近ラウンドで「編集しても`source_kind`/`source_ref`は変えない」に倒していたのを反転し、`meta.hasSourceRef`な種別の通常編集（soft-delete/restoreを除く）は必ず`source_kind='manual'`/`source_ref='PWA共有管理画面'`へ再スタンプするようにした——field auditの来歴が「人が画面から編集した」ことを示さなくなる問題が再監査で指摘されたため。soft-delete/restoreは引き続き`source_kind`/`source_ref`を変えない（可視性の切替であって編集ではないため）。migration 192のseed行は固定idで存在判定するため、`source_ref`が編集で書き換わってもrevival（意図しない復活）は起きない。**migration 192 backfill検証のcount非依存化**: interaction actor_sideのbackfill検証を、固定`count(*) < 4`判定から、`source_ref`＋既知summaryに一致する live 行のうち`actor_side='unknown'`のまま残っているものが1件でもあれば失敗、という判定へ変更した。ユーザーが該当行を編集（summaryや`actor_side`を変更）または削除した場合はcheckの対象から自然に外れ、再適用が誤って失敗しない。**blocked partner最優先ソート**: `sxPartnerHasBlockedHolding(partner)`/`sxPartnerPrioritySortKey(partner)`（`pwa/src/lib/sx-partner-holdings.ts`）を追加し、`sxGroupPartnersByPrimaryClassification()`の分類内ソート・分類間（group先頭partnerに基づく）ソートの両方を、blocked保有事項を持つ機関が常に最優先（tier `"0-"`）、その後は従来の表示期限順（tier `"1-"`）になるキーへ切り替えた。画面では該当機関の名前の右に赤い「停止」バッジが出るので、並び替えだけに頼らず気付ける。**その他の細部**: 分類グループ見出し`<h4>`を`text-[10px]`→`text-[11px]`＋左罫線（`border-l-4`）へ、低コントラストな`#777166`（10px使用箇所）を`#69665d`へ統一、管理者向け「保有事項を追加」ボタンを`min-h-11`のテキストボタンから`h-6 w-6`のアイコンのみボタンへ圧縮し初期行高を押し上げないようにした。build v3.49.1。

運用準備、4本柱の詳細比較表、目的→成果→KPI、意思決定の記録、判断→実行→確認、測定・資金・体制・約束、非表示にした共有情報の復元は、低頻度の編集面として単一の`id="management-ledger"` `<details>`「管理台帳・編集」へ集約する。個別の折りたたみボックスを並べず、各サブ機能（新規追加ボタン、編集、復元）は集約後も同一のまま動作する。

新規追加はPOSTで、選択中ゲートから論点 → 複数仮説 → 根拠/反証 → 検証 → 判断 → action → 次回確認を親情報つきで作る。portfolio/adminだけが作成でき、project scopeは閲覧だけ。履歴記録に失敗したPOSTは追加行を補償的にsoft-deleteし、再実行可能な状態に戻す。migration 184は未決分類、約束種類、相手の約束必須条件、親情報の同一PJ検査を補正し、再適用可能である。migration 191は協力機関の現在ボール/次の受け渡し先/目標状態/期限精度の additive 追加、date precision整合CHECK（partners/interactions）、やり取り履歴表 `project_management_partner_interactions` の新設、p21のダイキアクシス/SMBC current truth seed（`source_ref='user:2026-07-23#partner-progress'`）を含み、再適用可能である。partner seedは`ON CONFLICT (project_id,slug) DO UPDATE`でcurrent truth列を再適用のたびに反映する（`deleted_at`/`deleted_by`は対象外、soft-delete済み行を勝手に復元しない）。interaction seedは固定`TIMESTAMPTZ '2026-07-23 00:00:00+09'`起点のオフセットでrecord timestampを保存し（`now()`は使わない）、末尾の件数検査は当該`source_ref`＋想定summaryの件数が下限（daiki-axis 3件/smbc 2件）以上であることを見る（exact countではないため、後からユーザー履歴が増えても再適用できる）。migration 192 (`192_sx_partner_role_and_work_items.sql`) は `project_management_partner_roles`（役割×関係状態の正規化、unique partial indexで1partner1primary role、`source_kind`/`source_ref`必須）、`project_management_partner_work_items`（当方/先方の保有事項台帳、完了監査用の`completed_on`/`completion_evidence`/`accepted_by`/`accepted_on`とCHECK 2本を含む）を新設し、`project_management_partner_interactions`へ`actor_side`/`actor_label`をadditive追加、p21の6機関へprimary role seed（`source_ref='user:2026-07-24#partner-role-normalization'`）とダイキアクシス/SMBCの保有事項seed 4件（`source_ref='user:2026-07-24#partner-work-items'`）、既存interaction 4件のactor_side backfill（8月納品予定確認は`unknown`のまま明示的に据え置き）を含み、再適用可能である。role/work itemのseed existence checkとverificationはいずれも`source_ref`基準（`deleted_at`を問わない）なので、ユーザーが後からsoft-deleteしても再適用で復活せず、verificationも誤って失敗しない。管理API (`/api/project-workspace/[projectId]/management`) には resource `partner_role`/`partner_work_item` を追加し、`PARENT_FIELDS.partner_role=[["partner_id","project_management_partners"]]`/`PARENT_FIELDS.partner_work_item=[["partner_id","project_management_partners"],["related_milestone_id","project_management_milestones"]]`による親PJ検証（`related_milestone_id`が他PJのゲートを指すケースは`scripts/test_project_management_rls.mjs`に直接probeあり）、`interaction`のcreate/edit時`actor_side`/`actor_label`検証、`partner_work_item`のcreate/edit時`assertWorkItemCompletionRequirements()`（完了/成果物受入必須条件）検証を含む。

### 権限・表示境界・レスポンシブ

新規共有情報はAPIとRLSの両方でPJ所属を検証する。soft-delete対象のmember_selectは`deleted_at IS NULL`を含み、重要表はauthenticatedの物理DELETEを拒否する。共有DTOはraw本文、契約原文、報酬、メール本文、内部交渉メモ、source URLを返さない。portfolio/adminは共有情報を更新でき、project scopeは自PJの許可範囲だけ更新する。

1440pxは同一比較軸の表と事業化ロードマップ、768pxはカード、390pxは期限順カード/縦ロードマップへ再構成し、ページ全体の水平スクロールを作らない。workspace直リンクでは月初合意モーダルを出さず、desktopはGlobalNavサイドバーの代わりにワークスペース内部専用の152px幅stickyセクションナビ（`lg:grid-cols-[152px_minmax(0,1fr)]`）、mobile/tabletは同じナビが横スクロールの上部帯になる形で、経営サマリー/全体計画/論点・仮説/関係先/実行・体制を移動する。loading / empty / error / disabled / selected / focusを持ち、タップ領域は44px以上、状態は色以外の文言でも伝える。表示文は日本語中心で、内部status・confidence・source・entity/field名は利用者向けラベルへ変換する。

### 初期画面 = 経営状況図（2026-07-25、v3.49.9。同日中にv3.49.10で置換済みの履歴）

2026-07-25、まさの利用者受入評価「まだまだぱっと見ただけで全体の状況が分かる状態にはなっていない」を受け、`v3.49.8` のPJ管制盤（経営判定・4本柱・重要経路・対応待ち・直近アクションを同一外枠内の別区画として並べる構成）の利用者受入を撤回し、初期画面最上段（`SxExecutiveControlDeck`）を一続きの経営状況図へ再設計した。完成条件は要素の存在ではなく、1440×900のスクロール前スクリーンショットを5秒見て `全体判定 / 重要経路の順序と現在地 / 停止・遅延地点と下流影響 / ボール保持者と止まる対象 / 次の介入・担当・期限` の5問へ答えられること。

- **帯1 経営判定** (`sx-verdict-band`): 判定語（オンスケ/要注意/危険/判定不能、`sxVerdictDisplayLabel`）を帯内最大サイズ（22px bold）の色面で左端へ置き、判定理由1行、重大未確認/停止/充足/次期限（390pxでは設立判断日も）、設立判断日、更新日を続ける。判定語より強い見出しを帯内に置かない。
- **帯2 4本柱信号** (`sx-four-pillar-signal-strip`): 柱ごとに左3pxのアクセント罫（`SX_TRACKS.accent`）+ 柱名 + 状態ラベル + 予定差（`sxFormatDelta`）+ 現在ゲート→ + 次期限 + 証拠充足（`sxTrackEvidenceCompleteness`、小型バー+%、中立色。大型の緑進捗バーで「進んでいる」誤読を作らない）+ 詰まり1行。アクセント色は経営状況図ノードの点の縁色・柱略称テキストと対応し、柱と経路の接続を色+文字の両方で示す。クリックで `onSelectTrack`。
- **帯3 経営状況図** (`sx-state-map`): `deriveSxStateMap`（`src/lib/sx-executive-control-deck.ts` の純粋関数）が導出する。重要経路の可視ノード（`deriveSxCriticalPathRail` の窓 = 直前完了1+現在+次3+最終、`+N完了`/`…N`は該当区間の接続線上）を一方向レールへ置き、ノード間隔は予測日（`forecastEnd || plannedEnd`）の日数差に比例（`gapDaysFromPrev` をgrid frへ変換、min幅floor）。`今日`マーカー（`asOf`）は現在地ノードの直前。各ノードカード = 状態記号+ラベル（(仮)/現在地チップ含む）+ 柱略称 + 予定→予測（折り返し可、truncateしない）+ 遅延幅バー（`SlipBar`、共通スケール2px/日・上限56日、差0以下は文字のみでバーを描かない）+ 担当。仮日程は破線ボーダー/破線接続線。介入行のうち実在の停止・待ち（`FLAG_KINDS` = critical_blocked / critical_overdue / technical_test_blocked / validation_run / action_item / partner_work_item / partner_fallback / issue_stalled）は該当ノード直下の旗（`sx-blocker-flag`）として `row.milestoneId` の一致だけで接続し、ボール（`ballDisplay` = 側+実名。「未確認・未確認」「担当 担当未確認」の重複を畳む）と精度付き期限を表示する。担当未確認/情報更新切れ/ゲート評価未完はノード上のstate markとして描き（owner_unconfirmedのランクバッジはノードの担当行へ統合）、第三者の旗にしない。可視ノードへ解決しない行は `経路ノード未接続の対応待ち`（`sx-unattached-blockers`）へ明示し、推測でどこかのノードへ付けない。
- **帯4 次の経営介入**: 全件数を示しつつ上位3件へ絞り、①②③（`RankBadge`）を帯3の旗・state markと共有する。行 = ランク + 対象 + 種別ラベル + ボール/担当 + 期限（精度付き、予測期限/親ゲート期限の文脈ラベル）+ 止まるゲート。直近アクション（`deriveSxUpcomingQueue`）は1行の薄い帯（`sx-upcoming-queue`、上位3件+全件数のインラインリンク）へ降格し、対応待ちと同格の2枠並置をやめた。
- **レスポンシブ**: lg+は帯3→帯4、lg未満は帯4→帯3（order swap）。lg未満の状況図は縦レール（`sx-critical-path-rail-vertical`、時間は上→下、旗はノード下へインデント、カードはmax-w 430px）。390pxでも判定語・柱・介入・状況図の優先順を保ち、ページ横あふれ0。
- **維持**: ノードclick→`onSelectMilestone`、旗/介入/直近行click→`focusAnchorRow`（`data-sx-anchor`解決、prefers-reduced-motion対応）、44px操作領域、色以外の状態手掛かり、未評価/仮日程/期限未設定をオンスケへ丸めない導出、月精度期限の「YYYY年M月」表示は `v3.49.8` から変更しない。旧 `sx-critical-path-band` / `sx-queue-columns` の2枠レイアウトは廃止。

### 初期画面 = 統合タイムライン（2026-07-25、v3.49.10 現行契約）

`v3.49.9`の経営状況図（時間比例スパイン+旗）はまさの利用者受入で再差し戻し（「ほとんど改善されていない印象」）となり、PM実務者役とUX/UIデザイナー役の2サブエージェント監査（正本: ehm-os `SX_DASHBOARD_CRITIQUE_20260725.md`）を経て全面再構成した。中心診断は「時間軸が3枚（経路レール/事業化ロードマップ/折りたたみ全件ガント）に分裂し、どの1枚も時間・現在地・遅延・ボール・次の一手を揃えていない」こと。

- **帯1 判定バー**（`sx-verdict-bar` / `deriveSxVerdictSummary`）: 業務判定（重要経路。停止>期限超過>遅延見込み+N日の優先。未評価だけの経路をオンスケへ変換しない）/ 運用判定（判定不能ラベル・充足%・重大未確認件数。データ欠損をビジネス判定の顔で出さない）/ STEP2消化（SXは設立前でSTEP2資金を年度内消化する立て付けのため、ランウェイやバーン機構は作らない=まさ確定 2026-07-25。資金スナップショットに金額が無い間は「未確認」に閉じる）/ 設立判断まで残N日。
- **帯2 統合タイムライン**（`SxUnifiedTimeline` / `deriveSxUnifiedTimeline`）: 唯一の時間軸ビュー。月グリッド・今日線・設立判断旗の共通座標系（0〜100%）に、柱4レーン（事業開発→技術開発→体制構築→資金調達。レーンヘッダーが旧4本柱信号の予測差・詰まり一語を吸収）×日付付き全マイルストーン行（1行=1MS、ラベル全文はsticky左列、バー=計画開始→予定日、縦線=予定日、◇=予測日（中抜き=仮）、橙バー=遅延幅、+N日直書き）。重要経路の行は太字+黒左罫で、各行の予測◇を破線SVG polylineで接続する（行高は固定44px=`.sx-management-workspace button`のグローバル操作領域規則とy座標計算を一致させる）。①〜⑤のボールピンは各介入の**自身の期日位置**（橙=相手側/双方ボール、黒=当方。月精度はリング表示。近接ピンは`MIN_PIN_GAP_PCT`で表示位置のみ補正し日付は変えない）。日付未登録・完了済みはレーンに描かず件数として明示（詳細表へ誘導）。laneOrderに無いtrackの行は「柱未確認」末尾レーンで落とさない。<lg はコンテナ内横スクロール（min-w 880px）でラベル列sticky（固定レーン見出し付き内部横スクロールの既存モバイル契約を踏襲）。
- **帯3 今週の意思決定 + 次の経営介入**: 意思決定待ち（`sx-decision-queue`。論点台帳の意思決定待ちと同一判定=未決のdecisionを持つ論点 or 意思決定待ち分類、closed除外。件数の意味を台帳と揃える）を全件昇格し、介入キューはtop5（`deriveSxInterventionQueue`へ`pillarGates`を追加し、重要経路外の柱現在ゲートの停止/期限超過/担当未確認/鮮度切れ/評価未完も同じキューへ。`applySxInterventionPillarQuota`で最大遅延柱をtop5へ必ず1件、候補ゼロならば行を発明せず`sx-quota-note`）。①〜⑤はタイムラインのピンと同番号。旧・対応待ち/直近アクションの2枠と直近アクション1行帯は廃止。
- **廃止・移動**: `SxNineMonthTimeline`（事業化ロードマップ。9チップ全ラベル截断・状況図と同一ノード重複のため）削除。全件ガントの折りたたみは「全マイルストーン詳細表」として計画詳細節（id=`management-plan`維持、`SelectedMilestoneContext`同居）へ。三つの証明はカード3枚→3行ストリップ+共通不足バナー（`sx-proof-shared-missing`、3枚同文の不足を1回だけ）、7×3マトリクスは既定閉details付録（週次で変化しない設計情報のため）。7テーマ表はヘッダーの経路ストリップ（重要経路の3重描画の一枚）を削除し、「未登録」系の運用ギャップを灰トーン（赤は事業リスク専用）へ。ナビは 経営サマリー/計画詳細/技術証明(`management-proof`新設)/論点・仮説/関係先/実行・体制。週次エフォート入力フォームとメンバー内訳は「今週実績Xh・入力N/M名」サマリー付き`<details>`（`sx-effort-entry-details`）へ降格（PJ限定メンバーの自己入力導線は維持）。ヘッダー鮮度は基準日+データ最終確認の2値、内部コード`p21`の露出削除、共有面の「〜だよ/してね」口調を常体化。
- **不変**: 実名・体言止め表示境界、未評価/仮日程/期限未設定をオンスケ・0%へ丸めない導出、月精度期限の「YYYY年M月」、focusAnchorRow/prefers-reduced-motion/44px操作領域、左152px節ナビ、論点表形式、関係先7列register。

#### 2026-07-25 追補（v3.49.12）: 遅延語の3状態 / ゲート詳細モーダル / 図からの手動編集

- **遅延語の3状態**: 「予定より後ろ」を `sxEcdClassifySlip(milestone, today)` で分ける。`overdue`=予定日を過ぎて未完了（実測の遅れ）、`confirmed_slip`=予測>予定かつ `date_certainty='confirmed'` または `forecast_change_reason` に実質的な見直し理由がある、`provisional_slip`=予測>予定だが仮日程で理由も定型（`未確認`/`仮置き`/`初期Seed` を含む＝`isPlaceholderForecastReason`）、`none`=差なし・完了。**仮置きどうしの差を「遅延」と表示しない**。判定バーは confirmed_slip があるときだけ「遅延見込み +N日」（warn）、provisional_slip だけなら「予測差 +N日」+「期限超過なし・仮日程の見込み差」（unknownトーン）。タイムラインは 赤=期限超過 / 橙=根拠のある遅延見込み / 灰=仮置きの予測差 で塗り分け、行ラベルは `sxFormatSlip`（`期限超過` / `遅延見込み +N日` / `予測差 +N日（仮）`）。凡例に「灰バー=仮日程どうしの予測差（実測の遅れではない）」を明記する。由来: まさの指摘「予測差+7日なのに今日より先で終わる予定なのに遅延と読める」。p21実データは全9件が7/14投入の初期Seedで `forecast_change_reason='初期Seed。予測日は仮置きで、変更理由は未確認'`。
- **ゲート詳細モーダル**: タイムライン行クリックは `MilestoneDetailModal`（`data-testid="sx-milestone-detail-modal"`）を開く。ページ下部の `#selected-management-context` へスクロールする旧挙動は廃止（図から視線が飛ぶため。選択中ゲートへの自動スクロール effect も無効化）。Esc・背景クリック・閉じるボタンで閉じ、開いた直後に閉じるボタンへfocusを移す。ヘッダーは 予定 / 予測 / 仮日程か確定日程 / 担当、その下に `予測日の根拠:`（`forecast_change_reason`）を表示し、本文は既存 `SelectedMilestoneContext`（論点→仮説→根拠→検証→判断 / 関係先・約束 / 前提・依存 / 次の成果）をそのまま使う。編集・追加操作はモーダルを閉じてから既存の `EditPanel` / `AddPanel` を開く。
- **図からの手動追加・編集**: 管理者（`canManage`）のみ、レーンヘッダーの `＋`（hover/focusで出現、`onCreateMilestone(trackKey)`）でその柱にマイルストーンを追加、行右端の `✎`（同）で `EditPanel` を開く。モーダルヘッダーの「日程・担当を編集」も同じ経路。計画詳細節の全マイルストーン詳細表には `data-testid="sx-plan-manual-edit"`（マイルストーンを追加 / 依存関係を追加 / 選択中ゲートを編集）を置く。書き込みは既存の management API（resource `milestone` / `dependency`、portfolio/admin限定、履歴とfield auditつき）で、新規の書き込み経路・テーブルは作らない。閲覧のみのPJ限定メンバーには `＋` も `✎` も出さない。

#### 2026-07-25 追補2（v3.49.25）: 方向が読める遅延語 / 関係の流れ / 当方ボール強調

- **遅延語の方向明示**: 「予測差 +N日」は進みか遅れか読めないため全廃し、`sxFormatSlip` は「予定よりN日後ろ（仮置き）」「予定よりN日遅れ見込み」「期限超過」「予定よりN日前倒し」「予定どおり」を返す。判定バーの仮置きだけのケースは「実際の遅れなし」を主表示にし、detailで「仮置きの見込みは予定より最大N日後ろ」。トーンは中立（緑にしない=仮日程を健全へ変換しない）。
- **重要経路破線の自己説明**: 破線の最初の区間中点へ「重要経路の順序」ラベルを重ね、凡例を「破線=重要経路の順序（前のゲートが終わってから次へ進む依存のつながり）」とする。
- **関係の流れ（`PartnerJourneyFlow`、`data-testid="sx-partner-journey"`）**: 各関係先行の7列registerの直下に全幅で これまで→現在地→ゴール の一本線を置く。これまで=やり取り履歴を古い順（`occurredOn ?? createdAt` 昇順、同日はcreatedAt順）に種別+精度付き日付+要約で並べる。現在地=いまのボール（側+実名+期限）。当方（sx）ボールは赤の二重枠、相手側は琥珀、未確認は灰。これから=次の一手（`nextCommitment`、体言止め変換）。ゴール=目標状態（`targetState`、未登録は「目標状態 未登録」）。ステップの発明はしない。バンドは内部横スクロール可、各ステップ幅150px・title属性で全文到達。文字サイズは本文11px/補助10px（この面の9px禁止規約に従う）。
- **当方ボール強調**: `currentBallSide='sx'` の関係先行は 行頭バッジ「当方ボール」（白抜き赤）+ `border-l-4` 赤左罫 + 淡赤背景（保留・終了の既存装飾が優先）。介入キューのボール/担当列は「当方ボール・実名」を太字赤で表示。並び順は `sxPartnerPrioritySortKey` を blocked(0) > 当方ボール(1) > その他(2) の3tierへ拡張し、当方ボールは期限が遠くても前へ出す。
- **三つの証明の位置づけ**（`sx-proof-positioning`）: 「論点・仮説台帳=何を判断するかの経営検証ループ（全柱） / 三つの証明・7テーマ=技術開発柱の完了条件を何を証明できたかで管理する面。実験・検証の結果は7テーマの証拠・技術試験として接続」の1行を本文へ常設する。

#### 2026-07-27 追補3（v3.49.31）: 遅延語の二択化 / ピンのhover / 名字表示 / PoC候補先リスト

- **遅延語は「遅れ」か「前倒し」しか使わない**。「予定よりN日後ろ」は進んでいるのか遅れているのか読めないため禁止。仮日程どうしの差は「予定よりN日遅れ（仮置き）」と書き、根拠の弱さは括弧で示す。全体判定の主表示「実際の遅れなし（仮日程）」と中立トーンは維持する。
- **図中のピンはクリックで画面を動かさない**。①〜⑤はhover/focusでカード（対象・ボール側と実名・期限・止まるゲート）を出す。ページ下部へスクロールさせる導線は廃止する。
- **人名は名字だけを出す**。表示専用の正規化表はフルネームを持たない（まさ→山地、かる→輕部、ちこ→遠藤）。敬称付きで登録されている名前（石原先生）はそのまま。
- **PoC候補先リスト**（`data-testid="sx-poc-list"`、節ID `management-poc`。2026-07-30追補6でカードグリッドから罫線区切りの表/リストへ変更、testidも`sx-poc-board`→`sx-poc-list`）: 排液提供先の確保状況を、調達済 → 合意済・排液取得前 → 相談中 → 未接触の候補 の順で並べる。件数は登録データだけを数え、母集団や必要社数を画面へ書かない（台帳に無い数値のため）。役割ラベルの接頭辞（`PoC候補先` / `PoC接触先`）で判定し、関係段階では判定しない（EWIR候補機関など別の候補を巻き込むため）。
- **未接触のPoC候補先は関係先台帳へ出さない**。数十社を7列+履歴の台帳へ流し込むと、ボールと次の約束を5秒で読むという台帳の役割が壊れる。台帳には件数とPoC候補先リストへの導線だけを残し、接触が始まった先は自動で台帳へ戻す。

#### 2026-07-27 追補4（v3.49.33）: 計画バーは塗らない / 前提のつながり / 設立は決定済み

- **計画期間のバーを塗りつぶさない**。実線で塗ると、今日線より右へ伸びたバーが「そこまで終わっている」と読まれる。計画期間は枠線で描き、枠内の塗りは登録済みの進捗率からだけ出す。進捗が未登録・0%なら枠だけになる（それが事実）。
- **重要経路の破線は「前提のつながり」と呼ぶ**。「前のゲートが終わらないと次を始められない」とは断定しない。台帳の依存登録から描いていること、日程上は並行して進む区間があることを凡例に書く。登録された依存の型（finish_to_start等）と計画日程が矛盾する場合は、図で断定せずデータ側の確認事項として扱う。
- **「設立判断」という語を画面から外す**。設立自体は決定済みで、2027-03-31は設立の目標日。残日数は「設立まで」、図の旗は「設立」、目的の日付欄は「設立目標日」とする。
- **関係の流れの「これから」は複数ステップを許す**。次の一手だけでなく、未完了の保有事項（デューデリジェンスなど、ゴールまでに必ず通る作業）を期限順で並べる。完了・中止した作業は流れへ出さない。作業を台帳へ足せばそのまま流れへ現れる。
- **関係先台帳の列に履歴の省略表示を置かない**。数十文字に切られた最新記録は判断に使えない。履歴は関係の流れ（全件）と詳細トグル（全文）が担い、列は関連ゲート・寄与する証明を持つ。

#### 2026-07-27 追補5（v3.49.34）: 計画バーは二段塗り（枠線だけの白抜きは差し戻し）

- 追補4の「計画期間は枠線だけ」はまさが差し戻した（「線分はタスクが完了した範囲を示すべき。終わってないからって色を消すのはデザイン悪すぎる」）。
- 計画バーは**二段塗り**にする: 薄い塗り=計画期間（開始→予定。仮日程はさらに淡く）、**濃い塗り=完了した範囲**（登録済みの進捗率から。フル彩度）。進捗0%・未登録なら薄い塗りだけになり、柱の色は消えない。

#### 2026-07-30 追補6（v3.51.22）: メール専用リスト廃止 / 直近接点の統合 / PoC候補先リストの表化

- **メール接点だけを別リストにしない**（まさ指摘: 同じ関係先がメール台帳と関係先台帳の二重表示になるのは情報設計として不自然）。旧 `SxPartnerEmailLedger` は廃止し、ファイルごと削除した。
- **関係先行ごとに`SxLatestContactStrip`（`data-testid="sx-partner-latest-contact-{partnerId}"`）を追加**し、7列registerの内側に直近接点（種別・日付・送受信方向・要点・結果/次の約束・現在のボール）を1本の罫線行で表示する。メール由来かどうかで表示構造を変えない（非メールの直近接点も同じ形式）。本文・宛先・URL・raw `source_ref` はここでもDOMへ出さない。詳細な時系列履歴は既存 `InteractionTimeline` / `InteractionFullRow`・関係の流れ（`PartnerJourneyFlow`）が引き続き担う。7列register・二段ホールディングス・関係の流れ・編集・分類・保留/終了は変更なし。
- **PoC候補先リストはカードグリッドを廃止し、罫線区切りの表/リストにした**（`SxPocCandidateBoard`→`SxPocCandidateList`、`deriveSxPocBoard`→`deriveSxPocList`）。desktop/tabletは列（候補先/現在地/最終接点/次の一手/ボール・担当/編集）を持つ表、mobileは同じ内容を2段に再配置。段の並び順（調達済→合意済→相談中→未接触）と、未接触段階の初期表示件数を絞る挙動・「すべて表示」導線は維持する。
- weekly-control (`/project/[projectId]/weekly-control`) と workspace (`/project/[projectId]/workspace`) の両画面で同じ `SxPartnerPipeline` / `SxPocCandidateList` を使うため、この変更は両方に反映される。
- 維持する不変条件: 完了の主張（濃い塗り）は登録された進捗からしか出さない。計画期間を均一な単色で塗って完了に見せることはしない。凡例に「すべて薄いのは進捗未登録のため」を明記する。

#### 2026-07-30 追補7（v3.51.27）: PoCは進捗groupではなく横断属性

- 追補6の独立`SxPocCandidateList`はv3.51.26で削除済み。さらにv3.51.27では、同じ台帳内に残っていたPoC専用の「調達済 / 合意済・取得前 / 相談中 / 未接触」groupと未接触展開を廃止する。
- 候補・接触済み・調達済みを含む表示名は`PoC先`、各行badgeは`PoC`。PoCかどうかは横断属性であり、関係の現在地や進捗段階の代わりにしない。
- PoC先も全関係先と同じ`role_kind × relationship_state`groupと、停止→当方ボール→表示期限の共通sortを使う。`表示`のPoC filterと`役割`filterは独立し、ANDで同時選択できる。
- 母数帯のPoC固有表示は`PoC先 N件`だけ。未接触PoC先を実行中の緊急・ボール件数から除く契約は維持する。

#### 2026-07-30 追補8（v3.52.1）: PoC比較時は役割groupでなく共通7段階

- 追補7の「PoC filterと役割filterをAND」「同じrole group/sort」は通常台帳の情報構造として維持するが、PoC比較の初期表示には使わない。PoC選択中は全PoCを1本のcompact row一覧とし、役割未登録を進捗の未分類として見せない。
- 行は固定7区間の関係段階と、停止/期限/担当確認の要対応を別列にする。ボールは側と担当者を併記。段階filter後の集計は表示中partner単位で再計算し、全PoC件数と表示件数を分ける。
- 詳細は比較行の下へ展開せずmodal/sheetで開き、全履歴・保有事項・分類・編集をそこへ維持する。PoC filter文脈で自明なPoC badgeと同一railの二重表示は行から外す。
- 最終再監査で、平常の保留を担当/期限不足へ誤分類しない判定順へ修正。14日超または確度未確認は「情報更新要」とし、要対応件数ピルから該当先へ直接絞り込めるようにした。長スクロール時の並び帯/列見出し固定、モバイル行の1段圧縮、通常一覧のボール担当者復帰も同時に行う。

#### 2026-08-01 追補9（v3.53.13）: 可変進行へ復元 / VCタブ追加

- 追補8の固定7段階、段階filter、`x/7`は現行UIから撤回する。関係先ごとに、確認済み接点（古い順）→現在地→未完了work item→次の一手→ゴールを可変長で並べる。
- 会社名下の短いsegmentと進行状況blockは、同じ`buildPartnerProgressSteps()`の戻り値を受け取る。表示位置を同一分母へ丸めず、件数・順序を一致させる。
- `全関係先 / PoC候補先 / VC` は同じpartner台帳を絞る排他的タブ。VCは保存済み`role_kind='shareholder_investor'`だけで判定し、名称推測や別台帳を使わない。
- PoC候補先/VCタブ内の並びは要対応、当方ボール、期限、直近接点を使い、固定段階を不可視のtie-breakにも使わない。1社1行、具体的行動・担当/期限・PJ影響・根拠、直接編集、modal内の全履歴・保有事項は維持する。

#### 2026-08-01 追補10（v3.53.14 / migration 211）: 一覧情報の分離 / ガント詳細の重畳化

- 関係先一覧は`進行状況`を展開表示せず、`現在の状況`と`ゴール`を独立列にする。全stepの`進行状況`は詳細モーダルに置き、会社名下segmentと同じ配列を使う。
- 1社の行全体を詳細入口とし、会社名、現在値、ゴール、根拠、件数のどこを押しても同じ詳細モーダルを開く。編集は詳細内の値から行う。
- VC台帳へ別交渉主体のDAVP、BNV、いよぎんキャピタルを追加する。確認できていない接触段階・合意・ボール・期限・ゴールは作らない。
- 週次ガントの通常バー末尾の縦線を廃止する。行詳細は右ペインでガント幅を削らず、ガントを背後に残す中央重畳モーダルへ統一する。mobileは同じモーダルを下端へ寄せ、Esc・背景・閉じるで終了する。値を押して編集へ移る時は、外側の詳細モーダルを維持したまま本文そのものをフォームへ切り替える。埋め込みフォームは内側のパネル、別背景、枠、影、重複した「工程を編集」見出し、対象工程ブロックを持たず、見出し・スクロール本文・操作フッターは外側の1組だけにする。
