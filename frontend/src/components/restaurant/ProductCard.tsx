import React from 'react';
import { Clock3, Eye, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../utils/format.ts';

export default function ProductCard({ product, restaurant, onAdd }) {
  return (
    <article className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <img src={product.image} alt="" className="h-28 w-full rounded-lg object-cover" />
      <div className="mt-3">
        <p className="text-xs font-bold text-wine-600">{restaurant.name}</p>
        <h3 className="mt-1 font-black">{product.name}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-stone-500">{product.description}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {product.categories?.map((category) => (
            <span key={category.id_categoria} className="rounded-full bg-stone-100 px-2 py-1 text-xs font-bold text-stone-600">{category.nombre}</span>
          ))}
        </div>
        {product.discountActive && (
          <p className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-wine-700">
            <Clock3 size={14} /> Oferta activa hasta {product.discountEnd}
          </p>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <span>
          {product.discount > 0 && <span className="mr-2 text-xs text-stone-400 line-through">{formatCurrency(product.originalPrice)}</span>}
          <span className="font-black text-wine-700">{formatCurrency(product.price)}</span>
          {product.discount > 0 && <span className="ml-2 rounded-full bg-maize-100 px-2 py-1 text-xs font-black text-wine-800">-{product.discount}%</span>}
        </span>
        <div className="flex gap-2">
          <Link
            to={`/detalle/${restaurant.id}/${product.id}`}
            aria-label={`Ver detalle de ${product.name}`}
            className="grid h-9 w-9 place-items-center rounded-full bg-stone-100 text-wine-800"
            title="Ver detalle"
          >
            <Eye size={16} />
          </Link>
          <button
            type="button"
            onClick={() => onAdd(restaurant, product)}
            aria-label={`Agregar ${product.name} al carrito`}
            className="grid h-9 w-9 place-items-center rounded-full bg-maize-300 text-wine-900"
            title="Agregar"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}

