SOLのDD・コスト試算の表示改善を引き継ぐ。正規の作業場所は /Users/masa/projects/AMD/amd-os、資料と検証画像は /Users/masa/projects/AMD/SOL。今回の修正はまさ受入済み。新しい依頼がない限り、実装・DB更新・採算精査を自動再開しない。

読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/AGENTS.md、HANDOFF_COST_PWA_20261007.md、pwa/design_log/CLOSEOUT_SOL_DD_COST_20261007.md
4. pwa/manual/1-1-intro.md、pwa/spec/3-8-cockpit-current-spec.md、3-24-project-surface-pages-current-spec.md、5-17-dd-package-current-spec.md、pwa/manual/2-3-pj-cockpit.md、ios/DESIGN.md
5. BUGS.md、pwa/BUGS.md。開発履歴はpwa/design_log/sessions_2026-10.md
6. 計画の内容に進む場合だけ、SOL/LONG_TERM_PLAN.md、SOL_DD_CONTENTS_PLAN.md、HANDOFF_LONG_TERM_PLAN_20261007.md。採算精査はHANDOFF_COST_REVIEW_20261007.mdとその目的別mdを先に読む。

状態:
ブラウザではコスト試算が改善されているのにアプリでは変わらない、という指摘を修正した。アプリはChromeのインストール済みPWA。旧1280px限定の配置が1234px幅で縦積みとなっていた。1024pxから入力・明細をコンパクトにし、1100pxから入力と結果を横に並べる。結果欄は320px、1280px以上で380px。CSSと高さ計測の判定を揃え、3つの計算エンジン・3つの領域の共通部品へ適用した。計算・入力値・保存権限・公開範囲は変えていない。
実装e2143fed / v3.160.27はmainへ保存・push・正規反映済み。1172pxの実アプリ、1392pxのブラウザ、390pxの狭い画面を確認。廃液・燃料・汎用の検査、型検査、反映時の必須検査が成功。画像はSOL/outputs/261007_アプリのコスト試算表示確認/。確認時の金額を最新の採算結論として使わない。
終了着手時の正規repoはmain eb3b939a、origin差0/0、未保存・未追跡・競合0。本番は後続更新のv3.161.16 / 6191ad90。自分の変更と本番SHAは現行mainに含まれ、該当の幅条件も残っている。終了文書の最新commitと本番は次回git履歴・build-infoで取り直す。現行本番の全画面を終了時に再検収したわけではない。

次の行動:
今回の残件はなし。新しい依頼の対象を決めてから最新状態を確認する。表示差なら、実アプリの表示幅・拡大率・適用配置を測って原因を確かめる。版だけを見て古い表示が残ったと断定しない。長期計画は後続のv0.5が正本で、旧初版へ戻さない。2035年4月IPOは条件付き計画。計画・採算・月次・資本政策の未確定値を推定で決定しない。別担当の採算精査を明示依頼なしに再開しない。

運用と保管:
着手時にgit fetch、HEAD/origin/main、dirty、本番版を確認する。main一本、新規branch/worktree禁止。共有差分をreset/stash/delete/一括commitしない。表示変更は仕様・使い方・附則を同じ作業で同期する。検証は実アプリとブラウザで主要値・入力・根拠全文・横はみ出しを確認する。製品反映は AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh にまとめ、Ready・SHA・実画面を確認する。ローカル検証のために追加の認証権限を付与しない。
確認用main cloneは /Users/masa/.codex/cleanup_archives/20261007-cost-pwa-closeout/amd-os-main-clone に退避済み。旧SOL/work/261006_dd_development_issues/amd-osを再開先にしない。復元控えは同archive、旧共用移行文はSESSION_MIGRATION_PROMPT_DD_LAYOUT_BEFORE_COST_CLOSEOUT_20261007.mdに保持。検証画像・計画原稿はセッション外へ保存済み。新規枝/作業ツリーなし。会話の検討材料0件。
