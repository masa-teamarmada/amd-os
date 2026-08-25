# Project Share Handoff

Last updated: 2026-08-26 JST

Topic: ZMP退役後のProject Share現在地

## Latest Session Summary

- 現役のProject ShareはVSX / CX / SE / KUTEの4インスタンス。SXとZMPはAMD OSの各PJワークスペースへ統合済みで、Project Shareへ戻さない。
- ZMP旧Blobの28件は、AMD OSのZMPワークスペース`/project/p19/workspace`に移行済み。退役時点で同ワークスペースの`workspace_documents`は30件あり、旧Blobにだけ残る資料がないことを照合した。
- ZMPのVercelプロジェクト`zmp-project-share`、全デプロイ、ドメイン関連付け、専用Blob storeは削除済み。`https://zmp.team-armada.jp`はVercel上で404を返す。
- `services/project-share/zmp`の実装も削除し、現行一覧・SPEC・次回用プロンプトを現役4インスタンスへ更新した。
- GMOお名前.comのDNSには`zmp.team-armada.jp`のAレコードが残っている。管理画面ログイン後、この1レコードを削除し、外部DNSから消えたreadbackをもって完全退役とする。

## Repo / Production State

- ZMPの外部資料共有とテーマ進捗の正本はAMD OSのZMPワークスペースとSupabase。
- ZMP旧Vercelプロジェクトと旧Blob storeは存在しない。復元・再デプロイ・同じサブドメインの再利用はしない。
- 現役4インスタンスはAMD OS PWAとは別サービス。main pushだけで反映されたと判断せず、変更対象のREADMEにある手順で個別に反映する。
- 現役4インスタンスのログイン方式の本番反映状況は、この退役作業では再確認していない。認証変更を行う場合は各インスタンスのREADMEと本番をfreshに確認する。

## Unresolved Tasks

- **ZMP DNSの最終削除**: GMOお名前.comで`zmp.team-armada.jp`のAレコードだけを削除する。親ドメイン`team-armada.jp`や他のサブドメインは触らない。削除直前に対象行をreadbackし、実行確認を取る。
- 削除後、公開DNSで`zmp.team-armada.jp`が解決しないことを確認する。TTL経過中は旧値が返る可能性を残して報告する。

## First Next Action

Chromeのお名前.com管理画面へログインし、`zmp.team-armada.jp`のAレコード1件だけを特定する。対象行のホスト名・種別・値を確認後、まさの削除確認を受けて削除し、公開DNSをreadbackする。

## Pointers

- 恒久仕様: [`SPEC.md`](SPEC.md)
- 全体の運用・PJ境界: [`README.md`](README.md)
- PDF化の低レベルな注意: [`DEBUG.md`](DEBUG.md)
- ZMPの現行ワークスペース: `/project/p19/workspace`
- 次回用の依頼文: [`SESSION_MIGRATION_PROMPT.md`](SESSION_MIGRATION_PROMPT.md)

## OS Manual Gate

- ZMPの現行ワークスペース側の画面・利用者マニュアルはAMD OS PWAの変更として別途更新する。
- Project Share退役そのものは`services/`配下の独立Vercelサービス削除であり、現役4インスタンスの画面仕様は変更しない。
