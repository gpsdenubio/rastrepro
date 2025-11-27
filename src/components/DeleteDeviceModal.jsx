import React, { useState } from "react";
import { deleteDevice } from "../services/traccar";

export default function DeleteDeviceModal({ open, onClose, onDeleted, device }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    if (!device?.id) return;
    setLoading(true);
    setError("");
    try {
      await deleteDevice(device.id);
      onDeleted();
      onClose();
    } catch (err) {
      const msg = err?.response?.data || err?.message || "Erro ao excluir";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.55)] w-full max-w-md p-6 border border-slate-800 text-slate-100">
        <h2 className="text-xl font-semibold mb-3">Excluir dispositivo</h2>
        <p className="text-sm text-slate-400 mb-4">
          Tem certeza que deseja excluir o dispositivo <strong className="text-slate-100">{device?.name}</strong>? Essa ação não pode ser desfeita.
        </p>

        {error && (
          <div className="text-sm text-red-300 bg-red-900/40 border border-red-700 p-2 rounded mb-3">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 h-[46px] rounded-[10px] border border-slate-700 bg-slate-800 text-slate-100 hover:border-sky-500/60 hover:shadow-[0_0_12px_rgba(14,165,233,0.35)]"
          >
            Cancelar
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="px-4 py-2 h-[46px] rounded-[10px] bg-red-600 text-white font-semibold hover:bg-red-500 disabled:opacity-60 shadow-[0_0_16px_rgba(239,68,68,0.35)]"
          >
            {loading ? "Excluindo..." : "Excluir"}
          </button>
        </div>
      </div>
    </div>
  );
}
