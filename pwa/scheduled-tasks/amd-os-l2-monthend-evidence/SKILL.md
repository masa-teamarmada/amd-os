---
name: amd-os-l2-monthend-evidence
description: AMD OS month-end L2 evidence 抽出を 1 本の claude routine に束ねたもの (= M-1〜M-3)。月末候補日 16:00 JST 発火 (cron `0 16 28-31 * *`)、Phase 0 で「今日 == 当月最終日」判定し、最終日でなければ即 exit。最終日のみ M-1 monthly_reports → M-2 XRL根拠 → M-3 Management Monthly Signal の順に inline 実行し、17:00 JST までに完了させる (= 月末最終日 18:00 の月次振り返り MTG に間に合わせる)。claude.ai/code/routines (cloud / Anthropic-managed、サブスク定額枠、Sonnet 4.6)。daily 分 (D-1〜D-11) は別 routine `amd-os-l2-consolidated-evidence`、weekly 分 (W-1) は別 routine `amd-os-l2-weekly-vc-funding-signals`、毎時 (H-1) は MMOマシン Codex Desktop automation。
---

# AMD OS Month-end L2 Evidence routine (M-1〜M-3)

> **これは何か**: 月末にだけ抽出すべき L2 evidence を **1 本の claude routine** に束ねたもの。
> M-1 monthly_reports → M-2 XRL根拠 → M-3 Management Monthly Signal を **依存順** で実行。
> 2026-06-08 まさ確定の cadence ベース新ナンバリング (D / M / W / H)。

## 🚨 登録事故の current truth (2026-06-04)

- このリポの SKILL は素材であって、claude routine 登録済みの証拠ではない。
- **claude routine** = `claude.ai/code/routines` に存在し `ACTIVE` / `next run` / `last run` を確認できるものだけ。
- claude routine (cloud) はマシン非依存。Mac を閉じても・どのマシンが OFF でも Anthropic クラウドで発火する。
- 旧 Mac Local scheduled task (`~/.claude/scheduled-tasks/`) はマシン依存で全 disabled・未実行だった。これに戻さない。

## 設計の要点 (2026-06-04 まさ確定)

- **背景**: M-1 M-1 monthly / M-2 M-2 XRL / M-3 M-3 Management Signal は **全部「月末」cadence**。当初 B (month-end) と D (17:00) に分けていたが、3 つとも月末で、依存関係 (M-1 → M-2 → M-3) もあるため **1 routine に統合** (= run 消費も月末日 +1 だけ)。
- **発火**: 月末候補日 16:00 JST。cron `0 16 28-31 * *`。
- **最終日判定**: cron に「月の最終日」概念は無いため `28-31` で月末候補日に発火し、**Phase 0 で JST 判定**。今日が当月最終日でなければ本処理を一切実行せず 1 行 summary で即 exit (= 空振り run。月 3-4 回、daily run cap には全く触れない)。
- **完了目標**: 16:00 開始 → **17:00 JST までに M-3 まで完了**。理由 = 月末最終日 18:00 に月次振り返り MTG があり、その前に M-3 Management Signal まで出揃わせる。1 時間バッファ。差分検知で skip 多い月は 15-20 分で終わる。
- **実行環境**: claude.ai/code/routines (cloud sandbox VM、Pro/Max/Team サブスク内、Sonnet 4.6)。
- **入力**: AMD OS repo auto-clone + Connector (Supabase / Gmail / Drive / Calendar / Notion / Slack)。

## 新ナンバリング ↔ 旧番号 番号 対応

| 新 | 旧番号 | 名称 | table | 既存 SKILL / 実装 |
|---|---|---|---|---|
| M-1 | M-1 | Monthly Reports | `monthly_reports` | `amd-os-l1-monthly-report-extract/SKILL.md` |
| M-2 | M-2 | XRL根拠 | `project_xrl_evidence` / `project_founding_members` | `amd-os-l8-xrl-evidence-extract/SKILL.md` |
| M-3 | M-3 | Management Monthly Signal | `company_management_signal_reviews` | 新規 (本 SKILL Phase C に inline)。table = migration 122 |

## 【絶対】 動く前に必ず Read

1. `pwa/spec/5-3-automation-responsibility-current-spec.md` (= 責務分担 current truth)
2. `pwa/manual/8-3-l2-extraction-routines-spec.md`
3. `pwa/design/L2_DATA.md`
4. `pwa/design/db_schema.md` (= 列名は想像で書かない)
5. M-1: `amd-os-l1-monthly-report-extract/SKILL.md` / M-2: `amd-os-l8-xrl-evidence-extract/SKILL.md` / M-3: `pwa/design/amd_score.md` + migration 122

═══════════════════════════════════════════════════
Phase 0: 最終日判定 + env + active PJ
═══════════════════════════════════════════════════

1. **最終日判定 (= 最初に必ず行う)**:
   - JST の今日が当月の最終日か判定する (= 翌日が翌月 1 日か)。
   - **最終日でなければ即 exit**。本処理 (Phase A-C) を一切実行せず、`🗓️ month-end routine: 今日 (<YYYY-MM-DD JST>) は月末最終日ではないため skip` の 1 行だけ返す。
2. Supabase connector でスキーマ確認。列名は `db_schema.md` を grep。
3. `projects?status=eq.active&select=project_id,project_name,project_category` で active PJ。
4. ymList = [当月 (= YYYYMM JST)]。月末評価なので当月を primary、必要時のみ前月補完。

═══════════════════════════════════════════════════
Phase A: M-1 M-1 Monthly Reports (= 当月、最優先)
═══════════════════════════════════════════════════

`amd-os-l1-monthly-report-extract/SKILL.md` の手順を実行。
- 入力: active / sales PJ × 当月の **Supabase L2 snapshot primary** (= `project_meeting_summaries` / `project_strategy_signals` / `project_xrl_evidence` / `project_registry_diffs` / `protocols` / `project_knowledge` / `member_knowledge` / `milestone_monthly_progress` / `progress_estimate_state` / 既存 `monthly_reports`)。
- fallback: L2 coverage が薄い・古い・source refs 不足・no-data 候補のときだけ Gmail / Drive / Calendar / Slack / Notion 5 生データを gap check。`source_cache` だけで no-data 判定しない。
- 進捗ベース生成ガード (2026-06-03 正本): 「PJ状態」ではなく「その月に実進捗があるか」で生成可否を決める。進捗あり → 状態問わず生成。進捗なし & active → 「進捗なし」テンプレ。進捗なし & ended/frozen → 生成しない。未来月・開始前は backfill しない。
- 出力: `monthly_reports` (status='draft')。既存 `final_content` は force 明示なしで上書きしない。
- 反映: cloud 直書きできない環境では `/Users/masa/.codex/automations/amd-os-ms/outbox/` の `monthlyReports` 経由で非LLM applier。
- 禁止: R313 trigger / PWA report route / Anthropic 従量課金 API。
- **M-2 の入力になるので必ず M-2 より先に完了させる**。

═══════════════════════════════════════════════════
Phase B: M-2 M-2 XRL根拠 (= M-1 の monthly_reports を入力に含む)
═══════════════════════════════════════════════════

`amd-os-l8-xrl-evidence-extract/SKILL.md` の手順を実行。
- 入力: 5 生データ + 既存 L2 (= **Phase A で更新した monthly_reports** / meeting_summaries / member_knowledge 等)。
- 出力: `project_xrl_evidence` (axis = trl/brl/grl/srl/hrl、status='candidate')。
- 関連メンバー (HRL ベース): `project_founding_members.category in ('amd','startup','university')` のみ算入、VC/顧客/行政/産業パートナーは invalid。
- `project_category='ecosystem'` の PJ は AMD Score 対象外として skip。
- 反映: `outbox.xrlEvidence` → 非LLM applier (`ms_progress_review_tool.mjs apply-outbox-dir`)。score は直接確定せず candidate で、通知 yes で `confirmed`。
- XRL checklist audit (= 各 axis の evidence 充足チェック) もここで実施。

═══════════════════════════════════════════════════
Phase C: M-3 M-3 Management Monthly Signal (= 17:00 までに完了)
═══════════════════════════════════════════════════

新規 inline 抽出 (= 個別 SKILL なし。table = migration 122 `company_management_signal_reviews`)。
- 入力: 月次試算表の予実 = `company_budget_monthly` (予算) / `company_actual_monthly` (実績、`actual_amount_yen`) / `company_budget_variance_notes` (差分メモ) を当月 ym で読む。加えて M-1/M-2 の結果 (= 当月 monthly_reports 断面、XRL signal) を経営文脈として参照。
- 抽出: 予実差分から経営シグナル評価を作る。Sonnet 4.6 で以下の構造化フィールドに落とす:
  - `summary` (= 当月経営サマリ本文、必須)
  - `forecast_summary` (= 見通し)
  - `cost_actions` (JSONB 配列 = コスト面の打ち手)
  - `pipeline_actions` (JSONB 配列 = 売上/パイプライン面の打ち手)
  - `variance_findings` (JSONB 配列 = 予実差分の発見)
  - `risk_alerts` (JSONB 配列 = リスク警告)
  - `decision_signals` (JSONB 配列 = 経営判断シグナル)
  - `source_refs_json` (JSONB 配列 = 根拠 source refs、全文保存しない)
- 出力: `company_management_signal_reviews` (`ym` = 当月、`status='candidate'`、`created_by='claude_month_end_routine'`)。UNIQUE (ym, status) なので同 ym/candidate は upsert。
- 反映: `/management-score` 画面に表示される。まさが確認して `confirmed` 昇格 (= UI 採否)。
- **これが月次振り返り MTG (18:00) で一番見たいもの**。Phase A/B が長引いても 17:00 までに必ず Phase C を出す。

═══════════════════════════════════════════════════
Phase D: run summary
═══════════════════════════════════════════════════

```
🗓️ L2 month-end evidence (M-1〜M-3) 最終日 16:00 完了 (<HH:MM JST>):
  - M-1 M-1 monthly_reports: <N> draft saved, <M> skipped final
  - M-2 M-2 XRL根拠: <N> evidence candidate (trl/brl/grl/srl/hrl)
  - M-3 M-3 Management Signal: ym=<YYYYMM> candidate saved
  経過時間: <minutes> 分 (= 17:00 MTG 準備 締切まで余裕 <X> 分)
```

═══════════════════════════════════════════════════
【禁止】
═══════════════════════════════════════════════════

- 最終日判定を飛ばして月末候補日 (28-30 日) に本処理を走らせる。
- M-1 より M-2 を先に走らせる (= M-2 は M-1 の monthly_reports を入力にする)。
- R313 / PWA report route / Anthropic 従量課金 API を M-1 定期抽出に使う。
- 列名想像 (= `db_schema.md` を grep)。`company_management_signal_reviews` の status は `auto_preview / candidate / confirmed / archived` のみ。
- `monthly_reports.final_content` を force なしで上書き。
- XRL score を candidate を経ず直接 confirmed にする。
- 17:00 を超えて M-3 が出ない (= 重い月は Phase A/B の差分 skip を最大化し、Phase C を死守)。
- daily 分 (D-1〜D-11) / weekly 分 (W-1) / 毎時 (H-1) を本 routine に混ぜる。

═══════════════════════════════════════════════════
【execution time 配慮】
═══════════════════════════════════════════════════

- 16:00 開始・17:00 完了目標 = 60 分バジェット。Phase A (monthly 全 PJ) が最も重い。差分検知で skip を効かせる。
- timeout しても `l2_extract_state.last_processed_at` / outbox で idempotent。ただし月末は再 run 機会が翌月までないため、Phase C (M-3) を最優先で確定させる設計。
- 空振り run (= 最終日でない日) は Phase 0 で即 exit するので数秒で終わる。
