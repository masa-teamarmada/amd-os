# -*- coding: utf-8 -*-
# 使い方: python3 scripts/sps_batch/show.py <pNN.json> <index>
# prepare 出力の 1 件だけを表示する。並列運用では「1 件表示 -> その 1 件の add() を書く」を
# 厳密に繰り返す。まとめてダンプすると文脈が膨らんで seed_id の後半が失われる。
import io, json, sys

d = json.load(io.open(sys.argv[1], encoding="utf-8"))
i = int(sys.argv[2])
x = d["inputs"][i]
f = x["source_facts"]
s = f["seed"]
print("IDX", i, "/", len(d["inputs"]))
print("SEED_ID", x["seed_id"])
print("lane:", s.get("domain_lane"), "| status:", s.get("status"),
      "| trl:", s.get("trl"), "| brl:", s.get("brl"), "| hrl:", s.get("hrl"))
print("org:", s.get("org_name"))
print("title:", s.get("title"))
print("summary:", (s.get("summary") or "")[:900])
print("keywords:", s.get("keywords"), "| industry:", s.get("industry_target"))
for k in ("funding", "news", "projects"):
    v = f.get(k) or []
    if v:
        print(k + ":", json.dumps(v, ensure_ascii=False)[:600])
