# SOL DD社会課題ページ：登録と配布の記録（2026-10-07）

内容正本は/Users/masa/projects/AMD/SOL/SOL_DD_CONTENTS_PLAN.md。研究・事業分析はそちらへ保存し、この記録には技術的な反映だけを置く。

- 既存project_configのp21/founding_background（version1/title/summary/bodyMd/sourceRefs）の本文を改訂。JSON/.md正本を更新し、変更前md5一致・行ロック・対象1行確認のSQL sol-founding-background-revision-20261007.sqlを追加。適用済み、再実行不要。
- 登録値と最終JSON全項目一致。他設定7件とDD2件不変。既存parseProductDescription正常、4節・旧文言なし。schema/RLS/API・画面構造・秘密値追加なし。
- spec 5-17と6-1、manual2-6と9-3を同期。文書は画面にも掲載されるため配布対象。skip ciの誤指定はpush検査で停止、印を外して正規deploy.shへ切替。hookや検査の回避なし。
- 共有元の別担当差分を保持し、mainのclean cloneで必須検査・push・配布。commit d1d709698b1fc607933478330fde6bddc396491d。本番v3.160.28の同SHA・main・dirty=falseを確認、2分40秒で完了。一時cloneは削除、feature branch/worktree追加なし。
- 本番Chrome1532×1084・110%で上部の研究/受賞表と下部の3節を確認。文字切れ・表の横溢れ・重なりなし。PCのみ、モバイル未確認。
- 技術証跡：/Users/masa/projects/AMD/SOL/work/amie_founding_background_20261007/verification.json、deploy.log、production-build-info.json、REVIEW_AND_CLOSEOUT.md。最新引き継ぎ：同PJのHANDOFF_DD_SOCIAL_20261007.md。運用の教訓は同PJのBUGS.md。

今回の再開用文書はSOL（Git管理外）へ保存。後続の権限・組織図修正は各担当へ帰属し、今回の記録commitへ含めない。
