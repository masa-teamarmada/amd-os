# Proactive Operating Loop — 先手力維持ループ設計 (廃止 / 2026-06-27)

作成日: 2026-05-31
廃止日: 2026-06-27
ステータス: **廃止済み**。本設計の `proactive_loops` / `proactive_outbox` / `proactive_loop_events` テーブル群と司令塔通知 heartbeat は実装に進まない。理由は実運用で司令塔セッションが消滅し、heartbeat 受け側が成立しなくなったため。

## 廃止と次の正本

- **正本の置き換え先**: [`pwa/spec/2-4-proactive-todo-current-spec.md`](../spec/2-4-proactive-todo-current-spec.md) (先手 TODO 正本仕様)
- **置き換え後のテーブル**: `proactive_todos` (新規、シンプル版)。旧 `proactive_outbox` / `proactive_loops` / `proactive_loop_events` は作らない。
- **置き換え後の検知主体**: PWA cron `/api/cron/proactive-todo-extract` (毎時)。LLM 不使用、文字列ヒューリスティックで AMD ボール判定。
- **置き換え後の UI**: `/proactive` (admin 限定、3 ボタン完了 UI) + dashboard 上段の件数バッジ。`/loop` ルートと 5 段カーネル盤面 (`LoopKernelBoard`) は削除済み。

## なぜ白紙にしたか (2026-06-27 まさ判断)

1. 5 段ループ盤面 (`/loop` / dashboard 埋め込み) は実態が「DB candidate のテーブルダンプ」になっており、先手力維持と無関係の段が 4/5 を占めた。
2. 実行段の `proactive_outbox` には完了 UI が無く、超過 666h の古い seed が残骸として叫び続け、信頼できない TODO リストになった。
3. 「司令塔セッションのえいみ → worker → ドラフト生成」というワークフローが運用上成立せず (= Codex 側の司令塔セッションが機能せず廃止)、heartbeat の受け側が消えた。
4. 検知の起点を MTG (議事録 `next_actions` + 次回 MTG 予定) に絞れば 80% カバーできる、という仮説に賭けて MVP を再設計した。

旧本文は履歴として以下に残すが、参照しない。新規実装は必ず `pwa/spec/2-4-proactive-todo-current-spec.md` を見ること。

---

# (以下、2026-05-31 時点の旧本文 — 参照しない)

## Executive summary

AMD OS には現在、先手力を可視化するスコアや、H-1 MTGサマリ、D-6 経営ハイライト、Cockpit の月次 / MS / MTG表示がある。しかし、現状は「今どれくらい先手を打てているか」を見る仕組みが中心で、「ここから先手力を落とさない」ための制御ループが不足している。

本設計では、先手力を契約継続と AMD レピュテーションを守る運用 SLA として扱う。外部 MTG 後、ボールが曖昧な状態、次回 MTG 前、相手から催促された状態を検知し、OS が `proactive_outbox` に「打つべき一手」を積む。Codex / えいみ / 各 PJ 司令塔は、毎日 10:15-20:15 の毎時 15 分、合計 11 回の heartbeat で outbox を拾い、各 PJ 司令塔へ通知し、必要なドラフト作成 worker を切る。

重要な設計境界は次の通り。

- OS は検知、期限、outbox、状態、リスク可視化を担う。
- Codex / えいみ / 司令塔はドラフト生成、相手向け文面、資料案、ロードマップ案を担う。
- `ball_owner='ambiguous'` は AMD ボールとして扱う。
- 外部 MTG 後 48 時間以内に first move draft を用意する。
- 重要 PJ は次回 MTG 3 営業日前までに agenda / proposal / roadmap draft を用意する。
- 相手から「その後どうなっていますか」系の催促が来たら、先手 SLA 違反として記録する。
- CLG / LST のような社外取締役・advisor 文脈は初期対象外にする。

## Problem / why current proactive score is insufficient

現行の AMD Management Score / AMD Score は、先手力を経営状態の一部として可視化する方向に進んでいる。これは重要だが、可視化だけでは先手力は維持されない。

現場で問題になるのは、次のような瞬間。

- 外部 MTG が終わったあと、相手と AMD のどちらが次に動くのか曖昧になる。
- 初回顔合わせやキックオフ後に、AMD から「こう進めましょう」という進行案が出ない。
- 次回 MTG 前に、本来こちらから agenda / roadmap / 提案書を出すべきなのに、準備が見えない。
- こたさんや大学側から「その後どうなっていますか」と聞かれて初めて動き出す。

この状態は、単なる TODO 遅延ではなく、AMD の提供価値そのものの低下である。AMD の強みは Before 0 におけるビジョン注入力、技術戦略、大学連携ネットワーク、AMD プロトコル / AMD スコアの実装力にある。相手が「AMD が先に構造化してくれる」と期待している局面で先手が切れないと、契約継続・紹介・評判に直接響く。

したがって、本ループは「先手力スコアを下げないための検知・指示・期限管理・完了確認」の運用基盤として設計する。

## Definition of proactive operating loop

先手力維持ループは、次の 4 つを継続管理する運用サイクル。

1. 外部 MTG 後に、AMD 側の next action / first move draft が出ているか。
2. ボールが曖昧なときに、AMD が先に進行案を提示しているか。
3. 相手から催促される前に、進捗共有・提案・資料ドラフトを出しているか。
4. 重要 PJ で、次回 MTG 前に提示すべき agenda / roadmap / proposal が準備されているか。

このループは L2 そのものではなく、L2 と司令塔 / worker をつなぐ control layer として扱う。入力は H-1 MTGサマリ、D-6 経営ハイライト、Calendar、Gmail、Slack、Drive、Notion、monthly reports、MS 進捗など。出力は outbox row と commander 通知、UI 上の TODO、SLA 違反ログ。

## OS vs Codex/commander responsibility split

### OS side

OS は次を担う。

- Calendar / meeting summaries / L2 / Slack / Gmail / Drive / Notion / monthly reports から先手リスクを検知する。
- `proactive_loops` / `proactive_outbox` / `proactive_loop_events` を作成・更新する。
- PJ、機関、関連 MTG、source refs、reason、due_at、priority、draft_type、commander_thread_id を保持する。
- `queued`, `sent_to_commander`, `drafted`, `sent_to_counterpart`, `closed`, `blocked` の状態を管理する。
- 期限超過、催促検知、SLA 違反を Cockpit / Dashboard / 通知で見える化する。
- raw source 全文ではなく、source id / title / short snippet / hash / URL だけを evidence refs として保存する。

OS は、重い proposal / email / Slack / roadmap 本文を本番 runtime で生成しない。LLM コストと品質レビューの観点から、ドラフト生成は Codex / えいみ / 司令塔側へ寄せる。

### Codex / えいみ / commander side

Codex / えいみ / 各 PJ 司令塔は次を担う。

- heartbeat で `proactive_outbox.status='queued'` かつ due が近い row を拾う。
- `project_commander_threads.commander_thread_id` がある場合、`send_message_to_thread` 相当で PJ 司令塔へ通知する。
- draft_type に応じて、Slack 文面、メール文面、agenda、proposal、roadmap、next action plan の worker を切る。
- 完成したドラフトを `proactive_outbox.status='drafted'` に進め、必要に応じて source artifact path / thread id / draft summary を返す。
- 相手に送付済みなら `sent_to_counterpart`、先手リスクが解消したら `closed` にする。
- blocked の場合は、必要な判断・不足情報・止まっている理由を outbox に戻す。

## Trigger catalog

| trigger_type | 主入力 | 作成条件 | 推奨 draft_type | 既定 due |
|---|---|---|---|---|
| `meeting_ended` | Calendar / H-1 | 外部 MTG が終了し、開催済み summary または event が確認された | `next_action_plan` / `email` / `slack` | MTG終了から48h |
| `minutes_added` | `project_meeting_summaries` | `next_actions` または `risks` に AMD が動くべき項目がある | `next_action_plan` | summary 作成から48h |
| `ball_ambiguous` | MTG summary / Gmail / Slack | next action の担当が不明、または `shared` / `ambiguous` | `email` / `slack` / `next_action_plan` | 検知から24h |
| `next_meeting_due` | Calendar / upcoming meeting card | 次回 MTG が近く、agenda / proposal / roadmap が未準備 | `agenda` / `proposal` / `roadmap` | 次回MTG 3営業日前 |
| `counterpart_nudge_detected` | Gmail / Slack | 「その後」「進捗いかが」「どうなっていますか」等の催促検知 | `email` / `slack` | 即日、原則当日中 |
| `deadline_approaching` | MS / routine / manual deadline | 期限前に AMD から進捗共有すべきものがある | `next_action_plan` / `email` | deadline の2営業日前 |
| `strategy_signal_needs_action` | D-6 | `decision_state='proposed'` or `next_move` で人間の一手が必要 | `proposal` / `roadmap` | signal_date から72h |
| `report_only_gap` | monthly_reports | 月次 report-only month に活動があるが次アクションが未明 | `next_action_plan` | 検知から48h |

初期実装では `meeting_ended`, `minutes_added`, `ball_ambiguous`, `next_meeting_due`, `counterpart_nudge_detected` の 5 つを MVP にする。残りは Phase 2 以降でよい。

## Ball ownership rules

`ball_owner` は outbox 作成時点の暫定判断であり、後から commander / PM が修正できる。

| ball_owner | 意味 | 先手ループ上の扱い |
|---|---|---|
| `amd` | AMD が次に動くことが明確 | 必ず outbox 対象 |
| `counterpart` | 相手側の回答・資料・判断待ちが明確 | 原則 outbox 対象外。ただし一定期間後の follow-up は対象 |
| `shared` | 双方の作業がある | AMD 側の first move が必要なら対象 |
| `ambiguous` | 誰のボールか曖昧 | AMD ボールとして扱い、必ず outbox 対象 |

重要ルール:

- `ambiguous` は放置しない。AMD から「次はこう進めませんか」と提案する対象にする。
- `counterpart` でも、相手が詰まっていそうな場合は「確認・補助・たたき台提示」の follow-up を作る。
- `shared` は、AMD 側で先に作れる agenda / skeleton / options があるなら AMD ボールとして扱う。
- CLG / LST など advisor / 社外取締役文脈では、相手の経営責任領域へ踏み込みすぎないよう初期対象外にする。

## SLA rules

| SLA | 対象 | 期限 | 違反時 |
|---|---|---|---|
| first move after external meeting | 外部 MTG 後、AMD / shared / ambiguous | 48h以内 | `proactive_loop_events.event_type='sla_breached'` |
| ambiguous ball clarification | `ball_owner='ambiguous'` | 検知から24h以内に進行案 | priority を yellow 以上へ |
| next meeting preparation | 重要 PJ の次回 MTG | 3営業日前までに agenda / proposal / roadmap draft | priority red、Dashboard に表示 |
| counterpart nudge response | 相手から催促あり | 当日中、遅くとも翌営業日午前 | SLA違反として記録 |
| blocked clarification | outbox が `blocked` | 24h以内に司令塔が判断または再割当 | commander heartbeat で再通知 |

営業日計算は初期実装では JST の土日除外でよい。祝日は既存 business day helper が使えるなら利用する。祝日 helper がない場合は Phase 1 では土日除外だけで始め、Phase 2 で祝日対応する。

## Database / outbox proposal

### Overview

新規テーブル案:

- `project_commander_threads`
- `proactive_loops`
- `proactive_outbox`
- `proactive_loop_events`

既存 `l2_notifications` に無理に詰め込まない。通知採否ゲートは「候補を正本反映するか」の UI であり、先手力 outbox は「司令塔 / worker に仕事を渡す」queue なので、責務が違う。

### `project_commander_threads`

PJ と司令塔 thread を結ぶ lightweight mapping。

```sql
CREATE TABLE project_commander_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  commander_thread_id TEXT NOT NULL,
  thread_label TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT NOT NULL DEFAULT 'codex_worker',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, commander_thread_id)
);
```

status:

- `active`
- `archived`
- `unknown`

### `proactive_loops`

PJ 単位 / MTG 単位 / 期間単位の先手ループ親レコード。

```sql
CREATE TABLE proactive_loops (
  loop_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  institution_id TEXT,
  loop_kind TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  source_id TEXT,
  meeting_id TEXT,
  calendar_event_id TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  ball_owner TEXT NOT NULL DEFAULT 'ambiguous',
  priority TEXT NOT NULL DEFAULT 'yellow',
  sla_due_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open',
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT NOT NULL DEFAULT 'codex_automation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);
```

loop_kind 候補:

- `post_meeting`
- `ambiguous_ball`
- `next_meeting_preparation`
- `counterpart_nudge`
- `deadline_followup`
- `strategy_signal_action`

status:

- `open`
- `watching`
- `closed`
- `blocked`

dedupe:

- Phase 1 は `(project_id, loop_kind, source_id)` の unique index を推奨。
- `source_id` がない場合は `source_hash` 追加を検討する。

### `proactive_outbox`

heartbeat が拾う主テーブル。

```sql
CREATE TABLE proactive_outbox (
  outbox_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loop_id UUID REFERENCES proactive_loops(loop_id),
  project_id TEXT NOT NULL,
  institution_id TEXT,
  meeting_id TEXT,
  calendar_event_id TEXT,
  source_kind TEXT NOT NULL,
  source_id TEXT,
  trigger_type TEXT NOT NULL,
  ball_owner TEXT NOT NULL DEFAULT 'ambiguous',
  priority TEXT NOT NULL DEFAULT 'yellow',
  draft_type TEXT NOT NULL,
  recommended_first_move TEXT NOT NULL,
  risk_if_late TEXT NOT NULL,
  due_at TIMESTAMPTZ NOT NULL,
  commander_thread_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  sent_at TIMESTAMPTZ,
  drafted_at TIMESTAMPTZ,
  sent_to_counterpart_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  blocked_reason TEXT,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  draft_artifact_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT NOT NULL DEFAULT 'codex_automation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

trigger_type:

- `meeting_ended`
- `minutes_added`
- `ball_ambiguous`
- `next_meeting_due`
- `counterpart_nudge_detected`
- `deadline_approaching`
- `strategy_signal_needs_action`
- `report_only_gap`

priority:

- `red`: 期限超過、催促検知、重要 PJ の 3 営業日前未準備
- `yellow`: 48h SLA 対象、曖昧ボール、次回準備が必要
- `green`: 期限に余裕がある watch item

draft_type:

- `email`
- `slack`
- `agenda`
- `proposal`
- `roadmap`
- `next_action_plan`

status:

- `queued`
- `sent_to_commander`
- `drafted`
- `sent_to_counterpart`
- `closed`
- `blocked`

dedupe:

- Phase 1 は `(project_id, trigger_type, source_id, draft_type)` を unique にする。
- source_id がない `next_meeting_due` は `(project_id, calendar_event_id, draft_type)` を使う。
- rerun では `closed` 以外の既存 row を更新し、重複 row を増やさない。

### `proactive_loop_events`

監査ログ / SLA違反ログ。

```sql
CREATE TABLE proactive_loop_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loop_id UUID,
  outbox_id UUID,
  project_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_summary TEXT NOT NULL,
  actor_kind TEXT NOT NULL DEFAULT 'system',
  actor_id TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

event_type:

- `detected`
- `queued`
- `sent_to_commander`
- `drafted`
- `sent_to_counterpart`
- `closed`
- `blocked`
- `sla_breached`
- `counterpart_nudge_detected`
- `deduped`

## Status lifecycle

```text
queued
  -> sent_to_commander
  -> drafted
  -> sent_to_counterpart
  -> closed

queued / sent_to_commander / drafted
  -> blocked
  -> queued or closed
```

状態の意味:

| status | 意味 |
|---|---|
| `queued` | OS が先手タスクとして検知済み。heartbeat 未送信または再送対象 |
| `sent_to_commander` | 司令塔 thread へ通知済み。worker 起票待ちまたは司令塔判断待ち |
| `drafted` | draft artifact ができた。まだ相手送付済みではない |
| `sent_to_counterpart` | Slack / Gmail / docs 等で相手に送る一手が実行済み |
| `closed` | 先手リスクが解消。以後 rerun で再作成しない |
| `blocked` | 判断・情報・権限不足で止まっている。blocked_reason 必須 |

`sent_to_counterpart` は OS が自動で外部送信する意味ではない。人間または司令塔が送付済みと確認した状態を表す。

## Commander notification flow

1. heartbeat が `proactive_outbox` から対象 row を取得する。
2. `project_commander_threads` または row の `commander_thread_id` で通知先を解決する。
3. 司令塔へ次の情報を送る。
   - PJ / institution
   - priority / due_at / SLA 残時間
   - trigger_type / ball_owner
   - recommended_first_move
   - risk_if_late
   - evidence_refs
   - draft_type
   - worker に渡すべき初期 prompt
4. 送信に成功したら `status='sent_to_commander'`, `sent_at=now()`。
5. 司令塔側で worker を切り、成果物ができたら `drafted`。
6. 相手送付や提案提示が終わったら `sent_to_counterpart` / `closed`。

司令塔向けメッセージ例:

```text
【先手力outbox】KUTE: 6/11キックオフ前 agenda / roadmap draft が必要

priority: red
due_at: 2026-06-08 18:00 JST
trigger: next_meeting_due
ball_owner: amd
draft_type: agenda + roadmap

推奨 first move:
6/11 キックオフで「6月は認定規程を通す。ただし7規程・シーズ発掘・after GTIEまで一本の制度として設計する」という進行案を先に提示する。

遅れた場合のリスク:
規程作成業者に見え、KUTE PJ の本来価値である大学発SUエコシステム設計者としてのポジションが弱くなる。
```

## Heartbeat schedule assumption: daily 10:15-20:15 hourly, 11 runs/day

前提:

- 毎日 10:15, 11:15, 12:15, 13:15, 14:15, 15:15, 16:15, 17:15, 18:15, 19:15, 20:15 JST。
- 1 日 11 回。
- heartbeat は outbox の pickup / commander 通知 / stale row escalation だけを担う。
- 重い draft 生成は heartbeat 内で行わない。heartbeat は worker 起票または司令塔通知まで。

取得条件の初期案:

```sql
SELECT *
FROM proactive_outbox
WHERE status IN ('queued', 'blocked')
  AND due_at <= now() + interval '72 hours'
ORDER BY
  CASE priority WHEN 'red' THEN 1 WHEN 'yellow' THEN 2 ELSE 3 END,
  due_at ASC,
  created_at ASC
LIMIT 20;
```

再通知:

- `sent_to_commander` で due_at を過ぎた row は、6 時間ごとに再通知。
- `blocked` は blocked_reason を含めて 24 時間ごとに再通知。
- `red` は毎 heartbeat で Dashboard / commander digest に含める。

## UI proposal

### Dashboard: TODO

Dashboard 上部または Management Score 近くに「TODO」を出す。Dashboard では、まだ司令塔通知前 / 司令塔対応中 / ブロック中の未完 TODO だけを最大3件に絞る。作成済み資料の確認や履歴確認は、各 PJ cockpit 側で見る。

表示:

- red / yellow 件数
- 期限が近い top 3
- PJ、相手、due、recommended_first_move
- `未送信` / `司令塔へ送信済み` / `blocked` の状態
- 行クリック時は PJ へ遷移せず、発生経緯・遅延リスク・作成済み資料リンク・次の期待アクションをモーダルで開く

### Cockpit: TODO panel

`/project/[projectId]/cockpit` に PJ 単位の TODO panel を置く。

表示:

- open outbox
- closed loop history
- SLA違反ログ
- 関連 MTG / source refs
- draft artifact refs

既存の Cockpit major sections を消さず、`CockpitMeetingSummary` と `CockpitStrategySignals` の間に小さく始める。通常PJ cockpit の旧 nudge カードは廃止済みなので、右カラム前提で置かない。

### Admin / commander view

全 PJ 横断の司令塔別 outbox 一覧。

filter:

- commander_thread_id
- priority
- status
- due range
- draft_type
- trigger_type

### SLA violation log

`proactive_loop_events.event_type='sla_breached'` を一覧化する。目的は責めるためではなく、AMD の提供価値が落ちるパターンを学習し、次回の trigger / SLA / commander routing を改善すること。

## Initial project coverage

初期対象:

| PJ | project_id | 初期対象理由 | 注記 |
|---|---|---|---|
| KUTE | p25 | 研究機関エコシステム構築。キックオフ / 年間ロードマップ提示が重要 | 初期 red になりやすい |
| ZMP / OkuDoor / 理科大連携 | p19 | こたさんから催促される前に事業連携を進める必要 | ZeMA対外呼称に注意 |
| CX | p20 | NIMS / CryoX 法人設立準備。NIMS OS導入の先行事例 | 重要 PJ |
| SX | p21 | 愛媛大 / PSI / 国策・PoC機会が多い | 先手提案の価値が高い |
| VSX / 香川大 | p26 | 初回訪問直後。称号・クロアポ・GAP・次回MTGが曖昧 | `ambiguous` を AMD ボール扱い |
| NIMS OS導入 | institution-level | FY27 OS導入準備。CX と連動 | PJ row がなければ institution loop |

初期対象外:

| PJ | 理由 |
|---|---|
| CLG | 社外取締役 / advisor 文脈。AMD 先手ループ初期対象から外す |
| LST | advisor / まさ個人関与が残る文脈。AMD 契約先手SLAと混同しない |

要判断:

| 領域 | 論点 |
|---|---|
| corporate-site | 受託・広報タスクとして扱うなら対象。PJ契約維持SLAとは別 |
| before-zero | 学術化レイヤーの internal work。外部 counterpart がある学会 / ジャーナル投稿期は対象化 |
| BZM / textbook | internal 知財構築は対象外。ただし NIMS / URA 向け納品 deadline がある場合は対象 |

## Example flows

### 香川大 / VSX

入力:

- 2026-05-28 初回訪問。
- 下川先生案件、香川大エコシステム構築、100万円予算、10月クロアポ見立て、次回 MTG、GAP / START、公募特定が残る。
- ボールは曖昧。香川大側の称号・クロアポ確定待ちでも、AMD から次の進め方を提示できる。

検知:

- `trigger_type='meeting_ended'`
- `ball_owner='ambiguous'`
- `priority='red'` または `yellow`
- `draft_type='next_action_plan'`
- `due_at = meeting_end + 48h`

recommended_first_move:

- 「6月前半に次回 MTG を置き、称号 / クロアポ / 株式 / 赤字補填 / GAP候補 / 下川案件 next action / 香川大エコシステム構築の扱いを一枚に整理して確認しましょう」という進行案。

risk_if_late:

- 初回訪問で得た信頼とスコープ拡大の熱が落ち、香川大側から次の整理を待つ状態になる。

### KUTE

入力:

- 2026-06-11（木）15:00 新宿キャンパスで対面キックオフ予定。
- 6/15 事前会議、6/22 教授総会が控える。
- KUTE は規程作成業者ではなく、大学発 SU エコシステム設計者として見せる必要がある。

検知:

- `trigger_type='next_meeting_due'`
- `ball_owner='amd'`
- `priority='red'`
- `draft_type='agenda'` + `roadmap`
- `due_at = next_meeting_start - 3 business days`

recommended_first_move:

- 6/11 キックオフ用 agenda と、6月から2027年1月までの制度設計ロードマップを AMD 側から提示する。

risk_if_late:

- 大学側の議論が「認定規程の細かい修正」だけに閉じ、KUTE PJ の本来価値であるエコシステム設計の主導権が弱くなる。

### ZMP / 理科大

入力:

- 東京理科大 産学連携機構との初回 MTG 後、堂脇先生 / 下水汚泥由来水素 / 水素吸蔵合金 / LCA / 社会実装研究への接続可能性がある。
- こたさんから「その後どうなっていますか」と聞かれる前に、AMD から連携提案を進める必要がある。

検知:

- `trigger_type='ball_ambiguous'` または `meeting_ended`
- `ball_owner='ambiguous'`
- `draft_type='email'` or `next_action_plan`
- `priority='yellow'`

recommended_first_move:

- 理科大側へ、堂脇先生への接続判断に必要な論点整理、葛飾ロード側の関心、次回打診文面案を送る。

risk_if_late:

- 葛飾ロード側から催促され、AMD が ZeMA プロジェクト統括として先に動けていない印象になる。

### CX

入力:

- NIMS / CryoX 法人設立準備、プレシード、CEO候補、事業計画、NIMS契約推進が並行している。
- NIMS OS導入 FY27 の先行事例として、CX の運用品質が仕組みレイヤーにも影響する。

検知:

- `trigger_type='deadline_approaching'` or `next_meeting_due`
- `ball_owner='amd'` or `shared`
- `draft_type='roadmap'` / `proposal`

recommended_first_move:

- 次回 NIMS / 神谷さん MTG 前に、法人設立・契約・特許・CEO候補・資金計画の論点表を AMD から提示する。

risk_if_late:

- CX の Before 0 推進力が落ち、NIMS 側の信頼と FY27 OS導入の説得材料が弱くなる。

### NIMS OS導入

入力:

- partner institutions 正本では NIMS の AMD OS 導入は FY27 予定、現在は Y 準備中。
- 機関導入は個別 PJ の進行とは別に、URA / EIR / security / onboarding / use case の準備が必要。

検知:

- `trigger_type='strategy_signal_needs_action'` or `deadline_approaching`
- institution-level loop。project_id は仮に `p00` または dedicated pseudo project を要判断。
- `draft_type='roadmap'`

recommended_first_move:

- FY27 導入開始ゲート、最小ユースケース、NIMS 側担当者、権限設計、URA onboarding playbook の準備項目をロードマップ化する。

risk_if_late:

- OS導入が「いつかやる」状態で流れ、AMD OS の仕組みレイヤー収益化が遅れる。

## Implementation phases

### Phase 0: Design acceptance

- この md を司令塔で review する。
- 先手力 loop が新 L2 なのか control layer なのかを確定する。推奨は control layer。
- 初期対象 PJ と対象外 PJ を確定する。
- heartbeat の運用主体を確定する。

### Phase 1: DB + helper MVP

- migration を追加する。
  - `project_commander_threads`
  - `proactive_loops`
  - `proactive_outbox`
  - `proactive_loop_events`
- `pwa/design/db_schema.md` を dump 更新する。
- helper script を追加する。
  - detect from meeting summaries
  - detect next meeting due
  - detect ambiguous ball
  - list queued outbox
  - mark sent / drafted / closed / blocked
- direct DB write ではなく、既存 automation と同じく helper / outbox / applier 境界を守る。

### Phase 2: heartbeat / commander notification

- daily 10:15-20:15 hourly の automation を登録する。
- `send_message_to_thread` 相当の送信 helper を接続する。
- commander_thread_id が未登録の PJ は Dashboard に `routing_missing` として出す。
- 送信済み / blocked / SLA breach を `proactive_loop_events` に残す。

### Phase 3: UI MVP

- Dashboard に TODO を出す。
- Cockpit に PJ 別 TODO を出す。
- Admin / commander view は Phase 3 後半でよい。

### Phase 4: Trigger expansion

- Gmail / Slack の counterpart nudge detector を追加する。
- D-6 `next_move` / `decision_state='proposed'` から action loop を作る。
- monthly report / MS / routine deadline と連動する。
- SLA 違反を Management Score の先手力 axis へ反映する。

## Open questions

1. `proactive_loops` は D-8 として扱うか、L2 とは別の control layer として扱うか。推奨は別 control layer。
2. NIMS OS導入のような institution-level loop の `project_id` をどう持つか。`p00` で会社全体扱いにするか、institution pseudo project を作るか。
3. `project_commander_threads` の初期 seed を誰が持つか。AMD総司令塔だけでなく、KUTE / ZMP / CX / SX / VSX 司令塔 thread をどう登録するか。
4. `sent_to_counterpart` を誰が押すか。司令塔 / PM / admin UI のどれを正本にするか。
5. Gmail / Slack の counterpart nudge detector で誤検知をどう抑えるか。初期は `candidate` 扱いで commander review を挟むべき。
6. CLG / LST 以外の advisor / まさ個人関与 PJ をどう判定するか。`project_category='advisor'` は初期対象外が自然。
7. before-zero / corporate-site のような internal / public artifact work を対象に含める条件をどう切るか。
8. SLA 違反を Management Score に反映する場合、重みをどう置くか。

## Next worker tasks

1. この md を AMD総司令塔で review し、control layer 方針と初期対象 PJ を確定する。
2. migration worker を切る。
   - `pwa/scripts/migrations/NNN_proactive_operating_loop.sql`
   - `pwa/design/db_schema.md` dump 更新
   - RLS は admin / service_role のみから始める
3. helper worker を切る。
   - `pwa/scripts/proactive_loop_tool.mjs`
   - commands: `detect-meetings`, `detect-next-meetings`, `list-outbox`, `mark-sent`, `mark-drafted`, `mark-closed`, `mark-blocked`
4. heartbeat worker を切る。
   - daily 10:15-20:15 hourly
   - commander notification
   - retry / dedupe / blocked handling
5. UI worker を切る。
   - Dashboard 「TODO」
   - Cockpit 「TODO」
   - Admin commander outbox view
6. seed worker を切る。
   - KUTE / ZMP / CX / SX / VSX / NIMS OS導入の initial commander_thread_id と initial loop を登録する。
7. Management Score worker を別途切る。
   - SLA breach / overdue count を先手力 axis にどう反映するかを設計する。

## Current truth vs proposal

Current truth:

- L2 は M-1〜D-7。5 生データから直接 L2 を抽出する。
- M-1D-5M-2D-6D-7 は Codex automation outbox と非LLM LaunchAgent applier 境界が正本。
- H-1 MTGサマリ / MTGフローは Windows MMO Codex Desktop automation が現行 writer。
- `project_meeting_summaries`, `project_strategy_signals`, `l2_notifications`, `meeting_notifications`, `source_cache` は既存テーブル。
- `/notifications` は L2 candidate の採否ゲートであり、表示だけで正本反映しない。
- Cockpit は PJ 状態、MS、月次、MTG、経営ハイライトの中心画面。

Proposal:

- 先手力維持ループは新しい control layer として `proactive_*` tables を追加する。
- 既存 L2 / source refs を入力にして、司令塔 / worker 向け outbox を作る。
- 重いドラフト生成は OS runtime ではなく Codex / えいみ / PJ 司令塔へ渡す。
- 初期 SLA は 48h first move、曖昧ボール 24h、次回 MTG 3営業日前、催促当日中。
