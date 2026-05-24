# PJ Status コックピット — 設計の正本

作成: 2026-05-06 (cool-booth-b72d09 セッション)
正本ステータス: 進化中。仕様変更したらここを同じ commit で更新する。

---

## ⚠️ 既存 UI を勝手に消すな (まさのルール)

**新セッションのえいみ / Claude が一番先に読むべきこと**:
- 既存ページのリンク、ボタン、セクションを「自分の判断で消す」のは絶対禁止
- 過去のセッションで追加された機能は、まさが意図して入れたもの
- 「シンプルにしたい」「不要そう」と思っても、**まさに確認してから消す**
- 既存 UI が壊れた / 消えたとまさが指摘したら、まず git log / diff で履歴を遡って復元

このルールは [`AGENTS.common.md`](../../../../AGENTS.common.md) の「回答と実装の基本姿勢」(「データ消失・既存導線の消失・未確認の機能削除を避ける」) を PWA に当てはめたもの。

---

## このページが扱う範囲

`/project/[projectId]/cockpit` 直下に追加された **PJ Status セクション** の全体構造。
SU 系 PJ (`project_ventures` 行が存在する PJ、現在 9 件) でのみ表示される。

---

## ページ構成 (全体像) — 案C レイアウト (2026-05-23 まさ確定)

旧構成は `max-w-[1060px]` で左メイン 720px + 右 sticky 220px の 2 カラムだった。コンテンツが増えてきたので、画面幅をフルに使う **案C レイアウト** に組み替えた。

### Hero の出し分け (PJ 別)

- **p00 (= AMD 会社全体)**: `CockpitManagementScoreHero` を Hero として表示。横軸 ym, 縦軸 0-100 の折れ線で AMD Management Score の `total_score` と 5 軸 (`initiative_score` / `finance_score` / `retention_score` / `pipeline_score` / `direction_score`) の時系列を見せる。右側に最新値カード。
- **SU 系 PJ (project_ventures あり)**: `CockpitVentureStatus` を Hero として表示。AMD Score 折れ線と XRL 折れ線が `xl:flex-row` で横並び。
- **ecosystem PJ**: `showAmdScore` が false なので Hero なし。
- **その他 dtsu PJ で project_ventures が無い場合**: CockpitVentureStatus が「PJ Status 未設定」表示でフォールバックする。

### p00 (= AMD 会社全体) の月次データ

p00 にも他 PJ と同じく月次カード + 月次モーダルが出る。`billing_cycles` は backfill 済 (= 202601-202612 で 12 行、`status='not_started'`)。月次モーダルでは進捗タブだけ意味があり、請求書 / 報酬は他 PJ の動作と同じ UI が出るが内容は空。`monthly_reports` は将来 cron / 手動で生成する。


```
/project/[projectId]/cockpit (CockpitView)
container: max-w-[1600px] mx-auto px-4 py-3 flex flex-col gap-3

[A]   CockpitHeader (full width)                PJ 名 / clientName / status chip
[A2]  CockpitVentureStatus (full width hero)    PJ Status — 内部で AMD Score chart と XRL chart を xl: 横並び
                                                ecosystem PJ は AMD Score 対象外で非表示

メインボード: grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_300px] gap-3
├── col1: 今期MS + 設定 + 過去
│   ├── [B]   CockpitGoalsCompact     今期 MS Gantt + 担当・割合
│   ├── [B2]  CockpitNextPeriodSetup  次期 MS 設定バナー / 直接編集
│   └── [B3]  過去の期間 (折りたたみ)
│
├── col2: 経営・事業シグナル (L2 ⑨)
│   └── [B1]  CockpitStrategySignals  candidate / confirmed をMS直下の上位ボードとして見せる
│
└── col3: 月次オペ (lg 以上で sticky top-12)
    ├── ステータスバッジ (凍結中 / 再開予定 など)
    ├── [R]   CockpitRoutineGas + canEditRoutine ガード
    │         ※ ended/lost/frozen の PJ では非表示
    └── [N]   CockpitNudge            つくよみ nudge キュー

下段: grid lg:grid-cols-2 gap-3
├── [G]  CockpitMonthlyList                       月次カード一覧
└── 縦 stack
    ├── [G0]  CockpitFreezeBackfill ⭐          休止期間サマリ (再開予定月以降のみ表示)
    └── [E]   CockpitMeetingSummary             MTG サマリ

最下: [C] CockpitKanbanGas (tasks.length > 0 のときだけ全幅で表示)
```

★ 2026-05-11 追加:
- **凍結/再開履歴**: `project_freeze_periods` が正本。`projects.freeze_from_ym` / `restart_expected_ym` は現在状態の表示用キャッシュ。CTB のように「202412で一度終了 → 再開 → 202605で再凍結」のような複数期間は `project_freeze_periods` に複数行で保存する。
- **CockpitFreezeBackfill**: `freeze_period_backfills` テーブルから `(project_id, freeze_from_ym, restart_ym)` を fetch、再開月以降に「📦 休止期間サマリ」パネルを MTGサマリの直上に表示。データソースは `cron/freeze-period-backfill` が休止期間中の monthly_reports + project_meeting_summaries を Sonnet で 400-700 字に統合
- **canEditRoutine prop** (= members.is_admin OR project_members.is_pm): false なら CockpitRoutineGas を `pointer-events-none opacity-60` で読取専用に。一般メンバーが月次ルーティンを誤操作しないようガード
- **タブタイトル動的化**: `/project/[projectId]/layout.tsx` の generateMetadata が `projects.project_name` → `project_ventures.display_name` 順で fallback して `<PJ名> - AMD OS` を返す

### 今期MSの表示対象

`CockpitGoalsCompact` のトップ表示は、原則として `currentYm` が `periodStartYm`〜`periodEndYm` に含まれる plan cycle を使う。

ただしMS進捗を扱うのは `projects.project_category in ('dtsu','ecosystem')` のPJだけ。advisorなど非MS管理PJではMSカード・過去MS・MS設定バナーを表示せず、月次モーダルの月次ノートに毎月の進捗を記録する。

例外として、現在月を含む cycle が存在せず、次に始まる future cycle が登録済みの場合は、その future cycle をトップ表示に使う。  
これにより、5月時点で6-9月の次期MSを先行入力したCXのようなケースでも、コックピット上で設定済みMSを確認できる。

### 経営・事業シグナル

今期MSリスト直下に `CockpitStrategySignals` を表示する。

- 正本L2: `project_strategy_signals`
- 詳細仕様: [`project_strategy_signals.md`](project_strategy_signals.md)
- 目的: MS進捗だけでは拾えない、経営上の重要方針・事業進捗・戦略転換・提携・リスク・次の一手を短く残す
- 表示対象: `status in ('candidate','confirmed')` を **3 カテゴリにグルーピング** して表示 (まさ #12 2026-05-24):
  - **🌐 外部環境の変化** = `ip_regulatory` / `risk` (= 規制・知財・競合・リスク。外から飛び込んできた変化)
  - **🧭 経営判断** = `management_decision` / `strategic_pivot` / `next_move` (= PJ の進路を決める方針。まさえいMTGで議論する候補)
  - **📈 事業進捗** = `business_progress` / `commercial_progress` / `partnership` / `funding` (= 提携・商談・資金・実装の実進捗)
  - 各カテゴリには色アクセント (sky/violet/emerald) と左ボーダーで視覚的に区別
- candidate は候補chipを付け、`/notifications` の「はい/いいえ」で confirmed/rejected にする
- 各シグナルカード右に「⚠️ つくよみに修正依頼」ボタン (まさ #11 2026-05-24)。`/api/notifications/feedback` (`l2_kind='project_strategy_signal'`) 経由で feedback を保存 + `tsukuyomi_learnings` に学習させる
- `signal_date` は **事象が起きた日** を使う (まさ #13 2026-05-24)。観測日 (= 議事録に出てきた日) ではなく、「4/27 にリアクター特許出願完了」のような事象発生日が正
- source refs は短い snippet / source id / hash のみ。全文は保存しない

### MS設計と報酬配分

MSは報酬配分の最小単位でもある。`milestone_responsibility.share` は「そのMSで進んだptを誰に配るか」なので、独立して進む成果物を1つのMSに混ぜると、未着手パートの担当者にも報酬が乗る。

- 1つの成果物が複数人共同で進む場合: 1MS + shareで表現する。
- 事業計画 / 資本政策 / 知財戦略のように、進捗が別々に確定する場合: 成果物ごとに別MSへ分ける。
- SX旧MS#1はこのルールにより、`事業計画策定` (かる70% / まさ30%)、`資本政策策定` (まさ100%)、`知財戦略策定` (ちこ80% / まさ20%) に分割済み。
- 年間MS設定では、各MSに `period_start_ym` / `target_ym` を持たせる。UI上は `MS開始` / `MS終了` として表示し、月次モーダル・HUDの期間表示もこのDB値を優先する。
- このUIは過去に消えた回帰が複数回あるため、PWAで年間MS設定を触るときは `npm run test:next-period-ui` を必ず通す。

---

## CockpitVentureStatus の中身

```
┌────────────────────────────────────────────────────────────┐
│ Header (全要素クリックで CockpitVentureMetaEditModal)      │
│  - emoji (outcome) / PJ 名 / lane chip / outcome chip      │
│  - 設立日 / origin_org / origin_pi                         │
│  - [📜 沿革] [👥 メンバー] [🧑‍🤝‍🧑 創業] [🤝 事業会社] [📊 試算表] │
│  - AMD score chip (クリックで CockpitAmdScoreBreakdownModal)│
│                                                              │
│ short_description (クリックで CockpitDescriptionDetailModal)│
│                                                              │
│ Chart 1: AMD スコア折れ線                                   │
│  - 横軸 = データ実 min/max ± 6%                            │
│  - 縦軸 = -100 〜 +100                                      │
│  - イベントドット (kind 別色)、空白タップで新規イベント追加│
│  - ドットタップで CockpitVentureStatusEditModal             │
│                                                              │
│ Chart 2: XRL 折れ線 (TRL/BRL/HRL)                          │
│  - 各ドットは axis ごと (TRL/BRL/HRL) に独立 onClick        │
│  - ドット直径 r=12 (proposal r=15) で大きく                │
│  - 確定ドット → CockpitXrlDetailModal (axis 個別の詳細)    │
│  - LLM proposal ドット → 採用 / 却下 banner                │
│  - 「LLM 判定は毎朝 03:15 cron」の文言あり (ボタン無し)    │
└────────────────────────────────────────────────────────────┘
```

`project_ventures` 行が無い PJ では何も表示しない (= 通常の cockpit のまま)。

---

## モーダル一覧

| Modal                            | 開き方                                    | 用途                                                                 |
|----------------------------------|------------------------------------------|----------------------------------------------------------------------|
| CockpitVentureMetaEditModal      | Header 各要素タップ                      | display_name / lane / founded_at / outcome / AMD 支援期間 / origin / 概要 |
| CockpitVentureStatusEditModal    | AMD スコアチャート空白 / ドットタップ    | イベント追加・編集 (自由文 + Gemini 構造化)                          |
| CockpitMembersModal              | 👥 メンバー                              | project_venture_members 編集 (member_kind: amd_internal / su_internal / support_org) |
| CockpitFoundingMembersModal      | 🧑‍🤝‍🧑 創業                                | project_founding_members 表示。**関連メンバー (HRL評価のベース)** として運用。対象は `category='amd'` (= AMD code_name 一致) と `category='startup'` (= 該当SU 社員 / 創業候補) だけ。大学・研究機関 / VC / 顧客 / 行政 / 産業パートナーは HRL根拠外として `status='invalid'` 化する。AMDメンバーは `members.code_name` で記録 (フルネーム / 姓のみ表記は重複として invalid)。つくよみ修正依頼UIから追加・修正・invalid化を依頼できる。HRL 簡易推定 (ルールベース 0-9、`amd`+`startup` のみで算出) を末尾表示。詳細は [`xrl_evidence.md`](xrl_evidence.md) |
| CockpitPartnersModal             | 🤝 事業会社                              | project_partners (collab / customer)                                 |
| CockpitPlMonthlyModal            | 📊 試算表                                | project_pl_monthly 縦横ピボット表示 + 直接入力                       |
| CockpitPlHearingModal            | 試算表内「✨ つくよみとヒアリング」      | Sonnet が質問→回答→月次 PL 36ヶ月生成 → upsert                       |
| CockpitDescriptionDetailModal    | short_description タップ                 | long_description 編集 + 自由文追記 + Sonnet マージ                   |
| CockpitNarrativeModal            | 📜 沿革                                  | リスト形式 (年月+一行+詳細)、行 ✏ で修正依頼                          |
| CockpitNarrativeFeedbackModal    | 沿革モーダル内 ✏                         | フィードバック → 即時 Gemini 再生成 + Sonnet lesson 抽出             |
| CockpitXrlDetailModal            | XRL ドットタップ (axis 別)               | 軸個別の値・評価理由 (`source_note` の JSON) 表示 + Gemini 修正依頼  |
| CockpitAmdScoreBreakdownModal    | AMD score chip タップ                    | スコア計算式 + 各パラメータの内訳                                    |

---

## データモデル (Supabase)

```
projects (既存)
  └─ project_ventures   (project_id PK FK to projects.project_id)
       lane / founded_at / outcome_pattern / origin_org / origin_pi /
       amd_role / short_description / long_description /
       amd_support_started_at / amd_support_ended_at /
       narrative_text (JSON 配列文字列) / narrative_generated_at / narrative_invalidated_at
       └─ project_xrl_log
       └─ project_events           (kind: hire / funding / deal / tech_progress / governance / xrl_obs / amd_score_override / note)
       └─ project_venture_members  (member_kind: amd_internal / su_internal / support_org, amd_member_id FK)
       └─ project_partners         (partner_type: collab / customer)
       └─ project_pl_monthly       (UNIQUE(project_id, ym))
       └─ project_pl_hearings      (q_a jsonb + generated_pl)
       └─ narrative_feedbacks      (沿革修正依頼)
       └─ xrl_feedbacks            (XRL 修正依頼)

つくよみ学習・履歴
  - tsukuyomi_learnings_status (scope, target_project_id, lesson_text, source_feedback_id)
       admin/tsukuyomi で memory layer に統合表示
  - tsukuyomi_chat_logs (session_id, page_path, role, content, applied_actions)
       マスコットチャット履歴
```

migrations: `pwa/scripts/migrations/008_project_ventures.sql` 〜 `012_xrl_feedback_chat.sql`

---

## API ルート

### つくよみ系
| Path                                                        | 用途                                               |
|-------------------------------------------------------------|----------------------------------------------------|
| `/api/project-events/parse`                                 | event 自由文 → Gemini で kind 別 schema に構造化   |
| `/api/project-ventures/[id]/description-merge`              | Sonnet (system: つくよみ) が概要に追記をマージ。`web_search` tool 利用可 |
| `/api/project-ventures/[id]/narrative-regen`                | 沿革を 1 PJ だけ即時再生成 (cron と同じ lib)       |
| `/api/project-ventures/[id]/xrl-revise`                     | Gemini が axis 別 reason 込みで XRL を再評価       |
| `/api/project-ventures/[id]/pl-hearing/turn`                | Sonnet と試算表ヒアリング 1 ターン                 |
| `/api/tsukuyomi/chat`                                       | マスコット会話 + tool use (update_short_long_description / invalidate_narrative / record_xrl_feedback / web_search) |

### Cron (vercel.json)
| Path                                | UTC schedule | JST     | 用途                                                            |
|-------------------------------------|-------------|---------|-----------------------------------------------------------------|
| `/api/cron/venture-xrl-refresh`     | `15 18 * * *` | 03:15 daily | 差分があれば全 SU 系 PJ で Gemini 判定 → llm_proposal 挿入 |
| `/api/cron/venture-narrative-refresh` | `45 18 * * *` | 03:45 daily | invalidated > generated の PJ で Gemini 沿革再生成 + Sonnet lesson 抽出 |

---

## つくよみマスコットチャット (右下クリック)

- 右下マスコットクリック → 吹き出し風の小ウィンドウ (右下から上に出る、マスコット本体は隠れない)
- 会話状態は **localStorage に保存** (`tsukuyomi_chat:v1:<projectId or no_project>`)
  - ブラウザを閉じても、別タップしても、再開時に履歴復元
  - 「新しい会話」ボタンで明示リセット (履歴は admin/tsukuyomi に残る)
- 各ターンで `/api/tsukuyomi/chat` に投げる:
  - URL から projectId 抽出 (cockpit / venture-map/su)
  - その PJ の全 context (venture/xrl/events/members/partners/PL/narrative) を Sonnet に渡す
  - Sonnet が tool 呼ぶ (修正適用) + assistant text を返す
  - 全会話 + applied actions を `tsukuyomi_chat_logs` に保存
  - 修正系発話は `narrative_feedbacks` にも複製 (admin で一覧できるように)

---

## AMD スコア (現状ダミー)

```
score(t) = {
  Before 0 (founded > today): 線形補間 (-100 [5年前] → 0 [設立日])
  After 0  (founded ≤ today): min(100, ((TRL+BRL+HRL)/27)*60 + Σ event_bonus(kind))
}

event_bonus: hire +3 / funding +8 / deal +5 / tech_progress +4 / governance +2 / その他 0
```

正本式は [`/Users/masa/projects/knowledge/before_zero_theory.md`](../../../../knowledge/before_zero_theory.md) で別セッション議論中。確定したら `lib/venture-status-data.ts:computeAmdScoreSeries` と `:computeAmdScoreBreakdown` を差し替える。

---

## 学習ループ (まさ → つくよみ → 全 PJ に反映)

1. **沿革モーダル**で項目右の ✏ → CockpitNarrativeFeedbackModal で修正内容 textarea
2. submit → `narrative_feedbacks` に open で保存 + 即時 `/api/.../narrative-regen` 叩く
3. lib `narrative-refresh.ts` `refreshNarrativeForProject()` が:
   a. open feedbacks + 学習ルール (general + per-PJ) を Gemini プロンプトに注入
   b. 沿革を再生成
   c. Claude Sonnet が feedback から lesson 抽出 (general / individual)
   d. `tsukuyomi_learnings_status` に保存 (scope='narrative', target_project_id NULL=全 PJ 共通)
   e. feedback を applied 化
4. 次回以降の沿革生成・つくよみ会話に general lesson が自動注入される
5. admin/tsukuyomi の `🧷 記憶` (memory) layer に `pj_status:narrative` source で表示

XRL も同パターン (`xrl_feedbacks` → `/api/.../xrl-revise` → cron `/venture-xrl-refresh` でも反映)。

---

## 既存 UI を消したケース (反省)

- 2026-05-06 セッション後半で `CockpitHeader` に独断で `⚙️ config` リンク (→ /admin/projects) を追加。「PJ 台帳に飛ぶ」ためまさに却下された。2026-05-22時点でもコックピットから `/project/[projectId]/config` へ飛ぶ導線は置かない。CockpitHeader は **PJ 名 + clientName + status chip だけのシンプル構成**、PJごとの契約・請求・支払条件は `/admin/projects` が正本。
- **教訓**: 「過去にあったリンクの復活」を頼まれたとき、`git log -S` で履歴を確認せず推測で実装すると、まったく別のものを「復活」してしまう。今後は git history から確実に復元するか、まさに飛び先を確認してから追加する。

---

## 開発時の流れ

```
コード変更 → tsc --noEmit → next build → commit → push (branch + main) → Vercel deploy
                                                       ↓
                            DDL 変更があれば applyDDL.py で先に適用
```

詳細は [`SPEC_pwa.md`](SPEC_pwa.md) の「8. 運用コマンド」参照。

---

## Project Category

`projects.project_category` は status と別軸のPJ分類。契約状態ではなく、AMD OS上でどう扱うかを決める。

| value | 意味 | AMD Score |
|---|---|---|
| `dtsu` | 通常のDTSU伴走PJ | 対象 |
| `ecosystem` | 研究機関のSUエコシステム構築業務 | 対象外 |
| `advisor` | まさが社外取締役/経営顧問として入るPJ | 対象 |

- KUTE (`p25`) は `ecosystem`。工学院大学のSUエコシステム構築であり、特定SUのAMD Scoreは付けない。
- LST (`p07`) は `advisor`。AMDとしての契約が終了していても、まさ個人として関与が続くため、source/backfill系では対象に含める。
- cockpit header と `/admin/projects` に分類を表示する。
- `amd-score-l2-refresh` は `ecosystem` をskipする。

## 関連メンバー (旧 Founding Members)

`project_founding_members` はL2 ⑧ XRL根拠のうち、HRL評価のベースとなる **関連メンバー** 台帳。

### 表示対象 (まさ判断 2026-05-22)

- `category='amd'`: AMD の伴走メンバー (`members.code_name` に一致した人物)
- `category='startup'`: 該当SU の社員 / 社員候補 / 創業候補

### 除外対象 (HRL根拠から外す = status='invalid')

- `university`: 大学・研究機関のPI / 共同研究者 / 特許保有者
- `vc`: VC / ファンド / 投資家
- `partner_company`: 産業パートナー / 顧客 / サプライヤー / 委託先
- `government`: 補助金 / 行政 / 支援機関
- `individual`: 個人 (フリーランス等で SU+AMD 外)

「協業」「窓口」「相談」「アドバイザのみ」は曖昧関与として除外。

### 表記ルール

- AMDメンバーは必ず `members.code_name` で記録 (`まさ` / `きよ` 等)。本名 / 姓のみ表記は重複扱いで invalid。
- SU社員は `affiliation=<SU名>` + `category='startup'`。AMD と SU の二重表記 (`JOYCLE / AMD`) は使わない。
- 同一人物の別表記は LLM 抽出時に集約。

### ステータス遷移

- LLM抽出は `status='tentative'` で保存。
- 通知で「はい」→ `active`、「いいえ」→ `invalid`。
- コックピットの関連メンバーモーダルでは、直接セル編集ではなく、つくよみに修正指示を出し提案プレビュー → OK確定で upsert/invalid。

詳細は [`xrl_evidence.md`](xrl_evidence.md) の「関連メンバーの扱い」セクション参照。

## Annual MS Gantt

年間MSの表示は `MilestoneGanttChart` を正本にする。旧リスト型表示を復活させない。

- month columns: plan cycleの `periodStartYm` 〜 `periodEndYm`
- each bar: MS別 `periodStartYm` 〜 `targetYm`
- bar chips: member codeName, share %, allocated pt (`ms.points * share`)
- expanded row: responsibility detail + sub items

## Reward Cap / Stock

月次モーダルのメンバー報酬は、PJ予算を絶対に超えない。

- 今月払ってよい額 = 月次PJ予算 (`billing_cycles.budget_yen` or monthly fixed fee 65%)
- gross due = 今月発生報酬 + 前月までのmember別stock
- gross dueがcapを超える場合、支払額をcap内に比例配分し、未払い分を `stockYen` として翌月へ繰越
- UIは `要支払 / 支払 / 繰越入 / 現ストック / キャップ発動` を表示する

---

## p00 専用 MVV 表示セクション ⭐ NEW (2026-05-23、戦略再構築セッション)

`/project/p00/cockpit`（AMD 全社）**だけ**に表示される、AMD 全社の Mission / Impact Principles / 長期目標 / 戦略構造 / FY26 OKR を上から並べる縦構成セクション。

### 背景

2026-05-23 まさ × えいみ戦略再構築セッションで、AMD の長期目標を「SU 創出数中心」→「研究機関提携 + AMD OS 普及 + 学術体系化」中心へ転換。それに伴い、AMD 全社のミッション・戦略構造を**コックピット上で常時可視化**しておく必要が出てきた。

まさの言葉:
> てかさ、そういう長期的目標、MVV とかをちゃんとコックピットにも書いておかないとだよね。

### 表示する情報（縦並び、上から）

1. **Mission**
   - 「眠る知財をビジネスに変え、日本をディープテックの渦にする」
   - 英文: "Spin IP into ventures, supercharge economy, reward scientists, amplify science"

2. **Impact Principles（4 要素の循環構造）**
   - 図で表現: `[1] 知財事業化 → [2] 外貨獲得 → [3] 研究者還元 → [4] 研究者数増加 →（新しい知財）→ [1]`
   - 各要素のラベルとループの矢印を SVG / Flexbox で

3. **コア能力（3 つ）× 差別化資産（2 つ）**
   - コア能力: ビジョン注入力 / 俯瞰的技術戦略 / 大学連携ネットワーク
   - 差別化資産: AMDプロトコル / AMDスコア

4. **3 レイヤー戦略構造**
   - 🏗 仕組み（AMD OS 普及 / Y→X 遷移装置）
   - 🎓 学術（Before Zero Model 体系化）
   - 💰 案件（研究機関セグメント / 事業会社セグメント）
   - 各レイヤーは折りたたみ可、クリックで詳細展開

5. **AMD OS ロードマップ**
   - タイムライン形式
   - 2026 内部運用 + 教科書 STEP 1 着手 → 2027 NIMS 試験導入 → 2027-28 連携機関展開（並走）→ 2030+ 全国共通基盤

6. **2035 長期目標（主要メトリック）**
   - AMD OS 導入機関数: 60+
   - 連携研究機関 業務提携数: 60+
   - 論文累積（査読付）: 30（うちジャーナル掲載 10）
   - 学会発表累積: 40
   - ファンド運用額: 30 億円+
   - DTSU 創出数: 60+/年（副次指標）
   - 各メトリックは現在値（自動集計）と目標値を並べて進捗バー表示

7. **AMD ファンド（ゼブラ思想）**
   - 3 レイヤー外の収益源として独立カード
   - 思想（LP 厳選 / 余剰資金運用 / ブランディング保護）
   - FY28 組成 10 億円規模

8. **FY26 OKR（KR1 〜 KR6）**
   - KR1 事業規模 / KR2 収益性 / KR3 組織基盤 / KR4 将来基盤 / KR5 プレゼンス / KR6 学術化
   - 各 KR の現在達成率（手動入力 or 自動推定）と目標を並べて表示
   - クリックで該当 MS にジャンプ

9. **今期 MS リスト**
   - 既存の `CockpitGoalsCompact` がそのまま使える
   - `value_plan_cycles.plan_cycle_id='PC-p00-202606-202612'` の 14 MS を表示

### データソース

| 項目 | ソース |
|---|---|
| Mission / Impact Principles / コア能力 / 差別化資産 / 3 レイヤー | 静的（component 内 or `knowledge/company_profile.md` を build 時に取り込み） |
| AMD OS ロードマップ | 静的（`knowledge/amd_os_vision.md`）|
| 2035 長期目標（目標値）| 静的（`knowledge/company_profile.md` + `knowledge/midterm_plan.md`）|
| 2035 長期目標（現在値）| 動的: `partner_institutions.md` 集計 / `value_milestones` 集計 / `protocols` 集計 / 論文 DB（要設計）|
| AMD ファンド | 静的（`knowledge/midterm_plan.md` §3）|
| FY26 OKR（目標）| 静的（`knowledge/company_profile.md`）|
| FY26 OKR（達成率）| 手動入力 or 自動推定（要設計、H2 開始時点では手動入力で OK） |
| 今期 MS | `value_milestones` テーブル `plan_cycle_id='PC-p00-202606-202612'` |

### UI 構成（既存ページ構成への差分）

```
/project/p00/cockpit (CockpitView)
├── [A]   CockpitHeader               PJ 名 = "AMD" / status chip
├── [V]   CockpitP00MVVSection    ⭐ NEW (p00 のみ表示)
│   ├── 1. Mission ブロック
│   ├── 2. Impact Principles 循環構造図
│   ├── 3. コア能力 × 差別化資産
│   ├── 4. 3 レイヤー戦略構造（折りたたみ可）
│   ├── 5. AMD OS ロードマップ タイムライン
│   ├── 6. 2035 長期目標 進捗バー
│   ├── 7. AMD ファンド（ゼブラ思想）カード
│   └── 8. FY26 OKR KR1-KR6 進捗バー
├── [B]   CockpitGoalsCompact         今期 MS リスト（14 個）
├── [B1]  CockpitStrategySignals      経営・事業シグナル
├── [B2]  CockpitNextPeriodSetup
├── [B3]  過去の期間
├── [C]   CockpitKanbanGas
├── [G/E] CockpitMonthlyList + CockpitMeetingSummary
└── [Right] CockpitRoutineGas + CockpitNudge
```

> ⚠️ `[A2] CockpitVentureStatus`（PJ Status セクション）は **p00 では非表示**。AMD 全社は `project_ventures` 行を持たないため。代わりに CockpitP00MVVSection が同じ位置に表示される。

### 表示条件

- `project_id === 'p00'` のときのみ `CockpitP00MVVSection` を表示
- 他の PJ（p06 / p20 / p21 等）には**出さない**
- 既存の `CockpitVentureStatus` は p00 では出さない

### 実装ファイル（新規）

- `pwa/src/components/cockpit/CockpitP00MVVSection.tsx`（NEW）
- `pwa/src/components/cockpit/CockpitView.tsx` で `projectId === 'p00'` 分岐

### 静的データの md 同期ルール

`knowledge/` 配下の v2 md と CockpitP00MVVSection の静的データは**必ず同期**させる。

- md 変更時はコードも更新する（v2 化のタイミングで作ったルール）
- 将来的には build 時に `knowledge/company_profile.md` 等を解析して動的化することも検討（FY27 以降の課題、現状は静的でも OK）
- 静的データを変更したら、`knowledge/company_profile.md` の Changelog にも追記

### 関連 md

- [`/Users/masa/projects/knowledge/company_profile.md`](../../../knowledge/company_profile.md) — Mission / Impact Principles / 3 レイヤー / FY26 OKR / 組織体制
- [`/Users/masa/projects/knowledge/amd_value_model.md`](../../../knowledge/amd_value_model.md) — 3 軸構造 / コア能力 + 差別化資産
- [`/Users/masa/projects/knowledge/midterm_plan.md`](../../../knowledge/midterm_plan.md) — FY26-FY35 数値計画 / ファンド設計（ゼブラ思想）
- [`/Users/masa/projects/knowledge/amd_os_vision.md`](../../../knowledge/amd_os_vision.md) — AMD OS 中核戦略 / ロードマップ
- [`/Users/masa/projects/knowledge/partner_institutions.md`](../../../knowledge/partner_institutions.md) — 連携機関台帳

### Changelog

| 日付 | 変更 |
|---|---|
| 2026-05-23 | 初版。戦略再構築セッションで「コックピットにも MVV を書いておかないと」とまさ確定。CockpitP00MVVSection 仕様を新設 |
