# 次セッション用 migration prompt: 研究機関ページの支援プログラム比較（データ投入と推奨表の起草）

cwd: `/Users/masa/projects/AMD/amd-os`（通常セッション。branch/worktree を作らない）

## 読む順
1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `HANDOFF.md` の「F. 研究機関ページ 支援プログラム比較」節
4. `pwa/design_log/sessions_2026-09.md` の 2026-09-05 節（何を作り、何が残っているか）
5. `pwa/spec/4-3-ers-current-spec.md` の「支援プログラム比較 Contract」、`pwa/manual/4-9-institution-ers-spec.md` の「支援プログラム比較」「分析タブと機関詳細の支援プログラム節」
6. `pwa/BUGS.md` 末尾（2026-09-05 のワークフロー教訓）

## 状態スナップショット（2026-09-05 17:00 JST）
- 本番 `v3.100.25`（deploy 完了は HANDOFF を確認）。`/institutions` に「支援プログラム比較」「分析」タブ、機関詳細に「支援プログラム」節がある。DDL は migration 375（compare列＋新項目5件）・376（`institution_policy_recommendations`）まで本番適用済み。
- **DBに入っている比較データは 2026-05-31 入力の4機関分だけ**。今回の調査結果は未投入で、`pwa/output/institution_support_research_20260905/`（git管理外）に退避してある:
  - `results/wf1_support_programs_and_regulations.json` … 既存48機関のうち40機関の16項目＋新規規程＋新規候補39件（`newCandidatesAll`）。**検証なし**（`verify` は null）。
  - `results/wf3_contract4_items.json` … 工学院大・愛媛大・香川大・NIMS の37項目（内部資料ベース）。工学院大だけ照合済み。
  - `results/wf3_others_items.json` … 山口大・QST・京工繊・京都大・信州大・北大・京都府立医大の21項目＋略称/概要。
  - `inputs/`（機関ごとの既存規程URL・既存入力）、`w1_results/`（調査が開いたURL）、`internal/kute/`（確定版規程・支援細則・内規・チェックシートのmd、大学受領の施設・機器規程、AMD論点メモ）、`internal/ehime/`。
  - `scripts/`: `workflow1_support_programs_research.js`（16項目＋規程＋新規）、`workflow3_items.js`（37/21項目。`args_contract4.json` / `args_others.json`）、`workflow2_recommendations.js`（推奨表の起草）、`gen_migration.mjs`（wf1結果→migration 377）、`gen_items_migration.mjs`（wf3結果→migration 378）、`dump_inputs.mjs`、`_support_programs_screenshot.mjs`（認証付き実寸確認。`pwa/scripts/` へ一時コピーして `node` で実行、終わったら消す）。
- 未完了の調査: 既存8機関（東北大・筑波大・茨城大・立命館・長崎大・静岡大・森林総研・産総研）の16項目、新規候補16件の調査、他44機関のうち37機関の21項目、そして**全件の検証**。
- 使えるスクリプトの前提: 生成スクリプト内の `S=` は旧scratchpadのパスなので、`pwa/output/institution_support_research_20260905` へ書き換えてから使う。結果JSONの形は `{ today, existing:[{inst,result,verify}], newCandidatesAll, newResearched }`（wf1）と `{ today, mode, results:[{inst,result,verify}] }`（wf3）。

## 次タスク（この順）
1. **検証を走らせる**（未検証の値を本番に載せない約束）。Workflow を新規に組む: 機関を4件ずつに割った小さな `pipeline(調査→検証)` を `parallel` で束ねる。調査済みの機関は `result` を args で渡して検証だけ、未調査の機関は調査から。検証は `sonnet`、開くURLは最大8本。上限に当たらないよう、起動前に Claude のセッション上限の回復時刻（今回は 20:10 JST）を確認する。
2. 契約4機関は内部資料版（wf3 contract4）を正とし、wf1 の同機関の値より優先する。工学院大の規程は未施行なので「検討中（案:…）」のまま。愛媛大は `https://ccr.ehime-u.ac.jp/startup/program/`（事務室・研究室、所在地登記、研究設備利用）を根拠に埋まっているか確認する。
3. `gen_migration.mjs` で migration 377、`gen_items_migration.mjs` で 378 を生成し、SQL を目で読んでから `python3 -X utf8 pwa/scripts/apply_ddl.py` で適用。`institution_policy_assessments` の件数と `/institutions` の実画面で readback。新規機関は「検証済みの規程URLか認定制度の根拠がある候補だけ登録」。
4. 推奨表の起草: `gen_migration.mjs` が出す `column_summary.json` を args に、`workflow2_recommendations.js` を Workflow で実行（KUTE論点メモ `internal/kute/90_論点別比較メモ_20260510.md` を AMD の立場の土台に、20論点を起草→照合→文体統合）。結果を migration 379（`institution_policy_recommendations`）にして適用。まさの例「本店登記は調査した◯機関のうち◯機関が認めていて大学の負担も小さいので認めることを推奨」の形。統計は画面が自動計算するので、文中の数字は分母（確認済み機関数）を明示する。
5. 手引き: manual 4-9 の件数、changelog `pwa/spec/6-1-appendix-changelog.md` と `pwa/manual/9-3-appendix-changelog.md` に今回の行を追加（今回は両ファイルが他セッションの未コミット変更を含んでいて足せなかった。行の内容は design_log 2026-09-05 節から起こす）。design_log に続報。
6. 余力があれば: ECR の公開情報ベース下書き評価は今回見送った（理論正本を全文読んでから別セッションで）。

## 運用ルール（このPJで確立済み）
- 1機能=1commit、`git add` は対象ファイルだけ（共有checkoutに他セッションの dirty がある）。deploy は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`。dirty で止まるときは、使い捨てclean clone（`git clone --branch main <repo> <tmp>`、origin を GitHub に向け、`pwa/node_modules` を symlink、`.env.local` をコピー、origin/main に reset して自分のcommitだけ cherry-pick）から実行し、push 後に正規checkoutで fetch して一致を確認する。build version は `pwa/src/lib/build-info.ts` を毎回 patch 上げ。
- 参照系データは `reference-data-cache` 経由（`npm run test:reference-data-cache`）。分析の集計契約は `npm run test:institution-support-analysis`。
- 推測で埋めない。未確認（unknown）と未整備（not_started）を混ぜない。内部資料が根拠のときは `source_url` を空にして note に資料名。
- DBに書いたら本番画面で readback し、件数を design_log に書く。
