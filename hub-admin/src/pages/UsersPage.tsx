import { useCallback, useEffect, useId, useState } from "react";
import {
  ApiError,
  createUser,
  deleteUser,
  deleteWorld,
  listUsers,
  regenerateKey,
  setUserTier,
  updateQuotas,
  type HubUser,
  type HubUserTier,
} from "../lib/api";
import { Dialog } from "../components/Dialog";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { QuotaDialog } from "../components/QuotaDialog";

interface UsersPageProps {
  adminKey: string;
  onLogout: () => void;
}

function formatDate(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UsageBar({ used, quota, label }: { used: number; quota: number; label: string }) {
  const pct = quota === 0 ? 0 : Math.min(100, Math.round((used / quota) * 100));
  const color = pct >= 95 ? "var(--danger)" : pct >= 80 ? "#d8c268" : "var(--accent)";
  return (
    <div style={{ minWidth: 140 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.72rem",
          color: "var(--muted)",
          marginBottom: 3,
          letterSpacing: "0.06em",
        }}
      >
        <span>{label}</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {used.toLocaleString()} / {quota.toLocaleString()}
        </span>
      </div>
      <div
        style={{
          height: 5,
          width: "100%",
          background: "var(--bg-abyss)",
          borderRadius: 3,
          overflow: "hidden",
          border: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: color,
            transition: "width 0.3s",
          }}
        />
      </div>
    </div>
  );
}

type ConfirmState =
  | null
  | {
      kind: "confirm";
      title: string;
      message: string;
      confirmLabel: string;
      destructive: boolean;
      action: () => Promise<void> | void;
    };

export function UsersPage({ adminKey, onLogout }: UsersPageProps) {
  const revealTitleId = useId();
  const [users, setUsers] = useState<HubUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<{ apiKey: string; label: string } | null>(null);

  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [quotaTarget, setQuotaTarget] = useState<HubUser | null>(null);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newTier, setNewTier] = useState<HubUserTier>("full");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listUsers(adminKey);
      setUsers(rows);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runConfirm = async () => {
    if (!confirmState) return;
    const action = confirmState.action;
    setConfirmState(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await createUser(adminKey, {
        displayName: newName.trim(),
        email: newEmail.trim() || null,
        tier: newTier,
      });
      setRevealedKey({ apiKey: res.apiKey, label: `Key for ${res.user.displayName}` });
      setNewName("");
      setNewEmail("");
      setNewTier("full");
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  const askSetTier = (user: HubUser, tier: HubUserTier) => {
    if (user.tier === tier) return;
    const upgrading = tier === "full";
    setConfirmState({
      kind: "confirm",
      title: upgrading
        ? `Upgrade ${user.displayName} to full access?`
        : `Downgrade ${user.displayName} to publish-only?`,
      message: upgrading
        ? "They will gain hub AI access. Their current key is rotated and the old one stops working immediately."
        : "They lose access to all /ai/* features. Their current key is rotated and the old one stops working immediately.",
      confirmLabel: upgrading ? "Upgrade" : "Downgrade",
      destructive: !upgrading,
      action: async () => {
        const res = await setUserTier(adminKey, user.id, tier);
        if (res.apiKey) {
          setRevealedKey({
            apiKey: res.apiKey,
            label: `New ${tier === "publish" ? "publish-only" : "full"} key for ${user.displayName}`,
          });
        }
        await refresh();
      },
    });
  };

  const askRegenerate = (user: HubUser) => {
    setConfirmState({
      kind: "confirm",
      title: `Rotate ${user.displayName}'s API key?`,
      message: "Their old key stops working immediately. AI usage counters reset to zero.",
      confirmLabel: "Rotate key",
      destructive: false,
      action: async () => {
        const res = await regenerateKey(adminKey, user.id);
        setRevealedKey({ apiKey: res.apiKey, label: `New key for ${user.displayName}` });
      },
    });
  };

  const askDeleteUser = (user: HubUser) => {
    const count = user.worlds.length;
    setConfirmState({
      kind: "confirm",
      title: `Delete ${user.displayName}?`,
      message: `This also wipes ${count} world${count === 1 ? "" : "s"} from the hub. This cannot be undone.`,
      confirmLabel: "Delete user",
      destructive: true,
      action: async () => {
        await deleteUser(adminKey, user.id);
        await refresh();
      },
    });
  };

  const askDeleteWorld = (slug: string) => {
    setConfirmState({
      kind: "confirm",
      title: `Wipe world "${slug}"?`,
      message: "All published lore, images, and showcase data for this world will be removed from the hub. This cannot be undone.",
      confirmLabel: "Wipe world",
      destructive: true,
      action: async () => {
        await deleteWorld(adminKey, slug);
        await refresh();
      },
    });
  };

  const submitQuotas = async (next: { imagesQuota: number; promptsQuota: number }) => {
    if (!quotaTarget) return;
    const user = quotaTarget;
    setQuotaTarget(null);
    try {
      await updateQuotas(adminKey, user.id, next);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  };

  return (
    <>
      <div className="header">
        <h1>Arcanum Hub · Admin</h1>
        <div className="right">
          <button onClick={() => void refresh()} disabled={loading}>
            Refresh
          </button>
          <button onClick={onLogout}>Sign out</button>
        </div>
      </div>

      {error && <div className="banner error">{error}</div>}

      <div className="panel">
        <h2>Invite a user</h2>
        <div className="field">
          <label htmlFor="new-name">Display name</label>
          <input
            id="new-name"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Jane Mapmaker"
            disabled={creating}
          />
        </div>
        <div className="field">
          <label htmlFor="new-email">Email (optional)</label>
          <input
            id="new-email"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="jane@example.com"
            disabled={creating}
          />
        </div>
        <div className="field">
          <label>Tier</label>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start", cursor: "pointer", textTransform: "none", letterSpacing: 0, fontFamily: "Crimson Pro, serif", fontSize: "0.95rem", color: "var(--text)" }}>
              <input
                type="radio"
                name="new-tier"
                value="full"
                checked={newTier === "full"}
                onChange={() => setNewTier("full")}
                disabled={creating}
                style={{ marginTop: "0.3rem", accentColor: "var(--accent)" }}
              />
              <span>
                <strong style={{ color: "var(--accent)" }}>Full</strong> — showcase publish + hub AI (image, LLM, vision).
                <span className="muted" style={{ display: "block", fontSize: "0.82rem" }}>
                  Key prefix: <code>hubk_full_…</code>
                </span>
              </span>
            </label>
            <label style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start", cursor: "pointer", textTransform: "none", letterSpacing: 0, fontFamily: "Crimson Pro, serif", fontSize: "0.95rem", color: "var(--text)" }}>
              <input
                type="radio"
                name="new-tier"
                value="publish"
                checked={newTier === "publish"}
                onChange={() => setNewTier("publish")}
                disabled={creating}
                style={{ marginTop: "0.3rem", accentColor: "var(--accent)" }}
              />
              <span>
                <strong style={{ color: "var(--accent)" }}>Publish-only</strong> — showcase publish, no AI budget.
                <span className="muted" style={{ display: "block", fontSize: "0.82rem" }}>
                  Key prefix: <code>hubk_pub_…</code> — creator auto-disables hub AI toggle.
                </span>
              </span>
            </label>
          </div>
        </div>
        <button className="primary" onClick={() => void handleCreate()} disabled={creating || !newName.trim()}>
          {creating ? "Creating…" : "Create user + mint key"}
        </button>
      </div>

      <div className="panel">
        <h2>Users</h2>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : users.length === 0 ? (
          <p className="muted">No users yet. Invite one above.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Tier</th>
                  <th>AI Usage</th>
                  <th>Worlds</th>
                  <th>Last publish</th>
                  <th aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.displayName}</td>
                    <td className="muted">{user.email ?? "—"}</td>
                    <td>
                      <span className={`tier-badge ${user.tier === "full" ? "full" : "publish"}`}>
                        {user.tier === "full" ? "full" : "publish-only"}
                      </span>
                    </td>
                    <td>
                      {user.tier === "full" ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                          <UsageBar
                            used={user.usage.imagesUsed}
                            quota={user.usage.imagesQuota}
                            label="Images"
                          />
                          <UsageBar
                            used={user.usage.promptsUsed}
                            quota={user.usage.promptsQuota}
                            label="Prompts"
                          />
                        </div>
                      ) : (
                        <span className="muted" style={{ fontSize: "0.85rem" }}>
                          n/a (publish-only)
                        </span>
                      )}
                    </td>
                    <td>
                      {user.worlds.length === 0 ? (
                        <span className="muted">none</span>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                          {user.worlds.map((w) => (
                            <div
                              key={w.slug}
                              style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}
                            >
                              <code>{w.slug}</code>
                              {w.listed && <span className="listed-badge">listed</span>}
                              <span className="muted" style={{ fontSize: "0.82rem" }}>
                                {formatBytes(w.bytesUsed)}
                              </span>
                              <button
                                className="danger ghost"
                                onClick={() => askDeleteWorld(w.slug)}
                              >
                                Wipe
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="muted">{formatDate(user.lastPublishAt)}</td>
                    <td>
                      <div className="action-stack">
                        {user.tier === "full" ? (
                          <>
                            <button onClick={() => setQuotaTarget(user)}>Edit quotas</button>
                            <button onClick={() => askSetTier(user, "publish")}>
                              Downgrade
                            </button>
                          </>
                        ) : (
                          <button onClick={() => askSetTier(user, "full")}>
                            Upgrade to full
                          </button>
                        )}
                        <button onClick={() => askRegenerate(user)}>Rotate key</button>
                        <hr />
                        <button className="danger" onClick={() => askDeleteUser(user)}>
                          Delete user
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {revealedKey && (
        <Dialog
          open={true}
          onClose={() => setRevealedKey(null)}
          labelledBy={revealTitleId}
        >
          <h2 id={revealTitleId} style={{ color: "var(--accent)" }}>
            {revealedKey.label}
          </h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Copy this now — it will not be shown again. The old key (if any) no longer works.
          </p>
          <div className="key-reveal">{revealedKey.apiKey}</div>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button
              onClick={() => void navigator.clipboard.writeText(revealedKey.apiKey)}
            >
              Copy to clipboard
            </button>
            <button className="primary" onClick={() => setRevealedKey(null)} autoFocus>
              I saved it
            </button>
          </div>
        </Dialog>
      )}

      {confirmState && (
        <ConfirmDialog
          open={true}
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          destructive={confirmState.destructive}
          onConfirm={() => void runConfirm()}
          onCancel={() => setConfirmState(null)}
        />
      )}

      {quotaTarget && (
        <QuotaDialog
          open={true}
          userName={quotaTarget.displayName}
          imagesQuota={quotaTarget.usage.imagesQuota}
          promptsQuota={quotaTarget.usage.promptsQuota}
          onSubmit={submitQuotas}
          onCancel={() => setQuotaTarget(null)}
        />
      )}
    </>
  );
}
