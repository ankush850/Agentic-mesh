import { useLocation } from "react-router-dom";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "../ui/Button";

const TITLES: Array<{ match: RegExp; title: string; subtitle: string }> = [
  { match: /^\/$/, title: "Dashboard", subtitle: "Fleet health at a glance" },
  { match: /^\/runs\/new/, title: "New Run", subtitle: "From ticket to executed tests" },
  { match: /^\/runs\/[^/]+\/live/, title: "Live Run", subtitle: "Streaming agent activity" },
  { match: /^\/runs\/[^/]+$/, title: "Run Report", subtitle: "Results, repairs and evidence" },
  { match: /^\/runs/, title: "Run History", subtitle: "Every run the agent has executed" },
  { match: /^\/repairs/, title: "Repairs Center", subtitle: "Review and approve self-healing" },
  { match: /^\/demo/, title: "Demo Controls", subtitle: "Break the app, watch it heal" },
  { match: /^\/settings/, title: "Settings", subtitle: "Models, targets and preferences" },
];

export function TopBar({
  onOpenNav,
  collapsed,
  onToggleCollapse,
}: {
  onOpenNav: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const { pathname } = useLocation();
  const heading = TITLES.find((entry) => entry.match.test(pathname)) ?? TITLES[0];

  return (
    <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center gap-3 border-b border-line bg-bg/85 px-4 py-2 backdrop-blur lg:px-8">
      {/* Below lg the sidebar is an off-canvas drawer, so this opens it. */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onOpenNav}
        aria-label="Open navigation"
        className="lg:hidden"
      >
        <Menu className="h-4 w-4" aria-hidden />
      </Button>

      {/* At lg and above the same affordance folds the sidebar down to its rail. */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleCollapse}
        aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        aria-pressed={collapsed}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="hidden lg:inline-flex"
      >
        {collapsed ? (
          <PanelLeftOpen className="h-4 w-4" aria-hidden />
        ) : (
          <PanelLeftClose className="h-4 w-4" aria-hidden />
        )}
      </Button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-semibold tracking-tight text-fg">{heading.title}</h1>
        <p className="truncate text-[11px] text-muted">{heading.subtitle}</p>
      </div>
    </header>
  );
}
