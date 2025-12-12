const STORAGE_KEY = "devicePhotos";

const readMap = () => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
};

const writeMap = (map) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // silencioso
  }
};

const buildKeys = (id, uniqueId) => {
  const keys = [];
  if (id != null) keys.push(`id:${id}`);
  if (uniqueId) keys.push(`uid:${uniqueId}`);
  return keys;
};

export function getDevicePhoto(id, uniqueId) {
  const map = readMap();
  const keys = buildKeys(id, uniqueId);
  for (const k of keys) {
    if (map[k]) return map[k];
  }
  return "";
}

export function saveDevicePhoto({ id, uniqueId }, dataUrl) {
  if (!dataUrl) return;
  const map = readMap();
  const keys = buildKeys(id, uniqueId);
  keys.forEach((k) => {
    map[k] = dataUrl;
  });
  writeMap(map);
}

export function deleteDevicePhoto(id, uniqueId) {
  const map = readMap();
  let changed = false;
  buildKeys(id, uniqueId).forEach((k) => {
    if (map[k]) {
      delete map[k];
      changed = true;
    }
  });
  if (changed) writeMap(map);
}
