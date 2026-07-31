---
name: amd-os-l2-monthend-evidence
description: Claude Code Routines の Fable 5 で動かす AMD OS 月末処理。JST 月末最終日のみ、M-1 月次報告書、M-2 XRL 根拠、M-3 経営月次シグナルを依存順に生成する。従量課金 API、claude CLI、別モデルへのフォールバック、ローカル Scheduled Tasks は使わない。
---

# AMD OS Month-end L2 Evidence routine（M-1〜M-3）

## 正本と実行経路

- 登録先は `claude.ai/code/routines` の `AMD OS L2 月末抽出 (M-1月次レポート/M-2 XRL/M-3経営シグナル)`。
- 実行モデルは **Fable 5 固定**。この Code Routine の定額枠だけで文章を生成する。
- cron は `0 7 28-31 * *`（UTC。16:00 JST）。Phase 0 で JST 月末最終日を判定する。
- 旧 `/Users/masa/.claude/scheduled-tasks/amd-os-l2m1-monthly-report` は廃止済み。ローカル Scheduled Tasks に戻さない。
- M-1〜M-3をこの1本に束ねる。M-1単独の別 routine を登録しない。

## モデル・課金ゲート

本処理の最初に、現在の routine が Fable 5 で実行されていることを確認する。

- Fable 5 と確認できない場合は `model_gate: blocked_non_fable` を返し、connector read、文章生成、ファイル生成、DB write、通知を始めない。
- fallback model を使わない。
- `claude` CLI、Anthropic API、OpenAI API、Gemini APIなどの従量課金経路を使わない。
- subagent、workflow、並列エージェントを起動しない。1つの Fable routine 内で、1 PJずつ順番に処理する。

## 動く前に全文を読む

1. `pwa/scheduled-tasks/shared/kaku-report/SKILL.md`
2. `pwa/scheduled-tasks/amd-os-l2m1-monthly-report/SKILL.md`
3. `pwa/scheduled-tasks/amd-os-l8-xrl-evidence-extract/SKILL.md`
4. `pwa/spec/3-0-l2-data-list-current-spec.md`
5. `pwa/spec/3-1-l2-data-extraction-current-spec.md`
6. `pwa/spec/5-3-automation-responsibility-current-spec.md`
7. `pwa/design/L2_DATA.md`
8. `pwa/design/db_schema.md`
9. `pwa/design/amd_score.md`

列名、status、保存経路は実装と current spec を正本にする。想像で補わない。

## Phase 0: 月末・環境・書き込み経路の確認

1. JST の今日が当月最終日か確認する。最終日でなければ、M-1〜M-3を一切実行せず短いスキップ要約だけで終了する。
2. 対象月を当月 `YYYYMM` とする。提出版の `ym` は `YYYY-MM` に変換する。
3. コネクターと環境変数を確認する。欠落を「データなし」と扱わない。
4. DB write は承認済み非LLM helperと一時 outboxだけを使う。Supabase connector、SQL、RESTの直接 writeは禁止する。
5. 一時 outbox は `mktemp -d` で作る。`/Users/masa/...` のローカル固定パスを前提にしない。

## Phase A: M-1 月次報告書

`pwa/scheduled-tasks/amd-os-l2m1-monthly-report/SKILL.md` をそのまま実行する。

- 対象は `monthly_report_scope IN ('internal_only','internal_and_external')` かつ `status IN ('active','sales')`。
- `internal_only` は社内版 final まで、`internal_and_external` は社内版 final、提出版、禁止語検査、PDFまでを対象にする。
- 既存 final が空なら新規生成する。既存 final がある場合は品質監査を行い、kaku-reportと決定論的 validatorの両方に合格したものは上書きしない。
- 既存 final または提出版が不合格でも、この定期 routine から force 上書きしない。`repair_required` としてプロジェクト別に報告する。
- M-1が保存・再読込検証まで完了しなければ、そのプロジェクトのM-2を完了扱いにしない。

## Phase B: M-2 XRL根拠

M-1が確認できたプロジェクトだけ、`pwa/scheduled-tasks/amd-os-l8-xrl-evidence-extract/SKILL.md` を実行する。

- M-1で確定した当月月次報告を入力に含める。
- `project_xrl_evidence` は candidate として出力する。
- HRLは `project_founding_members.category in ('amd','startup','university')` のみを対象にする。
- `project_category='ecosystem'` は AMD Score 対象外としてスキップする。
- scoreを直接 confirmed にしない。

## Phase C: M-3 経営月次シグナル

M-1・M-2と当月の予実を使い、`company_management_signal_reviews` の candidate を作る。

- 入力は `company_budget_monthly`、`company_actual_monthly`、`company_budget_variance_notes`、当月M-1、当月M-2。
- `summary`、`forecast_summary`、`cost_actions`、`pipeline_actions`、`variance_findings`、`risk_alerts`、`decision_signals`、短い `source_refs_json` を作る。
- 根拠が不足する欄は未確認として残し、推測で埋めない。
- 保存は current spec に記載された承認済み経路だけを使う。経路が不明なら `review_required` で止める。

## 完了条件

Mごとに次を確認する。

- 生成物が品質ゲートに合格した。
- 承認済み helper の結果が `inserted` または `updated` だった。
- 保存後に再読込し、対象月、status、本文長、生成時刻が一致した。
- outboxを置いただけ、PDFを作っただけ、候補を作っただけでは完了にしない。

## 最終報告

監査情報は報告書本文に混ぜず、routineの最終実行報告だけに分離する。

```text
L2 month-end routine: <YYYY-MM-DD HH:mm JST>
model_gate: Fable 5 / pass
M-1: 対象 <N> / internal final <N> / external <N> / repair_required <N> / failed <N>
M-2: candidate <N> / skipped_dependency <N> / failed <N>
M-3: candidate <N> / review_required <N> / failed <N>
quality_gate: pass <N> / fail <N>
errors: <短い理由。raw本文や秘密情報は含めない>
```

## 禁止

- 報告書本文に取得件数、コネクタ名、draft、collection summary、source refs、L2、snapshot、生成過程を書く。
- 会議順、取得元順、配列のカンマ連結で本文を作る。
- M-2をM-1より先に実行する。
- forceなしで既存 final を上書きする。
- 非Fableモデル、CLI、従量課金API、subagent、workflowへ処理を逃がす。
- Supabase connector、SQL、RESTで直接 writeする。
- D系、W-1、H-1、deploy、git push、DDL、migration、ローカルautomation変更をこのroutineで行う。
