import React from 'react';
import { Search } from 'lucide-react';
import { foodImage } from '../assets.ts';
import ProductCard from '../components/restaurant/ProductCard.tsx';
import RestaurantCard from '../components/restaurant/RestaurantCard.tsx';
import { useApp } from '../context/AppContext.tsx';

export default function HomePage() {
  const { restaurants, addToCart, apiError } = useApp();
  const featuredProducts = restaurants.flatMap((restaurant) =>
    restaurant.menu.map((product) => ({ restaurant, product }))
  );

  return (
    <div className="space-y-8">
      <section aria-labelledby="home-title" className="relative overflow-hidden rounded-lg bg-wine-700 px-5 py-6 text-white shadow-soft md:px-9 md:py-10">
        <img src={foodImage} alt="" className="absolute inset-y-0 right-0 hidden h-full w-1/2 object-cover opacity-35 md:block" />
        <div className="relative max-w-xl space-y-5">
          <span className="inline-flex rounded-full bg-maize-300 px-3 py-1 text-sm font-bold text-wine-900">Pedidos en campus</span>
          <div>
            <h1 id="home-title" className="text-3xl font-black leading-tight md:text-5xl">Tiendas disponibles para pedir</h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-wine-50 md:text-base">Explora productos registrados por las tiendas de la institucion.</p>
          </div>
          <label className="flex items-center gap-2 rounded-lg bg-white p-2 text-stone-700 shadow-sm">
            <span className="sr-only">Buscar restaurante o plato</span>
            <Search aria-hidden="true" className="ml-2 text-wine-600" size={20} />
            <input className="w-full bg-transparent px-1 py-2 text-sm outline-none" placeholder="Buscar restaurante o plato" />
          </label>
        </div>
      </section>

      <section aria-labelledby="restaurants-title" className="space-y-3">
        <div>
          <h2 id="restaurants-title" className="text-2xl font-black text-wine-900">Restaurantes</h2>
          <p className="text-sm text-stone-500">Tiendas disponibles dentro de la institucion.</p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {restaurants.map((restaurant) => (
            <li key={restaurant.id}>
              <RestaurantCard restaurant={restaurant} />
            </li>
          ))}
          {!restaurants.length && (
            <EmptyState
              title="Aun no hay tiendas registradas"
              detail={apiError || 'Crea una tienda desde la API para empezar a cargar productos reales.'}
            />
          )}
        </ul>
      </section>

      <section aria-labelledby="products-title" className="space-y-3">
        <div>
          <h2 id="products-title" className="text-2xl font-black text-wine-900">Productos</h2>
          <p className="text-sm text-stone-500">Listado rapido de productos con acceso a detalle y carrito.</p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featuredProducts.map(({ restaurant, product }) => (
            <li key={`${restaurant.id}-${product.id}`}>
              <ProductCard
                restaurant={restaurant}
                product={product}
                onAdd={addToCart}
              />
            </li>
          ))}
          {!featuredProducts.length && (
            <EmptyState
              title="Aun no hay productos"
              detail="Cuando registres productos en la BDD apareceran aqui."
            />
          )}
        </ul>
      </section>
    </div>
  );
}

function EmptyState({ title, detail }) {
  return (
    <li className="rounded-lg border border-dashed border-wine-200 bg-white p-6 text-sm text-stone-600 sm:col-span-2 lg:col-span-3">
      <p className="font-black text-wine-900">{title}</p>
      <p className="mt-1">{detail}</p>
    </li>
  );
}

