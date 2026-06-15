import React, { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import MenuItem from '../components/restaurant/MenuItem.tsx';
import { useApp } from '../context/AppContext.tsx';

export default function RestaurantPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { restaurants, addToCart, loading } = useApp();
  const [categoryId, setCategoryId] = useState('');
  const restaurant = restaurants.find((entry) => entry.id === id);
  const menuCategories = useMemo(() => {
    const byId = new Map();
    restaurant?.menu.forEach((product) => product.categories.forEach((category) => byId.set(category.id_categoria, category)));
    return Array.from(byId.values()).filter((category: any) => category.nombre?.toLowerCase() !== 'extra');
  }, [restaurant]);
  const visibleMenu = restaurant?.menu.filter((product) => (
    categoryId
      ? product.categoryIds.includes(Number(categoryId))
      : !product.isExtra
  )) || [];

  if (loading) {
    return (
      <div role="status" className="rounded-lg bg-white p-8 text-center font-bold text-wine-800 shadow-sm">
        Cargando tienda y menu...
      </div>
    );
  }

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
        <div className="h-48 bg-stone-100 p-4 md:h-64">
          <img src={restaurant.logo} alt={`Logo de ${restaurant.name}`} className="h-full w-full object-contain" />
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 id="restaurant-menu-title" className="text-2xl font-black text-stone-950">Menu</h2>
          <label className="block min-w-56 space-y-1">
            <span className="text-sm font-bold text-stone-600">Categoria</span>
            <select className="field" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">Todas</option>
              {menuCategories.map((category: any) => (
                <option key={category.id_categoria} value={category.id_categoria}>{category.nombre}</option>
              ))}
            </select>
          </label>
        </div>
        <ul className="grid gap-3 md:grid-cols-2">
          {visibleMenu.map((item) => (
            <li key={item.id}>
              <MenuItem
                item={item}
                detailTo={`/detalle/${restaurant.id}/${item.id}`}
                onAdd={() => addToCart(restaurant, item)}
              />
            </li>
          ))}
          {!visibleMenu.length && (
            <li className="rounded-lg border border-dashed border-stone-200 bg-white p-5 text-sm text-stone-500 md:col-span-2">
              No hay productos disponibles en esta categoria.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}

