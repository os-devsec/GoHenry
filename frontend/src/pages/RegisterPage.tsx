import React from 'react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { appLogo } from '../assets.ts';
import { foodImage } from '../assets.ts';
import { useApp } from '../context/AppContext.tsx';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useApp();
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    correo: '',
    telefono: '',
    password: ''
  });
  const [error, setError] = useState('');

  const cleanPersonName = (value) => value.replace(/[0-9]/g, '');

  const submit = async (event) => {
    event.preventDefault();
    if (/\d/.test(form.nombre) || /\d/.test(form.apellido)) {
      setError('El nombre y apellido no pueden contener numeros.');
      return;
    }
    if (!/^\d{10}$/.test(form.telefono)) {
      setError('El telefono debe tener exactamente 10 digitos.');
      return;
    }
    if (form.password.length < 8) {
      setError('La contrasena debe tener al menos 8 caracteres.');
      return;
    }
    try {
      setError('');
      await register({
        ...form,
        acepta_repartos: false
      });
      navigate('/');
    } catch (_error) {
      setError('No se pudo crear la cuenta. Revisa los datos e intenta nuevamente.');
    }
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.85fr_1.15fr]">
      <section aria-labelledby="register-title" className="relative overflow-hidden rounded-lg bg-wine-700 p-7 text-white shadow-soft">
        <img src={foodImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        <div className="relative flex min-h-80 flex-col justify-between">
          <Link to="/" className="flex items-center gap-2 font-black">
            <img src={appLogo} alt="" className="h-11 w-11 rounded-full object-cover" />
            GoHenryGo
          </Link>
          <div>
            <p className="font-bold text-maize-300">Crear usuario</p>
            <h1 id="register-title" className="mt-2 text-3xl font-black md:text-4xl">Crea tu cuenta para pedir dentro del campus</h1>
          </div>
        </div>
      </section>

      <form onSubmit={submit} className="space-y-5 rounded-lg bg-white p-5 shadow-sm md:p-7">
        <FormSection title="Datos de cuenta">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nombre">
              <input required autoComplete="given-name" className="field" pattern="[^0-9]*" value={form.nombre} onChange={(event) => setForm({ ...form, nombre: cleanPersonName(event.target.value) })} placeholder="Nombre" />
            </Field>
            <Field label="Apellido">
              <input required autoComplete="family-name" className="field" pattern="[^0-9]*" value={form.apellido} onChange={(event) => setForm({ ...form, apellido: cleanPersonName(event.target.value) })} placeholder="Apellido" />
            </Field>
            <Field label="Correo" wide>
              <input required autoComplete="email" className="field" type="email" value={form.correo} onChange={(event) => setForm({ ...form, correo: event.target.value })} placeholder="correo@ejemplo.com" />
            </Field>
            <Field label="Telefono">
              <input required autoComplete="tel" className="field" type="tel" inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} value={form.telefono} onChange={(event) => setForm({ ...form, telefono: event.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="10 digitos" />
            </Field>
            <Field label="Contraseña">
              <input required autoComplete="new-password" className="field" type="password" minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Minimo 8 caracteres" />
            </Field>
          </div>
        </FormSection>

        <label className="flex items-start gap-3 rounded-lg border border-stone-200 p-3 text-sm text-stone-600">
          <input required type="checkbox" className="mt-1 h-4 w-4 accent-wine-600" />
          Acepto terminos y politicas de la plataforma.
        </label>

        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{error}</p>}
        <button type="submit" className="w-full rounded-full bg-wine-600 px-5 py-3 font-black text-white">Crear usuario</button>
      </form>
    </div>
  );
}

function FormSection({ title, children }) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-xl font-black text-wine-900">{title}</h2>
      </div>
      {children}
    </section>
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
