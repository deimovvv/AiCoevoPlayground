/**
 * Cliente de la API de Coevo Studio (sin dependencias del MCP: lo usa también check.mjs).
 *
 * - Dirección: COEVO_STUDIO_URL (por defecto la de producción). En dev: http://127.0.0.1:8000.
 * - Llave: token de servicio de Cloudflare Access en ~/.coevo-studio-token
 *   (CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET). Nunca se imprime.
 */
import { readFileSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename } from "node:path";

export const BASE = (process.env.COEVO_STUDIO_URL || "https://app.coevoagency.com").replace(/\/$/, "");
const TOKEN_FILE = process.env.COEVO_STUDIO_TOKEN_FILE || join(homedir(), ".coevo-studio-token");

function accessHeaders() {
    if (/^https?:\/\/(127\.0\.0\.1|localhost)/.test(BASE)) return {};
    let txt;
    try { txt = readFileSync(TOKEN_FILE, "utf8"); } catch {
        throw new Error(`Falta la llave de Studio en ${TOKEN_FILE} (CF_ACCESS_CLIENT_ID y CF_ACCESS_CLIENT_SECRET).`);
    }
    const env = Object.fromEntries(txt.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && l.includes("="))
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
    if (!env.CF_ACCESS_CLIENT_ID || !env.CF_ACCESS_CLIENT_SECRET) throw new Error(`${TOKEN_FILE} está incompleto.`);
    return { "CF-Access-Client-Id": env.CF_ACCESS_CLIENT_ID, "CF-Access-Client-Secret": env.CF_ACCESS_CLIENT_SECRET };
}

export async function api(path, { method = "GET", body, form } = {}) {
    const res = await fetch(BASE + path, {
        method,
        headers: { ...accessHeaders(), ...(body ? { "Content-Type": "application/json" } : {}) },
        body: form ?? (body ? JSON.stringify(body) : undefined),
        redirect: "manual",
    });
    if (res.status >= 300 && res.status < 400) throw new Error("Studio pidió login: la llave no pasó por Cloudflare Access.");
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) {
        const detail = typeof data === "object" && data?.detail ? data.detail : String(text).slice(0, 200);
        const err = new Error(`Studio ${res.status}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
        err.status = res.status;
        throw err;
    }
    return data;
}

/** Baja un archivo de Studio (/static/...) a una carpeta local; devuelve la ruta. */
export async function download(url, dir) {
    const full = url.startsWith("http") ? url : BASE + (url.startsWith("/") ? url : "/" + url);
    if (!full.startsWith(BASE)) throw new Error("Sólo se bajan archivos de Coevo Studio.");
    const res = await fetch(full, { headers: accessHeaders(), redirect: "manual" });
    if (!res.ok) throw new Error(`No se pudo bajar ${url} (${res.status}).`);
    mkdirSync(dir, { recursive: true });
    const out = join(dir, basename(new URL(full).pathname));
    writeFileSync(out, Buffer.from(await res.arrayBuffer()));
    return out;
}

// ── Marcas ─────────────────────────────────────────────────────────────────

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "");

export async function findBrand(query) {
    const { brands } = await api("/api/brands");
    const q = norm(query);
    const hit = brands.find((b) => b.id === query) || brands.find((b) => norm(b.id) === q || norm(b.name) === q)
        || brands.find((b) => norm(b.name).includes(q) || norm(b.id).includes(q));
    if (!hit) throw new Error(`No encontré la marca "${query}". Marcas: ${brands.map((b) => b.name).join(", ")}.`);
    return hit;
}

const files = (list) => (list || []).map((x) => ({
    id: x.id, nombre: x.name, ...(x.description ? { descripcion: x.description } : {}),
    ...(x.tags?.length ? { tags: x.tags } : {}), url: x.imageUrl,
}));

/**
 * La marca en los seis bloques de studio-v2 (design.md §7), sin el texto crudo de las fuentes.
 * Los archivos van como URL de Studio: para verlos, `bajar_archivo`.
 */
export function brandBlocks(b) {
    const dna = b.dna || {};
    const { colors, ...dnaRest } = dna;
    return {
        id: b.id,
        nombre: b.name,
        quien_es: {
            contexto: b.brandContext || null,
            negocio: b.business || null,
            dna: Object.keys(dnaRest).length ? dnaRest : null,
            fuentes: (b.brandSources || []).map((s) => ({ tipo: s.type, url: s.url || null, etiqueta: s.label || null })),
        },
        identidad_grafica: {
            colores: colors || null,
            tipografias: b.fonts || null,
            logos: files(b.logos),
            paginas_del_manual: files(b.manualPages),
            design_system: b.designSystemUrl || null,
            ...(b.designSystemUrl
                ? { como_usarlo: "Para piezas gráficas (carruseles, posts, láminas, webs) usar este Design System de Claude Design: leer su README (project/README.md) antes de diseñar; tiene tokens, fuentes, logos y piezas tipo." }
                : { falta: "Esta marca todavía no tiene Design System de Claude Design: pedirlo a Gonzalo antes de hacer piezas gráficas." }),
            archivos_de_trabajo: (b.workLinks || []).map((l) => ({ titulo: l.title, tipo: l.kind, url: l.url, lo_ve_el_cliente: !!l.client })),
            regla_archivos: "Una pieza nueva (carrusel, post, story) se suma DENTRO del archivo de tipo «piezas» de la marca, no en un artifact nuevo. Si la marca no tiene uno, crearlo una vez y cargar su link en Studio (Marca → Archivos).",
        },
        direccion_foto_video: {
            reglas: b.designSystem || null,
            moodboards: files(b.moodboards),
            luz: files(b.lookAndFeel),
            locaciones: files(b.backgrounds),
            poses: files(b.poses),
            planos: files(b.shotRefs),
            referencias_de_carrusel: files(b.carouselRefs),
        },
        caras: {
            avatares: files(b.avatars),
            voces: (b.voicePresets || []).map((v) => ({ id: v.id, nombre: v.name })),
        },
        catalogo: { productos: files(b.products), prendas: files(b.clothing) },
    };
}

export function brandSummary(b) {
    const n = (k) => (b[k] || []).length;
    return {
        id: b.id, nombre: b.name,
        tiene: {
            contexto: !!b.brandContext, dna: !!b.dna, direccion_foto: !!b.designSystem?.photoStyle,
            tipografias: !!b.fonts, avatares: n("avatars"), prendas: n("clothing"), productos: n("products"),
            moodboards: n("moodboards"), fondos: n("backgrounds"), voces: n("voicePresets"),
        },
    };
}

/** Arma un multipart con archivos locales (láminas en orden + fuente opcional). */
export function filesForm(fields, files, source) {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) if (v != null && v !== "") form.append(k, String(v));
    const add = (field, path) => {
        statSync(path);  // falla claro si no existe
        form.append(field, new Blob([readFileSync(path)]), basename(path));
    };
    files.forEach((p) => add("files", p));
    if (source) add("source", source);
    return form;
}
