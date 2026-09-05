# HANDOFF — BZM 3.0 教科書（出版前提の並列起草）

最終更新: 2026-09-05 17:00 JST
仕事の種別: 非開発（理論教科書の執筆）。`design_log/` は触っていない。制作正本は `BZM_3_0_TEXTBOOK_PLAN.md`。

## 今回のセッションでやったこと

- まさ「現状の BZM 3.0 をテキストブックに落とし込んで、出版前提で準備。各章を並列で一気に」。
- 正本（モデルページ本文 `model/MODEL_VERSION_LEDGER.md` 全2,116行）、出版計画（`BOOKS_PORTFOLIO.md`、`BOOK_A_PUBLISHING_PLAN.md`）、既存 BZM 2.2 教科書の体裁、執筆規範2本を通読。
- **制作正本 `bzm/BZM_3_0_TEXTBOOK_PLAN.md` を新設**: 16ファイル（序＋第1〜14章＋付録）の章構成、各章が写す正本の節、出版前提の規律（である調、数式全部入り、匿名化表、理論に忠実、係数は較正前の初期値と明記）、`/bzm` への登録手順、出版準備への接続。
- 16本のワーカー（fable）を並列起動。**セッションのトークン上限（429、20:10 JST リセット）で全ワーカーが途中停止**。
- 書き切れた章: **第1章 `bzm-3-0-textbook-industrial-value.md`（約33,000字）、第2章 `bzm-3-0-textbook-observed-state.md`（約38,000字）**。どちらも演習・次に読むもの・執筆メモまで完成。
- 未着手: 序、第3〜14章、付録（14ファイル）。

## リポジトリの状態

- branch `main`。今回の対象6ファイル（PLAN、第1章、第2章、この HANDOFF、引っ越しプロンプト、附則1行）を commit・push（SHA は commit 後に追記）。
- 共有 checkout の他セッター dirty（`bzm/PAPER_P1_*`、`bzm/sm_v2/*`、`bzm/AUDIT_*`、`pwa/spec/*`・`pwa/manual/*` の L2 関連、`pwa/design_log/sessions_2026-08.md`、`pwa/scripts/_support_programs_screenshot.mjs`）は触っていない。
- `bzm-chapters.ts` は未変更（全章が揃ってから1回で登録し、Vercel build を1回に束ねる）。本番 `/bzm` の左ナビにはまだ出ない。slug 直打ちでは読める（未確認）。

## 未解決

1. 残り14ファイルの起草（引っ越しプロンプト §次タスク 1）。
2. 正本との整合検査と禁止語検査（同 2）。第1・2章の執筆メモに、正本側の記述の曖昧さが計14件残っている（例: 9区分の「ピボット」と撤退の四経路①用途転換の対応、間接経費率30%の根拠レベル未記載、「資金がほぼ無い」の閾値未定義）。教科書側では正本の文言に留めてあるが、正本を改善するなら `model/proposals/` へ。
3. `/bzm` への登録と本番反映（同 3）。
4. 出版準備の次の段（同 4）。仮題、Book A との関係（旧9軸の章を 3.0 へ差し替えるか）はまさの判断事項。

## 次セッションの最初の一手

`bzm/SESSION_MIGRATION_PROMPT_BZM30_TEXTBOOK_2026-09-05.md` を起動文にして、第3〜6章のワーカー4本から回す（上限に当たったら本数を絞る）。

## 参照先

- 制作正本: `bzm/BZM_3_0_TEXTBOOK_PLAN.md`
- モデル正本: `model/MODEL_VERSION_LEDGER.md`（正本はモデルページ `/model`。md は読み込み元）
- 出版判例: `bzm/BOOKS_PORTFOLIO.md` §2、出版実務: `bzm/BOOK_A_PUBLISHING_PLAN.md`
- 事故記録: `pwa/BUGS.md` `[git/multi-session]`
