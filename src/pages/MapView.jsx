// src/pages/MapView.jsx
import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
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

  return (
    <div className="w-full h-full">
      <MapContainer center={[-22.84, -47.15]} zoom={12} style={{ height: "100%", width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitMapView positions={positions} />

        {devices.map((d) => {
          const p = getPos(d.id);
          if (!p) return null;
          return (
            <Marker
              key={d.id}
              position={[p.latitude, p.longitude]}
              eventHandlers={{
                click: () => onSelectDevice && onSelectDevice(d, p),
              }}
            >
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
    </div>
  );
}

