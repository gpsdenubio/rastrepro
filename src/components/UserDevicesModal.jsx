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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-800">
              Dispositivos do usuário
            </h2>
            <p className="text-sm text-slate-500">
              {user?.name || "Usuário"} — selecione quais dispositivos ele pode acessar.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
            ✕
          </button>
        </div>

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-100 p-2 rounded mb-3">
            {error}
          </div>
        )}

        <div className="max-h-[60vh] overflow-auto border rounded-xl">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-slate-500 border-b">
                <th className="py-3 px-4 w-10"></th>
                <th className="py-3 px-4">Nome</th>
                <th className="py-3 px-4">IMEI</th>
                <th className="py-3 px-4">Categoria</th>
              </tr>
            </thead>
            <tbody>
              {sortedDevices.map((d) => (
                <tr key={d.id} className="border-b last:border-0">
                  <td className="py-2 px-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(d.id)}
                      onChange={() => handleToggle(d.id)}
                    />
                  </td>
                  <td className="py-2 px-4">{d.name || "-"}</td>
                  <td className="py-2 px-4">{d.uniqueId || "-"}</td>
                  <td className="py-2 px-4 capitalize">{d.category || "-"}</td>
                </tr>
              ))}
              {sortedDevices.length === 0 && (
                <tr>
                  <td className="py-4 px-4" colSpan={4}>
                    Nenhum dispositivo cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-sky-600 text-white font-semibold hover:bg-sky-700 disabled:opacity-60"
          >
            {loading ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
