import { Outlet, useLocation } from "react-router";
import { Sidebar } from "./Sidebar";

// Routes that need full-bleed layout (no padding/max-width)
const FULL_BLEED_ROUTES = ["/dashboard"];

export function AppLayout() {
    const location = useLocation();
    const isFullBleed = FULL_BLEED_ROUTES.includes(location.pathname);

    return (
        <div className="flex h-screen w-full bg-primary-bg overflow-hidden text-text-primary">
            <Sidebar />
            {isFullBleed ? (
                <main className="flex-1 overflow-hidden h-full">
                    <Outlet />
                </main>
            ) : (
                <main className="flex-1 overflow-y-auto w-full">
                    <div className="max-w-[1280px] mx-auto p-4 md:p-8 space-y-8">
                        <Outlet />
                    </div>
                </main>
            )}
        </div>
    );
}
