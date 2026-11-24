#!/usr/bin/env node
/**
 * MCP de Coevo Studio — el puente entre el taller (Claude + skills) y la memoria de cada marca.
 * openspec/changes/studio-v2 (design.md §8, tarea P.2).
 *
 * Lee: marcas en seis bloques, archivos, poses curadas, notas del cliente, generaciones,
 * proyectos de video, entregas con sus comentarios. Escribe: entregas (subir y nueva ronda),
 * comentarios resueltos, notas resueltas y proyectos de video (con versión: no pisa).
 *
 * Las herramientas están en tools.mjs (las comparte con el remoto, http.mjs).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.mjs";

const server = new McpServer({ name: "coevo-studio", version: "0.1.0" });
registerTools(server);
await server.connect(new StdioServerTransport());
