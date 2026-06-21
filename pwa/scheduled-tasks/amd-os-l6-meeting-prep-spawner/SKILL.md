---
name: amd-os-l6-meeting-prep-spawner
description: AMD OS H-1 MTG Prep Worker の起動役。毎朝 06:30 JST、翌48h の upcoming MTG を全件拾い、各 MTG ごとに `amd-os-l6-meeting-prep-worker` を Codex Cloud automation として 1 回限り動的 spawn する。spawn 完了したら `project_meeting_summaries` の `prep_worker_status='spawning'` + `prep_worker_session_id` + `prep_worker_session_url` + `prep_worker_spawned_at` を upsert。spawner 自体は LLM を呼ばず、deterministic。
---

# AMD OS H-1 MTG Prep Spawner

`amd-os-l6-meeting-prep-worker` を翌48h MTG ごとに 1 つ動的 spawn する薄い役。**spawner は判断しない**、対象を拾って worker run を Codex Cloud 上に登録するだけ。

## 設計の核

- **1 MTG = 1 worker run**。複数 MTG をまとめて 1 worker に投げない
- **spawn 即発火**。worker 側で文脈ロード〜draft 生成まで全部やる
- **deterministic**。spawner は LLM 呼ばない、SQL とごく短い HTTP 呼び出しだけ
- **既に worker が走っている / ready の MTG は skip**。`prep_worker_status` を見て重複 spawn を防ぐ
- **ended / frozen PJ、`upcoming_tentative` は対象外** (= 既存 H-1 の進捗ベース原則と整合)

## 【絶対】 動く前に必ず Read

1. `pwa/spec/3-3-meeting-flow-current-spec.md` の「MTG Prep Worker」節 (= 仕様正本)
2. `pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/SKILL.md` (= 呼び出す worker の引数仕様)
3. `pwa/design/db_schema.md` の `project_meeting_summaries` (= prep_* 列の正確な型)

## cron

毎朝 **06:30 JST** (= nudge 07:30 より 1 時間早く、worker が文脈ロード〜draft 生成する時間を確保)

═══════════════════════════════════════════════════
Phase 0: env と対象抽出
═══════════════════════════════════════════════════

1. cwd を `/Users/masa/projects/AMD/amd-os` に固定
2. `pwa/.env.local` から SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / CODEX_CLOUD_API_TOKEN をロード
3. 対象 MTG を抽出:

```sql
SELECT pms.meeting_id, pms.project_id, pms.title, pms.meeting_start_at,
       pms.source_kinds, pms.calendar_event_id,
       p.status AS project_status, p.freeze_from_ym
FROM project_meeting_summaries pms
JOIN projects p USING (project_id)
WHERE pms.source_kinds LIKE '%upcoming%'
  AND pms.source_kinds NOT LIKE '%upcoming_tentative%'
  AND pms.meeting_id NOT LIKE 'upcoming-tentative:%'
  AND pms.meeting_start_at IS NOT NULL
  AND pms.meeting_start_at BETWEEN now() AND now() + interval '48 hours'
  AND (pms.prep_worker_status IS NULL OR pms.prep_worker_status = 'failed')
  AND p.status IN ('active', 'sales')
ORDER BY pms.meeting_start_at ASC
```

(= PostgREST 経由なら `?or=(prep_worker_status.is.null,prep_worker_status.eq.failed)` を組み合わせる)

ended / frozen / `freeze_from_ym <= 当月ym` は対象外。recurring MTG はすでに `calendar-sync` 時点で series 次回1件に絞り込まれているので、ここでは再 dedup 不要 (= 念のため `recurring_series_future_occurrence` の skip 判定だけ追加してもよい)。

═══════════════════════════════════════════════════
Phase 1: 各 MTG ごとに worker を動的 spawn
═══════════════════════════════════════════════════

各対象 MTG について順に:

1. `worker_name` を生成: `amd-os-l6-prep-{meeting_id をハッシュ8桁化}` (= 命名が長すぎる Codex Cloud のキャップ回避)
2. Codex Cloud REST API で 1 回限り automation を登録:
   ```
   POST https://codex.cloud.openai.com/api/v1/runs
   Authorization: Bearer {CODEX_CLOUD_API_TOKEN}
   Content-Type: application/json
   {
     "name": "{worker_name}",
     "instructions": "pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/SKILL.md を読んで meeting_id={meeting_id} project_id={project_id} で実行。終了後 session は idle のまま残してまさが入ってきたら対話継続できる状態を保つ。",
     "schedule": "once",
     "model": "gpt-5.5",
     "reasoning_effort": "high"
   }
   ```
   - 実装の現実: Codex Cloud REST API の正確な path / payload schema は別途確認が必要。spawner SKILL では「API 呼び出しに必要な情報を渡す」抽象記述に留め、初回手動 test 時に正確な spec を確認する
3. レスポンスから `run_id` と `run_url` を取得
4. `project_meeting_summaries` に upsert:
   ```
   PATCH /rest/v1/project_meeting_summaries?meeting_id=eq.{meeting_id}
   {
     "prep_worker_status": "spawning",
     "prep_worker_session_id": "{run_id}",
     "prep_worker_session_url": "{run_url}",
     "prep_worker_spawned_at": "{now ISO}"
   }
   ```
5. spawn 失敗時は `prep_worker_status='failed'` + run summary に `reason` を記録、次の MTG へ続行

═══════════════════════════════════════════════════
Phase 2: run summary 出力
═══════════════════════════════════════════════════

各 spawn 結果を1行ずつ:
```
[meeting_id]  [project_id]  [meeting_start_at]  [status: spawned|failed]  [run_url|reason]
```

集計:
- 対象 MTG 数
- spawn 成功数 / 失敗数
- skip 数 (= 既に ready / preparing 中)

## エラーハンドリング

| 状況 | 対応 |
|---|---|
| Codex Cloud API auth 失敗 | run abort、CRON_SECRET 連携で PWA `/api/cron/alert` に通知 |
| Codex Cloud API rate limit | exponential backoff (= 5s, 15s, 45s) × 3回、超えたら次の MTG へ |
| Supabase upsert 失敗 | 当該 MTG のみ skip、次へ続行 |
| `meeting_start_at IS NULL` の row | skip (= 既存 deterministic gate と整合) |

## 禁止事項

- LLM を呼ばない (= spawner は判断しない)
- worker の prep 内容を spawner 側で生成しない
- 同じ MTG に複数 worker を spawn しない (= status check で重複防止)
- ended / frozen PJ を対象にしない (= 既存 H-1 と同じ進捗ベース原則)
- recurring MTG の同シリーズで連続 occurrence を spawn しない (= series 次回1件のみ)
- spawn 失敗を黙って捨てない (= 必ず `prep_worker_status='failed'` で記録)
