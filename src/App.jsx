// src/App.jsx
import React, { Suspense, lazy, useEffect, useRef } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import {
  getDevices,
  getUsers,
  getDrivers,
  getPermissions,
} from "./services/traccar";

const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Devices = lazy(() => import("./pages/Devices"));
const Users = lazy(() => import("./pages/Users"));
const Reports = lazy(() => import("./pages/Reports"));
const MapView = lazy(() => import("./pages/MapView"));
const Alerts = lazy(() => import("./pages/Alerts"));
const Logout = lazy(() => import("./pages/Logout"));
const Audit = lazy(() => import("./pages/Audit"));
const Settings = lazy(() => import("./pages/Settings"));
const Drivers = lazy(() => import("./pages/Drivers"));
const Notifications = lazy(() => import("./pages/Notifications"));
const AddDevice = lazy(() => import("./pages/AddDevice"));

import MainLayout from "./layouts/MainLayout";
import { useAuth } from "./context/AuthContext";

export default function App() {
  const { user, authHeader, loading } = useAuth();
  const isAuthenticated = Boolean(user && authHeader);
  const preloadStartedRef = useRef(false);

  // Pré-carrega rotas e dados básicos uma única vez por sessão, em segundo plano.
  useEffect(() => {
    if (!isAuthenticated || loading || preloadStartedRef.current) return;
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem("preload:routes-done")) {
      preloadStartedRef.current = true;
      return;
    }
    preloadStartedRef.current = true;
    const markDone = () => {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("preload:routes-done", "1");
      }
    };

    const preloadPages = Promise.all([
      import("./pages/Dashboard"),
      import("./pages/Devices"),
      import("./pages/Users"),
      import("./pages/Reports"),
      import("./pages/MapView"),
      import("./pages/Alerts"),
      import("./pages/Settings"),
      import("./pages/Audit"),
      import("./pages/Drivers"),
      import("./pages/Notifications"),
      import("./pages/AddDevice"),
      import("./pages/Logout"),
    ]);

    const preloadData = (async () => {
      try {
        const [devices, users, drivers, perms] = await Promise.all([
          getDevices().catch(() => []),
          getUsers().catch(() => []),
          getDrivers().catch(() => []),
          getPermissions({ all: true }).catch(() => []),
        ]);
        if (typeof window !== "undefined") {
          if (devices?.length) localStorage.setItem("cache:devices", JSON.stringify(devices));
          if (users?.length) localStorage.setItem("cache:users", JSON.stringify(users));
          if (drivers?.length) localStorage.setItem("cache:drivers", JSON.stringify(drivers));
          if (Array.isArray(perms) && perms.length) {
            const plain = {};
            perms.forEach((p) => {
              if (p?.userId == null || p?.deviceId == null) return;
              const uid = Number(p.userId);
              if (!plain[uid]) plain[uid] = [];
              plain[uid].push(Number(p.deviceId));
            });
            localStorage.setItem("cache:user-permissions", JSON.stringify(plain));
          }
        }
      } catch {
        // silencioso
      }
    })();

    Promise.all([preloadPages, preloadData]).finally(markDone);
  }, [isAuthenticated, loading]);

  if (loading && authHeader) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-600">
        Validando sessão...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Suspense
        fallback={<div className="min-h-screen bg-slate-950 text-slate-100" />}
      >
        {isAuthenticated ? (
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/" element={<MapView />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/devices" element={<Devices />} />
              <Route path="/devices/new" element={<AddDevice />} />
              <Route path="/users" element={<Users />} />
              <Route path="/drivers" element={<Drivers />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/map" element={<MapView />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/audit" element={<Audit />} />
            </Route>
            <Route path="/logout" element={<Logout />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        ) : (
          <Routes>
            <Route path="*" element={<Login />} />
          </Routes>
        )}
      </Suspense>
    </BrowserRouter>
  );
}
