# ---- 出力 ----
OKU = 100000000
TUPLE = {"model_version":"sps-ind-tier0-v1","measure_version":"sps-ind-v1","q_model_version":"q-eval-v2",
         "q_ruleset_version":"rubric-v1.1","p_model_version":"p-ind-v1","assessment_ruleset_version":"rubric-v1.1+ind-v1"}
prep = json.load(io.open(sys.argv[1], encoding="utf-8"))
prep_ids = [x["seed_id"] for x in prep["inputs"]]

props = []
for it in ITEMS:
    pl = it["pl"] * OKU; pu = it["pu"] * OKU
    ql = it["ql"]; qu = it["qu"]
    assert len(it["ev"]) == 11, (it["sk"], len(it["ev"]))
    ev = []
    for fid, (d, t, a) in zip(ORDER, it["ev"]):
        assert d in ("down","up","widen","neutral"), d
        assert len(t) <= 500, (fid, len(t))
        assert a is None or len(a) <= 240, (fid, a)
        ev.append({"id": fid, "name": FN[fid], "direction": d, "evidence": t, "assessment": a})
    p = {"seed_id": it["seed_id"]}
    p.update(TUPLE)
    p.update({
        "stage_lower": it["sl"], "stage_upper": it["su"], "stage_tag": it["tag"],
        "q_lower_pct": ql, "q_upper_pct": qu,
        "p_lower_yen": pl, "p_upper_yen": pu,
        "sps_lower_yen": math.floor(pl * ql / 100 + 0.5),
        "sps_upper_yen": math.floor(pu * qu / 100 + 0.5),
        "q_main_factor": it["mf"], "p_class": it["pc"], "q_evidence": ev,
        "notes": it["notes"] + " " + SIG,
        "semantic_key": it["sk"], "proposal_summary": it["ps"],
    })
    for k, lim in (("stage_tag",60),("q_main_factor",120),("p_class",160),("notes",1500),("semantic_key",240),("proposal_summary",1000)):
        assert len(p[k]) <= lim, (it["sk"], k, len(p[k]))
    props.append(p)

out = {"version": 1, "contract": "amd-os-sps-initial-assessment-v1",
       "prompt_hash": prep["prompt"]["hash"], "prepared_hash": prep["prepared_hash"], "proposals": props}
io.open(sys.argv[2], "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False, indent=1))
print("proposals:", len(props))
miss = [s for s in prep_ids if s not in [p["seed_id"] for p in props]]
print("prepared seeds not covered:", len(miss), miss)
