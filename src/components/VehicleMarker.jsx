import React, { useEffect, useMemo, useState } from "react";
import { Marker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";

const statusColors = {
  blocked: "#e74c3c",
  moving: "#3498db",
  idle: "#f1c40f",
  online: "#2ecc71",
  offline: "#7f8c8d",
  unknown: "#94a3b8",
};

const svgIcons = {
  car: (color, accent) => `
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="16" width="32" height="20" rx="6" fill="${color}" stroke="${accent}" stroke-width="2"/>
      <path d="M14 22L18 16H34L38 22" stroke="${accent}" stroke-width="2" stroke-linecap="round" />
      <circle cx="18" cy="36" r="5" fill="#111" stroke="${accent}" stroke-width="2"/>
      <circle cx="34" cy="36" r="5" fill="#111" stroke="${accent}" stroke-width="2"/>
      <rect x="18" y="20" width="16" height="6" rx="2" fill="#0f172a"/>
    </svg>
  `,
  motorcycle: (color, accent) => `
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="34" r="6" fill="#0f172a" stroke="${accent}" stroke-width="2"/>
      <circle cx="36" cy="34" r="6" fill="#0f172a" stroke="${accent}" stroke-width="2"/>
      <path d="M14 34H22L30 28H36" stroke="${accent}" stroke-width="2.5" stroke-linecap="round" />
      <path d="M22 28L26 18H32L34 22" stroke="${accent}" stroke-width="2" stroke-linecap="round" />
      <path d="M22 20H17" stroke="${accent}" stroke-width="2" stroke-linecap="round" />
      <path d="M32 18L37 16" stroke="${accent}" stroke-width="2" stroke-linecap="round" />
      <circle cx="24" cy="22" r="3" fill="${color}" stroke="${accent}" stroke-width="1.5"/>
    </svg>
  `,
  truck: (color, accent) => `
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="18" width="22" height="16" rx="3" fill="${color}" stroke="${accent}" stroke-width="2"/>
      <rect x="30" y="22" width="12" height="12" rx="2" fill="${color}" stroke="${accent}" stroke-width="2"/>
      <path d="M30 24H34L38 30H42" stroke="${accent}" stroke-width="2" stroke-linecap="round" />
      <circle cx="16" cy="36" r="5" fill="#111" stroke="${accent}" stroke-width="2"/>
      <circle cx="34" cy="36" r="5" fill="#111" stroke="${accent}" stroke-width="2"/>
      <rect x="12" y="22" width="12" height="6" rx="2" fill="#0f172a"/>
    </svg>
  `,
  van: (color, accent) => `
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="18" width="28" height="16" rx="4" fill="${color}" stroke="${accent}" stroke-width="2"/>
      <path d="M26 18H38L42 24V34H38" stroke="${accent}" stroke-width="2" stroke-linejoin="round" />
      <circle cx="18" cy="36" r="5" fill="#111" stroke="${accent}" stroke-width="2"/>
      <circle cx="34" cy="36" r="5" fill="#111" stroke="${accent}" stroke-width="2"/>
      <rect x="16" y="22" width="10" height="6" rx="2" fill="#0f172a"/>
    </svg>
  `,
  pickup: (color, accent) => `
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="20" width="18" height="12" rx="3" fill="${color}" stroke="${accent}" stroke-width="2"/>
      <rect x="28" y="24" width="12" height="8" rx="2" fill="${color}" stroke="${accent}" stroke-width="2"/>
      <path d="M22 20V16H28L30 20" stroke="${accent}" stroke-width="2" stroke-linecap="round" />
      <circle cx="18" cy="34" r="5" fill="#111" stroke="${accent}" stroke-width="2"/>
      <circle cx="34" cy="34" r="5" fill="#111" stroke="${accent}" stroke-width="2"/>
    </svg>
  `,
  bus: (color, accent) => `
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="16" width="34" height="18" rx="5" fill="${color}" stroke="${accent}" stroke-width="2"/>
      <path d="M12 18H38" stroke="${accent}" stroke-width="2" stroke-linecap="round" />
      <rect x="12" y="20" width="10" height="8" rx="2" fill="#0f172a"/>
      <rect x="24" y="20" width="10" height="8" rx="2" fill="#0f172a"/>
      <circle cx="18" cy="36" r="5" fill="#111" stroke="${accent}" stroke-width="2"/>
      <circle cx="34" cy="36" r="5" fill="#111" stroke="${accent}" stroke-width="2"/>
    </svg>
  `,
  other: (color, accent) => `
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="14" y="18" width="24" height="16" rx="4" fill="${color}" stroke="${accent}" stroke-width="2"/>
      <path d="M14 22H38" stroke="${accent}" stroke-width="2" stroke-linecap="round" />
      <circle cx="20" cy="34" r="5" fill="#111" stroke="${accent}" stroke-width="2"/>
      <circle cx="32" cy="34" r="5" fill="#111" stroke="${accent}" stroke-width="2"/>
      <rect x="20" y="22" width="12" height="6" rx="2" fill="#0f172a"/>
    </svg>
  `,
};

const getIconSvg = (type, color, accent) => {
  const builder = svgIcons[type] || svgIcons.other;
  return builder(color, accent);
};

export default function VehicleMarker({
  latitude,
  longitude,
  heading = 0,
  speed = 0,
  type = "car",
  status = "offline",
  isBlocked = false,
  onClick,
  children,
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map?.getZoom?.() ?? 13);

  useEffect(() => {
    const handler = () => setZoom(map.getZoom());
    map.on("zoomend", handler);
    return () => {
      map.off("zoomend", handler);
    };
  }, [map]);

  const icon = useMemo(() => {
    const base = isBlocked
      ? "blocked"
      : status === "online" && speed > 1
      ? "moving"
      : status === "online"
      ? "online"
      : status === "offline"
      ? "offline"
      : "unknown";

    const color = statusColors[base] || statusColors.unknown;
    const accent = isBlocked ? "#991b1b" : "#0ea5e9";
    const size = Math.min(64, Math.max(34, 34 + (zoom - 12) * 3));
    const svg = getIconSvg(type, color, accent);

    const html = `
      <div class="vehicle-marker ${speed > 1 ? "is-moving" : ""} ${isBlocked ? "is-blocked" : ""}" style="--icon-size:${size}px; --rotation:${heading}deg;">
        ${svg}
        ${isBlocked ? '<div class="vehicle-badge-lock">🔒</div>' : ""}
      </div>
    `;

    return L.divIcon({
      className: "",
      html,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }, [heading, isBlocked, status, speed, type, zoom]);

  return (
    <Marker
      position={[latitude, longitude]}
      icon={icon}
      eventHandlers={onClick ? { click: onClick } : undefined}
    >
      {children ? (
        <Tooltip
          direction="top"
          offset={[0, -10]}
          permanent={false}
          interactive
          className="!bg-transparent !border-slate-800 !text-slate-100 !shadow-none"
        >
          {children}
        </Tooltip>
      ) : null}
    </Marker>
  );
}
