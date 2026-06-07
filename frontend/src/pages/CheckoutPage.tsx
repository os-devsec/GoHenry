import React from 'react';
import { useState } from 'react';
import { Check, CreditCard, Minus, Plus, ShoppingBag } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import IconButton from '../components/common/IconButton.tsx';
import SummaryRow from '../components/common/SummaryRow.tsx';
import { useApp } from '../context/AppContext.tsx';
import { calculateDeliveryFee } from '../utils/delivery.ts';
import { formatCurrency } from '../utils/format.ts';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { cart, total, updateQuantity, checkout } = useApp();
  const [address, setAddress] = useState('Edificio Marcelo Fernandez (Aulas), Aula 101 A');
  const [submitting, setSubmitting] = useState(false);
  const delivery = cart.length ? calculateDeliveryFee(cart[0].restaurantLocation, address) : 0;
  const finalTotal = total + delivery;

  const confirmOrder = async () => {
    if (!cart.length) return;
    setSubmitting(true);
    await checkout(address);
    setSubmitting(false);
    navigate('/pedido');
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section aria-labelledby="checkout-title" className="space-y-4">
        <h1 id="checkout-title" className="text-3xl font-black text-wine-900">Pedido y pago</h1>
        {cart.length === 0 ? (
          <div className="rounded-lg border border-dashed border-wine-200 bg-white p-8 text-center">
            <ShoppingBag className="mx-auto text-wine-500" size={40} />
            <p className="mt-3 font-bold">Tu carrito esta vacio</p>
            <Link to="/" className="mt-4 inline-flex rounded-full bg-maize-300 px-5 py-2 font-black text-wine-900">Explorar restaurantes</Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {cart.map((item) => (
              <li key={item.id}>
                <article className="flex items-center gap-4 rounded-lg bg-white p-4 shadow-sm">
                  <img src={item.image} alt="" className="h-20 w-20 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <h2 className="font-black">{item.name}</h2>
                    <p className="text-sm text-stone-500">{item.restaurantName}</p>
                    <p className="mt-1 font-bold text-wine-700">
                      {formatCurrency(item.price)}
                      {item.discount > 0 && <span className="ml-2 rounded-full bg-maize-100 px-2 py-1 text-xs text-wine-800">-{item.discount}%</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <IconButton label={`Quitar una unidad de ${item.name}`} onClick={() => updateQuantity(item.id, -1)} icon={<Minus size={16} />} />
                    <span aria-label={`${item.quantity} unidades`} className="w-7 text-center font-black">{item.quantity}</span>
                    <IconButton label={`Agregar una unidad de ${item.name}`} onClick={() => updateQuantity(item.id, 1)} icon={<Plus size={16} />} />
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside aria-labelledby="checkout-summary-title" className="h-fit rounded-lg bg-white p-5 shadow-soft">
        <h2 id="checkout-summary-title" className="text-xl font-black">Resumen</h2>
        <dl className="mt-4 grid grid-cols-2 gap-y-3 text-sm">
          <SummaryRow label="Subtotal" value={formatCurrency(total)} />
          <SummaryRow label="Envio" value={formatCurrency(delivery)} />
          <SummaryRow label="Total" value={formatCurrency(finalTotal)} strong />
        </dl>
        <div className="mt-5 space-y-3">
          <label className="block space-y-2">
            <span className="text-sm font-bold text-stone-700">Direccion</span>
            <input className="field" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Edificio Marcelo Fernandez (Aulas), Aula 101 A" />
          </label>
          <button type="button" aria-pressed="true" className="flex w-full items-center justify-between rounded-lg border border-stone-200 px-4 py-3 text-left font-bold">
            <span className="inline-flex items-center gap-2"><CreditCard size={18} /> Tarjeta terminada en 4242</span>
            <Check size={18} className="text-wine-600" />
          </button>
          <button type="button" onClick={confirmOrder} disabled={!cart.length || submitting} className="w-full rounded-full bg-wine-600 px-5 py-3 font-black text-white transition hover:bg-wine-700 disabled:bg-stone-300">
            {submitting ? 'Confirmando...' : 'Confirmar pedido'}
          </button>
          <Link to="/pedido" className="block w-full rounded-full bg-maize-300 px-5 py-3 text-center font-black text-wine-900">
            Ver seguimiento
          </Link>
        </div>
      </aside>
    </div>
  );
}

