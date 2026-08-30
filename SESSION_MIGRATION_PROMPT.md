# 次セッション用プロンプト（2026-08-30 時点）

cwd: `/Users/masa/projects/AMD/amd-os`

## 読む順

1. `/Users/masa/projects/AGENTS.common.md` — えいみ共通ルールの正本
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md` — AMD横断 memory
3. `/Users/masa/projects/AMD/amd-os/AGENTS.md` — AMD OS 固有のルール
4. `HANDOFF.md` — 現在地（E がこのタスク）
5. `SESSION_MIGRATION_PROMPT_PROJECT_PROFITABILITY_2026-08-30.md` — **このタスクの本体。禁止事項11点と確定した事実**
6. `pwa/manual/7-1-reward-calc-spec.md` — **報酬計算の正本。全文を Read で通す（必須）**
7. `pwa/spec/5-14-project-profitability-current-spec.md` — 現行仕様（作り直し対象）
8. `pwa/spec/5-10-reference-data-caching-current-spec.md` — 参照系キャッシュ規範
9. `pwa/BUGS.md` の 2026-08-30 節 — 今回の事故3件

## 状態スナップショット

- `main` 一本。着手時に `git fetch` して behind を解消してから触る
- 本番: `https://amd-os-pwa.vercel.app`。`/api/build-info` の `git_sha` で反映を確認する
- 画面: `/admin/project-profitability`（左メニュー「契約・お金」＞「PJ別利益構造」、admin のみ）
- **本番の現行画面には誤った表示が残っている**: 「需要 N×」警報、「未配分 ¥X」の金額表示
- 実装ファイル: `pwa/src/lib/project-profitability.ts` / `project-profitability-client.ts` /
  `pwa/src/app/api/admin/project-profitability/route.ts` /
  `pwa/src/components/admin/AdminProjectProfitabilityClient.tsx` /
  `pwa/src/app/(app)/admin/project-profitability/page.tsx`
- 検査: `pwa/scripts/check_project_profitability.mts`（`npm run test:project-profitability`、deploy.sh に登録済み）。
  **途中の設計を固定しているので、作り直しに合わせて書き直す**
- ナビ登録済み: `pwa/src/lib/surface-catalog.ts` の `admin-project-profitability`

## 次のタスク

**PJ別 利益構造ダッシュボードを白紙から作り直す。** 現行実装を踏襲しない。

まさが知りたいのは「どのPJが儲かっていて、どのPJがまさの持ち出しで回っているか」。
ここでの「儲かっている」は **まさ自身の稼働を織り込んだうえで**の話であり、
現金が出ていかないだけの状態を利益と呼ばない（まさの労働の対価を会社に付け替えているだけ）。

禁止事項11点の全文は `SESSION_MIGRATION_PROMPT_PROJECT_PROFITABILITY_2026-08-30.md` にある。要点:

- 「持ち出し」「枠超え」という語を使わない（意味が逆、または予算オーバーと誤読される）
- 年で切らない。シーズン（`value_plan_cycles`）で見る。シーズンは年をまたぐ
- 未払残（`stockYen`）を収益率に混ぜない
- **ポイント（MS pt / `grossDueYen`）を収益率の指標にしない。** まさ「マイルストーンをどのように
  設定しようが、原資を超える支出にならない設計じゃん」。「需要 N×」警報は無意味
- **OSにデータが無いことをお金の状態として語らない。** まさ「報酬を渡すべき人には渡し終わってるよ。
  計算ができてないだけ」
- **`tally_weekly_effort_entries` はまさ専用。** まさ「tallyはおれの稼働だけをカウントするアプリだよ」。
  他メンバーとの比較や「依存度」は作れない

**先に決めること（コードを書く前にまさへ提示して合意を取る）**
1. まさの時間の価値をいくらと置くか（前セッションの暫定20,000円/時は**まさ未承認**）
2. まさ以外の投下時間がOSに無いことを踏まえ、何を収益性の指標にするか

提示は抽象的なA/B/C案ではなく、**実データを入れた表**で見せる。

## このPJで確立済みの運用ルール

- **お金の集計を書く前に `pwa/manual/7-1-reward-calc-spec.md` を全文 Read。** grep や `sed -n` の
  拾い読みは不可。守らないと PreToolUse hook（`~/.claude/hooks/guard_canon_read.py`）が deny する
- 参照系データは3層キャッシュを最初から通す。`npm run test:reference-data-cache` に通す
- 実装後は**本番相当の実データで desktop 実寸を確認**（PWAのスマホ幅は対象外）。
  認証は service role で magiclink を発行し `sb-<ref>-auth-token` を **base64url** で cookie 注入して Playwright
- 反映は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`。
  ただし他セッションの未コミットがあると止まるので、その場合は個別 commit → `git push origin main`
- **Vercel は1日100デプロイ/アカウント全体。** `pwa/scripts/check_deploy_quota.mjs` が90超で push を止める。
  枯渇時は override せず枠が空くのを待つ（枠は1件ずつしか戻らない）
- `pwa/vercel.json` の `ignoreCommand` を**パス限定に戻さない**（08-29〜08-30 に本番反映を丸1日止めた）
- 指標や順位を出したら、**実態を知るまさに見せて違和感を聞く**。データが実態を持っているかは
  データを見ても分からない
