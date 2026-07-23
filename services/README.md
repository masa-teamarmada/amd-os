# services/

AMD OS モノレポの中で、`pwa/` / `ios/` / `macos/` / `android/` / `gas/` のいずれにも
属さない、独立デプロイの補助サービス群を置く場所。

各サービスは独自の `package.json` / デプロイ設定を持ち、`pwa/` の Next.js ビルド・
デプロイパイプラインとは結合しない。PWAとは別の独立Vercelプロジェクトとしてデプロイする
ことが多い。

## 現在のサービス

| dir | 役割 |
|---|---|
| `project-share/` | 汎用「Project Share」機能とPJ別パイロットインスタンス。詳細は [`project-share/README.md`](project-share/README.md) |

## 共通ルール

- PJ別の秘密値（パスワード、署名鍵、APIキー等）は、各サービスのVercelプロジェクトの
  Environment Variables にのみ置く。リポジトリ内のどのファイルにも書かない。
- 各サービスのビルド・デプロイ手順は、そのサービスディレクトリ配下の `README.md` /
  `AGENTS.md` を正本にする。ルート [`../CLAUDE.md`](../CLAUDE.md) には概要だけを書く。
