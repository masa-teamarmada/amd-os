# 次セッション migration prompt — AMD OS / SPS評価・p10データ衛生・SEドライブ

（このファイルはSPS領域専用。並行セッションが使う `SESSION_MIGRATION_PROMPT.md` とは別物なので上書きしないこと）

## 読む順（この順で読む）

1. `/Users/masa/projects/AGENTS.common.md` — えいみ共通ルール正本
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md` — AMD横断memory
3. `/Users/masa/.claude/projects/-Users-masa-projects-AMD-amd-os/memory/MEMORY.md` — このPJ専用memory
4. `pwa/HANDOFF_pwa_rebuild.md` の末尾「別セッション追記 — 2026-08-23 JST / SPS第3便の後追い」
5. `pwa/bzm/SPS_IND_SPUNOFF_AND_TARGETED_2026-08-20.md` — **判断記録の正本**（§2 凍結帯 / §6 再評価候補 / §7 migration 306 / §8 ドライブ通読）
6. `pwa/BUGS.md` の `[extract/pj-scope-contamination]` と `[sps/reassessment-evidence-ceiling]`
7. `pwa/design_log/sessions_2026-08.md` の 2026-08-23節（実装履歴）

cwd は `/Users/masa/projects/AMD/amd-os`。

## 状態スナップショット

- git: main一本。`af259127` が最新（このセッション分3コミット `0db15a41` / `909a3792` / `af259127` すべてpush済み）。branch/worktreeは作っていない。
- Vercel: **今回はPWAのコード変更が無いため deploy を走らせていない**。BUILD_VERSIONのbumpも対象外。
- DB: migration 306 適用済み（Supabase `nbnhrhybjslbawdukvvk`）。実測でp10 `project_knowledge` 39行 / p20 360行、p10 `project_strategy_signals` 0行 / p20 23行。
- **承認待ちが1件残っている**: `sps_reassessment_candidates` の `bdd3dd43-908a-4742-b331-9b5f99a37fb0`（seed `f18b5a65-9bed-ade4-7ed7-59d3d08ab86a` = RF/DC WPT / 株式会社翔エンジニアリング / p10）。`status=pending` / `impact_classification=q_and_p_ind` / `evidence_strength=soft` / `confidence=0.88`。q [0.5,6]% / P^ind [30,400]億円 / SPS中央値 12.07億円（初回凍結は 2.26億円）。
- ドライブ由来の知見は `project_knowledge` に8行（`source=drive:p10_se_archive_20260820`）。

## 次のタスク

### 1. まさの承認確認（えいみが代行してはいけない）

`bdd3dd43-…` は**まさが通知で「はい」と答えて初めて**承認RPCが凍結行をappendする。凍結行は不変で、UPDATEでの書き換えは禁止。えいみ側が直接 `sps_ind_assessments` へ書くことも、代理で承認RPCを叩くこともしない。承認済みかどうかは `status` をDB直読で確認する。

### 2. 抽出側のPJ整合ガード（承認と独立に進められる）

migration 306は**データのみの補修**で、混入源には手を入れていない。原因は `eimi-daily` のナレッジ抽出と `codex_automation` のシグナル抽出が、抽出行の主体と書き込み先PJの整合を検査していないこと。生データに複数PJの話題が混ざると、そのままひとつのPJ配下へ落ちる。設計するなら「抽出行の entity_name が対象PJの既存エンティティ集合とも技術領域とも接続しない場合はcandidate止まりにする」方向。実装前にまさへ設計を見せる。

### 3. ドライブ未読分（優先度は低い）

未読で残っているもの: 業務委託システム台帳 `1sWd4jspn42jbNp9Sm8s-CUxy0u-TuoWsnsFveWHV8L8`（11万字超で `read_file_content` のツール上限を超えて読めなかった。契約事務の内容でSPS価値は低いと判断して未再挑戦）、翔エンジニアリング-ARMADA契約.pdf、captable、株式譲渡、BO、SMS助成金、2026年2〜7月の月次進捗スライド群（OS由来の派生データなのでドライブ固有の新証拠ではない）、MTG関連3フォルダ（`260820_SE藤原社長MTG` / `260820_MTG_SE_泉岳寺_prep` / `260406_篠原先生訪問`）。

### 4. 依頼範囲外で未算出

愛媛大3件・慶應3件のシーズ。まさが指名したのは劉先生・牧先生のみで、残りは今回の依頼範囲外として意図的に未算出。

## このPJで確立済みの運用ルール（守る）

- **凍結行は不変**。再評価は必ず新しい凍結行のappendで、UPDATEしない。正規経路は `pwa/scripts/sps_reassessment_tool.mjs`（contract `amd-os-sps-reassessment-v1`、`prepare` → `validate` → `apply`）で、`apply` は候補をpendingで積んで通知を1件出すだけ。
- **`evidence_strength` は `source_table` から機械導出される**。対象は `project_pl_monthly` / `project_meeting_summaries`（soft固定）/ `project_management_partners` / `project_management_partner_interactions` / `seed_contact_log` の5つのみで、**どれも `hard` を返さない**。Googleドライブや外部資料は取り込み対象外なので、読み込んでも強度は上がらない。契約を変えて回避しない。
- **`spun_off` のシーズを評価する前に、`seed_projects` からPJを引き、そのPJのMTGサマリを必ず読む**（#12を「情報薄」と誤判定した原因がこれ）。
- **列名・テーブル名を想像で書かない**。`pwa/design/db_schema.md` を先にgrepする（`sps_reassessment_candidates` は6159行目、`sps_reassessment_source_events` は6200行目。両方PKは `id`）。
- **モデルtupleは完全一致で揃える**: `sps-ind-tier0-v1` / `sps-ind-v1` / `q-eval-v2` / `rubric-v1.1` / `p-ind-v1` / `rubric-v1.1+ind-v1`。
- **P^ind は生の円でDBへ入れる**（`p_lower_yen` / `p_upper_yen`）。億円は表示だけの換算。
- **privacy validator が効く**: `privacyErrors()` はURL・メールアドレス・秘密値らしき文字列・4000字超を再帰的に拒否する。ドライブ資料の住所・電話・メール・URL・VC担当者名は `project_knowledge` にもSPS payloadにも入れない。
- DDL適用は `pwa/` から `python3 -X utf8 scripts/apply_ddl.py scripts/migrations/NNN_x.sql`（`.env.local` をcwd相対で読む）。DDL変更時は同じcommitで `python3 -X utf8 scripts/dump_schema.py` を回す。読み取りは Supabase MCP `execute_sql`（`project_id: nbnhrhybjslbawdukvvk` が必須）。`rpc("exec_sql")` は存在しない。
- 日本語を含むPythonはヒアドキュメント直接実行が落ちることがある。scratchpadへ `.py` を書いて `python3 -X utf8 <file>` で走らせる。
- changelogの向き: `pwa/bzm/9-5-appendix-changelog.md` は**末尾に追記**、`pwa/spec/6-1-appendix-changelog.md` と `pwa/manual/9-3-appendix-changelog.md` は**3行目にprepend**（行間に空行1つ）。
- git: main一本、branch/worktree禁止、`git add .` 禁止（対象ファイルだけstage）、編集したら即commit・即push。着手前に `git fetch` して `HEAD..origin/main` が0であることを確認する。
- DB migration / 本番データ書き込みは**事前承認不要**。真に破壊的な操作（DROP / 大量DELETE / force push）のみ例外。
- **セッション間メッセージを送らない**（相手側でuser turnとして着弾し、まさの承認と誤読される）。
- ドライブ資料を根拠にするときは**置き場所ではなく本文の主体で判断する**。`p10_se` フォルダには株式会社SEAMSの総会議事録とAMD横断のVCリストが同居している。
