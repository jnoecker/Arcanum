import { useMemo } from "react";
import type { FactionDefinition } from "@/types/config";
import { SectionCard } from "@/components/ui/SectionCard";
import { useImageSrc } from "@/lib/useImageSrc";

interface RivalryMapProps {
  definitions: Record<string, FactionDefinition>;
  factionLabelMap: Map<string, string>;
}

export function RivalryMap({ definitions, factionLabelMap }: RivalryMapProps) {
  const ids = Object.keys(definitions);

  const edges = useMemo(() => {
    const seen = new Set<string>();
    const pairs: Array<[string, string]> = [];
    for (const [aid, def] of Object.entries(definitions)) {
      for (const bid of def.enemies ?? []) {
        if (!definitions[bid]) continue;
        const key = aid < bid ? `${aid}|${bid}` : `${bid}|${aid}`;
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push([aid, bid]);
      }
    }
    return pairs;
  }, [definitions]);

  const layout = useMemo(() => {
    const cx = 180;
    const cy = 150;
    const positions = new Map<string, { x: number; y: number }>();
    const n = ids.length;
    if (n === 0) return positions;
    if (n === 1) {
      positions.set(ids[0]!, { x: cx, y: cy });
      return positions;
    }
    if (n === 2) {
      positions.set(ids[0]!, { x: cx - 60, y: cy });
      positions.set(ids[1]!, { x: cx + 60, y: cy });
      return positions;
    }
    const radius = n <= 4 ? 80 : 100;
    ids.forEach((id, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      positions.set(id, {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      });
    });
    return positions;
  }, [ids]);

  return (
    <SectionCard
      title="Rivalry Map"
      description="Lines mark hostile pairs. Strike one faction and the other rewards you in kind."
    >
      <div className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] p-2">
        <div className="flourish-top-thread pointer-events-none absolute inset-x-6 top-0 h-px" />
        <svg
          viewBox="0 0 360 300"
          className="block h-auto w-full"
          role="img"
          aria-label="Faction rivalry graph"
        >
          <defs>
            <radialGradient id="rivalry-orbit" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgb(var(--accent-rgb))" stopOpacity="0" />
              <stop offset="80%" stopColor="rgb(var(--accent-rgb))" stopOpacity="0.08" />
              <stop offset="100%" stopColor="rgb(var(--accent-rgb))" stopOpacity="0" />
            </radialGradient>
          </defs>

          <ellipse cx={180} cy={150} rx={155} ry={110} fill="url(#rivalry-orbit)" />
          <ellipse
            cx={180}
            cy={150}
            rx={155}
            ry={110}
            fill="none"
            stroke="rgb(var(--accent-rgb))"
            strokeOpacity="0.1"
            strokeWidth="1"
          />

          {ids.length < 2 && (
            <text
              x={180}
              y={150}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="var(--color-text-muted)"
              fontFamily="'Crimson Pro', serif"
              fontSize="12"
              fontStyle="italic"
            >
              {ids.length === 0
                ? "Name a faction or two to draw the map"
                : "One faction can't have rivals alone — add another"}
            </text>
          )}

          {edges.length === 0 && ids.length >= 2 && (
            <text
              x={180}
              y={32}
              textAnchor="middle"
              fill="var(--color-text-muted)"
              fontFamily="'Crimson Pro', serif"
              fontSize="11"
              fontStyle="italic"
            >
              Peace, for now — no rivalries declared
            </text>
          )}

          {edges.map(([a, b], i) => {
            const pa = layout.get(a);
            const pb = layout.get(b);
            if (!pa || !pb) return null;
            return (
              <line
                key={i}
                x1={pa.x}
                y1={pa.y}
                x2={pb.x}
                y2={pb.y}
                stroke="rgb(var(--accent-rgb))"
                strokeOpacity="0.55"
                strokeWidth="1.5"
              />
            );
          })}

          {ids.map((id, i) => {
            const p = layout.get(id);
            if (!p) return null;
            const def = definitions[id]!;
            const label = factionLabelMap.get(id) ?? id;
            const fallbackStroke =
              i === 0 ? "rgb(var(--stellar-blue-rgb))" : "rgb(var(--accent-rgb))";
            return (
              <FactionNode
                key={id}
                id={id}
                cx={p.x}
                cy={p.y}
                color={def.color || fallbackStroke}
                image={def.image}
                label={label}
              />
            );
          })}
        </svg>
      </div>
    </SectionCard>
  );
}

interface FactionNodeProps {
  id: string;
  cx: number;
  cy: number;
  color: string;
  image: string | undefined;
  label: string;
}

function FactionNode({ id: _id, cx, cy, color, image, label }: FactionNodeProps) {
  const emblemSrc = useImageSrc(image);
  const r = 20;
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="rgb(var(--bg-panel-rgb, var(--bg-rgb)))"
        stroke={color}
        strokeOpacity="0.75"
        strokeWidth="1.5"
      />
      {emblemSrc ? (
        <>
          <defs>
            <clipPath id={`faction-emblem-clip-${_id}`}>
              <circle cx={cx} cy={cy} r={r - 2} />
            </clipPath>
          </defs>
          <image
            href={emblemSrc}
            x={cx - (r - 2)}
            y={cy - (r - 2)}
            width={(r - 2) * 2}
            height={(r - 2) * 2}
            clipPath={`url(#faction-emblem-clip-${_id})`}
            preserveAspectRatio="xMidYMid slice"
          />
        </>
      ) : (
        <CompassRoseGlyph cx={cx} cy={cy} stroke={color} />
      )}
      <text
        x={cx}
        y={cy + 38}
        textAnchor="middle"
        fill="var(--color-text-primary)"
        fontFamily="'Cinzel', serif"
        fontSize="11"
        fontWeight="600"
      >
        {label.length > 16 ? label.slice(0, 14) + "…" : label}
      </text>
    </g>
  );
}

function CompassRoseGlyph({ cx, cy, stroke }: { cx: number; cy: number; stroke: string }) {
  return (
    <g
      transform={`translate(${cx} ${cy}) scale(0.6)`}
      stroke={stroke}
      strokeOpacity="0.85"
      strokeWidth="1"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M0 -14 L1.6 -1.6 L14 0 L1.6 1.6 L0 14 L-1.6 1.6 L-14 0 L-1.6 -1.6 Z" />
      <circle cx="0" cy="0" r="0.8" fill={stroke} stroke="none" opacity="0.9" />
    </g>
  );
}
