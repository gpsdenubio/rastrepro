// src/components/VehiclePanel.jsx
import React from "react";

export default function VehiclePanel({ device, position, onClose }) {
  if (!device || !position) return null;

  return (
    <div className="fixed right-6 top-20 w-80 bg-white dark:bg-gray-800 border rounded-xl shadow-lg p-4 z-50">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-bold text-lg">{device.name || "Sem nome"}</h3>
          <p className="text-xs text-gray-500">{device.uniqueId}</p>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">×</button>
      </div>

      <div className="mt-3 text-sm text-gray-700 dark:text-gray-200 space-y-2">
        <div><strong>Velocidade:</strong> {position.speed ?? 0} km/h</div>
        <div><strong>Ignition:</strong> {position.attributes?.ignition ? "Ligada" : "Desligada"}</div>
        <div><strong>Última:</strong> {new Date(position.deviceTime).toLocaleString()}</div>
        <div><strong>Endereço:</strong> {position.address || position.attributes?.address || "Sem endereço"}</div>
      </div>

      <div className="mt-4 flex gap-2">
        <a
          className="flex-1 text-center px-3 py-2 rounded bg-sky-600 text-white text-sm hover:bg-sky-700"
          href={`#/map?deviceId=${device.id}`}
        >
          Ir ao mapa
        </a>
        <button className="flex-1 px-3 py-2 rounded border text-sm" onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  );
}
