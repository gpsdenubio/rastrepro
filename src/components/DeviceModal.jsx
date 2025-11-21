import React, { useEffect, useState } from "react";
import { createDevice, updateDevice } from "../services/traccar";

const categories = [
  { value: "car", label: "Carro" },
  { value: "motorcycle", label: "Moto" },
  { value: "truck", label: "Caminhão" },
  { value: "bus", label: "Ônibus" },
  { value: "boat", label: "Barco" },
  { value: "person", label: "Pessoa" },
  { value: "animal", label: "Animal" },
  { value: "other", label: "Outro" },
];

export default function DeviceModal({ open, onClose, onSaved, device }) {
  const isEdit = Boolean(device?.id);
  const [form, setForm] = useState({
    name: "",
    uniqueId: "",
    model: "",
    category: "car",
    plate: "",
    phone: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (device) {
      setForm({
        name: device.name || "",
        uniqueId: device.uniqueId || "",
        model: device.attributes?.modelo || device.model || "",
        category: device.category || "car",
        plate: device.attributes?.placa || "",
        phone: device.attributes?.linha || device.phone || "",
      });
    } else {
      setForm({
        name: "",
        uniqueId: "",
        model: "",
        category: "car",
        plate: "",
        phone: "",
      });
    }
    setError("");
  }, [device, open]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        id: device?.id,
        groupId: device?.groupId,
        calendarId: device?.calendarId,
        attributes: device?.attributes,
      };
      if (isEdit) {
        await updateDevice(device.id, payload);
      } else {
        await createDevice(form);
      }
      onSaved();
      onClose();
    } catch (err) {
      const msg = err?.response?.data || err?.message || "Erro ao salvar";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-slate-800">
            {isEdit ? "Editar dispositivo" : "Novo dispositivo"}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">✕</button>
        </div>

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-100 p-2 rounded mb-3">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col text-sm">
              Nome
              <input
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                className="mt-1 border rounded-lg px-3 py-2"
                required
              />
            </label>
            <label className="flex flex-col text-sm">
              IMEI (uniqueId)
              <input
                value={form.uniqueId}
                onChange={(e) => handleChange("uniqueId", e.target.value)}
                className="mt-1 border rounded-lg px-3 py-2"
                required
              />
            </label>
            <label className="flex flex-col text-sm">
              Modelo
              <input
                value={form.model}
                onChange={(e) => handleChange("model", e.target.value)}
                className="mt-1 border rounded-lg px-3 py-2"
              />
            </label>
            <label className="flex flex-col text-sm">
              Categoria
              <select
                value={form.category}
                onChange={(e) => handleChange("category", e.target.value)}
                className="mt-1 border rounded-lg px-3 py-2"
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-sm">
              Placa
              <input
                value={form.plate}
                onChange={(e) => handleChange("plate", e.target.value)}
                className="mt-1 border rounded-lg px-3 py-2"
              />
            </label>
            <label className="flex flex-col text-sm">
              Linha telefônica
              <input
                value={form.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                className="mt-1 border rounded-lg px-3 py-2"
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-sky-600 text-white font-semibold hover:bg-sky-700 disabled:opacity-60"
            >
              {saving ? "Salvando..." : isEdit ? "Salvar" : "Criar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
