AMD OSのPWA「取締役会と開閉カードの視認性改善」を引き継ぐ。作業場所は /Users/masa/projects/AMD/amd-os。pwa/をセッションのcwdにしない。まさには毎回、確認対象ページの直リンクを返す。

読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/AGENTS.md と /Users/masa/projects/AMD/amd-os/HANDOFF_DISCLOSURE_UI.md。ルートのHANDOFF.mdは別件の経営会議管理画面の引き継ぎなので、このUI作業の正本として上書きしない。
4. pwa/manual/1-1-intro.md と pwa/spec/1-3-reconstruction-coverage-audit.md
5. pwa/spec/3-23-project-format-current-spec.md「機関決定の比較一覧」と pwa/spec/2-7-ui-design-code-current-spec.md「開閉カードの操作」
6. pwa/manual/2-3-pj-cockpit.md「株主総会・取締役会」と pwa/manual/2-1-member-quick-start.md「カードの開閉」、ios/DESIGN.md、pwa/BUGS.md、pwa/design_log/sessions_2026-11.md

状態スナップショット（2026-11-05引き継ぎ着手時）:
まさの指摘「会社概要の機関設計…などの不要な表記」「決議事項が目立たない」「トグルの中身が薄いグレー」「文字ではなくカード全体を押したい」「開閉するカードはホバーで全体を薄青に」をPWA UIへ反映した。機関決定の行内詳細は白地で青い「決議事項」を主領域に置き、資料は補助欄へ。機関決定一覧は行全体、通常の開閉カードは見出し行と周囲の余白で開閉し、PCホバーでは操作面全体が淡青になる。本文・資料リンク・入力・編集・文字選択・キーボード操作は守る。実装commitはa5636bc95、49707a2ca、d7a562341、0eeb9b1c4、9c3d84c96。最後のUI版v3.165.17は当時本番SHA一致とPC Chrome実画面で確認済み。
引き継ぎ着手時のmain/origin/mainは21a53d2c5でclean、本体worktree1・ローカルbranch mainのみ。公開 /api/build-info はv3.165.18、SHA a1adb5c13で、UI版を含む後続版。最新のGit・本番状態は次セッション開始時に再確認する。正本は上記spec/manual、開発履歴はdesign_log、今回の引き継ぎはHANDOFF_DISCLOSURE_UI.md。スクリーンショット素材は元チャット添付、対象ページの直リンクは https://amd-os-pwa.vercel.app/project/p00/cockpit?tab=board-meeting 。

次の作業:
この依頼分に残作業はない。新しい表示フィードバックが来たら、まさの指摘のニュアンスを保持し、まず対象URLをPC Chromeの実画面で再現する。取締役会だけでなく株主総会・通常業務画面の他の開閉カードにも同じクリック範囲とホバー契約が成り立つかを見る。決議結果の意味色、未確認・署名待ち等の原記録の意味、資料リンクと編集ボタンの独立操作を崩さない。変更後は対象ページへの直リンクと、本番反映まで確認した範囲を別々に報告する。

運用:
main一本。既存の別作業のdirtyを戻さず、対象ファイルだけを明示stageする。変更前・push前にfetchして同期確認。PWA画面を変えたらspec・OS manual・ios/DESIGNの該当箇所を同期し、PC Chromeで表示確認。依頼されていないスマホWeb、Swift、DD、DBへ変更を広げない。PWAの本番反映はリポジトリルートから AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh を使い、buildと公開 /api/build-info のSHAを確認する。main pushだけを本番確認と呼ばない。終了時はhandoffとcloseoutの各ゲートを通す。
