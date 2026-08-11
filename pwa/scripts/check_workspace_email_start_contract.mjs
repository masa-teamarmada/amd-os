#!/usr/bin/env node
// Static/source-level contract check for POST /api/auth/email-start.
// Full route testing needs a live Next.js + Supabase context, which is out of scope here
// (no DB, no real email). Instead this greps the route source to lock in the
// enumeration-prevention contract:
//   - a single generic response shape/status used for every "no leak" branch
//   - the unregistered-account branch never stores the raw email in the audit log
//   - OTP is only sent after both an account lookup AND a usable-membership check
//   - shouldCreateUser is only set inside that gated branch
//   - an atomic DB rate-limit claim succeeds before signInWithOtp
//   - no domain-based authorization anywhere in the file
import fs from "node:fs";
import path from "node:path";

const PWA_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const ROUTE_PATH = path.join(PWA_ROOT, "src/app/api/auth/email-start/route.ts");

const src = fs.readFileSync(ROUTE_PATH, "utf8");

let failures = 0;
function check(label, condition) {
  if (condition) {
    console.log(`OK   ${label}`);
  } else {
    console.error(`FAIL ${label}`);
    failures++;
  }
}

// A single named generic-response constant, reused rather than ad-hoc literals per branch.
const genericConstMatch = src.match(/const GENERIC_RESPONSE = (\{[^}]*\}) as const;/);
check("GENERIC_RESPONSE constant is defined", !!genericConstMatch);

const genericUsages = src.match(/GENERIC_RESPONSE/g) ?? [];
check("GENERIC_RESPONSE is reused across multiple response branches (>=4 usages)", genericUsages.length >= 4);

// Every NextResponse.json(GENERIC_RESPONSE, ...) call must use status 200 — never a status
// that would let a caller distinguish registered vs. unregistered by HTTP status code.
const genericResponseCalls = [...src.matchAll(/NextResponse\.json\(GENERIC_RESPONSE,\s*\{\s*status:\s*(\d+)\s*\}\)/g)];
check("at least 3 call sites return GENERIC_RESPONSE", genericResponseCalls.length >= 3);
check(
  "every GENERIC_RESPONSE call site uses status 200",
  genericResponseCalls.every((m) => m[1] === "200"),
);

// The unregistered-account branch (account lookup returns null) must not pass the raw
// input email into the audit log — only a boolean "not found" signal.
const notFoundBranch = src.match(/if \(!account\) \{[\s\S]*?\n\s*\}/);
check("unregistered-account branch found", !!notFoundBranch);
if (notFoundBranch) {
  check(
    "unregistered-account branch does not pass rawEmail/normalizedEmail into the audit log",
    !/email:\s*(rawEmail|normalizedEmail)/.test(notFoundBranch[0]),
  );
}

// shouldCreateUser: true must appear, and only inside the signInWithOtp call that is
// reached after the account + membership checks (i.e. after the `if (!usable)` early return).
const usableGateIndex = src.indexOf("if (!usable)");
const shouldCreateUserIndex = src.indexOf("shouldCreateUser: true");
const rateLimitClaimIndex = src.indexOf('service.rpc("workspace_claim_email_otp_send"');
check("shouldCreateUser: true is present", shouldCreateUserIndex !== -1);
check(
  "shouldCreateUser: true appears only after the usable-membership gate",
  usableGateIndex !== -1 && shouldCreateUserIndex > usableGateIndex,
);
check("atomic OTP rate-limit claim is present", rateLimitClaimIndex !== -1);
check(
  "OTP send occurs only after the atomic rate-limit claim",
  rateLimitClaimIndex > usableGateIndex && shouldCreateUserIndex > rateLimitClaimIndex,
);
check(
  "rate-limit DB failure fails closed with the generic response",
  /if \(claimError\)[\s\S]*?NextResponse\.json\(GENERIC_RESPONSE, \{ status: 200 \}\)/.test(src),
);
check(
  "suppressed OTP claim returns the same generic response",
  /if \(sendClaimed !== true\)[\s\S]*?NextResponse\.json\(GENERIC_RESPONSE, \{ status: 200 \}\)/.test(src),
);

// signInWithOtp must be called with the DB-verified account email, not the raw request input.
check(
  "signInWithOtp uses the DB-verified account.email_normalized, not rawEmail",
  /signInWithOtp\(\{\s*email:\s*account\.email_normalized/.test(src),
);

// No domain-based authorization anywhere (e.g. checking email.endsWith("@team-armada.jp")).
check(
  "no domain-suffix based authorization (endsWith '@...') in this route",
  !/endsWith\(["']@/.test(src),
);

// login_scope=workspace must be present in the OTP redirect target.
check(
  "OTP redirect target includes login_scope=workspace",
  /login_scope=workspace/.test(src),
);

// next path must go through the shared sanitizer, not be used raw.
check(
  "next path is sanitized via sanitizeNextPath before use",
  /const next = sanitizeNextPath\(rawNext\)/.test(src),
);

console.log("");
if (failures > 0) {
  console.error(`${failures} check(s) failed.`);
  process.exit(1);
} else {
  console.log("All workspace email-start contract checks passed.");
}
