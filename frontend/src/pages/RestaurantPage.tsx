import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import MenuItem from '../components/restaurant/MenuItem.tsx';
import { useApp } from '../context/AppContext.tsx';

export default function RestaurantPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { restaurants, addToCart } = useApp();
  const restaurant = restaurants.find((entry) => entry.id === id);

  if (!restaurant) {
    return (
      <div className="rounded-lg border border-dashed border-wine-200 bg-white p-8 text-center">
        <h1 className="text-2xl font-black text-wine-900">Tienda no encontrada</h1>
        <p className="mt-2 text-sm text-stone-500">Cuando crees tiendas en la BDD apareceran disponibles para navegar.</p>
        <button type="button" onClick={() => navigate('/')} className="mt-5 rounded-full bg-wine-600 px-5 py-3 font-black text-white">Volver al inicio</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm font-bold text-wine-700">
        <ArrowLeft size={18} /> Volver
      </button>
      <section aria-labelledby="restaurant-title" className="overflow-hidden rounded-lg bg-white shadow-soft">
        <div className="h-48 md:h-64">
          <img src={restaurant.image} alt={restaurant.name} className="h-full w-full object-cover" />
        </div>
        <div className="flex flex-col gap-4 p-5 md:flex-row md:items-end md:justify-between">
          <div className="flex gap-4">
            <img src={restaurant.logo} alt="" className="-mt-14 h-24 w-24 rounded-lg border-4 border-white object-cover shadow-md" />
            <div>
              <h1 id="restaurant-title" className="text-3xl font-black text-wine-900">{restaurant.name}</h1>
              <p className="text-stone-500">{restaurant.category}</p>
              <ul className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-stone-600">
                {restaurant.tags.map((tag) => <li key={tag} className="rounded-full bg-maize-100 px-3 py-1 text-wine-800">{tag}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="restaurant-menu-title" className="space-y-3">
        <h2 id="restaurant-menu-title" className="text-2xl font-black text-stone-950">Menu</h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {restaurant.menu.map((item) => (
            <li key={item.id}>
              <MenuItem
                item={item}
                detailTo={`/detalle/${restaurant.id}/${item.id}`}
                onAdd={() => addToCart(restaurant, item)}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

