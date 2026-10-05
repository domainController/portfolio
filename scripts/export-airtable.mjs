#!/usr/bin/env node
/**
 * Exporte la table Airtable "Ventures" (ex-"Tech Venture") vers un fichier JSON statique,
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
// Handoff Cowork 05.10.2026 : l'onglet Market de Single Record doit tirer sa value prop
// et son différenciateur des modules satellites Brand/Value Props plutôt que des champs
// texte libre de Ventures — il faut donc exporter ces deux tables aussi, pas seulement
// Ventures comme jusqu'ici.
const BRAND_TABLE_ID = "tblquGFmUloAgPaOz";
const VALUEPROPS_TABLE_ID = "tbl4kVPDpsrfAWK2b";
const OUTPUT_PATH = new URL("../portfolio.json", import.meta.url);

const token = process.env.AIRTABLE_TOKEN;
if (!token) {
  console.error("Erreur : la variable d'environnement AIRTABLE_TOKEN n'est pas définie.");
  process.exit(1);
}

// Nom réel des champs (API Meta, distincte de l'API Records utilisée ci-dessous) —
// c'est ce qui permet à portfolio.html d'afficher le nom Airtable actuel d'un champ
// sans le recopier à la main dans son code : un renommage côté Airtable se reflète
// au sync suivant, plutôt que de rester silencieusement figé sur l'ancien nom.
// Dégrade en douceur (fieldNames vide) si le token n'a pas le scope schema.bases:read,
// plutôt que de faire échouer tout l'export pour ça.
// fieldNames fusionne les 3 tables dans un seul objet plat : les IDs de champ Airtable
// sont uniques globalement dans la base, pas seulement par table, donc pas de collision.
async function fetchFieldNames() {
  const url = `https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    console.warn(`Avertissement : API Meta ${res.status} ${res.statusText} — fieldNames omis (le token a-t-il le scope schema.bases:read ?)`);
    return {};
  }
  const data = await res.json();
  const names = {};
  for (const tableId of [TABLE_ID, BRAND_TABLE_ID, VALUEPROPS_TABLE_ID]) {
    const table = data.tables.find((t) => t.id === tableId);
    if (!table) {
      console.warn(`Avertissement : table ${tableId} absente de la réponse Meta — ses fieldNames sont omis.`);
      continue;
    }
    for (const f of table.fields) names[f.id] = f.name;
  }
  return names;
}

async function fetchAllRecords(tableId) {
  let records = [];
  let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${tableId}`);
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

const [records, brand, valueProps, fieldNames] = await Promise.all([
  fetchAllRecords(TABLE_ID),
  fetchAllRecords(BRAND_TABLE_ID),
  fetchAllRecords(VALUEPROPS_TABLE_ID),
  fetchFieldNames(),
]);

const payload = {
  generatedAt: new Date().toISOString(),
  baseId: BASE_ID,
  tableId: TABLE_ID,
  fieldNames,
  records,
  brand,
  valueProps,
};

const fs = await import("node:fs/promises");
await fs.writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2) + "\n", "utf-8");

console.log(`OK — ${records.length} ventures, ${brand.length} brand, ${valueProps.length} value props exportées vers ${OUTPUT_PATH.pathname}`);
