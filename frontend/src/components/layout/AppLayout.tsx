import { Outlet, useLocation } from "react-router";
import { TopBar } from "./TopBar";

// Rutas full-bleed: ocupan toda la altura del viewport sin padding ni max-width.
// Necesario para páginas con layout split sidebar+main (Lab, Ecommerce Batch, etc.)
// que usan h-full internamente. Si una página con sidebar fijo NO está acá, el wrapper
// con padding rompe el h-full → el sidebar se comprime y los footers sticky desaparecen
// fuera del viewport. Es lo que pasó cuando movimos Manual Lab a /dashboard/lab.
const FULL_BLEED_ROUTES: string[] = [
    "/dashboard/campaigns/new",  // panel + selector + canvas, igual que el Lab
    "/dashboard/chat",
    "/dashboard/voice-lab",
    "/dashboard/ecommerce-batch",
    "/dashboard/lab",
    "/dashboard/lab-v2",
    "/dashboard/entregas",       // láminas en fila + comentarios: usa toda la altura
    "/dashboard/entregas/plan",  // el calendario usa la pantalla entera
    "/dashboard/marca",          // studio-v2: compuesta para la pantalla entera
    "/dashboard/produccion",
];

/** Prefijos full-bleed — para rutas dinámicas donde no podemos pre-listar cada subruta.
 *  Ej. `/dashboard/generate/:toolId` cubre 15+ tools con un solo entry. */
const FULL_BLEED_PREFIXES: string[] = [
    "/dashboard/generate/",   // ToolRunPage layout split por tool
    "/dashboard/campaigns/",  // detalle de campaña: panel + canvas (ruta dinámica)
];

export function AppLayout() {
    const location = useLocation();
    const isFullBleed = FULL_BLEED_ROUTES.includes(location.pathname)
        || FULL_BLEED_PREFIXES.some((p) => location.pathname.startsWith(p));

    return (
        // studio-v2: barra arriba + página a todo el ancho (antes: rail vertical a la izquierda,
        // que sigue en disco como Sidebar.tsx). El tour de bienvenida apuntaba al sidebar: se fue con él.
        <div className="flex flex-col h-screen w-full overflow-hidden">
            <TopBar />
            {isFullBleed ? (
                <main className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden">
                    <Outlet />
                </main>
            ) : (
                <main className="flex-1 min-h-0 overflow-y-auto">
                    <div className="max-w-[1400px] mx-auto px-6 py-8 md:px-12 md:py-10 space-y-8">
                        <Outlet />
                    </div>
                </main>
            )}
        </div>
    );
}
