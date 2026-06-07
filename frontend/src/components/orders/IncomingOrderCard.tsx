import React from 'react';
import { Check, Clock3, MapPin, X } from 'lucide-react';
import { formatCurrency } from '../../utils/format.ts';

type IncomingOrderCardProps = {
  order: any;
  onAccept: (id: any) => void | Promise<void>;
  onReject?: (id: any) => void | Promise<void>;
  acceptLabel?: string;
  showReject?: boolean;
  totalLabel?: string;
};

export default function IncomingOrderCard({
  order,
  onAccept,
  onReject = () => {},
  acceptLabel = 'Aceptar',
  showReject = true,
  totalLabel = 'Total'
}: IncomingOrderCardProps) {
  const isPending = order.status === 'pendiente';
  const isAccepted = ['aceptado', 'preparando', 'listo_para_entrega'].includes(order.status);
  const isRejected = ['rechazado', 'cancelado'].includes(order.status);

  return (
    <article className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase text-wine-600">{order.code}</p>
          <h3 className="mt-1 text-lg font-black">{order.title}</h3>
          <p className="text-sm text-stone-500">{order.customer}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="mt-4 grid gap-3 text-sm text-stone-600 md:grid-cols-2">
        <InfoLine icon={<MapPin size={17} />} text={order.location} />
        <InfoLine icon={<Clock3 size={17} />} text={order.time} />
      </div>

      <div className="mt-4 rounded-lg bg-stone-50 p-3">
        <p className="text-xs font-black uppercase text-stone-500">Detalle pedido</p>
        <ul className="mt-2 space-y-1 text-sm">
          {order.items.map((item) => (
            <li key={item.name} className="flex justify-between gap-3">
              <span>{item.qty}x {item.name}</span>
              <span className="font-bold">{formatCurrency(item.subtotal)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-stone-200 pt-3 font-black text-wine-800">
          <span>{totalLabel}</span>
          <span>{formatCurrency(order.total)}</span>
        </div>
      </div>

      {isPending && (
        <div className={`mt-4 grid gap-2 ${showReject ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {showReject && <button type="button" onClick={() => onReject(order.id)} className="inline-flex items-center justify-center gap-2 rounded-full bg-stone-200 px-4 py-2 text-sm font-black text-stone-700">
            <X size={16} /> Rechazar
          </button>}
          <button type="button" onClick={() => onAccept(order.id)} className="inline-flex items-center justify-center gap-2 rounded-full bg-wine-600 px-4 py-2 text-sm font-black text-white">
            <Check size={16} /> {acceptLabel}
          </button>
        </div>
      )}

      {(isAccepted || isRejected) && (
        <p className={`mt-4 rounded-lg px-3 py-2 text-sm font-bold ${isAccepted ? 'bg-maize-100 text-wine-900' : 'bg-stone-100 text-stone-600'}`}>
          {isAccepted ? 'Pedido aceptado para continuar el flujo.' : order.status === 'cancelado' ? 'Pedido cancelado por el cliente.' : 'Pedido rechazado por la tienda.'}
        </p>
      )}
    </article>
  );
}

function InfoLine({ icon, text }) {
  return (
    <div className="flex gap-2">
      <span className="mt-0.5 text-wine-600">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    pendiente: 'bg-maize-100 text-wine-900',
    aceptado: 'bg-emerald-100 text-emerald-800',
    preparando: 'bg-emerald-100 text-emerald-800',
    listo_para_entrega: 'bg-sky-100 text-sky-800',
    rechazado: 'bg-stone-200 text-stone-600',
    cancelado: 'bg-stone-200 text-stone-600'
  };

  return (
    <span className={`w-fit rounded-full px-3 py-1 text-xs font-black uppercase ${styles[status]}`}>
      {status}
    </span>
  );
}

