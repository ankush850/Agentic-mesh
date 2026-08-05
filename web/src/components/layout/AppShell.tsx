import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { cn } from "../../lib/cn";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { Toaster } from "../ui/Toaster";

const COLLAPSE_KEY = "agentic-mesh:nav-collapsed";

/** App frame: collapsible icon rail on desktop, drawer on tablet/mobile. */
export function AppShell() {
  // Drawer visibility below the lg breakpoint.
  const [navOpen, setNavOpen] = useState(false);
  // Rail width at lg and above; persisted so the choice survives a reload.
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      // Private mode: the preference simply will not persist.
    }
  }, [collapsed]);

  return (
    <div className="min-h-full bg-bg text-fg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} collapsed={collapsed} />
      {/* The content column slides in step with the rail, matching its timing. */}
      <div
        className={cn(
          "transition-[padding] duration-300 ease-out lg:pl-60",
          collapsed && "lg:pl-16",
        )}
      >
        <TopBar
          onOpenNav={() => setNavOpen(true)}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((value) => !value)}
        />
        <main id="main" className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
      <Toaster />
    </div>
  );
}
