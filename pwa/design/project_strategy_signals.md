# 経営・事業シグナル (L2 ⑨) — 設計の正本

作成: 2026-05-23
正本ステータス: 実装中。仕様変更したらこのファイルと `L2_DATA.md` / `cockpit.md` / `FEATURE_REGISTRY.md` を同じ commit で更新する。

---

## 目的

MS進捗とは別に、PJの経営上の重要方針・事業上の進捗・戦略転換・リスク・次の一手を、短い根拠付きでコックピットに表示する。

MSは「計画した成果物の進捗」を扱う。  
経営・事業シグナルは「事業や経営判断として見落とすと危ない変化」を扱う。

---

## 表示場所

`/project/[projectId]/cockpit` の `CockpitGoalsCompact` (= 今期MSリスト) の直下。

表示セクション名: `経営・事業シグナル`

1行に出すもの:

- 日付
- type chip
- impact chip
- decision state
- candidate/confirmed status
- title
- 1-2行 summary
- source refs 数と短い根拠

---

## DB

正本テーブル: `project_strategy_signals`

主な列:

- `signal_id`: UUID PK
- `project_id`: `projects.project_id`
- `ym`: 対象月。月が明確でないものは NULL
- `signal_date`: 実際に観測された日
- `signal_type`: `management_decision` / `business_progress` / `strategic_pivot` / `commercial_progress` / `partnership` / `funding` / `ip_regulatory` / `risk` / `next_move`
- `title`: 短い見出し
- `summary`: 何が起きたか、なぜ重要か
- `impact_level`: `low` / `medium` / `high` / `critical`
- `decision_state`: `observed` / `proposed` / `decided` / `executing` / `revised`
- `status`: `candidate` / `confirmed` / `rejected` / `archived`
- `source_refs_json`: source id / date / title / short snippet / url / hash
- `source_hash`: 重複排除用
- `confidence`: 0-1
- `extraction_run_id`: Codex automation run の識別子

全文保存禁止:

- Gmail本文全文
- Slack全文
- Notion/Drive議事録全文
- 添付ファイル本文全文

保存してよいもの:

- source id
- date
- title
- short snippet
- url/permalink
- hash

---

## 抽出フロー

```text
5生データ
  Gmail / Drive / Calendar / Slack / Notion
        ↓
Codex automation: amd-os-strategy-signals
        ↓
outbox JSON
  /Users/masa/.codex/automations/amd-os-strategy-signals/outbox/*.json
        ↓
non-LLM applier
  scripts/run-ms-outbox-applier.sh
        ↓
Supabase
  project_strategy_signals
  l2_notifications(l2_kind='project_strategy_signal')
        ↓
/notifications
  はい: confirmed
  いいえ: rejected
        ↓
/project/[projectId]/cockpit
  confirmed + candidate を表示
```

LLM/Codex automation は DB/API へ直接書き込まない。  
DB反映は `pwa/scripts/ms_progress_review_tool.mjs apply-outbox-dir` が行う。

---

## outbox 形式

top-level:

```json
{
  "generatedAt": "2026-05-23T00:00:00.000Z",
  "ym": "202605",
  "source": "codex-automation",
  "strategySignals": [],
  "notifications": [],
  "notes": []
}
```

`strategySignals[]`:

```json
{
  "project_id": "p21",
  "ym": "202605",
  "signal_date": "2026-05-22",
  "signal_type": "management_decision",
  "title": "LINE-firstでOkuDoorの導線を固定",
  "summary": "LINEログイン/LIFF/Supabase連携を主導線にし、KRスマート決済を中心に置く方針へ寄せた。",
  "impact_level": "high",
  "decision_state": "decided",
  "source_refs_json": [
    {
      "source": "slack",
      "date": "2026-05-22",
      "title": "OkuDoor LINE連携",
      "snippet": "短い根拠だけ",
      "hash": "..."
    }
  ],
  "confidence": 0.82,
  "status": "candidate",
  "created_by": "codex_automation"
}
```

`notifications[]` は `l2_notifications` payload と同じ。  
`l2_kind='project_strategy_signal'`、`metadata_json.signal_type`、`metadata_json.signal_source_hash` を入れる。個別候補の通知は `scope_key='YYYYMM:strategy:<hash12>'` を推奨し、通知UIは `scope_key` 先頭の `YYYYMM` を表示月として扱う。

---

## Backfill / initial data

初期表示用の過去データは、既存 `member_activities` から決定的ルールで候補を作る。LLM/GASは使わない。

```bash
node pwa/scripts/backfill_strategy_signals_from_activities.mjs \
  --from-ym 202601 \
  --to-ym 202605 \
  --max-per-project 10 \
  --max-per-project-month 4 \
  --max-total 80 \
  --out /tmp/amd-os-strategy-signals-backfill.json

node pwa/scripts/ms_progress_review_tool.mjs apply-outbox \
  --file /tmp/amd-os-strategy-signals-backfill.json
```

2026-05-23に、`member_activities` 202601-202605 から40件を `status='candidate'` としてbackfill済み。通知も同時に作成済みなので、`/notifications` の「はい/いいえ」で confirmed/rejected にできる。

---

## 抽出基準

入れる:

- 経営方針や事業方針が明確に決まった
- 顧客/提携/資金/規制/知財/採用などでPJの進路が変わる進捗があった
- 重要リスクが顕在化した
- 次に取るべき行動が事業上の意思決定として明確になった
- MS進捗より上位の判断や文脈として残す価値がある

入れない:

- 単なる日程調整
- 通常のTODO
- 進捗率だけで表せるMS作業
- source refs が弱い推測
- 既存シグナルの言い換え

---

## 通知・承認

候補は `status='candidate'` で保存し、同時に `l2_notifications` に出す。

- はい: `project_strategy_signals.status='confirmed'`
- いいえ: `project_strategy_signals.status='rejected'`
- コメント: `l2_feedbacks` に保存し、次回 automation のプロンプトに含める

コックピットでは candidate も表示するが、候補 chip を付けて未承認であることを明示する。

---

## 議論セッション運用 (= まさ × えいみ daily 経営会議)

Codex automation の candidate 抽出と並列で、**まさ × えいみが claude/codex セッション内で対話して確定経営判断を書き込む** 経路を持つ。

### フロー

```
[Phase 1] daily routine (= Codex automation amd-os-strategy-signals)
  outbox → applier → project_strategy_signals (status='candidate', decision_state='proposed')
   ↓ + l2_notifications(l2_kind='project_strategy_signal')

[Phase 2] まさが claude/codex を開く (= 時間あるときだけ)
  えいみが candidate/proposed signals を read → 優先度順に提示
   ↓
  まさが pick up → 議論
   ↓
  確定経営判断:
    POST /api/strategy-signals
      action='confirm' (= 既存 signal を confirmed/decided に昇格)
      action='create' status='confirmed' (= 議論で新規に出た判断、直接書く)
    POST /api/dialogue-meeting (= 議論本体ログを project_meeting_summaries に保存)

[Phase 3] cockpit 表示
  - 経営・事業シグナル section: project_strategy_signals を表示
  - MTGサマリ section: source_kinds='dialogue' の議論ログを自動表示 (= UI 改修不要)
```

会社全体スコープの議論は `project_id='p00'` を指定。

### API

#### `POST /api/strategy-signals`

dialogue 経路用の CRUD ハブ。`action='create' | 'update' | 'confirm' | 'reject'`。

- daily routine からは **使わない** (= outbox + applier が正本経路)
- dialogue セッション中、まさが「これ確定」と言ったときに 1 件ずつ叩く想定
- `action='create'` は `(project_id, scope_key, signal_type, source_hash)` で upsert (= idempotent)、`source_hash` 未指定時は `project_id + ym + signal_type + title + summary` の SHA-256
- 認証: admin (members.is_admin=true) または `Authorization: Bearer ${CRON_SECRET}`

実装: [src/app/api/strategy-signals/route.ts](../src/app/api/strategy-signals/route.ts)

#### `POST /api/dialogue-meeting`

議論ログ 1 回分を `project_meeting_summaries` に upsert。

- `meeting_id='dialogue:{project_id}:{YYYYMMDD-HHMMSS}'`
- `source_kinds='dialogue'`
- `decided / progress / next_actions / risks` にバケツ分け
- 認証: admin または `Authorization: Bearer ${CRON_SECRET}`

cockpit の `CockpitMeetingSummary` が `source_kinds` 無関係に meeting_date DESC で表示するため、UI 改修なしで議論ログがコックピット MTGサマリ欄に出る。

実装: [src/app/api/dialogue-meeting/route.ts](../src/app/api/dialogue-meeting/route.ts)

### 議論プレイブック (= えいみ向け実務メモ)

PJ 1件あたり、以下を 30 秒〜2 分で横断 read してから議題を組む:

| 観点 | 主に見る場所 | 拾うシグナル |
|---|---|---|
| 月次レポート | `monthly_reports` 直近2-3本 | 滞り、繰り返し出る課題 |
| 会議 risks / decided | `project_meeting_summaries` 過去30日 | 未対応 risks、決定の含意 |
| 月次ルーティン滞留 | `billing_cycles` 当月+前月 | report_fixed_at / payment_confirmed_at null |
| XRL / AMD Score 急変 | `project_xrl_log`, `amd_score_inputs` | 前月比の急上昇/急減 |
| nudge | `tsukuyomi_nudge_queue` (status='ready') | 未処理 nudge |
| 外部環境 | `atlas_signals` 直近7日 × lane | 政策・競合・規制変化 |
| 入金 / 予算 | `billing_cycles.payment_confirmed_at` / freee sync | 入金遅延、PJ予算超過 |
| 既存 candidate | `project_strategy_signals` (status='candidate') | daily routine が積んだ議題 |

議論結果を残すルール:

- confirm はその場で叩く (= 後でやらない)
- まさが「これ違う、こっち」と修正した場合: 元 signal は `action='reject'`、新 signal を `action='create' status='confirmed'`
- 議論ログ (`/api/dialogue-meeting`) は **1 PJ 1 セッション 1 件** にまとめる (= シグナル毎に作らない)
- `decided[]` には「まさが今日確定した経営判断」、`next_actions[]` には「次回会議までの動作」
