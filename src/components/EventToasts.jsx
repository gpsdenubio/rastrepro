import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEventSocket } from "../hooks/useEventSocket";
import { useAuth } from "../context/AuthContext";
import { getDevices, getEvents } from "../services/traccar";

export default function EventToasts() {
  const DEBUG_NOTIFS = true;
  const { authHeader } = useAuth();
  const [devices, setDevices] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [lastEventId, setLastEventId] = useState(null);
  const [lastEventTime, setLastEventTime] = useState(() => new Date(Date.now() - 10 * 60 * 1000).toISOString());
  const seenIdsRef = useRef(new Set());
  const audioRef = useRef(null);
  const [muted, setMuted] = useState(() => {
    if (typeof window === "undefined") return false;
    const a = localStorage.getItem("alertsMuted");
    return a === "true";
  });

  const toIso = (d) => {
    if (!d) return "";
    return new Date(d).toISOString();
  };

  const normalizeEventType = (event) => {
    const raw =
      event?.type ||
      event?.event ||
      event?.attributes?.event ||
      event?.attributes?.alarm ||
      "";
    const key = String(raw || "").trim();
    const lower = key.toLowerCase();
    const map = {
      ignitionon: "ignitionOn",
      ignitionoff: "ignitionOff",
      devicemoving: "deviceMoving",
      devicestopped: "deviceStopped",
      enginestop: "engineStop",
      engineresume: "engineResume",
      lowbattery: "lowBattery",
      overspeed: "overspeed",
      alarm: "alarm",
      deviceonline: "deviceOnline",
      deviceoffline: "deviceOffline",
      test: "test",
    };
    return map[lower.replace(/[^a-z]/g, "")] || key || "unknown";
  };

  const eventLabel = (typeKey) => {
    const map = {
      ignitionOn: "Ignição ligada",
      ignitionOff: "Ignição desligada",
      deviceMoving: "Veículo em movimento",
      deviceStopped: "Veículo parado",
      engineStop: "Bloqueio",
      engineResume: "Desbloqueio",
      lowBattery: "Bateria baixa",
      overspeed: "Excesso de velocidade",
      alarm: "Alarme",
      deviceOnline: "Dispositivo online",
      deviceOffline: "Dispositivo offline",
      test: "Teste",
      unknown: "Evento",
    };
    return map[typeKey] || typeKey || "Evento";
  };

  const getDeviceInfo = useCallback(
    (deviceId) => {
      const found = devices.find((d) => String(d.id) === String(deviceId));
      if (!found) return {};
      const plate = found.attributes?.placa || found.attributes?.plate || found.attributes?.vehiclePlate || "";
      const imei = found.uniqueId || found.attributes?.imei || "";
      return {
        name: found.name || found.uniqueId || `ID ${found.id}`,
        plate,
        imei,
      };
    },
    [devices]
  );

  const buildAddress = (ev) => {
    return (
      ev.address ||
      ev.position?.address ||
      ev.position?.attributes?.address ||
      ev.attributes?.address ||
      ev.attributes?.formattedAddress ||
      ""
    );
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
      } catch {
        // silencioso
      }
    };
    load();
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const next = !!e.detail;
      setMuted(next);
    };
    window.addEventListener("alerts:mute", handler);
    return () => window.removeEventListener("alerts:mute", handler);
  }, []);

  const pushToast = useCallback((payload) => {
    const id = payload.id || `${Date.now()}-${Math.random()}`;
    if (seenIdsRef.current.has(id)) return;
    seenIdsRef.current.add(id);
    setToasts((prev) => {
      const next = [{ ...payload, id }, ...prev].slice(0, 5);
      return next;
    });
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 8000);
    // toca som
    if (!muted && audioRef.current && payload.playSound !== false) {
      try {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      } catch {
        // silencioso
      }
    }
  }, [muted]);

  const showBaseNotification = useCallback(
    (event) => {
      const typeKey = normalizeEventType(event);
      const info = getDeviceInfo(event.deviceId);
      const address = buildAddress(event);
      const time =
        event.eventTime || event.serverTime || event.deviceTime || event.position?.deviceTime || new Date().toISOString();
      const titleParts = [eventLabel(typeKey)];
      if (info.plate) titleParts.push(info.plate);
      const deviceParts = [info.name || deviceNameById[event.deviceId] || `ID ${event.deviceId || "-"}`];
      if (info.imei) deviceParts.push(`IMEI ${info.imei}`);
      const deviceLabel = deviceParts.join(" • ");
      pushToast({
        id: event.id || `${typeKey}-${event.deviceId || ""}-${time}`,
        title: titleParts.join(" • "),
        device: deviceLabel,
        time,
        message: address,
      });
    },
    [deviceNameById, getDeviceInfo, pushToast]
  );

  const onSocketMessage = useCallback(
    (msg) => {
      // Traccar envia {"devices": [...]} ou eventos individuais
      if (Array.isArray(msg?.events)) {
        msg.events.forEach((ev) => {
          if (DEBUG_NOTIFS) console.info("[notif] evento WS", ev);
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
          showBaseNotification(ev);
        });
      } else if (msg?.type && msg?.deviceId) {
        if (DEBUG_NOTIFS) console.info("[notif] evento WS unitário", msg);
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
        showBaseNotification(msg);
      }
    },
    [DEBUG_NOTIFS, showBaseNotification]
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
        const from = toIso(lastEventTime || new Date(Date.now() - 10 * 60 * 1000));
        const to = toIso(new Date());
        const events = await getEvents({ from, to });
        if (!active || !Array.isArray(events)) return;
        const filtered = events
          .filter((ev) => (lastEventId ? ev.id > lastEventId : true))
          .sort((a, b) => a.id - b.id);
        filtered.forEach((ev) => {
          if (DEBUG_NOTIFS) console.info("[notif] evento polling", ev);
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
          showBaseNotification(ev);
        });
      } catch (error) {
        console.warn("Falha ao obter eventos para toasts:", error);
      }
    };
    poll();
    const id = setInterval(poll, 8000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [authHeader, lastEventId, lastEventTime, DEBUG_NOTIFS, showBaseNotification]);

  if (!authHeader) return null;

  return (
    <>
      <audio ref={audioRef} src="https://actions.google.com/sounds/v1/alarms/beep_short.ogg" preload="auto" />
      <div className="fixed bottom-4 right-4 z-[2000] flex flex-col gap-2 max-w-xs">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="bg-slate-900/95 text-white rounded-2xl shadow-2xl p-3 text-sm border border-sky-500/20"
            style={t.color ? { borderColor: t.color, boxShadow: `0 0 12px ${t.color}55` } : undefined}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{t.title}</span>
              <span className="text-[11px] text-slate-200">
                {t.time ? new Date(t.time).toLocaleTimeString() : ""}
              </span>
            </div>
            <div className="text-xs text-slate-200 mt-1">{t.device}</div>
            {t.message && <div className="text-[11px] text-slate-300 mt-1">{t.message}</div>}
          </div>
        ))}
      </div>
    </>
  );
}
