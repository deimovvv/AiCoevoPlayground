#!/usr/bin/env node
/**
 * MCP de Coevo Studio por HTTP — para claude.ai y Claude Code (openspec/changes/studio-en-claude).
 *
 * No se expone solo: la API de Studio recibe `/mcp`, valida el token de la persona y reenvía acá
 * (backend/routers/mcp_remote.py). Cada pedido arma un servidor nuevo (sin sesión) y las herramientas
 * llaman a la API por adentro con ESE token, así `roles.py` decide qué ve cada uno.
 *
 *   MCP_PORT          puerto (3001)
 *   STUDIO_API_URL    la API por adentro (en Docker: http://api:8000; en local: http://127.0.0.1:8000)
 *   COEVO_STUDIO_URL  la dirección pública, para los links «ver_en» (https://app.coevoagency.com)
 */
import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerTools } from "./tools.mjs";
import { requestAuth } from "./studio.mjs";

const PORT = Number(process.env.MCP_PORT || 3001);
const API = (process.env.STUDIO_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

const json = (res, status, body) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };

async function readBody(req) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString("utf8");
    return raw ? JSON.parse(raw) : undefined;
}

createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/health") return json(res, 200, { ok: true });
    if (url.pathname !== "/mcp") return json(res, 404, { error: "not found" });
    const m = /^Bearer\s+(stk_\S+)$/i.exec(req.headers.authorization || "");
    if (!m) return json(res, 401, { error: "Falta el token de Studio." });
    if (req.method !== "POST") return json(res, 405, { jsonrpc: "2.0", error: { code: -32000, message: "Sólo POST (sin sesión)." }, id: null });
    let body;
    try { body = await readBody(req); } catch { return json(res, 400, { error: "JSON inválido" }); }
    await requestAuth.run({ token: m[1], apiBase: API }, async () => {
        const server = new McpServer({ name: "coevo-studio", version: "0.2.0" });
        registerTools(server, { remote: true });
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
        res.on("close", () => { transport.close(); server.close(); });
        try {
            await server.connect(transport);
            await transport.handleRequest(req, res, body);
        } catch (e) {
            if (!res.headersSent) json(res, 500, { jsonrpc: "2.0", error: { code: -32603, message: e.message }, id: null });
        }
    });
}).listen(PORT, () => console.log(`MCP de Studio (HTTP) en :${PORT} → API ${API}`));
