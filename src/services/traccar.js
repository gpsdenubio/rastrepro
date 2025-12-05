// src/services/traccar.js
import api from "./api";
import { TRACCAR_BASE_URL } from "../config";

// Cache simples por coordenada para evitar requisições repetidas
const geocodeCache = new Map();

// Geocodificação reversa via Traccar
export async function getAddressFromTraccar(lat, lon) {
  if (lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) return "";
  const key = `${lat.toFixed(5)},${lon.toFixed(5)}`;
  if (geocodeCache.has(key)) return geocodeCache.get(key);

  try {
    const authHeader =
      typeof window !== "undefined" ? localStorage.getItem("authHeader") : null;
    const res = await fetch(
      `${TRACCAR_BASE_URL.replace(/\/$/, "")}/geocoder?latitude=${lat}&longitude=${lon}`,
      {
        credentials: "include",
        headers: authHeader ? { Authorization: authHeader } : {},
      }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const addr = text || "";
    geocodeCache.set(key, addr);
    return addr;
  } catch (err) {
    console.warn("Falha ao geocodificar", lat, lon, err);
    return "";
  }
}

async function enrichWithAddress(list, coordsExtractor) {
  return Promise.all(
    (list || []).map(async (item) => {
      if (item?.address) return item;
      const coords = coordsExtractor(item);
      if (!coords || coords.lat == null || coords.lon == null) return item;
      const address = await getAddressFromTraccar(coords.lat, coords.lon);
      return { ...item, address: address || item.address };
    })
  );
}

// ➤ Buscar dispositivos (nome, status, etc) e enriquecer com posição e motorista
export async function getDevices() {
  try {
    const [res, positions, driversRes, permsRes] = await Promise.all([
      api.get("/devices"),
      getPositions(),
      api.get("/drivers").catch(() => ({ data: [] })), // motoristas
      api.get("/permissions", { params: { all: true } }).catch(() => ({ data: [] })), // vínculos
    ]);

    const posByDevice = {};
    (positions || []).forEach((p) => {
      if (p?.deviceId != null) posByDevice[p.deviceId] = p;
    });

    const drivers = Array.isArray(driversRes?.data) ? driversRes.data : [];
    const driverById = drivers.reduce((acc, drv) => {
      if (drv?.id != null) acc[drv.id] = drv;
      return acc;
    }, {});

    const driverByDevice = {};
    const perms = Array.isArray(permsRes?.data) ? permsRes.data : [];
    perms.forEach((p) => {
      if (p?.driverId != null && p?.deviceId != null) {
        driverByDevice[p.deviceId] = p.driverId;
      }
    });

    const devices = Array.isArray(res.data) ? res.data : [];
    // Enriquecer com endereço e motorista
    return devices.map((d) => {
      const pos = posByDevice[d.id];
      const address = pos?.address || d.address;
      const driverId = driverByDevice[d.id];
      const driver = driverId ? driverById[driverId] : null;
      return {
        ...d,
        ...(address ? { address } : {}),
        driverId: driverId || d.driverId || null,
        driverName: driver?.name || d.driverName || null,
        driverUniqueId: driver?.uniqueId || d.driverUniqueId || null,
        driver,
      };
    });
  } catch (err) {
    console.error("Erro ao obter dispositivos:", err);
    return [];
  }
}

// ➤ Buscar dispositivo individual (útil para atualizar status de bloqueio)
export async function getDevice(id) {
  try {
    const res = await api.get(`/devices/${id}`);
    return res.data;
  } catch (err) {
    console.error("Erro ao obter dispositivo:", err);
    throw err;
  }
}

// ➤ Buscar posições (latitude, longitude, endereço etc)
export async function getPositions() {
  try {
    const res = await api.get("/positions");
    const positions = Array.isArray(res.data) ? res.data : [];
    return enrichWithAddress(positions, (p) => ({
      lat: p.latitude,
      lon: p.longitude,
    }));
  } catch (err) {
    console.error("Erro ao obter posições:", err);
    return [];
  }
}

// ➤ Relatórios oficiais do Traccar (route, trips, stops, events)
const reportEndpoints = {
  route: "/reports/route",
  trips: "/reports/trips",
  stops: "/reports/stops",
  events: "/reports/events",
  resumo: "/reports/summary",
  summary: "/reports/summary",
};

export async function runReport(type, deviceId, from, to) {
  if (!reportEndpoints[type]) {
    throw new Error(`Tipo de relatório inválido: ${type}`);
  }
  const res = await api.get(reportEndpoints[type], {
    params: { deviceId, from, to },
  });
  return res.data;
}

// ➤ CRUD de dispositivos (attributes somente com modelo, placa, linha)
export async function createDevice(data) {
  const payload = {
    name: data.name,
    uniqueId: data.uniqueId,
    model: data.model,
    category: data.category,
    phone: data.phone,
    attributes: {
      modelo: data.model,
      placa: data.plate,
      linha: data.phone,
      ...(data.attributes || {}),
    },
    ...(data.totalDistance !== undefined ? { totalDistance: data.totalDistance } : {}),
  };
  const res = await api.post("/devices", payload);
  return res.data;
}

export async function updateDevice(id, data) {
  const prev = data.attributes || {};
  const pick = (val, fallback) =>
    val !== undefined && val !== null && val !== "" ? val : (fallback ?? "");

  const payload = {
    id: data.id ?? id,
    name: data.name,
    uniqueId: data.uniqueId,
    model: data.model,
    category: data.category,
    phone: data.phone,
    groupId: data.groupId ?? null,
    calendarId: data.calendarId ?? null,
    attributes: {
      modelo: pick(data.model, prev.modelo),
      placa: pick(data.plate, prev.placa),
      linha: pick(data.phone, prev.linha),
      ...(data.attributes || {}),
    },
    ...(data.totalDistance !== undefined ? { totalDistance: data.totalDistance } : {}),
  };
  const res = await api.put(`/devices/${id}`, payload);
  return res.data;
}

// Atualiza somente atributos específicos (ex.: odômetro) sem alterar demais campos
// Traccar exige ao menos name/uniqueId no PUT; use o snapshot atual do dispositivo.
export async function updateDeviceAttributes(device) {
  const payload = {
    id: device.id,
    name: device.name,
    uniqueId: device.uniqueId,
    category: device.category,
    attributes: device.attributes || {},
  };
  const res = await api.put(`/devices/${device.id}`, payload);
  return res.data;
}

export async function deleteDevice(id) {
  const res = await api.delete(`/devices/${id}`);
  return res.data;
}

// ➤ Usuários
export async function getUsers() {
  try {
    const res = await api.get("/users", { params: { all: true } });
    return res.data;
  } catch (err) {
    console.error("Erro ao obter usuários:", err);
    return [];
  }
}

export async function getPermissions(params = {}) {
  try {
    const res = await api.get("/permissions", {
      params,
    });
    return res.data;
  } catch (err) {
    console.error("Erro ao obter permissões:", err);
    return [];
  }
}

// ➤ Auditoria
export async function getAuditLogs(params = {}) {
  try {
    const res = await api.get("/audit", { params });
    return Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    console.error("Erro ao obter auditoria:", err);
    return [];
  }
}

const buildPermissionsAttributes = (data) => {
  // Admin mantém todas as permissões; demais respeitam o objeto recebido.
  if (data.admin || data.administrator) {
    return { view: true, create: true, edit: true, delete: true, devicesCreate: true };
  }
  if (data.permissions) return data.permissions;
  return data.attributes?.permissions || {};
};

export async function createUser(data) {
  const buildAttrs = () => ({
    ...(data.attributes || {}),
    cpfCnpj: data.cpfCnpj || "",
    address: data.address || "",
    notes: data.notes || "",
    accessLevel: data.accessLevel || "user",
    permissions: buildPermissionsAttributes(data),
    startDate: data.startDate || "",
    expiryDate: data.expiryDate || "",
    lastAccess: data.lastAccess || "",
    vehicleLimit: data.vehicleLimit ?? "",
    vehicleCount: data.vehicleCount ?? "",
    clientLimit: data.clientLimit ?? "",
    extraDeviceLimit: data.extraDeviceLimit ?? "",
    theme: data.theme || "light",
    language: data.language || "pt-BR",
    notifications: {
      email: !!data.notifEmail,
      whatsapp: !!data.notifWhatsapp,
      app: !!data.notifApp,
    },
    profilePhoto: data.profilePhoto || "",
  });

  const payload = {
    name: data.name,
    email: data.email,
    phone: data.phone,
    administrator: Boolean(data.admin),
    disabled: Boolean(data.disabled),
    password: data.password,
    attributes: buildAttrs(),
  };
  const res = await api.post("/users", payload);
  return res.data;
}

export async function updateUser(id, data) {
  const buildAttrs = () => {
    const prev = data.attributes || {};
    return {
      ...prev,
      cpfCnpj: data.cpfCnpj ?? prev.cpfCnpj ?? "",
      address: data.address ?? prev.address ?? "",
      notes: data.notes ?? prev.notes ?? "",
      accessLevel: data.accessLevel ?? prev.accessLevel ?? "user",
      permissions: buildPermissionsAttributes({
        ...data,
        permissions: data.permissions || prev.permissions || {},
      }),
      startDate: data.startDate ?? prev.startDate ?? "",
      expiryDate: data.expiryDate ?? prev.expiryDate ?? "",
      lastAccess: prev.lastAccess || data.lastAccess || "",
      vehicleLimit: data.vehicleLimit ?? prev.vehicleLimit ?? "",
      vehicleCount: data.vehicleCount ?? prev.vehicleCount ?? "",
      clientLimit: data.clientLimit ?? prev.clientLimit ?? "",
      extraDeviceLimit: data.extraDeviceLimit ?? prev.extraDeviceLimit ?? "",
      theme: data.theme ?? prev.theme ?? "light",
      language: data.language ?? prev.language ?? "pt-BR",
      notifications: {
        ...(prev.notifications || {}),
        email: data.notifEmail ?? prev.notifications?.email ?? false,
        whatsapp: data.notifWhatsapp ?? prev.notifications?.whatsapp ?? false,
        app: data.notifApp ?? prev.notifications?.app ?? false,
      },
      profilePhoto: data.profilePhoto ?? prev.profilePhoto ?? "",
    };
  };

  const payload = {
    id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    administrator: Boolean(data.admin),
    disabled: Boolean(data.disabled),
    attributes: buildAttrs(),
    // Só envia senha se informada
    ...(data.password ? { password: data.password } : {}),
  };
  const res = await api.put(`/users/${id}`, payload);
  return res.data;
}

export async function deleteUser(id) {
  const res = await api.delete(`/users/${id}`);
  return res.data;
}

// ➤ Comandos de ignição (bloquear/desbloquear)
async function sendEngineCommand(deviceId, type) {
  // Timeout curto para não deixar UI presa caso o dispositivo esteja offline
  const res = await api.post(
    "/commands/send",
    { deviceId, type },
    { timeout: 7000 }
  );
  return res.data;
}

export async function blockEngine(deviceId) {
  return sendEngineCommand(deviceId, "engineStop");
}

export async function unblockEngine(deviceId) {
  return sendEngineCommand(deviceId, "engineResume");
}

// ➤ Eventos recentes
export async function getEvents(params = {}) {
  try {
    const res = await api.get("/events", { params });
    const events = Array.isArray(res.data) ? res.data : [];
    return enrichWithAddress(events, (ev) => {
      const lat =
        ev.latitude ??
        ev.position?.latitude ??
        ev.attributes?.latitude ??
        ev.attributes?.lat;
      const lon =
        ev.longitude ??
        ev.position?.longitude ??
        ev.attributes?.longitude ??
        ev.attributes?.lon;
      return { lat, lon };
    });
  } catch (err) {
    console.error("Erro ao obter eventos:", err);
    return [];
  }
}
// ➤ Permissões de usuário/dispositivo
export async function addUserDevicePermission(userId, deviceId) {
  const res = await api.post("/permissions", { userId, deviceId });
  return res.data;
}

export async function removeUserDevicePermission(userId, deviceId) {
  // Envia tanto no body quanto em query para compatibilidade com o Traccar
  const res = await api.delete("/permissions", {
    params: { userId, deviceId },
    data: { userId, deviceId },
  });
  return res.data;
}

// ➤ Notificações (Traccar 6.10)
export async function getNotifications() {
  try {
    const res = await api.get("/notifications");
    return Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    console.error("Erro ao obter notificações:", err);
    return [];
  }
}

export async function createNotification(data) {
  const payload = {
    type: data.type || "alarm",
    always: true,
    notifications: true,
    text: data.message || data.title || "Alerta",
    attributes: {
      ...data.attributes,
      frontendRule: {
        title: data.title,
        message: data.message,
        color: data.color,
        events: data.events,
        showPopup: data.showPopup,
        playSound: data.playSound,
        enabled: data.enabled,
        scope: data.scope,
        deviceId: data.deviceId,
      },
    },
  };
  const res = await api.post("/notifications", payload);
  return res.data;
}

export async function updateNotification(id, data) {
  const payload = {
    id,
    type: data.type || "alarm",
    always: true,
    notifications: true,
    text: data.message || data.title || "Alerta",
    attributes: {
      ...data.attributes,
      frontendRule: {
        title: data.title,
        message: data.message,
        color: data.color,
        events: data.events,
        showPopup: data.showPopup,
        playSound: data.playSound,
        enabled: data.enabled,
        scope: data.scope,
        deviceId: data.deviceId,
      },
    },
  };
  const res = await api.put(`/notifications/${id}`, payload);
  return res.data;
}

export async function deleteNotification(id) {
  const res = await api.delete(`/notifications/${id}`);
  return res.data;
}

export async function assignNotificationToUser(userId, notificationId) {
  const res = await api.post("/permissions", { userId, notificationId });
  return res.data;
}

export async function removeNotificationFromUser(userId, notificationId) {
  const res = await api.delete("/permissions", {
    params: { userId, notificationId },
    data: { userId, notificationId },
  });
  return res.data;
}

// ➤ Motoristas
export async function getDrivers() {
  try {
    const res = await api.get("/drivers");
    return res.data;
  } catch (err) {
    console.error("Erro ao obter motoristas:", err);
    return [];
  }
}

export async function createDriver(data) {
  const payload = {
    name: data.name,
    uniqueId: data.uniqueId,
    attributes: {
      license: data.license || "",
      phone: data.phone || "",
      notes: data.notes || "",
    },
  };
  const res = await api.post("/drivers", payload);
  return res.data;
}

export async function updateDriver(id, data) {
  const prev = data.attributes || {};
  const payload = {
    id,
    name: data.name,
    uniqueId: data.uniqueId,
    attributes: {
      ...prev,
      license: data.license ?? prev.license ?? "",
      phone: data.phone ?? prev.phone ?? "",
      notes: data.notes ?? prev.notes ?? "",
    },
  };
  const res = await api.put(`/drivers/${id}`, payload);
  return res.data;
}

export async function deleteDriver(id) {
  const res = await api.delete(`/drivers/${id}`);
  return res.data;
}

export async function assignDriverToDevice(deviceId, driverId) {
  const res = await api.post("/permissions", { deviceId, driverId });
  return res.data;
}

export async function removeDriverFromDevice(deviceId, driverId) {
  const res = await api.delete("/permissions", {
    params: { deviceId, driverId },
    data: { deviceId, driverId },
  });
  return res.data;
}
