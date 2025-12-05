// src/pages/Devices.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import DeviceModal from "../components/DeviceModal";
import DeleteDeviceModal from "../components/DeleteDeviceModal";
import {
  getDevices,
  getDrivers,
  assignDriverToDevice,
  removeDriverFromDevice,
} from "../services/traccar";
import DeviceBlockActions from "../components/DeviceBlockActions";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEventSocket } from "../hooks/useEventSocket";

const categoryIcon = (cat) => {
  const map = {
    car: "🚗",
    motorcycle: "🏍️",
    truck: "🚚",
    pickup: "🛻",
    van: "🚐",
    camionete: "🛻",
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
  const { can, user, authHeader } = useAuth();
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [commandLogs, setCommandLogs] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [assigning, setAssigning] = useState(null);
  const canView = can("devices.view");
  const canCreate = can("devices.create");
  const deviceLimit = Number(user?.attributes?.vehicleLimit ?? 0);
  const allowCreate = canCreate && (deviceLimit === 0 || devices.length < deviceLimit);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [list, drvList] = await Promise.all([
        getDevices(),
        getDrivers(),
      ]);
      const driversMap = {};
      (Array.isArray(drvList) ? drvList : []).forEach((d) => {
        driversMap[d.id] = d;
      });
      const devicesWithDriver = (list || []).map((d) => {
        const driverId = d.driverId;
        const driver = driverId ? driversMap[driverId] : null;
        return {
          ...d,
          driverId: driverId || null,
          driverName: driver?.name || d.driverName,
          driverUniqueId: driver?.uniqueId || d.driverUniqueId,
        };
      });
      setDevices(devicesWithDriver);
      setDrivers(Array.isArray(drvList) ? drvList : []);
    } catch (error) {
      console.warn("Erro ao carregar dispositivos:", error);
      setError("Erro ao carregar dispositivos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canView) return;
    void loadDevices();
  }, [canView, loadDevices]);

  const handleNew = () => {
    if (!canCreate) return;
    navigate("/devices/new");
  };

  const handleEdit = (device) => {
    if (!can("devices.edit")) return;
    setSelected(device);
    setModalOpen(true);
  };

  const handleDelete = (device) => {
    if (!can("devices.delete")) return;
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

  const onlineCount = useMemo(
    () => devices.filter((d) => d.status === "online").length,
    [devices]
  );
  const offlineCount = useMemo(
    () => devices.filter((d) => d.status && d.status !== "online").length,
    [devices]
  );
  const unknownCount = useMemo(
    () => devices.filter((d) => !d.status).length,
    [devices]
  );

  useEventSocket({
    authHeader,
    onMessage: (msg) => {
      if (msg?.positions?.length) {
        const positions = msg.positions || [];
        setDevices((prev) => {
          const byId = new Map((prev || []).map((d) => [d.id, d]));
          positions.forEach((p) => {
            if (!p?.deviceId) return;
            const current = byId.get(p.deviceId);
            if (!current) return;
            byId.set(p.deviceId, {
              ...current,
              positionId: p.id ?? current.positionId,
              lastUpdate: p.serverTime || p.deviceTime || p.fixTime || current.lastUpdate,
              latitude: p.latitude ?? current.latitude,
              longitude: p.longitude ?? current.longitude,
              address: p.address || current.address,
              attributes: { ...(current.attributes || {}), ...(p.attributes || {}) },
            });
          });
          return Array.from(byId.values());
        });
      }
      if (msg?.devices?.length) {
        setDevices((prev) => {
          const byId = new Map((prev || []).map((d) => [d.id, d]));
          (msg.devices || []).forEach((d) => {
            const existing = byId.get(d.id) || {};
            byId.set(d.id, { ...existing, ...d });
          });
          return Array.from(byId.values());
        });
      }
    },
  });

  const handleLog = (entry) => {
    setCommandLogs((prev) => [entry, ...prev].slice(0, 20));
  };

  const handleAssignDriver = async (deviceId, driverId) => {
    if (!can("devices.edit")) return;
    setAssigning(deviceId);
    try {
      const current = devices.find((d) => d.id === deviceId);
      const currentDriverId = current?.driverId;

      // Se for trocar, remove o vínculo anterior
      if (currentDriverId && currentDriverId !== Number(driverId)) {
        await removeDriverFromDevice(deviceId, currentDriverId).catch(() => {});
      }

      if (driverId) {
        await assignDriverToDevice(deviceId, Number(driverId));
      } else if (currentDriverId) {
        await removeDriverFromDevice(deviceId, currentDriverId);
      }
      await loadDevices();
    } catch (err) {
      console.warn("Não foi possível vincular motorista:", err);
      setError("Não foi possível vincular motorista.");
    } finally {
      setAssigning(null);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 bg-slate-950 text-slate-100">
      {!canView ? (
        <>
          <h1 className="text-2xl font-bold">Dispositivos</h1>
          <p className="text-sm text-red-300 mt-2">Você não tem permissão para visualizar dispositivos.</p>
        </>
      ) : (
        <>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-100">Dispositivos</h1>
              <p className="text-sm text-slate-400">Gerencie veículos e comandos.</p>
            </div>
            {allowCreate && (
              <button
                onClick={handleNew}
                className="bg-sky-500 hover:bg-sky-400 text-slate-900 px-4 py-2 h-[46px] rounded-[10px] font-semibold shadow-[0_0_16px_rgba(14,165,233,0.45)] transition"
              >
                + Novo dispositivo
              </button>
            )}
            {canCreate && !allowCreate && (
              <span className="text-xs text-red-300">
                Limite de dispositivos atingido para este usuário.
              </span>
            )}
          </div>

          {error && <div className="text-red-400 text-sm">{error}</div>}

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
              <div className="text-xs text-slate-400">Total</div>
              <div className="text-xl font-semibold text-slate-100">{devices.length}</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
              <div className="text-xs text-slate-400">Online</div>
              <div className="text-xl font-semibold text-emerald-400">{onlineCount}</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
              <div className="text-xs text-slate-400">Offline</div>
              <div className="text-xl font-semibold text-red-300">{offlineCount}</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
              <div className="text-xs text-slate-400">Desconhecido</div>
              <div className="text-xl font-semibold text-slate-100">{unknownCount}</div>
            </div>
          </div>

      <div className="bg-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.35)] rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-auto max-h-[70vh]">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-800">
                <th className="py-3 px-4"> </th>
                <th className="py-3 px-4">Nome</th>
                <th className="py-3 px-4">IMEI</th>
                <th className="py-3 px-4">Modelo</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4">Placa</th>
                <th className="py-3 px-4">Motorista</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Bloqueio</th>
                <th className="py-3 px-4">Última atualização</th>
                <th className="py-3 px-4 text-right">Ações</th>
                <th className="py-3 px-4 text-right">Comandos</th>
              </tr>
            </thead>
            <tbody className="[&>tr]:border-b [&>tr]:border-slate-800 text-slate-200">
              {loading ? (
                <tr>
                  <td className="py-4 px-4" colSpan={13}>Carregando...</td>
                </tr>
              ) : tableRows.length === 0 ? (
                <tr>
                  <td className="py-4 px-4" colSpan={13}>Nenhum dispositivo cadastrado.</td>
                </tr>
              ) : (
                tableRows.map((d) => (
                  <tr key={d.id} className="last:border-0">
                    <td className="py-3 px-4 text-lg">{d.categoryIcon}</td>
                    <td className="py-3 px-4 font-semibold text-slate-100">{d.name}</td>
                    <td className="py-3 px-4">{d.uniqueId}</td>
                    <td className="py-3 px-4">{d.modelAttr}</td>
                    <td className="py-3 px-4 capitalize">{d.category || "-"}</td>
                    <td className="py-3 px-4">{d.plate}</td>
                    <td className="py-3 px-4">
                      {can("devices.edit") ? (
                        <select
                          value={d.driverId || ""}
                          onChange={(e) => handleAssignDriver(d.id, e.target.value || null)}
                          className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-400"
                          disabled={assigning === d.id}
                        >
                          <option value="">Sem motorista</option>
                          {drivers.map((drv) => (
                            <option key={drv.id} value={drv.id}>
                              {drv.name || drv.uniqueId || drv.id}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-slate-400">Sem permissão</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          d.status === "online"
                            ? "bg-emerald-900/60 text-emerald-200 border border-emerald-700"
                            : d.status
                            ? "bg-red-900/60 text-red-200 border border-red-700"
                            : "bg-slate-800 text-slate-200 border border-slate-700"
                        }`}
                      >
                        {d.status === "online" ? "Online" : d.status ? "Offline" : "Desconhecido"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {d.attributes?.engine === "stop" ? (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-900/60 text-red-200 border border-red-700">
                          Bloqueado
                        </span>
                      ) : d.attributes?.engine === "resume" ? (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-emerald-900/60 text-emerald-200 border border-emerald-700">
                          Desbloqueado
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">{formatDateTime(d.lastUpdate)}</td>
                    <td className="py-3 px-4 text-right space-x-2">
                      {can("devices.edit") && (
                        <button
                          onClick={() => handleEdit(d)}
                          className="px-3 py-1 rounded-[10px] border border-slate-700 text-slate-100 hover:border-sky-500/60 hover:shadow-[0_0_10px_rgba(14,165,233,0.35)] transition"
                        >
                          Editar
                        </button>
                      )}
                      {can("devices.delete") && (
                        <button
                          onClick={() => handleDelete(d)}
                          className="px-3 py-1 rounded-[10px] border border-red-700 text-red-200 hover:border-red-400 transition"
                        >
                          Excluir
                        </button>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {can("commands.block") && (
                        <DeviceBlockActions
                          device={d}
                          onLog={handleLog}
                          onDeviceUpdate={(updated) => {
                            if (!updated) return;
                            setDevices((prev) =>
                              prev.map((dev) => (dev.id === updated.id ? updated : dev))
                            );
                          }}
                        />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {commandLogs.length > 0 && (
        <div className="bg-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.35)] rounded-2xl border border-slate-800 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100">Logs de bloqueio/desbloqueio</h3>
            <button
              onClick={() => setCommandLogs([])}
              className="text-xs text-slate-400 hover:text-sky-300"
            >
              Limpar
            </button>
          </div>
          <div className="space-y-1 max-h-60 overflow-auto text-xs text-slate-300">
            {commandLogs.map((log, idx) => (
              <div key={idx} className="flex items-start justify-between border-b border-slate-800 py-1">
                <div>
                  <div className="font-semibold">{log.deviceName}</div>
                  <div className="text-slate-400">{log.action} — {log.status}</div>
                  {log.error && <div className="text-red-400">{log.error}</div>}
                </div>
                <div className="text-[11px] text-slate-400">
                  {log.time ? new Date(log.time).toLocaleTimeString() : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
        </>
      )}
    </div>
  );
}
