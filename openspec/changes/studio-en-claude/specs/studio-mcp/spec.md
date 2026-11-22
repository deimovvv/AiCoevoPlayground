# Spec delta — studio-mcp

## ADDED Requirements

### Requirement: MCP remoto con el login de Studio
Studio SHALL publicar su MCP en `/mcp` (Streamable HTTP) protegido por OAuth 2.1 (registro dinámico, PKCE S256).
La autorización SHALL ocurrir en `/oauth/authorize`, detrás de Cloudflare Access, y el token SHALL quedar atado al mail
de quien autorizó.

#### Scenario: Sin token
- **WHEN** se llama a `/mcp` sin token, con un token vencido o con uno cortado
- **THEN** responde 401 y no devuelve ningún dato

#### Scenario: Cliente
- **WHEN** un usuario con rol cliente usa el MCP
- **THEN** ve sólo sus marcas y sólo lo que la app ya le deja ver (mismas reglas que `RoleGuard`)

### Requirement: Un documento, un link
`guardar_link` SHALL actualizar el link existente de la marca si coincide la url o el título, en vez de crear otro.

#### Scenario: Volver a guardar
- **WHEN** se guarda un link con la misma url que uno existente
- **THEN** se actualiza ese mismo registro y la marca sigue teniendo uno solo
