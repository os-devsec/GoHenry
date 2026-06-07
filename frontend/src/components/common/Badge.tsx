import React from 'react';

export default function Badge({ icon, text }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1">
      {icon}
      {text}
    </span>
  );
}

