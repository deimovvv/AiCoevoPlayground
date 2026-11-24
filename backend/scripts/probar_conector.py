"""Prueba de punta a punta del conector de Claude (studio-en-claude, paso 1). Con la API local en :8001 y el MCP (http.mjs) corriendo:
    cd backend && .venv/bin/python scripts/probar_conector.py
No genera nada ni gasta: registra una app de prueba, autoriza como admin local y llama a listar_marcas."""
import base64, hashlib, json, re, secrets, sys
from urllib.parse import urlparse, parse_qs
import httpx

B = "http://127.0.0.1:8001"
ok = lambda c, m: print(("OK  " if c else "MAL ") + m) or (c or sys.exit(1))
c = httpx.Client(base_url=B, follow_redirects=False, timeout=60)

r = c.post("/mcp", json={})
ok(r.status_code == 401 and "resource_metadata" in r.headers.get("www-authenticate", ""), "sin token: 401 con la dirección del login")
ok(c.post("/mcp", json={}, headers={"Authorization": "Bearer stk_inventado"}).status_code == 401, "token inventado: 401")
meta = c.get("/.well-known/oauth-protected-resource").json()
asm = c.get("/.well-known/oauth-authorization-server").json()
ok(meta["resource"].endswith("/mcp") and asm["code_challenge_methods_supported"] == ["S256"], "descubrimiento")
ok(c.post("/oauth/register", json={"redirect_uris": ["https://malo.com/cb"]}).status_code == 400, "registro con vuelta ajena: rechazado")
reg = c.post("/oauth/register", json={"redirect_uris": ["http://localhost:9999/callback"], "client_name": "Prueba"}).json()
cid = reg["client_id"]
ver = secrets.token_urlsafe(48)
chal = base64.urlsafe_b64encode(hashlib.sha256(ver.encode()).digest()).rstrip(b"=").decode()
q = {"client_id": cid, "redirect_uri": "http://localhost:9999/callback", "response_type": "code",
     "code_challenge": chal, "code_challenge_method": "S256", "state": "xyz"}
page = c.get("/oauth/authorize", params=q)
ok(page.status_code == 200 and "Autorizar" in page.text, "pantalla «Autorizar»")
csrf = re.search(r'name="csrf" value="([^"]+)"', page.text).group(1)
form = {"client_id": cid, "redirect_uri": q["redirect_uri"], "code_challenge": chal, "state": "xyz", "csrf": csrf, "decision": "ok"}
bad = c.post("/oauth/authorize", data={**form, "csrf": "x" * 64})
ok(bad.status_code == 400, "formulario sin firma válida: rechazado")
r = c.post("/oauth/authorize", data=form)
loc = parse_qs(urlparse(r.headers["location"]).query)
ok(r.status_code == 302 and loc["state"] == ["xyz"], "autorizar devuelve código y state")
code = loc["code"][0]
ok(c.post("/oauth/token", data={"grant_type": "authorization_code", "code": code, "redirect_uri": q["redirect_uri"],
                                "client_id": cid, "code_verifier": "otro"}).status_code == 400, "PKCE incorrecto: rechazado")
t = c.post("/oauth/token", data={"grant_type": "authorization_code", "code": code, "redirect_uri": q["redirect_uri"],
                                 "client_id": cid, "code_verifier": ver})
ok(t.status_code == 200, "código → token")
ok(c.post("/oauth/token", data={"grant_type": "authorization_code", "code": code, "redirect_uri": q["redirect_uri"],
                                "client_id": cid, "code_verifier": ver}).status_code == 400, "el código no se usa dos veces")
tok = t.json()
H = {"Authorization": f"Bearer {tok['access_token']}", "Accept": "application/json, text/event-stream", "Content-Type": "application/json"}
rpc = lambda m, p=None, i=1: c.post("/mcp", headers=H, json={"jsonrpc": "2.0", "id": i, "method": m, "params": p or {}})
init = rpc("initialize", {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "prueba", "version": "1"}})
ok(init.status_code == 200 and init.json()["result"]["serverInfo"]["name"] == "coevo-studio", "MCP: initialize")
names = sorted(t["name"] for t in rpc("tools/list", i=2).json()["result"]["tools"])
print("    herramientas:", names)
ok("listar_marcas" in names and "subir_entrega" not in names and "bajar_archivo" not in names, "remoto: sólo las de leer")
res = rpc("tools/call", {"name": "listar_marcas", "arguments": {}}, i=3).json()["result"]
marcas = json.loads(res["content"][0]["text"])["marcas"]
ok(not res.get("isError") and len(marcas) > 0, f"listar_marcas como admin local: {len(marcas)} marcas")
r2 = c.post("/oauth/token", data={"grant_type": "refresh_token", "refresh_token": tok["refresh_token"], "client_id": cid})
ok(r2.status_code == 200, "refresh → token nuevo")
ok(c.post("/oauth/token", data={"grant_type": "refresh_token", "refresh_token": tok["refresh_token"]}).status_code == 400, "el refresh viejo ya no sirve (rota)")
ok(rpc("tools/list").status_code == 401, "el token viejo quedó cortado al rotar")
print(json.dumps({"client_id": cid}))
