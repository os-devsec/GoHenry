import React from 'react';

export default function AdminMetric({ icon, label, value }) {
  return (
    <div className="rounded-lg bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-wine-700">
        {icon}
        <span className="text-sm font-bold">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

