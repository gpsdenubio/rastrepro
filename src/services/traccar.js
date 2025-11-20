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
