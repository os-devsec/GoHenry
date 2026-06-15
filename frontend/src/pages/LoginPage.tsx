import React from 'react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { appLogo, foodImage } from '../assets.ts';
import { useApp } from '../context/AppContext.tsx';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useApp();
  const [form, setForm] = useState({ correo: '', password: '' });
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    try {
      setError('');
      await login(form.correo, form.password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (_error) {
      setError('No se pudo iniciar sesion. Revisa tu correo y contrasena.');
    }
  };

  return (
    <div className="mx-auto grid max-w-4xl overflow-hidden rounded-lg bg-white shadow-soft md:grid-cols-2">
      <section aria-labelledby="login-title" className="relative min-h-64 bg-wine-700 p-7 text-white">
        <img src={foodImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
        <div className="relative flex h-full flex-col justify-between">
          <Link to="/" className="flex items-center gap-2 font-black">
            <img src={appLogo} alt="" className="h-11 w-11 rounded-full object-cover" />
            GoHenryGo
          </Link>
          <div>
            <h1 id="login-title" className="text-3xl font-black">Ingresa y sigue tu pedido</h1>
            <p className="mt-2 text-wine-50">Una sola cuenta para clientes, restaurantes y delivery.</p>
          </div>
        </div>
      </section>
      <form onSubmit={submit} className="space-y-4 p-6 md:p-8">
        <h2 className="text-2xl font-black text-wine-900">Login</h2>
        <Field label="Correo">
          <input required autoComplete="email" className="field" type="email" value={form.correo} onChange={(event) => setForm({ ...form, correo: event.target.value })} placeholder="correo@ejemplo.com" />
        </Field>
        <Field label="Contrasena">
          <input required autoComplete="current-password" className="field" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Contrasena" />
        </Field>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{error}</p>}
        <button type="submit" className="w-full rounded-full bg-wine-600 px-5 py-3 font-black text-white">Entrar</button>
        <Link to="/register" className="block w-full rounded-full bg-maize-300 px-5 py-3 text-center font-black text-wine-900">Crear cuenta</Link>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-bold text-stone-700">{label}</span>
      {children}
    </label>
  );
}

