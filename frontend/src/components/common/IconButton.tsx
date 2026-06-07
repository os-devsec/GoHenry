import React from 'react';

export default function IconButton({ label, onClick, icon }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-full bg-maize-100 text-wine-800 transition hover:bg-maize-300"
    >
      {icon}
    </button>
  );
}

