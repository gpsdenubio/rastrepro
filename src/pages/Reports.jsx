// src/pages/Reports.jsx
import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Polyline, Popup, Marker, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { getDevices, runReport, getAddressFromTraccar } from "../services/traccar";
import RealisticVehicleMarker from "../components/RealisticVehicleMarker";
import { useAuth } from "../context/AuthContext";

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

const toDateTimeLocal = (date) => {
  if (!(date instanceof Date)) return "";
  const tzOffsetMs = date.getTimezoneOffset() * 60000;
  const local = new Date(date.getTime() - tzOffsetMs);
  return local.toISOString().slice(0, 16);
};
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

const formatRawTime = (value) => {
  if (!value) return "-";
  const buildDate = (val) => {
    if (val instanceof Date) return val;
    const str = String(val);
    // Lida com formatos "YYYY-MM-DD HH:mm:ss" convertendo para ISO parseável
    if (str.includes(" ") && !str.includes("T")) {
      return new Date(str.replace(" ", "T"));
    }
    return new Date(str);
  };
  const d = buildDate(value);
  if (Number.isNaN(d.getTime())) return "-";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}, ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
};

const getEventTime = (item) => {
  const candidate =
    item?.eventTime ||
    item?.deviceTime ||
    item?.serverTime ||
    item?.position?.deviceTime ||
    item?.position?.fixTime ||
    item?.position?.serverTime;
  return formatRawTime(candidate);
};

const formatDistance = (value) => {
  if (value == null) return "-";
  const meters = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(meters)) return "-";
  return `${(meters / 1000).toFixed(2)} km`;
};

const speedToKmh = (value) => {
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  // Traccar envia velocidade em nós; convertemos para km/h como no painel
  return num * 1.852;
};

const formatSpeed = (value) => {
  const kmh = speedToKmh(value);
  if (kmh == null) return "-";
  return `${kmh.toFixed(1)} km/h`;
};

const formatDurationMs = (ms) => {
  if (ms == null || Number.isNaN(ms)) return "-";
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${m}m ${s}s`;
};

const haversineMeters = (lat1, lon1, lat2, lon2) => {
  if (
    lat1 == null || lon1 == null || lat2 == null || lon2 == null ||
    Number.isNaN(lat1) || Number.isNaN(lon1) || Number.isNaN(lat2) || Number.isNaN(lon2)
  ) {
    return null;
  }
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

const parseTimeMs = (value) => {
  if (!value) return null;
  const d = new Date(value);
  const t = d.getTime();
  return Number.isNaN(t) ? null : t;
};

const normalizeDurationVal = (val) => {
  if (val == null) return null;
  const num = Number(val);
  if (Number.isNaN(num)) return null;
  // se já veio em ms (valores grandes), mantém; senão, converte de segundos
  return num > 1e8 ? num : num * 1000;
};

const enrichTripAddresses = async (trips = []) => {
  const resolved = await Promise.all(
    trips.map(async (t) => {
      const startAddress =
        t.startAddress ||
        (t.startLat != null && t.startLon != null
          ? await getAddressFromTraccar(t.startLat, t.startLon)
          : "");
      const endAddress =
        t.endAddress ||
        (t.endLat != null && t.endLon != null ? await getAddressFromTraccar(t.endLat, t.endLon) : "");
      return { ...t, startAddress: startAddress || t.startAddress, endAddress: endAddress || t.endAddress };
    })
  );
  return resolved;
};

const enrichStopAddresses = async (stops = []) => {
  const shouldGeocode = (addr = "") => {
    if (!addr) return true;
    const trimmed = String(addr).trim();
    // Se parece com coordenadas (ex.: "-22.83, -47.15"), força geocodificar para nome de rua
    return /^-?\d+(\.\d+)?\s*[,; ]\s*-?\d+(\.\d+)?$/.test(trimmed);
  };

  const resolved = await Promise.all(
    stops.map(async (s) => {
      if (!shouldGeocode(s?.address)) return s;
      const lat = s.latitude ?? s.lat;
      const lon = s.longitude ?? s.lon;
      if (lat == null || lon == null) return s;
      const addr = await getAddressFromTraccar(lat, lon);
      return { ...s, address: addr || s.address };
    })
  );
  return resolved;
};

const toMsFromSecondsMaybe = (value) => {
  if (value == null) return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  // Heurística: valores pequenos são segundos; valores grandes já vêm em ms
  return num < 1e6 ? num * 1000 : num;
};

const extractTripPoints = (trip) => {
  if (Array.isArray(trip?.positions) && trip.positions.length) return trip.positions;
  if (Array.isArray(trip?.route) && trip.route.length) return trip.route;
  return [];
};

const resolveEngineHoursRange = (item) => {
  const total = toMsFromSecondsMaybe(item.engineHours ?? item.totalEngineHours);
  const start = toMsFromSecondsMaybe(item.startEngineHours ?? item.engineHoursStart);
  const end = toMsFromSecondsMaybe(item.endEngineHours ?? item.engineHoursEnd);

  if (start != null && end != null) return { start, end };
  if (start != null && total != null) return { start, end: start + total };
  if (end != null && total != null) return { start: Math.max(end - total, 0), end };
  return { start, end };
};

const computeTripMetrics = (trip) => {
  const points = extractTripPoints(trip);
  const seq = points.length ? points : [];

  let distanceMeters = 0;
  let maxSpeedKmh = 0;
  let startMs = parseTimeMs(trip.startTime);
  let endMs = parseTimeMs(trip.endTime);
  let startLat = trip.startLat;
  let startLon = trip.startLon;
  let endLat = trip.endLat;
  let endLon = trip.endLon;

  const toMs = (p) => parseTimeMs(p.deviceTime || p.serverTime || p.fixTime || p.time);
  const toSpeedKmh = (p) => {
    const s = Number(p.speed);
    if (Number.isNaN(s)) return null;
    return s * 1.852;
  };

  for (let i = 0; i < seq.length; i++) {
    const p = seq[i];
    const t = toMs(p);
    if (t != null) {
      if (startMs == null) startMs = t;
      endMs = t;
    }
    if (startLat == null && p.latitude != null) startLat = p.latitude;
    if (startLon == null && p.longitude != null) startLon = p.longitude;
    if (p.speed != null) {
      const kmh = toSpeedKmh(p);
      if (kmh != null) maxSpeedKmh = Math.max(maxSpeedKmh, kmh);
    }
    if (seq[i + 1]) {
      const n = seq[i + 1];
      const dist = haversineMeters(p.latitude, p.longitude, n.latitude, n.longitude);
      if (dist != null && dist >= 1) {
        distanceMeters += dist;
      }
    }
  }

  if (!distanceMeters) {
    const dist = haversineMeters(Number(trip.startLat), Number(trip.startLon), Number(trip.endLat), Number(trip.endLon));
    if (dist != null && !Number.isNaN(dist)) distanceMeters = dist;
  }

  const startOdo = Number(trip.startOdometer);
  const endOdo = Number(trip.endOdometer);
  const diffOdo = !Number.isNaN(startOdo) && !Number.isNaN(endOdo) ? endOdo - startOdo : null;
  if (diffOdo != null && diffOdo > 0 && diffOdo < 1e6) {
    distanceMeters = Math.max(distanceMeters, diffOdo);
  }

  const rawDist = Number(trip.distance);
  if (distanceMeters === 0 && rawDist && rawDist > 0) distanceMeters = rawDist;

  const durationMs =
    startMs != null && endMs != null && endMs > startMs
      ? endMs - startMs
      : normalizeDurationVal(trip.durationMs ?? trip.duration);

  const durationHours = durationMs ? durationMs / 3600000 : null;
  const avgKmh =
    distanceMeters > 100 && durationHours && durationHours > (60 / 3600)
      ? distanceMeters / 1000 / durationHours
      : null;
  const avgKnots = avgKmh != null ? avgKmh / 1.852 : null;
  const maxKnots = maxSpeedKmh ? maxSpeedKmh / 1.852 : trip.maxSpeed;

  const startIso = startMs != null ? new Date(startMs).toISOString() : trip.startTime;
  const endIso = endMs != null ? new Date(endMs).toISOString() : trip.endTime;

  return {
    ...trip,
    distance: distanceMeters,
    durationMs: durationMs ?? trip.durationMs,
    averageSpeed: avgKnots ?? trip.averageSpeed,
    maxSpeed: maxKnots ?? trip.maxSpeed,
    startTime: startIso,
    endTime: endIso,
    startLat,
    startLon,
    endLat,
    endLon,
  };
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

const formatCoords = (lat, lon) => {
  if (lat == null || lon == null) return "-";
  return `${Number(lat).toFixed(5)}, ${Number(lon).toFixed(5)}`;
};

const smoothPath = (points = [], segments = 8) => {
  if (!Array.isArray(points) || points.length < 3) {
    return points.map((p) =>
      Array.isArray(p) ? { lat: p[0], lon: p[1], speed: 0, time: null } : p
    );
  }

  const getLat = (p) => (Array.isArray(p) ? p[0] : p.lat);
  const getLon = (p) => (Array.isArray(p) ? p[1] : p.lon);
  const getSpeed = (p) => (Array.isArray(p) ? 0 : p.speed || 0);
  const getTimeMs = (p) => {
    if (Array.isArray(p)) return null;
    const t = p.time ? new Date(p.time).getTime() : null;
    return Number.isNaN(t) ? null : t;
  };

  const catmull = (p0, p1, p2, p3, t) => {
    const t2 = t * t;
    const t3 = t2 * t;
    const speedHold = getSpeed(p1); // mantém velocidade do ponto, sem diluir picos
    const tm1 = getTimeMs(p1);
    const tm2 = getTimeMs(p2);
    const timeLerp =
      tm1 != null && tm2 != null ? tm1 + (tm2 - tm1) * t : tm1 ?? tm2 ?? null;
    const x =
      0.5 *
      ((2 * getLon(p1)) +
        (-getLon(p0) + getLon(p2)) * t +
        (2 * getLon(p0) - 5 * getLon(p1) + 4 * getLon(p2) - getLon(p3)) * t2 +
        (-getLon(p0) + 3 * getLon(p1) - 3 * getLon(p2) + getLon(p3)) * t3);
    const y =
      0.5 *
      ((2 * getLat(p1)) +
        (-getLat(p0) + getLat(p2)) * t +
        (2 * getLat(p0) - 5 * getLat(p1) + 4 * getLat(p2) - getLat(p3)) * t2 +
        (-getLat(p0) + 3 * getLat(p1) - 3 * getLat(p2) + getLat(p3)) * t3);
    return {
      lat: y,
      lon: x,
      speed: speedHold,
      time: timeLerp ? new Date(timeLerp).toISOString() : null,
    };
  };

  const res = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    res.push({
      lat: getLat(p1),
      lon: getLon(p1),
      speed: getSpeed(p1),
      time: getTimeMs(p1) ? new Date(getTimeMs(p1)).toISOString() : null,
    });
    for (let tStep = 1; tStep < segments; tStep++) {
      const t = tStep / segments;
      res.push(catmull(p0, p1, p2, p3, t));
    }
  }
  const last = points[points.length - 1];
  res.push({
    lat: getLat(last),
    lon: getLon(last),
    speed: getSpeed(last),
    time: getTimeMs(last) ? new Date(getTimeMs(last)).toISOString() : null,
  });
  return res;
};

export default function Reports() {
  const { can } = useAuth();
  const canView = can("reports.view");
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
    resumo: { rows: [] },
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [generatedTypes, setGeneratedTypes] = useState({});

  useEffect(() => {
    if (!canView) return;
    const loadDevices = async () => {
      try {
        const list = await getDevices();
        setDevices(list || []);
      } catch (error) {
        console.warn("Não foi possível carregar dispositivos:", error);
        setError("Não foi possível carregar dispositivos");
      }
    };
    loadDevices();
  }, [canView]);

  const toIso = (val) => new Date(val).toISOString();
  const setRange = (range) => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfDay = (date) => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const setLocal = (d) => toDateTimeLocal(d);

    switch (range) {
      case "today":
        setFromDate(setLocal(startOfToday));
        setToDate(setLocal(now));
        break;
      case "yesterday": {
        const start = startOfDay(new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000));
        const end = new Date(start);
        end.setHours(23, 59, 0, 0);
        setFromDate(setLocal(start));
        setToDate(setLocal(end));
        break;
      }
      case "24h": {
        const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        setFromDate(setLocal(start));
        setToDate(setLocal(now));
        break;
      }
      case "3d": {
        const start = startOfDay(new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000));
        setFromDate(setLocal(start));
        setToDate(setLocal(now));
        break;
      }
      case "4d": {
        const start = startOfDay(new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000));
        setFromDate(setLocal(start));
        setToDate(setLocal(now));
        break;
      }
      case "7d": {
        const start = startOfDay(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
        setFromDate(setLocal(start));
        setToDate(setLocal(now));
        break;
      }
      default:
        break;
    }
  };

const eventTypeLabel = (raw) => {
  const val = String(raw || "").trim();
  const map = {
    ignitionOn: "Ignição ligada",
    ignitionOff: "Ignição desligada",
    deviceMoving: "Veículo em movimento",
    deviceStopped: "Dispositivo parado",
    deviceOnline: "Status online",
    deviceOffline: "Status offline",
    fenceEnter: "Entrou no polo",
    fenceExit: "Saiu do polo",
    overspeed: "Excesso de velocidade",
    alarm: "Alarme",
  };
  if (map[val]) return map[val];
  if (!val) return "-";
  return val;
};

const normalizeRows = (type, data) => {
  if (!Array.isArray(data)) return [];
  switch (type) {
    case "route":
      return data.map((item, idx) => ({
        id: item.id || idx,
        time: getEventTime(item),
        type: eventTypeLabel(
          item.event ||
            item.type ||
            item.attributes?.event ||
            item.attributes?.alarm
        ),
        lat: item.latitude ?? item.lat ?? item.position?.latitude,
        lon: item.longitude ?? item.lon ?? item.position?.longitude,
      }));
      case "trips":
        return data.map((item, idx) => {
          const durationMs = item.durationMs ?? normalizeDurationVal(item.duration);
          const startAddr =
            item.startAddress || formatCoords(item.startLat, item.startLon);
          const endAddr =
            item.endAddress || formatCoords(item.endLat, item.endLon);
          const baseDistance = Number(item.distance);
          const startOdo = Number(item.startOdometer);
          const endOdo = Number(item.endOdometer);
          const hasOdo = !Number.isNaN(startOdo) && !Number.isNaN(endOdo);
          const diffOdoVal = hasOdo ? endOdo - startOdo : null;
          const distanceMeters =
            diffOdoVal != null && diffOdoVal > 0 ? Math.max(baseDistance || 0, diffOdoVal) : baseDistance;
          const durationHours = durationMs ? durationMs / 3600000 : null;
          const computedAvg =
            distanceMeters && durationHours && durationHours > 0 ? distanceMeters / 1000 / durationHours : null;
          const avgRaw = item.averageSpeed ?? item.avgSpeed ?? item.average ?? item.speedAverage ?? computedAvg;
          const avgVal = avgRaw && !Number.isNaN(Number(avgRaw)) ? Number(avgRaw) : computedAvg;
          const maxRaw = item.maxSpeed;
          const maxVal =
            maxRaw && !Number.isNaN(Number(maxRaw)) && Number(maxRaw) > 0
              ? Number(maxRaw)
              : avgVal && avgVal > 0
              ? avgVal
              : null;
          const diffOdoDisplay = diffOdoVal;
          let odoOk = diffOdoDisplay != null && diffOdoDisplay >= 0;
          if (odoOk && distanceMeters > 0) {
            const ratio = diffOdoDisplay / distanceMeters;
            if (ratio < 0.5 || ratio > 2) {
              odoOk = false;
            }
          }
          const displayStartOdo = odoOk ? formatDistance(item.displayStartOdo ?? startOdo) : "—";
          const displayEndOdo = odoOk ? formatDistance(item.displayEndOdo ?? endOdo) : "—";
          return {
            id: item.id || idx,
            start: formatDateTime(item.startTime),
            end: formatDateTime(item.endTime),
            distance: formatDistance(distanceMeters),
            avgSpeed: formatSpeed(avgVal),
            startOdometer: displayStartOdo,
            startAddress: startAddr,
            endOdometer: displayEndOdo,
            endAddress: endAddr,
            maxSpeed: formatSpeed(maxVal),
            duration: durationMs != null ? formatDurationMs(durationMs) : "-",
            fuel:
              item.spentFuel != null && !Number.isNaN(Number(item.spentFuel))
                ? `${Number(item.spentFuel).toFixed(2)} L`
                : "-",
            driver: item.driverUniqueId || item.driverName || item.driver || "-",
          };
        });
      case "stops":
        return data.map((item, idx) => {
          const startMs = parseTimeMs(item.startTime || item.deviceTime || item.time);
          const endMs = parseTimeMs(item.endTime || item.serverTime || item.deviceTime || item.time);
          const durationMs =
            startMs != null && endMs != null && endMs >= startMs
              ? endMs - startMs
              : normalizeDurationVal(item.durationMs ?? item.duration);
          const rawAddress = item.address || formatCoords(item.latitude, item.longitude);
          const displayAddress = rawAddress || "-";

          return {
            id: item.id || idx,
            start: formatDateTime(item.startTime),
            end: formatDateTime(item.endTime),
            address: displayAddress,
            odometer: "—",
            duration: durationMs != null ? formatDurationMs(durationMs) : "-",
            engineHours:
              item.engineHours != null && !Number.isNaN(Number(item.engineHours))
                ? formatDurationMs(Number(item.engineHours))
                : "-",
            fuel:
              item.spentFuel != null && !Number.isNaN(Number(item.spentFuel))
                ? `${Number(item.spentFuel).toFixed(2)} L`
                : "-",
            driver: item.driverUniqueId || item.driverName || item.driver || "-",
            deviceName: item.deviceName || "Dispositivo",
          };
        });
      case "events":
        return data.map((item, idx) => ({
          id: item.id || idx,
          time: getEventTime(item),
          address: item.address || formatCoords(item.latitude, item.longitude),
          speed: item.speed != null ? `${item.speed} km/h` : "-",
          distance: "-",
          duration: "-",
          event: eventTypeLabel(
            item.event ||
              item.type ||
              item.attributes?.event ||
              item.attributes?.alarm
          ),
        }));
      case "resumo":
        return data.map((item, idx) => {
          const { start: ehStart, end: ehEnd } = resolveEngineHoursRange(item);
          return {
            id: item.id || idx,
            device: item.deviceName || item.device || "-",
            start: formatDateTime(item.startTime),
            end: formatDateTime(item.endTime),
            distance: formatDistance(item.distance),
            avgSpeed: formatSpeed(item.averageSpeed ?? item.avgSpeed ?? item.average ?? item.speedAverage),
            startOdometer: formatDistance(item.startOdometer),
            endOdometer: formatDistance(item.endOdometer),
            maxSpeed: formatSpeed(item.maxSpeed),
            duration: formatDurationMs(toMsFromSecondsMaybe(item.durationMs ?? item.duration)),
            startAddress: item.startAddress || "-",
            endAddress: item.endAddress || "-",
            engineHours: formatDurationMs(toMsFromSecondsMaybe(item.engineHours)),
            engineHoursStart: formatDurationMs(ehStart),
            engineHoursEnd: formatDurationMs(ehEnd),
            fuel:
              item.spentFuel != null && !Number.isNaN(Number(item.spentFuel))
                ? `${Number(item.spentFuel).toFixed(2)} L`
                : "-",
            driver: item.driverUniqueId || item.driverName || item.driver || "-",
          };
        });
      default:
        return [];
    }
  };

  const handleGenerate = async (type) => {
    setError("");
    setLoading(true);
    try {
      const deviceId = Number(selectedDevice);
      if (!deviceId) throw new Error("Selecione um dispositivo.");
      const deviceBaseOdo = Number(
        devices.find((d) => d.id === deviceId)?.attributes?.odometerBase
      ) || 0;
      const from = toIso(fromDate);
      const to = toIso(toDate);
      if (type === "route") {
        const [eventsData, routeData] = await Promise.all([
          runReport("events", deviceId, from, to),
          runReport("route", deviceId, from, to),
        ]);
        const eventsClean = Array.isArray(eventsData) ? eventsData.filter(Boolean) : [];
        const routeClean = cleanRoutePositions(Array.isArray(routeData) ? routeData : []);
        const normalized = normalizeRows("route", eventsClean);
        setDataByType((prev) => ({
          ...prev,
          route: {
            rows: normalized,
            raw: routeClean,
              mapPoints: smoothPath(
                routeClean
                  .filter((r) => r.latitude != null && r.longitude != null && !Number.isNaN(r.latitude) && !Number.isNaN(r.longitude))
                  .map((r) => ({
                    lat: r.latitude,
                  lon: r.longitude,
                  speed: (() => {
                    const speedKmhAttr = Number(r?.attributes?.speedKmh);
                    if (Number.isFinite(speedKmhAttr) && speedKmhAttr > 0) return speedKmhAttr;
                    const rawKnots = Number(
                      r.speed ??
                        r.attributes?.speed ??
                        r.position?.speed
                    );
                    if (!Number.isFinite(rawKnots) || rawKnots <= 0) return null;
                    // Traccar envia speed em nós quando não há speedKmh; converte apenas uma vez
                    return rawKnots * 1.852;
                  })(),
                  time: r.deviceTime || r.serverTime || r.fixTime || r.time,
                }))
            ),
          },
        }));
      } else {
        const data = await runReport(type, deviceId, from, to);
        let cleaned = Array.isArray(data) ? data : [];

        if (type === "trips") {
          cleaned = cleanTripsReport(cleaned);
          cleaned = cleaned.map(computeTripMetrics);
          cleaned = await enrichTripAddresses(cleaned);
          cleaned = cleaned.map((t) => {
            const startOdoRaw = Number(t.startOdometer);
            const endOdoRaw = Number(t.endOdometer);
            const hasStart = !Number.isNaN(startOdoRaw);
            const hasEnd = !Number.isNaN(endOdoRaw);
            const displayStartOdo =
              hasStart ? startOdoRaw + deviceBaseOdo : deviceBaseOdo || startOdoRaw;
            const displayEndOdo =
              hasEnd ? endOdoRaw + deviceBaseOdo : hasStart ? displayStartOdo : deviceBaseOdo || endOdoRaw;
            return {
              ...t,
              displayStartOdo,
              displayEndOdo,
            };
          });
        }

        if (type === "stops") {
          cleaned = await enrichStopAddresses(cleaned);
        }

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
      }

      setGeneratedTypes((prev) => ({ ...prev, [type]: true }));
    } catch (error) {
      const msg = error?.message || "Erro ao gerar relatório";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) return;
    if (selectedDevice) {
      handleGenerate(activeTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedDevice, fromDate, toDate, canView]);



  const selectedDeviceName = useMemo(() => {
    const found = devices.find((d) => d.id === Number(selectedDevice));
    return found?.name || found?.uniqueId || "Dispositivo";
  }, [devices, selectedDevice]);
  const selectedDeviceType = useMemo(() => {
    const found = devices.find((d) => d.id === Number(selectedDevice));
    return found?.category || found?.attributes?.vehicleType || found?.type || "car";
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
  const arrowIcon = useMemo(
    () =>
      L.divIcon({
        className: "",
        html:
          '<div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:12px solid #38bdf8;transform:rotate(0deg);"></div>',
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      }),
    []
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("reportsBaseMap", baseMap);
    }
  }, [baseMap]);

  const currentRows = dataByType[activeTab]?.rows || [];
  const mapPoints = dataByType.route?.mapPoints || [];
  const currentReportLabel = reportCards.find((t) => t.value === activeTab)?.label || "Relatório";
  const isResumo = activeTab === "resumo";
  const isTrips = activeTab === "trips";

  return (
    <div className="p-4 md:p-6 space-y-4 bg-slate-950 text-slate-100">
      {!canView ? (
        <>
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-sm text-red-300 mt-2">Você não tem permissão para acessar relatórios.</p>
        </>
      ) : (
        <>
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
                onClick={() => setRange("24h")}
                className="px-3 py-1 rounded-[10px] border border-slate-700 bg-slate-800 text-slate-100 hover:border-sky-500/60 hover:shadow-[0_0_12px_rgba(14,165,233,0.35)]"
              >
                Últimas 24h
              </button>
              <button
                onClick={() => setRange("3d")}
                className="px-3 py-1 rounded-[10px] border border-slate-700 bg-slate-800 text-slate-100 hover:border-sky-500/60 hover:shadow-[0_0_12px_rgba(14,165,233,0.35)]"
              >
                Últimos 3 dias
              </button>
              <button
                onClick={() => setRange("4d")}
                className="px-3 py-1 rounded-[10px] border border-slate-700 bg-slate-800 text-slate-100 hover-border-sky-500/60 hover:shadow-[0_0_12px_rgba(14,165,233,0.35)]"
              >
                Últimos 4 dias
              </button>
              <button
                onClick={() => setRange("7d")}
                className="px-3 py-1 rounded-[10px] border border-slate-700 bg-slate-800 text-slate-100 hover:border-sky-500/60 hover:shadow-[0_0_12px_rgba(14,165,233,0.35)]"
              >
                Últimos 7 dias
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
                <MapContainer
                  center={[mapPoints[0].lat, mapPoints[0].lon]}
                  zoom={13}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer
                    key={currentLayer.id}
                    url={currentLayer.url}
                    attribution={currentLayer.attribution}
                    subdomains={currentLayer.subdomains}
                  />
                  <Polyline
                    positions={mapPoints.map((p) => [p.lat, p.lon])}
                    color="#38bdf8"
                    weight={3}
                    opacity={0.9}
                    lineCap="round"
                  />
                  {mapPoints.map((p, idx) => (
                    <CircleMarker
                      key={`pt-${idx}`}
                      center={[p.lat, p.lon]}
                      radius={4}
                      weight={0}
                      fillColor="#38bdf8"
                      fillOpacity={0.4}
                    >
                      <Popup closeButton={false} className="!bg-transparent !border-none !shadow-none !p-0">
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "6px",
                            padding: "2px",
                          }}
                        >
                          {Number.isFinite(Number(p.speed)) && Number(p.speed) > 0 ? (
                            <div
                              style={{
                                minWidth: "30px",
                                height: "30px",
                                borderRadius: "10px",
                                background: "linear-gradient(145deg, rgba(11,17,32,0.95), rgba(15,23,42,0.9))",
                                color: "#e2e8f0",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "12px",
                                fontWeight: 800,
                                border: "1px solid rgba(56,189,248,0.48)",
                                boxShadow: "0 6px 16px rgba(0,0,0,0.3), 0 0 0 1px rgba(56,189,248,0.08)",
                                padding: "0 8px",
                                lineHeight: 1.1,
                                backdropFilter: "blur(6px)",
                              }}
                            >
                              <div style={{ textAlign: "center" }}>
                                <div style={{ fontFamily: "inherit" }}>{Math.round(Number(p.speed))}</div>
                                <div style={{ fontSize: "9px", fontWeight: 700, color: "#bae6fd", fontFamily: "inherit" }}>
                                  km/h
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div
                              style={{
                                minWidth: "26px",
                                height: "26px",
                                borderRadius: "9px",
                                background: "rgba(15,23,42,0.85)",
                                color: "#94a3b8",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "11px",
                                fontWeight: 600,
                                border: "1px solid rgba(148,163,184,0.35)",
                                boxShadow: "0 5px 12px rgba(0,0,0,0.25)",
                                padding: "0 6px",
                                backdropFilter: "blur(6px)",
                              }}
                            >
                              -
                            </div>
                          )}
                          {p.time ? (
                            <div
                              style={{
                                padding: "6px 10px",
                                borderRadius: "10px",
                                background: "linear-gradient(145deg, rgba(11,17,32,0.95), rgba(17,24,39,0.9))",
                                color: "#e2e8f0",
                                fontSize: "11px",
                                fontWeight: 700,
                                border: "1px solid rgba(148,163,184,0.4)",
                                boxShadow: "0 8px 14px rgba(0,0,0,0.26), 0 0 0 1px rgba(56,189,248,0.06)",
                                backdropFilter: "blur(6px)",
                              }}
                            >
                              {formatRawTime(p.time)}
                            </div>
                          ) : null}
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
                  <RealisticVehicleMarker
                    latitude={mapPoints[0].lat}
                    longitude={mapPoints[0].lon}
                    type={selectedDeviceType}
                    speed={0}
                    status="online"
                    usePopup
                  >
                    <div className="text-xs text-slate-100">Início</div>
                  </RealisticVehicleMarker>
                  <RealisticVehicleMarker
                    latitude={mapPoints[mapPoints.length - 1].lat}
                    longitude={mapPoints[mapPoints.length - 1].lon}
                    type={selectedDeviceType}
                    speed={0}
                    status="online"
                    usePopup
                  >
                    <div className="text-xs text-slate-100">Fim</div>
                  </RealisticVehicleMarker>
                  <Marker
                    position={[
                      mapPoints[Math.floor(mapPoints.length / 2)].lat,
                      mapPoints[Math.floor(mapPoints.length / 2)].lon,
                    ]}
                    icon={arrowIcon}
                  />
                </MapContainer>
              </div>
            </div>
          )}

          {(activeTab === "route" || activeTab === "trips" || activeTab === "stops" || activeTab === "events") && (
            <div className="bg-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.35)] rounded-2xl p-4 border border-slate-800">
              <h2 className="text-lg font-semibold text-slate-100 mb-2">{currentReportLabel}</h2>

              {!loading && generatedTypes[activeTab] && currentRows.length === 0 && (
                <div className="text-slate-400 text-sm">Nenhum registro no período selecionado.</div>
              )}

              {activeTab === "route" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {currentRows.map((row) => (
                    <div key={row.id} className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                      <div className="text-xs text-slate-400">Hora GPS</div>
                      <div className="text-sm font-semibold text-slate-100">{row.time}</div>
                      <div className="text-xs text-slate-400 mt-2">Tipo</div>
                      <div className="text-sm font-semibold text-slate-100">{row.type}</div>
                    </div>
                  ))}
                </div>
              ) : activeTab === "stops" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {currentRows.map((row) => (
                    <div key={row.id} className="bg-slate-800 rounded-lg p-3 border border-slate-700 space-y-1">
                      <div>
                        <div className="text-xs text-slate-400">Hora inicial</div>
                        <div className="text-sm font-semibold text-slate-100">{row.start}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Hora final</div>
                        <div className="text-sm font-semibold text-slate-100">{row.end}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Endereço</div>
                        <div className="text-sm font-semibold text-slate-100">{row.address}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-xs text-slate-400">Duração</div>
                          <div className="text-sm font-semibold text-slate-100">{row.duration}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">Horas ligado</div>
                          <div className="text-sm font-semibold text-slate-100">{row.engineHours}</div>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Gasto de Combustível</div>
                        <div className="text-sm font-semibold text-slate-100">{row.fuel}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : activeTab === "trips" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {currentRows.map((row) => (
                    <div key={row.id} className="bg-slate-800 rounded-lg p-3 border border-slate-700 space-y-1">
                      <div>
                        <div className="text-xs text-slate-400">Hora inicial</div>
                        <div className="text-sm font-semibold text-slate-100">{row.start}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Hora final</div>
                        <div className="text-sm font-semibold text-slate-100">{row.end}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Distância</div>
                        <div className="text-sm font-semibold text-slate-100">{row.distance}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Velocidade média</div>
                        <div className="text-sm font-semibold text-slate-100">{row.avgSpeed}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Início do odômetro</div>
                        <div className="text-sm font-semibold text-slate-100">{row.startOdometer}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Fim do odômetro</div>
                        <div className="text-sm font-semibold text-slate-100">{row.endOdometer}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Velocidade máxima</div>
                        <div className="text-sm font-semibold text-slate-100">{row.maxSpeed}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Duração</div>
                        <div className="text-sm font-semibold text-slate-100">{row.duration}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Gasto de combustível</div>
                        <div className="text-sm font-semibold text-slate-100">{row.fuel}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Motorista</div>
                        <div className="text-sm font-semibold text-slate-100">{row.driver}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Endereço inicial</div>
                        <div className="text-sm font-semibold text-slate-100">{row.startAddress}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Endereço final</div>
                        <div className="text-sm font-semibold text-slate-100">{row.endAddress}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : activeTab === "events" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {currentRows.map((row) => (
                    <div key={row.id} className="bg-slate-800 rounded-lg p-3 border border-slate-700 space-y-2">
                      <div>
                        <div className="text-xs text-slate-400">Horário</div>
                        <div className="text-sm font-semibold text-slate-100">{row.time}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Evento</div>
                        <div className="text-sm font-semibold text-slate-100">{row.event}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="overflow-auto max-h-[70vh]">
                  <table className="min-w-full text-sm text-slate-200">
                    <thead>
                      {isResumo ? (
                        <tr className="text-left text-slate-400 border-b border-slate-800">
                          <th className="py-2 pr-4 whitespace-nowrap">Hora inicial</th>
                          <th className="py-2 pr-4 whitespace-nowrap">Hora final</th>
                          <th className="py-2 pr-4 whitespace-nowrap">Distância</th>
                          <th className="py-2 pr-4 whitespace-nowrap">Velocidade Média</th>
                          <th className="py-2 pr-4 whitespace-nowrap">Início do odômetro</th>
                          <th className="py-2 pr-4">Endereço inicial</th>
                          <th className="py-2 pr-4 whitespace-nowrap">Fim do odômetro</th>
                          <th className="py-2 pr-4">Endereço final</th>
                          <th className="py-2 pr-4 whitespace-nowrap">Velocidade Máxima</th>
                          <th className="py-2 pr-4 whitespace-nowrap">Duração</th>
                          <th className="py-2 pr-4 whitespace-nowrap">Gasto de Combustível</th>
                          <th className="py-2 pr-4 whitespace-nowrap">Motorista</th>
                        </tr>
                      ) : isTrips ? (
                        <tr className="text-left text-slate-400 border-b border-slate-800">
                          <th className="py-2 pr-4 whitespace-nowrap">Hora inicial</th>
                          <th className="py-2 pr-4 whitespace-nowrap">Hora final</th>
                          <th className="py-2 pr-4 whitespace-nowrap">Distância</th>
                          <th className="py-2 pr-4 whitespace-nowrap">Velocidade Média</th>
                          <th className="py-2 pr-4 whitespace-nowrap">Início do odômetro</th>
                          <th className="py-2 pr-4">Endereço inicial</th>
                          <th className="py-2 pr-4 whitespace-nowrap">Fim do odômetro</th>
                          <th className="py-2 pr-4">Endereço final</th>
                          <th className="py-2 pr-4 whitespace-nowrap">Velocidade Máxima</th>
                          <th className="py-2 pr-4 whitespace-nowrap">Duração</th>
                          <th className="py-2 pr-4 whitespace-nowrap">Gasto de Combustível</th>
                          <th className="py-2 pr-4 whitespace-nowrap">Motorista</th>
                        </tr>
                      ) : activeTab === "events" ? null : (
                        <tr className="text-left text-slate-400 border-b border-slate-800">
                          <th className="py-2 pr-4">Horário</th>
                          <th className="py-2 pr-4">Distância</th>
                          <th className="py-2 pr-4">Duração</th>
                          <th className="py-2 pr-4">Evento</th>
                        </tr>
                      )}
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {currentRows.map((row) =>
                        isResumo ? (
                          <tr key={row.id} className="border-b border-slate-800 last:border-0">
                            <td className="py-2 pr-4 whitespace-nowrap">{row.start}</td>
                            <td className="py-2 pr-4 whitespace-nowrap">{row.end}</td>
                            <td className="py-2 pr-4 whitespace-nowrap">{row.distance}</td>
                            <td className="py-2 pr-4 whitespace-nowrap">{row.avgSpeed}</td>
                            <td className="py-2 pr-4 whitespace-nowrap">{row.startOdometer}</td>
                            <td className="py-2 pr-4">{row.startAddress}</td>
                            <td className="py-2 pr-4 whitespace-nowrap">{row.endOdometer}</td>
                            <td className="py-2 pr-4">{row.endAddress}</td>
                            <td className="py-2 pr-4 whitespace-nowrap">{row.maxSpeed}</td>
                            <td className="py-2 pr-4 whitespace-nowrap">{row.duration}</td>
                            <td className="py-2 pr-4 whitespace-nowrap">{row.fuel}</td>
                            <td className="py-2 pr-4 whitespace-nowrap">{row.driver}</td>
                          </tr>
                        ) : isTrips ? (
                          <tr key={row.id} className="border-b border-slate-800 last:border-0">
                            <td className="py-2 pr-4 whitespace-nowrap">{row.start}</td>
                            <td className="py-2 pr-4 whitespace-nowrap">{row.end}</td>
                            <td className="py-2 pr-4 whitespace-nowrap">{row.distance}</td>
                            <td className="py-2 pr-4 whitespace-nowrap">{row.avgSpeed}</td>
                            <td className="py-2 pr-4 whitespace-nowrap">{row.startOdometer}</td>
                            <td className="py-2 pr-4">{row.startAddress}</td>
                            <td className="py-2 pr-4 whitespace-nowrap">{row.endOdometer}</td>
                            <td className="py-2 pr-4">{row.endAddress}</td>
                            <td className="py-2 pr-4 whitespace-nowrap">{row.maxSpeed}</td>
                            <td className="py-2 pr-4 whitespace-nowrap">{row.duration}</td>
                            <td className="py-2 pr-4 whitespace-nowrap">{row.fuel}</td>
                            <td className="py-2 pr-4 whitespace-nowrap">{row.driver}</td>
                          </tr>
                        ) : null
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === "resumo" && currentRows.length > 0 && (
            <div className="bg-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.35)] rounded-2xl p-4 border border-slate-800">
              <h2 className="text-lg font-semibold text-slate-100 mb-4">Resumo</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 text-sm text-slate-200">
                {currentRows.map((row) => (
                  <React.Fragment key={row.id}>
                    <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                      <div className="text-xs text-slate-400">Hora inicial</div>
                      <div className="text-base font-semibold">{row.start}</div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                      <div className="text-xs text-slate-400">Hora final</div>
                      <div className="text-base font-semibold">{row.end}</div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                      <div className="text-xs text-slate-400">Distância</div>
                      <div className="text-base font-semibold">{row.distance}</div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                      <div className="text-xs text-slate-400">Velocidade média</div>
                      <div className="text-base font-semibold">{row.avgSpeed}</div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                      <div className="text-xs text-slate-400">Início do odômetro</div>
                      <div className="text-base font-semibold">{row.startOdometer}</div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                      <div className="text-xs text-slate-400">Fim do odômetro</div>
                      <div className="text-base font-semibold">{row.endOdometer}</div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                      <div className="text-xs text-slate-400">Velocidade máxima</div>
                      <div className="text-base font-semibold">{row.maxSpeed}</div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                      <div className="text-xs text-slate-400">Tempo total ligado</div>
                      <div className="text-base font-semibold">{row.engineHours}</div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                      <div className="text-xs text-slate-400">Tempo de partida do motor</div>
                      <div className="text-base font-semibold">{row.engineHoursStart}</div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                      <div className="text-xs text-slate-400">Encerrar horas do motor de partida</div>
                      <div className="text-base font-semibold">{row.engineHoursEnd}</div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                      <div className="text-xs text-slate-400">Gasto de combustível</div>
                      <div className="text-base font-semibold">{row.fuel}</div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                      <div className="text-xs text-slate-400">Motorista</div>
                      <div className="text-base font-semibold">{row.driver}</div>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
