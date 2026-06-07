import React from 'react';
import { Bike, Home, LogIn, PackageCheck, Settings, ShieldCheck, ShoppingBag, User } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useApp } from '../../context/AppContext.tsx';

function TabLink({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center gap-1 rounded-lg py-2 text-xs font-semibold ${
          isActive ? 'text-wine-700' : 'text-stone-500'
        }`
      }
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </NavLink>
  );
}

export default function MobileTabs() {
  const { canCreateStores, canManageStore, canUseDelivery, currentUser } = useApp();
  const tabs = [
    { to: '/', icon: <Home size={20} />, label: 'Inicio' },
    canCreateStores ? { to: '/platform-admin', icon: <ShieldCheck size={20} />, label: 'Admin' } : null,
    canManageStore ? { to: '/restaurant-admin', icon: <Settings size={20} />, label: 'Tienda' } : null,
    canUseDelivery ? { to: '/delivery', icon: <Bike size={20} />, label: 'Delivery' } : null,
    { to: '/carrito', icon: <ShoppingBag size={20} />, label: 'Carrito' },
    currentUser ? { to: '/usuario', icon: <User size={20} />, label: 'Usuario' } : { to: '/login', icon: <LogIn size={20} />, label: 'Login' },
    currentUser ? { to: '/pedido', icon: <PackageCheck size={20} />, label: 'Pedido' } : null
  ].filter(Boolean).slice(0, 5);

  return (
    <nav aria-label="Navegacion movil" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-wine-100 bg-white px-2 py-2 md:hidden">
      {tabs.map((tab) => <TabLink key={tab.to} to={tab.to} icon={tab.icon} label={tab.label} />)}
    </nav>
  );
}

