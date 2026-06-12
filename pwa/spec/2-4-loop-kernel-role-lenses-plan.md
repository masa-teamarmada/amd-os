# ループカーネル × 役割レンズ — OS 全体構造の再定義 (plan)

> **この章は何か**: 2026-06-12 まさ × えいみ構造議論で確定した、AMD OS 全体構造の再定義プラン。`-plan` 章であり、current truth ではない部分は明示する。実装が進んだ領域から current-spec 化していく。

## OS の目的の言語化 (2026-06-12 まさ確定)

AMD OS の目的は 5 層で言語化される。**本丸は第 5 層**。

| 層 | 内容 | 状態 |
|---|---|---|
| 1 | 属人性からの脱却 — 判断材料を OS に集約し「まさが個別判断しなくても回る」状態へ | 公式目的 (manual 1-1) |
| 2 | 経営の知覚系の自動構築 — 5 生データ → L2 → cockpit。手動入力前提の機能は禁止 | 実装が最も厚い |
| 3 | 経営判断の理論化・知財化 — AMD Score / Before Zero Theory / AMD Protocol / BZM 教科書 | 蓄積中 |
| 4 | 観測から制御へ — 検知 → outbox → worker → SLA の制御ループ (proactive operating loop) | 着手段階 |
| 5 | **OS 自体の商品化 — 経営 OS として他機関 (NIMS FY27 等) に提供する** | **本来の目的 (まさ確定)** |

第 5 層が本丸であることの含意: 構造判断の基準は「AMD で便利か」ではなく **「AMD という 1 テナントを剥がしても成立するか」**。AMD は tenant #1 / リファレンス実装と位置づける。

## ループカーネル — 5 段ループ

OS のカーネル概念は、経営の認知ループそのもの:

```text
観測 (Observe) → 評価 (Assess) → 判断 (Decide) → 実行 (Act) → 学習 (Learn) → (観測へ戻る)
```

| 段 | 問い | 吸収する既存機能 | 主なデータ |
|---|---|---|---|
| 📡 観測 | 何が起きたか | 5 生データ取り込み / Atlas / Macrotrend / Seeds / VC / Scholar | `source_cache`, `atlas_signals`, L2 抽出入力 |
| 📈 評価 | それで状態はどう変わったか | AMD Score (PRS primary) / Management Score / XRL / MS 進捗 / Venture Map | `amd_score_*`, `amd_management_score_*`, `project_xrl_evidence`, `milestone_monthly_progress`, `ms_progress_revisions` |
| ⚖️ 判断 | 人間が何を採否・決定するか | /notifications 採否ゲート / 経営ハイライト / まさえいMTG | `l2_notifications`, `meeting_notifications`, `project_strategy_signals` |
| 🚀 実行 | OS と worker が何を動かすか | proactive outbox / 月次ルーティン / admin オペ | `proactive_loops`, `proactive_outbox`, `billing_cycles`, `payout_notices` |
| 📚 学習 | 判断と結果から何を資産化するか | AMD Protocol / Textbook Insights / tsukuyomi learnings | `protocols`, `protocol_result_observations`, `textbook_insight_candidates`, `tsukuyomi_learnings` |

設計原則:

- **新機能は必ず「どの段の住人か」を宣言してから作る**。段に置けない機能は、概念が壊れているサイン。
- **観測・評価系の新規追加は原則凍結** (2026-06-12 まさ同意)。当面の開発重心は実行・学習段 (proactive loop の実装、Protocol 結果観測の運用化)。新スコア・新ビューの追加は「どの判断を変えるか」を必須記述にする。
- proactive loop は L2 ではなく **実行段の control layer** (`design/proactive_operating_loop.md` の Open Question 1 への回答)。

## L2 の位置づけ — 頻度コード + 型メタデータ

L2 の正本ナンバリングは cadence ベースの **D / M / H** (spec 3-1、2026-06-04 まさ確定)。本プランはこれを変更しない。その上で、各 L2 に **型メタデータ**を付与する:

| 型 | 意味 | 該当 L2 (新コード) |
|---|---|---|
| 出来事 (event) | いつ何が起きたかの記録 | H-1 (MTG flow), M-1 (月次レポート) |
| 状態 (state) | 今どうなっているかのスナップショット | D-2 (MS進捗), D-5 (台帳差分), M-2 (XRL根拠) |
| 知識 (knowledge) | 再利用できる事実・知見 | D-3 (PJ知識), D-4 (メンバー知識), D-7 (textbook insights) |
| 判断 (decision) | 採否・意思決定の記録 | D-1 (protocol), D-6 (経営ハイライト) |

型はループ段への接続を決める: 出来事・状態 → 観測/評価段、知識 → 学習段、判断 → 判断段。頻度コードは運用 (いつ更新されるか)、型は概念 (ループのどこに効くか)。頻度が変わればコードはリネームされる (rename 履歴を台帳に残す) が、型は安定アンカーとして残る。

## 役割レンズ — 1 カーネル × 3 レンズ

ループカーネルは 1 つ、見る人の役割で「レンズ」を変える (2026-06-12 まさ確定)。レンズは権限と UI の違いであり、データは同じカーネル。

| レンズ | 対象 | デフォルトランディング | 見えるもの |
|---|---|---|---|
| **経営レンズ** | まさ (将来: 機関の経営層) | ループダッシュボード (`/loop`) | 5 段ループ全体。判断キューが画面の重心、実行段の SLA が常時可視 |
| **推進レンズ** | AMD メンバー | マイワークスペース (現 `/mypage` の進化形) | 自分の PJ・自分のボール・直近 MTG・月次 TODO・報酬。**ループ用語は出さない** |
| **運営レンズ** | きよ (admin オペ) | 運営コンソール (現 `/admin/billing`+`/admin/payouts`+`/admin/finance`+月次ルーティンの集約) | 月次ルーティン盤面 (PJ × ステップ)・財務体制 |

- メンバーの議事録投稿・月次ルーティン操作は、本人にループを意識させないまま観測段への供給・実行段の消化になる。
- 機関導入時はこの 3 レンズがロールテンプレートになる (executive / member / ops)。例: NIMS なら機構長 = 経営レンズ、研究者 = 推進レンズ、URA = 運営レンズ。
- AMD 固有物 (まさえいMTG、えいみ/つくよみキャラ、freee 連携等) は **テナント実装層**であり、カーネル (ループ機構 / L2 型 / 採否ゲート / outbox) と分離して扱う。

## 段階実装プラン

| Phase | 内容 | 状態 |
|---|---|---|
| 1 | **`/loop` ルート MVP** — 経営レンズの 5 段ダッシュボード。admin 限定、既存画面は変更しない。判断キュー (`l2_notifications` pending + `project_strategy_signals` candidate) と実行 outbox (`proactive_outbox`) を実データ接続 | 2026-06-12 実装済み (admin 限定)。同日 Step 1 拡張: 全段アイテムクリック → 詳細モーダル (全文表示)、判断段はモーダル内で採否完結、dashboard 最上段に盤面埋め込み (`LoopKernelBoard`) |
| 2 | 実行段の充実 — proactive loop の検知・heartbeat 本稼働 (`design/proactive_operating_loop.md`)、`/loop` から outbox 操作 | 未着手 |
| 3 | 推進レンズ — `/mypage` を「自分のボール」中心に再構成 | 未着手 |
| 4 | 運営レンズ — admin 月次オペ + 財務の単一コンソール化 | 未着手 |
| 5 | ランディングのロール出し分け、ナビのループ段再編 | 未着手 |
| 6 | テナント分離 (カーネル / AMD 固有の境界を実装レベルで引く) — 機関提供の前提 | 未着手、`design/institution_tenant_access.md` と接続 |

既存画面の削除・置き換えは行わない (FEATURE_REGISTRY 保全)。`/loop` が実用に達してから、ナビ・ランディングの切り替えを Phase 5 で判断する。

## ループ成立の定義と Step ロードマップ (2026-06-12 まさ A 案承認)

まさ指摘: 「冒頭数十文字が見えるだけでアクションできないなら、ループが成立したとはいえない」。ループ成立 = 以下 4 遷移が OS 上のデータとして繋がること:

1. **見る → その場で判断**: 盤面アイテムをクリック → 全文モーダル → 判断段はモーダル内で採否
2. **判断 → 実行**: confirm 時に `proactive_outbox` へ期限つき次の一手が積まれる
3. **実行 → 学習**: outbox close 時に結果が記録され、protocol 結果観測 / textbook insight へ流れる
4. **学習 → 次の判断**: 判断カードに関連プロトコルが表示され、過去の学習が判断材料になる

| Step | 内容 | 状態 |
|---|---|---|
| 1 | 全段クリック → 詳細モーダル + 判断段モーダル内採否 + dashboard 最上段埋め込み。**ページ遷移なし・モーダル完結 UX が必須要件 (まさ指示)** | 2026-06-12 実装済み (v0.17.1) |
| 2 | confirm 時に `proactive_outbox` へ期限つき次の一手を積む (outbox 運用設計にまさ判断要) | 未着手 |
| 3 | outbox close 時の結果記録 → 学習段への流し込み | 未着手 |
| 4 | 判断カードに関連プロトコル表示 (学習が次の判断に現れる) | 未着手 |

### Step 1 実装 contract (current truth)

- 盤面本体 = `pwa/src/components/loop/LoopKernelBoard.tsx` ("use client"、self-fetching / self-gating)。`/loop` ページと dashboard 最上段 (`hideWhenNoAccess` + `showHeader`) で共用
- 権限: browser client で `members.is_admin` を自前チェック。非 admin は dashboard では非表示 (hideWhenNoAccess)、`/loop` は server 側でも `notFound()` ゲート
- 読むテーブル: `source_cache` (本日 count + 直近 3 全文) / `ms_progress_revisions` pending / `project_xrl_evidence` candidate count / `l2_notifications` unread / `project_strategy_signals` candidate / `proactive_outbox` open / `protocols` candidate / `textbook_insight_candidates` candidate / `projects`
- 採否 API: signals → `POST /api/strategy-signals` (`{action:'confirm'|'reject', signal_id}`)、L2 通知 → `POST /api/notifications/feedback` (`{l2_kind, target_id, scope_key, notification_id, action:'yes'|'no'}`) + `read_at` 既読化。成功後にモーダルを閉じて盤面再 fetch
- L2 チップ表示は日本語 + L2 番号ラベル (`L2_KIND_LABEL`、正本 = NotificationsClient.tsx)

## Current truth vs plan

- Current truth: 5 段ループ・3 レンズはこの章と `/loop` MVP 以外まだ実装されていない。既存ナビ・cockpit・notifications は従来通り。
- Current truth: L2 正本は spec 3-1 の D/M/H ナンバリング。型メタデータは本章の定義のみで、DB カラム化はしていない。
- Plan: 上記 Phase 2 以降はすべて未実装。着手前にこの章を更新する。

## 再構築可能性チェック

この章はプラン正本であり、`/loop` の実装 contract (テーブル・クエリ・権限・採否 API) は「Step 1 実装 contract」節が current truth。不足: レンズ別ランディングのルーティング仕様 (Phase 5 で確定)、Step 2 の outbox 積み込み仕様 (まさ判断待ち)。
