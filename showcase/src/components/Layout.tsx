import { NavLink, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { useShowcase } from "@/lib/DataContext";
import type { ReactNode } from "react";

const NAV_ITEMS = [
  { to: "/", label: "Home" },
  { to: "/articles", label: "Codex" },
  { to: "/stories", label: "Stories" },
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
        `relative block px-3 py-2 sm:py-1.5 text-[12px] font-display tracking-[0.2em] uppercase transition-colors duration-300 after:mt-1 after:block after:h-px after:origin-left after:transition-transform after:duration-300 ${
          isActive
            ? "text-[var(--color-aurum-pale)] after:scale-x-100 after:bg-[var(--color-aurum)]"
            : "text-text-muted hover:text-text-primary after:scale-x-0 after:bg-border-muted/70 hover:after:scale-x-100"
        }`
      }
    >
      {label}
    </NavLink>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { data } = useShowcase();
  const location = useLocation();
  const worldName = data?.meta.showcase?.navLogoText ?? data?.meta.worldName ?? "World Lore";
  const footerText = data?.meta.showcase?.footerText ?? "Built with Ambon Arcanum";
  const [menuOpen, setMenuOpen] = useState(false);
  const [pageKey, setPageKey] = useState(location.pathname);
  const [scrolled, setScrolled] = useState(false);

  // Track scroll position for header background
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll(); // check initial position
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll to top and trigger page transition on route change
  useEffect(() => {
    window.scrollTo({ top: 0 });
    setPageKey(location.pathname);
    setMenuOpen(false);
  }, [location.pathname]);

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

      <header className={`sticky top-0 z-50 transition-[background-color,border-color,box-shadow] duration-300 ${
        scrolled
          ? "bg-bg-abyss/85 backdrop-blur-md border-b border-border-muted/50 shadow-[0_4px_24px_rgba(0,8,14,0.3)]"
          : "bg-transparent border-b border-transparent"
      }`}>
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
          <NavLink
            to="/"
            className="min-w-0 max-w-[min(22rem,calc(100vw-7rem))] rounded-md transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-accent/40"
            title={worldName}
          >
            <span className="block text-[9px] uppercase tracking-[0.34em] text-text-muted/80">
              Atlas Of
            </span>
            <span className="mt-1 block text-balance break-words font-display text-[1.05rem] tracking-[0.28em] uppercase text-[var(--color-aurum-pale)] hover:text-accent-emphasis">
              {worldName}
            </span>
          </NavLink>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-0.5" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </nav>

          {/* Mobile menu button */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="sm:hidden min-h-11 min-w-11 rounded-md p-2 text-text-secondary hover:text-text-primary transition-colors focus-visible:ring-2 focus-visible:ring-accent/40"
            aria-expanded={menuOpen}
            aria-label="Toggle navigation menu"
            aria-controls="mobile-navigation"
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
          <nav
            id="mobile-navigation"
            className="sm:hidden border-t border-border-muted/50 bg-bg-abyss/95 backdrop-blur-md px-5 py-3 animate-[fadeIn_150ms_ease-out]"
            aria-label="Main navigation"
          >
            {NAV_ITEMS.map((item) => (
              <NavItem key={item.to} {...item} onClick={() => setMenuOpen(false)} />
            ))}
          </nav>
        )}
      </header>

      {/* Atmospheric glow */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-[-12rem] left-[-8rem] w-[36rem] h-[36rem] rounded-full bg-glow-aurum-radial blur-3xl" />
        <div className="absolute bottom-[-16rem] right-[-10rem] w-[40rem] h-[40rem] rounded-full bg-glow-stellar-radial blur-3xl" />
      </div>

      <main
        id="main-content"
        key={pageKey}
        className="relative z-10 flex-1 max-w-5xl mx-auto px-5 sm:px-8 py-10 sm:py-14 w-full animate-[fadeIn_200ms_ease-out_both]"
      >
        {children}
      </main>

      <footer className="border-t border-border-muted/30 py-8 text-center">
        <p className="mx-auto max-w-3xl break-words px-5 text-text-muted text-xs tracking-[0.1em]">
          {footerText}
        </p>
      </footer>
    </div>
  );
}
