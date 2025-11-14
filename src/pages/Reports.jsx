// src/pages/Reports.jsx

import React, { useState, useEffect } from "react";
import api from "../services/api";

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadReports = async () => {
    try {
      // Exemplo: pegar posições (ou alertas) do Traccar
      const res = await api.get("/positions"); 
      setReports(res.data || []);
      setLoading(false);
    } catch (err) {
      console.error("Erro ao carregar relatórios:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4 text-sky-700">Relatórios</h1>

      {loading ? (
        <div className="text-gray-500">Carregando...</div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div
              key={r.id}
              className="p-4 rounded-xl border border-gray-200 shadow-sm bg-white"
            >
              <p className="text-sm font-semibold">
                Dispositivo ID: {r.deviceId} - Protocolo: {r.protocol}
              </p>
              <p className="text-xs text-gray-600">
                Velocidade: {r.speed} km/h • Ignition: {r.attributes?.ignition ? "Ligado" : "Desligado"}
              </p>
              <p className="text-xs text-gray-600">
                Atualizado: {r.serverTime ? new Date(r.serverTime).toLocaleString() : "Sem data"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
