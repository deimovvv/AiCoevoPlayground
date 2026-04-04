import { useState } from "react";
import { Outlet, useLocation } from "react-router";
import { Sidebar } from "./Sidebar";
import { ChatPanel } from "../ChatPanel";
import { MessageSquare, X } from "lucide-react";
import { cn } from "../../lib/utils";

// Routes that need full-bleed layout (no padding/max-width)
const FULL_BLEED_ROUTES: string[] = [];

export function AppLayout() {
    const location = useLocation();
    const isFullBleed = FULL_BLEED_ROUTES.includes(location.pathname);
    const [chatOpen, setChatOpen] = useState(false);

    return (
        <div className="flex h-screen w-full bg-primary-bg overflow-hidden text-text-primary">
            <Sidebar />
            <div className="flex-1 flex overflow-hidden">
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

                {/* Chat drawer */}
                {chatOpen && (
                    <div className="w-[400px] shrink-0 border-l border-edge bg-canvas h-full flex flex-col">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-edge">
                            <div className="flex items-center gap-2">
                                <MessageSquare size={14} className="text-fg-muted" />
                                <span className="text-[13px] font-medium text-fg">AI Chat</span>
                            </div>
                            <button
                                onClick={() => setChatOpen(false)}
                                className="p-1 text-fg-faint hover:text-fg transition-colors cursor-pointer rounded"
                            >
                                <X size={14} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <ChatPanel compact />
                        </div>
                    </div>
                )}
            </div>

            {/* Chat toggle button */}
            {!chatOpen && (
                <button
                    onClick={() => setChatOpen(true)}
                    className={cn(
                        "fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full flex items-center justify-center",
                        "bg-[var(--color-warm)] text-white shadow-lg hover:opacity-90 transition-all cursor-pointer",
                        "hover:scale-105 active:scale-95"
                    )}
                    title="Open AI Chat"
                >
                    <MessageSquare size={20} />
                </button>
            )}
        </div>
    );
}
