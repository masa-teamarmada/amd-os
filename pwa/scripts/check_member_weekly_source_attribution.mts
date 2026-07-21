#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  slackActorId,
  driveActorEmails,
} from "../src/lib/member-weekly-source-attribution.ts";

// slackActorId: 本人値 (user / user_id / actor_slack_id) を読む
{
  assert.equal(slackActorId({ user: "U123" }), "U123");
  assert.equal(slackActorId({ user_id: "U456" }), "U456");
  assert.equal(slackActorId({ actor_slack_id: "U789" }), "U789");
}

// slackActorId: bot_id または subtype=bot_message は null
{
  assert.equal(slackActorId({ user: "U123", bot_id: "B999" }), null);
  assert.equal(slackActorId({ user: "U123", subtype: "bot_message" }), null);
}

// slackActorId: 不明値は null
{
  assert.equal(slackActorId(null), null);
  assert.equal(slackActorId({}), null);
  assert.equal(slackActorId({ user: 123 }), null);
}

// driveActorEmails: 本人値 (last_modifying_user_email / lastModifyingUser.emailAddress) を読む
{
  assert.deepEqual(driveActorEmails({ last_modifying_user_email: "Masa@Team-Armada.jp" }), [
    "masa@team-armada.jp",
  ]);
  assert.deepEqual(
    driveActorEmails({ lastModifyingUser: { emailAddress: "eimi@team-armada.jp" } }),
    ["eimi@team-armada.jp"]
  );
}

// driveActorEmails: owner (文字列) / owners (配列: email or emailAddress) を読み、lowercase・unique
{
  assert.deepEqual(driveActorEmails({ owner: "Masa@Team-Armada.jp" }), ["masa@team-armada.jp"]);
  assert.deepEqual(
    driveActorEmails({
      owners: [{ email: "a@team-armada.jp" }, { emailAddress: "B@team-armada.jp" }, "c@team-armada.jp"],
    }),
    ["a@team-armada.jp", "b@team-armada.jp", "c@team-armada.jp"]
  );
  assert.deepEqual(
    driveActorEmails({
      last_modifying_user_email: "masa@team-armada.jp",
      owner: "MASA@team-armada.jp",
    }),
    ["masa@team-armada.jp"]
  );
}

// driveActorEmails: 複雑な/不正な値は安全に無視
{
  assert.deepEqual(driveActorEmails(null), []);
  assert.deepEqual(driveActorEmails({}), []);
  assert.deepEqual(driveActorEmails({ last_modifying_user_email: 123 }), []);
  assert.deepEqual(driveActorEmails({ owner: "not-an-email" }), []);
  assert.deepEqual(driveActorEmails({ owners: [1, null, {}, { email: 42 }] }), []);
  assert.deepEqual(driveActorEmails({ lastModifyingUser: "not-an-object" }), []);
}

console.log(JSON.stringify({ ok: true, checks: "member-weekly-source-attribution" }, null, 2));
