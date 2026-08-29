# HANDOFF

最終更新: 2026-08-29 JST
対象: **3本。C はこのセッションで完了（未解決なし）、A は確認1件が残り、B が次の着手先**

- **C. マニュアルのつくよみ Q&A が全質問で0件だった件** — 直して本番反映済み。未解決なし（下記）
- **A. ホーム（`/dashboard`）の作り直しと、見込みPJの統合** — 完了。残るのはまさへの確認1件だけ（下記）
- **B. シーズの産業創出価値（BZM 3.0）** — 入力は埋め切った。組織の**OS側の器**もできた（2026-08-28〜29）。
  **次はモデル本体の2点に着手する**

---

# C. マニュアルのつくよみ Q&A（2026-08-29・完了）

まさ「マニュアルページに設置してるつくよみBOTが全然機能しない。何を聞いても見つからん、わからんって言われる」。

原因は Gemini ではなく、質問文から検索語を取り出す側。日本語の切れ目を助詞の位置だけで見ていたため、
「支払フローってどこにある？」のような口語は文全体が1語になり、42章すべてが 0 件。文脈が空のまま生成へ進み、
プロンプトの指示どおり「見つけきれなかった」と答えていた。旧コードで口語15問すべてが 0 件だったことを実測で確認。

直した内容と検証は [design_log/sessions_2026-08.md](pwa/design_log/sessions_2026-08.md) の「2026-08-29」節、
教訓は [BUGS.md](pwa/BUGS.md) の同節、挙動の正本は [manual/3-3](pwa/manual/3-3-notifications-and-tsukuyomi.md)「マニュアル限定つくよみ Q&A」。
本番 `https://amd-os-pwa.vercel.app` で同じ質問を叩いて回答を確認済み（`0642ac7e` / `5a9c44ef`）。

**未解決なし。** 残る改善余地は1つだけ: マニュアル本文が英語表記の語（`Venture Map` など）は日本語で聞かれると
本文検索に当たらず索引案内どまり。当たりを増やすなら `pwa/src/app/(app)/manual/manual-chapters.ts` の
`topics` / `screens` へ日本語の別名を足す（今回はやっていない）。

---

# A. ホームの作り直しと、見込みPJの統合（2026-08-27〜28・完了）

まさ「４カラムになっててメディア掲載と写真とマイページが被ってカオスになってる。トップページ全体の構成を練り直してほしい」から始まり、
PJポートフォリオの中身、見込みPJの扱い、売上原価の横引き廃止まで広がった。本番反映済み（**v3.99.0**）。

実装の詳細と教訓は [design_log/sessions_2026-08.md](pwa/design_log/sessions_2026-08.md) の「2026-08-27〜28」節、
事故は [BUGS.md](BUGS.md) の同節、確定仕様は [FEATURE_REGISTRY.md](pwa/design/FEATURE_REGISTRY.md) `## /dashboard` と
[manual/4-5](pwa/manual/4-5-management-score-and-finance-simulation-spec.md)。

やったこと（要点だけ）:

1. **重なりの解消** — `sticky` の可動域は grid コンテナ全体。2カラム grid の中の `col-span-2` が右カラムに覆われていた。grid の外へ出し、guard で `col-span-2` を禁止した
2. **会社の記録を作り直し** — 4カラム（約9,600px）→「写真を全幅で先頭 + 3列の内部スクロール」（1,031px）。9本のクエリを `/api/dashboard/company-content` へ一本化し参照系3層キャッシュを通した。英字と生値を日本語へ
3. **PJポートフォリオ** — 「研究ポートフォリオ」から改名。3列（研究機関PJ / シーズPJ / 事業会社PJ）。**PJ化した瞬間にリストから消える絞り込みだった**のを直した
4. **由来の欠けていたPJ** — UST(p23)を東京科学大学へ、AER(p14)の元シーズ（株式会社aerota）を新規登録。由来要確認 7件→5件
5. **見込みPJ3本を統合** — p32→p21 SX、p33→p20 CX。p34 PSI Step2 はPJが未定なので会社の臨時収入（spot）へ。3本とも削除
6. **売上原価の横引きを廃止** — `carryForwardExternalByPj` を撤去。消える分（p19 ZMP 月137,280円）は台帳へ明示

**検証**: 統合の前後で27ヶ月ぶんを突き合わせ、会社全体の売上 ¥53,014,535 と外部メンバー支払 ¥5,610,758 が**1円も動かない**ことを確認
（`pwa/scripts/pj_merge_snapshot.mts` の before/after/diff、スナップショットは `pwa/scripts/__snapshots__/pj_merge_20260827/`）。
そのあと PSI Step2 を spot へ移したので、いまは売上高だけ年間480万減っている（利益とキャッシュは変わらず）。

## A の未解決（まさへの確認1件）

**PSI Step2 の月40万を、売上高に出すかどうか。** いまは臨時収入なので売上高には出ず、経常利益とキャッシュにだけ入る。
「どちらか採択されるか未定」の見込みなので売上高に混ぜない方が正直だが、まさが来年度の収入見込みを売上高で見たいなら別の持ち方が要る。
採択先が決まったら、`company_budget_inputs` の `sp-psi-step2-YYYYMM` を消して、そのPJの `billing_cycles` へ移す。

**スマホ幅は未確認**（まさ「スマホはswift版しか使ってないよ」で対象外）。

A の続きをやるときの引っ越しプロンプト: [SESSION_MIGRATION_PROMPT_DASHBOARD_2026-08-28.md](SESSION_MIGRATION_PROMPT_DASHBOARD_2026-08-28.md)
（UX/UI監査で挙がって未対応のもの — z-index のトークン化、モーダル挙動の統一、PJ一覧のモバイル分岐 — もそこに書いてある）。

---

# B. シーズの産業創出価値（BZM 3.0）

## 今回のセッション（2026-08-27〜28）

**21件の入力を OS の全データ・まさからの聞き取り・ネット調査から埋め、天井を SAM で組み直して画面へ戻した。**

1. **棚卸し** — `project_id` を持つ165テーブルのうち99を読み、66を理由つきで読まないと決めた（[INVENTORY.md](model/cases/INVENTORY.md)）
2. **空欄をゼロに** — 全21件・全12項目に値と根拠。根拠はパラメータ1件ずつの欄へ（migration 332）
3. **天井を TAM → SOM → SAM** — シェアは天井に入れない（モデル側の取り分が担うので二重計上）
4. **金額を画面へ戻した**（`BZM30_SCORES_PUBLISHED = true`）

スコアの一覧と読み方は [model/cases/SCORES.md](model/cases/SCORES.md)、実装の履歴は
[design_log/sessions_2026-08.md](pwa/design_log/sessions_2026-08.md)、事故は [BUGS.md](BUGS.md)。

**いまの上位**: OptQC 574億 / LiSTie 154億 / マテリアル・コンセプト 88億 / CryoX 74億 / JOYCLE 45億。
**下位**: 翔エンジニアリング 4,949万 / ORLIB 3,547万 / 熱電 532万 / ZEO 203万 / r3kt 37万。

## 組織の器（2026-08-28〜29・完了、モデル本体は未着手）

まさ「SXの経営ハイライトに、杉浦先生の対人の壁の話が書かれちゃってる。これどうみても経営ハイライトじゃなくない？
…スコア詳細タブの中に『組織』のコーナーを作って、そこにこういう情報を入れておこうよ」。

**モデル台帳が §6.B・§6.C で定義済みの観測を、OS が受け取る場所が無かった**ので作った。本番反映済み（v3.99.1）。

- スコア詳細タブの最下段に《組織》— 担い手の八機能 / 人・組織の観測 / メンバー の3ブロック
- 八機能の一覧は画面に書き写さず正本 §6.B-1 の表から実行時に読む。判定条件のずれは `npm run check:team-function-contract` が検出
- 記録が薄い PJ は「空席」ではなく「未記帳」（§6.C-3 の3。記録の薄さを悪材料と混同しない）
- 負の観測（重し）は正本に無い拡張。**充足へは数えず画面に併記するだけ**
- 人の性質・組織の状態を経営ハイライトへ入れない線引きを spec 3-6 と L9 抽出 SKILL へ。4PJぶんを移設

**$e$ の感度を実測して、この案件では $e$ がほとんど効かないことが分かった**（0.2〜0.8 で金額13〜14億円）。
ORLIB に続く2例目で、提案の優先順位3（八機能の充足）の論拠になる。提案 md に追記済み。

詳細は [design_log/sessions_2026-08.md](pwa/design_log/sessions_2026-08.md) の「2026-08-28〜29」節、
正本は [spec/4-9](pwa/spec/4-9-project-org-section-current-spec.md)、教訓は [BUGS.md](pwa/BUGS.md) の同節。
続きの引っ越しプロンプト: [SESSION_MIGRATION_PROMPT_ORG_SECTION.md](SESSION_MIGRATION_PROMPT_ORG_SECTION.md)

## いま止まっているところ

**まさ 2026-08-28「組織の評価ができていないことと『これ以上ゲートを越えない』の両方をモデルに入れるところに着手しよう」。
これが次のタスク。** 提案は書いてある（未承認）: [model/proposals/2026-08-28_bzm30-organization-input.md](model/proposals/2026-08-28_bzm30-organization-input.md)
**OS 側の器は上のとおりできているので、残っているのはモデル本体の改訂だけ。**

優先順位（提案の中で更新済み）:

1. **変換能力 $c$ を案件ごとに受け取る（提案7）** — **正本の要件1に挙げた量が実装に入っていない。**
   $c$ は「投入資源あたりに前進を生む速さの乗数」（§5.3）、つまり
   **案件が持っている戦略余力（設立後の資金と、資金以外の余力）をどれだけ前進へ変換できるか**。
   §5.3 に測り方（投入した資金と月数に対して越えたゲートの数の比）まで書いてあるのに、
   参照実装は `cNodes` を全案件共通で回すだけ。ゾンビ化（これ以上ゲートを越えない）も $c$ で表せる。
   **まさの拡張**: この考え方を設立前に獲得した資金にも当てはめ、その資金がどれだけ案件の資産
   （知財・試作・データ・人）へ変わったかで $c$ を推し量る。実装は `cNodes` の差し替えだけで軽い
1-2. **戦略余力の、資金以外の部分（提案8）** — **要件2の「金だけではない」が実装に入っていない。**
   参照実装の戦略余力は資金の残高だけ。大学の設備を使える権利、共同研究先が負担する工数、
   引き当てられる人、応募できる公的支援の枠が入らない。**設立前の案件で効く。**
   資金へ換算して足す案なら実装が要らず、換算の規約を決めるだけ
2. **案件ごとのバーンレート（提案6）** — 実績が既定の2〜37倍ずれている。値は `burn_rate_yen_month` に入っている
3. **八機能の充足（提案1〜3）** — 組織の中心。**機能2（技術の核）が「空席にならない」と規約で固定**されていて、
   ORLIB の「誰も電池を作れない」を表せない。計算量が2倍（1件5〜6分）
4. **権利残件に資本の種類（提案5）** — SHA未締結・支配権の集中。実装は軽いが設計の判断が要る
5. **機能の補完性（提案4）** — CEOとCTOの関係、チームの一体感。較正の材料が無いので乗数から

## まさの判断待ち

1. **休眠の承認** — `model/proposals/2026-08-27_bzm30-dormancy.md`（別セッションが起票、**未承認**）。
   「会社化前の資金切れでは死なない。研究室は大学の基盤で存続し、次の公的資金を待つ」という改訂。
   **未承認なので、いまの算出は承認済みの版（`git show 40aebfe9:model/tools/bzm30_forward.cjs`）で走らせている。**
   承認されると会社設立前の6件（CryoX・SolvioraX・VasculaX・KENQ・ZEO・熱電）の残高の感度が消えるので、全件やり直しになる
2. **組織の入力の提案7件**（上記）
3. **置き換え分の割合** — p21 SolvioraX 7割・p02 r3kt 8割・p05 マテリアル・コンセプト 5割はいずれも暫定。純増が2〜4倍動く
4. **旧SPS の DB データ（`seed_screening_bands` 998行）を物理削除するか** — 画面からは消えている

## この作業で分かった、OS の運用の穴

**開催日を過ぎても中身が空の会議カードが26件・10PJ分**（2026-07-09〜08-26）。
LiSTie 8/26経営会議、SolvioraX経営会議、CLG取締役会を含む。議事録はNotionにあるのにカードが更新されていない。
塞ぐための別セッション用プロンプトは [SESSION_PROMPT_MEETING_CAPTURE.md](SESSION_PROMPT_MEETING_CAPTURE.md)。

**`NOTION_API_KEY` はローカルの `.env.local` に無い**ので、手元のセッションからNotionを取りに行けない。

## 分担（まさ確定 2026-08-27）

- **別セッション**: BZM 3.0 のモデル本体（参照実装・正本・自動算出の設計 `pwa/spec/5-12`）
- **このセッション**: 現状のモデルでパラメータを埋める → **今回で完了。次はモデル本体側へ着手する**

同じ checkout を5〜10セッションが共有している。長い計算の前後で `git log --oneline -5 origin/main` を見る。
計算の入力になる `model/tools/bzm30_forward.cjs` が変わっていたら計算をやり直す。

## 最初の次アクション

`model/proposals/2026-08-28_bzm30-organization-input.md` の**提案7（変換能力 $c$）から着手する。**
`model/MODEL_VERSION_LEDGER.md` の §5.3 と §6.I-9-1 を読み、`cNodes` を `init.c` で差し替える形を実装して、
21件に $c$ を置いて再計算する。まさの承認を取ってから正本へ統合する（`model/README.md` (c) の手順）。

## 検証（このセッションで実際に走らせたもの）

```
cd pwa && npx tsc --noEmit
npx eslint <触ったファイル>
npm run build                         # exit 0
npm run test:critical-ui              # pre-commit で強制的に走る
npm run test:reference-data-cache
npm run test:seed-list-display / test:current-sps-only / test:seed-screening-bands
node pwa/scripts/model_lock.cjs relock --approval <id>   # モデル正本を触ったとき
```

算出: `node model/tools/bzm30_score_seeds.cjs <seed_id> --impl /tmp/bzm30_forward_approved.cjs`（1件0.5〜6分・並列6）。
承認済みの版は `git show 40aebfe9:model/tools/bzm30_forward.cjs > /tmp/bzm30_forward_approved.cjs` で取り出す。
表の貼り替えは `node model/tools/bzm30_scores_md.cjs` の出力を `model/cases/SCORES.md` へ。

本番は `https://amd-os-pwa.vercel.app`。push すると Vercel が自動でデプロイする。
`curl -s https://amd-os-pwa.vercel.app/api/build-info` で `git_sha` を確認する。
