# HANDOFF — BZM 本書執筆 (Before Zero Model モノグラフ) 2026-06-27 セッション

- Last updated: 2026-06-27 (BZM 本書 Book II 100% + Book III 4 章 skeleton 完成 + Ch 5 §5.0 本文 draft 試作品)
- 本ハンドオフは BZM 本書執筆セッション専用。AMD OS 経営ガードレール作業の handoff は別の `HANDOFF.md` 参照
- Canonical project root: `/Users/masa/projects/AMD/amd-os/pwa/bzm/`
- L1 (不変項): `pwa/bzm/BOOK_MASTER_PLAN.md`
- L2 (判決台帳): `pwa/bzm/BOOK_DECISIONS.md` (D-001..D-055 active + R-1..R-5 + P-001..P-011 pending)
- L3 (章単位): `pwa/bzm/CHAPTER_*_SKELETON.json` + `pwa/bzm/CHAPTER_*_PARAGRAPH_OUTLINE.md`

## このセッションでやったこと

- **Book II 全 19 章 skeleton 完成** (272p) — Ch 5 / 5.5 / 6 / 7 / 8 / 9 / 10.0-10.10 / 11 / 11.5 すべて 3 persona × 3 judge × synth で起草
- **Book III 4 章 skeleton 着手** — Ch 12 TIEM ゾンビ型 / Ch 13 BWE 健全型 (進行中) / Ch 14 CX R_net 負号 / Ch 15 SX μ_G ジャンプ
- **段落 outline 2 節完成** — Ch 5 (96 段落 15,300 字) + Ch 5.5 (73 段落 14,210 字) = `CHAPTER_5_PARAGRAPH_OUTLINE.md` + `CHAPTER_5_5_PARAGRAPH_OUTLINE.md`
- **本文 draft 試作品 1 節** — Ch 5 §5.0 章頭フック 2,280 字 12 段落 (witapvxv9 output JSON 内 final_section_body_markdown)。まさからトーン feedback (= 次の起点)
- **L1/L2 確立** — 3 層 md frame (L1 不変項 + L2 判決ledger + L3 章単位進捗)、D-001..D-055 active、進化経済査読 軽微修正 6 件すべて active 化
- **memory rule 2 件** — `feedback_commit_push_no_approval_for_docs.md` (docs/ledger は承認得ず即実行) + `feedback_git_staged_set_verification.md` (commit 前に必ず staged set 検証)

詳細ログは `pwa/design_log/sessions_2026-06.md` の「2026-06-27 — BZM 本書 Book II 100% + Book III 4 章 + 本文 draft 試作品」エントリ。

## まさからのトーン feedback (次の起点)

- **トーンは OK** だが、もう少し読者親和性を上げたい
- **まさっぽさ**を守る (= まさは「説明が分かりやすい」と評価される。これを守らないと「まさの本」じゃない)
- **専門性は譲らない** が、説明を厚くして読みやすさを担保
- **セクションが短すぎる** → 説明を厚くしてちょうどいいボリュームに
- 初心者向け本は別途あとから出版する、本書は専門書だが読みやすさは守る

## Repo / Deploy State

- Local branch: `main`
- Last BZM 本書 commit: `d21fc958 docs(bzm): add L3 CHAPTER_12_SKELETON.json (TIEM ゾンビ型 24p)` (push 済み)
- 本セッション中の事故 2 件 (BUGS.md に append 済み):
  - 73f92211: `git commit` が staged 全 72 files 巻き込み → 45a831e3 で revert
  - 411eba9e: revert chain で D-045..D-048 が L2 から脱落 → 67dfa2a4 で補正
- Unrelated dirty state (まさ別作業の WIP) はそのまま、broad cleanup 禁止
- BZM 本書 docs only commit は BUILD_VERSION bump up 不要 (反省 #2 ルール)

## 進行中 workflows (次セッション開始時点で完了見込み)

| ID | 内容 | 状態 |
|---|---|---|
| `wi0pizhng` | Ch 13 BWE 健全型 22p skeleton | 18:00 前後に完了見込み |

完了通知が来たら `pwa/bzm/CHAPTER_13_SKELETON.json` として保存 + commit + push。

## Unresolved Tasks (優先順位順)

1. **【最優先】Ch 5 §5.0 本文 draft v2** — まさトーン feedback を反映して書き直し。設計目標:
   - セクションが短すぎる問題 → 1 段落 200-400 字 (現在 90-220 字)、合計 3,500-4,500 字 (現在 2,280 字)
   - まさっぽい説明の厚み = 専門用語の **読者向け補足** を増やす (例: 「Cobb-Douglas 合成 = 幾何平均型集約」「これは何かというと…」)
   - narrative の物語的接続詞は残す (まさが好む)
   - Tier A 規律と引用密度は維持
   - witapvxv9 output JSON の tone_handles_for_masa 8 個を起点にレビュー
2. v2 が OK なら、まさ確定 → 同 protocol で Ch 5 §5.1〜§5.7 を順次起草 (7 節)
3. Ch 5 完成後、Ch 5.5 段落 outline (`CHAPTER_5_5_PARAGRAPH_OUTLINE.md`) を元に本文 draft へ
4. Book III 残り 12 章 (Ch 16 CTB / Ch 17 YD / Ch 18 JC / Ch 19 CLG / Ch 20-24 機関 / Ch 25 / Ch 26a / Ch 26b) の skeleton 起草を Book II と同じ pattern で
5. Book 0 / I / IV / V / VI は Book II/III 完成後 (まさ確定書き順 D-007)

## まさが先に判断する pending (BOOK_DECISIONS.md §4)

P-001 機関匿名化 / P-002 Ch 24 国際機関 / P-003 Ch 26b ≥20 case / P-004 Ch 21 KUTE wave-1 / P-005 ALQ4 controversy / P-006 Ch 37 dominate failure / P-007 Y-006/007/008 / P-008a-e 進化経済軽微修正残 / P-009 ICC 第三伴走 / P-010 Ch 9/10.4 正典分担 / P-011 OSF 事前登録タイミング

## Read First Next Session (順番厳守)

1. **本ファイル** `HANDOFF_BZM_BOOK_2026-06-27.md`
2. `pwa/bzm/BOOK_MASTER_PLAN.md` (L1 不変項、940p / 18ヶ月 / Cambridge UP + Research Policy + ICC)
3. `pwa/bzm/BOOK_DECISIONS.md` (L2 判決台帳、D-001..D-055)
4. `pwa/bzm/CHAPTER_5_PARAGRAPH_OUTLINE.md` (Ch 5 段落 outline、本文 draft の起点)
5. `/private/tmp/claude-501/-Users-masa-projects-AMD-before-zero/3ab4bb45-6708-402b-9674-f186ca8484bc/tasks/witapvxv9.output` (Ch 5 §5.0 本文 draft 試作品 v1 + tone_handles_for_masa)
6. `pwa/design_log/sessions_2026-06.md` の 2026-06-27 BZM 本書セッション entry (反省 + 事故 2 件 + memory rule 2 件)
7. `pwa/BUGS.md` の 73f92211 + 411eba9e 事故エントリ (再発防止規律)

## First Next Action (= Ch 5 §5.0 本文 draft v2 起草)

```
witapvxv9.output の Ch 5 §5.0 v1 (2,280 字) を読み、まさトーン feedback
(読者親和性アップ・まさっぽさ・説明厚く・セクション長め) を反映した v2 を
起草する Workflow を立てる。

設計:
- Phase 1: 1 agent (opus effort=high) で v1 を読み込み、各段落を 200-400 字に
  厚くする (専門用語の読者向け補足、まさっぽい説明の厚み)。合計 3,500-4,500 字
- Phase 2: まさへ提示、段落単位擦り合わせ
- Phase 3: まさ確定後、同 protocol で §5.1〜§5.7 を起草
```

## 関連事故 (BUGS.md に append 済み、再発防止規律)

- **73f92211 事故**: `git add <file>` 後 `git commit` (オプションなし) が staged 全件を commit する標準動作で 72 files 巻き込み push
- **411eba9e 事故**: `git revert -n` 後 `git add` が空 diff (revert で workdir 戻った後だったことに気付かず) → D-045..D-048 がロストして commit、後 67dfa2a4 で補正
- memory rule `feedback_git_staged_set_verification.md` 強制: `git status --short` + `git diff --staged --stat` を commit 前に必ず実行

## Token 累計 (参考)

このセッションで起動した workflows 約 25 件、累計 subagent_tokens ≈ 10M。各 workflow は 7 agents × effort=high opus。
