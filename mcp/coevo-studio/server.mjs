#!/usr/bin/env node
/**
 * MCP de Coevo Studio — el puente entre el taller (Claude + skills) y la memoria de cada marca.
 * openspec/changes/studio-v2 (design.md §8, tarea P.2).
 *
 * Lee: marcas en seis bloques, archivos, poses curadas, notas del cliente, generaciones,
 * proyectos de video. Escribe: notas resueltas y proyectos de video (con versión: no pisa).
 * `subir_entrega` llega con la tabla de entregas (tarea P.3).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { BASE, api, download, findBrand, brandBlocks, brandSummary } from "./studio.mjs";

const server = new McpServer({ name: "coevo-studio", version: "0.1.0" });

const ok = (data) => ({ content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] });
const tool = (name, description, schema, fn) =>
    server.tool(name, description, schema, async (args) => {
        try { return ok(await fn(args)); } catch (e) { return { isError: true, content: [{ type: "text", text: e.message }] }; }
    });

const BLOQUES = ["quien_es", "identidad_grafica", "direccion_foto_video", "caras", "catalogo"];

tool("listar_marcas",
    "Las marcas de Coevo Studio con qué tiene cargado cada una. Usar primero para saber el id de una marca.",
    {},
    async () => {
        const { brands } = await api("/api/brands");
        return { studio: BASE, marcas: brands.filter((b) => b.id !== "__sandbox__").map(brandSummary) };
    });

tool("ver_marca",
    "La memoria de una marca: quién es, identidad gráfica, dirección de foto y video, caras (avatares y voces) y catálogo. " +
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

await server.connect(new StdioServerTransport());
