import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import api, { setAuthHeader as applyAxiosAuthHeader } from "../services/api";
import { recordLog } from "../services/logs";

const AuthContext = createContext({
  user: null,
  authHeader: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  loadSession: async () => {},
});

const USERNAME_KEY = "authUsername";
const HEADER_KEY = "authHeader";
const SESSION_LOGS_KEY = "sessionLogs";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authHeader, setAuthHeader] = useState(null);
  const [loading, setLoading] = useState(true);

  const appendSessionLog = useCallback((entry) => {
    try {
      const now = new Date().toISOString();
      const prev = JSON.parse(localStorage.getItem(SESSION_LOGS_KEY) || "[]");
      const next = [{ ...entry, time: now }, ...prev].slice(0, 100);
      localStorage.setItem(SESSION_LOGS_KEY, JSON.stringify(next));
      // tenta também gravar remotamente
      recordLog({ ...entry, time: now }).catch(() => {});
    } catch (err) {
      // silencioso
    }
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(HEADER_KEY);
    localStorage.removeItem(USERNAME_KEY);
    applyAxiosAuthHeader(null);
    setUser(null);
    setAuthHeader(null);
  }, []);

  const fetchUser = useCallback(async (loginName) => {
    try {
      const res = await api.get("/users");
      const list = Array.isArray(res.data) ? res.data : [];
      if (!list.length) return loginName ? { name: loginName, username: loginName } : null;
      if (loginName) {
        const match = list.find(
          (u) =>
            u.name === loginName ||
            u.login === loginName ||
            u.username === loginName ||
            u.email === loginName
        );
        if (match) return match;
      }
      return list[0];
    } catch (err) {
      console.warn("Não foi possível obter /users, usando fallback local:", err?.message);
      if (loginName) {
        return { name: loginName, username: loginName, admin: false };
      }
      return { name: "Usuário", username: "user", admin: false };
    }
  }, []);

  const loadSession = useCallback(async () => {
    const storedHeader = typeof window !== "undefined" ? localStorage.getItem(HEADER_KEY) : null;
    const storedUsername = typeof window !== "undefined" ? localStorage.getItem(USERNAME_KEY) : null;
    if (!storedHeader) {
      setLoading(false);
      clearSession();
      return false;
    }

    try {
      setLoading(true);
      applyAxiosAuthHeader(storedHeader);
      setAuthHeader(storedHeader);

      // Valida credenciais em um endpoint protegido
      await api.get("/devices");

      const foundUser = await fetchUser(storedUsername);
      setUser(foundUser);
      appendSessionLog({ action: "session_restore", username: storedUsername || foundUser?.name || "desconhecido" });
      setLoading(false);
      return true;
    } catch (err) {
      clearSession();
      setLoading(false);
      return false;
    }
  }, [clearSession, fetchUser]);

  const login = useCallback(
    async (username, password) => {
      setLoading(true);
      const header = `Basic ${btoa(`${username}:${password}`)}`;
      try {
        applyAxiosAuthHeader(header);

        // Testa credenciais
        await api.get("/devices");

        localStorage.setItem(HEADER_KEY, header);
        localStorage.setItem(USERNAME_KEY, username);
        setAuthHeader(header);

        const foundUser = await fetchUser(username);
        setUser(foundUser);
        appendSessionLog({ action: "login", username });

        setLoading(false);
        return { success: true, user: foundUser };
      } catch (err) {
        clearSession();
        setLoading(false);
        if (err.response?.status === 401) {
          throw new Error("Credenciais inválidas");
        }
        throw err;
      }
    },
    [clearSession, fetchUser]
  );

  const logout = useCallback(() => {
    appendSessionLog({ action: "logout", username: user?.name || user?.username || "desconhecido" });
    clearSession();
  }, [clearSession, user, appendSessionLog]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  return (
    <AuthContext.Provider value={{ user, authHeader, loading, login, logout, loadSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
