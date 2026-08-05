import { NavLink } from "react-router-dom";
import {
  Activity,
  FlaskConical,
  GitBranch,
  History,
  LayoutDashboard,
  Play,
  Settings,
  ShieldCheck,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import { cn } from "../../lib/cn";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/runs/new", label: "New Run", icon: Play },
  { to: "/sre", label: "SRE Observability", icon: Activity },
  { to: "/repo", label: "Connect Repo", icon: GitBranch },
  { to: "/runs", label: "Run History", icon: History },
  { to: "/repairs", label: "Repairs", icon: Wrench },
  { to: "/optimizer", label: "Tree-sitter & Token Optimizer", icon: Sparkles },
  { to: "/demo", label: "Demo Controls", icon: FlaskConical },
  { to: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  /** Desktop only: fold the sidebar to an icon rail. Ignored by the drawer. */
  collapsed: boolean;
}

export function Sidebar({ open, onClose, collapsed }: SidebarProps) {
  return (
    <>
      {/* Mobile scrim */}
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-30 bg-black/50 backdrop-blur-sm transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        aria-label="Main navigation"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-line bg-surface transition-[transform,width] duration-300 ease-out lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
          collapsed && "lg:w-16",
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center justify-between gap-2 border-b border-line px-4",
            collapsed && "lg:justify-center lg:px-2",
          )}
        >
          <NavLink
            to="/"
            className={cn("flex items-center gap-2.5", collapsed && "lg:gap-0")}
            onClick={onClose}
            title="Agentic-mesh"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <ShieldCheck className="h-4.5 w-4.5" aria-hidden />
            </span>
            <span className={cn("leading-tight", collapsed && "lg:hidden")}>
              <span className="block text-sm font-semibold tracking-tight text-fg">Agentic-mesh</span>
              <span className="block text-[10px] uppercase tracking-widest text-muted">
                Self-healing QA
              </span>
            </span>
          </NavLink>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-fg lg:hidden"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              /* Only the rail hides the text, so only then does the name need
                 a tooltip — otherwise it would duplicate the visible label. */
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  collapsed && "lg:justify-center lg:gap-0 lg:px-2",
                  isActive
                    ? "bg-highlight text-on-highlight"
                    : "text-muted hover:bg-surface-2 hover:text-fg",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn("h-4 w-4 shrink-0", isActive ? "text-accent" : "text-muted")}
                    aria-hidden
                  />
                  <span className={cn("truncate", collapsed && "lg:hidden")}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Version only — the product name and tagline are already in the header above. */}
        <div className={cn("border-t border-line px-4 py-3 text-[11px] text-muted", collapsed && "lg:hidden")}>
          <p>v1.0.0</p>
        </div>
      </aside>
    </>
  );
}
