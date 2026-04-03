import { useFocusTrap } from "@/lib/useFocusTrap";

interface ShortcutsHelpProps {
  onClose: () => void;
}

const shortcuts = [
  { keys: "Ctrl+S", desc: "Save all zones and config" },
  { keys: "Ctrl+Z", desc: "Undo (active zone or lore)" },
  { keys: "Ctrl+Shift+Z / Ctrl+Y", desc: "Redo (active zone or lore)" },
  { keys: "Ctrl+W", desc: "Close active tab" },
  { keys: "Ctrl+Tab", desc: "Next tab" },
  { keys: "Ctrl+Shift+Tab", desc: "Previous tab" },
  { keys: "Ctrl+1-9", desc: "Jump to tab N" },
  { keys: "?", desc: "Toggle this help" },
  { keys: "Escape", desc: "Close this help" },
];

export function ShortcutsHelp({ onClose }: ShortcutsHelpProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-dialog-title"
        className="mx-4 w-96 rounded-lg border border-border-default bg-bg-secondary shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border-default px-5 py-3">
          <h2 id="shortcuts-dialog-title" className="font-display text-sm tracking-wide text-text-primary">
            Keyboard Shortcuts
          </h2>
        </div>
        <div className="px-5 py-3">
          <table className="w-full">
            <tbody>
              {shortcuts.map((s) => (
                <tr key={s.keys} className="border-b border-border-default last:border-0">
                  <td className="py-2 pr-4">
                    <kbd className="rounded bg-bg-elevated px-1.5 py-0.5 font-mono text-xs text-text-primary">
                      {s.keys}
                    </kbd>
                  </td>
                  <td className="py-2 text-xs text-text-secondary">
                    {s.desc}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end border-t border-border-default px-5 py-3">
          <button
            onClick={onClose}
            className="rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
