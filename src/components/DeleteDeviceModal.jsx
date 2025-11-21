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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-xl font-semibold text-slate-800 mb-3">Excluir dispositivo</h2>
        <p className="text-sm text-slate-600 mb-4">
          Tem certeza que deseja excluir o dispositivo <strong>{device?.name}</strong>? Essa ação não pode ser desfeita.
        </p>

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-100 p-2 rounded mb-3">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600"
          >
            Cancelar
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? "Excluindo..." : "Excluir"}
          </button>
        </div>
      </div>
    </div>
  );
}
