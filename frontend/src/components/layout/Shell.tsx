import React from 'react';
import { Bike, Home, LogIn, LogOut, PackageCheck, Settings, ShieldCheck, ShoppingBag, User, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { appLogo } from '../../assets.ts';
import { useApp } from '../../context/AppContext.tsx';
import MobileTabs from './MobileTabs.tsx';
import NavItem from './NavItem.tsx';

export default function Shell({ children }) {
  const { canCreateStores, canManageStore, canUseDelivery, cartCount, currentUser, logout } = useApp();

  return (
    <div className="min-h-screen bg-stone-50 text-stone-950">
      <header className="sticky top-0 z-40 border-b border-wine-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" aria-label="Ir al inicio de GoHenryGo" className="flex items-center gap-2 font-black text-wine-700">
            <img src={appLogo} alt="" className="h-11 w-11 rounded-full border border-wine-100 object-cover" />
            <span className="text-xl">GoHenryGo</span>
          </Link>
          <nav aria-label="Navegacion principal" className="hidden items-center gap-1 md:flex">
            <NavItem to="/" icon={<Home size={18} />} label="Inicio" />
            {canCreateStores && <NavItem to="/platform-admin" icon={<ShieldCheck size={18} />} label="Plataforma" />}
            {canManageStore && <NavItem to="/restaurant-admin" icon={<Settings size={18} />} label="Restaurante" />}
            {canUseDelivery && <NavItem to="/delivery" icon={<Bike size={18} />} label="Delivery" />}
            {currentUser && <NavItem to="/pedido" icon={<PackageCheck size={18} />} label="Pedido" />}
            {currentUser && <NavItem to="/usuario" icon={<User size={18} />} label="Usuario" />}
            {!currentUser && <NavItem to="/register" icon={<UserPlus size={18} />} label="Registro" />}
            {!currentUser && <NavItem to="/login" icon={<LogIn size={18} />} label="Login" />}
            {currentUser && (
              <button type="button" onClick={logout} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-stone-600 hover:bg-wine-50 hover:text-wine-700">
                <LogOut size={18} /> Salir
              </button>
            )}
          </nav>
          <Link to="/carrito" aria-label={`Carrito con ${cartCount} producto${cartCount === 1 ? '' : 's'}`} className="relative grid h-11 w-11 place-items-center rounded-full bg-maize-300 text-wine-900 shadow-sm">
            <ShoppingBag size={21} />
            {cartCount > 0 && (
              <span aria-hidden="true" className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-wine-600 px-1 text-xs font-bold text-white">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </header>
      <main id="contenido-principal" tabIndex={-1} className="mx-auto max-w-6xl px-4 pb-24 pt-5 md:pt-8">{children}</main>
      <MobileTabs />
    </div>
  );
}

