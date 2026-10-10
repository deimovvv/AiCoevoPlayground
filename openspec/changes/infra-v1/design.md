## Context

Llevar Coevo Studio a producción para que el equipo (3–8 personas) lo use, **lo más barato
posible pero profesional**. Precios verificados en las páginas oficiales el 2026-10-09 (sin IVA).

Antecedente: `docs/archive/planning.md` fase 5 ya decía "archivos en R2, Postgres administrado,
login Clerk o contraseña compartida, Vercel + Render/Railway". Esto lo ajusta con precios reales.

## Qué necesita la app en producción (las variables)

| Variable | Por qué pesa |
|---|---|
| **Renders con FFmpeg y Remotion** | picos de CPU, ~2 GB de RAM, 10–60 s. Descarta lo más chico y complica lo "serverless" |
| Muchas llamadas a APIs externas (Fal, kie, ElevenLabs, Gemini) | ya las paga Coevo por uso; no dependen del hosting |
| Base de datos | Postgres (infra-v1) |
| **Archivos de video** | lo que más cuesta es la salida de datos → R2 (salida gratis) |
| Tarea diaria | sincronizar métricas de Postiz |
| Login del equipo | hoy no hay; es lo primero antes de abrirlo |
| **Claude** | **no se usa en producción**: la app no llama a Claude. Claude trabaja local con la suscripción del usuario y sube el resultado a la marca. Cero costo de API de Anthropic |

## Opciones de servidor (backend)

| Opción | Costo/mes | Qué incluye | Contras |
|---|---|---|---|
| **DigitalOcean droplet 2 vCPU / 4 GB** | **US$24** | todo en una máquina con Docker: API + Postgres + tarea diaria; 4 TB de transferencia | hay que cuidar backups y actualizaciones |
| Hetzner CPX22 2 vCPU / 4 GB | €19,49 + €0,50 IPv4 | igual que arriba | subió de precio el 2026-06-15; los planes baratos (CX/CAX, €5–6) figuran "no disponibles" |
| Railway | US$5 + uso (~US$20 por vCPU-mes, ~US$10 por GB-mes) → ~US$40+ siempre prendido | administrado, deploy desde GitHub | se va de precio con un servidor siempre encendido |
| Render | US$25 (1 CPU / 2 GB) · US$85 (2 CPU / 4 GB) + Postgres aparte | administrado | caro para 4 GB |
| Fly.io | ~US$13 (2 GB) + IPv4 US$2; su Postgres desde US$38 | | Postgres caro |
| Google Cloud Run | gratis hasta 180k vCPU-s/mes, después por uso | escala a cero | Chrome/Remotion y tareas en segundo plano son incómodos; más piezas |

## Base de datos

| Opción | Costo | Ojo |
|---|---|---|
| **En el mismo servidor (Docker)** | **incluido** | backups diarios a R2 por nuestra cuenta |
| Supabase Free | US$0 | 500 MB, **se pausa tras una semana sin uso** |
| Supabase Pro | US$25 | 8 GB, trae login (100k usuarios) |
| Neon Free / Launch | US$0 / por uso | se suspende a los 5 min sin uso (arranque lento) |

## Archivos

**Cloudflare R2**: US$0,015/GB-mes, salida gratis, 10 GB gratis por mes. 100 GB de video ≈ US$1,35/mes.

## Frontend

**Cloudflare Pages**: gratis (500 builds/mes). Vercel Hobby **prohíbe uso comercial** (una
herramienta interna de agencia lo es) → descartado.

## Login del equipo

| Opción | Costo | Cuándo |
|---|---|---|
| **Cloudflare Access** (entrar con Google, sin programar) | gratis hasta 50 usuarios (**a confirmar en la página actual**) | ahora: protege app y API para el equipo |
| Supabase Auth / Clerk | gratis hasta 50k usuarios | después: portal de clientes con cuentas propias |

## Licencias a revisar

- **Remotion** (graba los textos): tiene licencia para empresas; con equipo de más de unas pocas
  personas puede ser paga — **verificar antes de producción**. Alternativa sin costo:
  HyperFrames (Apache 2.0), que ya está en el plan para los bloques animados.

## Recomendación

```
 Cloudflare Pages (frontend, gratis)
        │  Cloudflare Access (login con Google, gratis)
        ▼
 DigitalOcean 2 vCPU / 4 GB — US$24/mes
   Docker: API FastAPI · Postgres · tarea diaria · FFmpeg/Remotion
        │                                   │
        ▼                                   ▼
 Cloudflare R2 (videos, ~US$1–2/mes)   backups diarios de Postgres → R2
```

**≈ US$26/mes** para todo el equipo, más Postiz (aparte, ver `brand-integrations`). Todo en
una cuenta **de Coevo** (Cloudflare y DigitalOcean), nunca de Monks.

Por qué no lo "más administrado": Railway/Render + Supabase cuestan 2–3× por lo mismo. El costo
del servidor propio es mantenerlo: se compensa con Docker (un comando para levantar todo) y
backups automáticos. Si mañana molesta, la misma imagen Docker se muda a Railway o Render sin
reescribir nada.

## Fuentes

digitalocean.com/pricing/droplets · docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/
· railway.com/pricing · render.com/pricing · docs.fly.io/about/pricing · cloud.google.com/run/pricing
· supabase.com/pricing · neon.com/pricing · developers.cloudflare.com/r2/pricing/
· developers.cloudflare.com/pages/platform/limits/ · vercel.com/docs/limits/fair-use-guidelines · clerk.com/pricing
