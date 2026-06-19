# 経営ハイライト (D-6) — 設計の正本

作成: 2026-05-23
正本ステータス: 実装中。仕様変更したらこのファイルと `L2_DATA.md` / `cockpit.md` / `FEATURE_REGISTRY.md` を同じ commit で更新する。

> **manual / spec / bzm 3層分割中**: D-6 経営ハイライトの確定実装仕様は `/spec/3-6-strategy-signals-current-spec.md` へ移行済み。移行完了までは、この design も設計議論・履歴として残し、迷う内容は両方に置く。

---

## 目的

MS進捗とは別に、PJの経営上の重要方針・事業上の進捗・戦略転換・リスク・次の一手を、短い根拠付きでコックピットに表示する。

MSは「計画した成果物の進捗」を扱う。  
経営ハイライトは「進んだこと・起きたこと」を扱う。未了 / TODO / アイディアは別 UI に置く。

---

## 表示場所

`/project/[projectId]/cockpit` の `CockpitGoalsCompact` (= 今期MSリスト) の直下。

表示セクション名: `経営ハイライト`

1行に出すもの:

- 日付
- polarity chip (= `breakthrough` / `forward` / `pivot` / `risk`。未設定ならカテゴリ emoji fallback)
- type chip
- impact chip
- candidate の「未確認」chip
- title
- 1-2行 summary
- `score_impact_summary` があれば AMD Score / XRL への影響 1 行
- source refs 数と短い根拠

---

## DB

正本テーブル: `project_strategy_signals`

主な列:

- `signal_id`: UUID PK
- `project_id`: `projects.project_id`
- `ym`: 対象月。月が明確でないものは NULL
- `signal_date`: **事象が起きた日** (= occurred_at)。例えば「リアクター特許出願完了（4/27付）」のような signal は、source ref が 5/13 定例で確認されたものでも signal_date は `2026-04-27` にする。観測日 (= 議事録に出てきた日) ではなく事象発生日を使う (まさ #13 2026-05-24 確定)。raw 内に明確な日付パターン (`N/N付` / `N/N に` / `N月N日`) があれば優先採用
- `polarity`: `breakthrough` / `forward` / `pivot` / `risk` (= migration 090)。旧案の中立 `external` は使わない。未設定 row はカテゴリ emoji fallback で表示する。
- `signal_type`: `management_decision` / `business_progress` / `strategic_pivot` / `commercial_progress` / `partnership` / `funding` / `ip_regulatory` / `risk` / `next_move` / **`tech_progress`** (= migration 088, まさ #14-3rd 2026-05-24 追加)
  - **cockpit 表示は 4 分類でグルーピング** (= 左ボーダー色 + 時間軸混合、まさ #14 + #14-3rd 2026-05-24 確定):
    - **🏛 経営全般** (violet) = `management_decision` / `strategic_pivot` / `funding` / `next_move`
    - **🚀 事業開発** (emerald) = `business_progress` / `commercial_progress` / `partnership`
    - **🔬 技術開発** (sky) = `tech_progress` (= 自社特許出願 / 技術スタック進捗)
    - **🌐 外部環境** (amber) = `ip_regulatory` (= 他国規制動向 / 競合知財動向) + `risk` (= 純粋な外部要因)
  - 外部環境カテゴリも他 3 分類と同じく cockpit に表示する。Atlas リンクは header に残す (= 横断マクロシグナル一覧として併存)。
  - **LLM 抽出時の判定ガイドライン** (Codex automation prompt 必須記載):
    - `risk` は **純粋な外部要因** (政府方針変化・競合の動き・市場ショック・規制強化) のみに使う
    - 自社内部のリスク (= 経営判断未了 / 財務 variance / Score 急減 / 品質問題 / 商談減額) は `risk` ではなく **本来の分類** (`management_decision` / `business_progress` / `commercial_progress`) を使う
    - 「リスク」という言葉に引きずられて何でも `risk` にしない
    - **自社特許出願 / 知財戦略 / 技術スタック進捗 は `tech_progress`、他国規制動向 / 競合知財動向 は `ip_regulatory`** (= 内部活動 vs 外部要因で分ける)
- `title`: 短い見出し
- `summary`: 何が起きたか、なぜ重要か
- `impact_level`: `low` / `medium` / `high` / `critical`
- `decision_state`: `observed` / `proposed` / `decided` / `executing` / `revised`。legacy 軸として残るが、経営ハイライト UI の主表示軸にはしない。
- `status`: `candidate` / `confirmed` / `rejected` / `archived`
- `score_impact_summary`: AMD Score / XRL への影響 1 行。あれば cockpit card に表示する。
- `score_impact_delta_json`: 後追い集計用の構造化 delta。
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
Codex automation: amd-os
        ↓
outbox JSON
  /Users/masa/.codex/automations/amd-os/strategy-signals-outbox/*.json
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

### automation health の範囲

D-6の `automation-prepare` は、Supabase と PWA API が取れていれば review を進めてよい。GAS はこの抽出経路の必須依存ではないため、`automation-prepare` / `refresh-snapshot` ではデフォルトで GAS health を skip する。

- D-6で必須: Supabase snapshot refresh、PWA API、5生データ connector
- D-6で任意診断: GAS bridge
- GAS も含めて診断したい場合: `node pwa/scripts/ms_progress_review_tool.mjs health` または `automation-prepare --include-gas-health`

理由: 経営ハイライト候補は Codex automation が 5生データ / OS snapshot から outbox を作り、非LLM applier が Supabase に反映する。GAS は freee / 一部 cron / legacy bridge の健全性確認には重要だが、この daily review の hard gate にすると不要な false degraded が出る。

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

## 議論セッション運用 (= dialogue)

> **呼称ルール**: UI / manual では「提案前の論点整理セッション」または `dialogue` と呼ぶ。会社の正式会議体ではなく、チームへ提案する前の論点・提案・残課題を整理する対話セッションとして記録する。

Codex automation の candidate 抽出と並列で、**dialogue で対話して、チームに出す提案を整理する** 経路を持つ。

### フロー

```
[Phase 1] daily routine (= Codex automation amd-os)
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
  - 経営ハイライト section: project_strategy_signals を表示
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

#### `POST /api/dialogue-meeting/narrate`

dialogue meeting の `decided / progress / next_actions / risks` 配列を、初めて読む人でも
`## 🎯背景` → `## 📊経緯` → `## ✅決まったこと` → `## ▶️次の一手` → `## ⚠️残課題` が一気に追える Markdown narrative に
書き直して `project_meeting_summaries.narrative_md` に保存する。

- `Body: { meeting_id }` で 1 件 narrate
- `Body: { all: true, limit?: number }` で `narrative_md is null` の dialogue meeting を順次 narrate (default 10 件)
- LLM: Claude Sonnet 4.6 (`claude-sonnet-4-6`)
- 認証: admin または `Authorization: Bearer ${CRON_SECRET}`
- 関連 strategy signal は `source_url = internal://strategy-signals/<id1>,<id2>` の形式で
  抽出され、prompt に併記される。

cockpit の `CockpitMeetingDetailModal` は `narrative_md` があれば narrative を 1 本の
ストーリーとして表示し、raw decided/progress/... は折りたたみ「元データ」へ落とす。
narrative がなければ従来の section view (= raw を見せる) に fallback する。

#### 運用ルール (= dialogue の議事録)

- `## ✅決まったこと` は「チームへ出す提案としてこの場で固まったこと」の意味で使う。チームに無断で会社として正式決定したように読める言い方は避ける。
- 見出しは `## 🎯背景` → `## 📊経緯` → `## ✅決まったこと` → `## ▶️次の一手` → `## ⚠️残課題` の順に固定し、箇条書きではなく段落で書く。
- `summary_short` には「議論の背景 + 何を議論したか」を 2-4 文で書く。1 行サマリだけにしない。
- 議論ログを保存したあと、`POST /api/dialogue-meeting/narrate { meeting_id }` を叩いて
  narrative_md を生成する。生成後はコックピットに narrative 主体の議事録として出る。
- まさが narrative の表現を直したい場合は、Supabase 直 update で `narrative_md` を上書きしてよい。
  LLM 再生成すると上書きされるので、編集後は再 narrate を呼ばない運用。

### 議論プレイブック (= えいみ向け実務メモ)

PJ 1件あたり、以下を 30 秒〜2 分で横断 read してから議題を組む:

| 観点 | 主に見る場所 | 拾うシグナル |
|---|---|---|
| 月次レポート | `monthly_reports` 直近2-3本 | 滞り、繰り返し出る課題 |
| 会議 risks / decided | `project_meeting_summaries` 過去30日 | 未対応 risks、決定の含意 |
| admin請求/レポート滞留 | `billing_cycles` 当月+前月 | report_fixed_at / payment_confirmed_at null |
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
