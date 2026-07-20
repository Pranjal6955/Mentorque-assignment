import { createContext, useContext, useState, useEffect, useCallback } from "react";
import * as authApi from "../api/auth.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const getStorage = useCallback(() => {
    return typeof sessionStorage !== "undefined" && sessionStorage.getItem("token")
      ? sessionStorage
      : localStorage;
  }, []);

  const loadUser = useCallback(async () => {
    const storage = getStorage();
    const token = storage.getItem("token");

    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const { user: u } = await authApi.me();
      setUser(u);
    } catch (err) {
      console.warn("[AuthContext] /me failed:", err?.message);
      for (const key of ["token", "userRole", "userId", "userEmail", "role", "user"]) {
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [getStorage]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = useCallback(async (email, password) => {
    const { user: u, token } = await authApi.login({ email, password });
    const storage = getStorage();
    storage.setItem("token", token);
    storage.setItem("userRole", u.role);
    setUser(u);
    return u;
  }, [getStorage]);

  const register = useCallback(async (data) => {
    const { user: u, token } = await authApi.register(data);
    const storage = getStorage();
    storage.setItem("token", token);
    storage.setItem("userRole", u.role);
    setUser(u);
    return u;
  }, [getStorage]);

  const logout = useCallback(() => {
    for (const key of ["token", "userRole", "userId", "userEmail", "role", "user"]) {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser: loadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
