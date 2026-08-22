# Textbook Field Toolkit layout readability pass

Date: 2026-06-03 JST

## Executive summary

Full-story cold-reader reviewの次surgical orderに沿って、Ch22〜Ch24を本文の続きではなくField Toolkit / 参照道具として見せるため、public manuscript UIに控えめな付録表示を追加した。

本文の大改稿はしていない。Epilogue後に付録へ進む構成は維持した。

## Scope

- `pwa/src/app/(app)/bzm/public/[slug]/page.tsx`
- `pwa/src/app/(app)/bzm/public/PublicManuscriptNav.tsx`
- `pwa/bzm/textbook/COMMANDER_TASKS.md`

## Changes

- Toolkit章を表示しているとき、本文上部に `Field Toolkit / 参照道具` の小さな区切りを出すようにした。
- Toolkit章のarticleにamberの細いtop borderを付け、本編から参照道具へ切り替わったことを視覚的に示した。
- 左ナビのToolkit sectionだけ、控えめなamber surfaceとactive stateに変更した。
- Prologue〜Epilogue本文、Field Toolkit本文、manifest順序は変更していない。

## Acceptance check

- Field ToolkitはEpilogue後の付録として見える。
- 本編の読書体験を邪魔する大きな装飾は入れていない。
- 既存のpublic manuscript manifestは維持。
- code変更ありのためlocal buildを実施した。
- local browser checkはdev server起動後に試行したが、NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 不在によりmiddlewareで500になった。今回差分ではなく、このworktreeのenv不足として記録する。

## Next actions

1. `model exposition placement brief`: 式やモデル説明をどこへ置くか、物語本文とは別に設計する。
2. `route/main integration review`: story polish branchをmainへ取り込む順序とbuild/deploy gateを整理する。
3. `final publication readiness audit`: 販売前copy rhythm、章間疲労、Field Toolkit参照性をまとめて確認する。
