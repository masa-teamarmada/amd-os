"""Curated display facts; source prose and graphs remain the evidence."""
import copy
import json
import os
from pathlib import Path

base = Path(os.environ["AMIE_EFFLUENT_EVIDENCE_DIR"])
data = json.loads((base / "照合済み廃液一覧.json").read_text())
empty = dict(element_symbols=[], water_types=[], changes=[], weather="unknown", weather_reason="", analysis_note="")
facts = {}
def c(parameter, before, after, time="", note=""):
    return dict(parameter=parameter, before=before, after=after, time=time, note=note)
def put(slug, elements=(), types=(), weather="unknown", reason="", changes=(), note=""):
    for change in changes:
        unconfirmed = any(word in change['after'] for word in ['未','不明','再試験','きれい'])
        change['effect'] = 'unknown' if unconfirmed or weather in ['unknown','cloudy'] else 'worsened' if weather=='storm' else 'limited' if weather=='rain' else 'improved'
    facts[slug] = dict(element_symbols=list(elements), water_types=list(types), changes=list(changes), weather=weather, weather_reason=reason, analysis_note=note)

put("okayama_b", ["Cu","Zn","Mg"], ["metal"], "storm", "Mgが増加", [c("Cu","含有","取込み不良","24時間"),c("Mg","含有","液中へ放出","24時間")], "Feは定性分析で不検出。油分あり")
put("okayama_d", ["Fe","Mn","Cu","Mo"], ["metal"], "rain", "Fe取込み不良", [c("Fe","含有","取込み不良","24時間")], "油分あり。Mn・Cu・Moの濃度推移は元図を参照")
for slug in ["aichi_1","aichi_6"]:
    put(slug,["Zn"],["metal"],"clear","Znゼロの報告",[c("Zn","含有を確認","ゼロ（報告）","3〜6時間")])
put("aichi_4",["Zn"],["metal"],"sunny","図に残存値",[c("Zn","含有を確認","微小な残存","3〜6時間","本文はゼロと報告")])
put("mate_nd_raw",["Nd"],["metal"],"clear","Nd検出限界以下",[c("Nd","6 ppb","検出限界以下","30分")])
put("kuroki_indigo",["Cu","Zn"],["colored","metal"],"sunny","金属濃度が低下",[c("Cu/Zn","含有","濃度低下","","定量値は元図"),c("色","着色","脱色は未評価")])
for slug in ["kuroki_sulfur","seishoku_dye"]:
    put(slug,[],["colored","metal"],"sunny","金属取込みの報告",[c("金属","含有","取込みの報告","","元素別数値未記載"),c("色","着色","脱色は未評価")])
put("okabe",[],[],"cloudy","CODは未測定",[c("COD","2,000","処理後未測定"),c("pH","5","約8","43時間")])
put("nihon_shokken",[],[],"cloudy","処理効果未測定",[c("pH","4.3","処理後未測定"),c("増殖","対照と比較","明瞭な差なし","77時間")])
put("kishimoto_cutting",[],["metal"],"cloudy","分析結果待ち",[c("菌体","窒息死","前処理後は元気","","金属分析は未収録")],"Fe・Mo・Cr等は2社の試料の共通説明。個別試料への元素対応は未照合")
put("sample_a443c95c",[],["metal"])
put("sample_ec761df8",[],["metal"])
put("zeon_water",["Ni"],["metal"],changes=[c("Ni","数百 ppm","処理結果未収録")],note="Pb・Mn・Cr・Alは系統によって含まれるとの説明。今回の採取系統は未確定")
put("advantech_first",changes=[c("COD","約11万 mg/L","処理後未測定")])
put("advantech_second",changes=[c("COD","3,800〜5,000","処理後未測定","","mg/L"),c("BOD","約1,000","処理後未測定")])
put("sumitomo_factory",["Ni","Cu","Al","N","P","Na"],["metal"],note="工場排水の性状説明。採取試料の個別定量値は未確認")
put("marutomo_wakame",["P"],["colored"],changes=[c("色","緑色着色料","処理結果未収録")],note="工場排水の性状説明。採取試料の個別定量値は未確認")
put("marutomo_dashi",changes=[c("塩分","最大20%","処理結果未収録")])
put("nimame_unidentified",["Fe"],["colored","metal"],"sunny","Fe除去の報告",[c("Fe","初期濃度不明","全量除去の報告"),c("色","黄色","別の色へ変化")])
put("iron_unidentified",["Fe"],["metal"],"cloudy","定量値未確認",[c("pH","2","中性化の報告"),c("Fe","初期濃度不明","きれいとの報告")])
put("iron_reactor_unidentified",["Fe"],["metal"],"sunny","Fe 0.09 ppm",[c("Fe","初期濃度不明","0.09 ppm","約1時間","10 L試験")])
put("cadmium_unidentified",["Cd"],["metal"],"cloudy","pHのみ確認",[c("pH","5.64","7","1時間"),c("Cd","初期濃度不明","処理後濃度不明")])
put("fuel_unidentified",["N","S"],["colored"],"cloudy","培養観察のみ",[c("菌体","培養開始","約4倍","1日"),c("N/S","酸化物を含む","処理後濃度不明")])
put("sim_cr",["Cr"],["metal"],"sunny","濃度低下",[c("Cr","約10 ppm","約0.5 ppm","24時間","元図の概読値")])
put("sim_cd",["Cd"],["metal"],"sunny","濃度低下",[c("Cd","約20 ppm","約0.5 ppm","24時間","元図の概読値")])
put("sim_pb",["Pb"],["metal"],"cloudy","比較条件不足",[c("Pb","株ごとに異なる","同条件で再試験")])
put("sim_fe",["Fe"],["metal"],"clear","50 ppm全量取込み",[c("Fe","50 ppm","全量取込み","24時間"),c("pH","2.6","6.2")])
put("sim_nd_dy",["Nd","Dy"],["metal"],"sunny","ほぼ取込みの報告",[c("Nd/Dy","初期濃度不明","ほぼ取込み","1時間以内")])
facts["okayama_b"]["changes"][0]["effect"]="limited"
facts["nimame_unidentified"]["changes"][1]["effect"]="unknown"

data["topic"]["title"] = "実験・評価一覧"
data["topic"]["tech_domain"] = "実験・評価"
for record in data["rows"]:
    record["entry"]["experiment"]["visual"] = copy.deepcopy(facts.get(record["slug"],empty))
    if record["slug"] == "okayama_b":
        record["entry"]["experiment"]["components"] = "銅・亜鉛・マグネシウム・油分"
(base / "視覚表示の照合済み一覧.json").write_text(json.dumps(data,ensure_ascii=False,indent=2))
# 初回seed用のレビュー入力にも同じ事実を持たせる。適用済みSQLは履歴のまま。
fixture_path=Path("pwa/scripts/data/amie_sol_effluent_ledger_20261014.json")
fixture=json.loads(fixture_path.read_text())
fixture["topic"]["title"]=data["topic"]["title"]
fixture["topic"]["tech_domain"]=data["topic"]["tech_domain"]
for dst,src in zip(fixture["rows"],data["rows"]):
    assert dst["slug"]==src["slug"]
    dst["entry"]["experiment"]["visual"]=src["entry"]["experiment"]["visual"]
    dst["entry"]["experiment"]["components"]=src["entry"]["experiment"]["components"]
fixture_path.write_text(json.dumps(fixture,ensure_ascii=False,indent=2)+"\n")
print(json.dumps({"rows":len(data["rows"]),"withCuratedVisualFacts":len(facts)}))
