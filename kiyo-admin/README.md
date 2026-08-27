# kiyo-admin（きよあどみ） — AMD OS ビューワー / 承認アプリ

AMD OS 本体の「きよ」ページ（`/admin/kiyo`）を、きよ専用の単独アプリとして持ち出したもの。
本体と同じ Supabase を見るので、どちらから見ても同じデータになる。

## ⭐ このアプリの原則：金額を計算しない

**きよあどみは、AMD OS 本体が確定させた結果を表示して承認するだけの道具。**

数字を作るのは全部本体の仕事:

| 何を | どこが作るか | いつ |
|---|---|---|
| 報酬の計算結果 | 本体 `/api/cron/payout-reward-cache-refresh` → `billing_cycles.reward_summary_json` | 毎晩 JST 03:05 |
| 支払通知書PDF | 本体 `/api/cron/payout-notice-prebuild` → `payout_notices` | 毎晩 JST 02:00 |
| 支払明細の確定 | 本体 `/admin/kiyo?task=payouts` の保存操作 → `monthly_reward_payout` | 人が押したとき |
| 請求書の発行 | 本体 `/admin/kiyo?task=invoices` → freee | 人が押したとき |
| お金の流れの集計 | 本体 `/api/admin/kiyo/money-flow` | 呼ばれたとき（TTL 5分） |

### なぜこの原則があるか（2026-08-27 の撤去）

このアプリは最初、本体の計算ロジックを**コピーして持っていた**。
ファイルの先頭には「逐語コピー」と書いてあったが事実ではなく、作成日の時点ですでに
本体の 1/4 の抜粋版だった（581行 vs 2203行）。結果、本体と **5か所** ズレていた:

1. 報酬計算式が抜粋版（確定分の保護 / 相殺 / 上限の繰越が無い）
2. 予算超過時に独自に比例圧縮して、全員を減額していた
3. 金額を手動上書きしたメンバーを通知書から落としていた
4. 支払ルール「請求書受領後60日」を知らず、対象月がズレていた
5. 立替精算（報酬とは別原資）の存在を知らなかった

さらに「報酬キャッシュ再計算」を押すと、古い式の結果を
`billing_cycles.reward_summary_json` に**上書き**していた。この列は本体の24ファイルが読む
共有の保管場所なので、**本体の表示金額まで汚れていた**。
画面はどこも壊れないまま金額だけが静かに間違う——いちばん気づけない事故だった。

だから、計算とコピーをやめた。

### やってはいけないこと

- 本体の計算ロジックをここへコピーする（必ず腐る。今回の事故そのもの）
- `billing_cycles.reward_summary_json` に書く（本体が読む共有の保管場所）
- `payout_notices` の `total_yen` / `pdf_url` / `notice_no` を書く（本体が確定させた値）
- 「再計算」「発行」ボタンを足す
- 表示のために金額を按分・推計・補正する

金額に関わる機能が必要になったら、**本体側に足して、こちらは表示するだけにする。**

### 例外：「見せ方」だけの部品はコピーしてよい

`src/components/kiyo-money-flow/` と `src/lib/finance/kiyo-money-flow-types.ts`、
`src/lib/utils.ts` は本体からのコピー。これらは**描画専用**で、金額の計算は一切していない
（数字は本体の API が返した値をそのまま描いているだけ）。

| こちら | 正本 |
|---|---|
| `src/components/kiyo-money-flow/*` | `pwa/src/components/admin/kiyo-money-flow/*` |
| `src/lib/finance/kiyo-money-flow-types.ts` | `pwa/src/lib/finance/kiyo-money-flow-types.ts` |
| `src/lib/utils.ts` | `pwa/src/lib/utils.ts` |

唯一の変更は `KiyoMoneyFlowPanel.tsx` の取得先を
`/api/admin/kiyo/money-flow` から `/api/kiyo/money-flow` にしたところだけ。

ズレても**金額事故にはならない**（図の見た目が本体と食い違うだけ）。
本体側を直したら、こちらへコピーし直して、取得先とコピー注記を戻す。

## 画面（本体の `/admin/kiyo` と同じ4タブ）

トップ（`/`）を開くと **00 お金の流れ** が出る。タブ切替は `/?task=...`。

| タブ | できること | データ元 |
|---|---|---|
| **00 お金の流れ** | どこから入り何に使ったか。期間は今月／今シーズン／全期間 | 本体 `/api/admin/kiyo/money-flow` を中継。図（流れ図）は本体の描画部品をそのまま使う |
| **01 立替精算** | 申請を確認して **PM承認 / admin承認 / 却下** | 一覧は `reimbursements` を読むだけ。承認は本体 `/api/reimbursements/decision` へ中継 |
| **02 請求書** | 発行・送付・入金の状態を確認 | `billing_cycles` を読むだけ。**発行操作は無い**（freee に本物を作るので本体でやる） |
| **03 メンバー支払** | 確定した通知書とPDFを見て **送付済みにする / 取り消す** | `payout_notices` を読むだけ。書くのは `sent_at` だけ |

## 本体をどうやって呼んでいるか

本体の `pwa/src/lib/supabase/server.ts` は `Authorization: Bearer <access_token>` を
受け付ける作りになっている（iOS ネイティブ版のために元からある仕組み）。
きよあどみと本体は同じ Supabase プロジェクトなので、こちらのログインで得た token を
そのまま渡せば本体は同じ人として扱う。

→ **本体には一切手を入れていない。** 実装は `src/lib/amd-os.ts`。

## セットアップ

```bash
cd kiyo-admin
npm install
cp .env.example .env.local   # 値は pwa/.env.local と同じものを入れる
npm run dev                  # http://localhost:3000（3100 にすると Supabase のログイン許可リストから外れて本体へ飛ばされる）
```

| 変数 | 用途 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ログイン・セッション |
| `SUPABASE_SERVICE_ROLE_KEY` | 確定済みデータの読み取りと `sent_at` の更新 |
| `AMD_OS_BASE_URL` | 本体の公開URL。省略時 `https://amd-os-pwa.vercel.app` |

GAS の設定はもう要らない（PDFは本体が作るため）。

## アプリとして使う（PWA インストール）

公開URLを Edge / Chrome で開いて、アドレスバー右の **インストール** を押す。
タスクバーに乗って、アドレスバー無しの単独ウィンドウで開く。

`public/sw.js` は**わざとキャッシュしない**。金額を扱うので、古い内容がオフラインで
返る方が事故になる。service worker はインストール要件を満たすためだけに置いてある。
**キャッシュ処理を足さないこと。**

## 認証

- Google Workspace（`team-armada.jp` ドメイン限定）でログイン
- `members.is_admin = true` のみ画面と API に入れる
- 本体と違って Calendar / Gmail スコープは要求しない
- `members.last_login_at` は更新しない（本体の責務。同じ列を2アプリから書くと事故る）

---

# このアプリを触るときの原則（AI / 開発者向け）

> `kiyo-admin/CLAUDE.md` と `kiyo-admin/AGENTS.md` を置きたかったが、きよPCの権限設定で
> 書き込みがブロックされているのでここにまとめてある。

## 必読（この順）

1. この README ⭐ とくに冒頭の「金額を計算しない」
2. [`pwa/manual/31-admin-payouts-reward-notice-spec.md`](../pwa/manual/31-admin-payouts-reward-notice-spec.md) — 支払通知書の仕様正本
3. [`pwa/manual/6-11-kiyo-money-flow-spec.md`](../pwa/manual/6-11-kiyo-money-flow-spec.md) — お金の流れの仕様正本
4. [`pwa/manual/04-admin-ops.md`](../pwa/manual/04-admin-ops.md) — admin 月次オペ全体の入口
5. [`AGENTS.md`](../AGENTS.md) — モノレポ全体のルール

## 1. 仕様の正本は `pwa/manual/` にある

`kiyo-admin/` に**新しい設計 md を作らない**。仕様を変えるなら `pwa/manual/` を同じ保存で直す。

## 2. 計算を持ち込まない

`src/lib/` にあるのは日付の表示ヘルパー（`ym.ts`）、Supabase 接続、本体を呼ぶ薄い
クライアント（`amd-os.ts`）だけ。**ここに計算ファイルを増やさない。**

新しい数字を出したくなったら、まず本体の API を探す。無ければ本体側に足す。

## 3. 本番 DB を読む自覚を持つ

`SUPABASE_SERVICE_ROLE_KEY` で RLS をバイパスして本番を読む。
書き込みは `payout_notices.sent_at` だけに限定してある。**書く先を増やさない。**

## 4. 機能追加はミニマムから積む

「1画面 = 1業務」で足していく。本体の画面をまるごと持ってこない。

## 5. Next.js の作法

Next.js 16 系。`middleware.ts` は deprecated なので **`src/proxy.ts`** を使う
（本体はまだ `middleware.ts` のまま）。

## 6. PWA まわりを壊さない

`public/manifest.json` + `public/sw.js` + `src/components/ServiceWorkerRegister.tsx` の3点セット。
`proxy.ts` の matcher から `manifest.json` / `sw.js` / `icons/` を外してある。
ここを触ると 307 で login に飛んでインストールが壊れる。
