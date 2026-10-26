"""Start two hidden, local-only processes. No cloud credentials or paid APIs."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser

from setup_runtime import VERSION, runtime_root

APP_URL = "http://127.0.0.1:17840"
AI_URL = "http://127.0.0.1:11439"
MODEL = "qwen3:4b-instruct"
TRANSPORT = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def get_json(url, timeout=2):
    with TRANSPORT.open(url, timeout=timeout) as response:
        return json.load(response)


def running(url):
    try:
        with TRANSPORT.open(url, timeout=2) as response:
            return response.status == 200
    except (OSError, urllib.error.URLError):
        return False


def launch(command, log, env):
    flags = subprocess.CREATE_NO_WINDOW | subprocess.DETACHED_PROCESS if os.name == "nt" else 0
    with log.open("ab") as output:
        process = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=output, stderr=output,
                                   env=env, creationflags=flags, cwd=Path(__file__).resolve().parent)
    return process.pid


def wait_for(url):
    for _ in range(80):
        if running(url):
            return
        time.sleep(0.25)
    raise SystemExit("Local process did not start. Check the protected runtime log.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pull", action="store_true", help="Download the selected model from the official registry")
    parser.add_argument("--open", action="store_true", help="Open the local screen")
    args = parser.parse_args()
    root = runtime_root()
    runtime = root / f"ollama-{VERSION}"
    if not (runtime / "verified-release.json").exists():
        raise SystemExit("First run setup_runtime.py.")
    (root / "logs").mkdir(parents=True, exist_ok=True)
    # Do not pass provider/API credentials from the user's shell to the service.
    env = {key: value for key, value in os.environ.items() if key.upper() in {
        "PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "USERPROFILE", "LOCALAPPDATA", "APPDATA",
        "PROGRAMDATA", "PROGRAMFILES", "PROGRAMFILES(X86)", "COMSPEC", "PATHEXT", "HOMEDRIVE", "HOMEPATH"}}
    env.update({"OLLAMA_HOST": "127.0.0.1:11439", "OLLAMA_MODELS": str(root / "models"),
                "OLLAMA_NO_CLOUD": "1", "OLLAMA_CONTEXT_LENGTH": "8192", "OLLAMA_NUM_PARALLEL": "1",
                "OLLAMA_MAX_LOADED_MODELS": "1", "OLLAMA_DEBUG": "0", "PYTHONUTF8": "1"})
    if not running(AI_URL + "/api/version"):
        pid = launch([str(runtime / "ollama.exe"), "serve"], root / "logs/ollama.log", env)
        (root / "ollama.pid").write_text(str(pid), encoding="ascii")
        wait_for(AI_URL + "/api/version")
    version = get_json(AI_URL + "/api/version").get("version")
    if version != VERSION:
        raise SystemExit("The dedicated AI port belongs to another runtime. Startup stopped.")
    if not running(APP_URL):
        pid = launch([sys.executable, str(Path(__file__).with_name("server.py"))], root / "logs/server.log", env)
        (root / "server.pid").write_text(str(pid), encoding="ascii")
        wait_for(APP_URL)
    print("Local screen ready: " + APP_URL, flush=True)
    if args.pull:
        print("Downloading local Qwen3 4B Instruct (approximately 2.5 GB); no input documents are uploaded.", flush=True)
        request = urllib.request.Request(AI_URL + "/api/pull", data=json.dumps({"model": MODEL, "stream": False}).encode(),
                                         headers={"Content-Type": "application/json"})
        with TRANSPORT.open(request, timeout=3600) as response:
            result = json.load(response)
        if result.get("status") != "success":
            raise SystemExit("Model download did not complete.")
        models = get_json(AI_URL + "/api/tags").get("models", [])
        model = next(item for item in models if item.get("name") == MODEL)
        (root / "model-receipt.json").write_text(json.dumps({"name": MODEL, "digest": model["digest"],
            "size": model["size"], "source": "https://ollama.com/library/qwen3:4b-instruct"}, indent=2), encoding="utf-8")
        print("Model installed and digest recorded.", flush=True)
    if args.open:
        webbrowser.open(APP_URL)


if __name__ == "__main__":
    main()
