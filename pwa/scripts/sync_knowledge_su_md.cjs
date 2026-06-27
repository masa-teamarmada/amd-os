#!/usr/bin/env node
/**
 * /Users/masa/projects/knowledge/{slug}.md の本文を
 * project_ventures.master_md_text に upsert する。
 *
 * 使い方:
 *   cd pwa && node scripts/sync_knowledge_su_md.cjs
 *
 * 動作:
 *   - project_ventures から master_md_slug が入っている行を全件 fetch
 *   - 各 slug について /Users/masa/projects/knowledge/<slug>.md を読み込む
 *   - 存在する場合は project_ventures.master_md_text + master_md_updated_at を update
 *   - 存在しない場合は警告のみ (skip)
 *
 * 設計判断 (2026-05-22):
 *   - knowledge/ は git 管理外のローカル正本。AMD-OS リポ内には複製しない。
 *   - cron は Supabase 経由でしか md を読めない。よって本 script で同期する。
 *   - 内容を変えるたびに手動で実行する (= まさが md 編集 → sync → cron 反映)
 */

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });

const KNOWLEDGE_DIR = "/Users/masa/projects/knowledge";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE env. Set NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }
  const db = createClient(url, key);

  const { data: ventures, error } = await db
    .from("project_ventures")
    .select("project_id, display_name, master_md_slug")
    .not("master_md_slug", "is", null);
  if (error) {
    console.error("fetch project_ventures failed:", error.message);
    process.exit(1);
  }
  if (!ventures || ventures.length === 0) {
    console.warn("No project_ventures with master_md_slug. Run migration 077 first.");
    return;
  }

  let synced = 0;
  let missing = 0;
  for (const v of ventures) {
    const slug = v.master_md_slug;
    const filePath = path.join(KNOWLEDGE_DIR, `${slug}.md`);
    if (!fs.existsSync(filePath)) {
      console.warn(`[skip] ${v.project_id} (${v.display_name}): ${filePath} not found`);
      missing++;
      continue;
    }
    const text = fs.readFileSync(filePath, "utf-8");
    const { error: updateError } = await db
      .from("project_ventures")
      .update({
        master_md_text: text,
        master_md_updated_at: new Date().toISOString(),
      })
      .eq("project_id", v.project_id);
    if (updateError) {
      console.error(`[error] ${v.project_id}: ${updateError.message}`);
      continue;
    }
    console.log(`[ok] ${v.project_id} (${v.display_name}) ← ${slug}.md (${text.length} chars)`);
    synced++;
  }
  console.log(`\nDone. synced=${synced}, missing=${missing}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
