// Inline SVG icons for the Enchanting panel — functional UI icons only.

interface IconProps {
  className?: string;
}

function base(p: IconProps) {
  return {
    className: `h-3.5 w-3.5 shrink-0 ${p.className ?? ""}`,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

export function PlusIcon(p: IconProps) {
  // Sigil-cross: a four-point star with serif tips. Reads as "inscribe".
  return (
    <svg {...base(p)}>
      <path d="M12 4v16M4 12h16" />
      <path d="M10 4h4M10 20h4M4 10v4M20 10v4" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function XIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M5 5l14 14M19 5L5 19" />
    </svg>
  );
}

export function SearchIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16l4 4" />
    </svg>
  );
}

export function FilterIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 5h18l-7 9v6l-4-2v-4z" />
    </svg>
  );
}

export function CopyIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="8" y="3" width="13" height="13" rx="2" />
      <path d="M16 8H5a2 2 0 0 0-2 2v11" />
    </svg>
  );
}

export function TrashIcon(p: IconProps) {
  // Broken-seal glyph: a wax seal with a jagged crack through it.
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M14 4.5l-3.5 6 4 3-3 6" />
    </svg>
  );
}

export function SaveIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M5 5h11l3 3v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
      <path d="M7 5v6h8V5" />
      <path d="M8 19v-6h8v6" />
    </svg>
  );
}
