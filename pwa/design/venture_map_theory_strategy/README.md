# 2026-05 Venture Map 理論化戦略 — デッキ生成ソース

`../2026-05_venture_map_theory_strategy.pptx` を再生成・改訂するためのソース一式。

## ファイル構成

| ファイル / ディレクトリ | 役割 |
|---|---|
| `build.js` | スライド全体の設計と pptx 生成スクリプト (pptxgenjs) |
| `render_eqs_local.js` | LaTeX 数式を PNG にレンダリング (tectonic + Swift) |
| `pdf2png.swift` | PDF → PNG 変換 (macOS PDFKit、`render_eqs_local.js` から呼ばれる) |
| `package.json` | npm 依存定義 (pptxgenjs, image-size) |
| `eqs/` | レンダリング済み数式 PNG (`build.js` が参照) |
| `tex/` | LaTeX 中間ファイル (.tex / .pdf、再生成可能) |
| `node_modules/` | npm 依存の実体 (`.gitignore` 対象) |

## 前提依存

| 依存 | 配置 | 用途 |
|---|---|---|
| Node.js | `~/.local/node-current/bin/node` | スクリプト実行 |
| tectonic | `~/.local/bin/tectonic` | LaTeX → PDF |
| Swift | `/usr/bin/swift` (Xcode 同梱) | PDF → PNG |
| Yu Gothic フォント | macOS 標準 | スライド本文 |

## 使い方

### 初回セットアップ

```bash
cd /Users/masa/projects/AMD/amd-os/pwa/design_log/2026-05_venture_map_theory_strategy
npm install
```

### デッキを再生成 (数式を変えていない時)

```bash
node build.js
```

→ `../2026-05_venture_map_theory_strategy.pptx` が上書きされる。

### 数式を追加・修正したい時

1. `render_eqs_local.js` の `eqs` 配列を編集
2. `node render_eqs_local.js` を実行 → `eqs/*.png` が再生成される
3. `node build.js` を実行 → デッキ反映

### スライド構成を変えたい時

`build.js` 内の各ブロック (`// === N: タイトル ===`) を編集。
`TOTAL` を更新するのを忘れずに。

## 設計判断のメモ

- 数式は **本物の LaTeX (Computer Modern)** で組版。matplotlib mathtext や CodeCogs API は使わない (品質・依存・秘匿性の理由)。
- ブランドカラーは Armada Blue / Gray / White に統一 (`knowledge/DESIGN.md` 準拠)。
- 全ページに「ヘキサゴンロゴ + teamARMADA ロゴタイプ」を右上に配置。
- 背景は全スライド白基調 (タイトルスライドも例外なし)。

## バージョン履歴

| Version | 日付 | 変更内容 |
|---|---|---|
| v0.1 | 2026-05-03 | 初版 (10 枚) — Ocean Gradient パレット、デザイン検討 |
| v0.2 | 2026-05-03 | Armada カラーに刷新 |
| v0.3 | 2026-05-03 | LaTeX 数式 (matplotlib mathtext) 導入、Slide 2 リフレーム |
| v0.4 | 2026-05-03 | CodeCogs API で本物 LaTeX 化、メンバー共有用フレーミング |
| v0.5 | 2026-05-03 | tectonic + Swift PDFKit でローカル LaTeX パイプライン構築 |
| v0.6 | 2026-05-04 | 批判 18 点 + 改訂式M-1〜D-3 を追加 (14→19 枚) |
| v0.7 | 2026-05-04 | 改訂スライドを「批判 + 修正 + 対応理由」のテーブル形式に拡張 |
