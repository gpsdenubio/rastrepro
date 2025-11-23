// src/pages/Dashboard.jsx
import React from "react";
import { Navigate } from "react-router-dom";

export default function Dashboard() {
  // Mantemos a rota, mas redirecionamos para o mapa para evitar qualquer tela antiga.
  return <Navigate to="/map" replace />;
}
