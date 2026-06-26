#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const PWA_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const REPO_ROOT = path.resolve(PWA_ROOT, "..");

loadEnv(path.join(PWA_ROOT, ".env.local"));
loadEnv(path.join(PWA_ROOT, ".env.production.local"));
loadEnv(path.join(REPO_ROOT, ".vercel", ".env.production.local"));
loadEnv(path.join(PWA_ROOT, ".vercel", ".env.production.local"));

const args = parseArgs(process.argv.slice(2));

async function main() {
  const connector = String(args.connector || "").trim().toLowerCase();
  if (!connector) throw new Error("--connector is required");

  const source = String(args.source || "h1_meeting_flow").trim();
  const reason = String(args.reason || "reauth_required").trim();
  const context = String(args.context || "").trim();
  const connectorMeta = resolveConnectorMeta(connector, args);
  const reauthUrl = String(
    args["reauth-url"] ||
    connectorMeta.install_url ||
    connectorMeta.app_url ||
    "",
  ).trim();
  const link = String(args.link || "/notifications").trim();
  const dedupeHours = clampInt(args["dedupe-hours"], 1, 168, 24);
  const dryRun = Boolean(args["dry-run"]);
  const detectedAt = new Date().toISOString();

  const row = {
    kind: "connector_auth",
    title: `再認証が必要: ${connectorLabelJa(connector)}`.slice(0, 180),
    body: buildBody({ connector, reason, context, reauthUrl }),
    link,
    source,
    native_notified_at: null,
    meta: {
      connector,
      connector_id: connectorMeta.connector_id || null,
      link_id: connectorMeta.link_id || null,
      reason,
      context: context || null,
      reauth_url: reauthUrl || null,
      reauth_app_url: connectorMeta.app_url || null,
      reauth_install_url: connectorMeta.install_url || null,
      host_action: "TRIGGER_REAUTHENTICATION",
      resource_uri: connectorMeta.resource_uri || null,
      fallback_continues: true,
      detected_at: detectedAt,
      dedupe_hours: dedupeHours,
    },
  };

  if (dryRun) {
    process.stdout.write(`${JSON.stringify({ ok: true, dry_run: true, row }, null, 2)}\n`);
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Supabase env is missing. Need NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const since = new Date(Date.now() - dedupeHours * 60 * 60 * 1000).toISOString();
  const { data: existing, error: existingError } = await db
    .from("app_notifications")
    .select("id,created_at,title")
    .eq("kind", "connector_auth")
    .eq("source", source)
    .is("read_at", null)
    .is("dismissed_at", null)
    .gte("created_at", since)
    .contains("meta", { connector })
    .limit(1);

  if (existingError) throw existingError;
  if (existing?.length && !args.force) {
    const { data: updated, error: updateError } = await db
      .from("app_notifications")
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq("id", existing[0].id)
      .select("id,created_at,updated_at")
      .single();
    if (updateError) throw updateError;

    process.stdout.write(JSON.stringify({
      ok: true,
      action: "updated_existing",
      connector,
      notification_id: updated.id,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
    }, null, 2));
    process.stdout.write("\n");
    return;
  }

  const { data, error } = await db
    .from("app_notifications")
    .insert(row)
    .select("id,created_at")
    .single();
  if (error) throw error;

  process.stdout.write(JSON.stringify({
    ok: true,
    action: "inserted",
    connector,
    notification_id: data.id,
    created_at: data.created_at,
  }, null, 2));
  process.stdout.write("\n");
}

function buildBody({ connector, reason, context, reauthUrl }) {
  const lines = [
    `${connectorLabelJa(connector)}の接続が切れているみたい。H-1は別の資料を見ながら処理を続けてるよ。`,
    `理由: ${reasonLabelJa(reason)}`,
  ];
  if (context) lines.push(`対象: ${context}`);
  if (reauthUrl) {
    lines.push("この通知の「再認証を開く」から復旧できる。復旧後は次回のH-1でノーションを読み直す。");
  } else {
    lines.push("接続設定から該当サービスを再認証してね。");
  }
  return lines.join("\n");
}

function connectorLabel(connector) {
  const labels = {
    notion: "Notion",
    gmail: "Gmail",
    drive: "Google Drive",
    calendar: "Google Calendar",
    slack: "Slack",
  };
  return labels[connector] || connector;
}

function connectorLabelJa(connector) {
  const labels = {
    notion: "ノーション",
    gmail: "メール",
    drive: "ドライブ",
    calendar: "カレンダー",
    slack: "スラック",
  };
  return labels[connector] || connector;
}

function reasonLabelJa(reason) {
  const labels = {
    oauth_token_invalid_grant: "認証の有効期限切れ",
    TRIGGER_REAUTHENTICATION: "再認証が必要",
    reauth_required: "再認証が必要",
  };
  return labels[reason] || reason;
}

function resolveConnectorMeta(connector, args) {
  const explicitConnectorId = String(args["connector-id"] || "").trim();
  const explicitLinkId = String(args["link-id"] || "").trim();
  const explicitAppUrl = String(args["app-url"] || "").trim();
  const explicitInstallUrl = String(args["install-url"] || "").trim();

  const fromCache = readCodexAppsCache(connector);
  const fallback = CONNECTOR_DEFAULTS[connector] || {};
  const connectorId = explicitConnectorId || fromCache.connector_id || fallback.connector_id || "";
  const linkId = explicitLinkId || fromCache.link_id || fallback.link_id || "";
  const appUrl = explicitAppUrl || fromCache.app_url || fallback.app_url || (connectorId ? `app://${connectorId}` : "");
  const installUrl = explicitInstallUrl || fromCache.install_url || fallback.install_url || "";

  return {
    connector_id: connectorId,
    link_id: linkId,
    app_url: appUrl,
    install_url: installUrl,
    resource_uri: fromCache.resource_uri || fallback.resource_uri || "",
  };
}

function readCodexAppsCache(connector) {
  const home = process.env.HOME || "";
  if (!home) return {};

  const wantedName = connectorLabel(connector).toLowerCase();
  const cacheDir = path.join(home, ".codex", "cache");
  const meta = {};

  for (const file of listJsonFiles(path.join(cacheDir, "codex_apps_tools"))) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      for (const tool of parsed.tools || []) {
        const toolMeta = tool.tool?._meta || {};
        const connectorName = String(tool.connector_name || toolMeta.connector_name || "").toLowerCase();
        if (connectorName !== wantedName) continue;
        const codexApps = toolMeta._codex_apps || {};
        meta.connector_id ||= tool.connector_id || toolMeta.connector_id || "";
        meta.link_id ||= toolMeta.link_id || "";
        meta.resource_uri ||= codexApps.resource_uri || "";
        if (meta.connector_id && meta.link_id) break;
      }
    } catch {
      // Ignore stale cache files.
    }
  }

  for (const file of listJsonFiles(path.join(cacheDir, "codex_app_directory"))) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      const apps = Array.isArray(parsed) ? parsed : (parsed.apps || parsed.items || []);
      const app = apps.find((item) => {
        const name = String(item?.name || "").toLowerCase();
        return name === wantedName || name === `${wantedName} (legacy)`;
      });
      if (app) {
        meta.connector_id ||= app.id || "";
        meta.install_url ||= app.installUrl || "";
        meta.app_url ||= app.id ? `app://${app.id}` : "";
      }
    } catch {
      // Ignore stale cache files.
    }
  }

  return meta;
}

function listJsonFiles(dir) {
  try {
    return fs.readdirSync(dir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => path.join(dir, name));
  } catch {
    return [];
  }
}

const CONNECTOR_DEFAULTS = {
  notion: {
    connector_id: "asdk_app_69c18c28f1188191bf5b8445c4ab0a2e",
    link_id: "link_69ee427bb90481919a44fb327ae7ed75",
    app_url: "app://asdk_app_69c18c28f1188191bf5b8445c4ab0a2e",
    install_url: "https://chatgpt.com/apps/notion/asdk_app_69c18c28f1188191bf5b8445c4ab0a2e",
    resource_uri: "/asdk_app_69c18c28f1188191bf5b8445c4ab0a2e/link_69ee427bb90481919a44fb327ae7ed75/notion-create-view",
  },
};

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function clampInt(value, min, max, fallback) {
  const n = Number(value || fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
