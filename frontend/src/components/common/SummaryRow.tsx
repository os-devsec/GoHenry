import React from 'react';

export default function SummaryRow({ label, value, strong = false }) {
  return (
    <>
      <dt className={strong ? 'border-t border-stone-200 pt-3 text-lg font-black text-wine-800' : 'text-stone-600'}>{label}</dt>
      <dd className={`text-right ${strong ? 'border-t border-stone-200 pt-3 text-lg font-black text-wine-800' : 'text-stone-600'}`}>{value}</dd>
    </>
  );
}

