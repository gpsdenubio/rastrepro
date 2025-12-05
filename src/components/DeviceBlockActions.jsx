import React, { useState } from "react";
import { blockEngine, unblockEngine, getDevice } from "../services/traccar";

export default function DeviceBlockActions({ device, onLog, onDeviceUpdate }) {
  const [loading, setLoading] = useState(null); // "block" | "unblock" | null
  const [status, setStatus] = useState(null); // "blocked" | "unblocked" | null
  const [message, setMessage] = useState("");

  // Status inicial conforme atributo engine
  React.useEffect(() => {
    const engine = device?.attributes?.engine;
    if (engine === "stop") setStatus("blocked");
    else if (engine === "resume") setStatus("unblocked");
    else setStatus(null);
  }, [device]);

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
        onLog?.({
          deviceId: device.id,
          deviceName: device.name || device.uniqueId || device.id,
          action: "Bloquear",
          status: "enviado",
          time: new Date().toISOString(),
        });
      } else {
        await unblockEngine(device.id);
        setStatus("unblocked");
        setMessage(`Comando de DESBLOQUEIO enviado para ${device.name || device.uniqueId}`);
        onLog?.({
          deviceId: device.id,
          deviceName: device.name || device.uniqueId || device.id,
          action: "Desbloquear",
          status: "enviado",
          time: new Date().toISOString(),
        });
      }
      // Recarrega status real do dispositivo
      const updated = await getDevice(device.id);
      const engine = updated?.attributes?.engine;
      if (engine === "stop") setStatus("blocked");
      else if (engine === "resume") setStatus("unblocked");
      onDeviceUpdate?.(updated);
    } catch (err) {
      const msg = err?.response?.data || err?.message || "Erro ao enviar comando";
      setMessage(typeof msg === "string" ? msg : JSON.stringify(msg));
      onLog?.({
        deviceId: device.id,
        deviceName: device.name || device.uniqueId || device.id,
        action: action === "block" ? "Bloquear" : "Desbloquear",
        status: "erro",
        time: new Date().toISOString(),
        error: msg,
      });
    } finally {
      clearTimeout(timer);
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {(status === "blocked" || status === "unblocked") && (
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold border ${
              status === "blocked"
                ? "bg-red-900/60 text-red-200 border-red-700"
                : "bg-emerald-900/60 text-emerald-200 border-emerald-700"
            }`}
          >
            {status === "blocked" ? "Bloqueado" : "Desbloqueado"}
          </span>
        )}
        <button
          onClick={() => handleAction("block")}
          disabled={loading === "block"}
          className="px-3 py-2 h-[40px] rounded-[10px] border border-red-700 text-red-200 bg-red-900/60 hover:border-red-400 hover:shadow-[0_0_10px_rgba(248,113,113,0.35)] disabled:opacity-60 transition"
        >
          {loading === "block" ? "Enviando..." : "Bloquear Veículo"}
        </button>
        <button
          onClick={() => handleAction("unblock")}
          disabled={loading === "unblock"}
          className="px-3 py-2 h-[40px] rounded-[10px] border border-emerald-700 text-emerald-200 bg-emerald-900/60 hover:border-emerald-400 hover:shadow-[0_0_10px_rgba(52,211,153,0.35)] disabled:opacity-60 transition"
        >
          {loading === "unblock" ? "Enviando..." : "Desbloquear Veículo"}
        </button>
      </div>
      {message && (
        <div className="text-[11px] text-slate-300 bg-slate-800 border border-slate-700 rounded px-2 py-1">
          {message}
        </div>
      )}
    </div>
  );
}
