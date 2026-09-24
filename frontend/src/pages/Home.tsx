import { useNavigate } from "react-router";
import { useEffect, useRef, useState } from "react";

/**
 * Home — landing pública.
 * ───────────────────────
 * Lenguaje: screen UI sobre negro (ref. flora.ai). Las reglas del sistema:
 *
 *   1. Lo que se muestra es el PRODUCTO, no fotos de campaña. Paneles, atajos
 *      de teclado, estados de job, contadores. Vendemos software.
 *   2. La UI de las secciones está construida en HTML, no son screenshots:
 *      queda nítida en cualquier pantalla y se puede animar.
 *   3. Gris frío. NADA cálido — el burgundy del dashboard no entra acá.
 *   4. El rosa (#ff5f8f) es señal funcional: activo, nuevo, en curso. Nunca
 *      decorativo, nunca de fondo.
 *   5. Todo en movimiento: marquee, grilla que cicla, contadores, blink.
 *
 * Para cambiar las piezas de la grilla: dropeá el archivo en `public/hero/`
 * y editá TILES.
 */

/* ── Tokens locales — la landing NO hereda los del dashboard ─────────────── */
const INK = "#0b0b0c";       // fondo
const PANEL = "#141416";     // superficie
const LINE = "#232327";      // bordes
const DIM = "#6e6e78";       // texto secundario
const SIGNAL = "#ff5f8f";    // rosa: sólo señal funcional

/**
 * Piezas del archivo.
 *   `r`    — aspect-ratio real de la imagen. En las tiras el alto es fijo, así que
 *            este ratio define el ancho: una 16:9 ocupa casi el doble que una 4:5.
 *   `wide` — en la grilla de Output, ocupa 2 columnas.
 *
 * Antes TODAS se metían en un contenedor 4/5 con object-cover y las horizontales
 * perdían ~70% de la composición (la foto reclinada quedaba irreconocible).
 */
type Tile = { src: string; r: string; wide?: boolean };

const TILES: Tile[] = [
  // Registro FLASH — flash directo, film 35mm, color saturado, actitud 90s/Y2K.
  // Reemplaza al set anterior (fondo hueso, luz suave, poses quietas), que leía
  // demasiado quieto y elegante para lo que la herramienta tiene que transmitir.
  { src: "/hero/flash-portrait.webp", r: "4/5" },
  { src: "/hero/flash-black-slip.webp", r: "4/5" },
  { src: "/hero/flash-leather-red.webp", r: "4/5" },
  { src: "/hero/flash-blue-track.webp", r: "4/5" },
  { src: "/hero/flash-silver-coat.webp", r: "4/5" },
  { src: "/hero/flash-red-sky.webp", r: "4/5" },
  // Horizontales — ocupan el doble de ancho
  { src: "/hero/flash-two-wall.webp", r: "16/9", wide: true },
  // Del set editorial anterior: se quedan las que aguantan al lado del flash
  // (producto y composición ancha, donde el registro pesa menos).
  { src: "/hero/product-table.webp", r: "16/9", wide: true },
  { src: "/hero/standing-pair.webp", r: "16/9", wide: true },
  { src: "/hero/boots-pair.webp", r: "4/5" },
];


/** Orden intercalado para las tiras: evita que las 4 anchas queden juntas. */
const STRIP: Tile[] = [
  TILES[0], TILES[6], TILES[1], TILES[2], TILES[7], TILES[3],
  TILES[4], TILES[8], TILES[5], TILES[9],
];

const STAGES = [
  {
    n: "01", title: "Brief", kicker: "El contexto de marca, una sola vez",
    body: "Assets, tono, reglas visuales y voces cargados por marca. Cada tool los hereda sin volver a configurarlos.",
  },
  {
    n: "02", title: "Generate", kicker: "Diecisiete pipelines, no un prompt",
    body: "Cada tool sabe qué pedir: tomas, poses, encuadres y continuidad de identidad entre cuadros.",
  },
  {
    n: "03", title: "Scale", kicker: "De un look a un catálogo",
    body: "Lote de prendas por lote de poses. Foto, video y voz en la misma corrida.",
  },
];

const INDEX = [
  { n: "01", name: "Ecommerce Pack", desc: "Prenda sobre modelo, vistas y fondos", tag: "Popular" },
  { n: "02", name: "Fashion Reel", desc: "Reel multi-toma desde un look", tag: "Nuevo" },
  { n: "03", name: "UGC Creator", desc: "Avatar a cámara, voz clonada" },
  { n: "04", name: "Video Ad Creator", desc: "Storyboard de diez cuadros a video" },
  { n: "05", name: "Fashion Editorial", desc: "Variantes con receta de look" },
  { n: "06", name: "Avatar Sheet", desc: "Identidad consistente entre tomas" },
  { n: "07", name: "Product Sheet", desc: "Vistas desde una a cuatro fotos" },
  { n: "08", name: "Carousel Creator", desc: "Consistencia entre slides" },
];

/** Contador que sube cuando la sección entra en viewport. */
function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // prefers-reduced-motion: mostrar el número final sin animar.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setN(to); return; }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / 900);
        setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [to]);
  return <span ref={ref} className="tabular-nums">{n.toLocaleString("es-AR")}{suffix}</span>;
}

export function Home() {
  const navigate = useNavigate();

  return (
    <div style={{ background: INK }} className="min-h-screen text-white overflow-x-hidden">
      <style>{`
        @keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes blink { 0%,100% { opacity: 1 } 50% { opacity: .25 } }
        .mq { animation: marquee 48s linear infinite; }
        .mq-rev { animation: marquee 62s linear infinite reverse; }
        .blink { animation: blink 1.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .mq, .mq-rev, .blink { animation: none !important; }
        }
      `}</style>

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav
        className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-5 md:px-7 h-12 text-[12px] backdrop-blur-xl"
        style={{ background: "rgba(11,11,12,.82)", borderBottom: `1px solid ${LINE}` }}
      >
        <div className="flex items-center gap-2.5">
          <img src="/ISO-COEVO-BLANCO.png" alt="" className="h-[15px] w-auto" />
          <span className="font-medium tracking-tight">Coevo Studio</span>
          <span className="hidden sm:inline-flex items-center gap-1.5 ml-2 px-1.5 py-0.5 rounded text-[10px] tracking-[0.08em] uppercase"
                style={{ border: `1px solid ${LINE}`, color: DIM }}>
            <i className="blink w-1 h-1 rounded-full inline-block" style={{ background: SIGNAL }} />
            v2
          </span>
        </div>
        <div className="hidden md:flex items-center gap-7" style={{ color: DIM }}>
          <a href="#how" className="hover:text-white transition-colors">Cómo funciona</a>
          <a href="#index" className="hover:text-white transition-colors">Tools</a>
          <a href="#work" className="hover:text-white transition-colors">Output</a>
        </div>
        <button
          onClick={() => navigate("/dashboard")}
          className="px-3 h-7 rounded-md text-[12px] font-medium text-black bg-white hover:opacity-85 transition-opacity cursor-pointer"
        >
          Entrar
        </button>
      </nav>

      {/* ── Hero — tipografía chica + dos marquees en direcciones opuestas ─── */}
      <header className="pt-24 md:pt-28 pb-16 md:pb-20">
        <div className="px-5 md:px-7">
          <div className="flex items-center gap-2 text-[11px] tracking-[0.1em] uppercase" style={{ color: DIM }}>
            <i className="blink w-1.5 h-1.5 rounded-full inline-block" style={{ background: SIGNAL }} />
            Fashion content infrastructure
          </div>
          <h1 className="mt-5 text-[30px] md:text-[46px] leading-[1.05] tracking-[-0.035em] font-medium max-w-[18ch]">
            Infraestructura de contenido<br className="hidden md:block" /> para marcas de moda.
          </h1>
          <p className="mt-5 text-[13px] md:text-[14px] leading-relaxed max-w-[48ch]" style={{ color: DIM }}>
            Diecisiete pipelines de producción con el contexto de cada marca adentro.
            Catálogo, campaña y video —desde las fotos que la marca ya tiene.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="px-4 h-9 rounded-md text-[13px] font-medium text-black bg-white hover:opacity-85 transition-opacity cursor-pointer"
            >
              Empezar
            </button>
            <button
              onClick={() => navigate("/dashboard/generate")}
              className="px-4 h-9 rounded-md text-[13px] hover:border-white/40 transition-colors cursor-pointer"
              style={{ border: `1px solid ${LINE}`, color: DIM }}
            >
              Ver las tools
            </button>
          </div>
        </div>

        {/* Dos tiras infinitas cruzadas. El duplicado de TILES es lo que hace el
            loop continuo: la animación corre hasta -50% y reinicia sin salto. */}
        <div className="mt-14 md:mt-16 space-y-2 overflow-hidden">
          {([["mq", STRIP], ["mq-rev", [...STRIP].reverse()]] as const).map(([cls, list], row) => (
            <div key={row} className="flex w-max gap-2">
              <div className={`${cls} flex gap-2 shrink-0`}>
                {[...list, ...list].map((t, i) => (
                  <div
                    key={t.src + i}
                    /* Alto fijo por fila; el ancho lo define el aspect-ratio de cada
                       pieza, así una 16:9 ocupa naturalmente más que una 4:5. */
                    className="relative h-[160px] md:h-[215px] shrink-0 overflow-hidden rounded"
                    style={{ aspectRatio: t.r, background: PANEL, border: `1px solid ${LINE}` }}
                  >
                    <img src={t.src} alt="" loading="lazy" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Barra de métricas — lee a panel de sistema, no a landing. */}
        <div
          className="mt-10 md:mt-12 mx-5 md:mx-7 grid grid-cols-2 md:grid-cols-4 text-[12px]"
          style={{ border: `1px solid ${LINE}`, borderRadius: 8, background: PANEL }}
        >
          {[
            ["Tools activas", <Counter key="a" to={17} />],
            ["Piezas generadas", <Counter key="b" to={4281} />],
            ["Marcas", <Counter key="c" to={13} />],
            ["Modelos conectados", <Counter key="d" to={9} />],
          ].map(([label, val], i) => (
            <div key={i} className="px-4 py-3.5" style={{ borderLeft: i ? `1px solid ${LINE}` : undefined }}>
              <div className="text-[18px] md:text-[21px] font-medium tracking-tight">{val}</div>
              <div className="mt-0.5 text-[11px]" style={{ color: DIM }}>{label}</div>
            </div>
          ))}
        </div>
      </header>

      {/* ── Cómo funciona — 01/02/03 con UI real construida en HTML ────────── */}
      <section id="how" className="px-5 md:px-7 py-20 md:py-28 scroll-mt-12">
        <div className="grid md:grid-cols-3 gap-2">
          {STAGES.map((s, i) => (
            <article
              key={s.n}
              className="relative overflow-hidden rounded-lg p-5 md:p-6 flex flex-col"
              style={{ background: PANEL, border: `1px solid ${LINE}`, minHeight: 420 }}
            >
              <div className="flex items-baseline gap-2.5">
                <span className="text-[26px] md:text-[30px] font-medium tracking-tight" style={{ color: "#3a3a42" }}>{s.n}</span>
                <span className="text-[26px] md:text-[30px] font-medium tracking-tight">{s.title}</span>
              </div>

              {/* Mock de UI por etapa — HTML, no screenshot */}
              <div className="mt-5 flex-1 rounded-md overflow-hidden" style={{ background: INK, border: `1px solid ${LINE}` }}>
                {i === 0 && (
                  <div className="p-3 text-[11px]">
                    <div className="pb-2 mb-2 text-[10px] tracking-[0.08em] uppercase" style={{ color: DIM, borderBottom: `1px solid ${LINE}` }}>Brand kit</div>
                    {[["Avatars", "6"], ["Productos", "24"], ["Prendas", "18"], ["Voces", "3"], ["Look & Feel", "5"]].map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between py-[7px]">
                        <span>{k}</span><span style={{ color: DIM }}>{v}</span>
                      </div>
                    ))}
                    <div className="mt-2 pt-2 flex items-center gap-1.5 text-[10px]" style={{ borderTop: `1px solid ${LINE}`, color: SIGNAL }}>
                      <i className="blink w-1 h-1 rounded-full inline-block" style={{ background: SIGNAL }} /> Heredado por 17 tools
                    </div>
                  </div>
                )}
                {i === 1 && (
                  <div className="p-3 text-[11px]">
                    <div className="pb-2 mb-2.5 text-[10px] tracking-[0.08em] uppercase" style={{ color: DIM, borderBottom: `1px solid ${LINE}` }}>Shot list</div>
                    {[["Plano general", "✓"], ["Medio", "✓"], ["Detalle", "···"], ["Espalda", ""]].map(([k, st], j) => (
                      <div key={k} className="flex items-center justify-between py-[7px] px-1.5 rounded"
                           style={{ background: j === 2 ? "rgba(255,95,143,.07)" : undefined }}>
                        <span style={{ color: j === 3 ? DIM : undefined }}>{k}</span>
                        <span style={{ color: j === 2 ? SIGNAL : DIM }}>{st}</span>
                      </div>
                    ))}
                    <div className="mt-3 grid grid-cols-3 gap-1">
                      {TILES.slice(0, 3).map((t) => (
                        <img key={t.src} src={t.src} alt="" loading="lazy" className="w-full aspect-[4/5] object-cover rounded-sm" />
                      ))}
                    </div>
                  </div>
                )}
                {i === 2 && (
                  <div className="p-3 text-[11px]">
                    <div className="flex items-center justify-between pb-2 mb-2.5 text-[10px] tracking-[0.08em] uppercase" style={{ color: DIM, borderBottom: `1px solid ${LINE}` }}>
                      <span>Batch</span><span style={{ color: SIGNAL }}>en curso</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {TILES.filter((t) => !t.wide).slice(0, 8).map((t, j) => (
                        <div key={t.src} className="relative rounded-sm overflow-hidden" style={{ border: j === 5 ? `1px solid ${SIGNAL}` : `1px solid ${LINE}` }}>
                          <img src={t.src} alt="" loading="lazy" className="w-full aspect-[4/5] object-cover" />
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 h-[3px] rounded-full overflow-hidden" style={{ background: LINE }}>
                      <div className="h-full rounded-full" style={{ width: "62%", background: SIGNAL }} />
                    </div>
                    <div className="mt-1.5 flex justify-between text-[10px]" style={{ color: DIM }}>
                      <span>62 / 100</span><span>~4 min</span>
                    </div>
                  </div>
                )}
              </div>

              <h3 className="mt-5 text-[14px] font-medium">{s.kicker}</h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: DIM }}>{s.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Index de tools — tabla, con señal en las nuevas ─────────────────── */}
      <section id="index" className="px-5 md:px-7 pb-20 md:pb-28 scroll-mt-12">
        <div className="flex items-baseline justify-between pb-3 text-[11px] tracking-[0.08em] uppercase"
             style={{ color: DIM, borderBottom: `1px solid ${LINE}` }}>
          <span>Tools</span><span>{INDEX.length} de 17</span>
        </div>
        <ul>
          {INDEX.map((t) => (
            <li key={t.n}>
              <button
                onClick={() => navigate("/dashboard/generate")}
                className="w-full text-left grid grid-cols-[2rem_1fr_auto] md:grid-cols-[3rem_13rem_1fr_auto] items-center gap-x-3 py-3 hover:bg-white/[0.035] transition-colors cursor-pointer group"
                style={{ borderBottom: `1px solid ${LINE}` }}
              >
                <span className="text-[11px] tabular-nums" style={{ color: "#3a3a42" }}>{t.n}</span>
                <span className="text-[13px] md:text-[13.5px]">{t.name}</span>
                <span className="hidden md:block text-[12px]" style={{ color: DIM }}>{t.desc}</span>
                <span className="text-[10px] tracking-[0.06em] uppercase px-1.5 py-0.5 rounded"
                      style={t.tag ? { color: SIGNAL, border: `1px solid ${SIGNAL}33` } : { color: "transparent" }}>
                  {t.tag || "—"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Output — grilla densa a sangre ─────────────────────────────────── */}
      <section id="work" className="scroll-mt-12">
        <div className="px-5 md:px-7 pb-3 flex items-baseline justify-between text-[11px] tracking-[0.08em] uppercase" style={{ color: DIM }}>
          <span>Output</span><span>Piezas generadas con la plataforma</span>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-px" style={{ background: LINE }}>
          {TILES.map((t) => (
            <div
              key={t.src}
              className={`relative overflow-hidden group ${t.wide ? "col-span-2" : ""}`}
              style={{ background: INK }}
            >
              <img src={t.src} alt="" loading="lazy"
                   style={{ aspectRatio: t.r }}
                   className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="px-5 md:px-7 pt-14 pb-8 mt-20" style={{ borderTop: `1px solid ${LINE}` }}>
        <div className="grid md:grid-cols-[1fr_auto] gap-8 items-end">
          <div className="max-w-[34rem]">
            <p className="text-[13px] leading-relaxed" style={{ color: DIM }}>
              Coevo Studio es la plataforma que usamos para producir el contenido de
              nuestras marcas. Construida dentro de una agencia de moda, para el
              trabajo que la agencia hace todos los días.
            </p>
            <button
              onClick={() => navigate("/dashboard")}
              className="mt-6 text-[13px] underline underline-offset-4 hover:opacity-70 transition-opacity cursor-pointer"
              style={{ textDecorationColor: DIM }}
            >
              Abrir la plataforma
            </button>
          </div>
          <div className="flex gap-7 text-[11px] tracking-[0.08em] uppercase" style={{ color: "#3a3a42" }}>
            <span>Buenos Aires</span><span>© 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
