// Prueba rápida de la conexión (sin el MCP): `npm run check`.
import { BASE, api, brandBlocks, brandSummary, findBrand } from "./studio.mjs";

const { brands } = await api("/api/brands");
console.log(`${BASE}: ${brands.length} marcas`);
for (const b of brands.slice(0, 3)) console.log(" ", JSON.stringify(brandSummary(b).tiene), b.name);
const morph = await findBrand("morph");
const blocks = brandBlocks(await api(`/api/brands/${morph.id}`));
console.log(`${morph.name}: bloques`, Object.keys(blocks).filter((k) => !["id", "nombre"].includes(k)).join(", "));
