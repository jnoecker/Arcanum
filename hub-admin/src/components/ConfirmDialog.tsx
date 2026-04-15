import { useId } from "react";
import { Dialog } from "./Dialog";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const messageId = useId();

  return (
    <Dialog open={open} onClose={onCancel} labelledBy={titleId} describedBy={messageId}>
      <h2 id={titleId}>{title}</h2>
      <p id={messageId} className="muted" style={{ marginTop: 0 }}>
        {message}
      </p>
      <div className="row" style={{ justifyContent: "flex-end", marginTop: "1.25rem" }}>
        <button type="button" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={destructive ? "danger" : "primary"}
          onClick={onConfirm}
          autoFocus
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
