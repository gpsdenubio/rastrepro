import React, { useEffect, useMemo, useState } from "react";
import {
  addUserDevicePermission,
  removeUserDevicePermission,
} from "../services/traccar";

export default function UserDevicesModal({
  open,
  onClose,
  user,
  devices = [],
  assigned = new Set(),
  allowedDevices = [],
  onSaved,
  onSavedSelection,
}) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const normalized = new Set(Array.from(assigned || []).map((v) => Number(v)));
    setSelectedIds(normalized);
    setError("");
  }, [assigned, open, user]);

  const handleToggle = (id) => {
    const normalizedId = Number(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(normalizedId)) {
        next.delete(normalizedId);
      } else {
        next.add(normalizedId);
      }
      return next;
    });
  };

  const sortedDevices = useMemo(() => {
    const base = allowedDevices.length ? allowedDevices : devices;
    return [...base].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [allowedDevices, devices]);

  const handleSave = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError("");
    try {
      const normalizeId = (v) => Number(v);
      const current = new Set(Array.from(assigned || []).map(normalizeId));
      const next = new Set(Array.from(selectedIds).map(normalizeId));

      const allowedIds = new Set(sortedDevices.map((d) => Number(d.id)));
      const toAdd = [...next].filter((id) => allowedIds.has(id) && !current.has(id));
      const toRemove = [...current].filter((id) => allowedIds.has(id) && !next.has(id));

      await Promise.all([
        ...toAdd.map((id) => addUserDevicePermission(user.id, id)),
        ...toRemove.map((id) => removeUserDevicePermission(user.id, id)),
      ]);

      const finalSet = new Set(next);
      onSavedSelection?.(user.id, finalSet);
      onSaved?.();
      onClose();
    } catch (err) {
      const msg = err?.response?.data || err?.message || "Erro ao salvar permissões";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-950 text-slate-100 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] w-full max-w-3xl max-h-[90vh] border border-slate-800 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-sky-700/30 via-slate-900 to-slate-950 border-b border-slate-800">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400 mb-1">
              Controle de acesso
            </p>
            <h2 className="text-xl font-semibold leading-tight">Dispositivos do usuário</h2>
            <p className="text-sm text-slate-400">
              {user?.name || "Usuário"} — selecione quais dispositivos ele pode acessar.
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-10 w-10 rounded-xl border border-slate-700 bg-slate-900 hover:border-sky-500/60 hover:shadow-[0_0_16px_rgba(14,165,233,0.4)] text-slate-100 transition"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 text-sm text-red-300 bg-red-900/40 border border-red-700 p-3 rounded-xl">
            {error}
          </div>
        )}

        <div className="flex-1 m-6 mt-4 rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
          <div className="overflow-auto max-h-[60vh]">
            <table className="min-w-full text-sm text-slate-200">
              <thead className="bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10 border-b border-slate-800">
                <tr className="text-left text-slate-400">
                  <th className="py-3 px-4 w-12"></th>
                  <th className="py-3 px-4">Nome</th>
                  <th className="py-3 px-4">IMEI</th>
                  <th className="py-3 px-4">Categoria</th>
                </tr>
              </thead>
              <tbody>
                {sortedDevices.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(d.id)}
                          onChange={() => handleToggle(d.id)}
                          className="h-4 w-4 accent-sky-500 rounded"
                        />
                        <span className="text-xs text-slate-500"># {d.id}</span>
                      </label>
                    </td>
                    <td className="py-3 px-4 font-medium">{d.name || "-"}</td>
                    <td className="py-3 px-4 text-slate-300">{d.uniqueId || "-"}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700">
                        {d.category ? d.category : "—"}
                      </span>
                    </td>
                  </tr>
                ))}
                {sortedDevices.length === 0 && (
                  <tr>
                    <td className="py-4 px-4 text-center text-slate-400" colSpan={4}>
                      Nenhum dispositivo cadastrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-[10px] h-[46px] border border-slate-700 bg-slate-900 text-slate-100 hover:border-sky-500/60 hover:shadow-[0_0_12px_rgba(14,165,233,0.35)]"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 rounded-[10px] h-[46px] bg-sky-500 text-slate-900 font-semibold hover:bg-sky-400 disabled:opacity-60 shadow-[0_0_16px_rgba(14,165,233,0.45)]"
          >
            {loading ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
