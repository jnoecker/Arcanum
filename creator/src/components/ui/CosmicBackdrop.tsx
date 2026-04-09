interface CosmicBackdropProps {
  variant?: "shell" | "panel" | "welcome";
  className?: string;
}

export function CosmicBackdrop({
  variant = "shell",
  className = "",
}: CosmicBackdropProps) {
  const hostClass = className ? ` ${className}` : "";

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden cosmic-backdrop cosmic-backdrop-${variant}${hostClass}`}
    >
      <div className="cosmic-nebula-layer" />
      <div className="cosmic-starfield-layer" />
      <div className="cosmic-orbit-layer" />
    </div>
  );
}
