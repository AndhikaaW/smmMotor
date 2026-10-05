import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/app/providers/AuthProvider";
import { sendResetForIdentifier, signInWithIdentifier } from "@/lib/firestore/auth";

export function LoginPage() {
  const navigate = useNavigate();
  const { firebaseUser, appUser, loading } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loggedIn = !loading && !!firebaseUser && !!appUser?.isActive;
  useEffect(() => {
    if (loggedIn) navigate("/", { replace: true });
  }, [loggedIn, navigate]);

  if (loggedIn) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await signInWithIdentifier({ identifier, password });
        navigate("/", { replace: true });
      } else {
        await sendResetForIdentifier(identifier);
        setInfo("Link reset dikirim ke email akun tersebut.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6">
        <h1 className="text-xl font-bold">🏍️ Sedyo Makmur Motor POS</h1>
        <p className="mt-1 text-sm text-muted">
          {mode === "login" ? "Masuk untuk mulai kasir." : "Reset password via email."}
        </p>
        <form className="mt-6 space-y-3" onSubmit={handleSubmit}>
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm focus:outline-2 focus:outline-primary"
            placeholder="Username / Email / No HP"
            autoComplete="username"
          />
          {mode === "login" && (
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm focus:outline-2 focus:outline-primary"
              placeholder="Password"
              autoComplete="current-password"
            />
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
          {info && <p className="text-sm text-success">{info}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Memproses..." : mode === "login" ? "Masuk" : "Kirim Link Reset"}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "reset" : "login");
            setError(null);
            setInfo(null);
          }}
          className="mt-3 w-full text-center text-sm text-muted hover:text-text"
        >
          {mode === "login" ? "Lupa password?" : "Kembali ke login"}
        </button>
      </div>
    </div>
  );
}
