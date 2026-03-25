import { useFocusTrap } from "@/lib/useFocusTrap";

interface ErrorDialogProps {
  title: string;
  messages: string[];
  onClose: () => void;
}

export function ErrorDialog({ title, messages, onClose }: ErrorDialogProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div ref={trapRef} role="alertdialog" aria-modal="true" aria-labelledby="error-dialog-title" className="mx-4 max-w-lg rounded-lg border border-border-default bg-bg-secondary shadow-xl">
        <div className="border-b border-border-default px-5 py-3">
          <h2 id="error-dialog-title" className="font-display text-sm tracking-wide text-status-error">{title}</h2>
        </div>
        <div className="px-5 py-4">
          <ul className="flex flex-col gap-2">
            {messages.map((msg, i) => (
              <li key={i} className="text-sm text-text-secondary">
                {msg}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-end border-t border-border-default px-5 py-3">
          <button
            onClick={onClose}
            className="rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
