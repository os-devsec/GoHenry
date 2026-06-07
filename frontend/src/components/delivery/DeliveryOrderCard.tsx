import React from 'react';
import { Check, MapPin, MessageCircle, Navigation, PackageCheck } from 'lucide-react';

export default function DeliveryOrderCard({ order, onDeliver, onStart }) {
  const isOnWay = order.assignmentStatus === 'en_camino';
  const phone = order.clientPhone?.replace(/\D/g, '');
  const whatsappUrl = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(`Hola ${order.clientName || ''}, soy el repartidor de tu pedido #${order.orderId}.`)}`
    : '#';

  return (
    <article className="rounded-lg bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-wine-600">{order.status}</p>
          <h2 className="mt-1 text-lg font-black">{order.restaurant}</h2>
          <p className="text-sm text-stone-500">{order.customer}</p>
        </div>
        {order.pay && <span className="rounded-full bg-maize-100 px-3 py-1 text-sm font-black text-wine-900">{order.pay}</span>}
      </div>
      <div className="mt-4 space-y-3 text-sm">
        <div className="flex gap-2 text-stone-600">
          <PackageCheck className="mt-0.5 text-wine-600" size={18} />
          <span>{order.pickup}</span>
        </div>
        <div className="flex gap-2 text-stone-600">
          <MapPin className="mt-0.5 text-wine-600" size={18} />
          <span>{order.dropoff}</span>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {phone && (
          <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-green-500 px-4 py-2 text-sm font-black text-white">
            <MessageCircle size={16} /> Escribir al cliente
          </a>
        )}
        {!isOnWay && (
          <button type="button" onClick={() => onStart?.(order.id)} className="inline-flex items-center justify-center gap-2 rounded-full bg-wine-600 px-4 py-2 text-sm font-black text-white">
            <Navigation size={16} /> En camino
          </button>
        )}
        <button type="button" onClick={() => onDeliver?.(order.id)} disabled={!isOnWay} className="inline-flex items-center justify-center gap-2 rounded-full bg-maize-300 px-4 py-2 text-sm font-black text-wine-900 disabled:bg-stone-200 disabled:text-stone-500">
          <Check size={16} /> Entregado
        </button>
      </div>
    </article>
  );
}

