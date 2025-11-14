// src/pages/Devices.jsx

import React, { useEffect, useState } from "react";
import api from "../services/api";
import { MapPin, Navigation, Gauge } from "lucide-react";

export default function Devices() {
  const [devices, setDevices] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const devRes = await api.get("/devices");
      const posRes = await api.get("/positions");

      setDevices(devRes.data || []);
      setPositions(posRes.data || []);
      setLoading(false);
    } catch (err) {
      console.error("Erro ao carregar dispositivos:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getPos = (deviceId) => positions.find((p) => p.deviceId === deviceId);

  return (
    <div className="p-4">

      <h1 className="text-2xl font-bold mb-4 text-sky-700">
        🚗 Veículos Rastreados
      </h1>

      {loading ? (
        <div className="text-gray-500">Carregando...</div>
      ) : (
        <div className="space-y-4">
          {devices.map((d) => {
            const pos = getPos(d.id);

            return (
              <div
                key={d.id}
                className="p-4 rounded-2xl border border-gray-200 shadow-md bg-white hover:shadow-lg transition"
              >
                <div className="flex justify-between items-start">
                  {/* esquerda */}
                  <div>
                    <h2 className="text-lg font-semibold">{d.name}</h2>

                    <p className="text-xs text-gray-600 mt-1">
                      ID: {d.uniqueId} • {d.category || "Sem categoria"}
                    </p>

                    <p className="text-sm mt-1">
                      <span
                        className={
                          d.status === "online"
                            ? "text-green-600 font-semibold"
                            : "text-red-600 font-semibold"
                        }
                      >
                        {d.status === "online" ? "Online" : "Offline"}
                      </span>{" "}
                      • {d.lastUpdate ? new Date(d.lastUpdate).toLocaleString() : "Sem data"}
                    </p>

                    {/* endereço */}
                    <p className="text-sm text-gray-700 mt-2 flex items-start gap-1">
                      <MapPin size={16} />
                      {pos?.address || "Endereço não disponível"}
                    </p>

                    {/* velocidade e ignição */}
                    <div className="flex gap-4 mt-2 text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        <Gauge size={14} />
                        {pos?.speed || 0} km/h
                      </span>
                      <span className="flex items-center gap-1">
                        🔌 {pos?.attributes?.ignition ? "Ligada" : "Desligada"}
                      </span>
                    </div>
                  </div>

                  {/* direita */}
                  <button
                    className="px-4 py-2 bg-sky-600 text-white rounded-xl hover:bg-sky-700 text-sm shadow"
                  >
                    <Navigation size={16} className="inline mr-1" />
                    Ver no mapa
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

