// src/components/Sidebar.jsx
import React from "react";
import { Link } from "react-router-dom";
import { Home, MapPin, List, Bell, LogOut, Users, FileText } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Sidebar({ open }) {
  const { logout } = useAuth();

  const itemClass =
    "w-full flex items-center gap-3 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 mt-1";

  return (
    <aside
      className={`flex-shrink-0 h-screen bg-white border-r transition-all ${
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
        <Link to="/map" className={itemClass.replace(" mt-1", "")}>
          <MapPin size={18} />
          {open && <span>Mapa</span>}
        </Link>

        <Link to="/devices" className={itemClass}>
          <List size={18} />
          {open && <span>Veículos</span>}
        </Link>

        <Link to="/users" className={itemClass}>
          <Users size={18} />
          {open && <span>Usuários</span>}
        </Link>

        <Link to="/reports" className={itemClass}>
          <FileText size={18} />
          {open && <span>Relatórios</span>}
        </Link>

        <Link to="/dashboard" className={itemClass}>
          <Home size={18} />
          {open && <span>Dashboard</span>}
        </Link>

        <Link to="/alerts" className={itemClass}>
          <Bell size={18} />
          {open && <span>Alertas</span>}
        </Link>
      </nav>

      <div className="absolute bottom-4 w-full px-2">
        <Link
          to="/logout"
          onClick={logout}
          className="w-full flex items-center gap-3 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <LogOut size={18} />
          {open && <span>Sair</span>}
        </Link>
      </div>
    </aside>
  );
}
