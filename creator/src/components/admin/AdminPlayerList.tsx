import { useState } from "react";
import { useAdminStore } from "@/stores/adminStore";
import type { PlayerSummary } from "@/types/admin";
import { AdminPlayerDetail } from "./AdminPlayerDetail";

function HpBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  if (maxHp <= 0) return null;
  const pct = Math.round((hp / maxHp) * 100);
  const color =
    pct > 60 ? "bg-status-success" : pct > 25 ? "bg-status-warning" : "bg-status-error";
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuenow={hp}
        aria-valuemin={0}
        aria-valuemax={maxHp}
        aria-label="Health"
      >
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-2xs text-text-muted">
        {hp}/{maxHp}
      </span>
    </div>
  );
}

function PlayerRow({
  player,
  onSelect,
}: {
  player: PlayerSummary;
  onSelect: (name: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(player.name)}
      className="flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-left transition-colors duration-200 hover:border-accent/20 hover:bg-accent/[0.04] hover:shadow-[inset_3px_0_0_var(--color-accent)] focus-visible:ring-2 focus-visible:ring-border-active focus-visible:outline-none"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-sm text-text-primary">{player.name}</span>
          {player.isStaff && (
            <span className="rounded-full bg-violet/15 px-2 py-0.5 text-2xs text-violet">
              Staff
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
          <span className="text-text-muted">Lv {player.level}</span>
          <span className="text-stellar-blue">{player.playerClass}</span>
          <span className="text-text-muted">{player.race}</span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-xs text-text-secondary">{player.room}</div>
        <HpBar hp={player.hp} maxHp={player.maxHp} />
      </div>
    </button>
  );
}

export function AdminPlayerList() {
  const players = useAdminStore((s) => s.players);
  const selectedPlayer = useAdminStore((s) => s.selectedPlayer);
  const fetchPlayerDetail = useAdminStore((s) => s.fetchPlayerDetail);
  const clearSelectedPlayer = useAdminStore((s) => s.clearSelectedPlayer);
  const searchPlayer = useAdminStore((s) => s.searchPlayer);
  const playerSearchResults = useAdminStore((s) => s.playerSearchResults);
  const clearPlayerSearch = useAdminStore((s) => s.clearPlayerSearch);
  const lastError = useAdminStore((s) => s.lastError);
  const [searchQuery, setSearchQuery] = useState("");

  if (selectedPlayer) {
    return <AdminPlayerDetail player={selectedPlayer} onBack={clearSelectedPlayer} />;
  }

  // If viewing a search result, show that player's detail
  if (playerSearchResults) {
    return (
      <AdminPlayerDetail
        player={playerSearchResults}
        onBack={clearPlayerSearch}
      />
    );
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      searchPlayer(searchQuery.trim());
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-lg text-text-primary">Inhabitants</h3>
          <p className="mt-0.5 text-xs text-text-muted">Players currently in the world. Click a name to inspect.</p>
        </div>
        <span className="shrink-0 text-[11px] uppercase tracking-ui text-text-muted">
          {players.length} present
        </span>
      </div>

      {/* Player search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name (online or offline)..."
          className="h-9 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/15 px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-border-active focus:outline-none focus-visible:ring-2 focus-visible:ring-border-active"
        />
        <button
          type="submit"
          disabled={!searchQuery.trim()}
          className="h-9 rounded-xl border border-white/10 bg-black/10 px-4 text-xs font-medium text-text-primary transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-border-active focus-visible:outline-none"
        >
          Search
        </button>
      </form>
      {lastError && searchQuery && (
        <p className="text-xs text-status-error">{lastError}</p>
      )}

      {players.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-white/12 bg-white/4 px-6 py-12 text-center">
          <p className="font-display text-base text-text-secondary">The world is still</p>
          <p className="mt-1 text-sm text-text-muted">No souls walk the land at this moment. Use search to find offline players.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {players.map((p) => (
            <PlayerRow key={p.name} player={p} onSelect={fetchPlayerDetail} />
          ))}
        </div>
      )}
    </div>
  );
}
