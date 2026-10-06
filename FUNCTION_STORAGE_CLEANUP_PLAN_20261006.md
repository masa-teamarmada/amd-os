# Function保存容量の旧版整理案

2026-10-06。対象はamd-os-pwa（prj_raZW3HSKIszzPUwNTHfy7xDGzLHm）の下記23件だけ。現在の稼働版と直近正常3版は保持。各候補の現行aliasが0であることをAPIで確認済み。

通常の削除で旧deployment URLは410となる。成功版はVercelの通常の復元手順で30日間復元できる。完全消去・DB/Blob削除・他PJ削除は行わない。使用量の即時低下は保証せず、削除状態・稼働版・使用量を別々に検証する。

承認状態: まさが「旧版23件の通常削除を許可」と明示承認。23件すべて通常DELETEのDELETED応答と一覧からの除外を確認済み。各削除直前に直近正常3版・対象project・READY・現行aliasなしを再検査した。完全消去なし。

実行後: 一覧17件（READY 3、CANCELED 14）。現行17d15894の4alias、復旧候補2版、v3.160.7/dirty:falseを保持。manual/spec/bzm未認証401、公開文書APIの検証は下記引き継ぎへ。保存期間は全状態1日を再読戻し済み。

UsageのLast 30 Days（画面表示Sep 6 3:00–Oct 6 3:00）はamd-os-pwa 10.09GB、他PJ合計約127MB、チーム合計10.22GB。削除後も同値。履歴・日次最大値の集計であり、物理容量の即時解放や超過表示の解消は未確認。Todayの0B表示も即時解放の証拠として採用しない。

## 保持

| ID | commit | 役割 |
|---|---|---|
| `dpl_7KH3Q7go4wmLUD3qJaaQ2nN9Hb4y` | `17d15894` | 現行配信、alias4つ |
| `dpl_FqPBGtuVRodQKWfNSpbcTnddUVCA` | `4a90431e` | 復旧候補 |
| `dpl_5wcS2PPJNY8uhNZWuUMKCsKBtwFU` | `fbfa8056` | 復旧候補 |

## 整理対象

| ID | commit | 作成時刻（日本時間） | 現行alias数 |
|---|---|---|---|
| `dpl_5rTncrUUj9KSNt97mqAj1mLiHBvG` | `d46d49f6` | 2026-10-06 14:37 | 0 |
| `dpl_VAvxtxq6zohHBjGzLGvuixoZQxYT` | `9788970d` | 2026-10-06 14:26 | 0 |
| `dpl_DCiDQMCRgDDYgUao1RU4n4SC4Q2n` | `e46751a7` | 2026-10-06 14:21 | 0 |
| `dpl_DuHjjsWFZ9KXYReJs54vYDpad23A` | `27c46818` | 2026-10-06 14:19 | 0 |
| `dpl_CKWqnVKCT3uCtkUrxW976zJsUskx` | `8f8550b4` | 2026-10-06 13:26 | 0 |
| `dpl_5hYFgBhNmKDfjzH2fnCZ7mFLsWgC` | `971b4db7` | 2026-10-06 13:18 | 0 |
| `dpl_4sNTDsEWfZCEQHxw5mPrCWR2MzdW` | `369f2923` | 2026-10-06 12:57 | 0 |
| `dpl_5uXU8vCDNpREfeS69R6DSiS2yAHo` | `91883c67` | 2026-10-06 12:53 | 0 |
| `dpl_59BMQeEeXiiovP4LmoqnAWxP1T9B` | `18f21c74` | 2026-10-06 12:44 | 0 |
| `dpl_HRTvQKL1vDtmgm86vVNF5hXcUZvk` | `d417e33b` | 2026-10-06 12:40 | 0 |
| `dpl_7QCTyoe4VVmj5yuERuPGN378suZM` | `d14304db` | 2026-10-06 12:37 | 0 |
| `dpl_2T8E4xZn6Usd1aCTzm8fywCoUTB1` | `16663fbe` | 2026-10-06 12:37 | 0 |
| `dpl_D2D1HVhGM2W6f3HtwRszycUkcfZQ` | `f6a0d3a4` | 2026-10-06 12:33 | 0 |
| `dpl_CH5KdGbLXph3ruDSb2xNWX1bMvz2` | `cf8ab31d` | 2026-10-06 12:25 | 0 |
| `dpl_CqCE2Gv2f8CBUknTk6wvf6vqoKU2` | `e168a8bc` | 2026-10-06 12:23 | 0 |
| `dpl_NBbSauTy597SoioKdXeGydVhrEST` | `bca5c497` | 2026-10-06 12:17 | 0 |
| `dpl_B1EscyGPRh6JvL7T81Vo9yCGJusK` | `b6138915` | 2026-10-06 12:03 | 0 |
| `dpl_B1d1DuXcJgg6bkAo63Jvte9zymAk` | `ac3866c9` | 2026-10-06 11:57 | 0 |
| `dpl_3GSCsyA6vdGa1XbSYGw75n7kGRjt` | `478f37be` | 2026-10-06 11:37 | 0 |
| `dpl_6F2SbW1UaAaDt5tMMGNJnuiX1gZ4` | `23fe973f` | 2026-10-06 11:36 | 0 |
| `dpl_CaHDJZfUqFy4FntBFiDfECcSVAfG` | `f0c30d0f` | 2026-10-06 09:55 | 0 |
| `dpl_DKkkHohiZMoKqd4i8kfShk9muvdu` | `22d652e8` | 2026-10-06 09:37 | 0 |
| `dpl_EUYrdc3RFy4TZCgKZcSsUoZdqQL7` | `041af07b` | 2026-10-06 09:29 | 0 |

## 再発防止の現在地

同梱容量ゲートと全状態1日保存は既に適用済み。ただし1日保存と最大48時間の整理遅延では当日中の多数版は積み上がる。今回の整理結果を確認後、必要ならデプロイ成功後に直近3版・現行aliasを保護して旧版を整理する経路を具体化し、承認された範囲で仕様/manualへ反映する。新たな定期ジョブ・課金変更・外部通知は作らない。
