# Textbook Author Directives

> まさがTextbook司令塔へ直接伝えた思想・現場知・必ず残したい論点を保存する台帳。
> 公開本文へ反映した後も、編集で消えないようにここで追跡する。

## 運用ルール

- まさから直接出た「この話は入れてほしい」「こういう思想を消さないでほしい」という内容は、このファイルへ `author_directive` として保存する。
- 公開本文へ反映する場合も、元の意図、反映先、編集時の注意を残す。
- 編集者workerやrewrite workerは、本文から該当要素を削る前に、この台帳を確認し、削除ではなく移動・圧縮・別章反映として扱う。
- どうしても削る必要がある場合は、理由と代替反映先を `status` に追記し、Textbook司令塔レビューへ回す。
- 公開本文では会社名・個人名・内部運用語を出さず、読者に届く普遍的な現場語へ翻訳する。
- writer/editor workerは、本文rewriteや批評noteの `Acceptance gate` に `author_directive retention` を含める。
- `public_locations` に入っている章からdirective要素を削る場合、同一commit内で移動先を追加するか、run noteに `directive moved to ...` を記録する。
- directiveは「そのままの文言を残す」ではなく、「本の中で消えない問い・場面・判断軸として残す」ことを優先する。

## Directives

### 2026-06-13: 単一候補依存の根本原因は KPI の置き方 — KPI を交渉力に置く

- `source`: まさからTextbook司令塔への直接入力 (戦略余力章プロトタイプのレビュー時)
- `status`: prototype-strategic-slack-chapter.md (rev2) の「なぜ手が緩むのか — KPI が交渉力を壊す」節に一次反映済み。編集時は削除禁止。必要なら章間移動または圧縮で扱う。
- `public_locations`:
  - `pwa/bzm/textbook/prototype-strategic-slack-chapter.md` (型確定後に public-manuscript 第II部へ移設)
- `core_intent`:
  - 「一社よい候補が出てくると他候補の探索を止めてしまう」問題の根本原因は、個人の弱さではなく KPI の置き方にある。
  - 「年内に共同開発を 1 件獲得」のような成果件数 KPI を立てるから、良い候補が出てきた途端に開拓の手を止めることが合理的になってしまう。
  - KPI を交渉力 (= 生きた選択肢の数と質、BATNA) に置いておけば、良い候補が現れても手は緩まない。開拓継続が目標達成行動そのものになる。
- `editing_notes`:
  - 「担当者が怠けた」「気が緩んだ」という個人責任の物語にしない。目標設計の構造問題として書く。
  - 成果 (契約) は「遅れて、しかし良い条件で付いてくる」という順序を保つ。成果軽視と誤読させない。
  - 研究機関の支援部門だけでなく、スタートアップ自身の営業 KPI にも同型の問題があることを示す。

- `source`: まさからTextbook司令塔への直接入力
- `status`: public manuscriptへ一次反映済み。編集時は削除禁止。必要なら章間移動または圧縮で扱う。
- `public_locations`:
  - `pwa/bzm/public-manuscript/00-prologue.md`
  - `pwa/bzm/public-manuscript/01-research-results-are-not-companies.md`
  - `pwa/bzm/public-manuscript/06-incorporation-timing.md`
  - `pwa/bzm/public-manuscript/19-integrated-score-as-next-action.md`
- `core_intent`:
  - 新モデルの根幹には、生存確率、とくに稼げる体質かどうかを見る思想がある。
  - まだ稼げる状態でもないのに、スタートアップ周辺の過熱に押されて早めに起業してしまうケースがある。
  - 早いうちから稼げるようにしておくこと、整っていないなら設立を遅らせることも選択肢として提示したい。
  - 小さく稼げるようになるとJカーブ/IPOの目標を捨てて楽な道を選ぶという批判はあり得る。
  - ただし大半のシーズはJカーブを描けない可能性が高く、すべてを一律にJカーブ/IPOへ向かわせる動きには疑問がある。
- `editing_notes`:
  - 「小銭を稼ぐこと」自体を推奨する章にしない。
  - 「小さな対価が、顧客の痛み・評価条件・予算経路・継続利用可能性を明らかにするか」を見る論点として扱う。
  - Jカーブ/IPOを否定しきらない。狙えるシーズには必要だが、全シーズへ一律適用するのは危うい、というバランスにする。
  - 会社化を遅らせることは逃げではなく、生存確率を上げるためのBefore Zero作業として扱う。
- `next_dramatization_targets`:
  - Ch04〜Ch06では、研究者や若手事業化人材がこの問いを「説明として語る」のではなく、外部CEO要求、開示事故寸前、登記判断の中で体験する場面にする。
  - Ch09〜Ch10では、投資家のNOや企業PoC停滞を、資金調達可否ではなく生存確率を上げるための証拠更新として扱う。
  - Ch19以降では、readiness map / survival conversation / next uncertainty mapとして理論側に再登場させる。
