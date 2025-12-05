// src/App.jsx
import React, { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

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
