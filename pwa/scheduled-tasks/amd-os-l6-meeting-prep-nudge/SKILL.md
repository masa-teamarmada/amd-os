---
name: amd-os-l6-meeting-prep-nudge
description: AMD OS H-1 MTG Prep Worker のつくよみ nudge 役。毎朝 07:30 JST (= spawner 06:30 の 1 時間後)、`prep_worker_status='ready'` かつ `prep_concierge_nudged_at IS NULL` かつ 翌48h 開催の MTG を全件拾い、まさ専用 Slack DM 1本にまとめてつくよみ口調で通知する。session URL + readiness pill + 今日の空き枠 vs prep 見積比較を含める。nudge は LLM を呼ばず、deterministic に template に埋めて投げる。
---

# AMD OS H-1 MTG Prep Nudge

つくよみが翌48h MTG の prep 状況を まさ専用 Slack DM 1本でまとめて知らせる。「worker起動済みだよ〜、▶ tap で開けるよ」だけ。

## 設計の核

- **判断しない**。worker が ready 状態に到達したものを拾って template に流し込むだけ
- **まさ専用 DM だけ**。PJ の facilitator (kaz / かる / ちこ等) には送らない (= まさが議題分配を判断する)
- **1日1回まとめ送信**。MTG 1件ごとに別 DM を送らない (= うるさい)
- **重複送信防止**: `prep_concierge_nudged_at` を見て、既に送った MTG は除外
- **failed の MTG も別ブロックで通知** (= 「手動で claude code 開いて」と告げる)
- **つくよみキャラ正本**を尊重: 普段「そうかなあ…」「いいとおもうよー (しらんけど)」「別にいいよお〜」。月モチーフ・おっとり女子。緊急性を煽らない

## 【絶対】 動く前に必ず Read

1. `pwa/spec/3-3-meeting-flow-current-spec.md` の「MTG Prep Worker」節 (= 仕様正本)
2. `pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/SKILL.md` (= worker 出力の構造)
3. `memory/feedback_tsukuyomi_character_tone.md` (= つくよみ口調)

## cron

毎朝 **07:30 JST** (= spawner 06:30 から 1 時間遅らせて worker が draft 生成完了する時間を確保)

═══════════════════════════════════════════════════
Phase 0: env と対象抽出
═══════════════════════════════════════════════════

1. cwd を `/Users/masa/projects/AMD/amd-os` に固定
2. `pwa/.env.local` から SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SLACK_BOT_TOKEN / SLACK_USER_ID_MASA をロード
3. nudge 対象を抽出:

```sql
SELECT pms.meeting_id, pms.project_id, pms.title,
       pms.meeting_start_at, pms.source_kinds,
       pms.prep_readiness_score, pms.prep_readiness_reasons,
       pms.prep_worker_status, pms.prep_worker_session_url,
       pms.prep_draft_md,
       p.project_name
FROM project_meeting_summaries pms
JOIN projects p USING (project_id)
WHERE pms.source_kinds LIKE '%upcoming%'
  AND pms.meeting_start_at BETWEEN now() AND now() + interval '48 hours'
  AND pms.prep_concierge_nudged_at IS NULL
  AND pms.prep_worker_status IN ('ready', 'failed', 'preparing')
ORDER BY pms.meeting_start_at ASC
```

(= `preparing` も含めるのは「worker起動はしたけど draft 途中」を ready と分けて通知するため)

═══════════════════════════════════════════════════
Phase 1: 今日のまさ空き枠を計算
═══════════════════════════════════════════════════

1. Calendar freebusy API でまさの今日 (= JST today 09:00-21:00) の busy window を取得
2. 09:00-21:00 から busy を引いて空き枠 list を作る
3. 各空き枠は最小 30 分単位、合計時間も計算

═══════════════════════════════════════════════════
Phase 2: prep 見積時間の合計
═══════════════════════════════════════════════════

各 MTG の prep 見積時間:
- readiness ≥ 80: 0.5h (= 最終確認のみ)
- readiness 50-79: 1.5h (= 着地点詰め + 資料微修正)
- readiness < 50: 3h (= 着地点議論 + 資料一から作り直し)

(= 経験則。後で実データから補正する)

合計 prep 見積を計算。

═══════════════════════════════════════════════════
Phase 3: Slack DM 本文 生成
═══════════════════════════════════════════════════

template (= つくよみ口調、月モチーフ、おっとり):

```
🌙 まさ、明日と明後日の MTG prep worker、もう動かしといたよー

{ready の MTG 1件ずつ:}
📌 {MTG タイトル} ({日付} {HH:MM}, {project_name}, {対面/オンライン推定})
   readiness {score}/100  {緑●/黄●/赤●}
   worker準備完了 → ▶ {prep_worker_session_url}
   {readiness が 50 未満なら 1行コメント: 「資料draftは作ったけど着地点要相談」}

{preparing の MTG 1件ずつ:}
🌀 {MTG タイトル} ({日付} {HH:MM}, {project_name})
   worker 準備中… draft 出来上がり待ち
   → ▶ {prep_worker_session_url} (まだ薄いかも)

{failed の MTG 1件ずつ:}
⚠️ {MTG タイトル} ({日付} {HH:MM}, {project_name})
   worker 起動失敗 ({reason})
   手動で claude code 開いて準備してね

今日のまさ空き枠 ({JST today 日付}): {空き枠 list}
   合計 {合計 hours}h
prep 見積: {MTG ごとの内訳} 合計 {合計 hours}h
{空き枠 ≥ 見積なら} ✅ 収まるよ
{空き枠 < 見積なら} ⚠️ {不足 hours}h 足りないかも。明日朝に回すなら教えて〜

(明日のMTGは今日中、明後日のMTGは明日でも間に合うよ)
```

**例**:
```
🌙 まさ、明日と明後日の MTG prep worker、もう動かしといたよー

📌 KUTE定例 (明日 10:00, KUTE, オンライン)
   readiness 75/100  🟡
   worker準備完了 → ▶ https://codex.cloud.openai.com/runs/abc123

📌 pHydrogen KR訪問 (明後日 14:00, pHydrogen, 対面)
   readiness 35/100  🔴
   worker準備完了 → ▶ https://codex.cloud.openai.com/runs/def456
   資料draftは作ったけど着地点要相談

今日のまさ空き枠 (2026-06-22):
   14:00-15:30 (1.5h)
   17:00-18:00 (1.0h)
   合計 2.5h
prep 見積: KUTE 0.5h + pHydrogen 3.0h = 3.5h
⚠️ 1.0h 足りないかも。明日朝に回すなら教えて〜
```

═══════════════════════════════════════════════════
Phase 4: Slack DM 送信
═══════════════════════════════════════════════════

```
POST https://slack.com/api/chat.postMessage
Authorization: Bearer {SLACK_BOT_TOKEN}
{
  "channel": "{SLACK_USER_ID_MASA}",
  "text": "{Phase 3 で生成した本文}",
  "unfurl_links": false,
  "unfurl_media": false
}
```

(= unfurl 切ることで session URL が link preview で展開されてDM が長くなるのを防ぐ)

═══════════════════════════════════════════════════
Phase 5: nudge 記録
═══════════════════════════════════════════════════

通知に含めた全 MTG (ready / preparing / failed) について:
```
PATCH /rest/v1/project_meeting_summaries?meeting_id=eq.{meeting_id}
{
  "prep_concierge_nudged_at": "{now ISO}"
}
```

= 同じMTGに対して同じ日に二度通知しないようにする。

## エラーハンドリング

| 状況 | 対応 |
|---|---|
| 対象 MTG 0件 | nudge skip。run summary に `nudge_skipped: no eligible meetings` |
| Slack API auth 失敗 | run abort、CRON_SECRET 連携で PWA `/api/cron/alert` に通知。`prep_concierge_nudged_at` は touch しない |
| Slack rate limit | exponential backoff × 3 回 |
| Calendar freebusy 失敗 | 空き枠表示部分だけ「空き枠取得失敗」と置換、本文の他は出す |

## 禁止事項

- LLM を呼ばない (= deterministic template 流し込みのみ)
- まさ以外 (= 各 PJ facilitator) に同じ DM を送らない
- 既に nudge 済みの MTG を再送しない (= `prep_concierge_nudged_at` で重複防止)
- 緊急性を煽る文言を使わない (= つくよみは普段おっとり、月モチーフ)
- worker が failed でも黙って捨てない (= 必ず別ブロックで通知)
- 同 MTG に対して 1 日に複数回送らない
- session URL を unfurl させない (= DM が肥大化する)
