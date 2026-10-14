"""Export PDF image pixels together with their original soft masks."""
import hashlib
import json
import os
from pathlib import Path
import fitz

evidence = Path(os.environ["AMIE_EFFLUENT_EVIDENCE_DIR"])
sol = evidence.parent
manifest_path = evidence / "元グラフ/画像出典.json"
manifest = json.loads(manifest_path.read_text())
sources = {
    "SX 定例報告会_261014.pdf": sol / "261014_SOL定例/SX 定例報告会_261014.pdf",
    "SX 定例報告会_260722.pdf": sol / "FY26/260722_SX定例/SX 定例報告会_260722.pdf",
    "SX 定例報告会_260902.pdf": sol / "260902_SX定例/SX 定例報告会_260902.pdf",
}
archive = evidence / "元グラフ/抽出途中_透過未反映"
archive.mkdir(exist_ok=True)
if not (archive / manifest_path.name).exists():
    (archive / manifest_path.name).write_text(manifest_path.read_text())
for graph in manifest:
    doc = fitz.open(sources[graph["source"]])
    images = [i for i in doc[graph["page"] - 1].get_images(full=True)
              if i[2:4] == (graph["width"], graph["height"])]
    if len(images) != 1:
        raise ValueError(f"Ambiguous original image: {graph['name']}")
    xref, soft_mask = images[0][:2]
    image = fitz.Pixmap(doc, xref)
    if soft_mask:
        if image.alpha:
            image = fitz.Pixmap(image, 0)
        image = fitz.Pixmap(image, fitz.Pixmap(doc, soft_mask))
    output = Path(graph["file"])
    if not graph.get("pdf_soft_mask_preserved") and output.exists():
        output.rename(archive / output.name)
    image.save(output)
    graph["sha256"] = hashlib.sha256(output.read_bytes()).hexdigest()
    graph["pdf_soft_mask_preserved"] = True
    graph["pdf_image_xref"] = xref
    graph["pdf_soft_mask_xref"] = soft_mask
    doc.close()
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
print(json.dumps({"images": len(manifest), "pdfSoftMasksPreserved": True}))
