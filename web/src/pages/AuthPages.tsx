import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button, Card, ErrorState, Input } from "../components/ui";

function AuthPage({ register = false }: { register?: boolean }) {
  const { user, isLoading, login, register: registerUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isLoading && user) {
    const destination = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/receipts";
    return <Navigate to={destination} replace />;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!email.includes("@")) { setError("Enter a valid email address."); return; }
    if (password.length < (register ? 8 : 1)) { setError(register ? "Password must be at least 8 characters." : "Password is required."); return; }
    if (register && name.trim().length < 1) { setError("Name is required."); return; }
    setBusy(true);
    try {
      if (register) await registerUser(name.trim(), email.trim(), password);
      else await login(email.trim(), password);
      navigate("/receipts", { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md p-6">
        <h1 className="mb-6 text-2xl font-semibold">{register ? "Create account" : "Welcome back"}</h1>
        <form onSubmit={submit} className="space-y-4" noValidate>
          {register && <label className="block text-sm font-medium">Name<Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>}
          <label className="block text-sm font-medium">Email<Input className="mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
          <label className="block text-sm font-medium">Password<Input className="mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={register ? "new-password" : "current-password"} /></label>
          {error && <ErrorState message={error} />}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait..." : register ? "Create account" : "Sign in"}</Button>
        </form>
        <button type="button" className="mt-5 w-full text-sm text-slate-600 underline" onClick={() => navigate(register ? "/login" : "/register")}>
          {register ? "Already have an account? Sign in" : "Need an account? Register"}
        </button>
      </Card>
    </div>
  );
}

export function LoginPage() { return <AuthPage />; }
export function RegisterPage() { return <AuthPage register />; }
