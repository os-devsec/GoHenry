import React, { useEffect, useState } from 'react';
import { Banknote, Bike, Check, Landmark, Minus, PackageCheck, Plus, ShoppingBag, Smartphone } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import IconButton from '../components/common/IconButton.tsx';
import SummaryRow from '../components/common/SummaryRow.tsx';
import { api } from '../api.ts';
import { useApp } from '../context/AppContext.tsx';
import { formatCurrency } from '../utils/format.ts';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { cart, subtotal, totalDiscount, total, updateQuantity, checkout } = useApp();
  const [orderType, setOrderType] = useState('delivery');
  const [locations, setLocations] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [locationMode, setLocationMode] = useState('existing');
  const [locationId, setLocationId] = useState('');
  const [placeName, setPlaceName] = useState('');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [quotingDelivery, setQuotingDelivery] = useState(false);
  const [deliveryQuoteError, setDeliveryQuoteError] = useState('');
  const storeId = cart[0]?.restaurantId || cart[0]?.id_tienda || 0;
  const selectedLocation = locations.find((location) => String(location.id_ubicacion) === locationId);
  const destinationName = locationMode === 'existing'
    ? selectedLocation?.nombre_lugar || ''
    : placeName;
  const totalWithDelivery = total + deliveryFee;
  const selectedPayment = paymentMethods.find((method) => String(method.id_metodo_pago) === paymentMethodId);

  useEffect(() => {
    api.get('/api/v1/ubicaciones?tipo=entrega')
      .then((data) => {
        setLocations(data);
        if (data.length) setLocationId(String(data[0].id_ubicacion));
        else setLocationMode('new');
      })
      .catch(() => setLocationMode('new'));
    api.get('/api/v1/metodos-pago')
      .then((data) => {
        const allowed = data.filter((method) =>
          ['deuna', 'transferencia', 'efectivo'].includes(method.nombre.toLowerCase())
        );
        setPaymentMethods(allowed);
        if (allowed.length) setPaymentMethodId(String(allowed[0].id_metodo_pago));
      })
      .catch(() => setPaymentMethods([]));
  }, []);

  useEffect(() => {
    if (orderType !== 'delivery' || !cart.length) {
      setDeliveryFee(0);
      setDeliveryQuoteError('');
      return undefined;
    }
    if (!storeId || (locationMode === 'existing' && !locationId) || (locationMode === 'new' && !placeName.trim())) {
      setDeliveryFee(0);
      setDeliveryQuoteError('');
      return undefined;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      setQuotingDelivery(true);
      setDeliveryQuoteError('');
      const destinationPayload = locationMode === 'existing'
        ? { id_ubicacion_entrega: Number(locationId) }
        : { nombre_lugar: placeName.trim(), referencia: reference.trim() || null };
      api.post('/api/v1/pedidos/cotizar-envio', {
        id_tienda: Number(storeId),
        ...destinationPayload
      })
        .then((quote) => {
          if (active) setDeliveryFee(Number(quote.costo_envio || 0));
        })
        .catch((quoteError) => {
          if (active) {
            setDeliveryFee(0);
            setDeliveryQuoteError(quoteError.message);
          }
        })
        .finally(() => {
          if (active) setQuotingDelivery(false);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [orderType, locationMode, locationId, storeId, placeName, reference, cart.length]);

  const confirmOrder = async () => {
    if (!cart.length) return;
    if (!paymentMethodId) return;
    if (orderType === 'delivery' && locationMode === 'existing' && !locationId) return;
    if (orderType === 'delivery' && locationMode === 'new' && !placeName.trim()) return;
    try {
      setError('');
      setSubmitting(true);
      const locationPayload = orderType === 'pickup'
        ? {}
        : locationMode === 'existing'
          ? { id_ubicacion_entrega: Number(locationId) }
          : { nombre_lugar: placeName.trim(), referencia: reference.trim() || null };
      await checkout({
        tipo_pedido: orderType,
        id_metodo_pago: Number(paymentMethodId),
        estado_pago: selectedPayment?.nombre.toLowerCase() === 'efectivo' ? 'pendiente' : 'pagado',
        ...locationPayload
      });
      navigate('/pedido');
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setSubmitting(false);
    }
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
          <SummaryRow label="Subtotal" value={formatCurrency(subtotal)} />
          <SummaryRow label="Descuentos" value={`-${formatCurrency(totalDiscount)}`} />
          <SummaryRow label="Envio" value={quotingDelivery ? 'Calculando...' : formatCurrency(deliveryFee)} />
          <SummaryRow label="Total" value={formatCurrency(totalWithDelivery)} strong />
        </dl>
        <div className="mt-5 space-y-3">
          <fieldset className="space-y-2">
            <legend className="text-sm font-black text-stone-700">Como recibiras tu pedido</legend>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setOrderType('delivery')} className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-black ${orderType === 'delivery' ? 'bg-wine-600 text-white' : 'bg-stone-100 text-stone-600'}`}>
                <Bike size={18} /> Entrega
              </button>
              <button type="button" onClick={() => setOrderType('pickup')} className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-black ${orderType === 'pickup' ? 'bg-wine-600 text-white' : 'bg-stone-100 text-stone-600'}`}>
                <PackageCheck size={18} /> Recoger en tienda
              </button>
            </div>
          </fieldset>
          {orderType === 'pickup' && (
            <p className="rounded-lg bg-maize-100 px-4 py-3 text-sm font-bold text-wine-900">
              Retiras el pedido en {cart[0]?.restaurantName || 'la tienda seleccionada'}. No se cobrara envio ni se solicitara repartidor.
            </p>
          )}
          {orderType === 'delivery' && (
          <>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setLocationMode('existing')} className={`rounded-full px-4 py-2 text-sm font-black ${locationMode === 'existing' ? 'bg-wine-600 text-white' : 'bg-stone-100 text-stone-600'}`}>Lugar existente</button>
            <button type="button" onClick={() => setLocationMode('new')} className={`rounded-full px-4 py-2 text-sm font-black ${locationMode === 'new' ? 'bg-wine-600 text-white' : 'bg-stone-100 text-stone-600'}`}>Nuevo lugar</button>
          </div>
          {locationMode === 'existing' ? (
            <label className="block space-y-2">
              <span className="text-sm font-bold text-stone-700">Ubicacion de entrega</span>
              <select
                className="field"
                value={locationId}
                onChange={(event) => setLocationId(String(event.currentTarget.value))}
              >
                {locations.map((location) => (
                  <option key={location.id_ubicacion} value={location.id_ubicacion}>
                    {location.nombre_lugar}{location.referencia ? ` - ${location.referencia}` : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label className="block space-y-2">
                <span className="text-sm font-bold text-stone-700">Nombre del lugar</span>
                <input className="field" value={placeName} onChange={(event) => setPlaceName(event.target.value)} placeholder="Edificio Principal" />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-bold text-stone-700">Referencia</span>
                <input className="field" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Aula, piso o punto de encuentro" />
              </label>
            </>
          )}
          {destinationName && (
            <p aria-live="polite" className="rounded-lg bg-stone-50 px-4 py-3 text-sm text-stone-600">
              <span className="font-black text-stone-800">Ruta calculada:</span>{' '}
              {cart[0]?.restaurantLocation || 'Tienda'} a {destinationName}. Envio:{' '}
              <span className="font-black text-wine-700">{quotingDelivery ? 'Calculando...' : formatCurrency(deliveryFee)}</span>
            </p>
          )}
          {deliveryQuoteError && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
              No se pudo cotizar el envio: {deliveryQuoteError}
            </p>
          )}
          </>
          )}
          <fieldset className="space-y-2">
            <legend className="text-sm font-black text-stone-700">Metodo de pago</legend>
            {paymentMethods.map((method) => {
              const selected = String(method.id_metodo_pago) === paymentMethodId;
              const Icon = method.nombre === 'DeUna' ? Smartphone : method.nombre === 'Transferencia' ? Landmark : Banknote;
              return (
                <label key={method.id_metodo_pago} className={`flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 font-bold ${selected ? 'border-wine-600 bg-wine-50 text-wine-900' : 'border-stone-200 text-stone-600'}`}>
                  <span className="inline-flex items-center gap-2">
                    <input type="radio" name="payment-method" value={method.id_metodo_pago} checked={selected} onChange={(event) => setPaymentMethodId(event.target.value)} className="accent-wine-600" />
                    <Icon size={18} /> {method.nombre}
                  </span>
                  {selected && <Check size={18} className="text-wine-600" />}
                </label>
              );
            })}
            {!paymentMethods.length && <p className="text-sm text-red-600">No hay metodos de pago disponibles.</p>}
          </fieldset>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{error}</p>}
          <button type="button" onClick={confirmOrder} disabled={!cart.length || !paymentMethodId || submitting} className="w-full rounded-full bg-wine-600 px-5 py-3 font-black text-white transition hover:bg-wine-700 disabled:bg-stone-300">
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

