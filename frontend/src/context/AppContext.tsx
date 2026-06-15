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
  const publicProducts = await api.get('/api/v1/productos');
  const memberships = user?.tiendas || [];
  const storeIds = user?.rol_usuario === 'admin_plataforma'
    ? stores.map((store) => store.id_tienda)
    : memberships.map((membership) => membership.id_tienda);

  if (!storeIds.length) return publicProducts;

  const storeProductResults = await Promise.allSettled(
    storeIds.map((id) => api.get(`/api/v1/tiendas/${id}/productos`))
  );
  const byId = new Map(publicProducts.map((product) => [product.id_producto, product]));
  storeProductResults.forEach((result) => {
    if (result.status === 'fulfilled') {
      result.value.forEach((product) => byId.set(product.id_producto, product));
    }
  });
  return Array.from(byId.values());
}

function storedCartForUser(user) {
  if (!user?.id_usuario) return [];
  const ownerId = localStorage.getItem('cartOwnerId');
  if (ownerId !== String(user.id_usuario)) {
    localStorage.removeItem('cart');
    localStorage.removeItem('cartOwnerId');
    return [];
  }
  return storedJson('cart', []);
}

export function storeIsWithinSchedule(openingValue, closingValue, now = new Date()) {
  const opening = String(openingValue || '').match(/^(\d{2}):(\d{2})$/);
  const closing = String(closingValue || '').match(/^(\d{2}):(\d{2})$/);
  if (!opening || !closing) return false;

  const timeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Guayaquil',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(now);
  const hour = Number(timeParts.find((part) => part.type === 'hour')?.value || 0);
  const minute = Number(timeParts.find((part) => part.type === 'minute')?.value || 0);
  const currentMinutes = hour * 60 + minute;
  const openingMinutes = Number(opening[1]) * 60 + Number(opening[2]);
  const closingMinutes = Number(closing[1]) * 60 + Number(closing[2]);

  return openingMinutes <= currentMinutes && currentMinutes < closingMinutes;
}

export function useApp() {
  return useContext(AppContext);
}

export function AppProvider({ children }) {
  const storedUser = storedJson('usuario', null);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>(() => storedCartForUser(storedUser));
  const [currentUser, setCurrentUser] = useState(storedUser);
  const [lastOrder, setLastOrder] = useState(() => storedJson('lastOrder', null));
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [cartError, setCartError] = useState('');

  const refreshCurrentUser = async () => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
      const user = await api.get('/api/v1/auth/me');
      if (localStorage.getItem('cartOwnerId') !== String(user.id_usuario)) {
        localStorage.removeItem('cart');
        localStorage.setItem('cartOwnerId', String(user.id_usuario));
        setCart([]);
      }
      localStorage.setItem('usuario', JSON.stringify(user));
      setCurrentUser(user);
      return user;
    } catch (_error) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      setCurrentUser(null);
      setCart([]);
      setCartError('');
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
        const storeLogo = storeLogoUrl(store.logo_url) || logoImage;
        const manuallyOpen = Boolean(store.estado);
        const withinSchedule = storeIsWithinSchedule(store.horario_apertura, store.horario_cierre);
        const storeAvailable = typeof store.disponible === 'boolean'
          ? store.disponible
          : manuallyOpen && withinSchedule;
        const closedBySchedule = typeof store.cerrada_por_horario === 'boolean'
          ? store.cerrada_por_horario
          : manuallyOpen && !withinSchedule;
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
            enabled: Boolean(product.estado),
            available: Boolean(product.estado) && Number(product.stock || 0) > 0 && storeAvailable,
            categories: Array.isArray(product.categorias) ? product.categorias : [],
            categoryIds: Array.isArray(product.categorias)
              ? product.categorias.map((category) => category.id_categoria)
              : [],
            isExtra: Array.isArray(product.categorias)
              && product.categorias.some((category) => category.nombre?.toLowerCase() === 'extra'),
            isOnlyExtra: Array.isArray(product.categorias)
              && product.categorias.length > 0
              && product.categorias.every((category) => category.nombre?.toLowerCase() === 'extra'),
            imageUrl: product.imagen_url || '',
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
          manuallyOpen,
          available: storeAvailable,
          closedBySchedule,
          locationText: [store.nombre_lugar, store.referencia].filter(Boolean).join(' '),
          logoUrl: store.logo_url || '',
          image: storeLogo,
          logo: storeLogo,
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
        if (!latest || Number(latest.stock || 0) <= 0) return null;
        return {
          ...item,
          ...latest,
          quantity: Math.min(item.quantity, Number(latest.stock || 0))
        };
      }).filter(Boolean));
    } catch (_error) {
      setApiError('No pudimos cargar el menu en este momento. Intenta nuevamente.');
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
    const refreshVisibleData = () => {
      if (document.visibilityState === 'visible') refreshData(currentUser);
    };
    window.addEventListener('focus', refreshVisibleData);
    document.addEventListener('visibilitychange', refreshVisibleData);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshVisibleData);
      document.removeEventListener('visibilitychange', refreshVisibleData);
    };
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser?.id_usuario) {
      localStorage.removeItem('cart');
      localStorage.removeItem('cartOwnerId');
      return;
    }
    localStorage.setItem('cartOwnerId', String(currentUser.id_usuario));
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart, currentUser?.id_usuario]);

  const addToCart = (restaurant, item) => {
    if (!restaurant.available) {
      setCartError('La tienda no esta disponible en este momento.');
      return;
    }
    if (!item.available || Number(item.stock || 0) <= 0) {
      setCartError('Este producto no tiene stock disponible.');
      return;
    }

    setCart((current) => {
      const restaurantId = restaurant.id_tienda || Number(restaurant.id);
      const sameRestaurant = current.filter((entry) => entry.restaurantId === restaurantId);
      const found = sameRestaurant.find((entry) => entry.id === item.id);
      if (found) {
        if (found.quantity >= Number(item.stock || 0)) {
          setCartError(`Solo hay ${item.stock} unidades disponibles de ${item.name}.`);
          return current;
        }
        setCartError('');
        return sameRestaurant.map((entry) => (
          entry.id === item.id ? { ...entry, quantity: entry.quantity + 1 } : entry
        ));
      }
      setCartError('');
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
    setCart((current) => current
      .map((item) => {
        if (item.id !== itemId) return item;
        const requested = Math.max(0, item.quantity + amount);
        const stock = Number(item.stock || 0);
        if (requested > stock) {
          setCartError(`Solo hay ${stock} unidades disponibles de ${item.name}.`);
          return item;
        }
        setCartError('');
        return { ...item, quantity: requested };
      })
      .filter((item) => item.quantity > 0));
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
      imagen_url: item.imageUrl || '',
      estado: true
    });
    await refreshData();
    return product;
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
      imagen_url: item.imageUrl || '',
      estado: item.enabled
    });
    await refreshData();
  };

  const createStore = async (payload) => {
    const store = await api.post('/api/v1/tiendas', payload);
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
    const store = await api.patch(`/api/v1/tiendas/${storeId}`, payload);
    await refreshData();
    return store;
  };

  const toggleStoreAvailability = async (storeId) => {
    const restaurant = restaurants.find((entry) => entry.id_tienda === storeId);
    const store = await api.patch(`/api/v1/tiendas/${storeId}/disponibilidad`, {
      estado: !restaurant?.manuallyOpen
    });
    setRestaurants((current) => current.map((entry) => (
      entry.id_tienda === storeId
        ? {
            ...entry,
            manuallyOpen: Boolean(store.estado),
            available: Boolean(store.disponible),
            closedBySchedule: Boolean(store.cerrada_por_horario)
          }
        : entry
    )));
    await refreshData(currentUser);
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
    await api.patch(`/api/v1/productos/${itemId}/disponibilidad`, { estado: !product?.enabled });
    await refreshData();
  };

  const login = async (correo, password) => {
    const result = await api.post('/api/v1/auth/login', { correo, password });
    localStorage.removeItem('cart');
    localStorage.setItem('cartOwnerId', String(result.usuario.id_usuario));
    localStorage.setItem('token', result.token);
    localStorage.setItem('usuario', JSON.stringify(result.usuario));
    localStorage.removeItem('lastOrder');
    setCurrentUser(result.usuario);
    setLastOrder(null);
    setCart([]);
    setCartError('');
    await refreshData(result.usuario);
    return result.usuario;
  };

  const register = async (payload) => {
    const result = await api.post('/api/v1/auth/register', payload);
    localStorage.removeItem('cart');
    localStorage.setItem('cartOwnerId', String(result.usuario.id_usuario));
    localStorage.setItem('token', result.token);
    localStorage.setItem('usuario', JSON.stringify(result.usuario));
    localStorage.removeItem('lastOrder');
    setCurrentUser(result.usuario);
    setLastOrder(null);
    setCart([]);
    setCartError('');
    await refreshData(result.usuario);
    return result.usuario;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    localStorage.removeItem('lastOrder');
    localStorage.removeItem('cart');
    localStorage.removeItem('cartOwnerId');
    setCurrentUser(null);
    setLastOrder(null);
    setCart([]);
    setCartError('');
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
    const restaurant = restaurants.find((entry) => entry.id_tienda === cart[0].restaurantId);
    if (!restaurant?.available) {
      throw new Error('La tienda no esta disponible en este momento.');
    }
    const unavailableItem = cart.find((item) => item.quantity > Number(item.stock || 0));
    if (unavailableItem) {
      throw new Error(`Solo hay ${unavailableItem.stock} unidades disponibles de ${unavailableItem.name}.`);
    }
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
    setCartError('');
    await refreshData(user);
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
      cartError,
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
      toggleStoreAvailability,
      addStoreStaff,
      createPlatformAdmin,
      removeStoreStaff,
      setCart,
      setCartError,
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
    [restaurants, categories, cart, total, subtotal, totalDiscount, cartCount, loading, apiError, cartError, currentUser, lastOrder]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

