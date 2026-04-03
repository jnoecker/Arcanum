import { useFocusTrap } from "@/lib/useFocusTrap";
import { ActionButton, DialogShell } from "@/components/ui/FormWidgets";

interface ErrorDialogProps {
  title: string;
  messages: string[];
  onClose: () => void;
  onRetry?: () => void;
}

export function ErrorDialog({ title, messages, onClose, onRetry }: ErrorDialogProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);

  return (
    <DialogShell
      dialogRef={trapRef}
      titleId="error-dialog-title"
      title={title}
      role="alertdialog"
      widthClassName="max-w-lg"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          {onRetry && (
            <ActionButton variant="primary" size="sm" onClick={() => { onClose(); onRetry(); }}>
              Try Again
            </ActionButton>
          )}
          <ActionButton variant="ghost" size="sm" onClick={onClose}>
            Dismiss
          </ActionButton>
        </div>
      }
    >
      <ul className="flex flex-col gap-2">
        {messages.map((msg, i) => (
          <li key={i} className="text-sm text-text-secondary">
            {msg}
          </li>
        ))}
      </ul>
    </DialogShell>
  );
}
