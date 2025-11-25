// src/pages/MapView.jsx
import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { getDevices, getPositions } from "../services/traccar";

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

function FitMapView({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions.map((p) => [p.latitude, p.longitude]));
      map.fitBounds(bounds, { padding: [80, 80] });
    }
  }, [positions]);
  return null;
}

export default function MapView({ onSelectDevice }) {
  const [devices, setDevices] = useState([]);
  const [positions, setPositions] = useState([]);
  const [baseMap, setBaseMap] = useState(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("baseMap") : null;
    return stored || "google-road";
  });
  const [ignitionCache, setIgnitionCache] = useState({});

  const categoryIcon = {
    car: "🚘",
    motorcycle: "🏍️",
    truck: "🚛",
    pickup: "🚙",
    camionete: "🚙",
    van: "🚐",
    bus: "🚌",
    boat: "🛥️",
    person: "🚶",
    animal: "🐾",
    other: "📡",
  };

  const categoryColors = {
    car: "#0ea5e9",
    motorcycle: "#f59e0b",
    truck: "#a855f7",
    pickup: "#22c55e",
    camionete: "#22c55e",
    van: "#14b8a6",
    bus: "#6366f1",
    boat: "#06b6d4",
    person: "#f97316",
    animal: "#8b5cf6",
    other: "#475569",
  };

  const getMarkerIcon = (category) => {
    const emoji = categoryIcon[category] || categoryIcon.other;
    const color = categoryColors[category] || categoryColors.other;
    const html = `<div class="device-marker-mini" style="--marker-color:${color};">${emoji}</div>`;

    return L.divIcon({
      className: "",
      html,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
  };

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

  const getPos = (deviceId) => positions.find((p) => p.deviceId === deviceId);

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

  return (
    <div className="w-full h-[calc(100vh-2rem)] bg-white relative">
      <div className="flex items-center justify-end gap-2 p-2">
        <label className="text-xs text-slate-600">Mapa:</label>
        <select
          value={baseMap}
          onChange={(e) => setBaseMap(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1 text-sm shadow-sm"
        >
          {baseLayers.map((layer) => (
            <option key={layer.id} value={layer.id}>
              {layer.name}
            </option>
          ))}
        </select>
      </div>

      <MapContainer
        center={[-22.84, -47.15]}
        zoom={10}
        style={{ height: "calc(100% - 48px)", width: "100%" }}
        className="z-0"
      >
        <TileLayer
          key={currentLayer.id}
          url={currentLayer.url}
          attribution={currentLayer.attribution}
          subdomains={currentLayer.subdomains}
        />
        <FitMapView positions={positions} />

        {devices.map((d) => {
          const p = getPos(d.id);
          if (!p) return null;
          const icon = getMarkerIcon(d.category, d.name);
          const isOnline = d.status === "online";
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
          return (
            <Marker
              key={d.id}
              position={[p.latitude, p.longitude]}
              icon={icon}
              eventHandlers={{
                click: () => onSelectDevice && onSelectDevice(d, p),
              }}
            >
              <Tooltip direction="top" offset={[0, -10]} permanent={false} interactive>
                <div className="text-xs bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-lg p-3 min-w-[200px]">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-slate-800">{d.name || "Sem nome"}</div>
                    <span className={`text-[10px] px-2 py-1 rounded-full ${isOnline ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                      {isOnline ? "Online" : "Offline"}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1 text-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-[10px] uppercase tracking-wide">Velocidade</span>
                      <span className="font-semibold text-slate-800">{p.speed ?? 0} km/h</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-[10px] uppercase tracking-wide">Ignição</span>
                      <span className="font-semibold text-slate-800">
                        {ignition === true ? "Ligada" : ignition === false ? "Desligada" : "-"}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 leading-snug">
                      {address !== "-" ? address : "Sem endereço disponível"}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {p.deviceTime ? new Date(p.deviceTime).toLocaleString() : "-"}
                    </div>
                  </div>
                </div>
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
