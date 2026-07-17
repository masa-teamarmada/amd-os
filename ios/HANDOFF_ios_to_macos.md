# iOS → macOS ハンドオフ

最終更新: 2026-07-17 JST

## 設計

- macOSはWKWebView wrapperではなく、`macos/`の独立SwiftUIクライアント。
- iOSの5タブをそのまま移植せず、`NavigationSplitView` の「仕事 / 探索 / 管理 / 設定」で一覧と詳細を横に並べる。
- 共通層はmacOS側の `AMDOSCore`、表示トークンは `AMDOSDesign`。iOSのUIKit依存や既存iOS画面をmacOSへ直接持ち込まない。
- GoogleログインはSupabase OAuth + PKCE、callbackは `amdos-macos-auth://oauth/callback`。Supabase側へのredirect URI登録が必要。
- Macの名刺はファイル選択・ドラッグ&ドロップ・クリップボード貼付を主導線にし、OCR候補は人が確認してから既存APIで確定する。

## 実装済み

- `AMDOSCore`: Supabase REST読み取り、Google OAuth PKCE、session保持、admin権限確認、モデル。
- `AMDOSDesign`: 色・文字・状態・カード・階層の共通トークン。
- macOSの常設4領域ナビ、今日、PJ一覧、PJ詳細入口、通知判断のPWA安全経路、名刺入力受付、admin gate、アカウント。
- PWA route / FEATURE_REGISTRY / iOS画面の全件追跡表: `macos/PARITY.md`。

## 未実装を残している契約

- 通知のserver-driven action card、完全な採否write、remote push。
- MS詳細編集・月次・請求・財務・支払・契約・メンバー・裏wiki・経営ノウハウ・運営カレンダー・シーズン予実。
- Atlas / Seeds / PoC / VC / Scholar / AMD Score の詳細UI。
- 教科書のMac段組みリーダー、HUDの実データ計器、研究機関の詳細評価。

未実装を画面から削除せず、`PARITY.md`の状態を更新してから各機能を追加する。

## macOS側の検証

- `xcodegen generate --spec macos/project.yml --project macos/AMDOSMac.xcodeproj`
- `xcodebuild -project macos/AMDOSMac.xcodeproj -scheme AMDOSMac -configuration Debug -destination 'platform=macOS' CODE_SIGNING_ALLOWED=NO build`
- 起動後にログイン画面、4領域ナビ、PJ一覧、名刺入力、admin非表示を確認。
