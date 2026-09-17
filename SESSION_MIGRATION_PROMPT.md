# 次セッションへの引き継ぎ — AMD OS変更履歴・外部アクセス承認

あなたは株式会社チームアルマダのAMD OSを引き継ぐ「えいみ」。cwdは `/Users/masa/projects/AMD/amd-os` にし、`pwa/`をcwdにしない。正規checkoutには別作業のdirtyと未push commitがあるため、所有者と意図を確認せず変更、reset、stash、rebase、削除、`git add .`をしない。

## 読む順

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/pwa/HANDOFF_pwa_rebuild.md`
4. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
5. `/Users/masa/projects/AMD/amd-os/pwa/AGENTS.md`
6. `/Users/masa/projects/AMD/amd-os/pwa/manual/1-1-intro.md`
7. `/Users/masa/projects/AMD/amd-os/pwa/spec/1-3-reconstruction-coverage-audit.md`
8. `/Users/masa/projects/AMD/amd-os/pwa/manual/2-6-admin-ops.md`
9. `/Users/masa/projects/AMD/amd-os/pwa/spec/2-1-pwa-runtime-routes.md`
10. `/Users/masa/projects/AMD/amd-os/pwa/spec/2-2-pwa-surface-inventory-current-spec.md`
11. `/Users/masa/projects/AMD/amd-os/pwa/spec/2-7-ui-design-code-current-spec.md`
12. `/Users/masa/projects/AMD/amd-os/pwa/design/SPEC_pwa.md`
13. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md`
14. `/Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-09.md`

## 状態スナップショット

- productionは `https://amd-os-pwa.vercel.app`、配信版は `v3.141.5` / `9c836b46d9aa0294c47c8f4d41822c887a858f70`。closeout文書commitはこのproduct commitの後にmainへ積まれている。
- `/admin/change-history` はOS全体の監査履歴を、実行者、JST日時、対象、項目、変更前後の組で表示する。秘密値は伏せ、大きい値は省略し、履歴自体は追記専用。
- メンバー履歴は `members.id` を対象行IDとして解決し、`member_name`、`code_name`、`member_id` で誰の変更かを表示する。メールアドレスは使わない。
- 日付時刻はすべて `Asia/Tokyo`。UTC offsetや`Z`を画面へ出さず、同一秒内の差だけミリ秒を表示する。
- 同一自動処理内の同一メンバーの最終ログイン連続更新は一件に集約する。本番では11件が `2026/09/17 00:26:28 → 2026/09/17 08:43:56` として表示された。
- 安全な変更だけ「戻す」を表示し、現在値が履歴の変更後と一致する場合だけ同一transactionで逆操作する。戻し自体も履歴に残す。
- 未許可外部メールのlogin要求は `workspace_access_requests` へ集約し、まさ（ID001）へSlack DMする。範囲が一意ならDMから、未特定なら `/admin/access` で範囲を選んで許可または拒否する。
- 正規checkoutはcloseout確認時に別作業由来のdirty 29 pathと未push 3 commitがあり、`ahead 3 / behind 229`。この状態を今回の作業と混ぜない。

## 次のタスク

今回の依頼範囲に未解決はない。まさの次の依頼から開始する。変更履歴を触る場合は、raw IDやraw timestampをそのまま並べず、利用者が一行で対象・項目・変更前後を把握できる表示を先に決める。

## 確立済みの運用ルール

- SupabaseがDBの正本。新しいpublic tableには監査trigger refreshを同じmigrationで含め、本番適用後にschema、migration history、実データを読み戻す。
- actor情報がないservice-role更新は個人名を推測せず `OS自動処理` と表示する。
- 監査画面の日時はJST専用formatterを通す。raw ISO、UTC offset、`Z`を利用者向け表示へ混ぜない。
- UIは情報密度を落とさず、desktopと390px幅で行高、折返し、操作領域、横overflowを実コンポーネントで測る。
- 画面や運用を変えたらmanual/spec/changelog、必要な`ios/DESIGN.md`、設計ログ、BUGSを同じ変更で同期する。
- PWA変更はmainへ一度にまとめ、`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`で反映し、`/api/build-info`のSHA/version/`dirty:false`と認証済み実画面を読む。Vercel CLIの直接deployは禁止。
- 正規checkoutの別作業dirtyを戻さない。安全に同期できなければ最新`origin/main`のclean cloneで対象差分だけを扱う。
- Slack、メール、DBの実データ操作は依頼範囲だけ。外部通知の実送信テストは明示許可なしに行わない。

## 完了条件

- コード、仕様、操作マニュアル、変更履歴、BUGSの対象差分が一致する。
- 対象テスト、型検査、lint、critical UI検査、desktop/mobileの画面確認が成功する。
- mainへpush済みで、本番SHA/versionと認証済み画面を読み戻す。
- 一時cloneや検証serverを片付け、正規checkoutに別作業の変更を持ち込まない。
