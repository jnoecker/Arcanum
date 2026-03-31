import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";

export interface MentionItem {
  id: string;
  label: string;
}

export interface MentionListProps {
  items: MentionItem[];
  command: (item: MentionItem) => void;
}

export interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const MentionList = forwardRef<MentionListRef, MentionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => setSelectedIndex(0), [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((i) => (i + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          const item = items[selectedIndex];
          if (item) command(item);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="rounded-lg border border-border-default bg-bg-secondary px-3 py-2 text-xs text-text-muted shadow-panel">
          No articles found
        </div>
      );
    }

    return (
      <div className="max-h-48 overflow-y-auto rounded-lg border border-border-default bg-bg-secondary shadow-panel">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
              index === selectedIndex
                ? "bg-accent/15 text-accent"
                : "text-text-secondary hover:bg-bg-tertiary"
            }`}
            onClick={() => command(item)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <span className="text-2xs text-text-muted">@</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    );
  },
);

MentionList.displayName = "MentionList";
