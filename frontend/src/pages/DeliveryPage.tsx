import React from 'react';
import { useEffect, useState } from 'react';
import { Bike, CheckCircle2, PackageCheck } from 'lucide-react';
import { api } from '../api.ts';
import DeliveryOrderCard from '../components/delivery/DeliveryOrderCard.tsx';
import IncomingOrderCard from '../components/orders/IncomingOrderCard.tsx';
import { useApp } from '../context/AppContext.tsx';
import { formatCurrency } from '../utils/format.ts';

export default function DeliveryPage() {
  const { currentUser, isPlatformAdmin } = useApp();
  const [assignments, setAssignments] = useState([]);

  const loadAssignments = async () => {
    if (!currentUser) return;
    const path = isPlatformAdmin
      ? '/api/v1/asignaciones-repartidor'
      : `/api/v1/repartidores/${currentUser.id_usuario}/asignaciones`;
    const data = await api.get(path).catch(() => []);
    setAssignments(data);
  };

  useEffect(() => {
    loadAssignments();
    const interval = window.setInterval(loadAssignments, 5000);
    return () => window.clearInterval(interval);
  }, [currentUser?.id_usuario, isPlatformAdmin]);

  const updateOrderStatus = async (assignmentId, status) => {
    if (status === 'aceptada') {
      await api.patch(`/api/v1/asignaciones-repartidor/${assignmentId}/aceptar`, {});
    }
    if (status === 'rechazado') {
      await api.patch(`/api/v1/asignaciones-repartidor/${assignmentId}/cancelar`, { observacion: 'Rechazado desde frontend' });
    }
    await loadAssignments();
  };

  const markDelivered = async (assignmentId) => {
    await api.patch(`/api/v1/asignaciones-repartidor/${assignmentId}/entregar`, {});
    await loadAssignments();
  };

  const markOnWay = async (assignmentId) => {
    await api.patch(`/api/v1/asignaciones-repartidor/${assignmentId}/en-camino`, {});
    await loadAssignments();
  };

  const newOrders = assignments
    .filter((assignment) => assignment.estado_asignacion === 'pendiente')
    .map(mapIncomingAssignment);
  const deliveryOrders = assignments
    .filter((assignment) => ['aceptada', 'en_camino'].includes(assignment.estado_asignacion))
    .map(mapActiveAssignment);
  const deliveredCount = assignments.filter((assignment) => assignment.estado_asignacion === 'entregada').length;

  return (
    <div className="space-y-6">
      <section aria-labelledby="delivery-title" className="rounded-lg bg-wine-700 p-5 text-white shadow-soft md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold text-maize-300">Modo delivery</p>
            <h1 id="delivery-title" className="mt-1 text-3xl font-black">Entregas activas</h1>
            <p className="mt-2 max-w-2xl text-wine-50">Vista para repartidores con asignaciones reales de entrega.</p>
          </div>
          <div className="grid h-20 w-20 place-items-center rounded-full bg-maize-300 text-wine-900">
            <Bike size={38} />
          </div>
        </div>
      </section>

      <section aria-label="Metricas de entregas" className="grid gap-4 md:grid-cols-3">
        <DeliveryMetric icon={<PackageCheck size={20} />} label="Pendientes" value={newOrders.length} />
        <DeliveryMetric icon={<Bike size={20} />} label="En curso" value={deliveryOrders.length} />
        <DeliveryMetric icon={<CheckCircle2 size={20} />} label="Entregadas" value={deliveredCount} />
      </section>

      <section aria-labelledby="delivery-lists-title" className="space-y-5">
        <h2 id="delivery-lists-title" className="sr-only">Asignaciones de delivery</h2>
        <div className="space-y-3">
          <h3 className="text-xl font-black text-wine-900">Pedido nuevo</h3>
          <ul className="space-y-3">
          {newOrders.map((order) => (
            <li key={order.id}>
              <IncomingOrderCard
                order={order}
                acceptLabel="Aceptar entrega"
                showReject={false}
                totalLabel="Total cobrado"
                onAccept={(orderId) => updateOrderStatus(orderId, 'aceptada')}
              />
            </li>
          ))}
          {!newOrders.length && <EmptyDeliveryState text="No tienes entregas pendientes por aceptar." />}
          </ul>
          <h3 className="pt-3 text-xl font-black text-wine-900">Entregas asignadas</h3>
          <ul className="space-y-3">
            {deliveryOrders.map((order) => (
              <li key={order.id}>
                <DeliveryOrderCard order={order} onStart={markOnWay} onDeliver={markDelivered} />
              </li>
            ))}
            {!deliveryOrders.length && <EmptyDeliveryState text="No tienes entregas activas en este momento." />}
          </ul>
        </div>
      </section>
    </div>
  );
}

function mapIncomingAssignment(assignment) {
  return {
    id: assignment.id_asignacion,
    code: `Pedido #${assignment.id_pedido}`,
    title: 'Asignacion de entrega',
    customer: 'Disponible para repartidores activos',
    location: `Retiro: ${assignment.tienda_nombre} / Entrega: ${assignment.punto_entrega}${assignment.referencia_entrega ? ` - ${assignment.referencia_entrega}` : ''}`,
    time: 'Pendiente',
    status: assignment.estado_asignacion,
    total: assignment.total_con_envio ?? assignment.total,
    items: [
      { qty: 1, name: 'Costo de productos', subtotal: assignment.costo_pedido ?? assignment.total },
      { qty: 1, name: 'Ganancia de envio', subtotal: assignment.ganancia_envio ?? assignment.costo_envio }
    ]
  };
}

function mapActiveAssignment(assignment) {
  return {
    id: assignment.id_asignacion,
    status: assignment.estado_asignacion,
    assignmentStatus: assignment.estado_asignacion,
    restaurant: assignment.tienda_nombre,
    customer: `Pedido #${assignment.id_pedido}`,
    pickup: `Recoger en ${assignment.tienda_nombre}`,
    dropoff: [assignment.punto_entrega, assignment.referencia_entrega].filter(Boolean).join(' - '),
    clientName: assignment.cliente,
    clientPhone: assignment.telefono_cliente,
    orderId: assignment.id_pedido,
    orderCost: formatCurrency(assignment.costo_pedido ?? assignment.total ?? 0),
    deliveryEarning: formatCurrency(assignment.ganancia_envio ?? assignment.costo_envio ?? 0),
    pay: formatCurrency(assignment.total_con_envio ?? assignment.total ?? 0)
  };
}

function DeliveryMetric({ icon, label, value }) {
  return (
    <div className="rounded-lg bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-wine-700">
        {icon}
        <span className="text-sm font-bold">{label}</span>
      </div>
      <p className="mt-2 text-xl font-black">{value}</p>
    </div>
  );
}

function EmptyDeliveryState({ text }) {
  return (
    <li className="rounded-lg border border-dashed border-wine-200 bg-white p-5 text-sm text-stone-600">
      <p>{text}</p>
    </li>
  );
}

