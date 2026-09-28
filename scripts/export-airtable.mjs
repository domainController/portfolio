#!/usr/bin/env node
/**
 * Exporte la table Airtable "Tech Venture" vers un fichier JSON statique,
 * qui est ce que la page publique (portfolio.html) lit — jamais l'API
 * Airtable directement, donc jamais de token exposé côté navigateur.
 *
 * Usage :
 *   AIRTABLE_TOKEN=xxxx node scripts/export-airtable.mjs
 *
 * Le token ne doit JAMAIS être écrit dans ce fichier ni commité :
 * il vient uniquement de la variable d'environnement (en local),
 * ou d'un secret GitHub Actions (en CI, voir .github/workflows/sync-portfolio.yml).
 */

const BASE_ID = "app0YdcF6Ql3khMZl";
const TABLE_ID = "tblzqRja5Xz4Mz1dg";
const OUTPUT_PATH = new URL("../portfolio.json", import.meta.url);

const token = process.env.AIRTABLE_TOKEN;
if (!token) {
  console.error("Erreur : la variable d'environnement AIRTABLE_TOKEN n'est pas définie.");
  process.exit(1);
}

async function fetchAllRecords() {
  let records = [];
  let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`);
    url.searchParams.set("returnFieldsByFieldId", "true");
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      throw new Error(`Airtable a répondu ${res.status} ${res.statusText} : ${await res.text()}`);
    }
    const data = await res.json();
    records = records.concat(data.records);
    offset = data.offset;
  } while (offset);
  return records;
}

const records = await fetchAllRecords();

const payload = {
  generatedAt: new Date().toISOString(),
  baseId: BASE_ID,
  tableId: TABLE_ID,
  records,
};

const fs = await import("node:fs/promises");
await fs.writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2) + "\n", "utf-8");

console.log(`OK — ${records.length} ventures exportées vers ${OUTPUT_PATH.pathname}`);
