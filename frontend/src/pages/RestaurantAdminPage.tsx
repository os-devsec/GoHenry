import React from 'react';
import { CalendarClock, ChevronDown, ChevronUp, History, Pencil, Percent, Save, Store, Tags, Trash2, UserPlus, Users, UtensilsCrossed, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.ts';
import { foodImage } from '../assets.ts';
import AdminMetric from '../components/admin/AdminMetric.tsx';
import IconButton from '../components/common/IconButton.tsx';
import IncomingOrderCard from '../components/orders/IncomingOrderCard.tsx';
import { useApp } from '../context/AppContext.tsx';
import { formatCurrency } from '../utils/format.ts';

export default function RestaurantAdminPage() {
  const {
    managedRestaurants,
    categories,
    storeMemberships,
    isPlatformAdmin,
    addMenuItem,
    createCategory,
    addStoreStaff,
    deleteMenuItem,
    removeStoreStaff,
    toggleAvailability,
    toggleStoreAvailability,
    updateMenuItem,
    updateStore
  } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedStoreId, setSelectedStoreId] = useState(searchParams.get('tienda') || '');
  const restaurant = managedRestaurants.find((entry) => String(entry.id_tienda) === selectedStoreId) || managedRestaurants[0];
  const [form, setForm] = useState({ name: '', description: '', price: '', stock: '20', discount: '0', discountStart: '', discountEnd: '', categoryIds: [], imageUrl: '' });
  const [newCategoryName, setNewCategoryName] = useState('');
  const [staffForm, setStaffForm] = useState({ nombre: '', apellido: '', correo: '', telefono: '', password: '', cargo: 'empleado' });
  const [staff, setStaff] = useState([]);
  const [incomingOrders, setIncomingOrders] = useState([]);
  const [showOrderHistory, setShowOrderHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', price: '', stock: '', discount: '0', discountStart: '', discountEnd: '', categoryIds: [], imageUrl: '', enabled: true });
  const [storeForm, setStoreForm] = useState(null);
  const [storeMessage, setStoreMessage] = useState('');
  const [storeError, setStoreError] = useState('');
  const currentMembership = storeMemberships.find((membership) => membership.id_tienda === restaurant?.id_tienda);
  const canManageProducts = isPlatformAdmin || currentMembership?.cargo === 'administrador';
  const canManageStaff = canManageProducts;
  const terminalOrderStatuses = ['entregado', 'cancelado', 'rechazado'];
  const activeOrders = incomingOrders.filter((order) => !terminalOrderStatuses.includes(order.status));
  const orderHistory = incomingOrders.filter((order) => terminalOrderStatuses.includes(order.status));

  useEffect(() => {
    if (!restaurant) return;
    setStoreForm({
      nombre: restaurant.name,
      sucursal: restaurant.sucursal,
      nombre_lugar: restaurant.nombre_lugar,
      referencia: restaurant.referencia,
      horario_apertura: restaurant.horario_apertura,
      horario_cierre: restaurant.horario_cierre,
      logo_url: restaurant.logoUrl || ''
    });
  }, [
    restaurant?.id_tienda,
    restaurant?.name,
    restaurant?.sucursal,
    restaurant?.nombre_lugar,
    restaurant?.referencia,
    restaurant?.horario_apertura,
    restaurant?.horario_cierre,
    restaurant?.logoUrl
  ]);

  const loadOrders = async () => {
    if (!restaurant) return;
    const data = await api.get(`/api/v1/pedidos?tienda=${restaurant.id_tienda || 1}`).catch(() => []);
    setIncomingOrders(data.map((order) => ({
      id: order.id_pedido,
      code: `Pedido #${order.id_pedido}`,
      title: 'Nuevo pedido para preparar',
      customer: `Cliente: ${order.cliente_nombre}`,
      type: order.tipo_pedido,
      location: order.tipo_pedido === 'pickup'
        ? `Retiro en tienda: ${restaurant.name}`
        : `Entrega: ${order.nombre_lugar_entrega}${order.referencia_entrega ? ` - ${order.referencia_entrega}` : ''}`,
      time: order.fecha_pedido,
      status: order.estado_nombre,
      total: order.total_tienda ?? order.subtotal,
      items: order.items.map((item) => ({ qty: item.cantidad, name: item.nombre, subtotal: item.subtotal }))
    })));
  };

  const loadStaff = async () => {
    if (!restaurant || !canManageStaff) {
      setStaff([]);
      return;
    }
    const data = await api.get(`/api/v1/tiendas/${restaurant.id_tienda}/personal`).catch(() => []);
    setStaff(data);
  };

  useEffect(() => {
    loadOrders();
    loadStaff();
    const interval = window.setInterval(loadOrders, 5000);
    return () => window.clearInterval(interval);
  }, [restaurant?.id_tienda, canManageStaff]);

  if (!restaurant) {
    return (
      <div className="rounded-lg border border-dashed border-wine-200 bg-white p-8 text-center">
        <h1 className="text-2xl font-black text-wine-900">No hay tiendas registradas</h1>
        <p className="mt-2 text-sm text-stone-500">Un admin de plataforma debe crear o asignarte una tienda.</p>
      </div>
    );
  }

  const updateOrderStatus = async (orderId, status) => {
    const order = incomingOrders.find((entry) => entry.id === orderId);
    const estado = status === 'aceptado'
      ? 'en_preparacion'
      : status === 'listo'
        ? 'listo_para_entrega'
        : status === 'entregado'
          ? 'entregado'
          : 'rechazado';
    await api.patch(`/api/v1/pedidos/${orderId}/estado`, { estado });
    if (status === 'aceptado' && order?.type === 'delivery') {
      await api.post('/api/v1/asignaciones-repartidor', { id_pedido: orderId }).catch(() => null);
    }
    await loadOrders();
  };

  const submitStore = async (event) => {
    event.preventDefault();
    if (!storeForm) return;
    try {
      setSaving(true);
      setStoreError('');
      setStoreMessage('');
      await updateStore(restaurant.id_tienda, storeForm);
      setStoreMessage('Informacion y horario actualizados correctamente.');
    } catch (_error) {
      setStoreError('No se pudo actualizar la tienda. Revisa los datos e intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  const changeStoreAvailability = async () => {
    try {
      setSaving(true);
      setStoreError('');
      setStoreMessage('');
      await toggleStoreAvailability(restaurant.id_tienda);
      setStoreMessage(restaurant.manuallyOpen ? 'Tienda cerrada manualmente.' : 'Tienda habilitada correctamente.');
    } catch (_error) {
      setStoreError('No se pudo cambiar el estado de la tienda.');
    } finally {
      setSaving(false);
    }
  };

  const startEditingProduct = (item) => {
    setEditingProductId(item.id);
    setEditForm({
      name: item.name,
      description: item.description,
      price: String(item.originalPrice),
      stock: String(item.stock),
      discount: String(item.configuredDiscount || 0),
      discountStart: item.discountStart || '',
      discountEnd: item.discountEnd || '',
      categoryIds: item.categoryIds || [],
      imageUrl: item.imageUrl || '',
      enabled: item.enabled
    });
  };

  const submitProductEdit = async (event) => {
    event.preventDefault();
    await updateMenuItem(restaurant.id_tienda, editingProductId, editForm);
    setEditingProductId(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name || !form.price) return;
    setSaving(true);
    await addMenuItem(restaurant.id, {
      name: form.name,
      description: form.description || 'Nuevo producto del restaurante.',
      price: Number(form.price),
      stock: Number(form.stock),
      discount: Number(form.discount),
      discountStart: form.discountStart,
      discountEnd: form.discountEnd,
      categoryIds: form.categoryIds,
      imageUrl: form.imageUrl
    });
    setForm({ name: '', description: '', price: '', stock: '20', discount: '0', discountStart: '', discountEnd: '', categoryIds: [], imageUrl: '' });
    setSaving(false);
  };

  const addCategory = async () => {
    const nombre = newCategoryName.trim();
    if (!nombre) return;
    const existing = categories.find((category) => category.nombre.toLowerCase() === nombre.toLowerCase());
    const category = existing || await createCategory({ nombre, descripcion: '' });
    setForm((current) => ({
      ...current,
      categoryIds: Array.from(new Set([...current.categoryIds, category.id_categoria]))
    }));
    setNewCategoryName('');
  };

  const submitStaff = async (event) => {
    event.preventDefault();
    if (!staffForm.correo) return;
    await addStoreStaff(restaurant.id_tienda, staffForm);
    setStaffForm({ nombre: '', apellido: '', correo: '', telefono: '', password: '', cargo: 'empleado' });
    await loadStaff();
  };

  const removeStaff = async (staffId) => {
    await removeStoreStaff(restaurant.id_tienda, staffId);
    await loadStaff();
  };

  return (
    <div className="space-y-6">
      <section aria-labelledby="restaurant-admin-title" className="flex flex-col gap-4 rounded-lg bg-wine-700 p-5 text-white shadow-soft md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-bold text-maize-300">Panel restaurante</p>
          <h1 id="restaurant-admin-title" className="text-3xl font-black">{restaurant.name}</h1>
          <p className="mt-1 text-wine-50">Gestiona tienda, productos y pedidos entrantes dentro de la institucion.</p>
        </div>
        {managedRestaurants.length > 1 && (
          <label className="block space-y-2">
            <span className="text-sm font-bold text-wine-50">Tienda activa</span>
            <select
              className="field max-w-xs bg-white text-stone-900"
              value={restaurant.id_tienda}
              onChange={(event) => {
                setSelectedStoreId(event.target.value);
                setSearchParams({ tienda: event.target.value });
              }}
            >
              {managedRestaurants.map((entry) => (
                <option key={entry.id_tienda} value={entry.id_tienda}>{entry.name}</option>
              ))}
            </select>
          </label>
        )}
        <img src={restaurant.logo} alt="" className="h-20 w-20 rounded-lg border-4 border-white object-cover" />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <AdminMetric
          icon={<Store size={20} />}
          label="Estado"
          value={restaurant.available ? 'Abierta' : restaurant.closedBySchedule ? 'Cerrada por horario' : 'Cerrada manualmente'}
        />
        <AdminMetric
          icon={<CalendarClock size={20} />}
          label="Horario"
          value={`${restaurant.horario_apertura} - ${restaurant.horario_cierre}`}
        />
        <AdminMetric icon={<UtensilsCrossed size={20} />} label="Platos" value={restaurant.menu.length} />
      </section>

      {canManageProducts && storeForm && (
        <form onSubmit={submitStore} className="rounded-lg bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-wine-900">Informacion del restaurante</h2>
              <p className="text-sm text-stone-500">Solo administradores de plataforma o de esta tienda pueden modificarla.</p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={changeStoreAvailability}
                className={`rounded-full px-4 py-2 text-sm font-black text-white ${restaurant.manuallyOpen ? 'bg-stone-700' : 'bg-green-700'}`}
              >
                {restaurant.manuallyOpen ? 'Cerrar tienda' : 'Abrir tienda'}
              </button>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-wine-600 px-4 py-2 text-sm font-black text-white">
                <Save size={16} /> Guardar
              </button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Field label="Nombre"><input className="field" value={storeForm.nombre} onChange={(event) => setStoreForm({ ...storeForm, nombre: event.target.value })} /></Field>
            <Field label="Sucursal"><input className="field" value={storeForm.sucursal} onChange={(event) => setStoreForm({ ...storeForm, sucursal: event.target.value })} /></Field>
            <Field label="Lugar"><input className="field" value={storeForm.nombre_lugar} onChange={(event) => setStoreForm({ ...storeForm, nombre_lugar: event.target.value })} /></Field>
            <Field label="Referencia"><input className="field" value={storeForm.referencia} onChange={(event) => setStoreForm({ ...storeForm, referencia: event.target.value })} /></Field>
            <Field label="Apertura"><input className="field" type="time" value={storeForm.horario_apertura} onChange={(event) => setStoreForm({ ...storeForm, horario_apertura: event.target.value })} /></Field>
            <Field label="Cierre"><input className="field" type="time" value={storeForm.horario_cierre} onChange={(event) => setStoreForm({ ...storeForm, horario_cierre: event.target.value })} /></Field>
            <Field label="Enlace del logo" wide><input className="field" type="url" placeholder="https://ejemplo.com/logo.jpg" value={storeForm.logo_url} onChange={(event) => setStoreForm({ ...storeForm, logo_url: event.target.value })} /></Field>
          </div>
          {storeMessage && <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm font-bold text-green-700">{storeMessage}</p>}
          {storeError && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{storeError}</p>}
        </form>
      )}

      <section aria-labelledby="incoming-orders-title" className="space-y-3">
        <div>
          <h2 id="incoming-orders-title" className="text-2xl font-black text-wine-900">Pedidos entrantes</h2>
          <p className="text-sm text-stone-500">Revisa, acepta y prepara los pedidos de esta tienda.</p>
        </div>
        <ul className="grid gap-3 lg:grid-cols-2">
          {activeOrders.map((order) => (
            <li key={order.id}>
              <IncomingOrderCard
                order={order}
                acceptLabel="Aceptar pedido"
                totalLabel="Total de platos"
                onAccept={(orderId) => updateOrderStatus(orderId, 'aceptado')}
                onReject={(orderId) => updateOrderStatus(orderId, 'rechazado')}
                onReady={(orderId) => updateOrderStatus(orderId, 'listo')}
                onComplete={(orderId) => updateOrderStatus(orderId, 'entregado')}
              />
            </li>
          ))}
          {!activeOrders.length && (
            <li className="rounded-lg border border-dashed border-wine-200 bg-white p-6 text-sm text-stone-600 lg:col-span-2">
              <p className="font-black text-wine-900">No hay pedidos activos</p>
              <p className="mt-1">Los pedidos nuevos y en preparacion apareceran aqui.</p>
            </li>
          )}
        </ul>
        <button
          type="button"
          onClick={() => setShowOrderHistory((current) => !current)}
          className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-4 py-2 text-sm font-black text-wine-800"
          aria-expanded={showOrderHistory}
        >
          <History size={17} />
          Historial de pedidos ({orderHistory.length})
          {showOrderHistory ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
        </button>
        {showOrderHistory && (
          <div className="space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-4">
            <h3 className="text-lg font-black text-wine-900">Pedidos completados y cancelados</h3>
            <ul className="grid gap-3 lg:grid-cols-2">
              {orderHistory.map((order) => (
                <li key={order.id}>
                  <IncomingOrderCard
                    order={order}
                    totalLabel="Total de platos"
                    onAccept={() => {}}
                    showReject={false}
                  />
                </li>
              ))}
              {!orderHistory.length && (
                <li className="text-sm text-stone-500 lg:col-span-2">Todavia no hay pedidos en el historial.</li>
              )}
            </ul>
          </div>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        {canManageProducts && (
        <form onSubmit={submit} aria-labelledby="add-product-title" className="h-fit rounded-lg bg-white p-5 shadow-sm">
          <h2 id="add-product-title" className="text-xl font-black text-wine-900">Agregar plato</h2>
          <div className="mt-4 space-y-3">
            <Field label="Nombre del plato">
              <input className="field" placeholder="Nombre del plato" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </Field>
            <Field label="Descripcion">
              <textarea className="field min-h-24" placeholder="Descripcion" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </Field>
            <Field label="Precio">
              <input className="field" type="number" min="0" step="0.01" placeholder="Precio" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} />
            </Field>
            <Field label="Stock">
              <input className="field" type="number" min="0" step="1" placeholder="Stock" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} />
            </Field>
            <Field label="Descuento porcentual">
              <div className="relative">
                <input className="field pr-10" type="number" min="0" max="100" step="1" placeholder="0" value={form.discount} onChange={(event) => setForm({ ...form, discount: event.target.value })} />
                <Percent className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-wine-600" size={17} />
              </div>
              <span className="block text-xs text-stone-500">Ejemplo: 15 equivale a 15% de descuento.</span>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Inicio del descuento">
                <input className="field" type="time" required={Number(form.discount) > 0} value={form.discountStart} onChange={(event) => setForm({ ...form, discountStart: event.target.value })} />
              </Field>
              <Field label="Fin del descuento">
                <input className="field" type="time" required={Number(form.discount) > 0} value={form.discountEnd} onChange={(event) => setForm({ ...form, discountEnd: event.target.value })} />
              </Field>
            </div>
            <p className="text-xs text-stone-500">El horario se repite todos los dias en la zona horaria de Ecuador.</p>
            <Field label="Categorias">
              <CategorySelector
                categories={categories}
                selected={form.categoryIds}
                onChange={(categoryIds) => setForm({ ...form, categoryIds })}
              />
            </Field>
            <Field label="Crear categoria">
              <div className="flex gap-2">
                <input className="field" value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="Ej. Bebidas o Extra" />
                <button type="button" onClick={addCategory} className="inline-flex items-center gap-2 rounded-lg bg-stone-100 px-4 py-2 text-sm font-black text-wine-800">
                  <Tags size={16} /> Crear
                </button>
              </div>
            </Field>
            <Field label="Enlace de la imagen">
              <input className="field" type="url" placeholder="https://ejemplo.com/plato.jpg" value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} />
            </Field>
            <button type="submit" disabled={saving} className="w-full rounded-full bg-wine-600 px-5 py-3 font-black text-white disabled:bg-stone-300">
              {saving ? 'Guardando...' : 'Agregar al menu'}
            </button>
          </div>
        </form>
        )}

        <section aria-labelledby="menu-products-title" className={`space-y-3 ${!canManageProducts ? 'lg:col-span-2' : ''}`}>
          <h2 id="menu-products-title" className="sr-only">Productos del menu</h2>
          <ul className="space-y-3">
          {restaurant.menu.map((item) => (
            <li key={item.id}>
              {editingProductId === item.id ? (
                <form onSubmit={submitProductEdit} className="rounded-lg bg-white p-4 shadow-sm">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Nombre"><input className="field" value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} /></Field>
                    <Field label="Precio"><input className="field" type="number" min="0" step="0.01" value={editForm.price} onChange={(event) => setEditForm({ ...editForm, price: event.target.value })} /></Field>
                    <Field label="Descripcion" wide><textarea className="field" value={editForm.description} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} /></Field>
                    <Field label="Stock"><input className="field" type="number" min="0" value={editForm.stock} onChange={(event) => setEditForm({ ...editForm, stock: event.target.value })} /></Field>
                    <Field label="Descuento (%)"><input className="field" type="number" min="0" max="100" value={editForm.discount} onChange={(event) => setEditForm({ ...editForm, discount: event.target.value })} /></Field>
                    <Field label="Inicio descuento"><input className="field" type="time" required={Number(editForm.discount) > 0} value={editForm.discountStart} onChange={(event) => setEditForm({ ...editForm, discountStart: event.target.value })} /></Field>
                    <Field label="Fin descuento"><input className="field" type="time" required={Number(editForm.discount) > 0} value={editForm.discountEnd} onChange={(event) => setEditForm({ ...editForm, discountEnd: event.target.value })} /></Field>
                    <Field label="Enlace de la imagen" wide><input className="field" type="url" placeholder="https://ejemplo.com/plato.jpg" value={editForm.imageUrl} onChange={(event) => setEditForm({ ...editForm, imageUrl: event.target.value })} /></Field>
                    <Field label="Categorias" wide>
                      <CategorySelector
                        categories={categories}
                        selected={editForm.categoryIds}
                        onChange={(categoryIds) => setEditForm({ ...editForm, categoryIds })}
                      />
                    </Field>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button type="submit" className="inline-flex items-center gap-2 rounded-full bg-wine-600 px-4 py-2 text-sm font-black text-white"><Save size={16} /> Guardar plato</button>
                    <button type="button" onClick={() => setEditingProductId(null)} className="inline-flex items-center gap-2 rounded-full bg-stone-200 px-4 py-2 text-sm font-black text-stone-700"><X size={16} /> Cancelar</button>
                  </div>
                </form>
              ) : (
              <article className="flex flex-col gap-3 rounded-lg bg-white p-4 shadow-sm sm:flex-row sm:items-center">
                <img src={item.image || foodImage} alt="" className="h-20 w-full rounded-lg object-cover sm:w-24" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-black">{item.name}</h3>
                  <p className="line-clamp-1 text-sm text-stone-500">{item.description}</p>
                  <p className="mt-1 text-xs font-bold text-stone-500">
                    {item.categories?.map((category) => category.nombre).join(', ') || 'Sin categoria'}
                  </p>
                  <p className="mt-1 font-bold text-wine-700">
                    {formatCurrency(item.price)}
                    {item.configuredDiscount > 0 && (
                      <span className={`ml-2 rounded-full px-2 py-1 text-xs ${item.discountActive ? 'bg-maize-100 text-wine-800' : 'bg-stone-100 text-stone-600'}`}>
                        {item.configuredDiscount}% de {item.discountStart} a {item.discountEnd}
                      </span>
                    )}
                  </p>
                </div>
                {canManageProducts && <div className="flex gap-2">
                  <button type="button" onClick={() => toggleAvailability(restaurant.id, item.id)} aria-pressed={item.enabled} className={`rounded-full px-4 py-2 text-sm font-black ${item.enabled ? 'bg-maize-300 text-wine-900' : 'bg-stone-200 text-stone-600'}`}>
                    {item.enabled ? (Number(item.stock) > 0 ? 'Disponible' : 'Sin stock') : 'Pausado'}
                  </button>
                  <IconButton label={`Editar ${item.name}`} onClick={() => startEditingProduct(item)} icon={<Pencil size={16} />} />
                  <IconButton label={`Eliminar ${item.name}`} onClick={() => deleteMenuItem(restaurant.id, item.id)} icon={<Trash2 size={16} />} />
                </div>}
              </article>
              )}
            </li>
          ))}
          </ul>
        </section>
      </section>

      {canManageStaff && (
        <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <form onSubmit={submitStaff} aria-labelledby="create-staff-title" className="h-fit rounded-lg bg-white p-5 shadow-sm">
            <h2 id="create-staff-title" className="flex items-center gap-2 text-xl font-black text-wine-900"><UserPlus size={20} /> Crear empleado</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Field label="Nombre">
                <input autoComplete="given-name" className="field" placeholder="Nombre" value={staffForm.nombre} onChange={(event) => setStaffForm({ ...staffForm, nombre: event.target.value })} />
              </Field>
              <Field label="Apellido">
                <input autoComplete="family-name" className="field" placeholder="Apellido" value={staffForm.apellido} onChange={(event) => setStaffForm({ ...staffForm, apellido: event.target.value })} />
              </Field>
              <Field label="Correo" wide>
                <input required autoComplete="email" className="field" type="email" placeholder="Correo" value={staffForm.correo} onChange={(event) => setStaffForm({ ...staffForm, correo: event.target.value })} />
              </Field>
              <Field label="Telefono">
                <input autoComplete="tel" className="field" type="tel" placeholder="Telefono" value={staffForm.telefono} onChange={(event) => setStaffForm({ ...staffForm, telefono: event.target.value })} />
              </Field>
              <Field label="Contrasena si es nuevo">
                <input autoComplete="new-password" className="field" type="password" placeholder="Contrasena si es nuevo" value={staffForm.password} onChange={(event) => setStaffForm({ ...staffForm, password: event.target.value })} />
              </Field>
              <Field label="Cargo" wide>
                <select className="field" value={staffForm.cargo} onChange={(event) => setStaffForm({ ...staffForm, cargo: event.target.value })}>
                  <option value="empleado">Empleado</option>
                  <option value="administrador">Administrador de tienda</option>
                </select>
              </Field>
              <button type="submit" className="rounded-full bg-wine-600 px-5 py-3 font-black text-white md:col-span-2">Guardar empleado</button>
            </div>
          </form>

          <section aria-labelledby="store-staff-title" className="rounded-lg bg-white p-5 shadow-sm">
            <h2 id="store-staff-title" className="flex items-center gap-2 text-xl font-black text-wine-900"><Users size={20} /> Personal de tienda</h2>
            <ul className="mt-4 space-y-3">
              {staff.map((person) => (
                <li key={person.id_tienda_usuario}>
                  <article className="flex flex-col gap-3 rounded-lg border border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-black text-stone-900">{person.nombre} {person.apellido}</h3>
                      <p className="text-sm text-stone-500">{person.correo}</p>
                      <p className="mt-1 text-xs font-black uppercase text-wine-700">{person.cargo}</p>
                    </div>
                    <IconButton label={`Quitar a ${person.nombre} ${person.apellido}`} onClick={() => removeStaff(person.id_tienda_usuario)} icon={<Trash2 size={16} />} />
                  </article>
                </li>
              ))}
              {!staff.length && <li className="rounded-lg border border-dashed border-stone-200 p-4 text-sm text-stone-500">Aun no hay empleados asignados.</li>}
            </ul>
          </section>
        </section>
      )}
    </div>
  );
}

function Field({ label, children, wide = false }) {
  return (
    <label className={`block space-y-2 ${wide ? 'md:col-span-2' : ''}`}>
      <span className="text-sm font-bold text-stone-700">{label}</span>
      {children}
    </label>
  );
}

function CategorySelector({ categories, selected, onChange }) {
  const toggle = (categoryId) => {
    onChange(
      selected.includes(categoryId)
        ? selected.filter((id) => id !== categoryId)
        : [...selected, categoryId]
    );
  };

  return (
    <div className="flex flex-wrap gap-2 rounded-lg border border-stone-200 p-3">
      {categories.map((category) => (
        <label key={category.id_categoria} className={`inline-flex cursor-pointer items-center gap-2 rounded-full px-3 py-2 text-sm font-bold ${selected.includes(category.id_categoria) ? 'bg-wine-600 text-white' : 'bg-stone-100 text-stone-600'}`}>
          <input
            type="checkbox"
            className="sr-only"
            checked={selected.includes(category.id_categoria)}
            onChange={() => toggle(category.id_categoria)}
          />
          {category.nombre}
        </label>
      ))}
      {!categories.length && <span className="text-sm text-stone-500">Crea la primera categoria para clasificar el producto.</span>}
    </div>
  );
}

