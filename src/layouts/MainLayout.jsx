// src/layouts/MainLayout.jsx
import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import EventToasts from "../components/EventToasts";

export default function MainLayout({ children }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar open={open} />

      <div className="flex flex-col flex-1 bg-white">
        <TopBar onToggleSidebar={() => setOpen((prev) => !prev)} />
        <main className="p-4 flex-1 overflow-auto">
          {children || <Outlet />}
        </main>
        <EventToasts />
      </div>
    </div>
  );
}
