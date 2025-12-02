import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useEventSocket } from "../hooks/useEventSocket";
import { useAuth } from "../context/AuthContext";
import { getDevices, getEvents } from "../services/traccar";

export default function EventToasts() {
  const { authHeader } = useAuth();
  const [devices, setDevices] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [lastEventId, setLastEventId] = useState(null);
  const [lastEventTime, setLastEventTime] = useState(() => new Date(Date.now() - 60 * 60 * 1000).toISOString());

  const toIso = (d) => {
    if (!d) return "";
    return new Date(d).toISOString();
  };

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
          setLastEventId((prev) => (!prev || ev.id > prev ? ev.id : prev));
          if (ev.serverTime || ev.eventTime || ev.deviceTime) {
            setLastEventTime(
              (prev) => {
                const current = new Date(prev).getTime();
                const next = new Date(ev.serverTime || ev.eventTime || ev.deviceTime).getTime();
                return next > current ? new Date(next).toISOString() : prev;
              }
            );
          }
          pushToast({
            id: ev.id,
            title: ev.type || "Evento",
            device: deviceNameById[ev.deviceId] || `ID ${ev.deviceId || "-"}`,
            time: ev.eventTime || ev.serverTime || ev.deviceTime || "",
          });
        });
      } else if (msg?.type && msg?.deviceId) {
        setLastEventId((prev) => (!prev || msg.id > prev ? msg.id : prev));
        if (msg.serverTime || msg.eventTime || msg.deviceTime) {
          setLastEventTime(
            (prev) => {
              const current = new Date(prev).getTime();
              const next = new Date(msg.serverTime || msg.eventTime || msg.deviceTime).getTime();
              return next > current ? new Date(next).toISOString() : prev;
            }
          );
        }
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

  // Permite toasts locais (ex: âncora)
  useEffect(() => {
    const handler = (e) => {
      const detail = e.detail || {};
      pushToast({
        id: detail.id,
        title: detail.title || "Aviso",
        device: detail.device || "",
        time: detail.time || new Date().toISOString(),
      });
    };
    window.addEventListener("local:toast", handler);
    return () => window.removeEventListener("local:toast", handler);
  }, [pushToast]);

  useEventSocket({ onMessage: onSocketMessage, authHeader });

  // Fallback: polling de eventos para garantir notificações mesmo se o WS falhar
  useEffect(() => {
    if (!authHeader) return undefined;
    let active = true;
    const poll = async () => {
      try {
        const from = toIso(lastEventTime || new Date(Date.now() - 60 * 60 * 1000));
        const to = toIso(new Date());
        const events = await getEvents({ from, to });
        if (!active || !Array.isArray(events)) return;
        const filtered = events
          .filter((ev) => (lastEventId ? ev.id > lastEventId : true))
          .sort((a, b) => a.id - b.id);
        filtered.forEach((ev) => {
          setLastEventId((prev) => (!prev || ev.id > prev ? ev.id : prev));
          if (ev.serverTime || ev.eventTime || ev.deviceTime) {
            setLastEventTime(
              (prev) => {
                const current = new Date(prev).getTime();
                const next = new Date(ev.serverTime || ev.eventTime || ev.deviceTime).getTime();
                return next > current ? new Date(next).toISOString() : prev;
              }
            );
          }
          pushToast({
            id: ev.id,
            title: ev.type || "Evento",
            device: deviceNameById[ev.deviceId] || `ID ${ev.deviceId || "-"}`,
            time: ev.eventTime || ev.serverTime || ev.deviceTime || "",
          });
        });
      } catch (err) {
        // silencioso
      }
    };
    poll();
    const id = setInterval(poll, 8000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [authHeader, lastEventId, deviceNameById, pushToast]);

  if (!authHeader) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[2000] flex flex-col gap-2 max-w-xs">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="bg-slate-900/95 text-white rounded-2xl shadow-2xl p-3 text-sm border border-sky-500/20"
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
