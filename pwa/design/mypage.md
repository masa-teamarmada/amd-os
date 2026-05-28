# SPEC: マイページ（iOS AMD OS）

## 目的

ログインユーザーが「自分が関わる全PJの当月業務と報酬」を一覧で確認できる画面。
全PJの報酬額合計 = 当月発行される支払通知書の額 と一致する。
ただし `ID006` / りりは NIMS からの無償出向メンバーなので、`/mypage` と `/dashboard` 埋め込み上の報酬額は金額ではなく `ー` と表示する。

## 設計哲学

- **member_allocations_json が正本**: 報酬額の計算はGAS `rv2_calcRewardSummary` が正本で、結果は `billing_cycles.member_allocations_json[memberId]` に格納されている。iOS側で再計算しない
- **Supabase直接クエリ**: Edge Functionは作らず、既存パターン（`fetchInvoicePreview` 等）に合わせてSupabaseServiceからマルチテーブルクエリで組み立てる
- **過去はトグル折りたたみ**: 当月のみデフォルト展開、前月以前はChevronタップで展開

## 確定事項

### 表示範囲
- **過去6ヶ月 + 当月**（計7ヶ月分）
- 進捗計算用の前月データのため `milestone_monthly_progress` は7ヶ月分（当月〜6ヶ月前 +1ヶ月）取得
- りり (`ID006`) は無償出向のため、当月合計・月別合計・PJ別報酬額を `ー` 表示にする。報酬計算キャッシュ自体は他メンバーやadmin集計との整合のためそのまま読む。

### データ源泉（すべてSupabase既存テーブル、追加migration不要）
| テーブル | 用途 |
|---|---|
| `members` | email → memberId 解決 |
| `project_members` (is_active=true) | 参加PJ一覧 |
| `projects` | project_name |
| `billing_cycles` | `member_allocations_json[myMemberId]` 報酬額 / status |
| `value_plan_cycles` (status='fixed') | アクティブプラン取得 |
| `value_milestones` (is_active=true) | MS一覧（title, points, tag） |
| `milestone_monthly_progress` | 月次進捗率 |
| `member_activities(source='member_weekly')` | Gmail / 共有メンバーカレンダー / source_cache / `project_meeting_summaries` から抽出した「今週やったこと」 |

### 「いまやること」生成ルール

- `/mypage` はログインユーザー個人の画面なので、月次ルーティンTODOは `project_members` の担当roleで絞る。
- `is_pm=true` のPJ: 請求額確定、報告会日程調整、報告書FIX、請求書発行/送付など、そのPJの月次ルーティンを表示する。
- `is_pl=true` かつ `is_pm=false` のPJ: PL承認対象である `請求額確定` だけを表示する。
- ただの参加メンバー (`is_pm=false` / `is_pl=false`) には、PJ参加中でも月次ルーティンTODOを出さない。admin全体確認は `/admin/*` で扱い、マイページには混ぜない。

### AllocationStatus 判定ロジック
- `budget_confirmed` → `.confirmed` ✅
- `allocation_confirmed` は旧DB値の読み取り互換だけ。新規書き込み・UI表示は `budget_confirmed` / `予算確定` に統一する。
- `reported` → `.reported` ⏳
- それ以外 or cycle無し → `.notSet`

### タブ配置
**1番目**（person.circle アイコン）。頻繁にアクセスする画面のため最左に配置。

## 却下した選択肢

| 選択肢 | 却下理由 |
|---|---|
| 新規Edge Function `my-page` 作成 | 既存パターン（iOS直接クエリ）と不統一。データ量も小さくメリット薄い |
| iOS側でptUnit・earnedPt再計算 | `rv2_calcRewardSummary` ロジックが複雑（cap処理・控除・routine自動進捗）。二重メンテ回避 |
| per-MS の myShare（コミット率）表示 | `sub_item_responsibilities` / `milestone_responsibilities` テーブルがSupabase未移行。Phase 2で対応 |

## Phase計画

### Phase 1（✅完了: 2026-04-15）
- マイページタブ新設
- PJ別報酬額（member_allocations_json正本）
- MS進捗バー（累積% + 当月増分）
- 過去6ヶ月トグル折りたたみ

### Phase 2（未着手）
- **per-MS myShare 表示**: `sub_item_responsibilities` / `milestone_responsibilities` をSupabaseに移行 → 「このMSで私は60%背負ってる」表示
- **earnedPt × ptUnit の内訳表示**: 「このPJでの私の獲得ポイント → 報酬額」の透明性
- **支払通知書との突合せ**: "全PJ合計 = ¥XXX,XXX（支払通知書額と一致）" バッジ
- **週次活動表示**: ✅ PWA先行で実装。`/api/cron/member-weekly-activities` がGmail / OSから読める共有メンバーカレンダー / source_cache / `project_meeting_summaries` を同一活動単位に束ね、複数の生データのつながりから「実務として何を進めたか」を `member_activities(source='member_weekly')` に保存する。CalendarのTODO/descriptionも根拠であり、議事録だけを優先しない。Gmailは `SENT` / `DRAFT` または社内メンバーが送信者のsource_cacheだけを活動扱いにし、受信しただけのメール・招集通知・メール本文全文は載せない。PJ判定はPJ専用/関係先email・PJ名・client名に加え、当面のPWA runtime mirrorとして `project_knowledge(category='alias', status='active')` を読むが、alias正本はGAS/Notion系で使う外部スプシ `CFG_PJAlias`。`project_knowledge(category='alias')` は正本ではなく、PWAがSupabaseだけで動くための暫定ミラー。OkuDoor / Okudoor / ZeMA は ZMP (`p19`) のaliasとして扱い、`奥ドア` 表記はactive aliasにしない。登録PJに一致しない一般の社内共同作業は、社内メンバー2名以上かつ共同作業語がある場合だけ AMD共通活動 (`p00`) として保存する。毎日18:00 JSTに、前日18:00〜当日18:00の24hを抽出し、`/mypage` は今週(月-日 JST)の行を表示する。
- **カレンダー共有はログイン時に必須**: Google Workspaceログイン時に `calendar.readonly` を必須scopeとして要求し、callbackでCalendar APIが読めることを確認する。未許可ならOSへ入れず、`members.google_calendar_status` を `missing/error` にする。ログイン成功時は `members.last_login_at` を更新し、既存セッションのまま使い続けるユーザーもmiddlewareが1時間に1回 `last_login_at` をtouchする。`/admin/members` で共有状態と最終ログインを確認できる。`info` / `つくよみ` などの非ログイン系アカウントはCalendar共有の対象外。
- 週次抽出cronは、「読むカレンダー」と「保存対象メンバー」を分ける。読むカレンダーは `google_calendar_status = connected` のメンバーに限るが、保存対象はactiveな人間メンバー全員（`info` / `つくよみ` 等のシステムアカウントは除外）。共有済みカレンダーや議事録の参加者emailに、未接続メンバー（例: うめ / あび）が含まれる場合、そのメンバーの `member_activities(source='member_weekly')` にも同じ活動を保存する。未接続メンバー本人のカレンダーは読めないが、他メンバーの共有カレンダー / `project_meeting_summaries` / `source_cache` に参加者として出ている活動はマイページに出る。
- マイページはadmin閲覧時のみ `/mypage?memberId=<member_id>` で他メンバーのページを表示できる。`member_id` は `members.member_id` の値をそのまま使い、例は `ID001`。`001` のように `ID` prefix を削らない。OS内の文章に出るメンバーコードネームは、共通UI `LinkedMemberText` で `/mypage?memberId=<member_id>` へのリンクにする。`/admin/members` の codeName セルはこのURLの基準リンクUI。

### Phase 3（アイデアレベル）
- 年間累積報酬グラフ
- PJ終了予定月までの見込み報酬予測

## 未決事項

- MS一覧は「PJ全体のMS」を表示中。「自分が担当するMSのみ」に絞るべきか？ → Phase 2でmyShareデータが入った時点で判断
- `value_plan_cycles` がないPJ（プラン未作成）の表示方針 → 現状はMS空配列。バッジで「プラン未作成」表示するか要検討

## 実装参照

### 新規ファイル
- `amd-os-ios/AMDOS/Core/Models/MyPageModels.swift`
- `amd-os-ios/AMDOS/Features/MyPage/MyPageView.swift`
- `amd-os-ios/AMDOS/Features/MyPage/ProjectRewardCard.swift`

### 変更ファイル
- `amd-os-ios/AMDOS/Features/Home/MainTabView.swift` — タブ追加（1番目）
- `amd-os-ios/AMDOS/Core/Services/SupabaseService.swift` — `fetchMyPageData(email:)` + `generateTargetYms()` / `currentYmString()` ヘルパー

### 関連GAS参照
- `gas-main/059_RewardV2_Ops.js` `rv2_calcRewardSummary` — 報酬計算の正本
- `gas-main/086_ValuePlanRepo.js` — DB_ValuePlanCycles / DB_ValueMilestones スキーマ

## 実装状態

| Phase | 状態 |
|---|---|
| Phase 1 (基本実装) | ✅ 完了（2026-04-15、実機インストール済み） |
| Phase 2 (myShare・内訳) | 🟡 一部完了（週次活動表示はPWA先行完了） |
| Phase 3 (グラフ・予測) | ❌ 未着手 |

## 知見

- **xcodegen 再生成が必須**: 新しいFeaturesサブディレクトリ（`Features/MyPage/`）を作った場合、`project.yml` の `sources: path: AMDOS` では新規ディレクトリが自動認識されるが、`.xcodeproj` に反映するには `xcodegen generate` が必要。最初のビルドで "cannot find 'MyPageView' in scope" エラーが出たのはこれが原因
- **AuthService.userEmail プロパティ**: `authService.currentUser?.profile?.email` より `authService.userEmail` の方が簡潔（linter が自動修正した）
