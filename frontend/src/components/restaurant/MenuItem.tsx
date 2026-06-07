import React from 'react';
import { Eye, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../utils/format.ts';

export default function MenuItem({ item, onAdd, detailTo }) {
  return (
    <article className={`flex gap-4 rounded-lg border bg-white p-4 shadow-sm ${item.available ? 'border-stone-200' : 'border-stone-200 opacity-60'}`}>
      <img src={item.image} alt="" className="h-24 w-24 flex-none rounded-lg object-cover" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-black">{item.name}</h3>
            <p className="mt-1 line-clamp-2 text-sm text-stone-500">{item.description}</p>
          </div>
          <div className="text-right">
            {item.discount > 0 && <span className="block text-xs text-stone-400 line-through">{formatCurrency(item.originalPrice)}</span>}
            <span className="font-black text-wine-700">{formatCurrency(item.price)}</span>
            {item.discount > 0 && <span className="ml-2 rounded-full bg-maize-100 px-2 py-1 text-xs font-black text-wine-800">-{item.discount}%</span>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {detailTo && (
            <Link to={detailTo} aria-label={`Ver detalle de ${item.name}`} className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-4 py-2 text-sm font-bold text-wine-800">
              <Eye size={16} /> Detalle
            </Link>
          )}
          <button
            type="button"
            onClick={onAdd}
            disabled={!item.available}
            aria-label={item.available ? `Agregar ${item.name} al carrito` : `${item.name} no disponible`}
            className="inline-flex items-center gap-2 rounded-full bg-wine-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-wine-700 disabled:cursor-not-allowed disabled:bg-stone-300"
          >
            <Plus size={16} /> {item.available ? 'Agregar' : 'No disponible'}
          </button>
        </div>
      </div>
    </article>
  );
}

