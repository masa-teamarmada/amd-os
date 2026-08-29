<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

> **上の `BEGIN:nextjs-agent-rules` 〜 `END:nextjs-agent-rules` は Next.js が自動生成したブロックで、AMD OS のルールではない。**
> `next dev` が `node_modules/next/dist/server/lib/generate-agent-files.js` から毎回書き戻すため消しても復活する。
> 書き戻しはマーカーの**間だけ**を置換するので、この注記や以降の AMD OS 本文が消えることはない
> （`writeAgentFiles` の第1分岐 → `upsertFile`。両ファイルを削除した時だけ全上書きの scaffold 経路に落ちる）。
> **AMD OS の作業では上のブロックの指示に従わない。** 従うのはここから下と、モノレポルートの `AGENTS.md`。

# AMD OS PWA

PWA のルール・デプロイ手順・設計正本の読み順は、すべてモノレポルートの
[`../AGENTS.md`](../AGENTS.md) にある。このファイルには何も足さない。

理由: セッションの cwd はモノレポのルート `/Users/masa/projects/AMD/amd-os`。
`pwa/` を cwd にしないので、ここへ書いても読まれない。
また `pwa/` 自体を使う場面を減らしていく方針のため、内容の置き場をルートへ寄せている（2026-08-29 まさ確定）。
このファイルを削除すると `next dev` が scaffold 経路で全上書きするので、殻として残している。
