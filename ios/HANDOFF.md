# AMD OS iOS Handoff

最終更新: 2026-07-16 JST

対象: `/Users/masa/projects/AMD/amd-os/ios`

トピック: 通知の判断カード化と5タブ再編

## Latest Session Summary

- Swift版の下部タブを `今日 / PJ / 通知 / 登録 / 設定` の5つへ再編した。
- `通知` は未回答を1件ずつ処理する判断キューになり、次カードの予告、根拠展開、種別別アクション、修正コメント、セッション内の「あとで」を持つ。
- 判断カードは `観測 → 候補 → 判断 → 正本` の現在地と、「押すと起きること」を明示する。汎用の「はい / いいえ」は表示しない。
- `登録` は立替申請と名刺登録を1つのハブへ統合した。
- 月次ルーティンの立替確認は登録タブ内の立替一覧へ直接遷移し、支払通知は既存のadmin権限ゲートを通って管理画面を開く。
- 既存のSupabase書き込み境界は変更していない。詳細は `DESIGN.md` と `design_log/sessions_2026-07.md` を参照。

## Repo State

- 正本repo: `/Users/masa/projects/AMD/amd-os`
- 正本branch: `main`
- 実装commit: `3dfd235c feat(ios): add notification judgment deck`
- TestFlight: 未更新
- 今回の実装でDB migration、環境変数、API追加はなし。
- root checkoutには別ownerのPWA/H-1/KENQ系dirtyがあるため、今回のiOS bundleへ混ぜていない。

## Verification Run

- iPhone 17 Pro / iOS 26.5 simulator向けDebug build: `BUILD SUCCEEDED`
- masaiPhone（iPhone 16 Pro）向けDebug build: `BUILD SUCCEEDED`
- `xcrun devicectl device install app`: `App installed` を確認
- `xcrun devicectl device process launch --terminate-existing`: `jp.team-armada.amdos` の起動成功を確認
- シミュレータは未ログインだったため、新しい判断カードを実データ入りで目視できていない。実機には最新ビルドを起動済み。

## Unresolved Tasks

- アプリ終了中にも届く本物のリモートPushは未実装。
- delivered と人間既読の完全分離、server-driven action card、recipient/role scope、自己/AMD全体切替、backend undoは未実装。
- 実データの長文通知を使ったLight/Dark Modeと最大Dynamic Typeの目視確認は未実施。
- Android版には今回の5タブと判断カードUIを未移植。`HANDOFF_ios_to_android.md` を入口にする。

## First Next Action

1. masaiPhoneで `通知` タブを開き、実データを3〜5件処理してカード密度・文言・「あとで」の手触りを確認する。
2. 修正する場合は `SettingsView.swift` の `NotificationInboxView` / `NotificationJudgmentCard` と `MainTabView.swift` を対象にする。
3. iOSソースを変えたら、buildだけで終わらず実機install + launchまで行う。

## Pointers

- 画面・アクション正本: `DESIGN.md` §2.1.1
- 通知コード: `AMDOS/Features/Settings/SettingsView.swift`
- タブ・登録ハブ: `AMDOS/Features/Home/MainTabView.swift`
- ルーティン直接導線: `AMDOS/Features/Routine/RoutineFlowView.swift`
- OSマニュアル: `../pwa/manual/3-3-notifications-and-tsukuyomi.md`
- バグ・教訓: `BUGS.md`
- セッションログ: `design_log/sessions_2026-07.md`
- 次セッションprompt: `HANDOFF_PROMPT.md` / `../SESSION_MIGRATION_PROMPT_IOS_NOTIFICATION_DECK.md`

## Guardrails

- 最初に `/Users/masa/projects/AGENTS.common.md`、AMD level memory、repo/iOSの `CLAUDE.md` / `AGENTS.md` を読む。
- branch/worktreeを作らずmainで対象ファイルだけを明示stageする。`git add .` は禁止。
- `project_registry_diff` のiOS採用は候補をacceptedにするところまで。OS台帳への実反映はPWA/helperの安全な反映処理に任せる。
- `meeting_summary` の「確認した」は確認記録だけで再抽出しない。
- connector再認証は採否ではなく復旧アクション。リンクを開いたことを復旧成功とみなさない。
- iOS修正は `BUILD SUCCEEDED`、`App installed`、実機launch成功の3点を揃える。
