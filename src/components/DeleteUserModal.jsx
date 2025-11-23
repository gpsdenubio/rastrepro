import React, { useState } from "react";
import { deleteUser } from "../services/traccar";

export default function DeleteUserModal({ open, onClose, onDeleted, user }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError("");
    try {
      await deleteUser(user.id);
      onDeleted?.();
      onClose();
    } catch (err) {
      const msg = err?.response?.data || err?.message || "Erro ao excluir usuário";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-2">
          Confirmar exclusão
        </h3>
        <p className="text-sm text-slate-600">
          Tem certeza que deseja excluir o usuário{" "}
          <span className="font-semibold">{user?.name || "sem nome"}</span>?
        </p>

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-100 p-2 rounded mt-3">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600"
            disabled={loading}
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
