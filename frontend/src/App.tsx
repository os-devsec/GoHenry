import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Shell from './components/layout/Shell.tsx';
import CheckoutPage from './pages/CheckoutPage.tsx';
import DeliveryPage from './pages/DeliveryPage.tsx';
import DetailPage from './pages/DetailPage.tsx';
import HomePage from './pages/HomePage.tsx';
import LoginPage from './pages/LoginPage.tsx';
import OrderPage from './pages/OrderPage.tsx';
import PlatformAdminPage from './pages/PlatformAdminPage.tsx';
import RegisterPage from './pages/RegisterPage.tsx';
import RestaurantAdminPage from './pages/RestaurantAdminPage.tsx';
import RestaurantPage from './pages/RestaurantPage.tsx';
import UserPage from './pages/UserPage.tsx';
import { useApp } from './context/AppContext.tsx';

export default function App() {
  const { canCreateStores, canManageStore, canUseDelivery, currentUser, loading } = useApp();

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/index" element={<HomePage />} />
        <Route path="/restaurant/:id" element={<RestaurantPage />} />
        <Route path="/restaurante/:id" element={<RestaurantPage />} />
        <Route path="/detalle/:restaurantId/:productId" element={<DetailPage />} />
        <Route path="/checkout" element={<ProtectedRoute allow={Boolean(currentUser)} loading={loading}><CheckoutPage /></ProtectedRoute>} />
        <Route path="/carrito" element={<ProtectedRoute allow={Boolean(currentUser)} loading={loading}><CheckoutPage /></ProtectedRoute>} />
        <Route path="/pedido" element={<ProtectedRoute allow={Boolean(currentUser)} loading={loading}><OrderPage /></ProtectedRoute>} />
        <Route path="/usuario" element={<ProtectedRoute allow={Boolean(currentUser)} loading={loading}><UserPage /></ProtectedRoute>} />
        <Route path="/platform-admin" element={<ProtectedRoute allow={canCreateStores} loading={loading}><PlatformAdminPage /></ProtectedRoute>} />
        <Route path="/restaurant-admin" element={<ProtectedRoute allow={canManageStore} loading={loading}><RestaurantAdminPage /></ProtectedRoute>} />
        <Route path="/delivery" element={<ProtectedRoute allow={canUseDelivery} loading={loading}><DeliveryPage /></ProtectedRoute>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}

function ProtectedRoute({ allow, children, loading }) {
  const { currentUser } = useApp();
  const location = useLocation();
  if (loading) {
    return <div className="rounded-lg bg-white p-6 text-sm font-bold text-stone-600 shadow-sm">Cargando permisos...</div>;
  }
  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (!allow) return <Navigate to="/" replace />;
  return children;
}

