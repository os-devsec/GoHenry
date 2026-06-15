import React from 'react';
import { Link } from 'react-router-dom';

export default function RestaurantCard({ restaurant }) {
  return (
    <Link to={`/restaurant/${restaurant.id}`} aria-label={`Ver tienda ${restaurant.name}`} className="group block overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-soft">
      <div className="relative h-40">
        <img src={restaurant.image} alt={restaurant.name} className="h-full w-full object-cover" />
        <span className={`absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-black ${restaurant.available ? 'bg-green-100 text-green-800' : 'bg-stone-800 text-white'}`}>
          {restaurant.available ? 'Abierta' : 'Cerrada'}
        </span>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <img src={restaurant.logo} alt="" className="h-12 w-12 rounded-lg border border-stone-100 object-cover" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-black text-stone-950">{restaurant.name}</h2>
            <p className="text-sm text-stone-500">{restaurant.category}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}

