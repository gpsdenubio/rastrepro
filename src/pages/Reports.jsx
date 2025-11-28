// src/pages/Reports.jsx
import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { getDevices, runReport } from "../services/traccar";

// Corrige assets padrão do Leaflet (necessário em bundlers)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const reportCards = [
  { value: "route", label: "Percurso", desc: "Rastreamento detalhado" },
  { value: "stops", label: "Paradas", desc: "Intervalos e duração" },
  { value: "trips", label: "Viagens", desc: "Início/Fim com distâncias" },
  { value: "events", label: "Eventos", desc: "Ign, cerca, alarme" },
  { value: "resumo", label: "Resumo", desc: "Totais e estatísticas" },
];

const toDateTimeLocal = (date) => date.toISOString().slice(0, 16);
const addHours = (date, h) => {
  const d = new Date(date);
  d.setHours(d.getHours() + h);
  return d;
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
};

const formatDuration = (value) => {
  if (value == null) return "-";
  const ms = value > 1e6 ? value : value * 1000;
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${m}m ${s}s`;
};

const formatDistance = (value) => {
  if (value == null) return "-";
  const meters = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(meters)) return "-";
  return `${(meters / 1000).toFixed(1)} km`;
};

const formatDurationMs = (ms) => {
  if (!ms || Number.isNaN(ms)) return "-";
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${m}m ${s}s`;
};

// Limpa paradas: velocidade zero, mínima 5 min, ignora intervalos muito longos (>2h)
const cleanStopsReport = (list = []) => {
  const MIN_MS = 5 * 60 * 1000;
  const MAX_MS = 2 * 60 * 60 * 1000;
  const sorted = [...list].sort((a, b) => {
    const ta = new Date(a.startTime || a.deviceTime || a.time).getTime();
    const tb = new Date(b.startTime || b.deviceTime || b.time).getTime();
    return ta - tb;
  });
  return sorted
    .map((item) => {
      const start = new Date(item.startTime || item.deviceTime || item.time);
      const end = new Date(item.endTime || item.serverTime || item.deviceTime || item.time);
      const durationMs = end - start;
      return { ...item, durationMs };
    })
    .filter((item) => {
      const speedZero = (Number(item.speed) || 0) === 0 && (Number(item.averageSpeed) || 0) === 0;
      if (!speedZero) return false;
      if (item.durationMs < MIN_MS) return false;
      if (item.durationMs > MAX_MS) return false; // ignora buracos de sinal muito longos
      return true;
    });
};

// Limpa viagens (trips): ignora buracos >2h, dupes sem deslocamento, duração real
const cleanTripsReport = (list = []) => {
  const MAX_GAP_MS = 2 * 60 * 60 * 1000;
  return list
    .map((item) => {
      const start = new Date(item.startTime || item.deviceTime || item.time);
      const end = new Date(item.endTime || item.serverTime || item.deviceTime || item.time);
      const durationMs = end - start;
      return { ...item, durationMs };
    })
    .filter((item, idx, arr) => {
      if (item.durationMs <= 0) return false;
      // ignora buracos muito longos sem pacotes
      if (item.durationMs > MAX_GAP_MS) return false;
      const prev = arr[idx - 1];
      const samePath =
        prev &&
        prev.startLat === item.startLat &&
        prev.startLon === item.startLon &&
        prev.endLat === item.endLat &&
        prev.endLon === item.endLon &&
        (Number(item.distance) || 0) === 0;
      if (samePath) return false;
      return true;
    });
};

// Remove pontos consecutivos repetidos (mesma lat/lon e velocidade 0)
const cleanRoutePositions = (list = []) => {
  const cleaned = [];
  list.forEach((item) => {
    const last = cleaned[cleaned.length - 1];
    const sameCoord =
      last &&
      last.latitude === item.latitude &&
      last.longitude === item.longitude &&
      (Number(item.speed) || 0) === 0 &&
      (Number(last.speed) || 0) === 0;
    if (sameCoord) return;
    cleaned.push(item);
  });
  return cleaned;
};

// Agrupa paradas longas consecutivas no mesmo ponto
const groupStops = (list = []) => {
  const grouped = [];
  let buffer = [];

  const flushBuffer = () => {
    if (buffer.length === 0) return;
    if (buffer.length === 1 || (Number(buffer[0].speed) || 0) !== 0) {
      grouped.push(buffer[0]);
      buffer = [];
      return;
    }
    const first = buffer[0];
    const last = buffer[buffer.length - 1];
    grouped.push({
      ...first,
      startTime: first.serverTime || first.deviceTime || first.time,
      endTime: last.serverTime || last.deviceTime || last.time,
      durationMs:
        new Date(last.serverTime || last.deviceTime || last.time).getTime() -
        new Date(first.serverTime || first.deviceTime || first.time).getTime(),
      speed: 0,
      event: "Parado",
      groupedStop: true,
    });
    buffer = [];
  };

  list.forEach((item) => {
    const speedZero = (Number(item.speed) || 0) === 0;
    if (speedZero) {
      if (
        buffer.length === 0 ||
        (buffer[0].latitude === item.latitude && buffer[0].longitude === item.longitude)
      ) {
        buffer.push(item);
        return;
      }
    }
    flushBuffer();
    buffer.push(item);
    if (!speedZero) {
      flushBuffer();
    }
  });
  flushBuffer();
  return grouped;
};

const formatCoords = (lat, lon) => {
  if (lat == null || lon == null) return "-";
  return `${Number(lat).toFixed(5)}, ${Number(lon).toFixed(5)}`;
};

export default function Reports() {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [activeTab, setActiveTab] = useState("route");
  const [fromDate, setFromDate] = useState(() => toDateTimeLocal(addHours(new Date(), -24)));
  const [toDate, setToDate] = useState(() => toDateTimeLocal(new Date()));
  const [baseMap, setBaseMap] = useState(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("reportsBaseMap") : null;
    return stored || "google-road";
  });

  const [dataByType, setDataByType] = useState({
    route: { rows: [], raw: [], mapPoints: [] },
    trips: { rows: [] },
    stops: { rows: [] },
    events: { rows: [] },
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [generatedTypes, setGeneratedTypes] = useState({});

  useEffect(() => {
    const loadDevices = async () => {
      try {
        const list = await getDevices();
        setDevices(list || []);
      } catch (err) {
        setError("Não foi possível carregar dispositivos");
      }
    };
    loadDevices();
  }, []);

  const toIso = (val) => new Date(val).toISOString();
  const setRange = (range) => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const setLocal = (d) => toDateTimeLocal(d);

    switch (range) {
      case "today":
        setFromDate(setLocal(startOfToday));
        setToDate(setLocal(now));
        break;
      case "yesterday": {
        const start = new Date(startOfToday);
        start.setDate(start.getDate() - 1);
        const end = new Date(start);
        end.setHours(23, 59, 59, 999);
        setFromDate(setLocal(start));
        setToDate(setLocal(end));
        break;
      }
      case "3d": {
        const start = new Date(now);
        start.setDate(start.getDate() - 3);
        setFromDate(setLocal(start));
        setToDate(setLocal(now));
        break;
      }
      case "4d": {
        const start = new Date(now);
        start.setDate(start.getDate() - 4);
        setFromDate(setLocal(start));
        setToDate(setLocal(now));
        break;
      }
      default:
        break;
    }
  };

const normalizeRows = (type, data) => {
  if (!Array.isArray(data)) return [];
  switch (type) {
    case "route":
      return data.map((item, idx) => ({
        id: item.id || idx,
        time: formatDateTime(item.startTime || item.serverTime || item.deviceTime || item.fixTime || item.time),
        address: item.address || formatCoords(item.latitude, item.longitude),
        speed: item.groupedStop ? "-" : item.speed != null ? `${item.speed} km/h` : "-",
        distance: item.groupedStop
          ? "-"
          : formatDistance(item.attributes?.distance ?? item.distance ?? item.attributes?.totalDistance),
        duration: item.groupedStop ? formatDurationMs(item.durationMs) : "-",
        event: item.groupedStop ? "Parado" : "-",
        lat: item.latitude,
        lon: item.longitude,
      }));
      case "trips":
        return data.map((item, idx) => ({
          id: item.id || idx,
          time: formatDateTime(item.startTime),
          address: `${item.startAddress || formatCoords(item.startLat, item.startLon)} → ${
            item.endAddress || formatCoords(item.endLat, item.endLon)
          }`,
          speed: item.maxSpeed != null ? `${item.maxSpeed} km/h` : "-",
          distance: formatDistance(item.distance),
          duration: formatDurationMs(item.durationMs ?? item.duration * 1000),
          event: "-",
        }));
      case "stops":
        return data.map((item, idx) => ({
          id: item.id || idx,
          time: formatDateTime(item.startTime),
          address: item.address || formatCoords(item.latitude, item.longitude),
          speed: "-",
          distance: "-",
          duration: formatDurationMs(item.durationMs ?? item.duration * 1000),
          event: "-",
        }));
      case "events":
        return data.map((item, idx) => ({
          id: item.id || idx,
          time: formatDateTime(item.serverTime || item.deviceTime),
          address: item.address || formatCoords(item.latitude, item.longitude),
          speed: item.speed != null ? `${item.speed} km/h` : "-",
          distance: "-",
          duration: "-",
          event: item.type || "-",
        }));
      default:
        return [];
    }
  };

  const handleGenerate = async (type) => {
    if (type === "resumo") return;
    setError("");
    setLoading(true);
    try {
      const deviceId = Number(selectedDevice);
      if (!deviceId) throw new Error("Selecione um dispositivo.");
      const from = toIso(fromDate);
      const to = toIso(toDate);
      const data = await runReport(type, deviceId, from, to);
      const cleaned =
        type === "route"
          ? groupStops(cleanRoutePositions(data))
          : type === "stops"
          ? cleanStopsReport(data)
          : type === "trips"
          ? cleanTripsReport(data)
          : data;
      const normalized = normalizeRows(type, cleaned);

      setDataByType((prev) => ({
        ...prev,
        [type]: {
          rows: normalized,
          raw: type === "route" ? cleaned : prev[type]?.raw,
          mapPoints:
            type === "route"
              ? normalized
                  .filter((r) => r.lat != null && r.lon != null && !Number.isNaN(r.lat) && !Number.isNaN(r.lon))
                  .map((r) => [r.lat, r.lon])
              : prev[type]?.mapPoints,
        },
      }));

      setGeneratedTypes((prev) => ({ ...prev, [type]: true }));
    } catch (err) {
      const msg = err?.message || "Erro ao gerar relatório";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "resumo" && selectedDevice) {
      handleGenerate(activeTab);
    }
  }, [activeTab, selectedDevice, fromDate, toDate]);

  const selectedDeviceName = useMemo(() => {
    const found = devices.find((d) => d.id === Number(selectedDevice));
    return found?.name || found?.uniqueId || "Dispositivo";
  }, [devices, selectedDevice]);

  const baseLayers = useMemo(
    () => [
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
    ],
    []
  );

  const currentLayer = baseLayers.find((l) => l.id === baseMap) || baseLayers[0];

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("reportsBaseMap", baseMap);
    }
  }, [baseMap]);

  const routeStats = useMemo(() => {
    const routeRaw = dataByType?.route?.raw || [];
    if (!routeRaw.length) return null;

    const sorted = [...routeRaw].sort((a, b) => {
      const ta = new Date(a.serverTime || a.deviceTime || a.fixTime || a.time).getTime();
      const tb = new Date(b.serverTime || b.deviceTime || b.fixTime || b.time).getTime();
      return ta - tb;
    });

    const getDistVal = (item) => {
      const val = item?.attributes?.distance ?? item?.distance ?? item?.attributes?.totalDistance;
      const num = Number(val);
      return Number.isNaN(num) ? null : num;
    };

    const haversine = (lat1, lon1, lat2, lon2) => {
      const toRad = (v) => (v * Math.PI) / 180;
      const R = 6371e3;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    let totalDistMeters = 0;
    let maxSpeed = 0;
    let stoppedMs = 0;

    for (let i = 0; i < sorted.length; i++) {
      const curr = sorted[i];
      const next = sorted[i + 1];
      const distVal = getDistVal(curr);
      if (distVal != null) {
        totalDistMeters += distVal;
      } else if (
        curr?.latitude != null && curr?.longitude != null &&
        next?.latitude != null && next?.longitude != null
      ) {
        totalDistMeters += haversine(curr.latitude, curr.longitude, next.latitude, next.longitude);
      }

      const speedVal = Number(curr?.speed);
      if (!Number.isNaN(speedVal)) {
        maxSpeed = Math.max(maxSpeed, speedVal);
      }

      if (speedVal === 0 && next) {
        const t1 = new Date(curr.serverTime || curr.deviceTime || curr.fixTime || curr.time).getTime();
        const t2 = new Date(next.serverTime || next.deviceTime || next.fixTime || next.time).getTime();
        if (!Number.isNaN(t1) && !Number.isNaN(t2) && t2 > t1) {
          stoppedMs += (t2 - t1);
        }
      }
    }

    const firstTime = new Date(sorted[0].serverTime || sorted[0].deviceTime || sorted[0].fixTime || sorted[0].time).getTime();
    const lastTime = new Date(sorted[sorted.length - 1].serverTime || sorted[sorted.length - 1].deviceTime || sorted[sorted.length - 1].fixTime || sorted[sorted.length - 1].time).getTime();
    const totalTimeMs = (!Number.isNaN(firstTime) && !Number.isNaN(lastTime) && lastTime > firstTime) ? (lastTime - firstTime) : 0;

    const totalDistKm = totalDistMeters / 1000;
    const totalTimeHours = totalTimeMs / (1000 * 60 * 60);
    const avgSpeed = totalTimeHours > 0 ? (totalDistKm / totalTimeHours) : 0;

    const formatHm = (ms) => {
      const totalMinutes = Math.floor(ms / 60000);
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      if (h <= 0) return `${m} min`;
      return `${h}h ${m}min`;
    };

    return {
      totalDistanceKm: totalDistKm.toFixed(1),
      totalTime: formatHm(totalTimeMs),
      maxSpeed: `${Math.round(maxSpeed)} km/h`,
      avgSpeed: `${avgSpeed.toFixed(1)} km/h`,
      stopped: formatHm(stoppedMs),
    };
  }, [dataByType]);

  const currentRows = dataByType[activeTab]?.rows || [];
  const mapPoints = dataByType.route?.mapPoints || [];
  const currentReportLabel = reportCards.find((t) => t.value === activeTab)?.label || "Relatório";

  return (
    <div className="p-4 md:p-6 space-y-4 bg-slate-950 text-slate-100">
      <div className="bg-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.35)] rounded-2xl p-4 border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Relatórios</h1>
            <p className="text-sm text-slate-400">Selecione o tipo, veículo e período para gerar.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleGenerate(activeTab)}
              disabled={loading}
              className="bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-900 px-4 py-2 h-[46px] rounded-[10px] shadow-[0_0_16px_rgba(14,165,233,0.45)] transition font-semibold"
            >
              {loading ? "Gerando..." : "Gerar relatório"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex flex-col text-sm">
            Veículo
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="mt-1 border border-slate-700 bg-slate-800 text-slate-100 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
              required
            >
              <option value="">Selecione</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name || d.uniqueId || `ID ${d.id}`}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm">
            Data inicial
            <input
              type="datetime-local"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="mt-1 border border-slate-700 bg-slate-800 text-slate-100 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
              required
            />
          </label>
          <label className="flex flex-col text-sm">
            Data final
            <input
              type="datetime-local"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="mt-1 border border-slate-700 bg-slate-800 text-slate-100 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
              required
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-slate-400">
          <span className="font-semibold">Intervalo rápido:</span>
          <button
            onClick={() => setRange("today")}
            className="px-3 py-1 rounded-[10px] border border-slate-700 bg-slate-800 text-slate-100 hover:border-sky-500/60 hover:shadow-[0_0_12px_rgba(14,165,233,0.35)]"
          >
            Hoje
          </button>
          <button
            onClick={() => setRange("yesterday")}
            className="px-3 py-1 rounded-[10px] border border-slate-700 bg-slate-800 text-slate-100 hover:border-sky-500/60 hover:shadow-[0_0_12px_rgba(14,165,233,0.35)]"
          >
            Ontem
          </button>
          <button
            onClick={() => setRange("3d")}
            className="px-3 py-1 rounded-[10px] border border-slate-700 bg-slate-800 text-slate-100 hover:border-sky-500/60 hover:shadow-[0_0_12px_rgba(14,165,233,0.35)]"
          >
            Últimos 3 dias
          </button>
          <button
            onClick={() => setRange("4d")}
            className="px-3 py-1 rounded-[10px] border border-slate-700 bg-slate-800 text-slate-100 hover:border-sky-500/60 hover:shadow-[0_0_12px_rgba(14,165,233,0.35)]"
          >
            Últimos 4 dias
          </button>
        </div>

        {error && <div className="text-red-400 text-sm">{error}</div>}
      </div>

      <div className="bg-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.35)] rounded-2xl p-3 border border-slate-800">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {reportCards.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`text-left px-4 py-3 rounded-2xl border transition shadow-sm ${
                activeTab === tab.value
                  ? "border-sky-500 bg-slate-800 text-sky-200 shadow-[0_0_16px_rgba(14,165,233,0.35)]"
                  : "bg-slate-900 text-slate-200 border-slate-800 hover:border-sky-500/60"
              }`}
            >
              <div className="text-sm font-semibold">{tab.label}</div>
              <div className="text-[12px] text-slate-400">{tab.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {activeTab === "route" && mapPoints.length > 0 && (
        <div className="bg-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.35)] rounded-2xl p-4 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Mapa - {selectedDeviceName}</h2>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Base:</span>
              <select
                value={baseMap}
                onChange={(e) => setBaseMap(e.target.value)}
                className="border border-slate-700 bg-slate-800 text-slate-100 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/60"
              >
                {baseLayers.map((layer) => (
                  <option key={layer.id} value={layer.id}>
                    {layer.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="h-96 rounded-lg overflow-hidden border border-slate-800">
            <MapContainer center={mapPoints[0]} zoom={13} style={{ height: "100%", width: "100%" }}>
              <TileLayer
                key={currentLayer.id}
                url={currentLayer.url}
                attribution={currentLayer.attribution}
                subdomains={currentLayer.subdomains}
              />
              <Polyline positions={mapPoints} color="blue" weight={4} />
              <Marker position={mapPoints[0]}>
                <Popup>Início</Popup>
              </Marker>
              <Marker position={mapPoints[mapPoints.length - 1]} icon={L.icon({
                iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
                shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
                className: "end-marker",
              })}>
                <Popup>Fim</Popup>
              </Marker>
            </MapContainer>
          </div>
        </div>
      )}

      {activeTab === "resumo" && routeStats && (
        <div className="bg-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.35)] rounded-2xl p-4 border border-slate-800">
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Resumo da Viagem</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-sm text-slate-200">
            <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
              <div className="text-xs text-slate-400">Distância total</div>
              <div className="text-lg font-semibold">{routeStats.totalDistanceKm} km</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
              <div className="text-xs text-slate-400">Tempo total</div>
              <div className="text-lg font-semibold">{routeStats.totalTime}</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
              <div className="text-xs text-slate-400">Velocidade máxima</div>
              <div className="text-lg font-semibold">{routeStats.maxSpeed}</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
              <div className="text-xs text-slate-400">Velocidade média</div>
              <div className="text-lg font-semibold">{routeStats.avgSpeed}</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
              <div className="text-xs text-slate-400">Tempo parado</div>
              <div className="text-lg font-semibold">{routeStats.stopped}</div>
            </div>
          </div>
        </div>
      )}

      {(activeTab === "route" || activeTab === "trips" || activeTab === "stops" || activeTab === "events") && (
        <div className="bg-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.35)] rounded-2xl p-4 border border-slate-800">
          <h2 className="text-lg font-semibold text-slate-100 mb-2">
            {currentReportLabel}
          </h2>

          {!loading && generatedTypes[activeTab] && currentRows.length === 0 && (
            <div className="text-slate-400 text-sm">Nenhum registro no período selecionado.</div>
          )}

          <div className="overflow-auto max-h-[70vh]">
            <table className="min-w-full text-sm text-slate-200">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-800">
                  <th className="py-2 pr-4">Horário</th>
                  <th className="py-2 pr-4">Endereço / Coordenadas</th>
                  <th className="py-2 pr-4">Velocidade</th>
                  <th className="py-2 pr-4">Distância</th>
                  <th className="py-2 pr-4">Duração</th>
                  <th className="py-2 pr-4">Evento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {currentRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-800 last:border-0">
                    <td className="py-2 pr-4 whitespace-nowrap">{row.time}</td>
                    <td className="py-2 pr-4">{row.address}</td>
                    <td className="py-2 pr-4">{row.speed}</td>
                    <td className="py-2 pr-4">{row.distance}</td>
                    <td className="py-2 pr-4">{row.duration}</td>
                    <td className="py-2 pr-4">{row.event}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
