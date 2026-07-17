# AMD OS macOS AGENTS

作業前に `/Users/masa/projects/AGENTS.common.md`、ルート `AGENTS.md` / `CLAUDE.md`、`macos/DESIGN.md`、`macos/PARITY.md`、`ios/DESIGN.md`、`pwa/spec/1-1-overview.md`、`pwa/spec/1-2-document-layer-migration-map.md`、`pwa/spec/1-3-reconstruction-coverage-audit.md`、`pwa/spec/2-1-pwa-runtime-routes.md`、`pwa/spec/2-2-pwa-surface-inventory-current-spec.md`、`pwa/design/README.md`、`pwa/design/FEATURE_REGISTRY.md` を読む。

- Macアプリは独立SwiftUIクライアント。WKWebView全面移植は禁止。
- ナビゲーションは「仕事 / 探索 / 管理 / 設定」。iOSの5タブをそのまま横展開しない。
- 共通層は `AMDOSCore`、表示トークンは `AMDOSDesign`。iOS依存 (`UIKit`) をmacOSへ持ち込まない。
- 読み取り元・書込み先・権限・回帰確認は `PARITY.md` と画面実装を同じ作業単位で更新する。
- `git add .`は禁止。共有checkoutのfull `git status`をcommit直前にも確認し、macOS対象だけをstageする。
- 物理端末を使うiOSの実機確認はmacOSアプリの完了条件にしない。macOSはbuild・起動・画面状態を確認する。

