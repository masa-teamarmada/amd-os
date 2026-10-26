"""Install a pinned, portable Ollama runtime; no paid services or system settings."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import urllib.request
import zipfile

VERSION = "0.40.11"
ARCHIVE_SHA256 = "bda4a493ba8a7c24d57263cd843cd68cee84f44aed4299eeed532acad7eda12a"
URL = f"https://github.com/ollama/ollama/releases/download/v{VERSION}/ollama-windows-amd64.zip"


def runtime_root() -> Path:
    return Path(os.environ.get("LOCALAPPDATA", Path.home() / ".local/share")) / "AMDOS" / "amie-local-ai"


def install() -> None:
    if os.name != "nt":
        raise SystemExit("This installer targets Windows amd64.")
    root = runtime_root()
    root.mkdir(parents=True, exist_ok=True)
    target = root / f"ollama-{VERSION}"
    receipt = target / "verified-release.json"
    if receipt.exists() and (target / "ollama.exe").exists():
        print(f"Verified runtime already installed: {VERSION}", flush=True)
        return
    archive = root / f"ollama-{VERSION}.zip"
    if not archive.exists():
        partial = archive.with_suffix(".download")
        print(f"Downloading official Ollama {VERSION} (approximately 1.6 GB)", flush=True)
        request = urllib.request.Request(URL, headers={"User-Agent": "amie-local-ai-setup"})
        with urllib.request.urlopen(request, timeout=60) as response, partial.open("wb") as output:
            while block := response.read(4 * 1024 * 1024):
                output.write(block)
        partial.replace(archive)
    with archive.open("rb") as source:
        digest = hashlib.file_digest(source, "sha256").hexdigest()
    if digest != ARCHIVE_SHA256:
        raise SystemExit("Runtime checksum mismatch. Archive was not executed or extracted.")
    print("SHA-256 verified; extracting portable runtime", flush=True)
    target.mkdir(exist_ok=True)
    with zipfile.ZipFile(archive) as bundle:
        for member in bundle.infolist():
            resolved = (target / member.filename).resolve()
            if not resolved.is_relative_to(target.resolve()):
                raise SystemExit("Unsafe archive entry; extraction stopped.")
        bundle.extractall(target)
    receipt.write_text(json.dumps({"version": VERSION, "sha256": digest, "source": URL}, indent=2), encoding="utf-8")
    print(f"Portable runtime ready: {VERSION}", flush=True)


if __name__ == "__main__":
    install()
