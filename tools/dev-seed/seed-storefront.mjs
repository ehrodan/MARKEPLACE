#!/usr/bin/env node
/**
 * Semeia a vitrine LOCAL com vendedores, itens e anúncios de desenvolvimento.
 *
 * Por que existe: com um único anúncio no banco, nenhuma decisão de layout pode
 * ser avaliada — densidade de grade, hierarquia de preço, faixa de categorias e
 * multivendedor só aparecem com volume. Isto enche o banco de dev; não toca em
 * produção e não inventa nada na interface.
 *
 * As três regras que este seed respeita, e que o tornam legítimo:
 *
 * 1. NADA de propriedade de terceiro. O gate G0 (autorização do publicador)
 *    segue `BLOQUEADO` em `docs/22`, então não entra nome, arte nem marca de
 *    jogo real. Os itens têm nomes próprios e `game_origin = 'AMOSTRA_DEV'`.
 * 2. A arte é NOSSA: cada item ganha um SVG gerado aqui, derivado do slug de
 *    forma determinística, com a paleta da marca. Nenhum download, nenhuma
 *    imagem de banco de imagens, nenhuma licença de terceiro.
 * 3. É REVERSÍVEL e identificável: tudo nasce com o prefixo `dev-` no slug, e
 *    `--undo` remove exatamente o que este script criou.
 *
 * Uso:
 *   node tools/dev-seed/seed-storefront.mjs          # semeia
 *   node tools/dev-seed/seed-storefront.mjs --undo   # remove o que semeou
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const PREFIX = "dev-";
const CONTAINER = "midas-local-postgres-1";
const DB_USER = "midas_local";
const DB_NAME = "midas_local";
const ART_DIR = resolve(process.cwd(), "apps/web/public/assets/catalogo-dev");
const ART_URL = "/assets/catalogo-dev";

/** UUIDv7: prefixo temporal + aleatório, como manda `docs/17`. */
function uuidv7(when) {
  const ms = BigInt(when).toString(16).padStart(12, "0");
  const rand = [...crypto.getRandomValues(new Uint8Array(10))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const hex = ms + "7" + rand.slice(0, 3) + ((0x8 | (Number.parseInt(rand[3], 16) & 0x3)).toString(16)) + rand.slice(4, 19);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** Hash estável do slug: mesma entrada, mesma arte, em qualquer máquina. */
function hashOf(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

const SELLERS = [
  "Forja Aurora", "Casa Meridiano", "Depósito Cinzas",
  "Atelier Vértice", "Bancada Norte", "Coletivo Âmbar",
];

/** Nome, tipo, raridade, desgaste, preço em centavos, estoque. */
const ITEMS = [
  ["Lâmina Auréola", "WEAPON", "LEGENDARY", "FACTORY_NEW", 189900, 2],
  ["Fuzil Cinza-Ferro", "WEAPON", "EPIC", "MINIMAL_WEAR", 74500, 5],
  ["Pistola Brasa", "WEAPON", "RARE", "FIELD_TESTED", 12900, 12],
  ["Punho Obsidiana", "WEAPON", "MYTHIC", "FACTORY_NEW", 459000, 1],
  ["Carabina Salina", "WEAPON", "UNCOMMON", "WELL_WORN", 6400, 20],
  ["Revólver Vespertino", "WEAPON", "EPIC", "MINIMAL_WEAR", 88700, 3],
  ["Pele Vidro Fosco", "SKIN", "RARE", "FACTORY_NEW", 23400, 8],
  ["Pele Malha Antiga", "SKIN", "UNCOMMON", "FIELD_TESTED", 8900, 15],
  ["Pele Corte Solar", "SKIN", "LEGENDARY", "FACTORY_NEW", 267000, 2],
  ["Pele Névoa Baixa", "SKIN", "COMMON", "BATTLE_SCARRED", 2900, 40],
  ["PeleRaiz Escura", "SKIN", "EPIC", "MINIMAL_WEAR", 61200, 6],
  ["Adesivo Meia-Noite", "STICKER", "RARE", null, 4900, 25],
  ["Adesivo Foguete de Papel", "STICKER", "COMMON", null, 1200, 60],
  ["Adesivo Selo Duplo", "STICKER", "EPIC", null, 15800, 9],
  ["Chave Latão", "KEY", "COMMON", null, 1900, 100],
  ["Chave Cobre Velho", "KEY", "UNCOMMON", null, 3400, 45],
  ["Caixa Expedição", "CASE", "RARE", null, 7800, 18],
  ["Caixa Litoral", "CASE", "UNCOMMON", null, 3900, 32],
  ["Caixa Fundição", "CASE", "EPIC", null, 24900, 7],
  ["Emblema Trígono", "OTHER", "LEGENDARY", null, 129900, 4],
];

function slugify(name) {
  return PREFIX + name.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Placa do item: um SVG nosso, com matiz e geometria derivadas do slug.
 * Não é ilustração do item — é uma placa de identidade estável, que dá ao card
 * uma figura reconhecível sem fingir ser a arte de um jogo.
 */
function artFor(slug, label, kind) {
  const h = hashOf(slug);
  const hue = h % 360;
  const tilt = (h >> 8) % 40 - 20;
  const sides = kind === "CASE" ? 4 : kind === "STICKER" ? 6 : 3;
  const points = Array.from({ length: sides }, (_, i) => {
    const a = (Math.PI * 2 * i) / sides - Math.PI / 2;
    return `${(200 + Math.cos(a) * 78).toFixed(1)},${(200 + Math.sin(a) * 78).toFixed(1)}`;
  }).join(" ");
  const initials = label.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" aria-label="${label}">
  <defs>
    <radialGradient id="g" cx="50%" cy="42%">
      <stop offset="0%" stop-color="oklch(72% 0.14 ${hue})"/>
      <stop offset="70%" stop-color="oklch(38% 0.08 ${hue})"/>
      <stop offset="100%" stop-color="oklch(16% 0.02 ${hue})"/>
    </radialGradient>
  </defs>
  <rect width="400" height="400" fill="oklch(13% 0.012 75)"/>
  <circle cx="200" cy="188" r="120" fill="url(#g)" opacity="0.5"/>
  <polygon points="${points}" fill="none" stroke="oklch(78% 0.16 80)" stroke-width="3"
    transform="rotate(${tilt} 200 200)" opacity="0.92"/>
  <text x="200" y="212" text-anchor="middle" font-family="monospace" font-size="52"
    font-weight="700" fill="oklch(94% 0.012 85)" opacity="0.9">${initials}</text>
</svg>
`;
}

function psql(sql, extraArgs = []) {
  return execFileSync(
    "podman",
    ["exec", "-i", CONTAINER, "psql", "-U", DB_USER, "-d", DB_NAME, "-v", "ON_ERROR_STOP=1", ...extraArgs, "-f", "-"],
    { input: sql, encoding: "utf8" },
  );
}

/** Um valor escalar. `-t -A` em vez da meta-instrucao `\t`, que imprime
    "Tuples only is on." junto do resultado e contamina a leitura. */
function psqlValue(sql) {
  return psql(sql, ["-t", "-A"]).trim();
}

const q = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);

if (process.argv.includes("--undo")) {
  console.log(psql(`
BEGIN;
DELETE FROM catalog.listings WHERE public_slug LIKE '${PREFIX}%';
DELETE FROM catalog.catalog_assets WHERE catalog_item_id IN
  (SELECT catalog_item_id FROM catalog.catalog_items WHERE public_slug LIKE '${PREFIX}%');
DELETE FROM catalog.catalog_items WHERE public_slug LIKE '${PREFIX}%';
DELETE FROM sellers.seller_accounts WHERE display_name LIKE '${PREFIX}%';
COMMIT;
`));
  rmSync(ART_DIR, { recursive: true, force: true });
  console.log("Semente de desenvolvimento removida.");
  process.exit(0);
}

mkdirSync(ART_DIR, { recursive: true });
const now = Date.now();

// Idempotente por decisão: rodar o seed duas vezes é um acidente comum, e a
// falha anterior era um `duplicate key` no meio da transação — barulhento e
// sem dizer o que fazer. Aqui ele reconhece o próprio trabalho e para.
const already = Number.parseInt(
  psqlValue(`SELECT count(*) FROM catalog.catalog_items WHERE public_slug LIKE '${PREFIX}%';`),
  10,
);
if (already > 0) {
  console.log(`A vitrine já está semeada: ${String(already)} itens com prefixo '${PREFIX}'.`);
  console.log("Para recriar do zero: node tools/dev-seed/seed-storefront.mjs --undo && node tools/dev-seed/seed-storefront.mjs");
  process.exit(0);
}

const planRow = psqlValue("SELECT listing_plan_id FROM catalog.listing_plans WHERE plan_code = 'BASIC';");
if (!planRow) throw new Error("plano BASIC ausente — rode `pnpm db:migrate` antes");

const sellerIds = SELLERS.map(() => uuidv7(now));
const lines = ["BEGIN;"];

SELLERS.forEach((name, i) => {
  lines.push(`INSERT INTO sellers.seller_accounts (seller_account_id, display_name, account_type, seller_account_status)
VALUES (${q(sellerIds[i])}, ${q(PREFIX + name)}, 'INDIVIDUAL', 'ACTIVE');`);
});

ITEMS.forEach((row, i) => {
  const [name, kind, rarity, wear, priceMinor, qty] = row;
  const slug = slugify(name);
  const itemId = uuidv7(now + i);
  const assetId = uuidv7(now + i);
  const listingId = uuidv7(now + i);
  const seller = sellerIds[i % sellerIds.length];

  writeFileSync(resolve(ART_DIR, `${slug}.svg`), artFor(slug, name, kind), "utf8");

  lines.push(`INSERT INTO catalog.catalog_items
  (catalog_item_id, public_slug, display_name, description, game_origin, item_type, rarity, craft_quality)
VALUES (${q(itemId)}, ${q(slug)}, ${q(name)},
  ${q(`Item de amostra para desenvolvimento local. Não representa item de jogo de terceiro.`)},
  'AMOSTRA_DEV', ${q(kind)}, ${q(rarity)}, ${q(wear)});`);

  lines.push(`INSERT INTO catalog.catalog_assets
  (catalog_asset_id, catalog_item_id, asset_type, storage_uri, storage_provider,
   file_size_bytes, mime_type, width_pixels, height_pixels, is_primary, approval_status, approved_at)
VALUES (${q(assetId)}, ${q(itemId)}, 'POSTER_2D', ${q(`${ART_URL}/${slug}.svg`)}, 'LOCAL',
  1024, 'image/svg+xml', 400, 400, true, 'APPROVED', clock_timestamp());`);

  lines.push(`INSERT INTO catalog.listings
  (listing_id, public_slug, catalog_item_id, seller_account_id, listing_plan_id,
   listing_status, price_minor, currency, quantity_available, condition_notes, published_at)
VALUES (${q(listingId)}, ${q(`${slug}-oferta`)}, ${q(itemId)}, ${q(seller)}, ${q(planRow)},
  'PUBLISHED', ${priceMinor}, 'BRL', ${qty},
  ${q("Anúncio de amostra criado pelo seed de desenvolvimento local.")}, clock_timestamp());`);
});

lines.push("COMMIT;");
psql(lines.join("\n"));

const count = psqlValue("SELECT count(*) FROM catalog.listings WHERE listing_status = 'PUBLISHED';");
console.log(`Semeado: ${SELLERS.length} vendedores, ${ITEMS.length} itens, ${ITEMS.length} anúncios.`);
console.log(`Anúncios PUBLISHED no banco agora: ${count}`);
console.log(`Arte gerada em ${ART_DIR}`);
console.log("Para desfazer: node tools/dev-seed/seed-storefront.mjs --undo");
