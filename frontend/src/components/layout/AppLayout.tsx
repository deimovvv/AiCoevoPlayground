import { Outlet } from "react-router";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
    return (
        <div className="flex h-screen w-full bg-primary-bg overflow-hidden text-text-primary">
            <Sidebar />
            <main className="flex-1 overflow-y-auto w-full">
                <div className="max-w-[1280px] mx-auto p-4 md:p-8 space-y-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
