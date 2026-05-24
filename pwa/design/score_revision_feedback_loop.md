# Score Revision Feedback Loop (#21) — 設計議論 (draft)

> **状態**: まさ #21 (2026-05-24) 確定方針 + 自動修正提案ロジック追加要件。**次セッションで実装着手**。
>
> 関連: [`amd_score.md`](amd_score.md), [`cockpit.md`](cockpit.md), [`notifications.md`](notifications.md)

---

## 目的

AMD スコアの **未来予測 (= 破線)** をまさが修正したときに、なぜ修正したかの議論を保存し、全 PJ のスコアリング設計 (= `amd_score_alpha` 重み / `signal_type` 定義 / `frl` 計算式 / 等) にフィードバックする。

さらに、まさが破線を押さなくても、**つくよみが自動で「破線修正提案」を通知に送る** ロジックも併設する。

## なぜ必要か

- 破線 (= 未来予測) は AMD OS が現時点の入力データから計算した予測値だが、実情との乖離は常に発生する
- まさが修正した内容を「単発の上書き」で終わらせると、同じズレが全 PJ で再発する
- 修正パターンを集約 → alpha 重み (= 7 軸の Cobb-Douglas) を調整 → 次回からの予測が改善するループを回したい
- まさが手動で破線を見ない PJ もある → つくよみが代わりにパターン検出して提案できれば、自動で気づける

## データモデル (新規 2 テーブル)

```sql
-- migration 089 (= 次セッションで apply)

CREATE TABLE amd_score_revisions (
  revision_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         TEXT NOT NULL REFERENCES projects(project_id),
  score_input_id     UUID REFERENCES amd_score_inputs(id),
  axis               TEXT NOT NULL,            -- mu_A / mu_I / mu_G / trl / brl / grl / srl / hrl / frl_grit / frl_resilience
  old_value          NUMERIC,
  new_value          NUMERIC NOT NULL,
  evaluated_at       DATE NOT NULL,
  reason_md          TEXT NOT NULL,            -- 「なぜ修正したか」(まさ必須記入)
  discussion_md      TEXT,                     -- まさえいMTG の議論ログ (任意)
  revised_by         TEXT NOT NULL,            -- 'まさ' / 'tsukuyomi_auto' / 等
  revised_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_to_alpha   BOOL NOT NULL DEFAULT FALSE,
  alpha_proposal_id  UUID,                     -- どの proposal でアルファに反映されたか (FK to amd_score_alpha_proposals)
  source             TEXT NOT NULL DEFAULT 'manual'   -- 'manual' (まさ手動) / 'tsukuyomi_proposal' (つくよみ自動)
                     CHECK (source IN ('manual','tsukuyomi_proposal')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_score_revisions_unapplied
  ON amd_score_revisions(project_id, axis)
  WHERE applied_to_alpha = FALSE;

CREATE TABLE amd_score_alpha_proposals (
  proposal_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_period_start  DATE NOT NULL,
  analysis_period_end    DATE NOT NULL,
  pattern_summary_md     TEXT NOT NULL,        -- LLM 抽出した修正パターン
  proposed_alpha_diff    JSONB NOT NULL,       -- 例: { mu_A: { old: 0.18, new: 0.15 }, ... }
  reasoning_md           TEXT NOT NULL,        -- 推奨理由
  status                 TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','approved','rejected')),
  applied_revisions_count INT NOT NULL DEFAULT 0,
  approved_by            TEXT,
  approved_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## フロー

### 経路 A: まさが破線ドットを修正する

```
[まさがAMDスコアグラフの未来 (破線) ドットをクリック]
  → AmdScoreFutureEditModal が開く
  → 修正値入力 + reason_md (必須) + discussion_md (任意)
[保存]
  → amd_score_inputs.update (= 既存)
  → amd_score_revisions.insert (source='manual')
  → l2_notifications に「○○ 未来予測修正、alpha レビュー候補」を admin に通知
```

### 経路 B: つくよみが自動で修正提案する (= まさ追加要件)

```
[毎日 cron: cron/amd-score-auto-revision-propose]
  → 各 PJ の amd_score_inputs を取得
  → 直近の 5 生データ抽出結果 (= monthly_reports / meeting_summaries / project_strategy_signals) を Sonnet に渡す
  → 「現在の入力値が実態とズレているか」を LLM が判定
  → ズレがあれば amd_score_revisions に insert (source='tsukuyomi_proposal', applied_to_alpha=false)
    + l2_notifications に l2_kind='score_revision_proposal' で通知
[まさが /notifications で「はい」]
  → revision を確定 (= amd_score_inputs.update)
[まさが「いいえ」]
  → revision を archived
```

### 経路 C: 週次 alpha レビュー

```
[週次 cron: cron/amd-score-revision-review (= 月曜 03:00 JST)]
  → 直近 7 日の amd_score_revisions (= applied_to_alpha=false) を集約
  → Sonnet が「修正パターン」を抽出 (例: 「全PJで mu_A が高めに見積もられる傾向」「FRL_resilience の評価が甘い」)
  → amd_score_alpha_proposals.insert (status='pending')
  → l2_notifications で admin に「alpha 修正提案あり」
[/admin/amd-score-alpha-review (新画面) で proposal を review]
  → approve → amd_score_alpha に新 row (= 既存 alpha versioning)
  → 関連 revisions を applied_to_alpha=true に
  → l2_notifications で全PJ に「AMD Score 計算式が更新されました」
```

## UI

- **AmdScoreFutureEditModal (新規)**: 破線ドットクリックで開く。axis 選択 + new value + reason_md + discussion_md
- **CockpitVentureStatus の破線ドット**: 透明 hit area (= r=20 円) を追加してクリック範囲を拡大 (= #20 まさ指摘で「クリック範囲が狭すぎる」)
- **/admin/amd-score-alpha-review (新画面)**: pending proposals を表示、approve/reject ボタン

## LLM プロンプト概要

```
あなたは AMD OS のスコアリング設計担当。

過去 N 日の各 PJ 未来予測修正リスト:
- [{project_id, axis, old, new, reason, evaluated_at}, ...]

これらを分析して:

## 修正パターン
- パターン 1: ...

## alpha 推奨修正
- alpha.mu_A: 0.18 → 0.15 (= 学術評価が高く出る傾向、減重 by 16%)

## reasoning
...
```

## まさ × えいみMTG での議論

- まさえいMTG セッションで「最近の修正パターン」を Sonnet に質問 → 議論 → alpha 微調整の判断
- alpha 修正後の数ヶ月で「修正頻度が下がったか」を tracking (= dashboard で見える化)
- 修正パターンに偏りがあれば signal_type 定義 / FRL 計算式自体の見直しを提案 (= 構造変更レベル)

## 残設計事項 (次セッションで確定)

- AmdScoreFutureEditModal の UI 詳細 (= axis ごとの input、現在値プレビュー、変更影響シミュレーション)
- つくよみ自動修正提案の判定ロジック (= Sonnet prompt 詳細、確信度しきい値、提案頻度制御)
- alpha 修正の影響シミュレーション UI (= 「この修正を反映したら全 PJ のスコアがどう変わるか」プレビュー)
- 修正パターンの dashboard 化 (= /admin/amd-score-alpha-review に「修正頻度推移」「軸別ズレヒートマップ」等)
