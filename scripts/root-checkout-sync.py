#!/usr/bin/env python3
"""root-checkout-sync.py — 共有の作業フォルダ（amd-os の main checkout）を origin/main へ追従させる。

背景 (2026-10-03): 作業フォルダが origin/main から 311 件遅れ、別セッションの書きかけ 35 件と
未push commit 3 件が残っていた。セッション開始時の表示 (git_dirty_guard.sh) は「別worker由来は触らない」
と案内するだけで、どのセッションも追従せず clean clone へ逃げたため、遅れと書きかけが数週間たまり続けた。
書きかけの一部は古い版のファイルで、そのまま commit すると後の作業 (事業計画タブの月次試算表など) を消す状態だった。

このスクリプトは失わない操作だけで追従する。
  1. git fetch のあと、書きかけを1件ずつ 3 者 (HEAD / 作業フォルダ / origin/main) で比べる。
       upstream_same     … 作業フォルダの中身が origin/main と同じ
       upstream_contains … 書きかけの差分が origin/main に取り込み済み (3-way merge の結果が origin/main と一致)
       local_only        … origin/main 側はそのファイルを変えていない。追従しても書きかけは残る
       blocking          … 両方が変えていて、書きかけが origin/main に無い
  2. upstream_same / upstream_contains は控えを取ってから HEAD へ戻す (中身は origin/main に既にある)。
  3. 未push commit は、中身が origin/main に含まれる場合だけ追従に巻き込む (merge-tree の木が一致、または全件 patch 等価)。
  4. merge --ff-only (未push commit なし) か reset --keep (含まれる未push commit あり) で origin/main へ進める。
     local_only の書きかけはそのまま残る。

blocking の書きかけと、中身が origin/main に無い未push commit は追従を止める。
それらが --stale-hours 以上動いていない場合だけ「隔離」の対象になる。
  --quarantine dry-run (既定) … 隔離すれば追従できることを報告するだけ
  --quarantine on             … 控え (patch・ファイル写し・git bundle) を取ってから HEAD へ戻し、追従する

控えの置き場: /Users/masa/projects/AMD/amd-os-root-dirty/<日時>/ (README.md に仕分け結果)
記録: ~/Library/Logs/amd-os-root-sync.log、最後の結果: <控えの置き場>/last_status.json

同期の対象は CANONICAL_REPO だけ。別の checkout (automation runtime 等) は報告だけにする。
"""

from __future__ import annotations

import argparse
import datetime as dt
import fcntl
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

# 環境変数は検査用 (使い捨ての clone で同期の挙動を確かめるとき) にだけ使う
CANONICAL_REPO = Path(os.environ.get("AMD_OS_ROOT_SYNC_CANONICAL", "/Users/masa/projects/AMD/amd-os"))
BACKUP_ROOT = Path(os.environ.get("AMD_OS_ROOT_SYNC_BACKUP_ROOT", "/Users/masa/projects/AMD/amd-os-root-dirty"))
LOG_FILE = Path(os.environ.get("AMD_OS_ROOT_SYNC_LOG", str(Path.home() / "Library/Logs/amd-os-root-sync.log")))
BRANCH = "main"
REMOTE_REF = "origin/main"
SAFE_KINDS = ("upstream_same", "upstream_contains")


class GitError(RuntimeError):
    pass


def git(repo: Path, *args: str, check: bool = True, input_bytes: bytes | None = None, timeout: int = 60) -> str:
    proc = subprocess.run(
        ["git", *args],
        cwd=repo,
        input=input_bytes,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=timeout,
        env={**os.environ, "GIT_TERMINAL_PROMPT": "0", "LC_ALL": "C"},
    )
    if check and proc.returncode != 0:
        raise GitError(f"git {' '.join(args)}: {proc.stderr.decode(errors='replace').strip()}")
    return proc.stdout.decode(errors="replace")


def git_ok(repo: Path, *args: str) -> bool:
    return subprocess.run(["git", *args], cwd=repo, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0


def blob_at(repo: Path, ref: str, path: str) -> str | None:
    out = git(repo, "rev-parse", "-q", "--verify", f"{ref}:{path}", check=False).strip()
    return out or None


def worktree_blob(repo: Path, path: str) -> str | None:
    full = repo / path
    if not full.exists() and not full.is_symlink():
        return None
    if full.is_dir():
        return "<dir>"
    return git(repo, "hash-object", "--", path).strip()


def cat_blob(repo: Path, sha: str) -> bytes:
    return subprocess.run(["git", "cat-file", "blob", sha], cwd=repo, stdout=subprocess.PIPE, check=True).stdout


def merge_equals_theirs(repo: Path, path: str, base: str, theirs: str) -> bool:
    """書きかけ (ours) の差分を origin/main (theirs) へ 3-way で重ね、結果が theirs と一致するか。"""
    with tempfile.TemporaryDirectory() as tmp:
        t = Path(tmp)
        (t / "ours").write_bytes((repo / path).read_bytes())
        (t / "base").write_bytes(cat_blob(repo, base))
        theirs_bytes = cat_blob(repo, theirs)
        (t / "theirs").write_bytes(theirs_bytes)
        proc = subprocess.run(
            ["git", "merge-file", "-p", "-q", str(t / "ours"), str(t / "base"), str(t / "theirs")],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )
        return proc.returncode == 0 and proc.stdout == theirs_bytes


def parse_status(repo: Path) -> list[dict]:
    raw = git(repo, "status", "--porcelain=v1", "-z", "--untracked-files=all")
    entries = []
    parts = raw.split("\0")
    i = 0
    while i < len(parts):
        item = parts[i]
        i += 1
        if not item:
            continue
        code, path = item[:2], item[3:]
        orig = None
        if code[0] in "RC":
            orig = parts[i]
            i += 1
        entries.append({"code": code, "path": path, "orig": orig})
    return entries


def classify(repo: Path, entry: dict) -> dict:
    path, code = entry["path"], entry["code"]
    base = blob_at(repo, "HEAD", path)
    theirs = blob_at(repo, REMOTE_REF, path)
    ours = worktree_blob(repo, path)
    full = repo / path
    mtime = full.lstat().st_mtime if (full.exists() or full.is_symlink()) else None
    info = {"path": path, "code": code, "untracked": code == "??", "in_head": base is not None, "mtime": mtime}
    if entry["orig"] is not None or ours == "<dir>":
        info["kind"] = "blocking"
    elif ours == theirs:
        info["kind"] = "upstream_same"
    elif base == theirs:
        info["kind"] = "local_only"
    elif base and theirs and ours and merge_equals_theirs(repo, path, base, theirs):
        info["kind"] = "upstream_contains"
    else:
        info["kind"] = "blocking"
    return info


def ahead_commits(repo: Path) -> list[dict]:
    out = git(repo, "log", "--format=%H%x09%ct%x09%s", f"{REMOTE_REF}..HEAD").strip()
    commits = []
    for line in out.splitlines():
        sha, ct, subject = line.split("\t", 2)
        commits.append({"sha": sha, "time": int(ct), "subject": subject})
    return commits


def ahead_contained(repo: Path) -> bool:
    """未push commit の中身がすべて origin/main に含まれるか。"""
    proc = subprocess.run(
        ["git", "merge-tree", "--write-tree", REMOTE_REF, "HEAD"], cwd=repo, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL
    )
    if proc.returncode == 0:
        tree = proc.stdout.decode().splitlines()[0].strip()
        if tree == git(repo, "rev-parse", f"{REMOTE_REF}^{{tree}}").strip():
            return True
    cherry = git(repo, "cherry", REMOTE_REF, "HEAD").strip().splitlines()
    return bool(cherry) and all(line.startswith("-") for line in cherry)


def in_progress_reason(repo: Path) -> str | None:
    git_dir = Path(git(repo, "rev-parse", "--absolute-git-dir").strip())
    for name, label in (
        ("index.lock", "別の git 操作の途中 (index.lock)"),
        ("MERGE_HEAD", "merge の途中"),
        ("rebase-merge", "rebase の途中"),
        ("rebase-apply", "rebase の途中"),
        ("CHERRY_PICK_HEAD", "cherry-pick の途中"),
        ("REVERT_HEAD", "revert の途中"),
    ):
        if (git_dir / name).exists():
            return label
    return None


def fmt_age(seconds: float) -> str:
    hours = seconds / 3600
    if hours < 48:
        return f"{hours:.0f}時間"
    return f"{hours / 24:.0f}日"


class Backup:
    def __init__(self, stamp: str):
        self.dir = BACKUP_ROOT / stamp
        self.created = False

    def ensure(self) -> Path:
        if not self.created:
            (self.dir / "files").mkdir(parents=True, exist_ok=True)
            self.created = True
        return self.dir

    def save_patch(self, repo: Path) -> None:
        d = self.ensure()
        (d / "dirty.patch").write_text(git(repo, "diff", "HEAD", "--binary"), encoding="utf-8")
        (d / "base_HEAD.txt").write_text(git(repo, "rev-parse", "HEAD"), encoding="utf-8")

    def save_file(self, repo: Path, path: str, move: bool = False) -> None:
        src = repo / path
        if not (src.exists() or src.is_symlink()):
            return
        dst = self.ensure() / "files" / path
        dst.parent.mkdir(parents=True, exist_ok=True)
        if move:
            shutil.move(str(src), str(dst))
        else:
            shutil.copy2(src, dst, follow_symlinks=False)

    def save_commits(self, repo: Path, commits: list[dict]) -> None:
        if not commits:
            return
        d = self.ensure()
        git(repo, "bundle", "create", str(d / "unpushed.bundle"), f"{REMOTE_REF}..HEAD")
        git(repo, "format-patch", "-q", "-o", str(d / "unpushed-patches"), f"{REMOTE_REF}..HEAD")

    def write_readme(self, lines: list[str]) -> None:
        if self.created:
            (self.dir / "README.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def restore(repo: Path, item: dict, backup: Backup) -> None:
    """書きかけ1件を控えへ写し、HEAD の状態へ戻す。"""
    path = item["path"]
    if item["untracked"]:
        backup.save_file(repo, path, move=True)
        return
    backup.save_file(repo, path)
    if item["in_head"]:
        git(repo, "checkout", "HEAD", "--", path)
    else:
        git(repo, "rm", "-q", "--cached", "--", path)
        full = repo / path
        if full.exists() or full.is_symlink():
            full.unlink()


def run(repo: Path, quarantine: str, stale_hours: float, now: float, do_fetch: bool) -> dict:
    result: dict = {"repo": str(repo), "at": dt.datetime.fromtimestamp(now).isoformat(timespec="seconds"), "actions": []}
    canonical = repo.resolve() == CANONICAL_REPO.resolve()
    result["canonical"] = canonical

    branch = git(repo, "symbolic-ref", "-q", "--short", "HEAD", check=False).strip()
    if branch != BRANCH:
        result["status"] = "skipped"
        result["reason"] = f"main 以外 ({branch or 'detached'}) を開いている"
        return result
    reason = in_progress_reason(repo)
    if reason:
        result["status"] = "skipped"
        result["reason"] = reason
        return result

    if do_fetch:
        try:
            git(repo, "fetch", "-q", "origin", BRANCH, timeout=45)
        except (GitError, subprocess.TimeoutExpired) as exc:
            result["fetch_error"] = str(exc)[:300]

    behind = int(git(repo, "rev-list", "--count", f"HEAD..{REMOTE_REF}").strip())
    commits = ahead_commits(repo)
    contained = ahead_contained(repo) if commits else True
    items = [classify(repo, e) for e in parse_status(repo)]
    result.update(behind_before=behind, ahead_before=len(commits), ahead_contained=contained)
    if commits and not contained:
        result["unpushed"] = [f"{c['sha'][:8]} {c['subject']}" for c in commits]
    result["items"] = [{k: v for k, v in it.items() if k != "mtime"} | {"age": fmt_age(now - it["mtime"]) if it["mtime"] else None} for it in items]

    if behind == 0 and (not commits or not contained):
        result["status"] = "up_to_date" if not commits else "ahead_unpushed"
        return result
    # ここから先は「遅れがある」か「中身が origin/main に含まれる未push commit だけが残っている」場合

    blocking = [it for it in items if it["kind"] == "blocking"]
    safe = [it for it in items if it["kind"] in SAFE_KINDS]
    newest = max([it["mtime"] for it in items if it["mtime"]] + [c["time"] for c in commits] + [0])
    stale = newest > 0 and (now - newest) >= stale_hours * 3600
    result["newest_activity_age"] = fmt_age(now - newest) if newest else None
    needs_quarantine = bool(blocking) or not contained

    if not canonical:
        result["status"] = "report_only"
        result["reason"] = "正規の作業フォルダではないため報告だけ"
        return result
    if needs_quarantine and not stale:
        result["status"] = "blocked_active"
        result["reason"] = f"origin/main に無い書きかけ・未push commit がある。最後の動きは{fmt_age(now - newest)}前で、まだ作業中の可能性がある"
        return result
    if needs_quarantine and quarantine != "on":
        result["status"] = "blocked_stale_dry_run"
        result["reason"] = f"origin/main に無い書きかけ・未push commit が{fmt_age(now - newest)}動いていない。隔離すれば追従できる (いまは報告だけ)"
        return result

    stamp = dt.datetime.fromtimestamp(now).strftime("%Y%m%d-%H%M%S")
    backup = Backup(stamp)
    to_restore = safe + (blocking if needs_quarantine else [])
    if to_restore or (commits and not contained):
        backup.save_patch(repo)
    if commits and not contained:
        backup.save_commits(repo, commits)
    for it in to_restore:
        restore(repo, it, backup)
        result["actions"].append(f"{'隔離' if it['kind'] == 'blocking' else '最新版に既にあるため片付け'}: {it['path']}")

    try:
        if commits:
            git(repo, "reset", "--keep", REMOTE_REF)
        else:
            git(repo, "merge", "--ff-only", "-q", REMOTE_REF)
    except GitError as exc:
        result["status"] = "sync_failed"
        result["reason"] = str(exc)[:400]
        result["backup"] = str(backup.dir) if backup.created else None
        return result

    result["status"] = "synced"
    result["head"] = git(repo, "rev-parse", "--short", "HEAD").strip()
    result["remaining_local_only"] = [it["path"] for it in items if it["kind"] == "local_only"]
    if backup.created:
        result["backup"] = str(backup.dir)
        lines = [
            f"# 作業フォルダ自動同期の控え ({result['at']})",
            "",
            f"対象: `{repo}`。同期前の HEAD は `base_HEAD.txt`、追従先は {REMOTE_REF} `{result['head']}`。",
            "`dirty.patch` は同期前の書きかけ全体 (HEAD との差分)、`files/` は戻したファイルの写し。",
            "",
            "| ファイル | 仕分け | 最後の更新 |",
            "|---|---|---|",
        ]
        for it in to_restore:
            age = fmt_age(now - it["mtime"]) + "前" if it["mtime"] else "-"
            lines.append(f"| `{it['path']}` | {it['kind']} | {age} |")
        if commits and not contained:
            lines += ["", "未push commit (中身が origin/main に無い) は `unpushed.bundle` と `unpushed-patches/` に控えた。", ""]
            lines += [f"- `{c['sha'][:8]}` {c['subject']}" for c in commits]
        backup.write_readme(lines)
    return result


def summarize(result: dict) -> str:
    status = result.get("status")
    head = {
        "up_to_date": "作業フォルダは最新",
        "synced": f"作業フォルダを最新へ追従 ({result.get('behind_before', 0)} 件遅れ → 0)",
        "skipped": "作業フォルダの追従を見送り",
        "report_only": "作業フォルダの状態 (報告のみ)",
        "ahead_unpushed": "作業フォルダに未pushの commit がある",
        "blocked_active": "作業フォルダが遅れているが、作業中の書きかけがあるため追従を止めた",
        "blocked_stale_dry_run": "作業フォルダが遅れていて、放置された書きかけが追従を止めている",
        "sync_failed": "作業フォルダの追従に失敗",
    }.get(status, str(status))
    lines = [f"[root-sync] {head}"]
    if result.get("reason"):
        lines.append(f"  理由: {result['reason']}")
    if result.get("fetch_error"):
        lines.append(f"  fetch 失敗: {result['fetch_error']}")
    if status not in ("synced", "up_to_date") and result.get("behind_before") is not None:
        lines.append(f"  遅れ {result.get('behind_before', '?')} 件 / 未push {result.get('ahead_before', '?')} 件")
    for a in result.get("actions", [])[:20]:
        lines.append(f"  - {a}")
    blocking = [it for it in result.get("items", []) if it["kind"] == "blocking"]
    if blocking and status != "synced":
        lines.append("  origin/main に無い書きかけ (両側で変更あり):")
        lines += [f"    {it['path']} ({it['age']}前)" for it in blocking[:20]]
    if result.get("unpushed") and status != "synced":
        lines.append("  中身が origin/main に無い未push commit:")
        lines += [f"    {u}" for u in result["unpushed"][:10]]
    remaining = result.get("remaining_local_only") or []
    if remaining:
        lines.append(f"  残した書きかけ {len(remaining)} 件 (origin/main とぶつからないもの): " + ", ".join(remaining[:5]) + (" ほか" if len(remaining) > 5 else ""))
    if result.get("backup"):
        lines.append(f"  控え: {result['backup']}")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--repo", default=str(CANONICAL_REPO))
    ap.add_argument("--quarantine", choices=("dry-run", "on"), default=os.environ.get("AMD_OS_ROOT_SYNC_QUARANTINE", "dry-run"))
    ap.add_argument("--stale-hours", type=float, default=72.0)
    ap.add_argument("--no-fetch", action="store_true")
    ap.add_argument("--format", choices=("text", "json"), default="text")
    ap.add_argument("--now", type=float, default=None, help="検査用。UNIX 時刻を固定する")
    args = ap.parse_args()

    repo = Path(args.repo)
    try:
        repo = Path(git(repo, "rev-parse", "--show-toplevel").strip())
    except GitError as exc:
        print(f"[root-sync] git リポジトリではない: {exc}", file=sys.stderr)
        return 0

    git_dir = Path(git(repo, "rev-parse", "--absolute-git-dir").strip())
    with open(git_dir / "amd-os-root-sync.lock", "w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            result = {"status": "skipped", "reason": "同じ同期が実行中"}
        else:
            try:
                result = run(repo, args.quarantine, args.stale_hours, args.now or dt.datetime.now().timestamp(), not args.no_fetch)
            except Exception as exc:  # 同期の失敗でセッション開始や launchd を止めない
                result = {"status": "sync_failed", "reason": f"{type(exc).__name__}: {exc}"[:400]}

    if repo.resolve() == CANONICAL_REPO.resolve():
        try:
            BACKUP_ROOT.mkdir(parents=True, exist_ok=True)
            (BACKUP_ROOT / "last_status.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
            LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
            with open(LOG_FILE, "a", encoding="utf-8") as log:
                log.write(f"{result.get('at', dt.datetime.now().isoformat(timespec='seconds'))} {result.get('status')} "
                          f"behind={result.get('behind_before')} ahead={result.get('ahead_before')} "
                          f"actions={len(result.get('actions', []))} {result.get('reason', '')}\n")
        except OSError:
            pass

    print(json.dumps(result, ensure_ascii=False, indent=2) if args.format == "json" else summarize(result))
    return 0


if __name__ == "__main__":
    sys.exit(main())
