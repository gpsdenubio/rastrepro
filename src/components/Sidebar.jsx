// src/components/Sidebar.jsx
import React from "react";
import { Home, MapPin, List, Bell, LogOut } from "lucide-react";

export default function Sidebar({ open, onNavigate }) {
  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-white dark:bg-gray-900 border-r dark:border-gray-800 z-40 transition-all ${
        open ? "w-64" : "w-16"
      }`}
    >
      <div className="h-16 flex items-center px-3 border-b dark:border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🚗</span>
          {open && <span className="font-bold text-lg">RastrePro</span>}
        </div>
      </div>

      <nav className="mt-4 px-2">
        <button
          onClick={() => onNavigate("dashboard")}
          className="w-full flex items-center gap-3 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <Home size={18} />
          {open && <span>Dashboard</span>}
        </button>

        <button
          onClick={() => onNavigate("devices")}
          className="w-full flex items-center gap-3 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 mt-1"
        >
          <List size={18} />
          {open && <span>Veículos</span>}
        </button>

        <button
          onClick={() => onNavigate("map")}
          className="w-full flex items-center gap-3 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 mt-1"
        >
          <MapPin size={18} />
          {open && <span>Mapa</span>}
        </button>

        <button
          onClick={() => onNavigate("alerts")}
          className="w-full flex items-center gap-3 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 mt-1"
        >
          <Bell size={18} />
          {open && <span>Alertas</span>}
        </button>
      </nav>

      <div className="absolute bottom-4 w-full px-2">
        <button
          onClick={() => onNavigate("logout")}
          className="w-full flex items-center gap-3 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <LogOut size={18} />
          {open && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}

