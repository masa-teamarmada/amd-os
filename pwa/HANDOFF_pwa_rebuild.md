# HANDOFF — AMD OS PWA

次セッションが文脈を聞き直さずに再開できる **直近の引き継ぎだけ** をここに書く。

- 仕様 → `SPEC_pwa.md`
- バグ・教訓 (症状/原因/解決策/教訓) → `BUGS.md`
- 過去セッションの作業ログ → `design_log/sessions_YYYY-MM.md`
- 共通運用ルール → リポ root の `CLAUDE.md`、PWA 確認方針 → `pwa/AGENTS.md`

このファイルが 200 行を超えそうになったら、過去セッションを `design_log/sessions_YYYY-MM.md` へ切り出してスリム化する。

---

## 最終更新

2026-05-06 — PJ Status コックピット拡張 (6 phase) + マスコットチャット永続化 + config リンク事故修正

---

## 直近セッション要約

`/project/[projectId]/cockpit` の上部に SU 系 PJ 用の **PJ Status セクション** を追加した。設計は `pwa/design_log/2026-05_pj_status_cockpit.md` に集約 (構造図・モーダル一覧・データモデル・API・cron・学習ループ・反省事項)。

主な変更:

- migration 008-012 適用 (本番): `project_ventures` / `project_xrl_log` / `project_events` / `project_venture_members` / `project_partners` / `project_pl_monthly` / `project_pl_hearings` / `narrative_feedbacks` / `xrl_feedbacks` / `tsukuyomi_learnings_status` / `tsukuyomi_chat_logs`
- ボタン群: 沿革 (リスト形式 + 修正依頼 ✏ → 即時 Gemini 再生成 + Sonnet lesson 抽出) / メンバー (member_kind: amd_internal/su_internal/support_org) / 事業会社 (collab/customer) / 月次試算表 (縦横ピボット + つくよみヒアリングモード) / 事業概要詳細 (つくよみマージ + Anthropic web_search)
- AMD スコア: chip クリックで内訳モーダル (現状ダミー、`Before Zero Theory v3.x` 確定待ち)
- XRL: 各軸ドット個別クリックで軸別詳細 + Gemini 修正、`source_note` を `{trl/brl/hrl_reason}` JSON で保存、情報不足な軸は「情報不足」と明示
- 右下マスコット: クリックで吹き出し風小ウィンドウ → Sonnet が画面 context 込みで会話 + tool 修正 + localStorage 永続化
- /admin/tsukuyomi: 日時 JST 固定、`tsukuyomi_learnings_status` を memory layer に統合 (source=`pj_status:<...>`)
- イベント kind: 「採用」→「人事」、「技術進捗」追加、@メンション機能、ゾンビ化/中小企業化 outcome 追加
- 終了 PJ で月次ルーティン非表示

詳細: `design_log/sessions_2026-05.md` の 2026-05-06 (cool-booth-b72d09) セクション。

### 反省 (詳細は BUGS.md)

`CockpitHeader` に独断で `⚙️ config` リンク (`/admin/projects` 行き) を追加してまさに却下された。「過去にあったリンクの復活」を git history 確認せず推測実装した結果。最後にロールバック済。教訓は BUGS.md に記載。

---

## リポ状態

- 作業 worktree: `/Users/masa/projects/AMD/amd-os/.claude/worktrees/cool-booth-b72d09`
- 作業 branch: `claude/cool-booth-b72d09` (main にも順次 merge + push 済)
- main HEAD: `81aae77` (これから最後の commit が乗る)
- 本番デプロイ: 最新 `https://amd-os-pwa.vercel.app` (毎 commit ごとに deploy 済)
- 未 commit (このセッション末尾分): 後述「次の一手」で commit + deploy する予定
- uncommitted (まさの作業 — **触らない**): main checkout 側に `?? design_log/` `?? tsukuyomi-sheet.png` 等あり

---

## 未解決タスク

### 設計層 (まさの判断待ち)

- **AMD スコアの正本式**: `Before Zero Theory v3.x` で別セッション議論中。確定したら `pwa/src/lib/venture-status-data.ts` の `computeAmdScoreSeries` / `computeAmdScoreBreakdown` を差し替え
- **コックピットの "config" リンクの飛び先**: 過去にあったとまさが言うが git 履歴では特定不能。次セッションで「飛び先 = どのページか」を聞いて、`CockpitHeader` に再追加する
- Timeline 3D 拡張 (前 session の継続): スコア式正本化、過去 22 PJ への拡張、AMD 参画期間の正確化、Bloom postprocessing
- Venture Map モデル: 数式モデルの未解決論点 5 点 (`design_log/2026-05_venture_map_model.md`)、競合密度 / 予算データ未投入

### 実装層

- マスコットチャット会話の永続化は localStorage で実装済だが、「同一 session 内で別 PJ に移動したら別キーで保存される」設計。意図通りか、それとも session ID 単位でグローバル保存にすべきかは要確認
- XRL の axis 別 reason は今後の cron / xrl-revise から JSON 形式で書かれるが、既存の plain text source_note (旧形式) の PJ もある。次回 cron で全部上書きされるまでは「旧形式」フォールバック表示

中長期 TODO は `SPEC_pwa.md` の「10. 既知の TODO / 未着手」。

---

## 次セッションの最初の一手

1. リポ状態 4 ステップ (`git fetch --all --prune` → `git log --branches --not --remotes --oneline` → `git branch -a` → `git status -s`)
2. **`design_log/2026-05_pj_status_cockpit.md` を読む** (PJ Status コックピットの設計正本、冒頭に「既存 UI を勝手に消すな」のルール)
3. `SPEC_pwa.md` で全体像、`BUGS.md` で 2026-05-06 の config 事故を確認
4. まさに「config リンクの本来の飛び先」を確認 → 確認できたら `CockpitHeader` に追加
5. **PWA は常に本番で確認** (`pwa/AGENTS.md` 参照)。tsc 通ったら commit → push → main merge → `npx vercel --prod --yes --cwd /Users/masa/projects/AMD/amd-os` まで一気に通す
