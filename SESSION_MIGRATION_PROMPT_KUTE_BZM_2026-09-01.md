# 次セッション用プロンプト — KUTE BZM 3.0

cwdは必ず `/Users/masa/projects/AMD/amd-os`。worker worktree、Codex DesktopのLocal子タスク、Handoffは使わない。

最初にこの順で読む。

1. `/Users/masa/projects/AGENTS.common.md`
2. `AGENTS.md`
3. `HANDOFF_KUTE_BZM_2026-09-01.md`
4. `model/cases/kute_22_tier0_baseline_2026-09-01.md`
4. `pwa/manual/5-1-research-assets-vc-seeds-scholar-spec.md`
5. `pwa/spec/4-8-bzm30-seed-score-panel-current-spec.md`
6. `model/MODEL_VERSION_LEDGER.md`
7. `model/cases/README.md`
8. `model/tools/bzm30_score_seeds.cjs`

KUTEの22シーズは全件「法人化検討前・専任の事業チームなし」。無効なのは直前の `P^ind × q` による今回試算の結論・順位・金額だけ。SPSという指標名は廃止しておらず、現行SPSはBZM 3.0が算出する産業創出価値 `V` として扱う。出力列は「SPS／産業創出価値V（下限・中央値・上限）」にする。

初期状態は、技術の核 `f2` が存在することをシーズ登録の前提とし、技術確度 `ψ` は技術証拠から案件別に置く。組織機能1・3〜7は未充足から始める。`e=0.50` と `κIP=0.55` はTier 0仮置きであり、事実や市場シェアではない。SAMにSOMを掛けない。

22件の比較用再計算は `model/cases/kute_22_tier0_baseline_2026-09-01.md` に完了している。BZM入力と用途別天井がDBで揃っていたのは熱電1件のみで、残りを本番DBへ直接入力していない。表の用途別SAM、置換分、技術証拠、権利帰属を一次根拠で更新し、パラメータ別の根拠・推定・欠測を分けてまさへ提示してから、承認済みの正規routeだけで候補化・入力・再計算する。

本番DB、PJ状態、外部連絡は変更していない。正本checkoutには他作業者のdirtyがあるため、対象外ファイルに触れず、`git add .`は使わない。
