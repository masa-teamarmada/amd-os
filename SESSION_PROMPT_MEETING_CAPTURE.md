# 次セッションのプロンプト — 会議で話したことがOSに入らない穴を塞ぐ

cwd: `/Users/masa/projects/AMD/amd-os`

---

AMD OS で、**開いた会議の中身がOSに入らないまま放置される**穴を塞いでほしい。

## 何が起きているか

`project_meeting_summaries` には、カレンダーの予定から**開催前に**作る「これから開く会議」のカードがある
（`meeting_id` が `upcoming:` で始まる行）。開催後に議事録を取り込んで中身を埋める前提だが、
**埋まらないまま残っているカードが26件・10PJ分ある**（2026-07-09〜2026-08-26 時点）。

```sql
select project_id, meeting_date, title
from project_meeting_summaries
where meeting_id like 'upcoming:%' and meeting_date < current_date
  and coalesce(summary_short,'')='' and coalesce(narrative_md,'')=''
order by meeting_date desc;
```

中には落としてはいけないものが入っている。

- p07 LiSTie 経営会議（2026-08-12・2026-08-26）
- p21 SolvioraX 経営会議（2026-08-11・2026-08-24）ほか SX の社内打ち合わせ・企業面談
- p24 チャレナジー 取締役会（2026-08-26）
- p20 CryoX 定例、p29 KENQ 定例、p25 KUTE、p19 ZeMA、p30 EHM、p10 SE

**実害が出た。** 2026-08-27に BZM 3.0（産業創出価値）の入力を21件ぶん埋め直したとき、
p10 SE の 2026-08-20 の打ち合わせカードが空だったため「会議の元データが無い」と誤診した。
実際は**議事録はNotionにあった**。OSのカードが更新されていないだけだった。
この案件は、OSのデータだけで組むと2位（1,026億）、まさから直接聞き取ると19位（6億）になる。
**会議で話されたことがOSに入らないと、モデルの答えが桁で狂う。**

## 調べてほしいこと（原因の特定が先）

1. **`upcoming:` のカードを作っているのは誰か。** `pwa/src/app/api/meeting-prep/` と
   `pwa/src/app/api/meeting-prep/calendar-sync/`、`pwa/src/app/api/meeting-calendar/upsert-plan/` あたり。
   cron から動いているなら `pwa/vercel.json` と `pwa/src/app/api/cron/` を見る
2. **開催後に中身を埋める処理はあるか。** あるなら、なぜこの26件で動かなかったか。
   無いなら、そもそも設計に「開催後に埋め戻す」段が無いということ
3. **議事録の取り込み元は何か。** Notion（`pwa/src/lib/sources/notion.ts`、`NOTION_API_KEY`）、
   Gmail、Drive、Calendar のどれが使われていて、どれが落ちているか。
   **`NOTION_API_KEY` はローカルの `.env.local` に無い**ので、Vercel 側の環境変数を確認する必要がある
4. **26件それぞれが、どの取り込み元で落ちたか**を分類する。原因が1つとは限らない
   （Notionにページがある / Gmailにしかない / どこにも文字が無い、は別々の問題）

## 作ってほしい仕組み

原因が分かってからでいいが、方向としてはこの3段。

1. **検知** — 開催日を過ぎても中身が空のカードを毎日数える。0件でないなら誰かに見えるようにする。
   `pwa/src/app/api/cron/` に既存の cron が並んでいるので、同じ形で足す
2. **自動で埋める** — 検知したカードについて、Notion・Gmail・Drive・Calendar を順に当たって議事録を探し、
   見つかったら要約・決定・次アクション・リスクを抽出して入れる。
   **LLM は Codex automation 経由で動かす**（PWA から Anthropic API を直接叩かない。
   `pwa/CLAUDE.md` と AMD memory の `feedback_no_pwa_anthropic_api_use_codex_instead` を読むこと）
3. **埋まらないものは人へ回す** — 自動で見つからないカードは、まさか担当メンバーへ「この会議の議事録どこ？」と
   1件ずつ聞ける形にする。**黙って消さない。空のまま静かに残るのが今回の事故の形**

## 決めてほしい設計の論点

- 検知の閾値。開催の何日後から「埋まっていない」と扱うか（当日〜3日は書く時間として要る）
- 通知の宛先と頻度。**対人通知は既定OFF**（`AGENTS.common.md`）。まず画面に出すところから
- 議事録が本当に存在しない会議（雑談・立ち話）をどう畳むか。「議事録なし」と明示的に閉じられる状態が要る
- 過去の26件をどこまで遡って埋めるか

## 守るルール

- `main` 一本。branch と worktree を作らない。既存の dirty を保ち、対象ファイルだけを commit する
- 着手前に `AGENTS.common.md`、`pwa/CLAUDE.md`、`pwa/AGENTS.md`、`HANDOFF.md`、`BUGS.md` を読む
- 仕様は `pwa/spec/` か `pwa/manual/` の**画面に出る場所**へ書く（`pwa/design/` は使わない）
- 検証: `npx tsc --noEmit` / `npx eslint <触ったファイル>` / `npm run build` /
  `npm run test:critical-ui`（pre-commit で強制的に走る）/ `npm run test:reference-data-cache`
- commit → push → 本番（`https://amd-os-pwa.vercel.app`）で確認まで進める
- `next dev` を起動したら commit 前に `git diff pwa/AGENTS.md` を見て戻す

## 背景の読みもの

- `BUGS.md` の 2026-08-28「OSに無い事実で順位が決まっていた — SEを2位に置いていた」
- `model/cases/INVENTORY.md` の「この棚卸しで見つかった、データ側の問題」3
  （なぜ抽出できていなかったかを4つの原因に分けてある。この26件はそのうちの1つ）

## まさへの報告

ファイル名・テーブル名・関数名を本文に並べない。**まさが開く画面で何がどう変わるか**、
**何件が埋まって何件が残るか**、**次に誰が何をすれば残りが埋まるか**で書く。
