# SESSION_MIGRATION_PROMPT

最終更新: 2026-08-23 JST / 前セッション: モデル層 `/model` の新設と、BZM/SPS の目的・要件の再構築

---

cwd: /Users/masa/projects/AMD/amd-os

## 読む順

1. `/Users/masa/projects/AGENTS.common.md` — えいみ共通ルールの正本
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md` — AMD level memory
3. `HANDOFF.md` — 現在地と次の一手
4. **`model/MODEL_VERSION_LEDGER.md`** — モデルの目的と要件（今回の主戦場。OS では `/model`）
5. `model/APPROVALS.md` — まさの承認記録。**モデル正本を変えるには、ここに承認を記録してから relock する**
6. `model/README.md` — モデル変更の運用規約
7. `bzm/sps-current-domain-definition.md` §1〜§6 — 理論の目的・対象領域・中心命題・分業の出典
8. `pwa/BUGS.md` の 2026-08-22〜23 節 — 今回の事故5件（フックの設計ミス、commit 巻き込み、目的の逆算）
9. `pwa/design_log/sessions_2026-08.md` の 2026-08-22〜23 節 — 実装の詳細

## 状態スナップショット

- branch は `main` のみ。直近の自セッション commit は `1aae0483`、push 済み、作業ツリー clean。
- **共有 checkout に常時5〜10セッションが並行する。** 着手前に `git fetch --all --prune` →
  `git log --oneline -15` → `git status -sb`。
- `/model` は admin 限定で本番稼働中。画面は `model/MODEL_VERSION_LEDGER.md` をそのまま描画する。
- モデル正本12件は `model/LOCK.json` でロック済み。critical-ui guard / `.githooks/pre-commit` /
  Claude Code の PreToolUse hook（`~/.claude/hooks/guard_model_canon.py`）の3層で検査する。
- 提案 `model/proposals/2026-08-22_sps-propulsion-and-slack.md` は**未承認**。正本には入っていない。

## 次のタスク

**要件の議論を続ける。** まさが確定させた順序は次のとおりで、いまは 2 の途中。

1. この理論で何を見ようとしているか（目的）← 確定済み（3件）
2. **それを見るために考慮すべき要素（要件）← いまここ。9件確定、2件議論中、未判断の候補が複数**
3. モデル化するための既存理論を論文から持ってくる（巨人の肩）
4. 既存理論で足りない部分だけを作る

まさの原文（2026-08-22）:
> これ一度さ、おれがこのモデルで何を見ようとしていて、それを見るためにどういう要素を考慮しなきゃ
> いけないかをまとめたうえで、それをモデル化するために必要な過去の理論を論文からもってきて、
> それだけでは足りない部分だけを作っていく、という順番にしないとダメじゃね？

> 新しい理論というのは、「巨人の肩」の上につくるべきものであって、何の土台もなしに作ったら誰も信用しないよ。

議論中の2件と未判断の候補は `HANDOFF.md` の「未解決」にある。まさへ順に問い、
**まさが合意したものだけ**を `/model` へ書く。

## このPJで確立済みの運用ルール（守らないと事故る）

- **`/model` にはまさが合意した内容だけを書く。** 正本 md から抽出した内容であっても、合意を経ていない
  ものは置かない。表示物を足すときは、先に `model/APPROVALS.md` へ承認を記録する。
- **モデル正本を変えるには**: 提案を `model/proposals/` へ書く → まさへ本文で提示 → 承認の発言を
  `model/APPROVALS.md` へ引用つきで記録 → 正本を変更 → `node pwa/scripts/model_lock.cjs relock --approval <id>`
  → 同じ commit で `bzm/9-5-appendix-changelog.md` に1行。迂回フラグは無い。
- **要件が固まる前に式を作らない。** 作業の都合から要素を逆算しない。前セッションはこれで2回差し戻された。
- **えいみが「現行」と呼んでいた11要因ルーブリックは正本ではない**（参考情報）。要素の設計はゼロベースでやる。
- **数式やパラメータを出すときは、記号の意味を毎回書く**（まさ「全部覚えられない」）。数式は独立行の `$$` ブロックのみ。
- **判断をまさへ丸投げしない。** まさが持つのは事業の要件と価値基準だけ。数理設計・測定方法・実装方式は
  えいみが負い、二重批判監査を通してから完成案の採否だけを仰ぐ。
- **`git add` はパスを名指しする。** stage と commit は1コマンドにまとめ、staged のまま待たない。
- **他セッションへメッセージを送らない。** 調整は repo 内の記録（APPROVALS / changelog / 台帳）で行う。

## 検証手順

```
cd /Users/masa/projects/AMD/amd-os && node pwa/scripts/model_lock.cjs check
cd pwa && npx tsc --noEmit && npm run test:critical-ui && npm run test:model-formula-canon
```

本番反映は main への push（Vercel Git 自動 deploy）。
