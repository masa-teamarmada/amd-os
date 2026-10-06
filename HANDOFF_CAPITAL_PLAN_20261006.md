# 資本政策表・SOL条件入力の引き継ぎ

更新: 2026-10-06。開発と事業計画の混合、受入済み。

AMD OSの資本政策表修正とSOLシリーズA入力を引き継いで。作業場所は /Users/masa/projects/AMD/amd-os。仕事種別は開発と事業計画の混合。

読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. AGENTS.md、HANDOFF_CAPITAL_PLAN_20261006.md
4. pwa/manual/1-1-intro.md、pwa/spec/1-3-reconstruction-coverage-audit.md、pwa/spec/3-8-cockpit-current-spec.md、pwa/manual/2-3-pj-cockpit.md
5. /Users/masa/projects/AMD/SOL/IYOGIN_FINANCING_MATERIALS.md、/Users/masa/projects/knowledge/sol.md
6. pwa/BUGS.md、/Users/masa/projects/AMD/SOL/BUGS.md、pwa/spec/audits/ui-meta-copy-20261006.md

現在地:
- 依頼は「保存された〜使用します」の削除、OS全体の同種説明の洗出し、エラーカードから修正できる導線、既に資料で固めたシリーズA条件の入力。受入済み。
- コード91883c67/369f2923はmain統合・本番v3.159.25で確認済み。公開build-infoのSHAは369f2923024f26a23cae63f1cc61c20f8f8a6451/main/dirty=false。その後は引き継ぎ文書のみ。開始時fetch/status/build-infoを再確認し、古いSHAへ戻さない。
- エラーカードが詳細を開き対象欄へ移動・フォーカス。計算基準、評価額、単価、割当を修正し既存自動保存で解決できる。重複エラー統合、閲覧専用導線、スマホ横はみ出しも修正。
- 資本政策41検査、関連導線・出力検査、型検査、627ページ本番ビルドと配布ゲート成功。PC/390pxスマホの編集・保存・再読込みは模擬データで確認。本番SOLではカード導線と今回指定条件の保存・DB読戻し・再読込みを確認。
- SOL Aは2028年7月、調達前12億円（J-KISS転換分込み）、調達3億円、調達後15億円、A20%。plan id9a6fb7cd-8f57-4456-92a5-8df486a55ae3、revision16、エラー0/警告0。投資家別配分は未定の協議案。提出版は確定していない。
- 株主一覧・他イベントの入力条件、月次P/L・現金計画・調達実績・確定J-KISS転換取引は変更していない。後続イベントの計算値は再計算。
- OS説明文監査はPWA33/iOS1/macOS128候補。他画面の削除は未実施、動的文言やDB本文の全数監査ではない。native実装は未移植。現行仕様・マニュアルとios/DESIGNに境界を記録済み。
- 技術履歴はpwa/design_log/sessions_2026-10.md。計画条件の正本はSOLのIYOGIN_FINANCING_MATERIALS.md。既存の別件引き継ぎはSESSION_MIGRATION_PROMPT_PAGE_LOADING_20261006.md等を参照。
- 未追跡の旧SESSION_MIGRATION_PROMPT_task_based_pt_20260922.mdは別担当資料。内容不変のGit保存可否をまさに確認中。返答なしでstage・削除しない。

次の行動:
- 今回の追加実装は不要。上記旧メモの判断だけを返答に従って処理する。
- OS全体の説明文を削る追加依頼が来たら監査表から対象を選び、意思決定に必要な操作説明を残す。資本政策の計画条件を旧「未定」へ戻さない。
- 月次計画やIPO公募額の整合は別依頼。未確認の投資家合意・配分・調達実績を作らない。

運用:
- main一本、新規branch/worktree禁止。共有checkoutをreset/stash/deleteしない。対象ファイルのみ明示stage。
- 仕様変更はspec/manualと附則を同期。PWA配布は AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh。本番SHAを照合する。pwa/HANDOFFはskip-ci除外対象ではないため今回専用文書はroot HANDOFFへ。
- 個別PJの計画条件は目的別正本へ、開発履歴はdesign_logへ分ける。秘密値やDB全文はGit/報告に出さない。自動継続・外部送信・提出版確定は依頼されていない。
