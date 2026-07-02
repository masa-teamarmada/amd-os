# HANDOFF — BZM Book (2026-07-02)

Last updated: 2026-07-02
Session topic: 教科書2冊 (Book A/B) の設計確定 + RT 組成論を仮説的第三柱として BZM 理論・940p 本に正式組み込み + Ch 9.5 (RT 結合機構) / Ch 37.5 (自己批判とオープンプロブレム) 新設 + skeleton ステージ2確定

詳細セッションログは `pwa/design_log/sessions_2026-07.md` の 2026-07-02 (BZM) エントリ。理論・設計・進捗の正本は下記 §ポインタ参照。

---

## 今回セッションの要旨 (3-10 行)

1. まさ依頼「MBA/学部向け教科書 (Book A) + 産連/URA/EIR/VC/研究者/新規事業担当向け解説書 (Book B) の2冊 + RT を PRS/ERS 対構造にどう組み込むか」に対して、多視点ワークフロー (9 エージェント: 6視点分析 + 3批判レビュー) と既存コーパス突合を統合してディスカッション土台を作成。まさ回答 (Q1-Q12) を踏まえ **BOOKS_PORTFOLIO.md (3冊+コーパスの L1 上位層) を新設**、PF-001〜011 を判例化。
2. **Book A = 数式全部入りの「理論の集大成テキスト」** (まさ確定: 読者配慮で数式を減らさない、380-450p 想定、共著候補=愛媛大 石原先生筆頭)。**Book B = 実戦書ドラフト17章の統合改修** (URA 案4部16章)。素材リユースは実戦書17章のみ (textbook企画・public-manuscript は「見なかったこと」に)。看板主張=出口ポートフォリオ論。
3. **RT 組成論を BZM の一級市民として組み込み確定**。理論正本 `BZSF/rt_roundtable_theory.md` を v0.2 に更新 (§13.4-13.6 = ERS接続 [ICT レンズ + 最小サブ軸 4-d/2-e/8-b] / 二重計上ガード [排他的主経路割当・take-or-pay 3分割・leave-one-out ERS₋ᵢ・帰属タグ] / 三項構造 [Ψ_j = Ψ̄ + β·ICT_j = Murmann coupling の法人化前カーネル])。940p→980p、**Ch 9.5「ラウンドテーブル — 二層を結合する組成機構」(28p) + Ch 37.5「自己批判とオープンプロブレム — 第二版への課題」(12p) を新設** (D-056)。
4. **Ch 9.5 skeleton ステージ1完了** (workflow wf_4432f1b0-6ea、3 persona × 3 lens × synth、8節28.0p、命題 9.5.1-9.5.4 + 仮説 9.5.H)。**ステージ2 (Kingpin K1-K8) まさ確定完了** (D-057、n₀=3ヶ月仮置き・Ch 26b 事前登録で凍結、Tier A 記述は金額非表記で開始)。
5. **BUILD_VERSION v0.37.3 → v0.37.4** に bump。左ナビに Ch 9.5 / Ch 37.5 を not-started 状態で登録、Book II ラベル「300p, 10章」 / Book VI「72p, 4章」に更新。build 検証済み、Vercel 自動デプロイ完了 (`edb36a65`)。
6. **terminology_glossary.md を新設** (3冊共通正本): 節参照記法規律 (「Ch 9 §9.5」) / RT 記号ブロック (ℛ, m(e), ERS₋ᵢ, n₀=3) / 乗法/加重和/補完性の3層対応表。
7. **弁護士確認は別セッションで進行中** (task_2985c953: RT 独禁法務確認 field-of-use 分割の垂直ライセンス構成の発注パッケージ作成、まさ承認済み・独立起動)。

---

## Repo 状態 (2026-07-02 20:30 JST 頃)

- `amd-os/main` origin HEAD: **`edb36a65`** feat(bzm): Ch 9.5 / Ch 37.5 を目次に登録 (D-056/D-057) + BUILD_VERSION v0.37.4
- 今日 origin/main に上がった BZM 系コミット (時系列): `1cb83f28` (ディスカッション土台) → `2d1579f2` (BOOKS_PORTFOLIO 新設) → `34a31137` (D-056 判例化 + L1 反映) → `61a35f82` (Ch 9.5 skeleton) → `d189ac6a` (D-057 + terminology_glossary) → `edb36a65` (bzm-chapters.ts 登録 + version bump)
- **ローカル `amd-os/main` の dirty state** (私は触っていない・別 worker 作業): `HANDOFF.md` / `SESSION_MIGRATION_PROMPT.md` / `gas/*` / `pwa/design/*` / `pwa/manual/*` に M 多数 (ahead 5 / behind 14)。**BZM handoff は clean worktree で作業して cherry-pick push している** — ローカル main の他 worker 作業に混ぜていない。
- BZSF リポは repo 外 (`/Users/masa/projects/AMD/BZSF/rt_roundtable_theory.md` v0.2 で保存済み、git 管理なし)。
- knowledge/ も repo 外 (`/Users/masa/projects/knowledge/members.md` に まさ役職 + 共著候補追記済み、git 管理なし)。

---

## 未解決タスク

| # | 内容 | 主担当 | 次アクション |
|---|---|---|---|
| 1 | **RT 独禁法務確認 (§7.3 field-of-use 分割の垂直ライセンス構成)** の発注パッケージ作成 → まさが法律事務所へ送付 | 別セッション (task_2985c953) 進行中 | 完了通知待ち。成果物 = `/Users/masa/projects/AMD/BZSF/RT_ANTITRUST_LEGAL_REVIEW_REQUEST_202607.md` |
| 2 | **石原先生への Book A 共著正式打診** の段取り | まさ | Book A 企画概要1枚をえいみがドラフト可 (未着手) |
| 3 | **Ch 9.5 段落 outline (ステージ3)** | えいみ | 書き順ルール (D-007 + D-056) により **Ch 10.7 の後**。現行の起草優先は Book I Ch 1 + Book II Ch 5 §5.0.1 (2026-06-28 まさ確定) を維持 |
| 4 | KENQ / SX/EWIR / VSX の匿名化方針・TIEM D-010 の A/B 適用範囲を BOOK_DECISIONS.md に判例化 | まさ | Book B RT 部の執筆前提。P-001 (機関実名) と併せて判断 |
| 5 | AMD OS 開発要件: ICT カラム (`/institutions` 独立表示) + ERS v1.1 (新サブ軸 4-d/2-e/8-b、全機関 N/A スタート) の実装 | OS 司令塔 | 実装タイミングは SX/EWIR 検証後を推奨 (BOOKS_PORTFOLIO PF-011) |
| 6 | Book B 企画書 + 目次 + サンプル2章 (実戦書の完成度が高い部分から) の Q4 作成 | えいみ | 版元打診用。着手は2026 Q4 の予定 (時間軸 §9) |
| 7 | モノグラフ英訳工程の裁定 | まさ | Q10「Fable トークン料金次第。多分そんな時間かからん」→ 実施タイミングをどこかで決める |

---

## First next action (次セッション最初にやること)

**優先順は 2 セッション条件で決まる**:

- **(A) 弁護士確認セッション (task_2985c953) が完了通知を返した場合**: その成果物を確認し、Book B RT 部の印刷ゲート (BOOKS_PORTFOLIO §6) と KENQ プロジェクトへの影響を整理する。
- **(B) 完了通知がまだ来ていない場合**: 未解決タスク #2 (石原先生 Book A 共著打診の企画概要1枚) をえいみがドラフトする。Book A の性格 (数式全部入りの理論集大成、380-450p) / 章立て / 共著者の役割分担案 / 想定スケジュール (2029年4月学期照準) を A4 1枚に。

いずれの場合も、**現行の940p本 本文起草 (Book I Ch 1 §1.0.1 + Book II Ch 5 §5.0.1) は引き続き最優先**。Ch 9.5 の本文着手は書き順ルールにより Ch 10.7 完了後まで待つ (skeleton は完成済みなので、本文起草開始時にすぐ段落 outline に入れる)。

---

## セッション開始時の必読リスト (次セッション用、順序厳守)

1. 本 HANDOFF (`pwa/bzm/HANDOFF_BZM_BOOK_2026-07-02.md`)
2. `pwa/bzm/BOOKS_PORTFOLIO.md` (3冊+コーパス L1 上位層、PF-001〜011)
3. `pwa/bzm/COMMANDER_TASKS.md` (BZM 司令塔台帳、未完タスク一覧)
4. `pwa/bzm/BOOK_MASTER_PLAN.md` (940p→980p 本 L1) + `BOOK_DECISIONS.md` (L2、特に active な D-045〜D-057)
5. `pwa/bzm/CHAPTER_9_5_SKELETON.json` + `CHAPTER_9_5_PROGRESS.md` (Ch 9.5 の骨格と進捗)
6. `pwa/bzm/terminology_glossary.md` (3冊共通用語・記号)
7. `/Users/masa/projects/AMD/BZSF/rt_roundtable_theory.md` v0.2 (RT 理論正本、特に §13 全体)
8. `pwa/design_log/sessions_2026-07.md` の 2026-07-02 (BZM) エントリ (詳細ログ)

---

## Pointers

- **設計・企画正本** (執筆設計の判例): `pwa/bzm/BOOKS_PORTFOLIO.md` / `BOOK_MASTER_PLAN.md` / `BOOK_DECISIONS.md`
- **理論正本** (数式・命題): `/Users/masa/projects/AMD/BZSF/before_zero_theory.md` (BZM全体) / `rt_roundtable_theory.md` v0.2 (RT + PRS/ERS 接続) / `pwa/design/amd_score.md` (PRS) / `pwa/design/institution_readiness.md` (ERS)
- **章単位の進捗**: `pwa/bzm/CHAPTER_9_5_PROGRESS.md` / `CHAPTER_5_PARAGRAPH_OUTLINE.md` / `CHAPTER_5_5_PARAGRAPH_OUTLINE.md`
- **用語・記号**: `pwa/bzm/terminology_glossary.md`
- **セッションログ**: `pwa/design_log/sessions_2026-07.md`
- **BUGS / 教訓**: `pwa/BUGS.md` (今日は BZM 領域で新規バグ・事故なし)
