import { useFocusTrap } from "@/lib/useFocusTrap";
import { ActionButton, DialogShell } from "@/components/ui/FormWidgets";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(onCancel);

  return (
    <DialogShell
      dialogRef={trapRef}
      titleId="confirm-dialog-title"
      title={title}
      widthClassName="max-w-md"
      onClose={onCancel}
      footer={
        <div className="flex justify-end gap-2">
          <ActionButton variant="ghost" size="sm" onClick={onCancel}>
            {cancelLabel}
          </ActionButton>
          <ActionButton
            variant={destructive ? "danger" : "primary"}
            size="sm"
            onClick={onConfirm}
          >
            {confirmLabel}
          </ActionButton>
        </div>
      }
    >
      <p className="text-sm text-text-secondary">{message}</p>
    </DialogShell>
  );
}
