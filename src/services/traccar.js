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

// ➤ Buscar dispositivos (nome, status, etc)
export async function getDevices() {
  try {
    const [res, positions] = await Promise.all([api.get("/devices"), getPositions()]);
    const posByDevice = {};
    (positions || []).forEach((p) => {
      if (p?.deviceId != null) posByDevice[p.deviceId] = p;
    });
    const devices = Array.isArray(res.data) ? res.data : [];
    // Enriquecer com endereço da última posição (quando disponível)
    return devices.map((d) => {
      const pos = posByDevice[d.id];
      const address = pos?.address || d.address;
      return address ? { ...d, address } : d;
    });
  } catch (err) {
    console.error("Erro ao obter dispositivos:", err);
    return [];
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
    },
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
    },
  };
  const res = await api.put(`/devices/${id}`, payload);
  return res.data;
}

export async function deleteDevice(id) {
  const res = await api.delete(`/devices/${id}`);
  return res.data;
}

// ➤ Usuários
export async function getUsers() {
  try {
    const res = await api.get("/users");
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

export async function createUser(data) {
  const buildAttrs = () => ({
    ...(data.attributes || {}),
    cpfCnpj: data.cpfCnpj || "",
    address: data.address || "",
    notes: data.notes || "",
    accessLevel: data.accessLevel || "user",
    permissions: {
      create: !!data.permCreate,
      edit: !!data.permEdit,
      delete: !!data.permDelete,
      view: !!data.permView,
      finance: !!data.permFinance,
      reports: !!data.permReports,
      map: !!data.permMap,
      settings: !!data.permSettings,
      export: !!data.permExport,
    },
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
      permissions: {
        ...(prev.permissions || {}),
        create: data.permCreate ?? prev.permissions?.create ?? false,
        edit: data.permEdit ?? prev.permissions?.edit ?? false,
        delete: data.permDelete ?? prev.permissions?.delete ?? false,
        view: data.permView ?? prev.permissions?.view ?? true,
        finance: data.permFinance ?? prev.permissions?.finance ?? false,
        reports: data.permReports ?? prev.permissions?.reports ?? true,
        map: data.permMap ?? prev.permissions?.map ?? true,
        settings: data.permSettings ?? prev.permissions?.settings ?? false,
        export: data.permExport ?? prev.permissions?.export ?? false,
      },
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
