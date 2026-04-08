import { memo, useState, useRef, useEffect } from "react";
import { useAdminStore } from "@/stores/adminStore";
import type { PlayerDetail } from "@/types/admin";

const StatRow = memo(function StatRow({ label, value, valueClass }: { label: string; value: string | number; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--chrome-stroke)] py-2 last:border-b-0">
      <span className="text-xs capitalize text-text-muted">{label}</span>
      <span className={`text-xs ${valueClass ?? "text-text-primary"}`}>{value}</span>
    </div>
  );
});

const VitalBar = memo(function VitalBar({
  label,
  current,
  max,
  color,
  ariaLabel,
}: {
  label: string;
  current: number;
  max: number;
  color: string;
  ariaLabel: string;
}) {
  const pct = max > 0 ? Math.round((current / max) * 100) : 0;
  return (
    <div className="flex items-center justify-between border-b border-[var(--chrome-stroke)] py-2 last:border-b-0">
      <span className="text-xs text-text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <div
          className="h-1.5 w-14 overflow-hidden rounded-full bg-[var(--chrome-highlight-strong)]"
          role="progressbar"
          aria-valuenow={current}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={ariaLabel}
        >
          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-text-primary">
          {current} / {max}
        </span>
      </div>
    </div>
  );
});

const Section = memo(function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-[var(--chrome-stroke)] bg-gradient-panel-light p-4 shadow-section">
      <h4 className="mb-2 text-2xs uppercase tracking-wide-ui text-text-muted">{title}</h4>
      {children}
    </div>
  );
});

export function AdminPlayerDetail({
  player,
  onBack,
}: {
  player: PlayerDetail;
  onBack: () => void;
}) {
  const hpPct = player.maxHp > 0 ? (player.hp / player.maxHp) * 100 : 0;
  const hpColor = hpPct > 60 ? "bg-status-success" : hpPct > 25 ? "bg-status-warning" : "bg-status-error";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-3 py-1 text-xs text-text-muted transition hover:bg-[var(--chrome-highlight-strong)] hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-active focus-visible:outline-none"
        >
          &#x2190; Back
        </button>
        <h3 className="font-display text-xl text-text-primary">{player.name}</h3>
        {player.isStaff && (
          <span className="rounded-full bg-violet/15 px-2 py-0.5 text-2xs text-violet">
            Staff
          </span>
        )}
        {player.activeTitle && (
          <span className="text-xs italic text-text-secondary">{player.activeTitle}</span>
        )}
        <span
          className={`ml-auto rounded-full px-2.5 py-0.5 text-2xs ${
            player.isOnline
              ? "bg-status-success/15 text-status-success"
              : "bg-[var(--chrome-fill)] text-text-muted"
          }`}
        >
          {player.isOnline ? "Online" : "Offline"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Section title="Identity">
          <StatRow label="Level" value={player.level} />
          <StatRow label="Class" value={player.playerClass} valueClass="text-stellar-blue" />
          <StatRow label="Race" value={player.race} />
          <StatRow label="Room" value={player.room} valueClass="font-mono text-text-secondary" />
        </Section>

        <Section title="Vitals">
          <VitalBar label="HP" current={player.hp} max={player.maxHp} color={hpColor} ariaLabel="Health" />
          <VitalBar label="Mana" current={player.mana} max={player.maxMana} color="bg-stellar-blue" ariaLabel="Mana" />
          <StatRow label="XP" value={player.xpTotal.toLocaleString()} />
          <StatRow label="Gold" value={player.gold.toLocaleString()} valueClass="text-status-warning" />
        </Section>

        <Section title="Stats">
          {Object.entries(player.stats).length > 0 ? (
            Object.entries(player.stats).map(([key, val]) => (
              <StatRow key={key} label={key} value={val} />
            ))
          ) : (
            <p className="text-xs text-text-muted">No stats available</p>
          )}
        </Section>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Section title="Active quests">
          {player.activeQuestIds.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {player.activeQuestIds.map((id) => (
                <span
                  key={id}
                  className="rounded-full bg-status-warning/12 px-2.5 py-1 text-2xs text-status-warning"
                >
                  {id}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted">None</p>
          )}
        </Section>

        <Section title="Achievements">
          {player.achievementIds.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {player.achievementIds.map((id) => (
                <span
                  key={id}
                  className="rounded-full bg-violet/12 px-2.5 py-1 text-2xs text-violet"
                >
                  {id}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted">None</p>
          )}
        </Section>
      </div>

      {player.completedQuestIds.length > 0 && (
        <Section title="Completed quests">
          <div className="flex flex-wrap gap-1.5">
            {player.completedQuestIds.map((id) => (
              <span
                key={id}
                className="rounded-full bg-badge-success-bg px-2.5 py-1 text-2xs text-badge-success"
              >
                {id}
              </span>
            ))}
          </div>
        </Section>
      )}

      <StaffToggleSection playerName={player.name} isStaff={player.isStaff} />
    </div>
  );
}

// ─── Staff toggle ──────────────────────────────────────────────────

function StaffToggleSection({ playerName, isStaff }: { playerName: string; isStaff: boolean }) {
  const toggleStaff = useAdminStore((s) => s.toggleStaff);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);

  const handleClick = () => {
    if (!confirming) {
      setConfirming(true);
      setResultMsg(null);
      timer.current = setTimeout(() => setConfirming(false), 4000);
      return;
    }
    setConfirming(false);
    if (timer.current) clearTimeout(timer.current);
    doToggle();
  };

  const doToggle = async () => {
    setLoading(true);
    const result = await toggleStaff(playerName);
    setLoading(false);
    if (result) {
      setResultMsg(result.isStaff ? "Staff granted" : "Staff revoked");
      setTimeout(() => setResultMsg(null), 3000);
    }
  };

  return (
    <Section title="Admin actions">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-text-primary">Staff privileges</p>
          <p className="mt-0.5 text-2xs text-text-muted">
            {isStaff ? "This player has staff access." : "This player has no staff access."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {resultMsg && (
            <span className="motion-safe:animate-unfurl-in text-2xs text-status-success">{resultMsg}</span>
          )}
          {confirming && (
            <button
              onClick={() => { setConfirming(false); if (timer.current) clearTimeout(timer.current); }}
              className="rounded text-2xs text-text-muted hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-active focus-visible:outline-none"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleClick}
            disabled={loading}
            className={`shrink-0 rounded-xl border px-4 py-1.5 text-xs font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-border-active focus-visible:outline-none disabled:opacity-40 ${
              confirming
                ? "border-status-warning/50 bg-status-warning/15 text-status-warning"
                : isStaff
                  ? "border-status-error/30 bg-status-error/10 text-status-error hover:bg-status-error/20"
                  : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] text-text-primary hover:bg-[var(--chrome-highlight-strong)]"
            }`}
          >
            {loading ? "..." : confirming ? "Confirm" : isStaff ? "Revoke staff" : "Grant staff"}
          </button>
        </div>
      </div>
    </Section>
  );
}
