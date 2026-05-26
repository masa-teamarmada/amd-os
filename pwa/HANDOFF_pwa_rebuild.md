# HANDOFF — AMD OS PWA

- Last updated: 2026-05-27 (= 後続セッション、 v0.4.0)
- Topic: バイタル v4 仕上げ — DialogueModeButton 削除 + EvidencePanel 再設計 + graduation_detection LLM 化
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- Build version: `v0.4.0` (deploy aliased = `amd-os-pwa.vercel.app`)

## Latest Summary

前セッション (= バイタルサイン v4 大改修) の Open Tasks を全件処理。

1. **DialogueModeButton 削除 → EvidencePanel に「まさえいMTG 確定シグナル」 chip 帯追加** (= まさ #91 再設計)。 確認 UI を廃止、 議論で confirm されたシグナル (= `status='confirmed' AND decision_state IN ('decided','executing','revised')`) が新規 / 方向軸に流れていることを可視化
2. **migration 093 番号衝突整理**: 私の no-op 093 を削除、 他セッション 093 (meeting_workflow_orchestration) のみ残す
3. **旧 signal 残存 SQL 再確認**: seeds/venture_portfolio/protocol/atlas/macro 系 evidence は 過去 6 ヶ月で 0 件、 clean
4. **freee revenue=0 調査結果確定**: raw_signals 直接確認、 freee API trial_pl レスポンス自体に「売上高」 ノードが 1 件も含まれない (= PWA コード側で解決不可能、 freee dashboard 確認 / 経理運用見直しが必要)
5. **graduation_detection LLM 化** (= manual 39 章 signal 1/3 の LLM 経路実装、 minor bump v0.4.0)。 migration 095 で `llm_prompts` に 2 件 seed (= `is_active=FALSE`)、 まさが `/admin/prompts` で activate すると次回 cron から LLM 経由で signal 1/3 が埋まる

詳細 [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) 末尾「2026-05-27 続き」 (= Phase 10-14)。

## Repo State

- branch: `main`
- HEAD: `487fc68` (= 別セッションの L6 cron 絞り、 後続セッション中に変化なし、 本セッション末で commit + push 予定)
- 未 push commit: 0 (= 別セッション分は既に push 済、 本セッションは未 commit)
- 未 commit (= 本セッションスコープ):
  - 新規ファイル:
    - `scripts/migrations/095_graduation_detection_llm_prompts.sql` (= seed 適用済)
  - 削除ファイル:
    - `src/components/management-score/DialogueModeButton.tsx` (= rm 済)
    - `scripts/migrations/093_project_ventures_amd_support_ended_at.sql` (= no-op だったので削除、 番号衝突整理)
  - 改修ファイル:
    - `src/lib/build-info.ts` (= v0.3.5 → v0.4.0)
    - `src/lib/graduation-detection/calculate.ts` (= LLM 経路追加 / signal 1+3 / loadPrompt / parseJsonFromLlm)
    - `src/app/api/cron/graduation-detection/route.ts` (= Anthropic instance + maxDuration 300s)
    - `src/app/(app)/management-score/page.tsx` (= DialogueModeButton 削除 / query を confirmed 取得に変更)
    - `src/components/management-score/EvidencePanel.tsx` (= DialogueConfirmedChips セクション追加 + types export)
    - `pwa/manual/29-management-score-and-finance-simulation-spec.md` (= まさえいMTG 確定シグナル 帯 セクション追加 + 既知ギャップ表更新)
    - `pwa/manual/39-graduation-detection-spec.md` (= LLM プロンプト運用ルール追記)
    - `pwa/BUGS.md` (= [ui/dialogue-mode] entry を ✅ 修正済 にマーク)
    - `pwa/design_log/sessions_2026-05.md` (= Phase 10-14 追記)
    - `pwa/HANDOFF_pwa_rebuild.md` (= 本文書、 v0.4.0 状態に更新)
- 未 commit (= 他セッション、 私は触らない):
  - `gas/074f_MeetingWorkflow.js` 他 GAS 系
  - `scripts/migrations/093_meeting_workflow_orchestration.sql` (= 番号衝突整理で残った正本 093)
  - `src/app/api/meeting-prep/`, `meeting-workflow/`, `tsukuyomi/post/`
  - `ios/supabase/.temp/*`
  - 多数の admin/cockpit/atlas/vcs/etc 系

## Open Tasks (= 次セッション)

### 🔥 まさ向けアクション

1. **LLM prompt activate**: [`/admin/prompts`](https://amd-os-pwa.vercel.app/admin/prompts) で `graduation_detection.talker_ratio` と `graduation_detection.report_attribution` の body を確認 (= migration 095 で seed)、 微調整 → `is_active=TRUE`。 次月初 06:00 JST 自動 cron 実行から signal 1/3 が LLM 経路で埋まる
2. **freee revenue 確認**: freee dashboard で売上計上タイミングを確認。 売掛金で計上されてないか、 入金月ベース運用になってないかチェック。 PWA コード側は問題なし

### 🚧 中型 (= 次のえいみ向け)

3. **amd_os_installations 新テーブル新設** (= direction 軸 25% 重み、 当面 0 で全体引き下げ要因、 新 migration + L2 抽出経路)
4. **manual 39 章 + 29 章 を v4 用 anchor link 整備** (= 動的番号に追随しない text 参照、 優先度低)
5. **LLM activate 後の cron 結果モニタリング** (= p21「撤退」 detect 済 → LLM で readiness が跳ね上がる可能性、 卒業提案候補 candidate がまさえいMTG に上がるか確認)

### ⚠️ 注意点

- `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` 必須 (= `--cwd .../pwa` 禁止)
- **修正したら必ず `src/lib/build-info.ts` の `BUILD_VERSION` を bump up** (= patch 中心、 minor は新機能のみ。 詳細 [pwa/CLAUDE.md](CLAUDE.md) 🔢 セクション)
- 別セッション並行運用、 push 前必ず `git pull --rebase --autostash origin main`

## First Read Next Session

1. **`pwa/HANDOFF_pwa_rebuild.md`** (= 本文書、 最新状態 + 次の一手)
2. **`pwa/manual/29-management-score-and-finance-simulation-spec.md`** (= バイタル v4 正本、 まさえいMTG 確定シグナル 帯 セクション含む)
3. **`pwa/manual/39-graduation-detection-spec.md`** (= 卒業フェーズ検出仕様正本、 LLM プロンプト運用ルール含む)
4. **`pwa/design_log/sessions_2026-05.md`** 末尾「2026-05-27 続き」 セクション (= Phase 10-14 全部)
5. **`pwa/BUGS.md`** 末尾「2026-05-27 — バイタル v4 改修中に発見した設計バグ」 (= [ui/dialogue-mode] が ✅ 修正済)
6. **`pwa/CLAUDE.md`** 🔢 build version の bump up セクション

## First Next Action

```sh
cd /Users/masa/projects/AMD/amd-os
git fetch --all --prune
git status -s
git log --branches --not --remotes --oneline
git pull --rebase --autostash origin main
```

その後:
1. まさが LLM prompt activate 済か `/admin/prompts` で確認
2. activate されてたら `curl /api/cron/graduation-detection?ym=202605` で smoke test → `llm_enabled:true` + readiness 上昇を確認
3. amd_os_installations テーブル新設へ進む

## Verification Commands Run This Session

- `npx tsc --noEmit` (× 3 回、 全 pass)
- `bash pwa/scripts/deploy.sh` (× 1 回、 Ready 2 分 21 秒、 v0.4.0)
- `python3 scripts/apply_ddl.py scripts/migrations/095_graduation_detection_llm_prompts.sql` (= OK 201、 llm_prompts に 2 件 seed 確認済)
- Supabase MCP `execute_sql` で:
  - `amd_management_score_snapshots` 最新 5 ヶ月確認
  - `amd_management_score_evidence` の axis × evidence_kind 集計 (= 旧 signal 残存 0 件確認)
  - `amd_management_score_raw_signals` で freee_actual:revenue 全件 (= 雑収入 + 受取利息のみ)
  - `company_actual_monthly` で freee category × 月別 (= 売上高ノード無し確認)
- `curl /api/cron/graduation-detection?ym=202605` (= 本番、 `ok:true llm_enabled:false processed:8 candidates:0`)

## マニュアル同期棚卸し (= handoff ゲート)

| # | 新仕様/仕様変更 | design正本 | OSマニュアル章 | 状態 |
|---|---|---|---|---|
| 1 | DialogueModeButton 削除 + EvidencePanel「まさえいMTG 確定シグナル」 chip 帯 | [EvidencePanel.tsx](src/components/management-score/EvidencePanel.tsx) | [29 章](manual/29-management-score-and-finance-simulation-spec.md) | ✅ |
| 2 | migration 093 番号衝突整理 | — | — | 対象外: 内部運用 (= 仕様変更なし) |
| 3 | evidence 旧 signal 残存 SQL 確認 | — | — | 対象外: 確認結果 clean、 仕様変更なし |
| 4 | freee revenue=0 調査結果 → freee 側問題確定 | — | [29 章 既知ギャップ表](manual/29-management-score-and-finance-simulation-spec.md#既知ギャップ--v4-移行-todo) | ✅ |
| 5 | graduation_detection LLM 化 (signal 1+3) + llm_prompts seed | [calculate.ts](src/lib/graduation-detection/calculate.ts) + [migration 095](scripts/migrations/095_graduation_detection_llm_prompts.sql) | [39 章「LLM プロンプト」](manual/39-graduation-detection-spec.md#llm-プロンプト--2026-05-27-seed-済) | ✅ |

## Pointers

- **バイタルサイン v4 仕様正本**: [`pwa/manual/29-management-score-and-finance-simulation-spec.md`](manual/29-management-score-and-finance-simulation-spec.md)
- **卒業フェーズ検出仕様正本**: [`pwa/manual/39-graduation-detection-spec.md`](manual/39-graduation-detection-spec.md)
- **マニュアル目次**: [`pwa/manual/00-intro.md`](manual/00-intro.md)
- **中核データ正本**: [`pwa/design/L2_DATA.md`](design/L2_DATA.md)
- **バグ事故ログ**: [`pwa/BUGS.md`](BUGS.md) 末尾
- **セッションログ**: [`pwa/design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) 末尾
- **PWA 固有運用**: [`pwa/CLAUDE.md`](CLAUDE.md)
