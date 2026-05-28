# HANDOFF: AMD OS iOS ネイティブアプリ

## 最終更新
2026-04-26 (32回目) — 月次報告書つくよみ修正依頼フロー + 差分ハイライトUI + つくよみ学習Admin ページ まで完了・Build 20 実機インストール済み

## 完了タスク（2026-04-26: 32回目）

### 月次報告書 つくよみ修正依頼フロー（MonthlyModal）
- [x] **Supabase migration `20260426030000_monthly_report_revisions_and_learnings.sql`** 適用済み
  - `monthly_report_revisions`: 修正依頼レコード（instruction / revised_content / status=pending|applied|discarded）
  - `monthly_report_revision_messages`: PM ↔ つくよみ メッセージ履歴
  - `tsukuyomi_learnings`: 汎用学習テーブル（scope / scope_key / content / source / status）
- [x] **Edge Function `revise-monthly-report` デプロイ**
  - `monthly_reports.final_content / draft_content` を取得
  - `tsukuyomi_learnings` から同PJの学習を最大20件取得しpromptに注入
  - Claude Haiku (`claude-haiku-4-5-20251001`) で修正後全文を生成
  - `monthly_report_revisions` に upsert + `monthly_report_revision_messages` に PM/つくよみ発言を追加
- [x] **SupabaseService.swift 拡張**（6メソッド追加）
  - `requestMonthlyReportRevision` → Edge Function 呼び出し
  - `applyMonthlyReportRevision` → `monthly_reports` に修正後全文をPATCH
  - `addTsukuyomiLearning` → 学習データをPOST
  - `fetchTsukuyomiLearnings` → 学習一覧取得（scope 絞り込み対応）
  - `unlearnTsukuyomi` → soft delete + 「覚えないで」反学習追加
- [x] **RoutineModels.swift 拡張**
  - `MonthlyReportRevisionResult`, `HunkType`, `HunkStatus`, `ReportHunk`, `TsukuyomiLearningRow` 追加
- [x] **`MonthlyModal.swift` 完全書き直し**（894行）
  - `RevisionState` 列挙子で状態管理: idle → requesting → reviewing → applying
  - 「つくよみに修正依頼する」ボタン → TextEditor シート → Edge Function 呼び出し
  - **段落レベル差分（`computeDiff`）**: Swift `CollectionDifference` で `\n\n` 単位のパラグラフを比較
  - **インライン diff 表示（`HunkRowView`）**: 追加=緑ハイライト / 削除=赤取り消し線 / 置換=両方表示
  - **ハンク単位の承認/却下ボタン**: ✓ / ✗、却下時に任意理由入力
  - 「承認した変更を適用する」→ 却下理由を `tsukuyomi_learnings` に保存 → `monthly_reports` に書き込み

### つくよみ学習 Admin ページ（Phase 2）
- [x] **`TsukuyomiLearningsView.swift` 新規作成**（Admin/）
  - `fetchTsukuyomiLearnings()` で全件取得、active/削除済み切り替えトグル
  - カードごとに scope バッジ / source バッジ / content / 作成日表示
  - 「覚えないでほしい」ボタン → UnlearnSheet（理由入力） → `unlearnTsukuyomi` 呼び出し
- [x] **`AdminTabView.swift` 更新**: Section("管理") に「つくよみの学び」NavigationLink 追加
- [x] **Build 20、masaiPhone インストール・起動確認済み**

### バグ修正（ビルド時）
- [x] `MonthlyModal.swift:326` — 全角`）`が string interpolation 終端として機能せずコンパイルエラー → ASCII `)` に修正
- [x] `SupabaseService.swift` `fetchTsukuyomiLearnings` — `.order()` 後に `.eq()` を呼ぶと `PostgrestTransformBuilder` エラー → フィルタ先付け・`.order()` を最後に移動

## 残タスク（次セッションの最初にやること）

### バックログ
- [ ] **`dailySync_setupTrigger()`（802_DailySyncToSheets.js）手動実行** — まさがGASエディタから1回実行。毎朝03:00 JST の Supabase→スプシ同期トリガーを登録する
- [ ] **Edge Function `collect-member-activities` 新設**（前 30回目から） — L2として生データから各メンバーの活動をSupabase `member_activities` テーブルに抽出するcron。今は `attribute-ms-activity` で代用できているので緊急度低
- [ ] **きよの実機動作確認** — TestFlight で正常動作確認
- [ ] **ProjectListView 等への DesignSystem 統一適用**（Phase 3、後回しOK）

### このセッションで得た知見
- `PostgrestFilterBuilder` の `.order()` は `PostgrestTransformBuilder` を返すため、その後に `.eq()` は呼べない。フィルタを先に全部組んでから `.order().execute()` を最後に繋ぐ
- 日本語全角文字（`）`）は Swift string interpolation の終端 `)` として認識されない。`\(expr)` の閉じ括弧は必ず ASCII `)` を使う
- rsync は Google Drive の書き込み完了を保証しない（ローカル write 直後のrsync でファイルが欠けることある）→ 新規ファイルは `cp` で個別コピーが安全

## 完了タスク（2026-04-26: 31回目）

### マイページ・PJ進捗・タブ周りのリファクタ（前半）
- [x] **タブ並び変更**: マイページ → PJ進捗 → 月次ルーティン → 立替 → 設定（[MainTabView.swift](AMDOS/Features/Home/MainTabView.swift)）
- [x] **PJ進捗詳細MS担当者表示**: 各MS下に code_name + share% + 役割を表示（milestone_responsibility JOIN）
- [x] **マイページMS表示を「自分が担当のMSのみ」に絞り込み**（share>0 でフィルタ）
- [x] **マイページのプラン選択ロジック修正**: status='fixed' のみだと旧プランを引いてた → status in (active/confirmed/fixed/draft) + 期間内マッチ優先
- [x] **終了済PJの非表示**: ym > end_ym の月では PJ ごとスキップ
- [x] **当月進捗の強調表示**: 緑カプセル「+x.x%」 / オレンジカプセル「進捗なし」

### つくよみ系（メイン）
- [x] **GAS estimator note 制限緩和**（200 → 4000 文字、gas-main + gas-report、clasp push 済み）
- [x] **Migration: `member_ms_activities`, `ms_progress_proposals`, `ms_proposal_messages`, `ms_progress_revisions`, `ms_revision_messages`, `member_ms_activities.learned_addendum`** 適用済み
- [x] **Edge Function `attribute-ms-activity` デプロイ**: note + milestone_responsibility を Claude Haiku に投げてメンバーごとの narrative 生成。learned_addendum も prompt に注入
- [x] **Edge Function `tsukuyomi-rephrase` デプロイ**: admin の差し戻し理由を つくよみ口調に LLM 変換
- [x] **Edge Function `revise-ms-progress` デプロイ**: PM の修正依頼 + 既存note → LLM で新 progress_pct + 新 note を提案
- [x] **マイページ MS カードに narrative 表示 + 「つくよみに提案する」ボタン + LINE 風スレッド**
- [x] **Admin タブに「提案箱」追加**: pending 一覧、承認 / 差し戻し（理由入力 → つくよみ口調変換）
- [x] **PJ進捗 MS 行に「つくよみに修正依頼」ボタン + スレッド**: PM ↔ つくよみ。OK 確定で milestone_monthly_progress 更新 + narrative 自動再生成
- [x] **つくよみ学習**: 承認された提案テキストを `learned_addendum` に追記、次回 narrative 生成 prompt に注入
- [x] **PWA → Supabase → Swift 自動同期**: PWA で `milestone_responsibility.task_description` を編集 → Supabase 直書き → Swift は自動反映（追加実装ゼロ）

### PJ Config 予算額連動 + 予算ステップ修正
- [x] **`cascadeFeeAmountToFutureCycles`**: PJ Config で fee_amount 変更時に未確定月の billing_cycles.budget_yen を一括更新（reward_summary_json はクリア）
- [x] **RLS 突破バグ修正**: 当初 anon key で PATCH していたため 0 行更新で静かに失敗していた → accessToken (user JWT) に変更
- [x] **Billing Matrix と月次ルーティンの判定基準統一**: BudgetStepView を `status` 判定 → `budget_confirmed_at` 判定に変更（Billing Matrix と同じ基準）。p21 202604 のような「status='allocation_confirmed' なのに budget_confirmed_at=null」の不整合データも自然に修復可能に
- [x] **確定済み予算でも再編集可能に**: confirmedView に「修正する」ボタン追加 + 既存値を引き継ぎ
- [x] **submitBudgetReport で再申告対応**: status='reported' に戻し、budget_confirmed_at / budget_confirmed_by / budget_yen を NULL クリア

### 月次モーダル想定報酬の3段階フォールバック
- [x] **fetchCockpitData の memberRewards 計算を 3 段階に**:
  1. `reward_summary_json.members` がある → GAS estimator 計算済（最終確定値）
  2. `member_allocations_json` に値あり → 配賦額をそのまま想定報酬として表示
  3. どちらも空 + budget_yen あり（**SXルール**） → 進捗ベース自動計算
     - `earnedPt = MS.points × その月の進捗delta(%) × そのMSでのshare`
     - `ptUnit = budget_yen / totalEarnedPt`
     - `想定報酬 = earnedPt × ptUnit`
     - GAS の `rv2_calcRewardSummary` を月単位に簡略化したロジック

### Spec
- [x] **`SPEC_system_map.md` 更新**: 上記の全機能・データソース・優先順位ルールを追記済

## 完了タスク（2026-04-19: 27回目 auth 調査・切り戻し）

- [x] **nonce 問題の根本原因を特定** — GIDSignIn（AppAuth-iOS）が内部で自動生成した rawNonce を Google JWT に埋め込む。GoTrue は `sha256(provided)==jwt.nonce` で検証するが、この値は外から取得不可能なため GIDSignIn ベースでの修正は不可能と確定
- [x] **各種修正案をすべて試して全滅を確認**（Build 10〜14）— nonce なし / JWT decode / KVC nonce 抽出 / Supabase OAuth → いずれも失敗
- [x] **正解実装 `GoogleSignInHandler.swift` を作成**（未統合、削除済み） — `ASWebAuthenticationSession` でカスタム OAuth を実装。rawNonce 生成 → sha256Hex(rawNonce) を Google に渡す → rawNonce を Supabase に渡す → GoTrue 検証通過、という正しいフローを確認
- [x] **Build 15 でクリーン状態に切り戻し・masaiPhone にインストール済み** — `AuthService.swift` は nonce コード一切なし（GIDSignIn + signInWithGoogle(idToken:accessToken:) のみ）

## 完了タスク（2026-04-19: 28回目 GoogleSignInHandler 統合）

- [x] **⭐️ GoogleSignInHandler 統合・nonce 問題根本解決（Build 16）**
  - `Core/Services/GoogleSignInHandler.swift` 新規作成（ASWebAuthenticationSession + PKCE + rawNonce）
  - `AuthService.swift` 書き換え（GIDSignIn 完全除去、GoogleSignInHandler.shared.signIn() に）
  - `LoginView.swift` 書き換え（GoogleSignInButton → 普通の Button）
  - `AMDOSApp.swift` 書き換え（GIDSignIn import/onOpenURL 削除）
  - `SupabaseService.swift` 更新（signInWithGoogle の accessToken を optional 化、currentUserEmail() 追加）
  - pbxproj に GoogleSignInHandler.swift を直接追加
  - Build 16、masaiPhone（iPhone 16 Pro）実機インストール・起動確認済み
  - 注: GoogleSignIn パッケージは project.yml/xcodeproj に残存（未使用だがビルドに影響なし）

## 完了タスク（2026-04-19: 29回目 UI刷新）

- [x] **⭐️ RoutineFlowView UI 完全書き直し・DesignSystem トークン体系整備**（設計詳細は `SPEC_ios_ui_design.md` 参照）
  - `DesignSystem.swift`: StatusToken構造体（bg/ink/solid 3軸）追加、AMD.textSub/textTertiary/textQuat/divider/bgDeep 追加
  - `RoutineFlowView.swift` 完全書き直し:
    - `AMDCapsule`（tone-aware pill）・`AMDStatusBadge`（6ステータス）新設
    - `HexShape`（AMDロゴ flat-top 六角形 カスタムShape）新設 → ウォーターマークに使用
    - ヒーローバナー: padding-based、cornerRadius 26、セグメント分割プログレスバー、hex×2、11pt UPPERCASE eyebrow
    - タイトルエリア: 11pt UPPERCASE クライアント名 + 28pt bold tracking-0.6 プロジェクト名
    - タイムライン行: 44pt左カラム + leading 8pt + HStack spacing 6 + 0.5pt divider
    - バッジ: done/warn/overdue = tint背景+dark ink（ソリッドはcurrentのみ）
    - overdue カラーをオレンジ系（`#FFF0E0`/`#8B3000`）に確定（赤なし）
  - Build 16、masaiPhone（iPhone 16 Pro）実機インストール・動作確認済み

## 完了タスク（2026-04-21: 30回目 マイページ「今月の活動」）

- [x] **⭐️ マイページに「今月の活動」セクション追加（Build 17）**
  - Supabase migration: `20260421_member_activities.sql`
    - `monthly_reports.section_members` TEXT カラム追加
    - `member_activities` テーブル新設（RLS付き）
  - GAS `R012_SupabaseSync.js`: `sb_syncMonthlyReport_` に `section_members` 同期追加 → v15デプロイ済み
  - iOS 4ファイル変更:
    - `MyPageModels.swift`: `MyPageProject.sectionMembers: String?` 追加
    - `SupabaseService.swift`: `monthly_reports` クエリ追加・`MonthlyReportRow` struct追加
    - `MyPageView.swift`: `codeName` を `ProjectRewardCard` に渡すよう変更
    - `ProjectRewardCard.swift`: 「今月の活動」セクション追加（`extractMemberSection` ヘルパー: `### {codeName}` パターンで自分の部分を抽出）
  - Build 17、masaiPhone インストール・起動確認済み
  - **注**: section_members は GAS が月次レポート生成時に書き込む。まだデータがないためマイページ上は空表示。GASでレポート生成後に表示される

## 残タスク（次セッションの最初にやること）

### 次セッションの主題
- [ ] **月次モーダルでの報告書編集** — 現状は `MonthlyModal` の `reportTab` で報告書本文を表示するだけ。アプリ内で編集→保存（`monthly_reports.final_content` upsert + status 更新）まで対応する。GAS の `pwa_fixMonthlyReport_` / `312_MonthlyReport_FixApi.js` を参考にロジック移植
  - 関連: `AMDOS/Features/Cockpit/MonthlyModal.swift`, `AMDOS/Core/Services/SupabaseService.swift` の `fetchMonthlyReport` 周辺

### バックログ
- [ ] **`dailySync_setupTrigger()`（802_DailySyncToSheets.js）手動実行** — まさがGASエディタから1回実行。毎朝03:00 JST の Supabase→スプシ同期トリガーを登録する
- [ ] **Edge Function `collect-member-activities` 新設**（前 30回目から） — L2として生データから各メンバーの活動をSupabase `member_activities` テーブルに抽出するcron。今は `attribute-ms-activity` で代用できているので緊急度低
- [ ] **きよの実機動作確認** — TestFlight 0.1.0(19) でアプリが正常に動くか確認してもらう
- [ ] **ProjectListView 等への DesignSystem 統一適用**（Phase 3、後回しOK）

### 30回目から引き続き
- 完了：マイページ「今月の活動」 (`section_members`) は表示まで実装済み。GAS が month report 生成後にデータ反映される

## 完了タスク（2026-04-15: 26回目 マイページ）

- [x] **マイページ Phase 1 実装完了** — 設計詳細は `SPEC_mypage.md` 参照
  - 新規ファイル: `MyPageModels.swift` / `MyPageView.swift` / `ProjectRewardCard.swift`
  - 変更ファイル: `MainTabView.swift`（1番目タブ追加）/ `SupabaseService.swift`（`fetchMyPageData(email:)` 追加）
  - データ源泉: `members` / `project_members` / `projects` / `billing_cycles` / `value_plan_cycles` / `value_milestones` / `milestone_monthly_progress` をiOS直接クエリで組み立て（Edge Function不要）
  - 報酬額は `billing_cycles.member_allocations_json[myMemberId]` を正本
  - 過去6ヶ月 + 当月表示、当月のみデフォルト展開
  - ビルド成功・masaiPhone実機インストール済み
  - **xcodegen 再生成が必要だった**（新規 `Features/MyPage/` ディレクトリ追加のため）

## 完了タスク（2026-04-15: 25回目）

- [x] **meeting-slots Edge Function → Google Calendar API直接連携** — GAS中継を完全廃止
  - FreeBusy API直接呼び出し（masa + kyoko + PM）
  - 日本の祝日カレンダー（`ja.japanese#holiday@...`）も自動チェック
  - 13-18時優先 / フォールバック9-20時のロジックはGASと同等
  - E2Eテスト成功（空き枠一覧を正常取得確認）
- [x] **schedule-meeting Edge Function → Google Calendar API直接連携** — GAS中継を完全廃止
  - 既存イベントがあればPATCH（人間メモ保持）、なければINSERT（Google Meet自動生成）
  - 完了後 Supabase `billing_cycles` を直接更新
- [x] **Google OAuth2 credentials 取得 → Supabase secrets 設定**
  - 使用クレデンシャル: `AMD_OS/gas-dev/creds.json`（project: amd-os-gcp）
  - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REFRESH_TOKEN` を supabase secrets に設定済み
  - scope: `https://www.googleapis.com/auth/calendar`
- [x] **きよ TestFlight参加完了** — 外部テスターグループで招待、プライベートApple IDで参加成功

## 残タスク

- [x] **⭐️ GoogleSignInHandler 統合（nonce 根本解決）** — Build 16 完了
- [ ] **マイページ実機確認** — masaのiPhoneで表示確認。PJ一覧・報酬額・MS進捗が正しく出るか
- [ ] **マイページ Phase 2**: `sub_item_responsibilities` / `milestone_responsibilities` Supabase移行 → per-MS myShare 表示（詳細は `SPEC_mypage.md`）
- [ ] **`dailySync_setupTrigger()`（802_DailySyncToSheets.js）手動実行** — まさがGASエディタから1回実行。毎朝03:00 JST の Supabase→スプシ同期トリガーを登録する
- [ ] **きよの実機動作確認** — TestFlight 0.1.0(3) でアプリが正常に動くか確認してもらう


---

## プロジェクト概要
- **目的**: AMD OS（GAS製）の月次ルーティンをiOS nativeアプリとして完全移植
- **開発フォルダ**: `claude/AMD_OS/amd-os-ios/`
- **Bundle ID**: `jp.team-armada.amdos`
- **App ID（App Store Connect）**: `6762036924`
- **DEVELOPMENT_TEAM**: `9AH24QT45T`（asahina.ic@gmail.com）
- **GAS本体 exec URL**: `https://script.google.com/macros/s/AKfycbx4IgBEjrP8Ov-e5PhGi_3Z5-WOoEKCyNV-7S6s4iksto0qwD3c_fKiwJ-l4xn0zgir/exec`

---

## 完了タスク（このセッションまで）

- [x] Xcodeプロジェクト生成（xcodegen）
- [x] GASApiClient.swift（pwaApi GETクライアント）
- [x] ProjectListView（アクティブPJ一覧 → RoutineFlowViewへ遷移）
- [x] RoutineFlowView（8ステップ表示、状態色分け: done/current/warn/overdue/future/deferred）
- [x] RoutineModels.swift（8ステップ対応: id/label/status/done/doneAt/deadline/href/action/deferred）
- [x] AppIcon生成・CFBundleIconName追加
- [x] App Store Connect登録・TestFlightアップロード成功（v1370）
- [x] 実機（iPhone 16 Pro）インストール確認済み
- [x] GAS PWA API `routineFlowFull` デプロイ（v1370）
- [x] **Step 1「予算確定」ネイティブSheet実装**
  - GAS `099_PwaApi.js` に `billingBudget` / `reportBudget` アクション追加
  - `RoutineModels.swift` に `BillingBudgetData` / `ReportBudgetResult` 追加
  - `BudgetStepView.swift` 新規作成（承認済み/申告済み/未申告の3パターンUI）
  - `RoutineFlowView.swift` の `budget` タップで Sheet 表示（`bizYm` も渡す）
  - GAS v1371 デプロイ済み（既存iOS用URL維持）
  - iPhone 16 Pro 実機インストール済み
- [x] **全ステップ行タップ範囲修正**（`.contentShape(Rectangle())` 追加）
- [x] **StepSheetをenumで統合**（budget/meeting を `activeSheet: StepSheet?` で管理）
- [x] **Step 2「報告会日程調整」ネイティブSheet実装**
  - GAS `099_PwaApi.js` に `meetingSlots` / `scheduleMeeting` アクション追加
  - `RoutineModels.swift` に `MeetingSlot` / `MeetingSlotsData` / `ScheduleMeetingResult` 追加
  - `MeetingStepView.swift` 新規作成（3パターン: 確定済み表示 / スロット選択 / 空き枠なし）
  - done+hrefはCalendar URL直接open、それ以外はSheet
  - スロット選択→確認Dialog→`scheduleMeeting`API→dismiss
  - GAS v1372 デプロイ済み・iPhone 16 Pro 実機インストール済み
- [x] **タップ範囲を完全修正**（Button→`onTapGesture`に切り替え。List内ではcontentShapeがButtonに効かない問題を根本解決）
- [x] **Step 3「月次報告書FIX」ネイティブSheet実装**（GAS v1374）
  - GAS `099_PwaApi.js` に `monthlyReport` / `fixReport` アクション追加
  - `monthlyReport` → `api_getMonthlyReport(projectId, ym)` を呼び、レポート本文を返す
  - `fixReport` → `pwa_fixMonthlyReport_()` で `DB_BillingCycle.monthlyReportFixedAt` にタイムスタンプ記録
  - `RoutineModels.swift` に `MonthlyReportData` / `MonthlyReportContent` / `FixReportResult` 追加
  - `ReportFixStepView.swift` 新規作成（レポート本文表示 ＋「レポートをFIXする」ボタン）
  - `RoutineFlowView.swift` の `reportFix` ステップタップで Sheet 表示（`StepSheet.reportFix` 追加）
  - レポート未生成時は「まだレポートが生成されていません」を表示
  - FIX済みの場合は「確定済み」バッジ表示、FIXボタン非表示
  - iPhone 16 Pro 実機インストール済み
- [x] **Step 3「PCで内容を編集する」ボタン追加**（GAS v1375）
  - `requestReportEdit` アクション追加（`099_PwaApi.js`）
  - `pwa_requestReportEdit_(projectId, ym, email)`: DB_Members で email→slackId 照合 → `slack_postDm()` でDM送信
  - DM内容: PJ名・対象月・コックピットURL（`WEBAPP_BASE_URL?page=cockpit&projectId=...`）
  - iOS: `@EnvironmentObject var authService` から `currentUser?.profile?.email` を取得してAPIに渡す
  - ボタンUI: 「PCで内容を編集する（desktopcomputer icon）」→ 「レポートをFIXする」の順で縦並び
  - Slack DM送信成功でトースト表示、失敗はエラートースト
- [x] **つくよみ語調を敬語→タメ語に修正**（GAS v1376）
- [x] **Step 4「請求書発行」ネイティブSheet完全実装**（GAS v1377〜1382）
  - GAS `099_PwaApi.js` に `invoicePreview` / `issueInvoice` / `saveInvoiceDraft` アクション追加
  - `pwa_invoicePreview_`: `invoiceBaseLinesJson`→立替費→推奨日付（ym月末/翌月末）を返す
  - `issueInvoice`: `payload.allLines`（順序付き全行）を `api_issueInvoiceFreee` に直渡し
  - `saveInvoiceDraft`: 件名＋allLines を `DB_BillingCycle.invoiceBaseLinesJson` に保存（freee発行なし）
  - `007_FreeeInvoiceFlow.js`: `payload.allLines` で `body.lines` をUIの順序のまま上書き（テキスト行が正しい位置に入る）
  - `RoutineModels.swift` に `InvoicePreviewData` / `InvoiceBaseLine(type追加)` / `InvoiceReimbItem` / `IssueInvoiceResult` / `SaveInvoiceDraftResult` 追加
  - `InvoiceStepView.swift`: 件名・明細（品目行/テキスト行）・立替費・合計・日付・下書き保存・発行ボタン
  - 前月踏襲（fromPrevMonth バッジ）、DatePicker（翌月末＋休日調整デフォルト）
  - `RoutineFlowView.swift` の `StepSheet` に `.invoiceIssue` を追加
  - masaiPhone（iPhone 16 Pro）実機インストール済み
- [x] **Step 5「請求書送付」confirmationDialog実装**（GAS v1383）
  - GAS `099_PwaApi.js` に `markInvoiceSent` case + `pwa_markInvoiceSent_()` 追加
  - `pwa_markInvoiceSent_`: `DB_BillingCycle.invoiceSentAt` に nowIso を記録（`b_upsertRow_` 使用）、成功後キャッシュ無効化
  - `RoutineModels.swift` に `MarkInvoiceSentResult` 追加
  - `RoutineFlowView.swift`: `StepRowView` に `confirmationDialog`「請求書、送付した？」→「送付した」でAPI呼び出し
  - sheet不要、inline confirmationDialogで完結。成功後 `onSheetDismiss?()` でフロー再ロード
  - masaiPhone（iPhone 16 Pro）実機インストール済み
- [x] **Step 4 追加UX改善**（GAS v1381〜1382）
  - 明細行ドラッグ並び替え（`.onMove` + editMode スコープを linesSection のみに限定）
  - 左スワイプ＋長押し contextMenu で削除
  - キーボード: スクロールで自動非表示 + toolbarの「完了」ボタン
  - 発行済み情報セクション（請求書番号・発行日）+ 「発行を取り消す」ボタン
  - 取り消し後: DB フィールドリセット + PJチャンネルに Slack 通知
  - **バグ修正**: `b_updateCycle_`（存在しない関数）→ `b_upsertRow_` に修正
  - **バグ修正**: `isActuallyDone` 状態管理 + sheet `onDismiss` でフロー再ロード
- [x] **Calendar削除時の未完了復元**（GAS v1373）
  - `routineFlowFull` 呼び出し時に `pwa_fixDeletedMeetingSteps_` を自動実行
  - `CalendarApp.getEventById(eventId)` でイベント存在を確認
  - 削除済みなら `DB_BillingCycle` の `meetingEventId`/`meetingStartAt`/`meetingStartAtJst`/`meetingHtmlLink` をクリア
  - 返却ステップオブジェクトも `done:false, status:"current"` に書き換えてiOSに未完了として返す
  - エラーは無視（メインレスポンスには影響しない設計）
- [x] **GAS完全廃止 + Supabase Edge Function化**（23回目）
  - **GASApiClient.swift 削除**（pwa GETクライアント全廃）
  - **RoutineFlowView**: `cockpitURL` をインラインの `makeCockpitURL()` ローカル関数に置き換え
  - **MeetingStepView**: `loadSlots` / `confirmSchedule` → `callEdgeFunctionGET("meeting-slots" / "schedule-meeting")`（GAS中継Edgeとして暫定デプロイ）
  - **ReportFixStepView**: `loadReport` → `SupabaseService.fetchMonthlyReport()`（monthly_reports直読み）、`requestEditOnPC` → `callEdgeFunction("send-slack-dm")`
  - **InvoiceStepView**: `loadPreview` → `SupabaseService.fetchInvoicePreview()`、`saveDraft` → `saveInvoiceDraft()`、`issueInvoice` → `callEdgeFunction("issue-invoice")`、`cancelInvoice` → `callEdgeFunction("cancel-invoice")`
  - **billing_cycles に4カラム追加** (`invoice_base_lines_json`, `invoice_subject`, `freee_invoice_number`, `invoice_pdf_url`)
  - **Edge Functions 5本デプロイ済み**: `meeting-slots` / `schedule-meeting` / `send-slack-dm` / `issue-invoice` / `cancel-invoice`
  - **SupabaseService.swift に追加したメソッド**: `fetchMonthlyReport()`, `fetchInvoicePreview()`, `saveInvoiceDraft()`, `callEdgeFunction()`, `callEdgeFunctionGET()`, `markInvoiceSent()`, `confirmPayoutNotice()`, `confirmPayment()`, `markPayoutPaid()`
  - ✅ **SLACK_BOT_TOKEN** Supabase secrets 設定済み
  - ✅ **meeting-slots / schedule-meeting** Google Calendar API 直接連携に置き換え完了（2026-04-15）
  - iPhone 16 Pro 実機インストール済み

---

## 月次ルーティン 8ステップ 実装仕様（GAS完全移植）

各ステップを**1セッション1ステップ**で実装する。

---

### Step 1: 予算確定（`budget`）
**GASアクション**: `bbmOpen(projectId, bizYm)`
**GASファイル**: `321_BillingBudgetModal.html`
**GAS API**: `billing_budget_api_getForModal({ projectId, ym })`

**iOS実装内容**:
- ステップタップ → ネイティブSheet表示
- Sheet内容:
  - プロジェクト名・対象月
  - 契約種別（月額固定 or 変動）・契約月額
  - ステータス別表示:
    - `budget_confirmed`: ✅ 承認済み（申告額・メンバー予算・承認日時）
    - `reported`: ⏳ 申告済み（申告額・申告日時・申告者）＋「修正する」ボタン
    - 未申告: 金額入力フォーム＋「申告する」ボタン
- **必要なPWA API追加**:
  - `billingBudget` → `billing_budget_api_getForModal({ projectId, ym })`
  - `reportBudget` → 申告処理（`billing_budget_api_report` 相当）

---

### Step 2: 報告会日程調整（`meeting`）
**GASアクション**: パターン分岐あり
**GASファイル**: `511_CockpitInvoice.html`

**iOS実装内容**（3パターン）:
1. **done + href あり** → `step.href` をSafariで開く（Google Calendar イベントURL）
2. **done + href なし** → ネイティブSheet:「📅 N月N日 HH:mm〜（30分）で確定済み🌙」
   - `step.action` = `"cpShowMeetingInfo('2026-04-10T01:00:00.000Z')"` からISO日時をparse
3. **未完了** → ネイティブSlot選択Sheet:
   - GAS APIで空き枠取得 → 一覧表示 → タップで会議登録
   - 「空き枠なし」時: 「直接カレンダーで調整してね」メッセージ
- **必要なPWA API追加**:
  - `meetingSlots` → `api_getMeetingSlots({ projectId, ym })`（`055_ProjectCockpit_Api.js`）
  - `scheduleMeeting` → `api_admin_forceSetMonthlyMeeting({ projectId, ym, startISO, endISO, _skipAdminCheck: true })`（`005_CalendarMonthly.js`）

---

### Step 3: 月次報告書FIX（`reportFix`）
**GASアクション**: `cpOpenModalToTab(bizYm, 'report')`
**GASファイル**: `505_CockpitReport.html`, `301~313_MonthlyReport_*.js`

**iOS実装内容**:
- 月次レポートの内容表示（Notion/Slack/Gmail/Calendar/Driveからの集約データ）
- レポートサマリー表示（テキスト）
- 「レポートをFIXする」ボタン → `monthlyReportFixedAt` を記録
- **必要なPWA API追加**:
  - `monthlyReport` → レポート内容取得（`pwa_cockpitData_` 内の report フィールド相当）
  - `fixReport` → `312_MonthlyReport_FixApi.js` の fix処理を呼ぶ

---

### Step 4: 請求書発行（`invoiceIssue`）
**GASアクション**: `cpOpenInvoiceModal(bizYm)`
**GASファイル**: `511_CockpitInvoice.html`, `006_FreeeCore.js`, `007_FreeeInvoiceFlow.js`

**iOS実装内容**:
- freee API連携（OAuth済みトークンをGAS経由で利用）
- 請求書プレビュー（金額・品目）
- 「請求書を発行する」ボタン → freeeに請求書作成
- **必要なPWA API追加**:
  - `invoicePreview` → 請求書プレビューデータ取得
  - `issueInvoice` → `007_FreeeInvoiceFlow.js` の発行処理

---

### Step 5: 請求書送付（`invoiceSend`）
**GASアクション**: `cpOpenAdminBilling(projectId, bizYm)`
**GASファイル**: `013_InvoiceEmail.js`

**iOS実装方針（次セッション）**:
- 手動送付（PDF を手動でメール）のため、**確認ダイアログのみ**で実装
- タップ → 「送付した？」confirmationDialog → 「送付した」でチェック ON
- GAS: `markInvoiceSent` アクション → `DB_BillingCycle.invoiceSentAt` にタイムスタンプ記録
- `RoutineFlowView` の `StepSheet` に `.invoiceSend` 追加（または confirmationDialog を直接 StepRowView に実装）
- **必要なPWA API追加**:
  - `markInvoiceSent` → `invoiceSentAt = nowIso` を DB に記録（`b_upsertRow_` 使用）

---

### Step 6: 支払通知書確認（`payoutNotice`）
**GASアクション**: `cpOpenAdminPayouts(bizYm)`
**GASファイル**: `061_PayoutApi.js`, `062_PayoutRepo.js`

**iOS実装内容**:
- 支払通知書（PDF）の確認状況一覧
- 「確認済みにする」ボタン → `payoutNoticeUploadedAt` 記録
- **必要なPWA API追加**:
  - `payoutList` → 対象ym のPayout一覧
  - `confirmPayoutNotice` → 確認済み記録

---

### Step 7: 入金確認（`payment`）
**GASアクション**: `cpOpenModalToTab(nextYm, 'reward')`
**GASファイル**: `014_PaymentConfirm.js`, `053~060_Reward*.js`

**iOS実装内容**:
- 請求金額と実入金額の照合表示
- 「入金確認する」ボタン → `paymentConfirmedAt` 記録
- 報酬スコア確認（次月分の予算計算に連動）
- **必要なPWA API追加**:
  - `paymentStatus` → 入金確認用データ取得
  - `confirmPayment` → `paymentConfirmedAt` 記録処理

---

### Step 8: 報酬支払い（`payout`）
**GASアクション**: `cpOpenAdminPayouts(bizYm)`
**GASファイル**: `059_RewardV2_Ops.js`, `063_PayoutDomain.js`, `064_PayoutFreeeNotice.js`

**iOS実装内容**:
- メンバー別報酬金額一覧
- freee経由で振込実行 or 実行済みマーク
- **必要なPWA API追加**:
  - `payoutDetail` → 報酬明細取得
  - `executePayout` → 支払い実行 or 完了記録

---

## 現在のファイル構成

```
amd-os-ios/
├── project.yml                    ← xcodegen設定
├── AMDOS.xcodeproj/
└── AMDOS/
    ├── App/
    │   └── AMDOSApp.swift
    ├── Core/
    │   ├── Networking/
    │   │   └── GASApiClient.swift     ← pwaApi GETクライアント + cockpitURL()
    │   └── Models/
    │       └── RoutineModels.swift    ← 8ステップ + BillingBudgetData / MeetingSlotsData / MonthlyReportData
    ├── Features/
    │   ├── Home/
    │   │   └── MainTabView.swift      ← 2タブ（月次ルーティン・設定）
    │   ├── Routine/
    │   │   ├── ProjectListView.swift  ← アクティブPJ一覧
    │   │   ├── RoutineFlowView.swift  ← 8ステップ表示（StepSheet enumで統合）
    │   │   ├── BudgetStepView.swift   ← ✅ Step 1「予算確定」Sheet（3パターン）
    │   │   ├── MeetingStepView.swift  ← ✅ Step 2「報告会日程調整」Sheet（3パターン）
    │   │   └── ReportFixStepView.swift← ✅ Step 3「月次報告書FIX」Sheet
    │   └── Settings/
    │       └── SettingsView.swift
    └── Resources/
        └── Assets.xcassets/
            └── AppIcon.appiconset/   ← 濃紺アイコン（#1a2744）
```

## GAS側ファイルマップ（参照用）

| 機能 | GASファイル |
|---|---|
| PWA APIハンドラ | `099_PwaApi.js` |
| 予算確定モーダル | `321_BillingBudgetModal.html` |
| 請求書・会議スケジュール | `511_CockpitInvoice.html` |
| コックピットモーダル | `503_CockpitModal.html` |
| カレンダー会議登録 | `005_CalendarMonthly.js` |
| ルーティンフロー(8step) | `055_ProjectCockpit_Api.js` |
| 月次レポートAPI | `301_MonthlyReport_Api.js` |
| レポートFIX | `312_MonthlyReport_FixApi.js` |
| freee連携 | `006_FreeeCore.js`, `007_FreeeInvoiceFlow.js` |
| 請求書メール送付 | `013_InvoiceEmail.js` |
| Payout管理 | `061_PayoutApi.js`〜`066_PayoutPaidRepo.js` |

## 既知の問題・注意事項

### 認証（Auth）
- Google Sign-In 済み（`team-armada.jp` ドメインのみ許可）
- ログインユーザーのメールアドレス: `authService.currentUser?.profile?.email`（例: `masa@team-armada.jp`）
- `AuthService` は `@EnvironmentObject` で全 View からアクセス可能
- このメールを GAS API に渡せば `DB_Members` の `email` 列と照合して `slackMemberId` を取得できる

### その他
- `PWA_API_KEY` は未設定（GASエディタ保存エラーで保留）。GASがバリデーションをスキップするためMVPとして許容。
- GASデプロイはv1370（`clasp deploy`済み）。新しいAPIを追加したら必ず `clasp push --force` + `clasp version` + `clasp deploy` の3ステップを踏む。
- `clasp` のパスは `/usr/local/bin/clasp`、`node` は `/usr/local/bin/node`（PATHに含まれないため明示指定が必要）
- `GASApiClient` は `actor`。`baseURL` と `cockpitURL()` は `nonisolated` にしてある

## 完了タスク（2026-04-11: Supabase 移行セッション）

### Supabase 全データ移行（Phase 1〜2 完了）
- **全テーブル移行完了**: members(28)・projects(22)・project_members(25)・billing_cycles(126)・value_milestones(136)・milestone_monthly_progress(122)・milestone_sub_items(138)・monthly_reports(58)・tasks(13)・tsukuyomi_context(45)・tsukuyomi_memory(45)・source_cache(2613)・project_knowledge(2024)
- **migration方法**: `clasp run` が API executable 未設定のためエラー → 099_PwaApi.js に一時エンドポイントを追加して curl で実行（完了後削除済み）
- **iOS: supabase-swift SDK 追加** (`project.yml`: packages に `Supabase: from 2.0.0` 追加)
- **iOS: SupabaseService.swift 新規作成** (`Core/Services/SupabaseService.swift`): service_role key で直接接続、`fetchActiveProjects()` 実装
- **iOS: ProjectListView を Supabase 直接接続に切り替え**: GASApiClient の `listProjects` から `SupabaseService.shared.fetchActiveProjects()` に変更
- **GAS: 802_DailySyncToSheets.js 新規作成・デプロイ済み（v1393）**: Supabase → スプシ毎日同期。`dailySyncSupabaseToSheets()` が全13テーブルをスプシに書き戻す
- **実機インストール済み**: iPhone 16 Pro（UDID: 22F6F889-985D-5CAF-AFF3-D50D5E80FFA0）

### ⚠️ 手動実行が必要なこと（えいみが物理的にできない）
1. **GASエディタから `dailySync_setupTrigger()`（802_DailySyncToSheets.js）を一度だけ手動実行** → 毎朝03:00 JSTの自動トリガーが登録される

### パフォーマンス改善: 2層キャッシュ実装（Phase 0 完了）
- **根本原因確認**: iOS → GAS（コールドスタート 5〜20秒）→ スプシ（毎回全行読み取り）。Supabase は現時点で未接続。
- **iOS 側新規ファイル/変更**:
  - `Core/Services/CacheService.swift` 新規作成（UserDefaults + TTL ベースの actor キャッシュ）
  - `GASApiClient.swift`: `get(action:params:ttl:)` に TTL 引数追加。`invalidateCache()` 追加
  - `ProjectListView`: `listProjects` に TTL 600秒（10分）
  - `RoutineFlowView`: `routineFlowFull` に TTL 300秒（5分）
  - `BudgetStepView` / `MeetingStepView` / `ReportFixStepView`: 書き込み成功後に `routineFlowFull` キャッシュ無効化
- **GAS 側（099_PwaApi.js, v900 デプロイ済み）**:
  - `listProjects`: GAS CacheService 5分キャッシュ追加
  - `routineFlowFull`: GAS CacheService 5分キャッシュ追加（`pwa_routineFlowFull_{projectId}` キー）
  - `reportBudget` / `scheduleMeeting` / `fixReport`: 成功後にキャッシュ削除

### Supabase 移行計画策定
- 計画正本: `design_log/amd_os/2026-04_supabase_migration_plan.md`
- Phase 0（✅キャッシュ）→ Phase 1（スキーマ補完）→ Phase 2（初期移植）→ Phase 3（iOS 切り替え）→ Phase 4（PWA 切り替え）→ Phase 5（スプシ同期 Cron 03:00 JST）

---

## 現在の状態（2026-04-11 17回目終了時点）

### Supabase 移行フェーズ完了状況
| Phase | 内容 | 状態 |
|---|---|---|
| Phase 0 | iOS + GAS キャッシュ | ✅ 完了 |
| Phase 1 | billing_cycles スキーマ拡張（12カラム）| ✅ 完了 |
| Phase 2 | GAS → Supabase 全データ移行 | ✅ 完了（全13テーブル） |
| Phase 3 | iOS を Supabase 直接接続に切り替え | ✅ 完了 |
| Phase 4 | 書き込み操作の Supabase 直接書き込み化 | ❌ 未着手（GAS経由 + 012_SupabaseSync.js リアルタイム同期で代替中）|
| Phase 5 | Supabase → スプシ 毎朝03:00 JSTデイリー同期 | ✅ 完了（⚠️ GASエディタで `dailySync_setupTrigger()` を手動実行が必要） |

### iOS アーキテクチャ（現状）
- `ProjectListView` → **Supabase `projects` テーブル直接クエリ**
- `RoutineFlowView` → **Supabase Edge Function `routine-flow`**（GAS不要）
- 書き込み系（予算申告・会議登録・FIX・請求書・送付確認）→ **GAS経由** + `012_SupabaseSync.js` がリアルタイムでSupabaseに同期

## 立替精算ページ（別タブ）

- GAS v1399: `pwaListReimburse` / `pwaSaveReimburse` / `pwaUpdateReimburse` / `pwaDeleteReimburse` 追加（emailパラメータ受け取り版、Session.getActiveUser()不要）
- iOS: `ReimburseModels.swift` / `ReimburseListView.swift` / `ReimburseFormView.swift` 新規作成
- `MainTabView` に「立替」タブ追加（yensign.circle アイコン）
- GAS仕様そのまま: PJ選択・発生日・費目・金額・税率・摘要・交通費詳細（往復2倍）。自分の申請のみ表示。submitted のみ編集・削除可。
- レシート添付はスコープ外（base64がURLに乗らないため）
- masaiPhone（iPhone 16 Pro）実機インストール済み（v1399）

## 完了タスク（2026-04-12: 21回目 Supabase書き込み直接化 + 立替移行）

### routine-flow Edge Function 対応
- `RoutineFlowView.swift`: GASApiClient → `SupabaseService.shared.fetchRoutineFlow()` に切り替え済み
- `RoutineStep.isTappable`: サーバー返却の `isTappable` フィールドをデコード（GASフォールバック付き）
- `payoutNotice` を `tappableIds` に追加（Edge Function v4）

### 書き込み系 Supabase 直接化（Phase 4 完了）
- `markInvoiceSent` → `SupabaseService.markInvoiceSent(projectId:ym:)` でSupabase直接UPDATE
- `confirmPayoutNotice` → `SupabaseService.confirmPayoutNotice(projectId:ym:)` で直接UPDATE
- `fixReport` → `SupabaseService.fixReport(projectId:ym:fixedBy:)` で直接UPDATE
- `scheduleMeeting`（GAS） → Google Calendar登録後にSupabase PATCHも実行（`005_CalendarMonthly.js`）
- Step 6「支払通知書確認」confirmationDialog実装済み（`RoutineFlowView.swift`）

### reimbursements Supabase移行（完全移行）
- Supabaseに `reimbursements` テーブル新設（`billed_ym` カラム含む）
- 既存データ1件 → `temp_migrateReimbursements()`（801_SupabaseMigration.js）で移行済み
- iOS `ReimburseListView.swift`: GAS → `SupabaseService.fetchReimbursements(email:)` に切り替え
- iOS `ReimburseFormView.swift`: GAS → `SupabaseService.saveReimbursement / updateReimbursement` に切り替え
- 削除: `SupabaseService.deleteReimbursement()` で直接DELETE
- `ReimburseFormView` のPJ一覧も `SupabaseService.fetchActiveProjects()` に切り替え
- GAS `invoicePreview`: `reimburse_listApprovedForBilling` をSupabaseから読むよう更新（スプシフォールバック付き）
- GAS ウォームアップ: `MainTabView.warmUpGAS()` でアプリ起動時にpwaListReimburseをバックグラウンド呼び出し
- GAS CacheService: `pwaListReimburse` に2分キャッシュ追加（invalidate: save/update/delete時）
- GAS v1403 デプロイ済み
- iPhone 16 Pro 実機インストール済み

## 現在のアーキテクチャ（完全Supabase化）

| 機能 | 接続先 |
|---|---|
| PJ一覧 | Supabase `projects` 直接 |
| ルーティンフロー | Supabase Edge Function `routine-flow` |
| 書き込み系（markInvoiceSent等） | Supabase `billing_cycles` 直接UPDATE |
| 会議登録（scheduleMeeting） | GAS（Calendar API） + Supabase PATCH |
| 請求書発行（issueInvoice） | GAS（freee API）|
| 立替一覧/作成/更新/削除 | Supabase `reimbursements` 直接 |
| invoicePreview 承認立替算入 | Supabase `reimbursements` 読み込み |

## 完了タスク（2026-04-12: 23回目 予算申請フロー設計修正 + GAS参照削減）

### 予算申請フローの設計明確化
- **役割分担確定**: PM が「請求額・バッファ・PJ予算」を申請 → Admin は承認のみ
- `budget_buffer_amount` カラムを Supabase `billing_cycles` に追加（`add-billing-columns` Edge Function更新・再実行済み）
- `BudgetStepView.swift` 全面改修:
  - 請求額 + バッファ（任意）+ PJ予算（= 請求額×65%−バッファ）のフォーム
  - リアルタイムPJ予算プレビュー表示
  - 申告済み表示で 請求額/バッファ/PJ予算 を明示
  - **GAS完全除去**: loadData → `SupabaseService.fetchBillingBudget()` に切り替え
  - submit → `SupabaseService.submitBudgetReport()` のみ（GAS `reportBudget` 廃止）
- `BudgetApprovalView.swift` 改修: Admin側は読み取り専用（バッファ入力なし、承認ボタンのみ）
- `AdminModels.swift`: `budgetBufferAmount: Int?` を `BudgetPendingItem` に追加、`pjBudget(buffer:)` メソッド化
- `SupabaseService` 追加:
  - `fetchBillingBudget(projectId:ym:)` — Supabase直読み（billing_cycles + projects）
  - `submitBudgetReport(...)` — 予算申告をSupabaseに直接書き込み
- `temp_syncBillingCycleMissingFields()` 実行済み（126行同期 → `budget_reported_amount` 等が埋まった）

### GAS参照削減
- `MainTabView.swift`: `warmUpGAS()` 削除（Supabaseはウォームアップ不要）
- `MeetingStepView.swift`: `invalidateCache` 削除
- `InvoiceStepView.swift`: `invalidateCache` ×2 削除
- `BudgetStepView.swift`: GAS参照ゼロ（loadData・submit ともにSupabase直接）

### 残存GAS参照（外部API依存のため今セッションでは対応せず）
| 機能 | 理由 |
|---|---|
| MeetingStepView: meetingSlots / scheduleMeeting | Google Calendar API（GASがゲートウェイ）|
| InvoiceStepView: invoicePreview / issueInvoice / saveDraft / cancelInvoice | freee API（GASがゲートウェイ）|
| ReportFixStepView: monthlyReport / requestReportEdit | Google Drive / Slack（GASがゲートウェイ）|

## 完了タスク（2026-04-12: 22回目 Admin tab + Step7/8）

### Admin 4th タブ
- `AdminModels.swift` 新規: `BillingMatrixRow`, `BudgetPendingItem`, `matrixStepDefs` 等
- `AdminTabView.swift` 新規: NavigationStack + BillingMatrix / BudgetApproval リンク
- `BillingMatrixView.swift` 新規: 月別セクション × PJドット表示 → タップで `BillingCycleDetailSheet`
- `BudgetApprovalView.swift` 新規: 申告待ちリスト → 承認（65%計算は iOS 側で実施）
- `MainTabView.swift`: `.admin` タブ追加（`isAdmin` が true のときのみ表示）
- admin 判定: `["masa@team-armada.jp", "kyoko@team-armada.jp"]` の固定リスト

### SupabaseService 追加 (7関数)
- `isAdmin(email:)` — nonisolated
- `fetchAllVisibleProjects()` — active/ended/frozen 全取得
- `fetchBillingMatrix()` — 過去11ヶ月+来月の billing_cycles
- `updateBillingMatrixCell(...)` — URLSession PATCH（NSNull() で null 送信）
- `fetchBudgetPending()` — status="reported" 一覧
- `approveBudget(...)` — 65%計算して budget_confirmed_at を更新
- `confirmPayment(...)` / `markPayoutPaid(...)` — Step7/8 書き込み

### Step7 (payment) + Step8 (payout) — RoutineFlowView
- confirmationDialog 追加 (Step5/6 と同パターン)
- Edge Function v5: `reward_paid_at` を BillingCycle interface に追加、payout の doneAt に使用
- `tappableIds` に `"payment"` と `"payout"` を追加

### アーキテクチャ補足
- BillingMatrix の更新は全て Supabase 直接 REST PATCH（GAS 変更なし）
- BillingCycleDetailSheet: タップで done/undone/skip 切り替え → dismiss して親リロード
- meeting ステップのみ「スキップ」オプションあり（`canSkip: true`）

## 現在のアーキテクチャ（23回目終了時点）

| 機能 | 接続先 |
|---|---|
| PJ一覧 | Supabase `projects` 直接 |
| ルーティンフロー | Supabase Edge Function `routine-flow` |
| 予算申告/承認 | Supabase `billing_cycles` 直接 |
| 会議スロット取得 | Edge Function `meeting-slots`（→ GAS中継、暫定）|
| 会議登録 | Edge Function `schedule-meeting`（→ GAS中継、暫定）|
| 月次レポート取得 | Supabase `monthly_reports` 直接 |
| Slack DM送信 | Edge Function `send-slack-dm`（✅ SLACK_BOT_TOKEN設定済み）|
| 請求書プレビュー | Supabase 直接（billing_cycles + projects + reimbursements）|
| 請求書下書き保存 | Supabase `billing_cycles` 直接UPDATE |
| 請求書発行 | Edge Function `issue-invoice`（freee API）|
| 請求書キャンセル | Edge Function `cancel-invoice`（DB NULLリセット）|
| 書き込み系全般 | Supabase 直接 |
| 立替一覧/作成/更新/削除 | Supabase `reimbursements` 直接 |
| **GASApiClient** | **✅ 削除済み** |

## 完了タスク（2026-04-13: 24回目 TestFlight配布 + つくよみDM）

- ✅ **AMDOS 0.1.0(2) TestFlight アップロード** — Xcode Product → Archive → TestFlight Internal Only で Upload完了
- ✅ **つくよみbotに `mpim:write` スコープ追加** — api.slack.com/apps/A0A5Z2UETQD で Bot Token Scopes に追加 → Reinstall to Workspace（まさが実施）
- ✅ **つくよみ名義でまさ・きよ・つくよみの3人DMにインストール案内送信** — AMD-Slack GAS S999の `temp_sendTestFlightGuideToKiyo()` を実行
- ✅ **App Store Connect きよ招待** — Internal Testing に kyoko@team-armada.jp を追加（まさが実施）
- ✅ **フィードバックメモリ追加** — 「制約があっても短絡的に無理と言わない」

## 次のアクション（推奨）
1. **きよのTestFlight動作確認**（きよの反応待ち。インストール → ログイン → ルーティン表示できるか）
2. **send-payout-notice E2Eテスト** — Edge Function → GAS `generateAndSendPayoutNotice` → PDF生成 → メール送信の一連フロー未テスト
3. **gas-main push確認** — `099_PwaApi.js`（generateAndSendPayoutNotice追加）と `801_SupabaseMigration.js`（member_name等追加）が gas-main に push済みか確認
4. GASエディタで `dailySync_setupTrigger()`（802_DailySyncToSheets.js）を実行してトリガー登録（積み残し）
5. **meeting-slots / schedule-meeting** を Google Calendar API 直接連携に置き換え（GAS中継を廃止）
6. 必要なら Payout Table ビュー（メンバー別報酬確認）を Admin タブに追加
