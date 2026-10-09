# 同じ画面の閲覧者・閲覧履歴 — 2026-10-08

## 2026-10-09 — 閲覧更新を1分に変更（反映済み）

- PWAの定期更新を60秒、通信断の失効期限を180秒へ変更。初回表示・表示復帰・ページ切替・パネルを開く操作は即時更新、非表示・退出は即時離脱。定期通信の回数は従来の約6分の1。DB・認可・履歴の保存方式・理論・画面配置の変更なし。
- 実装commit `f15ab19fbcb42b7f66657ad206b08f4791e078e6`、`v3.162.10`。正規deploy.sh経由でmainへpushし、2分15秒でproduction反映。対象amd-os-pwa、deployment `dpl_3fypNzncFoY6YqPGT8AMnLbhNQMY`はREADY。公開build-infoのSHA・main・dirty=falseを確認。
- 本番ChromeとDB: 確認用の表示中タブで初回16:22:43.194→次回16:23:43.352 JST、連番1→2、間隔60.158秒。閲覧中は「まさ（自分）」、履歴一覧も表示。繰返し更新後の同一visitは1件。タブを閉じた後にactive=falseを確認。確認用タブは閉じ、既存タブは保持。
- 検証: 既存test:page-viewing、単独TypeScript検査、通常npm run buildとpostbuild容量検査、pre-commitとdeploy.shの必須検査が成功。最初のローカルTurbopack検査は外部node_modulesシンボリックリンクで停止。webpack代替はメモリ上限と旧型生成の既存export制約で停止。依存ファイルを検査cloneへコピーし、NODE_OPTIONS=--max-old-space-size=8192で本番と同じTurbopackの通常buildを成功させた。本番設定・依存版・アプリの追加修正なし。DB ROLLBACK検査用SQLの失効条件も180秒へ同期（今回このSQLの実行は不要と判断）。
- 表示配置は不変。パソコン幅と320px設定でパネルが表示幅内に収まり、氏名・履歴切替・閉じる操作を確認。幅設定は解除済み。新しい版の本番でも閲覧中・履歴を確認。前回の画面レビュー8.5/10の配置を維持。

### 同期ゲート・事後報告

| 仕様変更 | 設計正本 | OSマニュアル章 | 状態 |
|---|---|---|---|
| 60秒更新・180秒失効・操作時即時更新 | spec2-1 / FEATURE_REGISTRY / ios DESIGN | manual2-1 | 実装・文書・本番確認済み |
| 変更履歴 | spec6-1 | manual9-3 | 同じ実装commitで同期 |
| ネイティブへの引き継ぎ | HANDOFF_pwa_to_native_viewing | manual2-1 | 更新済み。ネイティブUIは従来の未移植範囲を維持 |
| 理論・DB | 変更なし | 対象外 | bzm・migration追加/再適用なし |

仕事種別development。恒久仕様・使い方・引き継ぎを更新し、design_logは対象外。含めた変更は更新間隔・失効期限・版数・関連文書と既存検査SQLの同期だけ。別チャットの契約workflow等は除外。mainと本番実装は一致し、自分の変更はすべてpush済み。新規branch/worktreeなし。検査cloneはmainのみ、dirty/conflict/stashなし、ahead/behind=0/0（本記録のpush後）。コピーしたnode_modules/.next、.vercel/.env.localの既存リンクはgitignore対象の検査用ファイル。

正規の共有checkoutはfetch済みだが別作業の未反映commit3件が残り、実装push後の確認時点でahead3/behind22。quarantine ownerは進行中の契約承認workflowチャット。次の判断条件は同担当が3件を確認・統合する時。元からあるstash2件も今回作成しておらず、HTML preview/PDFの保存名で退避された理論・SX・Project Share差分を含む。元担当の統合確認まで保持し、復元・削除・一括commitなし。共有checkout同期は未完了、本番反映とは分けて扱う。本記録はrootのmdのみの追記なのでPWA build対象外。

会話の検討材料: 0件。今回の製品設定を個人特性として保存しない。

---

PWAの共通ツールバー右上に氏名の頭文字と人数を表示し、開くと「閲覧中」「閲覧履歴」を切り替えられる。コックピット・ワークスペース・DDの画面内ページも区別する。履歴は導入後から保存し、表示は新しい順に50件。外部ユーザーには本人の履歴だけを返す。

## 反映・検証

- 実装commit: `8414eb4730b2ad89cbe85511e83f61808ca461a8`、mainへpush済み。canonical `deploy.sh` を使用し、production aliasのbuild-infoが同じSHA・`v3.161.29`となって成功。6分45秒。後続main `f54e54e7`にも同じ実装が含まれる。
- migration `20261008120000` は本番適用・migration履歴登録済み。再適用禁止。テーブルとRPCはservice_roleのみ。authenticatedの直接SELECT/EXECUTE不可をDBで確認。
- TypeScript全体、対象ESLint、新しい画面キー/ページ名/外部制限/重複排除テスト、deploy.shの必須検査が成功。参照キャッシュガードには10秒ごとに変わるPOSTの理由を登録。
- 実DBのトランザクション検証: 繰り返し更新でも1訪問、古い更新/離脱の棄却、別actorのセッション乗っ取り拒否、TTL・直接アクセス拒否。テストはROLLBACKし架空の履歴を残さない。
- 本番API: 未認証404、別origin403、生URL/クエリ400、null/過大body400、招待中/停止外部アカウントが社内画面に入れないことを確認。権限・招待状態は変更していない。
- 本番Chrome: ダッシュボードで「まさ（自分）」と日本時間の閲覧履歴を確認。ゴールツリー→事業計画の画面内切り替えで閲覧情報のページ名も更新。DBのresource_key/訪問が別ページになり、退出したダッシュボードのsessionはinactive。複数の10秒更新で訪問は増殖しない。DD会社概要の実訪問もDBで確認。
- 画面検証: パソコン幅・390px幅で長い氏名、3人表示、履歴日時、切り替えを確認。ポップアップは幅に収まり、比較できる行で表示。検証用の架空データページは削除済み。画面レビュー8.5/10。

## 仕様と境界

正本: `pwa/spec/2-1-pwa-runtime-routes.md`、使い方: `pwa/manual/2-1-member-quick-start.md`、登録: `pwa/design/FEATURE_REGISTRY.md`。manual9-3/spec6-1/ios DESIGN/DB schema同期済み。理論の変更はなくbzm更新不要。

2026-10-09の負荷抑制変更: 定期通信は1分更新、通信断は3分で失効。初回表示・表示復帰・ページ切替・パネルを開く操作は即時更新、非表示・退出は即時離脱。ブラウザの表示中タブを対象にする。実際の注視や閲覧時間は推定しない。生URL・クエリ・署名・本文は保存しない。

外部アカウントは現行DBで招待中/停止のみのため、外部本人の実ログイン正常系は未検証。iOS/macOS/Androidには未移植。引き継ぎは `pwa/HANDOFF_pwa_to_native_viewing.md`。書斎・印刷・native用埋め込み枠にはこの共通ツールバーを追加していない。

## 終了確認

仕事種別: 開発。恒久仕様/使い方/引き継ぎに保存。design_logは変更なし。自分の必要な変更はすべてcommit・push済み、競合なし。新規branch/worktreeなし、ローカルbranchはmainのみ。一時cloneの変更はmainと一致し、未公開差分なし。無視されるビルドキャッシュ・検証レポートだけが残る。

共有checkoutには別の進行中チャット「承認なしの押印を防ぐ設計」に対応する契約workflow/管理者画面/メール監視/GASの変更が残る。owner推定およびquarantine ownerはその進行中チャット。今回のstage/commitに含めず保持。次の判断条件は当該チャットが自分の反映前に差分を検査しcommit・pushすること。勝手に削除すると進行中の実装を失うため触らない。今回の機能に残作業なし。

会話の検討材料: 0件。製品設計はrepoへ保存し、個人の特性としては保存しない。
