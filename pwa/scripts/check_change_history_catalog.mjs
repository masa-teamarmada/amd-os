import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const pwa = fileURLToPath(new URL("..", import.meta.url));
const catalog = JSON.parse(readFileSync(path.join(pwa, "src/lib/change-history-catalog.json")));
const schema = JSON.parse(readFileSync(path.join(pwa, "src/lib/change-history-schema.json")));
const readable = (label) => typeof label === "string" && /[ぁ-んァ-ン一-龠]/.test(label) && !label.includes("未登録");
for (const [table, fields] of Object.entries(schema)) {
  assert.ok(readable(catalog.tables[table]?.label), `${table}: 履歴の対象名を日本語で登録して`);
  for (const field of fields) assert.ok(readable(catalog.fields[field]), `${table}.${field}: 履歴の項目名を登録して`);
}
// 基準以降のDDLも検査する。新しい保存先・列を足す変更は、同じ変更で表示名を揃える。
const migrationDir = path.resolve(pwa, "../ios/supabase/migrations");
export function checkMigration(sql) {
  sql = sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?"?(\w+)"?\s*\(([\s\S]*?)\);/gi)) {
    const table = match[1];
    assert.ok(catalog.tables[table], `${table}: 新しい台帳に履歴の表示名・主キー・対象名の取得列を登録して`);
    for (const line of match[2].split(/\n|,(?![^()]*\))/)) {
      const field = line.match(/^\s*"?(\w+)"?\s+(?:text|uuid|varchar|character|jsonb?|integer|int\d?|bigint|smallint|numeric|decimal|boolean|bool|date|timestamp\w*|timestamptz|real|double|float\d*|serial|bigserial)\b/i)?.[1];
      if (field) assert.ok(readable(catalog.fields[field]), `${table}.${field}: 履歴の項目名を登録して`);
    }
  }
  for (const check of sql.matchAll(/(?:CHECK\s*\([\s\S]*?\)\s*(?:[,;]|$)|ALTER\s+TYPE[^;]+ADD\s+VALUE[^;]+;)/gi)) {
    for (const match of check[0].matchAll(/'([a-z][a-z0-9_]*)'/g)) {
      assert.ok(catalog.values[match[1]], `${match[1]}: 新しい選択値の表示名を登録して`);
    }
  }
  for (const statement of sql.split(";")) {
    const table = statement.match(/ALTER\s+TABLE\s+(?:ONLY\s+)?(?:public\.)?"?(\w+)"?/i)?.[1];
    if (!table || table === "amd_os_data_change_history") continue;
    for (const match of statement.matchAll(/ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?\s+(?:text|uuid|varchar|jsonb?|integer|int\d?|bigint|numeric|boolean|bool|date|timestamp\w*|timestamptz|real|double|serial)\b/gi)) {
      assert.ok(readable(catalog.fields[match[1]]), `${table}.${match[1]}: 履歴の項目名を登録して`);
    }
  }
}
for (const name of readdirSync(migrationDir).filter((name) => name.endsWith(".sql") && name > "20261105012202")) checkMigration(readFileSync(path.join(migrationDir, name), "utf8"));
console.log(`change history catalog: ${Object.keys(schema).length}対象 / ${Object.keys(catalog.fields).length}項目の表示名を検査`);
