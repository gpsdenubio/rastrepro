// src/pages/Devices.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Battery,
  Car,
  Clock3,
  Gauge,
  Image as ImageIcon,
  Power,
  WifiOff,
  ChevronDown,
  ChevronUp,
  Hash,
  MapPin,
  Navigation2,
  Ruler,
  Satellite,
  Network,
} from "lucide-react";
import DeviceModal from "../components/DeviceModal";
import DeleteDeviceModal from "../components/DeleteDeviceModal";
import {
  getDevices,
  getDrivers,
  assignDriverToDevice,
  removeDriverFromDevice,
  getPositions,
  updateDevice,
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
  const [devices, setDevices] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("cache:devices");
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return [];
        }
      }
    }
    return [];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [commandLogs, setCommandLogs] = useState([]);
  const [drivers, setDrivers] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("cache:drivers");
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return [];
        }
      }
    }
    return [];
  });
  const [assigning, setAssigning] = useState(null);
  const canView = can("devices.view");
  const canCreate = can("devices.create");
  const deviceLimit = Number(user?.attributes?.vehicleLimit ?? 0);
  const allowCreate = canCreate && (deviceLimit === 0 || devices.length < deviceLimit);
  const firstLoadDoneRef = useRef(false);
  const [expandedId, setExpandedId] = useState(null);

  const loadDevices = useCallback(async () => {
    const shouldShowLoading = !firstLoadDoneRef.current && devices.length === 0;
    if (shouldShowLoading) setLoading(true);
    setError("");
    try {
      const [list, drvList, positions] = await Promise.all([
        getDevices(),
        getDrivers(),
        getPositions().catch(() => []),
      ]);
      const posByDevice = new Map(
        (positions || []).map((p) => [p.deviceId, p])
      );
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
          lastPosition: posByDevice.get(d.id) || d.lastPosition || null,
          address: d.address || posByDevice.get(d.id)?.address || d.attributes?.address || d.attributes?.formattedAddress || d.address,
        };
      });
      setDevices(devicesWithDriver);
      setDrivers(Array.isArray(drvList) ? drvList : []);
    } catch (error) {
      console.warn("Erro ao carregar dispositivos:", error);
      setError("Erro ao carregar dispositivos");
    } finally {
      setLoading(false);
      firstLoadDoneRef.current = true;
    }
  }, [devices.length]);

  useEffect(() => {
    if (!canView) return;
    void loadDevices();
  }, [canView, loadDevices]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("cache:devices", JSON.stringify(devices));
    }
  }, [devices]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("cache:drivers", JSON.stringify(drivers));
    }
  }, [drivers]);

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
  const vehicleBatteryValue = (d) => {
    const attrs = d?.attributes || {};
    const raw =
      attrs.power ??
      attrs.charge ??
      attrs["battery.vehicle"];
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
  };
  const deviceBatteryValue = (d) => {
    const attrs = d?.attributes || {};
    const raw =
      attrs.battery ??
      attrs.batteryLevel ??
      attrs["battery.device"];
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
  };

  const buildPositionAttributes = (d) => {
    const pos = d?.lastPosition || d;
    const get = (key) => pos?.[key] ?? pos?.attributes?.[key];
  const label = (key) =>
    ({
      id: "Identificador",
      deviceId: "ID do Dispositivo",
      protocol: "Protocolo",
      serverTime: "Hora do Servidor",
      deviceTime: "Hora do Dispositivo",
      fixTime: "Hora GPS",
      valid: "Válido",
      latitude: "Latitude",
      longitude: "Longitude",
      altitude: "Altitude",
      speed: "Velocidade",
      course: "Direção",
      accuracy: "Precisão",
      network: "Rede",
      geofenceIds: "Cerca Virtual",
      adc1: "ADC1",
      distance: "Distância",
      totalDistance: "Distância Total",
      motion: "Movimento",
      hours: "Horas",
    }[key] || key);
  const formatTime = (val) => {
    if (!val) return null;
    const dte = new Date(val);
    if (Number.isNaN(dte.getTime())) return val;
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "short",
      timeStyle: "medium",
    }).format(dte);
  };

  const formatHours = (val) => {
    if (!Number.isFinite(Number(val))) return val;
    const num = Number(val);
    // Se vier em milissegundos ou segundos, converte para horas.
    if (num > 1e6) return (num / 3600000).toFixed(2); // ms -> horas
    if (num > 1e3) return (num / 3600).toFixed(2); // segundos -> horas
    return num;
  };

  const formatDistanceVal = (val) => {
    if (!Number.isFinite(Number(val))) return val;
    const num = Number(val);
    return `${(num / 1000).toFixed(2)} km`;
  };

  const formatMotion = (val) => {
    if (val === true || val === "true" || val === 1) return "Sim";
    if (val === false || val === "false" || val === 0) return "Não";
    return val;
  };

  const formatValid = (val) => {
    if (val === true || val === "true" || val === 1) return "Sim";
    if (val === false || val === "false" || val === 0) return "Não";
    return val;
  };

  const entries = [
    { key: "id", label: label("id"), icon: <Hash size={16} />, value: get("id") ?? get("positionId") },
    { key: "deviceId", label: label("deviceId"), icon: <Hash size={16} />, value: get("deviceId") ?? d?.id },
    { key: "protocol", label: label("protocol"), icon: <Satellite size={16} />, value: get("protocol") },
    { key: "fixTime", label: label("fixTime"), icon: <Clock3 size={16} />, value: formatTime(get("fixTime")) },
    { key: "valid", label: label("valid"), icon: <Activity size={16} />, value: formatValid(get("valid")) },
    { key: "latitude", label: label("latitude"), icon: <MapPin size={16} />, value: get("latitude") },
      { key: "longitude", label: label("longitude"), icon: <MapPin size={16} />, value: get("longitude") },
    { key: "altitude", label: label("altitude"), icon: <Ruler size={16} />, value: get("altitude") },
    { key: "speed", label: label("speed"), icon: <Gauge size={16} />, value: get("speed") },
    { key: "course", label: label("course"), icon: <Navigation2 size={16} />, value: get("course") },
    { key: "accuracy", label: label("accuracy"), icon: <Ruler size={16} />, value: get("accuracy") },
    { key: "network", label: label("network"), icon: <Network size={16} />, value: get("network") },
    {
      key: "geofenceIds",
      label: label("geofenceIds"),
      icon: <Hash size={16} />,
      value: (() => {
        const v = get("geofenceIds");
        if (Array.isArray(v)) return v.join(", ");
        return v;
      })(),
    },
    { key: "adc1", label: label("adc1"), icon: <Battery size={16} />, value: get("adc1") },
    { key: "distance", label: label("distance"), icon: <Ruler size={16} />, value: formatDistanceVal(get("distance")) },
    { key: "totalDistance", label: label("totalDistance"), icon: <Ruler size={16} />, value: formatDistanceVal(get("totalDistance")) },
    { key: "motion", label: label("motion"), icon: <Activity size={16} />, value: formatMotion(get("motion")) },
    { key: "hours", label: label("hours"), icon: <Clock3 size={16} />, value: formatHours(get("hours")) },
  ];
  const filtered = entries.filter((e) => e.value !== undefined && e.value !== null && e.value !== "");

  const combined = [];
  filtered.forEach((item) => {
    if (item.key === "longitude") {
      return;
    }
    if (item.key === "latitude") {
      const lon = filtered.find((e) => e.key === "longitude");
      combined.push({ ...item, combinedWith: lon });
    } else {
      combined.push(item);
    }
  });

  return combined;
};



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
              lastPosition: p,
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

          <div className="space-y-3">
            {tableRows.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-6 text-slate-300 text-sm text-center">
                Nenhum dispositivo cadastrado.
              </div>
            ) : (
              tableRows.map((d) => {
                const lastPos = d.lastPosition || {};
                const status = d.status || "unknown";
                const moving = status === "online" && Number(lastPos?.speed ?? d?.attributes?.speed ?? d?.speed) > 1;
                const statusIcon =
                  status === "online"
                    ? <Activity size={18} className="text-emerald-400" />
                    : status === "offline"
                    ? <WifiOff size={18} className="text-red-300" />
                    : <Power size={18} className="text-slate-300" />;
                const vBatt = vehicleBatteryValue(d);
                const dBatt = deviceBatteryValue(d);
                const fixTime =
                  lastPos.fixTime ||
                  lastPos.deviceTime ||
                  lastPos.serverTime ||
                  d.fixTime ||
                  d.deviceTime ||
                  d.serverTime ||
                  d.lastUpdate;
                const lastUpdate =
                  fixTime && !Number.isNaN(new Date(fixTime).getTime())
                    ? new Intl.DateTimeFormat("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                        dateStyle: "short",
                        timeStyle: "medium",
                      }).format(new Date(fixTime))
                    : null;
                const speedVal = Number(lastPos?.speed ?? d?.speed ?? d?.attributes?.speed);
                const hasSpeed = Number.isFinite(speedVal);
                const protocol = lastPos?.protocol || d?.protocol;
                const photoUrl = d?.attributes?.photoUrl;
                const expanded = expandedId === d.id;

                return (
                  <div
                    key={d.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
                  >
                    <div className="flex items-center gap-3 p-4">
                      <button
                        type="button"
                        onClick={() => handleEdit(d)}
                        className="h-14 w-14 rounded-2xl overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center"
                        title="Trocar foto"
                      >
                        {photoUrl ? (
                          <img
                            src={photoUrl}
                            alt={d.name || "Foto do dispositivo"}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-300 text-xs">
                            <ImageIcon size={18} className="mb-1" />
                            <span>Foto</span>
                          </div>
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-lg">{d.categoryIcon}</span>
                            <span className="font-semibold text-slate-100 truncate">{d.name || "-"}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setExpandedId(expanded ? null : d.id)}
                            className="text-slate-300 hover:text-sky-300"
                            aria-label="Ver detalhes"
                          >
                            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-300">
                          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-800 border border-slate-700">
                            {statusIcon}
                            {moving && <span className="text-[10px] text-emerald-300">Movendo</span>}
                          </span>
                          {protocol && (
                            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-800 border border-slate-700">
                              <Satellite size={16} className="text-slate-200" />
                              <span className="font-semibold">{protocol}</span>
                            </span>
                          )}
                          {Number.isFinite(vBatt) && (
                            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-800 border border-slate-700">
                              <Car size={16} className="text-sky-300" />
                              <span className="font-semibold">{vBatt.toFixed(1)}V</span>
                            </span>
                          )}
                          {Number.isFinite(dBatt) && (
                            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-800 border border-slate-700">
                              <Battery size={16} className="text-emerald-300" />
                              <span className="font-semibold">{Math.round(dBatt)}%</span>
                            </span>
                          )}
                          {lastUpdate && (
                            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-800 border border-slate-700">
                              <Clock3 size={16} className="text-amber-300" />
                              <span className="font-semibold">{lastUpdate}</span>
                            </span>
                          )}
                          {hasSpeed && (
                            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-800 border border-slate-700">
                              <Gauge size={16} className="text-indigo-300" />
                              <span className="font-semibold">{`${speedVal.toFixed(1)} km/h`}</span>
                            </span>
                          )}
                          {d.address && (
                            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-800 border border-slate-700 max-w-full">
                              <MapPin size={16} className="text-sky-300 shrink-0" />
                              <span className="font-semibold truncate">{d.address}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {expanded && (
                      <div className="border-t border-slate-800 px-4 pb-4 pt-3 space-y-3 text-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 text-xs">IMEI</span>
                            <span className="font-semibold text-slate-100">{d.uniqueId || "-"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 text-xs">Modelo</span>
                            <span className="font-semibold text-slate-100">{d.modelAttr}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 text-xs">Placa</span>
                            <span className="font-semibold text-slate-100">{d.plate}</span>
                          </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-xs">Linha</span>
                          <span className="font-semibold text-slate-100">{d.lineAttr}</span>
                        </div>
                        {d.address && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 text-xs">Endereço</span>
                            <span className="font-semibold text-slate-100 break-words">{d.address}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-xs">Status</span>
                          <span className="font-semibold text-slate-100 capitalize">
                            {d.status || "desconhecido"}
                          </span>
                          </div>
                        </div>

                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 text-xs">Motorista</span>
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
                          </div>

                          <div className="flex items-center gap-2">
                            {can("devices.edit") && (
                              <button
                                onClick={() => handleEdit(d)}
                                className="h-10 w-10 rounded-xl border border-slate-700 text-slate-100 hover:border-sky-500/60 hover:shadow-[0_0_10px_rgba(14,165,233,0.35)] transition"
                                title="Editar"
                              >
                                ✏️
                              </button>
                            )}
                            {can("devices.delete") && (
                              <button
                                onClick={() => handleDelete(d)}
                                className="h-10 w-10 rounded-xl border border-red-700 text-red-200 hover:border-red-400 transition"
                                title="Excluir"
                              >
                                🗑️
                              </button>
                            )}
                            {can("commands.block") && (
                              <div className="h-10">
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
                              </div>
                            )}
                          </div>
                        </div>

                        {(() => {
                          const attrs = buildPositionAttributes(d);
                          if (!attrs.length) return null;
                          return (
                            <section className="rounded-2xl border border-slate-800 bg-slate-900/80 shadow-[0_10px_30px_rgba(0,0,0,0.35)] p-3 space-y-2">
                              <div className="text-xs uppercase tracking-wide text-slate-400">Última posição</div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {attrs.map((item) => (
                                  <div
                                    key={item.key}
                                    className="flex items-start gap-2 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100"
                                  >
                                    <span className="text-sky-300">{item.icon}</span>
                                    {item.combinedWith ? (
                                      <div className="flex-1 grid grid-cols-2 gap-2 leading-tight">
                                        <div className="flex flex-col">
                                          <span className="text-[11px] uppercase tracking-wide text-slate-400">{item.label || item.key}</span>
                                          <span className="text-sm break-all">{String(item.value)}</span>
                                        </div>
                                        <div className="flex flex-col">
                                          <span className="text-[11px] uppercase tracking-wide text-slate-400">{item.combinedWith.label || item.combinedWith.key}</span>
                                          <span className="text-sm break-all">{String(item.combinedWith.value ?? "")}</span>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col leading-tight">
                                        <span className="text-[11px] uppercase tracking-wide text-slate-400">{item.label || item.key}</span>
                                        <span className="text-sm break-all">{String(item.value)}</span>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </section>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })
            )}
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
