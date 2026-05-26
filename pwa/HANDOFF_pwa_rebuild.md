# HANDOFF — AMD OS PWA

- Last updated: 2026-05-27 (深夜)
- Topic: バイタルサイン v4 大改修 + manual UI 単一化 + 卒業フェーズ検出機能 + freee cron 運用化
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- Build version: `v0.3.5` (deploy aliased = `amd-os-pwa.vercel.app`)

## Latest Summary

`/management-score` (= バイタルサイン) の計算ロジック・入力・UI を全面改修。 v3 (加重平均 + finance cap) → v4 (加算 + 不可逆閾値 + 動的重み + 死亡判定 + 6 入力 direction)。 並行で manual UI 整備 (= audience 廃止 / 章番号動的注入 / md 32 章 prefix 削除) と卒業フェーズ検出機能の新設 (= migration 094 + 月次 cron)、 freee 実績 cron 運用化。

詳細は [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) 末尾「2026-05-26〜27 — バイタルサイン v4 大改修」 セクション全部 (= Phase 1-9)。

## Repo State

- branch: `main`
- HEAD: `487fc68` (= 別セッションの L6 cron 絞り、 私のセッション前後で変化なし)
- 未 push commit: 0 (= 別セッション分のみ、 私は本セッションでは commit してない、 handoff 末で commit + push 予定)
- 未 commit (= 本セッションスコープ):
  - 新規 ファイル:
    - `src/lib/build-info.ts` (= BUILD_VERSION 定数)
    - `src/lib/graduation-detection/calculate.ts` + `src/app/api/cron/graduation-detection/route.ts`
    - `src/components/management-score/DialogueModeButton.tsx` (= **次回削除予定**) + `EvidencePanel.tsx`
    - `src/app/(app)/manual/manual-data.ts` + `ManualMapClient.tsx` (= codex から復元)
    - `manual/39-graduation-detection-spec.md` + 13 章別フォーク作成済 (= 25/26/27/28/30/31/32/33/34/35/36/37/10)
    - `scripts/migrations/092_management_score_snapshot_summary.sql` / `093_project_ventures_amd_support_ended_at.sql` / `094_project_graduation_signals.sql`
  - 改修 ファイル:
    - `src/lib/management-score/calculate.ts` (= v4 全面)
    - `src/lib/management-score/raw-data.ts` (= 入力ソース差し替え)
    - `src/app/(app)/management-score/page.tsx` (= UI 対象月 filter + EvidencePanel + DialogueModeButton 接続)
    - `src/app/(app)/manual/` 配下 (= 単一化 + 動的番号)
    - `src/components/nav/GlobalNav.tsx` (= build_version 表示)
    - `manual/*.md` 32 ファイル (= h1/h2/h3 prefix 削除 sed)
    - `manual/29-management-score-and-finance-simulation-spec.md` (= v4 全面改訂)
    - `vercel.json` (= cron 3 個追加: management-score-raw-data freee + calculate + graduation-detection)
    - `CLAUDE.md` (= build version bump up ルール追加)
    - `design/db_schema.md` (= 再生成)
- 未 commit (= 他セッション、 私は触らない):
  - `gas/074f_MeetingWorkflow.js` 他 GAS 系
  - `scripts/migrations/093_meeting_workflow_orchestration.sql` (= 同番号衝突注意)
  - `src/app/api/meeting-prep/`, `meeting-workflow/`, `tsukuyomi/post/`
  - `ios/supabase/.temp/*`
  - 多数の admin/cockpit/atlas/vcs/etc 系 (= 別セッション)

## Open Tasks

### 🔥 次セッション最優先 (= まさ指摘待ち)

1. **DialogueModeButton 削除** (= まさ #91、 「議論してないものをレビューする UI」 は意味ない、 設計取り違え)
   - `src/components/management-score/DialogueModeButton.tsx` ファイル削除
   - `src/app/(app)/management-score/page.tsx` から import / fetch / render 削除
   - 代わりに **EvidencePanel に「dialogue で confirmed されたシグナル」 chip** を強調表示 (= raw-data v4 で confirmed funding/commercial が既に direction/pipeline 入力に流れる、 そこを可視化)
2. **要因 (= evidence) に「シーズ探索結果」 が残ってないか再確認** (= raw-data v4 で seeds 入力削除したつもりだが、 何か残ってる可能性)
3. **freee revenue=0 問題** (= raw-data で freee trial_pl から売上が拾えてない、 `freeeCategory` の文字列マッチ精度 or freee 試算表側で売上計上タイミング)

### 🚧 中型

4. **graduation_detection LLM 化** (= signal 1 main_talker / signal 3 monthly_reports 寄与文言が今 0、 LLM 入れたら readiness 精度向上、 p21「撤退」 検出済なので有望)
5. **amd_os_installations テーブル新設** (= direction 軸 25% 重み、 当面 0 で全体引き下げ要因、 新 migration + L2 抽出経路)
6. **manual 39 章 + 29 章 を v4 用 anchor link 整備** (= 「29.6 戦略接近度」 のような text 参照が動的番号に追随しない、 ただ優先度低)

### ⚠️ 注意点

- `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` 必須 (= `--cwd .../pwa` 禁止)
- **修正したら必ず `src/lib/build-info.ts` の `BUILD_VERSION` を bump up** (= patch 中心、 minor は新機能のみ。 詳細 [pwa/CLAUDE.md](CLAUDE.md) 🔢 セクション)
- migration 093 が **同番号で 2 つ存在**: 私の `093_project_ventures_amd_support_ended_at.sql` (= no-op で済んだ、 既存列) と他セッションの `093_meeting_workflow_orchestration.sql`。 push 前に番号衝突確認 (= 後者を 095 にリネーム or 私の 093 を no-op として削除する選択)
- 別セッション並行運用、 push 前必ず `git pull --rebase --autostash origin main`

## First Read Next Session

1. **`pwa/HANDOFF_pwa_rebuild.md`** (= 本文書、 最新状態 + 次の一手)
2. **`pwa/manual/29-management-score-and-finance-simulation-spec.md`** (= バイタル v4 仕様正本)
3. **`pwa/manual/39-graduation-detection-spec.md`** (= 卒業フェーズ検出仕様正本)
4. **`pwa/design_log/sessions_2026-05.md`** 末尾「2026-05-26〜27」 セクション (= Phase 1-9 全部)
5. **`pwa/BUGS.md`** 末尾「2026-05-27 — バイタル v4 改修中に発見した設計バグ」 (= 6 件、 特に [ui/dialogue-mode] と [infra/manual-ui])
6. **`pwa/CLAUDE.md`** 🔢 build version の bump up セクション (= 毎回 bump up)

## First Next Action

```sh
cd /Users/masa/projects/AMD/amd-os
git fetch --all --prune
git status -s
git log --branches --not --remotes --oneline
git pull --rebase --autostash origin main
```

その後:
1. migration 093 番号衝突を解決 (= 私の `093_project_ventures_amd_support_ended_at.sql` を `095_*.sql` にリネーム、 ただし apply 済なので migration の意味は no-op に変わらない、 履歴整合のため)
2. DialogueModeButton 削除 + EvidencePanel に「dialogue confirmed」 chip 追加
3. evidence で「seed_candidate」 のような旧 source_kind が残ってないか SQL で確認
4. freee revenue=0 調査: 過去月の freee trial_pl レスポンスを log 見ながら、 売上が含まれてるか account_category_name の文字列マッチで取れてるか確認

## Verification Commands Run This Session

- `npx tsc --noEmit` (× 多数、 全 pass)
- `bash pwa/scripts/deploy.sh` (× 8 回、 全 Ready、 v0.1.0 → v0.3.5)
- `python3 scripts/apply_ddl.py scripts/migrations/092_*.sql` + `093_project_ventures_amd_support_ended_at.sql` (= no-op) + `094_project_graduation_signals.sql` (= 全 OK 201)
- `python3 scripts/dump_schema.py` (= db_schema.md 再生成、 121 tables / 1439 columns)
- `curl /api/cron/management-score-raw-data?ym=YYYYMM&includeFreee=1` (× 6 ヶ月分、 全 success)
- `curl /api/cron/management-score-calculate?ym=YYYYMM` (× 6 ヶ月分、 全 OK)
- `curl /api/cron/graduation-detection?ym=YYYYMM` (× 6 ヶ月分、 全 processed=8、 candidates=0)

## Pointers

- **バイタルサイン v4 仕様正本**: [`pwa/manual/29-management-score-and-finance-simulation-spec.md`](manual/29-management-score-and-finance-simulation-spec.md)
- **卒業フェーズ検出仕様正本**: [`pwa/manual/39-graduation-detection-spec.md`](manual/39-graduation-detection-spec.md)
- **マニュアル目次**: [`pwa/manual/00-intro.md`](manual/00-intro.md)
- **中核データ正本**: [`pwa/design/L2_DATA.md`](design/L2_DATA.md)
- **バグ事故ログ**: [`pwa/BUGS.md`](BUGS.md) 末尾
- **セッションログ**: [`pwa/design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) 末尾
- **PWA 固有運用**: [`pwa/CLAUDE.md`](CLAUDE.md)

## 重要メモ (= 次セッションのえいみへ)

- **DialogueModeButton は設計取り違え**。 まさ #91 で「議論してないものは重要じゃない、 議論したものは確認なしで採用」 と明言。 candidate review UI は削除して、 dialogue で confirmed されたものがバイタル evidence にどう反映されてるか **可視化する方向**に再設計する
- **chapter.number は動的計算のみ** (= 静的 field は廃止)。 manual md に h1 / h2 prefix の数字を書かない (= 動的注入される)
- **build version は毎回 bump up**。 patch 中心 (= UI 改修 / バグ修正)、 minor は新機能のみ
- **migration 093 同番号衝突**: 私の `093_project_ventures_amd_support_ended_at.sql` と他セッション `093_meeting_workflow_orchestration.sql`。 push 前に整理する
- **静的 number と動的計算を同時に持たない**ルール (= まさ #87)。 表示は applyManualBookNumbering 経由のみ
