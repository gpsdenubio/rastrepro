import React from "react";
import { Menu, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function TopBar({ onToggleSidebar }) {
  const { logout } = useAuth();

  return (
    <div className="w-full bg-white/70 backdrop-blur-lg shadow-md border-b border-white/30 px-4 py-3 flex items-center gap-4">
      
      {/* Botão do Menu */}
      <button
        onClick={onToggleSidebar}
        className="p-2 rounded-xl hover:bg-white/40 transition duration-200 shadow-sm border"
      >
        <Menu size={22} />
      </button>

      {/* Título */}
      <h1 className="text-xl font-semibold text-sky-700">
        Painel de Rastreamento
      </h1>

      <div className="ml-auto">
        <button
          onClick={logout}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-600 border hover:bg-white/50 transition"
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>

    </div>
  );
}
