#!/usr/bin/env node
/**
 * MCP de Coevo Studio — el puente entre el taller (Claude + skills) y la memoria de cada marca.
 * openspec/changes/studio-v2 (design.md §8, tarea P.2).
 *
 * Lee: marcas en seis bloques, archivos, poses curadas, notas del cliente, generaciones,
 * proyectos de video, entregas con sus comentarios. Escribe: entregas (subir y nueva ronda),
 * comentarios resueltos, notas resueltas y proyectos de video (con versión: no pisa).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { BASE, api, download, findBrand, brandBlocks, brandSummary, filesForm } from "./studio.mjs";

const server = new McpServer({ name: "coevo-studio", version: "0.1.0" });

const ok = (data) => ({ content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] });
const tool = (name, description, schema, fn) =>
    server.tool(name, description, schema, async (args) => {
        try { return ok(await fn(args)); } catch (e) { return { isError: true, content: [{ type: "text", text: e.message }] }; }
    });

const BLOQUES = ["quien_es", "identidad_grafica", "direccion_foto_video", "caras", "catalogo", "estrategia"];

tool("listar_marcas",
    "Las marcas de Coevo Studio con qué tiene cargado cada una. Usar primero para saber el id de una marca.",
    {},
    async () => {
        const { brands } = await api("/api/brands");
        return { studio: BASE, marcas: brands.filter((b) => b.id !== "__sandbox__").map(brandSummary) };
    });

tool("ver_marca",
    "La memoria de una marca: quién es, identidad gráfica, dirección de foto y video, caras (avatares y voces), catálogo y estrategia (claim, enemigo, ángulos, calendario). " +
    "Leerla ANTES de producir cualquier pieza para esa marca. Los archivos vienen como URL de Studio: para verlos, usar bajar_archivo.",
    {
        marca: z.string().describe("id o nombre de la marca (ej. 'morph-ai', 'Taller Santa Clara')"),
        bloque: z.enum(BLOQUES).optional().describe("sólo un bloque; sin esto, todos"),
    },
    async ({ marca, bloque }) => {
        const b = await api(`/api/brands/${encodeURIComponent((await findBrand(marca)).id)}`);
        const blocks = brandBlocks(b);
        return bloque ? { id: blocks.id, nombre: blocks.nombre, [bloque]: blocks[bloque] } : blocks;
    });

tool("bajar_archivo",
    "Baja un archivo de Studio (una URL /static/... de ver_marca: avatar, prenda, moodboard, fondo) a una carpeta local y devuelve la ruta, para mirarlo o usarlo de referencia.",
    {
        url: z.string().describe("URL de Studio, ej. /static/avatars/morph-ai_c0433814.png"),
        carpeta: z.string().optional().describe("carpeta destino; por defecto una temporal"),
    },
    async ({ url, carpeta }) => ({ ruta: await download(url, carpeta || join(tmpdir(), "coevo-studio")) }));

tool("ver_poses",
    "Poses curadas de Coevo (maniquí gris: se copia postura y encuadre, nunca la ropa), para todas las marcas.",
    {
        genero: z.enum(["mujer", "hombre"]).optional(),
        plano: z.enum(["cuerpo-entero", "medio", "inferior", "detalle"]).optional(),
        toma: z.string().optional().describe("id de toma del Ecommerce Pack, ej. model_medium"),
    },
    async ({ genero, plano, toma }) => {
        const q = new URLSearchParams({ ...(genero && { gender: genero }), ...(plano && { plano }), ...(toma && { shot: toma }) });
        return api(`/api/system/poses${q.size ? "?" + q : ""}`);
    });

tool("ver_notas_cliente",
    "Lo que comentó o pidió el cliente de una marca (notas del portal), lo más nuevo primero. Leerlas antes de corregir o de armar el próximo pedido.",
    { marca: z.string(), pendientes: z.boolean().optional().describe("sólo las no resueltas (por defecto sí)") },
    async ({ marca, pendientes = true }) => {
        const { notes } = await api(`/api/brands/${encodeURIComponent((await findBrand(marca)).id)}/portal/notes`);
        return { notas: pendientes ? notes.filter((n) => !n.resolvedAt && !n.resolved) : notes };
    });

tool("marcar_nota_resuelta",
    "Marca una nota del cliente como resuelta, después de aplicar el cambio. Sólo con el OK de la persona.",
    { marca: z.string(), nota_id: z.string() },
    async ({ marca, nota_id }) => api(
        `/api/brands/${encodeURIComponent((await findBrand(marca)).id)}/portal/notes/${encodeURIComponent(nota_id)}/resolve`,
        { method: "POST", body: {} }));

tool("ver_generaciones",
    "Las últimas generaciones (corridas de tools) de una marca: qué se hizo, con qué tool, cuándo y su costo si lo tiene.",
    { marca: z.string(), limite: z.number().int().min(1).max(100).optional() },
    async ({ marca, limite = 20 }) => {
        const { generations } = await api(`/api/generations?brandId=${encodeURIComponent((await findBrand(marca)).id)}`);
        return generations.slice(0, limite).map((g) => ({
            id: g.id, tool: g.toolId || g.tool, titulo: g.title || g.name || null, creada: g.createdAt,
            estado: g.status || null, costo: g.cost ?? g.totalCost ?? null,
        }));
    });

tool("proyectos_video",
    "Los proyectos de video (timelines) de una marca guardados en Studio.",
    { marca: z.string() },
    async ({ marca }) => api(`/api/brands/${encodeURIComponent((await findBrand(marca)).id)}/video-projects`));

tool("ver_proyecto_video",
    "Un proyecto de video con su timeline completo y su versión (hace falta para guardar).",
    { id: z.string() },
    async ({ id }) => api(`/api/video-projects/${encodeURIComponent(id)}`));

tool("guardar_proyecto_video",
    "Guarda el timeline de un proyecto de video. Pasar la versión que se leyó: si alguien lo cambió después, " +
    "Studio responde 409 y hay que volver a leerlo (no se pisa trabajo ajeno).",
    {
        id: z.string(),
        version: z.number().int(),
        timeline: z.record(z.any()).optional(),
        titulo: z.string().optional(),
    },
    async ({ id, version, timeline, titulo }) => {
        try {
            return await api(`/api/video-projects/${encodeURIComponent(id)}`, {
                method: "PUT", body: { version, ...(timeline && { timeline }), ...(titulo && { title: titulo }) },
            });
        } catch (e) {
            if (e.status === 409) throw new Error("Conflicto: el proyecto cambió desde que lo leíste. Leelo de nuevo con ver_proyecto_video y reaplicá el cambio.");
            throw e;
        }
    });

// ── Entregas (studio-v2 P.3) ───────────────────────────────────────────────

const entregaCorta = (d) => ({
    id: d.id, titulo: d.title, tipo: d.kind, estado: d.status, ronda: d.round, laminas: d.items?.length ?? d.items,
    visible_para: d.visibility === "cliente" ? "cliente" : "sólo el equipo",
    campana: d.campaignName ?? null, etapa: d.stage ?? null,
    comentarios_abiertos: d.openComments, aprobada_por: d.approvedBy, actualizada: d.updatedAt,
});

tool("ver_entregas",
    "Las entregas de una marca (carruseles, videos, imágenes) con su estado: en_revision, cambios o aprobada, y cuántos comentarios abiertos tiene cada una.",
    { marca: z.string() },
    async ({ marca }) => (await api(`/api/brands/${encodeURIComponent((await findBrand(marca)).id)}/deliveries`)).map(entregaCorta));

tool("ver_entrega",
    "Una entrega completa: sus láminas (URL de Studio), la fuente editable y los comentarios — cada uno con la lámina, el punto (x, y de 0 a 1, desde arriba a la izquierda) y la ronda. " +
    "Usar antes de corregir: aplicar sólo lo comentado y dejar todo lo demás igual.",
    { id: z.string() },
    async ({ id }) => {
        const d = await api(`/api/deliveries/${encodeURIComponent(id)}`);
        const label = Object.fromEntries((d.items || []).map((i) => [i.id, i.label]));
        return {
            ...entregaCorta(d), nota: d.note, plantilla: d.template, fuente: d.source,
            // aprobada=false: el cliente dijo «esta no». Para la etapa siguiente (ej. el video), usar sólo las aprobadas.
            laminas: d.items.map((i) => ({ id: i.id, etiqueta: i.label, tipo: i.kind, url: i.url, aprobada: !i.rejected })),
            comentarios: d.comments.map((c) => ({
                id: c.id, lamina: c.itemId ? `${label[c.itemId] ?? "(ronda anterior)"} [${c.itemId}]` : "toda la entrega",
                punto: c.x != null ? { x: c.x, y: c.y } : null, texto: c.text, autor: c.author, ronda: c.round,
                de: c.internal ? "equipo" : "cliente",
                resuelto: !!c.resolvedAt,
            })),
        };
    });

tool("subir_entrega",
    "Sube una pieza terminada a Entregas de la marca para que la vean y comenten. `archivos` son las láminas EN ORDEN " +
    "(png/jpg/webp/mp4, rutas locales); `fuente` es el archivo editable (ej. el HTML del carrusel) para poder corregir después. " +
    "Queda INTERNA: la ve sólo el equipo; mandarla al cliente lo decide una persona desde Studio. Subir sólo con el OK de la persona.",
    {
        marca: z.string(),
        titulo: z.string(),
        archivos: z.array(z.string()).min(1).describe("rutas locales, en el orden en que se ven"),
        tipo: z.enum(["carrusel", "video", "imagenes"]).optional(),
        etiquetas: z.array(z.string()).optional().describe("nombre de cada lámina, mismo orden (ej. Portada)"),
        fuente: z.string().optional().describe("ruta local de la fuente editable"),
        nota: z.string().optional().describe("qué es y qué hay que mirar"),
        plantilla: z.string().optional().describe("plantilla y versión usadas, ej. 'carrusel-v1'"),
        campana_id: z.string().optional().describe("id de la campaña (ver_campanas), si la pieza es parte de una"),
        etapa: z.string().optional().describe("etapa dentro de la campaña, ej. '01 Fotos', '02 Video'"),
    },
    async ({ marca, titulo, archivos, tipo = "carrusel", etiquetas, fuente, nota, plantilla, campana_id, etapa }) => {
        const b = await findBrand(marca);
        const form = filesForm({ title: titulo, kind: tipo, note: nota, template: plantilla, labels: etiquetas?.join("|"), campaignId: campana_id, stage: etapa }, archivos, fuente);
        const d = await api(`/api/brands/${encodeURIComponent(b.id)}/deliveries`, { method: "POST", form });
        return { ...entregaCorta(d), ver_en: `${BASE}/dashboard/entregas?id=${d.id}` };
    });

tool("nueva_ronda",
    "Sube la versión corregida de una entrega (todas las láminas otra vez, en orden). Vuelve a 'en revisión' e INTERNA (el equipo la revisa antes de volver a mandarla); los comentarios viejos quedan con su ronda. " +
    "Después, marcar como resueltos los comentarios aplicados con resolver_comentario.",
    {
        id: z.string(),
        archivos: z.array(z.string()).min(1),
        etiquetas: z.array(z.string()).optional(),
        fuente: z.string().optional(),
        nota: z.string().optional().describe("qué cambió en esta ronda"),
    },
    async ({ id, archivos, etiquetas, fuente, nota }) => {
        const form = filesForm({ note: nota, labels: etiquetas?.join("|") }, archivos, fuente);
        return entregaCorta(await api(`/api/deliveries/${encodeURIComponent(id)}/round`, { method: "POST", form }));
    });

tool("resolver_comentario",
    "Marca un comentario de una entrega como resuelto (o lo reabre si ya estaba resuelto).",
    { entrega_id: z.string(), comentario_id: z.string() },
    async ({ entrega_id, comentario_id }) => api(
        `/api/deliveries/${encodeURIComponent(entrega_id)}/comments/${encodeURIComponent(comentario_id)}/resolve`, { method: "POST", body: {} }));

// ── Campañas (studio-v2 §15): la dirección de ESTA pieza; gana en lo suyo sobre la marca ────

const TIPO = { moodboard: "moodboard", lookfeel: "luz", background: "locacion", plano: "planos", pose: "poses",
    avatar: "casting", clothing: "prendas", product: "productos", reference: "otras" };

tool("ver_campanas",
    "Las campañas de una marca (cada una con su idea y su tablero de referencias).",
    { marca: z.string() },
    async ({ marca }) => {
        const { campaigns } = await api(`/api/campaigns?brandId=${encodeURIComponent((await findBrand(marca)).id)}`);
        return campaigns.map((c) => ({ id: c.id, nombre: c.name, idea: c.brief, referencias: (c.inputs || []).length, creada: c.createdAt }));
    });

tool("ver_campana",
    "El tablero de una campaña: la idea y las referencias agrupadas (moodboard, luz, locación, planos, poses, casting, prendas). " +
    "Al producir para una campaña: lo del tablero GANA en su dominio (luz, locación, clima); la marca (ver_marca) pone los límites (siempre/nunca, paleta, caras).",
    { id: z.string() },
    async ({ id }) => {
        const c = await api(`/api/campaigns/${encodeURIComponent(id)}`);
        const tablero = {};
        for (const i of c.inputs || []) (tablero[TIPO[i.type] || "otras"] ||= []).push({ nombre: i.name, url: i.url });
        return { id: c.id, nombre: c.name, marca: c.brandId, idea: c.brief, tablero };
    });

// ── Costo de lo que se genera desde las skills (fuera de las tools de Studio) ──

tool("registrar_costo",
    "Registra en Studio lo que se generó desde una skill (fotos con Nano Banana / GPT, clips con Seedance o Kling, voces), " +
    "con su costo real, para que sume al gasto del mes de la marca. Llamarla UNA vez por tanda generada, después de generar.",
    {
        marca: z.string(),
        que: z.string().describe("qué se hizo, ej. 'Oxidian · 9 tomas animadas 1080p'"),
        usd: z.number().min(0).describe("costo total en dólares, con los precios verificados"),
        modelo: z.string().describe("modelo principal, ej. 'seedance-2.5-kie' o 'nano-banana-2'"),
        tipo: z.enum(["video", "image", "copy"]).optional(),
        imagenes: z.number().int().min(0).optional(),
        clips: z.number().int().min(0).optional(),
        segundos: z.number().min(0).optional().describe("segundos de video generados"),
        campana_id: z.string().optional(),
        verificado: z.boolean().optional().describe("true si el precio salió de la tabla oficial del proveedor"),
    },
    async ({ marca, que, usd, modelo, tipo = "video", imagenes = 0, clips = 0, segundos = 0, campana_id, verificado = false }) => {
        const b = await findBrand(marca);
        const g = await api("/api/generations", {
            method: "POST",
            body: {
                brandId: b.id, campaignId: campana_id ?? null, toolId: "skill", title: que, type: tipo, status: "completed",
                metadata: { origen: "skill (Claude local)", modelo },
                cost: { usd, images: imagenes, videoClips: clips, videoSeconds: segundos, ttsChars: 0, byModel: { [modelo]: usd }, verified: verificado },
            },
        });
        return { registrado: g.id ?? true, marca: b.name, usd };
    });

await server.connect(new StdioServerTransport());
