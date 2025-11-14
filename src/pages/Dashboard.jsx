// src/pages/Dashboard.jsx
import React, { useState } from "react";
import TopBar from "../components/TopBar";
import MapView from "./MapView";

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-100">

      {/* --- SIDEBAR --- */}
      <div
        className={`fixed top-0 left-0 h-full w-72
          bg-white/70 backdrop-blur-xl shadow-2xl border-r border-white/30
          transition-transform duration-500 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-80"} z-40`}
      >
        {/* Cabeçalho da sidebar */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/20">
          <h2 className="text-2xl font-bold text-sky-700 drop-shadow-sm">RastrePro</h2>

          {/* Botão fechar */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="px-3 py-1 rounded hover:bg-white/30 transition"
          >
            ✕
          </button>
        </div>

        {/* Menu */}
        <ul className="p-4 space-y-2">
          {["Dashboard", "Veículos", "Mapa", "Relatórios"].map((item) => (
            <li
              key={item}
              className="cursor-pointer px-4 py-2 rounded-xl text-gray-800 font-medium
              hover:bg-sky-100 hover:text-sky-700 transition-all duration-200"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* --- ÁREA PRINCIPAL --- */}
      <div className="flex flex-col w-full h-full">
        <TopBar
          onToggleSidebar={() => setSidebarOpen(true)}
          className="relative z-50"
        />

        <div className="p-4 h-full overflow-auto relative z-0">
          <MapView />
        </div>
      </div>
    </div>
  );
}

