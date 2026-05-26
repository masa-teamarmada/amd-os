# 開発者向け

新しい機能を追加する開発者 (= えいみ含む) 向け。

## リポジトリ構成

正本リポ: **`github.com/masa-teamarmada/amd-os`** (= 唯一)

```
amd-os/
├── pwa/              ← Next.js 16 + React 19 + Tailwind v4 (= 本体)
│   ├── manual/       ← このマニュアル
│   ├── design/       ← 設計議論 md
│   ├── design_log/   ← セッション記録 (時系列)
│   ├── src/
│   ├── scripts/      ← migration / 手動ツール
│   ├── public/
│   └── ...
├── gas/              ← Google Apps Script (= 一部運用系のみ、L2 抽出は廃止)
├── ios/              ← Swift / SwiftUI (= 別アプリ)
├── android/          ← TBD
└── ...
```

### 開発時の注意
- 旧スタンドアロンリポ (`amd-os-ios` / `amd-os-pwa` / `amd-os-android` / `amd-os` GAS版) は **archive 済**、参照しない
- Google Drive 配下に clone するのは **禁止** (= `.git` が壊れる事故あり、`~/.Trash/` に退避)
- 推奨パス: `~/projects/AMD/amd-os/`

## Vercel デプロイ (= 正本)

```bash
bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh
```

- `--cwd` は repo root を指す (`pwa/` ではない、二重指定で失敗する)
- `--archive=tgz` 必須 (= モノレポで 15000 files 越え対応)
- 完了通知 (= macOS Glass 音) でまさに知らせる
- 失敗は Basso 音

### 事前確認
- `.vercel/project.json` が `amd-os-pwa` を指す (= 空だと `--yes` で新プロジェクト作成事故)

### ロールバック
```bash
npx vercel promote <デプロイID> --scope armada0130 --yes
```

## Supabase

- プロジェクト: `nbnhrhybjslbawdukvvk`
- migration: `pwa/scripts/migrations/NNN_name.sql`
- apply:
  ```bash
  python3 -X utf8 pwa/scripts/apply_ddl.py pwa/scripts/migrations/NNN_name.sql
  ```
  - `.env.local` の `SUPABASE_ACCESS_TOKEN` (sbp_…) 使用
  - User-Agent ヘッダー必須 (= Cloudflare 1010 回避)
- schema dump:
  ```bash
  python3 -X utf8 pwa/scripts/dump_schema.py
  ```
  - `pwa/design/db_schema.md` を自動生成 (= 手動編集禁止)

### 列名・テーブル名は想像で書かない
- DDL を変更したら同じ commit で `dump_schema.py` を実行して `db_schema.md` を再生成
- 他の md / コードで「テーブル X の列 Y」と書くときも必ず `db_schema.md` を grep

## Codex automation の追加

場所: `~/.codex/automations/{name}/`

### 構成
```
amd-os-{name}/
├── automation.toml     ← cron 設定 + prompt
├── memory.md           ← automation の状態メモ
└── outbox/             ← Supabase 反映前の JSON 出力先
```

### automation.toml 例
```toml
[automation]
schedule = "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU;BYHOUR=3;BYMINUTE=20"

[prompt]
system = """
あなたは...
"""

user = """
{{input data}}
"""
```

### outbox の reach 経路
1. automation が `outbox/{timestamp}.json` を吐く
2. LaunchAgent applier (= `run-ms-outbox-applier.sh`) が 5 分ごとに polling
3. apply 成功で `outbox/applied/` に移動

### outbox 監視 dir に追加するには
`/Users/masa/projects/AMD/amd-os/scripts/run-ms-outbox-applier.sh` を編集:
```bash
NEW_AUTOMATION_DIR="/Users/masa/.codex/automations/amd-os-{name}"
NEW_COUNT=$(find "${NEW_AUTOMATION_DIR}/outbox" -maxdepth 1 -type f -name '*.json' 2>/dev/null | wc -l | tr -d ' ')
if [ "${NEW_COUNT}" != "0" ]; then
  node pwa/scripts/{tool}.mjs apply-outbox-dir --dir "${NEW_AUTOMATION_DIR}/outbox" || STATUS=$?
fi
```

## Claude routine (= scheduled task) の追加

場所: `~/.claude/scheduled-tasks/{name}/SKILL.md`

### 登録 (= 正本フロー)
1. SKILL.md の prompt を起草 (= `pwa/design/{name}.md` に inline で書いてまさレビュー、`pwa/design/l2_extract_claude_routine.md` 参照)
2. レビュー OK 後、`mcp__scheduled-tasks__create_scheduled_task` tool で登録 (= cron 式はローカル時刻)
3. routine は Claude Code app 起動中に発火 (= app 閉じてた時は次回起動時に追いつき)
4. `notifyOnCompletion=true` で running session に通知 (= 標準)

### 構成
```markdown
---
name: amd-os-{name}
description: ...
---

# Skill 本文

【絶対】 動く前に必ず Read:
1. {関連マニュアル / 設計 md パス}
2. ...

═══════════════════════════════════════════════════
Phase A: {データ収集 or 候補抽出}
═══════════════════════════════════════════════════

1. cwd を /Users/masa/projects/AMD/amd-os
2. pwa/.env.local から CRON_SECRET / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY をロード
3. ...

═══════════════════════════════════════════════════
Phase B: {処理 + upsert}
═══════════════════════════════════════════════════

1. ...
2. **修正依頼の織り込み** (= 必須): `l2_feedbacks` を読み込んで prompt に渡す
3. 直接 Supabase REST に upsert (= service_role)

═══════════════════════════════════════════════════
Phase C: run summary
═══════════════════════════════════════════════════
- 処理件数 / saved / skipped / エラー
- まさへの 1 行サマリ
```

### Skill の特徴
- Claude Code Skill としても動作 (= まさが `/{name}` で手動キック可)
- scheduled で勝手に動く + 結果を running session に通知 (`notifyOnCompletion=true`)
- LaunchAgent と違い、Claude Code app が動いてる時に発火 (= app 閉じてた時は次回起動時に追いつき)

### 既存 routine (= 2026-05-25 時点)
- ✅ `amd-os-management-dialogue-prep` (daily 07:00 JST) — まさえいMTG 議題プリペア
- 🚧 `amd-os-meeting-extract` (毎時 0 分 予定) — L2 ⑥ MTG サマリ抽出 (= GAS 153 後継)
- 🚧 `amd-os-protocol-extract` (daily 08:00 JST 予定) — L2 ② AMD プロトコル抽出
- 🚧 `amd-os-project-knowledge-extract` (daily 08:15 JST 予定) — L2 ④ PJ ナレッジ抽出
- 🚧 `amd-os-member-knowledge-extract` (daily 08:30 JST 予定) — L2 ⑤ メンバーナレッジ抽出

## LaunchAgent (= outbox applier) の追加 / 拡張

場所: `~/Library/LaunchAgents/jp.teamarmada.{name}.plist`

### plist 例
```xml
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>jp.teamarmada.{name}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>/Users/masa/projects/AMD/amd-os/scripts/run-{name}.sh</string>
  </array>
  <key>StartInterval</key>
  <integer>300</integer>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
```

### 登録
```bash
launchctl load -w ~/Library/LaunchAgents/jp.teamarmada.{name}.plist
```

## デバッグ・トラブルシュート

### Codex automation が動いてない時
```bash
# 最新 outbox 確認
ls -lat ~/.codex/automations/amd-os/strategy-signals-outbox/
ls -lat ~/.codex/automations/amd-os-ms/outbox/

# applier ログ確認
tail ~/.codex/automations/amd-os-ms/logs/outbox-applier.log

# 手動 apply
node /Users/masa/projects/AMD/amd-os/pwa/scripts/ms_progress_review_tool.mjs apply-outbox-dir --dir ~/.codex/automations/amd-os/strategy-signals-outbox
```

### Vercel deploy 失敗時
- `.vercel/project.json` が正しいか
- archive=tgz が付いてるか
- ファイル数 15000 超えてないか

### Supabase 接続失敗時
- `.env.local` の `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 確認
- migration repair (= ローカルとリモートの migration version 不整合): `pwa/scripts/migration_repair.py`

### `/admin/settings` と cron 台帳を触る時
- `pwa/src/lib/operations-catalog.ts` が Raw / L2 / Cron 表示の正本
- Run Now 可能にする前に、LLM 課金・DB 大量更新・dryRun の有無を確認する
- 停止中の LLM cron を復活させる前に [05 章 5.1](05-decisions-and-history.md#51-cron-廃止経緯--2026-05-22-仕様変更の本丸) と [24 章](24-operations-settings-spec.md) を読む

### LLM 抽出結果がおかしい時
- まず prompt が DB 管理されてるか確認 (= AGENTS.common.md ルール)
- DB 管理されてないなら、コード hardcode 部分を編集 + DB 化を別 task として起票
- 修正後は **次回 cron** で反映 (= 即時再抽出ロジックが組まれてれば即反映)

---

## 関連
- 開発ルール正本: [`/Users/masa/projects/AGENTS.common.md`](../../../AGENTS.common.md)
- PWA 固有: [`pwa/CLAUDE.md`](../CLAUDE.md)
- 仕様統制: [`pwa/design/SPEC_GOVERNANCE.md`](../design/SPEC_GOVERNANCE.md)
