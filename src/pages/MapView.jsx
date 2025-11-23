// src/pages/MapView.jsx
import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from "react-leaflet";
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

  const categoryEmoji = {
    car: "🚗",
    motorcycle: "🏍️",
    truck: "🚚",
    pickup: "🛻",
    camionete: "🛻",
    van: "🚐",
    bus: "🚌",
    boat: "⛵",
    person: "🧍",
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
    const emoji = categoryEmoji[category] || categoryEmoji.other;
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
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const getPos = (deviceId) => positions.find((p) => p.deviceId === deviceId);

  const overspeedThreshold = 80; // km/h

  const notifications = useMemo(() => {
    if (!positions.length) return [];

    const nameById = devices.reduce((acc, d) => {
      acc[d.id] = d.name || d.uniqueId || `ID ${d.id}`;
      return acc;
    }, {});

    const ignitionOn = [];
    const ignitionOff = [];
    const moving = [];
    const stopped = [];
    const overspeed = [];
    const online = [];
    const offline = [];

    devices.forEach((d) => {
      const name = nameById[d.id] || `ID ${d.id}`;
      if (d.status === "online") {
        online.push(name);
      } else if (d.status) {
        offline.push(name);
      }
    });

    positions.forEach((p) => {
      const name = nameById[p.deviceId] || `ID ${p.deviceId}`;
      const speed = Number(p.speed) || 0;
      const ign = p.attributes?.ignition;

      if (ign === true) ignitionOn.push(name);
      if (ign === false) ignitionOff.push(name);

      if (speed > overspeedThreshold) {
        overspeed.push(`${name} (${Math.round(speed)} km/h)`);
      }

      if (speed > 5) {
        moving.push(`${name} (${Math.round(speed)} km/h)`);
      } else {
        stopped.push(name);
      }
    });

    const data = [];
    if (online.length) data.push({ label: "Online", icon: "🟢", color: "bg-green-100 text-green-700", items: online });
    if (offline.length) data.push({ label: "Offline", icon: "⚪", color: "bg-slate-100 text-slate-700", items: offline });
    if (ignitionOn.length) data.push({ label: "Ignição ligada", icon: "🔌", color: "bg-green-100 text-green-700", items: ignitionOn });
    if (ignitionOff.length) data.push({ label: "Ignição desligada", icon: "⏻", color: "bg-slate-100 text-slate-700", items: ignitionOff });
    if (moving.length) data.push({ label: "Veículo em movimento", icon: "🚀", color: "bg-sky-100 text-sky-700", items: moving });
    if (stopped.length) data.push({ label: "Veículo parado", icon: "⏸️", color: "bg-amber-100 text-amber-700", items: stopped });
    if (overspeed.length) data.push({ label: "Alta velocidade", icon: "⚡", color: "bg-red-100 text-red-700", items: overspeed });

    return data;
  }, [positions, devices]);

  return (
    <div className="w-full h-[calc(100vh-2rem)] bg-white relative">
      <MapContainer
        center={[-22.84, -47.15]}
        zoom={10}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitMapView positions={positions} />

        {devices.map((d) => {
          const p = getPos(d.id);
          if (!p) return null;
          const icon = getMarkerIcon(d.category, d.name);
          return (
            <Marker
              key={d.id}
              position={[p.latitude, p.longitude]}
              icon={icon}
              eventHandlers={{
                click: () => onSelectDevice && onSelectDevice(d, p),
              }}
            >
              <Tooltip direction="top" offset={[0, -10]}>
                <div className="text-xs">
                  <div className="font-semibold text-slate-800">{d.name || "Sem nome"}</div>
                  <div className="text-slate-600">Categoria: {d.category || "-"}</div>
                  <div className="text-slate-600">Velocidade: {p.speed ?? 0} km/h</div>
                  <div className="text-slate-600">
                    Atualizado: {p.deviceTime ? new Date(p.deviceTime).toLocaleString() : "-"}
                  </div>
                </div>
              </Tooltip>
              <Popup>
                <div>
                  <strong>{d.name}</strong>
                  <br />
                  Velocidade: {p.speed ?? 0} km/h
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {notifications.length > 0 && (
        <div className="absolute top-4 right-4 flex flex-col gap-2 w-64">
          {notifications.map((n) => (
            <div
              key={n.label}
              className={`flex items-start gap-2 px-3 py-2 rounded-xl text-xs font-semibold shadow-sm ${n.color}`}
            >
              <span className="mt-[2px]">{n.icon}</span>
              <div className="flex-1">
                <div>{n.label}</div>
                <div className="text-[11px] text-slate-600 font-normal leading-tight">
                  {n.items.join(", ")}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
