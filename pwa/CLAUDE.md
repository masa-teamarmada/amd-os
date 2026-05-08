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
| **AMD OS 中核データ正本** ⭐⭐⭐ | `pwa/design/L2_DATA.md` | **L2 6 種 (monthly report / AMDプロトコル / MS進捗 / PJナレッジ / メンバーナレッジ / MTGサマリ) + レポート + 全 cron**。データに触る作業の前に必ず読む |
| **設計 md フォルダ全体の入口** ⭐ | `pwa/design/README.md` | 設計の正本フォルダのインデックス。**まずここを読んで「次に何を読むか」を決める** |
| **PWA 全体の正本仕様** ⭐ | `pwa/design/SPEC_pwa.md` | 画面・ルート・データモデル・cron・共通インフラ・運用コマンド・実装規約 |
| **コックピット詳細 / 月次ルーティン** ⭐ | `pwa/design/cockpit.md` | PJ Status / 月次ルーティン stepId × クリック挙動 (回帰多発) |
| テーマ別設計 (Atlas / Venture Map / AMD Score / VC List 等) | `pwa/design/<topic>.md` | `pwa/design/README.md` の表参照 |
| 直近セッション + 次の一手 | `pwa/HANDOFF_pwa_rebuild.md` | スリム保持 (~200 行以下) |
| バグ・教訓 | `pwa/BUGS.md` | 症状/原因/解決策/教訓 形式 |
| 過去セッションの作業ログ | `pwa/design_log/sessions_YYYY-MM.md` | 月単位の作業ログ (append-only) |

**🚨 重要 — 設計 md の置き場所ルール**:
- 設計判断・仕様変更は必ず `pwa/design/` 配下に置く
- `pwa/design_log/` には **過去セッションの sessions_*.md** だけ。新規設計 md を作ってはいけない (次セッションのえいみが見落とす)
- 新セッション開始時は **必ず `pwa/design/README.md` から読む**

---

## ⚠️ Vercel デプロイコマンド（正本・必ずこれを使う）

```bash
bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh
```

このスクリプトは:
1. `npx vercel --prod --yes --cwd <repo-root>` で deploy トリガー
2. Build が Ready になるまで polling (最大 10 分)
3. 完了 → macOS 通知 (Glass 音) でまさに知らせる
4. 失敗 → Basso 音でエラー通知

**直接 `npx vercel` を叩かないこと**。Build 完了通知が出ないので、まさが「終わった?」と確認しに来る無駄が発生する (2026-05-07 のフィードバック)。

**`--cwd` は リポジトリ root** (`pwa/` ではない)。Vercel project `amd-os-pwa` の Settings → Build → Root Directory に `pwa` が設定されているため、`--cwd .../pwa` だと `pwa/pwa` 二重で失敗する (BUGS.md 2026-05-06 参照)。

事前確認:
- リポ root の `.vercel/project.json` が `amd-os-pwa` (`prj_raZW3HSKIszzPUwNTHfy7xDGzLHm`) を指していること。空だと `--yes` で誤って新プロジェクト `amd-os` が作られる
- 無ければ `cp -r /Users/masa/projects/AMD/amd-os/pwa/.vercel /Users/masa/projects/AMD/amd-os/.vercel` で復元

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
