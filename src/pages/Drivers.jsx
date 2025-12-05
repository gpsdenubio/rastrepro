// src/pages/Drivers.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  getDrivers,
  createDriver,
  updateDriver,
  deleteDriver,
  getDevices,
  assignDriverToDevice,
  removeDriverFromDevice,
  getPermissions,
} from "../services/traccar";
import { useAuth } from "../context/AuthContext";

const emptyForm = { name: "", uniqueId: "", license: "", phone: "", notes: "" };

function DriverFormModal({ open, onClose, onSave, driver }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(driver);

  useEffect(() => {
    if (driver) {
      setForm({
        name: driver.name || "",
        uniqueId: driver.uniqueId || "",
        license: driver.attributes?.license || "",
        phone: driver.attributes?.phone || "",
        notes: driver.attributes?.notes || "",
      });
    } else {
      setForm(emptyForm);
    }
  }, [driver]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg p-5 text-slate-100">
        <h2 className="text-xl font-semibold mb-3">{isEdit ? "Editar motorista" : "Novo motorista"}</h2>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-300">Nome *</span>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-300">Identificador único *</span>
              <input
                name="uniqueId"
                value={form.uniqueId}
                onChange={handleChange}
                required
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-300">CNH / Licença</span>
              <input
                name="license"
                value={form.license}
                onChange={handleChange}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-300">Telefone</span>
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-300">Observações</span>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={3}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 resize-none"
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-[10px] border border-slate-700 text-slate-200 hover:border-sky-500/60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-[10px] bg-sky-500 text-slate-900 font-semibold shadow-[0_0_16px_rgba(14,165,233,0.45)] hover:bg-sky-400 disabled:opacity-60"
            >
              {saving ? "Salvando..." : isEdit ? "Salvar" : "Cadastrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Drivers() {
  const { can } = useAuth();
  const canView = can("drivers.view");
  const canManage = can("drivers.manage");
  const [drivers, setDrivers] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [savingAssignment, setSavingAssignment] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [drvList, devList, perms] = await Promise.all([
        getDrivers(),
        getDevices(),
        getPermissions({ all: true }),
      ]);
      const permsList = Array.isArray(perms) ? perms : [];
      const driverByDevice = {};
      permsList.forEach((p) => {
        if (p?.driverId != null && p?.deviceId != null) {
          driverByDevice[p.deviceId] = p.driverId;
        }
      });
      const driversMap = {};
      (Array.isArray(drvList) ? drvList : []).forEach((d) => {
        driversMap[d.id] = d;
      });
      const devicesWithDriver = (Array.isArray(devList) ? devList : []).map((d) => {
        const driverId = driverByDevice[d.id] ?? d.driverId;
        const driver = driverId ? driversMap[driverId] : null;
        return {
          ...d,
          driverId: driverId || null,
          driverName: driver?.name || d.driverName,
          driverUniqueId: driver?.uniqueId || d.driverUniqueId,
        };
      });
      setDrivers(Array.isArray(drvList) ? drvList : []);
      setDevices(devicesWithDriver);
    } catch (err) {
      console.warn("Erro ao carregar motoristas:", err);
      setError("Não foi possível carregar motoristas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) return;
    loadData();
  }, [canView]);

  const assignmentsByDriver = useMemo(() => {
    const map = {};
    devices.forEach((d) => {
      if (d.driverId) {
        if (!map[d.driverId]) map[d.driverId] = [];
        map[d.driverId].push(d);
      }
    });
    return map;
  }, [devices]);

  const handleSave = async (form) => {
    if (!canManage) return;
    if (selectedDriver) {
      await updateDriver(selectedDriver.id, { ...selectedDriver, ...form });
    } else {
      await createDriver(form);
    }
    await loadData();
  };

  const handleDelete = async (driver) => {
    if (!canManage) return;
    if (!window.confirm(`Deseja excluir o motorista "${driver.name}"?`)) return;
    await deleteDriver(driver.id);
    await loadData();
  };

  const handleAssign = async (driverId, deviceId) => {
    if (!canManage) return;
    setSavingAssignment(deviceId || driverId || "assign");
    try {
      const targetDevId = deviceId ? Number(deviceId) : null;

      // Remove vínculos existentes desse motorista
      const currentDevices = devices.filter((d) => d.driverId === driverId);
      await Promise.all(
        currentDevices.map((d) => removeDriverFromDevice(d.id, driverId).catch(() => {}))
      );

      if (targetDevId) {
        const currentDriverForDevice = devices.find((d) => d.id === targetDevId)?.driverId;
        if (currentDriverForDevice && currentDriverForDevice !== driverId) {
          await removeDriverFromDevice(targetDevId, currentDriverForDevice).catch(() => {});
        }
        await assignDriverToDevice(targetDevId, driverId);
      }
      await loadData();
    } catch (err) {
      console.warn("Erro ao vincular motorista:", err);
      setError("Não foi possível atualizar vínculo do motorista.");
    } finally {
      setSavingAssignment(null);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 bg-slate-950 text-slate-100">
      {!canView ? (
        <>
          <h1 className="text-2xl font-bold">Motoristas</h1>
          <p className="text-sm text-red-300 mt-2">Você não tem permissão para visualizar motoristas.</p>
        </>
      ) : (
        <>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Motoristas</h1>
          <p className="text-sm text-slate-400">Gerencie motoristas e vincule aos veículos.</p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <button
              onClick={() => {
                setSelectedDriver(null);
                setModalOpen(true);
              }}
              className="bg-sky-500 hover:bg-sky-400 text-slate-900 px-4 py-2 h-[46px] rounded-[10px] font-semibold shadow-[0_0_16px_rgba(14,165,233,0.45)] transition"
            >
              + Novo motorista
            </button>
          )}
        </div>
      </div>

      {error && <div className="text-sm text-red-400">{error}</div>}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.35)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-slate-200">
            <thead className="bg-slate-800/70 text-slate-300">
              <tr>
                <th className="text-left px-4 py-3 border-b border-slate-800">Nome</th>
                <th className="text-left px-4 py-3 border-b border-slate-800">ID</th>
                <th className="text-left px-4 py-3 border-b border-slate-800">CNH</th>
                <th className="text-left px-4 py-3 border-b border-slate-800">Telefone</th>
                <th className="text-left px-4 py-3 border-b border-slate-800">Veículo vinculado</th>
                <th className="text-right px-4 py-3 border-b border-slate-800">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-slate-400">
                    Carregando...
                  </td>
                </tr>
              ) : drivers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-slate-400">
                    Nenhum motorista cadastrado.
                  </td>
                </tr>
              ) : (
                drivers.map((drv) => {
                  const devicesForDriver = assignmentsByDriver[drv.id] || [];
                  const currentDeviceId = devicesForDriver[0]?.id || "";
                  return (
                    <tr key={drv.id}>
                      <td className="px-4 py-3 font-semibold text-slate-100">{drv.name || "-"}</td>
                      <td className="px-4 py-3 text-slate-300">{drv.uniqueId || "-"}</td>
                      <td className="px-4 py-3 text-slate-300">{drv.attributes?.license || "-"}</td>
                      <td className="px-4 py-3 text-slate-300">{drv.attributes?.phone || "-"}</td>
                      <td className="px-4 py-3">
                        <select
                          value={currentDeviceId}
                          onChange={(e) => handleAssign(drv.id, e.target.value || null)}
                          className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-400"
                          disabled={savingAssignment !== null || !canManage}
                        >
                          <option value="">Sem vínculo</option>
                          {devices.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name || d.uniqueId || d.id}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {canManage ? (
                          <>
                            <button
                              onClick={() => {
                                setSelectedDriver(drv);
                                setModalOpen(true);
                              }}
                              className="px-3 py-1 rounded-[10px] border border-slate-700 text-slate-100 hover:border-sky-500/60 hover:shadow-[0_0_10px_rgba(14,165,233,0.35)] transition"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDelete(drv)}
                              className="px-3 py-1 rounded-[10px] border border-red-700 text-red-200 hover:border-red-400 transition"
                            >
                              Excluir
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">Sem permissão</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DriverFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        driver={selectedDriver}
      />
        </>
      )}
    </div>
  );
}
