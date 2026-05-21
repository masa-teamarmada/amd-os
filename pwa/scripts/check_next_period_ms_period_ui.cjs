const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const files = [
  {
    path: path.join(root, "src/components/cockpit/CockpitNextPeriodSetup.tsx"),
    patterns: [
      "MS開始",
      "MS終了",
      "periodStartYm",
      "targetYm",
      "validateMsPeriod",
    ],
  },
  {
    path: path.join(root, "src/lib/supabase-data.ts"),
    patterns: [
      "periodStartYm?: string | null",
      "targetYm?: string | null",
      "period_start_ym",
      "target_ym",
    ],
  },
  {
    path: path.join(root, "src/app/api/progress/ms-schedule/route.ts"),
    patterns: [
      "period_start_ym",
      "target_ym",
      "dbScheduleByMs",
    ],
  },
];

const failures = [];
for (const item of files) {
  const text = fs.readFileSync(item.path, "utf8");
  for (const pattern of item.patterns) {
    if (!text.includes(pattern)) {
      failures.push(`${path.relative(root, item.path)} missing "${pattern}"`);
    }
  }
}

if (failures.length > 0) {
  console.error("MS period UI regression guard failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("MS period UI regression guard passed");
