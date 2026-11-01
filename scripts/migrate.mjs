#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const akar = join(dirname(fileURLToPath(import.meta.url)), '..');
const dirMigrasi = join(akar, 'db', 'migrations');

const url = process.argv[2] ?? process.env.DATABASE_URL;
if (!url) {
  console.error('Pakai: node scripts/migrate.mjs [DATABASE_URL]');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

await client.query(`
  create table if not exists schema_migrations (
    filename   text primary key,
    applied_at timestamptz not null default now()
  )
`);

const { rows } = await client.query('select filename from schema_migrations');
const sudah = new Set(rows.map((r) => r.filename));

const berkas = readdirSync(dirMigrasi)
  .filter((f) => f.endsWith('.sql'))
  .sort();

let dijalankan = 0;
for (const nama of berkas) {
  if (sudah.has(nama)) continue;
  const sql = readFileSync(join(dirMigrasi, nama), 'utf8');
  try {
    await client.query('begin');
    await client.query(sql);
    await client.query('insert into schema_migrations (filename) values ($1)', [nama]);
    await client.query('commit');
    console.log(`terpasang  ${nama}`);
    dijalankan++;
  } catch (e) {
    await client.query('rollback');
    console.error(`GAGAL      ${nama}: ${e.message}`);
    await client.end();
    process.exit(1);
  }
}

console.log(
  dijalankan === 0 ? 'tidak ada migrasi baru' : `${dijalankan} migrasi dipasang`,
);
await client.end();
