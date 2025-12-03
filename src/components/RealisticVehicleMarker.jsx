import React, { useEffect, useMemo, useState } from "react";
import { Marker, Tooltip, Popup, useMap } from "react-leaflet";
import L from "leaflet";

const iconCache = new Map();

const palette = {
  "car-small": { body: "#3b82f6", roof: "#0f172a" },
  "car-sedan": { body: "#1d4ed8", roof: "#0b1220" },
  suv: { body: "#0ea5e9", roof: "#0f172a" },
  pickup: { body: "#22c55e", roof: "#0f172a" },
  moto: { body: "#f59e0b", roof: "#0f172a" },
  "moto-delivery": { body: "#fb923c", roof: "#0f172a" },
  van: { body: "#14b8a6", roof: "#0f172a" },
  "truck-small": { body: "#8b5cf6", roof: "#0f172a" },
  "truck-box": { body: "#6366f1", roof: "#0f172a" },
  other: { body: "#94a3b8", roof: "#0f172a" },
};

const drawTopView = (typeKey) => {
  const key = typeKey && palette[typeKey] ? typeKey : "other";
  if (iconCache.has(key)) return iconCache.get(key);

  const { body, roof } = palette[key];
  const canvas = document.createElement("canvas");
  const w = 54;
  const h = 108;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;

  // Body
  ctx.fillStyle = body;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  const radius = 10;
  ctx.moveTo(5 + radius, 8);
  ctx.arcTo(w - 5, 8, w - 5, h - 8, radius);
  ctx.arcTo(w - 5, h - 8, 5, h - 8, radius);
  ctx.arcTo(5, h - 8, 5, 8, radius);
  ctx.arcTo(5, 8, w - 5, 8, radius);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Roof
  ctx.fillStyle = roof;
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(12, 22, w - 24, h - 44, 8);
  ctx.fill();
  ctx.stroke();

  // Windows
  ctx.fillStyle = "#cfe4ff";
  ctx.beginPath();
  ctx.roundRect(14, 28, w - 28, 22, 6);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(14, h - 56, w - 28, 22, 6);
  ctx.fill();

  // Wheels
  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.ellipse(12, 20, 6, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(w - 12, 20, 6, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(12, h - 20, 6, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(w - 12, h - 20, 6, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Lights
  ctx.fillStyle = "#fde047";
  ctx.fillRect(18, 6, w - 36, 6);
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(18, h - 12, w - 36, 6);

  // Delivery box indicator for moto-delivery
  if (key === "moto-delivery") {
    ctx.fillStyle = "#f97316";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(w / 2 - 10, h / 2 - 24, 20, 16, 4);
    ctx.fill();
    ctx.stroke();
  }

  const dataUrl = canvas.toDataURL("image/png");
  iconCache.set(key, dataUrl);
  return dataUrl;
};

const typeToKey = (type) => {
  const key = (type || "").toLowerCase();
  if (["car", "carro", "auto", "automobile", "carro pequeno"].includes(key)) return "car-small";
  if (["sedan", "car-sedan"].includes(key)) return "car-sedan";
  if (["suv"].includes(key)) return "suv";
  if (["pickup", "camionete", "pickuptruck"].includes(key)) return "pickup";
  if (["moto", "motorcycle", "bike"].includes(key)) return "moto";
  if (["moto-delivery", "delivery"].includes(key)) return "moto-delivery";
  if (["van", "vanette"].includes(key)) return "van";
  if (["truck-small", "caminhao pequeno", "3/4", "caminhao 3/4"].includes(key)) return "truck-small";
  if (["truck", "caminhao", "truck-box", "bau"].includes(key)) return "truck-box";
  return "other";
};

// Ícones realistas por tipo (vista superior)
const realisticIcons = {
  car: "https://cdn-icons-png.flaticon.com/512/12689/12689302.png",
  carro: "https://cdn-icons-png.flaticon.com/512/12689/12689302.png",
  auto: "https://cdn-icons-png.flaticon.com/512/12689/12689302.png",
  automobile: "https://cdn-icons-png.flaticon.com/512/12689/12689302.png",
  moto: "https://cdn.pixabay.com/photo/2013/07/12/18/57/motorcycle-153914_1280.png",
  motorcycle: "https://cdn.pixabay.com/photo/2013/07/12/18/57/motorcycle-153914_1280.png",
  bike: "https://cdn.pixabay.com/photo/2013/07/12/18/57/motorcycle-153914_1280.png",
  caminhão: "/icons/caminhao.png",
  caminhao: "/icons/caminhao.png",
  truck: "/icons/caminhao.png",
  carreta: "/icons/carreta.png",
  truckbox: "/icons/carreta.png",
  van: "/icons/van.png",
};

const getIconByType = (type) => {
  const key = (type || "").toLowerCase().replace(/\s+/g, "");
  const url = realisticIcons[key];
  if (!url) return null;
  return L.icon({
    iconUrl: url,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -24],
    className: "realistic-vehicle-top",
  });
};

const detectTypeByName = (name = "") => {
  const n = name.toLowerCase();
  const has = (arr) => arr.some((w) => n.includes(w));

  if (has(["cg", "titan", "twister", "biz", "fazer", "factor", "xre", "bros", "mt", "cb"])) return "moto";
  if (has(["fh", "scania", "volvo", "mb", "constellation", "cargo", "iveco", "actros"])) return "caminhao";
  if (has(["carreta", "bau", "graneleiro", "3 eixos", "9 eixos"])) return "carreta";
  if (has(["hilux", "s10", "ranger", "amarok", "fiat toro", "toro"])) return "carro";
  if (has(["onix", "gol", "uno", "polo", "hb20", "fiesta", "civic", "corolla", "sandero", "kwid"])) return "carro";
  if (has(["sprinter", "ducato", "master", "jumper"])) return "van";
  return null;
};

export default function RealisticVehicleMarker({
  latitude,
  longitude,
  heading = 0,
  type,
  speed = 0,
  status = "offline",
  isBlocked = false,
  usePopup = false,
  children,
  onClick,
  device,
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map?.getZoom?.() ?? 12);

  useEffect(() => {
    const handler = () => setZoom(map.getZoom());
    map.on("zoomend", handler);
    return () => map.off("zoomend", handler);
  }, [map]);

  const icon = useMemo(() => {
    const detectedType = device?.attributes?.tipo || detectTypeByName(device?.name) || type;
    const customIcon = getIconByType(detectedType);
    if (customIcon) return customIcon;

    const speedBadge =
      Number.isFinite(Number(speed)) && Number(speed) > 0
        ? `<div style="
            position:absolute;
            top:-6px;
            right:-6px;
            width:26px;
            height:26px;
            border-radius:999px;
            background:rgba(15,23,42,0.92);
            color:#e2e8f0;
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:11px;
            font-weight:700;
            border:1px solid rgba(148,163,184,0.6);
            box-shadow:0 6px 14px rgba(0,0,0,0.35);
          ">${Math.round(Number(speed))}</div>`
        : "";

    const size = Math.min(72, Math.max(48, 48 + (zoom - 12) * 3));
    const iconKey = typeToKey(detectedType);
    const url = drawTopView(iconKey);
    const statusClass = isBlocked ? "blocked" : status;
    const html = `
      <div class="realistic-vehicle ${speed > 1 ? "rv-moving" : ""} rv-status-${statusClass}" style="--icon-size:${size}px; --heading:${heading}deg;">
        <img src="${url}" alt="vehicle" draggable="false" />
        <div class="rv-status-dot dot-${statusClass}"></div>
        ${speedBadge}
      </div>
    `;
    return L.divIcon({
      className: "",
      html,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }, [heading, speed, type, zoom, status, isBlocked]);

  return (
    <Marker
      position={[latitude, longitude]}
      icon={icon}
      eventHandlers={onClick ? { click: onClick } : undefined}
    >
      {children ? (
        usePopup ? (
          <Popup
            closeButton={false}
            offset={[0, -10]}
            className="!bg-transparent !border-none !shadow-none !p-0"
          >
            {children}
          </Popup>
        ) : (
          <Tooltip
            direction="top"
            offset={[0, -10]}
            permanent={false}
            interactive
            className="!bg-transparent !border-slate-800 !text-slate-100 !shadow-none"
          >
            {children}
          </Tooltip>
        )
      ) : null}
    </Marker>
  );
}
