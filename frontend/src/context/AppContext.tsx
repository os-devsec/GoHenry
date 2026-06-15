import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, productImageUrl, storeLogoUrl } from '../api.ts';
import { foodImage, logoImage } from '../assets.ts';

const AppContext = createContext(null);

function storedJson(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch (_error) {
    localStorage.removeItem(key);
    return fallback;
  }
}

async function optionalProducts(stores = [], user = null) {
  const load = async () => {
    const publicProducts = await api.get('/api/v1/productos').catch(() => []);
    const memberships = user?.tiendas || [];
    const storeIds = user?.rol_usuario === 'admin_plataforma'
      ? stores.map((store) => store.id_tienda)
      : memberships.map((membership) => membership.id_tienda);

    if (!storeIds.length) return publicProducts;

    const storeProducts = await Promise.all(
      storeIds.map((id) => api.get(`/api/v1/tiendas/${id}/productos`).catch(() => []))
    );
    const byId = new Map(publicProducts.map((product) => [product.id_producto, product]));
    storeProducts.flat().forEach((product) => byId.set(product.id_producto, product));
    return Array.from(byId.values());
  };

  return Promise.race([
    load(),
    new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 1200))
  ]);
}

export function useApp() {
  return useContext(AppContext);
}

export function AppProvider({ children }) {
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>(() => storedJson('cart', []));
  const [currentUser, setCurrentUser] = useState(() => storedJson('usuario', null));
  const [lastOrder, setLastOrder] = useState(() => storedJson('lastOrder', null));
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');

  const refreshCurrentUser = async () => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
      const user = await api.get('/api/v1/auth/me');
      localStorage.setItem('usuario', JSON.stringify(user));
      setCurrentUser(user);
      return user;
    } catch (_error) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      setCurrentUser(null);
      return null;
    }
  };

  const refreshData = async (userOverride = currentUser) => {
    try {
      setApiError('');
      const stores = await api.get('/api/v1/tiendas');
      const [products, categoryData] = await Promise.all([
        optionalProducts(stores, userOverride),
        api.get('/api/v1/categorias').catch(() => [])
      ]);
      setCategories(categoryData.filter((category) => category.estado));
      const mapped = stores.map((store) => {
        const menu = products
          .filter((product) => product.id_tienda === store.id_tienda)
          .map((product) => {
            const configuredDiscount = Number(product.descuento_porcentaje || 0);
            const discountActive = Boolean(product.descuento_activo);
            const discount = discountActive ? configuredDiscount : 0;
            const originalPrice = Number(product.precio || 0);
            return {
            id: product.id_producto,
            id_producto: product.id_producto,
            id_tienda: product.id_tienda,
            name: product.nombre,
            description: product.descripcion,
            price: Number(product.precio_final ?? originalPrice * (1 - discount / 100)),
            originalPrice,
            stock: product.stock,
            discount,
            configuredDiscount,
            discountActive,
            discountStart: product.descuento_inicio || '',
            discountEnd: product.descuento_fin || '',
            available: product.estado,
            categories: Array.isArray(product.categorias) ? product.categorias : [],
            categoryIds: Array.isArray(product.categorias)
              ? product.categorias.map((category) => category.id_categoria)
              : [],
            isExtra: Array.isArray(product.categorias)
              && product.categorias.some((category) => category.nombre?.toLowerCase() === 'extra'),
            image: productImageUrl(product.imagen_url) || foodImage
          };
          });

        return {
          id: String(store.id_tienda),
          id_tienda: store.id_tienda,
          name: store.nombre,
          category: store.sucursal || 'Campus UIDE',
          sucursal: store.sucursal || 'Campus UIDE',
          nombre_lugar: store.nombre_lugar || 'Campus UIDE',
          referencia: store.referencia || '',
          horario_apertura: store.horario_apertura || '08:00',
          horario_cierre: store.horario_cierre || '18:00',
          locationText: [store.nombre_lugar, store.referencia].filter(Boolean).join(' '),
          image: foodImage,
          logo: storeLogoUrl(store.logo_url) || logoImage,
          tags: [store.nombre_lugar || 'Campus', store.horario_apertura || '08:00'],
          menu
        };
      });
      setRestaurants(mapped);
      const latestProducts = new Map<any, any>();
      mapped.forEach((restaurant) => {
        restaurant.menu.forEach((product) => latestProducts.set(product.id, product));
      });
      setCart((current) => current.map((item) => {
        const latest = latestProducts.get(item.id);
        return latest ? { ...item, ...latest, quantity: item.quantity } : item;
      }));
    } catch (error) {
      setApiError(error.message);
      setRestaurants([]);
    } finally {
      setLoading(false);
    }
  };

  const saveLastOrder = (order) => {
    if (!order) return null;
    setLastOrder(order);
    localStorage.setItem('lastOrder', JSON.stringify(order));
    return order;
  };

  const refreshOrder = async (orderId = lastOrder?.id_pedido) => {
    if (!orderId) return null;
    const order = await api.get(`/api/v1/pedidos/${orderId}`);
    const payment = await api.get(`/api/v1/pedidos/${orderId}/pago`).catch(() => null);
    if (payment && Object.keys(payment).length) order.pago = payment;
    if (['entregado', 'cancelado'].includes(order.estado_nombre)) {
      setLastOrder(null);
      localStorage.removeItem('lastOrder');
      return null;
    }
    return saveLastOrder(order);
  };

  const refreshLatestOrder = async (userId = currentUser?.id_usuario) => {
    if (!userId) return null;
    const orders = await api.get(`/api/v1/pedidos?usuario=${userId}`).catch(() => []);
    const dismissed = JSON.parse(localStorage.getItem('dismissedOrders') || '[]');
    const order = orders.find((entry) =>
      !['entregado', 'cancelado'].includes(entry.estado_nombre)
      && !(entry.estado_nombre === 'rechazado' && dismissed.includes(entry.id_pedido))
    ) || null;
    if (!order) {
      setLastOrder(null);
      localStorage.removeItem('lastOrder');
      return null;
    }
    const payment = await api.get(`/api/v1/pedidos/${order.id_pedido}/pago`).catch(() => null);
    if (payment && Object.keys(payment).length) order.pago = payment;
    return saveLastOrder(order);
  };

  useEffect(() => {
    const load = async () => {
      const user = await refreshCurrentUser();
      await refreshData(user || currentUser);
    };
    load();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => refreshData(currentUser), 60_000);
    return () => window.clearInterval(interval);
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (restaurant, item) => {
    if (!item.available) return;

    setCart((current) => {
      const restaurantId = restaurant.id_tienda || Number(restaurant.id);
      const sameRestaurant = current.filter((entry) => entry.restaurantId === restaurantId);
      const found = sameRestaurant.find((entry) => entry.id === item.id);
      if (found) {
        return sameRestaurant.map((entry) => (
          entry.id === item.id ? { ...entry, quantity: entry.quantity + 1 } : entry
        ));
      }
      return [...sameRestaurant, {
        ...item,
        quantity: 1,
        restaurantName: restaurant.name,
        restaurantId,
        restaurantLocation: restaurant.nombre_lugar || restaurant.locationText || restaurant.category,
        restaurantReference: restaurant.referencia || ''
      }];
    });
  };

  const updateQuantity = (itemId, amount) => {
    setCart((current) =>
      current
        .map((item) => (item.id === itemId ? { ...item, quantity: Math.max(0, item.quantity + amount) } : item))
        .filter((item) => item.quantity > 0)
    );
  };

  const addMenuItem = async (restaurantId, item) => {
    const restaurant = restaurants.find((entry) => entry.id === String(restaurantId) || entry.id_tienda === restaurantId);
    const product = await api.post('/api/v1/productos', {
      id_tienda: restaurant?.id_tienda || Number(restaurantId),
      nombre: item.name,
      descripcion: item.description || 'Nuevo producto del restaurante.',
      precio: Number(item.price),
      stock: Number(item.stock || 20),
      descuento_porcentaje: Number(item.discount || 0),
      descuento_inicio: Number(item.discount || 0) > 0 ? item.discountStart : '',
      descuento_fin: Number(item.discount || 0) > 0 ? item.discountEnd : '',
      id_categorias: item.categoryIds || [],
      estado: true
    });
    if (item.imageFile) {
      const formData = new FormData();
      formData.append('imagen', item.imageFile);
      await api.upload(`/api/v1/productos/${product.id_producto || product.id}/imagen`, formData);
    }
    await refreshData();
  };

  const updateMenuItem = async (restaurantId, itemId, item) => {
    const restaurant = restaurants.find((entry) => entry.id === String(restaurantId) || entry.id_tienda === restaurantId);
    await api.patch(`/api/v1/productos/${itemId}`, {
      id_tienda: restaurant?.id_tienda || Number(restaurantId),
      nombre: item.name,
      descripcion: item.description,
      precio: Number(item.price),
      stock: Number(item.stock),
      descuento_porcentaje: Number(item.discount || 0),
      descuento_inicio: Number(item.discount || 0) > 0 ? item.discountStart : '',
      descuento_fin: Number(item.discount || 0) > 0 ? item.discountEnd : '',
      id_categorias: item.categoryIds || [],
      estado: item.available
    });
    await refreshData();
  };

  const createStore = async (payload) => {
    const { logoFile, ...storePayload } = payload;
    const store = await api.post('/api/v1/tiendas', storePayload);
    if (logoFile) {
      const formData = new FormData();
      formData.append('logo', logoFile);
      await api.upload(`/api/v1/tiendas/${store.id_tienda}/logo`, formData);
    }
    await refreshData();
    return store;
  };

  const deleteStore = async (storeId) => {
    await api.delete(`/api/v1/tiendas/${storeId}`);
    await refreshData();
    await refreshCurrentUser();
  };

  const createCategory = async (payload) => {
    const category = await api.post('/api/v1/categorias', payload);
    setCategories((current) => [...current, category].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    return category;
  };

  const updateStore = async (storeId, payload) => {
    const { logoFile, ...storePayload } = payload;
    const store = await api.patch(`/api/v1/tiendas/${storeId}`, storePayload);
    if (logoFile) {
      const formData = new FormData();
      formData.append('logo', logoFile);
      await api.upload(`/api/v1/tiendas/${storeId}/logo`, formData);
    }
    await refreshData();
    return store;
  };

  const addStoreStaff = async (storeId, payload) => {
    const staff = await api.post(`/api/v1/tiendas/${storeId}/personal`, payload);
    await refreshCurrentUser();
    return staff;
  };

  const createPlatformAdmin = async (payload) => {
    return api.post('/api/v1/admin-plataforma', payload);
  };

  const removeStoreStaff = async (storeId, staffId) => {
    await api.delete(`/api/v1/tiendas/${storeId}/personal/${staffId}`);
  };

  const deleteMenuItem = async (_restaurantId, itemId) => {
    await api.delete(`/api/v1/productos/${itemId}`);
    await refreshData();
  };

  const toggleAvailability = async (restaurantId, itemId) => {
    const restaurant = restaurants.find((entry) => entry.id === String(restaurantId) || entry.id_tienda === restaurantId);
    const product = restaurant?.menu.find((item) => item.id === itemId);
    await api.patch(`/api/v1/productos/${itemId}/disponibilidad`, { estado: !product?.available });
    await refreshData();
  };

  const login = async (correo, password) => {
    const result = await api.post('/api/v1/auth/login', { correo, password });
    localStorage.setItem('token', result.token);
    localStorage.setItem('usuario', JSON.stringify(result.usuario));
    localStorage.removeItem('lastOrder');
    setCurrentUser(result.usuario);
    setLastOrder(null);
    await refreshData(result.usuario);
    return result.usuario;
  };

  const register = async (payload) => {
    const result = await api.post('/api/v1/auth/register', payload);
    localStorage.setItem('token', result.token);
    localStorage.setItem('usuario', JSON.stringify(result.usuario));
    localStorage.removeItem('lastOrder');
    setCurrentUser(result.usuario);
    setLastOrder(null);
    await refreshData(result.usuario);
    return result.usuario;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    localStorage.removeItem('lastOrder');
    setCurrentUser(null);
    setLastOrder(null);
  };

  const toggleDeliveryMode = async () => {
    if (!currentUser) throw new Error('Inicia sesion para activar delivery');
    const user = currentUser;
    const updated = await api.patch(`/api/v1/usuarios/${user.id_usuario}/repartos`, {
      acepta_repartos: !user.acepta_repartos
    });
    localStorage.setItem('usuario', JSON.stringify(updated));
    setCurrentUser(updated);
  };

  const updateAccount = async (payload) => {
    if (!currentUser) throw new Error('Inicia sesion para editar tu cuenta');
    const updated = await api.patch(`/api/v1/usuarios/${currentUser.id_usuario}`, payload);
    localStorage.setItem('usuario', JSON.stringify(updated));
    setCurrentUser(updated);
    return updated;
  };

  const cancelOrder = async (orderId) => {
    const order = await api.patch(`/api/v1/pedidos/${orderId}/cancelar`, {});
    setLastOrder(null);
    localStorage.removeItem('lastOrder');
    return order;
  };

  const dismissLastOrder = () => {
    if (lastOrder?.id_pedido) {
      const dismissed = JSON.parse(localStorage.getItem('dismissedOrders') || '[]');
      localStorage.setItem('dismissedOrders', JSON.stringify(Array.from(new Set([...dismissed, lastOrder.id_pedido]))));
    }
    setLastOrder(null);
    localStorage.removeItem('lastOrder');
  };

  const checkout = async ({ tipo_pedido = 'delivery', id_metodo_pago, estado_pago, ...ubicacionEntrega }) => {
    if (!cart.length) return null;
    if (!currentUser) throw new Error('Inicia sesion para crear pedidos');
    const user = currentUser;
    const order = await api.post('/api/v1/pedidos', {
      id_usuario: user.id_usuario,
      id_tienda: cart[0].restaurantId || cart[0].id_tienda || 1,
      tipo_pedido,
      ...ubicacionEntrega,
      items: cart.map((item) => ({
        id_producto: item.id_producto || item.id,
        cantidad: item.quantity
      }))
    });
    const payment = await api.post(`/api/v1/pedidos/${order.id_pedido}/pago`, {
      id_metodo_pago,
      estado_pago
    });
    const refreshed = await api.get(`/api/v1/pedidos/${order.id_pedido}`).catch(() => order);
    refreshed.pago = payment;
    saveLastOrder(refreshed);
    setCart([]);
    return refreshed;
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.originalPrice * item.quantity, 0);
  const totalDiscount = subtotal - total;
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const storeMemberships = currentUser?.tiendas || [];
  const isPlatformAdmin = currentUser?.rol_usuario === 'admin_plataforma';
  const managedRestaurants = isPlatformAdmin
    ? restaurants
    : restaurants.filter((restaurant) => storeMemberships.some((membership) => membership.id_tienda === restaurant.id_tienda));
  const canCreateStores = isPlatformAdmin;
  const canManageStore = isPlatformAdmin || storeMemberships.length > 0;
  const canUseDelivery = isPlatformAdmin || Boolean(currentUser?.acepta_repartos);

  const value = useMemo(
    () => ({
      restaurants,
      categories,
      cart,
      total,
      subtotal,
      totalDiscount,
      cartCount,
      loading,
      apiError,
      currentUser,
      storeMemberships,
      isPlatformAdmin,
      managedRestaurants,
      canCreateStores,
      canManageStore,
      canUseDelivery,
      lastOrder,
      addToCart,
      updateQuantity,
      addMenuItem,
      updateMenuItem,
      deleteMenuItem,
      toggleAvailability,
      createStore,
      deleteStore,
      createCategory,
      updateStore,
      addStoreStaff,
      createPlatformAdmin,
      removeStoreStaff,
      setCart,
      login,
      register,
      logout,
      toggleDeliveryMode,
      updateAccount,
      checkout,
      cancelOrder,
      dismissLastOrder,
      refreshOrder,
      refreshLatestOrder,
      refreshData,
      refreshCurrentUser,
      setLastOrder
    }),
    [restaurants, categories, cart, total, subtotal, totalDiscount, cartCount, loading, apiError, currentUser, lastOrder]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

