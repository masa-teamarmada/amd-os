AMD OSのDD議事録・固有名詞の作業を引き継ぐ。仕事種別は開発。
コードの正規cwdは /Users/masa/projects/AMD/amd-os。素材と検証は /Users/masa/projects/AMD/SOL。新しい製品作業の残件はなく、まさの最新「おけ」で受入済み。次の依頼を待つ。

読む順：
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/AGENTS.md、HANDOFF_DD_MINUTES_20261007.md
4. pwa/manual/1-1-intro.md、pwa/spec/3-24-project-surface-pages-current-spec.md、3-3-meeting-flow-current-spec.md、5-17-dd-package-current-spec.md、3-23-project-format-current-spec.md
5. pwa/BUGS.md、pwa/manual/2-3-pj-cockpit.md・2-6-admin-ops.md・2-7-task-management.md、pwa/design/db_schema.md、ios/DESIGN.md
6. 開発履歴はpwa/design_log/sessions_2026-10.mdの同日DD議事録終了記録。別件はHANDOFF_DD_LAYOUT_20261007.md、HANDOFF_ACCESS_LOGIN_20261007.md。

状態：
DD /dd/sol?tab=governance は開催済み経営会議を全期間表示する。開催日・決議事項・決議結果の3列で、1議案と結果・条件を同じ行に並べる。3会議13組（5/3/5行）。開催日は会議単位で行結合し、その中のボタンで本文モーダルを開く。会議タイトル・全体要約を議案列へ戻さない。承認を推測せず、方針確認・継続審議・次回確認を区別する。確認済み添付はない。今後の関連資料は、該当議案に対応する認可済みDD文書だけを既存閲覧経路で開く。
固有名詞はコックピットのPJ管理→固有名詞で追加・編集・削除・保存する。MTG欄に戻さない。正しい表記は山地・河尻・ツウテック。最新の辞書はOSが正本、SOL/PROPER_NOUNS.mdは初回の控え。辞書保存は次回の議事録生成へ適用し、過去本文を自動書換えしない。
正本はproject_configのproper_noun_spellingsとmeeting_resolutions:<meeting_id>。議案・結果はsourceHashと原文根拠を検証し、未整理は未確認。新schema/RLS/環境変数はない。H-1の抽出手順も同期済みだが、次回実抽出と実添付資料の開封は未確認。依頼なしに自動化の試験実行・通知をしない。

保存・検証：
受入実装はc8251f24、49ad7264、c86604d3、ff0b346cまでmainへ反映済み。名字統一68行・固有名詞補正6行、13組の対応データを保存して読戻し。元のID・URL・source_hashを保持。DD/重要画面/ナビ/標準フォーマット/辞書/H-1安全性/型/本番ビルドの確認と、PC1392px・スマホ指定390pxの本番表示、本文モーダル、辞書保存・再取得が通過。
終了時の説明書同期はv3.161.16 / 6191ad9012efee542f8f5bec465905cbf6395f38を本番で読戻し。後続の権限・フェーズ変更も含む。終了文書だけの追加commitは履歴で確認する。main aligned、未保存・未送信・競合なし。
証跡はSOL/work/amie_minutes_surname_20261007/、amie_minutes_proper_nouns_20261007/、amie_resolution_pairs_20261007/。VERIFICATION.md、スクリーンショット、限定補正の読戻しを参照。before.jsonやSQLはローカル機密控えなのでリポジトリや報告へ本文を転記しない。
使い捨てmain clone2個、旧PT移行文と以前のroot移行文は /Users/masa/.codex/cleanup_archives/20261007-dd-minutes-194015/ に回復可能な控えとして保管。旧移行文を現行指示として実行しない。今回の新規branch/worktreeは0、ローカル枝はmainのみ、本体worktree1個。会話の検討材料0件。

次の行動と運用：
まさの次の依頼から対象を決める。議事録に戻るなら現行画面の13行と登録根拠を照合してから指定差分を進める。元の表記・議案と結果が非対応の形式へ戻さず、過去データ補正のスクリプトやSQLを再実行しない。
着手前にgit fetch、HEAD/origin/main、未保存差分、本番/api/build-infoを確認する。main一本、新branch/worktree禁止。共有差分をreset/stash/delete/一括保存しない。PJ番号で表示を分けず、共通フォーマットと既存の認可を使う。
仕様・マニュアル・附則・ios/DESIGNを同じ変更単位で更新する。反映はAMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.shでまとめ、SHAと実画面まで確認。ブラウザ確認は束縛した対象タブだけを操作し、アプリ全体へキーを送らない。権限・公開範囲・対人通知・資本条件を依頼外に変更しない。
