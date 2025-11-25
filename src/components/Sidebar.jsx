// src/components/Sidebar.jsx
import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Home, MapPin, List, Bell, LogOut, Users, FileText } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Sidebar({ open }) {
  const { logout } = useAuth();
  const location = useLocation();

  const baseItem =
    "w-full flex items-center gap-3 p-2 rounded-lg transition mt-1 text-slate-700";

  const navItems = [
    { to: "/map", label: "Mapa", icon: <MapPin size={18} /> },
    { to: "/devices", label: "Veículos", icon: <List size={18} /> },
    { to: "/users", label: "Usuários", icon: <Users size={18} /> },
    { to: "/reports", label: "Relatórios", icon: <FileText size={18} /> },
    { to: "/alerts", label: "Alertas", icon: <Bell size={18} /> },
    { to: "/dashboard", label: "Dashboard", icon: <Home size={18} /> },
  ];

  return (
    <aside
      className={`flex-shrink-0 h-screen bg-slate-100 border-r border-slate-200 transition-all ${
        open ? "w-64" : "w-16"
      }`}
    >
      <div className="h-16 flex items-center px-3 border-b dark:border-gray-800">
        <div className="flex items-center gap-2">
          {open && <span className="font-bold text-lg text-slate-800">RastrePro</span>}
        </div>
      </div>

      <nav className="mt-4 px-2">
        {navItems.map((item, idx) => {
          const active = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`${baseItem} ${idx === 0 ? "mt-0" : ""} ${
                active ? "bg-white text-sky-600 border border-slate-200" : "hover:bg-slate-200/60"
              }`}
            >
              <span className={active ? "text-sky-600" : "text-slate-600"}>
                {item.icon}
              </span>
              {open && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div className="absolute bottom-4 w-full px-2">
        <NavLink
          to="/logout"
          onClick={logout}
          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-200/60 text-slate-700"
        >
          <LogOut size={18} />
          {open && <span>Sair</span>}
        </NavLink>
      </div>
    </aside>
  );
}
