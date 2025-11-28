import React, { useEffect, useMemo, useState } from "react";
import { Marker, Tooltip, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import carIcon from "../assets/vehicle-icons/car.svg";
import motorcycleIcon from "../assets/vehicle-icons/motorcycle.svg";
import truckIcon from "../assets/vehicle-icons/truck.svg";
import vanIcon from "../assets/vehicle-icons/van.svg";
import pickupIcon from "../assets/vehicle-icons/pickup.svg";
import busIcon from "../assets/vehicle-icons/bus.svg";
import otherIcon from "../assets/vehicle-icons/other.svg";

const typeToIcon = {
  car: carIcon,
  automobile: carIcon,
  moto: motorcycleIcon,
  motorcycle: motorcycleIcon,
  bike: motorcycleIcon,
  truck: truckIcon,
  caminhao: truckIcon,
  van: vanIcon,
  vanette: vanIcon,
  pickup: pickupIcon,
  pickuptruck: pickupIcon,
  camionete: pickupIcon,
  bus: busIcon,
  onibus: busIcon,
};

const getIconByType = (type) => {
  if (!type) return otherIcon;
  const key = String(type).toLowerCase();
  return typeToIcon[key] || otherIcon;
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
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map?.getZoom?.() ?? 12);

  useEffect(() => {
    const handler = () => setZoom(map.getZoom());
    map.on("zoomend", handler);
    return () => map.off("zoomend", handler);
  }, [map]);

  const icon = useMemo(() => {
    const size = Math.min(72, Math.max(42, 42 + (zoom - 12) * 3));
    const url = getIconByType(type);
    const statusClass = isBlocked ? "blocked" : status;
    const html = `
      <div class="realistic-vehicle ${speed > 1 ? "rv-moving" : ""} rv-status-${statusClass}" style="--icon-size:${size}px; --heading:${heading}deg;">
        <img src="${url}" alt="vehicle" draggable="false" />
        <div class="rv-status-dot dot-${statusClass}"></div>
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
