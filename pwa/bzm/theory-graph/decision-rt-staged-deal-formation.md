---
id: decision-rt-staged-deal-formation
title: "RTを段階的ディール組成へ変更する"
kind: decision
layer: institution
status: design-choice
summary: "RTは単一のネットワーク強度ではなく、法人化前後をつなぐ段階的な合意形成と契約組成として扱う。法的スポンサーと契約主体、参加者ごとの便益・負担・権限・利益相反、背景IPと成果IP、有償の実現可能性確認、会社化後の更改・移転・終了の順に証拠を記録する。二需要家・自発参加・take-or-payは全案件共通の必要条件にしない。"
source_ref: "BZM_2_0_REVISION_REQUIREMENTS.md#53-rtを段階的ディール組成へ変更する"
relations:
  - type: depends_on
    target: decision-amd-stakeholder-capacity-ledger
  - type: operationalizes
    target: concept-measurement-separation-principle
---

## 内容

RTは、単一のネットワーク強度ではなく、法人化前後をつなぐ段階的な合意形成と契約組成として扱う。次の順に証拠を記録する。

1. 法的スポンサーと契約主体。
2. 参加者ごとの便益、負担、権限、利益相反。
3. 背景IP、成果IP、情報隔壁、公表権。
4. 有償の実現可能性確認、オプション、条件付き発注。
5. 会社化後の更改、移転、終了。

二需要家、自発参加、take-or-payは全案件共通の必要条件にしない。案件類型ごとに成立条件を定める。この設計により、RTは単一のスコアではなく段階ごとの証拠系列として扱われ、他の総合スコアと同様に一つの数へ潰さない測定分離原則の対象になる。
