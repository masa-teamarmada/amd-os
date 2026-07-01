# SESSION MIGRATION PROMPT - AMD OS JC Shareholder Materials Backfill

```text
cd /Users/masa/projects/AMD/amd-os

まず `HANDOFF.md` を読んで。次に仕様正本として `pwa/spec/4-2-amd-score-current-spec.md` と `pwa/spec/3-8-cockpit-current-spec.md` を読んで。そのあと `pwa/BUGS.md`、`pwa/design/db_schema.md`、`pwa/design/project_strategy_signals.md`、`CLAUDE.md`、`AGENTS.md`、`pwa/CLAUDE.md` を読んで。

今回の current truth:
- JC(p09) の共有Drive `総会関連資料` から、`2026年6月-株主報告会.pdf` と `月次決算（5月末締）.pdf` を読んで、cockpit DBへ反映済み。
- exact name `定時株主総会` の新規PDFは見当たらなかった。今回の新規資料は株主報告会と5月末試算表。
- `project_documents` に2PDF登録済み。
- `project_strategy_signals` 4件、`project_events` 4件、`project_pl_monthly` 202605、`project_xrl_log` 2026-06-30、`project_xrl_evidence` 5件を追加/更新済み。
- PRS primary は 2026-07-01 入力で 1,389 -> 5,294 に更新済み。主入力は P=6 / R_net=4 / mu_i=9 / TRL=6.5 / BRL=8 / GRL=6 / SRL=7 / HRL=6 / FRL=5.5 / FRL_cap=4.5。
- A種優先株式ラウンドは投資家内訳を反映し、AMD貢献ステータスを暫定 full から unreviewed に戻した。
- `projects.governance_watch_shareholder_meetings=true` に更新済み。
- 参加者リストの個人連絡先など raw PII は durable artifact に入れていない。

作業開始前に必ず:
1. `git fetch origin main --prune`
2. `git status -sb --untracked-files=all`
3. `git log --left-right --oneline main...origin/main`
4. `node /Users/masa/Documents/Codex/2026-07-01/new-chat/work/jc_db_read.mjs > /Users/masa/Documents/Codex/2026-07-01/new-chat/work/jc_db_current.json`
5. `rg -n "project_documents|project_strategy_signals|project_pl_monthly|amd_score_revisions|project_xrl_evidence" pwa/design/db_schema.md pwa/spec pwa/design`

最初の一手:
1. JC作業を続けるなら、まず `HANDOFF.md` のDB countsと `jc_db_current.json` の最新値が一致するか見る。
2. PRSをさらに調整する場合は、必ず `pwa/src/lib/amd-score.ts` の `calculatePrsScore` / `computeFrlCES` と `pwa/spec/4-2-amd-score-current-spec.md` を見てから `amd_score_inputs` と `amd_score_revisions` を更新する。
3. A種ラウンドのAMD貢献判定を続ける場合は、`unreviewed` のまま証拠を探し、証拠が弱ければ `partial` や `full` にしない。
4. unrelated dirty tree に H-1/Notion property guard bundle が残っている。JCのhandoffと混ぜない。

守ること:
- `git add .` は使わない。選んだ bundle のファイルだけ個別 stage。
- raw Gmail / raw Slack / raw Notion / raw Drive 本文を durable artifact に出さない。
- JC資料の参加者連絡先など個人情報をDB summaryやhandoffへ出さない。
- PostgREST write は先に `pwa/design/db_schema.md` で列名・generated column・check constraint を確認する。
- PRSの概算は独自の単純積で出さず、コックピット実装式に合わせる。
- PWA deploy が必要なら `.vercel/project.json` が `amd-os-pwa / prj_raZW3HSKIszzPUwNTHfy7xDGzLHm` であることを確認し、`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` を使う。
```
