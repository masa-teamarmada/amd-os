# 4-7 AMDの貢献記録 現行仕様

PJコックピット `進捗管理` タブの最下部に置く「AMDがこのPJへ行ってきたこと」。
隣に置く [`4-6 BZM 2.2 獲得台帳`](4-6-bzm-22-acquisition-ledger-current-spec.md) と対になる。

## 1. 何のための欄か

まさ確定 2026-08-14:

> AMDがそのPJに対して行ってきた貢献についてまとめてあるコーナーもほしい。進捗タブの一番下でいいので。

獲得台帳が「そのPJが何を得たか」を並べるのに対し、この欄は「AMDが何を投じたか」を並べる。
主語が違うので同じ台帳に混ぜない。並べて置くことで、投じたものと得たものを同じ画面で読める。

## 2. 専用テーブルを持たない

この欄はDBに専用の行を持たず、既存の生データからその場で組む。

| 出所 | 使う列 | 何になるか |
|---|---|---|
| `member_activities` | `member_id` / `ym` / `source` / `title` / `content_preview` / `item_date` | AMDメンバーが実際にやった仕事の1件 |
| `project_meeting_summaries` | `meeting_id` / `ym` / `meeting_date` / `title` / `summary_short` / `decided` | 打ち合わせの1件 |
| `members` | `member_id` / `code_name` | 表示名 |

専用テーブルを作らないのは、作った瞬間に「人が貢献を書き込む欄」になるため。
AMD OSは生データからの自動構築を原則にしており、手入力前提の機能を作らない。
書くべき内容が足りないなら、この欄を編集可能にするのではなく、抽出側（`member_activities` を作る経路）を直す。

`project_meeting_summaries` のうち `source_kinds='upcoming'` と、`meeting_date` が今日より後の行は除く。
予定はまだ「行ってきたこと」ではない。

## 3. 表示の規則

`src/components/cockpit/CockpitAmdContributions.tsx`。守ること:

- **日付の新しい順**に並べ、月ごとに区切る。`impact` / `depth` / 件数で並べ替えて「大きい貢献」を上へ出さない
- **件数を貢献度の指標として大きく出さない**。最下部に「拾えた記録の母数」として小さく添えるだけにする
- 「AMD OSが生データから拾えた分だけ」と必ず出す。**無記録を「やっていない」に見せない**
- `member_activities.source='inferred'` の行は `推定` と出し、観測へ昇格させない
- メンバー名は `code_name` を出し、`/mypage?memberId={members.member_id}` へリンクする
- 直近2か月分を開いておき、それ以前は1つの折りたたみへ入れる（進捗タブの末尾が伸びきらないように）

## 4. API

`GET /api/project/[projectId]/amd-contributions`

- 認証: `requireMember()`
- `runtime = "nodejs"` / `dynamic = "force-dynamic"` / `Cache-Control: private, no-store, max-age=0`
- 各出所につき上限400件。上限に達したら `truncated: true` を返し、画面に「古い記録は省いている」と出す
- 返り値: `{ projectId, firstOn, lastOn, activeMonths, members[], items[], recordedCount, truncated }`

正規化は `src/lib/amd-contributions.ts`。日付が採れない行は捨てる（日付を捏造しない）。

契約テストは `npm run test:amd-contributions`。

## 5. 変更ゲート

- 表示項目を増やすときは [`design/FEATURE_REGISTRY.md`](../design/FEATURE_REGISTRY.md) の該当節も更新する
- 出所を増やすときは §2 の表に行を足し、その出所の証拠段階（観測か推定か）を必ず決めてから足す
- **この欄に手入力の口を付けない**。付けたくなったら抽出側を直す
