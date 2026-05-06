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

## ページ構成 (全体像)

```
/project/[projectId]/cockpit (CockpitView)
├── [A]   CockpitHeader               PJ 名 / clientName / status chip
├── [A2]  CockpitVentureStatus    ⭐  PJ Status セクション (このドキュメントの主役)
├── [B]   CockpitGoalsCompact         今期 MS リスト
├── [B2]  CockpitNextPeriodSetup      次期 MS 設定バナー
├── [B3]  過去の期間 (折りたたみ)
├── [C]   CockpitKanbanGas            TODO カンバン
├── [G/E] CockpitMonthlyList + CockpitMeetingSummary  月次カード + MTG サマリ
└── [Right] CockpitRoutineGas (active/sales のみ) + CockpitNudge
                                  ※ ended/lost/frozen の PJ では Routine 非表示
```

---

## CockpitVentureStatus の中身

```
┌────────────────────────────────────────────────────────────┐
│ Header (全要素クリックで CockpitVentureMetaEditModal)      │
│  - emoji (outcome) / PJ 名 / lane chip / outcome chip      │
│  - 設立日 / origin_org / origin_pi                         │
│  - [📜 沿革] [👥 メンバー] [🤝 事業会社] [📊 試算表]       │
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

- 2026-05-06 セッション後半で `CockpitHeader` に独断で `⚙️ config` リンク (→ /admin/projects) を追加。「PJ 台帳に飛ぶ」ためまさに却下された。CockpitHeader は **PJ 名 + clientName + status chip だけのシンプル構成**に戻した。
- **教訓**: 「過去にあったリンクの復活」を頼まれたとき、`git log -S` で履歴を確認せず推測で実装すると、まったく別のものを「復活」してしまう。今後は git history から確実に復元するか、まさに飛び先を確認してから追加する。

---

## 開発時の流れ

```
コード変更 → tsc --noEmit → next build → commit → push (branch + main) → Vercel deploy
                                                       ↓
                            DDL 変更があれば applyDDL.py で先に適用
```

詳細は [`SPEC_pwa.md`](../SPEC_pwa.md) の「8. 運用コマンド」参照。
