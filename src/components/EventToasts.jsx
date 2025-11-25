import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useEventSocket } from "../hooks/useEventSocket";
import { useAuth } from "../context/AuthContext";
import { getDevices } from "../services/traccar";

export default function EventToasts() {
  const { authHeader } = useAuth();
  const [devices, setDevices] = useState([]);
  const [toasts, setToasts] = useState([]);

  const deviceNameById = useMemo(() => {
    const map = {};
    devices.forEach((d) => {
      map[d.id] = d.name || d.uniqueId || `ID ${d.id}`;
    });
    return map;
  }, [devices]);

  useEffect(() => {
    const load = async () => {
      try {
        const list = await getDevices();
        setDevices(Array.isArray(list) ? list : []);
      } catch (err) {
        // silencioso
      }
    };
    load();
  }, []);

  const pushToast = useCallback((payload) => {
    const id = payload.id || `${Date.now()}-${Math.random()}`;
    setToasts((prev) => {
      const next = [{ ...payload, id }, ...prev].slice(0, 5);
      return next;
    });
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 8000);
  }, []);

  const onSocketMessage = useCallback(
    (msg) => {
      // Traccar envia {"devices": [...]} ou eventos individuais
      if (Array.isArray(msg?.events)) {
        msg.events.forEach((ev) => {
          pushToast({
            id: ev.id,
            title: ev.type || "Evento",
            device: deviceNameById[ev.deviceId] || `ID ${ev.deviceId || "-"}`,
            time: ev.eventTime || ev.serverTime || ev.deviceTime || "",
          });
        });
      } else if (msg?.type && msg?.deviceId) {
        pushToast({
          id: msg.id || `${msg.type}-${msg.deviceId}-${Date.now()}`,
          title: msg.type,
          device: deviceNameById[msg.deviceId] || `ID ${msg.deviceId || "-"}`,
          time: msg.eventTime || msg.serverTime || msg.deviceTime || "",
        });
      }
    },
    [deviceNameById, pushToast]
  );

  useEventSocket({ onMessage: onSocketMessage, authHeader });

  if (!authHeader) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[2000] flex flex-col gap-2 max-w-xs">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="bg-slate-900/90 text-white rounded-2xl shadow-2xl p-3 text-sm border border-white/10"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">{t.title}</span>
            <span className="text-[11px] text-slate-200">
              {t.time ? new Date(t.time).toLocaleTimeString() : ""}
            </span>
          </div>
          <div className="text-xs text-slate-200 mt-1">{t.device}</div>
        </div>
      ))}
    </div>
  );
}
