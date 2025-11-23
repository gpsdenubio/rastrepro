// src/components/TopBar.jsx
import React from "react";
import { Menu, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function TopBar({ onToggleSidebar, title = "RastrePro" }) {
  const { logout } = useAuth();

  return (
    <div className="w-full h-16 bg-white border-b flex items-center px-4 shadow-sm">
      <button
        onClick={onToggleSidebar}
        className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition"
      >
        <Menu size={22} />
      </button>

      <h1 className="ml-4 text-lg font-semibold text-slate-700 dark:text-white">
        {title}
      </h1>

      <div className="flex-1" />

      <button
        onClick={logout}
        className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition"
      >
        <LogOut size={16} />
        Sair
      </button>
    </div>
  );
}
