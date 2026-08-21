# -*- coding: utf-8 -*-
# 使い方: python3 scripts/sps_batch/check.py <genNN.py> <pNN.json>
# 1) 構文検査 2) 非日本語文字の混入検査 3) seed_id を prepare 出力の実UUIDへ突合・自動修正
import io, json, re, sys, unicodedata

gen_path, prep_path = sys.argv[1], sys.argv[2]
src = io.open(gen_path, encoding="utf-8").read()
compile(src, gen_path, "exec")

OK_PUNCT = (0x2010, 0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2026,
            0x2212, 0x00b0, 0x00d7, 0x2192, 0x301c, 0x3b3)
bad = set()
for ch in src:
    o = ord(ch)
    if o < 128:
        continue
    if 0x3000 <= o <= 0x30ff or 0x4e00 <= o <= 0x9fff or 0xff00 <= o <= 0xffef or o in OK_PUNCT:
        continue
    bad.add((ch, hex(o), unicodedata.name(ch, "?")))

prep = json.load(io.open(prep_path, encoding="utf-8"))
real = [x["seed_id"] for x in prep["inputs"]]
pre = {r[:8]: r for r in real}
used = re.findall(r'add\(seed_id="([0-9a-f-]+)"', src)
unmatched, fixed = [], 0
for u in used:
    if u in real:
        continue
    if u[:8] in pre:
        src = src.replace('"%s"' % u, '"%s"' % pre[u[:8]])
        fixed += 1
    else:
        unmatched.append(u)
io.open(gen_path, "w", encoding="utf-8").write(src)

used2 = re.findall(r'add\(seed_id="([0-9a-f-]+)"', src)
notcov = [r for r in real if r not in used2]
print("adds:", len(re.findall(r"^add\(", src, re.M)))
print("non-jp:", sorted(bad))
print("seed_id used:", len(used2), "fixed:", fixed, "unmatched:", unmatched)
print("dups:", len(used2) != len(set(used2)), "/ not covered:", len(notcov), notcov)
ok = not bad and not unmatched and not notcov and len(used2) == len(set(used2))
print("RESULT:", "OK" if ok else "NG")
sys.exit(0 if ok else 1)
