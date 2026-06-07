import React from 'react';
import { useEffect, useState } from 'react';
import { Bike, Clock3, Mail, Pencil, Phone, Save, User, X } from 'lucide-react';
import { api } from '../api.ts';
import { useApp } from '../context/AppContext.tsx';
import { formatCurrency } from '../utils/format.ts';

export default function UserPage() {
  const { currentUser, toggleDeliveryMode, updateAccount } = useApp();
  const [orders, setOrders] = useState([]);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    nombre: currentUser?.nombre || '',
    apellido: currentUser?.apellido || '',
    telefono: currentUser?.telefono || '',
    password: ''
  });
  const user = currentUser;

  useEffect(() => {
    if (!user) return;
    const loadOrders = () => api.get(`/api/v1/pedidos?usuario=${user.id_usuario}`).then(setOrders).catch(() => setOrders([]));
    loadOrders();
    const interval = window.setInterval(loadOrders, 5000);
    return () => window.clearInterval(interval);
  }, [user?.id_usuario]);

  if (!user) return null;
  const systemRole = user.rol_usuario === 'admin_plataforma' ? 'Admin plataforma' : 'Cliente institucional';
  const saveAccount = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    await updateAccount(form);
    setSaving(false);
    setEditing(false);
    setForm((current) => ({ ...current, password: '' }));
    setMessage('Informacion de cuenta actualizada.');
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <aside aria-labelledby="user-profile-title" className="h-fit rounded-lg bg-white p-5 shadow-soft">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-wine-600 text-maize-300">
          <User size={34} />
        </div>
        <h1 id="user-profile-title" className="mt-4 text-2xl font-black text-wine-900">{user.nombre} {user.apellido}</h1>
        <p className="text-sm text-stone-500">{systemRole}</p>
        {user.tiendas?.length > 0 && (
          <ul className="mt-3 space-y-2">
            {user.tiendas.map((store) => (
              <li key={store.id_tienda_usuario} className="inline-flex rounded-full bg-maize-100 px-3 py-1 text-xs font-black uppercase text-wine-800">
                {store.tienda_nombre}: {store.cargo}
              </li>
            ))}
          </ul>
        )}
        {editing ? (
          <form onSubmit={saveAccount} className="mt-5 space-y-3">
            <label className="block text-sm font-bold text-stone-700">Nombre<input className="field mt-1" value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} /></label>
            <label className="block text-sm font-bold text-stone-700">Apellido<input className="field mt-1" value={form.apellido} onChange={(event) => setForm({ ...form, apellido: event.target.value })} /></label>
            <label className="block text-sm font-bold text-stone-700">Telefono<input className="field mt-1" value={form.telefono} onChange={(event) => setForm({ ...form, telefono: event.target.value })} /></label>
            <label className="block text-sm font-bold text-stone-700">Nueva contrasena<input className="field mt-1" type="password" minLength={6} placeholder="Dejar vacio para conservarla" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-wine-600 px-4 py-2 font-black text-white"><Save size={16} /> Guardar</button>
              <button type="button" onClick={() => setEditing(false)} className="inline-flex items-center justify-center gap-2 rounded-full bg-stone-200 px-4 py-2 font-black text-stone-700"><X size={16} /> Cancelar</button>
            </div>
          </form>
        ) : (
          <>
            <address className="mt-5 space-y-3 text-sm not-italic text-stone-600">
              <Info icon={<Mail size={17} />} text={user.correo} />
              <Info icon={<Phone size={17} />} text={user.telefono} />
            </address>
            <button type="button" onClick={() => setEditing(true)} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-stone-100 px-5 py-3 font-black text-wine-800">
              <Pencil size={17} /> Editar mi cuenta
            </button>
          </>
        )}
        {message && <p role="status" className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm font-bold text-green-700">{message}</p>}
        <button type="button" aria-pressed={user.acepta_repartos} onClick={toggleDeliveryMode} className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 font-black ${user.acepta_repartos ? 'bg-maize-300 text-wine-900' : 'bg-wine-600 text-white'}`}>
          <Bike size={18} /> {user.acepta_repartos ? 'Dejar de hacer delivery' : 'Activar modo delivery'}
        </button>
      </aside>

      <section aria-labelledby="order-history-title" className="space-y-4">
        <div>
          <h2 id="order-history-title" className="text-2xl font-black text-wine-900">Historial de pedidos</h2>
          <p className="text-sm text-stone-500">Pedidos realizados por el usuario dentro de la institucion.</p>
        </div>
        <ul className="space-y-4">
          {orders.map((order) => (
            <li key={order.id_pedido}>
              <article className="rounded-lg bg-white p-4 shadow-sm">
                <button
                  type="button"
                  aria-expanded={expandedOrderId === order.id_pedido}
                  onClick={() => setExpandedOrderId((current) => (current === order.id_pedido ? null : order.id_pedido))}
                  className="flex w-full flex-col gap-3 text-left sm:flex-row sm:items-center sm:justify-between"
                >
                  <span>
                    <span className="block text-xs font-black uppercase text-wine-600">Pedido #{order.id_pedido}</span>
                    <span className="block font-black">{order.tienda_nombre}</span>
                    <span className="block text-sm text-stone-500">{order.items?.map((item) => item.nombre).join(', ') || 'Pedido sin productos'}</span>
                  </span>
                  <span className="flex items-center justify-between gap-4 sm:block sm:text-right">
                    <span className="block font-black text-wine-700">{formatCurrency(order.total)}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-600">
                      <Clock3 size={13} /> {order.estado_nombre}
                    </span>
                  </span>
                </button>
                {expandedOrderId === order.id_pedido && (
                  <div className="mt-4 border-t border-stone-100 pt-4">
                    <dl className="grid gap-2 text-sm text-stone-600 sm:grid-cols-[auto_1fr]">
                      <dt className="font-black">Entrega:</dt><dd>{order.nombre_lugar_entrega}{order.referencia_entrega ? ` - ${order.referencia_entrega}` : ''}</dd>
                      <dt className="font-black">Descuento:</dt><dd>{formatCurrency(order.total_descuento || 0)}</dd>
                      <dt className="font-black">Subtotal:</dt><dd>{formatCurrency(order.subtotal || 0)}</dd>
                    </dl>
                    <ul className="mt-4 space-y-2 rounded-lg bg-stone-50 p-3 text-sm">
                      {order.items?.map((item) => (
                        <li key={item.id_detalle_pedido || item.id_producto} className="flex justify-between gap-3">
                          <span>{item.cantidad}x {item.nombre}</span>
                          <span className="font-bold">{formatCurrency(item.subtotal)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            </li>
          ))}
        </ul>
        {!orders.length && (
          <div className="rounded-lg border border-dashed border-wine-200 bg-white p-6 text-sm text-stone-600">
            <p className="font-black text-wine-900">Sin pedidos registrados</p>
            <p className="mt-1">Cuando hagas pedidos reales apareceran en este historial.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function Info({ icon, text }) {
  return (
    <div className="flex gap-2">
      <span className="text-wine-600">{icon}</span>
      <span>{text}</span>
    </div>
  );
}
