// src/pages/MapView.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useAuth } from "../context/AuthContext";
import {
  Gauge,
  Signal,
  WifiOff,
  HelpCircle,
  Navigation2,
  Layers,
  MapPin as MapPinIcon,
  Clock3,
  User2,
  Zap,
  Battery as BatteryIcon,
  Lock,
  Unlock,
  Anchor as AnchorIcon,
  Globe2,
} from "lucide-react";

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

const isCoordLike = (addr) =>
  typeof addr === "string" &&
  /^-?\d+(\.\d+)?\s*[,; ]\s*-?\d+(\.\d+)?$/.test(addr.trim());

const buildCoordKey = (lat, lon) => {
  if (lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) return null;
  return `${Number(lat).toFixed(5)},${Number(lon).toFixed(5)}`;
};

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
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setHasFitted(true);
      }
    }
  }, [positions, map, hasFitted, lastInteractionRef]);
  return null;
}

export default function MapView({ onSelectDevice, height }) {
  const { can } = useAuth();
  const canView = can("map.view");
  const lastInteractionRef = useRef(0);
  const batteryCacheRef = useRef({});
  const addressCacheRef = useRef({});
  const geocodedKeyRef = useRef({});
  const geocodeInFlightRef = useRef(new Set());
  const ignitionDisplayRef = useRef({});
  const batteryDisplayRef = useRef({});
  const headingHistoryRef = useRef({});
  const setCachedAddress = (key, addr) => {
    if (!addr) return;
    const k = key != null ? String(key) : null;
    if (!k) return;
    addressCacheRef.current = {
      ...addressCacheRef.current,
      [k]: addr,
    };
  };
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
        } catch {
          return {};
        }
      }
    }
    return {};
  });
  const [actionLoading, setActionLoading] = useState(null);
  const [streetViewUrl, setStreetViewUrl] = useState(null);

  const openStreetViewInside = (lat, lon) => {
    if (lat == null || lon == null) return;
    const url = `https://maps.google.com/maps?q=&layer=c&cbll=${lat},${lon}&cbp=11,0,0,0,0&output=svembed`;
    setStreetViewUrl(url);
  };

  const closeStreetView = () => setStreetViewUrl(null);
  const mapMatchCacheRef = useRef(new Map());
  const mergingPositionsRef = useRef(false);

  const updateIgnitionCacheFromList = (list = []) => {
    setIgnitionCache((prev) => {
      const next = { ...prev };
      list.forEach((item) => {
        const id = item.deviceId ?? item.id;
        if (id == null) return;
        const raw =
          item?.attributes?.ignition ??
          item?.ignition ??
          item?.attributes?.acc;
        if (
          raw === true ||
          raw === false ||
          raw === "true" ||
          raw === "false" ||
          raw === 1 ||
          raw === 0
        ) {
          next[id] = raw === true || raw === "true" || raw === 1;
        }
      });
      return next;
    });
  };

  const updateBatteryCacheFromList = (list = []) => {
    const cache = { ...batteryCacheRef.current };
    list.forEach((item) => {
      const id = item.deviceId ?? item.id;
      if (id == null) return;
      const lvl = Number(
        item?.attributes?.batteryLevel ??
          item?.batteryLevel
      );
      const volt =
        Number(
          item?.attributes?.battery ??
            item?.attributes?.batteryLevelVolts ??
            item?.batteryLevelVolts ??
            item?.battery ??
            item?.attributes?.power ??
            item?.attributes?.deviceBattery
        );
      const hasLvl = Number.isFinite(lvl);
      const hasVolt = Number.isFinite(volt);
      if (hasLvl || hasVolt) {
        const prev = cache[id] || {};
        cache[id] = {
          level: hasLvl ? lvl : prev.level,
          voltage: hasVolt ? volt : prev.voltage,
        };
      }
    });
    batteryCacheRef.current = cache;
  };

  const loadData = useCallback(async () => {
    if (!canView) return;
    const dev = await getDevices();
    const pos = await getPositions();
    setDevices(dev);
    // Semear cache de endereço e usar último valor conhecido
    const cache = { ...addressCacheRef.current };
    dev.forEach((d) => {
      if (d?.address) {
        setCachedAddress(d.id, d.address);
        cache[String(d.id)] = d.address;
      }
    });
    const posWithAddress = pos.map((p) => {
      const coordKey = buildCoordKey(p.latitude, p.longitude);
      const keyId = p.deviceId ?? p.id;
      const lastCoordKey = keyId != null ? geocodedKeyRef.current[keyId] : null;
      const incomingAddr =
        p.address ||
        p.attributes?.address ||
        p.attributes?.formattedAddress ||
        "";
      const cachedAddr =
        cache[String(p.deviceId)] ||
        cache[String(p.id)] ||
        "";
      const chosenAddr = incomingAddr || cachedAddr;
      const hasReadableAddr = Boolean(chosenAddr) && !isCoordLike(chosenAddr);
      if (chosenAddr) {
        cache[String(p.deviceId || p.id)] = chosenAddr;
      }
      if (hasReadableAddr && coordKey && keyId != null) {
        geocodedKeyRef.current[keyId] = coordKey;
      }
      const needsGeocode =
        coordKey && !hasReadableAddr && coordKey !== lastCoordKey;
      return { ...p, address: chosenAddr || p.address, needsGeocode: Boolean(needsGeocode) };
    });
    addressCacheRef.current = cache;
    setPositions(posWithAddress);
    updateIgnitionCacheFromList(dev);
    updateIgnitionCacheFromList(pos);
    updateBatteryCacheFromList(dev);
    updateBatteryCacheFromList(pos);
  }, [canView]);

  useEffect(() => {
    if (!canView) return;
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
  }, [canView, loadData]);

  // Mantém header de auth atualizado (para WS)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("authHeader");
      setAuthHeader(stored);
    }
  }, []);

  // Preenche endereço caso ainda não exista (fallback)
  useEffect(() => {
    if (!canView) return;
    const fillAddresses = async () => {
      const missing = positions.filter(
        (p) =>
          (() => {
            const coordKey = buildCoordKey(p.latitude, p.longitude);
            if (!coordKey) return false;
            const lastKey = geocodedKeyRef.current[p.deviceId ?? p.id];
            const hasReadableAddr = Boolean(p.address) && !isCoordLike(p.address || "");
            const shouldGeocode =
              (!hasReadableAddr || p.needsGeocode || isCoordLike(p.address || "")) &&
              coordKey !== lastKey;
            return (
              shouldGeocode &&
              p.latitude != null &&
              p.longitude != null &&
              !geocodeInFlightRef.current.has(p.deviceId)
            );
          })()
      );
      if (!missing.length) return;
      missing.forEach((p) => {
        if (p?.deviceId != null) geocodeInFlightRef.current.add(p.deviceId);
      });
      const updates = await Promise.all(
        missing.map(async (p) => {
          const addr = await getAddressFromTraccar(p.latitude, p.longitude);
          return {
            id: p.id,
            deviceId: p.deviceId,
            address: addr,
            coordKey: buildCoordKey(p.latitude, p.longitude),
          };
        })
      );
      setPositions((prev) => {
        const cache = { ...addressCacheRef.current };
        const next = prev.map((pos) => {
          const found = updates.find(
            (u) => (u.id && u.id === pos.id) || u.deviceId === pos.deviceId
          );
          if (found && found.address) {
            cache[String(pos.deviceId || pos.id)] = found.address;
            if (found.coordKey && (pos.deviceId || pos.id)) {
              geocodedKeyRef.current[pos.deviceId || pos.id] = found.coordKey;
            }
            if (pos?.deviceId != null) geocodeInFlightRef.current.delete(pos.deviceId);
            return { ...pos, address: found.address, needsGeocode: false };
          }
          if (found?.coordKey && (pos.deviceId || pos.id)) {
            geocodedKeyRef.current[pos.deviceId || pos.id] = found.coordKey;
            if (pos?.deviceId != null) geocodeInFlightRef.current.delete(pos.deviceId);
            return { ...pos, needsGeocode: false };
          }
          return pos;
        });
        addressCacheRef.current = cache;
        return next;
      });
      missing.forEach((p) => {
        if (p?.deviceId != null) geocodeInFlightRef.current.delete(p.deviceId);
      });
    };
    fillAddresses();
  }, [positions, canView]);

  // Verifica âncoras a cada atualização de posição
  useEffect(() => {
    if (!canView || !positions.length) return;
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
  }, [positions, canView]);

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
    if (!canView) return;
    setIgnitionCache((prev) => {
      const next = { ...prev };
      positions.forEach((p) => {
        if (p?.deviceId == null) return;
        const raw = p.attributes?.ignition ?? p?.ignition ?? p?.attributes?.acc;
        if (raw === true || raw === false || raw === "true" || raw === "false" || raw === 1 || raw === 0) {
          const normalized = raw === true || raw === "true" || raw === 1;
          next[p.deviceId] = normalized;
        }
      });
      return next;
    });
  }, [positions, canView]);

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
      maxNativeZoom: 19,
      maxZoom: 22,
    },
    {
      id: "carto",
      name: "Carto Basemaps",
      url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
      attribution: "&copy; CartoDB",
      subdomains: ["a", "b", "c", "d"],
      maxNativeZoom: 20,
      maxZoom: 22,
    },
    {
      id: "google-maps",
      name: "Google Maps",
      url: "https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
      attribution: "&copy; Google",
      subdomains: ["0", "1", "2", "3"],
      maxNativeZoom: 20,
      maxZoom: 22,
    },
    {
      id: "google-road",
      name: "Google Estrada",
      url: "https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
      attribution: "&copy; Google",
      subdomains: ["0", "1", "2", "3"],
      maxNativeZoom: 20,
      maxZoom: 22,
    },
    {
      id: "google-traffic",
      name: "Google Tráfego",
      url: "https://mt{s}.google.com/vt/lyrs=m@221097413,traffic&x={x}&y={y}&z={z}",
      attribution: "&copy; Google",
      subdomains: ["0", "1", "2", "3"],
      maxNativeZoom: 20,
      maxZoom: 22,
    },
    {
      id: "google-sat",
      name: "Google Satélite",
      url: "https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
      attribution: "&copy; Google",
      subdomains: ["0", "1", "2", "3"],
      maxNativeZoom: 20,
      maxZoom: 22,
    },
    {
      id: "google-hybrid",
      name: "Google Híbrido",
      url: "https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
      attribution: "&copy; Google",
      subdomains: ["0", "1", "2", "3"],
      maxNativeZoom: 20,
      maxZoom: 22,
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

  const statusCards = useMemo(() => ([
    {
      label: "Total",
      value: devices.length,
      icon: <Gauge size={18} />,
      accent: "from-slate-900/90 via-slate-900/60 to-slate-800/70",
      dot: "bg-sky-300",
    },
    {
      label: "Online",
      value: onlineCount,
      icon: <Signal size={18} />,
      accent: "from-emerald-900/90 via-emerald-900/70 to-emerald-800/70",
      dot: "bg-emerald-300",
    },
    {
      label: "Offline",
      value: offlineCount,
      icon: <WifiOff size={18} />,
      accent: "from-rose-900/90 via-rose-900/70 to-rose-800/70",
      dot: "bg-rose-300",
    },
    {
      label: "Desconhecido",
      value: unknownCount,
      icon: <HelpCircle size={18} />,
      accent: "from-slate-900/90 via-slate-900/70 to-slate-800/70",
      dot: "bg-slate-300",
    },
    {
      label: "Movimento",
      value: movingCount,
      icon: <Navigation2 size={18} />,
      accent: "from-sky-900/90 via-sky-900/70 to-cyan-800/70",
      dot: "bg-sky-300",
    },
  ]), [devices.length, onlineCount, offlineCount, unknownCount, movingCount]);

  const formatSpeed = (rawSpeed) => {
    if (rawSpeed == null || Number.isNaN(Number(rawSpeed))) return "0 km/h";
    const kph = Number(rawSpeed) * 1.852;
    return `${kph.toFixed(1)} km/h`;
  };

  const toRad = (deg) => (deg * Math.PI) / 180;
  const bearingBetween = (a, b) => {
    if (!a || !b) return null;
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const dLon = toRad(b.lon - a.lon);
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    const brng = (Math.atan2(y, x) * 180) / Math.PI;
    const norm = (brng + 360) % 360;
    return Number.isFinite(norm) ? norm : null;
  };

  const updateHeadingHistory = useCallback((list = []) => {
    list.forEach((pos) => {
      const id = pos?.deviceId ?? pos?.id;
      if (id == null || pos?.latitude == null || pos?.longitude == null) return;
      const current = { lat: Number(pos.latitude), lon: Number(pos.longitude) };
      const prevEntry = headingHistoryRef.current[id];
      const last = prevEntry?.last;
      const moved = last && (last.lat !== current.lat || last.lon !== current.lon);
      headingHistoryRef.current[id] = {
        prev: moved ? last : prevEntry?.prev,
        last: current,
      };
    });
  }, []);

  useEffect(() => {
    updateHeadingHistory(positions);
  }, [positions, updateHeadingHistory]);

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
    } catch (error) {
      console.warn("Map matching falhou:", error);
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
      const cache = { ...addressCacheRef.current };
      const all = [...(prev || []), ...incoming];
      all.forEach((p) => {
        if (!p?.deviceId) return;
        const current = byDevice.get(p.deviceId);
        const currentTime = current?.deviceTime ? new Date(current.deviceTime).getTime() : 0;
        const newTime = p.deviceTime ? new Date(p.deviceTime).getTime() : 0;
        if (!current || newTime >= currentTime) {
          const cachedAddr = cache[String(p.deviceId)];
          const coordKey = buildCoordKey(p.latitude, p.longitude);
          const lastCoordKey = geocodedKeyRef.current[p.deviceId];
          const addr =
            p.address ||
            p.attributes?.address ||
            p.attributes?.formattedAddress ||
            cachedAddr;
          if (addr) cache[String(p.deviceId)] = addr;
          const hasReadableAddr = Boolean(addr) && !isCoordLike(
            addr ||
              ""
          );
          if (hasReadableAddr && coordKey) {
            geocodedKeyRef.current[p.deviceId] = coordKey;
          }
          const needsGeocode =
            coordKey && !hasReadableAddr && coordKey !== lastCoordKey;
          byDevice.set(p.deviceId, {
            ...current,
            ...p,
            address: addr || p.address,
            needsGeocode: Boolean(needsGeocode),
          });
        }
      });
      const merged = Array.from(byDevice.values());
      addressCacheRef.current = cache;
      updateIgnitionCacheFromList(incoming);
      updateBatteryCacheFromList(incoming);
      return merged;
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
          updateIgnitionCacheFromList(msg.devices || []);
          updateBatteryCacheFromList(msg.devices || []);
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

  const mapHeight = height || "calc(100vh - 96px)";

  return (
    <div className="w-full bg-white" style={{ height: mapHeight }}>
      {!canView ? (
        <div className="p-4 text-sm text-red-300">Você não tem permissão para visualizar o mapa.</div>
      ) : !currentLayer ? (
        <div className="p-4 text-sm text-red-600">Nenhuma camada de mapa disponível.</div>
      ) : (
        <>
        <div className="relative w-full" style={{ height: mapHeight }}>
          <MapContainer
            center={[-22.84, -47.15]}
            zoom={10}
            maxZoom={22}
            style={{ height: "100%", width: "100%" }}
            className="z-0"
          >
            <TileLayer
              key={currentLayer.id}
              url={currentLayer.url}
              attribution={currentLayer.attribution}
              subdomains={currentLayer.subdomains}
              maxZoom={currentLayer.maxZoom || 22}
              maxNativeZoom={currentLayer.maxNativeZoom || 20}
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
              const rawIgn = p.attributes?.ignition ?? d.attributes?.ignition ?? p?.attributes?.acc;
              const normalizedIgn =
                rawIgn === true || rawIgn === "true" || rawIgn === 1
                  ? true
                  : rawIgn === false || rawIgn === "false" || rawIgn === 0
                  ? false
                  : null;
              const lastIgn = ignitionCache[d.id];
              const ignition = normalizedIgn !== null ? normalizedIgn : lastIgn;
              if (ignition !== undefined && ignition !== null) {
                ignitionDisplayRef.current[d.id] = ignition;
              }
            const anchor = anchorStates[d.id];
            const rawHeading =
              p.course ??
              p.attributes?.course ??
              p.attributes?.bearing ??
              p.attributes?.heading ??
              p.attributes?.direction ??
              p.direction ??
              p.heading ??
              d?.attributes?.heading ??
              d?.attributes?.direction ??
              null;
            const history = headingHistoryRef.current[d.id];
            const derivedHeading = history?.prev && history?.last
              ? bearingBetween(history.prev, history.last)
              : null;
            const heading = Number.isFinite(derivedHeading)
              ? derivedHeading
              : Number.isFinite(Number(rawHeading))
              ? Number(rawHeading)
              : 0;
            const type = (d.category || "").toLowerCase();
            const markerStatus = isOnline ? (speedVal > 1 ? "moving" : "online") : "offline";
            const addressDisplay =
              addressCacheRef.current[d.id] ||
              p.address ||
              p.attributes?.address ||
              p.attributes?.formattedAddress ||
              (p.latitude && p.longitude ? `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}` : "-");
            const driverLabel =
              d.driverName ||
              d.driverUniqueId ||
              p.attributes?.driverUniqueId ||
              p.attributes?.driverName ||
              "-";

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

            const cache = batteryCacheRef.current;
            const rawLevel = Number(
              d?.attributes?.batteryLevel ??
              p?.attributes?.batteryLevel ??
              p?.batteryLevel
            );
            const rawVoltage = Number(
              d?.attributes?.battery ??
              d?.attributes?.batteryLevelVolts ??
              p?.attributes?.battery ??
              p?.attributes?.batteryLevelVolts ??
              p?.batteryLevelVolts ??
              p?.battery
            );
            const previous = cache[d.id] || {};
            const hasLevel = Number.isFinite(rawLevel);
            const hasVolt = Number.isFinite(rawVoltage);
            const batteryLevel = hasLevel ? rawLevel : previous.level;
            const batteryVoltage = hasVolt ? rawVoltage : previous.voltage;
            if (hasLevel || hasVolt) {
              cache[d.id] = {
                level: batteryLevel,
                voltage: batteryVoltage,
              };
            }
            if (batteryLevel !== undefined || batteryVoltage !== undefined) {
              batteryDisplayRef.current[d.id] = {
                level: batteryLevel,
                voltage: batteryVoltage,
              };
            }

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
                device={d}
              onClick={() => onSelectDevice && onSelectDevice(d, p)}
              usePopup
            >
              <div className="relative overflow-hidden bg-slate-950 border border-slate-700/80 rounded-2xl shadow-[0_12px_26px_rgba(0,0,0,0.32)] p-2.5 min-w-[178px] text-slate-100 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{d.name || "Sem nome"}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-300">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] ${isOnline ? "border-emerald-500/60 text-emerald-200 bg-emerald-900/30" : "border-rose-500/60 text-rose-200 bg-rose-900/30"}`}>
                        <span className="h-2 w-2 rounded-full bg-current" />
                        {isOnline ? "Online" : "Offline"}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-slate-700 bg-slate-900/60 text-slate-200">
                        <BatteryIcon size={12} />
                        {Number.isFinite(batteryLevel) || Number.isFinite(batteryDisplayRef.current[d.id]?.level)
                          ? `${Math.round(Number.isFinite(batteryLevel) ? batteryLevel : batteryDisplayRef.current[d.id].level)}%`
                          : "--"}
                        {Number.isFinite(batteryVoltage) || Number.isFinite(batteryDisplayRef.current[d.id]?.voltage)
                          ? ` • ${(Number.isFinite(batteryVoltage) ? batteryVoltage : batteryDisplayRef.current[d.id].voltage).toFixed(1)}V`
                          : ""}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-sky-500/50 bg-sky-900/30 text-sky-100">
                        <Zap size={12} />
                        {formatSpeed(p.speed)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-[11px]">
                  <div className="flex items-center gap-2 text-slate-200">
                    <MapPinIcon size={13} className="text-sky-300 shrink-0" />
                    <span className="truncate">{addressDisplay}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-200">
                    <User2 size={13} className="text-emerald-300 shrink-0" />
                    <span className="truncate">{driverLabel || "-"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Clock3 size={13} className="text-slate-300 shrink-0" />
                    <span>{p.deviceTime ? new Date(p.deviceTime).toLocaleString() : "-"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-1.5">
                  <span
                    title={
                      ignition === true
                        ? "Ignição ligada"
                        : ignition === false
                        ? "Ignição desligada"
                        : "Ignição desconhecida"
                    }
                    className={`h-9 w-full text-lg rounded-xl border flex items-center justify-center shadow-inner ${
                      (ignition ?? ignitionDisplayRef.current[d.id]) === true
                        ? "text-emerald-300 border-emerald-500/60 bg-emerald-900/30"
                        : (ignition ?? ignitionDisplayRef.current[d.id]) === false
                        ? "text-rose-300 border-rose-500/60 bg-rose-900/30"
                        : "text-slate-300 border-slate-600 bg-slate-800/60"
                    }`}
                  >
                    <Zap size={16} />
                  </span>
                  <button
                    title={anchor?.active ? "Desativar âncora" : "Ativar âncora"}
                    onClick={() => {
                      if (anchor?.active) {
                        setAnchorStates((prev) => {
                          const next = { ...prev };
                          delete next[d.id];
                          return next;
                        });
                      } else {
                        setAnchorModal({ open: true, device: d, position: p });
                      }
                    }}
                    className={`h-9 w-full rounded-xl border flex items-center justify-center transition ${
                      anchor?.active
                        ? "border-sky-500 text-sky-200 bg-sky-900/30 hover:bg-sky-900/50"
                        : "border-slate-600 text-slate-200 bg-slate-800/70 hover:bg-slate-800"
                    }`}
                  >
                    <AnchorIcon size={16} />
                  </button>
                  <button
                    title="Bloquear"
                    onClick={handleBlock}
                    disabled={actionLoading === d.id}
                    className="h-9 w-full rounded-xl border border-rose-500 text-rose-200 bg-rose-900/30 hover:bg-rose-900/50 disabled:opacity-50 flex items-center justify-center transition"
                  >
                    <Lock size={16} />
                  </button>
                  <button
                    title="Desbloquear"
                    onClick={handleUnblock}
                    disabled={actionLoading === d.id}
                    className="h-9 w-full rounded-xl border border-emerald-500 text-emerald-200 bg-emerald-900/30 hover:bg-emerald-900/50 disabled:opacity-50 flex items-center justify-center transition"
                  >
                    <Unlock size={16} />
                  </button>
                  <button
                    title="Ver foto da rua"
                    onClick={(e) => {
                      e.stopPropagation();
                      openStreetViewInside(p.latitude, p.longitude);
                    }}
                    className="h-9 w-full rounded-xl border border-sky-500 text-sky-200 bg-sky-900/30 hover:bg-sky-900/50 flex items-center justify-center transition"
                  >
                    <Globe2 size={16} />
                  </button>
                </div>
              </div>
            </RealisticVehicleMarker>
          );
        })}
        </MapContainer>

        <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-1 pointer-events-none">
          {statusCards.map((card) => (
            <div
              key={card.label}
              className={`pointer-events-auto relative overflow-hidden rounded-2xl border border-slate-700/70 bg-gradient-to-br ${card.accent} backdrop-blur-md shadow-[0_6px_14px_rgba(0,0,0,0.22)] px-1.5 py-1 w-[78px] transition transform hover:translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[0_10px_18px_rgba(56,189,248,0.12)]`}
              title={card.label}
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-white/4 to-transparent pointer-events-none" />
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-slate-800/70 border border-slate-600/70 grid place-items-center text-slate-100 shadow-inner text-[10px]">
                  {card.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white leading-tight text-right">{card.value}</div>
                </div>
                <span className={`h-2.5 w-2.5 rounded-full ${card.dot} shadow-[0_0_8px_rgba(255,255,255,0.28)]`} />
              </div>
            </div>
          ))}
        </div>
        <div className="absolute top-4 right-4 z-[1000] pointer-events-none">
          <div className="pointer-events-auto relative overflow-hidden rounded-2xl border border-slate-700/70 bg-gradient-to-br from-slate-900/85 via-slate-900/70 to-slate-800/70 backdrop-blur-md shadow-[0_10px_24px_rgba(0,0,0,0.26)] px-2 py-1.5 w-[120px]">
            <div className="absolute inset-0 bg-gradient-to-tr from-white/4 to-transparent pointer-events-none" />
            <div className="flex items-center gap-2 text-slate-100 mb-1">
              <span className="h-5 w-5 rounded-lg bg-slate-800/80 border border-slate-700/80 grid place-items-center shadow-inner text-[10px]">
                <Layers size={12} />
              </span>
              <div className="leading-none min-w-0">
                <div className="text-[8px] uppercase tracking-wide text-slate-300">Mapa base</div>
                <div className="text-[10px] font-semibold text-white truncate max-w-[90px]">
                  {currentLayer?.name || "Mapa"}
                </div>
              </div>
            </div>
            <select
              value={baseMap}
              onChange={(e) => setBaseMap(e.target.value)}
              className="w-full border border-slate-700/70 rounded-lg px-2 py-1.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-sky-400 bg-slate-900/80 text-slate-100 shadow-inner"
            >
              {baseLayers.map((layer) => (
                <option key={layer.id} value={layer.id}>
                  {layer.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {streetViewUrl && (
        <div className="fixed bottom-4 right-4 z-[99999] w-[380px] h-[250px]">
          <div className="relative w-full h-full bg-slate-900 border border-slate-700 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.55)] overflow-hidden">
            <button
              onClick={closeStreetView}
              className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-slate-800 text-slate-200 text-sm font-bold border border-slate-600 hover:bg-slate-700"
            >
              ×
            </button>
            <iframe
              title="Street View"
              src={streetViewUrl}
              width="100%"
              height="100%"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      )}

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
        </>
      )}
    </div>
  );
}
