# APPROVALS.md — まさ承認の記録台帳

このファイルは `model/` 配下のモデル正本（および `model/LOCK.json` にロック対象として
列挙されたファイル）を変更してよいという、まさの承認だけを記録する。

## 運用

- エントリ形式は次の通り、日付が変わった同日内の複数件は連番で区別する。

  ```
  ## YYYY-MM-DD-N

  日付: YYYY-MM-DD

  引用:
  > (まさの発言をそのまま引用する。要約や言い換えをしない)

  対象ファイル:
  - path/to/file1.md
  - path/to/file2.md

  反映commit: (未反映なら「(未反映)」、反映後に司令塔がハッシュを追記)
  ```

- 「対象ファイル」に列挙したパスが、そのままロック対象（`model/LOCK.json` の `files[]`）に
  入る。`node pwa/scripts/model_lock.cjs relock --approval <id>` はこのセクションのパス一覧を
  読み取って `LOCK.json` を再生成する。パスはリポジトリルート（`amd-os/`）からの相対パスで書く。
- 承認の引用を要約・翻訳・創作しない。まさが実際に書いた／言った言葉をそのまま貼る。
- このファイルへの追記は、まさの承認が実際にあった場合だけ行う。提案段階では書かない。

---

## 2026-08-22-1

日付: 2026-08-22

引用:
> その４層でいいので実装進めて。式の各変数をクリックすると、その変数の説明箇所に飛ぶようにしてほしい。参考文献はリンク付きで記載すること。

> こないだみたいに新しいP^PJみたいな概念を勝手に持ち出すことがないように、このOSのモデルのところを正本にして、そこを変更するような場合には、その変更をおれに提案して、それが受け入れられない限りはOS上のモデルだけを参照するような仕組みも作ってほしい。

対象ファイル:
- bzm/sps-2-0-reachability-model.md
- bzm/sps-2-0-domain-definition.md
- bzm/sps-2-0-measurability-gate.md
- bzm/SPS_NAT_VALUE_MEASURE_PROPOSAL_2026-08-16.md
- bzm/SEED_Q_RUBRIC_2026-08-15.md
- bzm/terminology_glossary.md
- bzm/bzm-2-2-strategic-slack-and-propulsion.md
- bzm/bzm-2-1-dynamic-business-value-model.md
- bzm/BZM_2_0_DIAGNOSTIC_SCORE_SPEC.md
- bzm/bzm-1-0-to-2-1-evolution-guide.md
- model/MODEL_VERSION_LEDGER.md
- model/CURRENT.json

反映commit: (司令塔が追記)
