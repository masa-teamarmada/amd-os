AMD OS の「特定のPJだけの処理を置かない」作業の続きを再開する。作業場所は `/Users/masa/projects/AMD/amd-os`。

読む順:
1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`（特に feedback_no_project_special_cases・feedback_project_format_uniform）
3. `/Users/masa/projects/AMD/amd-os/HANDOFF_NO_PJ_SPECIAL_CASES_20261004.md`
4. `/Users/masa/projects/AMD/amd-os/pwa/spec/3-23-project-format-current-spec.md` §6・§7
5. `/Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-10.md` の 2026-10-04 節

状態:
- v3.157.0（実験ダッシュボード削除）・v3.158.0（PJ別特例の撤去）・migration 475〜477 は本番反映済み。検査 test:no-project-special-cases が deploy 前に走る。
- 2026-11-14 時点 main=origin/main（8f8f53f7f）。question-tree の2ファイルの未コミット変更は別セッションの作業なので触らない。
- DB の設定値（task_point_review_from_ym・external_research_topics）の現在値は未確認。着手時に読む。

次のタスク:
1. まさに2つの判断を聞く。(a) タスクpt検収をほかのPJでも始めるか（A: SOLだけ / B: 全PJで翌月分から / C: PJを選ぶ。報酬の決まり方が変わる）。(b) 外部リサーチを全PJへ広げるか（A: 今の7PJ / B: 全PJ、テーマは各PJの定義から下書き→まさ確認）。返答に従い設定を入れ、spec 3-23 §6 を更新。
2. まさの指示があれば、SOL の廃液・燃料のコスト試算を標準の画面（spec 3-23 §7）へ移す。
3. gas-slack/S100_MacroNewsToSlack.js の PJ略称表を DB の設定から読む形にする（GAS の反映手順は gas/AGENTS.md）。

運用ルール:
- PJごとの違いは DB の列（設定）に置き、コードは全PJ同じ決まり。PJ番号・PJ名で分岐しない。例外は check_no_project_special_cases.mjs の ALLOWED に理由つき。
- main 一本、着手前 git fetch・ff-only、対象ファイルだけ stage、1機能1commit、deploy は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`、本番画面を claude-in-chrome で確認。
- DDL は `pwa/scripts/migrations/NNN_*.sql`（番号は origin/main の最新を確認）を `python3 -X utf8 scripts/apply_ddl.py <絶対パス>` で適用し、dump_schema.py で db_schema.md を更新。
- まさへの報告は画面で何が変わったかから、専門語なし。
