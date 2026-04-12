import { useCallback, useEffect, useState } from "react";
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

// Inline progress bar for usage columns.
function UsageBar({ used, quota, label }: { used: number; quota: number; label: string }) {
  const pct = quota === 0 ? 0 : Math.min(100, Math.round((used / quota) * 100));
  // Yellow past 80%, red past 95%, otherwise accent gold.
  const color = pct >= 95 ? "var(--danger)" : pct >= 80 ? "#d8c268" : "var(--accent)";
  return (
    <div style={{ minWidth: 120 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.7rem",
          color: "var(--muted)",
          marginBottom: 2,
        }}
      >
        <span>{label}</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {used.toLocaleString()} / {quota.toLocaleString()}
        </span>
      </div>
      <div
        style={{
          height: 4,
          width: "100%",
          background: "var(--bg)",
          borderRadius: 2,
          overflow: "hidden",
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

export function UsersPage({ adminKey, onLogout }: UsersPageProps) {
  const [users, setUsers] = useState<HubUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<{ apiKey: string; label: string } | null>(null);

  // ─── Create form state ─────────────────────────────────────────────
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

  const handleSetTier = async (user: HubUser, tier: HubUserTier) => {
    if (user.tier === tier) return;
    const label =
      tier === "publish"
        ? `Downgrade ${user.displayName} to publish-only? Their current key will be rotated and they will lose access to all /ai/* features.`
        : `Upgrade ${user.displayName} to full (publish + AI)? Their current key will be rotated.`;
    const ok = window.confirm(label);
    if (!ok) return;
    try {
      const res = await setUserTier(adminKey, user.id, tier);
      if (res.apiKey) {
        setRevealedKey({
          apiKey: res.apiKey,
          label: `New ${tier === "publish" ? "publish-only" : "full"} key for ${user.displayName}`,
        });
      }
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  };

  const handleRegenerate = async (user: HubUser) => {
    const ok = window.confirm(
      `Rotate the API key for ${user.displayName}? Their old key will stop working immediately.`,
    );
    if (!ok) return;
    try {
      const res = await regenerateKey(adminKey, user.id);
      setRevealedKey({ apiKey: res.apiKey, label: `New key for ${user.displayName}` });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  };

  const handleDeleteUser = async (user: HubUser) => {
    const count = user.worlds.length;
    const ok = window.confirm(
      `Delete ${user.displayName}? This also wipes ${count} world${count === 1 ? "" : "s"} from the hub.`,
    );
    if (!ok) return;
    try {
      await deleteUser(adminKey, user.id);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  };

  const handleEditQuotas = async (user: HubUser) => {
    const imagesStr = window.prompt(
      `New images quota for ${user.displayName} (current: ${user.usage.imagesQuota})`,
      String(user.usage.imagesQuota),
    );
    if (imagesStr === null) return;
    const promptsStr = window.prompt(
      `New prompts quota for ${user.displayName} (current: ${user.usage.promptsQuota})`,
      String(user.usage.promptsQuota),
    );
    if (promptsStr === null) return;
    const imagesQuota = parseInt(imagesStr, 10);
    const promptsQuota = parseInt(promptsStr, 10);
    if (!Number.isFinite(imagesQuota) || !Number.isFinite(promptsQuota)) {
      setError("Quotas must be numbers");
      return;
    }
    try {
      await updateQuotas(adminKey, user.id, { imagesQuota, promptsQuota });
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  };

  const handleDeleteWorld = async (slug: string) => {
    const ok = window.confirm(`Wipe world "${slug}" from the hub? This cannot be undone.`);
    if (!ok) return;
    try {
      await deleteWorld(adminKey, slug);
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
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", cursor: "pointer" }}>
              <input
                type="radio"
                name="new-tier"
                value="full"
                checked={newTier === "full"}
                onChange={() => setNewTier("full")}
                disabled={creating}
                style={{ marginTop: "0.2rem" }}
              />
              <span>
                <strong>Full</strong> — showcase publish + hub AI (image, LLM, vision).
                <span className="muted" style={{ display: "block", fontSize: "0.8rem" }}>
                  Key prefix: <code>hubk_full_…</code>
                </span>
              </span>
            </label>
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", cursor: "pointer" }}>
              <input
                type="radio"
                name="new-tier"
                value="publish"
                checked={newTier === "publish"}
                onChange={() => setNewTier("publish")}
                disabled={creating}
                style={{ marginTop: "0.2rem" }}
              />
              <span>
                <strong>Publish-only</strong> — showcase publish, no AI budget.
                <span className="muted" style={{ display: "block", fontSize: "0.8rem" }}>
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
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Tier</th>
                <th>AI Usage</th>
                <th>Worlds</th>
                <th>Last publish</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.displayName}</td>
                  <td className="muted">{user.email ?? "—"}</td>
                  <td>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: user.tier === "full" ? "var(--accent)" : "var(--muted)",
                        border: `1px solid ${user.tier === "full" ? "var(--accent)" : "var(--muted)"}`,
                        borderRadius: 3,
                        padding: "0.1rem 0.4rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        fontVariant: "all-small-caps",
                      }}
                    >
                      {user.tier === "full" ? "full" : "publish-only"}
                    </span>
                  </td>
                  <td>
                    {user.tier === "full" ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
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
                      <span className="muted" style={{ fontSize: "0.8rem" }}>
                        n/a (publish-only)
                      </span>
                    )}
                  </td>
                  <td>
                    {user.worlds.length === 0 ? (
                      <span className="muted">none</span>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                        {user.worlds.map((w) => (
                          <div
                            key={w.slug}
                            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                          >
                            <code>{w.slug}</code>
                            {w.listed && (
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  color: "var(--accent)",
                                  border: "1px solid var(--accent)",
                                  borderRadius: 3,
                                  padding: "0 0.35rem",
                                }}
                              >
                                listed
                              </span>
                            )}
                            <span className="muted" style={{ fontSize: "0.8rem" }}>
                              {formatBytes(w.bytesUsed)}
                            </span>
                            <button
                              className="danger"
                              style={{ padding: "0.15rem 0.5rem", fontSize: "0.8rem" }}
                              onClick={() => void handleDeleteWorld(w.slug)}
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
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                      {user.tier === "full" ? (
                        <>
                          <button onClick={() => void handleEditQuotas(user)}>Edit quotas</button>
                          <button onClick={() => void handleSetTier(user, "publish")}>
                            Downgrade to publish-only
                          </button>
                        </>
                      ) : (
                        <button onClick={() => void handleSetTier(user, "full")}>
                          Upgrade to full
                        </button>
                      )}
                      <button onClick={() => void handleRegenerate(user)}>Rotate key</button>
                      <button className="danger" onClick={() => void handleDeleteUser(user)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {revealedKey && (
        <div className="overlay" onClick={() => setRevealedKey(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: "var(--accent)" }}>{revealedKey.label}</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              Copy this now — it will not be shown again. The old key (if any) no longer works.
            </p>
            <div
              style={{
                background: "var(--bg)",
                border: "1px solid var(--accent)",
                borderRadius: 6,
                padding: "0.75rem",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "0.9rem",
                wordBreak: "break-all",
                marginBottom: "1rem",
              }}
            >
              {revealedKey.apiKey}
            </div>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button
                onClick={() => void navigator.clipboard.writeText(revealedKey.apiKey)}
              >
                Copy to clipboard
              </button>
              <button className="primary" onClick={() => setRevealedKey(null)}>
                I saved it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
