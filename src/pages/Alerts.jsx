import React, { useEffect, useMemo, useState } from "react";
import { getDevices, getEvents } from "../services/traccar";

export default function Alerts() {
  const [devices, setDevices] = useState([]);
  const [notifiedIds, setNotifiedIds] = useState(new Set());
  const [toasts, setToasts] = useState([]);
  const [error, setError] = useState("");

  const deviceNameById = useMemo(() => {
    const map = {};
    devices.forEach((d) => {
      map[d.id] = d.name || d.uniqueId || `ID ${d.id}`;
    });
    return map;
  }, [devices]);

  const eventTypeLabel = (type) => {
    const map = {
      deviceOnline: "Online",
      deviceOffline: "Offline",
      ignitionOn: "Ignição ligada",
      ignitionOff: "Ignição desligada",
      overspeed: "Alta velocidade",
      alarm: "Alarme",
      geofenceEnter: "Entrou na cerca",
      geofenceExit: "Saiu da cerca",
      commandResult: "Resposta de comando",
    };
    return map[type] || type || "Evento";
  };

  const pushToast = (item) => {
    setToasts((prev) => {
      const next = [item, ...prev].slice(0, 5); // mantém últimos 5
      return next;
    });
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== item.id));
    }, 8000);
  };

  const loadDevices = async () => {
    try {
      const devs = await getDevices();
      setDevices(Array.isArray(devs) ? devs : []);
    } catch (err) {
      setError("Não foi possível carregar dispositivos.");
    }
  };

  const pollEvents = async () => {
    try {
      const now = new Date();
      const from = new Date(now.getTime() - 5 * 60 * 1000); // últimos 5 min
      const list = await getEvents({ from: from.toISOString(), to: now.toISOString() });
      if (!Array.isArray(list)) return;

      setNotifiedIds((prev) => {
        const next = new Set(prev);
        list.forEach((ev) => {
          if (!next.has(ev.id)) {
            next.add(ev.id);
            pushToast({
              id: ev.id,
              title: eventTypeLabel(ev.type),
              device: deviceNameById[ev.deviceId] || `ID ${ev.deviceId || "-"}`,
              time: ev.eventTime ? new Date(ev.eventTime).toLocaleTimeString() : "-",
            });
          }
        });
        // evita crescer infinito
        if (next.size > 200) {
          const trimmed = Array.from(next).slice(-200);
          return new Set(trimmed);
        }
        return next;
      });
    } catch (err) {
      setError("Não foi possível carregar eventos em tempo real.");
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  useEffect(() => {
    pollEvents();
    const interval = setInterval(pollEvents, 3000);
    return () => clearInterval(interval);
  }, [devices]); // dispositivos carregados para exibir nome

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold text-slate-800">Alertas em tempo real</h1>
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="relative min-h-[120px] bg-white border border-slate-100 rounded-2xl shadow-sm p-3 overflow-hidden">
        {toasts.length === 0 ? (
          <div className="text-sm text-slate-500">Nenhum evento recente.</div>
        ) : (
          <div className="space-y-2">
            {toasts.map((t) => (
              <div
                key={t.id}
                className="border border-slate-200 rounded-xl p-3 bg-slate-50 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-800">{t.title}</span>
                  <span className="text-[11px] text-slate-500">{t.time}</span>
                </div>
                <div className="text-xs text-slate-600">{t.device}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
