import { Outlet, useLocation } from "react-router";
import { TopNav } from "./TopNav";

const FULL_BLEED_ROUTES: string[] = ["/dashboard/chat", "/dashboard/voice-lab"];

export function AppLayout() {
    const location = useLocation();
    const isFullBleed = FULL_BLEED_ROUTES.includes(location.pathname);

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
