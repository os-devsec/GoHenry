import React, { useState } from 'react';
import { Plus, ShieldCheck, Store, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.tsx';

export default function PlatformAdminPage() {
  const { createPlatformAdmin, createStore, deleteStore, restaurants } = useApp();
  const [storeForm, setStoreForm] = useState({
    nombre: '',
    sucursal: 'Campus UIDE',
    nombre_lugar: 'Campus UIDE',
    referencia: '',
    horario_apertura: '08:00',
    horario_cierre: '18:00',
    logoFile: null
  });
  const [adminForm, setAdminForm] = useState({ nombre: '', apellido: '', correo: '', telefono: '', password: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [deletingStoreId, setDeletingStoreId] = useState<number | null>(null);

  const submitStore = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      setError('');
      await createStore(storeForm);
      setStoreForm({ nombre: '', sucursal: 'Campus UIDE', nombre_lugar: 'Campus UIDE', referencia: '', horario_apertura: '08:00', horario_cierre: '18:00', logoFile: null });
      form.reset();
      setMessage('Tienda creada correctamente.');
    } catch (_error) {
      setError('No se pudo crear la tienda. Revisa los datos e intenta nuevamente.');
    }
  };

  const submitAdmin = async (event) => {
    event.preventDefault();
    try {
      setError('');
      await createPlatformAdmin(adminForm);
      setAdminForm({ nombre: '', apellido: '', correo: '', telefono: '', password: '' });
      setMessage('Admin de plataforma guardado correctamente.');
    } catch (_error) {
      setError('No se pudo guardar el administrador. Revisa los datos e intenta nuevamente.');
    }
  };

  const removeStore = async (restaurant) => {
    const confirmed = window.confirm(
      `¿Eliminar "${restaurant.name}" permanentemente?\n\nTambién se eliminarán sus productos, personal, carritos, pedidos, pagos, comisiones y asignaciones. Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    try {
      setError('');
      setMessage('');
      setDeletingStoreId(restaurant.id_tienda);
      await deleteStore(restaurant.id_tienda);
      setMessage(`Tienda "${restaurant.name}" eliminada correctamente.`);
    } catch (_error) {
      setError('No se pudo eliminar la tienda. Intenta nuevamente.');
    } finally {
      setDeletingStoreId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section aria-labelledby="platform-title" className="rounded-lg bg-wine-700 p-5 text-white shadow-soft md:p-7">
        <p className="text-sm font-bold text-maize-300">Admin plataforma</p>
        <h1 id="platform-title" className="mt-1 text-3xl font-black">Control global</h1>
        <p className="mt-2 max-w-2xl text-wine-50">Crea tiendas y admins con acceso total para soporte operativo.</p>
      </section>

      {(message || error) && (
        <p role={error ? 'alert' : 'status'} className={`rounded-lg px-4 py-3 text-sm font-bold ${error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {error || message}
        </p>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={submitStore} aria-labelledby="new-store-title" className="rounded-lg bg-white p-5 shadow-sm">
          <h2 id="new-store-title" className="flex items-center gap-2 text-xl font-black text-wine-900"><Store size={20} /> Nueva tienda</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label="Nombre de tienda" wide>
              <input required className="field" placeholder="Nombre de tienda" value={storeForm.nombre} onChange={(event) => setStoreForm({ ...storeForm, nombre: event.target.value })} />
            </Field>
            <Field label="Sucursal">
              <input className="field" placeholder="Sucursal" value={storeForm.sucursal} onChange={(event) => setStoreForm({ ...storeForm, sucursal: event.target.value })} />
            </Field>
            <Field label="Lugar">
              <input className="field" placeholder="Lugar" value={storeForm.nombre_lugar} onChange={(event) => setStoreForm({ ...storeForm, nombre_lugar: event.target.value })} />
            </Field>
            <Field label="Referencia" wide>
              <input className="field" placeholder="Referencia" value={storeForm.referencia} onChange={(event) => setStoreForm({ ...storeForm, referencia: event.target.value })} />
            </Field>
            <Field label="Horario de apertura">
              <input className="field" type="time" value={storeForm.horario_apertura} onChange={(event) => setStoreForm({ ...storeForm, horario_apertura: event.target.value })} />
            </Field>
            <Field label="Horario de cierre">
              <input className="field" type="time" value={storeForm.horario_cierre} onChange={(event) => setStoreForm({ ...storeForm, horario_cierre: event.target.value })} />
            </Field>
            <Field label="Logo de tienda" wide>
              <input className="field" type="file" accept="image/*" onChange={(event) => setStoreForm({ ...storeForm, logoFile: event.target.files?.[0] || null })} />
            </Field>
            <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-full bg-wine-600 px-5 py-3 font-black text-white md:col-span-2">
              <Plus size={18} /> Crear tienda
            </button>
          </div>
        </form>

        <form onSubmit={submitAdmin} aria-labelledby="new-admin-title" className="rounded-lg bg-white p-5 shadow-sm">
          <h2 id="new-admin-title" className="flex items-center gap-2 text-xl font-black text-wine-900"><ShieldCheck size={20} /> Admin global</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label="Nombre">
              <input autoComplete="given-name" className="field" placeholder="Nombre" value={adminForm.nombre} onChange={(event) => setAdminForm({ ...adminForm, nombre: event.target.value })} />
            </Field>
            <Field label="Apellido">
              <input autoComplete="family-name" className="field" placeholder="Apellido" value={adminForm.apellido} onChange={(event) => setAdminForm({ ...adminForm, apellido: event.target.value })} />
            </Field>
            <Field label="Correo" wide>
              <input required autoComplete="email" className="field" type="email" placeholder="Correo" value={adminForm.correo} onChange={(event) => setAdminForm({ ...adminForm, correo: event.target.value })} />
            </Field>
            <Field label="Telefono">
              <input autoComplete="tel" className="field" type="tel" placeholder="Telefono" value={adminForm.telefono} onChange={(event) => setAdminForm({ ...adminForm, telefono: event.target.value })} />
            </Field>
            <Field label="Contrasena si es nuevo">
              <input autoComplete="new-password" className="field" type="password" placeholder="Contrasena si es nuevo" value={adminForm.password} onChange={(event) => setAdminForm({ ...adminForm, password: event.target.value })} />
            </Field>
            <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-full bg-wine-600 px-5 py-3 font-black text-white md:col-span-2">
              <ShieldCheck size={18} /> Guardar admin
            </button>
          </div>
        </form>
      </section>

      <section aria-labelledby="registered-stores-title" className="space-y-3">
        <h2 id="registered-stores-title" className="text-xl font-black text-wine-900">Tiendas registradas</h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {restaurants.map((restaurant) => (
            <li key={restaurant.id_tienda}>
              <article className="flex items-center gap-3 rounded-lg bg-white p-4 shadow-sm">
                <img src={restaurant.logo} alt="" className="h-12 w-12 flex-none rounded-lg border border-stone-100 object-cover" />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-black text-stone-900">{restaurant.name}</h3>
                  <p className="text-sm text-stone-500">{restaurant.category}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link to="/restaurant-admin" className="inline-flex rounded-full bg-maize-300 px-4 py-2 text-sm font-black text-wine-900">Administrar</Link>
                    <button
                      type="button"
                      onClick={() => removeStore(restaurant)}
                      disabled={deletingStoreId === restaurant.id_tienda}
                      className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-black text-white disabled:cursor-wait disabled:opacity-60"
                    >
                      <Trash2 size={16} />
                      {deletingStoreId === restaurant.id_tienda ? 'Eliminando...' : 'Eliminar'}
                    </button>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </section>
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
