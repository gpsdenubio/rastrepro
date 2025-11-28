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

  // Fecha o menu por padrão em mobile, mantém aberto em desktop
  React.useEffect(() => {
    const sync = () => {
      const isDesktop = window.innerWidth >= 768;
      setOpen(isDesktop);
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-slate-950 to-black text-slate-100">
      <Sidebar open={open} />

      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar onToggleSidebar={() => setOpen((prev) => !prev)} />
        <main className="p-4 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="max-w-7xl mx-auto w-full">
            {children || <Outlet />}
          </div>
        </main>
        <EventToasts />
      </div>
    </div>
  );
}
