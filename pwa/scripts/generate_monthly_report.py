#!/usr/bin/env python3
"""
amd-os-l2m1-monthly-report Phase 2.6 PDF 生成実装。

対外提出版 markdown を pandoc → HTML → Chrome headless → PDF に変換する。
Vercel serverless で Puppeteer を回さない方針のため、ローカル (まさの mac) の
Chrome headless を使う。ページ内で明示的な改頁 CSS ( page-break-before 等) は入れない
(= 単一連続文書として、見出しの break-inside: avoid だけで自然に流す)。

使い方:
  python3 generate_monthly_report.py --project-id <pid> --ym <YYYYMM> \
      --markdown <external markdown path or -> --output-dir <local out dir>
"""
import argparse
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Optional

CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
]

PRINT_CSS = """
@page { size: A4; margin: 0; }
body { font-family: -apple-system, "Hiragino Sans", sans-serif; font-size: 10.5pt; line-height: 1.9; color: #0f172a; margin: 0; padding: 15mm 18mm; }
h1 { font-size: 16pt; margin: 0 0 8mm; }
h2 { font-size: 13.5pt; font-weight: 700; margin: 6mm 0 3mm; padding: 2mm 4mm; color: #f8fafc; background: #0a1628; break-inside: avoid; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
h3 { font-size: 12pt; font-weight: 700; margin: 5mm 0 2mm; padding-bottom: 1mm; color: #0a1628; border-bottom: 2px solid #0a1628; break-inside: avoid; }
table { border-collapse: collapse; width: 100% !important; table-layout: fixed; margin: 3mm 0; }
th, td { border: 1px solid #cbd5e1; padding: 1.5mm 2.5mm; font-size: 9.5pt; overflow-wrap: anywhere; }
th:first-child, td:first-child { width: 14%; }
th { background: #f1f5f9; }
p { margin: 0 0 2mm; }
"""


def find_chrome() -> str:
    for path in CHROME_CANDIDATES:
        if Path(path).exists():
            return path
    found = shutil.which("chrome") or shutil.which("chromium")
    if found:
        return found
    raise RuntimeError("Chrome/Chromium headless バイナリが見つかりません")


def markdown_to_html(markdown_path: Optional[Path], html_path: Path, markdown_text: Optional[str] = None) -> None:
    source = "-" if markdown_text is not None else str(markdown_path)
    subprocess.run(
        ["pandoc", source, "-f", "markdown", "-t", "html", "-o", str(html_path), "--standalone"],
        check=True,
        input=markdown_text,
        text=markdown_text is not None,
    )
    html = html_path.read_text(encoding="utf-8")
    html = html.replace("</head>", f"<style>{PRINT_CSS}</style></head>")
    html_path.write_text(html, encoding="utf-8")


def html_to_pdf(chrome_bin: str, html_path: Path, pdf_path: Path) -> None:
    subprocess.run(
        [
            chrome_bin,
            "--headless",
            "--disable-gpu",
            "--no-pdf-header-footer",
            f"--print-to-pdf={pdf_path}",
            str(html_path),
        ],
        check=True,
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-id", required=True)
    parser.add_argument("--ym", required=True, help="YYYYMM")
    parser.add_argument("--markdown", required=True)
    parser.add_argument("--output-dir", required=True)
    args = parser.parse_args()

    markdown_text = sys.stdin.read() if args.markdown == "-" else None
    markdown_path = None if markdown_text is not None else Path(args.markdown)
    if markdown_path is not None and not markdown_path.exists():
        print(f"markdown not found: {markdown_path}", file=sys.stderr)
        sys.exit(1)
    if markdown_text is not None and not markdown_text.strip():
        print("markdown stdin is empty", file=sys.stderr)
        sys.exit(1)

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    ym_hyphen = f"{args.ym[:4]}-{args.ym[4:]}"
    base_name = f"{args.project_id}-{ym_hyphen}"
    html_path = output_dir / f"{base_name}.html"
    pdf_path = output_dir / f"{base_name}.pdf"

    markdown_to_html(markdown_path, html_path, markdown_text)
    chrome_bin = find_chrome()
    html_to_pdf(chrome_bin, html_path, pdf_path)

    print(str(pdf_path))


if __name__ == "__main__":
    main()
