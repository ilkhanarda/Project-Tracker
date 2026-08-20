import { useEffect, useMemo, useState, type ReactNode } from "react";

import { apiFetch, getApiError } from "../lib/api";
import { AuthContext } from "./AuthContext";
import type { LoginValues, RegisterValues, User } from "./types";

type AuthResponse = {
  user: User;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function restoreSession() {
      try {
        const response = await apiFetch("/auth/me", {
          signal: controller.signal,
        });

        if (!response.ok) {
          setUser(null);
          return;
        }

        const data = (await response.json()) as AuthResponse;
        setUser(data.user);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setUser(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsAuthLoading(false);
        }
      }
    }

    void restoreSession();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const clearInvalidSession = () => setUser(null);
    window.addEventListener("auth:unauthorized", clearInvalidSession);
    return () => {
      window.removeEventListener("auth:unauthorized", clearInvalidSession);
    };
  }, []);

  async function authenticate(
    endpoint: "/auth/login" | "/auth/register",
    values: LoginValues | RegisterValues,
  ) {
    const response = await apiFetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      throw new Error(await getApiError(response, "Authentication failed"));
    }

    const data = (await response.json()) as AuthResponse;
    setUser(data.user);
  }

  async function logout() {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
    }
  }

  const value = useMemo(
    () => ({
      user,
      isAuthLoading,
      login: (values: LoginValues) => authenticate("/auth/login", values),
      register: (values: RegisterValues) =>
        authenticate("/auth/register", values),
      logout,
    }),
    [user, isAuthLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
