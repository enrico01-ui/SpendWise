import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui";

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const signOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <button className="font-semibold" onClick={() => navigate("/receipts")}>SpendWise</button>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-600 sm:inline">{user?.name}</span>
            <Button className="bg-white text-slate-900 border border-slate-300 hover:bg-slate-100" onClick={signOut}>Log out</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4"><Outlet /></main>
    </div>
  );
}
