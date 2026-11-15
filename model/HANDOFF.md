# HANDOFF — モデル層（BZM 3.0）

- 更新: 2026-11-15 JST
- 作業種別: development（参照実装・正本の改訂）＋ モデル入力の調査
- 注意: リポジトリ直下の `HANDOFF.md` は別の作業（請求書の立替税率）の引き継ぎなので、**モデル層の引き継ぎはこのファイル**に置く
- 対象セッション: 2026-08-26〜27。その後 2026-08-29〜11-11 に別セッションが大きく進めている（下の「現在地」）

## このセッションでやったこと（2026-08-26〜27）

- 承認 #2026-08-26-1（M1〜M3、K1・K2・K5・K7・K8、係数 v3）と #2026-08-27-1（N1 撤退の四経路、N2 経済性の乗数）を正本 §5・§6.I・§7 へ反映
- 参照実装 `model/tools/bzm30_forward.cjs` に、案件ごとの観測状態の入力口と、N1・N2 を実装
- 9件の天井と観測状態を手作業で調べて算出した（`model/cases/`）。**OS の生データを使っていなかったため、まさから「OSの情報が一切使われていない」と指摘された**。のちに OS 内の自動算出（`seed_bzm30_inputs`・`seed_bzm30_scores`）へ置き換わった
- 計算バグ2件（補間の質量増幅・休眠中の資本自立の誤判定）を修正（`pwa/BUGS.md` に記録）
- 詳細: `pwa/design_log/sessions_2026-08.md` の「2026-08-26〜27 BZM 3.0 参照実装に…」

## 現在地（2026-11-15 に正本と突き合わせて確認した範囲）

| 項目 | 現在の状態 | 確認元 |
|---|---|---|
| 休眠（会社化前の資金切れ） | 「前進の速さを資金で変える」定義へ書き直して承認済み。さらに 2026-11-11 に「資金がほぼ無いあいだの前進をゲートの種類で分ける」へ改め、Q34（0.35）を廃止 | `model/APPROVALS.md` #2026-08-29-1・#2026-11-11-1 |
| 反実仮想の控除（α） | 2026-09-02 にモデルから外した。同じシーズの2社はそれぞれ満額で数える | #2026-09-02-1、ledger §3 |
| 置き換え分 δ | 残す（#2026-09-02-1 §2） | 同上 |
| スコアの算出 | OS が自動で行う。シーズ一覧・シーズ詳細（`/seeds`）と DB `seed_bzm30_scores`。最新の再計算は 2026-11-11 の42件 | `model/cases/SCORES.md`、`pwa/spec/4-8-bzm30-seed-score-panel-current-spec.md` |
| 撤退の割合を主要指標に並べない | §5.8 に明記済み | ledger §5.8 |

## まさ判断待ち（`model/proposals/` の未承認。2026-11-15 に状態行を読んで確認）

- `2026-09-04_bzm30-multi-use-case-aggregation.md` — 複数の用途の市場を足すことを正本へ書く（このセッションの近似 A16「用途を1本に畳む」の解消にあたる）
- `2026-09-02_bzm30-stage-reg-and-a16.md`、`2026-09-02_approval-coverage.md`
- `2026-11-02_strategic-resource-value-yen.md`、`2026-11-03_sol-strategic-resource-comparison.md`、`2026-11-03_strategic-resource-theory.md`
- `2026-11-10_killer-factor-validation-protocol.md`
- `2026-10-03_textbook-canon-issues.md`、`2026-10-18_textbook-v04-canon-issues.md`（教科書側から見つかった正本の食い違いの一覧）

## 未解決・未確認

1. `pwa/spec/5-12-bzm30-auto-scoring-plan.md` は `spec-chapters.ts` に登録されていないので、OS の仕様ページに出ない。実装済みの経緯なので、登録するか 4-8 へ畳むか決める（未実施）
2. 参照実装の検査に「9区分の確率の合計が 1」を入れる（`pwa/BUGS.md` の再発防止策。未実施）
3. 付加価値率 0.35（暫定）の産業連関表からの引き直し、較正（共通倍率）の取り直しが現在までに済んだか: **未確認**
4. 作業ツリーの未コミット `pwa/src/components/question-tree/question-tree.module.css` は別セッションの変更。触らない

## 次の最初の作業

1. `git fetch --all --prune` → `git log --oneline -15` → `git status -sb`（常時5〜10セッションが並行）
2. モデルページ `/model`（読み込み元 `model/MODEL_VERSION_LEDGER.md`）を先に読み、`node pwa/scripts/model_lock.cjs check` が緑か確認
3. 上の「まさ判断待ち」のうち、近似 A16 に関わる 09-04 の提案を、現在の正本（§5.7・§5.8）と突き合わせて、まさへ判断を求める文面にする

## 参照先

- 正本: `/model`（§5 BZM 3.0 の定義、§6 運用一式、§6.I 係数、§7 較正の台帳、§10 参考文献）
- 承認: `model/APPROVALS.md`（最新 #2026-11-11-1）／規約: `model/README.md`
- 案件ごとの入力と一覧: `model/cases/`（`SCORES.md`、`INVENTORY.md`）
- 画面仕様: `pwa/spec/4-8-bzm30-seed-score-panel-current-spec.md`、`pwa/spec/5-11-model-canon-page-current-spec.md`
- 開発履歴: `pwa/design_log/sessions_2026-08.md` ほか／バグ: `pwa/BUGS.md`

## 検証手順

```
node pwa/scripts/model_lock.cjs check
node model/tools/bzm30_forward.cjs degen   # 縮退検査（約20分）
node model/tools/bzm30_forward.cjs conv    # 格子の収束検査
```

実行状況: この closeout では `model_lock.cjs check` を commit の hook 経由で実行（結果は commit 時に確認）。`degen`・`conv` は 2026-11-11 の別セッションが取り直したもので、このセッションでは再実行していない（**未確認**）。
