// src/services/api.js

import axios from "axios";
import { TRACCAR_BASE_URL, TRACCAR_USER, TRACCAR_PASS } from "../config";

const api = axios.create({
  baseURL: TRACCAR_BASE_URL,
  auth: {
    username: TRACCAR_USER,
    password: TRACCAR_PASS,
  },
});

export default api;
                          // Busca lista de dispositivos do Traccar
export async function getDevices() {
  try {
    const response = await api.get("/devices");
    return response.data;
  } catch (error) {
    console.error("Erro ao buscar dispositivos:", error);
    throw error;
  }
}

