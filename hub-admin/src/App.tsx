import { useEffect, useState } from "react";
import { clearStoredAdminKey, getStoredAdminKey, setStoredAdminKey, listUsers } from "./lib/api";
import { LoginPage } from "./pages/LoginPage";
import { UsersPage } from "./pages/UsersPage";

export function App() {
  const [adminKey, setAdminKey] = useState<string | null>(() => getStoredAdminKey());
  const [verifying, setVerifying] = useState<boolean>(adminKey !== null);

  useEffect(() => {
    if (!adminKey) {
      setVerifying(false);
      return;
    }
    let cancelled = false;
    setVerifying(true);
    listUsers(adminKey)
      .then(() => {
        if (!cancelled) setVerifying(false);
      })
      .catch(() => {
        if (!cancelled) {
          clearStoredAdminKey();
          setAdminKey(null);
          setVerifying(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [adminKey]);

  if (verifying) {
    return (
      <div className="panel">
        <p className="muted">Verifying admin key…</p>
      </div>
    );
  }

  if (!adminKey) {
    return (
      <LoginPage
        onLogin={(key) => {
          setStoredAdminKey(key);
          setAdminKey(key);
        }}
      />
    );
  }

  return (
    <UsersPage
      adminKey={adminKey}
      onLogout={() => {
        clearStoredAdminKey();
        setAdminKey(null);
      }}
    />
  );
}
