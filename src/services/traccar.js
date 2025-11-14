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
