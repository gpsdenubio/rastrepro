// src/App.jsx

import React from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
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

  return isAuthenticated ? <Dashboard /> : <Login />;
}
