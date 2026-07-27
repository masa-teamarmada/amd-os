#!/usr/bin/env python3
"""
amd-os-l2m1-monthly-report Phase 2.5 禁止語チェック実装。

対外提出版markdownに社内限定の隠語・コードネーム・内部評価用語が残っていないか検査する。
ルール正本はこのファイル。SKILL.md からは `--mode check` で呼ばれる。

使い方:
  python3 strip_internal_jargon.py --input <markdown path> --mode check
  echo $? # 0 = hard_fail無し, 1 = hard_fail検出
"""
import argparse
import json
import re
import sys

# 自社メンバー code_name (提出版に絶対出してはいけない)
CODE_NAMES = [
    "まさ", "きよ", "かる", "こう", "りょー", "りり", "ちこ", "うめ", "あび",
    "らん", "はるママ", "りさ", "かず", "ももち", "はる", "まーすー", "まゆ",
    "なめ", "あかね", "いく", "かな", "まり", "やぎ", "まどか", "しん", "しろー",
    "つくよみ", "あき", "えいみ",
]

# hard_fail: 検出したら PDF 生成を止める (社外に絶対出せない内部用語)
HARD_FAIL_PATTERNS = [
    (r"AMD\s*Score", "AMD Score (内部評価指標名)"),
    (r"L2\s*(件数|カウント|snapshot)", "L2 メタデータ"),
    (r"月次ルーティン|monthly[_-]?report[_-]?routine", "内部ルーティン名"),
    (r"確定済み証跡", "内部プロセス文言"),
    (r"eLAD", "eLAD (誤字、e-Rad が正)"),
]
for name in CODE_NAMES:
    escaped = re.escape(name)
    # 通常語の一部（例: 「こうした」）を誤検知せず、markdownラベルまたは
    # 人名として使われる区切り・助詞がある場合だけ code_name と判定する。
    HARD_FAIL_PATTERNS.append((
        rf"(?:\[{escaped}\](?=\()|(?<![一-龥ぁ-んァ-ンA-Za-z0-9]){escaped}(?=(?:は|が|を|も|へ|から|より|[\s、。・（(「『【）)」』】])))",
        f"code_name: {name}",
    ))

# soft_warn: 検出しても止めないが notifications に積む (表記ゆれ・要確認語)
SOFT_WARN_PATTERNS = [
    (r"cockpit|コックピット", "内部UI名称"),
    (r"outbox", "内部運用語"),
    (r"プロンプト|LLM|Claude|Anthropic|Opus", "内部実装語"),
]

# 表記正規化 (削除ではなく置換して通す語)
NORMALIZE_MAP = [
    (r"eLAD", "e-Rad"),
]


def check(markdown: str):
    hard = []
    soft = []
    for pattern, label in HARD_FAIL_PATTERNS:
        for m in re.finditer(pattern, markdown, flags=re.IGNORECASE):
            hard.append({"word": m.group(0), "label": label, "pos": m.start()})
    for pattern, label in SOFT_WARN_PATTERNS:
        for m in re.finditer(pattern, markdown, flags=re.IGNORECASE):
            soft.append({"word": m.group(0), "label": label, "pos": m.start()})
    return hard, soft


def normalize(markdown: str) -> str:
    normalized = markdown
    for pattern, replacement in NORMALIZE_MAP:
        normalized = re.sub(pattern, replacement, normalized, flags=re.IGNORECASE)
    return normalized


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="検査対象の markdown ファイルパス")
    parser.add_argument("--mode", default="check", choices=["check", "normalize"])
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as f:
        content = f.read()

    if args.mode == "normalize":
        sys.stdout.write(normalize(content))
        return

    hard, soft = check(content)
    status = "failed" if hard else ("warning" if soft else "clean")
    result = {"status": status, "hard_fail": hard, "soft_warn": soft}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    sys.exit(1 if hard else 0)


if __name__ == "__main__":
    main()
