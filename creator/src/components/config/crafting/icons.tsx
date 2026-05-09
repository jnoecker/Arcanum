// Inline SVG icons for the Crafting panel.

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

export function ChevronRightIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M9 6l6 6-6 6" />
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

export function SaveIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M5 5h11l3 3v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
      <path d="M7 5v6h8V5" />
      <path d="M8 19v-6h8v6" />
    </svg>
  );
}
