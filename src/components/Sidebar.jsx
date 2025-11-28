// src/components/Sidebar.jsx
import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Home,
  MapPin,
  List,
  Bell,
  LogOut,
  Users,
  FileText,
  Settings,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Sidebar({ open }) {
  const { logout } = useAuth();
  const location = useLocation();

  const baseItem =
    "w-full flex items-center gap-3 p-2.5 rounded-lg transition mt-1 text-slate-200";

  const navItems = [
    { to: "/dashboard", label: "Dashboard", icon: <Home size={18} /> },
    { to: "/users", label: "Usuários", icon: <Users size={18} /> },
    { to: "/devices", label: "Dispositivos", icon: <List size={18} /> },
    { to: "/reports", label: "Relatórios", icon: <FileText size={18} /> },
    { to: "/alerts", label: "Eventos", icon: <Bell size={18} /> },
    { to: "/map", label: "Mapa", icon: <MapPin size={18} /> },
    { to: "/dashboard", label: "Configurações", icon: <Settings size={18} /> },
  ];

  return (
    <aside
      className={`fixed md:static inset-y-0 left-0 z-40 h-screen bg-slate-900 border-r border-slate-800 transition-transform duration-200 shadow-[8px_0_24px_rgba(0,0,0,0.35)] ${
        open ? "translate-x-0 w-64" : "-translate-x-full md:translate-x-0 md:w-16"
      }`}
    >
      <div className="h-16 flex items-center px-3 border-b border-slate-800">
        <div className="flex items-center gap-2 text-slate-100">
          {open && <span className="font-bold text-lg text-sky-400">RastrePro</span>}
        </div>
      </div>

      <nav className="mt-4 px-2 flex flex-col gap-1 pb-6">
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
