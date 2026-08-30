#!/usr/bin/env python3
"""bzm/sm_v2/SM-{A..G}.md を連結して bzm/PAPER_P1_SM_V2.md を作る。

統合版は生成物。**手で編集しない。**節を直すときは sm_v2/ 側の該当ファイルを直して
このスクリプトを流し直す。記号・用語・版の共通契約は PAPER_P1_SM_V2_GLOSSARY.md。
"""
import os, sys
BZM = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORDER = list("ABCDEFG")
HEAD = open(os.path.join(BZM, "tools", "sm_v2_header.md"), encoding="utf-8").read()
parts = [HEAD]
for k in ORDER:
    p = os.path.join(BZM, "sm_v2", f"SM-{k}.md")
    if not os.path.exists(p):
        sys.exit(f"missing: {p}")
    parts.append(open(p, encoding="utf-8").read().strip() + "\n")
out = os.path.join(BZM, "PAPER_P1_SM_V2.md")
open(out, "w", encoding="utf-8").write("\n".join(parts))
print(f"wrote {out} ({len(' '.join(parts).split())} words)")
