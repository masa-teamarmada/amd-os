# model/proposals/ — 提案中のモデル変更

ここに置くのは、まだまさの承認を得ていない変更提案だけ。ファイル名は
`YYYY-MM-DD_<件名>.md`、冒頭に状態行 `状態: proposal / 未承認` を必ず入れる。

承認されたら、正本（`bzm/` 配下の該当 md や `model/MODEL_VERSION_LEDGER.md` など）へ反映し、
`model/APPROVALS.md` へ承認記録を追記したうえで `node pwa/scripts/model_lock.cjs relock --approval <id>`
を実行する。ここから承認済みファイルとして自動昇格することはない。

却下された提案は `model/withdrawn/` へ移す。運用手順の全体は `model/README.md` を参照。

`model/LOCK.json` はこの配下のファイルを対象にしない。ここへの書き込みは
`/Users/masa/.claude/hooks/guard_model_canon.py` も止めない。
