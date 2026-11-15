# Supabase組織の費用整理 — 次セッション引き継ぎプロンプト（2026-11-15 作成）

## 読む順（この順で読んでから着手する）

1. `/Users/masa/projects/AGENTS.common.md` — えいみ共通ルール正本。必ず最初
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md` — AMD階層のメモリ索引
3. `/Users/masa/projects/AMD/amd-os/HANDOFF_SUPABASE_ORG_COST_20261115.md` — 現在地、費用の仕組み、未解決
4. `/Users/masa/projects/AMD/ZMP/OkuDoor/SUPABASE_OWNER_TRANSFER_PROMPT.md` — OkuDoor 移管の手順書（11/15 に数字を再計測済み）
5. `/Users/masa/projects/knowledge/OkuDoor.md` — 運営主体は葛飾ロード株式会社（KR）

## 状態スナップショット（2026-11-15）

- Team ARMADA の Supabase は3台: `amd-os-v2`（`nbnhrhybjslbawdukvvk`、AMD OS本体）、`amie-os-suite`（`alflpkgezztswgynnlmy`）、`okudoor`（`mbgvdwuuwjhwipybrxym`）。`l2m-boss` は 2026-08-27 に削除済み。
- OkuDoor を Team ARMADA から KR（葛飾ロード株式会社）の組織へ移す作業は未実施。移す理由は、別会社の持ち物が Team ARMADA の請求書に乗っていること、顧客データの責任の所在、原価が請求書で直接出ること。
- 移管方式は組織間の Project Transfer。参照ID・接続URL・鍵が変わらないので、OkuDoor のコードと Vercel の環境変数は変更しない。
- OkuDoor の規模（11/15 読み取り）: public 95テーブル、認証利用者472人、アプリ利用者692人、DB 31.6MB。本番稼働中のため検証目的の書き込みはしない。
- 費用の見込み: 9月以降 45.00ドル、OkuDoor 移管後 35.00ドル。実際の請求書は未確認。

## 次タスク

1. 管理画面で Team ARMADA の 9〜11月の請求書を読み、見込みとの差を確認する（`claude-in-chrome` を使う。まさのログインが残っている）。
2. まさへ2点を確認する。(a) KR 側のだれの名義で Supabase の組織を作るか。(b) 移管先を無料プランにするか Pro にするか。判断材料は手順書の表にある。バックアップの有無が分かれ目。
3. 決まったら手順書の手順1（事前チェック）から実行する。KR への依頼文はメール下書きまでで、送信はまさが行う。

## 確立済みの運用ルール

- 本番データベースへの書き込みをしない。件数確認は読み取りのみ。
- `app/.env.local` の中身を表示・複製しない。鍵が要るときは `supabase projects api-keys --project-ref mbgvdwuuwjhwipybrxym` で取る。
- Supabase CLI は `~/.local/bin/supabase`（ログイン済み）。有料プランのプロジェクトは一時停止できず、課金を止める手段は削除のみ。
- KR 側のクレジットカード登録は KR に依頼する。えいみは触らない。
- 新規プロジェクトを作ってデータを流し込む方式にしない。前提条件を満たせない場合だけ、まさへ報告して判断を仰ぐ。
- メールは送信しない。別セッションを許可なく立ち上げない。
