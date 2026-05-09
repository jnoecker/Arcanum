// Inline SVG icons for the Factions panel. Sized via wrapper-class
// (default 14×14). Uses currentColor so they inherit from text color.

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

export function GripIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="9" cy="6" r="1" fill="currentColor" />
      <circle cx="15" cy="6" r="1" fill="currentColor" />
      <circle cx="9" cy="12" r="1" fill="currentColor" />
      <circle cx="15" cy="12" r="1" fill="currentColor" />
      <circle cx="9" cy="18" r="1" fill="currentColor" />
      <circle cx="15" cy="18" r="1" fill="currentColor" />
    </svg>
  );
}

export function PlusIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 5v14M5 12h14" />
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

export function TrashIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
      <path d="M10 11v7M14 11v7" />
    </svg>
  );
}

/** Eight-pointed compass-rose star used as the faction emblem. */
export function CompassRoseIcon(p: IconProps) {
  return (
    <svg
      className={`h-5 w-5 shrink-0 ${p.className ?? ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2l1.6 8.4L22 12l-8.4 1.6L12 22l-1.6-8.4L2 12l8.4-1.6z" />
      <path d="M5.6 5.6l4.8 4.8M18.4 5.6l-4.8 4.8M5.6 18.4l4.8-4.8M18.4 18.4l-4.8-4.8" opacity="0.6" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
