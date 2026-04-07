import { useEffect, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { MapViewer } from "@/components/MapViewer";
import {
  ShowcaseEmptyState,
  showcaseButtonClassNames,
  showcaseSurfaceClassNames,
} from "@/components/ShowcasePrimitives";
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
        <div className={`${showcaseSurfaceClassNames.section} px-6 py-6`}>
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
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.85fr)]">
        <div className={`${showcaseSurfaceClassNames.hero} px-6 py-7 sm:px-8`}>
          <h1 className="mt-3 max-w-3xl font-display text-3xl leading-tight text-[var(--color-aurum-pale)] sm:text-4xl">
            Cross the dominions by plate, route, and pinned testimony.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-text-secondary sm:text-[0.95rem]">
            Each published chart carries its own field of landmarks, letting readers move from a coast, fortress, or
            shrine directly into the codex entries tied to that ground.
          </p>
          <p className="mt-6 text-sm leading-7 text-text-muted">
            {new Intl.NumberFormat().format(maps.length)} published charts with {new Intl.NumberFormat().format(totalPins)} pinned sites.{" "}
            {activeMap ? `${activeMap.title} is open.` : ""}
          </p>
        </div>

        <div className="flex flex-col justify-end gap-4 px-1 pb-1 xl:pl-6">
          <p className="font-display text-2xl text-accent-emphasis">
            {new Intl.NumberFormat().format(activePins)} markers on this plate
          </p>
          <p className="text-sm leading-7 text-text-secondary">
            {new Intl.NumberFormat().format(linkedPins)} of them open directly into article records, while the rest
            preserve place memory as unlinked notes on the terrain.
          </p>
          <p className="text-sm leading-7 text-text-muted">
            Use the atlas index below to jump between plates. Wide charts keep their original canvas dimensions so the
            topography stays readable before you descend into individual pins.
          </p>
        </div>
      </section>

      {activeMap ? (
        <section className={`${showcaseSurfaceClassNames.section} overflow-hidden`}>
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border-muted/25 px-5 py-5 sm:px-6">
            <div>
              <h2 className="mt-2 font-display text-3xl text-[var(--color-aurum-pale)]">{activeMap.title}</h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-text-muted sm:text-right">
              {new Intl.NumberFormat().format(activePins)} markers, {new Intl.NumberFormat().format(linkedPins)} linked pins, and a canvas of {new Intl.NumberFormat().format(activeMap.width)} x{" "}
              {new Intl.NumberFormat().format(activeMap.height)}.
            </p>
          </div>
          <MapViewer map={activeMap} />
        </section>
      ) : null}

      <section className={`${showcaseSurfaceClassNames.section} px-5 py-5 sm:px-6`}>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border-muted/25 pb-4">
          <div>
            <h2 className="mt-2 font-display text-2xl text-accent-emphasis">Available plates</h2>
          </div>
          <p className="text-sm text-text-muted">
            {new Intl.NumberFormat().format(maps.length)} published chart{maps.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {maps.map((map, index) => {
            const isActive = activeMap?.id === map.id;
            return (
              <button
                key={map.id}
                type="button"
                onClick={() => navigate(`/maps/${map.id}`)}
                aria-pressed={isActive}
                className={`rounded-[1.35rem] border px-4 py-4 text-left transition-colors duration-300 ${
                  isActive
                    ? "border-[var(--color-aurum)]/35 bg-[var(--color-aurum)]/10"
                    : "border-border-muted/30 bg-bg-secondary/45 hover:bg-bg-hover/25"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[0.65rem] uppercase tracking-[0.24em] text-text-muted">
                      Plate {index + 1}
                    </p>
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
      </section>
    </div>
  );
}
