# SESSION MIGRATION PROMPT — iOS 通知判断キュー

```text
cd /Users/masa/projects/AMD/amd-os

最初に読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/ios/HANDOFF.md
4. /Users/masa/projects/AMD/amd-os/ios/DESIGN.md
5. /Users/masa/projects/AMD/amd-os/ios/BUGS.md
6. /Users/masa/projects/AMD/amd-os/CLAUDE.md
7. /Users/masa/projects/AMD/amd-os/AGENTS.md
8. /Users/masa/projects/AMD/amd-os/ios/CLAUDE.md
9. /Users/masa/projects/AMD/amd-os/ios/AGENTS.md
10. /Users/masa/projects/AMD/amd-os/pwa/manual/3-3-notifications-and-tsukuyomi.md
11. /Users/masa/projects/AMD/amd-os/ios/design_log/sessions_2026-07.md
12. /Users/masa/projects/AMD/amd-os/ios/HANDOFF_ios_to_android.md

状態スナップショット:
- 正本は /Users/masa/projects/AMD/amd-os の main。旧 amd-os-ios standalone repoは参照禁止。
- 実装commitは 3dfd235c feat(ios): add notification judgment deck。
- Swift版のタブは 今日 / PJ / 通知 / 登録 / 設定 の5つ。
- 通知タブは未回答を1件ずつ処理する判断キュー。次カード予告、根拠展開、種別別アクション、修正コメント、セッション内「あとで」を実装済み。
- 登録タブは立替申請と名刺登録のハブ。月次ルーティンの立替確認は立替一覧へ直接pushする。
- 支払通知のルーティン導線はAppNavigationState経由で既存Admin fullScreenCoverを開く。isAdminゲートを迂回しない。
- DB migration、環境変数、API追加はない。既存SupabaseServiceのwrite contractを再利用している。
- TestFlightは未更新。
- iPhone 17 Pro / iOS 26.5 simulator build成功。
- masaiPhone（iPhone 16 Pro）向けbuild、devicectl install、terminate-existing launchまで成功。
- シミュレータは未ログインだったため、実データ入り判断カードの目視は未確認。

今回確立した仕様:
- 判断カードは 観測 → 候補 → 判断 → 正本 の現在地と「押すと起きること」を表示する。
- 汎用の「はい / いいえ」は使わず、MS進捗を確定、提案を破棄、採用候補にする、見送る、根拠として確定、不採用、確認した、修正する等の意味ラベルを使う。
- project_registry_diffのiOS採用はaccepted候補の記録まで。OS台帳の実反映はPWA/helper側。
- meeting_summaryの確認は確認記録だけで再抽出しない。
- connector_authは採否対象ではないが、未読の間は再認証という復旧アクションとして判断キューに出る。既読履歴から再試行できる。
- 「あとで」は@Stateのセッション内保留。通知画面の再生成で復活し、「もう一度見る」で即時リセットできる。
- 長い日本語ラベルやDynamic TypeではTwoButtonRowが縦並びへフォールバックする。

次タスク:
1. masaiPhoneで通知タブを開き、実データ3〜5件を処理する。
2. OSの見立て、押すと起きること、根拠、種別別ボタン、「あとで」の処理速度と分かりやすさを確認する。
3. Light/Dark Mode、最大Dynamic Type、長い議事録本文でもカードが崩れないか目視する。
4. フィードバックがあればSettingsView.swift / MainTabView.swift / DESIGN.mdを同じcommitで更新する。
5. 次の拡張候補は本物のremote Push、delivered/read分離、server-driven action card、recipient/role scope、undo。現行DB contractを推測で広げない。

検証ルール:
- iOSソースを触ったらxcodebuild成功だけで完了にしない。
- xcrun devicectl device install app --device 22F6F889-985D-5CAF-AFF3-D50D5E80FFA0 <AMDOS.app>
- xcrun devicectl device process launch --device 22F6F889-985D-5CAF-AFF3-D50D5E80FFA0 --terminate-existing jp.team-armada.amdos
- App installedとlaunch成功を観測してから完了報告する。

運用ルール:
- branch/worktreeを新規作成しない。main直編集・main直push。
- dirtyを理由に止まらず、対象ファイルだけ明示stageする。git add .は禁止。
- root checkoutの別owner dirtyを今回bundleへ混ぜない。
- commit前にgit fetch origin mainでcurrent truthを取り直す。
- iOS main更新時はDESIGN.md、HANDOFF_ios_to_android.md、OS manualを同じbundleで同期する。
- raw通知本文、個人情報、secret、private URLをhandoffやdesign logへ残さない。
```
