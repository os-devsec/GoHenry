import React from 'react';
import { useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
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

  const submit = async (event) => {
    event.preventDefault();
    try {
      setError('');
      await register({
        ...form,
        acepta_repartos: false
      });
      navigate('/');
    } catch (apiError) {
      setError(apiError.message);
    }
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.85fr_1.15fr]">
      <section aria-labelledby="register-title" className="relative overflow-hidden rounded-lg bg-wine-700 p-7 text-white shadow-soft">
        <img src={foodImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        <div className="relative flex min-h-80 flex-col justify-between">
          <Link to="/" className="flex items-center gap-2 font-black"><UtensilsCrossed /> UIDElivery</Link>
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
              <input required autoComplete="given-name" className="field" value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} placeholder="Nombre" />
            </Field>
            <Field label="Apellido">
              <input required autoComplete="family-name" className="field" value={form.apellido} onChange={(event) => setForm({ ...form, apellido: event.target.value })} placeholder="Apellido" />
            </Field>
            <Field label="Correo institucional" wide>
              <input required autoComplete="email" className="field" type="email" value={form.correo} onChange={(event) => setForm({ ...form, correo: event.target.value })} placeholder="correo@ejemplo.com" />
            </Field>
            <Field label="Telefono">
              <input required autoComplete="tel" className="field" type="tel" value={form.telefono} onChange={(event) => setForm({ ...form, telefono: event.target.value })} placeholder="Telefono" />
            </Field>
            <Field label="Contrasena">
              <input required autoComplete="new-password" className="field" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Contrasena" />
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
