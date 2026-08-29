# 引っ越しプロンプト — ホーム（/dashboard）と見込みPJまわりの続き

cwd: `/Users/masa/projects/AMD/amd-os`

> このプロンプトは 2026-08-27〜28 の「ホームの作り直し + 見込みPJの統合」の続き用。
> **本体は完了して本番反映済み（v3.99.0）**。残っているのはまさへの確認1件と、監査で挙がった未対応分。
> BZM 3.0 のモデル本体を進めるなら [`SESSION_MIGRATION_PROMPT.md`](SESSION_MIGRATION_PROMPT.md) の方を使う。

---

AMD OS の作業を続けて。前回セッションでホーム（`/dashboard`）の構成を作り直し、見込みPJ3本を親PJへ統合した。
**実装と本番反映は終わっている。** このプロンプトは、そこで残った確認と、UX/UI監査で挙がって未対応のものを片付けるためのもの。

## 読む順（この順で全部読む）

1. `/Users/masa/projects/AGENTS.common.md` — えいみ共通ルールの正本
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md` — AMD配下の長期記憶
3. `/Users/masa/projects/AMD/amd-os/AGENTS.md` — モノレポの固有ルール（cwd はルート、pwa に cd しない）
4. `HANDOFF.md` の **A 節** — 何をやって何が残っているか
5. `pwa/design/FEATURE_REGISTRY.md` の `## /dashboard` — ホームの確定仕様（消してはいけない導線と、今回入れた釘）
6. `pwa/manual/4-5-management-score-and-finance-simulation-spec.md` の「見込 (`status='sales'`) PJ」行と「将来月の外部支払は台帳へ明示する」行 — 財務側の確定仕様
7. `pwa/BUGS.md` の「2026-08-27〜28」節 — 5件の事故と再発防止
8. `pwa/design_log/sessions_2026-08.md` の「2026-08-27〜28」節 — 実装履歴（必要なときだけ）

## いまの状態

**本番**: `https://amd-os-pwa.vercel.app`、v3.99.0。`curl -s https://amd-os-pwa.vercel.app/api/build-info` で `git_sha` を確認できる。

**ホームの構成（上から）**:
先手TODO → **PJポートフォリオ**（研究機関PJ 4 / シーズPJ 11 / 事業会社PJ 1 の3列） → **PJ運用**（全31件の台帳。稼働中・商談準備中は開、終了停止中は折り畳み） → 要対応 → 経営指標・接続状況（2列・折り畳み） → **会社の記録**（写真を全幅で先頭 + メンバー/沿革/メディア掲載の3列）。
右カラムはマイページ埋め込み（xl以上）。当月報酬と月初合意は畳んである。

**財務**:
- p32 NewCo業務委託 → **p21 SX**（2027-05〜 月60万）、p33 CX再開 → **p20 CX**（2027-01〜 月27.4万）へ統合済み。3本とも `projects` から削除済み
- p21 / p20 は `fee_type='variable'` + `end_ym=null`。月別金額は `billing_cycles.budget_reported_amount`
- p34 PSI Step2 は **PJではなく** `company_budget_inputs` の臨時収入（`source_id='sp-psi-step2-YYYYMM'`、2027-04〜2028-03 月40万）
- 売上原価の**横引き（`carryForwardExternalByPj`）は廃止済み**。原価は `billing_cycles.reward_summary_json` の値だけ。p19 ZMP の 202701〜202803 は月137,280円を `manualForecast` 付きで台帳へ明示してある

**検証の資産**: `pwa/scripts/pj_merge_snapshot.mts`（`before` / `after` / `diff`）。
統合の前後で27ヶ月ぶんの会社全体の売上と外部メンバー支払を突き合わせる。スナップショットは `pwa/scripts/__snapshots__/pj_merge_20260827/`。
財務まわりのデータを触るときは、触る前に `before` を撮ってから作業する。

```
cd /Users/masa/projects/AMD/amd-os/pwa
node --experimental-strip-types --import ./scripts/register_ts_aliases.mjs scripts/pj_merge_snapshot.mts before
# (作業)
node --experimental-strip-types --import ./scripts/register_ts_aliases.mjs scripts/pj_merge_snapshot.mts after
node --experimental-strip-types --import ./scripts/register_ts_aliases.mjs scripts/pj_merge_snapshot.mts diff
```

## タスク

### 1.（まさへの確認が要る）PSI Step2 の月40万を売上高に出すか

いまは臨時収入（`spot`）なので**売上高には出ず、経常利益とキャッシュにだけ入る**。統合前と比べて 2027-04〜2028-03 の売上高が年間480万減っている（¥53,014,535 → ¥48,214,535）。
「香川大下川 or 愛媛大中島 のどちらか採択されるか未定」の見込みなので売上高に混ぜない方が正直だが、まさが来年度の収入見込みを売上高で見たいなら別の持ち方が要る（PJに紐づかない売上の仕組みは現在無い）。
**まさの回答を待ってから動く。** 採択先が決まったら、`sp-psi-step2-YYYYMM` を消してそのPJの `billing_cycles` へ移す。

### 2. UX/UI監査で挙がって未対応のもの

前回、情報設計とレイアウト実装の2本の監査を回した。以下は指摘されたが今回は手をつけていない。**どれも急がない**ので、まさが困ったと言ったときに着手する。

- **z-index に設計が無い**。ナビ本体 50 / ナビのフライアウト 60・61 / 月初合意ゲート 80 / 緊急通知 90 と、値が散らばっている。今回入れた写真モーダルは 70。`globals.css` にトークン（`--z-nav` / `--z-flyout` / `--z-modal`）を定義して全箇所を張り替えるのが根治
- **`AllPjIntroductionModal` は背景クリックで閉じるが、他のモーダルと挙動が揃っていない**。`useModalContainment` を使う形へ寄せると全画面で統一できる
- **PJ一覧（`DashboardGrid`）の12カラム行にモバイル分岐が無い**。390px幅でも `col-span-4/2/4/2` のままで、担当欄が約50px、請求4ステップが約38pxに潰れる。**ただしまさは「スマホはswift版しか使ってない」ので優先度は低い**
- **`FEATURE_REGISTRY.md` の `## /dashboard` に「PJ台帳の Slack CH 列」の項があるが、実物は `/admin/projects` 側**。正本の記述位置がずれている（軽微）

### 3. 触るときの注意

- **2カラム grid の中へ全幅要素を置かない**。`sticky` の可動域は grid コンテナ全体なので、`col-span-2` を1つ足した瞬間に右カラムがその節へ被さる。`npm run test:portfolio-home-contract` が `col-span-2` を禁止している
- **会社の記録のデータはキャッシュ層を通す**。ブラウザから `media_assets` などを直接読むと `npm run test:reference-data-cache` が落ちる
- **見込み案件を独立PJとして立てない**。親になるシーズ・研究機関・事業会社があるならそのPJの月別台帳へ、どこになるか未定なら会社の臨時収入へ
- **「まさ確定」と正本に書くときは、まさが実際に答えた問いの範囲で書く**。発言を引くなら、何を聞かれて答えたのかも一緒に残す
- **背面タブでは `IntersectionObserver` が発火しない**。Chrome MCP はタブを背景で操作するので、交差や `requestAnimationFrame` に依存する挙動をそこで判定しない

## 検証とデプロイ（このPJの手順）

```
cd /Users/masa/projects/AMD/amd-os/pwa
npx tsc --noEmit
npx eslint <触ったファイル>
npm run build                              # exit 0 を確認
npm run test:critical-ui                   # pre-commit で強制的に走る
npm run test:portfolio-home-contract       # ホームを触ったら必ず
npm run test:reference-data-cache          # データ取得を触ったら必ず
```

`pwa/src/lib/build-info.ts` の `BUILD_VERSION` を上げてから、

```
AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh
```

同じ checkout を5〜10セッションが共有している。`deploy.sh` は clean checkout を要求するので、
他セッションの未コミット変更があると止まる。そのときは**触らずに**、自分の対象ファイルだけ commit して
guard を個別に通してから `git push origin main` する。着手前と deploy 前に `git log --oneline -5 origin/main` を見る。

本番の確認は Chrome（`mcp__claude-in-chrome__*`）でまさのログイン済みセッションを使う。
月初合意の全画面ゲートが出ていて下が見えないときは、`javascript_tool` で fixed のオーバーレイを
`display:none` にして `document.body.style.removeProperty('overflow')` する（検査のためだけ。**合意ボタンは押さない**）。
