import React from 'react';

const DeviceCard = ({ device }) => {
  return (
    <div className="border p-4 rounded shadow mb-2">
      <h3 className="font-bold text-lg">{device.name}</h3>
      <p>Status: <span className={device.status === 'online' ? 'text-green-600' : 'text-red-600'}>{device.status}</span></p>
      <p>Última posição: {device.lastPosition || 'Desconhecida'}</p>
      <p>Velocidade: {device.speed || 0} km/h</p>
    </div>
  );
};

export default DeviceCard;
