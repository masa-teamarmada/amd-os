# Project Share 退役Handoff

Last updated: 2026-08-26 JST

## 完了済み

- SX / ZMP / VSX / CX / SE / KUTEのProject Shareを全廃。
- VSX / CX / SE / KUTEのVercel projectとprivate Blob storeを削除。
- 旧URL `vsx` / `cx` / `se` / `kute` / `zmp` がVercel上で404を返すことを確認。
- 移行readback: VSX 4 object、CX 0 object、SE 0 object、KUTE 6 object。移行対象fileはすべて`workspace_documents`とprivate Storageに存在。
- repo内の全Project Share実装、移行helper、旧debug / session promptを削除。

## 残る最終確認

GMOお名前.comのDNSから、次のAレコードだけを削除し、公開DNSで消失をreadbackする。

| host | type | TTL | value |
|---|---|---:|---|
| `vsx.team-armada.jp` | A | 600 | `76.76.21.21` |
| `cx.team-armada.jp` | A | 600 | `76.76.21.21` |
| `se.team-armada.jp` | A | 600 | `76.76.21.21` |
| `kute.team-armada.jp` | A | 600 | `76.76.21.21` |
| `zmp.team-armada.jp` | A | 600 | `76.76.21.21` |

親domain、`www`、`sx`、`tsukuyomi`など他のDNS recordは触らない。TTL中にrecursive resolverが旧値を返す場合は、未削除と混同せずauthoritative DNSも確認する。

## 正本

現行の資料共有はAMD OSのPJワークスペース、`workspace_documents`、private Storage `workspace-files`。旧ホスト名とProject Share方式は再利用しない。
