# Textbook epilogue story close

Date: 2026-06-03 JST

## Executive summary

まさ方針「narrativeベースで物語を書き進め、プロローグ〜エピローグまで完成する」を受け、公開原稿へエピローグを追加した。

目的は、式やモデル説明を後回しにし、今ある物語の声を信じて、本編の読後感を閉じること。

## Changes

- Added `pwa/bzm/public-manuscript/25-epilogue.md`
- Updated `pwa/src/app/(app)/bzm/public/public-manuscript.ts`
- Updated `pwa/bzm/textbook/COMMANDER_TASKS.md`

## Story function

Epilogueは、Prologueの鏡として設計した。

Prologueでは、若い事業化人材が「二年以内に産業実装を目指します」という少し強すぎる一文を書き、研究者がだんだん黙っていく。

Epilogueでは、半年後の別案件で、若い事業化人材が企業へ返す一文を少し弱く戻す。今回は研究者が黙らず、「この文なら、送れます」と言う。

この差分で、本編全体で積み上げた学習、責任導線、弱い事実を弱いまま扱う態度を、物語として閉じた。

## Placement

EpilogueはCh21の後、Field Toolkitの前に置いた。

理由:
- Ch21で本編の機関側の物語が閉じる。
- Epilogueで読後感を閉じる。
- Ch22〜Ch24は物語の続きではなく、読者が持ち帰るField Toolkitとして読ませる。

## Acceptance check

- Prologueの強すぎる一文に呼応する終幕になっている。
- author directiveの生存確率、稼げる体質、早すぎる会社化、一律Jカーブ/IPOへの違和感を、説教ではなく読後の問いとして保持した。
- public forbidden termsを入れていない。
- markdown tableを追加していない。
- manifestにEpilogueを追加したためbuild対象。

## Next actions

1. `full-story readthrough pass`: Prologue〜Epilogueを一気読みし、物語の声、章間の呼吸、余韻を確認する。
2. `epilogue cold-reader review`: 終幕が説明臭くないか、Toolkit前の位置が自然かを確認する。
3. `model exposition placement brief`: 物語を壊さず、後からモデル説明を差し込む位置を設計する。
