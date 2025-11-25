// src/services/traccar.js
import api from "./api";

// ➤ Buscar dispositivos (nome, status, etc)
export async function getDevices() {
  try {
    const res = await api.get("/devices");
    return res.data;
  } catch (err) {
    console.error("Erro ao obter dispositivos:", err);
    return [];
  }
}

// ➤ Buscar posições (latitude, longitude, endereço etc)
export async function getPositions() {
  try {
    const res = await api.get("/positions");
    return res.data;
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
  const payload = {
    name: data.name,
    email: data.email,
    phone: data.phone,
    admin: Boolean(data.admin),
    disabled: Boolean(data.disabled),
    password: data.password,
  };
  const res = await api.post("/users", payload);
  return res.data;
}

export async function updateUser(id, data) {
  const payload = {
    id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    admin: Boolean(data.admin),
    disabled: Boolean(data.disabled),
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
    return res.data;
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
