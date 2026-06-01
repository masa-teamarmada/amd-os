---
name: amd-os-l9-strategy-signal-extract
description: AMD OS L2 ⑨ 経営ハイライト抽出の repo 正本。現行 writer は Codex automation `amd-os` + non-LLM LaunchAgent applier。active PJ × 当月/前月の 5 生データ + OS snapshot から「進んだこと・起きたこと」(= done のみ、未了は除外、まさ #26) を抽出し、`strategySignals` outbox JSON を `/Users/masa/.codex/automations/amd-os/strategy-signals-outbox/` に作る。Supabase `project_strategy_signals` への upsert は `ms_progress_review_tool.mjs apply-outbox-dir --dir` が行う。DB/APIへ直接書き込まない。
---

# AMD OS L2 ⑨ 経営ハイライト抽出 automation

## 設計の要点
- Codex automation `amd-os` (= daily 03:20 JST) が `strategy-signals-outbox` に JSON を吐く → LaunchAgent applier → Supabase 反映
- この SKILL は outbox payload の生成仕様。DB/API へ直接書き込まない
- 古い Claude routine / direct Supabase REST 移植案は履歴扱い。復活させない
- **中身ルール (= まさ #26 確定 2026-05-24)**: 「進んだこと・起きたこと」だけ書く (= done のみ、未了 / TODO / アイディアは TODO かんばん側、本 routine では除外)
- **signal_type**: management_decision / business_progress / strategic_pivot / commercial_progress / partnership / funding / ip_regulatory / tech_progress / risk / next_move (= 10 種)
- **impact_level**: low / medium / high / critical
- **polarity** (= まさ #29 2026-05-24、migration 090 適用後): breakthrough (🎉) / forward (✨) / pivot (🔄) / risk (⚠️) (= 🌐 中立廃止)
- **score_impact_summary** (= まさ #31 2026-05-24、migration 090 適用後): 「📊 影響: TRL 4→5、X 軸 +40pt」短文
- **company vital scope** (= migration 118): `signal_scope` / `applies_to_company_score` / `pipeline_status` / `pipeline_probability` / `expected_amount_yen` / `expected_contract_ym` / `company_score_axis` / `scope_reason`。PJ cockpit表示と Management Score 採用可否を分ける
- 修正依頼は対話型 (= 経営ハイライト UI で 「⚠️ つくよみに修正依頼」 → /api/notifications/feedback/dialog/start → 提案 → 適用) で運用、本 routine では `l2_feedbacks` 読み込んで prompt に反映

## 反映経路

outbox は `/Users/masa/.codex/automations/amd-os/strategy-signals-outbox/*.json` に保存する。LaunchAgent `jp.teamarmada.amd-os-ms-outbox-applier` が 5 分ごとに `pwa/scripts/ms_progress_review_tool.mjs apply-outbox-dir --dir /Users/masa/.codex/automations/amd-os/strategy-signals-outbox` を実行し、成功ファイルを `applied/`、失敗ファイルを `failed/` へ移動する。

## 【絶対】 動く前に必ず Read
1. `pwa/manual/3-2-data-and-extraction.md` §3.2-3.4
2. `pwa/manual/9-1-decisions-and-history.md` §5.2 (= 経営ハイライト改訂経緯、done のみルール)
3. `pwa/design/project_strategy_signals.md` (= L2 ⑨ 仕様正本)
4. `pwa/design/strategy_signals_redesign.md` (= 4 分類 + polarity 設計)
5. `pwa/design/feedback_dialog.md` (= 対話型修正依頼)
6. `pwa/design/db_schema.md` (= project_strategy_signals 列名)
7. `/Users/masa/.codex/automations/amd-os/automation.toml` (= 元実装 prompt)

═══════════════════════════════════════════════════
Phase 0: env + active projects + ymList
═══════════════════════════════════════════════════

```bash
ENV=pwa/.env.local
SUPABASE_URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' "$ENV" | cut -d= -f2-)
SRK=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' "$ENV" | cut -d= -f2-)
```

- `projects?status=eq.active&select=project_id,project_name,slack_channel_id,drive_folder_id,report_emails,project_category`
- 全 active PJ + 会社全体 p00 (= AMD 全体経営判断、別扱い)
- ymList = [当月 (JST), 前月]
- 1 回 max 5 PJ (= 残りは翌日)

═══════════════════════════════════════════════════
Phase A: 5 生データ + OS snapshot 収集
═══════════════════════════════════════════════════

各 (projectId, ym) について:

### A-1: OS snapshot
- `monthly_reports?project_id=eq.<projectId>&ym=eq.<ym>&status=neq.invalid` (= 当月 + 前月)
- `project_meeting_summaries?project_id=eq.<projectId>&ym=eq.<ym>&source_kinds=neq.none&order=meeting_date.desc&limit=30`
- `project_xrl_log?project_id=eq.<projectId>&order=created_at.desc&limit=5` (= 直近 XRL 変化)
- `amd_score_inputs?project_id=eq.<projectId>&order=evaluated_at.desc&limit=3` (= 直近 AMD Score)
- p00 のみ追加: `amd_management_score_snapshots` 直近 3 ヶ月 + `amd_management_score_evidence` 直近 1 ヶ月

### A-2: 5 生データ補強 (= 必要に応じて MCP 直叩き)
- Gmail / Notion / Calendar / Slack / Drive で当月の関連 events / messages

### A-3: 既存 signals (= 重複防止)
- `project_strategy_signals?project_id=eq.<projectId>&ym=eq.<ym>&status=in.(candidate,confirmed)&select=signal_id,signal_type,title,source_hash`

### A-4: past l2_feedbacks
- `l2_feedbacks?l2_kind=eq.project_strategy_signal&target_id=eq.<projectId>&status=eq.active`

═══════════════════════════════════════════════════
Phase B: LLM 抽出 (= 私自身、done のみ / polarity 必須)
═══════════════════════════════════════════════════

**抽出ルール**:
- **🚨 done のみ** (= まさ #26 確定 2026-05-24): 「進んだこと・起きたこと」だけ抽出。未了 / TODO / アイディアは除外
- **signal_type** (10 種):
  - 経営全般: `management_decision` (方針決定) / `strategic_pivot` (戦略転換) / `funding` (資金) / `next_move` (次の一手 = ただし done 系のみ、未了は除外)
  - 事業開発: `business_progress` / `commercial_progress` (商談・売上) / `partnership` (提携)
  - 技術開発: `tech_progress` (自社特許・技術スタック進捗)
  - 外部環境: `ip_regulatory` (他国規制動向) / `risk` (重要リスク、ただし発生済 = done)
- **impact_level**: low / medium / high / critical
- **polarity** (= migration 090 後): breakthrough (🎉) / forward (✨) / pivot (🔄) / risk (⚠️) (= 必ず set)
- **score_impact_summary**: 「📊 影響: TRL 4→5、X 軸 +40pt」のような 1 行 (= null OK だが書ける時は書く)
- title 30-50 chars、summary 80-200 chars
- source_refs_json は short snippet (200 chars) + source_url + hash のみ (= 全文禁止)
- source_hash = sha256(JSON.stringify(source_refs + title))
- 既存 source_hash と同じなら出さない (= 重複防止)
- past_feedbacks 必ず反映
- 「経営判断未了」「○○の方針未定」のような未了系は **絶対に出さない** (= まさ #26)
- Management Score会社バイタル分類:
  - AMD会社全体の売上、入金、契約見込み、営業pipeline、資金繰り、人員稼働、資源配分へ直接効く signal は `signal_scope="company"` or `"cross_project"`, `applies_to_company_score=true`, `company_score_axis` を必ず入れる
  - 個別PJの技術・実験・設立・顧客/装置/研究論点だけなら `signal_scope="project"`, `applies_to_company_score=false`
  - 契約前でも香川大/KUTE/NIMSのような高確度案件は `company_score_axis="pipeline"`, `pipeline_status="high_confidence"`, `pipeline_probability>=0.75`, `expected_contract_ym` を入れる
  - `scope_reason` は対象/非対象にした根拠を1文で残す

**出力 JSON のみ**:
```json
{
  "signals": [
    {
      "project_id": "<projectId>",
      "ym": "<ym>",
      "signal_date": "<YYYY-MM-DD>",
      "scope_key": "<ym>:strategy:<source_hash 先頭 12 chars>",
      "signal_type": "<10 種から>",
      "title": "<30-50 chars>",
      "summary": "<80-200 chars>",
      "impact_level": "low|medium|high|critical",
      "polarity": "breakthrough|forward|pivot|risk",
      "score_impact_summary": "<1 行 or null>",
      "signal_scope": "company|project|cross_project",
      "applies_to_company_score": true,
      "pipeline_status": "prospect|high_confidence|contracting|contracted|lost|deferred|null",
      "pipeline_probability": 0.5,
      "expected_amount_yen": 1000000,
      "expected_contract_ym": "202606",
      "company_score_axis": "pipeline|funding|runway|finance|capacity|decision|resource_allocation|revenue|null",
      "scope_reason": "<会社スコア対象/非対象の根拠1文>",
      "decision_state": "observed|proposed|decided|executing|revised",
      "source_refs_json": [ { "kind": "...", "ref_id": "...", "snippet": "<200 chars>", "source_url": "...", "hash": "..." } ],
      "source_hash": "<sha256>",
      "confidence": 0.5-0.9
    },
    ...
  ]
}
```

═══════════════════════════════════════════════════
Phase C: Supabase upsert + 通知
═══════════════════════════════════════════════════

### C-1: project_strategy_signals upsert
```
POST $SUPABASE_URL/rest/v1/project_strategy_signals
body: {
  ...signal 全部
  "status": "candidate",
  "created_by": "claude_routine_l9",
  "extraction_run_id": "<run UUID>"
}
Prefer: return=minimal
```

### C-2: l2_notifications upsert (= signals.length > 0)
```
body: {
  "l2_kind": "project_strategy_signal",
  "target_id": "<projectId>",
  "scope_key": "<ym>",
  "title": "🚀 <projectName> (<ym>) 経営ハイライト候補 (<N>件)",
  "summary": "<top 3 signal_type:title joined / >",
  "saved_count": <N>,
  "total_count": <N>,
  "importance": 3
}
```

### C-3: feedback applied_count++

═══════════════════════════════════════════════════
Phase D: run summary
═══════════════════════════════════════════════════

- signal_type 別件数
- polarity 別件数
- まさへの 1 行サマリ:
  `🚀 経営ハイライト routine 03:20 完了: N PJ チェック、M signals (= breakthrough=X, forward=Y, pivot=Z, risk=W)`

【禁止】
- 未了 / TODO / アイディアを signal にする (= まさ #26、done のみ)
- polarity を null で出す (= migration 090 後は必ず 4 種から選ぶ、🌐 中立は廃止)
- 全文 / 議事録全文 / メール全文を source_refs_json に含める (= snippet 200 chars + hash のみ)
- 既存 source_hash と同じ signal を再提出
- past_feedbacks 無視 (= まさが対話型 UI で修正依頼してたら必ず prompt に注入)
- 「経営判断未了」「次の一手 (未決)」を next_move として出す (= 未了系は TODO かんばん側)

【参考】
- 経営ハイライト修正依頼は対話型 (= `/api/notifications/feedback/dialog/{start,refine,confirm}`) で運用、本 routine は次回 cron で l2_feedbacks 反映
- p00 (= AMD 全体) は別扱い、Management Score / freee / 月次運用関連の signal を抽出
