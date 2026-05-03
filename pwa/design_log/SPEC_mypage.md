# SPEC: マイページ（iOS AMD OS）

## 目的

ログインユーザーが「自分が関わる全PJの当月業務と報酬」を一覧で確認できる画面。
全PJの報酬額合計 = 当月発行される支払通知書の額 と一致する。

## 設計哲学

- **member_allocations_json が正本**: 報酬額の計算はGAS `rv2_calcRewardSummary` が正本で、結果は `billing_cycles.member_allocations_json[memberId]` に格納されている。iOS側で再計算しない
- **Supabase直接クエリ**: Edge Functionは作らず、既存パターン（`fetchInvoicePreview` 等）に合わせてSupabaseServiceからマルチテーブルクエリで組み立てる
- **過去はトグル折りたたみ**: 当月のみデフォルト展開、前月以前はChevronタップで展開

## 確定事項

### 表示範囲
- **過去6ヶ月 + 当月**（計7ヶ月分）
- 進捗計算用の前月データのため `milestone_monthly_progress` は7ヶ月分（当月〜6ヶ月前 +1ヶ月）取得

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

### AllocationStatus 判定ロジック
- `allocation_confirmed` / `budget_confirmed` → `.confirmed` ✅
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
| Phase 2 (myShare・内訳) | ❌ 未着手 |
| Phase 3 (グラフ・予測) | ❌ 未着手 |

## 知見

- **xcodegen 再生成が必須**: 新しいFeaturesサブディレクトリ（`Features/MyPage/`）を作った場合、`project.yml` の `sources: path: AMDOS` では新規ディレクトリが自動認識されるが、`.xcodeproj` に反映するには `xcodegen generate` が必要。最初のビルドで "cannot find 'MyPageView' in scope" エラーが出たのはこれが原因
- **AuthService.userEmail プロパティ**: `authService.currentUser?.profile?.email` より `authService.userEmail` の方が簡潔（linter が自動修正した）
