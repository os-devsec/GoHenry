import React, { useEffect, useState } from 'react';
import { Bike, CheckCircle2, MessageCircle, PackageCheck, ShoppingBag, Store, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.tsx';
import { formatCurrency } from '../utils/format.ts';

export default function OrderPage() {
  const { cancelOrder, currentUser, dismissLastOrder, lastOrder, refreshLatestOrder, refreshOrder } = useApp();
  const [error, setError] = useState('');
  const order = lastOrder?.id_usuario === currentUser?.id_usuario ? lastOrder : null;

  useEffect(() => {
    if (!currentUser) return undefined;
    let active = true;
    const load = async () => {
      if (!active) return;
      if (lastOrder?.id_pedido) {
        await refreshOrder(lastOrder.id_pedido).catch(() => null);
      } else {
        await refreshLatestOrder(currentUser.id_usuario).catch(() => null);
      }
    };
    load();
    const interval = window.setInterval(load, 4000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [currentUser?.id_usuario, lastOrder?.id_pedido]);

  if (!order) {
    return (
      <div className="rounded-lg border border-dashed border-wine-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-black text-wine-900">Aun no tienes pedidos activos</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-stone-500">Cuando hagas un pedido real, su estado aparecera aqui.</p>
        <Link to="/" className="mt-5 inline-flex rounded-full bg-wine-600 px-5 py-3 font-black text-white">Ver tiendas</Link>
      </div>
    );
  }

  if (order.estado_nombre === 'rechazado') {
    return (
      <section className="mx-auto max-w-xl rounded-lg border border-red-100 bg-white p-7 text-center shadow-soft">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-red-50 text-red-600">
          <XCircle size={34} />
        </span>
        <p className="mt-4 text-sm font-black uppercase text-red-600">Pedido #{order.id_pedido}</p>
        <h1 className="mt-1 text-2xl font-black text-wine-900">Tu pedido fue rechazado por el restaurante</h1>
        <p className="mt-2 text-sm text-stone-500">No se procesara ningun cobro ni se buscara repartidor para este pedido.</p>
        <Link
          to="/"
          onClick={dismissLastOrder}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-wine-600 px-5 py-3 font-black text-white"
        >
          <ShoppingBag size={18} /> Hacer otro pedido
        </Link>
      </section>
    );
  }

  const repartidor = order.asignacion;
  const phone = repartidor?.telefono?.replace(/\D/g, '');
  const whatsappUrl = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(`Hola, soy del pedido #${order.id_pedido}.`)}` : '#';
  const assignmentStatus = repartidor?.estado_asignacion;
  const restaurantAccepted = !['pendiente', 'cancelado'].includes(order.estado_nombre);
  const deliveryAssigned = ['aceptado', 'en_camino', 'entregado'].includes(assignmentStatus);
  const deliveryOnWay = order.estado_nombre === 'en_camino' || ['en_camino', 'entregado'].includes(assignmentStatus);
  const delivered = order.estado_nombre === 'entregado' || assignmentStatus === 'entregado';
  const canCancel = order.estado_nombre === 'pendiente';
  const handleCancel = async () => {
    try {
      setError('');
      await cancelOrder(order.id_pedido);
    } catch (apiError) {
      setError(apiError.message);
      await refreshOrder(order.id_pedido).catch(() => null);
    }
  };
  const steps = [
    { label: 'Pedido recibido', detail: `${order.tienda_nombre} recibio tu pedido.`, icon: CheckCircle2, done: true },
    {
      label: 'En preparacion',
      detail: restaurantAccepted ? 'La tienda esta preparando tu pedido.' : 'Esperando aceptacion de la tienda.',
      icon: Store,
      done: restaurantAccepted
    },
    {
      label: 'Repartidor asignado',
      detail: deliveryAssigned ? `${repartidor.nombre} acepto la entrega.` : 'Buscando repartidor disponible.',
      icon: Bike,
      done: deliveryAssigned
    },
    {
      label: 'En camino',
      detail: deliveryOnWay ? `Destino: ${order.direccion_entrega || 'Campus UIDE'}.` : 'El repartidor aun no ha salido.',
      icon: PackageCheck,
      done: deliveryOnWay
    },
    {
      label: 'Entregado',
      detail: delivered ? 'Pedido entregado correctamente.' : 'Pendiente de entrega.',
      icon: CheckCircle2,
      done: delivered
    }
  ];

  return (
    <div className="space-y-6">
      <section aria-labelledby="order-title" className="rounded-lg bg-wine-700 p-6 text-white shadow-soft">
        <p className="text-sm font-bold text-maize-300">Seguimiento</p>
        <h1 id="order-title" className="mt-1 text-3xl font-black">Pedido #{order.id_pedido}</h1>
        <p className="mt-2 text-wine-50">Estado actual de entrega dentro del campus.</p>
        {canCancel && (
          <button type="button" onClick={handleCancel} className="mt-5 rounded-full bg-white px-5 py-2.5 text-sm font-black text-wine-700">
            Cancelar pedido
          </button>
        )}
      </section>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}

      <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <section aria-labelledby="delivery-status-title" className="rounded-lg bg-white p-5 shadow-sm">
          <h2 id="delivery-status-title" className="text-xl font-black text-wine-900">Estado de entrega</h2>
          <ol className="mt-5 space-y-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.label} className="flex gap-4" aria-current={step.done && !steps[index + 1]?.done ? 'step' : undefined}>
                  <div className="flex flex-col items-center">
                    <span className={`grid h-10 w-10 place-items-center rounded-full ${step.done ? 'bg-maize-300 text-wine-900' : 'bg-stone-100 text-stone-500'}`}>
                      <Icon size={19} />
                    </span>
                    {index < steps.length - 1 && <span className="h-10 border-l-2 border-dashed border-stone-200" />}
                  </div>
                  <div>
                    <h3 className="font-black">{step.label}</h3>
                    <p className="text-sm text-stone-500">{step.detail}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <aside aria-labelledby="order-summary-title" className="h-fit rounded-lg bg-white p-5 shadow-sm">
          <h2 id="order-summary-title" className="text-xl font-black text-wine-900">Resumen</h2>
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-2 gap-y-3 text-sm text-stone-600">
            <dt className="font-black">Restaurante:</dt><dd>{order.tienda_nombre}</dd>
            <dt className="font-black">Producto:</dt><dd>{order.items?.map((item) => item.nombre).join(', ')}</dd>
            <dt className="font-black">Entrega:</dt><dd>{order.direccion_entrega}</dd>
            <dt className="font-black">Envio:</dt><dd>{formatCurrency(order.costo_envio || 0)}</dd>
            <dt className="font-black">Total:</dt><dd>{formatCurrency(order.total || 0)}</dd>
          </dl>
          {phone && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-green-500 px-5 py-3 font-black text-white"
            >
              <MessageCircle size={18} /> Chatear con repartidor
            </a>
          )}
        </aside>
      </section>
    </div>
  );
}

