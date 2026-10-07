SOLのDD製品説明資料を引き継いで。作業種別は開発。資料の内容正本は /Users/masa/projects/AMD/SOL、アプリの正本は /Users/masa/projects/AMD/amd-os。

読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/AGENTS.md と HANDOFF_SOL_DD_DENSITY_20261007.md
4. /Users/masa/projects/AMD/SOL/SOL_DD_CONTENTS_PLAN.md
5. /Users/masa/projects/AMD/amd-os/pwa/spec/5-17-dd-package-current-spec.md、pwa/manual/2-6-admin-ops.md
6. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md と pwa/design_log/sessions_2026-10.md

状態:
製品説明の初稿、在庫シアノからの燃料生産、SOLロゴ入り装置写真、現行処理とSOL処理の上下比較図、用途別工程図、TRL1〜9の矢印を作成・採用済み。写真は透明配管に茶色い流入水と透明な処理水、透明な大型シアノ充填カートリッジ。採用PNG2枚はそのまま維持する。
最後の指示は「フォント大きすぎない？ とにかく全ページエグサマのレベルで情報密度を高くして」。全DD本文を12px中心、表・余白を縮小。製品説明は写真と図、関連する節を左右へ配置。現在TRL4、シード6、A7、B8は現在と計画を分けて維持。
実装3374d609、公開ba623c78/v3.160.28、本番Ready・SHA一致。PC1392×824で40資料の共通密度と横溢れ0を確認。製品説明7節・4表・2Mermaid・4画像、本文2607.63pxで約56%減。略歴29職歴・8受賞を維持、約61%減。DD回帰・型検査成功。製品説明/略歴のDB正本不変、公開画像4件バイト一致。
Gitはmainへ保存・push済み。引き継ぎ開始時HEAD f4253ed5、ahead/behind 0/0。後続の別担当変更があるため再開時に現在値を確認する。
素材と制作元はDriveのp21_sol/261007_製品説明資料。原稿12290bytes、用途SVG、TRL SVG、制作元、改訂メモ、完成画面。採用PNG原本は前日の261006資料フォルダ。検証証跡はSOL/work/amie_dd_density_20261007/production-readback.json、live-40-pages.json、product-dense-live.jpg。過去の段階はOS rootのHANDOFF_SOL_DD_PRODUCT_MEDIA_20261006.md、HANDOFF_SOL_DD_PRODUCT_VISUAL_20261006.md。
試作ページ、試作サーバ、試作タブは終了。新規branch/worktreeなし。共有checkoutの創業背景・仕様・マニュアル等の未保存差分は別の稼働中チャット「DDパッケ社会課題ページを修正」（01a11467-7a83-7461-92fc-62421036dd56）のもの。変更・削除・一括保存しない。古い未追跡SESSION_MIGRATION_PROMPT_task_based_pt_20260922.mdは「タスク方式への変更」（01a0c711-2edc-7cc3-b346-fbe198603454）の草稿で、今回の指示として実行しない。

次の行動:
今回の依頼は完了。追加実装は不要。新しい依頼を受けたら本番 /dd/sol?tab=product-description を確認し、指定された箇所だけ進める。採用済み写真・比較イラストとエグサマの密度を維持し、達成済みと調達後目標を混ぜない。製品説明の変更は共通ページ経由でワークスペース/コックピット/DDに反映される。

運用:
main一本で新しい枝・worktree・子エージェントを作らない。共有差分は対象だけを扱い、reset/stash/一括commitを使わない。必要ならmainのclean cloneで作業する。仕様・使い方・全プラットフォーム設計を同期し、npm --prefix pwa run test:dd-package と型検査、実PC画面を確認する。CSS ModulesでTailwindのクラスを参照する際は属性セレクタを使い、SVG/foreignObjectの内部には本文CSSを適用しない。
PWA変更の配布は AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh でmain push、Ready、配信SHAと実画面まで確認。データ更新は旧値一致と読戻しが必須。依頼外のDB操作、公開範囲変更、メール・Slack送信はしない。
