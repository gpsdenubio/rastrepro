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

const tabs = [
  { value: "route", label: "Rotas" },
  { value: "trips", label: "Viagens" },
  { value: "stops", label: "Paradas" },
  { value: "events", label: "Eventos" },
  { value: "resumo", label: "Resumo" },
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

  const normalizeRows = (type, data) => {
    if (!Array.isArray(data)) return [];
    switch (type) {
      case "route":
        return data.map((item, idx) => ({
          id: item.id || idx,
          time: formatDateTime(item.serverTime || item.deviceTime || item.fixTime || item.time),
          address: item.address || formatCoords(item.latitude, item.longitude),
          speed: item.speed != null ? `${item.speed} km/h` : "-",
          distance: formatDistance(item.attributes?.distance ?? item.distance ?? item.attributes?.totalDistance),
          duration: "-",
          event: "-",
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
          duration: formatDuration(item.duration),
          event: "-",
        }));
      case "stops":
        return data.map((item, idx) => ({
          id: item.id || idx,
          time: formatDateTime(item.startTime),
          address: item.address || formatCoords(item.latitude, item.longitude),
          speed: "-",
          distance: "-",
          duration: formatDuration(item.duration),
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
      const normalized = normalizeRows(type, data);

      setDataByType((prev) => ({
        ...prev,
        [type]: {
          rows: normalized,
          raw: type === "route" ? data : prev[type]?.raw,
          mapPoints:
            type === "route"
              ? normalized
                  .filter((r) => r.lat != null && r.lon != null)
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

  return (
    <div className="p-4 space-y-4 bg-white">
      <div className="bg-white shadow rounded-2xl p-4 border border-slate-100">
        <h1 className="text-2xl font-bold text-sky-700 mb-4">Relatórios</h1>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Dispositivo</label>
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="border rounded-lg px-3 py-2 focus:outline-none focus:ring focus:ring-sky-200"
              required
            >
              <option value="">Selecione</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name || d.uniqueId || `ID ${d.id}`}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Data inicial</label>
            <input
              type="datetime-local"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="border rounded-lg px-3 py-2 focus:outline-none focus:ring focus:ring-sky-200"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Data final</label>
            <input
              type="datetime-local"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="border rounded-lg px-3 py-2 focus:outline-none focus:ring focus:ring-sky-200"
              required
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => handleGenerate(activeTab)}
              disabled={loading}
              className="bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white px-6 py-2 rounded-lg transition w-full"
            >
              {loading ? "Gerando..." : "Gerar"}
            </button>
          </div>
        </div>

        {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
      </div>

      <div className="bg-white shadow rounded-2xl p-2 border border-slate-100">
        <div className="flex flex-wrap gap-2 p-2">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                activeTab === tab.value
                  ? "bg-sky-600 text-white border-sky-600"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "route" && mapPoints.length > 0 && (
        <div className="bg-white shadow rounded-2xl p-4 border border-slate-100">
          <h2 className="text-lg font-semibold text-slate-700 mb-2">Mapa - {selectedDeviceName}</h2>
          <div className="h-96 rounded-lg overflow-hidden border">
            <MapContainer center={mapPoints[0]} zoom={13} style={{ height: "100%", width: "100%" }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
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
        <div className="bg-white shadow rounded-2xl p-4 border border-slate-100">
          <h2 className="text-lg font-semibold text-slate-700 mb-4">Resumo da Viagem</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-sm text-slate-700">
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs text-slate-500">Distância total</div>
              <div className="text-lg font-semibold">{routeStats.totalDistanceKm} km</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs text-slate-500">Tempo total</div>
              <div className="text-lg font-semibold">{routeStats.totalTime}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs text-slate-500">Velocidade máxima</div>
              <div className="text-lg font-semibold">{routeStats.maxSpeed}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs text-slate-500">Velocidade média</div>
              <div className="text-lg font-semibold">{routeStats.avgSpeed}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs text-slate-500">Tempo parado</div>
              <div className="text-lg font-semibold">{routeStats.stopped}</div>
            </div>
          </div>
        </div>
      )}

      {(activeTab === "route" || activeTab === "trips" || activeTab === "stops" || activeTab === "events") && (
        <div className="bg-white shadow rounded-2xl p-4 border border-slate-100">
          <h2 className="text-lg font-semibold text-slate-700 mb-2">
            {tabs.find((t) => t.value === activeTab)?.label}
          </h2>

          {!loading && generatedTypes[activeTab] && currentRows.length === 0 && (
            <div className="text-slate-500 text-sm">Nenhum registro no período selecionado.</div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-4">Horário</th>
                  <th className="py-2 pr-4">Endereço / Coordenadas</th>
                  <th className="py-2 pr-4">Velocidade</th>
                  <th className="py-2 pr-4">Distância</th>
                  <th className="py-2 pr-4">Duração</th>
                  <th className="py-2 pr-4">Evento</th>
                </tr>
              </thead>
              <tbody>
                {currentRows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
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
