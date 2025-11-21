// src/pages/Devices.jsx
import React, { useEffect, useMemo, useState } from "react";
import DeviceModal from "../components/DeviceModal";
import DeleteDeviceModal from "../components/DeleteDeviceModal";
import { getDevices } from "../services/traccar";

const categoryIcon = (cat) => {
  const map = {
    car: "🚗",
    motorcycle: "🏍️",
    truck: "🚚",
    bus: "🚌",
    boat: "⛵",
    person: "🧍",
    animal: "🐾",
    other: "📡",
  };
  return map[cat] || "📡";
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
};

export default function Devices() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const loadDevices = async () => {
    setLoading(true);
    setError("");
    try {
      const list = await getDevices();
      setDevices(list || []);
    } catch (err) {
      setError("Erro ao carregar dispositivos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const handleNew = () => {
    setSelected(null);
    setModalOpen(true);
  };

  const handleEdit = (device) => {
    setSelected(device);
    setModalOpen(true);
  };

  const handleDelete = (device) => {
    setSelected(device);
    setDeleteOpen(true);
  };

  const tableRows = useMemo(() => {
    return devices.map((d) => ({
      ...d,
      plate: d.attributes?.placa || "-",
      modelAttr: d.attributes?.modelo || d.model || "-",
      lineAttr: d.attributes?.linha || d.phone || "-",
      categoryIcon: categoryIcon(d.category),
    }));
  }, [devices]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Dispositivos</h1>
        <button
          onClick={handleNew}
          className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg font-semibold"
        >
          + Novo dispositivo
        </button>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <div className="bg-white shadow rounded-2xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-3 px-4"> </th>
                <th className="py-3 px-4">Nome</th>
                <th className="py-3 px-4">IMEI</th>
                <th className="py-3 px-4">Modelo</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4">Placa</th>
                <th className="py-3 px-4">Linha</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Última atualização</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="py-4 px-4" colSpan={10}>Carregando...</td>
                </tr>
              ) : tableRows.length === 0 ? (
                <tr>
                  <td className="py-4 px-4" colSpan={10}>Nenhum dispositivo cadastrado.</td>
                </tr>
              ) : (
                tableRows.map((d) => (
                  <tr key={d.id} className="border-b last:border-0">
                    <td className="py-3 px-4 text-lg">{d.categoryIcon}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{d.name}</td>
                    <td className="py-3 px-4">{d.uniqueId}</td>
                    <td className="py-3 px-4">{d.modelAttr}</td>
                    <td className="py-3 px-4 capitalize">{d.category || "-"}</td>
                    <td className="py-3 px-4">{d.plate}</td>
                    <td className="py-3 px-4">{d.lineAttr}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          d.status === "online"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {d.status === "online" ? "Online" : "Offline"}
                      </span>
                    </td>
                    <td className="py-3 px-4">{formatDateTime(d.lastUpdate)}</td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleEdit(d)}
                        className="px-3 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(d)}
                        className="px-3 py-1 rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DeviceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={loadDevices}
        device={selected}
      />

      <DeleteDeviceModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDeleted={loadDevices}
        device={selected}
      />
    </div>
  );
}
