# 2026-05-27 — L2 ⑥ 予定MTGカード / Drive資料同期 修正

## 背景

KUTEで複数の次MTGが設定されたが、MTGサマリ欄の予定MTGカード生成が偏っていた。続いてCLGでも今日の取締役会カードにDrive内の関係資料が載っていないことが分かった。

## 実施内容

- `POST /api/meeting-prep/calendar-sync` が `drive_files` metadata を受け取り、予定MTGカードの `関連Drive資料` に出せるようにした。
- `source_hash` にDrive資料 metadata を含め、資料リンク・更新時刻・snippet の変化でカードが更新されるようにした。
- 同日開始済み予定を `past_event` 扱いで弾かないよう、skip条件をJST日付比較に変更した。
- L2⑥ SKILL の未来Calendar同期範囲を `today 00:00 JST` から `now + 60 days` に変更した。
- L2⑥ SKILL にDrive root + 1階層サブフォルダ探索を追加し、Docs / Slides / Sheets / PDF / Office files を会議資料候補として扱うようにした。
- Drive資料だけで「決定済み」とは書かず、資料・論点・準備物として `progress` / `risks` / `narrative_md` に寄せるガードを入れた。

## 本番反映

- CLG `p24` の `CLG 取締役会` (2026-05-27 17:30 JST) 予定カードを本番APIで更新。
- Drive `260527_取締役会` フォルダから以下3件をカードへ反映:
  - `260527_取締役会_第1号議案資料_6月度予算執行 全社＋開発.xlsx`
  - `260527_取締役会_報告資料_4月度予算実績比較.xlsx`
  - `2026年5月27日_取締役会招集通知.pdf`
- Supabase readbackで `summary_short` / `progress` / `next_actions` / `risks` / `narrative_md` にDrive資料3件が入っていることを確認。

## Commit / deploy

- `35b71d4 feat(pwa): include drive materials in meeting prep sync`
- `a320ce5 fix(pwa): pass finance simulation inputs`
- `f39a9f6 fix(pwa): allow strategy signal metadata fields`
- `fff185e fix(pwa): sync same-day meeting prep cards`
- `a28e8ff polish(pwa): clarify same-day meeting prep copy`

Vercel production deployment:

- `dpl_2Ff3Ytd14AtGxao3u3nAXUKqDYEU`
- URL alias: `https://amd-os-pwa.vercel.app`
- 状態: READY

## 検証

- `npm --prefix pwa run lint -- src/app/api/meeting-prep/calendar-sync/route.ts` pass。
- Vercel build / TypeScript / deployment READY を確認。
- `POST https://amd-os-pwa.vercel.app/api/meeting-prep/calendar-sync` でCLGカード更新成功 (`updated=1`)。
- Supabase REST readbackで `関連Drive資料` と3ファイルリンクを確認。

## 注意

- MMO PC 側 repo の最新pullはこのMacから `msi.local` が解決できず未確認。MMO側 auto-pull task が最大30分遅延で拾う設計だが、急ぐ場合はMMOで `git pull origin main` を確認する。
- `pwa/design/meeting_summaries.md` は本セッション前からdirtyだったため、既存差分を巻き込まないよう注意。
