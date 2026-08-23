# 次セッション migration prompt — AMD OS / SPS初回評価「意味づけ欠落」是正ラウンド

（このファイルはSPS初回評価の品質是正専用。`SESSION_MIGRATION_PROMPT_SPS.md`（再評価候補・p10データ衛生）
とも `SESSION_MIGRATION_PROMPT.md`（モデル層）とも別物なので上書きしないこと）

## 読む順（この順で読む）

1. `/Users/masa/projects/AGENTS.common.md` — えいみ共通ルール正本
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md` — AMD横断memory
3. `/Users/masa/.claude/projects/-Users-masa-projects-AMD-amd-os/memory/MEMORY.md` — このPJ専用memory
4. `pwa/HANDOFF_pwa_rebuild.md` の末尾「別セッション追記 — 2026-08-23 JST / SPS初回評価『意味づけ欠落』是正ラウンド」
5. `bzm/SPS_INITIAL_ASSESSMENT_PLAYBOOK.md` §1（**件数と再開手順の正本**）
6. `pwa/scripts/sps_batch/README.md`「是正ラウンド」節（**手順の正本**。回し方・エージェント指示ひな型を含む）
7. `pwa/BUGS.md` の2026-08-22〜23節「SPS意味づけ欠落の是正ラウンドで、進捗確認を怠り23時間停止に気づけなかった」

cwd は `/Users/masa/projects/AMD/amd-os`（モノレポのルート）。`pwa/` を cwd にしない。各コマンドは先頭で
`cd /Users/masa/projects/AMD/amd-os/pwa` する。

## 状態スナップショット

- git: main一本。このスレッドの最終commitは `docs: SPS初回評価の意味づけ欠落是正ラウンドのhandoffを追記`
  （HEAD付近）。すべてpush済み。branch/worktreeは作っていない。
- DB: migration 318 適用済み（Supabase `nbnhrhybjslbawdukvvk`）。是正経路（`supersedes_assessment_id` 追記方式）が稼働中。
- **意味づけ欠落は 372 → 170 まで進んだ**（`ok 202 / ng 0`）。実測は
  `cd pwa && node scripts/sps_initial_assessment_tool.mjs status` の `defective` フィールド。
  `remaining`（未評価）は既に0で今回は動かない。
- pending候補は0件。**途中の中断状態は残っていない**ので、素直に `prepare --remediate --limit 100` から始められる。
- **共有checkoutに他セッションのdirtyが残っている可能性がある**（自分の作業ではないので確認だけしてから進める）:
  `model/APPROVALS.md`（変更）、`pwa/scripts/migrations/319_sps_reassessment_pgcrypto_resolution.sql`（新規・未追跡）。
  `git log` でこれが今も書かれている途中か確認してから、自分の対象ファイルだけ扱う。

## 次のタスク

### 1. 残り170件の是正投入（このスレッドの本体作業）

`sps_batch/README.md`「回し方（実証済み）」のひな型をそのまま使う。1ラウンド = `prepare --remediate --limit 100`
（親が1回だけ叩く）→ 5体 × 20件担当 → 全員の `applied ok=N ng=M` が揃ってから次の `prepare`。

- **pending の除外は submit された後にしか効かない。** 走っている最中にもう一度 `prepare` を叩くと同じ100件が返る。
- **サブエージェントは親セッション（＝このClaude Codeプロセス）が閉じると死ぬ。** バックグラウンドで起動して
  席を外すことはできない。まさが画面を見ていられる間に、1ラウンド10分弱で完走させる。
- エージェントには「1件読んだらその場で `add()` を書き足す（まとめて最後に書かない）」を必ず指示する。
  途中で死んでも、書きかけの gen ファイルが scratchpad に残っていれば拾って続けられる（`pwa/BUGS.md` 参照）。
- 投入のたびに `audit_remediation.mjs --since <ISO時刻>` で構造監査する（端点再計算・11因子順序・意味づけ充足・署名）。
- 170件が0になったら `bzm/SPS_INITIAL_ASSESSMENT_PLAYBOOK.md` §1 の件数を更新し、
  `bzm/9-5-appendix-changelog.md` へ完了報告の行を追記する。

### 2. 完了後の確認

`defective: 0` になったら、`seed_screening_bands` の現行版タプル行が11因子すべて意味づけを持つことを
`audit_remediation.mjs`（`--since` なしで全件、または適切な範囲）で最終確認してから、まさへ完了報告する。

## このPJで確立済みの運用ルール（守る）

- **prepared（`pNN.json` / `pR*.json`）は絶対に加工しない。** 全エージェントが同じファイルを `--prepared` に渡す。
- **同時に複数シーズを絶対に読まない。** `show.py` で1件ずつ。
- **是正モードは11因子すべてに空でない `assessment` が必須**（通常投入は1件以上でよい）。1つでも空だとDB側の
  検証関数が弾く。
- **根拠のない値は null のまま。** 採択年度・金額・実施期間を推測で埋めない。
- **`RESULT: OK` になるまで submit しない。**
- エージェントが返すのは `applied ok=N ng=M` の1行と、NGがあればその candidate_id だけ。評価本文は返させない。
- git: main一本、branch/worktree禁止、`git add .` 禁止（対象ファイルだけstage）、編集したら即commit・即push。
  **`git add <path>` の直後、commit する前に `git diff --staged <path>` で自分が書いた内容だけが乗っているか確認する**
  （共有checkoutで他セッションの書き込みを巻き込んだ実例があるため）。
- DB migration / 本番データ書き込みは事前承認不要。真に破壊的な操作（DROP / 大量DELETE / force push）のみ例外。
- **セッション間メッセージを送らない。**
- **バックグラウンド実行の状況は、直前に実測した場合しか「進んでいる」と言わない。** 「動いているはず」で
  会話を終えない。
