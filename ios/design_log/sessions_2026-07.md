# iOS Sessions 2026-07

## 2026-07-16 — 通知判断キューと5タブ再編

### 依頼と設計判断

- PWAだけが進む状態を解消し、Swift版にも通知処理と登録機能の両方を残す方針を確定した。
- スマホでは通知をカード形式で次々に手早く処理したい、という要望から、一覧中心ではなく1件ずつの判断キューを主導線にした。
- 判断前に理由が読めることを優先し、カード内に `OSの見立て`、`押すと起きること`、折りたたみ式の`根拠`を置いた。

### 実装

- `MainTabView` を `今日 / PJ / 通知 / 登録 / 設定` の5タブへ再編。
- `NotificationInboxView` を `判断 / 未読 / 履歴` の3セグメントへ変更。
- 判断画面は現在カード1件と次カードの予告を表示し、種別ごとの意味ラベルで採否・確認・修正を返す。
- 修正sheetに `PJが違う / 人物が違う / 数値が違う / 重要度が違う` のチップと自由記述を追加。
- `あとで` は永続状態を増やさず、セッション中だけキューから外す。全件保留時は `もう一度見る` で戻せる。
- `RegistrationHubView` に立替申請と名刺登録を統合。
- ルーティンの `reimburseConfirm` は登録タブ内の立替一覧へ直接pushし、`payoutNotice` は既存admin権限ゲートを通して管理画面を開く。

### 書き込み境界

- Supabase schema / API /環境変数は変更していない。
- `project_registry_diff` の採用は候補をacceptedにするところまでで、OS台帳の実反映はPWA/helperに残した。
- `meeting_summary` の確認は確認記録のみで再抽出しない。
- `connector_auth` は採否ではなく再認証の復旧アクションとして扱い、既読後も履歴から再試行できる。

### 回帰と教訓

- 初回タブ再編では、旧 `AppTab.reimburse` / `.admin` をenumに残しただけで実在タブがなく、ルーティンからの遷移が失われる回帰をレビューで検出した。
- 実在する5タブだけをenumに残し、立替は型安全な `NavigationStack` path、adminはpresentation requestへ置き換えた。
- closeout時にcritical UI guardが旧 `PJ進捗 / 名刺` を必須にして停止したため、新5タブと通知・登録ハブのアンカーへ更新した。
- 詳細は `ios/BUGS.md` の2026-07-16項目を参照。

### Verification

- iPhone 17 Pro / iOS 26.5 simulator向けDebug build成功。
- masaiPhone（iPhone 16 Pro）向けDebug build成功。
- `devicectl device install app` で `App installed` を確認。
- `devicectl device process launch --terminate-existing` でアプリ起動成功を確認。
- シミュレータは未ログインのため、実データ入り判断カードの目視確認は次セッションへ残した。

### Accepted commit

- `3dfd235c feat(ios): add notification judgment deck`
