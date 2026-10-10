#!/usr/bin/env python3.12
"""Read back/apply only the two Auth login email templates; never send email."""
import argparse
import json
import os
from pathlib import Path
import sys
import tomllib
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
PROJECT = "nbnhrhybjslbawdukvvk"

def desired_fields():
    config = tomllib.loads((ROOT / "ios/supabase/config.toml").read_text())
    fields = {}
    for name in ("magic_link", "confirmation"):
        template = config["auth"]["email"]["template"][name]
        fields[f"mailer_subjects_{name}"] = template["subject"]
        path = (ROOT / "ios" / template["content_path"]).resolve()
        if not path.is_relative_to(ROOT / "ios/supabase/templates"):
            raise ValueError("Template path must stay in the shared Auth templates directory")
        body = path.read_text()
        if body.count('{{ .Token }}') != 1 or '<html lang="ja">' not in body:
            raise ValueError("Login template must display one OTP and use Japanese language")
        if '{{ .ConfirmationURL }}' in body or '<a' in body.lower() or '<button' in body.lower():
            raise ValueError("Login template must use codes only, without login links or buttons")
        if any(x in body.lower() for x in ("<script", "<img", "blockquote", "gmail_quote", "display:none")):
            raise ValueError("Login template must be visible without scripts, images or quoted content")
        fields[f"mailer_templates_{name}_content"] = body
    return fields

def access_token():
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if not token:
        for line in (ROOT / "pwa/.env.local").read_text().splitlines():
            if line.startswith("SUPABASE_ACCESS_TOKEN="):
                token = line.split("=", 1)[1].strip().strip('\"\'')
                break
    if not token:
        raise ValueError("Supabase management credential is unavailable")
    return token

def auth_config(token, fields=None):
    request = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT}/config/auth",
        data=json.dumps(fields).encode() if fields is not None else None,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="PATCH" if fields is not None else "GET",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    fields = desired_fields()
    token = access_token()
    before = auth_config(token)
    if args.apply and any(before.get(k) != v for k, v in fields.items()):
        auth_config(token, fields)
    after = auth_config(token) if args.apply else before
    matches = all(after.get(k) == v for k, v in fields.items())
    unrelated = [k for k in before.keys() | after.keys() if k not in fields and before.get(k) != after.get(k)]
    # Do not print config, subjects rendered with OTPs, credentials or email links.
    print(json.dumps({"templateFieldsMatch": matches, "unrelatedAuthFieldsUnchanged": not unrelated, "fieldCount": len(fields), "emailSent": False}))
    return 0 if matches and not unrelated else 1

if __name__ == "__main__":
    try:
        sys.exit(main())
    except urllib.error.HTTPError as error:
        print(f"Auth template configuration failed: HTTP {error.code}", file=sys.stderr)
        sys.exit(1)
    except Exception as error:
        print(f"Auth template configuration failed: {type(error).__name__}", file=sys.stderr)
        sys.exit(1)
