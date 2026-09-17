# HANDOFF - AMD OS PWA

- 更新: 2026-09-17 JST
- セッション: 納付済み誤警告の是正と不納付加算税の現金仕訳
- 作業種別: mixed（PWA開発 + 本番の支払義務/freee会計反映）

## 最新セッションの到達点

- `/admin/payments` と `/admin/schedule` の赤い期限超過は、確定額・支払証跡なし・同額候補なしの法定納付だけに限定した。見積額、金額未取得、`needs_review`、同額出金の月割当待ちは「要確認」であり、未納と断定しない。
- freeeの同じ納付先・照合期間に未使用の出金候補が1件だけなら、見積額を実額へ置き換えて納付済みにする。確定額との差異は、加算税等の実通知が親へ紐づく場合だけ許す。同じ候補を複数月が参照するときは自動消込しない。
- 過去の法定納付は納期限後120日まで再生成する。現行運用前の古い給与期間を、現在の給与仕訳から新しい滞納として逆生成しない。
- Vercelの会社スケジュール定期実行を毎日09:35 JSTへ復旧した。支払義務の更新を同日中に予定へ反映する。
- 本番の赤い期限超過は0件・0円。源泉所得税1-6月分は2026-07-17の533,112円、消費税中間納付は2026-08-31の811,600円で納付済みに更新済み。
- 不納付加算税26,500円は、まさの現金納付証言を根拠に2026-09-30付で納付済み。freeeへ `租税公課 / 現金`、税区分対象外、未決済残高0円で登録した（取引ID `3784543055`）。OSの支払義務と予定も完了、freee証跡を紐付け済み。

## 本番の要確認

- 労働保険料（2026年度）29,056円: 見積額、支払候補なし、`needs_review`。未納とは断定していない。
- 社会保険料（2026年7月分）304,119円: 同額出金はあるが6月分と候補が重なるため、`needs_review`。月割当の確認が必要。
- 社会保険料（2026年8月分）304,119円: 9/30期限の見積額、`needs_review`。
- freee OAuthアプリは参照可能だが、`POST /api/1/deals` は403で拒否された。今回の現金仕訳は、まさがログインしたfreee画面から登録し、登録後にAPIで取引ID・金額・残額を読み返した。

## 反映・検証

- 実装commit: `0d87857c`、境界修正commit: `5109fbd9`。いずれもmainへpush済み。
- 2026-09-17 closeout時のproduction: `v3.141.5` / `48fe73adfb4b524bf95c958c344ef4aae2c26990` / branch `main` / dirty=false。
- 実装時の検証: `npm run test:payment-obligations`、`npm run test:admin-schedule`、`npm run test:critical-ui`、`npx tsc --noEmit`、eslint、`npm run build`、本番画面readback。
- 今回の現金仕訳readback: 取引日・決済日2026-09-30、支出26,500円、租税公課、現金、対象外、残額0円。OS行は`paid`、予定は`completed`。

## Repo状態

- canonical branch: `main`。今回の引き継ぎ文書は最新`origin/main`の使い捨てclean cloneで更新・pushする。
- 正規checkout `/Users/masa/projects/AMD/amd-os` は別作業の29ファイルがdirtyで、local mainが3 ahead / 229 behind。未pushは `4edc01d2` / `315a81af` / `d4d254a7`。今回の作業では削除・stash・reset・commitへ巻き込んでいない。
- 今回作成したbranch / git worktree: なし。作業用cloneはcloseout後に削除する。

## 未解決

- 今回の誤警告修正と不納付加算税の仕訳に残作業なし。
- 上記3件の`needs_review`は未納確定ではない。追加で追う場合は、freeeの元帳・納付書・対象月の対応を確認してから正本を更新する。
- リポ全体のarchiveは、正規checkoutの別作業dirtyと未push3件の所有者が確定し、origin/mainへ統合または明示処分されるまで不可。

## 次の最初の行動

まさの次の指示を待つ。納付照合を続ける場合は、社会保険料7月分の304,119円候補が6月分の出金と重なる理由をfreee元帳で確認し、推測で納付済みにしない。

## 参照先

- 利用・運用: `pwa/manual/6-9-company-payment-obligations-spec.md`
- 納付画面仕様: `pwa/spec/5-15-payment-ledger-current-spec.md`
- 運営カレンダー仕様: `pwa/spec/5-9-admin-operating-calendar-current-spec.md`
- freee照合境界: `pwa/manual/6-10-freee-accounting-reconciliation-spec.md`
- 実装履歴: `pwa/design_log/sessions_2026-09.md`
- バグ・教訓: `pwa/BUGS.md`
