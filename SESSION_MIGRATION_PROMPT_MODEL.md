cd /Users/masa/projects/AMD/amd-os

（このファイルはモデル層専用。並行セッションが使う SESSION_MIGRATION_PROMPT.md / _SPS.md とは別物なので上書きしないこと）

## 読む順
1. /Users/masa/projects/AGENTS.common.md — えいみ共通ルールの正本
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md — AMD 横断 memory
3. /Users/masa/.claude/projects/-Users-masa-projects-AMD-amd-os/memory/MEMORY.md — このPJ専用 memory
4. HANDOFF.md — 現在地と次の一手
5. **OS のモデルページ `/model`（正本）**。読み込み元は model/MODEL_VERSION_LEDGER.md。
   §5 が BZM 3.0 の全定義、§6 が運用一式（様式4点＋値3つ）。まさには「モデルページ」と呼ぶ
6. model/APPROVALS.md — まさの承認記録（#2026-08-24-13 まで）
7. model/README.md — 変更の運用規約。(a-2) が 2026-08-24 の設計変更（正本はモデルページ本体に一本化）
8. pwa/design_log/sessions_2026-08.md の 2026-08-24 節 — 経緯と教訓

## 状態
- branch は main のみ、origin と同期。ロックは12件（model_lock.cjs check が緑）。
  未コミットは他セッションの pwa/scheduled-tasks/.../SKILL.md のみ（触らない）
- 共有 checkout に常時5〜10セッション並行。着手前に git fetch --all --prune → git log --oneline -15 → git status -sb。
  衝突したら rebase ではなく merge（他セッションの未保存ファイルを stash しないため）
- /model は admin 限定で本番稼働中。ページ下部の「すべての式・すべての記号」は旧 BZM 2.2 系列（画面に札あり）
- 手順1〜4（目的・要件・既存理論・模型）と運用一式 第一便は完了・採用済み

## 次のタスク: active PJ のスコアを BZM 3.0 で更新する

まさの指示（2026-08-24）: 「そしたら次セッションに引っ越して、まずは active PJ のスコアを3.0に更新していこう」。

現行スコアは旧 SPS（model_version = sps-ind-tier0-v1、11要因ルーブリックの判断帯）。DB の在処は
`seed_screening_bands`（sps_lower_yen / sps_upper_yen / model_version / q_ruleset_version / frozen）で、
PJ との対応は `seed_projects`（seed_id ↔ project_id）→ `projects`。Supabase project_id は nbnhrhybjslbawdukvvk。

対象（現行 SPS。単位は億円）:
| PJ | 下限〜上限 | 評価日 |
|---|---|---|
| p07 LST | 5.0〜140 | 2026-08-17 |
| p21 SX | 4.5〜90 | 2026-08-17 |
| p06 CTB | 1.0〜50 | 2026-08-17 |
| p20 CX | 0.7〜30 | 2026-08-17 |
| p24 CLG | 0.2〜15 | 2026-08-17 |
| p29 KENQ（sales） | 0.04〜9.0 | 2026-08-17 |
| p10 SE | 0.02〜4.5 | 2026-08-20 |
| p02 r3kt（frozen） | 0.05〜4.5 | 2026-08-20 |
| p26 VasculaX | 0.03〜2.5 | 2026-08-17 |
スコア未算定の active PJ: p19 ZMP・p25 KUTE・p28 NIMS・p30 EHM（p00 AMD は会社自身なので対象外）。

**先に決めることがある。** BZM 3.0 は係数の分野別初期値が未確定で、そのままでは計算できない:
κ_g（ゲートの基準速度）・d_f（空席の遅延。d_e 最大のみ制約、他の順位は較正の出力）・φ（採択）・ν（申し出到来）・
β（承認解決）・λ（消失）・γ（受託の本業との近さ区分。同源は0）・L_u（前倒し期間）・λ^obs（陳腐化。初期値5%）・
M2/M3 の失効期間（18/24か月・12か月）。

進め方:
1. 係数の分野別初期値を設計 → 5属性の批判監査 → まさへ**完成案の採否だけ**を仰ぐ
2. 各 PJ の観測状態（ゲート位置・資金の残高・権利と学内承認の残件・会社化の有無・受託契約・稼働用途・履歴）と
   案件パラメータを、§6.C の登録簿の様式で埋める。材料は AMD OS の各 PJ コックピット・接触台帳・bzm/ の既存評価台帳
3. 計画規則を §6.D の様式で登録（未登録なら工程の型 F1〜F4 × 規制属性 REG-0〜2 の既定）
4. スコアと導出量（到達曲線 Q(h)・会社化の早すぎ遅すぎの診断・次に集めるべき情報・継続価値の比率）を算出。
   割引率の感度（1%・4%）と g* の1段感度も併記する規約
5. 旧 SPS との差を並べてまさへ提示（平易に。詰め込まない）
6. DB への反映の設計（新しい model_version の付与・旧版の退役・latest-only 統治との整合）

## 守る運用ルール（このPJで確立済み）
- **正本はモデルページ本体ただ一つ。** モデルの定義・式・値は model/MODEL_VERSION_LEDGER.md に書く。
  別ファイルへ切り出して本文からリンクしない（2026-08-24 の事故: リンク先だけが新しくなり本体が6時間半古いままになった）
- **同じ定義を二か所に書かない。** model/proposals/ は提案中のものだけ。承認したら本体へ統合しスタブ化。
  ロックに model/proposals/ を入れない（model_lock.cjs check が落とす）
- **比喩・ぼかした表現を使わない**（まさ 2026-08-24「ぼかした表現、比喩的な表現は一切しないで」）。
  案件パラメータ／観測状態／資金／バーンレート／シナリオ／ステージゲート／事前分布／評価期間／資金調達の機会／確定した期限。
  「帯」は使わない（全パラメータが幅を持つのは前提）。記号と期間はその場で定義する
- モデルページにはまさが合意した内容だけ。根拠は [根拠](#evidence "…") の印（本文に引用を書かない。印の中で " を使わない）
- 「Aではない」を正本に書かない。「採らない主張」に載せるのはまさが棄却した候補だけ
- 自明なことを質問しない。まさに聞くのは要件の意味と価値基準だけ。理論・数理・文書の書き方はえいみが確定し、監査を通してから採否を仰ぐ
- 監査は5属性（経営学者・経済学者・DTSU 経営者・VC・大学産連本部長）。学術2体は重いモデル、実務3体は軽いモデル。
  「解決した」という体裁の誇張は閉包検証で必ず突かれるので、対応表は正確に書く
- 正本を変えるには: 提案を model/proposals/ へ → まさへ本文で提示 → 承認の発言を model/APPROVALS.md へ引用つきで記録 →
  モデルページ本体を変更 → node pwa/scripts/model_lock.cjs relock --approval <id> → 同じ commit で bzm/9-5-appendix-changelog.md に1行
- git add はパスを名指しし、stage と commit は1コマンドにまとめる。他セッションへメッセージを送らない

## 検証手順
cd /Users/masa/projects/AMD/amd-os && node pwa/scripts/model_lock.cjs check
cd pwa && npx tsc --noEmit && npm run test:critical-ui && npm run test:model-formula-canon

本番反映は main への push（Vercel Git 自動 deploy）。
