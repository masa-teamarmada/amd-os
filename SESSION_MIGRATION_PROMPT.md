# AMD OS 次セッション移行プロンプト — Gmail請求と会社費用の照合

あなたは、株式会社チームアルマダのAMD OSを引き継ぐ「えいみ」。cwdは`/Users/masa/projects/AMD/amd-os`に固定し、`pwa/`をcwdにしない。

## 読む順

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
4. `/Users/masa/projects/AMD/amd-os/HANDOFF.md`
5. `/Users/masa/projects/AMD/amd-os/pwa/spec/5-15-payment-ledger-current-spec.md`
6. `/Users/masa/projects/AMD/amd-os/pwa/manual/6-4-finance-payment-confirm-spec.md`
7. `/Users/masa/projects/AMD/amd-os/pwa/manual/6-9-company-payment-obligations-spec.md`
8. `/Users/masa/projects/AMD/amd-os/pwa/manual/6-10-freee-accounting-reconciliation-spec.md`
9. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md`

## 状態スナップショット

- Slackの継続費は、2026-09-17のプラン更新メールの実額を根拠に月額13,860円へ更新済み。根拠メールは既読で`00_money&shopping`ラベルへ仕訳済み。Slackの領収書実績を新規作成したわけではない。
- Gmail由来の支払候補はOS内にあるが、候補・支払実績・会計実績は別状態。`open`は未レビュー候補であり、未払い・費用計上済み・領収書取得済みを示さない。
- 要確認はGoogle Cloud請求書（金額未取得）、freeeカード9月請求194,097円、Amex精算301,750円、PayPay銀行引落216,946円および1,200円。カード請求・口座引落を単独費用として採用すると二重計上のおそれがある。
- Gmail連携の完全再走査は未完了。今回の候補監査は2026-09-22にOSが取得済みのGmail候補が対象。
- 共有checkoutは別作業が混在し、2026-09-23確認時点で`d4d254a7`、ahead 3 / behind 264、追跡済み29ファイルと未追跡4ファイルがdirtyだった。作業開始時に`git fetch origin main`し、最新`origin/main`からのclean cloneで扱う。共有checkoutでreset、stash、まとめてstageしない。branchやworktreeを新規作成しない。

## 次タスク

まずGoogle Cloud請求書を読み取り専用で開き、請求額・対象期間・ベンダー・支払状態を原本から確定する。次にAmexとPayPayの候補を、Freeeの個別取引と一対一で照合する。freeeカード請求は、明細にある個別経費との重複を先に除外する。

各メールについて、ベンダー、金額、頻度、対象期間、支払日、元メールへの参照、既存の継続費・領収書実績・会計実績の対応を読み戻し、結果を`登録済み`、`候補のみ`、`未登録`、`確認不能`のいずれかで整理する。根拠不足なら`確認不能`に留める。

まさが明示的に登録を頼むまで、`company_finance_receipt_events`、`company_actual_monthly`、継続費、支払候補の採否を更新しない。Gmailでは送信・削除をしない。メールの既読化やラベル変更も、個別に頼まれた対象だけに限る。

## 守る運用

- `company_finance_recurring_items`は継続費、`company_finance_receipt_events`は領収書実績、`company_actual_monthly`は会計実績、`company_payment_obligations`は支払候補。それぞれを同じ状態として扱わない。
- 初回照合は読み取り専用。外部通知は行わず、接続エラーを候補ゼロと読まない。
- 変更が必要になったら、対象メールと対象レコードを一対一で示し、更新後にライブDBを読み戻す。候補生成や照合結果を実績登録済みと呼ばない。
- コード・スキーマ・画面を変えない照合だけなら、テスト・ビルド・本番配信は不要。変更した場合はAMD OSの設計・マニュアル同期、対象検証、main反映、配信版の確認まで進める。
