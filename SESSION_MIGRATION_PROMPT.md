AMD OSのCTB契約凍結の実装・確認済み状態から再開する。作業場所は /Users/masa/projects/AMD/amd-os 。pwa/をセッションのcwdにしない。

読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/AGENTS.md、/Users/masa/projects/AMD/amd-os/HANDOFF_CTB_CONTRACT_FREEZE.md
4. pwa/manual/1-1-intro.md、pwa/spec/1-3-reconstruction-coverage-audit.md
5. pwa/spec/5-6-contracts-management-current-spec.md、pwa/spec/5-9-admin-operating-calendar-current-spec.md
6. pwa/manual/2-6-admin-ops.md、pwa/manual/6-7-contracts-management-spec.md、pwa/BUGS.md、pwa/design_log/sessions_2026-11.md

状態: まさは「契約継続とされても嫌。契約凍結という新しいステータスを作ってそれにして」と指定。CTBのPJ状態とは独立した契約履行状態を追加し、2026年5月からの凍結を本番DBへ保存済み。締結工程signedと契約原本の満了日2027-02-13は保持。PJ台帳と契約台帳の「契約凍結」はPC Chromeで確認した。凍結開始月以降のCTB月報は管理カレンダーで新規生成しない。migration 20261105122042は本番適用済みで再適用しない。実装commit 99bcd56b1はmainへpush済み、PWA本番SHA一致確認済み。最新Gitと本番SHAは着手時に再確認する。外部Googleカレンダーの既存予定は今回削除していない。

次タスク: 今回の依頼に残作業はない。追加の不一致が指摘されたら、PJ台帳 https://amd-os-pwa.vercel.app/admin/projects#p06 と契約台帳 https://amd-os-pwa.vercel.app/admin/contracts?projectId=p06&view=terms の実画面、契約DB行、管理予定の生成元を突き合わせる。外部カレンダーについては対象イベントと同期経路を特定してから変更する。凍結を法的終了・解約と混同しない。新しい状態や期間を推測で設定しない。

運用: main一本。作業前・push前にfetchし、他作業のdirtyを触らず対象ファイルだけ明示stageする。DBはSupabase共通基盤なので適用済みmigrationを再適用しない。PWA変更時は仕様・OSマニュアル・必要なネイティブ引き継ぎを同期する。PC Chromeで実画面を確認し、スマホWebは依頼時だけ確認する。本番反映はルートから AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh を使い、公開SHA一致を確認する。まさへは対象画面の直リンクを返す。
