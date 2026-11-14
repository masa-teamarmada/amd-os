納付（税・社会保険）の台帳と督促を、2026-11-14 の現行状態から再開する。作業場所は `/Users/masa/projects/AMD/amd-os`。`pwa/` をセッションの作業場所にしない（pwa基準のコマンドは各コマンド内で `cd` する）。

読む順:

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/HANDOFF_PAYMENT_LEDGER_20261114.md`
4. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
5. `/Users/masa/projects/AMD/amd-os/pwa/manual/6-9-company-payment-obligations-spec.md`（納付台帳・加算税・督促の正本）
6. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md` の「[納付] 期限を過ぎた納付の督促が、金額未確認のものほど早く黙った (2026-11-14)」

## 状態スナップショット（2026-11-14 時点）

- 画面: `/admin/payments`（納付）に、行＝年月・列＝税と保険料の種類の表、その下に期限順の明細、その下に会社が負う税・保険料・提出の全23件の目録。`/admin/schedule`（管理カレンダー）の先頭には、納期限を過ぎたまま納付を確認できていない法定納付の警告。
- 定時処理: `/api/cron/payment-obligations` が毎日09:20 JSTに台帳を同期し、納期限を過ぎた法定納付の督促を `is_admin` のまさ（ID001）・きよ（ID002）へSlack DMで送る。`PAYMENT_OBLIGATION_AUTO_NUDGE_ENABLED` に関わらず送る（期限前の予告やメール由来の候補だけが既定停止）。
- 督促の現状: **2026-09-15 を最後に届いていない。これは不具合ではない。** 2026-09-17 の `0d87857c1 fix: reconcile statutory payment alerts` が `isUnsettledStatutoryPayment` に「`status!='needs_review'` かつ `amount_status='exact'` かつ同額の出金候補0件」という絞り込みを入れた。誤報を避けるための意図的な設計。ただし金額を取得できない義務ほどこの網から外れ、照合が進まない限り永久に黙る。
- 本セッションで直したもの: `notificationStage` の分岐順序だけ。納期限を過ぎているものは、金額や期日が未確認でも超過の段階を返す（それ以前は `needs-review` に固定され、二度送らない制御が1通で打ち止めにしていた）。**絞り込み自体は別セッションの設計判断なので変えていない。** そのため本番で `?dryRun=1` を叩いても督促候補は0件のままで、これは期待どおり。
- 反映状態: 本番反映済み（`deploy.sh` 経由、`v3.165.26`、live git_sha 確認済み）。

## 期限を過ぎたまま残っている納付（実データ）

| 納付 | 期限 | 超過 | 金額 | freeeの口座に見つかった候補 |
|---|---|---|---|---|
| 労働保険料（年度更新・2026年度） | 2026-07-10 | 127日 | 未取得 | 0件 |
| 社会保険料（2026年8月分） | 2026-09-30 | 45日 | 304,119円（概算） | 1件 |
| 社会保険料（2026年9月分） | 2026-11-02 | 12日 | 304,119円（概算） | 0件 |

候補は `company_payment_obligations` の `payload.settlementSearch`（探した窓、件数、日付と金額、freeeの処理状態）に入っている。労働保険料は候補0件で127日超過なので未納の可能性が高い。社会保険料8月分は同額の出金候補が1件あるため、納付済みで割り当てが済んでいないだけの可能性がある。

## 次の最初の作業

0. **まさに決めてもらう**: 照合待ちのまま長期化した納付（いまは労働保険料127日、社会保険料8月分45日）を知らせる経路を作るか。作るなら、確定額の督促とは別の弱い通知（月1回、件数だけ伝えるなど）にして誤報を避ける。作らないなら、画面の赤い警告だけで運用する。
1. **freeeの口座明細で、上の3件の実際の出金を確認する。** `payload.settlementSearch` の窓と候補から当たる。未納なら納付が必要、納付済みなら消込条件（金額完全一致＋期限前後の窓）を直す。OSの値から外部サービスの状態を推測せず、freeeを見る。
2. **1月31日が期限の償却資産の申告と法定調書合計表の生成ルールを作る。** いま目録に「仕組みがまだ無い」と出ているだけで予定は生成されない。償却資産は無申告で10万円以下の過料、課税は課税標準150万円以上のときだけ。会社が償却資産を持っているかの事実がOSに無いので、freeeの固定資産台帳から判定する経路も要る。
3. **見込み金額の精度を実績から見直す。** 源泉所得税は見込み325,500円に対し実額533,112円、消費税中間は見込み405,200円に対し実額811,600円だった。`pwa/src/lib/finance/statutory-payment-rules.ts` の金額ルールが、業務委託への報酬から源泉徴収した分や中間納付の回数区分を拾えていない疑いがある。

## このPJで確立している運用ルール

- **本番反映は必ず `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`。** `git push` だけだと検査を全部すり抜ける。正規checkoutが他セッションのdirtyで止まる場合は、`main` の使い捨てclean cloneに `pwa/node_modules` をシンボリックリンクし、`.env.local` をコピーして実行する。
- **pushは束ねて1回。** 同一リポジトリにVercelプロジェクトが2つ紐づいており、`pwa/` を触る1 pushが1 buildを消費する。1日100デプロイがアカウント全体の上限。
- 検証: `cd /Users/masa/projects/AMD/amd-os/pwa && npm run test:payment-obligations`（加算税・延滞税の算式、督促の段階、月×種類の集計）、`npm run test:admin-schedule`（予定種別、目録の突き合わせ、納付済みを期限超過に落とさない判定）、`npm run build`。
- 画面確認は認証cookieを起こしたPlaywrightで desktop 1440、横スクロール0を確認する。手順は memory の `reference_local_pwa_screenshot_auth`。PWAのスマホ幅は確認対象外。
- **対人通知を実際に送る前に、宛先・件数・本文を確認する。** 督促は既に運用に乗っている（9月に実送信の実績あり）ので、定時処理からの送信は追加承認なしで流れる。手動で一斉送信する場合だけ、`?dryRun=1` で候補を確認してからにする。
- 金額・期日・納付済みの正本は `company_payment_obligations`。カレンダーと納付画面は読み取りモデルで、画面上で直せない。誤りは支払義務台帳か接続元で直し、`POST /api/admin/schedule/rebuild` を理由つきで実行する。
- まさへの報告は、画面で何がどう変わったかから書く。ファイル名・関数名・commit番号を本文に並べない。
