AMD OSのFunction Storage対策の引き継ぎ。作業場所は /Users/masa/projects/AMD/amd-os。仕事種別は開発。追加の監視・削除・課金変更の依頼はない。

読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md（AMD共通知識）
3. AGENTS.md、HANDOFF_FUNCTION_STORAGE_20261006.md、HANDOFF_FUNCTION_STORAGE_CLEANUP_20261006.md
4. pwa/manual/1-1-intro.md、pwa/spec/1-3-reconstruction-coverage-audit.md、pwa/spec/5-2-development-operations-current-spec.md、pwa/manual/9-2-developer.md
5. pwa/BUGS.md、pwa/design/SPEC_GOVERNANCE.md。開発履歴はpwa/design_log/sessions_2026-10.md。

状態:
- 同梱肥大修正ac3866c9はmain・本番に反映。postbuild容量検査を追加、保存期間は全状態1日。旧版23件は明示承認後に通常削除し、直後READY26→3、現行4aliasを確認。具体的IDは整理記録にある。完全消去なし。
- 削除後の文書API未認証401、公開35章200、本番v3.160.7を確認。その後別担当が更新し、今回closeoutでは本番v3.160.8/20f968b5/main/dirty:falseを確認。旧版へ戻さない。
- Usage最終実測はチーム10.22GB、AMD10.09GB。期間集計と物理容量を混同しない。正常版件数88%減は容量88%減の意味ではない。
- 更新時刻・整理後の物理容量・超過表示解消は未確認。10月7〜8日は確認の目安であり、更新や減少の確約ではない。Hobby一般仕様は超過時に機能制限の可能性を記載するが、Functions Storage固有の停止条件は未確認。現在の稼働と将来の無制限保証は分ける。
- まさはtoken-indicatorで集計を見られる。減る時期が気になっただけで、追加監視は不要。追加依頼なしなら新作業を始めない。
- 着手時main20f968b5/origin一致、ahead0/behind0、本体worktree1つ、local mainのみ。別チャット「ドライブのファイルURLをコピー可能にする」01a110ae-f3c2-77a1-9218-228ea3602227の資料室コード・CSS・関連spec/manual/DESIGN/build-info差分は担当が継続中。変更・stageしない。
- 未追跡SESSION_MIGRATION_PROMPT_task_based_pt_20260922.mdはまさ/タスク報酬移行担当の再開資料。保持し、当該タスク再開か明示判断時だけ扱う。旧ナビの再開プロンプトはSESSION_MIGRATION_PROMPT_PROJECT_NAV_20261006.mdへ内容不変で保存。

運用と次の行動:
- 新しい依頼を待つ。制限エラーが発生したら具体的HTTP/APIエラーと現在の保持版・同じ期間の使用量を読戻し、Storage起因か確認する。
- main一本。branch/worktree/subagentを作らず、他担当dirtyをreset/stash/deleteしない。fetch後に対象ファイルだけ明示stage、束ねてpush。
- 製品変更は AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh。CLI直接deploy禁止。今回のroot引き継ぎ文書だけのpushは[skip ci]で不要buildを避ける。
- 恒久仕様はspec/manual、履歴はdesign_log、現在地は短いHANDOFFへ分離。秘密値を表示しない。今回の23件削除承認を将来の定期削除へ拡張しない。
