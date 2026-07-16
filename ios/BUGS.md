# BUGS

> See also: [CLAUDE.md](CLAUDE.md) — 最重要ルール / [DESIGN.md](DESIGN.md) — 全画面の正本仕様 / [DEBUG.md](DEBUG.md) — デバッグ手順

このファイルには **過去に踏んだバグ・事故** と **再発防止メモ** を時系列で蓄積する。
新しい事故を踏んだら必ず追記する。

---

## 2026-07-16: タブ再編後にルーティンの立替・管理画面導線が行き先を失った

### 症状
- 下部タブを `今日 / PJ / 通知 / 登録 / 設定` に再編した初回差分で、月次ルーティンの `reimburseConfirm` と `payoutNotice` が画面遷移しなくなった。

### 原因
- `AppTab.reimburse` / `.admin` を互換用としてenumに残したが、現行 `TabView` には対応する `.tag` が無かった。
- 存在しないタブ値をselectionへ入れても、登録ハブの立替一覧やadmin fullScreenCoverは開かれない。

### 対応内容
- `AppTab` を実在する5タブだけに限定した。
- `reimburseConfirm` は `RegistrationRoute.reimburse` を型安全なNavigationStack pathへ積んでから登録タブへ切り替えるようにした。
- `payoutNotice` は `AppNavigationState.requestAdminPresentation` を通じて、`MainTabView` が既存の `isAdmin` ゲート後にfullScreenCoverを開くようにした。

### 再発防止策
- タブ削除・統合時は、画面上のタブだけでなく `selectedTab =` と `AppTab.` の全参照を検索する。
- enumに旧値を残すだけの互換対応はしない。実際の遷移先をpath/presentationとして接続する。
- タブ再編のレビューには、ルーティン・通知deep link・floating adminのプログラム遷移を含める。

---

## 2026-07-14: 名刺台帳の正常読込後もWebViewの一時キャンセルを失敗表示した

### 症状
- iOSの名刺タブで「名刺台帳を開けなかったよ」が表示された。
- 同時刻の本番ログでは `/native/business-cards` と `/api/business-cards` はどちらも HTTP 200 で、台帳DB/API自体は正常だった。

### 原因
- `BusinessCardsView` の `WKNavigationDelegate` が、redirect・再読込で発生する `NSURLErrorCancelled (-999)` まで無条件に画面エラーへ変換していた。
- 後続navigationが正常完了しても、先行navigationのエラー表示を解除していなかった。

### 修正・再発防止
- `NSURLErrorCancelled (-999)` と WebKit のpolicy change interruptionは無視する。
- `webView(_:didFinish:)` でエラー表示を解除する。
- WebView障害は、画面表示だけでDB/API障害と断定せず、同時刻のroute/API statusを先に確認する。

---

## 2026-04-24: `xcodebuild install` 成功を実機反映済みと誤認した

### 症状
- マイページで `the data couldn't be read because it is missing.` が表示され続けた。
- `BUILD SUCCEEDED` と `INSTALL SUCCEEDED` を確認した後も、実機上の表示が変わらなかった。
- 他ページは正常に表示できていたため、当初は `MyPage` のデコード処理だけを疑って修正を重ねた。

### 原因
- `xcodebuild ... install` の `INSTALL SUCCEEDED` を「実機へ確実に上書きインストールされた」と誤認した。
- 実際には Xcode の install ビルド工程成功を見ていただけで、端末側への反映確認が不足していた。
- 最終的に `xcrun devicectl device install app` で `.app` を明示インストールしたところ、実機に反映されてマイページが直った。

### 正しい確認手順
1. Google Drive 配下の `xcodeproj` はハングしやすいため、必要に応じて `/tmp` などローカルへ同期してビルドする。
2. `xcodebuild` で `BUILD SUCCEEDED` を確認する。
3. 実機へは `devicectl` で明示インストールする。

```sh
xcrun devicectl device install app \
  --device 22F6F889-985D-5CAF-AFF3-D50D5E80FFA0 \
  /path/to/AMDOS.app
```

4. インストール結果に以下が出ることを確認する。

```text
App installed:
bundleID: jp.team-armada.amdos
```

5. その後、明示起動する。

```sh
xcrun devicectl device process launch \
  --device 22F6F889-985D-5CAF-AFF3-D50D5E80FFA0 \
  jp.team-armada.amdos
```

### 再発防止メモ
- iOSファイルはgit管理外なので、修正後は必ず `BUILD SUCCEEDED` だけでなく、`devicectl device install app` の `App installed` まで確認する。
- `xcodebuild install` の `INSTALL SUCCEEDED` だけで実機反映完了と判断しない。
- 「コード上はエラー分岐を消したのに実機表示が変わらない」場合は、まずインストール経路を疑う。
- 実機確認対象:
  - UDID: `22F6F889-985D-5CAF-AFF3-D50D5E80FFA0`
  - 端末名: `masaiPhone`
  - Bundle ID: `jp.team-armada.amdos`

## 2026-04-24: Billing Matrix シートが完了操作後に閉じる不具合修正と再デプロイ

### 対応内容
- 対象: `AMDOS/Features/Admin/BillingMatrixView.swift`
- `BillingCycleDetailSheet` のステータス更新後、 `dismiss()` が呼ばれていたため、完了/未完了をタップするとモーダルが閉じてしまう不具合を修正。
- シート側で `statusOverrides` を保持して、更新結果を即時反映するように変更。
- `onUpdate()` 呼び出し後もシートを閉じない仕様に変更。

### 実機デプロイ
- 実施日時: 2026-04-24 15:45（ローカル構築から `devicectl` 明示インストール）
- コマンド
  - `xcodebuild -project /tmp/amdos-ios-deploy/AMDOS.xcodeproj -scheme AMDOS -configuration Debug -sdk iphoneos -derivedDataPath /tmp/amdos-ios-deploy-deriv CODE_SIGNING_ALLOWED=YES CODE_SIGNING_REQUIRED=YES build`
  - `xcrun devicectl device install app --device 22F6F889-985D-5CAF-AFF3-D50D5E80FFA0 /tmp/amdos-ios-deploy-deriv/Build/Products/Debug-iphoneos/AMDOS.app`
  - `xcrun devicectl device process launch --device 22F6F889-985D-5CAF-AFF3-D50D5E80FFA0 jp.team-armada.amdos`

### 確認
- `BUILD SUCCEEDED` を確認。
- `App installed` が表示され、起動コマンドも成功。

### 再発防止メモ
- 今回のような UI が画面上で即時反映してほしい変更は、ビルド成功後に `devicectl` 実機インストールを必ず実行し、再起動して確認する。

## 2026-04-25: 月次ルーティン / マイページがフリーズした根本原因は祝日判定の再帰暴走

### 症状
- `月次ルーティン` タブを開くと画面遷移前後で固まり、PJ 一覧や詳細が表示されない。
- `マイページ` も一時期ローディングのまま固まった。
- `routine-flow` や通知取得を疑っても、静的画面へ落としてなおフリーズした。

### 原因
- 実機の crash log（`.ips`）を確認したところ、`RoutineModels.swift` の `isJapaneseHoliday(_:)` が CPU を使い切っていた。
- 「国民の休日」判定が `isJapaneseHoliday(previous) && isJapaneseHoliday(previous2)` という再帰になっており、連休のあとに休日判定が前日へ伝播し続けた。
- その結果 `adjustedBusinessDay(_:)` が営業日を確定できず、締日計算を行う `visibleRoutineSteps(...)` と `fetchMyPageNotifications(...)` の両方で main thread / background task が詰まった。

### 修正
- `isJapaneseHoliday(_:)` を `基礎祝日` / `振替休日` / `国民の休日` に分離し、非再帰で判定する形へ変更。
- `振替休日` は「直前の基礎祝日ブロックに日曜祝日があるか」で判定。
- `国民の休日` は「前日と翌日が祝日で挟まれている1日だけ」を見るように修正。
- デバッグ用に差し込んだ `DebugLog.swift` と静的テスト画面も撤去し、`月次ルーティン一覧` を通常のプロジェクト一覧へ戻した。

### 再発防止メモ
- iOS で「画面が無限ローディング・タップで固まる」症状が出たら、API レスポンスだけでなく `systemCrashLogs` の `.ips` を先に見る。
- 祝日・営業日計算のような日付ロジックは、再帰で前後日を辿らない。特に `previous` / `previous2` を使う休日判定は連休で暴走しやすい。
- `月次ルーティン` と `マイページ通知` は同じ締日計算を使うため、どちらか片方だけ壊れるとは限らない。

## 2026-04-28: 「Drive 上の amd-os-ios」を作業場所に使い続けて事故が頻発

### 症状
- Drive 同期コンフリクトで `XXX.swift` / `index.ts` / `*.md` が **0 byte 化**、本物が `XXX 2.swift` 側に押し出される
- Xcode が `XXX 2.swift` を Project Navigator に拾い、`project.pbxproj` にゴミエントリが入って後でビルドが壊れる
- 「`HANDOFF.md` が 0 byte で、片方は `HANDOFF 2.md` にしかない」など、信用できない状態が常時発生
- ある日「つくよみの学び」管理画面が iOS から消えて見えていたが、原因は別マシンの Drive 同期事故で git 側のファイルが消えていたこと

### 原因
- 複数マシン (Mac / Windows / iPad) が同時に Drive 上の `.git` や Swift ファイルを書き換える
- Drive sync は CRDT じゃないので「衝突」したら片方を 0 byte にする
- `.git/HEAD` / `.git/index` / `project.yml` / `index.ts` などインフラに近いファイルが繰り返し犠牲になる
- 同期の挙動が **時間差・確率的** で、ローカルで見えてる状態と Drive が他マシンに配る状態がズレる

### 対応
- **Drive 上の `共有ドライブ/claude/AMD_OS/amd-os-ios/` を完全廃止**
- 作業場所は `~/dev/amd-os-ios`（Drive 外のローカルクローン）に統一
- 正本は GitHub `masa-teamarmada/amd-os-ios`
- `~/.Trash/amd-os-ios-drive-deprecated-20260428-170604` に退避（Trash 空にすれば完全削除）
- `CLAUDE.md` / `AGENTS.md` / `HANDOFF.md` / `HANDOFF_PROMPT.md` を一括書き換え

### 再発防止メモ
- Drive 配下に `amd-os-ios` クローンが残っているマシンを一掃する（`team-armada` の各マシンで確認）
- どんな理由でも Drive 上の `共有ドライブ/claude/AMD_OS/amd-os-ios/` を開かない・読まない・書かない
- もし誰かが「Drive 側を見て」と言ってきたらまず Drive 廃止経緯を共有、GitHub を見るよう案内する

## 2026-04-28: 未 push commit による「巻き戻り」事故（フロートボタン消失）

### 症状
- ユーザーから「フロートボタンや支払通知書周りが巻き戻ってる」報告
- 私のセッションは `origin/main` (= `fb68db8`) を起点にビルドして masaiPhone に install/launch していた
- 一方ローカルには `claude/crazy-nobel-0a8429` ブランチが **9 commit 分 push されないまま** 残っており、その中に Admin タブのフロートボタン (`2100900`)・支払通知書 layout polish (`660151d`) などの最新機能があった
- 私は `git fetch` だけで「ローカル未 push commit」を見ていなかったので、これらの存在に気づかず origin/main で巻き戻し install してしまった

### 原因
- 前セッションがエラーで閉じ、その時点で `claude/crazy-nobel-0a8429` の 9 commit が push されていなかった
- その後の私のセッションで `git log origin/main..HEAD` だけ見ても「main からの差分」しか出ないので、別ブランチに残っている未 push commit を検知できなかった
- masaiPhone は前セッションが install した最新コード (660151d) で動いていたが、git の状態と一致していないことに気づかなかった

### 対応 (2026-04-28)
- ローカル未 push commit を全部洗い、main を `660151d` ベースに再構築
- 私の作業 (Drive 廃止反映 / DESIGN.md 接続 / MyPage 月次差分フィルタ) を 660151d の上に積み直し
- 以下「巻き戻り防止 5 層」を CLAUDE.md / AGENTS.md / HANDOFF.md / HANDOFF_PROMPT.md に明文化

### 巻き戻り防止 5 層

1. **commit したら即 push（最優先）**
   - ブランチ作ったら即 `git push -u origin <branch>` で upstream を切る
   - 機能単位の小さい commit を頻繁に作り、commit のたびに `git push` する
   - エラー閉じ時点までの全作業が GitHub に残るので、次セッションが必ず拾える

2. **セッション開始時の 4 ステップ（最重要）**
   ```sh
   cd ~/dev/amd-os-ios
   git fetch --all --prune
   git log --branches --not --remotes --oneline    # ← 未 push commit を全検知
   git branch -a
   git status -s
   ```
   - **(2) の出力が空でないなら、必ず未 push commit の中身を確認してから先に進む**
   - これさえやっていれば今回の事故は完全に防げた

3. **DESIGN.md = 「在るべき姿」の正本**
   - 画面が消えたら DESIGN.md を見れば「在るべきものが無い」と即気づける
   - 画面・機能を増減したら同じコミットで DESIGN.md も更新

4. **HANDOFF_ios_to_android.md の必須化**
   - main を更新したら必ず更新 + push
   - Win 側のえいみが状況を追える

5. **BUGS.md / DEBUG.md に過去事故を蓄積**
   - 次セッションが BUGS.md を読めば「同じ罠が過去にもあった」と分かる

### 再発防止メモ
- セッション開始時の 4 ステップを **何があっても** 飛ばさない
- 未 push commit を見つけたら **絶対に勝手に消さない / 上書きしない**。まずユーザーに状況報告する
- 「`git status` が clean だから問題ない」は罠。別ブランチに作業が残っていることがある
- masaiPhone に install されているコードと git の状態が一致しているか、`devicectl` で install する前に確認する
