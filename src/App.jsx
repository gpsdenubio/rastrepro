// src/App.jsx
import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Devices from "./pages/Devices";
import Users from "./pages/Users";
import Reports from "./pages/Reports";
import MapView from "./pages/MapView";
import Alerts from "./pages/Alerts";
import Logout from "./pages/Logout";
import DashboardPage from "./pages/Dashboard";
import Audit from "./pages/Audit";
import Settings from "./pages/Settings";

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
      {isAuthenticated ? (
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<MapView />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/devices" element={<Devices />} />
            <Route path="/users" element={<Users />} />
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
    </BrowserRouter>
  );
}
