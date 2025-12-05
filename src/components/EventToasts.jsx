import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEventSocket } from "../hooks/useEventSocket";
import { useAuth } from "../context/AuthContext";
import { getDevices, getEvents } from "../services/traccar";
import { loadNotificationRules } from "../services/notifications";

export default function EventToasts() {
  const DEBUG_NOTIFS = true;
  const { authHeader } = useAuth();
  const [devices, setDevices] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [lastEventId, setLastEventId] = useState(null);
  const [lastEventTime, setLastEventTime] = useState(() => new Date(Date.now() - 10 * 60 * 1000).toISOString());
  const seenIdsRef = useRef(new Set());
  const audioRef = useRef(null);
  const customAudioRef = useRef(null);
  const [muted, setMuted] = useState(() => {
    if (typeof window === "undefined") return false;
    const a = localStorage.getItem("alertsMuted");
    return a === "true";
  });
  const [customRules, setCustomRules] = useState([]);
  const [customLog, setCustomLog] = useState([]);

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
      return {
        name: found.name || found.uniqueId || `ID ${found.id}`,
        plate,
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

  // carrega regras customizadas de notificações
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onUpdate = (e) => {
      const next = e.detail || loadNotificationRules();
      setCustomRules(next);
    };
    const onStorage = (e) => {
      if (e.key === "customNotificationRules") {
        setCustomRules(loadNotificationRules());
      }
    };
    setTimeout(() => setCustomRules(loadNotificationRules()), 0);
    window.addEventListener("notifications:rules-updated", onUpdate);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("notifications:rules-updated", onUpdate);
      window.removeEventListener("storage", onStorage);
    };
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

  const applyCustomRules = useCallback(
    (event) => {
      if (!event || !customRules.length) return;
      const typeKey = normalizeEventType(event);
      if (!typeKey) return;
      customRules
        .filter((r) => {
          if (!r.enabled) return false;
          if (!(r.events || []).includes(typeKey)) return false;
          if (r.scope === "device" && r.deviceId) {
            return String(event.deviceId) === String(r.deviceId);
          }
          return true;
        })
        .forEach((rule) => {
          const id = `${rule.id}-${event.id || Date.now()}`;
          const shouldShow = rule.showPopup !== false;
          const deviceLabel = deviceNameById[event.deviceId] || `ID ${event.deviceId || "-"}`;
          if (shouldShow) {
            pushToast({
              id,
              title: rule.title || "Alerta",
              device: deviceLabel,
              time: event.eventTime || event.serverTime || event.deviceTime || "",
              color: rule.color || "#38bdf8",
              message: rule.message || "",
              playSound: rule.playSound !== false,
            });
          }
          setCustomLog((prev) =>
            [{ id, title: rule.title, time: new Date().toLocaleTimeString(), device: deviceNameById[event.deviceId], color: rule.color, message: rule.message }, ...prev].slice(0, 10)
          );
          if (!muted && rule.playSound !== false && customAudioRef.current) {
            try {
              customAudioRef.current.currentTime = 0;
              customAudioRef.current.play().catch(() => {});
            } catch {
              // silencioso
            }
          }
          if (DEBUG_NOTIFS) {
            console.info("[notif] disparada", { typeKey, ruleId: rule.id, device: deviceLabel });
          }
        });
    },
    [customRules, deviceNameById, muted, pushToast, DEBUG_NOTIFS]
  );

  const showBaseNotification = useCallback(
    (event) => {
      const typeKey = normalizeEventType(event);
      const info = getDeviceInfo(event.deviceId);
      const address = buildAddress(event);
      const time =
        event.eventTime || event.serverTime || event.deviceTime || event.position?.deviceTime || new Date().toISOString();
      const titleParts = [eventLabel(typeKey)];
      if (info.plate) titleParts.push(info.plate);
      pushToast({
        id: event.id || `${typeKey}-${event.deviceId || ""}-${time}`,
        title: titleParts.join(" • "),
        device: info.name || deviceNameById[event.deviceId] || `ID ${event.deviceId || "-"}`,
        time,
        message: address,
      });
    },
    [deviceNameById, getDeviceInfo, pushToast]
  );

  // Testar notificação manual
  useEffect(() => {
    const handler = (e) => {
      const rule = e.detail;
      if (!rule) return;
      const fakeEvent = {
        id: `test-${Date.now()}`,
        type: (rule.events && rule.events[0]) || "teste",
        deviceId: rule.deviceId ? Number(rule.deviceId) : undefined,
      };
      showBaseNotification(fakeEvent);
      applyCustomRules(fakeEvent);
    };
    window.addEventListener("notifications:test", handler);
    return () => window.removeEventListener("notifications:test", handler);
  }, [applyCustomRules, showBaseNotification]);

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
          applyCustomRules(ev);
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
        applyCustomRules(msg);
      }
    },
    [applyCustomRules, DEBUG_NOTIFS, showBaseNotification]
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
          applyCustomRules(ev);
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
  }, [authHeader, lastEventId, lastEventTime, applyCustomRules, DEBUG_NOTIFS, showBaseNotification]);

  if (!authHeader) return null;

  return (
    <>
      <audio ref={audioRef} src="https://actions.google.com/sounds/v1/alarms/beep_short.ogg" preload="auto" />
      <audio ref={customAudioRef} src="https://actions.google.com/sounds/v1/alarms/beep_short.ogg" preload="auto" />
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
      {customLog.length > 0 && (
        <div className="fixed top-24 right-4 z-[1800] w-72 space-y-2 pointer-events-none">
          {customLog.map((c) => (
            <div
              key={c.id}
              className="pointer-events-auto bg-slate-900 border border-slate-800 rounded-xl shadow-lg px-3 py-2"
              style={c.color ? { borderColor: c.color, boxShadow: `0 0 10px ${c.color}40` } : undefined}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{c.title}</span>
                <span className="text-[11px] text-slate-400">{c.time}</span>
              </div>
              <div className="text-xs text-slate-300 truncate">{c.device || "-"}</div>
              {c.message && <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">{c.message}</div>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
