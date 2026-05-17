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

export function MoreIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="6" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="18" cy="12" r="1" fill="currentColor" />
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

export function CopyIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="8" y="3" width="13" height="13" rx="2" />
      <path d="M16 8H5a2 2 0 0 0-2 2v11" />
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

export function CheckIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M5 12l5 5L20 6" />
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

export function ArrowUpIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

export function ArrowDownIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 5v14M19 12l-7 7-7-7" />
    </svg>
  );
}

export function FunnelIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 5h18l-7 9v6l-4-2v-4L3 5z" />
    </svg>
  );
}

export function EyeOffIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 3l18 18" />
      <path d="M10.6 6.1A8 8 0 0 1 12 6c6 0 10 6 10 6a16 16 0 0 1-3.4 4.1" />
      <path d="M6.6 6.6A16 16 0 0 0 2 12s4 6 10 6c1.7 0 3.2-.4 4.5-1" />
      <path d="M14 14a3 3 0 0 1-4-4" />
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

export function SaveIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M5 5h11l3 3v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
      <path d="M7 5v6h8V5" />
      <path d="M8 19v-6h8v6" />
    </svg>
  );
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

export function FilterIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 5h18l-7 9v6l-4-2v-4z" />
    </svg>
  );
}

export function EyeIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
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

export function PencilIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

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
