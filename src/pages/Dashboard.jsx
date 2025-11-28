// src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import MapView from "./MapView";
import { getDevices, getUsers, getEvents } from "../services/traccar";

export default function Dashboard() {
  const [devices, setDevices] = useState([]);
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const now = new Date();
      const from = new Date(now.getTime() - 60 * 60 * 1000); // últimos 60 min
      const [devs, usr, evs] = await Promise.all([
        getDevices(),
        getUsers(),
        getEvents({ from: from.toISOString(), to: now.toISOString(), all: true }),
      ]);
      setDevices(Array.isArray(devs) ? devs : []);
      setUsers(Array.isArray(usr) ? usr : []);
      setEvents(Array.isArray(evs) ? evs.slice(-10).reverse() : []);
    } catch (err) {
      setError("Não foi possível carregar dados do painel.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onlineCount = useMemo(
    () => devices.filter((d) => d.status === "online").length,
    [devices]
  );
  const offlineCount = useMemo(
    () => devices.filter((d) => d.status && d.status !== "online").length,
    [devices]
  );
  const unknownCount = useMemo(
    () => devices.filter((d) => !d.status).length,
    [devices]
  );

  const cards = [
    { label: "Usuários", value: users.length, accent: "bg-sky-500" },
    { label: "Dispositivos", value: devices.length, accent: "bg-indigo-500" },
    { label: "Online", value: onlineCount, accent: "bg-emerald-500" },
    { label: "Offline", value: offlineCount, accent: "bg-red-500" },
    { label: "Desconhecido", value: unknownCount, accent: "bg-slate-400" },
    { label: "Alertas", value: events.length, accent: "bg-amber-500" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6 bg-slate-950 text-slate-100">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-400">Visão geral rápida da operação.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="px-4 py-2 h-[46px] rounded-[10px] border border-slate-700 bg-slate-900 text-slate-100 hover:border-sky-500/60 hover:shadow-[0_0_12px_rgba(14,165,233,0.35)] transition"
          >
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
          <button className="px-4 py-2 h-[46px] rounded-[10px] bg-sky-500 text-slate-900 hover:bg-sky-400 shadow-[0_0_16px_rgba(14,165,233,0.45)] transition font-semibold">
            Exportar
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-red-400">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)] flex items-center gap-3"
          >
            <div className={`h-10 w-10 rounded-xl ${card.accent} text-slate-900 grid place-items-center font-bold`}>
              {card.label.charAt(0)}
            </div>
            <div>
              <div className="text-sm text-slate-400">{card.label}</div>
              <div className="text-lg font-semibold text-slate-100">{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="w-full flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-slate-100">Mapa de dispositivos</h2>
          <span className="text-xs text-slate-400">Tempo real</span>
        </div>
        <div className="w-full rounded-2xl overflow-hidden flex" style={{ minHeight: "60vh", height: "60vh" }}>
          <MapView height="100%" />
        </div>
      </div>

    </div>
  );
}
