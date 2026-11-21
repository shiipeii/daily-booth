#!/usr/bin/env node
// full backup of everything, straight from supabase, to a local folder.
// use this when moving to another service; the in-app export does the same
// for one couple from a phone.
//
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=... \
//   node scripts/backup.mjs ./backup
//
// writes ./backup/tables/*.json (every row of every table) and
// ./backup/photos/<couple>/<date>/<file>.jpg (every stored photo).

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const out = process.argv[2] ?? "./backup";
if (!url || !key) {
  console.error("set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (project settings → api)");
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}` };
const tables = ["couples", "members", "days", "photos", "push_subscriptions", "app_config"];

for (const table of tables) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*`, { headers });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  await save(join(out, "tables", `${table}.json`), JSON.stringify(rows, null, 2));
  console.log(`${table}: ${rows.length} rows`);

  if (table === "photos") {
    for (const p of rows) {
      for (const path of [p.original_path, p.film_path]) {
        const file = await fetch(`${url}/storage/v1/object/photos/${path}`, { headers });
        if (!file.ok) {
          console.warn(`  missing ${path}`);
          continue;
        }
        await save(join(out, "photos", path), Buffer.from(await file.arrayBuffer()));
      }
    }
    console.log(`photos: ${rows.length * 2} files`);
  }
}
console.log(`done → ${out}`);

async function save(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
}
