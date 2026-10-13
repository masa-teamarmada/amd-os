AMD OSのDD秘密指定・スタンプ・NDA入場確認を引き継ぐ。正規cwdは /Users/masa/projects/AMD/amd-os（pwaをcwdにしない）。まさ受入済み、今回の残件なし。新しい指示なしに追加実装や通知を始めない。

読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. AGENTS.md、HANDOFF_DD_NDA_ENTRY.md
4. pwa/manual/1-1-intro.md、pwa/spec/1-3-reconstruction-coverage-audit.md、pwa/spec/5-17-dd-package-current-spec.md、pwa/manual/2-6-admin-ops.md、ios/DESIGN.md
5. pwa/BUGS.md、pwa/design_log/sessions_2026-10.mdの2026-10-13終了節

状態:
2026-10-13終了確認時のmain/origin/mainと本番はf349b6f7 / v3.162.35。DD最終実装fb0d413b / v3.162.32はその祖先で、DD対象ソースに後続差分なし。終了文書のcommitはこのsnapshotより後になる。未保存・未push・conflictなし、local branchはmainのみ、登録worktreeは本体1つ。再開時にfetch・git status・ahead/behind・本番 /api/build-infoを取り直す。

まさの意図と実装:
契約書で個別指定する手間を増やさず、DD内の追加・更新を含むすべての情報を標準表示で秘密指定する。赤い生成CONFIDENTIALスタンプを使用。大きな専用余白は取らず、閲覧画面だけ右端に160px（狭幅100px）で下のコンテンツへ軽く重ねる。資料・PDF/Excel/ZIPには秘密指定を残し、保存原本を加工しない。

DD入口で「秘密保持契約の確認」を出し、「はい」の本人・日時・対象会社名を保存できてから本文へ進む。「いいえ」は一覧へ戻る。会社名は会社概要で設立済みの正式商号だけをチームアルマダに加え、予定社名は使わない。既存DD個別付与を毎回検証し、NDA申告で権限を増やさない。確認は本人/PJ/文言に結び付く署名cookieで最大1時間、ログアウト・文言/会社変更で再確認。契約台帳の締結状態とは別の自己申告。管理画面の「入場確認・閲覧記録」で回答者・日本時間の日時・対象会社名を表示する。

検証の範囲:
対象lint、8GB指定の型検査、DD/NDA/全deploy検査、PC/スマホの実画面、確認前の本文非表示、いいえで戻る操作は確認済み。保存成功/失敗・署名・本人/PJ・直接入口は実routeの依存置換で検査。DBは一時検査行の保存/日時readback後に片付けた。実ユーザー自身による本番「はい」→入場→本人の管理記録の一連操作は未確認。本人の締結済み申告を代行しない。独立DDのネイティブ移植は未実施。生成PDFの実体検査とブラウザ内蔵PDFビューアの目視を混同しない。

素材・成果物:
コード素材はpwa/public/dd/confidential-stamp-20261012.png / .webp、生成由来は同README。Driveの共有ドライブ/ARMADA/a0_management/AMD OS資料室/261012_DD秘密情報スタンプと261012_DD入場確認に、素材・出力検査物・画面画像・検証HTML/JSを保存済み。今回の仕様正本はspec/5-17、使い方はmanual/2-6。旧一時clone/previewは復元可能な終了アーカイブへ移動済みで、再開に不要。

最初の次の行動:
新しい依頼を受けてから、最新Git/本番状態を確認して着手。今回の機能を作り直さない。入場や記録の相談なら、該当本人の実操作と監査記録を先に照合する。表示修正なら、スタンプの透明領域だけでなく赤枠と文字、狭幅メニュー、admin表内スクロールを実寸で確認する。

確立済み運用:
main一本、新規branch/worktree・サブエージェントなし。別担当の変更をreset/stash/一括commitしない。仕様変更はspec/manual/附則と共通DESIGNを同期。PWA反映は AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh に束ね、Ready・本番SHA・実画面まで確認。DB schema・新しい環境変数・理論は今回変更なし。原本・契約台帳・認可の境界を維持する。メール送信禁止、NDA自己申告を本人に代わって押さない。会話の検討材料は0件。
