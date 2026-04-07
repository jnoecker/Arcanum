import type { CSSProperties, ReactNode } from "react";

type ShowcasePanelStyle = CSSProperties & {
  "--showcase-tone"?: string;
  "--showcase-title-color"?: string;
};

interface ShowcasePanelProps {
  title: string;
  toneColor?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

interface ShowcaseEmptyStateProps {
  title: string;
  description: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export const showcaseButtonClassNames = {
  primary: "showcase-button showcase-button--primary",
  secondary: "showcase-button showcase-button--secondary",
  quiet: "showcase-button showcase-button--quiet",
} as const;

export function ShowcasePanel({
  title,
  toneColor,
  children,
  className = "",
  bodyClassName = "",
}: ShowcasePanelProps) {
  const style = toneColor
    ? ({
        "--showcase-tone": `${toneColor}30`,
        "--showcase-title-color": toneColor,
      } satisfies ShowcasePanelStyle)
    : undefined;

  return (
    <section className={`showcase-panel ${className}`.trim()} style={style}>
      <div className="showcase-panel__header">
        <h3 className="showcase-panel__title">{title}</h3>
      </div>
      <div className={`showcase-panel__body ${bodyClassName}`.trim()}>{children}</div>
    </section>
  );
}

export function ShowcaseEmptyState({
  title,
  description,
  actions,
  className = "",
}: ShowcaseEmptyStateProps) {
  return (
    <div className={`showcase-empty-state ${className}`.trim()}>
      <h2 className="showcase-empty-state__title">{title}</h2>
      <div className="showcase-empty-state__description">{description}</div>
      {actions ? <div className="showcase-empty-state__actions">{actions}</div> : null}
    </div>
  );
}
