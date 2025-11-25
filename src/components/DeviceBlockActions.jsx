import React, { useState } from "react";
import { blockEngine, unblockEngine } from "../services/traccar";

export default function DeviceBlockActions({ device }) {
  const [loading, setLoading] = useState(null); // "block" | "unblock" | null
  const [status, setStatus] = useState(null); // "blocked" | "unblocked" | null
  const [message, setMessage] = useState("");

  if (!device?.id) return null;

  const handleAction = async (action) => {
    setMessage("");
    setLoading(action);
    const timer = setTimeout(() => {
      setMessage("Sem resposta do servidor. Verifique se o dispositivo está online.");
      setLoading(null);
    }, 8000);

    try {
      if (action === "block") {
        await blockEngine(device.id);
        setStatus("blocked");
        setMessage(`Comando de BLOQUEIO enviado para ${device.name || device.uniqueId}`);
      } else {
        await unblockEngine(device.id);
        setStatus("unblocked");
        setMessage(`Comando de DESBLOQUEIO enviado para ${device.name || device.uniqueId}`);
      }
    } catch (err) {
      const msg = err?.response?.data || err?.message || "Erro ao enviar comando";
      setMessage(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      clearTimeout(timer);
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold border ${
            status === "blocked"
              ? "bg-red-100 text-red-700 border-red-200"
              : status === "unblocked"
                ? "bg-green-100 text-green-700 border-green-200"
                : "bg-slate-100 text-slate-600 border-slate-200"
          }`}
        >
          {status === "blocked"
            ? "Bloqueado"
            : status === "unblocked"
              ? "Desbloqueado"
              : "Aguardando"}
        </span>
        <button
          onClick={() => handleAction("block")}
          disabled={loading === "block"}
          className="px-3 py-2 rounded-full border border-red-200 text-red-700 bg-red-50/80 hover:bg-red-50 disabled:opacity-60"
        >
          {loading === "block" ? "Enviando..." : "Bloquear Veículo"}
        </button>
        <button
          onClick={() => handleAction("unblock")}
          disabled={loading === "unblock"}
          className="px-3 py-2 rounded-full border border-emerald-200 text-emerald-700 bg-emerald-50/80 hover:bg-emerald-50 disabled:opacity-60"
        >
          {loading === "unblock" ? "Enviando..." : "Desbloquear Veículo"}
        </button>
      </div>
      {message && (
        <div className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-1">
          {message}
        </div>
      )}
    </div>
  );
}
