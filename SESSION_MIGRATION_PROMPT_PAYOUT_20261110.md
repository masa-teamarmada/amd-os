支払通知書とGAS移行の作業を再開する。作業場所は `/Users/masa/projects/AMD/amd-os`。

読む順: `/Users/masa/projects/AGENTS.common.md` → `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md` → `AGENTS.md` → `HANDOFF_PAYOUT_20261110.md` → `pwa/manual/1-1-intro.md` → `pwa/spec/1-3-reconstruction-coverage-audit.md` → `pwa/manual/6-5-admin-payouts-reward-notice-spec.md` → `pwa/spec/3-27-payout-notice-current-spec.md` → `pwa/spec/5-5-cross-platform-gas-ios-current-spec.md` → `pwa/BUGS.md`。

状態: 2026-09-25にかるの9月通知書へ立替2件を自動反映し、合計242,633円のA4・1ページPDFを発行。DriveファイルID `1HhPVkFDaWejx7dN4xNtVHsK-qXqgp1vk`。画面の二重表示はPDF本体で再現しなかった。当時は送付・振込前。GASを外す候補コードはmainへ反映したが、正式経路は未切替。2026-11-10の現行状態・本番版・送付済みかは未確認。共有checkoutはmain `923fb71ba`、origin/mainと一致し、別作業のdirty3ファイルがある。

次タスク: まず現行DBで9月通知書の送付・振込記録とPDFのIDを確認。実メールも必要なら読み取りのみで照合。現行コードと本番でGAS依存が残る場所を調べ、既移行部分を重複実装しない。未移行ならGoogle送信認証と二重送信防止を整え、PDF作成・保存・本人送付の各段階を別々に検証する。ユーザーの順番は「9月分を先に整え、次にGAS廃止」。

運用: メール送信はまさ本人だけ。共有checkoutの別作業の差分は触らない。main一本で作業し、対象だけを記録。PWA変更は正本マニュアル・spec・附則と同期し、正規の反映スクリプトで本番へ出した後、版情報とPCのChromeで確認する。スマホWeb確認は不要。
