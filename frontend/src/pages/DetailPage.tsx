import React, { useState } from 'react';
import { ArrowLeft, Check, Minus, Plus, ShoppingBag } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext.tsx';
import { formatCurrency } from '../utils/format.ts';

export default function DetailPage() {
  const navigate = useNavigate();
  const { restaurantId, productId } = useParams();
  const { restaurants, addToCart } = useApp();
  const [quantity, setQuantity] = useState(1);
  const [option, setOption] = useState('Normal');
  const restaurant = restaurants.find((entry) => entry.id === restaurantId);
  const product = restaurant?.menu.find((item) => String(item.id) === String(productId));

  if (!restaurant || !product) {
    return (
      <div className="rounded-lg border border-dashed border-wine-200 bg-white p-8 text-center">
        <h1 className="text-2xl font-black text-wine-900">Producto no encontrado</h1>
        <p className="mt-2 text-sm text-stone-500">Crea tiendas y productos en la BDD para ver detalles reales.</p>
        <button type="button" onClick={() => navigate('/')} className="mt-5 rounded-full bg-wine-600 px-5 py-3 font-black text-white">Volver al inicio</button>
      </div>
    );
  }

  const addSelected = () => {
    Array.from({ length: quantity }).forEach(() => addToCart(restaurant, product));
  };

  return (
    <div className="space-y-6">
      <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm font-bold text-wine-700">
        <ArrowLeft size={18} /> Volver
      </button>

      <section aria-labelledby="product-detail-title" className="grid overflow-hidden rounded-lg bg-white shadow-soft lg:grid-cols-[0.9fr_1.1fr]">
        <img src={product.image} alt={product.name} className="h-72 w-full object-cover lg:h-full" />
        <div className="p-6">
          <p className="text-sm font-black text-wine-600">{restaurant.name}</p>
          <h1 id="product-detail-title" className="mt-2 text-3xl font-black text-wine-900">{product.name}</h1>
          <p className="mt-3 text-stone-600">{product.description}</p>
          <div className="mt-5 flex items-center gap-3">
            <p className="text-3xl font-black text-wine-700">{formatCurrency(product.price)}</p>
            {product.discount > 0 && (
              <>
                <span className="text-lg text-stone-400 line-through">{formatCurrency(product.originalPrice)}</span>
                <span className="rounded-full bg-maize-100 px-3 py-1 text-sm font-black text-wine-800">{product.discount}% de descuento</span>
              </>
            )}
          </div>

          <fieldset className="mt-6 space-y-3">
            <legend className="text-sm font-black text-stone-700">Opciones</legend>
            {['Normal', 'Sin salsas', 'Para llevar'].map((item) => (
              <label
                key={item}
                className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left font-bold ${
                  option === item ? 'border-wine-600 bg-wine-50 text-wine-900' : 'border-stone-200 text-stone-600'
                }`}
              >
                <span className="inline-flex items-center gap-3">
                  <input type="radio" name="product-option" value={item} checked={option === item} onChange={() => setOption(item)} className="h-4 w-4 accent-wine-600" />
                  {item}
                </span>
                {option === item && <Check aria-hidden="true" size={18} />}
              </label>
            ))}
          </fieldset>

          <div className="mt-6 flex items-center justify-between rounded-lg bg-stone-50 p-3">
            <span id="quantity-label" className="font-black">Cantidad</span>
            <div className="flex items-center gap-3">
              <button type="button" aria-label="Disminuir cantidad" aria-describedby="quantity-label" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="grid h-9 w-9 place-items-center rounded-full bg-white text-wine-700">
                <Minus size={16} />
              </button>
              <span aria-live="polite" className="w-8 text-center font-black">{quantity}</span>
              <button type="button" aria-label="Aumentar cantidad" aria-describedby="quantity-label" onClick={() => setQuantity(quantity + 1)} className="grid h-9 w-9 place-items-center rounded-full bg-maize-300 text-wine-900">
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={addSelected} className="inline-flex items-center justify-center gap-2 rounded-full bg-wine-600 px-5 py-3 font-black text-white">
              <ShoppingBag size={18} /> Agregar
            </button>
            <Link to="/carrito" className="rounded-full bg-maize-300 px-5 py-3 text-center font-black text-wine-900">
              Ir al carrito
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

