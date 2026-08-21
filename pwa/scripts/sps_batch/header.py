# -*- coding: utf-8 -*-
import json, io, math, sys
FN = {"unit_economics":"ユニットエコノミクス成立性","capital_intensity":"資本集約度","scale_constraint":"スケール律速の型","reproducibility":"再現性","payer_budget":"誰の財布か","customer_validation_cost":"顧客の検証コスト","regulatory_gate":"規制・認証の関門","alternative_advantage":"代替解との差の桁","social_acceptance":"社会受容性","microtrend_fit":"マイクロトレンド適合","patent_position":"特許の状態"}
ORDER = list(FN.keys())
def E(d, t, a=None): return (d, t, a)
SIG = "評価者: えいみ / rubric v1.1 + ind v1 / 2026-08-22 / 証拠水準Lv0(公開情報のみ)"
ITEMS = []
def add(**k): ITEMS.append(k)
