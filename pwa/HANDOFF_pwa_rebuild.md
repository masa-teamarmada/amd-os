# HANDOFF — AMD OS PWA

次セッションが文脈を聞き直さずに再開できる **直近の引き継ぎだけ** をここに書く。

- 仕様 → `SPEC_pwa.md`
- バグ・教訓 (症状/原因/解決策/教訓) → `BUGS.md`
- 過去セッションの作業ログ → `design_log/sessions_YYYY-MM.md`
- 共通運用ルール → リポ root の `CLAUDE.md`、PWA 確認方針 → `pwa/AGENTS.md`

このファイルが 200 行を超えそうになったら、過去セッションを `design_log/sessions_YYYY-MM.md` へ切り出してスリム化する。

---

## 最終更新

2026-05-07 — AMD Score 周りの 8 改修 (XRL 5 軸 / FRL ALQ / KaTeX / つくよみ tools 拡張 / 添付対応 etc)

---

## 直近セッション要約 (4 phase に分けて連続 deploy)

### Phase A — 軽量 UX 修正
- (3) project_xrl_log に grl/srl 列追加 (migration 014)、cockpit XRL グラフを TRL/BRL/GRL/SRL/HRL の 5 軸に拡張
- (4) cockpit AMD スコアグラフ + AMD Score 経時 chart に AMD 支援期間 (amd_support_started_at - ended_at) を背景帯で明示
- (7) CockpitAmdScoreBreakdownModal を KaTeX で数式描画 + XRL を集約表記に変更
- (8) AmdScoreView ヘッダに「↩ <PJ名> のコックピットに戻る」リンク追加

### Phase B — FRL 構造化評価 + XRL 次レベル進捗
- (2) migration 015: amd_score_inputs に Walumbwa 2008 ALQ 4 次元 (alq_self_awareness/relational_transparency/balanced_processing/internalized_moral) + frl_notes を追加
- AmdScoreView に FrlAlqPanel: 4 軸ミニレーダー + スライダー + 自由備考 + 自動算出 (ALQ 平均) ⇄ 手動 FRL 切替
- 「FRL 学術定義から見て ALQ + 備考だけでは何が足りないか」を展開可能セクションで明示 (360° / Founder Quality / Founder Experience / Achievement Motivation / Psychological Safety / 動的観測 / Founder Network 効果 が不足)
- 新 lib `xrl-level-definitions.ts`: 内閣府 SIP 9 段階定義 (TRL/BRL/GRL/SRL/HRL 各 9 レベル) を網羅
- CockpitXrlDetailModal に NextLevelProgress: 現 Lv → 次 Lv の説明 + 進捗 % + exit_criteria 明示

### Phase C — つくよみチャットに AMD Score 認識 + L2 入力 tool 群
- (1)+(5) system prompt に AMD Score の数式 / フェーズ / FRL ALQ 構造を明記
- ProjectContext に amd_score (latest_input + 計算済 score + phase + bottleneck + alpha) と xrl_next_levels (5 軸の現/次 Lv + 進捗 % + exit_criteria) を含める
- 新 tool 群:
  - `update_amd_score_input`: μ_A/I/G + 5 XRL + FRL/ALQ + frl_notes upsert (部分上書き)
  - `update_amd_score_alpha`: 重み α 新版保存 (前版を close)
  - `add_xrl_observation`: project_xrl_log 追加 (5 軸対応)
  - `record_xrl_feedback`: 5 軸対応
  - `add_project_event`: 沿革駆動イベント (hire/funding/deal/tech_progress/governance/note)
  - `add_project_member`: メンバー追加
  - `add_project_partner`: 事業会社追加
  - `add_pl_monthly`: 月次試算表 upsert
- system prompt に「L2 情報を貼られたら分類して複数 tool 並行呼び出し」例

### Phase D — つくよみチャットに添付サポート
- (6) TsukuyomiChatDrawer: 📎 添付ボタン + ドラッグ&ドロップ (画像 / PDF / テキスト最大 5 ファイル × 8MB)
- API: 添付を Anthropic content blocks (image / document / text) に変換して Sonnet に渡す
- tsukuyomi_chat_logs に添付ファイル名 metadata を保存

---

## リポ状態

- 作業 worktree: `/Users/masa/projects/AMD/amd-os/.claude/worktrees/blissful-kepler-9e95b0`
- 作業 branch: `claude/blissful-kepler-9e95b0` (main にも順次 merge + push 済)
- main HEAD: AMD Score 改修 4 phase が乗っている
- 本番デプロイ: `https://amd-os-pwa.vercel.app` (Phase A→B→C→D 順次 deploy 済)
- migrations: 013 (amd_score), 014 (project_xrl_log grl/srl), 015 (amd_score_inputs alq) 全て本番適用済

---

## 未解決タスク

### 設計層 (まさの判断待ち)

- **PWA `/project/[projectId]/config` ページ新規作成** (前 commit `5b3c1a9` の暫定リンクの正式化) — GAS `226_ProjectConfig.html` を PWA 移植する
- **AMD Score 期待値とのズレ**: 一部 PJ で seed の μ 値が §8 表より低めに出ている件。まさが UI スライダーで PJ ごとに合わせる方針 (もしくは tsukuyomi に L2 情報渡して update_amd_score_input してもらう)
- **Shallow Tech モードの重み再分配** (理論 §11.3): TRL=1.0 を BRL/HRL に再分配して K=1.0 にする案
- **σ_SU を /venture-map/state-space と連携**: 現状は手動入力 μ_A/μ_I/μ_G、本来は Triple Helix 状態空間モデル推定値を pull すべき
- Timeline 3D 拡張、Venture Map 数式モデル深化

### 実装層

- データ駆動 α 推定 (9 PJ 階層 Bayesian)
- VC valuation との比較ビュー (理論 §10)
- AMD Score の cron 自動更新 (atlas signal が来たら関連 PJ の σ_SU を再評価)
- FRL の 360° feedback 取り込み (現状 ALQ 自己申告のみ)

中長期 TODO は `SPEC_pwa.md` の「10. 既知の TODO / 未着手」。

---

## 次セッションの最初の一手

1. リポ状態 4 ステップ (`git fetch --all --prune` → `git log --branches --not --remotes --oneline` → `git branch -a` → `git status -s`)
2. **`design_log/2026-05_amd_score.md`** と **`design_log/2026-05_pj_status_cockpit.md`** を読む (両方とも冒頭に「既存 UI を勝手に消すな」ルール)
3. `SPEC_pwa.md` で全体像、`BUGS.md` で過去事故を確認
4. 本番 (`https://amd-os-pwa.vercel.app/venture-map/amd-score`) でまさが触ってフィードバック → tune
5. 候補 (まさに優先確認):
   a. **GAS `gas/226_ProjectConfig.html` 移植** → `/project/[projectId]/config` ページ新規作成 (CockpitHeader リンク先を直す)
   b. **AMD Score / FRL ALQ / 添付つくよみチャット** の本番触ってもらってフィードバック
   c. AMD Score の cron 化 (atlas signal → σ_SU 自動更新)
   d. その他
6. **PWA は常に本番で確認** (`pwa/AGENTS.md`)。tsc 通ったら commit → push → main merge → `npx vercel --prod --yes --cwd /Users/masa/projects/AMD/amd-os` まで一気に通す
