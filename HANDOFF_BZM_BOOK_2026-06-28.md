# HANDOFF — BZM 本書執筆 (Before Zero Model モノグラフ) 2026-06-28 セッション

- Last updated: 2026-06-28 (Ch 5 §5.0.1 v4 完成 + Ch 1 §1.0 + §1.0.1 v1 完成 + 目次三層インフラ + Before Zero 定義確定 + 実戦書表記)
- 本ハンドオフは BZM 本書執筆セッション専用。AMD OS 経営ガードレール作業の handoff は別の `HANDOFF.md` 参照
- Canonical project root: `/Users/masa/projects/AMD/amd-os/pwa/bzm/`
- L1 (不変項): `pwa/bzm/BOOK_MASTER_PLAN.md`
- L2 (判決台帳): `pwa/bzm/BOOK_DECISIONS.md` (D-001..D-055 active + R-1..R-5 + P-001..P-011 pending)
- L3 (章単位): `pwa/bzm/CHAPTER_*_PARAGRAPH_OUTLINE.md` (Ch 5 outline は 4 sub-section 構造へ書き換え済み)
- 本文 draft 保存先: `pwa/bzm/new-{book}-ch-{n}-section-{x}[-{y}].md` + 共有ドライブ `ARMADA/a0_management/教科書/<タイトル>.md`
- preview URL: `/bzm/<slug>` (Vercel deploy 経由、スマホ可)

## このセッションでやったこと (要約 — 詳細は design_log)

- **Ch 5 §5.0.1 v3 → v4 反復** — まさレビュー「めっちゃいい」(v3) → さらに引用復活 + ディスプレイ式 σ_SU = ((μ_A+1)(μ_I+1)(μ_G+1))^(1/3) − 1 + 軽い式 + 英語フルスペル定義で v4 (3,320 字 6 段落)
- **Ch 1 (1-1) 起草開始** — まさ確定「やっぱり 1-1 から順に見ていきたい」を受け、§1.0 節本文 v1 (1,380 字 4 段落) + §1.0.1 v1 (2,390 字 5 段落 = 月曜国立大学 / 水曜 VC / 金曜公設試 の三人の面談 blockquote 並置、Kalman 1960 / Stokey-Lucas-Prescott 1989 / Simon 1962 引用、軽い式 s_t = (P_t,R_t,S_t) + y_t = g(s_t) + ε_t) を起草
- **目次三層インフラ整備** — `bzm-chapters.ts` に L1 §5 TOC の全 60 章 entry + status (completed / in-progress / not-started / legacy) + level (1 章 / 2 節 / 3 サブセクション) field 追加、`BzmSideNav` に status indicator + level 別 indent、`BzmMarkdown` blockquote を「四方枠 + 薄背景 + shadow」の囲み box に、`[slug]page` の未着手 stub fallback、目次順序を新 BZM 940p を上 / 実戦書を下、目次番号「1-1」「2-3」を削除
- **Before Zero 定義確定 (まさ確定 2026-06-28、重要)** — Zero = 会社を設立する瞬間 / Before Zero = ゼロより前 / ゼロイチ本との対比から本書独自の位置取り。§1.0 + §1.0.1 本文に明示
- **「実戦書」表記** (まさ確定 2026-06-28) — 旧 BZM 2026-06-13 章割は「後から出版予定の実戦書」と位置付け。bzm-chapters の 6 Part label「[旧版]」→「[実戦書]」、Part key `legacy-*` → `practical-*`、description を「学術書 (新 BZM 本書) と実戦書の二段構え」フレーミングに

詳細は `pwa/design_log/sessions_2026-06.md` の「2026-06-28 — BZM 本書執筆: §5.0.1 v3→v4 + Ch 1 §1.0 + §1.0.1 + 目次三層インフラ + Before Zero 定義確定 + 実戦書表記」エントリ。

## まさの確定方針 (= 次セッションの基準)

- **Zero = 会社を設立する瞬間、Before Zero = ゼロより前** (本書全体の中核フレーミング)
- 文体 = 既存 narrative パート (preface / model-overview / s-survival) と統一。「ですます調」(本論) + 「である調」(冒頭ストーリー blockquote)
- どの学部の大学1年生でも理解できる + 引用文献を読まずに本文だけで完結する
- 「すべて理解できなくても、すべて読破したくなる」を照準
- 学術引用は本文に出す。ただし引用直後に本文側で意味を補足し引用先未読でも完結
- 式はちゃんと出すべきところで出す (§1.0.1 でも display 式 1-2 + 軽い式)
- 冒頭ナラティブパートは markdown blockquote (`>`) で囲い、ナラティブミックス教科書の囲み box 雰囲気に
- サブセクション字数 = 1,500-2,500 字 (Ch 5 §5.0.1 v4 = 3,320 字、Ch 1 §1.0.1 v1 = 2,390 字、§1.0 節本文 = 1,380 字)
- 書き順 = 1-1 (Ch 1) から順に見る (= D-007 の「Book II 中核から」ではなく Book I Ch 1 から)
- 目次順序 = 新 BZM 940p (Book 0-VI + 付録) を一番上、実戦書 (旧 BZM 2026-06-13) を下に
- 目次階層 = 章 (level 1, bold) > 節 (level 2, semibold, indent) > サブセクション (level 3, medium, deeper indent)

## Repo / Deploy State

- Local branch: `main`
- Last BZM 本書 commit: `3df1e540 docs(bzm): §1.0 節本文 v1 + 旧版→実戦書 表記変更` (push 済み)
- このセッションの BZM 関連 commit (上から新しい順):
  - `3df1e540` §1.0 節本文 v1 + 旧版→実戦書 表記変更
  - `a07c7d88` 目次番号削除 + Before Zero 定義修正
  - `c1c05e49` Ch 1 §1.0.1 v1 first draft + Book I 三層 entry 追加
  - `8be31987` 冒頭ナラティブパートを線で囲い box に
  - `81e41f04` v4 §5.0.1 + 目次三層階層化 + 新 BZM 上配置
  - `7adcfd87` v3 narrative tone (大学1年生でも読める版)
  - `a6665886` scaffold 新 BZM 本書 940p TOC + §5.0.1 first draft
- BUILD_VERSION: 開始 `v0.36.9` → 現在 `v0.36.25` (= 私の bump + 他セッション の bump 合計)
- Unrelated dirty state (まさ別作業の WIP) はそのまま、broad cleanup 禁止 (= 私は 6 ファイルだけ specific stage で commit)

## 残課題 (優先順位順)

1. **【最優先】まさ確認待ち**: Ch 5 §5.0.1 v4 (引用 + 式入り、blockquote 化済) + Ch 1 §1.0 節本文 + §1.0.1 v1 の URL 目視。スマホで `/bzm/new-book2-ch-5-section-0-1` / `/bzm/new-book1-ch-1-section-0` / `/bzm/new-book1-ch-1-section-0-1` を確認。
2. まさ OK が出れば、§1.0.2 / §1.0.3 / §1.0.4 を **並列で 3 Workflow 起動** (= §1.0 残り 3 サブセクション、各 1,500-2,500 字、同じ Workflow 設計: 3 persona × synth + opus medium/high)。
3. § 1.0 完了後、§1.1 (= 「測る」とは何をすることか、4p) から順に起草。Ch 1 全体節構造 (8 節 30p) は `pwa/bzm/COMMANDER_TASKS.md` または design_log 2026-06-28 entry を参照。
4. 並行して Ch 5 §5.0.2 / §5.0.3 / §5.0.4 も起草可 (= Book II Ch 5 の §5.0 を埋める、まさ確定の書き順とは独立)。
5. **Ch 1 全体 8 節構造の outline 確定** (Workflow `wlewsdw8l` で起草済、bzm-chapters.ts に entry 反映済): §1.0 章頭 (2.5p, 着手中) / §1.1 「測る」とは (4p) / §1.2 状態空間 (5p) / §1.3 観測量 (5p) / §1.4 Before Zero の観測問題 (5p) / §1.5 二層観測 PRS/ERS (4p) / §1.6 失敗パターンと校正 (3p) / §1.7 Book II 橋渡し (1.5p)。
6. **まさが先に判断する pending** (`pwa/bzm/BOOK_DECISIONS.md` §4): P-001 機関匿名化 / P-002 Ch 24 国際機関 / P-003 Ch 26b ≥20 case / P-004 Ch 21 KUTE wave-1 / P-005 ALQ4 controversy / P-006 Ch 37 dominate failure / P-007 Y-006/007/008 / P-008a-e 進化経済軽微修正残 / P-009 ICC 第三伴走 / P-010 Ch 9/10.4 正典分担 / P-011 OSF 事前登録タイミング。

## First Next Action (= 次セッションの最初の一手)

```
まさが §1.0.1 v1 / §1.0 v1 / §5.0.1 v4 をスマホ目視し、OK サインが出たら:
- § 1.0.2 (「測れない」の正体: 状態と観測量のずれ) 起草 Workflow 起動
- § 1.0.3 (それでも測る理由: 共通言語・判断・再現可能性) 起草 Workflow 起動
- § 1.0.4 (本章の道筋: 状態空間と二層観測へ) 起草 Workflow 起動
を **並列で 3 つ** 立ち上げる。Workflow script は `/private/tmp/.../scratchpad/ch1_section_0_1_workflow.js` をベースに、対象サブセクションの outline (Workflow wlewsdw8l output `ch1_outline.section_0_outline` 参照) と既存 narrative トーン要件で書き直す。

NG が出た場合は、まさの修正指示を反映して該当サブセクションを書き直し。
```

## Read First Next Session (順番厳守)

1. **本ファイル** `HANDOFF_BZM_BOOK_2026-06-28.md`
2. `pwa/bzm/BOOK_MASTER_PLAN.md` (L1 不変項、940p / 18ヶ月 / Cambridge UP + Research Policy + ICC + 実戦書)
3. `pwa/bzm/BOOK_DECISIONS.md` (L2 判決台帳、D-001..D-055)
4. `pwa/bzm/CHAPTER_5_PARAGRAPH_OUTLINE.md` (Ch 5 §5.0 は 4 sub-section 構造へ書き換え済)
5. `pwa/bzm/new-book2-ch-5-section-0-1.md` (Ch 5 §5.0.1 v4 = 引用 + 式 + 冒頭 blockquote)
6. `pwa/bzm/new-book1-ch-1-section-0.md` (Ch 1 §1.0 節本文 v1)
7. `pwa/bzm/new-book1-ch-1-section-0-1.md` (Ch 1 §1.0.1 v1 = 三人の面談 blockquote 並置)
8. `pwa/bzm/preface.md` / `pwa/bzm/model-overview.md` / `pwa/bzm/s-survival.md` (= 実戦書素材、文体の手本)
9. `pwa/design_log/sessions_2026-06.md` の 2026-06-28 BZM 本書執筆 entry
10. `pwa/BUGS.md` 末尾 2 件 (Workflow script typo + reminder snapshot 誤判断、再発防止規律)

## ポインタ

- Spec 相当: L1 = `pwa/bzm/BOOK_MASTER_PLAN.md`、L2 = `pwa/bzm/BOOK_DECISIONS.md`
- 章単位進捗: `pwa/bzm/CHAPTER_*_PARAGRAPH_OUTLINE.md` (Ch 5 / Ch 5.5)、Ch 1 outline は Workflow `wlewsdw8l.output` 内 + bzm-chapters.ts entry 反映
- Bugs: `pwa/BUGS.md` (BZM 本書執筆セッションでの bug は 2026-06-27 の 2 件 + 2026-06-28 の 2 件)
- 設計提案: `pwa/bzm/2026-06-25_proposal_book0_vi.md` 他 3 件
- Task ledger: `pwa/bzm/COMMANDER_TASKS.md`

## Token 累計 (参考)

このセッションで起動した workflows 5 件、累計 subagent_tokens ≈ 510k。各 workflow は 3-5 agents × opus medium + 1 synth opus high。
