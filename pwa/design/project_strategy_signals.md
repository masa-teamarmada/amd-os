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
`l2_kind='project_strategy_signal'`、`metadata_json.signal_type`、`metadata_json.signal_source_hash` を入れる。

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
