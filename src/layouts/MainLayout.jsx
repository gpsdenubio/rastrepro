// src/layouts/MainLayout.jsx
import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import EventToasts from "../components/EventToasts";

export default function MainLayout({ children }) {
  const [open, setOpen] = useState(true);

  // Dispara resize para componentes como Leaflet recalcularem tamanho ao encolher/expandir sidebar
  React.useEffect(() => {
    const id = setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 150);
    return () => clearTimeout(id);
  }, [open]);

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-black text-slate-100">
      <Sidebar open={open} />

      <div className="flex flex-col flex-1">
        <TopBar onToggleSidebar={() => setOpen((prev) => !prev)} />
        <main className="p-4 flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto w-full pb-10">
            {children || <Outlet />}
          </div>
        </main>
        <EventToasts />
      </div>
    </div>
  );
}
