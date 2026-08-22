# AMD OS macOS

macOS版はPWAをWKWebViewで包むものではなく、`NavigationSplitView`を使う独立したSwiftUIクライアント。

## 正本と構成

- 全体方針: ルート `CLAUDE.md` / `AGENTS.md`
- iOS共通画面・業務仕様: `../ios/DESIGN.md`
- PWA route/API/重要導線: `../pwa/spec/` と `../pwa/design/FEATURE_REGISTRY.md`
- macOS画面仕様: `DESIGN.md`
- 移植台帳: `PARITY.md`
- iOSからの引き継ぎ: `../ios/HANDOFF_ios_to_macos.md`

```text
macos/
├── project.yml
├── AMDOSMac/
│   ├── AMDOSCore/       認証・モデル・Supabase read・安全なwrite境界
│   ├── AMDOSDesign/     色・文字・状態・カード・アクセシビリティの共通トークン
│   └── Features/        仕事 / 探索 / 管理 / 設定のSwiftUI画面
├── SupportingFiles/
└── PARITY.md
```

## 運用契約

- 既存のSupabase Auth、RLS、Edge Function、PWA APIの権限境界を広げない。
- Macから任意のテーブルを直接更新しない。明示した安全な書込み経路だけを使う。
- 名刺はファイル選択、ドラッグ&ドロップ、クリップボード貼付を主導線にし、OCR候補を自動確定しない。
- `/tasks` と旧月次ルーティンを復活させない。
- `PARITY.md` の未移植行を削除して完了扱いにしない。
- UI作業は `ui-polish-gate`、`refactoring-ui`、`design-review` の順で、幅広いMac画面・狭いウィンドウ・キーボード操作を確認する。

## ビルド

```sh
cd macos
xcodegen generate --spec project.yml
xcodebuild -project AMDOSMac.xcodeproj -scheme AMDOSMac -configuration Debug -destination 'platform=macOS' CODE_SIGNING_ALLOWED=NO build
```

`--project macos/AMDOSMac.xcodeproj` は使わない。XcodeGenの生成先はディレクトリであり、
その指定だと `AMDOSMac.xcodeproj` の内部にもう一つ `.xcodeproj` を作って、外側の
ビルド対象を更新しない。

Googleログインの本番確認には、Supabase側の `amdos-macos-auth://oauth/callback` redirect URI登録が必要。
