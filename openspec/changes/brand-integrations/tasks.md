## 0. Antes de construir

- [x] 0.1 API de Postiz: métricas por canal y por publicación, grupos de clientes, links de invitación, MCP (2026-10-09).
- [ ] 0.2 Verificar permisos de Meta (Instagram Graph API, Marketing API) y si hace falta revisión de app.
- [ ] 0.3 Decidir dónde viven credenciales, tareas programadas y métricas (base de datos).

## 1. Métricas vía Postiz

- [ ] 1.1 Asociar cada marca de Coevo a su grupo de clientes en Postiz (API key en .env).
- [ ] 1.2 Sincronización diaria: métricas por canal y por publicación, guardadas en la base (infra-v1).
- [ ] 1.3 PerformancePage con datos reales (reemplaza el placeholder) y reporte mensual en el portal del cliente.
- [ ] 1.4 (Después, opcional) Meta Ads con la Marketing API propia.

## 2. Postiz

- [ ] 2.1 Conectar Postiz por marca.
- [ ] 2.2 Programar una pieza aprobada; ver su estado en el dashboard.
- [ ] 2.3 Cruzar cada publicación con sus métricas de Meta.
