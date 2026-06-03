# iOS → Android ハンドオフ

> See also: [CLAUDE.md](CLAUDE.md) — 最重要ルール / [DESIGN.md](DESIGN.md) — **全画面の正本仕様（必読）** / [HANDOFF.md](HANDOFF.md) — 配布状況 / [BUGS.md](BUGS.md) — 既知バグ

最終更新: 2026-06-02 (JST)
対応 iOS commit: 6c3244b "feat(ios): tap PJ card → AMD Score detail (PWA WebView, auth cookie)"
TestFlight build: 21（未 upload のまま）

---

## 2026-06-02 追記その2: HUD を PWA Control Center 化 + AMD Score 詳細 WebView

### 16. CockpitHUDView を PWA `/hud/dashboard` 構成に刷新（実データ直読み）
- 初回版（独自メトリクス）から **PWA Control Center と同じ構成・文言**へ作り直し。Supabase 直読み（API 不要）。
- パネル: AMD Management Score（`amd_management_score_snapshots`：大リング GOOD/WATCH/ALERT + 5サブ + 推移 + confidence）/ System Status / Project Signal Board / Next Action Queue。
- `SupabaseService` に `fetchHudManagementSnapshots` / `fetchHudBillingCycles` / `fetchHudMonthlyReports` を追加。
- ⚠️ Signal Board の **M/X/F は AMD Score 計算エンジン未移植**のため月次ルーティン進捗で代替。PWA に `/api/hud/dashboard`（同集計の JSON API）を実装済み（main 6c3244b 系）だが Vercel 日次 deploy 上限のため当日は未 deploy。

### 17. PJカードタップ → AMD Score 詳細ページ（WebView, cookie 認証）
- Signal Board の各 PJ カードを tap → `ScoreDetailWebView` で PWA `/venture-map/amd-score/{projectId}` を WKWebView 表示（μ/XRL/FRL/ALQ/CES・計算式）。
- auth 必須ページなので、iOS の Supabase session を `@supabase/ssr` 0.10 互換 cookie（`sb-<ref>-auth-token`, `base64-`+base64url, 3600 超は `.0/.1` chunk）に変換し `httpCookieStore` に注入してから load。実機ログイン状態で認証通過を確認済み。

**Android 実装時の注意**: 優先度低（デモ表示）。Management Score 等は同テーブル直読みで再現可。AMD Score 詳細は同様に PWA ページを WebView 表示する場合、Android の CookieManager に同じ cookie を入れる。

---

## 2026-06-02 追記: HUD版コックピット（デモ表示）

### 15. CockpitHUDView — 設定から開く没入型 HUD コックピット

**動機**: デモ用に「かっこいい」タクティカル HUD 表示が欲しい。既存 Cockpit（PJ進捗タブ）とは別に、設定からワンタップで全社サマリを HUD テイストで見せる。

- `SettingsView.swift`
  - 先頭に「ディスプレイ」セクションを追加。`scope` アイコン + 「HUD版コックピット」ボタン。
  - `@State showHUDCockpit` → `.fullScreenCover` で `CockpitHUDView` を提示。
- `CockpitHUDView.swift`（新規）
  - 没入型フルスクリーン。背景はダークネイビー + ネオンシアン。`TimelineView(.animation)` でスキャンライン・回転リング・流れるティッカーをライブアニメーション。
  - **データは実データ集計**: `fetchActiveProjects()` → 各 PJ `fetchCockpitData()` を `withTaskGroup` で並列取得。
    - 全体達成率 = マイルストーンのポイント加重平均
    - PJ別ステータス = 当月 `expectedPct` との差分（AHEAD / AT RISK / ON TRACK / COMPLETE）
    - メトリクス = ACTIVE PJ / TOTAL POINTS / MONTH BUDGET / MS CLEARED / AT RISK / VELOCITY
    - REWARD ALLOCATION = 当月 `reward_summary_json.members` を横断合算
  - loading / error / empty も HUD テイスト（UPLINK スピナー / `DATA LINK FAILED` + RETRY）。
  - **表示専用・編集なし**。右上 `×` で閉じる。

**Android 実装時の注意**:
- 優先度は低い（デモ表示レイヤ。業務フローには影響しない）。移植するなら Compose で同テイストを再現する想定。
- 既存の Cockpit データ取得（active projects + cockpit data）をそのまま流用して集計するだけなので、新規 API / スキーマ追加は **なし**。
- 数値ロジック（ポイント加重平均・ステータス判定・報酬横断集計）は上記の通り iOS と揃えること。

### Android 反映状況
（Win 側のえいみがここを追記する）

---

## 2026-05-20 追記: 通知詳細・はい/いいえ/コメント回答

### 14. Native notification inbox and responses
**動機**: Swift 版にも L2/議事録通知は届くが、通知内容をアプリ内で見たり、`はい` / `いいえ` / コメントで返したりできなかった。PWA `/notifications` 相当の最低限の確認・回答導線を iOS に移植した。

- `AMDOSApp.swift`
  - `UNNotificationCategory` を追加: `AMD_L2_NOTIFICATION` / `AMD_MEETING_NOTIFICATION`
  - 通知アクションを追加: `AMD_NOTIFICATION_YES` / `AMD_NOTIFICATION_NO` / `AMD_NOTIFICATION_COMMENT`
  - 通知タップ時は `NotificationService.activeInboxLink` に deep link をセットし、該当通知カードを開く
  - 通知アクション時は `SupabaseService.submitNotificationResponse(...)` へ直接送る
- `MainTabView.swift`
  - `NotificationService.activeInboxLink` を監視し、`NotificationInboxView` を sheet 表示
- `MyPageView.swift`
  - マイページ最上部に「通知ボックス」を追加
- `SettingsView.swift`
  - 設定タブから通知入口を削除
  - `NotificationInboxView` を追加。`l2_notifications` / `meeting_notifications` を統合表示し、`すべて` / `未読` / `回答済み` でフィルタ
  - `すべて` / `未読` から回答済み通知を除外し、回答後は `回答済み` 側に移動
  - カード展開で通知本文、関連データ、過去コメント、回答フォームを表示
- `SupabaseService.swift`
  - `fetchNotificationInbox` / `fetchNotificationDetails` / `markNotificationRead` / `submitNotificationResponse` を追加
  - 共通で `l2_feedbacks` に回答保存、best-effort で `tsukuyomi_learnings` にも履歴保存
  - 回答後に該当通知を既読化。ネイティブ通知アクション経由では delivered notification も削除
  - `ms_progress`: `はい` = pending revision confirm、`いいえ` = pending revision discard
  - `project_registry_diff`: `はい` = accepted、`いいえ` = rejected。実DB適用は既存ルール通り helper/PWA 経由
  - `xrl_evidence`: `はい` = confirmed、`いいえ` = rejected

### Android 移植メモ
- 入口は MyPage top に「通知ボックス」を置けば iOS と揃う
- Android 通知 action は iOS と同じ意味で `yes` / `no` / `comment` を送る
- 一覧の統合キーは iOS と同じ:
  - L2: `l2-\(notification_id)`
  - meeting: `meeting-\(meeting_id)`
- feedback target は meeting だけ特殊:
  - meeting: `l2_kind = meeting_summary`, `target_id = project_id`, `scope_key = meeting_id`
  - L2: `l2_kind = l2_kind`, `target_id = target_id`, `scope_key = scope_key`
- project registry diff の accepted 後も Android が直接 apply しない。DB反映は helper/PWA 経由のルールを維持する

---

## 18:30 追記: バリュープラン確定UI + マイページ想定報酬表示

### 12. `180db47` Add admin-only "Fix plan" button to PJ progress
**動機**: 4月開始の新プラン (SX 等) が `value_plan_cycles.status='active'` のままで、
GAS が `billing_cycles.reward_summary_json` を計算してくれないため、PJ進捗の
「メンバー獲得pt / 想定報酬」が「未計算」になっていた。GAS 管理画面に入らずに
iOS から完結できる UI を追加。

- `CockpitPlanCycle` に `status` / `isFixable` / `statusLabel` を追加
- バリュープランカードにプラン状態バッジを表示（編集中=橙 / 承認待=青 / 下書き=gray / 確定済=緑）
- **admin** かつ `isFixable` (active/confirmed/draft) な時だけ「**プランを確定する**」ボタンを表示
- 押下 → confirmation dialog → `SupabaseService.fixPlanCycle(planCycleId)` で
  `value_plan_cycles.status='fixed'` に UPDATE
- GAS が `fixed` を拾って `reward_summary_json` を計算する設計（plan.status=fixed と
  reward_summary_json あり の相関 100% で確認済）

### 13. `2e83881` Show monthly estimated reward yen on MyPage PJ cards
**動機**: PJ進捗の「メンバー獲得pt / 想定報酬」をマイページ各PJカードにも反映する。

- `MyPageProject` に `monthlyEstimatedRewardYen` / `monthlyEarnedPt` を追加
- `fetchMyPageData` の billing_cycles select に `reward_summary_json` を追加し、
  `members[me].totalPay` / `earnedPt` を抽出
- `ProjectRewardCard` ヘッダのすぐ下に indigo 帯で「**今月想定 ¥X,XXX (Y.Y pt)**」を表示
- `reward_summary_json` 未計算なら「未計算」表記（plan が fixed されてない PJ）

### 補足: GAS 側の reward 計算仕様の追跡（解明済み）
- `billing_cycles.reward_summary_json` の書き込みは iOS / Edge Function には **無い**
- すべて GAS WebApp が計算
- 全 122 件の billing_cycle で集計した結果:
  - plan.status='fixed' な行 34 件 → 100% reward あり
  - plan.status='active' な行 11 件 → 100% reward なし
  - no_plan な行 77 件 → ほぼ reward なし
- → **plan を fixed に上げると GAS が計算する**
- iOS / Android 双方とも、ユーザに「プランを確定する」操作をしてもらわないと reward が出ない

---

---

## 🚨 大事な約束: DESIGN.md が全画面の正本

このリポジトリのトップに `DESIGN.md` がある。
**iOS / Android 双方で、画面・機能を追加 / 削除 / 名称変更したら必ず同じコミットで更新する**。
えいみが「これ知らない画面なんだけど…」となったら、まず DESIGN.md を確認する。

過去（2026-04-26 〜 28）、 **「つくよみの学び」管理画面が Drive 同期事故で git 側から消失**、
**フロートボタン等が未 push commit に閉じ込められて巻き戻り** など、複数の消失事故があった。
これらを防ぐスナップショットが DESIGN.md。詳細経緯は BUGS.md を参照。

---

## 🚨 巻き戻り防止 5 層（必読）

エラー閉じ・別マシン作業・別セッションによる「機能巻き戻り」を防ぐためのルール。
詳細は CLAUDE.md / BUGS.md にもあるが要点だけ:

1. **commit したら即 push** — ブランチ作ったら即 `git push -u origin <branch>`、commit ごとに `git push`
2. **セッション開始時の 4 ステップ**:
   ```sh
   git fetch --all --prune
   git log --branches --not --remotes --oneline   # 未 push commit 検知
   git branch -a
   git status -s
   ```
3. DESIGN.md を画面の正本として更新
4. main 更新 → 必ず HANDOFF_ios_to_android.md 更新 + push
5. BUGS.md / DEBUG.md に事故を蓄積

---

## 今回のハンドオフ範囲（11 commit + Drive 廃止）

`fb68db8` (前回 push 済み HEAD) から `fb9f503` までの **11 commit 分**。
時系列に沿って下から（古→新）に並べる。

### 1. `a42c4aa` Add DESIGN.md + UX fixes (payout notice, keyboard, back button, monthly_fixed)
- DESIGN.md（全画面設計の正本）を新設
- 支払通知書ロジック大改修: `billing_cycles.member_allocations_json` 起点 → **active メンバー × is_active project_members 起点**
- PJ Config (`AdminTabView.ProjectConfigDetailView`) にキーボード処理追加（`amdHideKeyboard()` / `dismissKeyboardOnTapOutside()` を `Core/DesignSystem.swift` に実装）
- 支払通知書詳細画面の戻るボタン重複（cancellationAction "閉じる" + システム戻るボタン）を解消
- 月額固定 PJ で BudgetStepView の請求額に `fee_amount` を自動入力 + プレースホルダー表示

### 2. `6e6874e` Payout notice: active PJ filter + billing_cycles cleanup + tap-to-budget
- 一覧 / 詳細とも `projects.status='active'` かつ `start_ym ≤ ym ≤ end_ym` を満たす PJ のみ表示
- 上記条件を満たさない PJ に紐づく `billing_cycles` 行は **画面ロード時に自動削除**（新関数 `pruneInactiveBillingCycles(ym:)`）
- `PayoutNoticePerMemberView` の PJ 内訳行を Button 化、タップで `BudgetStepView` をシート表示（adminもPMと同じ画面）

### 3. `804bd13` Budget step: placeholder-only, prev-month for variable, fix diff label
- 変動額 PJ で BudgetStep の請求額に「前月の値」をプレースホルダー表示
- 差分ラベルの誤表記を修正

### 4. `6916a71` Budget step: pre-fill invoice with default value
- 月額固定 PJ で BudgetStep を初回開いた時に請求額をプリフィル（ユーザーが何も入力しなくても保存できる）

### 5. `88e9fc8` MainTabView: replace TabView with custom horizontal scroll capsule bar
（試験的）— TabView を独自の横スクロール capsule バーに置き換え

### 6. `b4a8f7f` MainTabView: tab bar UI を iOS 標準スタイルに戻して横スクロール維持
- カプセル UI を iOS 標準スタイルに寄せた

### 7. `67b31c8` Revert MainTabView to original TabView (More tab returns)
- 上記 2 commit を一旦差し戻し、標準 TabView に戻した（More タブが復活）

### 8. `2100900` Admin floating button + payout PDF base64 transport ⭐ フロートボタン
- **Admin タブ画面下部にフロートボタン**を追加（PDF プレビュー / 送付動線をここからショートカット）
- 支払通知書 PDF の転送方式を URL → **base64 直送** に変更（PDF URL 期限切れ対策、Edge Function `send-payout-notice` 側も対応）

### 9. `660151d` Payout notice: layout polish, sequential notice_no, combined PDF preview
- 支払通知書の layout を整えた（フォント / 余白 / 行高など）
- `notice_no` をメンバー横断で **連番**（送付順に通し番号）に変更
- 1 メンバー × 1 ym = **1 PDF にすべての PJ をまとめて表示** するプレビューに変更

### 10. `efef8c0` Mark Drive deprecated + wire DESIGN.md into all docs + add 4-step session start protocol
- CLAUDE.md / AGENTS.md / HANDOFF.md / HANDOFF_PROMPT.md を一括更新
- 作業ディレクトリを Drive (`/Users/masa/Library/CloudStorage/.../共有ドライブ/...`) から `~/dev/amd-os-ios` に統一
- Drive 廃止を明記、参照禁止に
- DESIGN.md を全 md からの必読リストに追加
- セッション開始時の 4 ステップ手順を CLAUDE.md / AGENTS.md / HANDOFF_PROMPT.md に追加

### 11. `fb9f503` Filter MyPage milestones to month-with-progress + show delta note
- マイページの PJ カード内 MS 一覧を **当月差分 (`monthlyPct > 0.01`) があるものだけ**に絞り込み
- 各 MS 行に月次モーダル (`MonthlyModal.deltaSummaryText`) と同じ文面を表示
  優先順位: `milestone_monthly_progress.note` → AI 推定 → 通常の差分文面
- 当月差分バッジは AI 推定なら橙、確定値なら緑で色分け

### 加えて: Drive 廃止
- Drive 上の `共有ドライブ/claude/AMD_OS/amd-os-ios/` は廃止済み（`~/.Trash/amd-os-ios-drive-deprecated-20260428-170604` に退避）
- 以後の作業は `~/dev/amd-os-ios` のみ

---

## UI 仕様（差分のみ）

### Admin タブ全体（`AdminTabView`）
- 画面下部に **フロートボタン** を追加（commit `2100900`）
- ボタンの配置・色・押下時の動作については `AdminTabView.swift` を参照
- Android 側でも同じ位置・同じ動作で実装する

### 支払通知書作成（メンバー単位）一覧（`PayoutNoticeAdminListView`）
- 一覧に出す条件:
  - メンバー: `members.status = 'active'`
  - 参加 PJ: `project_members.is_active = true`
  - PJ 自体: `projects.status = 'active'` かつ `start_ym ≤ ym ≤ end_ym`
  - 過去メンバー（project_members 外）も `billing_cycles.member_allocations_json` 経由で救済して合流
- 各行:
  - 左: codeName / 合計（配賦入力済み PJ のみ）
  - 右: 「送付済み / 未送付」バッジ ＋ **「未設定 PJ あり」警告（橙色）** ＋ PJ 名連結
- 画面ロード時に inactive な PJ に紐づく `billing_cycles` 行を自動 DELETE

### 支払通知書詳細（`PayoutNoticePerMemberView`）
- PJ 内訳行は Button、タップで `BudgetStepView` シート表示（PMと同じ画面で配賦額編集可）
- PJ 内訳に「未設定」バッジ（橙色 capsule）追加
- 未設定 PJ が 1 つ以上あると「※ 未設定PJはこの通知書には含まれません」案内文表示
- PDF プレビュー / 送付ボタン: **配賦入力済み PJ が 1 つ以上ある場合のみ活性**
- システム戻るボタンのみ（「閉じる」ボタンは廃止）
- PDF プレビューは 1 メンバー × 1 ym = 1 PDF（全 PJ まとめ）
- `notice_no` は送付順に連番（メンバー横断）

### PJ Config（`AdminTabView.ProjectConfigDetailView`）
- 入力欄外タップ・スクロール・キーボードバーの「完了」でキーボードが閉じる
- 共通ヘルパ: `amdHideKeyboard()` / `.dismissKeyboardOnTapOutside()`（`AMDOS/Core/DesignSystem.swift`）

### 予算確定（`BudgetStepView`）
- 月額固定 PJ で初回開いたとき、請求額に `fee_amount` を自動入力
- ラベル横に「月額固定: ¥XXX」のヒント
- 変動額 PJ では前月の値をプレースホルダー表示

### マイページ MS 行（`ProjectRewardCard.milestoneRow`）
- **当月差分があった MS のみ**表示（無いものは行ごと消える）
- 行末尾に月次モーダルと同じ delta summary text を表示
- 当月差分バッジは AI 推定値なら橙、確定値なら緑

---

## データモデル / 永続化

新テーブル・カラム変更なし。

`milestone_monthly_progress` から `source` / `note` の SELECT を追加（`fetchMyPageData` の中だけ）。

`fetchPayoutNoticeMembers` 内部で `members.status='active'` / `project_members.is_active=true` / `projects.status='active'` を JOIN し、`pruneInactiveBillingCycles(ym:)` で inactive billing_cycles を DELETE する。

---

## 外部 API / Supabase 契約

### Edge Function `send-payout-notice` 仕様変更
- リクエスト・レスポンス: 変わらず
- ただし PDF データの **転送方式が URL → base64** に変更（commit `2100900`）
- Android 側もこれに合わせる（受信した base64 を `Uint8Array` 復元 → PdfRenderer 等に渡す）

---

## 検証済み挙動
- Mac で xcodebuild → BUILD SUCCEEDED（commit `fb9f503` 時点）
- masaiPhone (`22F6F889-985D-5CAF-AFF3-D50D5E80FFA0`) に Debug ビルドを `devicectl install` → 起動成功
- TestFlight build は今回未更新（build 21 として upload する場合は `CURRENT_PROJECT_VERSION` がすでに 21、archive → upload するだけ）

---

## Android 実装時の注意 / 差異

1. **Admin タブのフロートボタン** — Compose の `Box` + `Modifier.align(Alignment.BottomEnd)` で同等。位置・サイズ・押下時動作を iOS と揃える。`AdminTabView.swift` を参照。
2. **支払通知書一覧の起点** — `member_allocations_json` ではなく `members + project_members + projects` 起点に切り替える。Android にも同じバグが残っている可能性大。
3. **inactive billing_cycles の自動削除** — `pruneInactiveBillingCycles(ym:)` 相当を Android でも実装。データ汚れ防止のため。
4. **戻るボタン重複** — Compose の `Scaffold(topBar = { TopAppBar(navigationIcon = { ... }) })` で独自 "閉じる" を入れると同じ問題が起きる。NavigationStack push の画面は system back のみで運用。
5. **キーボード閉じ** — `LocalSoftwareKeyboardController.current?.hide()` + `Modifier.pointerInput { detectTapGestures { hide() } }`。
6. **月額固定の自動入力** — `projects.fee_type='monthly_fixed'` を読んで請求額フィールドに `fee_amount` をプリフィル。編集可能を保つ。
7. **PDF 転送 base64** — Android 側でも base64 受信 → デコード → PdfRenderer。
8. **マイページ MS 行のフィルタ + delta note** — iOS と同じ AND 条件 (`monthlyPct > 0.01`) と文面ロジックを Android にも適用。月次モーダル側と共通化推奨。
9. **DESIGN.md は共通参照とする** — Android 側で別ドキュメントを作らず、この iOS 側 DESIGN.md を Win 側のえいみも書き込む。

## Android 反映状況
（Win 側のえいみがここを追記する）
