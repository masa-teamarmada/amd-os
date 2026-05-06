@AGENTS.md

# CLAUDE.md — AMD OS PWA 固有ルール

> **共通運用ルールは `~/.claude/CLAUDE.md` を参照。**
> このファイルには AMD OS PWA 固有の技術仕様だけを書く。

---

## 技術スタック

Next.js 16 + React 19 + Tailwind CSS v4

## プロジェクト情報

- **ローカルディレクトリ（正本）**: `/Users/masa/projects/AMD/amd-os/pwa`
- **バックエンド**: Supabase（直接接続） + AMD OS GAS（`WEBAPP_BASE_URL` 経由）
- **デプロイ**: Vercel（armada0130 / amd-os-pwa）
- **本番URL**: https://amd-os-pwa.vercel.app

## デプロイ方式・Git運用

- **現在のPWA本番反映はVercel CLIによるローカル直接deploy**。
- **VercelのGit自動deployを正本として使っていない**。別repo/branchから自動反映される前提で作業しないこと。
- 実装ベースは `main` checkout の `/Users/masa/projects/AMD/amd-os/pwa`。
- ただし現状は移行直後の大きな未コミット差分を含む。`main` のリモートHEADだけを見ても本番相当の実装とは限らない。
- `git remote -v`: `https://github.com/masa-teamarmada/amd-os.git`
- `git branch --show-current`: `main`
- `.vercel/project.json`: projectName `amd-os-pwa` / projectId `prj_raZW3HSKIszzPUwNTHfy7xDGzLHm`
- Claude/Codexがdeployする場合は、必ずこのローカルcheckoutから `--cwd /Users/masa/projects/AMD/amd-os/pwa` を指定してVercel CLI deployする。

## ドキュメント構成（**この順で読む**）

| 何を知りたいか | ファイル | 内容 |
|---|---|---|
| **PWA 全体の正本仕様** ⭐ | `pwa/SPEC_pwa.md` | 画面・ルート・データモデル・cron・共通インフラ・運用コマンド・実装規約 |
| 直近セッション + 次の一手 | `pwa/HANDOFF_pwa_rebuild.md` | スリム保持 (~200 行以下)。過去ログは design_log へ |
| バグ・教訓 | `pwa/BUGS.md` | 症状/原因/解決策/教訓 形式。新バグはここに追記 |
| 過去セッションの作業ログ | `pwa/design_log/sessions_YYYY-MM.md` | 月単位の作業ログ |
| 個別設計議論 | `pwa/design_log/2026-MM_*.md` | テーマ別 (Atlas / Venture Map モデル等) |

**新セッションは SPEC_pwa.md を最初に読んで全体像を掴んでから HANDOFF を見る。** 仕様変更は SPEC を同じ commit で更新。バグ発生時は BUGS に追記。セッションごとの作業は design_log/sessions_YYYY-MM.md に append。役割分離の詳細は handoff skill を参照。

---

## ⚠️ Vercel デプロイコマンド（正本・必ずこれを使う）

```bash
npx vercel --prod --yes --cwd /Users/masa/projects/AMD/amd-os/pwa
```

**`--cwd` は必須。** シェルの現在地に依存すると別ディレクトリの設定ファイルだけがアップロードされ、全ルート 404 になる事故が起きる。

ロールバック方法（緊急時）:
```bash
npx vercel promote <デプロイID> --scope armada0130 --yes
# デプロイIDは vercel ls --scope armada0130 で確認
```

---

## ⚠️ DDL適用（Supabase Management API 経由）

```bash
python -X utf8 scripts/apply_ddl.py scripts/migrations/NNN_name.sql
```

- `.env.local` の `SUPABASE_ACCESS_TOKEN`（sbp_…）を使用
- **User-Agent ヘッダー必須**（Cloudflare 1010 回避）
- migrations は `scripts/migrations/NNN_name.sql` に必ず残す
- supabase-js REST + `rpc("exec_sql")` は存在しない。SQL Editor 手動依頼もNG

---

## AMD OS 固有ルール

GASとの連携・DB設計・ScriptPropertiesキー等は `AMD_OS/CLAUDE.md` を参照。
このセッションはPWA（フロントエンド）に集中する。GAS側の変更が必要になったら別セッションで対応する。
