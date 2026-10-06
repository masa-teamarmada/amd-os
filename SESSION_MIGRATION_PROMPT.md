AMD OSのDD左メニュー改善の引き継ぎ。作業場所は /Users/masa/projects/AMD/amd-os。仕事種別は開発。まさは成果を受け入れ済み。追加実装の依頼はない。

読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. AGENTS.md、HANDOFF_DD_NAVIGATION_20261006.md
4. pwa/manual/1-1-intro.md、pwa/spec/1-3-reconstruction-coverage-audit.md、pwa/spec/5-17-dd-package-current-spec.md、pwa/spec/3-24-project-surface-pages-current-spec.md
5. pwa/manual/2-3-pj-cockpit.md、pwa/manual/2-6-admin-ops.md、ios/DESIGN.md、pwa/BUGS.md
6. pwa/spec/5-2-development-operations-current-spec.md、pwa/design/SPEC_GOVERNANCE.md。履歴はpwa/design_log/sessions_2026-10.md。

状態と合意:
- 7分類の初期全展開と開閉はaf482837、幅・視認性改善は155dc6c1/v3.160.13でmain・本番へ反映済み。
- 技術・開発と製造は一緒でよい。開閉は許容、初期は全展開。幅を狭め無駄な余白を減らし、左メニューと本文を識別しやすくする、というまさの指定を維持。
- PC幅200px、背景と境界、現在地表示、横断検索、下部常設の開示資料を実装。閉じた分類も検索し、解除すると開閉状態が戻る。
- test:dd-package、test:project-format、型検査、production build、配布ゲート成功。本番ChromeのPC/狭幅で検索・開閉・移動を確認済み。
- 本番最終読戻しはv3.160.15/6e1f408a/main/dirty:false。closeout着手時main d0ece3c4、origin一致。後続の事業計画追加1e23112eは別チャットの変更で、配布進行中。今回検証した33資料を現行件数として固定しない。
- 同担当は追加依頼「開発課題」を実装中。新規API・共通本文・loader、DD/コックピット/ワークスペース接続、検査・lock・build-infoのdirtyは担当が検査・commit・配布する。今回のstage/削除対象外。
- 後続正本はpwa/HANDOFF_dd_business_plan_20261006.md。画面確認証跡は /Users/masa/.codex/visualizations/2026/10/06/01a110c9-ec4e-7881-b908-900725f5010a/dd-navigation-desktop.jpg。
- 既存未追跡SESSION_MIGRATION_PROMPT_task_based_pt_20260922.mdはまさ/タスク報酬移行担当の再開資料。内容を変更・削除・今回commitへ混入しない。当該タスク再開かまさの明示判断時に保存先を確定する。共有リポ全体のarchive判定は保留。
- 旧Function Storage再開文はSESSION_MIGRATION_PROMPT_FUNCTION_STORAGE_CLEANUP_20261006.mdへ内容不変で保存済み。

次の行動と運用:
- 新しい依頼を待つ。着手時にfetchしてmainと本番build-infoを再確認し、後続担当の変更を戻さない。
- main一本、branch/worktree/subagentを作らない。他担当のdirtyをreset/stash/deleteせず、対象ファイルだけ明示stageする。
- 製品変更は AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh で束ねてpush・監視。CLI直接deploy禁止。
- 監視中に別担当の後続版が本番へ進んだら、完全SHA一致待ちを成功と誤認せず、祖先関係・対象差分・現在の画面を確認する。今回はこの教訓をBUGSへ記録済み。
- 恒久仕様はspec/manual、履歴はdesign_log、現在地は短いHANDOFF。DB・権限・鍵・モデル・Native変更は本タスクに含まれない。
