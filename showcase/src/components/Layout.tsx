import { NavLink } from "react-router-dom";
import { useState } from "react";
import { useShowcase } from "@/lib/DataContext";
import type { ReactNode } from "react";

const NAV_ITEMS = [
  { to: "/", label: "Home" },
  { to: "/articles", label: "Codex" },
  { to: "/maps", label: "Maps" },
  { to: "/timeline", label: "Timeline" },
  { to: "/graph", label: "Connections" },
];

function NavItem({ to, label, onClick }: { to: string; label: string; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      onClick={onClick}
      className={({ isActive }) =>
        `block px-3 py-2 sm:py-1.5 text-sm font-display tracking-[0.18em] uppercase transition-colors ${
          isActive
            ? "text-accent border-b-2 border-accent"
            : "text-text-secondary hover:text-text-primary"
        }`
      }
    >
      {label}
    </NavLink>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { data } = useShowcase();
  const worldName = data?.meta.showcase?.navLogoText ?? data?.meta.worldName ?? "World Lore";
  const footerText = data?.meta.showcase?.footerText ?? "Built with Ambon Arcanum";
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100]
                   focus:bg-bg-primary focus:text-accent focus:px-4 focus:py-2 focus:rounded-md
                   focus:border focus:border-accent/50 focus:shadow-lg"
      >
        Skip to content
      </a>

      <header className="border-b border-border-muted bg-bg-primary/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <NavLink to="/" className="font-display text-accent text-lg tracking-[0.22em]">
            {worldName}
          </NavLink>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </nav>

          {/* Mobile menu button */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="sm:hidden p-2 text-text-secondary hover:text-text-primary transition-colors"
            aria-expanded={menuOpen}
            aria-label="Toggle navigation menu"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              {menuOpen ? (
                <>
                  <line x1="4" y1="4" x2="16" y2="16" />
                  <line x1="16" y1="4" x2="4" y2="16" />
                </>
              ) : (
                <>
                  <line x1="3" y1="5" x2="17" y2="5" />
                  <line x1="3" y1="10" x2="17" y2="10" />
                  <line x1="3" y1="15" x2="17" y2="15" />
                </>
              )}
            </svg>
          </button>
        </div>

        {/* Mobile nav dropdown */}
        {menuOpen && (
          <nav className="sm:hidden border-t border-border-muted bg-bg-primary/95 backdrop-blur-sm px-4 py-2" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => (
              <NavItem key={item.to} {...item} onClick={() => setMenuOpen(false)} />
            ))}
          </nav>
        )}
      </header>

      <main id="main-content" className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-8 w-full">
        {children}
      </main>

      <footer className="border-t border-border-muted py-4 text-center text-text-muted text-xs">
        {footerText}
      </footer>
    </div>
  );
}
