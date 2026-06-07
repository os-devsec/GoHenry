import React from 'react';
import { NavLink } from 'react-router-dom';

export default function NavItem({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
          isActive ? 'bg-wine-600 text-white' : 'text-stone-600 hover:bg-wine-50 hover:text-wine-700'
        }`
      }
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </NavLink>
  );
}

