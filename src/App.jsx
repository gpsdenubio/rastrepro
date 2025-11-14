// src/App.jsx

import React, { useState } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

export default function App() {
  const [user, setUser] = useState(null);

  return (
    <>
      {!user ? (
        <Login onSuccess={() => setUser(true)} />
      ) : (
        <Dashboard />
      )}
    </>
  );
}

