// src/components/Sidebar.jsx
import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Home, MapPin, List, Bell, LogOut, Users, FileText, Settings, User, BellRing } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Sidebar({ open, onClose }) {
  const { can } = useAuth();
  const location = useLocation();

  const baseItem =
    "w-full flex items-center gap-3 p-2.5 rounded-lg transition mt-1 text-slate-200";

  const navItems = [
    { to: "/dashboard", label: "Dashboard", icon: <Home size={18} />, perm: "dashboard.view" },
    { to: "/users", label: "Usuários", icon: <Users size={18} />, perm: "users.manage" },
    { to: "/drivers", label: "Motoristas", icon: <User size={18} />, perm: "drivers.view" },
    { to: "/notifications", label: "Notificações", icon: <BellRing size={18} />, perm: "notifications.view" },
    { to: "/devices", label: "Dispositivos", icon: <List size={18} />, perm: "devices.view" },
    { to: "/reports", label: "Relatórios", icon: <FileText size={18} />, perm: "reports.view" },
    { to: "/alerts", label: "Eventos", icon: <Bell size={18} />, perm: "alerts.view" },
    { to: "/map", label: "Mapa", icon: <MapPin size={18} />, perm: "map.view" },
    { to: "/settings", label: "Configurações", icon: <Settings size={18} />, perm: "settings.view" },
  ].filter((item) => can(item.perm));

  return (
    <aside
      className={`fixed md:static inset-y-0 left-0 z-40 h-screen bg-slate-900 border-r border-slate-800 transition-transform duration-200 shadow-[8px_0_24px_rgba(0,0,0,0.35)] ${
        open ? "translate-x-0 w-64" : "-translate-x-full md:translate-x-0 md:w-16"
      }`}
    >
      <div className="h-16 flex items-center px-3 border-b border-slate-800 relative">
        <div className="flex items-center gap-2 text-slate-100">
          {open && <span className="font-bold text-lg text-sky-400">RastrePro</span>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 hover:border-sky-500/60 md:hidden"
          aria-label="Fechar menu"
        >
          ✕
        </button>
      </div>

      <nav className="mt-4 px-2 flex flex-col gap-1 pb-6 overflow-y-auto">
        {navItems.map((item, idx) => {
          const active = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`${baseItem} ${idx === 0 ? "mt-0" : ""} ${
                active
                  ? "bg-slate-800 text-sky-400 ring-2 ring-sky-500/60 border border-slate-700"
                  : "hover:bg-slate-800/70"
              }`}
            >
              <span className={active ? "text-sky-400" : "text-slate-300"}>
                {item.icon}
              </span>
              {open && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
