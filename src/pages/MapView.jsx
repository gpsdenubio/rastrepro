// src/pages/MapView.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  getDevices,
  getPositions,
  getAddressFromTraccar,
  blockEngine,
  unblockEngine,
} from "../services/traccar";
import RealisticVehicleMarker from "../components/RealisticVehicleMarker";
import { useEventSocket } from "../hooks/useEventSocket";

// corrigir ícone
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function FitMapView({ positions, lastInteractionRef }) {
  const map = useMap();
  const [hasFitted, setHasFitted] = useState(false);

  useEffect(() => {
    const markInteraction = () => {
      lastInteractionRef.current = Date.now();
    };
    map.on("zoomstart", markInteraction);
    map.on("movestart", markInteraction);
    return () => {
      map.off("zoomstart", markInteraction);
      map.off("movestart", markInteraction);
    };
  }, [map, lastInteractionRef]);

  useEffect(() => {
    if (positions.length > 0) {
      const now = Date.now();
      const elapsed = now - (lastInteractionRef.current || 0);
      const allowRefit = !hasFitted || elapsed > 15000; // 15s após interação manual
      if (allowRefit) {
        const bounds = L.latLngBounds(positions.map((p) => [p.latitude, p.longitude]));
        map.fitBounds(bounds, { padding: [80, 80] });
        setHasFitted(true);
      }
    }
  }, [positions, map, hasFitted, lastInteractionRef]);
  return null;
}

export default function MapView({ onSelectDevice, height }) {
  const lastInteractionRef = useRef(0);
  const [devices, setDevices] = useState([]);
  const [positions, setPositions] = useState([]);
  const [matchedPositions, setMatchedPositions] = useState([]);
  const [authHeader, setAuthHeader] = useState(
    typeof window !== "undefined" ? localStorage.getItem("authHeader") : null
  );
  const [baseMap, setBaseMap] = useState(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("baseMap") : null;
    return stored || "google-road";
  });
  const [ignitionCache, setIgnitionCache] = useState({});
  const [anchorModal, setAnchorModal] = useState({ open: false, device: null });
  const [anchorStates, setAnchorStates] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("anchorStates");
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (err) {
          return {};
        }
      }
    }
    return {};
  });
  const [actionLoading, setActionLoading] = useState(null);
  const mapMatchCacheRef = useRef(new Map());
  const mergingPositionsRef = useRef(false);

  const loadData = async () => {
    const dev = await getDevices();
    const pos = await getPositions();
    setDevices(dev);
    setPositions(pos);
  };

  useEffect(() => {
    loadData();

    let interval = setInterval(loadData, 3000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        loadData();
        clearInterval(interval);
        interval = setInterval(loadData, 3000);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  // Mantém header de auth atualizado (para WS)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("authHeader");
      setAuthHeader(stored);
    }
  }, []);

  // Preenche endereço caso ainda não exista (fallback)
  useEffect(() => {
    const fillAddresses = async () => {
      const missing = positions.filter(
        (p) => !p.address && p.latitude != null && p.longitude != null
      );
      if (!missing.length) return;
      const updates = await Promise.all(
        missing.map(async (p) => {
          const addr = await getAddressFromTraccar(p.latitude, p.longitude);
          return { id: p.id, deviceId: p.deviceId, address: addr };
        })
      );
      setPositions((prev) =>
        prev.map((pos) => {
          const found = updates.find(
            (u) => (u.id && u.id === pos.id) || u.deviceId === pos.deviceId
          );
          if (found && found.address) {
            return { ...pos, address: found.address };
          }
          return pos;
        })
      );
    };
    fillAddresses();
  }, [positions]);

  // Verifica âncoras a cada atualização de posição
  useEffect(() => {
    if (!positions.length) return;
    setAnchorStates((prev) => {
      const next = { ...prev };
      Object.entries(prev).forEach(([deviceId, state]) => {
        if (!state?.active) return;
        const pos = positions.find((p) => p.deviceId === Number(deviceId));
        if (!pos) return;
        const dist = haversine(
          state.center?.[0],
          state.center?.[1],
          pos.latitude,
          pos.longitude
        );
        const inside = dist <= (state.radius || 0);
        if (state.inside && !inside) {
          dispatchToast({
            title: "ANCHOR_EXIT",
            device: pos.name || `ID ${deviceId}`,
            time: new Date().toISOString(),
          });
          if (state.mode === "block") {
            blockEngine(Number(deviceId)).catch(() => {});
          }
          next[deviceId] = { ...state, inside: false };
        } else if (!state.inside && inside) {
          dispatchToast({
            title: "ANCHOR_RETURN",
            device: pos.name || `ID ${deviceId}`,
            time: new Date().toISOString(),
          });
          next[deviceId] = { ...state, inside: true };
        } else {
          next[deviceId] = { ...state, inside };
        }
      });
      return next;
    });
  }, [positions]);

  const haversine = (lat1, lon1, lat2, lon2) => {
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371e3;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const dispatchToast = (payload) => {
    window.dispatchEvent(new CustomEvent("local:toast", { detail: payload }));
  };

  // Mantém último valor de ignição conhecido por dispositivo
  useEffect(() => {
    setIgnitionCache((prev) => {
      const next = { ...prev };
      positions.forEach((p) => {
        if (p?.deviceId == null) return;
        const raw = p.attributes?.ignition;
        if (raw === true || raw === false || raw === "true" || raw === "false" || raw === 1 || raw === 0) {
          const normalized = raw === true || raw === "true" || raw === 1;
          next[p.deviceId] = normalized;
        }
      });
      return next;
    });
  }, [positions]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("baseMap", baseMap);
    }
  }, [baseMap]);

  // Persistir âncoras
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("anchorStates", JSON.stringify(anchorStates));
    }
  }, [anchorStates]);

  const getPos = (deviceId) =>
    matchedPositions.find((p) => p.deviceId === deviceId) ||
    positions.find((p) => p.deviceId === deviceId);

  const baseLayers = useMemo(() => ([
    {
      id: "osm",
      name: "OpenStreetMap",
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: "&copy; OpenStreetMap",
      subdomains: ["a", "b", "c"],
    },
    {
      id: "carto",
      name: "Carto Basemaps",
      url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
      attribution: "&copy; CartoDB",
      subdomains: ["a", "b", "c", "d"],
    },
    {
      id: "google-maps",
      name: "Google Maps",
      url: "https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
      attribution: "&copy; Google",
      subdomains: ["0", "1", "2", "3"],
    },
    {
      id: "google-road",
      name: "Google Estrada",
      url: "https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
      attribution: "&copy; Google",
      subdomains: ["0", "1", "2", "3"],
    },
    {
      id: "google-sat",
      name: "Google Satélite",
      url: "https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
      attribution: "&copy; Google",
      subdomains: ["0", "1", "2", "3"],
    },
    {
      id: "google-hybrid",
      name: "Google Híbrido",
      url: "https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
      attribution: "&copy; Google",
      subdomains: ["0", "1", "2", "3"],
    },
  ]), []);

  const currentLayer = baseLayers.find((l) => l.id === baseMap) || baseLayers[0];

  // Contadores de status de dispositivos
  const onlineCount = useMemo(
    () => devices.filter((d) => d.status === "online").length,
    [devices]
  );
  const offlineCount = useMemo(
    () => devices.filter((d) => d.status === "offline").length,
    [devices]
  );
  const unknownCount = useMemo(
    () => devices.filter((d) => d.status !== "online" && d.status !== "offline").length,
    [devices]
  );
  const movingCount = useMemo(
    () => positions.filter((p) => (p.speed || 0) > 1).length,
    [positions]
  );

  const formatSpeed = (rawSpeed) => {
    if (rawSpeed == null || Number.isNaN(Number(rawSpeed))) return "0 km/h";
    const kph = Number(rawSpeed) * 1.852;
    return `${kph.toFixed(1)} km/h`;
  };

  const mapMatchPosition = async (pos) => {
    const lat = pos.latitude;
    const lon = pos.longitude;
    if (lat == null || lon == null) return pos;

    const key = `${lat.toFixed(5)},${lon.toFixed(5)}:${Math.round(pos.course || 0)}`;
    if (mapMatchCacheRef.current.has(key)) {
      return { ...pos, latitude: mapMatchCacheRef.current.get(key).lat, longitude: mapMatchCacheRef.current.get(key).lon };
    }

    try {
      const bearing = Math.round(pos.course || 0);
      const url = `https://router.project-osrm.org/nearest/v1/driving/${lon},${lat}?number=1&bearings=${bearing},45`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`OSRM ${res.status}`);
      const data = await res.json();
      const match = data?.waypoints?.[0]?.location;
      if (match && Array.isArray(match) && match.length === 2) {
        const [mlon, mlat] = match;
        const corrected = { ...pos, latitude: mlat, longitude: mlon };
        mapMatchCacheRef.current.set(key, { lat: mlat, lon: mlon });
        return corrected;
      }
    } catch (err) {
      // fallback silencioso
    }
    return pos;
  };

  // Aplica map matching às posições carregadas
  useEffect(() => {
    let canceled = false;
    const run = async () => {
      const matched = await Promise.all((positions || []).map((p) => mapMatchPosition(p)));
      if (!canceled) setMatchedPositions(matched);
    };
    if (positions.length) run();
    else setMatchedPositions([]);
    return () => {
      canceled = true;
    };
  }, [positions]);

  // Mescla novas posições recebidas em tempo real
  const mergePositions = (incoming = []) => {
    if (!incoming.length) return;
    setPositions((prev) => {
      const byDevice = new Map();
      const all = [...(prev || []), ...incoming];
      all.forEach((p) => {
        if (!p?.deviceId) return;
        const current = byDevice.get(p.deviceId);
        const currentTime = current?.deviceTime ? new Date(current.deviceTime).getTime() : 0;
        const newTime = p.deviceTime ? new Date(p.deviceTime).getTime() : 0;
        if (!current || newTime >= currentTime) {
          byDevice.set(p.deviceId, { ...current, ...p });
        }
      });
      return Array.from(byDevice.values());
    });
  };

  // WebSocket de eventos/posições (tempo real)
  useEventSocket({
    authHeader,
    onMessage: async (msg) => {
      if (msg?.positions?.length) {
        // evita corrida de renders
        if (mergingPositionsRef.current) return;
        mergingPositionsRef.current = true;
        const matched = await Promise.all((msg.positions || []).map((p) => mapMatchPosition(p)));
        mergePositions(matched);
        mergingPositionsRef.current = false;
      }
      if (msg?.devices?.length) {
        setDevices((prev) => {
          const byId = new Map((prev || []).map((d) => [d.id, d]));
          (msg.devices || []).forEach((d) => {
            byId.set(d.id, { ...(byId.get(d.id) || {}), ...d });
          });
          return Array.from(byId.values());
        });
      }
    },
  });

  const updateEngineStatus = (deviceId, status) => {
    setDevices((prev) =>
      prev.map((d) =>
        d.id === deviceId
          ? {
              ...d,
              attributes: { ...(d.attributes || {}), engine: status },
            }
          : d
      )
    );
  };

  if (!currentLayer) {
    return <div className="p-4 text-sm text-red-600">Nenhuma camada de mapa disponível.</div>;
  }

  const mapHeight = height || "calc(100vh - 96px)";

  return (
    <div className="w-full bg-white" style={{ height: mapHeight }}>
      <div className="relative w-full" style={{ height: mapHeight }}>
        <MapContainer
          center={[-22.84, -47.15]}
          zoom={10}
          style={{ height: "100%", width: "100%" }}
          className="z-0"
        >
          <TileLayer
            key={currentLayer.id}
            url={currentLayer.url}
            attribution={currentLayer.attribution}
            subdomains={currentLayer.subdomains}
          />
          <FitMapView positions={positions} lastInteractionRef={lastInteractionRef} />

          {Object.entries(anchorStates)
            .filter(([, state]) => state?.active && state.center)
            .map(([id, state]) => (
              <Circle
                key={`anchor-${id}`}
                center={state.center}
                radius={state.radius}
                pathOptions={{
                  color: state.mode === "block" ? "#e74c3c" : "#3498db",
                  fillColor: state.mode === "block" ? "#e74c3c" : "#3498db",
                  fillOpacity: 0.12,
                  weight: 2,
                }}
              />
            ))}

          {devices.map((d) => {
            const p = getPos(d.id);
            if (!p) return null;
            const speedVal = Number(p.speed || 0);
            const engine = d.attributes?.engine;
            const isOnline = d.status === "online";
            const isBlocked = engine === "stop";
            const rawIgn = p.attributes?.ignition;
            const normalizedIgn =
              rawIgn === true || rawIgn === "true" || rawIgn === 1
                ? true
                : rawIgn === false || rawIgn === "false" || rawIgn === 0
                ? false
                : null;
            const ignition = normalizedIgn !== null ? normalizedIgn : ignitionCache[d.id];
            const address =
              p.address ||
              p.attributes?.address ||
              p.attributes?.formattedAddress ||
              (p.latitude && p.longitude ? `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}` : "-");
            const anchor = anchorStates[d.id];
            const heading = p.course ?? p.attributes?.course ?? p.attributes?.bearing ?? 0;
            const type = (d.category || "").toLowerCase();
            const markerStatus = isOnline ? (speedVal > 1 ? "moving" : "online") : "offline";

            const handleBlock = async () => {
              if (actionLoading) return;
              setActionLoading(d.id);
              try {
                await blockEngine(d.id);
                updateEngineStatus(d.id, "stop");
              } catch (err) {
                console.error("Erro ao bloquear", err);
              } finally {
                setActionLoading(null);
              }
            };

            const handleUnblock = async () => {
              if (actionLoading) return;
              setActionLoading(d.id);
              try {
                await unblockEngine(d.id);
                updateEngineStatus(d.id, "resume");
              } catch (err) {
                console.error("Erro ao desbloquear", err);
              } finally {
                setActionLoading(null);
              }
            };

            return (
              <RealisticVehicleMarker
                key={d.id}
                latitude={p.latitude}
                longitude={p.longitude}
                heading={heading}
                speed={speedVal}
                status={markerStatus}
                isBlocked={isBlocked}
                type={
                  ["motorcycle", "moto"].includes(type)
                    ? "motorcycle"
                    : ["truck", "caminhao"].includes(type)
                    ? "truck"
                    : ["van"].includes(type)
                    ? "van"
                    : ["pickup", "camionete"].includes(type)
                    ? "pickup"
                    : ["bus", "onibus"].includes(type)
                    ? "bus"
                    : d.attributes?.vehicleType || type || "car"
                }
                status={markerStatus}
                onClick={() => onSelectDevice && onSelectDevice(d, p)}
                usePopup
              >
                <div className="text-xs bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.45)] p-3 min-w-[220px] text-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{d.name || "Sem nome"}</div>
                    <span className={`text-[10px] px-2 py-1 rounded-full border ${
                      isOnline
                        ? "bg-emerald-900/60 text-emerald-200 border-emerald-600"
                        : "bg-slate-800 text-slate-200 border-slate-600"
                    }`}>
                      {isOnline ? "Online" : "Offline"}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-[10px] uppercase tracking-wide">Velocidade</span>
                      <span className="font-semibold">{formatSpeed(p.speed)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-[10px] uppercase tracking-wide">Ignição</span>
                      <span className="font-semibold">
                        {ignition === true ? "Ligada" : ignition === false ? "Desligada" : "-"}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 leading-snug">
                      {address !== "-" ? address : "Sem endereço disponível"}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {p.deviceTime ? new Date(p.deviceTime).toLocaleString() : "-"}
                    </div>
                    {anchor?.active && (
                      <div className="flex items-center gap-1 text-[10px] text-sky-200 mt-1">
                        <span className="px-2 py-1 rounded-full border border-sky-500/60 bg-sky-900/40 text-[10px]">
                          Âncora ativa
                        </span>
                        {anchor.mode === "block" && <span title="Bloqueio automático">⚠️</span>}
                      </div>
                    )}
                    <div className="mt-2 flex gap-2">
                      {!anchor?.active ? (
                        <button
                          onClick={() => setAnchorModal({ open: true, device: d, position: p })}
                          className="text-[11px] px-2 py-1 rounded-[8px] border border-sky-600 text-sky-200 hover:bg-sky-800/50"
                        >
                          Ativar Âncora
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            setAnchorStates((prev) => {
                              const next = { ...prev };
                              delete next[d.id];
                              return next;
                            })
                          }
                          className="text-[11px] px-2 py-1 rounded-[8px] border border-red-600 text-red-200 hover:bg-red-800/40"
                        >
                          Desativar Âncora
                        </button>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={handleBlock}
                          disabled={actionLoading === d.id}
                          className="text-[11px] px-3 py-1 rounded-[8px] border border-red-500 text-red-200 hover:bg-red-800/40 disabled:opacity-50"
                        >
                          {actionLoading === d.id && isBlocked ? "Enviando..." : "Bloquear"}
                        </button>
                        <button
                          onClick={handleUnblock}
                          disabled={actionLoading === d.id}
                          className="text-[11px] px-3 py-1 rounded-[8px] border border-emerald-500 text-emerald-200 hover:bg-emerald-800/30 disabled:opacity-50"
                        >
                          {actionLoading === d.id && !isBlocked ? "Enviando..." : "Desbloquear"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </RealisticVehicleMarker>
            );
          })}
        </MapContainer>

        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2 pointer-events-none">
          <div className="shadow-lg rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-left w-[96px] pointer-events-auto">
            <div className="text-[9px] uppercase tracking-wide text-slate-300 leading-none mb-1">Mapa</div>
            <select
              value={baseMap}
              onChange={(e) => setBaseMap(e.target.value)}
              className="w-full border border-slate-700 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-400 bg-slate-900 text-slate-100"
            >
              {baseLayers.map((layer) => (
                <option key={layer.id} value={layer.id}>
                  {layer.name}
                </option>
              ))}
            </select>
          </div>
          {[
            { label: "Total", value: devices.length, bg: "bg-slate-800/95", border: "border-slate-600" },
            { label: "Online", value: onlineCount, bg: "bg-emerald-900/90", border: "border-emerald-600" },
            { label: "Offline", value: offlineCount, bg: "bg-red-900/90", border: "border-red-600" },
            { label: "Desconhecido", value: unknownCount, bg: "bg-slate-700/90", border: "border-slate-500" },
            { label: "Movimento", value: movingCount, bg: "bg-sky-900/90", border: "border-sky-600" },
          ].map((card) => (
            <button
              key={card.label}
              type="button"
              className={`pointer-events-auto shadow-lg rounded-md border ${card.border} ${card.bg} px-2 py-1 text-left hover:shadow-[0_0_12px_rgba(14,165,233,0.35)] transition w-[110px]`}
            >
              <div className="text-[9px] uppercase tracking-wide text-slate-100 leading-none drop-shadow">{card.label}</div>
              <div className="text-sm font-semibold text-white drop-shadow">{card.value}</div>
            </button>
          ))}
        </div>
      </div>

      {anchorModal.open && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 shadow-[0_20px_60px_rgba(0,0,0,0.55)] w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-1">
              Ativar Âncora — {anchorModal.device?.name || anchorModal.device?.uniqueId}
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              O bloqueio automático enviará o comando de corte ao dispositivo quando ele sair da área definida.
            </p>
            <div className="space-y-3">
              <label className="flex flex-col text-sm">
                Raio (metros)
                <input
                  type="number"
                  defaultValue={300}
                  min={50}
                  className="mt-1 border border-slate-700 bg-slate-800 text-slate-100 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                  onChange={(e) =>
                    setAnchorModal((prev) => ({ ...prev, radius: Number(e.target.value) || 0 }))
                  }
                />
              </label>
              <div className="space-y-2 text-sm">
                <div className="font-semibold text-slate-200">Modo</div>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="anchor-mode"
                    defaultChecked
                    onChange={() => setAnchorModal((prev) => ({ ...prev, mode: "notify" }))}
                  />
                  Apenas notificar ao sair
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="anchor-mode"
                    onChange={() => setAnchorModal((prev) => ({ ...prev, mode: "block" }))}
                  />
                  Notificar + bloquear automaticamente
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setAnchorModal({ open: false, device: null })}
                className="px-4 py-2 rounded-[10px] h-[40px] border border-slate-700 bg-slate-800 text-slate-100 hover:border-sky-500/60"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const radius = anchorModal.radius || 300;
                  const pos = anchorModal.position;
                  if (!pos || !anchorModal.device) return;
                  setAnchorStates((prev) => ({
                    ...prev,
                    [anchorModal.device.id]: {
                      active: true,
                      radius,
                      mode: anchorModal.mode || "notify",
                      center: [pos.latitude, pos.longitude],
                      inside: true,
                    },
                  }));
                  setAnchorModal({ open: false, device: null });
                }}
                className="px-4 py-2 rounded-[10px] h-[40px] bg-sky-500 text-slate-900 font-semibold hover:bg-sky-400 shadow-[0_0_16px_rgba(14,165,233,0.45)]"
              >
                Ativar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
