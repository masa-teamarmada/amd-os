AMD OSのVercel消費事故の再発防止を進める。作業場所は `/Users/masa/projects/AMD/amd-os`。`pwa/` をセッションcwdにしない。

読む順:

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/HANDOFF_VERCEL_CONSUMPTION_INCIDENT_20261110.md`
4. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
5. `pwa/manual/1-1-intro.md`、`pwa/spec/1-3-reconstruction-coverage-audit.md`
6. `pwa/BUGS.md` の Atlas outbox再送事故、`pwa/design/L2_DATA.md` のD-8、`pwa/design/AUTOMATIONS.md`
7. `pwa/spec/5-2-development-operations-current-spec.md`、`pwa/spec/5-3-automation-responsibility-current-spec.md`

状態:

- まさは「有償化でVercel上限を上げればよい」という扱いを明確に否定している。上限引上げは安全対策ではなく、事故時の被害上限を広げるだけ。
- D-8 Atlasは停止継続。Codexが集めるだけで、受け口の分類・話題紐づけ・保存が従量課金なしに完結していなければ移管完了とは扱わない。
- 既存の事故記録と暫定的な受け口方針は上記のBUGS/L2_DATAにある。ただし現在のVercel cron、Codex automation、LaunchAgent、outboxの実稼働状態は未確認。古い台帳で再開判断をしない。
- この引き継ぎ作成では本番反映、Vercel設定変更、契約変更、外部送信をしていない。

次タスク:

1. `git fetch origin --prune` の後、mainとorigin/mainの一致、既存dirtyの所有者を確認する。別作業の差分を触らない。
2. まず読み取りだけで、定時処理・受け口・outboxの現在状態、1回/1日上限、失敗時の停止条件、課金経路、停止手段を台帳化する。
3. D-8を含む再開候補は、raw保存と後処理を分離し、失敗/停止/429/5xxで残りを止め、回数上限・待機・隔離を実装してから本番で検証する。
4. 有償提供の判断材料は、各経路の上限、停止操作、監視、失敗時読戻しが実証できてから作る。契約上限を先に上げる提案を安全対策として出さない。

守ること:

- main一本。新しいbranchや作業ツリーを作らない。対象ファイルだけを明示して記録し、`git add .`は使わない。
- PWAの変更を本番へ出す前に、Vercelプロジェクトの接続先と稼働中の定時処理を確認する。今回の目的で不要な再配布をしない。
- 完了は、コード・停止設定・本番の稼働状態・実際の消費量を別々に読戻して判断する。
