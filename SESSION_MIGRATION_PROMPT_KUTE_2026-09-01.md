# 次セッション用プロンプト（2026-09-01 KUTE今期タスク再編後）

cwd: `/Users/masa/projects/AMD/amd-os`

## 読む順

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
4. `/Users/masa/projects/AMD/kute/AGENTS.md`
5. `/Users/masa/projects/AMD/kute/HANDOFF.md`
6. `/Users/masa/projects/AMD/kute/docs/FY2026_TASK_REVIEW.md`
7. `/Users/masa/projects/AMD/amd-os/pwa/spec/3-8-cockpit-current-spec.md`
8. `/Users/masa/projects/AMD/amd-os/pwa/manual/2-3-pj-cockpit.md`
9. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md`
10. `/Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-09.md`

## 状態スナップショット

- KUTE (`p25`) の「年度内ロードマップ」は、旧6工程ではなく6区分38タスクが現行正本。
- 区分は「認定制度」7、「関連6規程」12、「シーズ発掘」6、「桑折先生」8、「自走化・連携」4、「年度報告」1。
- 完了はR01/R02/R03/R08/S01/K01/K02/K03/K04の9件だけ。各行の限定作業の完了であり、大学の決裁・施行、研究者接触承認、実証受注、事業化、ファンド形成の完了を意味しない。
- 日程根拠がないタスクは日付NULL。旧6件は物理削除せずsoft-deleteで履歴保持。依存関係は0件。
- 「連携シーズ比較」はKUTEだけの「シーズ」タブ (`?tab=seeds`)。ガントは `?tab=gantt`。他研究機関PJへは未展開。
- 業務正本は `/Users/masa/projects/AMD/kute/docs/FY2026_TASK_REVIEW.md`。技術仕様は `pwa/spec/3-8-cockpit-current-spec.md`。
- 実装commitは `38a1c7e6`、mainへpush済み。本番DBへmigration `20260901184500_kute_fy2026_task_rebuild.sql` 適用済み。再適用しない。
- KUTE反映時のdeployment `dpl_CFNctc8rtLV2wouaVRWj11VusaV4` はREADY。その後mainはZMP変更を含む `345bb313` まで進み、最新productionもREADY。KUTE commitは現行mainに含まれる。
- closeout時点の正規checkoutはmain / origin/main一致。KUTE作業由来の未commit・未pushは0。残っているBZM原稿、8月設計ログ、CSS差分は別作業のものなので触らない。

## 次のタスク

最初に、まさがKUTEの本番ガントを実使用して、次の3点を確認できる状態にする。

1. 38件の粒度が細かすぎず、各タスク名だけで何を終わらせる仕事か分かるか。
2. 緑の完了9件が「限定作業の完了」として妥当か。特に規程案作成を大学決裁・施行へ拡張していないか。
3. 日程未設定の仕事と、報告書根拠の仮日程が見分けられるか。

まさがKUTE設計を承認したら、他研究機関PJへの横展開候補を一覧化する。KUTEの38件をそのまま複製せず、共通の型だけを移す。共通の型は、既存ロードマップを通常のガント台帳へ統合すること、作業・成果物・大学側判定を分けること、完了証跡がある仕事だけ状態色を付けること、連携シーズ比較を「シーズ」タブへ置くこと。各機関の契約・現行タスク・成果物・決裁主体を読み直し、機関別のタスク案をまさへ提示してからDBへ反映する。自動展開しない。

## 守る運用ルール

- main一本。branch / worker worktreeを作らない。着手時にfetchし、HEADとorigin/mainの一致を確認する。
- 共有checkoutのdirtyは別作業の所有物。対象ファイルだけを明示stageし、`git add .`、stash、reset、checkoutで戻す操作をしない。
- DB変更前に現行行、version、source_ref、依存関係をreadbackする。人の編集があればmigrationを止める。物理削除ではなくsoft-deleteを使う。
- 作成済み文書の存在と大学採用、調査完了と外部受注、候補化と接触承認を混同しない。Before Zero設計案を承認済み運用へ昇格させない。
- 仕様変更は `pwa/spec/3-8`、利用説明は `pwa/manual/2-3`、附則は `manual/9-3` と `spec/6-1`、全クライアント正本は `ios/DESIGN.md` を同じcommitで更新する。
- KUTEの非開発業務整理は `/Users/masa/projects/AMD/kute/docs/FY2026_TASK_REVIEW.md`、現在地と次の一手だけをKUTE `HANDOFF.md`へ置く。非開発内容をAMD OSのdesign_logへ混ぜない。
- 検査は `node pwa/scripts/check_kute_seeds_tab_contract.cjs` と `node pwa/scripts/check_kute_gantt_completion.cjs`。UI変更があればdesktop/mobile実寸も確認する。
- PWAを変更したらmain pushによるVercel反映をREADYまで監視し、本番データをfresh readbackする。他研究機関PJを無断で変更しない。
