/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import api, { setAuthHeader as applyAxiosAuthHeader } from "../services/api";

const AuthContext = createContext({
  user: null,
  authHeader: null,
  loading: true,
  role: "user",
  permissions: {},
  can: () => false,
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
  const [role, setRole] = useState("user");
  const [permissions, setPermissions] = useState({});

  const buildPermissions = useCallback((u) => {
    const isAdmin = Boolean(u?.admin || u?.administrator || u?.role === "admin");
    const attrsPerm = u?.attributes?.permissions || {};
    // Padrão: leitura básica; criação/edição dependem de flags explícitas vindas do Traccar (ex.: attributes.permissions.devicesCreate)
    const baseView = attrsPerm.view ?? true;
    const base = {
      mapView: Boolean(attrsPerm.mapView ?? attrsPerm.map ?? baseView),
      devicesView: Boolean(attrsPerm.devicesView ?? baseView),
      devicesCreate: Boolean(attrsPerm.devicesCreate ?? attrsPerm.create ?? false),
      devicesEdit: Boolean(attrsPerm.devicesEdit ?? attrsPerm.edit ?? false),
      devicesDelete: Boolean(attrsPerm.devicesDelete ?? attrsPerm.delete ?? false),
      usersView: Boolean(attrsPerm.usersView ?? baseView),
      usersCreate: Boolean(attrsPerm.usersCreate ?? attrsPerm.create ?? false),
      usersEdit: Boolean(attrsPerm.usersEdit ?? false),
      usersDelete: Boolean(attrsPerm.usersDelete ?? false),
      driversView: Boolean(attrsPerm.driversView ?? false),
      driversManage: Boolean(attrsPerm.driversManage ?? false),
      commandsBlock: Boolean(attrsPerm.commandsBlock ?? false),
      commandsUnblock: Boolean(attrsPerm.commandsUnblock ?? false),
      reportsView: Boolean(attrsPerm.reportsView ?? attrsPerm.reports ?? baseView),
      notificationsView: Boolean(
        attrsPerm.notificationsView ?? attrsPerm.notifications ?? attrsPerm.settings ?? false
      ),
      notificationsCreate: Boolean(attrsPerm.notificationsCreate ?? attrsPerm.notifications ?? false),
      settingsView: Boolean(attrsPerm.settingsView ?? attrsPerm.settings ?? false),
      alertsView: Boolean(attrsPerm.alertsView ?? baseView),
    };

    const usersViewFlag = base.usersView || base.usersCreate || base.usersEdit || base.usersDelete;
    const devicesViewFlag =
      base.devicesView || base.devicesCreate || base.devicesEdit || base.devicesDelete;
    const driversViewFlag = base.driversView || base.driversManage;
    const notificationsViewFlag = base.notificationsView || base.notificationsCreate;

    const computed = {
      "dashboard.view": isAdmin || base.mapView || base.devicesView || base.alertsView,
      "map.view": isAdmin || base.mapView,
      "devices.view": isAdmin || devicesViewFlag,
      "devices.create": isAdmin || base.devicesCreate,
      "devices.edit": isAdmin || base.devicesEdit,
      "devices.delete": isAdmin || base.devicesDelete,
      "users.view": isAdmin || usersViewFlag,
      "users.create": isAdmin || base.usersCreate,
      "users.edit": isAdmin || base.usersEdit,
      "users.delete": isAdmin || base.usersDelete,
      "users.manage": isAdmin || base.usersView || base.usersEdit || base.usersCreate,
      "drivers.view": isAdmin || driversViewFlag,
      "drivers.manage": isAdmin || base.driversManage,
      "reports.view": isAdmin || base.reportsView,
      "alerts.view": isAdmin || base.alertsView,
      "map.telemetry": isAdmin || base.devicesView || base.mapView,
      "notifications.view": isAdmin || notificationsViewFlag,
      "notifications.create": isAdmin || base.notificationsCreate,
      "settings.view": isAdmin || base.settingsView,
      "commands.block": isAdmin || base.commandsBlock,
      "commands.unblock": isAdmin || base.commandsUnblock,
      "telemetry.view": isAdmin || base.devicesView || base.mapView,
    };

    setRole(isAdmin ? "admin" : "user");
    setPermissions(computed);
    return { computed, isAdmin };
  }, []);

  const can = useCallback(
    (key) => {
      if (role === "admin") return true;
      return Boolean(permissions[key]);
    },
    [role, permissions]
  );

  const appendSessionLog = useCallback((entry) => {
    try {
      const now = new Date().toISOString();
      const prev = JSON.parse(localStorage.getItem(SESSION_LOGS_KEY) || "[]");
      const next = [{ ...entry, time: now }, ...prev].slice(0, 100);
      localStorage.setItem(SESSION_LOGS_KEY, JSON.stringify(next));
    } catch {
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
      buildPermissions(foundUser);
      setUser(foundUser);
      appendSessionLog({ action: "session_restore", username: storedUsername || foundUser?.name || "desconhecido" });
      setLoading(false);
      return true;
    } catch {
      clearSession();
      setLoading(false);
      return false;
    }
  }, [clearSession, fetchUser, appendSessionLog, buildPermissions]);

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
        buildPermissions(foundUser);
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
    [clearSession, fetchUser, appendSessionLog, buildPermissions]
  );

  const logout = useCallback(() => {
    appendSessionLog({ action: "logout", username: user?.name || user?.username || "desconhecido" });
    clearSession();
  }, [clearSession, user, appendSessionLog]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSession();
  }, [loadSession]);

  return (
    <AuthContext.Provider value={{ user, authHeader, loading, login, logout, loadSession, role, permissions, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
