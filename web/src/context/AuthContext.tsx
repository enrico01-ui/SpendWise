import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiRequest, logout as apiLogout, restoreSession, setAccessToken, setLogoutHandler } from "../lib/api";
import type { AuthTokens, User } from "../types/auth";

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setLogoutHandler(() => setUser(null));
    void restoreSession()
      .then((session) => setUser(session?.user ?? null))
      .finally(() => setIsLoading(false));
  }, []);

  const completeAuth = (result: AuthTokens) => {
    setAccessToken(result.accessToken);
    setUser(result.user);
  };

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isLoading,
    login: async (email, password) => {
      const result = await apiRequest<AuthTokens>("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      completeAuth(result);
    },
    register: async (name, email, password) => {
      const result = await apiRequest<AuthTokens>("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      completeAuth(result);
    },
    logout: async () => {
      await apiLogout();
      setUser(null);
    },
  }), [user, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
