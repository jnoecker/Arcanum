// Inline SVG icons for the Creation panel.

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

export function CoinPileIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <ellipse cx="9" cy="8" rx="6" ry="2.5" />
      <path d="M3 8v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V8" />
      <ellipse cx="15" cy="14" rx="6" ry="2.5" />
      <path d="M9 14v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4" />
    </svg>
  );
}

export function HelmetIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M5 16v-3a7 7 0 1 1 14 0v3" />
      <path d="M4 16h16l-1 4H5z" />
      <path d="M12 3v3" opacity="0.6" />
    </svg>
  );
}

export function PeopleIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19a6 6 0 0 1 12 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M14 19a4 4 0 0 1 8 0" opacity="0.7" />
    </svg>
  );
}

export function QuillIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M20 4l-8 8-3 7 7-3 8-8z" />
      <path d="M14 10l-9 9" />
      <path d="M5 19h4" opacity="0.7" />
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

export function SearchIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16l4 4" />
    </svg>
  );
}

export function MoreVerticalIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="6" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="18" r="1" fill="currentColor" />
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
