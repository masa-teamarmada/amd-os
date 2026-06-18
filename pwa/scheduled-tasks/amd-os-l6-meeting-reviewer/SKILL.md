---
name: amd-os-l6-meeting-reviewer
description: AMD OS H-1 MTGサマリの直後に走るツッコミ役。H-1が保存した `project_meeting_summaries` と raw Notion/Gmail/Drive/Slack/Calendar を見比べ、重大な経営判断・方針転換・CEO/資金調達/地元PoCなどが薄く丸まっていたら `l2_coverage_gaps` + `l2_notifications(l2_kind='coverage_gap')` に review_required として出す。H-1本文は自動上書きしない。
---

# AMD OS H-1 Meeting Reviewer

これは H-1 MTGサマリ本体ではなく、**H-1の直後に走る別人格のレビュー automation**。

## 目的

H-1 extractor の問いは「この会議を議事録化する」。  
本 reviewer の問いは「raw にある重大な経営判断が、H-1保存結果で薄く潰れていないか」。

2026-06-10 SX 愛媛大訪問では、raw Notion 文字起こしに「まさがCEOを引き受ける覚悟」「VC主軸から地元勢・PoC・共同開発費へ寄せる大転換」があったのに、初回H-1/D-6では「石原先生=開発管理、まさ=BizDev」「VCより補助金・地元企業」程度に丸まった。この事故の再発防止が本 routine の直接目的。

## 必ず読む

1. `pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md`
2. `pwa/design/meeting_summaries.md`
3. `pwa/design/coverage_gap_scanner.md`
4. `pwa/design/L2_DATA.md`
5. `pwa/design/db_schema.md`
6. `pwa/scripts/lib/h1_meeting_summary_reviewer.mjs`

## 実行タイミング

- H-1 `amd-os-l6-meeting-flow` が開催済みMTGを保存した直後、または毎時H-1 run の最後。
- 対象は `project_meeting_summaries.updated_at` が直近 90 分以内、`source_kinds` が `none` / `upcoming` / `upcoming_tentative` ではない行。
- `notion_url` がある行を優先する。Notion が無い行も、Gmail/Drive/Slack の raw が取れるなら対象にしてよい。

## 入力

対象 meeting row から最低限読む:

- `meeting_id`, `project_id`, `ym`, `meeting_date`, `meeting_start_at`, `title`
- `notion_url`, `notion_page_id`, `source_url`, `calendar_event_id`
- `source_kinds`, `summary_short`, `decided`, `progress`, `next_actions`, `risks`, `narrative_md`
- `updated_at`, `generated_at`, `generated_by_model`

raw source:

- Notion: visible summary だけで止まらず、**文字起こし / transcript block** まで読む。
- Gmail/Drive/Slack/Calendar: H-1が使った source refs があれば同じ raw を再取得する。
- Notion connector が `UNAUTHORIZED oauth_token_invalid_grant` の場合、Codex Desktop / Chrome のログイン済みNotionを使って確認する。認証切れだけで諦めない。

## レビュー観点

これは要約品質レビューではなく、**重大情報の落ち検知**。

特に以下を raw から探す:

- CEO / 社長 / 代表 / 就任 / 引き受け / 担う / やってもらいたい / なってほしい
- VC / フルコミット / 兼任 / 出資しない / 投資家 / 調達方針
- 地元 / ダイキ / 大輝 / ダイキアクシス / 三浦工業 / 伊予銀 / いよぎん / 今治 / 今治造船 / 太陽石油
- PoC / 共同開発費 / 導入 / プレス / リリース / 発表 / 派手 / ゴリゴリ / 巻き込む
- 旧正本と逆方向の発話: 外部CEO候補→まさCEO、VC主軸→地元勢、単なるPoC候補→地域発の大型実装、など

危険な丸まり:

- raw は「CEO/社長を誰が担うか」なのに、H-1保存結果が「BizDev分担」だけになっている。
- raw は「VC前提が崩れた」なのに、H-1保存結果が「補助金・地元企業も検討」程度になっている。
- raw は「過去前提の反転」なのに、D-6で `strategic_pivot` / `management_decision` / `critical` へ上がらない。
- raw は「当事者の覚悟・受諾・合意」なのに、H-1保存結果がタスク列挙だけになっている。

## 判定手順

1. raw transcript text と saved H-1 text を作る。
   - saved H-1 text = `summary_short + narrative_md + decided + progress + next_actions + risks`
2. deterministic guard を走らせる。

```bash
cd pwa
node scripts/review_h1_meeting_summary.mjs --fixture scripts/__fixtures__/h1_meeting_summary_reviewer_sx_pivot.json
```

実運用では fixture ではなく、対象 meeting row と raw transcript を以下の形にして stdin に渡す:

```json
{
  "meeting_id": "...",
  "project_id": "p21",
  "meeting_date": "2026-06-10",
  "title": "...",
  "notion_url": "...",
  "raw_text": "<Notion文字起こし/Gmail/Drive/Slack rawの短縮結合>",
  "summary_short": "...",
  "narrative_md": "...",
  "decided": [],
  "progress": [],
  "next_actions": [],
  "risks": []
}
```

3. guard が `items[]` を返したら、LLM reviewer として「これは本当に重大情報の落ちか」を短く再確認する。
4. confirmed な落ちなら `POST /api/coverage-gaps/extract` に渡す。

## 出力

`POST /api/coverage-gaps/extract`:

```json
{
  "items": [
    {
      "source": "notion",
      "source_ref": "<notion_page_id or notion_url>",
      "source_hash": "h1-review:<sha256>",
      "title": "H-1要約で創業体制/資金調達転換が薄まった可能性: ...",
      "summary": "raw transcriptには CEO/代表・就任合意 / VC前提の破れ / 地元勢・PoC・共同開発費 が出ているが...",
      "salience_score": 0.9,
      "matched_patterns": { "reviewer": "h1_meeting_summary_reviewer" },
      "proposed_target_l2": "strategy_signal",
      "gap_class": "extractor_miss",
      "project_id": "p21",
      "scope": "project",
      "evidence_refs_json": {
        "meeting_id": "...",
        "meeting_date": "...",
        "title": "...",
        "notion_url": "...",
        "snippets": ["short snippet only"],
        "saved_summary_preview": "..."
      }
    }
  ]
}
```

この route が `l2_coverage_gaps(review_status='candidate')` と `l2_notifications(l2_kind='coverage_gap')` を作る。raw全文は保存しない。

## H-1結果報告へのツッコミ

H-1 run summary / result chat には、reviewer の結果を必ず短く入れる。

```
H-1 reviewer:
- review_required: 1
  - SX 1on1 杉浦先生: rawに CEO/VC/地元勢転換があるのにH-1要約がBizDev分担へ丸まり気味。coverage_gap に送信済み。
```

ゼロ件なら:

```
H-1 reviewer: no critical omissions detected
```

## 禁止

- H-1 row を reviewer が自動上書きしない。修正は `coverage_gap` → `/notifications` → 人間確認後。
- raw Notion/Gmail/Slack/Drive全文を DB に保存しない。
- 「Notion認証切れ」だけでレビューを諦めない。少なくとも `reviewer_blocked_notion_auth` を run summary に残す。
- ordinary TODO や日程調整を gap にしない。これは「重大情報が落ちたか」だけを見る。
