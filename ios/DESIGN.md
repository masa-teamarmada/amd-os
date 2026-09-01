# DESIGN.md — AMD OS 全画面設計の正本

2026-08-31: PWAのKUTEガントは完了登録済みタスクを緑の全幅期間バーと「完了」表示で識別する。日付や進捗率のみで完了判定しない。KUTE限定、共通DB変更なし。iOS/macOS/Androidのネイティブ画面は未移植。詳細は `../pwa/spec/3-8-cockpit-current-spec.md`。

> See also: [CLAUDE.md](CLAUDE.md) — 最重要ルール / [HANDOFF.md](HANDOFF.md) — 現在の配布状況 / [HANDOFF_ios_to_android.md](HANDOFF_ios_to_android.md) — 直近の Android 向け引き継ぎ / [BUGS.md](BUGS.md) — 既知バグ
>
> **目的**: AMD OS（iOS / macOS / Android）に存在する **すべての画面 / 機能** の一覧と仕様。
> Drive 同期トラブルや Git 操作ミスでファイルが消えた場合でも、
> **このドキュメント単体で「何が在るべきか」が完全にわかる** ことをゴールにする。
>
> **更新ルール**:
> - 画面・機能を追加・削除・名称変更したら **同じコミットでこのファイルも更新する**
> - えいみ（Win側 Android担当）が「これ知らない画面なんだけど…」となったら必ずここを参照する
> - えいみがここを見て知らない画面があるならアラート → 即同期する
>
> 最終更新: 2026-09-01 (PWAコックピットの二階層ナビゲーション)

---

## PWAコックピットのタブ配置（2026-09-01）

PWAのPJコックピットは、上段のグループと選択中グループの子タブを持つ二階層ナビゲーションにする。通常PJは「進捗管理 / 事業計画 / PJ管理」の3グループ。`institution_projects`に実際にひもづく研究機関PJは事業計画を持たず、「進捗管理 / シーズリスト / 規程・内規 / PJ管理」の4グループとする。研究機関の判定はPJ番号へ固定せず、現在の機関PJリンクを正本にする。

進捗管理は「MS・月次 / 動向・会議 / 週次差分 / ガント / 目的構造 / 関係先 / 論点・仮説」、通常PJの事業計画は「スコア詳細 / 技術 / 事業計画 / コスト試算 / 知財 / 資本政策」、PJ管理は「PJ概要 / ドライブ / 会社概要」を持つ。活動・実績（助成金、獲得台帳、AMDの貢献）はPJ概要へ、資本政策は事業計画グループへ置く。ZMPのテーマ作業面と正本データはPJワークスペースへ残し、コックピットのテーマタブと`?tab=themes`導線は削除する。画面変更はPWA限定で、iOS / macOS / Androidのネイティブ画面には未移植。PCでは親グループのhover/focusで子一覧を直下へフロートし、タッチ端末では子列を常時表示する。詳細仕様は `../pwa/spec/3-8-cockpit-current-spec.md`。

## 0. 全体アーキテクチャ概要

| レイヤ | 技術 | 場所 |
|---|---|---|
| iOS UI | SwiftUI (iOS 17+) | `AMDOS/Features/*` |
| Android UI | Jetpack Compose | (別リポ / Win 側) |
| macOS UI | SwiftUI (macOS 14+) | `../macos/AMDOSMac/Features/*` |
| データ | Supabase (Postgres + RLS + Edge Functions) | `supabase/` |
| 認証 | Google Sign-In + Supabase Auth | `AMDOS/Features/Auth/` |
| 業務ロジック (重い処理) | GAS WebApp + 各種 Edge Function | `supabase/functions/*` |

macOSはiOSの5タブを横展開せず、`仕事 / 探索 / 管理 / 設定` の常設ナビを使う。
PWAの全route・重要UI・iOS画面の対応状況は `../macos/PARITY.md` を正本とし、実装済みだけを完了扱いにする。

主要 Supabase テーブル: `projects` / `project_members` / `members` / `billing_cycles` / `payout_notices` / `reimbursements` / `knowledge_sessions` / `ms_*` (マイルストーン) / `tsukuyomi_*` / `proposals` / `app_notifications` / `l2_notifications` / `meeting_notifications` / `l2_feedbacks` / `project_cost_models` / `project_cost_assumptions` / `project_cost_items` / `project_cost_questions` ほか。

> **PWA専用画面（Native未移植）**: PJコックピット `?tab=cost-model` とPJワークスペース `#cost-model` の
> 「コスト試算」タブ（2026-08-23追加、**全PJ常設**）。前提（変数）と費用明細をDBに持ち、前提を1つ動かすと
> 4シナリオ（循環/投入 × 既設/新設）をクライアントで再計算する。計算結果は保存せず常に導出する。
> 1画面で「想定している系 / CAPEX・OPEXの内訳（円/単位と円/年）/ 成立ライン（許容上限・損益分岐売価・目標との差）/
> 確度別の内訳と精度を下げている項目」が読めることを要件にしている。未登録PJは空状態を出す。
> 実装: `pwa/src/lib/project-cost-model.ts`（純関数）/ `pwa/src/components/cockpit/CockpitCostModel.tsx`。
> 行ごとに `visibility`（`amd_internal` / `workspace_shared`）を持ち、外部公開する行を選べる。

> **PWA専用画面（Native未移植）**: PJコックピット `?tab=capital-policy` の「資本政策表」タブ
> （2026-08-29追加、**全PJ常設**）。会社概要タブから独立させた資本構成の正本面で、ラウンドを列・株主を行に
> 置き、1ラウンド = 新規割当分 / 発行済株数 / 払込金額 / 顕在株比率 / 新規発行SO / 発行済SO / 潜在込比率 と、
> 列見出し直下のFD比率100%積み上げグラフ、最下段の発行価額・調達額・累計調達額・プレ/ポスト時価総額を出す。
> 表になるのは `project_equity_transactions` の confirmed だけで、計画ラウンドは同じタブのラウンド一覧に並ぶ。
> 実装: `pwa/src/lib/company-overview.ts` の `buildCapitalPolicyTable()`（純関数）/
> `pwa/src/components/cockpit/CapitalPolicyTable.tsx` / `CockpitCapitalPolicy.tsx`。
> 同日、事業計画タブに載せていた資本政策プラン台帳（`CapitalPlanWorkspace`）の掲載はやめた（まさ確定）。
> 資本構成の入口はこのタブ一本。台帳のコンポーネント・API・DBは残してあるので、必要なら戻せる。

> **PWA専用機能（Native未移植）**: p19 PJワークスペース `#theme-progress`（表示名「テーマ」）
> （2026-08-26追加・2026-08-31拡張）。`KR経営改革` / `水素循環PJ` / `OkuDoor運営` /
> `OkuDoorシステム開発＆運用` の4テーマへ既存9 value milestoneを4/2/2/1件で接続し、各成果目標の
> 進捗・根拠種別・更新日・目標月を表示する。テーマ平均は作らず、`routine_auto` は確定実績と区別して
> 「予定進行」と表示する。2026-08-31拡張で閲覧専用から作業ハブへ拡張し、運用タスク・運用マイルストーン・
> 論点/決定・予定成果物・作業間の関連を実際に作成/編集できる。MTGの新規作成・編集のみ、既存の
> 会議記録の公開範囲ポリシー承認待ちで一時停止中（既存MTGの閲覧・紐付けは可）。macOS/iOS Nativeへの
> 移植は未着手。

> 2026-09-01: p19のテーマ面はPJワークスペースへ集約し、コックピットの`?tab=themes`は廃止した。
> テーマ面は別の経緯台帳を持たず、既存のガントと関係先台帳への索引にする。ガント区画は時間順の`ガント`と、最上位目的から
> 成立条件・再帰的な親子タスク・関係先・現在のボールを逆算する`目的構造`を切替表示する。正本は同じ
> `project_management_*`。目的構造ではタスクを手動追加し、ドラッグまたは接続選択で親を付け替えられる。
> 水素循環PJは目的`都内で水素をつくる・ためる・つかう`と3成立条件へ分離し、供給元の確保→シーズリスト作成
> から堂脇先生／pHydrogen／その他探索へ分岐する。堂脇先生はコンタクト→MTG→継続→レスなしで一旦停止、
> pHydrogenはAMD側ボールとして登録した。アプローチタスクは`partner_id`で関係先正本へ接続する。旧水素7行の
> `project_theme_profiles.history_rows`は空にして二重編集を止めた。個別PJ権限を持つ外部メンバーにも
> テーマ、ガント／目的構造、関係先、共有資料を読み取り表示し、AMD内部のホーム／コックピット導線と
> 社内情報は出さない。migration `20260901153000_zmp_hydrogen_management_ledger.sql`と
> `20260901223000_zmp_objective_branch_history.sql`は本番適用済み。
> これらもiOS/macOS/Android未移植。ネイティブ実装、MTG公開ポリシー、モデルの変更はない。

---

## 1. タブ構成（MainTabView）

ログイン後に表示されるトップレベルタブ。`AMDOS/Features/Home/MainTabView.swift`。

| 順 | タブ名 | ファイル | 表示条件 |
|---|---|---|---|
| 1 | 今日 | `MyPage/MyPageView.swift` | 全員 |
| 2 | PJ | `Cockpit/CockpitView.swift` | 全員 |
| 3 | 通知 | `Settings/SettingsView.swift` の `NotificationInboxView` | 全員 |
| 4 | 登録 | `Home/MainTabView.swift` の `RegistrationHubView`（立替 + 名刺） | 全員 |
| 5 | 設定 | `Settings/SettingsView.swift` | 全員 |

Admin はタブではなく、`members.is_admin=true` の時だけ右下フロートボタンから `AdminTabView` を開く。

「登録」は独立タブだった「立替」「名刺」を1つに畳んだハブ画面（`RegistrationHubView`）。カード2枚（立替申請 → `ReimburseListView`、名刺登録 → `BusinessCardsView`）から NavigationLink で遷移する。

`AppTab` は実タブ5種のみ（`mypage` / `cockpit` / `notifications` / `registration` / `settings`）。月次ルーティン（`RoutineFlowView`）からの直接導線は2つ: `reimburseConfirm` タップで `registration` タブへ切替 + `RegistrationRoute.reimburse` を `NavigationStack` の `path` に積んで立替申請一覧まで自動 push、`payoutNotice` タップで `AppNavigationState.requestAdminPresentation` を立てて `MainTabView` が（`isAdmin` の時だけ）`AdminTabView` の fullScreenCover を直接開く。

---

## 2. 各タブ・画面の詳細

### 2.1 今日（MyPageView）

**目的**: 自分のPJ報酬・提案・通知をまとめて確認するホーム画面。タブ名は「今日」。

主要コンポーネント:
- `NotificationInboxView` への導線 — 判断キュー（後述 2.1.1）への近道（マイページ最上部）。同じ画面は「通知」タブからも開ける
- `ProjectRewardCard` — 自分が参加してる各PJの当月報酬カード
- 最近の通知（`app_notifications`）リスト
- 提案箱 への導線 → `ProposalComposeSheet` / `ProposalThreadView`

`ProjectRewardCard` の表示要素:
- ヘッダ: PJ名 / 配賦額（`billing_cycles.member_allocations_json[me]`、未確定なら「未確定」）
- **今月想定**: `billing_cycles.reward_summary_json.members[me].totalPay` を indigo 帯で表示
  （MS進捗から自動計算された想定報酬。plan が `fixed` でないと未計算 → 「未計算」表記）
  獲得pt も併記（`earnedPt`）
- 担当 MS ブロック（`milestone_responsibility.member_id == me` のもののみ、当月差分付き）
- 当月のみ: つくよみ activity card / proposal threads
- 月次モーダルと同じ delta summary text（`milestone_monthly_progress.note` ベース）

データソース: `members` / `project_members` / `milestone_responsibility` /
`billing_cycles.member_allocations_json` / `billing_cycles.reward_summary_json` /
`milestone_monthly_progress` / `app_notifications` / `proposals`

#### 2.1.1 通知（NotificationInboxView） — 判断キュー

**目的**: OS の観測パイプライン（観測→候補→判断→正本）のうち「判断」を担う画面。Swift に届いた L2 通知・議事録通知を PWA を開かずに iOS 内で確認し、判断・修正コメントで返せるようにする。`SettingsView.swift` に実装があるが、独立タブ「通知」として表示される（`MainTabView` からも「今日」タブからも同じビューを開く）。

入口:
- タブバー「通知」
- マイページ最上部 → 「通知ボックス」導線
- ローカル通知タップ → `NotificationInboxView` を sheet 表示し、該当通知を判断カードにフォーカス
- `app_notifications(kind='connector_auth')` → Swiftローカル通知。採用・不採用の判断対象ではなく、未読の間は「再認証」という復旧アクションとして判断キューに出る。通知タップで `meta.reauth_url` を即開く。タップ時に `read_at` を打つが、失敗時に再試行できるよう「既読」セグメントにも connector カードとして残し、再認証を開き直せる。

画面構成:
- 上部にパイプラインの現在地を示すレール（観測→候補→判断→正本、判断を強調）。横幅が足りない場合は矢印付きの横並びをやめ、番号付き2列グリッドにフォールバックする（矢印は出さない）
- セグメント: `判断` / `未読` / `履歴`
  - `判断`: 未回答アイテムを1件ずつカードで判断させるキュー。件数分母・表示対象は「このセッションで“あとで”にしていないアイテム」のみ（あとでにした分は分母・表示から外れる。ただし総未回答件数は「あとで中」画面で別掲）
  - `未読`: 未読の通知一覧（開閉式カード）
  - `履歴`: 既読 or 回答済みの通知一覧。connector auth は既読後もここに残り、再認証を開き直せる
- `l2_notifications` は `attention_state='approved' AND requires_masa_decision=true` の採否判断だけを表示・ローカル通知する。`meeting_notifications` はcockpitの会議記録に残し、通知ボックス・未読数・ローカル通知へ混ぜない

判断カード（1件ずつ表示、`NotificationJudgmentCard`）:
- 「OSの見立て」= 通知タイトル・本文
- 判断カードは必ず `追加先`、`追加・更新する情報`、`押すと起きること` をこの順番で表示する。追加先が未定義の通知は、正本を書き換える採用操作として見せない
- `coverage_gap.proposed_target_l2='shareholder_meeting'` は「開催履歴の追加」。候補の段階では正式履歴に入れず、`会社概要 → 総会・取締役会`へ入る会議種別・開催日・議題・決議・添付ファイル名を表示する。候補には開催日・開催済み証跡が必須で、ジョブカン等の承認ワークフローや日付なし候補は表示しない。`この開催履歴を追加する` はPWAのfeedback APIを経由して `project_shareholder_meetings` を1件追加し、メール送信・資料アップロード・元資料編集はしない
- `textbook_insight` は内部種別名を表示しない。`metadata_json.destination_kind='management_knowledge'` の候補は「経営ノウハウ追加候補」と表示し、追加先を `管理 → 経営ノウハウ`、追加内容を `分類 / 成熟度 / タグ / 再利用する場面 / 次に確認すること` として本文とは別に出す。「経営ノウハウに追加」は本文とその構造化情報を `management_knowledge_entries` に1件保存して候補を `applied` にする。元の会議メモ・プロトコル・BZM本文は変更しない。`destination_kind='bzm_textbook'` は「BZM追記候補」とし、BZM内の追記先と候補の型を出して local applier の承認経路へ送る。保存先を `practice_kind` から推測しない
- 種別ラベル（議事録 / MS進捗 / OS台帳差分 / XRL根拠 / 再認証 など）を必ず表示、内部の英語種別名をそのまま出さない
- 「押すと起きること」欄で、ボタンを押すと何が起きるかを日本語で明示（例:「採用候補として記録するところまで。実際の台帳反映はブラウザ版の安全な反映処理が行うよ」）
- 「根拠」は折りたたみ式。展開すると通知種別ごとの関連データを取得して表示:
  - `meeting_summary`: `project_meeting_summaries`
  - `ms_progress`: `ms_progress_revisions` + `value_milestones`
  - `project_registry_diff`: `project_registry_diffs`
  - `xrl_evidence`: `project_xrl_evidence`
- アクション: 種別ごとのラベル付き2択（例: 議事録=「確認した」/「修正する」、MS進捗=「MS進捗を確定」/「提案を破棄」、OS台帳差分=「採用候補にする」/「見送る」、XRL根拠=「根拠として確定」/「不採用」）。汎用の「はい」/「いいえ」表示はしない
- 2択ボタンは横並びを優先し、長い日本語ラベルや Dynamic Type で収まらない場合は縦並びにフォールバックする（`TwoButtonRow`）
- 「修正・コメント」ボタン → 修正 sheet（下記）。「あとで」ボタン → `@State` によるセッション内保留（単なるリロードでは復活せず、通知画面を閉じて開き直すなどビューが再生成されたときに復活する。永続的な既読/未読とは別軸）
- 判断キューが全件「あとで」になった場合は「もう一度見る」で後回しをリセットする画面を出す

修正 sheet:
- クイック選択チップ（「PJが違う」「人物が違う」「数値が違う」「重要度が違う」）+ 自由記述
- 送信中は閉じる操作を無効化。閉じるボタンあり
- 送信は `コメントを送る` → `l2_feedbacks` に `comment` として保存

判断（アクション送信）:
- すべて共通で `l2_feedbacks` に保存
- 回答した通知は既読化し、OS の delivered notification も削除対象にする
- `tsukuyomi_learnings` にも best-effort で回答履歴を残す
- `ms_progress` の採用は pending revision を confirm、破棄は discard
- `project_registry_diff` の採用/見送りは candidate diff を accepted / rejected に更新するところまで。**実DB（OS台帳）反映はここでは行わない** — 既存ルール通りブラウザ版（PWA）/helper 経由で別途反映される
- `xrl_evidence` の確定/不採用は candidate evidence を confirmed / rejected に更新
- `meeting_summary` の「確認した」は確認記録を残すだけで、要約の再抽出はしない

**未実装（2026-07-16 時点）**:
- アプリ終了中に届く remote push（現状はアプリ起動中のローカル通知 + `pull-app-notifications` によるポーリングのみ）
- 「配信済み（`native_notified_at`）」と「人間が既読した（`read_at`）」の完全な分離運用（現状は両者が近い扱いで、UI上厳密に作り分けていない）
- サーバー駆動のアクションカード（通知ペイロード側でボタン構成・アクション種別を指定する仕組み）
- 通知の recipient / role scope（誰宛の通知かの粒度制御）
- 「自分」/「AMD全体」を切り替えるトグル
- バックエンド側の undo（一度確定・不採用にした判断を取り消す機構）

---

### 2.2 月次ルーティン（廃止済み・履歴）

2026-07-14 にトップレベルタブとマイページの旧月次ルーティンTODO導線を廃止した。現行UIに「月次ルーティン」ボタンを出さない。請求・支払はAdmin、進捗・月次情報はPJ進捗 / 月次モーダルを正にする。以下は旧画面の保全履歴であり、再導入仕様ではない。

**目的**: 各PJ・各月の Step 1〜8 タスクを順に進めるための画面。
Step は AMD OS の月次経理フローそのもの。

#### 2.2.1 ProjectListView
PJ一覧 + 各PJの当月ステップ進捗バー。

#### 2.2.2 RoutineFlowView
1PJ × 1ymの全ステップ（Step1〜8）を縦リストで表示。各ステップタップで対応するシートを開く。

| Step | キー | 担当画面 | 説明 |
|---|---|---|---|
| 1 | budget | `BudgetStepView` | 請求額・バッファ・配賦額をPMが申告 → admin承認 |
| 2 | meeting | `MeetingStepView` | 月次MTGの予定確定（Google Calendar連携） |
| 3 | reportFix | `ReportFixStepView` | 月次レポート確定（つくよみ草案 → PM承認） |
| 4 | invoice | `InvoiceStepView` | 請求書発行（freee連携） |
| 5 | invoiceSent | `InvoiceStepView` | 請求書送付（メール送付 or 手動マーク） |

**月次後の admin 処理（routine からは除外、AdminTabView「今月やること」カードで管理）:**
- 支払通知書送付（メンバー単位） — `PayoutNoticeAdminListView`
- 入金確認 — `BillingMatrixView`
- 報酬支払い完了 — `BillingMatrixView`

これらは「その月内に完結する PM 中心のタスク」ではなく、月次後の admin 専任タスクなので、
月次ルーティンには出さず、Admin タブの「今月やること」カードに集約する（後述 2.5.0）。

#### 2.2.x PM 側 TODO の絞り込み（`fetchMyPageNotifications`）
- マイページ「いまやること」の budget ステップは、`billing_cycles.status='reported'`
  （PM 申告済み・admin 承認待ち）の場合は **除外**する（PM はすでに自分の作業を終えている）
- 申告と同時に `send-budget-approval-nudge` Edge Function が admin 全員に Slack DM を投げる

#### 2.2.2.5 BudgetStepView 取り下げ機能
- 申告済み（reported）/ 承認済み（allocation_confirmed / budget_confirmed）どちらの状態でも
  「取り下げる」ボタンを表示
- 押下 → confirmation dialog → `withdrawBudget(projectId:ym:)` で `status='draft'` に戻し、
  `budget_reported_*` / `budget_confirmed_*` / `budget_yen` / `member_allocations_json` を全て NULL クリア
- これで PM は再入力 → 再申告できる

#### 2.2.3 BudgetStepView の入力ロジック（重要）
- `billing_cycles.status` で表示が分岐:
  - `draft` → 入力フォーム（請求額・バッファ・メンバー配賦額）
  - `reported` → 申告済み（admin承認待ち、修正可能）
  - `allocation_confirmed` / `budget_confirmed` → 承認済み表示のみ
- **PJ予算 = 請求額 × 65% − バッファ**（ライブ計算）
- **月額固定PJ（`projects.fee_type = "monthly_fixed"`）の場合**:
  - 起動時、請求額に `projects.fee_amount` を自動入力（編集可）
  - プレースホルダーには「月額固定: ¥XXX」のヒントを表示
- 入力完了 → `submitBudgetReport` で `billing_cycles.status = "reported"`

#### 2.2.4 InvoiceStepView
freee連携で請求書発行・送付。詳細仕様は本画面のコードコメント参照。CTBは「翌月見積書」もここで生成。

#### 2.2.5 MeetingStepView
Google Calendar に月次MTG枠を作成、参加者に招待を飛ばす。`schedule-meeting` Edge Function を叩く。

#### 2.2.6 ReportFixStepView
つくよみが月次レポート草案を作り、PM が修正・承認 → `reportFixedAt` を打つ。
修正リクエストは `monthly_report_revisions` に保存。

---

### 2.3 立替（ReimburseListView）

**目的**: メンバーが立替経費を申請、PMが承認、admin が支払う。「登録」タブ → 「立替申請」カードから開く（独立タブではない）。

| 画面 | 役割 |
|---|---|
| `ReimburseListView` | 自分が関係する立替申請一覧（提出済 / 承認待ち / 支払済） |
| `ReimburseFormView` | 新規申請フォーム（PJ選択、金額、内容、領収書画像） |

データ: `reimbursements` テーブル。ステータス: `submitted` → `pmApproved` → `paid`。

---

### 2.4 PJ進捗 / Cockpit（CockpitView）

**目的**: 各PJのマイルストーン（ms_*）進捗を可視化するダッシュボード。
進捗修正提案・修正リクエストフローもここに統合。

| 画面 | 役割 |
|---|---|
| `CockpitView` | PJ一覧、各PJ進捗バー、警告バッジ |
| `CockpitDetailView` | 1PJのマイルストーン全リスト、各msの進捗・期限・状態 |
| `MonthCardView` | 月別サマリ（CockpitDetailView 内） |
| `MilestoneManagementSheet` | mile追加・編集・削除 |
| `MsProgressEditSheet` | 1mileの進捗を %  / ステータスで更新 |
| `MsRevisionRequestSheet` / `RevisionThreadView` | 進捗修正リクエスト送受信 |
| `CockpitHUDView` | **HUD版（デモ）**。設定タブから fullScreenCover で開く没入ダッシュボード |

データ: `ms_definitions` / `ms_progress_*` / `ms_revisions` / `ms_proposal_*`

**バリュープランの状態管理**（CockpitDetailView の planCard 内）:
- バリュープラン名の横に状態バッジを表示
  - `編集中` (active, 橙) / `承認待` (confirmed, 青) / `下書き` (draft, gray) / `確定済` (fixed, 緑)
- **admin** かつ プラン状態が active/confirmed/draft の時のみ「**プランを確定する**」ボタンを表示
  - 押下 → confirmation dialog → `value_plan_cycles.status='fixed'` に UPDATE
  - 確定後、GAS 側で `billing_cycles.reward_summary_json`（メンバー獲得pt / 想定報酬）が計算される
  - 月次モーダルの「メンバー獲得pt / 想定報酬」とマイページの「今月想定」両方がここを起点に出る

**HUD版コックピット（`CockpitHUDView`）— PWA Control Center のデモ表示レイヤ**:
- 設定タブの「ディスプレイ」セクション → 「HUD版コックピット」から `fullScreenCover` で開く。サイバー / ネオン HUD テイスト（PWA `hud_visual_language.md` 準拠の cyan/navy）。右上 `×` で閉じる。
- **PWA `/hud/dashboard` (HudControlCenterDashboard) と同じ構成・文言**。データは **Supabase 直読み**（API 不要・会場ネット非依存。`SupabaseService.fetchHudManagementSnapshots` / `fetchHudBillingCycles` / `fetchHudMonthlyReports` + `fetchActiveProjects`）:
  - **AMD Management Score**: `amd_management_score_snapshots` 最新 ym。総合スコアの大リング（`>=75 GOOD` / `>=55 WATCH` / `<55 ALERT`）+ 5サブリング（先手力=initiative / 財務=finance / 継続=retention / 新規=pipeline / 方向=direction）+ 6ヶ月推移ライン + `LOW CONF`（confidence ≤ 0.6）
  - **System Status**: Data Pipeline / Integration（BC 件数）/ Security / Backup
  - **Project Signal Board**: active PJと現行SPSを`/api/hud/dashboard`から読む。現行版は`sps-ind-v1 / q-eval-v2 / rubric-v1.1 / p-ind-v1`だけで、欠測は「最新版未評価」。旧M/X/Fスコアや月次ルーティン進捗へfallbackしない。
  - **Next Action Queue**: `billing_cycles` 未完了から自動生成（PWA `buildMonthlyRoutineActions` 相当）
- **PJカードをタップ → cockpit のスコア詳細**（`ScoreDetailWebView`）。iOS が開く互換URL `/venture-map/amd-score/{projectId}` は PWA `/project/{projectId}/cockpit?tab=score-detail`（PRS/R_net/XRL/FRL/ALQ radar/CES・計算式・XRLチェックリスト）へ自動転送する。iOS の Supabase セッションを `@supabase/ssr` 互換 cookie に変換して注入し、auth 必須ページを認証付きで開く。
- **スコア詳細タブの《組織》** (2026-08-28 新設、PWA): 産業創出価値のパネルの下に、経営チームの八機能の充足状態・人と組織の観測ログ・メンバー一覧を置く。機能の一覧はモデル正本から実行時に読み、充足は実働の記録だけで判定する（肩書では判定しない）。個人の評価を含むため member 限定で、外部の共有ワークスペースからは読めない。iOS が `ScoreDetailWebView` で開くのは同じページなので、ここも WebView に出る。正本は [`pwa/spec/4-9`](../pwa/spec/4-9-project-org-section-current-spec.md)。
- ローディング / エラーも HUD テイスト（UPLINK スピナー・`DATA LINK FAILED` + RETRY）。**表示専用**。アニメは `TimelineView(.animation)`（スキャンライン・パルス）。**計器目盛は静止**（無意味な常時回転は禁止）。

---

### 2.5 名刺管理（BusinessCardsView）

**目的**: スマホで名刺を撮影し、OCR候補を人が確認してPJへ紐付け、連絡先台帳とPJ人物ナレッジを同時に育てる。

- タブ位置: 「登録」タブ → 「名刺登録」カードから開く（独立タブではない）。
- `BusinessCardsView` は現在のSupabase sessionを `@supabase/ssr`互換cookieへ変換し、PWAのナビ無し native shell `/native/business-cards` を `WKWebView` で開く。
- WebViewのredirect・再読込に伴う一時的なnavigation cancelは失敗表示にせず、最終ページの読込完了時にエラー表示を解除する。本当の通信失敗だけ「もう一度」導線を出す。
- WebViewのUser-AgentはSafari/WKWebView標準値を維持し、`applicationNameForUserAgent` で `AMDOS-iOS BusinessCards` を追記する。標準UAを丸ごと上書きしない。
- PWA側の名刺shellは撮影 / 写真選択のため、当該routeだけ `camera=(self)` と `img-src ... blob:` を許可する。その他のPWA画面は従来どおり camera deny。
- PWA側の `/native/*` shell は `GlobalNav` だけでなく、通知・チャットなどの常駐クライアント部品も外し、埋め込み画面本体だけを描画する。
- 撮影 / 写真選択、Gemini OCR、修正、複数PJ選択、確定はPWAと同じ `/api/business-cards` contractを使う。
- OCRは自動確定しない。氏名と1件以上のPJを人が確認した時だけ `business_cards.status='confirmed'` とD-3 `project_knowledge(source='business_card')` を同期する。
- 名刺画像、email、phone、address、raw OCRはprivate名刺台帳だけに置き、PJナレッジへ複製しない。
- `NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription` を持つ。

### 2.6 Admin（AdminTabView）

**表示条件**: `members.is_admin = true` のメンバーのみ。

#### 2.6.-1 メンバー（`MemberListView` / `MemberDetailView`）

AMD メンバーの全項目を一覧・編集する admin 専用画面。

**MemberListView**: active / 離脱済み で2セクション表示。離脱済みはトグルで開閉。
各行に admin バッジ、`exclude_from_payout_notice=true` なら「通知書対象外」バッジを付ける。

**MemberDetailView**: 以下のフィールドを編集可能。
- 基本: code_name / member_name / email / slack_id
- 権限・ステータス: is_admin / status (active|inactive) / **exclude_from_payout_notice** ⭐
- 参加・離脱: joined_at / left_at （DATE）
- プラン課金状況: slack_plan / google_plan （"paid" | "free" | NULL）
- 支払通知書: member_address / bank_info

**`exclude_from_payout_notice` の効果**:
- `fetchPayoutNoticeMembers(ym:)` が `.eq("exclude_from_payout_notice", value: false)` で絞り込む
- 役員報酬を別建てにしているメンバー（masa等）や、無償出向（りり等）を支払通知書送付対象から除外
- DB 既定値は `false`（送付対象）

#### 2.6.0 「今月やること」カード（`AdminMonthlyTasksCard`）

AdminTabView 上部に常時表示するサマリカード。月次ルーティンから除外した admin 専任タスクや、
admin がアクション必要なものを集約する。

データ源: `fetchAdminPendingSummary()`（active PJ × 直近6ヶ月の billing_cycles を集計）。

| 表示行 | 条件 | タップ先 |
|---|---|---|
| 予算承認待ち | `status='reported'` | `BudgetApprovalView` |
| 支払通知書未送付 | 請求書発行済み × `payout_notice_uploaded_at` 未設定 | `PayoutNoticeAdminListView` |
| 入金未確認 | 請求書送付済み × `payment_confirmed_at` 未設定 | `BillingMatrixView` |
| 報酬未支払い | 入金確認済み × `reward_paid_at` 未設定 | `BillingMatrixView` |

`.task` と `.refreshable` でロード／再読み込み。0件の項目は行ごと非表示。

#### 2.6.1 PJ Config（ProjectConfigDetailView）
**目的**: PJ単位の業務委託料・送付ルール・送付先メールを設定。
- ステータス（active/frozen/ended）・開始月・終了月
- PJタイプ（標準 / CTB）
- 業務委託料タイプ（monthly_fixed / milestone / variable）と額
- 請求書送付日（毎月何日 / CTBは28日）
- 支払期日（発行月末 / 翌月末 / 翌月25日）
- 請求書送付先 To/CC/BCC（手動送付に切替も可能）
- **キーボード処理**: 入力欄外タップ・スクロール・キーボードバーの「完了」でキーボードを閉じる

#### 2.6.2 ナレッジ会（KnowledgeSessionListView）
**目的**: 月次ナレッジ会のオフライン開催設定 → all-pm への Slack 告知まで。
- 月ごとに「オフライン開催にする/しない」を選択
- オフラインなら開催日・場所（履歴から or 新規）・参加者・PMへのメッセージを設定
- 「PMにSlackで連絡」 → つくよみが告知文草案 → テスト投稿（C04QB6F7YPN）/ 本番投稿（all-pm: C08S3292L8G）
- データ: `knowledge_sessions` テーブル
- 編集シート: `KnowledgeSessionEditSheet`、告知シート: `KnowledgeAnnouncementSheet`

#### 2.6.3 Billing Matrix（BillingMatrixView）
**目的**: 全PJ × 全月の請求 / 支払 / 通知 ステップ完了状態をマトリクス表示。
- 行=PJ、列=ym、セル=各ステップ進捗（done/undone/skip）
- セルタップでそのPJ-ymの編集シートが開く

#### 2.6.4 予算承認（BudgetApprovalView）
**目的**: PMが申告した請求額 / バッファ / 配賦をadmin が承認する画面。
- `billing_cycles.status = "reported"` の行を一覧
- 各行で配賦額の最終調整 → 承認 → `status = "allocation_confirmed"`

#### 2.6.4.5 きよ お金の流れ（PWA専用 `/admin/kiyo?task=money-flow`、iOS未移植）

**目的**: きよが月次経理（立替精算・請求書・メンバー支払）に入る前に、AMDに「どこからいくらお金が入り、何に使われたか」の全体像を会計知識なしで理解できるようにする。B/Sや試算表の再現ではなく、ざっくり全体図（画面上にも明記）。設計正本: `pwa/manual/6-11-kiyo-money-flow-spec.md`。

- `/admin/kiyo` タブの先頭「00 お金の流れ」。既定タブは引き続き「01 立替精算」
- 期間切替: 今月 / 今シーズン（AMD自身 `project_id="p00"` の value_plan_cycles active 期間）/ ぜんぶ
- A: 自作SVGサンキー風の流れ図（左=PJ別の入り、中央=AMDの財布、右=使い道5分類）。ノード/帯クリックで下のB該当行へスクロール＋展開
- B: 「1 入ってきたお金 / 2 AMDの財布 / 3 使ったお金」の3ステップ縦カード。行クリックでドリルダウン（人別・月別・科目別など）
- 集計 API: `GET /api/admin/kiyo/money-flow?period=month|season|all`（server層 `src/lib/finance/kiyo-money-flow.ts`、プロセス内TTL5分）。admin専用（人別報酬を含むため member へ露出しない）

#### 2.6.5 支払通知書作成（PayoutNoticeAdminListView → PayoutNoticePerMemberView）

**🚨 重要：表示ロジック**

* 起点: **active メンバー × is_active な project_members × active PJ**
* つまり「すべての active メンバー × すべての active 参加PJ」が必ず行に出る
* PJの active 判定: `projects.status='active'` かつ `start_ym ≤ ym ≤ end_ym`
* 配賦額の取り扱い:
  - PMが `billing_cycles.member_allocations_json` でそのメンバーに配賦額を入れていれば → 円表示
  - 入れていない → **「未設定」バッジ表示**（行は消えない）
* 旧仕様: `billing_cycles.member_allocations_json` を起点にしていたので、PMが配賦未入力のPJは消えていた。 → 廃止。

**🧹 自動クリーンアップ**: 画面ロード時に `pruneInactiveBillingCycles(ym:)` を呼んで、
`projects.status != 'active'` か ym 範囲外のPJの `billing_cycles` 行を DELETE する。
ノイズ行を残さないため。

**📲 PJ内訳タップ**: PJ内訳の各行はボタン。タップすると `BudgetStepView` をシート表示し、
そのまま配賦額を入力 / 修正できる。シート閉じたら一覧再読み込み。

**画面**:

`PayoutNoticeAdminListView` (一覧):
- 対象月セレクタ + 「対象メンバー」「送付済み」サマリ
- 各メンバー行: コードネーム / 合計配賦額 / 送付済バッジ / **未設定PJあり警告** / PJ名一覧

`PayoutNoticePerMemberView` (1メンバー詳細):
- ヘッダー: 名前・対象月・合計・メールアドレス・送付済バッジ
- PJ内訳: 各PJの配賦額（または「未設定」バッジ）
- アクション: 「PDFをプレビュー」(QuickLook)・「送付する」（メール添付送付）
- 1メンバー × 1ym = 1通の支払通知書PDFを生成
- Edge Function `send-payout-notice` を `{memberId, ym, mode: "preview"|"send"}` で叩く
- 送付完了 → `payout_notices` に記録、関連PJの `billing_cycles.payout_notice_uploaded_at` も更新

#### 2.6.6 提案箱（ProposalInboxView）
**目的**: メンバーからの提案（`proposals` テーブル）をadminが読んで返信する。
- 未読 / 既読 で分類、スレッド形式で対話

#### 2.6.7 つくよみの学び（TsukuyomiLearningsView） ⭐
**目的**: つくよみAIが学習した内容を一覧 / レビュー / 削除する管理画面。
- 学習データ（`tsukuyomi_learnings` 等）を全件カード表示
- 各カード: スコープ（global/PJ単位）・出典・本文・PJキー（あれば）
- 「覚えないでほしい」ボタン → 理由を入れて学習を soft-delete
- トグルで「削除済み表示」も可能
- データ: `fetchTsukuyomiLearnings` / `unlearnTsukuyomi` / `addTsukuyomiLearning`
- **過去にDrive同期トラブルで消失したことあり**。消えたら必ずここを起点に復活させる。

---

### 2.7 設定（SettingsView）

| 画面 | 役割 |
|---|---|
| `SettingsView` | バージョン情報、ログアウト、HUD版コックピット、教科書導線 |
| `PayoutInfoEditView` | 自分の住所・振込先を編集（支払通知書PDFに記載される） |
| `TextbookReaderView` | 同梱した `pwa/bzm/*.md` を縦書きページリーダーで表示し、iOS Swift 版から Before Zero / BZM 教科書を読む |

**教科書導線（`TextbookReaderView`）**
- 設定タブの「資料」セクション → 「教科書」から開く。
- `ios/AMDOS/Resources/BZM/*.md` に同梱した Markdown を、縦書き・右から左への段組みでページ単位に読む。
- 初期表示は `preface.md`。右上の章メニューから同梱章を選び、右スワイプで次ページ、左スワイプで前ページへ戻る。下部の矢印は見た目どおり、左が前ページ、右が次ページ。
- ページ位置バーは読書順に合わせ、開始位置を右端、終端を左端に表示する。
- 文字送りは詰め、段と段の間だけ余白を取る Kindle 風の縦組み。画面高に応じて 1 段あたりの文字数を増やす。
- 右上の文字サイズメニューで 17〜30pt の間を調整できる。文字サイズ・画面幅に応じて 1 ページの段組みを再計算する。
- WebView / PWA 認証 cookie に依存しないため、白画面や `this page couldn't load` には落ちない。
- 読み取り専用。教科書本文の正本は `pwa/bzm/*.md` と `pwa/src/app/(app)/bzm/bzm-chapters.ts`。iOS 同梱分は正本から同期したコピー。

---

### 2.8 つくよみ（TsukuyomiView）

**目的**: 各メンバーが直接つくよみと対話する画面（個人用AIアシスタント）。
- データ: `tsukuyomi_sessions`
- ナビ：マイページから 1タップで開ける

---

### 2.9 タスク（TasksView）

(現状・将来の使い方は要再整理。`Tasks/TasksView.swift` 参照)

---

## 3. 横断的な UI ルール

すべての画面が守るべきルール。

### 3.1 キーボード
- TextField 群を含む画面では：
  1. `.scrollDismissesKeyboard(.immediately)` を Form / ScrollView に付与
  2. `.toolbar { ToolbarItemGroup(placement: .keyboard) { Spacer(); Button("完了") { amdHideKeyboard() } } }` でキーボードに「完了」ボタン
  3. 必要なら `.dismissKeyboardOnTapOutside()` でフォーム外タップ閉じる
- ヘルパは `AMDOS/Core/DesignSystem.swift` の `amdHideKeyboard()` / `dismissKeyboardOnTapOutside()`

### 3.2 ナビゲーション
- **NavigationLink で push する画面に `.toolbar { ToolbarItem(placement: .cancellationAction) { Button("閉じる") {} } }` を入れない** —— システムの戻るボタンとダブって縦に2つ並ぶ
- 「閉じる」ボタンが要るのは `.sheet`（モーダル）の中だけ
- モーダルなら `NavigationStack { ... }` で包んで内側に `cancellationAction` を置く

### 3.3 Drive 同期トラップ対策
- Drive 上で `.git` を操作しない（同期で壊れる）
- 重要な書き込みは GitHub or `/tmp` 作業コピーで
- **画面が消えたら GitHub リモートが正本**（`masa-teamarmada/amd-os-ios`）
- このDESIGN.md にも忘れず差分を反映

---

## 4. Supabase Edge Functions

| 関数 | 目的 |
|---|---|
| `send-payout-notice` | 支払通知書PDF生成 + 送付。`{memberId, ym, mode: "preview"\|"send"}` |
| `issue-invoice` | 請求書発行（freee 連携） |
| `cancel-invoice` | 請求書キャンセル（freee はそのまま、billing_cycles 側だけリセット） |
| `schedule-meeting` | Google Calendar に月次MTG作成 |
| `pull-app-notifications` | アプリ内通知の取得 |
| その他 | `supabase/functions/` 配下を直接参照 |

---

## 5. ビルド / デプロイ

- `project.yml` (XcodeGen) で `AMDOS.xcodeproj` を生成
- 新ファイル追加後は `xcodegen` を実行して pbxproj 更新（必要であれば）
- TestFlight 配布時も別建ての build 番号運用はしない。`MARKETING_VERSION` と `CURRENT_PROJECT_VERSION` を同じ値に揃える
  - アプリ内表示は `CFBundleShortVersionString` のみ。括弧付き build 番号は出さない
- 詳細: `TESTFLIGHT_WORKFLOW.md` 参照

---

## 6. このファイル自体の運用ルール

### 2026-07-25: 判断キューと契約要対応

- `判断` は先頭1件で止めず、未回答カードを縦に連続表示する。下へスクロールすると次の通知を確認でき、各カードに `n / total` を表示する。
- 契約の `action_item` は、契約ID・契約名・相手先・種別・現在状態・変更後状態がそろう場合だけ `管理 → 契約` の更新として判断させる。どれかが欠ける候補は `needs_source` として生成側で回収し、iPhoneの判断・未読キューには出さない。

### 2026-07-26: D-7 候補の保存先を明示

- D-7 の候補は `destination_kind` を必須にし、BZMと経営ノウハウを通知カード上で区別する。本文を「OSの見立て」と「追加・更新する情報」に重複表示しない。
- 経営ノウハウ候補の採用は、単なる確認記録ではなく、管理 → 経営ノウハウへの1件保存。通知には保存される分類・成熟度・タグ・再利用する場面を出す。

- 画面・機能を追加 → このDESIGN.mdの該当章を必ず追記する
- 画面・機能を削除 → 該当行を消す（履歴は git log に残るので worry無し）
- 大きなリファクタ（タブ追加・主要画面再設計）→ ChangeLog 的に上部に「最終更新」を更新
- えいみが「画面ある？」と聞いてきたら **このファイルが正** としてみる
