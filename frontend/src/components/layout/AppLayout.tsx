import { Outlet, useLocation } from "react-router";
import { Sidebar } from "./Sidebar";
import { Coachmarks, type CoachStep } from "../Coachmarks";

// Tour de bienvenida first-run — resalta los hitos del sidebar uno por uno.
const DASHBOARD_TOUR: CoachStep[] = [
    { target: '[data-tour="nav-inicio"]', title: "Este es tu Inicio", body: "Tools destacadas y tus campañas recientes, en un vistazo. Tu punto de partida." },
    { target: '[data-tour="nav-campanas"]', title: "Campañas", body: "El corazón del flujo: elegís assets de la marca, generás piezas y las revisás — todo agrupado por campaña." },
    { target: '[data-tour="nav-generar"]', title: "Generar", body: "Todas las tools sueltas: UGC, Ecommerce Pack, Fashion Reel, Ads, Content Analyzer y más." },
    { target: '[data-tour="brand-chip"]', title: "Tu marca activa", body: "Elegí sobre qué marca trabajás. Todas las tools heredan su brand kit (avatares, productos, moodboards…)." },
];

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
        // Layout horizontal: rail vertical 60px + main. Reemplaza al TopNav horizontal
        // (que sigue en disco como TopNav.tsx por si querés revertir). El rail es h-screen
        // independiente del scroll del main para que siempre esté visible.
        <div className="flex h-screen w-full bg-primary-bg overflow-hidden text-text-primary">
            <Sidebar />
            <Coachmarks steps={DASHBOARD_TOUR} storageKey="coevo-tour-dashboard-v1" />
            {isFullBleed ? (
                <main className="flex-1 overflow-hidden h-full">
                    <Outlet />
                </main>
            ) : (
                <main className="flex-1 overflow-y-auto">
                    <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8">
                        <Outlet />
                    </div>
                </main>
            )}
        </div>
    );
}
