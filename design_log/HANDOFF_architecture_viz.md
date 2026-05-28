# アーキテクチャ図の自動生成

## 最終更新
- 日時: 2026-04-04
- セッション概要: D264実装→本番投入完了（619件→15件Blueprint）、clasp正本統一、GASバックアップ週次タスク設定

## 完了タスク
- D264_BlueprintAutoExtract.js 新規作成・デプロイ・本番実行
- 設計ログ619件→Blueprint 15件抽出 → DB_Blueprint追記済み
- `blueprint_extract` プロンプトをDB_TsukuyomiContextに登録済み
- 毎日4:00 JSTの自動抽出cronトリガー設定済み
- clasp push正本ディレクトリを `/Users/masa/` に統一（全5プロジェクト）
- dev GASからAプレフィックス42ファイル混入を除去
- 共有ドライブ `gas-main/`, `gas-dev/` の `.clasp.json` を無効化
- GAS週次バックアップのscheduled task作成（毎週月曜9:07）

## 未完了・継続タスク
- DB_TsukuyomiContextの `blueprint_visualize` / `blueprint_spec` プロンプトの存在確認
- Dev画面Blueprintタブでproposedエントリをレビュー → activeに昇格
- 「📊 ビジュアライズ」でSVG生成して品質確認
- SVG自動生成のdaily cron追加（Blueprint抽出後に自動ビジュアライズ → Drive保存）

## 既知の問題・ブロッカー
- `blueprint_visualize` プロンプトがDB_TsukuyomiContextに存在するか未確認
- ビジュアライズはactiveエントリのみ対象（proposedは除外される可能性）

## 次のアクション（推奨）
1. Dev画面BlueprintタブでBlueprintエントリ15件を確認
2. 良いものを `active` に昇格
3. 「📊 ビジュアライズ」でSVG生成

## このセッションで得た知見
- clasp push正本は `/Users/masa/` 配下に統一。共有ドライブの `gas-*` は閲覧用ミラー
- dev GASにはDプレフィックスのみ。Aプレフィックスは事故混入だった
- 共有ドライブの `.clasp.json` は `.clasp.json.DISABLED` にリネームして物理的にpush不可に
- LLM分類の品質: 619件→15件への昇華は妥当。type/domain/priorityの分類も良好

## 環境情報

### clasp push正本ディレクトリ
| GASプロジェクト | 正本ディレクトリ |
|---|---|
| 本体GAS | `/Users/masa/amd-os/` |
| AMD-Admin | `/Users/masa/amd-admin/` |
| AMD-Report | `/Users/masa/amd-report/` |
| AMD-Slack | `/Users/masa/amd-slack/` |
| dev-AMD-OS | `/Users/masa/dev-amd-os/` |

### Google Drive フォルダID
| フォルダ | ID |
|---|---|
| `design_log/amd_os/` | `1wGcNmVPcBki1h9VJ8QAXFOgFIJEs8iP2` |

### dev GASプロジェクト
- scriptId: `1QtupbTVzNQ9vmudIiinyFps2-FCxoknFvnmZiqtlm1iBB83F4K7qgb5s`
- ローカルパス: `/Users/masa/dev-amd-os/`
- エディタURL: https://script.google.com/u/0/home/projects/1QtupbTVzNQ9vmudIiinyFps2-FCxoknFvnmZiqtlm1iBB83F4K7qgb5s/edit
