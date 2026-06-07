import React from 'react';
import { CalendarClock, Pencil, Percent, Save, Store, Trash2, UserPlus, Users, UtensilsCrossed, X } from 'lucide-react';
import { useEffect, useState } from 'react';
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
    storeMemberships,
    isPlatformAdmin,
    addMenuItem,
    addStoreStaff,
    deleteMenuItem,
    removeStoreStaff,
    toggleAvailability,
    updateMenuItem,
    updateStore
  } = useApp();
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const restaurant = managedRestaurants.find((entry) => String(entry.id_tienda) === selectedStoreId) || managedRestaurants[0];
  const [form, setForm] = useState({ name: '', description: '', price: '', stock: '20', discount: '0', imageFile: null });
  const [staffForm, setStaffForm] = useState({ nombre: '', apellido: '', correo: '', telefono: '', password: '', cargo: 'empleado' });
  const [staff, setStaff] = useState([]);
  const [incomingOrders, setIncomingOrders] = useState([]);
  const [saving, setSaving] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', price: '', stock: '', discount: '0', available: true });
  const [storeForm, setStoreForm] = useState(null);
  const currentMembership = storeMemberships.find((membership) => membership.id_tienda === restaurant?.id_tienda);
  const canManageProducts = isPlatformAdmin || currentMembership?.cargo === 'administrador';
  const canManageStaff = canManageProducts;

  useEffect(() => {
    if (!restaurant) return;
    setStoreForm({
      nombre: restaurant.name,
      sucursal: restaurant.sucursal,
      nombre_lugar: restaurant.nombre_lugar,
      referencia: restaurant.referencia,
      horario_apertura: restaurant.horario_apertura,
      horario_cierre: restaurant.horario_cierre,
      logoFile: null
    });
  }, [restaurant?.id_tienda]);

  const loadOrders = async () => {
    if (!restaurant) return;
    const data = await api.get(`/api/v1/pedidos?tienda=${restaurant.id_tienda || 1}`).catch(() => []);
    setIncomingOrders(data.map((order) => ({
      id: order.id_pedido,
      code: `Pedido #${order.id_pedido}`,
      title: 'Nuevo pedido para preparar',
      customer: `Cliente: ${order.cliente_nombre}`,
      location: `Entrega: ${order.nombre_lugar_entrega}${order.referencia_entrega ? ` - ${order.referencia_entrega}` : ''}`,
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
    const estado = status === 'aceptado' ? 'en_preparacion' : 'rechazado';
    await api.patch(`/api/v1/pedidos/${orderId}/estado`, { estado });
    if (status === 'aceptado') {
      await api.post('/api/v1/asignaciones-repartidor', { id_pedido: orderId }).catch(() => null);
    }
    await loadOrders();
  };

  const submitStore = async (event) => {
    event.preventDefault();
    if (!storeForm) return;
    setSaving(true);
    await updateStore(restaurant.id_tienda, storeForm);
    setSaving(false);
  };

  const startEditingProduct = (item) => {
    setEditingProductId(item.id);
    setEditForm({
      name: item.name,
      description: item.description,
      price: String(item.originalPrice),
      stock: String(item.stock),
      discount: String(item.discount || 0),
      available: item.available
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
      imageFile: form.imageFile
    });
    setForm({ name: '', description: '', price: '', stock: '20', discount: '0', imageFile: null });
    setSaving(false);
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
              onChange={(event) => setSelectedStoreId(event.target.value)}
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
        <AdminMetric icon={<Store size={20} />} label="Estado" value="Abierto" />
        <AdminMetric icon={<CalendarClock size={20} />} label="Horario" value="09:00 - 22:00" />
        <AdminMetric icon={<UtensilsCrossed size={20} />} label="Platos" value={restaurant.menu.length} />
      </section>

      {canManageProducts && storeForm && (
        <form onSubmit={submitStore} className="rounded-lg bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-wine-900">Informacion del restaurante</h2>
              <p className="text-sm text-stone-500">Solo administradores de plataforma o de esta tienda pueden modificarla.</p>
            </div>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-wine-600 px-4 py-2 text-sm font-black text-white">
              <Save size={16} /> Guardar
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Field label="Nombre"><input className="field" value={storeForm.nombre} onChange={(event) => setStoreForm({ ...storeForm, nombre: event.target.value })} /></Field>
            <Field label="Sucursal"><input className="field" value={storeForm.sucursal} onChange={(event) => setStoreForm({ ...storeForm, sucursal: event.target.value })} /></Field>
            <Field label="Lugar"><input className="field" value={storeForm.nombre_lugar} onChange={(event) => setStoreForm({ ...storeForm, nombre_lugar: event.target.value })} /></Field>
            <Field label="Referencia"><input className="field" value={storeForm.referencia} onChange={(event) => setStoreForm({ ...storeForm, referencia: event.target.value })} /></Field>
            <Field label="Apertura"><input className="field" type="time" value={storeForm.horario_apertura} onChange={(event) => setStoreForm({ ...storeForm, horario_apertura: event.target.value })} /></Field>
            <Field label="Cierre"><input className="field" type="time" value={storeForm.horario_cierre} onChange={(event) => setStoreForm({ ...storeForm, horario_cierre: event.target.value })} /></Field>
            <Field label="Nuevo logo" wide><input className="field" type="file" accept="image/*" onChange={(event) => setStoreForm({ ...storeForm, logoFile: event.target.files?.[0] || null })} /></Field>
          </div>
        </form>
      )}

      <section aria-labelledby="incoming-orders-title" className="space-y-3">
        <div>
          <h2 id="incoming-orders-title" className="text-2xl font-black text-wine-900">Pedidos entrantes</h2>
          <p className="text-sm text-stone-500">Ejemplo de la entidad Pedido con DetallePedido, Cliente, Producto y Pago.</p>
        </div>
        <ul className="grid gap-3 lg:grid-cols-2">
          {incomingOrders.map((order) => (
            <li key={order.id}>
              <IncomingOrderCard
                order={order}
                acceptLabel="Aceptar pedido"
                totalLabel="Total de platos"
                onAccept={(orderId) => updateOrderStatus(orderId, 'aceptado')}
                onReject={(orderId) => updateOrderStatus(orderId, 'rechazado')}
              />
            </li>
          ))}
          {!incomingOrders.length && (
            <li className="rounded-lg border border-dashed border-wine-200 bg-white p-6 text-sm text-stone-600 lg:col-span-2">
              <p className="font-black text-wine-900">Aun no hay pedidos para esta tienda</p>
              <p className="mt-1">Cuando los clientes creen pedidos reales apareceran aqui.</p>
            </li>
          )}
        </ul>
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
            <Field label="Imagen del plato">
              <input className="field" type="file" accept="image/*" onChange={(event) => setForm({ ...form, imageFile: event.target.files?.[0] || null })} />
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
                  <p className="mt-1 font-bold text-wine-700">
                    {formatCurrency(item.price)}
                    {item.discount > 0 && <span className="ml-2 rounded-full bg-maize-100 px-2 py-1 text-xs text-wine-800">{item.discount}% menos</span>}
                  </p>
                </div>
                {canManageProducts && <div className="flex gap-2">
                  <button type="button" onClick={() => toggleAvailability(restaurant.id, item.id)} aria-pressed={item.available} className={`rounded-full px-4 py-2 text-sm font-black ${item.available ? 'bg-maize-300 text-wine-900' : 'bg-stone-200 text-stone-600'}`}>
                    {item.available ? 'Disponible' : 'Pausado'}
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

