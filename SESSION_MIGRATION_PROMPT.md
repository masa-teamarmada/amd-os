AMD OSの契約通知・取下げ修正を引き継ぐ。作業場所は /Users/masa/projects/AMD/amd-os。まさ受入済みで、この件の残作業はなし。新しい依頼なしに追加実装・通知・再申請を始めない。

読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/AGENTS.md と HANDOFF_CONTRACT_NOTIFICATIONS.md
4. pwa/manual/1-1-intro.md、pwa/spec/1-3-reconstruction-coverage-audit.md、pwa/spec/5-6-contracts-management-current-spec.md、pwa/manual/6-7-contracts-management-spec.md
5. pwa/BUGS.mdの2026-10-16契約通知節、pwa/design_log/sessions_2026-10.mdの同日終了節

状態:
実装はa8b87835（取下げ導線）と5e68ea25（メール判定・通知文面）。本番v3.162.55への反映を確認後、他の作業が進み、終了監査時点ではmain/origin/main・本番とも864ccc8d / v3.162.56。この2件の契約関連ソースに後続差分なし。終了文書のcommitはこの観測より後になる。再開時にfetch、status、ahead/behind、/api/build-infoを取り直す。
共有フォルダの燃料計画の変更（監査開始時7、仕様/マニュアル/版数を含む10ファイルへ増加）は、別のactiveチャット「バイオ燃料の脂肪酸原価を確認」（01a143f3-9b20-7302-b822-ea831431d0ba）が編集中。今回の対象ではない。所有者の確定・反映前に戻す、消す、一括commitする操作は禁止。詳細と判断条件はHANDOFFの表を読む。今回の文書はpush済みにして閉じる。

まさの困りごとと解決:
テストで契約フローを1件作った後、Slack通知が続き、契約一覧で対象が分からず取り下げられなかった。テスト契約bは既存RPCで申請をcancelled、契約もcancelledにした。文書・履歴は保持し、送信待ちは0件とreadback済み。新しい催促や取下げ通知は送っていない。
今後は契約台帳上部「契約フローの確認・取下げ」→該当行「確認」→詳細下部「フローを取下げ」。本人の準備中・承認待ち・承認済みが対象。契約詳細からのフローリンクは既存申請を優先し、フローから契約へ戻ると対象の詳細を直接開く。
続いていたSlackはテスト申請の再送ではなく、Gmailを拾うメール検知通知だった。銀行・募金・サービス案内や一般未承認通知を契約として拾っていた。具体的な文書・署名の根拠を必須とし、過去の誤検知だけで同じメールの会話を拾い続けないように変更した。メール通知は「【契約メール】」から始まり、押印申請通知と区別する。必要な契約メールの通知は維持。

確認済みと未確認:
分類・状態/本人制約・表の回帰検査、型検査、全体構築、正規反映の検査成功。実メール7件を読取りだけで再判定し、不要4件除外・文書関連3件維持を確認。通知の試験送信なし。本番dryRun=1は200/ok、pending0/sent0/failed0、監視エラーなし・lease解放を確認。取下げ画面、既存申請と契約詳細の相互移動、新入口をChromeのPC/390px幅で確認。将来届く未知のメールの判定は未確認。
証跡は /Users/masa/.codex/visualizations/2026/10/16/01a1439f-814e-7ce1-a106-58a2881d8094/ のcontract-flow-review.md、contract-mail-notification-audit.mdと画面画像。メール本文や秘密値は保存していない。仕様はspec5-6、操作はmanual6-7、他プラットフォーム境界はios/HANDOFF_ios_to_pwa.md。schema・RLS・環境変数・監視間隔・理論は変更なし。ネイティブ専用UIは未移植。

最初の次の行動:
新しい依頼を受けてから最新状態を照合する。通知がまた多い相談なら、ユーザー指定Slackの実着とworkflow_mail_events/alert_deliveriesを読取り、メール検知と申請イベントを先に区別する。テスト申請を作り直したり、確認のための実通知を送ったりしない。

運用:
main一本。新branch/worktree・サブエージェントを作らない。共有dirtyをreset/stash/delete/一括commitしない。PWA変更はspec/manual/附則を同じ変更単位で同期し、反映は AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh で束ね、Ready・公開SHA・本番の動作を確認する。終了記録だけの画面非表示文書は既存deploy_skipの判定に従ってpushし、不要な再構築をしない。メール送信は禁止。会話の検討材料は0件。
