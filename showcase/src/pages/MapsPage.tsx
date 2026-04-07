import { useEffect, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { MapViewer } from "@/components/MapViewer";
import { ShowcaseEmptyState, showcaseButtonClassNames } from "@/components/ShowcasePrimitives";
import { useShowcase } from "@/lib/DataContext";

export function MapsPage() {
  const { id } = useParams<{ id: string }>();
  const { data } = useShowcase();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = `Maps - ${data?.meta.worldName ?? "World Lore"}`;
  }, [data?.meta.worldName]);

  const maps = data?.maps ?? [];
  const activeMap = useMemo(() => {
    if (maps.length === 0) {
      return undefined;
    }
    return id ? maps.find((map) => map.id === id) : maps[0];
  }, [id, maps]);

  if (!data) {
    return null;
  }

  if (maps.length === 0) {
    return (
      <ShowcaseEmptyState
        className="py-4"
        title="Uncharted lands"
        description="No cartographer has yet drawn these dominions for public study."
        actions={
          <Link to="/articles" className={showcaseButtonClassNames.secondary}>
            Explore the codex
          </Link>
        }
      />
    );
  }

  if (id && !activeMap) {
    return (
      <div className="space-y-6">
        <div className="rounded-[1.6rem] border border-border-muted/35 bg-[linear-gradient(160deg,rgba(18,18,28,0.97),rgba(11,12,20,0.94))] px-6 py-6 shadow-[var(--shadow-deep)]">
          <p className="text-[0.68rem] uppercase tracking-[0.36em] text-[var(--color-aurum)]/80">Atlas index</p>
          <h1 className="mt-3 font-display text-3xl text-[var(--color-aurum-pale)]">Map not found</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-text-secondary">
            The requested chart is not present in the public atlas. Return to the first available plate or continue by
            way of the codex.
          </p>
        </div>
        <ShowcaseEmptyState
          title="No matching chart"
          description="This route points to a map id that is not available in the current export."
          actions={
            <>
              <Link to="/maps" className={showcaseButtonClassNames.primary}>
                Open the atlas
              </Link>
              <Link to="/articles" className={showcaseButtonClassNames.secondary}>
                Browse the codex
              </Link>
            </>
          }
        />
      </div>
    );
  }

  const totalPins = maps.reduce((sum, map) => sum + map.pins.length, 0);
  const activePins = activeMap?.pins.length ?? 0;
  const linkedPins = activeMap?.pins.filter((pin) => Boolean(pin.articleId)).length ?? 0;

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.85fr)]">
        <div className="rounded-[1.75rem] border border-[var(--color-aurum)]/22 bg-[radial-gradient(circle_at_top_left,rgba(214,177,90,0.14),transparent_42%),linear-gradient(155deg,rgba(17,18,27,0.98),rgba(9,10,17,0.94))] px-6 py-7 shadow-[var(--shadow-deep)] sm:px-8">
          <p className="text-[0.68rem] uppercase tracking-[0.38em] text-[var(--color-aurum)]/80">Atlas chamber</p>
          <h1 className="mt-3 max-w-3xl font-display text-3xl leading-tight text-[var(--color-aurum-pale)] sm:text-4xl">
            Traverse the world by chart, plate, and pinned memory.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-text-secondary sm:text-[0.95rem]">
            Each map now sits inside its own chamber, with the index and field notes kept beside the image instead of
            stacked above it like generic filters.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          <div className="rounded-[1.5rem] border border-[var(--color-aurum)]/18 bg-bg-secondary/70 px-5 py-5">
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-text-muted">Charts</p>
            <p className="mt-3 font-display text-3xl text-[var(--color-aurum-pale)]">
              {new Intl.NumberFormat().format(maps.length)}
            </p>
            <p className="mt-2 text-sm text-text-secondary">Published atlas plates available for exploration.</p>
          </div>
          <div className="rounded-[1.5rem] border border-border-muted/40 bg-bg-secondary/55 px-5 py-5">
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-text-muted">Pinned sites</p>
            <p className="mt-3 font-display text-3xl text-accent-emphasis">{new Intl.NumberFormat().format(totalPins)}</p>
            <p className="mt-2 text-sm text-text-secondary">Known markers across the full public atlas.</p>
          </div>
          <div className="rounded-[1.5rem] border border-border-muted/40 bg-bg-secondary/55 px-5 py-5">
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-text-muted">Current plate</p>
            <p className="mt-3 font-display text-2xl text-accent-emphasis">{activeMap?.title}</p>
            <p className="mt-2 text-sm text-text-secondary">Open plates from the index to compare regions and routes.</p>
          </div>
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className="xl:sticky xl:top-24 xl:self-start">
          <div className="rounded-[1.5rem] border border-border-muted/40 bg-[linear-gradient(180deg,rgba(16,17,27,0.94),rgba(9,10,17,0.98))] px-5 py-5 shadow-[var(--shadow-deep)]">
            <p className="text-[0.68rem] uppercase tracking-[0.3em] text-text-muted">Atlas index</p>
            <h2 className="mt-2 font-display text-xl text-accent-emphasis">Available plates</h2>
            <div className="mt-4 space-y-2">
              {maps.map((map, index) => {
                const isActive = activeMap?.id === map.id;
                return (
                  <button
                    key={map.id}
                    type="button"
                    onClick={() => navigate(`/maps/${map.id}`)}
                    aria-pressed={isActive}
                    className={`w-full rounded-[1.2rem] border px-4 py-4 text-left transition-colors duration-300 ${
                      isActive
                        ? "border-[var(--color-aurum)]/35 bg-[var(--color-aurum)]/10"
                        : "border-border-muted/30 bg-bg-secondary/45 hover:bg-bg-hover/25"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[0.65rem] uppercase tracking-[0.24em] text-text-muted">Plate {index + 1}</p>
                        <p className="mt-2 break-words font-display text-lg text-accent-emphasis">{map.title}</p>
                      </div>
                      <span className="rounded-full border border-border-muted/30 px-2 py-1 text-[0.7rem] text-text-muted">
                        {new Intl.NumberFormat().format(map.pins.length)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {activeMap ? (
          <section className="space-y-5">
            <div className="rounded-[1.6rem] border border-border-muted/35 bg-[linear-gradient(180deg,rgba(18,18,28,0.92),rgba(10,10,18,0.98))] px-5 py-5 shadow-[var(--shadow-deep)] sm:px-6">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border-muted/25 pb-4">
                <div>
                  <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[var(--color-aurum)]/80">Current chart</p>
                  <h2 className="mt-2 font-display text-3xl text-[var(--color-aurum-pale)]">{activeMap.title}</h2>
                </div>
                <div className="grid gap-3 text-sm text-text-secondary sm:grid-cols-3 sm:text-right">
                  <div>
                    <p className="text-[0.65rem] uppercase tracking-[0.24em] text-text-muted">Markers</p>
                    <p className="mt-1 font-display text-xl text-accent-emphasis">
                      {new Intl.NumberFormat().format(activePins)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.65rem] uppercase tracking-[0.24em] text-text-muted">Linked</p>
                    <p className="mt-1 font-display text-xl text-accent-emphasis">
                      {new Intl.NumberFormat().format(linkedPins)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.65rem] uppercase tracking-[0.24em] text-text-muted">Canvas</p>
                    <p className="mt-1 font-display text-xl text-accent-emphasis">
                      {new Intl.NumberFormat().format(activeMap.width)} x {new Intl.NumberFormat().format(activeMap.height)}
                    </p>
                  </div>
                </div>
              </div>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-text-secondary">
                Move through the plate directly. Linked pins open codex entries, while unlabeled markers remain available
                for inspection as geographic notes.
              </p>
            </div>

            <div className="overflow-hidden rounded-[1.6rem] border border-border-muted/35 bg-bg-abyss shadow-[var(--shadow-deep)]">
              <MapViewer map={activeMap} />
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
