import { useEffect, useId, useState } from "react";
import { Dialog } from "./Dialog";

interface QuotaDialogProps {
  open: boolean;
  userName: string;
  imagesQuota: number;
  promptsQuota: number;
  onSubmit: (next: { imagesQuota: number; promptsQuota: number }) => void;
  onCancel: () => void;
}

export function QuotaDialog({
  open,
  userName,
  imagesQuota,
  promptsQuota,
  onSubmit,
  onCancel,
}: QuotaDialogProps) {
  const titleId = useId();
  const [images, setImages] = useState(String(imagesQuota));
  const [prompts, setPrompts] = useState(String(promptsQuota));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setImages(String(imagesQuota));
      setPrompts(String(promptsQuota));
      setError(null);
    }
  }, [open, imagesQuota, promptsQuota]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const imgs = parseInt(images, 10);
    const prs = parseInt(prompts, 10);
    if (!Number.isFinite(imgs) || !Number.isFinite(prs) || imgs < 0 || prs < 0) {
      setError("Quotas must be non-negative numbers.");
      return;
    }
    onSubmit({ imagesQuota: imgs, promptsQuota: prs });
  };

  return (
    <Dialog open={open} onClose={onCancel} labelledBy={titleId}>
      <h2 id={titleId}>Edit quotas for {userName}</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Lifetime caps. These counters only reset when the user's key is rotated.
      </p>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="quota-images">Images quota</label>
          <input
            id="quota-images"
            type="number"
            min={0}
            value={images}
            onChange={(e) => setImages(e.target.value)}
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="quota-prompts">Prompts quota</label>
          <input
            id="quota-prompts"
            type="number"
            min={0}
            value={prompts}
            onChange={(e) => setPrompts(e.target.value)}
          />
        </div>
        {error && (
          <div className="banner error" role="alert">
            {error}
          </div>
        )}
        <div className="row" style={{ justifyContent: "flex-end", marginTop: "1rem" }}>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Save quotas
          </button>
        </div>
      </form>
    </Dialog>
  );
}
