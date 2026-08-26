# services/project-share/ — 退役記録

Project Shareは2026-08-26に全インスタンスを退役した。このディレクトリには再デプロイ可能な実装を置かず、退役判断と移行readbackだけを残す。

## 現行の正本

- PJ資料室: `/project/<projectId>/workspace` とPJコックピットの資料室タブ
- メタデータ: Supabase `workspace_documents`
- ファイル: private Storage `workspace-files`
- 認可: AMD OSの内部member、PJ限定member、workspace accountの明示的なmembership / grant

旧Project Shareの共有パスワード、許可メール一覧、Vercel Blob、独立Vercel projectは使わない。

## 退役済みインスタンス

| PJ | 旧ホスト名 | 状態 |
|---|---|---|
| SX | `sx.team-armada.jp` | 退役済み |
| ZMP | `zmp.team-armada.jp` | 退役済み |
| VSX | `vsx.team-armada.jp` | 退役済み |
| CX | `cx.team-armada.jp` | 退役済み |
| SE | `se.team-armada.jp` | 退役済み |
| KUTE | `kute.team-armada.jp` | 退役済み |

これらのホスト名とProject Share方式は再利用しない。

## 2026-08-26 readback

- ZMP: 旧Blob 28件をp19へ移行済み。
- VSX: 旧Blob 4 object（3 file + folder marker）と、p26の移行済み3 file + 1 folderを照合済み。
- CX: 旧Blob 0 object。p20の現行`workspace_documents` 14件を確認済み。
- SE: 旧Blob 0 object。p10の現行`workspace_documents` 7件を確認済み。
- KUTE: 旧Blob 6 object（4 file + 2 folder marker）と、p25の移行済み4 file + 2 folderを照合済み。
- VSX / CX / SE / KUTEのVercel projectとBlob storeは削除済み。各旧URLが404を返すことを確認済み。

DNSの最終readbackは[`HANDOFF.md`](HANDOFF.md)に残す。過去の設計はGit履歴にあり、現行仕様として復元しない。
