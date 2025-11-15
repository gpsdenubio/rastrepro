// src/pages/Dashboard.jsx
import React, { useState } from "react";
import TopBar from "../components/TopBar";
import MapView from "./MapView";
import Devices from "./Devices";
import Reports from "./Reports";

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState("Mapa"); // mapa abre direto

  const renderPage = () => {
    switch (currentPage) {
      case "Veículos":
        return <Devices />;
      case "Mapa":
        return <MapView />;
      case "Relatórios":
        return <Reports />;
      default:
        return <MapView />; // fallback seguro
    }
  };

  const menuItems = ["Mapa", "Veículos", "Relatórios"];

  return (
    <div className="flex h-screen bg-gray-100">

      {/* SIDEBAR */}
      <div
        className={`fixed top-0 left-0 h-full w-72
          bg-white/70 backdrop-blur-xl shadow-2xl border-r border-white/30
          transition-transform duration-500 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-80"} z-40`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/20">
          <h2 className="text-2xl font-bold text-sky-700 drop-shadow-sm">RastrePro</h2>
          <button
            onClick={() => setSidebarOpen(false)}
            className="px-3 py-1 rounded hover:bg-white/30 transition"
          >
            ✕
          </button>
        </div>

        {/* Menu */}
        <ul className="p-4 space-y-2">
          {menuItems.map((item) => (
            <li
              key={item}
              onClick={() => {
                setCurrentPage(item);
                setSidebarOpen(false);
              }}
              className={`cursor-pointer px-4 py-2 rounded-xl font-medium transition-all duration-200
                ${currentPage === item
                  ? "bg-sky-600 text-white shadow"
                  : "text-gray-800 hover:bg-sky-100 hover:text-sky-700"
                }`}
            >
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* ÁREA PRINCIPAL */}
      <div className="flex flex-col w-full h-full">
        <TopBar
          onToggleSidebar={() => setSidebarOpen(true)}
          className="relative z-50"
        />
        <div className="p-4 h-full overflow-auto relative z-0">
          {renderPage()}
        </div>
      </div>
    </div>
  );
}

