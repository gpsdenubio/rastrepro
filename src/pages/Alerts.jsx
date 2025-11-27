import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { getDevices, getEvents } from "../services/traccar";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const severityColor = {
  critical: "bg-red-900/60 text-red-200 border-red-700",
  warning: "bg-amber-900/60 text-amber-200 border-amber-700",
  info: "bg-blue-900/60 text-blue-200 border-blue-700",
};

const mapEventSeverity = (type) => {
  if (!type) return "info";
  if (["alarm", "overspeed"].includes(type)) return "critical";
  if (["deviceOffline", "deviceUnknown"].includes(type)) return "warning";
  return "info";
};

export default function Alerts() {
  const [devices, setDevices] = useState([]);
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");

  const deviceNameById = useMemo(() => {
    const map = {};
    devices.forEach((d) => {
      map[d.id] = d.name || d.uniqueId || `ID ${d.id}`;
    });
    return map;
  }, [devices]);

  const eventTypeLabel = (type) => {
    const map = {
      deviceOnline: "Online",
      deviceOffline: "Offline",
      deviceUnknown: "Indefinido",
      ignitionOn: "Ignição ligada",
      ignitionOff: "Ignição desligada",
      alarm: "Alarme",
      geofenceEnter: "Entrou na cerca",
      geofenceExit: "Saiu da cerca",
      overspeed: "Alta velocidade",
      commandResult: "Resposta de comando",
    };
    return map[type] || type || "Evento";
  };

  const loadData = async () => {
    try {
      const now = new Date();
      const from = new Date(now.getTime() - 60 * 60 * 1000); // últimos 60 min
      const [devs, evs] = await Promise.all([
        getDevices(),
        getEvents({ from: from.toISOString(), to: now.toISOString(), all: true }),
      ]);
      setDevices(Array.isArray(devs) ? devs : []);
      setEvents(Array.isArray(evs) ? evs.slice(-50).reverse() : []);
    } catch (err) {
      setError("Não foi possível carregar eventos.");
    }
  };

  useEffect(() => {
    loadData();
    // interval removido para evitar mensagem de atualização automática
    return () => {};
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-4 bg-slate-950 min-h-screen text-slate-100">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Eventos</h1>
          <p className="text-sm text-slate-400">Lista de eventos em tempo real.</p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2 h-[46px] rounded-[10px] border border-slate-700 bg-slate-900 text-slate-100 hover:border-sky-500/60 hover:shadow-[0_0_12px_rgba(14,165,233,0.35)] transition"
        >
          Atualizar
        </button>
      </div>

      {error && <div className="text-sm text-red-400">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.35)] p-4 space-y-2 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Eventos recentes</h2>
          </div>
          <div className="max-h-[520px] overflow-auto space-y-2">
            {events.length === 0 ? (
              <div className="text-sm text-slate-400">Nenhum evento recente.</div>
            ) : (
              events.map((ev) => {
                const sev = mapEventSeverity(ev.type);
                const deviceName = deviceNameById[ev.deviceId] || `ID ${ev.deviceId || "-"}`;
                return (
                  <div
                    key={ev.id}
                    onClick={() => setSelected(ev)}
                    className={`cursor-pointer border ${severityColor[sev]} rounded-xl px-3 py-2 bg-slate-800/70 hover:bg-slate-800 transition`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-100">{eventTypeLabel(ev.type)}</div>
                      <div className="text-[11px] text-slate-300">
                        {ev.eventTime ? new Date(ev.eventTime).toLocaleString() : "-"}
                      </div>
                    </div>
                    <div className="text-xs text-slate-300">{deviceName}</div>
                    {ev.address && (
                      <div className="text-[11px] text-slate-400">{ev.address}</div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.35)] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Detalhes</h2>
            {selected && (
              <span className="text-xs text-slate-300">
                {selected.eventTime ? new Date(selected.eventTime).toLocaleString() : "-"}
              </span>
            )}
          </div>
          {selected ? (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-slate-100">
                {eventTypeLabel(selected.type)}
              </div>
              <div className="text-xs text-slate-300">
                Dispositivo: {deviceNameById[selected.deviceId] || `ID ${selected.deviceId || "-"}`}
              </div>
              <div className="text-xs text-slate-300">
                Endereço: {selected.address || selected.attributes?.address || "-"}
              </div>
              <div className="text-xs text-slate-300">
                Status: {mapEventSeverity(selected.type)}
              </div>
              <div className="h-48 rounded-xl overflow-hidden border border-slate-800">
                <MapContainer
                  center={[selected.latitude || 0, selected.longitude || 0]}
                  zoom={14}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  {selected.latitude && selected.longitude && (
                    <Marker position={[selected.latitude, selected.longitude]}>
                      <Popup>{eventTypeLabel(selected.type)}</Popup>
                    </Marker>
                  )}
                </MapContainer>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="px-3 py-2 rounded-[10px] border border-slate-700 bg-slate-800 text-slate-100 hover:border-sky-500/60 hover:shadow-[0_0_12px_rgba(14,165,233,0.35)] text-sm transition"
              >
                Marcar como lido
              </button>
            </div>
          ) : (
            <div className="text-sm text-slate-400">Selecione um evento para ver detalhes.</div>
          )}
        </div>
      </div>
    </div>
  );
}
