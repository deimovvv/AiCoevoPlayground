import { Outlet, useLocation } from "react-router";
import { TopNav } from "./TopNav";

// Rutas full-bleed: ocupan toda la altura del viewport sin padding ni max-width.
// Necesario para páginas con layout split sidebar+main (Lab, Ecommerce Batch, etc.)
// que usan h-full internamente. Si una página con sidebar fijo NO está acá, el wrapper
// con padding rompe el h-full → el sidebar se comprime y los footers sticky desaparecen
// fuera del viewport. Es lo que pasó cuando movimos Manual Lab a /dashboard/lab.
const FULL_BLEED_ROUTES: string[] = [
    "/dashboard/chat",
    "/dashboard/voice-lab",
    "/dashboard/ecommerce-batch",
    "/dashboard/lab",
    "/dashboard/lab-v2",
];

/** Prefijos full-bleed — para rutas dinámicas donde no podemos pre-listar cada subruta.
 *  Ej. `/dashboard/generate/:toolId` cubre 15+ tools con un solo entry. */
const FULL_BLEED_PREFIXES: string[] = [
    "/dashboard/generate/",  // ToolRunPage layout split por tool
];

export function AppLayout() {
    const location = useLocation();
    const isFullBleed = FULL_BLEED_ROUTES.includes(location.pathname)
        || FULL_BLEED_PREFIXES.some((p) => location.pathname.startsWith(p));

    return (
        <div className="flex flex-col h-screen w-full bg-primary-bg overflow-hidden text-text-primary">
            <TopNav />
            <div className="flex-1 flex overflow-hidden">
                {isFullBleed ? (
                    <main className="flex-1 overflow-hidden h-full">
                        <Outlet />
                    </main>
                ) : (
                    <main className="flex-1 overflow-y-auto w-full">
                        <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8">
                            <Outlet />
                        </div>
                    </main>
                )}
            </div>
        </div>
    );
}
